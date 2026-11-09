import { UA_PACEVOBOT } from "@/lib/races/robot";
import { longueurKm, tracePartiel } from "@/lib/parcours/trace";
import { estErreurTransitoire } from "@/lib/cron/transitoire";

/**
 * GÉOMÉTRIE GPS RÉELLE D'UN PARCOURS, depuis OpenStreetMap (ODbL) — logique sortie de la route
 * `/api/parcours/geometry` (09/11/2026) pour être éprouvée par les tests. Voir la route pour
 * l'historique (plus d'une minute d'attente quand Overpass tombait).
 */
const DELAI_MS = 12_000;
const API_OSM = "https://api.openstreetmap.org/api/0.6";
/**
 * Super-relation (sentier en étapes, parfois sur plusieurs niveaux) : au-delà de ce nombre de
 * relations relues, l'API officielle RENONCE et laisse Overpass (récursif) répondre. Jamais de
 * troncature : un tracé partiel serait montré comme « tracé réel » et gardé 30 jours en cache
 * (relecture « échecs muets » du 09/11/2026).
 */
const RELATIONS_MAX = 300;
/** Sous-relations relues en même temps, au plus. */
const LOT_API = 10;
/** Durée totale d'une recherche de tracé : au-delà, les deux sources sont annulées (503). */
const DUREE_MAX_MS = 20_000;

/** Un échec qui porte le statut HTTP de sa source (0 : délai, réseau, tracé incomplet). */
export class ErreurSource extends Error {
  /** `principal` : l'erreur porte sur la relation (ou le chemin) DEMANDÉ, pas sur une de ses étapes. */
  constructor(message: string, readonly status: number, readonly source: "api-osm" | "overpass", readonly principal = false) { super(message); }
}

/**
 * La relation n'existe plus (ou jamais) sur OpenStreetMap : l'API officielle répond 404 ou 410.
 * Ce n'est PAS une panne passagère — « réessaie dans quelques minutes » serait faux.
 */
export function refusDefinitif(e: unknown): boolean {
  // Seulement sur l'objet DEMANDÉ : une étape supprimée d'un long sentier n'est pas le sentier supprimé
  // (relecture du 09/11/2026) — Overpass, lui, peut encore rendre le reste.
  return causes(e).some((c) => c instanceof ErreurSource && c.source === "api-osm" && c.principal && (c.status === 404 || c.status === 410));
}


/**
 * Toutes les causes, à plat : Overpass lève son propre `AggregateError` (un par miroir) À
 * L'INTÉRIEUR de celui de la course — sans aplatir, ses statuts (403, 429, 502) étaient perdus.
 */
export function causes(e: unknown): unknown[] {
  return e instanceof AggregateError ? e.errors.flatMap(causes) : [e];
}

/**
 * L'ÉCHEC D'UNE SOURCE DIT-IL « RÉESSAIE » ? (09/11/2026) Quand une source n'a rendu qu'un morceau et
 * que l'autre a échoué par une PANNE (statut passager ou 5xx, délai, coupure réseau, Overpass
 * interrompue), le parcours n'est peut-être pas troué du tout : le coureur doit lire « réessaie dans
 * quelques minutes », pas « tracé incomplet ». Le statut HTTP passe par `estErreurTransitoire` (règle
 * du projet : l'erreur ET le statut). Sans statut, seul le NOM de l'erreur réseau compte — « nœud
 * manquant », « trop de relations », « géométrie vide » sont des faits du tracé, pas des pannes.
 */
export function echecPassager(e: unknown): boolean {
  const cs = causes(e);
  // Un FAIT du tracé (nœud manquant, géométrie vide) l'emporte sur la panne d'un autre miroir :
  // le parcours est peut-être vraiment troué, « réessaie » serait faux.
  if (cs.some((c) => c instanceof ErreurSource && / : (nœud manquant|géométrie vide)$/.test(c.message))) return false;
  return cs.some((c) => {
    // Une page illisible (HTML d'un Overpass surchargé, rendu en 200) : une panne de son côté.
    if (!(c instanceof ErreurSource)) return c instanceof Error && (c.name === "AbortError" || c.name === "TimeoutError" || c.name === "SyntaxError");
    if (c.status) return estErreurTransitoire(c, c.status) || c.status >= 500;
    if (/ : (TimeoutError|AbortError|TypeError)$/.test(c.message)) return true;
    // Overpass interrompue (« remark » rendue en 200 : délai, mémoire) : une panne de son côté.
    return c.message.startsWith("Overpass : ");
  });
}

