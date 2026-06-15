import type { RaceType } from "@/types";

// ── Correction du type à partir de la distance ───────────────────────────────
// ~2 % des courses importées ont un `type` qui ne colle pas à leur distance
// (ex. « L'Ardéchoise · 51 km » étiquetée Ultra alors que 51 km = Trail L).
// On NE touche PAS aux types route (5/10/semi/marathon) : la distance seule ne
// distingue pas route et trail. Pour les trails/ultras on reclasse strictement
// par distance. Correction non destructive (calculée à l'affichage).
export function correctedRaceType(distanceKm: number | null | undefined, type: RaceType): RaceType {
  if (type === "road_5k" || type === "road_10k" || type === "semi" || type === "marathon") return type;
  const d = Number(distanceKm);
  if (!(d > 0)) return type;
  if (d < 30) return "trail_s";
  if (d < 50) return "trail_m";
  if (d < 80) return "trail_l";
  if (d < 100) return "trail_xl";
  return "ultra";
}
