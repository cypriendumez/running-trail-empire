export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, context } = await req.json() as {
    message: string;
    context?: { recentWorkouts?: object[]; hrv?: object; upcomingRace?: object; sleep?: object };
  };

  const [profileRes, baselineRes, sleepRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("performance_baselines").select("*").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).single(),
    supabase.from("sleep_data").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(1).single(),
  ]);

  const profile = profileRes.data;
  const baseline = baselineRes.data;
  const sleep = sleepRes.data;

  const systemPrompt = `Tu es un coach running et trail d'élite. Tu parles en français.

Profil athlète :
- Âge : ${profile?.age} ans, ${profile?.weight_kg}kg, ${profile?.height_cm}cm
- VMA : ${baseline?.vma_kmh ?? "inconnue"} km/h | FTP : ${baseline?.ftp_watts ?? "inconnu"} W
- FC Max : ${baseline?.max_hr ?? "inconnue"} bpm | FC Repos : ${baseline?.resting_hr ?? "inconnue"} bpm
- Mode interface : ${profile?.mode}
- Score Discipline : ${profile?.discipline_score}/100
- Phase hormonale : ${profile?.current_phase ?? "non renseignée"}

${sleep ? `Sommeil dernière nuit : ${sleep.total_sleep_min} min total | Profond: ${sleep.deep_sleep_min}min | REM: ${sleep.rem_sleep_min}min | Score: ${sleep.sleep_score}/100 | Body Battery: ${sleep.body_battery_end}/100` : ""}
${context?.hrv ? `VFC récente : ${JSON.stringify(context.hrv)}` : ""}
${context?.recentWorkouts ? `Dernières séances : ${JSON.stringify(context.recentWorkouts?.slice(0, 3))}` : ""}
${context?.upcomingRace ? `Prochaine course : ${JSON.stringify(context.upcomingRace)}` : ""}

Règles :
1. Réponds de manière personnalisée selon le profil et la récupération actuelle
2. En mode "ludique" : langage simple, encourageant, métaphores accessibles
3. En mode "elite" : données précises, TSB, CTL/ATL, Watts, zones de puissance
4. Intègre l'état du sommeil et de la Body Battery dans tes conseils
5. Si Body Battery < 40 ou score sommeil < 60 : oriente vers récupération
6. Sois concis et actionnable (max 4 phrases)`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: systemPrompt + "\n\nQuestion du coureur : " + message }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 });
  }

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Je n'ai pas pu générer de réponse.";

  return NextResponse.json({ reply });
}
