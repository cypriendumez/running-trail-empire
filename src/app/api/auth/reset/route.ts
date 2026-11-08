export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailReinitialisation } from "@/lib/auth/emailConfirmation";
import { envoyerEmail } from "@/lib/email/envoyer";
import { statutCompte } from "@/lib/auth/statutCompte";
import { fournisseurDe, sansMotDePasse, statutDepuisUtilisateur } from "@/lib/auth/statut";
import { autoriserPartage, cleParAdresse, ipDe } from "@/lib/auth/limiteur";
import { controlerCaptcha } from "@/lib/auth/turnstile";

/**
 * L'E-MAIL DE RÉINITIALISATION, ENVOYÉ PAR NOUS.
 *
 * ⚠️ AVANT, `supabase.auth.resetPasswordForEmail()` déclenchait le gabarit par défaut de
 * Supabase : « Reset Your Password », en anglais, sans logo, avec un lien nu — arrivé dans
 * les INDÉSIRABLES d'Outlook le 13/09/2026. On fait comme pour l'inscription : on génère le
 * lien côté serveur (`generateLink` type `recovery`) et on envoie NOTRE message, avec le
 * logo et dans la langue de la personne, depuis l'expéditeur unique `RESEND_FROM`.
 *
 * ⚠️ UNE ADRESSE SANS COMPTE EST DITE À L'ÉCRAN (décision du 11/10/2026, voir
 * `lib/auth/statut`) : avant, « envoyé » s'affichait quand même et la personne attendait un
 * e-mail qui ne partirait jamais. Limiteur de débit : 10 demandes / 10 min / IP.
 *
 * Compte ouvert avec Google, sans mot de passe : le même lien sert à en CHOISIR un premier
 * (GoTrue v2.197 : `addingFirstPassword`), et l'e-mail le dit ainsi — pas « réinitialise ».
 *
 * ⚠️ LE LIEN EST À USAGE UNIQUE ET DATÉ. Il n'est ni journalisé, ni renvoyé au client :
 * il ne sort d'ici que par l'e-mail. Il pointe vers `/auth/confirm?token_hash=…&type=recovery`,
 * que `verifyOtp` vérifie (session posée dans nos cookies), donc robuste multi-navigateur —
 * contrairement au flux PKCE qui imposait d'ouvrir le lien dans le navigateur d'origine.
 */
