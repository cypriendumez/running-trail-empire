import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BASE = "https://intervals.icu/api/v1";

function authHeader(apiKey: string) {
  return {
    Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64"),
    "Content-Type": "application/json",
  };
}

// GET /api/intervals/sync?days=14
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") ?? "14");
  const oldest = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const newest = new Date().toISOString().split("T")[0];

  // Load credentials: user profile first, then global env vars
  const { data: profile } = await supabase
    .from("profiles")
    .select("intervals_athlete_id, intervals_api_key")
    .eq("id", user.id)
    .single();

  const ATHLETE_ID = profile?.intervals_athlete_id || process.env.INTERVALS_ICU_ATHLETE_ID;
  const API_KEY = profile?.intervals_api_key || process.env.INTERVALS_ICU_API_KEY;

  if (!ATHLETE_ID || !API_KEY) {
    return NextResponse.json({ error: "Intervals.icu non configuré — ajoutez vos identifiants dans l'onglet Configuration" }, { status: 503 });
  }

  const [activitiesRes, wellnessRes] = await Promise.all([
    fetch(`${BASE}/athlete/${ATHLETE_ID}/activities?oldest=${oldest}&newest=${newest}`, {
      headers: authHeader(API_KEY),
    }),
    fetch(`${BASE}/athlete/${ATHLETE_ID}/wellness?oldest=${oldest}&newest=${newest}`, {
      headers: authHeader(API_KEY),
    }),
  ]);

  if (!activitiesRes.ok || !wellnessRes.ok) {
    return NextResponse.json({ error: "Intervals.icu fetch failed" }, { status: 502 });
  }

  const [activities, wellness]: [IntervalsActivity[], IntervalsWellness[]] = await Promise.all([
    activitiesRes.json(),
    wellnessRes.json(),
  ]);

  let synced = { workouts: 0, hrv: 0, sleep: 0 };

  // ── Sync activities → workouts ──────────────────────────────
  for (const act of activities) {
    if (!act.type || !act.start_date_local) continue;

    const workoutType = mapActivityType(act.type);
    const { error } = await supabase.from("workouts").upsert(
      {
        user_id: user.id,
        title: act.name ?? workoutType,
        type: workoutType,
        date: act.start_date_local.split("T")[0],
        duration_seconds: act.moving_time ?? act.elapsed_time ?? 0,
        distance_km: act.distance ? act.distance / 1000 : null,
        elevation_gain_m: act.total_elevation_gain ?? 0,
        elevation_loss_m: act.total_elevation_loss ?? 0,
        avg_hr: act.average_heartrate ?? null,
        max_hr: act.max_heartrate ?? null,
        avg_pace_min_km: act.average_speed ? 1000 / 60 / act.average_speed : null,
        avg_power_watts: act.average_watts ?? null,
        max_power_watts: act.max_watts ?? null,
        avg_cadence_spm: act.average_cadence ? act.average_cadence * 2 : null,
        tss: act.icu_tss ?? null,
        training_effect: act.aerobic_te ?? null,
        vertical_oscillation_cm: act.avg_vertical_oscillation ?? null,
        ground_contact_time_ms: act.avg_ground_contact_time ?? null,
        stride_length_m: act.avg_stride_length ? act.avg_stride_length / 100 : null,
        cardiac_decoupling: act.decoupling ?? null,
        source: "garmin",
      },
      { onConflict: "user_id,date,title", ignoreDuplicates: false }
    );
    if (!error) synced.workouts++;

    // Sync power zones if available
    if (act.pace_z1 !== undefined) {
      const workoutRow = await supabase
        .from("workouts")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", act.start_date_local.split("T")[0])
        .eq("title", act.name ?? workoutType)
        .single();

      if (workoutRow.data) {
        await supabase.from("power_zone_distribution").upsert({
          workout_id: workoutRow.data.id,
          user_id: user.id,
          z1_seconds: act.pace_z1 ?? 0,
          z2_seconds: act.pace_z2 ?? 0,
          z3_seconds: act.pace_z3 ?? 0,
          z4_seconds: act.pace_z4 ?? 0,
          z5_seconds: act.pace_z5 ?? 0,
          aerobic_te: act.aerobic_te ?? null,
          anaerobic_te: act.anaerobic_te ?? null,
        }, { onConflict: "workout_id" });
      }
    }
  }

  // ── Sync wellness → hrv_data + sleep_data ──────────────────
  for (const day of wellness) {
    if (!day.id) continue;

    // HRV
    if (day.hrv !== undefined) {
      const state = derivePhysiologicalState(day.hrv, day.hrvSDNN);
      await supabase.from("hrv_data").upsert(
        {
          user_id: user.id,
          date: day.id,
          hrv_ms: day.hrv,
          rmssd: day.hrv,
          sdnn: day.hrvSDNN ?? null,
          physiological_state: state,
          notes: `Synced from Intervals.icu`,
        },
        { onConflict: "user_id,date" }
      );
      synced.hrv++;
    }

    // Sleep
    if (day.sleepSecs !== undefined) {
      await supabase.from("sleep_data").upsert(
        {
          user_id: user.id,
          date: day.id,
          total_sleep_min: Math.round(day.sleepSecs / 60),
          deep_sleep_min: day.deepSleepSecs ? Math.round(day.deepSleepSecs / 60) : 0,
          light_sleep_min: day.lightSleepSecs ? Math.round(day.lightSleepSecs / 60) : 0,
          rem_sleep_min: day.remSleepSecs ? Math.round(day.remSleepSecs / 60) : 0,
          sleep_score: day.sleepScore ?? null,
          body_battery_start: day.bbMax ?? null,
          body_battery_end: day.bb ?? null,
          respiration_rate: day.avgRespiration ?? null,
          spo2_avg: day.avgSpo2 ?? null,
          source: "intervals_icu",
        },
        { onConflict: "user_id,date" }
      );
      synced.sleep++;
    }
  }

  return NextResponse.json({ synced, period: { oldest, newest } });
}

// ─── Helpers ────────────────────────────────────────────────

function derivePhysiologicalState(hrv: number, sdnn?: number): "recovery" | "optimal" | "competition" {
  if (hrv < 50 || (sdnn !== undefined && sdnn < 40)) return "recovery";
  if (hrv > 80) return "competition";
  return "optimal";
}

function mapActivityType(type: string): string {
  const map: Record<string, string> = {
    Run: "easy",
    TrailRun: "trail",
    VirtualRun: "easy",
    Workout: "interval",
    Ride: "easy",
    Walk: "recovery",
    Hike: "trail",
  };
  return map[type] ?? "easy";
}

// ─── Intervals.icu Types (partial) ─────────────────────────

interface IntervalsActivity {
  id: string;
  name?: string;
  type?: string;
  start_date_local?: string;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  total_elevation_loss?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  average_watts?: number;
  max_watts?: number;
  average_cadence?: number;
  icu_tss?: number;
  aerobic_te?: number;
  anaerobic_te?: number;
  avg_vertical_oscillation?: number;
  avg_ground_contact_time?: number;
  avg_stride_length?: number;
  decoupling?: number;
  pace_z1?: number;
  pace_z2?: number;
  pace_z3?: number;
  pace_z4?: number;
  pace_z5?: number;
}

interface IntervalsWellness {
  id: string;
  hrv?: number;
  hrvSDNN?: number;
  sleepSecs?: number;
  deepSleepSecs?: number;
  lightSleepSecs?: number;
  remSleepSecs?: number;
  sleepScore?: number;
  bb?: number;
  bbMax?: number;
  avgRespiration?: number;
  avgSpo2?: number;
}
