export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * RETIRE UN ABONNEMENT PUSH. Authentifiée, et bornée à l'athlète connecté : on ne supprime
 * que SON propre endpoint (`user_id` + `endpoint`), jamais celui d'un autre.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ ok: false, error: "endpoint_absent" }, { status: 400 });

  const admin = createAdminClient();
  // ⚠️ On LIT l'erreur : un désabonnement qui se croit fait alors qu'il a échoué laisserait
  // l'athlète recevoir encore des push après avoir demandé l'arrêt.
  const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
