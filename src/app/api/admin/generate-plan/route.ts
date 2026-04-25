export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAIL = "cypriendumez@outlook.fr";
const GEMINI_KEY = process.env.GEMINI_API_KEY;
// gemini-1.5-flash = free tier, gemini-2.0-flash = requires billing
const GEMINI_URL = (model: string = "gemini-1.5-flash") =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
const ICU_BASE = "https://intervals.icu/api/v1";

function icuAuth(apiKey: string) {
  return "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user_id, sessions = 5, planType = "semaine", coachNote = "" } = await req.json().catch(() => ({}));
  if (!user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 });
  if (!GEMINI_KEY) return NextResponse.json({ error: "GEMINI_API_KEY manquant dans Railway" }, { status: 503 });

  const admin = createAdminClient();

  // Fetch profile + baseline from Supabase
  const [profileRes, baselineRes] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user_id).single(),
    admin.from("performance_baselines").select("*").eq("user_id", user_id).order("tested_at", { ascending: false }).limit(1).single(),
  ]);

  const profile = profileRes.data;
  const baseline = baselineRes.data;

  // ── Fetch directly from Intervals.icu if credentials available ──
  const athleteId = profile?.intervals_athlete_id;
  const apiKey = profile?.intervals_api_key;

  let icuActivities: unknown[] = [];
  let icuWellness: unknown[] = [];
  let icuSource = false;

  if (athleteId && apiKey) {
    const oldest = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const newest = new Date().toISOString().split("T")[0];

    const [actRes, wellRes] = await Promise.all([
      fetch(`${ICU_BASE}/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`, {
        headers: { Authorization: icuAuth(apiKey) },
      }),
      fetch(`${ICU_BASE}/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`, {
        headers: { Authorization: icuAuth(apiKey) },
      }),
    ]);

    if (actRes.ok) {
      const all: unknown[] = await actRes.json();
      // Keep only last N sessions
      icuActivities = all.slice(0, sessions).map((a: any) => ({
        date: a.start_date_local?.split("T")[0],
        name: a.name,
        type: a.type,
        distance_km: a.distance ? +(a.distance / 1000).toFixed(2) : null,
        duration_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
        elevation_m: a.total_elevation_gain ?? null,
        avg_hr: a.average_heartrate ?? null,
        max_hr: a.max_heartrate ?? null,
        avg_pace_min_km: a.average_speed ? +(60 / (a.average_speed * 3.6)).toFixed(2) : null,
        tss: a.icu_tss ?? null,
        training_effect: a.aerobic_te ?? null,
        cadence: a.average_cadence ? Math.round(a.average_cadence * 2) : null,
        power_avg: a.average_watts ?? null,
        vertical_osc: a.avg_vertical_oscillation ?? null,
        ground_contact: a.avg_ground_contact_time ?? null,
      }));
      icuSource = true;
    }

    if (wellRes.ok) {
      const wellAll: unknown[] = await wellRes.json();
      icuWellness = wellAll.slice(0, sessions * 2).map((w: any) => ({
        date: w.id,
        hrv: w.hrv ?? null,
        hrv_sdnn: w.hrvSDNN ?? null,
        sleep_hours: w.sleepSecs ? +(w.sleepSecs / 3600).toFixed(1) : null,
        sleep_score: w.sleepScore ?? null,
        body_battery: w.bb ?? null,
        spo2: w.avgSpo2 ?? null,
        resting_hr: w.restingHR ?? null,
        form: w.form ?? null,
        fatigue: w.atl ?? null,
        fitness: w.ctl ?? null,
      }));
    }
  }

  // Fallback: Supabase data if no Intervals.icu
  let fallbackWorkouts: unknown[] = [];
  let fallbackHrv: unknown[] = [];
  let fallbackSleep: unknown[] = [];

  if (!icuSource) {
    const [wRes, hRes, sRes] = await Promise.all([
      admin.from("workouts").select("*").eq("user_id", user_id).order("date", { ascending: false }).limit(sessions),
      admin.from("hrv_data").select("*").eq("user_id", user_id).order("date", { ascending: false }).limit(sessions * 2),
      admin.from("sleep_data").select("*").eq("user_id", user_id).order("date", { ascending: false }).limit(sessions * 2),
    ]);
    fallbackWorkouts = (wRes.data ?? []).map((w: any) => ({
      date: w.date, type: w.type,
      distance_km: w.distance_km,
      duration_min: Math.round((w.duration_seconds ?? 0) / 60),
      elevation_m: w.elevation_gain_m,
      avg_hr: w.avg_hr, tss: w.tss,
    }));
    fallbackHrv = (hRes.data ?? []).map((h: any) => ({ date: h.date, hrv: h.hrv_ms, state: h.physiological_state }));
    fallbackSleep = (sRes.data ?? []).map((s: any) => ({ date: s.date, sleep_hours: s.total_sleep_min ? +(s.total_sleep_min / 60).toFixed(1) : null, score: s.sleep_score, body_battery: s.body_battery_end }));
  }

  const athleteData = {
    data_source: icuSource ? "intervals.icu (temps réel)" : "supabase (synchronisé)",
    profile: {
      name: profile?.full_name,
      age: profile?.age,
      gender: profile?.gender,
      weight_kg: profile?.weight_kg,
      mode: profile?.mode,
      vma_kmh: baseline?.vma_kmh,
      max_hr: baseline?.max_hr,
      resting_hr: baseline?.resting_hr,
    },
    sessions_count: icuSource ? icuActivities.length : fallbackWorkouts.length,
    activities: icuSource ? icuActivities : fallbackWorkouts,
    wellness: icuSource ? icuWellness : [...fallbackHrv, ...fallbackSleep],
  };

  // Step 1 — Gemini Flash: analysis
  const analysisRes = await fetch(GEMINI_URL("gemini-1.5-flash"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `Analyse les données d'entraînement de cet athlète (source: ${athleteData.data_source}) et génère un rapport JSON.\n\nDONNÉES COMPLÈTES:\n${JSON.stringify(athleteData, null, 2)}\n\nRéponds UNIQUEMENT en JSON valide:\n{"summary":"Synthèse 2 phrases précises avec chiffres","training_load":"low|moderate|high|very_high","recovery_status":"recovered|adequate|fatigued|overreached","hrv_trend":"improving|stable|declining","fitness_trend":"improving|stable|declining","strengths":["point fort précis"],"areas_to_improve":["point précis"],"risk_flags":[],"next_week_recommendation":"recommandation précise"}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1200, responseMimeType: "application/json" },
    }),
  });

  if (!analysisRes.ok) {
    const errText = await analysisRes.text();
    return NextResponse.json({ error: `Gemini error ${analysisRes.status}: ${errText.slice(0, 300)}` }, { status: 502 });
  }

  const analysisData = await analysisRes.json();
  const rawText = analysisData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let analysis: Record<string, unknown> = {};
  try { analysis = JSON.parse(rawText); } catch { const m = rawText.match(/\{[\s\S]*\}/); if (m) try { analysis = JSON.parse(m[0]); } catch {} }

  // Step 2 — Gemini: coaching plan
  const planRes = await fetch(GEMINI_URL("gemini-1.5-flash"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `Tu es un coach trail running expert. Rédige un plan "${planType}" pour ${profile?.full_name || "l'athlète"}.\n\nANALYSE (basée sur données ${athleteData.data_source}):\n${JSON.stringify(analysis, null, 2)}\n\nPROFIL:\n- VMA: ${baseline?.vma_kmh ?? "?"}km/h | FC max: ${baseline?.max_hr ?? "?"}bpm | FC repos: ${baseline?.resting_hr ?? "?"}bpm | Mode: ${profile?.mode}${coachNote ? `\n\nNOTE DU COACH: ${coachNote}` : ""}\n\nSTRUCTURE OBLIGATOIRE:\n**Bilan** : 2-3 phrases sur les séances analysées (cite des chiffres réels)\n**Plan semaine — "${planType}"** :\n- Lundi : [type] [durée] [intensité] [allure/FC cible]\n- Mardi : ...\n- (tous les jours)\n**Point clé** : 1 conseil technique prioritaire\n\nTon : coach direct et exigeant. 300 mots max. Zéro mention IA.` }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 1200 },
    }),
  });

  const planData = await planRes.json();
  const plan = planData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return NextResponse.json({
    gemini: analysis,
    plan,
    sessions_analyzed: athleteData.sessions_count,
    data_source: athleteData.data_source,
    icu_connected: icuSource,
    raw_activities: athleteData.activities,
    raw_wellness: icuSource ? icuWellness.slice(0, 7) : [],
  });
}
