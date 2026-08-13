// ─────────────────────────────────────────────────────────────────────────────
//  GÉOMÉTRIE DES TRACES — fonctions pures, sans réseau ni base.
//
//  Tout l'appariement de segments repose là-dessus. Une erreur ici ne plante pas :
//  elle attribue un chrono à la mauvaise portion, ou décerne un record sur un
//  segment que l'athlète n'a jamais couru. C'est pourquoi chaque fonction est
//  testée sur des distances réelles connues.
// ─────────────────────────────────────────────────────────────────────────────

/** Un point de trace : latitude, longitude, et secondes écoulées depuis le départ. */
export type TrackPoint = { lat: number; lon: number; t: number };

const R_TERRE = 6_371_000; // rayon moyen, en mètres
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Distance entre deux points, en mètres (formule de haversine).
 *
 * On ne se contente PAS d'une approximation plane : sur un trail de montagne, une
 * erreur de quelques mètres suffit à faire manquer le portique d'entrée d'un segment,
 * donc à perdre un effort qui a bien eu lieu.
 */
export function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TERRE * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Longueur cumulée d'une trace, en mètres. */
export function trackLength(points: TrackPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }
  return d;
}

export type BBox = { minLat: number; maxLat: number; minLon: number; maxLon: number };

export function bboxOf(points: { lat: number; lon: number }[]): BBox | null {
  if (!points.length) return null;
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Les deux zones se recouvrent-elles, à `marginM` mètres près ?
 *
 * C'est le PRÉFILTRE qui rend l'appariement praticable : sans lui, chercher les
 * segments d'une séance imposerait de comparer sa trace à tous les segments de la
 * base, point par point. Avec lui, on écarte 99 % des candidats par deux comparaisons.
 */
export function bboxOverlap(a: BBox, b: BBox, marginM = 100): boolean {
  const dLat = marginM / 111_320;
  // Un degré de longitude rétrécit vers les pôles : utiliser la même marge qu'en
  // latitude sous-estimerait la zone à Tromsø et la surestimerait à l'équateur.
  const latMoy = (a.minLat + a.maxLat) / 2;
  const dLon = marginM / (111_320 * Math.max(0.05, Math.cos(rad(latMoy))));
  return !(a.maxLat + dLat < b.minLat || a.minLat - dLat > b.maxLat
        || a.maxLon + dLon < b.minLon || a.minLon - dLon > b.maxLon);
}

/**
 * Sous-échantillonne une trace en gardant sa forme (Ramer-Douglas-Peucker simplifié
 * par distance minimale entre points conservés).
 *
 * POURQUOI. Une sortie d'une heure enregistrée à 1 Hz fait 3 600 points. Les stocker
 * bruts pour 314 séances gonfle la base sans rien apporter : au-delà d'un point tous
 * les ~10 m, la précision supplémentaire ne change aucun appariement.
 */
export function simplify(points: TrackPoint[], minGapM = 10): TrackPoint[] {
  if (points.length <= 2) return [...points];
  const out: TrackPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const last = out[out.length - 1];
    if (haversine(last.lat, last.lon, points[i].lat, points[i].lon) >= minGapM) out.push(points[i]);
  }
  out.push(points[points.length - 1]); // le dernier point est TOUJOURS conservé
  return out;
}

// ── Encodage polyline (format Google) ───────────────────────────────────────
// Format compact et universellement lu par les bibliothèques de carte : une trace
// de 1 000 points tient en ~5 ko de texte au lieu de ~40 ko de JSON.

function encodeSigned(v: number): string {
  let x = v < 0 ? ~(v << 1) : v << 1;
  let out = "";
  while (x >= 0x20) {
    out += String.fromCharCode((0x20 | (x & 0x1f)) + 63);
    x >>= 5;
  }
  return out + String.fromCharCode(x + 63);
}

export function encodePolyline(points: { lat: number; lon: number }[]): string {
  let lastLat = 0, lastLon = 0, out = "";
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lon = Math.round(p.lon * 1e5);
    out += encodeSigned(lat - lastLat) + encodeSigned(lon - lastLon);
    lastLat = lat; lastLon = lon;
  }
  return out;
}

export function decodePolyline(encoded: string): { lat: number; lon: number }[] {
  const pts: { lat: number; lon: number }[] = [];
  let i = 0, lat = 0, lon = 0;
  while (i < encoded.length) {
    for (const axe of [0, 1]) {
      let shift = 0, result = 0, byte: number;
      do {
        byte = encoded.charCodeAt(i++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axe === 0) lat += delta; else lon += delta;
    }
    pts.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return pts;
}

/**
 * Indice du point de la trace le plus proche d'une coordonnée, et sa distance.
 * `fromIndex` permet de chercher la SORTIE d'un segment après son entrée — sans
 * quoi une boucle passant deux fois au même endroit produirait un chrono négatif.
 */
export function nearestPoint(
  points: TrackPoint[], lat: number, lon: number, fromIndex = 0,
): { index: number; distance: number } {
  let best = -1, bestD = Infinity;
  for (let i = Math.max(0, fromIndex); i < points.length; i++) {
    const d = haversine(points[i].lat, points[i].lon, lat, lon);
    if (d < bestD) { bestD = d; best = i; }
  }
  return { index: best, distance: bestD };
}
