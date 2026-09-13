export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailReinitialisation } from "@/lib/auth/emailConfirmation";
import { envoyerEmail } from "@/lib/email/envoyer";

/**
 * L'E-MAIL DE RÉINITIALISATION, ENVOYÉ PAR NOUS.
 *
 * ⚠️ AVANT, `supabase.auth.resetPasswordForEmail()` déclenchait le gabarit par défaut de
 * Supabase : « Reset Your Password », en anglais, sans logo, avec un lien nu — arrivé dans
 * les INDÉSIRABLES d'Outlook le 13/09/2026. On fait comme pour l'inscription : on génère le
 * lien côté serveur (`generateLink` type `recovery`) et on envoie NOTRE message, avec le
 * logo et dans la langue de la personne, depuis l'expéditeur unique `RESEND_FROM`.
 *
 * ⚠️ CETTE ROUTE NE DIT JAMAIS SI L'ADRESSE EXISTE. Elle répond `ok` dans tous les cas —
 * adresse inconnue, erreur d'envoi. Distinguer les cas transformerait « mot de passe
 * oublié » en annuaire : il suffirait d'essayer des adresses pour savoir qui a un compte.
 *
 * ⚠️ LE LIEN EST À USAGE UNIQUE ET DATÉ. Il n'est ni journalisé, ni renvoyé au client :
 * il ne sort d'ici que par l'e-mail. Il pointe vers `/auth/confirm?token_hash=…&type=recovery`,
 * que `verifyOtp` vérifie (session posée dans nos cookies), donc robuste multi-navigateur —
 * contrairement au flux PKCE qui imposait d'ouvrir le lien dans le navigateur d'origine.
 */
export async function POST(req: Request) {
  const { email, lang } = (await req.json().catch(() => ({}))) as { email?: string; lang?: string };
  const adresse = String(email ?? "").trim().toLowerCase();
  // Réponse volontairement identique : on ne renseigne pas un annuaire.
  const ok = () => NextResponse.json({ ok: true });
  if (!adresse || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(adresse)) return ok();

  const FROM = process.env.RESEND_FROM;
  const BASE = process.env.NEXT_PUBLIC_APP_URL;
  if (!process.env.RESEND_API_KEY || !FROM || !BASE) return ok();

  try {
    const admin = createAdminClient();
    // `generateLink` NE PART PAS tout seul : il rend le lien, c'est à nous de l'envoyer.
    // Pas de `redirectTo` : on n'utilise pas `action_link` (voir plus bas), donc l'URL de
    // redirection intégrée au lien Supabase ne servirait à rien. On construit le nôtre.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: adresse,
    } as Parameters<typeof admin.auth.admin.generateLink>[0]);

    // ⚠️ PAS `action_link` (il passe par supabase.co/auth/v1/verify, consomme le jeton et
    // renvoie la session dans un #fragment que le serveur ne voit pas — même piège que
    // l'inscription). On construit le lien sur le `hashed_token`, vérifié par /auth/confirm.
    const jeton = (data as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
    // Adresse sans compte : Supabase renvoie une erreur ici. On se tait (anti-annuaire).
    if (error || !jeton) return ok();
    const lien = `${BASE}/auth/confirm?token_hash=${encodeURIComponent(jeton)}&type=recovery&next=/reset-password`;

    const { objet, html, texte } = emailReinitialisation(String(lang ?? "fr"), BASE, lien);
    await envoyerEmail("reinitialisation", { from: FROM, to: [adresse], subject: objet, text: texte, html },
      { url: "/api/auth/reset", meta: { lang } });
  } catch { /* jamais d'échec visible pour l'appelant : l'échec d'envoi est journalisé */ }

  return ok();
}
