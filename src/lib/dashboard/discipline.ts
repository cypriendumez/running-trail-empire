/**
 * SCORE DISCIPLINE, ÉTAT DU JOUR ET STATISTIQUES DE VFC — calculs purs (04/10/2026).
 *
 * Sortis de `BentoDashboard` (composant client) pour que les pages détaillées des
 * indicateurs (/dashboard/indicateurs/…) affichent EXACTEMENT les mêmes chiffres que les
 * cartes : un seul calcul, deux écrans. Une page serveur ne peut pas appeler une fonction
 * d'un module « use client » — d'où ce module neutre.
 */
import type { HRVData, Workout } from "@/types";

export const DISCIPLINE_CONFIG = {
  weights: { precision: 0.4, consistency: 0.4, recovery: 0.2 }, // somme = 1
  windowDays: 14,            // fenêtre d'analyse (lisse le bruit d'une semaine isolée)
  weeklyTarget: 4,           // séances/semaine visées (Assiduité)
  easyShareTarget: 0.8,      // 80 % facile / 20 % qualité (modèle polarisé)
  penaltyTooHard: 220,       // trop d'intensité = pénalité forte (risque surcharge/blessure)
  penaltyTooEasy: 120,       // trop facile = pénalité plus douce (annulée en semaine de récup)
  minForPrecision: 3,        // sous ce nombre de séances, la Précision est peu fiable
  stateBaseline: { optimal: 85, competition: 80, recovery: 55 } as Record<string, number>,
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** L'état du jour : VFC du matin face à sa base 14 j, et sommeil RÉCENT. */
export type EtatDuJour = "aucun" | "top" | "repos" | "correct";

export function etatDuJour(hrvDelta: number | null, hrvBaseline: number | null, sleepScore: number | null): EtatDuJour {
  const sig: number[] = [];
  if (hrvDelta != null && hrvBaseline) sig.push(hrvDelta >= 0 ? 1 : hrvDelta / hrvBaseline >= -0.06 ? 0 : -1);
  if (sleepScore != null) sig.push(sleepScore >= 75 ? 1 : sleepScore >= 55 ? 0 : -1);
  if (!sig.length) return "aucun";
  const avg = sig.reduce((a, b) => a + b, 0) / sig.length;
  return avg >= 0.5 ? "top" : avg <= -0.5 ? "repos" : "correct";
}

/** Les chiffres de la carte VFC : mesure la plus récente, base 14 j, écart, fraîcheur. */
export function statsVfc(hrv: readonly Pick<HRVData, "date" | "hrv_ms">[], maintenant = Date.now()) {
  const dernier = hrv[0]?.hrv_ms ?? null;
  const jours = hrv[0]?.date
    ? Math.floor((maintenant - new Date(String(hrv[0].date).slice(0, 10) + "T00:00:00").getTime()) / 86400000)
    : null;
  const serie = hrv.slice(0, 14).map((h) => h.hrv_ms).filter((v): v is number => v != null);
  const base = serie.length ? Math.round(serie.reduce((a, b) => a + b, 0) / serie.length) : null;
  return { dernier, jours, fraiche: jours != null && jours <= 2, base, ecart: dernier != null && base != null ? dernier - base : null, n: serie.length };
}

export function computeDiscipline(
  workouts: Workout[], hrv: HRVData[],
  sleep: { sleep_score: number } | null, state: string,
): {
  total: number; precision: number; consistency: number; recovery: number; hasData: boolean;
  /** Les valeurs intermédiaires, montrées par la page détaillée (/dashboard/indicateurs/discipline). */
  details: { seances: number; faciles: number; qualites: number; cibleSeances: number; sommeil: number | null; signalVfc: number | null };
} {
  const C = DISCIPLINE_CONFIG;
  const now = Date.now();
  const recent = workouts.filter(w => now - new Date(w.date).getTime() <= C.windowDays * 86400000);
  const hasData = workouts.length > 0 || hrv.length > 0;

  // Assiduité — régularité sur la fenêtre vs cible (séances/sem × nb de semaines).
  const consistency = clamp(Math.round((recent.length / (C.weeklyTarget * (C.windowDays / 7))) * 100));

  // Précision — proximité d'une répartition polarisée ~80 % facile / 20 % qualité.
  //  Pénalité asymétrique : le « trop dur » coûte plus cher que le « trop facile ».
  let precision: number;
  if (recent.length >= C.minForPrecision) {
    const easyShare = recent.filter(w => !isQualityWorkout(w)).length / recent.length;
    const dev = easyShare - C.easyShareTarget;                          // <0 trop dur · >0 trop facile
    const tooEasy = state === "recovery" ? 0 : C.penaltyTooEasy;        // semaine de récup → le facile est normal
    precision = clamp(Math.round(100 - (dev < 0 ? -dev * C.penaltyTooHard : dev * tooEasy)));
  } else {
    precision = recent.length ? consistency : 0;                        // pas assez d'historique
  }

  // Récupération — données réelles : sommeil + tendance VFC (RMSSD du jour vs base 14 j).
  const signals: number[] = [];
  if (sleep?.sleep_score != null) signals.push(sleep.sleep_score);
  const hrvVals = hrv.slice(0, 14).map(h => h.hrv_ms).filter((v): v is number => v != null);
  let signalVfc: number | null = null;
  if (hrvVals.length >= 3) {
    const base = hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length;
    signalVfc = clamp(70 + ((hrvVals[0] - base) / base) * 300);        // à la base ≈ 70, +10 % ≈ 100
    signals.push(signalVfc);
  }
  const recovery = signals.length
    ? Math.round(signals.reduce((a, b) => a + b, 0) / signals.length)
    : (C.stateBaseline[state] ?? 70);

  const total = Math.round(
    C.weights.precision * precision + C.weights.consistency * consistency + C.weights.recovery * recovery,
  );
  const qualites = recent.filter(isQualityWorkout).length;
  return {
    total, precision, consistency, recovery, hasData,
    details: {
      seances: recent.length, faciles: recent.length - qualites, qualites,
      cibleSeances: C.weeklyTarget * (C.windowDays / 7),
      sommeil: sleep?.sleep_score ?? null, signalVfc: signalVfc != null ? Math.round(signalVfc) : null,
    },
  };
}

// ── Qualité (intensité) d'une séance — partagé par le Score Discipline ET la
//    répartition d'intensité (une seule source de vérité). ─────────────────────────
/** Au moins 10 minutes mesurées en zones pour juger une séance sur ses zones. */
export const ZONES_MIN_SECONDES = 600;
/** Une séance est de QUALITÉ si ≥ 12 % de son temps est en Z4–Z5, ou ≥ 30 % en Z3 et au-dessus. */
export const PART_Z4_QUALITE = 0.12;
export const PART_Z3_QUALITE = 0.30;

/**
 * ⚠️ LES ZONES MESURÉES PRIMENT SUR LE TYPE DÉCLARÉ (04/10/2026). La montre (via intervals.icu)
 * type « easy » presque toutes les sorties : relevé sur le compte de Cyprien, ses 10 séances
 * des 14 derniers jours étaient toutes « faciles », y compris 23,7 km à 3'45/km et 181 bpm
 * de moyenne. Le score discipline lui reprochait donc de manquer d'intensité. Quand la
 * montre a mesuré le temps passé dans chaque zone, c'est cette mesure qui décide.
 */
export function isQualityWorkout(w: Workout): boolean {
  const z = Array.isArray(w.hr_zone_seconds) ? w.hr_zone_seconds.map((v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }) : null;
  const total = z ? z.reduce((a, b) => a + b, 0) : 0;
  if (z && total >= ZONES_MIN_SECONDES) {
    const z3 = z.slice(2).reduce((a, b) => a + b, 0), z4 = z.slice(3).reduce((a, b) => a + b, 0);
    return z4 / total >= PART_Z4_QUALITE || z3 / total >= PART_Z3_QUALITE;
  }
  const type = String(w.type ?? "").toLowerCase();
  if (/easy|recovery|long|trail|endurance|footing|récup|fond|marche/.test(type)) return false;
  if (/interval|vma|tempo|seuil|race|hill|fractionn|côte|cote|sprint|vif|fartlek|threshold/.test(type)) return true;
  return (w.training_effect ?? 0) >= 4; // type ambigu : seul un effort très élevé compte comme qualité
}