/** Le délai d'un appel, ET l'annulation commune dès qu'une source a gagné la course. */
const signalDe = (commun?: AbortSignal) => (commun ? AbortSignal.any([AbortSignal.timeout(DELAI_MS), commun]) : AbortSignal.timeout(DELAI_MS));

interface OsmGeomPt { lat: number; lon: number }
interface OsmWay { type: "way"; id?: number; geometry?: OsmGeomPt[] }
interface OsmRelation { type: "relation"; members?: Array<{ type: string; geometry?: OsmGeomPt[] }> }
type OsmEl = OsmWay | OsmRelation | { type: string };

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function segmentsOverpass(elements: OsmEl[]): [number, number][][] {
  // Récupère chaque tronçon (way) séparément.
  const segs: [number, number][][] = [];
  const addWay = (geom?: OsmGeomPt[]) => {
    if (!geom || geom.length < 2) return;
    segs.push(geom.map((g) => [g.lon, g.lat] as [number, number]));
  };
  // Avec ">>", Overpass renvoie TOUS les tronçons (y compris ceux des
  // sous-relations) comme éléments "way" autonomes → on ne lit que ceux-là
  // (gère les super-relations, sans double comptage).
  const vus = new Set<number>();
  for (const el of parIdentifiant(elements.filter((x): x is OsmWay => x.type === "way"))) {
    if (el.id != null) { if (vus.has(el.id)) continue; vus.add(el.id); }
    addWay(el.geometry);
  }
  return segs;
}

/**
 * LE MÊME ORDRE, QUELLE QUE SOIT LA SOURCE (relecture du 09/11/2026). Le chaînage dépend de l'ordre
 * des tronçons (chaîne de départ, et la plus longue en cas d'égalité) : l'API officielle et Overpass ne
 * les rendent pas dans le même ordre, et la plus rapide décidait du tracé gardé 30 jours en cache.
 * Triés par identifiant OSM, les deux rendent la même chaîne.
 */
function parIdentifiant<T extends { id?: number }>(liste: T[]): T[] {
  return [...liste].sort((a, b) => (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER));
}

// Les membres d'une relation OSM ne sont PAS ordonnés bout-à-bout, et une route
// peut être faite de plusieurs morceaux. On construit d'abord des chaînes
// maximales (par tronçons qui se touchent), puis on les relie par proximité.
export function chainSegments(segs: [number, number][][]): [number, number][] {
  return chainSegmentsMesure(segs).coords;
}

/**
 * Le chaînage, et ce qu'il a ÉCARTÉ : les morceaux séparés de plus de 250 m de la chaîne principale
 * sont laissés de côté (jamais reliés par un trait droit). Sans mesure, une relation trouée rendait un
 * fragment montré comme le tracé complet — gardé 30 jours en cache (relecture du 09/11/2026).
 */
