/**
 * LE SOCLE i18n SANS DICTIONNAIRE — importable par le navigateur sans rien lui coûter.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE (22/09/2026) : `translations.ts` porte les cinq langues
 * (≈ 200 kB de source, 183 kB de JavaScript produit). Un composant client qui n'avait
 * besoin que de `LANGS` ou de `fill` embarquait TOUT le dictionnaire — sur chaque page,
 * publique ou non. Ici : les types, la liste des langues et deux fonctions pures. Le
 * dictionnaire lui-même n'entre dans le navigateur que par la langue courante, passée
 * en prop par le serveur (`LanguageProvider dict=…`), et par un import paresseux au
 * changement de langue.
 */
export type Lang = "fr" | "en" | "de" | "es" | "pt";
export type Dict = Record<string, string>;

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
];

/** Remplace `{clé}` par sa valeur — partagé par `t()` et les pages serveur. */
export function fill(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export function normLang(l: string | null | undefined): Lang {
  return (["fr", "en", "de", "es", "pt"].includes(l ?? "") ? l : "fr") as Lang;
}
