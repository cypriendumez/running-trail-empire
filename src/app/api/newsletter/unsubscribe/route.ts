export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jetonValide } from "@/lib/newsletter/token";

/**
 * GET /api/newsletter/unsubscribe?e=<email>&t=<jeton>
 *
 * En GET à dessein : un lien d'e-mail se clique, il ne se soumet pas. C'est aussi ce
 * que « désinscription en un clic » veut dire — aucune page intermédiaire, aucun
 * formulaire, aucune connexion demandée. Le pied de page le promettait déjà ; il n'y
 * avait simplement rien derrière.
 *
 * On ne SUPPRIME pas la ligne, on marque `unsubscribed`. Supprimer perdrait la trace du
 * refus, et une réinscription accidentelle par un import futur renverrait des e-mails à
 * quelqu'un qui n'en veut plus. Le refus est une information à conserver.
 *
 * La réponse est une page HTML minimale et autonome : elle doit s'afficher correctement
 * dans le navigateur intégré d'un client de messagerie, où rien ne garantit que le CSS
 * du site se charge.
 */

const page = (titre: string, message: string, ok: boolean) =>
  new NextResponse(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${titre} — Pacevo</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff;color:#18181b">
<div style="max-width:34rem;margin:0 auto;padding:4rem 1.5rem;text-align:center">
  <div style="font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${ok ? "#059669" : "#a1a1aa"}">Pacevo</div>
  <h1 style="margin:1.25rem 0 .75rem;font-size:1.6rem;line-height:1.25">${titre}</h1>
  <p style="margin:0;color:#52525b;line-height:1.7">${message}</p>
  <a href="/" style="display:inline-block;margin-top:2rem;padding:.7rem 1.25rem;border-radius:.75rem;background:#059669;color:#fff;text-decoration:none;font-weight:600">Retour au site</a>
</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = String(searchParams.get("e") ?? "").trim().toLowerCase();
  const jeton = String(searchParams.get("t") ?? "");

  if (!email || !jetonValide(email, jeton)) {
    return page(
      "Ce lien n'est plus valide",
      "Le lien de désinscription est incomplet ou a expiré. Écris-nous et nous te retirons de la liste à la main.",
      false,
    );
  }

  try {
    await createAdminClient()
      .from("newsletter_subscribers")
      .update({ unsubscribed: true })
      .eq("email", email);
  } catch {
    return page(
      "La désinscription a échoué",
      "Quelque chose n'a pas fonctionné de notre côté. Réessaie dans un instant, ou écris-nous.",
      false,
    );
  }

  return page(
    "C'est fait, tu es désinscrit",
    "Tu ne recevras plus le résumé hebdomadaire. Ton compte et tes données d'entraînement ne sont pas affectés.",
    true,
  );
}
