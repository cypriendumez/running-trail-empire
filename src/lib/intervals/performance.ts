// ─────────────────────────────────────────────────────────────────────────────
//  PERFORMANCE MESURÉE — ce que l'athlète a RÉELLEMENT fait
//
//  Jusqu'ici le coach raisonnait sur une VMA estimée et sur des allures déduites
//  d'un pourcentage de cette estimation. intervals.icu expose deux sources bien
//  plus solides, qui n'étaient pas exploitées :
//    · la courbe d'allure sur 42 jours, avec un modèle de vitesse critique ajusté
//      sur les données réelles (r² observé : 0,9999) ;
//    · les intervalles réellement courus, répétition par répétition.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

const BASE = "https://intervals.icu/api/v1";
const auth = (apiKey: string) => ({ Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64") });

/** Distances de référence sur lesquelles on suit la progression. */
const TARGETS = [400, 1000, 3000, 5000, 10000];

/** % de VMA soutenable selon la distance — même barème que le reste de l'application. */
function pctVmaFor(km: number): number {
  if (km <= 0.4) return 1.18;
  if (km <= 0.8) return 1.12;
  if (km <= 1.5) return 1.06;
  if (km <= 3.2) return 1.0;
  if (km <= 5.5) return 0.94;
  if (km <= 11) return 0.90;
  return 0.85;
}

/** VMA implicite des meilleurs efforts : on retient la plus favorable, car un effort
 *  non maximal ne peut que sous-estimer la capacité réelle. */
function vmaFromBest(best: { m: number; sec: number }[]): number | null {
  let top: number | null = null;
  for (const b of best) {
    if (!(b.m > 0) || !(b.sec > 0)) continue;
    const v = (b.m / 1000) / (b.sec / 3600) / pctVmaFor(b.m / 1000);
    if (v > 5 && v < 30 && (top == null || v > top)) top = Math.round(v * 10) / 10;
  }
  return top;
}

/** Un relevé daté de la capacité de l'athlète. Sert à mesurer une TENDANCE : sans
 *  historique, la courbe d'allure ne dit que « où il en est », jamais « où il va ». */
export type CurvePoint = { at: string; cs: number | null; vma: number | null };

export type PaceCurve = {
  /** Meilleur temps (s) par distance de référence, sur les 42 derniers jours. */
  best: { m: number; sec: number }[];
  /** Vitesse critique en m/s — seuil MESURÉ, pas un pourcentage de VMA estimée. */
  criticalSpeed: number | null;
  /** Réserve anaérobie (m) : capacité à courir au-dessus du seuil. */
  dPrime: number | null;
  at: string;
  /** Relevés antérieurs, du plus ancien au plus récent (16 max, ~1 par 4 jours). */
  history?: CurvePoint[];
};

export async function fetchPaceCurve(athleteId: string, apiKey: string): Promise<PaceCurve | null> {
  try {
    const r = await fetch(`${BASE}/athlete/${athleteId}/pace-curves?type=Run&curves=42d`, {
      headers: auth(apiKey), signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const j = await r.json() as { list?: { distance?: number[]; values?: number[]; paceModels?: { criticalSpeed?: number; dPrime?: number }[] }[] };
    const c = j.list?.[0];
    if (!c?.distance?.length || !c.values?.length) return null;

    const best: { m: number; sec: number }[] = [];
    for (const target of TARGETS) {
      let bi = -1, bd = Infinity;
      c.distance.forEach((d, i) => { const gap = Math.abs(d - target); if (gap < bd) { bd = gap; bi = i; } });
      // On n'accepte le point que s'il correspond vraiment à la distance visée (±6 %),
      // sinon on inventerait un record de 10 km à partir d'un effort de 7 km.
      if (bi >= 0 && bd / target <= 0.06) best.push({ m: target, sec: Math.round(c.values[bi]) });
    }
    const pm = c.paceModels?.[0];
    return {
      best,
      criticalSpeed: typeof pm?.criticalSpeed === "number" ? Math.round(pm.criticalSpeed * 1000) / 1000 : null,
      dPrime: typeof pm?.dPrime === "number" ? Math.round(pm.dPrime) : null,
      at: new Date().toISOString(),
    };
  } catch { return null; }
}

export type QualityExec = {
  date: string;
  /** Allures réalisées des répétitions dures (min/km, format décimal secondes). */
  repsSec: number[];
  /** Moyenne des FC sur ces répétitions. */
  avgHr: number | null;
  /** Décrochage : écart entre la 1re et la dernière répétition, en secondes/km. */
  fadeSec: number | null;
  at: string;
};

/**
 * Analyse l'exécution de la dernière séance de qualité : on isole les répétitions
 * réellement dures et on regarde si l'allure a tenu du début à la fin.
 * Un décrochage marqué signifie que la séance était trop ambitieuse — information
 * qu'aucune moyenne globale ne révèle.
 *
 * ATTENTION au piège de la zone FC : après une série, le cœur redescend lentement.
 * Vérifié sur une séance réelle (04/08) — les quatre tours de retour au calme, courus
 * à 4:35-4:45/km, étaient classés en zone 4 par intervals.icu parce que la FC stagnait
 * à 182-185. Les compter comme des répétitions faisait apparaître 61 s/km de
 * décrochage sur une séance en réalité parfaitement tenue. On identifie donc la série
 * par l'ALLURE — un paquet d'efforts homogènes autour du plus rapide — et la FC ne
 * sert plus que de garde-fou.
 */
export async function analyseQualityExecution(
  activityId: string, apiKey: string, dateISO: string,
): Promise<QualityExec | null> {
  try {
    const r = await fetch(`${BASE}/activity/${activityId}/intervals`, {
      headers: auth(apiKey), signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const j = await r.json() as { icu_intervals?: { zone?: number; average_speed?: number; gap?: number; average_heartrate?: number; moving_time?: number }[] };

    // Allure ajustée au dénivelé quand elle existe : sinon une répétition en montée
    // passerait pour un décrochage alors que l'effort était identique.
    const paceOf = (x: { average_speed?: number; gap?: number }) => {
      const v = x.gap && x.gap > 0.3 ? x.gap : x.average_speed;
      return v && v > 0.3 ? Math.round(1000 / v) : null;
    };

    type Cand = { pace: number; dur: number; hr: number | null; zone: number };
    const cands: Cand[] = [];
    for (const x of j.icu_intervals ?? []) {
      const pace = paceOf(x);
      const dur = x.moving_time ?? 0;
      // Trop court = un tour parasite ; zone 1-2 = échauffement ou récupération.
      if (pace == null || dur < 45 || (x.zone ?? 0) < 3) continue;
      cands.push({ pace, dur, hr: typeof x.average_heartrate === "number" ? x.average_heartrate : null, zone: x.zone ?? 0 });
    }
    if (cands.length < 3) return null;

    // La série = les efforts à moins de 20 % du plus rapide. La marge laisse passer un
    // vrai décrochage (c'est précisément ce qu'on cherche à mesurer) sans absorber un
    // footing de récupération, toujours bien plus lent que ça.
    const fastest = Math.min(...cands.map((c) => c.pace));
    const inBand = cands.filter((c) => c.pace <= fastest * 1.2);
    if (inBand.length < 3) return null;

    // Une série est aussi homogène en durée : on écarte le tour deux fois plus long
    // que les autres, qui serait un bloc continu et non une répétition.
    const durs = [...inBand.map((c) => c.dur)].sort((a, b) => a - b);
    const medDur = durs[Math.floor(durs.length / 2)];
    const reps = inBand.filter((c) => c.dur >= medDur * 0.5 && c.dur <= medDur * 2);
    // Sans au moins un effort franchement dur, c'est une sortie régulière, pas une séance.
    if (reps.length < 3 || !reps.some((c) => c.zone >= 4)) return null;

    const repsSec = reps.map((c) => c.pace);
    const hrs = reps.map((c) => c.hr).filter((h): h is number => h != null);
    // Décrochage : moyenne du dernier tiers moins moyenne du premier tiers.
    const n = Math.max(1, Math.floor(repsSec.length / 3));
    const first = repsSec.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const last = repsSec.slice(-n).reduce((a, b) => a + b, 0) / n;
    return {
      date: dateISO,
      repsSec,
      avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      fadeSec: Math.round(last - first),
      at: new Date().toISOString(),
    };
  } catch { return null; }
}

/**
 * Rafraîchit les deux analyses sur le profil, au plus une fois par jour :
 * ce sont deux appels réseau supplémentaires, inutiles à répéter à chaque synchro.
 */
export async function refreshPerformance(
  admin: SupabaseClient,
  opts: { userId: string; athleteId: string; apiKey: string; lastQualityId?: string | null; lastQualityDate?: string | null; storedAt?: string | null; previous?: PaceCurve | null },
): Promise<void> {
  if (opts.storedAt && Date.now() - new Date(opts.storedAt).getTime() < 20 * 3600_000) return;
  const [curve, exec] = await Promise.all([
    fetchPaceCurve(opts.athleteId, opts.apiKey),
    opts.lastQualityId && opts.lastQualityDate
      ? analyseQualityExecution(opts.lastQualityId, opts.apiKey, opts.lastQualityDate)
      : Promise.resolve(null),
  ]);
  const patch: Record<string, unknown> = {};
  if (curve) {
    // ── HISTORIQUE ────────────────────────────────────────────────────────────
    // La courbe d'allure était écrasée à chaque rafraîchissement : on savait où en
    // était l'athlète, jamais dans quel sens il allait. Or c'est la TENDANCE qui
    // permet de détecter un plateau (stagnation malgré une charge qui monte) et de
    // projeter sa capacité au jour de la course. On conserve donc des relevés datés.
    //
    // Rangés DANS le JSON existant plutôt que dans une nouvelle colonne : pas de
    // migration, et l'historique reste indissociable de la mesure dont il dérive.
    const prev = opts.previous ?? null;
    const past = Array.isArray(prev?.history) ? prev!.history! : [];
    const lastAt = past.length ? new Date(past[past.length - 1].at).getTime() : 0;
    // Un relevé tous les 4 jours au minimum : plus dense, on mesurerait du bruit.
    const shouldAppend = Date.now() - lastAt >= 4 * 86400_000;
    const point: CurvePoint = {
      at: curve.at,
      cs: curve.criticalSpeed,
      vma: vmaFromBest(curve.best),
    };
    curve.history = (shouldAppend ? [...past, point] : past).slice(-16);
    patch.pace_curve = curve;
  }
  if (exec) patch.last_quality_exec = exec;
  if (!Object.keys(patch).length) return;
  await admin.from("profiles").update(patch).eq("id", opts.userId).then(() => {}, () => {});
}
