import type { RaceType } from "@/types";

// ── Correction du type à partir de la distance ───────────────────────────────
// ~2 % des courses importées ont un `type` qui ne colle pas à leur distance
// (ex. « L'Ardéchoise · 51 km » étiquetée Ultra alors que 51 km = Trail L).
// On NE touche PAS aux types route (5/10/semi/marathon) : la distance seule ne
// distingue pas route et trail. Pour les trails/ultras on reclasse strictement
// par distance. Correction non destructive (calculée à l'affichage).
//
// ⚠️ LE NOM, QUAND IL DIT « TRAIL » (30/09/2026). 116 courses nommées « Trail … » étaient
// typées route — « Trail des 7 Monts » (15 km, 500 m D+), « Trail TKAL », « Trail des
// Auri'gines » — et manquaient au filtre « Trail ». Ni la distance ni le dénivelé ne
// tranchent (« Montée du Faron » est une course sur ROUTE à 47 m/km) ; le nom choisi par
// l'organisateur, si. Sauf le trail URBAIN, qui se court souvent sur le bitume : on ne le
// déplace pas. Correction à l'AFFICHAGE : la base garde le type qu'une troisième source a
// pu fixer (le-sportif, cron `races-types`).
export function correctedRaceType(distanceKm: number | null | undefined, type: RaceType, nom?: string | null): RaceType {
  const route = type === "road_5k" || type === "road_10k" || type === "semi" || type === "marathon";
  if (route && !(nom && /trail/i.test(nom) && !/urba/i.test(nom))) return type;
  const d = Number(distanceKm);
  if (!(d > 0)) return route ? "trail_s" : type;
  if (d < 30) return "trail_s";
  if (d < 50) return "trail_m";
  if (d < 80) return "trail_l";
  if (d < 100) return "trail_xl";
  return "ultra";
}
