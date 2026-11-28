/**
 * AJOUTER DES PARCOURS AU CATALOGUE, DEPUIS DES SOURCES OUVERTES ET VÉRIFIÉES.
 *
 *   npx tsx scripts/parcours-importer.ts --region 28 [--metropole] [--ign] [--ecrire] [--cache <dossier>]
 *
 * Cyprien, 27/11/2026 : « trouve en ligne, via de vraies sources fiables, plein de parcours —
 * surtout course à pied, trail, randonnée et vélo ; à Rouen il n'y a quasiment rien ». Les
 * sources retenues (licences relues à la source le 27/11/2026) :
 *  · OpenStreetMap (ODbL) : les relations sportives que la collecte de juin avait manquées —
 *    57 autour de Rouen, 140 en Seine-Maritime ;
 *  · Métropole Rouen Normandie, « Parcours de randonnée » (Licence Ouverte v2.0, 09/2022) ;
 *  · IGN BD TOPO, classe `itineraire_autre` (Licence Ouverte 2.0, édition du 12/11/2026).
 * ÉCARTÉES (conditions qui interdisent la réutilisation) : Visorando, AllTrails, Strava,
 * Komoot, Wikiloc, OpenRunner, FFRandonnée (GR®, PR). Un itinéraire dont le nom commence par
 * « GR » n'est pas repris des sources non OSM.
 *
 * Chaque parcours est MESURÉ comme ceux de la certification de juin (verifier.js) :
 *  · distance sur le tracé ; un tracé troué (> 25 % de morceaux écartés) est refusé ;
 *  · dénivelé et altitudes : IGN RGE ALTI (service d'altimétrie de la Géoplateforme) ;
 *  · communes, département, région : API Géo de l'État (geo.api.gouv.fr) ;
 *  · sport d'après le type réel (règle de `sportDepuisOsm`), durée, calories, difficulté.
 * Rien n'est inventé : une mesure qui manque fait écarter le parcours, elle n'est pas devinée.
 * Les doublons (même parcours dans deux sources) sont écartés par le TRACÉ.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { geometrieParcours, chainSegmentsMesure } from "../src/lib/parcours/geometrie";
import { estCleabs } from "../src/lib/parcours/geometrieIgn";
import { reparerNom } from "../src/lib/parcours/noms";
import { UA_PACEVOBOT } from "../src/lib/races/robot";
import { sportDepuisOsm, raisonDeRetrait, typeSportif } from "./parcours-auditer";
import { arreterSiDepasse, seuil } from "./garde-fous";

type LL = [number, number];   // [longitude, latitude]
export type Candidat = {
  cle: string;                // identifiant stable de la source
  source: "osm" | "metropole" | "ign";
  nom: string;
  osm?: { id: number; route: string };
  nature?: string;            // IGN : « Itinéraire cyclable », « Itinéraire de randonnée pédestre »…
  segments?: LL[][];          // géométrie fournie par la source (Métropole, IGN)
};

// PacevoBot, comme tout appel sortant de Pacevo (tests/legalite) : un nom qui dit qui nous sommes.
const UA = UA_PACEVOBOT;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Mesures ────────────────────────────────────────────────────────────────────────
export function distanceKm(a: LL, b: LL): number {
  const R = 6371, rad = Math.PI / 180;
  const dLa = (b[1] - a[1]) * rad, dLo = (b[0] - a[0]) * rad;
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export const longueurKm = (c: LL[]) => c.reduce((t, p, i) => (i ? t + distanceKm(c[i - 1], p) : 0), 0);

/** Le dénivelé, comme la certification : seuil de 4 m pour ne pas additionner le bruit. */
/**
 * Le dénivelé, ou `null` si l'altitude manque sur plus d'un point sur dix (bord de la couverture
 * RGE ALTI, mer, frontière) : calculé sur ce qui reste, il serait sous-estimé et affiché comme
 * mesuré (relecture du 28/11/2026). « Quand la donnée manque, on le dit. »
 */
export function denivele(elev: (number | null)[], T = 4) {
  const e = elev.filter((z): z is number => z != null);
  if (e.length < 2 || e.length < 0.9 * elev.length) return null;
  let gain = 0, perte = 0, ref = e[0];
  for (const z of e) { const d = z - ref; if (d >= T) { gain += d; ref = z; } else if (d <= -T) { perte += -d; ref = z; } }
  return { dp: Math.round(gain), dm: Math.round(perte), min: Math.round(Math.min(...e)), max: Math.round(Math.max(...e)) };
}

/** La plus forte pente (en %), entre deux points distants d'au moins 40 m (en deçà, le bruit de l'altitude domine). */
export function penteMax(points: LL[], z: (number | null)[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) {
    const d = distanceKm(points[i - 1], points[i]) * 1000;
    if (d >= 40 && z[i] != null && z[i - 1] != null) m = Math.max(m, Math.abs((z[i]! - z[i - 1]!) / d) * 100);
  }
  return Math.round(m);
}

