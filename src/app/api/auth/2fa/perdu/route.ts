export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClientSansGarde2fa } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoriserPartage, ipDe } from "@/lib/auth/limiteur";
import { demanderRetrait } from "@/lib/auth/deuxFacteurs";
import { emailRetraitDeuxFacteurs } from "@/lib/auth/emailConfirmation";
import { envoyerEmail } from "@/lib/email/envoyer";

/**
 * « J'AI PERDU MON TÉLÉPHONE » — envoie, à l'adresse DU COMPTE, le lien qui retire la double
 * authentification. Décision et garde-fous : `lib/auth/deuxFacteurs` (`demanderRetrait`).
 *
 * ⚠️ CLIENT SANS LA GARDE DU SECOND FACTEUR : la personne n'a justement pas pu donner son code ;
 * sa session est `aal1`, et `createClient()` la verrait comme déconnectée.
 *
 * ⚠️ LE LIEN EST À USAGE UNIQUE ET DATÉ (une heure). Ni journalisé, ni renvoyé au client : il ne
 * sort d'ici que par l'e-mail.
 */
export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!(await autoriserPartage(admin, `2fa-perdu-ip:${ipDe(req)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ ok: false, error: "trop_de_requetes" }, { status: 429 });
  }
  const { lang } = (await req.json().catch(() => ({}))) as { lang?: string };
  const langue = String(lang ?? "fr");
  const FROM = process.env.RESEND_FROM;
  const BASE = process.env.NEXT_PUBLIC_APP_URL;
  if (!process.env.RESEND_API_KEY || !FROM || !BASE) {
    await journaliser("Lien de retrait 2FA impossible : variables d'envoi manquantes");
    return NextResponse.json({ ok: false, error: "envoi_impossible" }, { status: 503 });
  }
  const supabase = await createClientSansGarde2fa();

  const r = await demanderRetrait({
    utilisateur: async () => (await supabase.auth.getUser()).data.user,
    autoriser: (cle) => autoriserPartage(admin, cle, 3, 60 * 60_000),
    envoyerLien: async (email) => {
      const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email } as Parameters<typeof admin.auth.admin.generateLink>[0]);
      const jeton = (data as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
      if (error || !jeton) {
        await journaliser(`Lien de retrait 2FA non généré : ${error ? `${error.code ?? error.status ?? "?"} — ${error.message}` : "pas de hashed_token"}`);
        return false;
      }
      const lien = `${BASE}/auth/confirm?token_hash=${encodeURIComponent(jeton)}&type=recovery&next=/verification-2fa/retrait`;
      const { objet, html, texte } = emailRetraitDeuxFacteurs(langue, BASE, lien);
      // Le refus de Resend est journalisé par la porte unique `envoyerEmail`.
      return (await envoyerEmail("2fa", { from: FROM, to: [email], subject: objet, text: texte, html }, { url: "/api/auth/2fa/perdu", meta: { lang: langue } })).ok;
    },
  });
  return NextResponse.json(r.body, { status: r.status });
}

async function journaliser(message: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from("error_logs").insert({ user_id: null, source: "2fa", message: message.slice(0, 2000), url: "/api/auth/2fa/perdu", meta: {} });
    if (error) console.error("[2fa] journal non écrit :", error.message);
  } catch (e) {
    console.error("[2fa] journal non écrit :", e instanceof Error ? e.message : String(e));
  }
}
