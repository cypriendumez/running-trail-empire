/**
 * LES NOMBRES AFFICHÉS — un seul endroit, et la langue décide du séparateur.
 *
 * ⚠️ TROIS COMPORTEMENTS COEXISTAIENT DANS LA MÊME INTERFACE, et deux étaient faux.
 * Constaté le 05/09/2026 sur le Trail Builder, à quelques pixels d'écart :
 *
 *     147.13 km          ← `toFixed(2)` brut : un POINT, alors qu'un francophone
 *                          écrit 147,13. C'est le format anglais.
 *     11,00 km/h         ← `toFixed(2).replace(".", ",")` : une virgule CODÉE EN DUR,
 *                          donc fausse pour un lecteur anglais, à qui elle se lit
 *                          comme un séparateur de milliers.
 *
 * Le troisième, correct, n'existait que pour les prix et les dates : `toLocaleString`
 * avec la langue. C'est celui qu'on généralise.
 *
 * ⚠️ ET `toFixed` N'ARRONDIT PAS QUE LE POINT : il rend une CHAÎNE. Une valeur non
 * finie y devient « NaN » ou « Infinity », qui s'affichent tels quels — le même piège
 * que dans `lib/running/fitness`. On rend donc un tiret quand le chiffre n'existe pas,
 * plutôt qu'un mot qui ressemble à une panne.
 */
import type { Lang } from "@/lib/i18n/translations";

/** Ce qu'on affiche quand la valeur n'est pas un nombre exploitable. */
export const SANS_VALEUR = "—";

/**
 * Convertit en nombre SANS transformer une absence en zéro.
 *
 * ⚠️ `Number(null)` VAUT 0, et `Number("")` aussi. Ma première version de ce module s'y
 * est fait prendre : une valeur absente s'affichait « 0,0 » — un chiffre inventé, qui
 * se lit comme une mesure. C'est exactement le défaut que ce module doit empêcher.
 */
function nombreOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Un nombre, écrit comme l'écrit la langue de l'athlète. */
export function fmtNombre(v: unknown, lang: Lang | string = "fr", decimales = 1): string {
  const n = nombreOuNull(v);
  if (n === null) return SANS_VALEUR;
  return n.toLocaleString(lang, { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/**
 * Une distance, avec son unité et le bon palier.
 *
 * Sous le kilomètre on passe aux mètres : « 0,42 km » se lit mal quand « 420 m » dit
 * la même chose sans effort.
 */
export function fmtKm(km: unknown, lang: Lang | string = "fr", decimales = 2): string {
  const n = nombreOuNull(km);
  if (n === null) return SANS_VALEUR;
  if (Math.abs(n) < 1) return `${Math.round(n * 1000)} m`;
  return `${fmtNombre(n, lang, decimales)} km`;
}

/** Un dénivelé, toujours en mètres entiers : le centimètre n'a pas de sens ici. */
export function fmtDenivele(m: unknown, lang: Lang | string = "fr"): string {
  const n = nombreOuNull(m);
  if (n === null) return SANS_VALEUR;
  return `${Math.round(n).toLocaleString(lang)} m`;
}
