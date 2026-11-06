/**
 * SCORE DISCIPLINE, ÉTAT DU JOUR ET STATISTIQUES DE VFC — calculs purs (04/10/2026).
 *
 * Sortis de `BentoDashboard` (composant client) pour que les pages détaillées des
 * indicateurs (/dashboard/indicateurs/…) affichent EXACTEMENT les mêmes chiffres que les
 * cartes : un seul calcul, deux écrans. Une page serveur ne peut pas appeler une fonction
 * d'un module « use client » — d'où ce module neutre.
 */
import type { HRVData, Workout } from "@/types";
import { ZONE_NORMALE_VFC } from "@/lib/health/vfc";
import { ageJours, dansFenetre } from "./fenetre";
import { jourLocal } from "@/lib/streak/compute";

export const DISCIPLINE_CONFIG = {
  weights: { precision: 0.4, consistency: 0.4, recovery: 0.2 }, // somme = 1
  windowDays: 14,            // fenêtre d'analyse (lisse le bruit d'une semaine isolée)
  easyShareTarget: 0.8,      // 80 % facile / 20 % qualité (modèle polarisé)
  penaltyTooHard: 220,       // trop d'intensité = pénalité forte (risque surcharge/blessure)
  penaltyTooEasy: 120,       // trop facile = pénalité plus douce (annulée en semaine de récup)
  minForPrecision: 3,        // sous ce nombre de séances, la Précision est peu fiable
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** L'état du jour : VFC du matin face à sa base 14 j, et sommeil RÉCENT. */
export type EtatDuJour = "aucun" | "top" | "repos" | "correct";

export function etatDuJour(hrvDelta: number | null, hrvBaseline: number | null, sleepScore: number | null): EtatDuJour {
  const sig: number[] = [];
  // `Number.isFinite` : un score de sommeil NaN se lisait « < 55 », donc comme de la fatigue.
  if (hrvDelta != null && Number.isFinite(hrvDelta) && hrvBaseline) sig.push(hrvDelta >= 0 ? 1 : hrvDelta / hrvBaseline >= -ZONE_NORMALE_VFC ? 0 : -1);
  if (sleepScore != null && Number.isFinite(sleepScore)) sig.push(sleepScore >= 75 ? 1 : sleepScore >= 55 ? 0 : -1);
  if (!sig.length) return "aucun";
  const avg = sig.reduce((a, b) => a + b, 0) / sig.length;
  return avg >= 0.5 ? "top" : avg <= -0.5 ? "repos" : "correct";
}

/** Ce que le coach a décidé pour la semaine (`auto_coach_state`), tel que le tableau de bord le lit. */
export type PlanDuCoach = {
  qBudget: number | null;
  /** Récupération d'après-course en cours (`lib/coach/apresCourse`), sinon `null`. */
  recuperation: { course: string; reprise: string } | null;
} | null;

export type PhraseDuJour = {
  cle: "dash.ready.none" | "dash.ready.top" | "dash.ready.rest" | "dash.ready.ok" | "dash.ready.recup" | "dash.ready.topSansQualite";
  recuperation?: { course: string; reprise: string };
};

/**
 * LA PHRASE DU JOUR SUIT LA DÉCISION DU COACH.
 *
 * ⚠️ Elle ne lisait que la VFC et le sommeil. Cas réel (Cyprien, 30/10/2026, J+5 du
 * marathon de Lille) : « Tu es frais — bon jour pour une séance de qualité » en tête du
 * tableau de bord, pendant que le calendrier disait « footings seulement, pas d'intensité
 * avant le 21 novembre ». Le corps peut être frais ; c'est le plan qui décide de la séance.
 * La phrase ne promet donc plus une qualité que le plan ne contient pas. Les signaux de
 * fatigue gardent leur propre message : il dit déjà « facile ».
 *
 * ⚠️ L'ABSENCE DE MESURE NE PASSE PLUS DEVANT LA RÉCUPÉRATION. Cas réel (Cyprien,
 * 05/11/2026, J+11 du marathon) : plus de VFC depuis le 30/10, et l'en-tête affichait
 * « Connecte ta montre pour une lecture de ta forme du jour » — rien sur la récupération
 * en cours, alors que c'est la seule consigne qui vaille ce jour-là, et qu'elle ne dépend
 * d'aucune mesure.
 */
export function phraseDuJour(etat: EtatDuJour, plan: PlanDuCoach): PhraseDuJour {
  if (etat === "repos") return { cle: "dash.ready.rest" };
  if (plan?.recuperation) return { cle: "dash.ready.recup", recuperation: plan.recuperation };
  if (etat === "aucun") return { cle: "dash.ready.none" };
  if (etat === "top") return { cle: plan?.qBudget === 0 ? "dash.ready.topSansQualite" : "dash.ready.top" };
  return { cle: "dash.ready.ok" };
}

/** Les chiffres de la carte VFC : mesure la plus récente, base 14 j, écart, fraîcheur. */
export function statsVfc(
  hrv: readonly Pick<HRVData, "date" | "hrv_ms">[],
  maintenant = Date.now(),
  /**
   * Jour civil de l'athlète (AAAA-MM-JJ). ⚠️ Le tableau de bord DOIT le passer : l'âge
   * calculé sur l'horloge et le fuseau de la machine différait entre le rendu serveur (UTC)
   * et le navigateur (Paris) entre minuit et 1 h — « vieille de 5 jours » au rendu,
   * « 6 jours » à l'hydratation : erreur React #418.
   */
  aujourdhui?: string,
) {
  const dernier = hrv[0]?.hrv_ms ?? null;
  const jours = !hrv[0]?.date ? null
    : aujourdhui ? ageJours(String(hrv[0].date), aujourdhui)
    : Math.floor((maintenant - new Date(String(hrv[0].date).slice(0, 10) + "T00:00:00").getTime()) / 86400000);
  const serie = hrv.slice(0, 14).map((h) => h.hrv_ms).filter((v): v is number => v != null);
  const base = serie.length ? Math.round(serie.reduce((a, b) => a + b, 0) / serie.length) : null;
  // Une mesure datée APRÈS aujourd'hui (horloge de montre fausse) n'est pas « fraîche » :
  // elle passait pour la mesure du matin (âge négatif ≤ 2). Trouvé par crash-test, 05/11/2026.
  return { dernier, jours, fraiche: jours != null && jours >= 0 && jours <= 2, base, ecart: dernier != null && base != null ? dernier - base : null, n: serie.length };
}

/**
 * L'état physiologique qui décide de la séance-clé et du score discipline. `hrv` est une
 * série passée par `serieVfc` : l'état y est RELATIF à la base de l'athlète. Il ne compte
 * que si la mesure est fraîche (2 jours) — la même règle que l'état du jour : une
 * « récupération » vieille d'une semaine ne doit pas imposer un footing aujourd'hui.
 * Partagé par la carte et la fiche, qui ne peuvent pas annoncer deux scores différents.
 */
export function etatPhysiologique(hrv: readonly Pick<HRVData, "date" | "hrv_ms" | "physiological_state">[], maintenant = Date.now(), aujourdhui?: string): string {
  return (statsVfc(hrv, maintenant, aujourdhui).fraiche ? hrv[0]?.physiological_state : null) ?? "optimal";
}

/** Une journée telle que la série l'a jugée (lib/streak) : seul ce que l'assiduité lit. */
export type JourJuge = { date: string; verdict: string };

/**
 * LE SCORE DISCIPLINE, REFAIT LE 06/11/2026 — trois défauts constatés sur un vrai compte
 * (J+12 d'un marathon, 58 %) :
 *  · ASSIDUITÉ = séances ÷ 8, pour tout le monde. Pendant la récupération prescrite par le
 *    coach, l'athlète était compté en retard parce qu'il ne courait pas quatre fois par
 *    semaine. Elle mesure désormais ce que le coach a DEMANDÉ : journées tenues ÷ journées
 *    jugées, avec les règles de la série (repos prescrit ou proposé = tenu).
 *  · RÉCUPÉRATION sur une VFC vieille d'une semaine, et 85 inventés sans aucune mesure
 *    (`stateBaseline`). Elle ne lit plus que des mesures FRAÎCHES (2 jours) ; sans mesure,
 *    elle vaut `null` et le total se calcule sur les composantes mesurées.
 *  · FENÊTRE sur l'horloge de la machine : le chiffre pouvait différer d'un point entre le
 *    serveur et le navigateur autour de minuit. Elle se compte en jours CIVILS.
 * Une composante `null` n'est pas un zéro : elle est absente, et le dire est l'affaire de
 * l'écran.
 */
export function computeDiscipline(
  workouts: Workout[], hrv: HRVData[],
  sleep: { sleep_score: number } | null, state: string,
  opts: { aujourdhui?: string; serie?: readonly JourJuge[] | null } = {},
): {
  total: number; precision: number | null; consistency: number | null; recovery: number | null; hasData: boolean;
  /** Les valeurs intermédiaires, montrées par la page détaillée (/dashboard/indicateurs/discipline). */
  details: { seances: number; faciles: number; qualites: number; tenues: number; jugees: number; sommeil: number | null; signalVfc: number | null };
} {
  const C = DISCIPLINE_CONFIG;
  const jour = opts.aujourdhui ?? jourLocal();
  const recent = workouts.filter((w) => dansFenetre(String(w.date), C.windowDays, jour));

  // Assiduité — ce que le coach a demandé, jugé comme la série le juge.
  const jugees = (opts.serie ?? []).filter((j) => dansFenetre(j.date, C.windowDays, jour)
    && (j.verdict === "tenu" || j.verdict === "protege" || j.verdict === "rompu"));
  const tenues = jugees.filter((j) => j.verdict !== "rompu").length;
  const consistency = jugees.length ? clamp(Math.round((100 * tenues) / jugees.length)) : null;

  // Précision — proximité d'une répartition polarisée ~80 % facile / 20 % qualité.
  //  Pénalité asymétrique : le « trop dur » coûte plus cher que le « trop facile ».
  //  Sous `minForPrecision` séances, rien à juger (elle empruntait l'assiduité).
  let precision: number | null = null;
  if (recent.length >= C.minForPrecision) {
    const easyShare = recent.filter(w => !isQualityWorkout(w)).length / recent.length;
    const dev = easyShare - C.easyShareTarget;                          // <0 trop dur · >0 trop facile
    const tooEasy = state === "recovery" ? 0 : C.penaltyTooEasy;        // semaine de récup → le facile est normal
    precision = clamp(Math.round(100 - (dev < 0 ? -dev * C.penaltyTooHard : dev * tooEasy)));
  }

  // Récupération — mesures FRAÎCHES seulement : le sommeil arrive déjà filtré par
  // l'appelant ; la VFC ne compte que si sa dernière mesure a 2 jours au plus.
  const signals: number[] = [];
  if (sleep?.sleep_score != null && Number.isFinite(sleep.sleep_score)) signals.push(sleep.sleep_score);
  const hrvVals = hrv.slice(0, 14).map(h => h.hrv_ms).filter((v): v is number => v != null);
  let signalVfc: number | null = null;
  if (hrvVals.length >= 3 && statsVfc(hrv, Date.now(), jour).fraiche) {
    const base = hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length;
    signalVfc = clamp(70 + ((hrvVals[0] - base) / base) * 300);        // à la base ≈ 70, +10 % ≈ 100
    signals.push(signalVfc);
  }
  const recovery = signals.length ? Math.round(signals.reduce((a, b) => a + b, 0) / signals.length) : null;

  // Total pondéré sur les composantes MESURÉES (poids renormalisés).
  const parts = ([[precision, C.weights.precision], [consistency, C.weights.consistency], [recovery, C.weights.recovery]] as const)
    .filter((p): p is readonly [number, number] => p[0] != null);
  const poids = parts.reduce((a, [, w]) => a + w, 0);
  const total = poids > 0 ? Math.round(parts.reduce((a, [v, w]) => a + v * w, 0) / poids) : 0;
  const qualites = recent.filter(isQualityWorkout).length;
  return {
    total, precision, consistency, recovery, hasData: parts.length > 0,
    details: {
      seances: recent.length, faciles: recent.length - qualites, qualites,
      tenues, jugees: jugees.length,
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
