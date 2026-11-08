/**
 * LE MODÈLE DE PERFORMANCE — Daniels & Gilbert (VDOT), le standard international (02/10/2026).
 *
 * ⚠️ CE QU'IL REMPLACE, ET POURQUOI. Les prédictions et la VMA « séances » passaient par un
 * barème en MARCHES D'ESCALIER (% de VMA tenable : 0,90 jusqu'à 11 km, 0,83 jusqu'à 22 km,
 * 0,79 jusqu'à 30 km…). Relevé sur le compte de Cyprien le 02/10/2026 :
 *   · 23,7 km à 3'45/km (29/09, 27 °C) divisés par 0,79 au lieu de ~0,82 → VMA 21,4 km/h.
 *     Le même effort sur 21,9 km aurait donné 20,3 : 5 % de VMA pour 1,8 km de plus ;
 *   · 10,9 km → 0,90, mais 11,5 km → 0,83 : un saut de 8 % ;
 *   · la pente du barème (5 km à 94 %, semi à 83 %) annonçait 14'55 sur 5 km et 1h11 sur
 *     semi pour un athlète dont le record est 1h15 — des chronos qu'il n'a jamais approchés.
 *
 * LE MODÈLE. Jack Daniels & Jimmy Gilbert (« Oxygen Power », 1979), base des tables VDOT
 * utilisées par les entraîneurs du monde entier :
 *   · coût en oxygène d'une vitesse v (m/min) : VO₂ = −4,60 + 0,182258·v + 0,000104·v² ;
 *   · fraction de VO₂max tenable pendant t minutes :
 *       0,8 + 0,1894393·e^(−0,012778·t) + 0,2989558·e^(−0,1932605·t) ;
 *   · VDOT = VO₂ / fraction. Deux performances de même VDOT sont ÉQUIVALENTES — c'est ce
 *     qui permet de passer d'une distance à l'autre sans barème arbitraire.
 *
 * LA VMA DANS CE MODÈLE. La VMA de l'application est la vitesse tenue pendant SIX MINUTES
 * à fond — c'est littéralement son test (`vmaFrom6min` : distance en 6 min / 100). Une VMA
 * est donc une performance comme une autre : 6 minutes à cette vitesse. Elle se convertit
 * en VDOT, et réciproquement, sans constante ajoutée.
 *
 * Fonctions pures, sans dépendance.
 */

/** Durée de l'effort qui DÉFINIT la VMA dans l'application (le test de 6 minutes). */
export const DUREE_VMA_MIN = 6;

/** Coût en oxygène (ml/kg/min) d'une course à `vMin` mètres par minute. */
export function coutOxygene(vMin: number): number {
  return -4.6 + 0.182258 * vMin + 0.000104 * vMin * vMin;
}

/** Fraction de la VO₂max que l'on tient pendant `tMin` minutes d'effort maximal. */
export function fractionTenable(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
}

/**
 * VDOT d'une performance. `null` hors du domaine où le modèle a un sens : vitesses
 * aberrantes (< 5 ou > 30 km/h), efforts de moins de 3 minutes (le modèle part du 1 500 m)
 * ou de plus de 6 heures.
 */
export function vdotDe(distanceKm: number, durationSec: number): number | null {
  if (!(distanceKm > 0) || !(durationSec > 0) || !Number.isFinite(distanceKm) || !Number.isFinite(durationSec)) return null;
  const kmh = distanceKm / (durationSec / 3600);
  if (kmh < 5 || kmh > 30) return null;
  const tMin = durationSec / 60;
  if (tMin < 3 || tMin > 360) return null;
  return coutOxygene((distanceKm * 1000) / tMin) / fractionTenable(tMin);
}