export function chainSegmentsMesure(segs: [number, number][][]): { coords: [number, number][]; totalKm: number; perduKm: number } {
  const valid = segs.filter((s) => s.length >= 2);
  const totalKm = valid.reduce((t, s) => t + chainKm(s), 0);
  if (valid.length <= 1) return { coords: dedup(valid[0] ?? []), totalKm, perduKm: 0 };
  // Tolérance ~5 m : raccorde les tronçons qui se touchent (petits écarts d'arrondi).
  const eq = (a: [number, number], b: [number, number]) =>
    Math.abs(a[0] - b[0]) < 5e-5 && Math.abs(a[1] - b[1]) < 5e-5;
  const used = new Array(valid.length).fill(false);

  // 1) Chaînes maximales (chaque composant connexe est chaîné proprement).
  const chains: [number, number][][] = [];
  for (let start = 0; start < valid.length; start++) {
    if (used[start]) continue;
    let chain = valid[start].slice();
    used[start] = true;
    let extended = true;
    while (extended) {
      extended = false;
      const head = chain[0], tail = chain[chain.length - 1];
      for (let i = 0; i < valid.length; i++) {
        if (used[i]) continue;
        const s = valid[i], a = s[0], b = s[s.length - 1];
        if (eq(tail, a)) chain = chain.concat(s.slice(1));
        else if (eq(tail, b)) chain = chain.concat(s.slice(0, -1).reverse());
        else if (eq(head, b)) chain = s.slice(0, -1).concat(chain);
        else if (eq(head, a)) chain = s.slice(1).reverse().concat(chain);
        else continue;
        used[i] = true; extended = true; break;
      }
    }
    chains.push(chain);
  }
  if (chains.length === 1) return { coords: dedup(chains[0]), totalKm, perduKm: 0 };

  // 2) On garde la PLUS LONGUE chaîne, puis on ne lui rattache que les chaînes
  //    séparées par un PETIT trou (< 250 m). On ne relie JAMAIS deux morceaux
  //    éloignés par un trait droit → plus de ligne à travers l'eau / les champs.
  const GAP_KM = 0.25;
  chains.sort((a, b) => chainKm(b) - chainKm(a));
  const usedC = new Array(chains.length).fill(false);
  let result = chains[0].slice();
  usedC[0] = true;
  let added = true;
  while (added) {
    added = false;
    const head = result[0], tail = result[result.length - 1];
    let best = -1, rev = false, prepend = false, bestGap = Infinity;
    for (let i = 0; i < chains.length; i++) {
      if (usedC[i]) continue;
      const c = chains[i], a = c[0], b = c[c.length - 1];
      const tA = havKm(tail, a), tB = havKm(tail, b), hA = havKm(head, a), hB = havKm(head, b);
      if (tA < bestGap) { bestGap = tA; best = i; rev = false; prepend = false; }
      if (tB < bestGap) { bestGap = tB; best = i; rev = true; prepend = false; }
      if (hB < bestGap) { bestGap = hB; best = i; rev = false; prepend = true; }
      if (hA < bestGap) { bestGap = hA; best = i; rev = true; prepend = true; }
    }
    if (best >= 0 && bestGap < GAP_KM) {
      usedC[best] = true; added = true;
      const c = rev ? chains[best].slice().reverse() : chains[best];
      result = prepend ? c.concat(result) : result.concat(c);
    }
  }
  const perduKm = chains.reduce((t, c, i) => t + (usedC[i] ? 0 : chainKm(c)), 0);
  return { coords: dedup(result), totalKm, perduKm };
}

/**
 * La chaîne principale, comme avant. ⚠️ PAS DE REFUS « INCOMPLET » ICI (rejeu du 09/11/2026 sur 30
 * parcours réels) : le catalogue Pacevo a été bâti sur CETTE chaîne (« Liaison Sigean-Port-la-Nouvelle » :
 * 1,70 km au catalogue, 1,70 km gardés sur 3,05 km de tronçons). Les refuser aurait retiré 3 parcours
 * sur 30. Le contrôle se fait dans le navigateur, contre la distance AFFICHÉE sur la carte du parcours.
 */
function chainerOuRefuser(segs: [number, number][][]): [number, number][] {
  return chainSegmentsMesure(segs).coords;
}

function havKm(a: [number, number], b: [number, number]): number {
  const R = 6371, dLat = ((b[1] - a[1]) * Math.PI) / 180, dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function chainKm(c: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < c.length; i++) d += havKm(c[i - 1], c[i]);
  return d;
}

function dedup(chain: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of chain) {
    const l = out[out.length - 1];
    if (!l || Math.abs(l[0] - p[0]) >= 1e-9 || Math.abs(l[1] - p[1]) >= 1e-9) out.push(p);
  }
  return out;
}

