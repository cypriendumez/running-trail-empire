export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailCompteExistant, emailInscription } from "@/lib/auth/emailConfirmation";
import { envoyerEmail } from "@/lib/email/envoyer";
import { domaineRecoitDuCourrier, suggestionDomaine } from "@/lib/auth/domaineCourrier";

/**
 * L'E-MAIL DE CONFIRMATION, ENVOYÉ PAR NOUS.
 *
 * ⚠️ Supabase envoie le sien automatiquement à l'inscription : « Confirm your email
 * address », en anglais, depuis `noreply@mail.app.supabase.io`, sans logo. C'est le
 * PREMIER message qu'une personne reçoit, celui qui décide si elle clique. On regénère
 * donc le lien côté serveur et on envoie NOTRE message, avec le logo et dans sa langue.
 *
 * ⚠️ CETTE ROUTE NE DIT JAMAIS SI L'ADRESSE EXISTE. Elle répond `ok` dans tous les cas —
 * adresse inconnue, déjà confirmée, erreur d'envoi. Une réponse qui distinguerait les
 * cas transformerait le formulaire d'inscription en annuaire : il suffirait d'essayer
 * des adresses pour savoir qui a un compte. C'est la même règle que « mot de passe
 * oublié », et elle vaut ici pour la même raison.
 *
 * ⚠️ MAIS LA BOÎTE, ELLE, REÇOIT TOUJOURS QUELQUE CHOSE. Adresse neuve → le lien de
 * confirmation ; adresse déjà inscrite → « tu as déjà un compte », avec la façon d'y entrer.
 * Seul le titulaire lit ce message : l'annuaire reste fermé, et personne n'attend en vain.
 *
 * ⚠️ LE LIEN EST À USAGE UNIQUE ET DATÉ. Il n'est ni journalisé, ni renvoyé au client :
 * il ne sort d'ici que par l'e-mail.
 */
