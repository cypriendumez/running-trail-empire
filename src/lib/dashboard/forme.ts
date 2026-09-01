import { isRun } from "@/lib/intervals/sport";
import { longRunPeakKm, demonstratedWeeklyKm, type RaceGoal } from "@/lib/running/volume";
import { raceProjection } from "@/lib/running/fitness";
import { dansFenetre } from "./fenetre";

/**
 * SCORE DE FORME — et ce qu'il mesure vraiment.
 *
 * ⚠️ CE SCORE ÉTAIT UN /100 AUX REPÈRES INVENTÉS. Trois constantes universelles y
 * décidaient de tout : sortie longue de 30 km = 100 %, 50 km/semaine = 100 %, VMA
 * comprise entre 8 et 20. Appliquées à tout le monde, elles disent n'importe quoi :
 * un coureur de 10 km qui a fait 12 km en sortie longue — soit exactement ce qu'il
 * faut — obtenait 40 % d'endurance et se croyait mal préparé. À l'inverse, sur ce
 * compte-ci, le score sortait à 99/100 avec deux axes saturés à 100 : un chiffre qui
 * n'apprend plus rien.
 *
 * Les repères suivent désormais L'OBJECTIF DE L'ATHLÈTE, en réutilisant les fonctions
 * qui font déjà autorité dans l'app plutôt qu'en inventant de nouvelles constantes :
 *   · sortie longue → `longRunPeakKm`, dont les repères sont documentés et justifiés ;
 *   · volume        → la capacité qu'il a DÉJÀ démontrée (`demonstratedWeeklyKm`) ;
 *   · vitesse       → le chrono qu'il courrait aujourd'hui face au chrono qu'il vise.
 *
 * Et quand un repère ne peut pas être déduit, on ne le remplace pas en silence : le
 * champ `reference` dit sur quoi le score a été calculé, et la carte l'affiche. Un
 * score sur 100 dont on ignore le dénominateur n'est pas une mesure.
 */

export type ObjectifForme = { distanceKm: number | null; targetSeconds: number | null } | null;

export type Forme = {
  total: number;
  endurance: number;
  speed: number;
  recovery: number;
  regularity: number;
  hasData: boolean;
  /** Sur quoi les échelles sont calées — affiché à l'athlète. */
  reference: "objectif" | "general";
  cibleLongueKm: number | null;
  cibleVolumeKm: number | null;
};

type Seance = { date: string; sport?: string | null; distance_km?: number | null };

/** Repères de repli, ceux d'avant. Conservés pour ne pas laisser un athlète SANS
 *  objectif devant une carte vide — mais annoncés comme génériques, pas comme sa mesure. */
const LONGUE_GENERIQUE = 30;
const VOLUME_GENERIQUE = 50;
const VMA_PLANCHER = 8;
const VMA_ETENDUE = 12;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0));

/** Famille de course déduite de la distance visée — même découpage que `longRunPeakKm`. */
export function butDe(distanceKm: number | null): RaceGoal {
  if (!distanceKm || distanceKm <= 0) return "general";
  if (distanceKm > 45) return "ultra";
  if (distanceKm > 25) return "marathon";
  if (distanceKm > 15) return "semi";
  if (distanceKm > 7) return "10k";
  return "5k";
}

export function computeForme(
  workouts: Seance[],
  currentVma: number,
  recovery: number,
  regularity: number,
  objectif: ObjectifForme = null,
): Forme {
  const recent = workouts.filter((w) => isRun(w.sport) && dansFenetre(w.date, 42));
  const hasData = workouts.length > 0;
  const longest = Math.max(0, ...recent.map((w) => w.distance_km ?? 0));
  const weeklyKm = recent.reduce((s, w) => s + (w.distance_km ?? 0), 0) / 6;

  const raceKm = objectif?.distanceKm && objectif.distanceKm > 0 ? objectif.distanceKm : null;
  const cibleLongueKm = longRunPeakKm(butDe(raceKm), raceKm);
  // La capacité DÉMONTRÉE, pas une cible tombée du ciel : c'est le volume que
  // l'athlète a réellement tenu. `null` tant qu'il n'a pas 4 semaines courues.
  const cibleVolumeKm = demonstratedWeeklyKm(
    workouts.filter((w) => isRun(w.sport)).map((w) => ({ date: w.date, distance_km: w.distance_km ?? 0 })),
  );

  const refLongue = cibleLongueKm ?? LONGUE_GENERIQUE;
  const refVolume = cibleVolumeKm ?? VOLUME_GENERIQUE;
  const endurance = clamp(Math.round(0.6 * (longest / refLongue) * 100 + 0.4 * (weeklyKm / refVolume) * 100));

  // Vitesse : le chrono qu'il courrait AUJOURD'HUI face à celui qu'il vise. C'est la
  // seule échelle qui ait un sens pour lui — une VMA de 17 est excellente pour un
  // coureur de 10 km et juste pour un objectif marathon ambitieux.
  let speed: number;
  if (currentVma > 0 && raceKm && objectif?.targetSeconds && objectif.targetSeconds > 0) {
    const { nowSec } = raceProjection(currentVma, raceKm, objectif.targetSeconds, null);
    speed = nowSec > 0 ? clamp(Math.round((objectif.targetSeconds / nowSec) * 100)) : 0;
  } else {
    speed = currentVma > 0 ? clamp(Math.round(((currentVma - VMA_PLANCHER) / VMA_ETENDUE) * 100)) : 0;
  }

  // ⚠️ `recovery` et `regularity` ARRIVENT DE L'EXTÉRIEUR ET N'ÉTAIENT PAS BORNÉS.
  //    Le total en sortait à 113 sur 100 : l'anneau se serait dessiné hors de son
  //    cercle et la carte aurait annoncé « 113 / 100 ». En production ces deux valeurs
  //    sont bornées à la source, mais un calcul ne doit pas dépendre de la prudence de
  //    son appelant — surtout quand il alimente un tracé. Trouvé par crash-test.
  const rec = clamp(recovery);
  const reg = clamp(regularity);
  const total = clamp(Math.round((endurance + speed + rec + reg) / 4));
  const reference: Forme["reference"] = cibleLongueKm != null ? "objectif" : "general";
  return { total, endurance, speed, recovery: rec, regularity: reg, hasData, reference, cibleLongueKm, cibleVolumeKm };
}