/** Temps (s) qu'un coureur de ce VDOT met sur cette distance. 0 si rien n'est calculable. */
export function tempsPourVdot(vdot: number, distanceKm: number): number {
  if (!(vdot > 0) || !(distanceKm > 0) || !Number.isFinite(vdot) || !Number.isFinite(distanceKm)) return 0;
  // Le VDOT d'une distance fixée DÉCROÎT quand le temps augmente : une dichotomie suffit.
  // Bornes : 30 km/h (plus rapide que tout humain) et 5 km/h (de la marche).
  let lo = (distanceKm / 30) * 3600, hi = (distanceKm / 5) * 3600;
  const v = (t: number) => {
    const tMin = t / 60;
    return coutOxygene((distanceKm * 1000) / tMin) / fractionTenable(tMin);
  };
  if (v(lo) < vdot || v(hi) > vdot) return 0;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (v(mid) > vdot) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** VDOT d'une VMA : six minutes courues à cette vitesse. */
export function vdotDeVma(vmaKmh: number): number | null {
  if (!(vmaKmh > 0) || !Number.isFinite(vmaKmh)) return null;
  return vdotDe((vmaKmh * DUREE_VMA_MIN) / 60, DUREE_VMA_MIN * 60);
}

/** VMA (km/h) d'un VDOT : la vitesse que ce VDOT tient six minutes. */
export function vmaDeVdot(vdot: number): number | null {
  if (!(vdot > 0) || !Number.isFinite(vdot)) return null;
  // coutOxygene(v) = vdot × fraction(6 min) — un trinôme en v, racine positive.
  const cible = vdot * fractionTenable(DUREE_VMA_MIN);
  const a = 0.000104, b = 0.182258, c = -4.6 - cible;
  const disc = b * b - 4 * a * c;
  if (!(disc > 0)) return null;
  const vMin = (-b + Math.sqrt(disc)) / (2 * a);
  return (vMin * 60) / 1000;
}

// ── LE SOCLE D'ENDURANCE : ce que le VDOT ne voit pas ──────────────────────────
//
// Les équivalences de Daniels supposent un coureur PRÉPARÉ pour la distance. C'est vrai
// jusqu'au semi ; au-delà, un athlète à 60 km/semaine dont la plus longue sortie fait
// 21 km ne tient pas sur marathon ce que son 10 km promet — Vickers & Vertosick (2016,
// 2 303 coureurs) l'ont mesuré : l'écart grandit quand le volume baisse. Les mêmes deux
// ancres de sortie longue que le reste de l'application (21 et 32 km), et une ancre de
// volume : 40 km/semaine (on ne prépare pas un marathon en dessous) à 100 (préparation
// complète d'un coureur de ce niveau).

export const SL_PLANCHER_KM = 21;
export const SL_PRET_KM = 32;
export const VOLUME_PLANCHER_KM = 40;
export const VOLUME_PRET_KM = 100;
/** Ralentissement maximal sur marathon pour un athlète sans socle (≈ l'écart mesuré). */
export const PENALITE_SOCLE_MARATHON = 0.06;

export type Socle = { sortieLongueKm?: number | null; volumeHebdoKm?: number | null };

const borne = (x: number) => Math.min(1, Math.max(0, x));

/** Préparation au long, de 0 (aucun socle connu ou prouvé) à 1 (socle complet). */
export function preparationLongue(socle: Socle | null | undefined): number {
  const parts: number[] = [];
  const sl = socle?.sortieLongueKm, vol = socle?.volumeHebdoKm;
  if (sl != null && sl > 0) parts.push(borne((sl - SL_PLANCHER_KM) / (SL_PRET_KM - SL_PLANCHER_KM)));
  if (vol != null && vol > 0) parts.push(borne((vol - VOLUME_PLANCHER_KM) / (VOLUME_PRET_KM - VOLUME_PLANCHER_KM)));
  // Rien de connu : on ne suppose RIEN de favorable — la prédiction prudente.
  // Le maillon faible décide : 120 km/semaine ne remplacent pas une sortie de 30 km.
  return parts.length ? Math.min(...parts) : 0;
}

/** Facteur (≥ 1) appliqué au temps prédit au-delà du semi, selon le socle. */
export function facteurSocle(distanceKm: number, socle: Socle | null | undefined): number {
  const SEMI = 21.0975, MARATHON = 42.195;
  if (!(distanceKm > SEMI)) return 1;
  const part = Math.min(1, (distanceKm - SEMI) / (MARATHON - SEMI));
  return 1 + PENALITE_SOCLE_MARATHON * part * (1 - preparationLongue(socle));
}