export async function POST(req: Request) {
  const { email, password, fullName, lang, domaineConfirme } = (await req.json().catch(() => ({}))) as { email?: string; password?: string; fullName?: string; lang?: string; domaineConfirme?: boolean };
  const adresse = String(email ?? "").trim().toLowerCase();
  // Réponse volontairement identique : on ne renseigne pas un annuaire.
  const ok = () => NextResponse.json({ ok: true });
  if (!adresse || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(adresse)) return ok();

  // ⚠️ LE MOT DE PASSE, LUI, DONNE UNE VRAIE ERREUR. Sa longueur ne dit rien sur
  // l'existence d'un compte : la taire ferait cliquer dans le vide quelqu'un dont le
  // mot de passe est simplement trop court. On ne se tait que sur ce qui renseignerait
  // un annuaire.
  const mdp = String(password ?? "");
  if (mdp.length < 8) {
    return NextResponse.json({ ok: false, error: "mot_de_passe_trop_court", min: 8 }, { status: 400 });
  }

  // ⚠️ LE DOMAINE, LUI AUSSI, DONNE UNE VRAIE ERREUR. Une adresse bien formée mais dont le
  // domaine n'a pas de serveur de courrier (« gmial.com », « outlok.fr ») recevait « c'est
  // envoyé » et la personne attendait un e-mail impossible. Dire que le DOMAINE ne reçoit
  // rien ne renseigne aucun annuaire : ça parle du fournisseur, pas d'un compte Pacevo.
  // Personne ne peut savoir si la BOÎTE existe (les fournisseurs ne répondent pas à cette
  // question) ; c'est la faute de frappe qu'on attrape ici, avant de créer quoi que ce soit.
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

  const CLE = process.env.RESEND_API_KEY;
  const FROM = process.env.RESEND_FROM;
  const BASE = process.env.NEXT_PUBLIC_APP_URL;
  if (!CLE || !FROM || !BASE) return ok();

  try {
    const admin = createAdminClient();
    // `generateLink` NE PART PAS tout seul : il rend le lien, c'est à nous de l'envoyer.
    // C'est exactement ce qu'il faut ici — sinon deux messages arriveraient.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email: adresse,
      password: mdp,
      options: {
        // ⚠️ LE NOM DOIT VOYAGER ICI, et son absence a été une VRAIE régression.
        // L'ancien `supabase.auth.signUp()` passait `data: { full_name }` ; en le
        // remplaçant par cette route j'avais oublié de reporter le champ. Résultat :
        // tout nouvel inscrit arrivait sans nom — le coach voyait une adresse e-mail à
        // la place d'une personne, et l'avis publié aurait signé « Un coureur ».
        // C'est la métadonnée que reprend le profil à la création du compte.
        data: { full_name: String(fullName ?? "").trim().slice(0, 80) },
      },
    } as Parameters<typeof admin.auth.admin.generateLink>[0]);

    // ⚠️ PAS `action_link`. Ce lien-là passe par `supabase.co/auth/v1/verify`, qui consomme le
    // jeton PUIS renvoie chez nous avec la session dans le fragment `#access_token=…` — que le
    // serveur ne voit jamais. Notre route `/auth/confirm` recevait donc une requête sans
    // `token_hash` et répondait `/login?error=confirm` : le 13/09/2026, une inscription RÉUSSIE
    // (compte confirmé, connecté côté Supabase) affichait « lien invalide », et le second clic,
    // logique après un tel message, tombait sur `otp_expired`. On construit donc le lien sur le
    // `hashed_token`, que `/auth/confirm` vérifie lui-même (`verifyOtp`) : la session naît dans
    // nos cookies et la personne arrive sur /onboarding.
    const jeton = (data as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;

    // ⚠️ ADRESSE DÉJÀ PRISE : avant le 11/10/2026, ON N'ENVOYAIT RIEN. L'écran affichait
    // « Vérifiez votre email » et la personne attendait un message qui ne partirait jamais
    // (vécu par Cyprien avec une adresse déjà ouverte par Google). Supabase refuse le
    // doublon d'un compte CONFIRMÉ (`email_exists`, sans rien écrire) ; on écrit donc au
    // titulaire de l'adresse que son compte existe, et comment y entrer. La réponse à
    // l'écran reste la même (`ok`) : l'annuaire reste fermé, seule la boîte est renseignée.
    if (error?.code === "email_exists") {
      await prevenirCompteExistant(admin, adresse, String(lang ?? "fr"), BASE, FROM);
      return ok();
    }
    // Tout autre refus était muet lui aussi : il va au journal (/admin › Bugs).
    if (error || !jeton) {
      await journaliser(`Lien d'inscription non généré pour ${adresse} : ${error ? `${error.code ?? error.status ?? "?"} — ${error.message}` : "pas de hashed_token"}`, { lang });
      return ok();
    }
    const lien = `${BASE}/auth/confirm?token_hash=${encodeURIComponent(jeton)}&type=signup&next=/onboarding`;

    const { objet, html, texte } = emailInscription(String(lang ?? "fr"), BASE, lien);
    await envoyerEmail("confirmation", { from: FROM, to: [adresse], subject: objet, text: texte, html },
      { url: "/api/auth/confirmation", meta: { lang } });
  } catch (e) {
    // Jamais d'échec visible pour l'appelant (voir l'en-tête) — mais jamais muet non plus.
    await journaliser(`Inscription de ${adresse} : exception — ${e instanceof Error ? e.message : String(e)}`, { lang });
  }

  return ok();
}

/**
 * Écrit au titulaire d'une adresse déjà inscrite : son compte existe, voici comment y entrer.
 *
 * Le lien joint est un lien `recovery` (même forme que « mot de passe oublié ») : il permet
 * de choisir un mot de passe, y compris le PREMIER d'un compte ouvert avec Google. Il ne
 * sort d'ici que par l'e-mail, vers la boîte du titulaire — exactement comme celui de
 * `/api/auth/reset`, que n'importe qui peut déjà déclencher.
 */
async function prevenirCompteExistant(
  admin: ReturnType<typeof createAdminClient>, adresse: string, lang: string, BASE: string, FROM: string,
): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: adresse,
  } as Parameters<typeof admin.auth.admin.generateLink>[0]);
  const jeton = (data as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
  if (error || !jeton) {
    await journaliser(`Compte existant ${adresse} : lien de mot de passe non généré — ${error ? `${error.code ?? error.status ?? "?"} — ${error.message}` : "pas de hashed_token"}`, { lang });
    return;
  }
  const compte = data.user;
  const fournisseurs = Array.isArray(compte?.app_metadata?.providers)
    ? (compte.app_metadata.providers as unknown[]).map(String)
    : [String(compte?.app_metadata?.provider ?? "email")];
  const lien = `${BASE}/auth/confirm?token_hash=${encodeURIComponent(jeton)}&type=recovery&next=/reset-password`;

  const { objet, html, texte } = emailCompteExistant(lang, BASE, lien, fournisseurs);
  await envoyerEmail("compte-existant", { from: FROM, to: [adresse], subject: objet, text: texte, html },
    { url: "/api/auth/confirmation", userId: compte?.id ?? null, meta: { lang, fournisseurs } });
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