/** Des points espacés d'au moins `pasM` mètres, au plus `max` : de quoi afficher et mesurer. */
export function alleger(c: LL[], pasM = 25, max = 300): LL[] {
  if (c.length <= 2) return c;
  const garde: LL[] = [c[0]];
  for (let i = 1; i < c.length - 1; i++) if (distanceKm(garde[garde.length - 1], c[i]) * 1000 >= pasM) garde.push(c[i]);
  garde.push(c[c.length - 1]);
  if (garde.length <= max) return garde;
  const out: LL[] = [];
  for (let i = 0; i < max; i++) out.push(garde[Math.round((i * (garde.length - 1)) / (max - 1))]);
  return out;
}

/** Distance (m) du point `p` au segment [a, b], en plan local (assez juste à quelques kilomètres). */
function auSegmentM(p: LL, a: LL, b: LL): number {
  const k = Math.cos((p[1] * Math.PI) / 180) * 111_320, m = 110_540;
  const ax = (a[0] - p[0]) * k, ay = (a[1] - p[1]) * m, bx = (b[0] - p[0]) * k, by = (b[1] - p[1]) * m;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/**
 * Part des points de `a` situés à moins de `toleranceM` du tracé `b` : un même parcours ≈ 1.
 * ⚠️ Distance au SEGMENT, pas au sommet le plus proche (relecture du 28/11/2026) : contre un tracé
 * de 60 points, un sommet sur 330 m à 20 km de long, la copie d'un parcours ne recouvrait qu'à 35 %
 * et passait pour un nouveau parcours.
 */
export function recouvrement(a: LL[], b: LL[], toleranceM = 60): number {
  if (!a.length || !b.length) return 0;
  const ech = alleger(a, 100, 80);
  const proche = ech.filter((p) => b.length === 1
    ? distanceKm(p, b[0]) * 1000 <= toleranceM
    : b.some((q, i) => i > 0 && auSegmentM(p, b[i - 1], q) <= toleranceM)).length;
  return proche / ech.length;
}

/**
 * Un ALLER-RETOUR : le tracé revient à son départ en repassant par son aller (la relation OSM liste
 * deux fois les mêmes chemins). 74 sentiers vers un sommet ou une plage (« Pic de Courmettes »,
 * 3,76 km au catalogue, 7,54 km de tracé) étaient mesurés sur l'aller seul : ils ne sont pas
 * « sans rapport », ils sont remesurés et rangés en « Aller-retour » (28/11/2026).
 */
export function estAllerRetour(c: LL[]): boolean {
  if (c.length < 8 || distanceKm(c[0], c[c.length - 1]) >= 0.3) return false;
  const m = Math.floor(c.length / 2);
  return recouvrement(c.slice(m), c.slice(0, m + 1)) > 0.9;
}

/**
 * Un nom qui cite un GR®, un GRP® ou un PR® (marques de la FFRandonnée) : écarté des sources hors
 * OSM, où qu'il soit dans le nom (« Boucle des Huguenots GR 965 », relecture du 28/11/2026).
 */
// ⚠️ Pas de `\b` : en JavaScript, « è » n'est pas une lettre pour lui (« Les Grès » passait pour un GR).
export const citeUnGr = (nom: string) => /(?<![\p{L}\d])GRP?(?!\p{L})|GR®|(?<![\p{L}\d])PR\s?\d|PR®/iu.test(nom);

export function sportDuCandidat(c: Candidat, km: number, dp: number): string | null {
  if (c.source === "osm") return sportDepuisOsm(c.osm?.route, km, dp);
  // La NATURE donnée par la source, d'abord ; le nom seulement à défaut (Métropole), et par mots
  // entiers : « Sentier du développement durable » n'est pas du vélo, ni « Champ de Courses » une
  // course (relecture du 28/11/2026).
  const nature = (c.nature ?? "").toLowerCase();
  const texte = nature || c.nom.toLowerCase();
  if (/\bvtt\b/.test(texte)) return "VTT";                              // « Itinéraire cyclable · Itinéraire VTT »
  if (/cyclable|voie verte|\bv[ée]lo(route)?\b|\bcyclo/.test(texte)) return "Vélo (Route)";
  if (/équestre|equestre|\bchevaux?\b|nautique|cano[ëe]|kayak/.test(texte)) return null;
  if (/parcours sportif|parcours de santé/.test(texte)) return "Running";
  return sportDepuisOsm("hiking", km, dp);
}

const SPEED: Record<string, number> = { "Running": 11, "Trail": 8.5, "Randonnée": 4.8, "Vélo (Route)": 19, "VTT": 13 };
const CLIMB: Record<string, number> = { "Running": 6, "Trail": 9, "Randonnée": 10, "Vélo (Route)": 4, "VTT": 6 };
const KCAL: Record<string, number> = { "Running": 65, "Trail": 70, "Randonnée": 55, "Vélo (Route)": 40, "VTT": 50 };
const fmtDuree = (min: number) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`; };

export const SOURCES = {
  osm: { licence: "ODbL 1.0", attribution: "© les contributeurs d'OpenStreetMap" },
  metropole: { licence: "Licence Ouverte v2.0", attribution: "Métropole Rouen Normandie, parcours de randonnée (09/2022)" },
  ign: { licence: "Licence Ouverte 2.0", attribution: "IGN, BD TOPO® (11/2026)" },
} as const;

// ── Services (avec cache disque : l'import se reprend où il s'est arrêté) ──────────────
let CACHE = "";
function cache<T>(nom: string): Record<string, T> {
  const f = path.join(CACHE, nom + ".json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
}
function garder(nom: string, v: unknown) { writeFileSync(path.join(CACHE, nom + ".json"), JSON.stringify(v)); }

/**
 * Au plus 3 appels d'altitude à la fois, pour tout le processus : le service de l'IGN refuse les
 * rafales (28/11/2026 : 3 échecs sur 10 appels simultanés), et chaque refus coûtait une mesure.
 */
let enVol = 0;
/** Réglable (`PACEVO_ALTI_SIMULTANES`) : le service tolère moins en journée qu'en pleine nuit. */
const ALTI_SIMULTANES = Math.max(1, Number(process.env.PACEVO_ALTI_SIMULTANES) || 3);
const attente: (() => void)[] = [];
async function jeton<T>(f: () => Promise<T>): Promise<T> {
  if (enVol >= ALTI_SIMULTANES) await new Promise<void>((r) => attente.push(r));
  enVol++;
  try { return await f(); } finally { enVol--; attente.shift()?.(); }
}

export async function altitudes(points: LL[]): Promise<(number | null)[] | null> {
  const out: (number | null)[] = [];
  for (let i = 0; i < points.length; i += 200) {
    const lot = points.slice(i, i + 200);
    const lon = lot.map((p) => p[0].toFixed(6)).join("|"), lat = lot.map((p) => p[1].toFixed(6)).join("|");
    let ok = false;
    for (let essai = 0; essai < 4 && !ok; essai++) {
      await jeton(async () => {
        try {
          const r = await fetch(`https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${lon}&lat=${lat}&resource=ign_rge_alti_wld&delimiter=|&zonly=true`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
          const j = await r.json() as { elevations?: number[] };
          if (Array.isArray(j.elevations) && j.elevations.length === lot.length) { out.push(...j.elevations.map((z) => (z < -1000 ? null : z))); ok = true; }
        } catch { /* nouvel essai */ }
      });
      if (!ok) await dormir(3000 * (essai + 1));
    }
    if (!ok) return null;
  }
  return out;
}

type Lieu = { commune: string; departement: string; region: string } | null;
/**
 * La commune d'un point. `null` = AUCUNE commune (en mer, hors de France) ; une panne de l'API
 * LÈVE une erreur — elle ne doit pas faire écarter un parcours comme « hors de France ».
 */
async function lieu(p: LL): Promise<Lieu> {
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch(`https://geo.api.gouv.fr/communes?lat=${p[1].toFixed(5)}&lon=${p[0].toFixed(5)}&fields=nom,departement,region&format=json`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      if (r.ok) {
        const j = await r.json() as { nom: string; departement?: { nom: string }; region?: { nom: string } }[];
        const c = j[0];
        return c?.departement && c.region ? { commune: c.nom, departement: c.departement.nom, region: c.region.nom } : null;
      }
    } catch { /* nouvel essai */ }
    await dormir(2000);
  }
  throw new Error("API Géo injoignable");
}

