export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailInscription } from "@/lib/auth/emailConfirmation";
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
 * ⚠️ LE LIEN EST À USAGE UNIQUE ET DATÉ. Il n'est ni journalisé, ni renvoyé au client :
 * il ne sort d'ici que par l'e-mail.
 */
export async function POST(req: Request) {
  const { email, password, fullName, lang } = (await req.json().catch(() => ({}))) as { email?: string; password?: string; fullName?: string; lang?: string };
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
  const domaine = adresse.split("@")[1];
  if ((await domaineRecoitDuCourrier(domaine)) === "non") {
    return NextResponse.json(
      { ok: false, error: "domaine_sans_courrier", domaine, suggestion: suggestionDomaine(domaine) },
      { status: 400 },
    );
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
        redirectTo: `${BASE}/auth/confirm?next=/onboarding`,
      },
    } as Parameters<typeof admin.auth.admin.generateLink>[0]);

    const lien = (data as { properties?: { action_link?: string } } | null)?.properties?.action_link;
    if (error || !lien) return ok();

    const { objet, html, texte } = emailInscription(String(lang ?? "fr"), BASE, lien);
    await envoyerEmail("confirmation", { from: FROM, to: [adresse], subject: objet, text: texte, html },
      { url: "/api/auth/confirmation", meta: { lang } });
  } catch { /* jamais d'échec visible pour l'appelant : voir l'en-tête ; l'échec est journalisé */ }

  return ok();
}
