export const locales = ["fr", "en", "de", "es", "it", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

// Langues réellement traduites (interface) — le sélecteur les applique EN DIRECT.
export const activeLocales: readonly Locale[] = ["fr", "en", "de", "es", "pt"];
export const isLocaleActive = (l: string): boolean =>
  (activeLocales as readonly string[]).includes(l);

// Langues proposées dans les sélecteurs, dans l'ordre d'affichage.
export type LanguageOption = { value: Locale; label: string; flag: string };
export const languageOptions: LanguageOption[] = [
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
];

// Ramène une valeur stockée sur une langue réellement active (sinon le défaut).
export const normalizeLocale = (l: string): Locale =>
  isLocaleActive(l) ? (l as Locale) : defaultLocale;