type ElementApi = { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; members?: { type: string; ref: number }[] };

/** L'API officielle d'OpenStreetMap : la relation (ou le chemin) avec tous ses nœuds. */
export async function depuisApiOsm(type: "relation" | "way", id: string, commun?: AbortSignal): Promise<[number, number][]> {
  const lire = async (t: string, i: string | number, principal = false): Promise<ElementApi[]> => {
    const r = await fetch(`${API_OSM}/${t}/${i}/full.json`, {
      headers: { "User-Agent": UA_PACEVOBOT, Accept: "application/json" },
      signal: signalDe(commun),
    }).catch((e) => { throw new ErreurSource(`API OSM : ${(e as Error).name}`, 0, "api-osm"); });
    if (!r.ok) throw new ErreurSource(`API OSM ${r.status}`, r.status, "api-osm", principal);
    return ((await r.json()) as { elements?: ElementApi[] }).elements ?? [];
  };
  const tous = await lire(type, id, true);
  // Super-relation : TOUS les niveaux de sous-relations, comme `>>` chez Overpass, sans troncature.
  if (type === "relation") {
    const lues = new Set<number>([Number(id)]);
    let aLire = tous.filter((e) => e.type === "relation" && e.id === Number(id)).flatMap((r) => r.members ?? [])
      .filter((m) => m.type === "relation").map((m) => m.ref);
    while (aLire.length) {
      aLire = [...new Set(aLire)].filter((r) => !lues.has(r));
      if (!aLire.length) break;
      if (lues.size + aLire.length > RELATIONS_MAX) throw new ErreurSource(`API OSM : plus de ${RELATIONS_MAX} relations`, 0, "api-osm");
      for (const r of aLire) lues.add(r);
      // Par lots de 10 : jamais des centaines de requêtes simultanées sur un service gratuit.
      const lot: ElementApi[] = [];
      for (let k = 0; k < aLire.length; k += LOT_API) {
        for (const els of await Promise.all(aLire.slice(k, k + LOT_API).map((r) => lire("relation", r)))) {
          for (const el of els) { lot.push(el); tous.push(el); }
        }
      }
      aLire = lot.filter((e) => e.type === "relation" && lues.has(e.id)).flatMap((r) => r.members ?? [])
        .filter((m) => m.type === "relation").map((m) => m.ref);
    }
  }
  const noeuds = new Map<number, [number, number]>();
  for (const e of tous) if (e.type === "node" && e.lat != null && e.lon != null) noeuds.set(e.id, [e.lon, e.lat]);
  const segs: [number, number][][] = [];
  const vus = new Set<number>();
  // Par identifiant de chemin : le même ordre que chez Overpass (voir `parIdentifiant`).
  for (const e of parIdentifiant(tous.filter((x) => x.type === "way"))) {
    if (vus.has(e.id)) continue;
    vus.add(e.id);
    const g = (e.nodes ?? []).map((n) => noeuds.get(n));
    // Un nœud manquant = un tracé troué : on le refuse plutôt que de le montrer raccourci.
    if (g.some((p) => p == null)) throw new ErreurSource("API OSM : nœud manquant", 0, "api-osm");
    if (g.length >= 2) segs.push(g as [number, number][]);
  }
  return chainerOuRefuser(segs);
}

