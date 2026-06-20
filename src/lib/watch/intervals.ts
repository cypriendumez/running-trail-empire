// ─────────────────────────────────────────────────────────────────────────────
//  Pousser une séance structurée vers la montre d'un client (via intervals.icu).
//  On cible des ZONES de fréquence cardiaque : elles s'exportent nativement vers
//  Garmin (pas besoin d'allure seuil) → le client reçoit la séance sans rien faire.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "https://intervals.icu/api/v1";

function authHeader(apiKey: string) {
  return {
    Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64"),
    "Content-Type": "application/json",
  };
}

// Durée par défaut (minutes) selon le type de séance, si non précisée.
export function durationForType(type: string): number {
  const s = (type || "").toLowerCase();
  if (/long/.test(s)) return 90;
  if (/récup|recup/.test(s)) return 30;
  if (/spéci|specif|allure|objectif/.test(s)) return 55;
  if (/seuil|tempo/.test(s)) return 55;
  if (/vma|fractionn|interval|piste|côte|cote|fartlek/.test(s)) return 50;
  return 50; // endurance par défaut
}

// %VMA cible par zone (cohérent avec coachContext : Z1 60 %, Z2 70 %, seuil 86 %, VMA 100 %).
const ZONE_VMA_PCT: Record<number, number> = { 1: 0.60, 2: 0.70, 3: 0.80, 4: 0.86, 5: 1.00 };
const fmtPace = (secPerKm: number) => `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, "0")}`;

// Plage d'allure « mm:ss-mm:ss » pour une zone, calculée depuis la VMA (bande ± selon l'intensité).
function zonePaceRange(vmaKmh: number, zone: number): string | null {
  const pct = ZONE_VMA_PCT[zone];
  if (!pct || !(vmaKmh > 0)) return null;
  const centerSec = 3600 / (vmaKmh * pct);             // s/km
  const band = zone <= 2 ? 8 : zone === 5 ? 6 : 5;     // footing facile = plus de tolérance
  return `${fmtPace(Math.max(120, centerSec - band))}-${fmtPace(centerSec + band)}`;
}

// Une étape : ALLURE cible avec libellé d'intensité. Priorité à l'allure EXPLICITE prescrite par le
// coach (paceSec → colle exactement à ce qu'affiche le calendrier client), sinon l'allure de la zone
// calculée depuis la VMA, sinon repli cible FC. Garmin n'alerte que sur UNE cible/étape → l'allure.
function zoneStep(durMin: number, zone: number, vmaKmh: number | null, label: string, paceSec?: number | null, hrOnly?: boolean): string {
  const d = Math.max(1, Math.round(durMin));
  // Échauffement / retour au calme : pilotés à la FRÉQUENCE CARDIAQUE (jamais à l'allure)
  // → on monte/descend en température par la FC, pas en visant un chrono.
  if (hrOnly) return `- ${d}m Z${zone} HR ${label}`;
  let range: string | null = null;
  if (paceSec && paceSec > 0) range = `${fmtPace(Math.max(120, paceSec - 8))}-${fmtPace(paceSec + 8)}`;
  else if (vmaKmh) range = zonePaceRange(vmaKmh, zone);
  return range ? `- ${d}m ${range} pace ${label}` : `- ${d}m Z${zone} HR ${label}`;
}

// Extrait l'allure prescrite d'un texte de séance : « 4'20/km », « 4:20/km », « à 4'20 ».
export function parsePaceSec(text: string): number | null {
  const t = (text || "").toLowerCase();
  const m = t.match(/(\d)\s*['’h:]\s*(\d{2})\s*\/?\s*km/) || t.match(/[àa]\s*(\d)\s*['’h:]\s*(\d{2})/);
  if (!m) return null;
  const sec = (+m[1]) * 60 + (+m[2]);
  return sec >= 150 && sec <= 600 ? sec : null; // garde-fou : 2'30–10'00/km
}

