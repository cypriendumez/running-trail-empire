export const locales = ["fr", "en", "de", "es", "it", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";
