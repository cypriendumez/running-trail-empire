export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailInscription } from "@/lib/auth/emailConfirmation";
import { envoyerEmail } from "@/lib/email/envoyer";
import { domaineRecoitDuCourrier, suggestionDomaine } from "@/lib/auth/domaineCourrier";
import { statutCompte } from "@/lib/auth/statutCompte";
import { autoriser, ipDe } from "@/lib/auth/limiteur";
import { champsConsentement, CONSENTEMENT_EFFACE } from "@/lib/auth/consentement";
import { randomBytes } from "node:crypto";

/**
 * L'INSCRIPTION PAR E-MAIL, ET L'E-MAIL DE CONFIRMATION ENVOYÉ PAR NOUS.
 *
 * ⚠️ Supabase envoie le sien automatiquement à l'inscription : « Confirm your email
 * address », en anglais, depuis `noreply@mail.app.supabase.io`, sans logo. C'est le
 * PREMIER message qu'une personne reçoit, celui qui décide si elle clique. On regénère
 * donc le lien côté serveur et on envoie NOTRE message, avec le logo et dans sa langue.
 *
 * ⚠️ CETTE ROUTE DIT POURQUOI ELLE REFUSE (décision du 11/10/2026, voir `lib/auth/statut`).
 * Jusque-là elle répondait `ok` à tout, pour ne pas révéler qui a un compte : le 11/10,
 * Cyprien s'est inscrit avec une adresse déjà ouverte par Google, l'écran a dit « vérifiez
 * votre email », et rien n'est jamais arrivé. Désormais, comme dans les applications
 * courantes : adresse déjà inscrite → `compte_existant` + ses méthodes (Google, mot de
 * passe), que l'écran transforme en bouton. Le prix — tester si une adresse est inscrite —
 * est borné par le limiteur de débit.
 *
 * `renvoi: true` (page de connexion, compte jamais confirmé) : renvoie le lien sans rien
 * créer — sauf si la personne ne connaît pas le mot de passe (`motDePasseConnu: false`).
 *
 * ⚠️ PRÉ-INSCRIPTION (fermée le 11/10/2026). GoTrue (v2.197, `adminGenerateLink`) ne change
 * PAS le mot de passe d'un compte non confirmé qu'on réinscrit : il garde le PREMIER. Donc
 * quelqu'un qui inscrivait l'adresse d'un autre avec SON mot de passe récupérait le compte le
 * jour où le vrai titulaire s'inscrivait et cliquait le lien : la confirmation validait le
 * mot de passe de l'intrus. Désormais, dès qu'une adresse non confirmée est réinscrite (ou
 * qu'un lien est redemandé sans connaître le mot de passe), PERSONNE ne garde de mot de
 * passe : il devient aléatoire, et `/auth/confirm` fait choisir le sien à celui qui clique —
 * c'est-à-dire au titulaire de la boîte. L'accord aux données de santé est effacé avec : il
 * sera redemandé au titulaire. (Google qui rejoint un tel compte : GoTrue retire déjà
 * l'identité non confirmée, `RemoveUnconfirmedIdentities`.)
 *
 * L'ACCORD AUX DONNÉES DE SANTÉ est exigé (`accord: true`, la case du formulaire) et
 * ENREGISTRÉ sur le compte — voir `lib/auth/consentement`.
 *
 * ⚠️ LE LIEN EST À USAGE UNIQUE ET DATÉ. Il n'est ni journalisé, ni renvoyé au client :
 * il ne sort d'ici que par l'e-mail.
 */
