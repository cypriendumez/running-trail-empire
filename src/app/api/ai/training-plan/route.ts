export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { race_id, target_time } = await req.json() as { race_id: string; target_time?: number };

  const [profileRes, baselineRes, raceRes, sleepRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("performance_baselines").select("*").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).single(),
    supabase.from("races").select("*").eq("id", race_id).single(),
    supabase.from("sleep_data").select("sleep_score,body_battery_end").eq("user_id", user.id).order("date", { ascending: false }).limit(7),
  ]);

  const profile = profileRes.data;
  const baseline = baselineRes.data;
  const race = raceRes.data;
  const recentSleep = sleepRes.data ?? [];

  if (!race) return NextResponse.json({ error: "Race not found" }, { status: 404 });

  const weeksUntilRace = Math.floor(
    (new Date(race.date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)
  );

  if (weeksUntilRace < 4) {
    return NextResponse.json({ error: "Race too soon (< 4 weeks)" }, { status: 400 });
  }

  const avgSleepScore = recentSleep.length
    ? Math.round(recentSleep.reduce((s, d) => s + (d.sleep_score ?? 70), 0) / recentSleep.length)
    : 70;

  const prompt = `Génère un plan d'entraînement running en JSON structuré pour:

ATHLÈTE:
- VMA: ${baseline?.vma_kmh ?? "inconnue"} km/h
- FTP: ${baseline?.ftp_watts ?? "inconnu"} W
- FC Max: ${baseline?.max_hr ?? 190} bpm | FC Repos: ${baseline?.resting_hr ?? 55} bpm
- Poids: ${profile?.weight_kg} kg | Chronotype: ${profile?.chronotype}
- Score sommeil moyen (7j): ${avgSleepScore}/100

COURSE CIBLE:
- Nom: ${race.name}
- Type: ${race.type} | Distance: ${race.distance_km} km
- Dénivelé: ${race.elevation_gain_m} m D+
- Date: ${race.date} | Semaines disponibles: ${weeksUntilRace}
${target_time ? `OBJECTIF: ${Math.floor(target_time / 3600)}h${String(Math.floor((target_time % 3600) / 60)).padStart(2, "0")}` : "OBJECTIF: finisher"}

PÉRIODISATION REQUISE:
- Phase base (40% des semaines): volume progressif Z1-Z2, faible intensité
- Phase développement (35%): intervalles VMA, tempo seuil, côtes
- Phase spécifique (15%): simulation course, terrain spécifique
- Affûtage (10%): réduction volume 40%, TSB cible +15 le Jour J

Retourne UNIQUEMENT du JSON valide avec cette structure exacte:
{
  "weeks": [
    {
      "week_number": 1,
      "phase": "base|development|specific|taper",
      "start_date": "YYYY-MM-DD",
      "total_km": 50,
      "total_elevation_m": 500,
      "ctl": 45,
      "atl": 48,
      "tsb": -3,
      "sessions": [
        {
          "day_of_week": 1,
          "type": "easy|tempo|interval|long_run|trail|vma|hill_repeat|recovery",
          "title": "Titre court",
          "description": "Description détaillée avec zones et cibles",
          "target_duration_min": 60,
          "target_distance_km": 10,
          "target_elevation_m": 0,
          "intensity_zone": "Z1|Z2|Z3|Z4|Z5",
          "target_watts_min": null,
          "target_watts_max": null,
          "is_key_session": false
        }
      ]
    }
  ]
}`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: "Tu es un coach running expert. Génère uniquement du JSON valide sans markdown, sans backticks.\n\n" + prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4000,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 });
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let planJson: Record<string, unknown>;
  try {
    planJson = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    planJson = match ? JSON.parse(match[0]) : {};
  }

  const { data: plan, error } = await supabase.from("training_plans").insert({
    user_id: user.id,
    race_id,
    name: `Plan ${race.name} — ${new Date(race.date).toLocaleDateString("fr")}`,
    start_date: new Date().toISOString().split("T")[0],
    race_date: race.date,
    weekly_km: (planJson.weeks as Array<{ total_km: number }>)?.[0]?.total_km ?? 50,
    target_seconds: target_time ?? null,
    plan_json: planJson,
    created_by: "ai",
    is_active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan });
}
