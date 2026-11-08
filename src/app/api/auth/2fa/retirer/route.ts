export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClientSansGarde2fa } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoriserPartage } from "@/lib/auth/limiteur";
import { retirerDeuxFacteurs } from "@/lib/auth/deuxFacteurs";
import { emailDeuxFacteursRetiree } from "@/lib/auth/emailConfirmation";
import { envoyerEmail } from "@/lib/email/envoyer";

/**
 * RETIRE LA DOUBLE AUTHENTIFICATION, après un clic sur le lien « J'ai perdu mon téléphone ».
 * Exige une session née d'un lien e-mail il y a moins d'une heure ; voir `lib/auth/deuxFacteurs`.
 *
 * ⚠️ PAR L'API D'ADMINISTRATION : GoTrue n'accepte de supprimer un facteur vérifié que depuis une
 * session `aal2` — précisément ce que la personne n'a plus. La preuve, ici, c'est le lien.
 */
export async function POST(req: Request) {
  const { lang } = (await req.json().catch(() => ({}))) as { lang?: string };
  const langue = String(lang ?? "fr");
  const supabase = await createClientSansGarde2fa();
  const admin = createAdminClient();

  const r = await retirerDeuxFacteurs({
    utilisateur: async () => (await supabase.auth.getUser()).data.user,
    // Lu APRÈS `getUser()`, qui a fait valider ce même jeton par GoTrue.
    jetonAcces: async () => (await supabase.auth.getSession()).data.session?.access_token,
    autoriser: (cle) => autoriserPartage(admin, cle, 5, 60 * 60_000),
    listerFacteurs: async (userId) => {
      const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
      return error ? { erreur: error.message } : { ids: (data?.factors ?? []).map((f) => f.id) };
    },
    supprimerFacteur: async (userId, id) => {
      const { error } = await admin.auth.admin.mfa.deleteFactor({ id, userId });
      return error ? error.message : null;
    },
    // Avec le jeton de CETTE session : GoTrue révoque toutes les autres du compte (`scope: others`).
    revoquerAutresSessions: async () => {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      return error ? error.message : null;
    },
    prevenir: async (email) => {
      const FROM = process.env.RESEND_FROM;
      const BASE = process.env.NEXT_PUBLIC_APP_URL;
      if (!FROM || !BASE) { await journaliser(null, "Avis de retrait 2FA non envoyé : variables d'envoi manquantes"); return; }
      const { objet, html, texte } = emailDeuxFacteursRetiree(langue, BASE);
      // Best effort : un avis qui ne part pas est journalisé par `envoyerEmail`, et n'annule pas le retrait.
      await envoyerEmail("2fa", { from: FROM, to: [email], subject: objet, text: texte, html }, { url: "/api/auth/2fa/retirer", meta: { lang: langue } });
    },
    journaliser,
  });
  return NextResponse.json(r.body, { status: r.status });
}

async function journaliser(userId: string | null, message: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from("error_logs").insert({ user_id: userId, source: "2fa", message: message.slice(0, 2000), url: "/api/auth/2fa/retirer", meta: {} });
    if (error) console.error("[2fa] journal non écrit :", error.message);
  } catch (e) {
    console.error("[2fa] journal non écrit :", e instanceof Error ? e.message : String(e));
  }
}