/** Overpass répond parfois 200 avec une erreur dans `remark` (mémoire, délai) : ce n'est pas une réponse. */
export const erreurOverpass = (t: { remark?: string }) => !!t.remark && /runtime error|timed out|out of memory|error/i.test(t.remark);

/**
 * Une réponse à un paquet de `demandes` relations est-elle exploitable ? Ni erreur, ni tronquée :
 * moins de la moitié des relations revenues = un miroir surchargé, pas des relations disparues
 * (relecture du 28/11/2026 : la prendre au mot retirait 40 parcours d'un coup).
 */
export const reponseUtilisable = (t: { remark?: string; elements?: unknown[] }, demandes: number) =>
  !erreurOverpass(t) && (t.elements ?? []).length >= Math.ceil(demandes / 2);

async function overpass(q: string): Promise<{ elements?: { id: number; tags?: Record<string, string>; center?: { lat: number; lon: number } }[] }> {
  for (const ep of ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter"]) {
    for (let essai = 0; essai < 3; essai++) {
      try {
        const r = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(200000) });
        if (r.ok) { const t = await r.json(); if (!erreurOverpass(t)) return t; }
      } catch { /* suivant */ }
      await dormir(10000);
    }
  }
  throw new Error("Overpass injoignable");
}

// ── Les sources ─────────────────────────────────────────────────────────────────────
/** Les 13 régions de France métropolitaine (code INSEE). */
export const REGIONS = ["11", "24", "27", "28", "32", "44", "52", "53", "75", "76", "84", "93", "94"];

async function candidatsOsm(region: string, connus: Set<number>): Promise<Candidat[]> {
  const q = `[out:json][timeout:300];area["ref:INSEE"="${region}"]["boundary"="administrative"]["admin_level"="4"]->.a;`
    + `rel(area.a)[type=route][route~"^(hiking|foot|running|bicycle|mtb)$"]["name"];out tags;`;
  const j = await overpass(q);
  return (j.elements ?? [])
    .filter((e) => !connus.has(e.id) && !raisonDeRetrait(e.tags ?? {}))
    .map((e) => ({ cle: `osm-${e.id}`, source: "osm" as const, nom: e.tags!.name, osm: { id: e.id, route: typeSportif(e.tags) ?? "hiking" } }));
}

