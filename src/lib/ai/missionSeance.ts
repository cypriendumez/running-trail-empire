/**
 * LA MISSION DE LA SÉANCE DU JOUR (`/api/ai/session`) — ce que l'IA doit viser, selon le cadre de santé du
 * coureur (lib/coach/cadreSante, 20/11/2026). Pour un coureur ordinaire, la mission d'avant, mot pour mot.
 * Sous cadre, la consigne le borne SANS en dire le motif : la mission disait « fais converger vers
 * l'objectif, intègre par moments l'allure spécifique » et « quelques rappels d'allure » avant la course,
 * même à un coureur cardiaque — et rien ne retenait l'IA de proposer une séance à qui attend l'avis d'un
 * médecin, ou un footing continu à qui suit la marche-course (@HeadCoach, 20/11/2026).
 */
import type { CadreSante } from "@/lib/coach/cadreSante";

export function missionSeanceDuJour(c: { cadreSante?: CadreSante | null }): string {
  const cadre = c.cadreSante;
  if (!cadre) return `- Si fatigué (VFC sous la base, sommeil bas, ou TSB très négatif) → récupération / facile.
- Si la course est proche → affûtage (fraîcheur, volume réduit, quelques rappels d'allure).
- Sinon, fais converger vers l'objectif : intègre par moments l'allure spécifique et la distance cible, en respectant le modèle polarisé et le niveau de l'athlète.
- Dose le volume sur le volume hebdomadaire réel et reste prudent si une douleur est signalée.`;
  if (cadre.niveau === "sansSeance") return `- ⛔ CADRE DE SANTÉ (n'en cite pas le motif) : AUCUNE séance d'endurance aujourd'hui — ni course, ni vélo, ni natation. Propose du repos, de la mobilité, une marche tranquille ou un renforcement doux sans saut, et rappelle-lui qu'un médecin doit le voir avant toute reprise.`;
  const duree = cadre.kine?.dureeMaxMin != null ? ` Une sortie dure ${cadre.kine.dureeMaxMin} min au plus.` : "";
  if (cadre.marcheCourse) return `- ⛔ CADRE DE SANTÉ (n'en cite pas le motif) : la séance du jour est celle de son étape de marche-course (${cadre.marcheCourse.etape} sur ${cadre.marcheCourse.total}), telle quelle — des alternances de marche et de course, rien d'autre.${duree}
- Si fatigué (VFC sous la base, sommeil bas, ou TSB très négatif) → repos ou marche tranquille.
- Reste prudent si une douleur est signalée.`;
  return `- ⛔ CADRE DE SANTÉ (n'en cite pas le motif) : ${cadre.niveau === "sansIntensite"
    ? "AUCUNE intensité — uniquement de l'endurance facile, à la conversation"
    : "ni VMA, ni test, ni allure de course, ni lignes droites ni accélérations ; au plus une séance sous le seuil (seuil bas) par semaine, sinon de l'endurance facile"}.${cadre.sensation
    ? " Aucune allure chiffrée ni cible de fréquence cardiaque : tout à la sensation, il doit pouvoir parler."
    : ""}${duree}
- Si fatigué (VFC sous la base, sommeil bas, ou TSB très négatif) → récupération / facile.
- Si la course est proche → fraîcheur et volume réduit, sans rappel d'allure.
- Dose le volume sur le volume hebdomadaire réel et reste prudent si une douleur est signalée.`;
}
