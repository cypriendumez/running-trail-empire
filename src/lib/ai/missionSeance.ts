/**
 * LA MISSION DE LA SÉANCE DU JOUR (`/api/ai/session`) — ce que l'IA doit viser, selon le cadre de santé du
 * coureur (lib/coach/cadreSante, 20/11/2026). Pour un coureur ordinaire, la mission d'avant, mot pour mot.
 * Sous cadre, la consigne le borne SANS en dire le motif : la mission disait « fais converger vers
 * l'objectif, intègre par moments l'allure spécifique » et « quelques rappels d'allure » avant la course,
 * même à un coureur cardiaque — et rien ne retenait l'IA de proposer une séance à qui attend l'avis d'un
 * médecin, ou un footing continu à qui suit la marche-course (@HeadCoach, 20/11/2026).
 */
import type { CadreSante } from "@/lib/coach/cadreSante";
import { COACH_SYSTEM, COACH_SYSTEM_CADRE } from "@/lib/ai/coachContext";

type CtxMission = { cadreSante?: CadreSante | null; malaiseApresEffort?: boolean };

export function missionSeanceDuJour(c: CtxMission): string {
  const cadre = c.cadreSante;
  if (!cadre) return `- Si fatigué (VFC sous la base, sommeil bas, ou TSB très négatif) → récupération / facile.
- Si la course est proche → affûtage (fraîcheur, volume réduit, quelques rappels d'allure).
- Sinon, fais converger vers l'objectif : intègre par moments l'allure spécifique et la distance cible, en respectant le modèle polarisé et le niveau de l'athlète.
- Dose le volume sur le volume hebdomadaire réel et reste prudent si une douleur est signalée.`;
  if (cadre.niveau === "sansSeance") return `- ⛔ CADRE DE SANTÉ (n'en cite pas le motif) : AUCUNE séance d'endurance aujourd'hui — ni course, ni vélo, ni natation. Propose du repos, de la mobilité, une marche tranquille ou un renforcement doux sans saut, et rappelle-lui qu'un médecin doit le voir avant toute reprise.`;
  // Covid long, plus mal après sa dernière séance (bilan du matin) : le plan pose un repos aujourd'hui.
  // Le même conseil que le plan (décision de Cyprien, 20/11/2026), sans rien affirmer de ce qu'il fait de la course.
  if (c.malaiseApresEffort) return `- ⛔ CADRE DE SANTÉ (n'en cite pas le motif) : REPOS aujourd'hui — il s'est senti nettement plus mal après sa dernière séance. Si une course tombe aujourd'hui, conseille-lui de ne pas prendre le départ (la décision lui appartient) et d'en parler à son médecin avant la suivante. Aucune autre séance.`;
  const duree = cadre.kine?.dureeMaxMin != null ? ` Une sortie dure ${cadre.kine.dureeMaxMin} min au plus.` : "";
  // Marche-course : la séance de son étape, SI le plan en pose une aujourd'hui (aucune quand la durée maximale
  // du kiné est plus courte qu'elle). Ni « alternances » (les dernières étapes sont de la course continue).
  if (cadre.marcheCourse?.bloquee) return `- ⛔ CADRE DE SANTÉ (n'en cite pas le motif) : AUCUNE séance de marche-course cette semaine — celle de son étape dépasse la durée fixée par son kinésithérapeute. Propose du repos, une marche tranquille ou un renforcement doux, et de lui demander comment l'adapter.`;
  if (cadre.marcheCourse) return `- ⛔ CADRE DE SANTÉ (n'en cite pas le motif) : si son plan pose une séance aujourd'hui, c'est celle de son étape de marche-course (${cadre.marcheCourse.etape} sur ${cadre.marcheCourse.total}), telle quelle, rien d'autre ; sinon, repos ou marche tranquille.${duree}
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

/**
 * L'INVITE ENTIÈRE DE LA SÉANCE DU JOUR (`/api/ai/session`) : système, dossier, mission, format de réponse. Pour un
 * coureur ordinaire, l'invite d'avant, mot pour mot. Sous cadre, le système du cadre, une mission « DANS son
 * cadre » et un format sans « allure/zone » ni étiquettes « VMA, Allure marathon » (@HeadCoach, relecteur).
 */
export function inviteSeanceDuJour(ctx: CtxMission & { text: string }, jour: string): string {
  if (!ctx.cadreSante) return `${COACH_SYSTEM}

VOICI L'ATHLÈTE (analyse CHAQUE ligne) :
${ctx.text}

MISSION : recommande LA séance-clé à faire AUJOURD'HUI (${jour}), parfaitement calibrée sur sa forme du jour, sa charge et son objectif de course.
${missionSeanceDuJour(ctx)}

Réponds UNIQUEMENT par un objet JSON valide (aucun texte autour) :
{"title":"nom court de la séance","subtitle":"description concrète : structure, allure/zone, durée/distance","tags":["2 à 3 tags très courts ex Z2, 10 km, VMA, Allure marathon"],"why":"1 phrase de justification personnalisée citant une donnée clé FOURNIE ci-dessus (sommeil, charge, objectif, ou VFC si elle y figure) — jamais une donnée absente"}`;
  return `${COACH_SYSTEM_CADRE}

VOICI L'ATHLÈTE (analyse CHAQUE ligne) :
${ctx.text}

MISSION : recommande LA séance à faire AUJOURD'HUI (${jour}), DANS son cadre de santé, calibrée sur sa forme du jour et sa charge.
${missionSeanceDuJour(ctx)}

Réponds UNIQUEMENT par un objet JSON valide (aucun texte autour) :
{"title":"nom court de la séance","subtitle":"description concrète : structure et durée${ctx.cadreSante.sensation ? ", à la sensation" : ""}","tags":["2 à 3 tags très courts ex ${ctx.cadreSante.niveau === "sansSeance" ? "Repos, Mobilité, Renfo doux" : "Endurance, Facile"}"],"why":"1 phrase de justification personnalisée citant une donnée clé FOURNIE ci-dessus (sommeil, charge, ou VFC si elle y figure) — jamais une donnée absente, jamais la cause médicale du cadre"}`;
}
