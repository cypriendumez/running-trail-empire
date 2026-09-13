export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ENREGISTRE L'ABONNEMENT PUSH DU NAVIGATEUR POUR L'ATHLÈTE CONNECTÉ.
 *
 * ⚠️ AUTHENTIFIÉE, ET C'EST INDISPENSABLE : un abonnement push est lié à une personne — s'en
 * remettre à un identifiant fourni par le client permettrait d'inscrire l'appareil de
 * quelqu'un d'autre. On lit donc l'utilisateur de la SESSION, jamais du corps.
 *
 * L'`endpoint` est unique par appareil : on fait un upsert dessus (réabonnement = même ligne
 * mise à jour, pas de doublon).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const sub = (await req.json().catch(() => null)) as
    { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ ok: false, error: "abonnement_invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
