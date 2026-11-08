export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoriserPartage } from "@/lib/auth/limiteur";
import { avertirActivation } from "@/lib/auth/deuxFacteurs";
import { emailDeuxFacteursActivee } from "@/lib/auth/emailConfirmation";
import { envoyerEmail } from "@/lib/email/envoyer";

/**
 * L'AVIS « DOUBLE AUTHENTIFICATION ACTIVÉE », envoyé à l'adresse du compte juste après l'activation
 * (carte des réglages). Décision : `lib/auth/deuxFacteurs` (`avertirActivation`).
 *
 * Client AVEC la garde du second facteur : la session vient de donner son premier code, elle est
 * `aal2` ; une session `aal1` d'un compte protégé n'a rien à faire ici.
 */
export async function POST(req: Request) {
  const { lang } = (await req.json().catch(() => ({}))) as { lang?: string };
  const langue = String(lang ?? "fr");
  const supabase = await createClient();
  const admin = createAdminClient();
  const r = await avertirActivation({
    utilisateur: async () => (await supabase.auth.getUser()).data.user,
    autoriser: (cle) => autoriserPartage(admin, cle, 3, 60 * 60_000),
    prevenir: async (email) => {
      const FROM = process.env.RESEND_FROM;
      const BASE = process.env.NEXT_PUBLIC_APP_URL;
      if (!process.env.RESEND_API_KEY || !FROM || !BASE) {
        // Le seul garde-fou contre une activation par un tiers : son absence se lit au journal.
        await journaliser("Avis d'activation 2FA non envoyé : variables d'envoi manquantes");
        return false;
      }
      const { objet, html, texte } = emailDeuxFacteursActivee(langue, BASE);
      // Un refus de Resend est journalisé par la porte unique `envoyerEmail`.
      return (await envoyerEmail("2fa", { from: FROM, to: [email], subject: objet, text: texte, html }, { url: "/api/auth/2fa/activee", meta: { lang: langue } })).ok;
    },
  });
  return NextResponse.json(r.body, { status: r.status });
}

async function journaliser(message: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from("error_logs").insert({ user_id: null, source: "2fa", message, url: "/api/auth/2fa/activee", meta: {} });
    if (error) console.error("[2fa] journal non écrit :", error.message);
  } catch (e) {
    console.error("[2fa] journal non écrit :", e instanceof Error ? e.message : String(e));
  }
}