// Étapes intervals.icu selon le type de séance. Allure prescrite (mainPaceSec) > allure de zone (VMA)
// > repli cible FC. mainPaceSec s'applique à l'étape PRINCIPALE. null = pas de séance montre.
export function stepsForType(type: string, durationMin: number, vmaKmh?: number | null, mainPaceSec?: number | null, warmMin?: number | null, coolMin?: number | null): string | null {
  const s = (type || "").toLowerCase();
  const d = Math.max(15, Math.round(durationMin));
  const v = vmaKmh ?? null;
  const p = mainPaceSec ?? null;
  // Durées d'échauffement / retour au calme = réglage du profil de l'athlète (5–30 min), repli 15 / 10.
  // Échauffement & retour au calme toujours pilotés à la FRÉQUENCE CARDIAQUE Z1 (doux) ; seul le corps vise l'allure.
  const warm = Math.min(30, Math.max(5, Math.round(warmMin ?? 15)));
  const cool = Math.min(30, Math.max(5, Math.round(coolMin ?? 10)));
  if (/repos|rest/.test(s)) return null;
  if (/renfo|muscu|gainage|force|ppg/.test(s)) return null; // pas une course
  if (/vélo|velo|bike|cycl|home ?trainer|\bride\b/.test(s)) {
    // Vélo (cross-training) : tout piloté à la FRÉQUENCE CARDIAQUE (pas d'allure course à vélo).
    const main = Math.max(15, d - warm - cool);
    return [zoneStep(warm, 1, v, "Échauffement", null, true), zoneStep(main, 2, v, "Vélo endurance", null, true), zoneStep(cool, 1, v, "Retour au calme", null, true)].join("\n");
  }
  if (/récup|recup/.test(s)) {
    const main = Math.max(10, d - warm - cool);
    return [zoneStep(warm, 1, v, "Échauffement", null, true), zoneStep(main, 1, v, "Récup", p), zoneStep(cool, 1, v, "Retour au calme", null, true)].join("\n");
  }
  if (/long|endurance|footing|fond|easy/.test(s)) {
    const main = Math.max(15, d - warm - cool);
    return [zoneStep(warm, 1, v, "Échauffement", null, true), zoneStep(main, 2, v, "Endurance facile", p), zoneStep(cool, 1, v, "Retour au calme", null, true)].join("\n");
  }
  if (/spéci|specif|allure|objectif|seuil|tempo/.test(s)) {
    const main = Math.max(10, d - warm - cool);
    return [zoneStep(warm, 1, v, "Échauffement", null, true), zoneStep(main, 4, v, "Seuil", p), zoneStep(cool, 1, v, "Retour au calme", null, true)].join("\n");
  }
  if (/vma|fractionn|interval|piste|côte|cote|fartlek|30\/30/.test(s)) {
    const main = Math.max(10, d - warm - cool);
    return [zoneStep(warm, 1, v, "Échauffement", null, true), zoneStep(main, 5, v, "VMA", p), zoneStep(cool, 1, v, "Retour au calme", null, true)].join("\n");
  }
  const main = Math.max(15, d - warm - cool);
  return [zoneStep(warm, 1, v, "Échauffement", null, true), zoneStep(main, 2, v, "Endurance facile", p), zoneStep(cool, 1, v, "Retour au calme", null, true)].join("\n");
}

