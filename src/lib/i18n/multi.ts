// ─────────────────────────────────────────────────────────────────────────────
//  TEXTE MULTILINGUE MATÉRIALISÉ — l'outillage commun de la traduction du plan.
//
//  POURQUOI PAS UNE SIMPLE CLÉ DE TRADUCTION. Les phrases du plan portent des
//  NOMBRES calculés (« 5×6 min à ~4'00/km, récup 1 min »). Une consigne privée de ses
//  chiffres n'apprend rien, et une clé rendue côté client obligerait à transporter
//  chaque variable jusqu'à l'écran. On matérialise donc les 5 langues AU MOMENT où le
//  plan est construit, là où les nombres sont connus.
//
//  ⚠️ LE FRANÇAIS RESTE LA VERSION CANONIQUE. `src/lib/watch/intervals.ts` construit la
//  séance Garmin en ANALYSANT la prose française (« corps : », « récup », « seuil »,
//  « N×DISTANCE à ALLURE »). Traduire le texte lu par la montre casserait la poussée en
//  silence. Les autres langues ne servent QU'À L'AFFICHAGE.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

/** Les 5 langues, dans un ordre stable. */
export const ALL_LANGS: readonly Lang[] = ["fr", "en", "de", "es", "pt"] as const;

/** Une phrase rendue dans les 5 langues. `fr` est la version de référence. */
export type I18nText = Record<Lang, string>;

/** Une langue inconnue retombe sur le FRANÇAIS, jamais sur une clé ni sur du vide. */
export const safeLang = (l: string | null | undefined): Lang =>
  (ALL_LANGS as readonly string[]).includes(String(l)) ? (l as Lang) : "fr";

/** Matérialise un gabarit dans les 5 langues. */
export const tr = (f: (l: Lang) => string): I18nText =>
  ({ fr: f("fr"), en: f("en"), de: f("de"), es: f("es"), pt: f("pt") });

/** Étiquette BCP-47 par langue — utilisée pour le formatage des nombres. */
export const LOCALE: Record<Lang, string> = {
  fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT",
};

/**
 * Nombre formaté SELON LA LOCALE, avec un nombre de décimales imposé.
 * Réservé aux endroits où le français passait DÉJÀ par `toLocaleString("fr-FR")` :
 * le rendu français y est donc rigoureusement inchangé (« 1,9 », « −44 »).
 */
export const nLoc = (v: number, lang: Lang, d = 0): string =>
  v.toLocaleString(LOCALE[lang], { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−");

/**
 * Nombre interpolé dans la phrase (« ~17,85 km »), AU FORMAT DE LA LOCALE.
 *
 * Le français passait auparavant par une interpolation brute (`${km}`), donc par le
 * point décimal de JavaScript : le plan écrivait « ~17.85 km » à un lecteur français.
 * C'était invisible tant que les distances tombaient rondes — et elles tombent rondes la
 * plupart du temps, ce qui est exactement pourquoi personne ne l'avait vu. La borne
 * haute des footings (`longRunKm × 0,85`) produit pourtant des décimales.
 *
 * ⚠️ CE FORMAT EST RELU PAR LES MACHINES. `intervals.ts` (`parseReps`) et
 * `GhostRunner.applyCoachSession` acceptent tous deux la virgule comme le point
 * (`[.,]`), et convertissent avant de calculer : le changement est donc sûr — c'est
 * vérifié par un test, pas supposé.
 */
export const nRaw = (v: number, lang: Lang): string =>
  // `useGrouping: false` est délibéré : le séparateur de milliers français est une
  // ESPACE INSÉCABLE FINE, qui couperait « 1 200 km » en plein milieu d'un motif
  // analysé par la montre. Aucune distance ne le justifie de toute façon.
  v.toLocaleString(LOCALE[lang], { maximumFractionDigits: 2, useGrouping: false });
