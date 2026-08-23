export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estAdmin } from "@/lib/admin/acces";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// POST /api/admin/coach-analyze {user_id} — analyse IA d'un client + séance proposée.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !estAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id } = await req.json() as { user_id: string };
  if (!user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 });

  const admin = createAdminClient();
  const [profileRes, workoutsRes, hrvRes, sleepRes, baselineRes, planRes, memoRes] = await Promise.all([
    admin.from("profiles").select("full_name,age,weight_kg,height_cm").eq("id", user_id).single(),
    admin.from("workouts").select("title,type,date,distance_km,elevation_gain_m,duration_seconds,avg_hr,max_hr,avg_pace_min_km,avg_cadence_spm,tss,stride_length_m").eq("user_id", user_id).order("date", { ascending: false }).limit(25),
    admin.from("hrv_data").select("hrv_ms,physiological_state,date").eq("user_id", user_id).order("date", { ascending: false }).limit(1).single(),
    admin.from("sleep_data").select("total_sleep_min,sleep_score,body_battery_end").eq("user_id", user_id).order("date", { ascending: false }).limit(1).single(),
    admin.from("performance_baselines").select("vma_kmh,max_hr,resting_hr").eq("user_id", user_id).order("tested_at", { ascending: false }).limit(1).single(),
    admin.from("training_plans").select("race_date,goal").eq("user_id", user_id).eq("is_active", true).single(),
    admin.from("notifications").select("data,created_at").eq("user_id", user_id).eq("type", "session_ai_analysis").order("created_at", { ascending: false }).limit(3),
  ]);

  const p = profileRes.data, w = workoutsRes.data ?? [], hrv = hrvRes.data, sleep = sleepRes.data, base = baselineRes.data, plan = planRes.data;
  const recent = w.filter((x) => new Date(x.date).getTime() > Date.now() - 14 * 86400000);
  const weekKm = w.filter((x) => new Date(x.date).getTime() > Date.now() - 7 * 86400000).reduce((s, x) => s + (x.distance_km ?? 0), 0);
  const km14 = recent.reduce((s, x) => s + (x.distance_km ?? 0), 0);
  const fmtP = (pace?: number) => (pace ? `${Math.floor(pace)}'${String(Math.round((pace % 1) * 60)).padStart(2, "0")}` : "?");
  const sessionsTxt = recent.map((x) => `${x.date} · ${x.title ?? x.type} : ${x.distance_km ?? "?"} km, allure ${fmtP(x.avg_pace_min_km)}/km, FC ${x.avg_hr ?? "?"}/${x.max_hr ?? "?"}, cadence ${x.avg_cadence_spm ?? "?"} spm, foulée ${x.stride_length_m ?? "?"} m, charge ${x.tss ?? "?"}, D+${x.elevation_gain_m ?? 0} m`).join("\n  ") || "aucune séance récente";
  const tss14 = recent.reduce((s, x) => s + (x.tss ?? 0), 0);
  const daysToRace = plan?.race_date ? Math.ceil((new Date(plan.race_date).getTime() - Date.now()) / 86400000) : null;
  const memo = (memoRes.data ?? []) as { data?: { date?: string; analysis?: string } }[];
  const memoTxt = memo.length ? memo.map((m) => `- ${m.data?.date ?? "?"} : ${(m.data?.analysis ?? "").replace(/\s+/g, " ").slice(0, 280)}`).join("\n  ") : "aucune pour l'instant";

  const prompt = `Tu es le coach running/trail expert et PRÉCIS de ${p?.full_name ?? "cet athlète"}. Analyse sa charge des 2 dernières semaines et prescris LA séance optimale pour aujourd'hui.

PROFIL : ${p?.age ?? "?"} ans · ${p?.weight_kg ?? "?"} kg · VMA ${base?.vma_kmh ?? "?"} km/h · FC max ${base?.max_hr ?? "?"} · FC repos ${base?.resting_hr ?? "?"}
RÉCUPÉRATION : VFC ${hrv?.hrv_ms ?? "non synchronisée"}${hrv?.physiological_state ? ` (${hrv.physiological_state})` : ""} · sommeil ${sleep?.sleep_score ?? "non synchronisé"}
CHARGE : ${weekKm.toFixed(0)} km / 7 j · ${km14.toFixed(0)} km / 14 j · ${recent.length} séances · charge cumulée ${tss14.toFixed(0)} TSS / 14 j
COURSE CIBLE : ${daysToRace != null ? `J-${daysToRace}` : "aucune"} ${plan?.goal ? `(objectif : ${plan.goal})` : ""}

SÉANCES DES 14 DERNIERS JOURS :
  ${sessionsTxt}

MÉMOIRE COACH (analyses détaillées de séances déjà envoyées à l'IA — tiens-en compte) :
  ${memoTxt}

CONSIGNES (sois précis et chiffré) :
- Déduis les allures cibles depuis la VMA (endurance ~65-75 % VMA, seuil ~85-90 %, VMA ~100-105 %) et donne-les en min/km.
- Analyse la distribution d'intensité (idéal polarisé 80/20), la progression du volume, et les signaux de fatigue (FC élevée à allure facile, baisse de cadence).
- Adapte la séance à la charge récente et à l'objectif. Si VFC/sommeil non dispo, base-toi sur la charge et les FC.

Réponds UNIQUEMENT en JSON valide :
{"analysis":"3-4 phrases PRÉCISES : charge, distribution d'intensité, fatigue éventuelle, point clé","session":{"title":"nom court","subtitle":"détail chiffré : zone + allure cible en min/km + distance/durée","tags":["2-3 tags courts ex Z2, 12 km, seuil"],"why":"justification précise liée à ses données"}}`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 800, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }),
    });
    if (!res.ok) return NextResponse.json({ error: res.status === 429 ? "Quota IA atteint" : `IA indisponible (${res.status})` }, { status: 502 });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "Réponse IA illisible" }, { status: 502 });
    const parsed = JSON.parse(m[0]);
    return NextResponse.json({
      analysis: String(parsed.analysis ?? "").slice(0, 400),
      session: {
        title: String(parsed.session?.title ?? "").slice(0, 60),
        subtitle: String(parsed.session?.subtitle ?? "").slice(0, 120),
        tags: Array.isArray(parsed.session?.tags) ? parsed.session.tags.slice(0, 3).map((t: unknown) => String(t).slice(0, 16)) : [],
        why: String(parsed.session?.why ?? "").slice(0, 160),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `Erreur IA: ${(e as Error).message}` }, { status: 502 });
  }
}
