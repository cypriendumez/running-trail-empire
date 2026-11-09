/**
 * En dessous, une gêne n'est pas enregistrée : chaque `pain_report` retire de la qualité au
 * plan (`qualityBudget`), et une gêne à 1/10 l'allégeait comme une douleur à 7. Seuil repris
 * de l'ancienne consultation (relecture du 09/11/2026).
 *
 * Module SANS dépendance serveur : l'écran Santé le lit (un `use client` embarque tout son
 * arbre d'imports, et `douleurDeclaree` tire le journal du serveur).
 */
export const SEUIL_DOULEUR_DECLAREE = 4;
