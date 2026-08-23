import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailEditeur } from "@/lib/admin/acces";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailNouvelInscrit } from "@/lib/notify/nouvelInscrit";

/**
 * Confirmation d'email (et autres OTP par lien) — flux `token_hash` recommandé
 * pour @supabase/ssr : fonctionne même si le lien est ouvert sur un autre
 * appareil/navigateur que celui de l'inscription (contrairement au PKCE/code).
 *
 * Le template d'email Supabase « Confirm signup » doit pointer vers :
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Nouveaux comptes → onboarding tant qu'il n'est pas terminé
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();
        // ── PRÉVENIR L'ÉDITEUR ────────────────────────────────────────────
        // ⚠️ ICI, ET PAS À LA SOUMISSION DU FORMULAIRE. À la saisie, une faute de
        // frappe, une adresse jetable ou un robot déclencheraient l'alerte. À la
        // confirmation, l'adresse est PROUVÉE : quelqu'un a reçu le message et a
        // cliqué. Et le lien étant à usage unique, `verifyOtp` échoue au second clic —
        // on ne peut donc pas prévenir deux fois pour le même compte.
        //
        // Best effort : un e-mail qui ne part pas ne doit pas empêcher quelqu'un
        // d'entrer dans l'application qu'il vient de confirmer.
        if (type === "signup" || type === "email") {
          void alerterInscription(supabase, user.id, origin);
        }

        if (!profile?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=confirm`);
}


/**
 * Envoie l'alerte « nouvel inscrit » à l'éditeur. Ne lève jamais.
 *
 * ⚠️ `premier` se calcule en comptant les profils : sur un site qu'on vient de publier,
 * savoir que c'est LE PREMIER change la nature de l'information. Le compte lui-même est
 * déjà créé par le déclencheur `handle_new_user`, donc il est inclus — on compare donc
 * à 1, pas à 0.
 */
async function alerterInscription(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  origin: string,
): Promise<void> {
  try {
    const CLE = process.env.RESEND_API_KEY;
    const FROM = process.env.RESEND_FROM;
    const DEST = emailEditeur();
    // Pas de destinataire exploitable → on n'envoie PAS (voir emailEditeur).
    if (!CLE || !FROM || !DEST) return;

    const admin = createAdminClient();
    const [{ data: profil }, { count }] = await Promise.all([
      admin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
      admin.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    const email = String(profil?.email ?? "");
    const nom = String(profil?.full_name ?? "").trim() || email.split("@")[0] || "Un coureur";
    const { objet, html, texte } = emailNouvelInscrit({
      nom, email, base: origin, premier: (count ?? 0) <= 1,
    });

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [DEST], subject: objet, text: texte, html }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* l'inscription vaut, l'alerte est un bonus */ }
}
