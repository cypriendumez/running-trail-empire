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

// ── FRACTIONNÉ RÉEL POUR LA MONTRE ──────────────────────────────────────────
// Sans ça, « 12×400 m récup 45 s » partait sur la montre comme un unique bloc de
// 10 min à l'allure VMA : l'athlète n'avait ni le décompte des répétitions, ni les
// bips de récupération — c'est-à-dire l'essentiel de ce qui rend une séance de
// fractionné suivable en courant.
//
// On lit nos PROPRES libellés (générés par le menu de qualité), dont le format est
// stable : « N×DISTANCE à ALLURE, récup DURÉE » ou « N×DURÉE à ALLURE, récup DURÉE ».
export type RepBlock = { reps: number; workSec: number; recSec: number; paceSec: number | null };

export function parseReps(text: string, fallbackPaceSec: number | null): RepBlock | null {
  const t = (text || "").replace(/\u00a0/g, " ").toLowerCase();
  // N × valeur unité   (× ou x, avec ou sans espaces)
  const m = t.match(/(\d{1,2})\s*[×x]\s*(\d{1,4}(?:[.,]\d+)?)\s*(m\b|km\b|min\b|mn\b|s\b|")/);
  if (!m) return null;
  const reps = Number(m[1]);
  const val = Number(String(m[2]).replace(",", "."));
  const unit = m[3].trim();
  if (!(reps >= 2 && reps <= 30) || !(val > 0)) return null;

  const paceSec = parsePaceSec(text) ?? fallbackPaceSec;

  // Durée d'un effort. Une distance n'est convertie que si l'on connaît l'allure :
  // envoyer une distance en pas de temps sans allure donnerait n'importe quoi.
  let workSec: number;
  if (unit === "min" || unit === "mn") workSec = val * 60;
  else if (unit === "s" || unit === '"') workSec = val;
  else if (unit === "km") { if (!paceSec) return null; workSec = val * paceSec; }
  else { if (!paceSec) return null; workSec = (val / 1000) * paceSec; }  // mètres
  workSec = Math.round(workSec);
  if (workSec < 15 || workSec > 30 * 60) return null;

  // Récupération : « récup 45 s », « récup 1 min 30 », « récup 2 min ». Une récup
  // décrite sans durée (« récup descente trottinée ») retombe sur une valeur sûre.
  let recSec = Math.min(180, Math.max(45, Math.round(workSec * 0.6)));
  const r = t.match(/r[ée]cup[^.]{0,24}?(\d{1,3})\s*(min|mn|s\b)(?:\s*(\d{1,2}))?/);
  if (r) {
    const n = Number(r[1]);
    recSec = /min|mn/.test(r[2]) ? n * 60 + (r[3] ? Number(r[3]) : 0) : n;
    recSec = Math.min(600, Math.max(15, recSec));
  }
  return { reps, workSec, recSec, paceSec };
}

/**
 * Étapes répétées, ÉCRITES UNE PAR UNE.
 *
 * intervals.icu n'interprète AUCUNE syntaxe de répétition : testé le 7 août 2026
 * contre leur parseur avec `12x` seul, indenté, précédé d'un tiret, et en blocs
 * nommés — les quatre formes donnent 4 étapes au lieu de 26, la ligne de répétition
 * étant purement ignorée. Résultat : l'athlète recevait UNE seule répétition de 70 s.
 * Les répétitions explicites produisent bien 26 étapes et 48 min, vérifié.
 *
 * Elles sont numérotées (« Effort 3/12 ») : sur la montre, savoir où l'on en est
 * pendant un fractionné vaut largement les quelques lignes supplémentaires.
 */
function repSteps(b: RepBlock, vmaKmh: number | null, zone: number, hill?: boolean): string {
  const fmt = (sec: number) => (sec % 60 === 0 ? `${sec / 60}m` : `${sec}s`);
  // En côte, une allure au km n'a aucun sens : on pilote à la fréquence cardiaque.
  const range = hill ? `Z${zone} HR` : b.paceSec
    ? `${fmtPace(Math.max(120, b.paceSec - 8))}-${fmtPace(b.paceSec + 8)} pace`
    : (vmaKmh ? `${zonePaceRange(vmaKmh, zone)} pace` : `Z${zone} HR`);
  const out: string[] = [];
  for (let i = 1; i <= b.reps; i++) {
    out.push(`- ${fmt(b.workSec)} ${range} Effort ${i}/${b.reps}`);
    // Pas de récupération après la dernière : le retour au calme enchaîne.
    if (i < b.reps) out.push(`- ${fmt(b.recSec)} Z1 HR Récup`);
  }
  return out.join("\n");
}

// Étapes intervals.icu selon le type de séance. Allure prescrite (mainPaceSec) > allure de zone (VMA)
// > repli cible FC. mainPaceSec s'applique à l'étape PRINCIPALE. null = pas de séance montre.
/**
 * Bornes de l'échauffement et du retour au calme, réglage du profil.
 * Exporté pour que le PLAN écrive dans son texte exactement les durées que la MONTRE
 * appliquera : sans cela le site annonçait « échauffement 10 min » et la montre en
 * envoyait 15 — deux séances différentes pour le même jour.
 */
export function warmCoolMin(warmMin?: number | null, coolMin?: number | null): { warm: number; cool: number } {
  return {
    warm: Math.min(30, Math.max(5, Math.round(warmMin ?? 15))),
    cool: Math.min(30, Math.max(5, Math.round(coolMin ?? 10))),
  };
}

export function stepsForType(type: string, durationMin: number, vmaKmh?: number | null, mainPaceSec?: number | null, warmMin?: number | null, coolMin?: number | null, reps?: RepBlock | null, rawDetail?: string): string | null {
  const s = (type || "").toLowerCase();
  const d = Math.max(15, Math.round(durationMin));
  const v = vmaKmh ?? null;
  const p = mainPaceSec ?? null;
  // Durées d'échauffement / retour au calme = réglage du profil de l'athlète (5–30 min), repli 15 / 10.
  // Échauffement & retour au calme toujours pilotés à la FRÉQUENCE CARDIAQUE Z1 (doux) ; seul le corps vise l'allure.
  const { warm, cool } = warmCoolMin(warmMin, coolMin);
  /**
   * Durée du CORPS de séance, lue dans le texte du plan (« → Corps : … »).
   *
   * Sans elle, `parseDurationMin` renvoyait la PREMIÈRE durée du texte — celle de
   * l'échauffement — et on lui soustrayait encore l'échauffement et le retour au calme.
   * Résultat constaté : le site annonçait 25 min de récupération et la montre en
   * envoyait 10 ; une sortie longue de 1 h 02 arrivait à 37 min. Le corps est désormais
   * lu tel qu'il est écrit, ce qui garantit que les deux affichages coïncident.
   */
  const bodyMin = (() => {
    const seg = (rawDetail || "").toLowerCase().split(/corps[^:]*:/)[1];
    if (!seg) return null;
    const head = seg.split(/→|\n/)[0];
    const h = head.match(/(\d+)\s*h\s*(\d{1,2})?/);
    const n = h ? Number(h[1]) * 60 + (h[2] ? Number(h[2]) : 0)
      : Number(head.match(/(\d{1,3})\s*min/)?.[1] ?? 0);
    return n >= 5 && n <= 300 ? n : null;
  })();

  if (/repos|rest/.test(s)) return null;
  if (/renfo|muscu|gainage|force|ppg/.test(s)) return null; // pas une course
  if (/vélo|velo|bike|cycl|home ?trainer|\bride\b/.test(s)) {
    // Vélo (cross-training) : tout piloté à la FRÉQUENCE CARDIAQUE (pas d'allure course à vélo).
    const main = Math.max(15, d - warm - cool);
    return [zoneStep(warm, 1, v, "Échauffement", null, true), zoneStep(main, 2, v, "Vélo endurance", null, true), zoneStep(cool, 1, v, "Retour au calme", null, true)].join("\n");
  }
  if (/récup|recup/.test(s)) {
    const main = bodyMin ?? Math.max(10, d - warm - cool);
    // Récupération : pilotée à la FRÉQUENCE CARDIAQUE, comme l'annonce son propre texte
    // (« Z1 très facile »). Y mettre une cible d'allure transformait une séance de
    // récupération en séance à chrono — exactement ce qu'elle ne doit pas être.
    return [zoneStep(warm, 1, v, "Échauffement", null, true), zoneStep(main, 1, v, "Récup", null, true), zoneStep(cool, 1, v, "Retour au calme", null, true)].join("\n");
  }
  if (/long|endurance|footing|fond|easy/.test(s)) {
    const main = bodyMin ?? Math.max(15, d - warm - cool);
    return [zoneStep(warm, 1, v, "Échauffement", null, true), zoneStep(main, 2, v, "Endurance facile", p), zoneStep(cool, 1, v, "Retour au calme", null, true)].join("\n");
  }
  // Durée explicitement annoncée pour le CORPS de séance : sans ça, « 25 min d'un bloc »
  // se retrouvait amputé de l'échauffement et arrivait à 10 min sur la montre.

  const quality = /spéci|specif|allure|objectif|seuil|tempo/.test(s) ? 4
    : /vma|fractionn|interval|piste|côte|cote|fartlek|30\/30/.test(s) ? 5 : 0;
  if (quality) {
    // Vraies répétitions quand le libellé en contient ; sinon bloc continu (seuil continu…).
    // Le mot « côte » est dans le LIBELLÉ de la séance, pas dans son type (« VMA »).
    const hill = /c[ôo]te|mont[ée]e|hill/.test(`${s} ${(rawDetail || "").toLowerCase()}`);
    const block = reps ? repSteps(reps, v, quality, hill) : null;
    const main = Math.max(10, d - warm - cool);
    return [
      zoneStep(warm, 1, v, "Échauffement", null, true),
      // Bloc continu : en CÔTE on pilote à la fréquence cardiaque, jamais à l'allure —
      // une allure au km ne veut rien dire en montée. Les répétitions le faisaient déjà,
      // le bloc continu, non : le drapeau `hill` ne lui était pas transmis.
      block ?? zoneStep(bodyMin ?? main, quality, v, quality === 5 ? "VMA" : "Seuil", hill ? null : p, hill),
      zoneStep(cool, 1, v, "Retour au calme", null, true),
    ].join("\n");
  }
  const main = Math.max(15, d - warm - cool);
  return [zoneStep(warm, 1, v, "Échauffement", null, true), zoneStep(main, 2, v, "Endurance facile", p), zoneStep(cool, 1, v, "Retour au calme", null, true)].join("\n");
}

// Crée (en remplaçant l'éventuelle séance coach déjà présente) une séance dans le
// calendrier intervals.icu du client → synchronisée sur sa montre.
export async function pushIntervalsWorkout(opts: {
  athleteId: string; apiKey: string; userId: string;
  name: string; date: string; description: string; sport?: "Run" | "Ride";
}): Promise<{ ok: boolean; eventId?: number; error?: string; unchanged?: boolean }> {
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
    let mine: { id: number; name?: string; description?: string }[] = [];
    const existRes = await fetch(`${BASE}/athlete/${athleteId}/events?oldest=${date}&newest=${date}`, { headers: authHeader(apiKey) });
    if (existRes.ok) {
      const existing = (await existRes.json()) as { id: number; external_id?: string; name?: string; description?: string }[];
      // On ne touche QUE la séance coach du jour : elle n'écrase jamais un défi Ghost
      // Runner, et vice-versa (ils coexistent sur le calendrier).
      mine = existing.filter((e) => e.external_id === extId);
      // Séance inchangée → on ne réécrit RIEN. Le plan est recalculé plusieurs fois par
      // jour et retombe presque toujours sur la même séance ; toute écriture relance une
      // synchronisation Garmin inutile. Ne pas toucher est ici la bonne action.
      const same = mine.find((e) => e.name === event.name && e.description === description);
      if (same) return { ok: true, eventId: same.id, unchanged: true };
    }

    // RECRÉATION UNIQUEMENT SI LA SÉANCE A CHANGÉ.
    //
    // Deux écueils opposés, et il a fallu les deux pour trouver l'équilibre.
    // · Supprimer-recréer à CHAQUE republication (le comportement d'origine) demandait à
    //   intervals.icu de retirer l'entraînement de Garmin puis d'en pousser un neuf,
    //   plusieurs fois par jour : la montre se retrouvait régulièrement sans séance.
    // · Mettre à jour en place (PUT) supprime cette instabilité, mais l'API ne dit NULLE
    //   PART si une modification est réellement renvoyée vers Garmin — aucun champ ne
    //   l'expose, seul `push_errors` existe et reste nul. Impossible à vérifier de
    //   l'extérieur, et une séance modifiée qui n'arrive pas sur la montre est pire
    //   qu'une séance recréée.
    // On recrée donc, mais SEULEMENT quand le contenu diffère — cas devenu rare depuis
    // que les séances identiques sont court-circuitées plus haut. La création, elle, est
    // le chemin dont on sait qu'il pousse vers Garmin.
    if (mine.length) {
      await Promise.all(mine.map((e) =>
        fetch(`${BASE}/athlete/${athleteId}/events/${e.id}`, { method: "DELETE", headers: authHeader(apiKey) }).catch(() => undefined)));
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
  // Répétitions détectées dans le libellé de la séance (« 12×400 m … récup 45 s »).
  const reps = parseReps(detail, mainPaceSec);
  const steps = stepsForType(type, dur, vmaKmh, mainPaceSec, warmMin, coolMin, reps, detail);
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