export async function POST(req: Request) {
  if (!autoriser(`inscription:${ipDe(req)}`, 15, 10 * 60_000)) {
    return NextResponse.json({ ok: false, error: "trop_de_requetes" }, { status: 429 });
  }
  const debut = Date.now();
  const { email, password, fullName, lang, domaineConfirme, renvoi, motDePasseConnu, accord } = (await req.json().catch(() => ({}))) as { email?: string; password?: string; fullName?: string; lang?: string; domaineConfirme?: boolean; renvoi?: boolean; motDePasseConnu?: boolean; accord?: boolean };
  const adresse = String(email ?? "").trim().toLowerCase();
  const langue = String(lang ?? "fr");
  if (!adresse || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(adresse)) {
    return NextResponse.json({ ok: false, error: "adresse_invalide" }, { status: 400 });
  }
  const mdp = String(password ?? "");

  const FROM = process.env.RESEND_FROM;
  const BASE = process.env.NEXT_PUBLIC_APP_URL;
  if (!process.env.RESEND_API_KEY || !FROM || !BASE) {
    await journaliser(`Inscription de ${adresse} impossible : variables d'envoi manquantes`, { lang: langue });
    return NextResponse.json({ ok: false, error: "envoi_impossible" }, { status: 503 });
  }

  // ── RENVOI DEPUIS LA CONNEXION : seulement pour un compte qui attend sa confirmation ──
  if (renvoi) {
    const statut = await statutCompte(adresse);
    if (!statut) return NextResponse.json({ ok: false, error: "indisponible" }, { status: 503 });
    if (statut.compte !== "a_confirmer") {
      return NextResponse.json({ ok: false, error: statut.compte === "aucun" ? "aucun_compte" : "compte_existant", methodes: statut.methodes }, { status: 409 });
    }
    // Ni nom ni mot de passe reçus : le compte existe. Si la personne ne connaît PAS le mot
    // de passe posé à l'inscription (la connexion vient de le refuser), le lien ne doit pas
    // le confirmer : c'est exactement la pré-inscription (voir l'en-tête).
    return envoyerConfirmation(adresse, null, null, langue, BASE, FROM, statut.methodes, motDePasseConnu === false ? "conteste" : "renvoi", debut);
  }

  // ⚠️ LE MOT DE PASSE trop court : refusé avant tout, sans réseau.
  if (mdp.length < 8) {
    return NextResponse.json({ ok: false, error: "mot_de_passe_trop_court", min: 8 }, { status: 400 });
  }
  // La case d'accord (CGU + données de santé) : exigée ICI aussi, pas seulement par le HTML.
  if (accord !== true) {
    return NextResponse.json({ ok: false, error: "accord_requis" }, { status: 400 });
  }

  // ⚠️ LE DOMAINE, LUI AUSSI, DONNE UNE VRAIE ERREUR. Une adresse bien formée mais dont le
  // domaine n'a pas de serveur de courrier (« gmial.com », « outlok.fr ») recevait « c'est
  // envoyé » et la personne attendait un e-mail impossible. Personne ne peut savoir si la
  // BOÎTE existe (les fournisseurs ne répondent pas à cette question) ; c'est la faute de
  // frappe qu'on attrape ici, avant de créer quoi que ce soit.
  //
  // ⚠️ ET LE DNS NE SUFFIT PAS : « gmial.com » et « outlok.fr » EXISTENT, déposés par des
  // squatteurs de fautes de frappe — « outlok.fr » a même un serveur de courrier, pour
  // récolter ce qui s'y égare (vérifié le 13/09/2026). Une adresse à une ou deux lettres
  // d'un fournisseur courant est donc signalée D'ABORD, sans réseau, et la personne
  // tranche : corriger, ou confirmer que c'était voulu (`domaineConfirme`). Le DNS ne
  // sert qu'ensuite, pour les domaines qui n'existent pas du tout.
  const domaine = adresse.split("@")[1];
  const suggestion = suggestionDomaine(domaine);
  if (suggestion && !domaineConfirme) {
    return NextResponse.json({ ok: false, error: "domaine_douteux", domaine, suggestion }, { status: 400 });
  }
  if ((await domaineRecoitDuCourrier(domaine)) === "non") {
    return NextResponse.json({ ok: false, error: "domaine_sans_courrier", domaine, suggestion }, { status: 400 });
  }

  // ── ADRESSE DÉJÀ INSCRITE (et confirmée) : on le DIT, avec la façon d'y entrer ─────────
  // Un compte qui attend sa confirmation, lui, reçoit un nouveau lien (plus bas).
  const statut = await statutCompte(adresse);
  if (statut?.compte === "actif") {
    return NextResponse.json({ ok: false, error: "compte_existant", methodes: statut.methodes }, { status: 409 });
  }

  // ⚠️ LE NOM DOIT VOYAGER ICI, et son absence a été une VRAIE régression. L'ancien
  // `supabase.auth.signUp()` passait `data: { full_name }` ; en le remplaçant par cette
  // route j'avais oublié de reporter le champ. Résultat : tout nouvel inscrit arrivait sans
  // nom — le coach voyait une adresse e-mail à la place d'une personne, et l'avis publié
  // aurait signé « Un coureur ». C'est la métadonnée que reprend le profil à la création.
  // Compte qui attend déjà sa confirmation : réinscription = « contestée » (voir l'en-tête).
  return envoyerConfirmation(adresse, mdp, String(fullName ?? "").trim().slice(0, 80), langue, BASE, FROM, statut?.methodes,
    statut?.compte === "a_confirmer" ? "conteste" : "nouveau", debut);
}

/**
 * Génère le lien (`generateLink`, qui N'ENVOIE RIEN : c'est à nous de l'expédier — sinon deux
 * messages arriveraient) et envoie NOTRE e-mail. Dit la vérité à l'écran : refus, panne, envoi.
 *
 * `mdp`/`nom` à `null` : renvoi pour un compte existant.
 * `mode` : `nouveau` (accord enregistré), `conteste` (mot de passe aléatoire, à choisir à la
 * confirmation, accord effacé), `renvoi` (rien d'autre que le jeton).
 */
