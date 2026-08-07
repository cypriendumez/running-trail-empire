export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sportOf } from "@/lib/intervals/sport";

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
    .select("intervals_athlete_id, intervals_api_key, last_loc_at, pace_curve")
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
    supabase.from("workouts").select("id, date, title, external_id")
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
  let freshWorkouts = 0;   // insertions uniquement (cf. plus bas)

  // ── Sync activities → workouts ──────────────────────────────
  const validActivities = activities.filter(a => a.type && a.start_date_local);

  if (validActivities.length > 0) {
    // Repli si la migration 015 n'est pas encore appliquée : PostgREST rejette le
    // select entier pour une seule colonne inconnue (42703).
    const existingRows = existingWorkoutsResult.error
      ? (await supabase.from("workouts").select("id, date, title")
          .eq("user_id", user.id).gte("date", oldest).lte("date", newest)).data ?? []
      : existingWorkoutsResult.data ?? [];

    // L'identifiant d'origine prime sur (date, titre) : deux sorties le même jour
    // portent le même titre automatique Garmin et se confondaient.
    const byExt = new Map<string, string>();
    const existingMap = new Map<string, string>();
    for (const w of existingRows as { id: string; date: string; title: string; external_id?: string | null }[]) {
      if (w.external_id) byExt.set(w.external_id, w.id);
      existingMap.set(`${w.date}__${w.title}`, w.id);
    }

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; payload: Record<string, unknown> }[] = [];
    const ri = (v: number | null | undefined) => v != null ? Math.round(v) : null;

    for (const act of validActivities) {
      const workoutType = mapActivityType(act.type!);
      const sport = sportOf(act.type);
      const date = act.start_date_local!.split("T")[0];
      const title = act.name ?? workoutType;

      const payload: Record<string, unknown> = {
        user_id: user.id, title, type: workoutType, sport, external_id: String(act.id), date,
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
        // ⚠️ Noms EXACTS de l'API intervals.icu. `avg_vertical_oscillation` et
        // `avg_stride_length` n'existent pas : les vrais champs sont `average_*`.
        // Résultat, ces deux colonnes sont restées vides à 100 % alors que la foulée est
        // disponible sur CHAQUE course. L'oscillation est en MILLIMÈTRES côté API (88,6)
        // et la colonne en centimètres — d'où la division.
        vertical_oscillation_cm: act.average_vertical_oscillation != null ? Math.round(act.average_vertical_oscillation / 10 * 10) / 10 : null,
        ground_contact_ms: ri(act.avg_ground_contact_time),
        stride_length_m: act.average_stride ?? null,
        // Économie de course et récupération cardiaque : déjà présentes dans la réponse,
        // jamais lues. `icu_hrr` est un objet — seule la chute de FC nous intéresse.
        vertical_ratio_pct: act.average_vertical_ratio != null ? Math.round(act.average_vertical_ratio * 100) / 100 : null,
        hrr_bpm: act.icu_hrr?.hrr != null ? Math.round(act.icu_hrr.hrr) : null,
        cardiac_decoupling: act.decoupling ?? null,
        // Champs disponibles chez intervals.icu mais jamais enregistrés jusqu'ici (recensement
        // du 7/08 : 0 % de remplissage côté base, 8/8 côté API). La température en particulier
        // rendait toute l'adaptation à la chaleur inopérante — 31 °C sur les sorties récentes.
        weather_temp_c: act.average_temp ?? null,
        gap_min_km: act.gap && act.gap > 0.3 ? Math.round((1000 / 60 / act.gap) * 100) / 100 : null,
        hr_zone_seconds: Array.isArray(act.icu_hr_zone_times) ? act.icu_hr_zone_times : null,
        intensity_pct: act.icu_intensity != null ? Math.round(act.icu_intensity) : null,
        source: "garmin",
      };

      const existingId = byExt.get(String(act.id)) ?? existingMap.get(`${date}__${title}`);
      if (existingId) toUpdate.push({ id: existingId, payload });
      else toInsert.push(payload);
    }

    // Séances RÉELLEMENT nouvelles (les mises à jour ne comptent pas : la sync
    // rafraîchit les 3 derniers jours à chaque sondage, ce qui produirait un
    // « du neuf » permanent et ferait republier le plan toutes les 2 minutes).
    freshWorkouts += toInsert.length;

    // Migration 015 en retard : PostgREST refuse l'écriture ENTIÈRE si `sport` n'existe
    // pas encore (42703). On sonde une fois et on retire la colonne partout plutôt que
    // de laisser la synchronisation échouer en bloc — le sport sera renseigné au premier
    // passage suivant l'application de la migration.
    {
      const probe = await supabase.from("workouts").select("sport, external_id, vertical_ratio_pct, hrr_bpm").limit(1);
      if (probe.error?.code === "42703") {
        for (const p of toInsert) { delete p.sport; delete p.external_id; delete p.vertical_ratio_pct; delete p.hrr_bpm; }
        for (const u of toUpdate) { delete u.payload.sport; delete u.payload.external_id; delete u.payload.vertical_ratio_pct; delete u.payload.hrr_bpm; }
      }
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
      // Ces champs sont ABSENTS de l'API wellness d'intervals.icu pour la plupart des
      // comptes. Les forcer à 0 fabriquait de la donnée : le coach lisait « 0 % de
      // sommeil profond » et y voyait une nuit catastrophique, alors qu'il s'agissait
      // simplement d'une mesure indisponible. Absent doit rester NULL.
      deep_sleep_min: d.deepSleepSecs != null ? Math.round(d.deepSleepSecs / 60) : null,
      light_sleep_min: d.lightSleepSecs != null ? Math.round(d.lightSleepSecs / 60) : null,
      rem_sleep_min: d.remSleepSecs != null ? Math.round(d.remSleepSecs / 60) : null,
      sleep_score: d.sleepScore ?? null,
      body_battery_start: d.bbMax ?? null,
      body_battery_end: d.bb ?? null,
      respiration_rate: d.avgRespiration ?? null,
      spo2_avg: d.avgSpo2 ?? null,
      source: "intervals_icu",
    }));

  // Métriques RICHES Garmin (montre) → profil. ⚠️ Le wellness le PLUS RÉCENT est souvent incomplet
  // (la FC repos / VFC se mesurent la nuit) → pour CHAQUE champ on prend la dernière valeur NON nulle.
  // Historique LONG (180 j) dédié : la fenêtre de sync est trop courte pour une vraie tendance VO2max
  // (Garmin ne met à jour la VO2max que ~1×/semaine) et le wellness récent manque souvent la FC repos.
  let histWell: IntervalsWellness[] = validWellness;
  try {
    const histOldest = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const hr = await fetch(`${BASE}/athlete/${ATHLETE_ID}/wellness?oldest=${histOldest}&newest=${newest}`, { headers: authHeader(API_KEY) });
    if (hr.ok) { const j = await hr.json(); if (Array.isArray(j) && j.length) histWell = (j as IntervalsWellness[]).filter(d => d.id); }
  } catch { /* on garde la fenêtre courte en repli */ }
  const wDesc = [...histWell].sort((a, b) => b.id.localeCompare(a.id)); // plus récent d'abord
  const latestNum = (k: keyof IntervalsWellness): number | null => {
    for (const w of wDesc) { const v = w[k]; if (typeof v === "number" && !Number.isNaN(v)) return v; }
    return null;
  };
  const latestVo2 = latestNum("vo2max");
  const ctlV = latestNum("ctl"), atlV = latestNum("atl"), rampV = latestNum("rampRate");
  const lastRun = (activities as unknown as Array<Record<string, unknown>>).find(a => /run/i.test(String(a.type ?? "")));
  const tpMps = Number(lastRun?.threshold_pace) || 0;
  // Historique VO2max (pour le graphique de tendance), ordre chronologique, ~120 derniers points.
  const vo2maxHistory = wDesc
    .filter(w => typeof w.vo2max === "number" && (w.vo2max as number) > 0)
    .map(w => ({ date: w.id, v: Math.round((w.vo2max as number) * 10) / 10 }))
    .reverse()
    .slice(-120);
  const garminMetrics = {
    vo2max: latestVo2,
    restingHR: latestNum("restingHR"),
    lthr: Number(lastRun?.lthr) || null,
    thresholdPaceSecPerKm: tpMps > 0 ? Math.round(1000 / tpMps) : null,
    ctl: ctlV != null ? Math.round(ctlV) : null,
    atl: atlV != null ? Math.round(atlV) : null,
    rampRate: rampV != null ? Math.round(rampV * 10) / 10 : null,
    vo2maxHistory,
    updatedAt: new Date().toISOString(),
  };
  const hasGarminMetrics = [garminMetrics.vo2max, garminMetrics.restingHR, garminMetrics.lthr, garminMetrics.ctl].some(v => v != null);

  await Promise.all([
    hrvRows.length > 0
      ? supabase.from("hrv_data").upsert(hrvRows, { onConflict: "user_id,date" })
          .then(() => { synced.hrv = hrvRows.length; })
      : Promise.resolve(),
    sleepRows.length > 0
      ? supabase.from("sleep_data").upsert(sleepRows, { onConflict: "user_id,date" })
          .then(() => { synced.sleep = sleepRows.length; })
      : Promise.resolve(),
    // best-effort (colonnes garmin_vo2max + garmin_metrics ajoutées via SQL) — n'empêche pas la sync.
    latestVo2 ? supabase.from("profiles").update({ garmin_vo2max: latestVo2 }).eq("id", user.id) : Promise.resolve(),
    hasGarminMetrics ? supabase.from("profiles").update({ garmin_metrics: garminMetrics }).eq("id", user.id) : Promise.resolve(),
  ]);

  // ── COACH INSTANTANÉ ──────────────────────────────────────────────────────
  // Dès qu'une séance vient d'être importée, on republie le plan des 7 jours dans la
  // foulée. AutoSync appelle cette route au chargement, au retour sur l'onglet et
  // toutes les 2 min : le plan reflète donc la dernière sortie en quelques minutes,
  // sans attendre le cron de la nuit. Best-effort — un échec ici ne casse pas la sync.
  // Position d'entraînement : rafraîchie au maximum une fois par jour depuis la
  // dernière course avec trace GPS. Sert à interroger la météo RÉELLE (la température
  // de la montre est mesurée au poignet, donc peu fiable).
  //
  // Volontairement PAS conditionné à `freshWorkouts` : sinon un athlète qui ne court
  // pas pendant quelques jours n'aurait jamais de position, donc jamais de météo —
  // alors que c'est précisément quand il ne court pas qu'on prépare ses prochains jours.
  {
    try {
      const lastRun = validActivities.find((a) => /run/i.test(String(a.type ?? "")) && a.id);
      if (lastRun?.id) {
        const { refreshAthleteLocation } = await import("@/lib/intervals/location");
        const { createAdminClient: adminFn } = await import("@/lib/supabase/admin");
        await refreshAthleteLocation(adminFn(), {
          userId: user.id, apiKey: API_KEY, activityId: String(lastRun.id),
          lastLocAt: (profile as { last_loc_at?: string | null } | null)?.last_loc_at ?? null,
        });
      }
    } catch { /* best-effort : la synchro n'échoue pas pour une position */ }
  }

  // Performance MESURÉE : courbe d'allure (meilleurs efforts + vitesse critique) et
  // exécution de la dernière séance de qualité. Deux appels réseau supplémentaires,
  // donc au plus une fois par jour.
  {
    try {
      const { refreshPerformance } = await import("@/lib/intervals/performance");
      const prevCurve = ((profile as { pace_curve?: import("@/lib/intervals/performance").PaceCurve | null } | null)?.pace_curve) ?? null;
      const { createAdminClient: adminFn2 } = await import("@/lib/supabase/admin");
      // Dernière séance dure identifiable : intensité élevée ou charge importante.
      const lastQ = validActivities.find((a) =>
        /run/i.test(String(a.type ?? "")) && a.id &&
        ((a.icu_intensity ?? 0) >= 85 || (a.icu_training_load ?? 0) >= 60));
      await refreshPerformance(adminFn2(), {
        userId: user.id, athleteId: ATHLETE_ID, apiKey: API_KEY,
        lastQualityId: lastQ?.id ? String(lastQ.id) : null,
        lastQualityDate: lastQ?.start_date_local ? String(lastQ.start_date_local).slice(0, 10) : null,
        storedAt: prevCurve?.at ?? null,
        previous: prevCurve,
      });
    } catch { /* best-effort : la synchro n'échoue pas pour une analyse */ }
  }

  let replanned = false;
  if (freshWorkouts > 0) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      // Garde-fou supplémentaire : jamais deux republications à moins de 10 min
      // d'intervalle (chaque republication pousse aussi des séances sur la montre).
      const { data: st } = await admin.from("notifications").select("data")
        .eq("user_id", user.id).eq("type", "auto_coach_state").maybeSingle();
      const lastAt = (st?.data as { at?: string } | null)?.at;
      if (!lastAt || Date.now() - new Date(lastAt).getTime() > 10 * 60000) {
        const { autoCoachForUser } = await import("@/lib/ai/autoCoach");
        const r = await autoCoachForUser(admin, { userId: user.id, athleteId: ATHLETE_ID, apiKey: API_KEY });
        replanned = !!r.processed;
      }
    } catch { /* le plan sera de toute façon recalculé par le cron */ }
  }

  return NextResponse.json({
    synced,
    freshWorkouts,
    replanned,
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
  average_vertical_oscillation?: number; average_vertical_ratio?: number;
  icu_hrr?: { hrr?: number } | null;
  average_temp?: number;
  gap?: number;
  icu_hr_zone_times?: number[];
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
  vo2max?: number;
  restingHR?: number;
  ctl?: number;
  atl?: number;
  rampRate?: number;
}
