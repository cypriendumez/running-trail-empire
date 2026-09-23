import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailEditeur } from "@/lib/admin/acces";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailNouvelInscrit } from "@/lib/notify/nouvelInscrit";
import { envoyerEmail } from "@/lib/email/envoyer";

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
      // ⚠️ SEULE UNE CONFIRMATION D'INSCRIPTION PASSE PAR L'ONBOARDING ET L'ALERTE.
      // Une RÉCUPÉRATION de mot de passe (`type=recovery`) doit filer droit sur
      // `next` (= /reset-password) : y intercaler /onboarding empêcherait quelqu'un
      // dont l'onboarding n'est pas fini de changer son mot de passe, et l'alerte
      // « nouvel inscrit » sonnerait pour un compte qui existe déjà.
      if (type === "signup" || type === "email") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // ── PRÉVENIR L'ÉDITEUR ────────────────────────────────────────────
          // ⚠️ ICI, ET PAS À LA SOUMISSION DU FORMULAIRE. À la saisie, une faute de
          // frappe, une adresse jetable ou un robot déclencheraient l'alerte. À la
          // confirmation, l'adresse est PROUVÉE : quelqu'un a reçu le message et a
          // cliqué. Et le lien étant à usage unique, `verifyOtp` échoue au second clic —
          // on ne peut donc pas prévenir deux fois pour le même compte.
          //
          // Best effort : un e-mail qui ne part pas ne doit pas empêcher quelqu'un
          // d'entrer dans l'application qu'il vient de confirmer.
          void alerterInscription(supabase, user.id, origin);

          // Nouveaux comptes → onboarding tant qu'il n'est pas terminé
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", user.id)
            .single();
          if (!profile?.onboarding_completed) {
            return NextResponse.redirect(`${origin}/onboarding`);
          }
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
 * ⚠️ DEUX VERROUS, PARCE QUE LE PREMIER NE SUFFISAIT PAS. Le commentaire d'origine
 * affirmait qu'on « ne peut pas prévenir deux fois pour le même compte, le lien étant à
 * usage unique ». C'est faux : chaque lien REGÉNÉRÉ est un nouveau jeton. Un renvoi de
 * confirmation suivi de deux clics, ou une connexion par lien (`type=email`), refaisait
 * sonner l'alerte — Cyprien a reçu plusieurs fois « nouvel inscrit : Cyprien Dumez »
 * pour son propre compte, créé des mois plus tôt (23/09/2026).
 *
 *  1. LE COMPTE DOIT ÊTRE NEUF. Au-delà de `FENETRE_INSCRIPTION_MS`, ce n'est pas une
 *     inscription, c'est une connexion — quel que soit le type de lien.
 *  2. ON N'ALERTE QU'UNE FOIS. La trace est écrite dans `notifications`, et relue avant
 *     tout envoi.
 *
 * ⚠️ `premier` se calcule en comptant les profils : sur un site qu'on vient de publier,
 * savoir que c'est LE PREMIER change la nature de l'information. Le compte lui-même est
 * déjà créé par le déclencheur `handle_new_user`, donc il est inclus — on compare donc
 * à 1, pas à 0.
 */
/** Au-delà de ce délai après la création du compte, ce n'est plus une inscription. */
const FENETRE_INSCRIPTION_MS = 24 * 60 * 60 * 1000;
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
    const [{ data: profil }, { count }, { data: dejaDit }] = await Promise.all([
      admin.from("profiles").select("full_name, email, created_at").eq("id", userId).maybeSingle(),
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("notifications").select("id").eq("user_id", userId).eq("type", "alerte_inscription").limit(1).maybeSingle(),
    ]);

    // VERROU 1 — le compte doit être neuf. Une connexion des mois plus tard n'est pas
    // une inscription, quel que soit le type de lien qui a servi à la faire.
    const creeA = Date.parse(String(profil?.created_at ?? ""));
    if (Number.isFinite(creeA) && Date.now() - creeA > FENETRE_INSCRIPTION_MS) return;
    // VERROU 2 — une seule alerte par compte, pour toujours.
    if (dejaDit) return;

    const email = String(profil?.email ?? "");
    const nom = String(profil?.full_name ?? "").trim() || email.split("@")[0] || "Un coureur";
    const { objet, html, texte } = emailNouvelInscrit({
      nom, email, base: origin, premier: (count ?? 0) <= 1,
    });

    // ⚠️ LA TRACE S'ÉCRIT AVANT L'ENVOI. Écrite après, un envoi lent puis rejoué
    // laisserait passer un doublon ; et une alerte manquée vaut mieux qu'une alerte
    // répétée, qui use la confiance dans toutes les autres.
    const { error: erreurTrace } = await admin.from("notifications").insert({
      user_id: userId, type: "alerte_inscription", title: "Alerte nouvel inscrit envoyée", body: email,
    });
    if (erreurTrace) console.error("[inscription] trace non écrite :", erreurTrace.message);

    await envoyerEmail("inscription", { from: FROM, to: [DEST], subject: objet, text: texte, html },
      { delaiMs: 8000, url: "/auth/confirm", meta: { inscrit: email } });
  } catch { /* l'inscription vaut, l'alerte est un bonus ; l'échec d'envoi est déjà journalisé */ }
}
