/**
 * LE TRACÉ ENTRE DEUX POINTS POSÉS SUR LA CARTE (onglet Carte, constructeur de parcours).
 *
 * ⚠️ LE SERVEUR DE DÉMONSTRATION D'OSRM CALCULAIT EN VOITURE (Cyprien, 27/11/2026, vidéo
 * à l'appui : « des fois ça relie pas du tout ce que je voulais »). `router.project-osrm.org`
 * ne sert QUE le profil voiture et ignore le mot `foot` ou `bike` de l'adresse. Mesuré le
 * 27/11/2026 entre deux points à 170 m dans le centre piéton de Rouen : 1 810 m en « pied »,
 * en « vélo » et en « voiture », à l'identique — le tour du pâté de maisons par les sens
 * uniques, les rues piétonnes étant interdites aux voitures.
 *
 * Les serveurs OSRM de FOSSGIS (`routing.openstreetmap.de`) servent de VRAIS profils piéton
 * et vélo : 236 m sur le même trajet. Leurs conditions (page « about », lue le 27/11/2026) :
 * l'attribution avec un lien « corriger la carte », UNE requête par seconde au plus, pas
 * d'usage intensif. D'où la file d'attente ci-dessous, et `CREDIT_ITINERAIRE`.
 */
import { profilOsrm } from "./altitude";

export type PointLL = { lat: number; lng: number };

/** Le serveur selon l'activité : sentiers et rues piétonnes à pied, pistes cyclables à vélo. */
export function serveurItineraire(activite: string): string {
  return profilOsrm(activite) === "bike"
    ? "https://routing.openstreetmap.de/routed-bike"
    : "https://routing.openstreetmap.de/routed-foot";
}

export function urlItineraire(a: PointLL, b: PointLL, activite: string): string {
  // ⚠️ `driving` dans l'adresse est NORMAL : sur ces serveurs, c'est le CHEMIN
  // (`routed-foot`) qui choisit le profil, et le segment de l'adresse est ignoré.
  return `${serveurItineraire(activite)}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?geometries=geojson&overview=full`;
}

/** L'écart minimal entre deux requêtes (conditions de FOSSGIS : une par seconde au plus). */
export const ECART_REQUETES_MS = 1100;

let derniere = 0;
let file: Promise<unknown> = Promise.resolve();

/**
 * Les requêtes partent UNE PAR UNE, à plus d'une seconde d'écart. Un athlète qui pose
 * cinq points d'affilée ne doit pas déclencher cinq requêtes dans la même seconde.
 */
function enFile<T>(tache: () => Promise<T>, encoreUtile: () => boolean): Promise<T | EchecTroncon> {
  const suite = file.then(async (): Promise<T | EchecTroncon> => {
    const attente = derniere + ECART_REQUETES_MS - Date.now();
    if (attente > 0) await new Promise((r) => setTimeout(r, attente));
    // Relu au DERNIER moment : une requête devenue inutile ne part pas, et comme elle ne
    // touche pas `derniere`, elle ne fait pas attendre la suivante.
    if (!encoreUtile()) return { echec: "inutile" };
    derniere = Date.now();
    return tache();
  });
  file = suite.catch(() => undefined);
  return suite;
}

/**
 * Un signal qui abandonne après `ms`. ⚠️ `AbortSignal.timeout` manque aux anciens Safari
 * iOS : l'appeler lèverait une erreur, avalée en « serveur en panne » pour CHAQUE tronçon.
 */
