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
 * Nombre INTERPOLÉ BRUT dans la phrase (`${km}`).
 *
 * Le français est rendu tel quel — c'est-à-dire exactement comme aujourd'hui, y compris
 * son point décimal quand le calcul en produit un (« 17.85 km »). Le corriger serait un
 * changement de comportement du plan français, et le plan français ne doit pas bouger
 * d'un caractère. Les autres langues, elles, suivent leur locale (« 17,85 » en allemand).
 */
export const nRaw = (v: number, lang: Lang): string =>
  lang === "fr" ? String(v) : v.toLocaleString(LOCALE[lang], { maximumFractionDigits: 2 });
