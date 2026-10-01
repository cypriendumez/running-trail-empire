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
/** Un gel standard. C'est l'unité que l'athlète manipule vraiment, pas le gramme. */
export const GEL_G = 25;
/** Une flasque souple standard : l'unité de boisson qu'on remplit et qu'on compte. */
export const FLASQUE_ML = 500;

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
    gels: Math.max(0, Math.round(glucidesTotalG / GEL_G)),
    mlParH,
    sodiumMgParL,
    avantCourseG: fini(e.poidsKg) ? Math.round(e.poidsKg * (dureeMin >= DUREE_LONGUE_MIN ? 2 : 1.5)) : null,
    tempConnue,
    tempC: t,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  LE PLAN, TRADUIT EN GESTES (écran Santé › Nutrition, 30/09/2026).
//
//  L'écran affichait des chiffres INVENTÉS sur place — « 120 mg de caféine », « 40 g/h
//  + 5 g par heure au-delà de 3 h », un sodium tiré de la température seule — qui ne
//  disaient pas la même chose que le coach. Désormais l'écran ne décide RIEN : il lit
//  `planNutritionCourse`, et ce qui suit ne fait que le convertir en unités qu'on
//  emporte (gels, flasques) et en moments (quand prendre quoi).
// ─────────────────────────────────────────────────────────────────────────────

export type DerouleCourse = {
  /** Minutes entre deux prises : le temps de consommer UN gel à la dose horaire. */
  intervalleMin: number;
  /** Minute (depuis le départ) de chaque prise — exactement autant que de gels. */
  prises: number[];
  /** Boisson à boire à chaque prise, arrondie à 10 ml. */
  mlParPrise: number;
  boissonTotaleMl: number;
  /** Flasques de 500 ml à remplir sur l'ensemble de l'effort. */
  flasques: number;
  sodiumMgParH: number;
  sodiumTotalMg: number;
};

/**
 * Quand prendre chaque gel, combien boire, combien emporter.
 *
 * L'intervalle découle de la dose : 25 g à 50 g/h → un gel toutes les 30 min ; à 75 g/h
 * → toutes les 20 min. Il y a EXACTEMENT autant de prises que de gels : sinon la liste
 * des horaires et le décompte du sac se contrediraient à l'écran (« 6 gels » au-dessus
 * de sept horaires). Le premier tombe à `premierApportMin`, avant la faim.
 */
export function derouleCourse(p: PlanNutrition): DerouleCourse {
  const intervalleMin = Math.max(1, Math.round((GEL_G / p.glucidesParH) * 60));
  const prises = Array.from({ length: p.gels }, (_, i) => p.premierApportMin + i * intervalleMin);
  // La boisson court sur TOUTE la durée — on boit dès le départ, contrairement aux gels.
  const boissonTotaleMl = Math.round((p.mlParH * p.dureeMin) / 60);
  return {
    intervalleMin,
    prises,
    mlParPrise: Math.round((p.mlParH * intervalleMin) / 60 / 10) * 10,
    boissonTotaleMl,
    flasques: Math.ceil(boissonTotaleMl / FLASQUE_ML),
    // Le module raisonne en mg PAR LITRE (la concentration de la boisson) ; l'athlète,
    // lui, lit ses pastilles en mg par heure. Même donnée, deux unités.
    sodiumMgParH: Math.round((p.sodiumMgParL * p.mlParH) / 1000),
    sodiumTotalMg: Math.round((p.sodiumMgParL * boissonTotaleMl) / 1000),
  };
}

/**
 * LES TRANCHES DE TEMPÉRATURE PROPOSÉES À L'ÉCRAN — calquées sur les paliers de
 * `planNutritionCourse` (10, 20, 25 et 30 °C).
 *
 * ⚠️ UNE TRANCHE = UN PALIER, jamais deux. Le calcul procède par marches : un bouton
 * « Chaud » couvrant 20 à 29 °C aurait rendu un chiffre juste pour la moitié de la
 * tranche et faux pour l'autre. Chaque tranche passe une température prise en son
 * milieu, et `tests/nutrition.test.ts` vérifie que ses deux bords rendent le même plan.
 * `min`/`max` servent au libellé ; `null` = tranche ouverte.
 */
export const TRANCHES_TEMPERATURE = [
  { cle: "frais", min: null, max: 9, tempC: 5 },
  { cle: "doux", min: 10, max: 19, tempC: 15 },
  { cle: "chaud", min: 20, max: 24, tempC: 22 },
  { cle: "tresChaud", min: 25, max: 29, tempC: 27 },
  { cle: "canicule", min: 30, max: null, tempC: 32 },
] as const;
export type TrancheTemperature = (typeof TRANCHES_TEMPERATURE)[number]["cle"];
