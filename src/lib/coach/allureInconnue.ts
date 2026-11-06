/**
 * UNE ALLURE QU'ON NE CONNAÎT PAS NE S'ÉCRIT PAS « ~?/km » (07/11/2026).
 *
 * Sans VMA (compte dispensé du test, ou VMA pas encore mesurée), les gabarits des séances de
 * qualité recevaient « ? » comme allure : « 16 min d'un bloc à ~?/km ». Illisible, et c'est
 * précisément la chose que l'athlète vient chercher. On remplace la préposition et le « ? »
 * par une consigne honnête : courir au ressenti, et faire le test qui chiffrera l'allure.
 * Rien n'est inventé : aucune allure par défaut n'est écrite.
 */
import type { Lang } from "@/lib/i18n/translations";

const AU_RESSENTI: Record<Lang, string> = {
  fr: " au ressenti (allure à chiffrer avec un test VMA)",
  en: " by feel (pace to be set with a VO₂max test)",
  de: " nach Gefühl (Tempo per vVO₂max-Test bestimmen)",
  es: " por sensaciones (ritmo a fijar con un test de VAM)",
  pt: " pela sensação (ritmo a definir com um teste de VAM)",
};

/** Les prépositions des gabarits devant une allure (« à ~4'10/km », « at », « zu », « bei », « a », « bis »). */
// Il faut « ~? » ou « ?/km » : une vraie question (« tu le sens ? ») n'est pas une allure.
const ALLURE_INCONNUE = /\s(?:à|at|zu|bei|bis|a|em)?\s*(?:~\?(?:\/km)?|\?\/km)/g;

export function sansAllureInconnue(texte: string, l: Lang = "fr"): string {
  return String(texte ?? "").replace(ALLURE_INCONNUE, AU_RESSENTI[l] ?? AU_RESSENTI.fr);
}
