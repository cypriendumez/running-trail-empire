import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TerraActivity {
  user: { user_id: string };
  activity?: {
    summary?: {
      active_duration_seconds_float?: number;
      distance_meters?: number;
      steps?: number;
      avg_hr_bpm?: number;
      max_hr_bpm?: number;
      avg_cadence_rpm?: number;
      calories?: number;
    };
    device_data?: { name?: string };
  }[];
  daily?: {
    summary?: {
      hrv?: { avg_rmssd?: number; avg_sdnn?: number };
      heart_rate?: { avg_hr_bpm?: number; resting_hr_bpm?: number };
      sleep?: { sleep_efficiency?: number };
    };
  }[];
}

export async function POST(req: Request) {
  const data = await req.json() as TerraActivity;

  if (data.activity) {
    for (const act of data.activity) {
      const summary = act.summary;
      if (!summary) continue;
      const userId = data.user?.user_id;
      if (!userId) continue;

      await supabaseAdmin.from("workouts").insert({
        user_id: userId,
        title: `Séance ${act.device_data?.name ?? "Montre"}`,
        type: "easy",
        date: new Date().toISOString().split("T")[0],
        duration_seconds: Math.round(summary.active_duration_seconds_float ?? 0),
        distance_km: (summary.distance_meters ?? 0) / 1000,
        avg_hr: summary.avg_hr_bpm,
        max_hr: summary.max_hr_bpm,
        avg_cadence_spm: summary.avg_cadence_rpm ? summary.avg_cadence_rpm * 2 : null,
        source: "garmin",
      });
    }
  }

  if (data.daily) {
    for (const day of data.daily) {
      const summary = day.summary;
      if (!summary?.hrv) continue;
      const userId = data.user?.user_id;
      if (!userId) continue;

      const hrv = summary.hrv;
      const rmssd = hrv.avg_rmssd ?? 0;
      const state = rmssd > 60 ? "optimal" : rmssd > 35 ? "recovery" : "recovery";

      await supabaseAdmin.from("hrv_data").upsert({
        user_id: userId,
        date: new Date().toISOString().split("T")[0],
        hrv_ms: rmssd,
        rmssd,
        sdnn: hrv.avg_sdnn,
        physiological_state: state,
      }, { onConflict: "user_id,date" });
    }
  }

  return NextResponse.json({ ok: true });
}
