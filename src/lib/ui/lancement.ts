/**
 * Clé de session de l'écran de lancement — dans un module NEUTRE, pas dans le composant.
 *
 * ⚠️ Une page serveur qui importe une constante d'un module `use client` ne reçoit pas la
 * valeur mais une RÉFÉRENCE client : le script du layout aurait lu une clé fantôme, et
 * l'écran se serait rejoué à chaque rechargement.
 */
export const CLE_SESSION_LANCEMENT = "pacevo_lancement";
