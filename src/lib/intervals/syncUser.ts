// ─────────────────────────────────────────────────────────────────────────────
//  SYNCHRONISATION intervals.icu → base Pacevo
//  Extrait du webhook pour être réutilisable : le webhook n'est pas le seul
//  déclencheur (l'ouverture de l'app et le cron quotidien s'en servent aussi).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

const BASE = "https://intervals.icu/api/v1";

function authHeader(apiKey: string) {
  return {
    Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64"),
    "Content-Type": "application/json",
  };
}

/** Importe activités + wellness des `days` derniers jours. Renvoie le nb d'activités enregistrées. */
export async function syncIntervalsForUser(
  admin: SupabaseClient,
  opts: { userId: string; athleteId: string; apiKey: string; days?: number },
): Promise<{ synced: number; error?: string }> {
  const { userId, athleteId, apiKey } = opts;
  const days = opts.days ?? 7;
  const profile = { id: userId, intervals_api_key: apiKey };

  // Sync last 7 days to catch the new activity
  const oldest = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
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
    return { synced: 0, error: `Intervals.icu ${activitiesRes.status}` };
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
        // Champs disponibles chez intervals.icu mais jamais enregistrés jusqu'ici — dont
        // la TEMPÉRATURE, sans laquelle toute l'adaptation à la chaleur restait lettre morte.
        weather_temp_c: act.average_temp ?? null,
        gap_min_km: act.gap && act.gap > 0.3 ? Math.round((1000 / 60 / act.gap) * 100) / 100 : null,
        hr_zone_seconds: Array.isArray(act.icu_hr_zone_times) ? act.icu_hr_zone_times : null,
        intensity_pct: act.icu_intensity != null ? Math.round(act.icu_intensity) : null,
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

  // Métriques RICHES Garmin → profil. Dernière valeur NON nulle par champ (le wellness du jour est
  // souvent incomplet : FC repos/VFC mesurées la nuit) + historique VO2max pour le graphique.
  const wDesc = wellness.filter(d => d.id).sort((a, b) => b.id.localeCompare(a.id));
  const wLatest = (k: keyof IntervalsWellness): number | null => {
    for (const w of wDesc) { const v = w[k]; if (typeof v === "number" && !Number.isNaN(v)) return v; }
    return null;
  };
  const latestVo2 = wLatest("vo2max");
  const lastRunAct = (activities as unknown as Array<Record<string, unknown>>).find(a => /run/i.test(String(a.type ?? "")));
  const tpMps = Number(lastRunAct?.threshold_pace) || 0;
  const ctlV = wLatest("ctl"), atlV = wLatest("atl"), rampV = wLatest("rampRate");
  const gm = {
    vo2max: latestVo2,
    restingHR: wLatest("restingHR"),
    lthr: Number(lastRunAct?.lthr) || null,
    thresholdPaceSecPerKm: tpMps > 0 ? Math.round(1000 / tpMps) : null,
    ctl: ctlV != null ? Math.round(ctlV) : null,
    atl: atlV != null ? Math.round(atlV) : null,
    rampRate: rampV != null ? Math.round(rampV * 10) / 10 : null,
    vo2maxHistory: wDesc.filter(w => typeof w.vo2max === "number" && (w.vo2max as number) > 0)
      .map(w => ({ date: w.id, v: Math.round((w.vo2max as number) * 10) / 10 })).reverse().slice(-120),
    updatedAt: new Date().toISOString(),
  };
  if (latestVo2 != null || gm.restingHR != null || gm.ctl != null) {
    await admin.from("profiles").update({ garmin_vo2max: latestVo2, garmin_metrics: gm }).eq("id", profile.id).then(() => {}, () => {});
  }

  return { synced };
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
  average_temp?: number; gap?: number; icu_hr_zone_times?: number[]; icu_intensity?: number;
}
interface IntervalsWellness {
  id: string; hrv?: number; hrvSDNN?: number; sleepSecs?: number;
  deepSleepSecs?: number; lightSleepSecs?: number; remSleepSecs?: number;
  sleepScore?: number; bb?: number; avgSpo2?: number; vo2max?: number;
  restingHR?: number; ctl?: number; atl?: number; rampRate?: number;
}
