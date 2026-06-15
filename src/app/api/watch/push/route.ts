export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BASE = "https://intervals.icu/api/v1";

function authHeader(apiKey: string) {
  return {
    Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64"),
    "Content-Type": "application/json",
  };
}

const paceStr = (secPerKm: number): string => {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
const fmtClock = (sec: number): string => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

/**
 * POST /api/watch/push
 * Body: { distanceKm, targetSeconds, name?, date? (YYYY-MM-DD), elevationM? }
 * Construit une séance structurée à l'allure objectif et l'envoie dans le calendrier
 * intervals.icu de l'athlète → qui la pousse vers la montre (Garmin / Coros / Wahoo).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetType: "pace" | "hr" = body.targetType === "hr" ? "hr" : "pace";
  const distanceKm = Number(body.distanceKm);
  const targetSeconds = Number(body.targetSeconds);
  const durationMin = Math.round(Number(body.durationMin) || 0);
  const hrZone = Math.min(5, Math.max(1, Math.round(Number(body.hrZone) || 0)));
  const elevationM = Number(body.elevationM ?? 0);
  const name: string = String(body.name ?? (targetType === "hr" ? "Séance cardio" : "Objectif course")).slice(0, 80);
  // Par défaut : DEMAIN (une séance « du jour » déjà entamée n'est pas poussée vers la montre).
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const date: string = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : tomorrow;

  if (targetType === "pace" && (!(distanceKm > 0) || !(targetSeconds > 0))) {
    return NextResponse.json({ error: "Distance et objectif requis." }, { status: 400 });
  }
  if (targetType === "hr" && !(durationMin > 0)) {
    return NextResponse.json({ error: "Durée et zone FC requises." }, { status: 400 });
  }

  // Identifiants intervals.icu (profil de l'athlète, sinon variables d'env).
  const { data: profile } = await supabase
    .from("profiles")
    .select("intervals_athlete_id, intervals_api_key")
    .eq("id", user.id)
    .single();
  const ATHLETE_ID = profile?.intervals_athlete_id || process.env.INTERVALS_ICU_ATHLETE_ID;
  const API_KEY = profile?.intervals_api_key || process.env.INTERVALS_ICU_API_KEY;

  if (!ATHLETE_ID || !API_KEY) {
    return NextResponse.json({
      ok: false,
      needsSetup: true,
      message: "Connecte d'abord ta montre via intervals.icu (onglet Sync Montre) pour envoyer tes objectifs.",
    }, { status: 200 });
  }

  // ── Pré-requis CRUCIAL : intervals.icu n'envoie l'allure cible à Garmin QUE si une allure
  //    seuil de course est définie. On la renseigne automatiquement (depuis la VMA) si absente,
  //    sinon la séance arrive sur la montre « sans allure » (inutile pour une cible FC).
  if (targetType === "pace") try {
    const ssRes = await fetch(`${BASE}/athlete/${ATHLETE_ID}/sport-settings`, { headers: authHeader(API_KEY) });
    if (ssRes.ok) {
      const settings = (await ssRes.json()) as { id: number; types?: string[]; threshold_pace?: number | null }[];
      const run = settings.find((s) => (s.types ?? []).some((t) => /Run/i.test(String(t))));
      if (run && (run.threshold_pace == null || run.threshold_pace <= 0)) {
        const { data: base } = await supabase
          .from("performance_baselines").select("vma_kmh")
          .eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).single();
        const vma = Number((base as { vma_kmh?: number } | null)?.vma_kmh) || 0;
        const thrMps = vma > 0 ? (vma * 0.88) / 3.6 : 1000 / (targetSeconds / distanceKm); // m/s ≈ allure seuil
        await fetch(`${BASE}/athlete/${ATHLETE_ID}/sport-settings/${run.id}`, {
          method: "PUT",
          headers: authHeader(API_KEY),
          body: JSON.stringify({ threshold_pace: Math.round(thrMps * 1000) / 1000 }),
        }).catch(() => undefined);
      }
    }
  } catch { /* best effort : on continue même si le réglage échoue */ }

  // ── Construit la séance selon la cible : ALLURE (distance + allure) ou FC (durée + zone cardiaque).
  const HR_ZONE_LABEL = ["", "Z1 Récup", "Z2 Endurance", "Z3 Tempo", "Z4 Seuil", "Z5 VO2max"];
  let description: string;
  let eventName: string;
  let summary: string;

  if (targetType === "hr") {
    const zl = HR_ZONE_LABEL[hrZone] ?? `Z${hrZone}`;
    eventName = `❤️ ${name}`.slice(0, 90);
    // Syntaxe intervals.icu : « <durée>m Z<zone> HR » → cible de fréquence cardiaque envoyée à la montre.
    description = [
      `❤️ ${name} — ${durationMin} min en ${zl} (fréquence cardiaque)`,
      "",
      `- ${durationMin}m Z${hrZone} HR`,
    ].join("\n");
    summary = `${durationMin} min en ${zl}`;
  } else {
    const targetPaceSec = targetSeconds / distanceKm;           // s/km
    const fast = paceStr(Math.max(120, targetPaceSec - 5));
    const slow = paceStr(targetPaceSec + 5);
    const km = Math.round(distanceKm * 1000) / 1000;
    const elevNote = elevationM > 0 ? ` · ${elevationM} m D+` : "";
    eventName = `🎯 ${name}`.slice(0, 90);
    // Syntaxe intervals.icu : « <dist>km <fast>-<slow> pace » → cible d'allure réelle envoyée à la montre.
    description = [
      `🎯 ${name} — ${distanceKm} km à ${paceStr(targetPaceSec)}/km (objectif ${fmtClock(targetSeconds)})${elevNote}`,
      "",
      `- ${km}km ${fast}-${slow} pace Allure objectif`,
    ].join("\n");
    summary = `${distanceKm} km à ${paceStr(targetPaceSec)}/km`;
  }

  const event = {
    category: "WORKOUT",
    start_date_local: `${date}T00:00:00`,
    type: "Run",
    name: eventName,
    description,
    external_id: `rte-objective-${user.id}-${date}`,
  };

  // Remplace une éventuelle séance déjà envoyée pour cette date (évite les doublons).
  try {
    const existRes = await fetch(`${BASE}/athlete/${ATHLETE_ID}/events?oldest=${date}&newest=${date}`, { headers: authHeader(API_KEY) });
    if (existRes.ok) {
      const existing = (await existRes.json()) as { id: number; external_id?: string }[];
      // Remplace UNIQUEMENT le défi Ghost Runner du même jour (jamais la séance coach → elles coexistent).
      await Promise.all(existing
        .filter((e) => e.external_id === event.external_id)
        .map((e) => fetch(`${BASE}/athlete/${ATHLETE_ID}/events/${e.id}`, { method: "DELETE", headers: authHeader(API_KEY) }).catch(() => undefined)));
    }
  } catch { /* best effort : on continue même si le nettoyage échoue */ }

  const res = await fetch(`${BASE}/athlete/${ATHLETE_ID}/events`, {
    method: "POST",
    headers: authHeader(API_KEY),
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return NextResponse.json({
      ok: false,
      error: `Envoi vers la montre impossible (intervals.icu HTTP ${res.status}).`,
      detail,
    }, { status: 502 });
  }

  const created = await res.json().catch(() => ({}));
  return NextResponse.json({
    ok: true,
    eventId: created?.id ?? null,
    date,
    summary,
    message: `✅ « ${name} » envoyée ! Elle se synchronise sur ta montre via Garmin (quelques minutes, en différé). Pour l'allure EN DIRECT tout de suite, utilise « Démarrer » (GPS du téléphone).`,
  });
}
