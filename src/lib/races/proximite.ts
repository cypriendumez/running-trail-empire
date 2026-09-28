/**
 * « AUTOUR DE MOI » — les courses à portée de chez soi.
 *
 * Demandé par Cyprien le 28/09/2026 : un catalogue de 17 500 courses se parcourait par
 * RÉGION, alors que la question d'un coureur est « qu'est-ce qu'il y a à moins d'une heure
 * de route ? ». Une région ne répond pas : Lille est à 20 km de la Belgique et à 250 km de
 * l'autre bout des Hauts-de-France.
 *
 * ⚠️ LA POSITION NE QUITTE PAS LE NAVIGATEUR. Tout le catalogue est déjà chargé côté client
 * avec ses coordonnées : la distance se calcule ici, aucune requête n'emporte la position
 * de l'athlète. Une donnée qu'on n'envoie pas est une donnée qu'on ne peut pas perdre.
 */

export type Point = { lat: number; lon: number };

/** D'où vient le centre : le GPS du téléphone, ou le départ de sa dernière sortie. */
export type SourcePosition = "gps" | "entrainement";

export type Proximite = { centre: Point; source: SourcePosition; rayonKm: number };

/** Les rayons proposés : du tour du quartier au week-end de course. */
export const RAYONS_KM = [10, 25, 50, 100, 200] as const;
export const RAYON_DEFAUT_KM = 50;

const RAYON_TERRE_KM = 6371;

/** Distance à vol d'oiseau (haversine). Précise à mieux de 0,5 % à ces échelles. */
export function distanceKm(a: Point, b: Point): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Une paire de coordonnées exploitable — ni vide, ni hors de la Terre, ni (0, 0). */
export function pointValide(lat: unknown, lon: unknown): Point | null {
  // ⚠️ `Number(null)` VAUT 0 : une latitude absente passait pour l'équateur (vu par le test).
  const vide = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");
  if (vide(lat) || vide(lon)) return null;
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  // (0, 0) est le golfe de Guinée : c'est la valeur par défaut d'un champ jamais rempli.
  if (la === 0 && lo === 0) return null;
  return { lat: la, lon: lo };
}

/**
 * Distance d'une course au centre, ou `null` si la course n'a pas de coordonnées.
 *
 * ⚠️ UNE COURSE SANS COORDONNÉES N'EST PAS « PROCHE ». On ne sait pas où elle est : la
 * laisser dans un filtre « à moins de 25 km » serait affirmer ce qu'on ignore.
 */
export function distanceDeCourse(r: { latitude?: number | null; longitude?: number | null }, centre: Point): number | null {
  const p = pointValide(r.latitude, r.longitude);
  return p ? distanceKm(centre, p) : null;
}

/** La course est-elle dans le rayon ? */
export function dansLeRayon(r: { latitude?: number | null; longitude?: number | null }, p: Proximite | null): boolean {
  if (!p) return true;
  const d = distanceDeCourse(r, p.centre);
  return d != null && d <= p.rayonKm;
}

/**
 * La position de départ de la dernière sortie, ARRONDIE au centième de degré (~1 km).
 * Assez pour trier des courses, trop peu pour désigner une porte d'entrée : la page
 * n'a aucune raison de transporter la position exacte du domicile de l'athlète.
 */
export function positionArrondie(lat: unknown, lon: unknown): Point | null {
  const p = pointValide(lat, lon);
  return p ? { lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 } : null;
}

/** « à 12 km » : au kilomètre près jusqu'à 20 km, puis par tranches de 5 (un trajet, pas une mesure). */
export function kmArrondis(d: number): number {
  return d < 20 ? Math.max(1, Math.round(d)) : Math.round(d / 5) * 5;
}
