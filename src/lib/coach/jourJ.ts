// ─────────────────────────────────────────────────────────────────────────────
//  LE PACK JOUR J (Premium) — tout ce qu'il faut savoir le jour de la course.
//
//  Cyprien, 30/10/2026, après l'audit des formules : Premium reposait sur des conseils
//  écrits ; aucun concurrent ne donne, pour SA course, le chrono réaliste, le tableau de
//  marche, les allures selon la température du jour, le ravitaillement et l'échauffement.
//
//  ⚠️ AUCUN APPEL DE MODÈLE : tout se calcule, donc rien ne s'invente et rien ne coûte par
//  athlète. Chaque brique est celle que l'application utilise déjà ailleurs :
//    · le chrono : `raceProjection` (le verdict « objectif cohérent » de la carte) ;
//    · la chaleur : `heatAdvice` × `PART_PENALITE_CHALEUR`, le modèle qui relit déjà les
//      performances par temps chaud (un effort de course souffre moins qu'un effort long) ;
//    · le ravitaillement : `planNutritionCourse` et `derouleCourse` (écran Santé).
//
//  ⚠️ EN TRAIL, PAS D'ALLURE AU KILOMÈTRE. Le catalogue donne le dénivelé TOTAL, jamais son
//  profil : une allure par kilomètre serait fausse dès la première côte, et la prédiction
//  (calée sur du plat) aussi. On le dit, et on donne une gestion à l'effort.
// ─────────────────────────────────────────────────────────────────────────────
import { raceProjection, PART_PENALITE_CHALEUR, type RaceProjection } from "@/lib/running/fitness";
import type { Socle } from "@/lib/running/vdot";
import { heatAdvice } from "@/lib/weather/openMeteo";
import { planNutritionCourse, derouleCourse, TRANCHES_TEMPERATURE, type PlanNutrition, type DerouleCourse, type TrancheTemperature } from "@/lib/coach/nutritionCourse";

export type EntreeJourJ = {
  objectif: { nom: string; date: string; distanceKm: number; viseSec: number; officielle: boolean };
  joursRestants: number;
  /** VMA effective ; `null` ou 0 = inconnue (aucune prédiction n'est alors donnée). */
  vma: number | null;
  socle: Socle | null;
  /** Amélioration attendue d'ici la course (fraction), mesurée sur la pente de l'athlète. */
  ameliorationMesuree: number | null;
  /** Dénivelé positif et terrain, quand la course est retrouvée dans le catalogue. */
  dplusM: number | null;
  terrain: string | null;
  poidsKg: number | null;
  /** Prévision du jour J (la fenêtre de prévision ne couvre que 7 jours), sinon `null`. */
  meteo: { tempC: number; humidite: number | null; ventKmh: number | null } | null;
};

export type Echauffement = "court" | "moyen" | "leger" | "marche";

export type PackJourJ = {
  mode: "route" | "trail";
  chrono: {
    viseSec: number;
    maintenantSec: number | null;
    projeteSec: number | null;
    verdict: RaceProjection["verdict"] | "inconnu";
    /** L'allure à tenir : celle de l'objectif, sauf s'il est hors de portée (alors la projection). */
    allureSecKm: number | null;
  };
  /** Course courte (jusqu'au 10 km) ou longue : la consigne de départ n'est pas la même. */
  strategie: "courte" | "longue";
  /** Temps de passage (route) : chaque kilomètre jusqu'à 10 km, tous les 5 km au-delà, et l'arrivée. */
  passages: { km: number; tempsSec: number }[];
  meteo: {
    prevue: { tempC: number; humidite: number | null; ventKmh: number | null; allureSecKm: number | null; tempsSec: number | null } | null;
    /** Allure et temps selon la température (route seulement). */
    scenarios: { cle: TrancheTemperature; tempC: number; allureSecKm: number; tempsSec: number }[];
  };
  nutrition: { plan: PlanNutrition; deroule: DerouleCourse } | null;
  echauffement: Echauffement;
  /** Glucides à charger la veille et le matin (g), quand le ravitaillement s'impose. */
  veilleGlucidesG: number | null;
  /** Course officielle : le Pass Prévention Santé est exigé pour s'inscrire en France. */
  pps: boolean;
};