// Crée (en remplaçant l'éventuelle séance coach déjà présente) une séance dans le
// calendrier intervals.icu du client → synchronisée sur sa montre.
export async function pushIntervalsWorkout(opts: {
  athleteId: string; apiKey: string; userId: string;
  name: string; date: string; description: string; sport?: "Run" | "Ride";
}): Promise<{ ok: boolean; eventId?: number; error?: string }> {
  const { athleteId, apiKey, userId, name, date, description, sport } = opts;
  const extId = `rte-coach-${userId}-${date}`;
  const event = {
    category: "WORKOUT",
    start_date_local: `${date}T00:00:00`,
    type: sport ?? "Run",
    name: name.slice(0, 90),
    description,
    external_id: extId,
  };
  try {
    const existRes = await fetch(`${BASE}/athlete/${athleteId}/events?oldest=${date}&newest=${date}`, { headers: authHeader(apiKey) });
    if (existRes.ok) {
      const existing = (await existRes.json()) as { id: number; external_id?: string }[];
      // Remplace UNIQUEMENT la séance du même type (coach) déjà présente ce jour-là.
      // → la séance coach n'écrase jamais un défi Ghost Runner, et vice-versa (ils coexistent).
      await Promise.all(existing
        .filter((e) => e.external_id === extId)
        .map((e) => fetch(`${BASE}/athlete/${athleteId}/events/${e.id}`, { method: "DELETE", headers: authHeader(apiKey) }).catch(() => undefined)));
    }
    const res = await fetch(`${BASE}/athlete/${athleteId}/events`, { method: "POST", headers: authHeader(apiKey), body: JSON.stringify(event) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const created = await res.json().catch(() => ({}));
    return { ok: true, eventId: (created as { id?: number })?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Extrait une durée (minutes) d'un texte de séance : « 40 min », « 1h00 », « 1h30 », « 45' ».
export function parseDurationMin(text: string): number | null {
  const t = (text || "").toLowerCase();
  const h = t.match(/(\d+)\s*h(?:\s*(\d{1,2}))?/);   // 1h, 1h00, 1h30
  if (h) return parseInt(h[1], 10) * 60 + (h[2] ? parseInt(h[2], 10) : 0);
  const m = t.match(/(\d+)\s*(?:min|')/);            // 40 min, 45min, 45'
  if (m) return parseInt(m[1], 10);
  return null;
}

// Construit la description d'une séance (note + étapes) selon son type ET sa vraie durée.
// objectiveRace : si le client a un objectif (ex. « Marathon de Paris 2027 »), la séance
// s'affiche sur la montre « Prépa Marathon de Paris 2027 — <séance> ».
export function buildWorkoutDescription(
  title: string, detail: string, type: string, objectiveRace?: string | null, vmaKmh?: number | null,
  warmMin?: number | null, coolMin?: number | null,
): { name: string; description: string; sport: "Run" | "Ride" } | null {
  const dur = parseDurationMin(`${title} ${detail} ${type}`) ?? durationForType(type);
  const mainPaceSec = parsePaceSec(`${title} ${detail}`);
  const steps = stepsForType(type, dur, vmaKmh, mainPaceSec, warmMin, coolMin);
  if (!steps) return null;
  // Séance vélo (cross-training) → exporte un workout "Ride" sur la montre (sinon "Run").
  const isBike = /vélo|velo|bike|cycl|home ?trainer|\bride\b/i.test(`${title} ${type}`);
  const sport: "Run" | "Ride" = isBike ? "Ride" : "Run";
  const note = [title, detail].map((x) => (x || "").trim()).filter(Boolean).join(" · ").slice(0, 180);
  const baseName = objectiveRace ? `Prépa ${objectiveRace} — ${title || type}` : (title || type);
  return { name: `${isBike ? "🚴" : "🏃"} ${baseName}`.slice(0, 90), description: `${note}\n\n${steps}`, sport };
}

// intervals.icu n'envoie l'allure cible à Garmin QUE si une « allure seuil de course » est définie.
// On la renseigne depuis la VMA (≈ 88 % VMA) si elle est absente — sinon les séances « allure »
// arrivent sur la montre SANS allure. Best-effort, idempotent (n'écrase jamais une valeur existante).
export async function ensureRunThresholdPace(opts: { athleteId: string; apiKey: string; vmaKmh?: number | null }): Promise<void> {
  const { athleteId, apiKey, vmaKmh } = opts;
  if (!(vmaKmh && vmaKmh > 0)) return;
  try {
    const ssRes = await fetch(`${BASE}/athlete/${athleteId}/sport-settings`, { headers: authHeader(apiKey) });
    if (!ssRes.ok) return;
    const settings = (await ssRes.json()) as { id: number; types?: string[]; threshold_pace?: number | null }[];
    const run = settings.find((s) => (s.types ?? []).some((t) => /Run/i.test(String(t))));
    if (!run || (run.threshold_pace != null && run.threshold_pace > 0)) return; // déjà défini → on n'écrase pas
    const thrMps = (vmaKmh * 0.88) / 3.6; // allure seuil ≈ 88 % VMA, en m/s
    await fetch(`${BASE}/athlete/${athleteId}/sport-settings/${run.id}`, {
      method: "PUT", headers: authHeader(apiKey),
      body: JSON.stringify({ threshold_pace: Math.round(thrMps * 1000) / 1000 }),
    }).catch(() => undefined);
  } catch { /* best effort : la séance part même si le réglage échoue */ }
}
