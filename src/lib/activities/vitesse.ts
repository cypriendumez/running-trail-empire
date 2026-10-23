// ─────────────────────────────────────────────────────────────────────────────
//  ALLURE OU VITESSE — ce que la moyenne d'une sortie doit afficher
//
//  Le fil et la fiche d'une séance affichaient une ALLURE pour tous les sports : la
//  sortie vélo de Cyprien du 23/10/2026 (8,97 km en 27 min 59 s) se lisait « 3:07 /km ».
//  Un cycliste compte en km/h (19,2), jamais en minutes au kilomètre. Une seule règle,
//  ici, pour que le fil et la fiche ne puissent pas se contredire.
// ─────────────────────────────────────────────────────────────────────────────
import { asSport, type Sport } from "@/lib/intervals/sport";

/** Sports dont la moyenne se lit en km/h. Le vélo couvre route, VTT, gravel,
 *  home-trainer et VAE (`lib/intervals/sport`). */
const EN_VITESSE: ReadonlySet<Sport> = new Set<Sport>(["bike"]);

/** La moyenne de ce sport se lit-elle en km/h plutôt qu'en allure ? Lit une valeur de
 *  `workouts.sport` : `null` (ligne antérieure à la migration 015) reste de la course. */
export const seLitEnVitesse = (sport: string | null | undefined): boolean => EN_VITESSE.has(asSport(sport));

/** Vitesse moyenne en km/h, ou `null` si la distance ou la durée manque : une vitesse
 *  inventée sur une mesure absente se lirait comme une vraie. */
export function vitesseKmh(km: number | null | undefined, sec: number | null | undefined): number | null {
  if (typeof km !== "number" || typeof sec !== "number" || !(km > 0) || !(sec > 0)) return null;
  return km / (sec / 3600);
}
