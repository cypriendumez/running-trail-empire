export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailInscription } from "@/lib/auth/emailConfirmation";

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
  const { email, password, lang } = (await req.json().catch(() => ({}))) as { email?: string; password?: string; lang?: string };
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
      options: { redirectTo: `${BASE}/auth/confirm?next=/onboarding` },
    } as Parameters<typeof admin.auth.admin.generateLink>[0]);

    const lien = (data as { properties?: { action_link?: string } } | null)?.properties?.action_link;
    if (error || !lien) return ok();

    const { objet, html, texte } = emailInscription(String(lang ?? "fr"), BASE, lien);
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [adresse], subject: objet, text: texte, html }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { /* jamais d'échec visible : voir l'en-tête */ }

  return ok();
}
