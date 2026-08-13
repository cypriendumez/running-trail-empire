// ─────────────────────────────────────────────────────────────────────────────
//  APPARIEMENT DES SEGMENTS ET CLASSEMENTS.
//
//  Le risque de cette brique n'est pas le plantage : c'est le chrono attribué à
//  tort. Décerner un record sur un segment que l'athlète n'a pas vraiment couru est
//  pire que ne rien décerner du tout — c'est un mensonge affiché en public, dans un
//  classement où d'autres se comparent. Chaque garde-fou ci-dessous existe pour ça.
// ─────────────────────────────────────────────────────────────────────────────
import { haversine, nearestPoint, trackLength, type TrackPoint } from "./geo";

export type SegmentDef = {
  id: string;
  distance_m: number;
  start_lat: number; start_lon: number;
  end_lat: number; end_lon: number;
};

export type Effort = {
  segment_id: string;
  elapsed_seconds: number;
  startIndex: number;
  endIndex: number;
  /** Distance réellement parcourue entre l'entrée et la sortie. */
  covered_m: number;
};

/**
 * Rayon du « portique » d'entrée et de sortie, en mètres.
 *
 * 25 m est un compromis mesuré : en deçà, le bruit GPS urbain (façades, tunnels)
 * fait manquer des passages pourtant réels ; au-delà, deux rues parallèles
 * deviennent le même segment.
 */
export const PORTIQUE_M = 25;

/**
 * Écart maximal toléré entre la distance du segment et celle réellement parcourue.
 *
 * C'est LE garde-fou contre le faux positif : sans lui, un athlète qui passe près du
 * départ, part ailleurs, puis revient près de l'arrivée se verrait attribuer un
 * chrono, généralement catastrophique — ou pire, excellent s'il a coupé.
 */
export const TOLERANCE_DISTANCE = 0.25;

/**
 * Tous les passages d'une trace sur un segment (une séance peut le parcourir
 * plusieurs fois : boucle, fractionné en côte).
 */
export function findEfforts(track: TrackPoint[], segment: SegmentDef): Effort[] {
  if (track.length < 2 || segment.distance_m <= 0) return [];
  const efforts: Effort[] = [];
  let cursor = 0;

  while (cursor < track.length - 1) {
    // Entrée : passage du portique de départ, à partir du curseur.
    const entry = gateIndex(track, segment.start_lat, segment.start_lon, cursor);
    if (entry < 0) break;

    // Sortie : portique d'arrivée APRÈS l'entrée. Chercher depuis le début
    // produirait un chrono négatif sur une boucle repassant au même endroit.
    const exit = gateIndex(track, segment.end_lat, segment.end_lon, entry + 1);
    if (exit < 0) break;

    const portion = track.slice(entry, exit + 1);
    const covered = trackLength(portion);
    const elapsed = portion[portion.length - 1].t - portion[0].t;
    const ecart = Math.abs(covered - segment.distance_m) / segment.distance_m;

    // On n'enregistre QUE si l'itinéraire correspond vraiment et que le temps est
    // exploitable. Un chrono nul ou négatif signale une trace sans horodatage
    // fiable : mieux vaut aucun effort qu'un effort inventé.
    if (ecart <= TOLERANCE_DISTANCE && elapsed > 0) {
      efforts.push({
        segment_id: segment.id, elapsed_seconds: Math.round(elapsed),
        startIndex: entry, endIndex: exit, covered_m: Math.round(covered),
      });
    }
    cursor = exit + 1;
  }
  return efforts;
}

/**
 * Indice du passage de portique, ou -1.
 *
 * ⚠️ ON NE PREND PAS LE PREMIER POINT DANS LE RAYON, et c'est tout le sujet. Avec un
 * portique de 25 m et une trace à 1 Hz, le premier point entrant dans le cercle peut
 * se trouver 25 m avant le vrai repère : le chrono s'arrêtait donc systématiquement
 * trop tôt, de plusieurs secondes. Sur un classement au dixième, ce biais décide du
 * vainqueur. On repère l'entrée dans le cercle, puis on retient le point RÉELLEMENT
 * le plus proche du repère parmi ceux qui s'y suivent.
 */
