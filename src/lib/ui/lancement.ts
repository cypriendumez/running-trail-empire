/**
 * Clé de session de l'écran de lancement — dans un module NEUTRE, pas dans le composant.
 *
 * ⚠️ Une page serveur qui importe une constante d'un module `use client` ne reçoit pas la
 * valeur mais une RÉFÉRENCE client : le script du layout aurait lu une clé fantôme, et
 * l'écran se serait rejoué à chaque rechargement.
 */
export const CLE_SESSION_LANCEMENT = "pacevo_lancement";

/** La phrase sous le nom, dans la langue de l'athlète (rendue par le serveur). */
export const SLOGAN_LANCEMENT = {
  fr: "Ton coach de course à pied",
  en: "Your running coach",
  de: "Dein Lauftrainer",
  es: "Tu entrenador de running",
  pt: "O teu treinador de corrida",
} as const;

/**
 * La route du logo, redessinée pour l'écran de lancement : une seule courbe, réutilisée
 * pour la piste pâle ET pour le trait qui la parcourt — ils ne peuvent pas diverger.
 */
export const ROUTE_LANCEMENT = "M4 34 C 46 34, 58 10, 104 16 S 168 38, 216 8";
