export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateContent } from "@/lib/ai/gemini";
import { exigeAcces } from "@/lib/billing/guard";


export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── VERROU D'ABONNEMENT ──────────────────────────────────────────────────
  // Cette route fait PARLER un modèle : c'est exactement ce que la formule Complet
  // facture, parce que c'est la seule partie du produit dont le coût grandit avec
  // le nombre d'athlètes. Masquer le bouton côté interface ne suffirait pas — la
  // route resterait appelable à la main, et c'est l'appel qui coûte.
  const refus = await exigeAcces(supabase, user.id, "ia");
  if (refus) return refus.reponse;

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

  // ⚠️ CLIENT PARTAGÉ, et plus un `fetch` vers une URL bâtie à la main. Cette route
  // écrivait le nom du modèle DANS son URL : elle échappait à la mémoire de quota (elle
  // rappelait donc Google après épuisement, pour rien) et à la bascule de modèle. Google
  // a déjà retiré `gemini-2.0-flash` ; le jour où `2.5` suivra, une URL figée tomberait
  // en silence.
  //
  // 600 jetons de sortie : le prompt demande « max 4 phrases », et la sortie coûte huit
  // fois l'entrée au jeton. Un plafond large ici ne rendrait pas la réponse meilleure,
  // il la rendrait seulement plus chère.
  const r = await generateContent(
    [{ role: "user", parts: [{ text: systemPrompt + "\n\nQuestion du coureur : " + message }] }],
    { temperature: 0.7, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } },
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  return NextResponse.json({ reply: r.text });
}
