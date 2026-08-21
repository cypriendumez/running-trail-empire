/**
 * La mention d'attribution Garmin, dans les 5 langues.
 *
 * ⚠️ Séparée du composant EXPRÈS : un test doit pouvoir l'importer sans monter React.
 * Vérifier une obligation contractuelle en grepant du JSX serait le genre de garde-fou
 * qui devient vert-aveugle au premier déplacement de fichier.
 *
 * Le texte anglais est celui qu'intervals.icu affiche sur son propre site et que son
 * auteur recommande (forum.intervals.icu, sujet 114087, 23/10/2025). Les quatre autres
 * en sont la traduction directe — on ne reformule pas une mention légale « pour faire
 * mieux ».
 */
export const ATTRIBUTION_GARMIN: Record<string, string> = {
  fr: "Les graphiques peuvent inclure des données provenant d'appareils Garmin.",
  en: "Charts may include data from Garmin devices.",
  de: "Diagramme können Daten von Garmin-Geräten enthalten.",
  es: "Los gráficos pueden incluir datos de dispositivos Garmin.",
  pt: "Os gráficos podem incluir dados de dispositivos Garmin.",
};

/** Les vues qui affichent des activités ou du bien-être — donc soumises à l'article 1.1. */
export const PAGES_ATTRIBUTION = [
  "src/app/dashboard/page.tsx",
  "src/app/dashboard/activite/page.tsx",
  "src/app/dashboard/calendrier/page.tsx",
  "src/app/dashboard/health/page.tsx",
] as const;
