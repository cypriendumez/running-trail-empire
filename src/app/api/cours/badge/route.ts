export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 🏅 Badge « Expert du cours » — quiz Complet réussi à ≥ 90 %.
// Stocké comme notification (type=badge) : visible dans la cloche, idempotent.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { score, total } = await req.json().catch(() => ({ score: 0, total: 0 })) as { score?: number; total?: number };
  if (!total || !score || score / total < 0.9) {
    return NextResponse.json({ error: "Score insuffisant pour le badge (≥ 90 % du quiz Complet)." }, { status: 400 });
  }

  // Déjà débloqué ? (idempotent)
  const { data: existing } = await supabase
    .from("notifications").select("id").eq("user_id", user.id).eq("type", "badge")
    .eq("data->>key", "cours_expert").limit(1).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, already: true });

  const { error } = await supabase.from("notifications").insert({
    user_id: user.id,
    type: "badge",
    title: "🏅 Badge débloqué : Expert du cours",
    body: `Quiz Complet réussi à ${Math.round((score / total) * 100)} % (${score}/${total}). Tu maîtrises la théorie !`,
    data: { key: "cours_expert", score, total, ts: new Date().toISOString() },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, already: false });
}
