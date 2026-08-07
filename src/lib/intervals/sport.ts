// ─────────────────────────────────────────────────────────────────────────────
//  SPORT D'UNE ACTIVITÉ — distinct du RÔLE de la séance
//
//  `workouts.type` décrit ce que la séance FAIT dans l'entraînement (easy,
//  interval, long, trail…). Il ne dit pas quel SPORT a été pratiqué, et les deux
//  étaient confondus : la randonnée arrivait en « trail », le vélo en « easy ».
//  Tout comptait alors comme du kilométrage de course.
//
//  Conséquence relevée en production : 101,8 km comptés sur une semaine où
//  35,8 km seulement avaient été courus — d'où une sortie longue de 33 km
//  proposée à un athlète qui n'avait pas dépassé 18 km en quatre semaines.
// ─────────────────────────────────────────────────────────────────────────────

export type Sport = "run" | "bike" | "hike" | "walk" | "other";

const SPORTS: Record<string, Sport> = {
  Run: "run", TrailRun: "run", VirtualRun: "run", Workout: "run",
  Ride: "bike", VirtualRide: "bike", GravelRide: "bike", MountainBikeRide: "bike", EBikeRide: "bike",
  Hike: "hike", Walk: "walk",
};

/** Sport d'une activité intervals.icu. Inconnu → « other » : au pire on l'exclut du
 *  volume de course, ce qui est le sens prudent (mieux vaut sous-compter que prescrire
 *  un volume calculé sur des kilomètres jamais courus). */
export function sportOf(type: string | null | undefined): Sport {
  return SPORTS[String(type ?? "")] ?? "other";
}

/** La séance compte-t-elle dans le volume de course et l'estimation de VMA ?
 *  Les lignes antérieures à la migration 015 n'ont pas de sport : on les considère
 *  comme de la course (comportement historique) jusqu'à leur prochaine synchronisation. */
export const isRun = (sport: string | null | undefined): boolean => sport == null || sport === "run";
