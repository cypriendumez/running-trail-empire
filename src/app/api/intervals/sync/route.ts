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
  const oldest = url.searchParams.get("oldest") ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const newest = url.searchParams.get("newest") ?? new Date().toISOString().split("T")[0];

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

  // ── Fetch ICU data + existing DB workouts in parallel ──────
  const [activitiesRes, wellnessRes, existingWorkoutsResult] = await Promise.all([
    fetch(`${BASE}/athlete/${ATHLETE_ID}/activities?oldest=${oldest}&newest=${newest}`, {
      headers: authHeader(API_KEY),
    }),
    fetch(`${BASE}/athlete/${ATHLETE_ID}/wellness?oldest=${oldest}&newest=${newest}`, {
      headers: authHeader(API_KEY),
    }),
    supabase.from("workouts").select("id, date, title")
      .eq("user_id", user.id).gte("date", oldest).lte("date", newest),
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
  const wellness: IntervalsWellness[] = wellnessRes.ok ? await wellnessRes.json() : [];

  let synced = { workouts: 0, hrv: 0, sleep: 0 };
  const syncErrors: string[] = [];

  // ── Sync activities → workouts ──────────────────────────────
  const validActivities = activities.filter(a => a.type && a.start_date_local);

  if (validActivities.length > 0) {
    const existingMap = new Map<string, string>();
    for (const w of existingWorkoutsResult.data ?? []) {
      existingMap.set(`${w.date}__${w.title}`, w.id);
    }

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; payload: Record<string, unknown> }[] = [];
    const ri = (v: number | null | undefined) => v != null ? Math.round(v) : null;

    for (const act of validActivities) {
      const workoutType = mapActivityType(act.type!);
      const date = act.start_date_local!.split("T")[0];
      const title = act.name ?? workoutType;

      const payload: Record<string, unknown> = {
        user_id: user.id, title, type: workoutType, date,
        duration_seconds: Math.max(1, Math.round(act.moving_time ?? act.elapsed_time ?? 1)),
        distance_km: act.distance ? act.distance / 1000 : null,
        elevation_gain_m: ri(act.total_elevation_gain),
        elevation_loss_m: ri(act.total_elevation_loss),
        avg_hr: ri(act.average_heartrate),
        max_hr: ri(act.max_heartrate),
        avg_pace_min_km: act.average_speed ? Math.min(999, 1000 / 60 / act.average_speed) : null,
        avg_power_watts: ri(act.average_watts),
        max_power_watts: ri(act.max_watts),
        avg_cadence_spm: act.average_cadence ? Math.round(act.average_cadence * 2) : null,
        tss: act.icu_training_load ?? act.icu_tss ?? null,                 // « Charge » intervals.icu
        training_effect: act.aerobic_te ?? null,
        vertical_oscillation_cm: act.avg_vertical_oscillation ?? null,
        ground_contact_ms: ri(act.avg_ground_contact_time),
        stride_length_m: act.average_stride ?? (act.avg_stride_length ? act.avg_stride_length / 100 : null),
        cardiac_decoupling: act.decoupling ?? null,
        source: "garmin",
      };

      const existingId = existingMap.get(`${date}__${title}`);
      if (existingId) toUpdate.push({ id: existingId, payload });
      else toInsert.push(payload);
    }

    // Batch insert
    if (toInsert.length > 0) {
      const { error } = await supabase.from("workouts").insert(toInsert);
      if (!error) {
        synced.workouts += toInsert.length;
      } else {
        syncErrors.push(`Insert batch: ${error.message}`);
        for (const p of toInsert) {
          const { error: e2 } = await supabase.from("workouts").insert(p);
          if (!e2) synced.workouts++;
          else syncErrors.push(`${p.date} "${p.title}": ${e2.message}`);
        }
      }
    }

    // Parallel updates (20 concurrent)
    for (let i = 0; i < toUpdate.length; i += 20) {
      await Promise.all(toUpdate.slice(i, i + 20).map(({ id, payload }) =>
        supabase.from("workouts").update(payload).eq("id", id)
          .then(({ error }) => { if (!error) synced.workouts++; })
      ));
    }
  }

  // ── Sync wellness → 2 batch upserts (HRV + sleep) ──────────
  const validWellness = wellness.filter(d => d.id);

  const hrvRows = validWellness
    .filter(d => d.hrv !== undefined)
    .map(d => ({
      user_id: user.id, date: d.id,
      hrv_ms: d.hrv!, rmssd: d.hrv!,
      sdnn: d.hrvSDNN ?? null,
      physiological_state: derivePhysiologicalState(d.hrv!, d.hrvSDNN),
      notes: "Synced from Intervals.icu",
    }));

  const sleepRows = validWellness
    .filter(d => d.sleepSecs !== undefined)
    .map(d => ({
      user_id: user.id, date: d.id,
      total_sleep_min: Math.round(d.sleepSecs! / 60),
      deep_sleep_min: d.deepSleepSecs ? Math.round(d.deepSleepSecs / 60) : 0,
      light_sleep_min: d.lightSleepSecs ? Math.round(d.lightSleepSecs / 60) : 0,
      rem_sleep_min: d.remSleepSecs ? Math.round(d.remSleepSecs / 60) : 0,
      sleep_score: d.sleepScore ?? null,
      body_battery_start: d.bbMax ?? null,
      body_battery_end: d.bb ?? null,
      respiration_rate: d.avgRespiration ?? null,
      spo2_avg: d.avgSpo2 ?? null,
      source: "intervals_icu",
    }));

  await Promise.all([
    hrvRows.length > 0
      ? supabase.from("hrv_data").upsert(hrvRows, { onConflict: "user_id,date" })
          .then(() => { synced.hrv = hrvRows.length; })
      : Promise.resolve(),
    sleepRows.length > 0
      ? supabase.from("sleep_data").upsert(sleepRows, { onConflict: "user_id,date" })
          .then(() => { synced.sleep = sleepRows.length; })
      : Promise.resolve(),
  ]);

  return NextResponse.json({
    synced,
    period: { oldest, newest },
    fetched: { activities: activities.length, wellness: wellness.length },
    valid_activities: validActivities.length,
    errors: syncErrors.slice(0, 5),
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
  icu_training_load?: number;
  trimp?: number;
  icu_intensity?: number;
  average_stride?: number;
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
