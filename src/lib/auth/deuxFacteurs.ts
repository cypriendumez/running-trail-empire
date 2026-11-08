import { aUnSecondFacteur } from "@/lib/auth/mfa";
import { sessionDeLienRecente } from "@/lib/auth/sessionLien";

/**
 * DOUBLE AUTHENTIFICATION — « J'AI PERDU MON TÉLÉPHONE » (08/11/2026).
 *
 * Choix de Cyprien : la récupération passe par un LIEN E-MAIL. Deux temps, deux routes :
 * 1. `demanderRetrait` (`/api/auth/2fa/perdu`) — depuis l'écran du code, une session ouverte avec
 *    le mot de passe (`aal1`) demande un lien. Il part à l'adresse DU COMPTE, jamais ailleurs : qui
 *    a volé le mot de passe sans la boîte mail ne reçoit rien.
 * 2. `retirerDeuxFacteurs` (`/api/auth/2fa/retirer`) — le lien cliqué (session née d'un lien
 *    e-mail il y a moins d'une heure, `lib/auth/sessionLien`) retire les facteurs, puis un AVIS
 *    part à la même adresse : si ce n'était pas le titulaire, il le sait aussitôt.
 *
 * ⚠️ CE QUE CELA VEUT DIRE, ET CYPRIEN L'A CHOISI EN CONNAISSANCE DE CAUSE : la double
 * authentification protège d'un mot de passe volé ou réutilisé (le cas courant), pas d'une boîte
 * mail compromise — qui permet déjà « mot de passe oublié ».
 *
 * Logique séparée des routes pour être testée par son comportement (`tests/deux-facteurs.test.ts`).
 */

export type Reponse = { status: number; body: Record<string, unknown> };
type Utilisateur = { id: string; email?: string | null; factors?: { id?: string; status?: string; factor_type?: string }[] | null };

export async function demanderRetrait(d: {
  utilisateur: () => Promise<Utilisateur | null>;
  autoriser: (cle: string) => Promise<boolean>;
  envoyerLien: (email: string) => Promise<boolean>;
}): Promise<Reponse> {
  const user = await d.utilisateur();
  if (!user) return { status: 401, body: { ok: false, error: "non_connecte" } };
  if (!aUnSecondFacteur(user)) return { status: 400, body: { ok: false, error: "sans_deux_facteurs" } };
  if (!user.email) return { status: 400, body: { ok: false, error: "sans_adresse" } };
  if (!(await d.autoriser(`2fa-perdu:${user.id}`))) return { status: 429, body: { ok: false, error: "trop_de_liens" } };
  return (await d.envoyerLien(user.email))
    ? { status: 200, body: { ok: true } }
    : { status: 502, body: { ok: false, error: "envoi_impossible" } };
}

export async function retirerDeuxFacteurs(d: {
  utilisateur: () => Promise<Utilisateur | null>;
  jetonAcces: () => Promise<string | undefined>;
  autoriser: (cle: string) => Promise<boolean>;
  listerFacteurs: (userId: string) => Promise<{ ids: string[] } | { erreur: string }>;
  supprimerFacteur: (userId: string, id: string) => Promise<string | null>;
  /** Déconnecte toutes les AUTRES sessions du compte ; rend l'erreur, ou `null`. */
  revoquerAutresSessions: () => Promise<string | null>;
  prevenir: (email: string) => Promise<void>;
  journaliser: (userId: string, message: string) => Promise<void>;
}): Promise<Reponse> {
  const user = await d.utilisateur();
  if (!user) return { status: 401, body: { ok: false, error: "non_connecte" } };
  // ⚠️ LA PREUVE : un lien reçu par e-mail, cliqué il y a moins d'une heure. Une session ouverte
  // avec le seul mot de passe ne retire RIEN — sinon la double authentification ne servirait à rien.
  if (!sessionDeLienRecente(await d.jetonAcces())) return { status: 403, body: { ok: false, error: "lien_requis" } };
  if (!(await d.autoriser(`2fa-retrait:${user.id}`))) return { status: 429, body: { ok: false, error: "trop_de_requetes" } };

  const liste = await d.listerFacteurs(user.id);
  if ("erreur" in liste) {
    await d.journaliser(user.id, `Retrait 2FA : facteurs illisibles — ${liste.erreur}`);
    return { status: 503, body: { ok: false, error: "indisponible" } };
  }
  for (const id of liste.ids) {
    const erreur = await d.supprimerFacteur(user.id, id);
    if (erreur) {
      await d.journaliser(user.id, `Retrait 2FA : facteur ${id} non supprimé — ${erreur}`);
      return { status: 500, body: { ok: false, error: "echec" } };
    }
  }
  // ⚠️ LES AUTRES SESSIONS TOMBENT (relecture du 08/11/2026) : une session ouverte avec un mot de
  // passe volé, laissée en attente sur l'écran du code, deviendrait PLEINEMENT valide dès que la
  // double authentification disparaît. Seule celle du titulaire, qui vient de cliquer, reste.
  // Un échec n'annule pas le retrait (déjà fait), mais se lit au journal.
  if (liste.ids.length) {
    const erreur = await d.revoquerAutresSessions();
    if (erreur) await d.journaliser(user.id, `Retrait 2FA : autres sessions non déconnectées — ${erreur}`);
  }
  if (user.email && liste.ids.length) await d.prevenir(user.email);
  return { status: 200, body: { ok: true, retires: liste.ids.length } };
}

/**
 * L'AVIS D'ACTIVATION (relecture du 08/11/2026) : quelqu'un qui connaît le mot de passe d'un compte
 * SANS double authentification pourrait l'activer avec SON téléphone et enfermer le titulaire
 * dehors. Le lien « téléphone perdu » l'en sortirait, mais encore faut-il qu'il le sache : un
 * e-mail part donc à l'adresse du compte à chaque activation. Appelé par la carte des réglages
 * juste après la vérification du premier code — la session est alors `aal2`, la garde la laisse passer.
 */
export async function avertirActivation(d: {
  utilisateur: () => Promise<Utilisateur | null>;
  autoriser: (cle: string) => Promise<boolean>;
  prevenir: (email: string) => Promise<boolean>;
}): Promise<Reponse> {
  const user = await d.utilisateur();
  if (!user) return { status: 401, body: { ok: false, error: "non_connecte" } };
  // Rien d'activé : pas d'avis (sinon la route servirait à envoyer des e-mails trompeurs).
  if (!aUnSecondFacteur(user)) return { status: 400, body: { ok: false, error: "sans_deux_facteurs" } };
  if (!user.email) return { status: 400, body: { ok: false, error: "sans_adresse" } };
  if (!(await d.autoriser(`2fa-activee:${user.id}`))) return { status: 429, body: { ok: false, error: "trop_de_requetes" } };
  return (await d.prevenir(user.email))
    ? { status: 200, body: { ok: true } }
    : { status: 502, body: { ok: false, error: "envoi_impossible" } };
}
