// Système d'unités choisi dans les Paramètres (métrique par défaut).
export type UnitSystem = "metric" | "imperial";

const round1 = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
};

// Convertit + formate une distance stockée en km selon le système choisi.
export function fmtDistance(km: number | null | undefined, system: UnitSystem = "metric"): string {
  if (km == null || isNaN(Number(km))) return "—";
  if (system === "imperial") return `${round1(Number(km) * 0.621371)} mi`;
  return `${round1(Number(km))} km`;
}

export function distanceUnit(system: UnitSystem = "metric"): string {
  return system === "imperial" ? "mi" : "km";
}
