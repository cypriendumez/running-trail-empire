/**
 * Le nom de l'événement DOM qui ouvre l'assistant depuis n'importe où (la tuile
 * « Assistant » de la barre d'onglets mobile l'émet, `SupportBubble` l'écoute). Une
 * constante partagée plutôt qu'une chaîne recopiée : une faute de frappe d'un côté
 * rendrait la tuile muette sans qu'aucun outil ne le voie.
 */
export const EVENEMENT_AIDE = "pacevo:aide";
