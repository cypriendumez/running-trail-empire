// ─────────────────────────────────────────────────────────────────────────────
//  DÉTECTION AUTOMATIQUE DE SEGMENTS.
//
//  Strava fait créer les segments à la main. On peut faire mieux : un segment n'a
//  d'intérêt que s'il est PARCOURU PLUSIEURS FOIS — sinon son classement n'a qu'un
//  seul concurrent et son « maître » est celui qui y est passé une fois.
//
//  On ne propose donc que des portions RÉELLEMENT répétées dans l'historique. Un
//  segment inventé sur une sortie unique serait un objet vide portant un nom.
// ─────────────────────────────────────────────────────────────────────────────
import { haversine, trackLength, bboxOf, type TrackPoint } from "./geo";

export type Candidate = {
  start: { lat: number; lon: number };
  end: { lat: number; lon: number };
  distance_m: number;
  /** Nombre de traces DISTINCTES qui parcourent cette portion. */
  repeats: number;
  points: TrackPoint[];
};

/** Taille de maille de l'index spatial, en degrés (~55 m sous nos latitudes). */
const MAILLE = 0.0005;
const cell = (lat: number, lon: number) => `${Math.round(lat / MAILLE)}:${Math.round(lon / MAILLE)}`;

/**
 * Index des mailles visitées par une trace → indices des points.
 * Sans lui, compter les répétitions imposerait de comparer chaque candidat à chaque
 * point de chaque trace : des dizaines de millions de calculs géodésiques.
 */
function indexer(track: TrackPoint[]): Map<string, number[]> {
  const idx = new Map<string, number[]>();
  for (let i = 0; i < track.length; i++) {
    const k = cell(track[i].lat, track[i].lon);
    const arr = idx.get(k);
    if (arr) arr.push(i); else idx.set(k, [i]);
  }
  return idx;
}

/** Indices des points d'une trace proches d'une coordonnée (maille + 8 voisines). */
function nearIndices(idx: Map<string, number[]>, lat: number, lon: number): number[] {
  const cl = Math.round(lat / MAILLE), co = Math.round(lon / MAILLE);
  const out: number[] = [];
  for (let a = -1; a <= 1; a++) {
    for (let b = -1; b <= 1; b++) {
      const arr = idx.get(`${cl + a}:${co + b}`);
      if (arr) out.push(...arr);
    }
  }
  return out.sort((x, y) => x - y);
}

/** Cette trace parcourt-elle la portion (départ puis arrivée, dans cet ordre) ? */
function parcourt(
  track: TrackPoint[], idx: Map<string, number[]>,
  start: { lat: number; lon: number }, end: { lat: number; lon: number },
  distance_m: number, rayon: number, tolerance: number,
): boolean {
  const debuts = nearIndices(idx, start.lat, start.lon)
    .filter((i) => haversine(track[i].lat, track[i].lon, start.lat, start.lon) <= rayon);
  if (!debuts.length) return false;
  const fins = nearIndices(idx, end.lat, end.lon)
    .filter((i) => haversine(track[i].lat, track[i].lon, end.lat, end.lon) <= rayon);
  if (!fins.length) return false;

  for (const d of debuts) {
    const f = fins.find((x) => x > d);
    if (f === undefined) continue;
    // La distance réellement parcourue doit correspondre : sans ce contrôle, une
    // trace qui passe aux deux extrémités par des chemins différents compterait
    // comme une répétition, et le segment prétendrait mesurer ce qu'il ne mesure pas.
    const covered = trackLength(track.slice(d, f + 1));
    if (Math.abs(covered - distance_m) / distance_m <= tolerance) return true;
  }
  return false;
}

export type DetectOptions = {
  /** Longueur visée des segments, en mètres. */
  longueur?: number;
  /** Répétitions minimales pour qu'une portion mérite d'exister. */
  minRepeats?: number;
  /** Rayon des portiques, en mètres. */
  rayon?: number;
  tolerance?: number;
  /** Nombre maximal de segments retournés. */
  max?: number;
};

/**
 * Détecte les portions récurrentes d'un ensemble de traces.
 *
 * Les candidats sont découpés dans les traces les plus longues (elles couvrent le
 * plus de terrain), puis validés contre TOUTES les traces. On écarte enfin les
 * candidats qui se chevauchent : dix segments quasi identiques décalés de 100 m
 * rempliraient l'écran sans rien apprendre.
 */
export function detectSegments(traces: TrackPoint[][], opts: DetectOptions = {}): Candidate[] {
  const longueur = opts.longueur ?? 1000;
  const minRepeats = opts.minRepeats ?? 3;
  const rayon = opts.rayon ?? 30;
  const tolerance = opts.tolerance ?? 0.25;
  const max = opts.max ?? 12;

  const utiles = traces.filter((t) => t.length >= 10);
  if (utiles.length < minRepeats) return [];
  const index = utiles.map(indexer);

  // Candidats découpés dans les traces les plus riches, un départ tous les ~500 m.
  const sources = [...utiles].sort((a, b) => b.length - a.length).slice(0, 8);
  const candidats: Candidate[] = [];

  for (const src of sources) {
    let parcouru = 0, dernierDepart = -Infinity;
    for (let i = 1; i < src.length; i++) {
      parcouru += haversine(src[i - 1].lat, src[i - 1].lon, src[i].lat, src[i].lon);
      if (parcouru - dernierDepart < 500) continue;
      dernierDepart = parcouru;

      // Fin du candidat : point atteignant la longueur visée.
      let d = 0, j = i;
      while (j + 1 < src.length && d < longueur) {
        d += haversine(src[j].lat, src[j].lon, src[j + 1].lat, src[j + 1].lon);
        j++;
      }
      if (d < longueur * 0.9) break; // fin de trace : plus de candidat complet

      const start = { lat: src[i].lat, lon: src[i].lon };
      const end = { lat: src[j].lat, lon: src[j].lon };
      // Une portion qui revient sur elle-même n'est pas un segment : ses deux
      // portiques se confondent et le chrono se déclencherait n'importe quand.
      if (haversine(start.lat, start.lon, end.lat, end.lon) < 200) continue;

      let repeats = 0;
      for (let k = 0; k < utiles.length; k++) {
        if (parcourt(utiles[k], index[k], start, end, d, rayon, tolerance)) repeats++;
      }
      if (repeats >= minRepeats) {
        candidats.push({ start, end, distance_m: Math.round(d), repeats, points: src.slice(i, j + 1) });
      }
    }
  }

  // Les plus parcourus d'abord, puis on écarte les quasi-doublons.
  candidats.sort((a, b) => b.repeats - a.repeats || b.distance_m - a.distance_m);
  const retenus: Candidate[] = [];
  for (const c of candidats) {
    const proche = retenus.some((r) =>
      haversine(r.start.lat, r.start.lon, c.start.lat, c.start.lon) < 300
      && haversine(r.end.lat, r.end.lon, c.end.lat, c.end.lon) < 300);
    if (!proche) retenus.push(c);
    if (retenus.length >= max) break;
  }
  return retenus;
}

/** Zone englobante d'un candidat, pour le préfiltrage à l'appariement. */
export const candidateBBox = (c: Candidate) => bboxOf(c.points);
