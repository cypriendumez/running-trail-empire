import { verifierRegles } from "@/lib/auth/reglesMotDePasse";
import type { ControleMotDePasse } from "@/lib/auth/motDePasseFuite";
import { sessionDeLienRecente } from "@/lib/auth/sessionLien";
import { estErreurTransitoire } from "@/lib/cron/transitoire";

/**
 * CHANGER SON MOT DE PASSE — la décision, séparée de la route `/api/auth/mot-de-passe` pour être
 * testée par son COMPORTEMENT (tests/mot-de-passe.test.ts) : chaque dépendance (session, limiteur,
 * vérification du mot de passe actuel, Have I Been Pwned, écriture GoTrue) est injectée.
 *
 * Ordre, et pourquoi :
 * 1. une session, sinon 401 — le compte est TOUJOURS celui de la session, jamais un identifiant reçu ;
 * 2. le limiteur (8 / 15 min par compte), AVANT tout le reste : sans lui, la route servirait à
 *    tester des mots de passe actuels à la chaîne sur une session volée ;
 * 3. les règles (sans réseau) ;
 * 4. le mot de passe ACTUEL, exigé sauf lien e-mail cliqué il y a moins d'une heure, ou compte
 *    sans mot de passe (ouvert avec Google) ;
 * 5. la fuite (Have I Been Pwned) ;
 * 6. l'écriture, qui transmet aussi le mot de passe actuel à GoTrue : si le réglage « Require
 *    current password » est actif chez Supabase, GoTrue le revérifie — et lui seul protège d'un
 *    appel direct à son API.
 *
 * ⚠️ CETTE ROUTE N'EST PAS UNE PORTE : quiconque tient une session peut appeler GoTrue en direct
 * (`updateUser` avec la clé publique et son jeton) et contourner règles, fuite et mot de passe
 * actuel. Seul le réglage Supabase « Require current password » ferme ce chemin — et GoTrue
 * (`Session.IsRecovery`) dispense alors les sessions de lien SANS limite d'âge : notre fenêtre
 * d'une heure ne vaut que pour le parcours normal de l'app.
 *
 * Les AUTRES sessions du compte sont déconnectées par GoTrue lui-même à chaque changement
 * (`User.UpdatePassword` → `LogoutAllExceptMe`, v2.197 lu le 08/11/2026) : inutile de le refaire.
 */

export type Reponse = { status: number; body: Record<string, unknown> };

export type UtilisateurSession = {
  id: string;
  email?: string | null;
  identities?: { provider: string }[] | null;
};

export type DependancesChangement = {
  utilisateur: () => Promise<UtilisateurSession | null>;
  jetonAcces: () => Promise<string | undefined>;
  autoriser: (cle: string) => Promise<boolean>;
  /** `captcha` : jeton Turnstile du navigateur, exigé par GoTrue pour cette connexion quand la protection CAPTCHA est active. */
  verifierActuel: (email: string, motActuel: string, captcha: string | null) => Promise<"ok" | "faux" | "captcha" | "indisponible">;
  controler: (mdp: string, email: string | null | undefined) => Promise<ControleMotDePasse>;
  ecrire: (mdp: string, motActuel: string | null) => Promise<{ error: { message: string; code?: string; status?: number } | null }>;
  journaliser: (userId: string, message: string) => Promise<void>;
};

const PAR_CODE_GOTRUE: Record<string, [string, number]> = {
  same_password: ["identique", 422],
  weak_password: ["mot_de_passe_faible", 400],
  current_password_mismatch: ["actuel_faux", 400],
  current_password_required: ["actuel_requis", 400],
  reauthentication_needed: ["reauthentification", 400],
  session_not_found: ["non_connecte", 401],
};

export async function changerMotDePasse(
  entree: { password?: unknown; actuel?: unknown; captcha?: unknown },
  d: DependancesChangement,
): Promise<Reponse> {
  const user = await d.utilisateur();
  if (!user) return { status: 401, body: { ok: false, error: "non_connecte" } };

  if (!(await d.autoriser(`mot-de-passe:${user.id}`))) return { status: 429, body: { ok: false, error: "trop_de_requetes" } };

  const mdp = typeof entree.password === "string" ? entree.password : "";
  const motActuel = typeof entree.actuel === "string" ? entree.actuel : "";

  const raisons = verifierRegles(mdp, user.email);
  if (raisons.length) return { status: 400, body: { ok: false, error: "mot_de_passe_faible", raisons } };

  // Dispense « compte sans mot de passe » SEULEMENT sur une liste d'identités connue, non vide et
  // sans identité « email » (compte Google). Liste absente ou vide = donnée manquante : on exige le
  // mot de passe actuel plutôt que de laisser passer en silence (relecture du 08/11/2026).
  const identites = user.identities;
  const sansMotDePasse = Array.isArray(identites) && identites.length > 0 && !identites.some((i) => i.provider === "email");
  if (!sansMotDePasse && !sessionDeLienRecente(await d.jetonAcces())) {
    if (!motActuel) return { status: 400, body: { ok: false, error: "actuel_requis" } };
    if (!user.email) return { status: 400, body: { ok: false, error: "reauthentification" } };
    const verdict = await d.verifierActuel(user.email, motActuel, typeof entree.captcha === "string" && entree.captcha ? entree.captcha : null);
    if (verdict === "faux") return { status: 400, body: { ok: false, error: "actuel_faux" } };
    if (verdict === "captcha") return { status: 400, body: { ok: false, error: "captcha_refuse" } };
    if (verdict !== "ok") return { status: 503, body: { ok: false, error: "indisponible" } };
  }

  const controle = await d.controler(mdp, user.email);
  if (!controle.ok) {
    return { status: 400, body: { ok: false, error: controle.error, ...(controle.error === "mot_de_passe_faible" ? { raisons: controle.raisons } : {}) } };
  }

  const { error } = await d.ecrire(mdp, motActuel || null);
  if (error) {
    const connu = error.code ? PAR_CODE_GOTRUE[error.code] : undefined;
    if (connu) return { status: connu[1], body: { ok: false, error: connu[0] } };
    if (estErreurTransitoire(error, error.status)) return { status: 503, body: { ok: false, error: "indisponible" } };
    await d.journaliser(user.id, `Mot de passe non changé : ${error.code ?? error.status ?? "?"} — ${error.message}`);
    return { status: 500, body: { ok: false, error: "echec" } };
  }
  return { status: 200, body: { ok: true, fuiteVerifiee: controle.fuiteVerifiee } };
}
