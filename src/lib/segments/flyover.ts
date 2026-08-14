// ─────────────────────────────────────────────────────────────────────────────
//  SURVOL — position de la caméra à un instant donné de la lecture.
//
//  Ce calcul vivait DANS la boucle d'animation du composant React, donc dans du code
//  qu'aucun test ne peut atteindre. Il a produit en production une erreur fatale :
//
//      Uncaught TypeError: Cannot read properties of undefined (reading 'lat')
//
//  Le seul chemin qui produit exactement cette erreur est un index NON FINI :
//  `Math.floor(NaN)` vaut NaN, `Math.min(n, NaN)` vaut NaN, et `points[NaN]` vaut
//  `undefined`. Et le NaN s'auto-entretient — il repart dans l'avancement, qui redate
//  le départ de la lecture, si bien que TOUTES les images suivantes plantent : le
//  survol est mort jusqu'au rechargement de la page.
//
//  On ne connaît pas la cause première du premier NaN, et on ne fait pas semblant :
//  ce module garantit seulement qu'elle ne peut plus être fatale. Il renvoie `null`
//  plutôt que de lever, et le lecteur s'arrête proprement.
// ─────────────────────────────────────────────────────────────────────────────

export type TracePoint = { lat: number; lon: number };

export type FlyoverPose = {
  lat: number;
  lon: number;
  /** Cap BRUT vers l'avant, en degrés. Le lissage reste à l'appelant : il dépend du
   *  cap précédent, donc d'un état d'animation qui n'a pas sa place ici. */
  capDeg: number;
  /** Index du point de départ du segment courant — utile pour lire l'altitude ou
   *  l'allure du moment dans les tableaux parallèles. */
  index: number;
};

/** Combien de points en avant on regarde pour calculer le cap. Trop court, la caméra
 *  tremble à chaque zigzag du GPS ; trop long, elle anticipe les virages. */
const REGARD_AVANT = 4;

/**
 * Position interpolée ENTRE deux points de la trace, à l'avancement `p` (0 → 1).
 *
 * Interpoler plutôt que se caler sur le point le plus proche : sinon la caméra fige
 * puis se téléporte, ce qui se lit comme une saccade alors que la trace est régulière.
 *
 * Renvoie `null` — jamais d'exception — si `p` n'est pas fini ou si la trace ne permet
 * pas de calculer une position (moins de deux points).
 */
export function poseAt(points: TracePoint[], p: number): FlyoverPose | null {
  if (!Array.isArray(points) || points.length < 2) return null;
  if (!Number.isFinite(p)) return null;

  const avance = Math.min(1, Math.max(0, p));
  const brut = avance * (points.length - 1);
  // Bornage des DEUX côtés. `Math.min` seul laissait passer un index négatif sur une
  // trace d'un seul point (`length - 2` vaut alors −1) — l'autre porte d'entrée du
  // même plantage.
  // Bornage des deux côtés. Ceinture ET bretelles assumées : c'est le contrôle de
  // longueur ci-dessus qui empêche réellement l'index négatif (sur un point unique,
  // `length - 2` vaut −1). Muter ce `Math.max` ne fait rougir aucun test — on le garde
  // parce qu'il rend l'invariant LOCAL au lieu de dépendre d'une garde située quatre
  // lignes plus haut, pas parce qu'il corrige un défaut connu.
  const i = Math.max(0, Math.min(points.length - 2, Math.floor(brut)));
  const a = points[i], b = points[i + 1];
  if (!a || !b) return null;
  if (![a.lat, a.lon, b.lat, b.lon].every(Number.isFinite)) return null;

  const f = brut - i;
  const loin = points[Math.min(points.length - 1, i + REGARD_AVANT)] ?? b;
  return {
    lat: a.lat + (b.lat - a.lat) * f,
    lon: a.lon + (b.lon - a.lon) * f,
    capDeg: (Math.atan2(loin.lon - a.lon, loin.lat - a.lat) * 180) / Math.PI,
    index: i,
  };
}

/**
 * Nouveau cap après lissage, par le PLUS COURT chemin angulaire.
 *
 * Sans ça, un virage qui franchit 0°/360° fait pivoter la caméra d'un tour complet :
 * de 350° à 10°, la différence brute vaut −340° au lieu de +20°.
 */
export function capLisse(capActuel: number, capVise: number, force = 0.06): number {
  if (!Number.isFinite(capVise)) return capActuel;
  if (!Number.isFinite(capActuel)) return capVise;
  const ecart = ((capVise - capActuel + 540) % 360) - 180;
  return capActuel + ecart * force;
}