/** Pente moyenne au-delà de laquelle une course se gère à l'effort, pas à l'allure (m de D+ par km). */
export const DPLUS_TRAIL_PAR_KM = 15;

/** Le surcoût de la chaleur sur une allure de COURSE (s/km), avec le modèle de l'application. */
export const penaliteChaleurCourse = (tempC: number, humidite: number | null) =>
  Math.round(heatAdvice(tempC, humidite).penaltySecPerKm * PART_PENALITE_CHALEUR);

export function packJourJ(e: EntreeJourJ): PackJourJ {
  const d = e.objectif.distanceKm;
  const trail = /trail|nature|montagne/i.test(e.terrain ?? "") || (e.dplusM != null && e.dplusM / d >= DPLUS_TRAIL_PAR_KM) || d > 42.5;
  const mode = trail ? "trail" : "route";

  // ── Le chrono : le MÊME calcul que le verdict de la carte d'objectif ─────────
  const proj = !trail && e.vma && e.vma > 0
    ? raceProjection(e.vma, d, e.objectif.viseSec, Math.max(0, e.joursRestants) / 7, e.ameliorationMesuree, e.socle)
    : null;
  // L'allure EXACTE (non arrondie) : arrondie à la seconde, 3'12 sur 5 km donnait 16'00 à
  // l'arrivée pour un objectif de 15'59. On n'arrondit qu'à l'affichage.
  const tempsCible = proj?.verdict === "irrealiste" ? proj.projectedSec : e.objectif.viseSec;
  const allureCible = trail ? null : tempsCible / d;

  // ── Le tableau de marche ─────────────────────────────────────────────────────
  const pas = d <= 10.5 ? 1 : 5;
  const bornes: number[] = [];
  for (let km = pas; km < d - 0.05; km += pas) bornes.push(km);
  bornes.push(Math.round(d * 100) / 100);
  const passages = allureCible == null ? [] : bornes.map((km, i) => ({
    km, tempsSec: i === bornes.length - 1 ? Math.round(tempsCible) : Math.round(allureCible * km),
  }));

  // ── La météo ─────────────────────────────────────────────────────────────────
  const scenarios = allureCible == null ? [] : TRANCHES_TEMPERATURE.map((t) => {
    const allure = allureCible + penaliteChaleurCourse(t.tempC, null);
    return { cle: t.cle, tempC: t.tempC, allureSecKm: allure, tempsSec: Math.round(allure * d) };
  });
  const prevue = e.meteo ? (() => {
    const allure = allureCible == null ? null : allureCible + penaliteChaleurCourse(e.meteo.tempC, e.meteo.humidite);
    return { ...e.meteo, allureSecKm: allure, tempsSec: allure == null ? null : Math.round(allure * d) };
  })() : null;

  // ── Le ravitaillement, sur la durée que la course va VRAIMENT durer ──────────
  const dureeSec = prevue?.tempsSec ?? (allureCible != null ? allureCible * d : e.objectif.viseSec);
  const plan = planNutritionCourse({ dureeSec, distanceKm: d, poidsKg: e.poidsKg, tempC: e.meteo?.tempC ?? null });

  return {
    mode,
    chrono: {
      viseSec: e.objectif.viseSec,
      maintenantSec: proj ? Math.round(proj.nowSec) : null,
      projeteSec: proj?.projectedSec ?? null,
      verdict: proj?.verdict ?? "inconnu",
      allureSecKm: allureCible,
    },
    strategie: d <= 10.5 ? "courte" : "longue",
    passages,
    meteo: { prevue, scenarios },
    nutrition: plan ? { plan, deroule: derouleCourse(plan) } : null,
    echauffement: trail ? "marche" : d <= 10.5 ? "court" : d <= 21.5 ? "moyen" : "leger",
    veilleGlucidesG: plan?.avantCourseG ?? null,
    pps: e.objectif.officielle,
  };
}

/** « 3'12 » pour une allure, « 15'59 » sous l'heure, « 1h16'05 » au-delà. */
export function temps(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}'${r}` : `${m}'${r}`;
}
