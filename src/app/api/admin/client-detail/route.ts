export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estAdmin } from "@/lib/admin/acces";


// POST /api/admin/client-detail {user_id} — TOUTES les données récentes d'un client.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !estAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id } = await req.json() as { user_id: string };
  if (!user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 });

  const admin = createAdminClient();
  const [profile, workouts, hrv, sleep, baseline, plan] = await Promise.all([
    admin.from("profiles").select("full_name,age,weight_kg,height_cm,gender,league,discipline_score,subscription_tier").eq("id", user_id).single(),
    admin.from("workouts").select("title,type,date,distance_km,elevation_gain_m,duration_seconds,avg_hr,max_hr,avg_pace_min_km,avg_cadence_spm,training_effect").eq("user_id", user_id).gte("date", new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0]).order("date", { ascending: false }).limit(120),
    admin.from("hrv_data").select("date,hrv_ms,physiological_state").eq("user_id", user_id).order("date", { ascending: false }).limit(14),
    admin.from("sleep_data").select("date,total_sleep_min,sleep_score,body_battery_end,deep_sleep_min,rem_sleep_min").eq("user_id", user_id).order("date", { ascending: false }).limit(14),
    admin.from("performance_baselines").select("vma_kmh,ftp_watts,max_hr,resting_hr").eq("user_id", user_id).order("tested_at", { ascending: false }).limit(1).single(),
    admin.from("training_plans").select("race_date,goal").eq("user_id", user_id).eq("is_active", true).single(),
  ]);

  return NextResponse.json({
    profile: profile.data ?? null,
    workouts: workouts.data ?? [],
    hrv: hrv.data ?? [],
    sleep: sleep.data ?? [],
    baseline: baseline.data ?? null,
    plan: plan.data ?? null,
  });
}
