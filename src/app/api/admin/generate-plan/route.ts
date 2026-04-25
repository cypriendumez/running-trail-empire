export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAIL = "cypriendumez@outlook.fr";
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

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

  // Fetch athlete data — last N sessions (no date filter)
  const [profileRes, workoutsRes, hrvRes, sleepRes, baselineRes] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user_id).single(),
    admin.from("workouts").select("*").eq("user_id", user_id).order("date", { ascending: false }).limit(sessions),
    admin.from("hrv_data").select("*").eq("user_id", user_id).order("date", { ascending: false }).limit(sessions * 2),
    admin.from("sleep_data").select("*").eq("user_id", user_id).order("date", { ascending: false }).limit(sessions * 2),
    admin.from("performance_baselines").select("*").eq("user_id", user_id).order("tested_at", { ascending: false }).limit(1).single(),
  ]);

  const profile = profileRes.data;
  const workouts = workoutsRes.data ?? [];
  const hrv = hrvRes.data ?? [];
  const sleep = sleepRes.data ?? [];
  const baseline = baselineRes.data;

  const athleteData = {
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
    sessions_analyzed: workouts.length,
    workouts: workouts.map(w => ({
      date: w.date,
      type: w.type,
      distance_km: w.distance_km,
      duration_min: Math.round((w.duration_seconds ?? 0) / 60),
      elevation_m: w.elevation_gain_m,
      avg_hr: w.avg_hr,
      tss: w.tss,
      training_effect: w.training_effect,
      cadence: w.avg_cadence_spm,
    })),
    hrv: hrv.map(h => ({ date: h.date, hrv_ms: h.hrv_ms, state: h.physiological_state })),
    sleep: sleep.map(s => ({ date: s.date, total_min: s.total_sleep_min, score: s.sleep_score, body_battery: s.body_battery_end })),
  };

  // Step 1 — Gemini Flash: structured analysis
  const analysisRes = await fetch(GEMINI_URL("gemini-2.0-flash"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `Analyse les ${workouts.length} dernières séances de cet athlète et génère un rapport JSON.\n\nDONNÉES:\n${JSON.stringify(athleteData)}\n\nRéponds UNIQUEMENT en JSON valide:\n{"summary":"Synthèse 2 phrases","training_load":"low|moderate|high|very_high","recovery_status":"recovered|adequate|fatigued|overreached","hrv_trend":"improving|stable|declining","strengths":["force 1"],"areas_to_improve":["point 1"],"risk_flags":[],"next_week_recommendation":"recommandation précise"}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1000, responseMimeType: "application/json" },
    }),
  });

  if (!analysisRes.ok) {
    const errText = await analysisRes.text();
    return NextResponse.json({ error: `Gemini error ${analysisRes.status}: ${errText.slice(0, 200)}` }, { status: 502 });
  }

  const analysisData = await analysisRes.json();
  const rawText = analysisData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let analysis: Record<string, unknown> = {};
  try { analysis = JSON.parse(rawText); } catch { const m = rawText.match(/\{[\s\S]*\}/); if (m) try { analysis = JSON.parse(m[0]); } catch {} }

  // Step 2 — Gemini Pro: coaching plan week by week
  const planRes = await fetch(GEMINI_URL("gemini-2.0-flash"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `Tu es un coach trail running expert. Rédige un plan "${planType}" pour ${profile?.full_name || "l'athlète"}.\n\nANALYSE DES ${workouts.length} DERNIÈRES SÉANCES:\n${JSON.stringify(analysis, null, 2)}\n\nPROFIL:\n- VMA: ${baseline?.vma_kmh ?? "?"}km/h | FC max: ${baseline?.max_hr ?? "?"}bpm | FC repos: ${baseline?.resting_hr ?? "?"}bpm | Mode: ${profile?.mode}${coachNote ? `\n\nNOTE DU COACH: ${coachNote}` : ""}\n\nSTRUCTURE OBLIGATOIRE:\n**Bilan** : 2-3 phrases sur les séances analysées (cite des chiffres réels)\n**Plan semaine — type "${planType}"** :\n- Lundi : [type] [durée] [intensité] [allure/FC cible]\n- Mardi : ...\n- (chaque jour de la semaine)\n**Point clé** : 1 conseil technique prioritaire\n\nTon : coach direct et exigeant. 300 mots max. Zéro mention IA.` }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 1200 },
    }),
  });

  const planData = await planRes.json();
  const plan = planData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return NextResponse.json({ gemini: analysis, plan, sessions_analyzed: workouts.length });
}