export async function POST(req: Request) {
  const limiteurAdmin = createAdminClient();
  if (!(await autoriserPartage(limiteurAdmin, `reset:${ipDe(req)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ ok: false, error: "trop_de_requetes" }, { status: 429 });
  }
  const { email, lang, captcha } = (await req.json().catch(() => ({}))) as { email?: string; lang?: string; captcha?: unknown };
  const adresse = String(email ?? "").trim().toLowerCase();
  if (!adresse || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(adresse)) {
    return NextResponse.json({ ok: false, error: "adresse_invalide" }, { status: 400 });
  }
  // ⚠️ CAPTCHA (en sommeil sans `TURNSTILE_SECRET_KEY`) : vérifié ICI, car GoTrue dispense de
  // CAPTCHA l'appel `generateLink` fait avec la clé d'administration. Et AVANT le compteur par
  // adresse (relecture du 08/11/2026) : sinon un robot sans jeton épuisait le quota de l'adresse
  // d'un tiers avant d'être refusé, et privait la personne de son lien pendant 10 minutes.
  if ((await controlerCaptcha(captcha, ipDe(req), "/api/auth/reset")) === "refuse") {
    return NextResponse.json({ ok: false, error: "captcha_refuse" }, { status: 400 });
  }
  // ⚠️ ET PAR ADRESSE : 3 liens par tranche de 10 minutes au plus pour une même boîte, quelle que
  // soit l'IP qui les demande. Le compteur par IP seul laissait un script tournant sur plusieurs
  // adresses IP inonder une personne de liens. La fenêtre est COURTE exprès : n'importe qui peut
  // épuiser ce compteur pour l'adresse d'un autre, et un plafond à l'heure aurait permis de priver
  // quelqu'un de « mot de passe oublié » pendant une heure. Ici : 18 e-mails par heure au pire,
  // 10 minutes de blocage au pire, et un message qui dit d'aller voir la boîte (`trop_de_liens`).
  if (!(await autoriserPartage(limiteurAdmin, cleParAdresse("reset-adresse", adresse), 3, 10 * 60_000))) {
    return NextResponse.json({ ok: false, error: "trop_de_liens" }, { status: 429 });
  }

  const FROM = process.env.RESEND_FROM;
  const BASE = process.env.NEXT_PUBLIC_APP_URL;
  if (!process.env.RESEND_API_KEY || !FROM || !BASE) {
    return NextResponse.json({ ok: false, error: "envoi_impossible" }, { status: 503 });
  }

  const statut = await statutCompte(adresse);
  if (statut?.compte === "aucun") return NextResponse.json({ ok: false, error: "aucun_compte" }, { status: 404 });

  try {
    const admin = createAdminClient();
    // `generateLink` NE PART PAS tout seul : il rend le lien, c'est à nous de l'envoyer.
    // Pas de `redirectTo` : on n'utilise pas `action_link` (voir plus bas), donc l'URL de
    // redirection intégrée au lien Supabase ne servirait à rien. On construit le nôtre.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: adresse,
    } as Parameters<typeof admin.auth.admin.generateLink>[0]);

    // Recherche en panne, ou compte supprimé entre-temps : Supabase le dit à son tour.
    if (error?.code === "user_not_found") return NextResponse.json({ ok: false, error: "aucun_compte" }, { status: 404 });
    // ⚠️ PAS `action_link` (il passe par supabase.co/auth/v1/verify, consomme le jeton et
    // renvoie la session dans un #fragment que le serveur ne voit pas — même piège que
    // l'inscription). On construit le lien sur le `hashed_token`, vérifié par /auth/confirm.
    const jeton = (data as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
    if (error || !jeton) {
      // Relecture du 08/11/2026 : cette panne de « mot de passe oublié » ne laissait AUCUNE trace.
      await journaliser(`Lien de réinitialisation non généré : ${error ? `${error.code ?? error.status ?? "?"} — ${error.message}` : "pas de hashed_token"}`);
      return NextResponse.json({ ok: false, error: "envoi_impossible" }, { status: 502 });
    }
    const lien = `${BASE}/auth/confirm?token_hash=${encodeURIComponent(jeton)}&type=recovery&next=/reset-password`;

    // Compte sans mot de passe (Google seul) : « choisis ton mot de passe ».
    const { methodes } = statutDepuisUtilisateur(data.user);
    const premier = sansMotDePasse(methodes) ? fournisseurDe(methodes) : null;
    const { objet, html, texte } = emailReinitialisation(String(lang ?? "fr"), BASE, lien, premier);
    const envoi = await envoyerEmail("reinitialisation", { from: FROM, to: [adresse], subject: objet, text: texte, html },
      { url: "/api/auth/reset", meta: { lang } });
    if (!envoi.ok) return NextResponse.json({ ok: false, error: "envoi_impossible" }, { status: 502 });
  } catch (e) {
    await journaliser(`Réinitialisation : exception — ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ ok: false, error: "envoi_impossible" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Un échec AVANT l'envoi (lien non généré, exception) : le refus de Resend, lui, est journalisé par `envoyerEmail`. */
async function journaliser(message: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from("error_logs").insert({
      user_id: null, source: "reinitialisation", message: message.slice(0, 2000), url: "/api/auth/reset", meta: {},
    });
    if (error) console.error("[reinitialisation] journal non écrit :", error.message);
  } catch (e) {
    console.error("[reinitialisation] journal non écrit :", e instanceof Error ? e.message : String(e));
  }
}
