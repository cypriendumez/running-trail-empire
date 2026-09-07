// ─────────────────────────────────────────────────────────────────────────────
//  LA NUTRITION DU JOUR DE COURSE.
//
//  La sortie longue avait déjà son plan (glucides par heure, hydratation selon la
//  température du jour, sodium, collation d'avant). La COURSE, elle, n'avait rien —
//  alors que c'est le seul jour où une erreur d'alimentation coûte des mois de
//  préparation. Sur un marathon ou un trail, le mur n'est pas une question de jambes.
//
//  ⚠️ LA TEMPÉRATURE DU JOUR J EST INCONNUE, et il faut le dire. La colonne
//  `historical_weather` du catalogue est VIDE sur les 17 211 courses (vérifié) : on ne
//  dispose d'une température que si la course tombe dans la fenêtre de prévision, soit
//  la dernière semaine. Le reste du temps, l'hydratation est donnée pour une journée
//  tempérée ET annoncée comme telle — un plan d'hydratation faux par 30 °C est
//  dangereux, pas seulement inexact.
//
//  Les quantités suivent le consensus actuel en nutrition sportive : rien sous 75 min,
//  30-60 g/h au-delà, jusqu'à 90 g/h sur plus de 2 h 30 avec des glucides
//  multi-transportables (glucose + fructose), et un premier apport AVANT d'avoir faim.
// ─────────────────────────────────────────────────────────────────────────────

/** En deçà, les réserves de glycogène suffisent : manger ne sert à rien. */
export const DUREE_MIN_MIN = 75;
/** Au-delà, on passe aux glucides multi-transportables et aux doses hautes. */
export const DUREE_LONGUE_MIN = 150;
/** Premier apport : avant la sensation de faim, jamais après. */
export const PREMIER_APPORT_MIN = 45;

export type PlanNutrition = {
  dureeMin: number;
  glucidesParH: number;
  glucidesTotalG: number;
  premierApportMin: number;
  /** Équivalent en gels de 25 g — la seule unité que l'athlète manipule vraiment. */
  gels: number;
  mlParH: number;
  sodiumMgParL: number;
  /** Glucides à charger la veille et le matin, en grammes. `null` sans le poids. */
  avantCourseG: number | null;
  /** Vrai quand la température vient d'une PRÉVISION, faux quand elle est supposée. */
  tempConnue: boolean;
  tempC: number | null;
};

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Plan d'alimentation et d'hydratation pour la course. Rend `null` quand il n'y a rien
 * à prescrire — course trop courte, ou durée inconnue.
 *
 * @param tempC température attendue. `null` = inconnue : on donne une base tempérée et
 *              l'appelant DOIT le dire à l'athlète.
 */
export function planNutritionCourse(e: {
  dureeSec?: number | null; distanceKm?: number | null; poidsKg?: number | null; tempC?: number | null;
}): PlanNutrition | null {
  if (!fini(e.dureeSec)) return null;
  const dureeMin = e.dureeSec / 60;
  if (dureeMin < DUREE_MIN_MIN) return null;

  const heures = dureeMin / 60;
  const glucidesParH = dureeMin >= DUREE_LONGUE_MIN ? 75 : 50;
  // Rien pendant la première heure : les réserves y suffisent, et manger tôt coûte du
  // confort digestif sans rien apporter.
  const glucidesTotalG = Math.round(glucidesParH * Math.max(0, heures - 1));

  // 0 °C est une température VALABLE : `fini()` exige > 0 et l'écarterait.
  const t = typeof e.tempC === "number" && Number.isFinite(e.tempC) ? e.tempC : null;
  const tempConnue = t != null;
  // Base tempérée quand on ne sait pas. Un plan d'hydratation faux par 30 °C est
  // dangereux : mieux vaut une base prudente ET annoncée comme supposée.
  const mlParH = t == null ? 500 : t >= 30 ? 800 : t >= 25 ? 650 : t >= 20 ? 550 : t >= 10 ? 450 : 350;
  const sodiumMgParL = t != null && t >= 25 ? 800 : t != null && t >= 20 ? 600 : 400;

  return {
    dureeMin: Math.round(dureeMin),
    glucidesParH,
    glucidesTotalG,
    premierApportMin: PREMIER_APPORT_MIN,
    gels: Math.max(0, Math.round(glucidesTotalG / 25)),
    mlParH,
    sodiumMgParL,
    avantCourseG: fini(e.poidsKg) ? Math.round(e.poidsKg * (dureeMin >= DUREE_LONGUE_MIN ? 2 : 1.5)) : null,
    tempConnue,
    tempC: t,
  };
}