/** Overpass : tous ses miroirs EN MÊME TEMPS, le premier qui répond gagne. */
export async function depuisOverpass(type: "relation" | "way", id: string, commun?: AbortSignal): Promise<[number, number][]> {
  // ">>" (recurse down) récupère AUSSI la géométrie des sous-relations (super-relations).
  const q = `[out:json][timeout:25];${type}(${id});${type === "relation" ? ">>;" : ""}out geom;`;
  return Promise.any(ENDPOINTS.map(async (url) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA_PACEVOBOT },
      body: "data=" + encodeURIComponent(q),
      signal: signalDe(commun),
    }).catch((e) => { throw new ErreurSource(`Overpass : ${(e as Error).name}`, 0, "overpass"); });
    if (!res.ok) throw new ErreurSource(`Overpass ${res.status}`, res.status, "overpass");
    const json = (await res.json()) as { elements?: OsmEl[]; remark?: string };
    // ⚠️ Un « remark » en 200 = requête interrompue (délai, mémoire) : les éléments sont PARTIELS.
    // Un fragment ne gagne jamais la course (relecture du 09/11/2026).
    if (json.remark) throw new ErreurSource(`Overpass : ${String(json.remark).slice(0, 80)}`, 0, "overpass");
    const coords = chainerOuRefuser(segmentsOverpass(json.elements ?? []));
    if (coords.length < 2) throw new ErreurSource("Overpass : géométrie vide", 0, "overpass");
    return coords;
  }));
}

/** La première géométrie valable des deux sources. Une erreur n'est PAS mise en cache. */
export async function geometrieParcours(type: "relation" | "way", id: string): Promise<[number, number][]> {
  return (await geometrieVerifiee(type, id, 0)).coords;
}

/**
 * UN MORCEAU N'EST PAS LE PARCOURS, ET IL NE DOIT PAS RESTER EN CACHE (09/11/2026).
 *
 * Les deux sources partent ensemble ; la première géométrie valable gagne (le cas courant, 0,3 s).
 * Si elle n'est qu'un morceau — moins des trois quarts de la distance du catalogue —, on ATTEND
 * l'autre source, déjà partie (rien n'est relancé : un service gratuit, des quotas stricts), et on
 * garde la plus longue. Toujours partiel : on le DIT (`partiel`), avec la cause de l'échec de l'autre
 * source s'il y en a une (`echecs`), et la route ne le met pas en cache — avant, le coureur voyait
 * « tracé incomplet » 30 jours sans pouvoir réessayer, même si l'autre source avait le parcours.
 * Distance inconnue (0) : aucun contrôle ici, le navigateur garde le sien.
 */
export async function geometrieVerifiee(
  type: "relation" | "way", id: string, distanceKm: number,
): Promise<{ coords: [number, number][]; partiel: boolean; echecs: unknown[] }> {
  const valable = async (p: Promise<[number, number][]>) => {
    const c = await p;
    if (c.length < 2) throw new Error("géométrie vide");
    return c;
  };
  // La source qui perd est ANNULÉE dès qu'on a ce qu'il faut : pas de requête inutile laissée
  // sur un service communautaire gratuit (risque de bannissement de l'adresse du serveur).
  const fin = new AbortController();
  const butoir = setTimeout(() => fin.abort(), DUREE_MAX_MS);
  try {
    // Parcours SUPPRIMÉ d'OpenStreetMap (l'API officielle le dit en 0,3 s) : on n'attend pas les 12 s
    // d'un Overpass en panne pour l'annoncer — tout s'arrête, le refus remonte aussitôt.
    const api = depuisApiOsm(type, id, fin.signal).catch((e) => { if (refusDefinitif(e)) fin.abort(); throw e; });
    const sources = [valable(api), valable(depuisOverpass(type, id, fin.signal))];
    const premier = await Promise.any(sources);
    if (!(distanceKm > 0) || !tracePartiel(premier, distanceKm)) return { coords: premier, partiel: false, echecs: [] };
    // Un morceau : l'autre source est encore en route (même butoir) — on l'attend, sans rien relancer.
    const r = await Promise.allSettled(sources);
    const ok = r.flatMap((x) => (x.status === "fulfilled" ? [x.value] : []));
    const echecs = r.flatMap((x) => (x.status === "rejected" ? [x.reason] : []));
    // À longueur égale, la première arrivée : le même tracé d'un appel à l'autre.
    const coords = ok.reduce((a, b) => (longueurKm(b) > longueurKm(a) ? b : a), premier);
    return { coords, partiel: tracePartiel(coords, distanceKm), echecs };
  } finally {
    clearTimeout(butoir);
    fin.abort();
  }
}
