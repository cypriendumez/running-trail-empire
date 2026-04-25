export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// POST /api/admin/report  { user_id, week_start }
// Generates a Gemini Flash technical synthesis for a given athlete + week
export async function POST(req: Request) {
  const authHeader = req.headers.get("x-admin-secret");
  if (authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { user_id, week_start } = await req.json() as { user_id: string; week_start: string };

  const weekEnd = new Date(new Date(week_start).getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [profileRes, workoutsRes, hrvRes, sleepRes, baselineRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user_id).single(),
    supabase.from("workouts").select("*").eq("user_id", user_id).gte("date", week_start).lte("date", weekEnd),
    supabase.from("hrv_data").select("*").eq("user_id", user_id).gte("date", week_start).lte("date", weekEnd),
    supabase.from("sleep_data").select("*").eq("user_id", user_id).gte("date", week_start).lte("date", weekEnd),
    supabase.from("performance_baselines").select("*").eq("user_id", user_id).order("tested_at", { ascending: false }).limit(1).single(),
  ]);

  const profile = profileRes.data;
  const workouts = workoutsRes.data ?? [];
  const hrv = hrvRes.data ?? [];
  const sleep = sleepRes.data ?? [];
  const baseline = baselineRes.data;

  const athleteJson = JSON.stringify({
    profile: {
      name: profile?.full_name,
      age: profile?.age,
      weight_kg: profile?.weight_kg,
      vma_kmh: baseline?.vma_kmh,
      ftp_watts: baseline?.ftp_watts,
      max_hr: baseline?.max_hr,
    },
    week: week_start,
    workouts: workouts.map((w) => ({
      date: w.date,
      type: w.type,
      distance_km: w.distance_km,
      duration_min: Math.round((w.duration_seconds ?? 0) / 60),
      elevation_m: w.elevation_gain_m,
      avg_hr: w.avg_hr,
      avg_power: w.avg_power_watts,
      tss: w.tss,
      training_effect: w.training_effect,
      cadence: w.avg_cadence_spm,
      vertical_osc: w.vertical_oscillation_cm,
      ground_contact: w.ground_contact_time_ms,
    })),
    hrv: hrv.map((h) => ({ date: h.date, hrv_ms: h.hrv_ms, state: h.physiological_state })),
    sleep: sleep.map((s) => ({
      date: s.date,
      total_min: s.total_sleep_min,
      deep_min: s.deep_sleep_min,
      rem_min: s.rem_sleep_min,
      score: s.sleep_score,
      body_battery: s.body_battery_end,
    })),
  });

  const prompt = `Analyse scientifique de la semaine d'entraînement pour ce coureur.

DONNÉES JSON:
${athleteJson}

Génère un rapport technique structuré en JSON avec:
{
  "summary": "Synthèse en 2 phrases",
  "weekly_tss": number,
  "weekly_km": number,
  "avg_hrv": number,
  "avg_sleep_score": number,
  "avg_body_battery": number,
  "training_load": "low|moderate|high|very_high",
  "recovery_status": "recovered|adequate|fatigued|overreached",
  "biomechanics_analysis": "Analyse cadence, oscillation, contact au sol",
  "power_analysis": "Analyse puissance et zones",
  "sleep_quality_analysis": "Analyse cycles sommeil et récupération",
  "hrv_trend": "improving|stable|declining",
  "strengths": ["point fort 1", "point fort 2"],
  "areas_to_improve": ["point à améliorer 1"],
  "next_week_recommendation": "Recommandation pour la semaine suivante",
  "risk_flags": ["risque identifié si applicable"]
}`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000, responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Gemini error" }, { status: 502 });
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let geminiJson: Record<string, unknown>;
  try {
    geminiJson = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    geminiJson = match ? JSON.parse(match[0]) : {};
  }

  const { data: adviceRow, error } = await supabase
    .from("ai_advice")
    .upsert({
      user_id,
      week_start,
      gemini_report: geminiJson.summary as string,
      gemini_json: geminiJson,
      advice_author: "gemini",
      published: false,
    }, { onConflict: "user_id,week_start" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: adviceRow, gemini_analysis: geminiJson });
}
