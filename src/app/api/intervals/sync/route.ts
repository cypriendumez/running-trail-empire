export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  if (!activitiesRes.ok) {
    const body = await activitiesRes.text().catch(() => "");
    return NextResponse.json({
      error: `Intervals.icu fetch failed (HTTP ${activitiesRes.status})`,
      detail: body.slice(0, 300),
      athleteId: ATHLETE_ID,
    }, { status: 502 });
  }

  const activities: IntervalsActivity[] = await activitiesRes.json();
  // Wellness is optional — some athletes don't have it configured on Intervals.icu
  const wellness: IntervalsWellness[] = wellnessRes.ok ? await wellnessRes.json() : [];

  let synced = { workouts: 0, hrv: 0, sleep: 0 };
  const syncErrors: string[] = [];

  // ── Sync activities → workouts (batch approach to avoid timeout) ──
  const validActivities = activities.filter(a => a.type && a.start_date_local);

  if (validActivities.length > 0) {
    // 1. Fetch all existing workouts for this user in the date range (1 query)
    const { data: existingWorkouts } = await supabase
      .from("workouts")
      .select("id, date, title")
      .eq("user_id", user.id)
      .gte("date", oldest)
      .lte("date", newest);

    const existingMap = new Map<string, string>();
    for (const w of existingWorkouts ?? []) {
      existingMap.set(`${w.date}__${w.title}`, w.id);
    }

    // 2. Build payloads
    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; payload: Record<string, unknown> }[] = [];

    for (const act of validActivities) {
      const workoutType = mapActivityType(act.type!);
      const date = act.start_date_local!.split("T")[0];
      const title = act.name ?? workoutType;
      const key = `${date}__${title}`;

      const payload: Record<string, unknown> = {
        user_id: user.id,
        title,
        type: workoutType,
        date,
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
        ground_contact_ms: act.avg_ground_contact_time ?? null,
        stride_length_m: act.avg_stride_length ? act.avg_stride_length / 100 : null,
        cardiac_decoupling: act.decoupling ?? null,
        source: "garmin",
      };

      const existingId = existingMap.get(key);
      if (existingId) {
        toUpdate.push({ id: existingId, payload });
      } else {
        toInsert.push(payload);
      }
    }

    // 3. Batch insert new activities
    if (toInsert.length > 0) {
      const { error } = await supabase.from("workouts").insert(toInsert);
      if (!error) {
        synced.workouts += toInsert.length;
      } else {
        syncErrors.push(`Insert batch: ${error.message}`);
        // Fallback: insert one by one to save what we can
        for (const p of toInsert) {
          const { error: e2 } = await supabase.from("workouts").insert(p);
          if (!e2) synced.workouts++;
          else syncErrors.push(`${p.date} "${p.title}": ${e2.message}`);
        }
      }
    }

    // 4. Update existing activities (in parallel, capped at 10 concurrent)
    for (let i = 0; i < toUpdate.length; i += 10) {
      const batch = toUpdate.slice(i, i + 10);
      await Promise.all(batch.map(({ id, payload }) =>
        supabase.from("workouts").update(payload).eq("id", id)
          .then(({ error }) => { if (!error) synced.workouts++; })
      ));
    }
  }

  // Power zones skipped for now (requires per-activity lookup, adds latency)

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

  // Debug: show first 3 raw activities from ICU to diagnose filter issues
  const rawSample = activities.slice(0, 3).map((a: any) => ({
    id: a.id,
    type: a.type,
    start_date_local: a.start_date_local,
    name: a.name,
    distance: a.distance,
  }));

  return NextResponse.json({
    synced,
    period: { oldest, newest },
    fetched: { activities: activities.length, wellness: wellness.length },
    valid_activities: validActivities.length,
    errors: syncErrors.slice(0, 5),
    raw_sample: rawSample,
  });
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