async function envoyerConfirmation(
  adresse: string, mdp: string | null, nom: string | null, lang: string, BASE: string, FROM: string,
  methodes: string[] | undefined, mode: "nouveau" | "conteste" | "renvoi", debut: number,
): Promise<NextResponse> {
  try {
    const admin = createAdminClient();
    const generer = () => admin.auth.admin.generateLink({
      type: "signup",
      email: adresse,
      ...(mdp !== null ? { password: mdp } : {}),
      ...(nom !== null ? { options: { data: { full_name: nom } } } : {}),
    } as Parameters<typeof admin.auth.admin.generateLink>[0]);
    let { data, error } = await generer();

    // Course entre la recherche et la création (ou recherche en panne) : Supabase refuse le
    // doublon d'un compte confirmé. Même réponse que plus haut.
    if (error?.code === "email_exists") {
      return NextResponse.json({ ok: false, error: "compte_existant", methodes: methodes ?? [] }, { status: 409 });
    }

    // ⚠️ PAS `action_link`. Ce lien-là passe par `supabase.co/auth/v1/verify`, qui consomme le
    // jeton PUIS renvoie chez nous avec la session dans le fragment `#access_token=…` — que le
    // serveur ne voit jamais. Notre route `/auth/confirm` recevait donc une requête sans
    // `token_hash` et répondait `/login?error=confirm` : le 13/09/2026, une inscription RÉUSSIE
    // (compte confirmé, connecté côté Supabase) affichait « lien invalide », et le second clic,
    // logique après un tel message, tombait sur `otp_expired`. On construit donc le lien sur le
    // `hashed_token`, que `/auth/confirm` vérifie lui-même (`verifyOtp`) : la session naît dans
    // nos cookies et la personne arrive sur /onboarding.
    const jetonDe = (d: typeof data) => (d as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
    const echecLien = async () => {
      await journaliser(`Lien d'inscription non généré pour ${adresse} : ${error ? `${error.code ?? error.status ?? "?"} — ${error.message}` : "pas de hashed_token"}`, { lang });
      return NextResponse.json({ ok: false, error: "envoi_impossible" }, { status: 502 });
    };
    if (error || !jetonDe(data)) return echecLien();

    // Recherche en panne : un compte créé AVANT cette requête n'est pas « nouveau ».
    const compte = (data as { user?: { id?: string; created_at?: string } } | null)?.user;
    const preexistant = mode === "nouveau" && Date.parse(String(compte?.created_at ?? "")) < debut - 5000;
    if (mode === "conteste" || preexistant) {
      // ⚠️ AVANT l'envoi, et sans repli : si le mot de passe de l'intrus ne peut pas être
      // retiré, aucun lien ne part (il le confirmerait).
      const { error: e } = compte?.id
        ? await admin.auth.admin.updateUserById(compte.id, {
            password: randomBytes(36).toString("base64url"),
            app_metadata: { mdp_a_choisir: true, ...CONSENTEMENT_EFFACE },
          })
        : { error: { message: "compte sans identifiant" } };
      if (e) {
        await journaliser(`Inscription contestée ${adresse} : mot de passe non neutralisé — ${e.message}`, { lang });
        return NextResponse.json({ ok: false, error: "envoi_impossible" }, { status: 502 });
      }
      // ⚠️ ET LE LIEN SE GÉNÈRE DE NOUVEAU, APRÈS. Changer le mot de passe remet à zéro TOUS
      // les jetons du compte (GoTrue v2.197, `UpdatePassword` : confirmation_token = "",
      // `ClearAllOneTimeTokensForUser`) : le lien obtenu plus haut est mort. Vu le 11/10/2026
      // sur un essai réel — le titulaire aurait reçu un lien « invalide ou expiré ».
      ({ data, error } = await generer());
      if (error || !jetonDe(data)) return echecLien();
    } else if (mode === "nouveau" && compte?.id) {
      const { error: e } = await admin.auth.admin.updateUserById(compte.id, { app_metadata: champsConsentement("inscription") });
      // Sans trace, l'écran `/consentement` redemandera l'accord : on n'empêche pas l'inscription.
      if (e) await journaliser(`Accord de ${adresse} non enregistré — ${e.message}`, { lang });
    }

    const lien = `${BASE}/auth/confirm?token_hash=${encodeURIComponent(String(jetonDe(data)))}&type=signup&next=/onboarding`;
    const { objet, html, texte } = emailInscription(lang, BASE, lien);
    const envoi = await envoyerEmail("confirmation", { from: FROM, to: [adresse], subject: objet, text: texte, html },
      { url: "/api/auth/confirmation", meta: { lang } });
    // Le refus de Resend est déjà au journal (porte unique) ; l'écran, lui, doit le savoir :
    // afficher « vérifiez votre email » pour un message parti nulle part, c'est le défaut
    // qu'on corrige ici.
    if (!envoi.ok) return NextResponse.json({ ok: false, error: "envoi_impossible" }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await journaliser(`Inscription de ${adresse} : exception — ${e instanceof Error ? e.message : String(e)}`, { lang });
    return NextResponse.json({ ok: false, error: "envoi_impossible" }, { status: 500 });
  }
}

/** Un échec AVANT l'envoi (lien non généré, exception) : même journal que les refus de Resend. */
async function journaliser(message: string, meta: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await createAdminClient().from("error_logs").insert({
      user_id: null, source: "confirmation", message: message.slice(0, 2000),
      url: "/api/auth/confirmation", meta,
    });
    if (error) console.error("[confirmation] journal non écrit :", error.message);
  } catch (e) {
    console.error("[confirmation] journal non écrit :", e instanceof Error ? e.message : String(e));
  }
}
