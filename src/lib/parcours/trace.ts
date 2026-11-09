/**
 * LE TRACÉ EST-IL LE PARCOURS, OU UN MORCEAU ? — sorti de `ParcoursBrowser` (09/11/2026) pour être
 * éprouvé seuil par seuil (relecture : il n'était vérifié que par une lecture du code).
 *
 * Moins de 4 points, moins de 400 m, ou moins des trois quarts de la distance AFFICHÉE sur la carte
 * du parcours : ce n'est pas le parcours. Le catalogue est bâti sur la même chaîne principale que la
 * route `/api/parcours/geometry` : un tracé conforme passe, un fragment non.
 */

/** Longueur d'un tracé [lon, lat], en km (haversine). */
export function longueurKm(coords: readonly [number, number][]): number {
  const R = 6371; let d = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const dLat = ((b[1] - a[1]) * Math.PI) / 180, dLng = ((b[0] - a[0]) * Math.PI) / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    d += R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  return d;
}

/** Part minimale de la distance affichée qu'un tracé doit couvrir pour être montré comme le parcours. */
export const PART_MIN = 0.75;

export function tracePartiel(coords: readonly [number, number][], distanceAnnonceeKm: number): boolean {
  const km = longueurKm(coords);
  return coords.length < 4 || km < 0.4 || (distanceAnnonceeKm > 0 && km < distanceAnnonceeKm * PART_MIN);
}
