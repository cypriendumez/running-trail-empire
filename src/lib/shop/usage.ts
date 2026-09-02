/**
 * À QUOI SERT LA CHAUSSURE — déduit des cotes, jamais saisi.
 *
 * ⚠️ POURQUOI CE N'EST PLUS UN CHAMP. L'usage était écrit à la main, modèle par modèle,
 * dans la liste des modèles à collecter. Tant qu'il y en avait cent, cela restait un
 * classement éditorial assumé ; dès que les modèles sont DÉCOUVERTS automatiquement chez
 * le marchand, il n'y a plus personne pour les classer, et « quotidien » par défaut
 * serait une affirmation inventée sur chaque nouvelle paire.
 *
 * Ici, l'usage se calcule à partir de ce qui a été RELEVÉ. Il est donc reproductible,
 * discutable, et il disparaît quand les cotes manquent — l'écran affiche alors « usage
 * non déterminé » plutôt qu'une case remplie au hasard.
 *
 * Les seuils sont ceux de la pratique, et chacun est justifié :
 *  · une plaque carbone ne se met pas dans une chaussure d'entraînement quotidien ;
 *  · au-delà de 40 mm de semelle on est dans l'amorti maximal (limite World Athletics) ;
 *  · sous 240 g avec une semelle contenue, on tient une chaussure de séance ;
 *  · en trail, c'est la matière sous le pied et le poids qui séparent le format court de
 *    l'ultra : au-delà de 30 mm de semelle ou de 300 g, on est sur du long.
 */
import type { Modele, Usage } from "./modele";

export function usageDe(m: Pick<Modele, "terrain" | "poidsG" | "dropMm" | "stackTalonMm" | "plaqueCarbone">): Usage | null {
  const poids = m.poidsG?.valeur, stack = m.stackTalonMm?.valeur, plaque = m.plaqueCarbone?.valeur;

  if (m.terrain === "trail") {
    if (stack == null && poids == null) return null;
    if ((stack != null && stack >= 30) || (poids != null && poids >= 300)) return "trail_long";
    return "trail_court";
  }

  if (plaque === true) return "competition";
  if (stack != null && stack >= 40) return "amorti_max";
  if (poids != null && poids < 240 && (stack == null || stack < 36)) return "tempo";
  if (poids == null && stack == null) return null;
  return "quotidien";
}

/** Vrai quand l'usage a pu être déduit : sert à ne pas afficher une case vide comme un classement. */
export function usageConnu(m: Parameters<typeof usageDe>[0]): boolean {
  return usageDe(m) != null;
}
