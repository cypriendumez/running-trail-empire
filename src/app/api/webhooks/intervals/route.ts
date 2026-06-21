export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";

export const runtime = "nodejs";

const BASE = "https://intervals.icu/api/v1";

function authHeader(apiKey: string) {
  return {
    Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64"),
    "Content-Type": "application/json",
  };
}

/**
 * POST /api/webhooks/intervals
 *
 * Called by Intervals.icu when a new activity is created or updated.
 * Payload: { athlete_id, event, id, ... }
 *
 * Secured via ?secret=WEBHOOK_SECRET in the URL we register with Intervals.icu.
 */
export async function POST(req: Request) {
  // Verify secret
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const athleteId = body.athlete_id as string | undefined;
  const event = body.event as string | undefined;

  if (!athleteId) {
    return NextResponse.json({ ok: true, skipped: "no athlete_id" });
  }

  // Only react to activity events
  if (event && !event.includes("activity")) {
    return NextResponse.json({ ok: true, skipped: `event=${event}` });
  }

  const admin = createAdminClient();

  // Find which user owns this athlete ID
  const { data: profile } = await admin
    .from("profiles")
    .select("id, intervals_athlete_id, intervals_api_key")
    .eq("intervals_athlete_id", athleteId)
    .single();

  if (!profile?.intervals_api_key) {
    return NextResponse.json({ ok: true, skipped: "user not found" });
  }

  // Sync last 7 days to catch the new activity
  const oldest = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const newest = new Date().toISOString().split("T")[0];

  const [activitiesRes, wellnessRes] = await Promise.all([
    fetch(`${BASE}/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`, {
      headers: authHeader(profile.intervals_api_key),
    }),
    fetch(`${BASE}/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`, {
      headers: authHeader(profile.intervals_api_key),
    }),
  ]);

  if (!activitiesRes.ok) {
    return NextResponse.json({ error: `Intervals.icu ${activitiesRes.status}` }, { status: 502 });
  }

  const [activities, wellness]: [IntervalsActivity[], IntervalsWellness[]] = await Promise.all([
    activitiesRes.json(),
    wellnessRes.ok ? wellnessRes.json() : Promise.resolve([]),
  ]);

  let synced = 0;

  for (const act of activities) {
    if (!act.type || !act.start_date_local) continue;
    const workoutType = mapActivityType(act.type);
    const { error } = await admin.from("workouts").upsert(
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
    if (!error) synced++;
  }

  for (const day of wellness) {
    if (!day.id) continue;
    if (day.hrv !== undefined) {
      const state = day.hrv < 50 ? "recovery" : day.hrv > 80 ? "competition" : "optimal";
      await admin.from("hrv_data").upsert(
        { user_id: profile.id, date: day.id, hrv_ms: day.hrv, rmssd: day.hrv, sdnn: day.hrvSDNN ?? null, physiological_state: state },
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
          body_battery_end: day.bb ?? null,
          spo2_avg: day.avgSpo2 ?? null,
          source: "intervals_icu",
        },
        { onConflict: "user_id,date" }
      );
    }
  }

  // Garmin VO2max (mesure montre) la plus récente → profil (source de vérité, best-effort).
  const latestVo2 = wellness
    .filter(d => d.id && typeof d.vo2max === "number" && (d.vo2max as number) > 0)
    .sort((a, b) => b.id.localeCompare(a.id))[0]?.vo2max;
  if (latestVo2) await admin.from("profiles").update({ garmin_vo2max: latestVo2 }).eq("id", profile.id).then(() => {}, () => {});

  // Coach AUTONOME INSTANTANÉ : dès qu'intervals notifie une nouvelle séance, on (re)publie
  // la prochaine séance sur le dashboard + la montre, sans aucun délai ni clic.
  let coached = false;
  if (synced > 0) {
    const r = await autoCoachForUser(admin, { userId: profile.id, athleteId, apiKey: profile.intervals_api_key }).catch(() => null);
    coached = !!r?.processed;
  }
  console.log(`[webhook/intervals] athlete=${athleteId} → ${synced} activités synced · coach=${coached}`);
  return NextResponse.json({ ok: true, synced, coached });
}

// Intervals.icu also sends GET to verify the webhook endpoint is alive
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, service: "running-trail-empire" });
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
  average_watts?: number; average_cadence?: number; icu_tss?: number;
  aerobic_te?: number; avg_vertical_oscillation?: number;
  avg_ground_contact_time?: number; avg_stride_length?: number; decoupling?: number;
}
interface IntervalsWellness {
  id: string; hrv?: number; hrvSDNN?: number; sleepSecs?: number;
  deepSleepSecs?: number; lightSleepSecs?: number; remSleepSecs?: number;
  sleepScore?: number; bb?: number; avgSpo2?: number; vo2max?: number;
}
