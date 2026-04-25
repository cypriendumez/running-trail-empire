export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAIL = "cypriendumez@outlook.fr";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(req: NextRequest) {
  // Auth guard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user_id, days = 30 } = await req.json().catch(() => ({}));
  if (!user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 });

  const admin = createAdminClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Fetch all athlete data
  const [profileRes, workoutsRes, hrvRes, sleepRes, baselineRes] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user_id).single(),
    admin.from("workouts").select("*").eq("user_id", user_id).gte("date", since).order("date", { ascending: false }).limit(50),
    admin.from("hrv_data").select("*").eq("user_id", user_id).gte("date", since).order("date", { ascending: false }).limit(30),
    admin.from("sleep_data").select("*").eq("user_id", user_id).gte("date", since).order("date", { ascending: false }).limit(30),
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
    period_days: days,
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
    sleep: sleep.map(s => ({
      date: s.date,
      total_min: s.total_sleep_min,
      score: s.sleep_score,
      body_battery: s.body_battery_end,
    })),
  };

  // Step 1: Gemini analysis
  if (!GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY manquant" }, { status: 503 });
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Analyse les données d'entraînement de cet athlète et génère un rapport JSON structuré.\n\nDONNÉES:\n${JSON.stringify(athleteData)}\n\nRéponds en JSON:\n{\n  "summary": "Synthèse 2 phrases",\n  "weekly_km": number,\n  "training_load": "low|moderate|high|very_high",\n  "recovery_status": "recovered|adequate|fatigued|overreached",\n  "hrv_trend": "improving|stable|declining",\n  "strengths": ["force 1", "force 2"],\n  "areas_to_improve": ["point 1"],\n  "risk_flags": ["risque si applicable"],\n  "next_week_recommendation": "recommandation précise"\n}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1500, responseMimeType: "application/json" },
      }),
    }
  );

  if (!geminiRes.ok) return NextResponse.json({ error: "Erreur Gemini" }, { status: 502 });
  const geminiData = await geminiRes.json();
  const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let analysis: Record<string, unknown> = {};
  try { analysis = JSON.parse(rawText); } catch { const m = rawText.match(/\{[\s\S]*\}/); if (m) analysis = JSON.parse(m[0]); }

  // Step 2: Claude coaching plan
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ gemini: analysis, error: "ANTHROPIC_API_KEY manquant" }, { status: 206 });
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `Tu es un coach trail running expert. Rédige un plan de la semaine prochaine pour ${profile?.full_name || "l'athlète"} basé sur cette analyse.\n\nANALYSE GEMINI:\n${JSON.stringify(analysis, null, 2)}\n\nDONNÉES ATHLÈTE:\n- VMA: ${baseline?.vma_kmh ?? "?"}km/h, FC max: ${baseline?.max_hr ?? "?"}bpm\n- Mode: ${profile?.mode}\n\nFormat attendu:\n1. Commentaire sur la semaine passée (2-3 phrases, cite des chiffres)\n2. Plan semaine prochaine : liste les séances jour par jour (type, durée, intensité, allure cible)\n3. Point clé à surveiller\n\nTon direct, humain, exigeant. 250-300 mots max. PAS de mention IA.`,
      }],
    }),
  });

  const claudeData = await claudeRes.json();
  const plan = claudeData.content?.[0]?.text ?? "";

  return NextResponse.json({
    gemini: analysis,
    plan,
    workouts_analyzed: workouts.length,
    period_days: days,
  });
}