function delai(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

export type Troncon = {
  /** Les points du chemin, du départ accroché à l'arrivée accrochée. */
  points: PointLL[];
  /** Où le serveur a accroché le point de départ et celui d'arrivée (sur le chemin). */
  depart: PointLL;
  arrivee: PointLL;
};

/**
 * Pourquoi il n'y a pas de tronçon. L'écran ne dit pas la même chose :
 *  · « aucun » : le serveur a répondu, il n'existe pas de chemin (point dans un lac…) ;
 *  · « panne » : le serveur n'a pas répondu ou a refusé (429, réseau, délai) ;
 *  · « inutile » : le point a été annulé ou effacé avant que la requête parte — elle n'est
 *    pas envoyée du tout (relecture du 27/11/2026 : après « Effacer », les requêtes en
 *    file partaient quand même, une par seconde, et retardaient les nouveaux points).
 */
export type EchecTroncon = { echec: "aucun" | "panne" | "inutile" };

/**
 * Le chemin de `a` à `b`, ou la raison de son absence. C'est à l'écran de DIRE l'absence
 * (ligne droite annoncée), jamais de faire passer une ligne droite pour un chemin.
 * `encoreUtile` est relu juste avant l'envoi, quand vient le tour de la requête.
 */
export function calculerTroncon(
  a: PointLL, b: PointLL, activite: string, fetcher: typeof fetch = fetch, encoreUtile: () => boolean = () => true,
): Promise<Troncon | EchecTroncon> {
  return enFile(async () => {
    try {
      const res = await fetcher(urlItineraire(a, b, activite), { signal: delai(8000) });
      if (!res.ok) return { echec: "panne" as const };
      const data = await res.json() as {
        code?: string;
        routes?: { geometry?: { coordinates?: [number, number][] } }[];
        waypoints?: { location?: [number, number] }[];
      };
      const coords = data.routes?.[0]?.geometry?.coordinates;
      if (data.code !== "Ok" || !coords || coords.length < 2) return { echec: "aucun" as const };
      const points = coords.map(([lng, lat]) => ({ lat, lng }));
      const loc = (i: number, repli: PointLL): PointLL => {
        const l = data.waypoints?.[i]?.location;
        return l && Number.isFinite(l[0]) && Number.isFinite(l[1]) ? { lat: l[1], lng: l[0] } : repli;
      };
      return { points, depart: loc(0, points[0]), arrivee: loc(1, points[points.length - 1]) };
    } catch {
      return { echec: "panne" as const };
    }
  }, encoreUtile);
}

export const estEchec = (t: Troncon | EchecTroncon): t is EchecTroncon => "echec" in t;

/**
 * Un point posé à plus de cette distance du chemin le plus proche n'est PAS déplacé
 * dessus : on garde l'endroit visé (un sommet hors sentier, un point au milieu d'un champ),
 * et le tronçon s'y raccorde par une courte ligne droite.
 */
export const ACCROCHE_MAX_M = 60;

function distanceM(a: PointLL, b: PointLL): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Raccorde un tronçon calculé aux points VISÉS. Rend les points à ajouter au tracé (sans
 * le départ, déjà posé) et l'endroit où afficher le repère d'arrivée.
 *
 *  · Point posé à côté d'une rue (≤ `ACCROCHE_MAX_M`) : le repère se pose SUR la rue, là
 *    où passe le tracé — sinon il flotte au milieu d'un pâté de maisons et l'on croit le
 *    tracé faux.
 *  · Point posé loin de tout chemin : on garde l'endroit visé, rejoint en ligne droite.
 */
export function raccorder(depart: PointLL, arrivee: PointLL, t: Troncon): { points: PointLL[]; repere: PointLL } {
  const pts = [...t.points];
  if (distanceM(depart, t.depart) > ACCROCHE_MAX_M) pts.unshift(depart);
  const loin = distanceM(arrivee, t.arrivee) > ACCROCHE_MAX_M;
  if (loin) pts.push(arrivee);
  return { points: pts.slice(1), repere: loin ? arrivee : t.arrivee };
}

/** L'endroit où afficher un point visé : sur le chemin s'il est tout près, sinon là où il a été posé. */
export function accroche(vise: PointLL, surChemin: PointLL): PointLL {
  return distanceM(vise, surChemin) > ACCROCHE_MAX_M ? vise : surChemin;
}

/** La clé d'un tronçon : les identifiants des DEUX points qu'il relie, dans l'ordre. */
export const cleTroncon = (a: { id: number }, b: { id: number }) => `${a.id}>${b.id}`;

/**
 * LE TRACÉ AFFICHÉ, assemblé dans l'ORDRE DES POINTS — jamais dans l'ordre d'arrivée des
 * réponses (Cyprien, vidéo du 27/11/2026 : « des fois ça relie pas du tout ce que je
 * voulais »). Un tronçon pas encore calculé est remplacé, à l'écran seulement, par une
 * ligne droite jusqu'à son point ; le tronçon d'un point retiré n'est jamais lu.
 */
export function assemblerTrace(reperes: (PointLL & { id: number })[], troncons: Record<string, PointLL[]>): PointLL[] {
  return reperes.flatMap((r, i) => i === 0
    ? [{ lat: r.lat, lng: r.lng }]
    : (troncons[cleTroncon(reperes[i - 1], r)] ?? [{ lat: r.lat, lng: r.lng }]));
}

/** Deux taps au même endroit en moins de 400 ms : le double-tap d'un zoom, pas deux points. */
export function estDoubleTap(avant: { t: number; lat: number; lng: number } | null, apres: { t: number; lat: number; lng: number }): boolean {
  return !!avant && apres.t - avant.t < 400 && distanceM(avant, apres) < 25;
}

/**
 * Au-delà de cette distance entre l'endroit TOUCHÉ et le chemin le plus proche, le calcul
 * d'itinéraire n'a plus de sens. Crash-test du 27/11/2026 dans les Calanques : deux points
 * posés à 421 m et 569 m de tout sentier, accrochés par le serveur à des chemins lointains,
 * donnaient 18,6 km de tracé pour 1,9 km à vol d'oiseau. Loin de tout chemin (hors-piste,
 * sommet, champ), on relie en ligne droite — et on le dit.
 */
export const LOIN_CHEMIN_M = 150;

export function loinDuChemin(depart: PointLL, arrivee: PointLL, t: Troncon): boolean {
  return distanceM(depart, t.depart) > LOIN_CHEMIN_M || distanceM(arrivee, t.arrivee) > LOIN_CHEMIN_M;
}
