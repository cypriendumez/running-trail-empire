// ─────────────────────────────────────────────────────────────────────────────
//  LES CHEVRONS DE DIRECTION — dans quel SENS la sortie a été courue.
//
//  Sur une boucle, un tracé sans flèches ne dit pas par où l'on est parti ni dans quel
//  sens on a tourné. Strava place de petits chevrons le long de la ligne ; c'est ce qui
//  transforme un trait en itinéraire.
//
//  Deux exigences que ce module existe pour tenir :
//  • les chevrons sont espacés le long de la DISTANCE PARCOURUE, pas tous les N points.
//    Un GPS échantillonne au temps : un athlète arrêté à un feu accumule des dizaines de
//    points au même endroit, et un chevron « tous les 40 points » s'y entasserait.
//  • le cap est calculé sur un SEGMENT ASSEZ LONG. Deux points consécutifs distants de
//    3 m portent surtout du bruit GPS : la flèche pointerait n'importe où.
// ─────────────────────────────────────────────────────────────────────────────
import { haversine } from "@/lib/segments/geo";

export type PointFleche = { lat: number; lon: number; cap: number };

/** Longueur minimale du segment servant à calculer un cap, en mètres. */
export const BASE_CAP_M = 25;

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Cap (0 = nord, 90 = est) du point `a` vers le point `b`, en degrés.
 * ⚠️ Le facteur cos(latitude) n'est pas optionnel : sans lui, un déplacement plein est
 * paraîtrait nord-est dès qu'on quitte l'équateur.
 */
export function cap(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLon = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const dLat = b.lat - a.lat;
  if (dLon === 0 && dLat === 0) return 0;
  const deg = (Math.atan2(dLon, dLat) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * `n` chevrons répartis le long du parcours, cap compris.
 *
 * Ni au tout début ni à la toute fin : les marqueurs de départ et d'arrivée y sont déjà,
 * et une flèche par-dessus les rendrait illisibles.
 */
export function flechesLeLongDe(points: readonly { lat: number; lon: number }[], n = 6): PointFleche[] {
  const pts = (points ?? []).filter((p) => p && fini(p.lat) && fini(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
  if (pts.length < 4 || !Number.isFinite(n) || n < 1) return [];

  const cumul: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
    cumul.push(cumul[i - 1] + (fini(d) && d > 0 ? d : 0));
  }
  const total = cumul[cumul.length - 1];
  // Un parcours qui ne va nulle part (tapis, GPS bloqué) n'a pas de direction à montrer.
  if (!(total > BASE_CAP_M * 2)) return [];

  const out: PointFleche[] = [];
  for (let k = 1; k <= n; k++) {
    const vise = (total * k) / (n + 1);
    let i = cumul.findIndex((d) => d >= vise);
    if (i < 1) i = 1;
    // On prend le point situé BASE_CAP_M plus loin pour calculer le cap : sur deux points
    // consécutifs, c'est le bruit du GPS qui déciderait de l'orientation.
    let j = i;
    while (j + 1 < pts.length && cumul[j] - cumul[i] < BASE_CAP_M) j++;
    if (j === i) { if (i > 1) i--; else continue; }
    out.push({ lat: pts[i].lat, lon: pts[i].lon, cap: cap(pts[i], pts[j]) });
  }
  return out;
}
