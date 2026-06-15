export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/settings — enregistre les préférences (couleur d'avatar, unités, début de semaine…)
// dans une ligne notifications type "user_settings" (jsonb), une par utilisateur.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.avatarColor === "string") patch.avatarColor = body.avatarColor.slice(0, 20);
  if (body.unitSystem === "metric" || body.unitSystem === "imperial") patch.unitSystem = body.unitSystem;
  if (body.weekStart === "mon" || body.weekStart === "sun") patch.weekStart = body.weekStart;
  // Préférences booléennes (notifications + confidentialité). Stockées centralement,
  // lues par les générateurs de notifications / les pages Ligues & Communauté.
  for (const k of ["weeklyDigest", "recoveryAlerts", "coachTips", "sessionReminders", "leaguePublic", "communityVisible"]) {
    if (typeof body[k] === "boolean") patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Rien à enregistrer" }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from("notifications")
    .select("id, data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle();
  const merged = { ...((existing?.data as object) ?? {}), ...patch };
  if (existing?.id) {
    await admin.from("notifications").update({ data: merged }).eq("id", existing.id);
  } else {
    await admin.from("notifications").insert({ user_id: user.id, type: "user_settings", title: "Préférences", body: "", read: true, data: merged });
  }
  return NextResponse.json({ ok: true, settings: merged });
}