function gateIndex(track: TrackPoint[], lat: number, lon: number, from: number): number {
  let i = Math.max(0, from);
  while (i < track.length && haversine(track[i].lat, track[i].lon, lat, lon) > PORTIQUE_M) i++;
  if (i >= track.length) return -1;

  let best = i, bestD = haversine(track[i].lat, track[i].lon, lat, lon);
  // On ne balaie QUE la traversée en cours : sortir du cercle clôt le passage,
  // sinon un second tour de boucle viendrait déplacer le point d'un premier tour.
  for (let j = i + 1; j < track.length; j++) {
    const d = haversine(track[j].lat, track[j].lon, lat, lon);
    if (d > PORTIQUE_M) break;
    if (d < bestD) { bestD = d; best = j; }
  }
  return best;
}

/** Le segment est-il seulement plausible sur cette trace ? (préfiltre bon marché) */
export function passesNear(track: TrackPoint[], segment: SegmentDef): boolean {
  return nearestPoint(track, segment.start_lat, segment.start_lon).distance <= PORTIQUE_M;
}

// ── Classements ──────────────────────────────────────────────────────────────

export type StoredEffort = { user_id: string; elapsed_seconds: number; started_at: string };

/**
 * Classement : le MEILLEUR temps de chaque athlète, pas tous ses passages.
 * Sans ce dédoublonnage, celui qui court le segment tous les jours occuperait les
 * dix premières places et le classement ne dirait plus rien.
 */
export function leaderboard(efforts: StoredEffort[]): StoredEffort[] {
  const best = new Map<string, StoredEffort>();
  for (const e of efforts) {
    const prev = best.get(e.user_id);
    if (!prev || e.elapsed_seconds < prev.elapsed_seconds) best.set(e.user_id, e);
  }
  return [...best.values()].sort((a, b) => a.elapsed_seconds - b.elapsed_seconds);
}

export const FENETRE_MAITRE_JOURS = 90;

/**
 * LE MAÎTRE DU SEGMENT — l'équivalent Pacevo du « Local Legend » de Strava.
 *
 * Il récompense la RÉGULARITÉ et non la vitesse : c'est celui qui a parcouru le
 * segment le plus souvent sur les 90 derniers jours. Un titre que le coureur du
 * dimanche peut prendre au coureur élite, ce qui est précisément l'intérêt.
 *
 * En cas d'égalité on renvoie TOUS les ex æquo. Départager par un critère inventé
 * (le plus rapide, le plus récent) désignerait un vainqueur que les données ne
 * désignent pas — exactement le genre d'invention que ce projet refuse.
 */
export function maitreDuSegment(
  efforts: StoredEffort[], now: Date = new Date(), fenetreJours = FENETRE_MAITRE_JOURS,
): { userIds: string[]; count: number; since: string } | null {
  const depuis = now.getTime() - fenetreJours * 86_400_000;
  const comptes = new Map<string, number>();
  for (const e of efforts) {
    const t = Date.parse(e.started_at);
    if (!Number.isFinite(t) || t < depuis || t > now.getTime()) continue;
    comptes.set(e.user_id, (comptes.get(e.user_id) ?? 0) + 1);
  }
  if (!comptes.size) return null;

  const max = Math.max(...comptes.values());
  // Un seul passage ne fait pas un maître : ce serait décerner un titre de
  // régularité à quelqu'un qui est passé une fois par hasard.
  if (max < 2) return null;

  return {
    userIds: [...comptes.entries()].filter(([, n]) => n === max).map(([id]) => id),
    count: max,
    since: new Date(depuis).toISOString().slice(0, 10),
  };
}
