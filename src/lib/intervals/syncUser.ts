// ─────────────────────────────────────────────────────────────────────────────
//  SYNCHRONISATION intervals.icu → base Pacevo
//  Extrait du webhook pour être réutilisable : le webhook n'est pas le seul
//  déclencheur (l'ouverture de l'app et le cron quotidien s'en servent aussi).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { sportOf } from "./sport";

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

  // ── ÉCRITURE DES SÉANCES ────────────────────────────────────────────────────
  // On n'utilise PLUS `upsert(..., { onConflict: "user_id,date,title" })` : cette
  // contrainte n'existe pas en base. Postgres répondait 42P10, et comme le code ne
  // testait que `if (!error) synced++`, l'échec était compté comme « rien à faire ».
  // Ce chemin (webhook + cron) n'a donc jamais enregistré une seule séance, et le
  // coach n'était jamais déclenché : la replanification instantanée ne partait pas.
  //
  // On lit d'abord l'existant et on choisit explicitement insertion ou mise à jour,
  // comme le fait déjà le chemin appelé depuis le navigateur.
  const dates = [...new Set(activities.map(a => a.start_date_local?.split("T")[0]).filter(Boolean))] as string[];
  const existing = dates.length
    ? (await admin.from("workouts").select("id, date, title, external_id").eq("user_id", userId).in("date", dates)).data ?? []
    : [];
  const byExt = new Map<string, string>();
  const byDateTitle = new Map<string, string>();
  for (const w of existing as { id: string; date: string; title: string; external_id?: string | null }[]) {
    if (w.external_id) byExt.set(w.external_id, w.id);
    byDateTitle.set(`${w.date}__${w.title}`, w.id);
  }

  // Colonnes issues de migrations éventuellement non appliquées : PostgREST rejette
  // l'écriture ENTIÈRE si l'une d'elles manque (42703). On sonde une fois.
  const probe = await admin.from("workouts").select("sport, external_id").limit(1);
  const hasNewCols = probe.error?.code !== "42703";

  for (const act of activities) {
    if (!act.type || !act.start_date_local) continue;
    const workoutType = mapActivityType(act.type);
    const date = act.start_date_local.split("T")[0];
    const title = act.name ?? workoutType;
    const payload: Record<string, unknown> = {
      user_id: userId,
      title,
      type: workoutType,
      date,
      ...(hasNewCols ? { sport: sportOf(act.type), external_id: String(act.id) } : {}),
      duration_seconds: Math.max(1, act.moving_time ?? act.elapsed_time ?? 1),
      distance_km: act.distance ? act.distance / 1000 : null,
      elevation_gain_m: act.total_elevation_gain ?? 0,
      elevation_loss_m: act.total_elevation_loss ?? 0,
      avg_hr: act.average_heartrate ?? null,
      max_hr: act.max_heartrate ?? null,
      avg_pace_min_km: act.average_speed ? 1000 / 60 / act.average_speed : null,
      avg_power_watts: act.average_watts ?? null,
      avg_cadence_spm: act.average_cadence ? act.average_cadence * 2 : null,
      tss: act.icu_training_load ?? act.icu_tss ?? null,
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
    };

    const id = byExt.get(String(act.id)) ?? byDateTitle.get(`${date}__${title}`);
    const { error } = id
      ? await admin.from("workouts").update(payload).eq("id", id)
      : await admin.from("workouts").insert(payload);
    // Seules les VRAIES nouveautés déclenchent une replanification : une mise à jour
    // se produit à chaque sondage et republierait le plan en boucle.
    if (!error && !id) synced++;
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

  // ── ANALYSES MESURÉES ───────────────────────────────────────────────────────
  // Courbe d'allure (meilleurs efforts + vitesse critique), exécution de la dernière
  // série, et position GPS pour la météo réelle.
  //
  // Elles ne vivaient que dans la route appelée depuis le navigateur : le coach
  // autonome (cron, webhook) ne les rafraîchissait donc JAMAIS, et l'athlète devait
  // ouvrir l'application pour que ses allures soient recalculées sur des données à
  // jour. C'est précisément ce qu'il ne doit pas avoir à faire.
  //
  // Best-effort et fortement espacées (20 h / 24 h) : quelques appels réseau de plus,
  // jamais à chaque synchronisation.
  try {
    const { data: prof } = await admin.from("profiles")
      .select("pace_curve, last_loc_at").eq("id", userId).maybeSingle();
    const stored = (prof as { pace_curve?: { at?: string } } | null)?.pace_curve;

    const lastQ = activities.find((a) =>
      /run/i.test(String(a.type ?? "")) && a.id &&
      ((a.icu_intensity ?? 0) >= 85 || (a.icu_training_load ?? 0) >= 60));

    const { refreshPerformance } = await import("./performance");
    await refreshPerformance(admin, {
      userId, athleteId, apiKey,
      lastQualityId: lastQ?.id ? String(lastQ.id) : null,
      lastQualityDate: lastQ?.start_date_local ? String(lastQ.start_date_local).slice(0, 10) : null,
      storedAt: stored?.at ?? null,
    });

    const lastGps = activities.find((a) => a.id && /run|ride|hike|walk/i.test(String(a.type ?? "")));
    if (lastGps?.id) {
      const { refreshAthleteLocation } = await import("./location");
      await refreshAthleteLocation(admin, {
        userId, apiKey, activityId: String(lastGps.id),
        lastLocAt: (prof as { last_loc_at?: string | null } | null)?.last_loc_at ?? null,
      });
    }
  } catch { /* best-effort : une analyse ne fait jamais échouer la synchronisation */ }

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
  icu_training_load?: number;
}
interface IntervalsWellness {
  id: string; hrv?: number; hrvSDNN?: number; sleepSecs?: number;
  deepSleepSecs?: number; lightSleepSecs?: number; remSleepSecs?: number;
  sleepScore?: number; bb?: number; avgSpo2?: number; vo2max?: number;
  restingHR?: number; ctl?: number; atl?: number; rampRate?: number;
}
