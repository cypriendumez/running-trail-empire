/**
 * L'accès poli des scripts de collecte — désormais dans la bibliothèque
 * (`src/lib/races/lecturePolie`), partagé avec les tâches serveur. Ce module ne fait que
 * le ré-exporter, pour les scripts existants.
 */
export { lectureAutorisee, lirePoliment } from "../src/lib/races/lecturePolie";
