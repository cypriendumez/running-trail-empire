// Système d'unités choisi dans les Paramètres (métrique par défaut).
export type UnitSystem = "metric" | "imperial";

/**
 * ⚠️ LA VIRGULE ÉTAIT CODÉE EN DUR, y compris pour les miles. Un athlète anglophone
 * qui choisit le système impérial lisait « 3,1 mi » — un format français collé à une
 * unité anglo-saxonne. Le séparateur suit maintenant la langue, comme partout ailleurs
 * (voir `lib/i18n/nombres`).
 */
const round1 = (n: number, lang: string) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? r.toLocaleString(lang) : r.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

// Convertit + formate une distance stockée en km selon le système choisi.
export function fmtDistance(km: number | null | undefined, system: UnitSystem = "metric", lang: string = "fr"): string {
  if (km == null || isNaN(Number(km))) return "—";
  if (system === "imperial") return `${round1(Number(km) * 0.621371, lang)} mi`;
  return `${round1(Number(km), lang)} km`;
}

export function distanceUnit(system: UnitSystem = "metric"): string {
  return system === "imperial" ? "mi" : "km";
}
