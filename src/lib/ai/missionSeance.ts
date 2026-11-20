/**
 * LA MISSION DE LA SÉANCE DU JOUR (`/api/ai/session`) — ce que l'IA doit viser, selon le cadre de santé du
 * coureur (20/11/2026). Pour un coureur ordinaire, la mission d'avant, mot pour mot. Pour un antécédent qui
 * interdit l'effort maximal, la consigne le borne SANS en dire le motif : la mission disait « fais converger
 * vers l'objectif, intègre par moments l'allure spécifique » et « quelques rappels d'allure » avant la
 * course, même à un coureur cardiaque.
 */
export type CadreSeance = { effortMaximalInterdit?: boolean; intensiteInterdite?: boolean; pilotageSensation?: boolean };

export function missionSeanceDuJour(c: CadreSeance): string {
  if (!c.effortMaximalInterdit) return `- Si fatigué (VFC sous la base, sommeil bas, ou TSB très négatif) → récupération / facile.
- Si la course est proche → affûtage (fraîcheur, volume réduit, quelques rappels d'allure).
- Sinon, fais converger vers l'objectif : intègre par moments l'allure spécifique et la distance cible, en respectant le modèle polarisé et le niveau de l'athlète.
- Dose le volume sur le volume hebdomadaire réel et reste prudent si une douleur est signalée.`;
  return `- ⛔ CADRE DE SANTÉ (n'en cite pas le motif) : ${c.intensiteInterdite
    ? "AUCUNE intensité — uniquement de l'endurance facile, à la conversation"
    : "ni VMA, ni test, ni allure de course, ni lignes droites ni accélérations ; au plus une séance sous le seuil (seuil bas), sinon de l'endurance facile"}.${c.pilotageSensation
    ? " Aucune allure chiffrée ni cible de fréquence cardiaque : tout à la sensation, il doit pouvoir parler."
    : ""}
- Si fatigué (VFC sous la base, sommeil bas, ou TSB très négatif) → récupération / facile.
- Si la course est proche → fraîcheur et volume réduit, sans rappel d'allure.
- Dose le volume sur le volume hebdomadaire réel et reste prudent si une douleur est signalée.`;
}