const lignes = (g: { type: string; coordinates: unknown }): LL[][] =>
  g.type === "LineString" ? [g.coordinates as LL[]] : g.type === "MultiLineString" ? (g.coordinates as LL[][]) : [];

async function candidatsMetropole(): Promise<Candidat[]> {
  const r = await fetch("https://data.metropole-rouen-normandie.fr/api/explore/v2.1/catalog/datasets/parcours-de-randonnee-metropole-rouen-normandie/exports/geojson", { headers: { "User-Agent": UA } });
  const j = await r.json() as { features: { properties: Record<string, string>; geometry: { type: string; coordinates: unknown } }[] };
  return j.features.filter((f) => !citeUnGr(f.properties.nom_de_la_trace ?? "")).map((f) => ({
    cle: `metropole-${f.properties.identifiant_trace}`, source: "metropole" as const,
    nom: f.properties.nom_de_la_trace, segments: lignes(f.geometry),
  }));
}

/** Normandie entière par défaut (cadre en latitude, longitude). */
/** `cadre` en « lat,lon,lat,lon » ; « france » ou absent : toute la France (26 399 itinéraires). */
async function candidatsIgn(cadre?: string): Promise<Candidat[]> {
  const out: Candidat[] = [];
  const bbox = cadre && cadre !== "france" ? `&BBOX=${cadre},urn:ogc:def:crs:EPSG::4326` : "";
  for (let debut = 0; ; debut += 1000) {
    const url = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:itineraire_autre&OUTPUTFORMAT=application/json&COUNT=1000&STARTINDEX=${debut}&SORTBY=cleabs${bbox}`;
    let j: { features: { properties: Record<string, string | null>; geometry: { type: string; coordinates: unknown } }[] } | null = null;
    for (let essai = 0; essai < 4 && !j; essai++) {
      try { const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(180000) }); if (r.ok) j = await r.json(); } catch { /* nouvel essai */ }
      if (!j) await dormir(10000);
    }
    if (!j) throw new Error(`IGN injoignable (page ${debut})`);
    if (debut % 5000 === 0) console.log(`  IGN : page ${debut / 1000 + 1}`);
    for (const f of j.features ?? []) {
      const p = f.properties;
      const nom = p.toponyme && p.toponyme !== "None" ? p.toponyme : "";
      if (citeUnGr(nom)) continue;                                        // FFRandonnée (GR®, PR®)
      if (/équestre/i.test(p.nature ?? "")) continue;
      if (!estCleabs(String(p.cleabs))) { console.log(`  IGN : identifiant inattendu ${p.cleabs}, écarté`); continue; }
      out.push({ cle: `ign-${p.cleabs}`, source: "ign", nom, nature: [p.nature, p.nature_detaillee].filter((x) => x && x !== "None").join(" · "), segments: lignes(f.geometry) });
    }
    if ((j.features ?? []).length < 1000) break;
    await dormir(1000);
  }
  return out;
}

// ── La mesure d'un candidat ──────────────────────────────────────────────────────────
export type Mesure = Record<string, unknown> & { coords: LL[]; distance_km: number };

/**
 * Les tracés OSM, PAR PAQUETS de 40 (`out geom`) : à l'échelle de la France, une relation à la fois
 * prendrait des jours et chargerait l'API d'édition d'OSM, qui n'est pas faite pour ça. Une
 * super-relation (sentier en étapes) n'a pas sa géométrie dans la réponse : on la laisse de côté.
 */
export async function tracesOsmParPaquets(ids: number[], deja: Set<number>, garder: (id: number, segs: LL[][] | "super") => void) {
  const reste = ids.filter((id) => !deja.has(id));
  for (let i = 0; i < reste.length; i += 40) {
    const lot = reste.slice(i, i + 40);
    type R = { elements?: { id: number; members?: { type: string; geometry?: { lat: number; lon: number }[] }[] }[] };
    let j: R | null = null;
    for (let essai = 0; essai < 3 && !j; essai++) {
      const t = await overpass(`[out:json][timeout:240];relation(id:${lot.join(",")});out geom;`).catch(() => null) as R | null;
      if (t && reponseUtilisable(t, lot.length)) j = t; else await dormir(15000);
    }
    if (!j) { console.log(`  tracés OSM : paquet ${i} illisible, repris au prochain passage`); continue; }
    const parId = new Map((j.elements ?? []).map((e) => [e.id, e]));
    for (const id of lot) {
      const e = parId.get(id);
      // Absente d'une réponse complète : rien en cache (« absent » serait définitif), le
      // candidat sera refusé « tracé OSM absent » pour ce passage, et relu au suivant.
      if (!e) continue;
      const segs = (e.members ?? []).filter((m) => m.type === "way" && m.geometry?.length).map((m) => m.geometry!.map((g) => [g.lon, g.lat] as LL));
      garder(id, !segs.length && (e.members ?? []).some((m) => m.type === "relation") ? "super" : segs);
    }
    if (Math.floor(i / 400) !== Math.floor((i + 40) / 400)) console.log(`  tracés OSM : ${Math.min(i + 40, reste.length)}/${reste.length}`);
    await dormir(1500);
  }
}

/** France métropolitaine et Corse (le catalogue et ses tests s'y tiennent). */
export const enMetropole = ([lon, lat]: LL) => lon >= -5.3 && lon <= 9.7 && lat >= 41 && lat <= 51.2;

/**
 * Un refus PASSAGER (service injoignable, réponse tronquée) : jamais mis en cache de reprise, sinon
 * une panne de dix minutes refuserait des centaines de parcours pour toujours (relecture du 28/11/2026).
 */
export const refusPassager = (refus: string) => /injoignable|indisponible|^erreur|illisible|tracé OSM absent|non mesuré/i.test(refus);

/**
 * Des identifiants UNIQUES pour les parcours hors OSM. Le hachage seul (31·h mod 9·10⁸) avait deux
 * collisions réelles sur les 26 187 itinéraires de l'IGN (relecture du 28/11/2026) : un parcours
 * aurait affiché le tracé d'un autre. Les clés sont prises dans l'ordre, et une place prise
 * (catalogue compris) passe à la suivante.
 */
export const idHache = (cle: string) => 9_000_000_000 + [...cle].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 900_000_000, 7);
export function idsUniques(cles: string[], pris: Iterable<number>): Map<string, number> {
  const occupe = new Set(pris);
  const out = new Map<string, number>();
  for (const cle of [...new Set(cles)].sort()) {
    let id = idHache(cle);
    while (occupe.has(id)) id++;
    occupe.add(id); out.set(cle, id);
  }
  return out;
}

/**
 * Les ajouts fusionnés au catalogue tel qu'il est AU MOMENT D'ÉCRIRE (relu, pas celui du début de
 * l'import, qui dure des heures : un audit appliqué entre-temps aurait été écrasé). Un ajout dont
 * l'identifiant est déjà au catalogue est écarté ; deux identifiants égaux font tout refuser.
 */
export function fusionner<T extends { osm_id: number }>(courant: T[], ajouts: T[]): { catalogue: T[]; ecartes: number } {
  const ids = new Set(courant.map((p) => p.osm_id));
  if (ids.size !== courant.length) throw new Error("le catalogue courant a des identifiants en double");
  const gardes = ajouts.filter((a) => !ids.has(a.osm_id));
  for (const a of gardes) { if (ids.has(a.osm_id)) throw new Error(`identifiant en double dans les ajouts : ${a.osm_id}`); ids.add(a.osm_id); }
  return { catalogue: [...courant, ...gardes], ecartes: ajouts.length - gardes.length };
}

/** Version des règles de mesure : une mesure en cache d'une version antérieure est refaite. */
export const MESURE_V = 2;

async function mesurer(c: Candidat, idSynthetique: number): Promise<{ ok: Mesure } | { refus: string }> {
  let coords: LL[];
  if (c.source === "osm" && !c.segments) {
    try { coords = await geometrieParcours("relation", String(c.osm!.id)); }
    catch (e) { return { refus: `tracé OSM illisible (${(e as Error).message})` }; }
  } else {
    const { coords: chaine, totalKm, perduKm } = chainSegmentsMesure(c.segments ?? []);
    if (totalKm > 0 && perduKm / totalKm > 0.25) return { refus: `tracé troué (${Math.round((perduKm / totalKm) * 100)} % écartés)` };
    coords = chaine;
  }
  if (coords.length < 2) return { refus: "tracé vide" };
  const km = Math.round(longueurKm(coords) * 100) / 100;
  if (!enMetropole(coords[0])) return { refus: "hors de France métropolitaine" };
  if (km < 1) return { refus: `trop court (${km} km)` };
  if (km > 400) return { refus: `trop long (${km} km)` };

  const echantillon = alleger(coords, 50, 400);
  const z = await altitudes(echantillon);
  if (!z) return { refus: "altitude IGN indisponible" };                 // passager : remesuré
  const dn = denivele(z);
  if (!dn) return { refus: "altitude IGN incomplète (bord de couverture)" };   // définitif

  const debut = coords[0], fin = coords[coords.length - 1];
  let lieuDebut: Lieu, lieuFin: Lieu;
  try { [lieuDebut, lieuFin] = [await lieu(debut), await lieu(fin)]; }
  catch { return { refus: "API Géo injoignable (à remesurer)" }; }
  if (!lieuDebut) return { refus: "hors de France (aucune commune au départ)" };

  const sport = sportDuCandidat(c, km, dn.dp);
  if (!sport) return { refus: `activité non retenue (${c.nature || c.osm?.route})` };
  const boucle = distanceKm(debut, fin) < 0.3;
  const nomBrut = c.nom || `${c.nature?.split(" · ").pop() || "Itinéraire"} · ${lieuDebut.commune}`;
  const nom = reparerNom({ nom: nomBrut, depart: lieuDebut.commune, arrivee: boucle ? lieuDebut.commune : lieuFin?.commune });
  const duree = Math.round((km / SPEED[sport]) * 60 + (dn.dp / 100) * CLIMB[sport]);
  const w = sport === "Trail" || sport === "Randonnée" || sport === "VTT" ? 1.3 : 1;
  const effort = km + (dn.dp / 100) * w;
  const pente = penteMax(echantillon, z!);
  const src = SOURCES[c.source];
  return { ok: {
    osm_id: c.source === "osm" ? c.osm!.id : idSynthetique,
    osm_type: c.source === "osm" ? "relation" : c.source,
    nom, sport, coords,
    distance_km: km,
    denivele_positif_m: dn.dp, denivele_negatif_m: dn.dm, altitude_min_m: dn.min, altitude_max_m: dn.max,
    type_parcours: boucle ? (estAllerRetour(coords) ? "Aller-retour" : "Boucle") : "Aller simple",
    difficulte: effort < 12 ? "Facile" : effort < 28 ? "Moyen" : "Difficile",
    temps_estime: fmtDuree(duree), duree_min: duree,
    calories_kcal: Math.round(km * KCAL[sport] + dn.dp * 0.9),
    pente_max_pct: pente,
    depart: lieuDebut.commune, arrivee: boucle ? lieuDebut.commune : (lieuFin?.commune ?? null),
    departements: [lieuDebut.departement], region: lieuDebut.region, pays: ["France"],
    lat: Math.round(debut[1] * 1e6) / 1e6, lng: Math.round(debut[0] * 1e6) / 1e6,
    confiance_distance: "haute", confiance_denivele: "IGN RGE ALTI", mesure_v: MESURE_V,
    source: src.attribution, licence: src.licence, cle_source: c.cle,
  } };
}

/** Déjà au catalogue ? Même départ (≤ 400 m), même longueur (± 15 %), même famille de sport. */
export function dejaAuCatalogue(m: { lat: number; lng: number; distance_km: number; sport: string }, catalogue: { lat: number; lng: number; distance_km: number; sport: string }[]): boolean {
  const velo = (s: string) => s === "Vélo (Route)" || s === "VTT";
  return catalogue.some((p) => velo(p.sport) === velo(m.sport)
    && Math.abs(p.distance_km - m.distance_km) <= 0.15 * Math.max(p.distance_km, m.distance_km)
    && distanceKm([p.lng, p.lat], [m.lng, m.lat]) <= 0.4);
}


// ── Doublons à l'échelle de la France : une grille, pour ne comparer que les voisins ─────────
const CELLULE = 0.05;   // ≈ 5 km
const cellule = (p: LL) => `${Math.floor(p[0] / CELLULE)}:${Math.floor(p[1] / CELLULE)}`;
type Cadre = [number, number, number, number];   // lon min, lat min, lon max, lat max
const cadreDe = (c: LL[]): Cadre => c.reduce<Cadre>((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
const MARGE = 0.001;   // ≈ 70 à 110 m : au-delà de la tolérance de 60 m
const seCroisent = (a: Cadre, b: Cadre) => a[0] <= b[2] + MARGE && b[0] <= a[2] + MARGE && a[1] <= b[3] + MARGE && b[1] <= a[3] + MARGE;

export class Grille {
  private cases = new Map<string, { id: string; c: LL[]; cadre: Cadre }[]>();
  ajouter(id: string, c: LL[]) {
    const vus = new Set<string>();
    const e = { id, c, cadre: cadreDe(c) };
    for (const p of c) { const k = cellule(p); if (vus.has(k)) continue; vus.add(k); (this.cases.get(k) ?? this.cases.set(k, []).get(k)!).push(e); }
  }
  /** Un tracé déjà présent qui recouvre `c` à 70 % au moins (ou l'inverse : une portion d'un plus long). */
  doublon(c: LL[]): string | null {
    const vus = new Set<string>();
    const cadre = cadreDe(c);
    // Les 9 cases autour de chaque point : une copie décalée de 15 m peut tomber de l'autre côté
    // d'une limite de case (cas du test du 28/11/2026, à la latitude 49,4 tout ronde).
    const voisines = (p: LL) => [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => `${Math.floor(p[0] / CELLULE) + dx}:${Math.floor(p[1] / CELLULE) + dy}`));
    for (const p of alleger(c, 500, 30)) {
      for (const v of voisines(p).flatMap((k) => this.cases.get(k) ?? [])) {
        if (vus.has(v.id)) continue; vus.add(v.id);
        // Tri rapide (cadres disjoints : rien en commun) avant la mesure au segment, coûteuse.
        if (!seCroisent(cadre, v.cadre)) continue;
        if (recouvrement(c, v.c) >= 0.7 && recouvrement(v.c, c) >= 0.5) return v.id;
      }
    }
    return null;
  }
}

if (process.argv[1]?.endsWith("parcours-importer.ts")) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  CACHE = arg("--cache") ?? "/tmp/pacevo-import";
  mkdirSync(CACHE, { recursive: true });
  const SOURCE_DATA = "data/parcours_certifies.json";
  const catalogue = JSON.parse(readFileSync(SOURCE_DATA, "utf8")) as (Mesure & { osm_id: number; lat: number; lng: number; sport: string })[];
  const connus = new Set(catalogue.map((p) => p.osm_id));
  const parallele = Number(arg("--parallele") ?? 4);

  // Cache en lignes (ajout seulement) : à l'échelle de la France, réécrire un seul gros fichier à
  // chaque mesure prendrait plus de temps que la mesure.
  const lire = <T,>(f: string) => { const m = new Map<string, T>(); if (existsSync(f)) for (const l of readFileSync(f, "utf8").split("\n")) if (l.trim()) { try { const o = JSON.parse(l); m.set(o.k, o.v); } catch { /* ligne coupée */ } } return m; };
  const FM = path.join(CACHE, "mesures.jsonl"), FG = path.join(CACHE, "traces-osm.jsonl");
  const mesures = lire<{ ok?: Mesure; refus?: string }>(FM);
  for (const [k, v] of mesures) if (v.refus && refusPassager(v.refus)) mesures.delete(k);    // à remesurer
  // Une mesure d'avant la règle « altitude trouée = pas de dénivelé » (28/11/2026) est refaite.
  for (const [k, v] of mesures) if (v.ok && v.ok.mesure_v !== MESURE_V) mesures.delete(k);
  const tracesOsm = lire<LL[][] | "super" | "absent">(FG);
  for (const [k, v] of tracesOsm) if (v === "absent") tracesOsm.delete(k);                  // relu
  const debutCatalogue = readFileSync(SOURCE_DATA, "utf8").length;
  const noter = (f: string, k: string, v: unknown) => appendFileSync(f, JSON.stringify({ k, v }) + "\n");

  (async () => {
    const candidats: Candidat[] = [];
    const regions = arg("--regions") === "france" ? REGIONS : (arg("--regions") ?? "").split(",").filter(Boolean);
    for (const r of regions) {
      const cfg = cache<Candidat[]>(`osm-region-${r}`) as unknown as Candidat[];
      const o = Array.isArray(cfg) && cfg.length ? cfg : await candidatsOsm(r, connus);
      garder(`osm-region-${r}`, o);
      console.log(`OSM région ${r} : ${o.length} relations absentes du catalogue`);
      candidats.push(...o.filter((c) => !connus.has(c.osm!.id)));
    }
    if (process.argv.includes("--metropole")) { const m = await candidatsMetropole(); console.log(`Métropole : ${m.length}`); candidats.push(...m); }
    if (arg("--ign")) {
      const enCache = cache<Candidat[]>(`ign-${arg("--ign")}`) as unknown as Candidat[];
      const g = Array.isArray(enCache) && enCache.length ? enCache : await candidatsIgn(arg("--ign"));
      if (!(Array.isArray(enCache) && enCache.length)) garder(`ign-${arg("--ign")}`, g);
      console.log(`IGN BD TOPO : ${g.length}`);
      candidats.push(...g);
    }

    // 1. Les tracés OSM, par paquets.
    const osmIds = candidats.filter((c) => c.source === "osm" && !mesures.has(c.cle)).map((c) => c.osm!.id);
    await tracesOsmParPaquets(osmIds, new Set([...tracesOsm.keys()].map(Number)), (id, v) => { tracesOsm.set(String(id), v); noter(FG, String(id), v); });

    // 2. Les mesures (altitude IGN, communes), en parallèle.
    const idStable = idHache;   // provisoire : l'identifiant définitif est donné à l'acceptation (idsUniques)
    const aFaire = candidats.filter((c) => !mesures.has(c.cle));
    console.log(`${candidats.length} candidats, ${aFaire.length} à mesurer`);
    let passagers = 0;
    for (let i = 0; i < aFaire.length; i += parallele) {
      const lot = aFaire.slice(i, i + parallele);
      const r = await Promise.all(lot.map(async (c) => {
        if (c.source === "osm") {
          const t = tracesOsm.get(String(c.osm!.id));
          if (t === "super") return { refus: "super-relation (sentier en étapes)" };
          if (!t || t === "absent") return { refus: "tracé OSM absent" };
          c = { ...c, segments: t };
        }
        try { return await mesurer(c, idStable(c.cle)); } catch (e) { return { refus: `erreur (${(e as Error).message})` }; }
      }));
      lot.forEach((c, k) => {
        const v = r[k] as { ok?: Mesure; refus?: string };
        if (v.ok) v.ok.coords = alleger(v.ok.coords as LL[], 25, 200);
        mesures.set(c.cle, v);
        if (!(v.refus && refusPassager(v.refus))) noter(FM, c.cle, v);
      });
      passagers += r.filter((v) => (v as { refus?: string }).refus && refusPassager((v as { refus: string }).refus)).length;
      if (Math.floor(i / 200) !== Math.floor((i + parallele) / 200)) console.log(`  mesurés : ${Math.min(i + parallele, aFaire.length)}/${aFaire.length} (refus passagers, à refaire : ${passagers})`);
    }

    // 3. Les acceptés : pas déjà au catalogue (tracé contrôlé, sinon départ + longueur), pas
    //    doublon d'une source déjà retenue. Priorité : OSM, Métropole, IGN.
    const grille = new Grille();
    const tracesCatalogue = arg("--traces-catalogue");
    if (!tracesCatalogue || !existsSync(tracesCatalogue)) console.log("⚠️ sans --traces-catalogue : les doublons du catalogue ne se reconnaissent qu'au départ et à la longueur");
    if (tracesCatalogue && existsSync(tracesCatalogue)) {
      for (const l of readFileSync(tracesCatalogue, "utf8").split("\n")) if (l.trim()) { try { const o = JSON.parse(l); grille.ajouter(`cat-${o.id}`, o.c); } catch { /* ligne coupée */ } }
    }
    // Le catalogue d'AUJOURD'HUI (un audit a pu être appliqué pendant l'import).
    const actuel = JSON.parse(readFileSync(SOURCE_DATA, "utf8")) as typeof catalogue;
    const ids = idsUniques(candidats.filter((c) => c.source !== "osm").map((c) => c.cle), actuel.map((p) => p.osm_id));
    const ordre = { osm: 0, metropole: 1, ign: 2 } as const;
    const acceptes: Mesure[] = [];
    const refus: Record<string, number> = {};
    const compter = (k: string) => { refus[k] = (refus[k] ?? 0) + 1; };
    for (const c of [...candidats].sort((a, b) => ordre[a.source] - ordre[b.source])) {
      const r = mesures.get(c.cle);
      if (!r?.ok) { compter((r?.refus ?? "non mesuré").replace(/\(.*\)/, "").trim()); continue; }
      // Les filtres de source s'appliquent aussi aux candidats d'un cache plus ancien qu'eux.
      if (c.source !== "osm" && citeUnGr(c.nom)) { compter("nom citant un GR®/PR® (FFRandonnée)"); continue; }
      if (c.source === "ign" && !estCleabs(c.cle.replace(/^ign-/, ""))) { compter("identifiant IGN inattendu"); continue; }
      const m = { ...r.ok, ...(c.source !== "osm" ? { osm_id: ids.get(c.cle)! } : {}) } as Mesure & { lat: number; lng: number; sport: string; osm_id: number };
      if (dejaAuCatalogue(m, actuel)) { compter("déjà au catalogue (départ et longueur)"); continue; }
      const d = grille.doublon(m.coords as LL[]);
      if (d) { compter(d.startsWith("cat-") ? "déjà au catalogue (même tracé)" : "doublon d'une autre source"); continue; }
      grille.ajouter(c.cle, m.coords as LL[]);
      // Une « boucle » qui repasse par son aller est un aller-retour (règle du 28/11/2026, appliquée
      // aussi aux mesures en cache, plus anciennes qu'elle).
      if (m.type_parcours === "Boucle" && estAllerRetour(m.coords as LL[])) m.type_parcours = "Aller-retour";
      acceptes.push(m);
    }
    const compte = (f: (m: Mesure) => string) => acceptes.reduce<Record<string, number>>((a, m) => { a[f(m)] = (a[f(m)] ?? 0) + 1; return a; }, {});
    const pres = (lat: number, lng: number) => acceptes.filter((m) => distanceKm([lng, lat], [m.lng as number, m.lat as number]) <= 30).length;
    console.log(JSON.stringify({ candidats: candidats.length, acceptes: acceptes.length,
      autourDe: { Rouen: pres(49.443, 1.099), Paris: pres(48.857, 2.352), Lille: pres(50.629, 3.057), Marseille: pres(43.296, 5.37), Lyon: pres(45.764, 4.836), Grenoble: pres(45.188, 5.724), Chamonix: pres(45.924, 6.869) },
      parSource: compte((m) => String(m.osm_type)), parSport: compte((m) => String(m.sport)), parRegion: compte((m) => String(m.region)), refus,
      exemples: acceptes.filter((_, i) => i % Math.max(1, Math.floor(acceptes.length / 20)) === 0).slice(0, 20).map((m) => `${m.nom} · ${m.sport} · ${m.distance_km} km · D+${m.denivele_positif_m} · ${m.depart}`) }, null, 1));

    if (process.argv.includes("--ecrire")) {
      // Le tracé n'est GARDÉ que pour la Métropole (53 parcours). OSM se relit chez OSM, l'IGN chez
      // l'IGN (route /api/parcours/geometry, type « ign ») : 26 000 tracés embarqués pèseraient des
      // dizaines de Mo dans la fonction serveur.
      const ajout = acceptes.map(({ coords, ...m }) => (m.osm_type === "metropole"
        ? { ...m, coordinates: (coords as LL[]).map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]) }
        : m));
      const relu = readFileSync(SOURCE_DATA, "utf8");
      if (relu.length !== debutCatalogue) console.log("  le catalogue a changé pendant l'import : fusion sur sa version d'aujourd'hui");
      const { catalogue: fusion, ecartes } = fusionner(JSON.parse(relu) as { osm_id: number }[], ajout as unknown as { osm_id: number }[]);
      arreterSiDepasse([{ quoi: "parcours ajoutés", n: fusion.length - actuel.length, max: seuil(process.argv, "--max-ajouts", 30000) }]);
      writeFileSync(SOURCE_DATA, JSON.stringify(fusion));
      console.log(`écrit : ${SOURCE_DATA} (+${fusion.length - actuel.length}, ${ecartes} déjà là, total ${fusion.length})\n⚠️ relancer « npx tsx scripts/parcours-compacter.ts » : la production lit le .min.json.gz`);
    }
  })();
}
