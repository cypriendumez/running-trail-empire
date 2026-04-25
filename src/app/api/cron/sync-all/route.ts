import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60; // 60s timeout (Vercel hobby = 10s, pro = 60s)

const BASE = "https://intervals.icu/api/v1";

function authHeader(apiKey: string) {
  return {
    Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64"),
    "Content-Type": "application/json",
  };
}

// GET /api/cron/sync-all
// Called by Vercel Cron every 30 minutes.
// Secured with CRON_SECRET header.
export async function GET(req: Request) {
  // Verify the cron secret
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch all users with Intervals.icu credentials
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, intervals_athlete_id, intervals_api_key")
    .not("intervals_athlete_id", "is", null)
    .not("intervals_api_key", "is", null);

  if (error) {
    console.error("[cron/sync-all] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const days = 1; // sync last 24h for the cron (lightweight)
  const oldest = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const newest = new Date().toISOString().split("T")[0];

  const results: { userId: string; ok: boolean; workouts?: number; error?: string }[] = [];

  for (const profile of profiles ?? []) {
    if (!profile.intervals_athlete_id || !profile.intervals_api_key) continue;

    try {
      const [activitiesRes, wellnessRes] = await Promise.all([
        fetch(`${BASE}/athlete/${profile.intervals_athlete_id}/activities?oldest=${oldest}&newest=${newest}`, {
          headers: authHeader(profile.intervals_api_key),
        }),
        fetch(`${BASE}/athlete/${profile.intervals_athlete_id}/wellness?oldest=${oldest}&newest=${newest}`, {
          headers: authHeader(profile.intervals_api_key),
        }),
      ]);

      if (!activitiesRes.ok) {
        results.push({ userId: profile.id, ok: false, error: `HTTP ${activitiesRes.status}` });
        continue;
      }

      const [activities, wellness]: [IntervalsActivity[], IntervalsWellness[]] = await Promise.all([
        activitiesRes.json(),
        wellnessRes.ok ? wellnessRes.json() : Promise.resolve([]),
      ]);

      let synced = 0;

      // Sync activities
      for (const act of activities) {
        if (!act.type || !act.start_date_local) continue;
        const workoutType = mapActivityType(act.type);
        const { error: upsertErr } = await admin.from("workouts").upsert(
          {
            user_id: profile.id,
            title: act.name ?? workoutType,
            type: workoutType,
            date: act.start_date_local.split("T")[0],
            duration_seconds: Math.max(1, act.moving_time ?? act.elapsed_time ?? 1),
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
          },
          { onConflict: "user_id,date,title", ignoreDuplicates: false }
        );
        if (!upsertErr) synced++;
      }

      // Sync wellness (HRV + sleep)
      for (const day of wellness) {
        if (!day.id) continue;
        if (day.hrv !== undefined) {
          const state = day.hrv < 50 ? "recovery" : day.hrv > 80 ? "competition" : "optimal";
          await admin.from("hrv_data").upsert(
            { user_id: profile.id, date: day.id, hrv_ms: day.hrv, rmssd: day.hrv, sdnn: day.hrvSDNN ?? null, physiological_state: state, notes: "Auto-sync Intervals.icu" },
            { onConflict: "user_id,date" }
          );
        }
        if (day.sleepSecs !== undefined) {
          await admin.from("sleep_data").upsert(
            {
              user_id: profile.id, date: day.id,
              total_sleep_min: Math.round(day.sleepSecs / 60),
              deep_sleep_min: day.deepSleepSecs ? Math.round(day.deepSleepSecs / 60) : 0,
              light_sleep_min: day.lightSleepSecs ? Math.round(day.lightSleepSecs / 60) : 0,
              rem_sleep_min: day.remSleepSecs ? Math.round(day.remSleepSecs / 60) : 0,
              sleep_score: day.sleepScore ?? null,
              body_battery_start: day.bbMax ?? null,
              body_battery_end: day.bb ?? null,
              spo2_avg: day.avgSpo2 ?? null,
              source: "intervals_icu",
            },
            { onConflict: "user_id,date" }
          );
        }
      }

      results.push({ userId: profile.id, ok: true, workouts: synced });
    } catch (err) {
      results.push({ userId: profile.id, ok: false, error: String(err) });
    }
  }

  const total = results.reduce((a, r) => a + (r.workouts ?? 0), 0);
  console.log(`[cron/sync-all] Synced ${total} activities for ${results.length} users`);
  return NextResponse.json({ ok: true, users: results.length, total_activities: total, results });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapActivityType(type: string): string {
  const map: Record<string, string> = {
    Run: "easy", TrailRun: "trail", VirtualRun: "easy",
    Workout: "interval", Ride: "easy", Walk: "recovery", Hike: "trail",
  };
  return map[type] ?? "easy";
}

interface IntervalsActivity {
  id: string; name?: string; type?: string; start_date_local?: string;
  moving_time?: number; elapsed_time?: number; distance?: number;
  total_elevation_gain?: number; total_elevation_loss?: number;
  average_heartrate?: number; max_heartrate?: number; average_speed?: number;
  average_watts?: number; max_watts?: number; average_cadence?: number;
  icu_tss?: number; aerobic_te?: number; avg_vertical_oscillation?: number;
  avg_ground_contact_time?: number; avg_stride_length?: number; decoupling?: number;
}
interface IntervalsWellness {
  id: string; hrv?: number; hrvSDNN?: number; sleepSecs?: number;
  deepSleepSecs?: number; lightSleepSecs?: number; remSleepSecs?: number;
  sleepScore?: number; bb?: number; bbMax?: number; avgSpo2?: number;
}
