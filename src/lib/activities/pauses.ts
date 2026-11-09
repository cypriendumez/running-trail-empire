// ─────────────────────────────────────────────────────────────────────────────
//  LES PAUSES D'UNE SÉANCE — relues sur la trace GPS déjà enregistrée.
//
//  La base ne garde que le temps EN MOUVEMENT (`duration_seconds` = `moving_time`
//  d'intervals.icu) : l'allure et la charge sont justes, mais le coach ne savait pas
//  que l'athlète s'était arrêté. Cyprien (09/11/2026) : « il doit prendre en compte les
//  pauses, sur ma montre, c'est très important ». Sa séance du soir : 42 min 07 en
//  mouvement, 52 min 28 du départ à l'arrivée, soit sept arrêts dont un de 5 min.
//
//  ⚠️ POURQUOI PAS LE SEUIL DES TEMPS INTERMÉDIAIRES (`computeSplits`, 0,5 m/s sur un
//  intervalle) : la trace est ALLÉGÉE à l'import (un point tous les 10 m au moins). Après
//  un arrêt, le point suivant est souvent à 30 ou 50 m : l'intervalle mêle l'arrêt et la
//  course qui le suit, et sa vitesse moyenne (0,6-0,7 m/s) dépasse le seuil. Sur la
//  séance ci-dessus, ce seuil ne voyait que 2 arrêts sur 7. On retranche donc la part
//  COURUE de l'intervalle (sa distance à la vitesse de la séance) : ce qui reste est
//  l'arrêt.
//
//  ⚠️ UNE MONTÉE EN MARCHANT N'EST PAS UN ARRÊT. En côte raide, 10 m à plat peuvent
//  prendre 25 s : comparée à la vitesse MOYENNE de la séance, cette marche passerait pour
//  une pause. La part courue se calcule donc à la vitesse des points VOISINS (la plus lente
//  des médianes des six intervalles avant et des six après) : en montée marchée, les
//  voisins sont lents aussi et rien n'est retenu. L'altitude ne sert pas de juge : relevée par GPS, elle saute de
//  plusieurs mètres à la reprise (testé : deux vrais arrêts sur sept écartés à tort).
//  Dans le doute, on se tait : un arrêt manqué vaut mieux qu'un arrêt inventé.
// ─────────────────────────────────────────────────────────────────────────────
import { haversine, type TrackPoint } from "@/lib/segments/geo";

/** En dessous, un intervalle entre deux points n'est pas examiné : courir 10 m prend 2 à 8 s. */
export const INTERVALLE_MIN_SEC = 20;
/** Temps à l'arrêt en dessous duquel on ne parle pas de pause (un feu, un lacet : rien à dire). */
export const PAUSE_MIN_SEC = 15;
/** Intervalles voisins, de chaque côté, qui donnent la vitesse du moment. */
export const VOISINS = 6;

export type Pause = {
  /** Secondes depuis le départ, au début de l'arrêt (approché à l'intervalle près). */
  debutSec: number;
  dureeSec: number;
  /** Distance parcourue avant l'arrêt, en km. */
  km: number;
};

export type PausesSeance = {
  liste: Pause[];
  /** Somme des arrêts détectés. */
  totalSec: number;
  /** Du premier au dernier point de la trace, arrêts compris. */
  ecouleSec: number;
  plusLongueSec: number;
};

/**
 * Les arrêts d'une séance, depuis sa trace.
 *
 * `vitesseMouvement` : la vitesse de la séance en mouvement, en m/s (distance ÷ temps en
 * mouvement, tous deux en base), repli quand les voisins manquent. Sans elle, ou sans trace
 * horodatée, on renvoie `null` :
 * « je ne sais pas » n'est pas « aucun arrêt ».
 */
export function pausesDeTrace(points: readonly TrackPoint[], vitesseMouvement: number | null): PausesSeance | null {
  if (points.length < 10) return null;
  if (vitesseMouvement == null || !Number.isFinite(vitesseMouvement) || vitesseMouvement <= 0) return null;
  const t0 = points[0].t, tFin = points[points.length - 1].t;
  if (!Number.isFinite(t0) || !Number.isFinite(tFin) || tFin <= t0) return null;

  const d: number[] = [], dt: number[] = [];
  for (let i = 1; i < points.length; i++) {
    d.push(haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon));
    dt.push(points[i].t - points[i - 1].t);
  }
  const mediane = (v: number[]): number | null => {
    if (!v.length) return null;
    const s = [...v].sort((x, y) => x - y);
    const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    return m > 0 ? m : null;
  };
  // La vitesse du moment : la PLUS LENTE des deux médianes, avant et après le trou. Une seule
  // médiane mêlait, au passage de la course à une montée marchée, des voisins à 3 m/s et
  // d'autres à 0,4 m/s : la marche devenait un arrêt de 19 s (trouvé par tests/pauses).
  const vitesseVoisine = (i: number): number => {
    const avant: number[] = [], apres: number[] = [];
    for (let j = Math.max(0, i - VOISINS); j < i; j++) if (dt[j] > 0) avant.push(d[j] / dt[j]);
    for (let j = i + 1; j <= Math.min(d.length - 1, i + VOISINS); j++) if (dt[j] > 0) apres.push(d[j] / dt[j]);
    const cotes = [mediane(avant), mediane(apres)].filter((x): x is number => x != null);
    return cotes.length ? Math.min(...cotes) : vitesseMouvement;
  };

  const liste: Pause[] = [];
  let cumulM = 0;
  for (let i = 0; i < d.length; i++) {
    const kmAvant = cumulM / 1000;
    cumulM += d[i];
    if (!(dt[i] >= INTERVALLE_MIN_SEC)) continue;
    const arret = Math.round(dt[i] - d[i] / vitesseVoisine(i));
    if (arret < PAUSE_MIN_SEC) continue;
    liste.push({ debutSec: Math.round(points[i].t - t0), dureeSec: arret, km: Math.round(kmAvant * 100) / 100 });
  }
  const totalSec = liste.reduce((s, p) => s + p.dureeSec, 0);
  return {
    liste,
    totalSec,
    ecouleSec: Math.round(tFin - t0),
    plusLongueSec: liste.reduce((m, p) => Math.max(m, p.dureeSec), 0),
  };
}

/** Points tels que stockés dans `activity_tracks.points` : 0 lat, 1 lon, 2 temps, 3 altitude. */
export function pointsStockes(bruts: unknown): TrackPoint[] {
  if (!Array.isArray(bruts)) return [];
  const out: TrackPoint[] = [];
  for (const p of bruts) {
    if (!Array.isArray(p)) continue;
    const [lat, lon, t, alt] = p as unknown[];
    if (typeof lat !== "number" || typeof lon !== "number" || typeof t !== "number") continue;
    out.push({ lat, lon, t, ...(typeof alt === "number" ? { alt } : {}) });
  }
  return out;
}

/** Vitesse en mouvement (m/s) depuis les colonnes de la séance ; `null` si l'une manque. */
export function vitesseEnMouvement(distanceKm: unknown, dureeSec: unknown): number | null {
  const km = Number(distanceKm), s = Number(dureeSec);
  return Number.isFinite(km) && Number.isFinite(s) && km > 0 && s > 0 ? (km * 1000) / s : null;
}

/** « 5 min 08 », « 53 s » : une durée d'arrêt lisible, sans dépendre de la langue. */
export function dureeCourte(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min ${String(r).padStart(2, "0")}`;
}
