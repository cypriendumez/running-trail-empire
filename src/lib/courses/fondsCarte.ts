/**
 * LES FONDS DE LA CARTE « ENREGISTRER » — plan et satellite, ou plan seul.
 *
 * Cyprien, 22/09/2026 : « fais comme sur Strava ». Strava donne un sélecteur de fond
 * au-dessus de la carte ; ici il y en a deux, et ce fichier décide lesquels EXISTENT.
 *
 * ── 27/11/2026 : LA CARTE « FAISAIT VIEILLE » (Cyprien, captures Strava à l'appui) ──
 * Le plan était une IMAGE (tuiles PNG MapTiler `streets-v2`, palette beige) : floue sur
 * un écran Retina, des routes jaunes épaisses, des étiquettes pixelisées. Strava dessine
 * une carte VECTORIELLE : nette à tout zoom, couleurs douces, parcs verts, eau bleue.
 * Le plan est donc désormais un STYLE VECTORIEL rendu par MapLibre :
 *   · les données viennent d'OpenFreeMap (OpenStreetMap, gratuit, sans clé ni quota,
 *     usage commercial autorisé) — aucune facture MapTiler de plus ;
 *   · la palette est la NÔTRE (`stylePacevo`) : on part du style « Liberty » et on le
 *     repeint, façon Strava — fond gris clair, routes blanches, parcs verts, chemins
 *     visibles (c'est là qu'on court), moins de commerces.
 *
 * ⚠️ LE SATELLITE N'EXISTE QUE SI LA CLÉ MAPTILER EXISTE. Sans elle, l'URL répond 403
 * et la carte n'émet aucune erreur : elle reste grise, et l'athlète croit avoir perdu le
 * réseau. On ne propose donc pas le bouton plutôt que de le proposer cassé.
 *
 * L'URL et l'attribution du satellite viennent du catalogue de `lib/trail/couches`, où
 * chaque source a été interrogée pour de vrai : une seule copie de l'adresse.
 */
import { FONDS, CALQUES, TRACES, avecCle, type Couverture } from "@/lib/trail/couches";

/**
 * ── LES MODÈLES DE CARTE (Cyprien, 27/11/2026, vidéo de Strava à l'appui) ──
 * « Strava propose plein de modèles quand on appuie sur le bouton des calques : mets-en
 * autant, en mieux, sans copier-coller. » Les fonds ci-dessous viennent tous du catalogue
 * VÉRIFIÉ de `lib/trail/couches` (chaque adresse interrogée pour de vrai), plus deux
 * styles à nous : Pacevo (clair) et Pacevo Nuit (sombre, pour courir le soir).
 * Les cartes nationales (IGN, swisstopo…) ne sont proposées que dans LEUR pays.
 */
export type IdFond = "plan" | "nuit" | "satellite" | "hybride" | "outdoor" | "topo" | "hiver" | "cyclosm" | "ign-plan" | "ign-photo" | "swisstopo" | "bkg-de" | "ign-es" | "us-topo";

/**
 * Trois fonds de plus (27/11/2026), INTERROGÉS POUR DE VRAI ce jour-là sur une tuile de
 * Rouen (z14) : 200 et une vraie image pour chacun. Outdoor et Hiver sont des styles
 * MapTiler (clé requise, quota compté) ; CyclOSM est le plan cycliste libre d'OpenStreetMap.
 */
const EN_PLUS: { id: IdFond; cle: string; url: string; attribution: string; taille: 256 | 512; zoomMax: number }[] = [
  { id: "outdoor", cle: "f.outdoor", url: "https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key={cleMapTiler}", attribution: "© MapTiler © OpenStreetMap contributors", taille: 512, zoomMax: 20 },
  { id: "hiver", cle: "f.hiver", url: "https://api.maptiler.com/maps/winter-v2/{z}/{x}/{y}.png?key={cleMapTiler}", attribution: "© MapTiler © OpenStreetMap contributors", taille: 512, zoomMax: 20 },
  { id: "cyclosm", cle: "f.cyclosm", url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", attribution: "CyclOSM — © OpenStreetMap contributors", taille: 256, zoomMax: 19 },
];

/** Le style vectoriel de départ — OpenFreeMap « Liberty », repeint par `stylePacevo`. */
export const STYLE_PLAN_URL = "https://tiles.openfreemap.org/styles/liberty";
/** Obligatoire par licence (OpenStreetMap ODbL, OpenMapTiles). Jamais vide. */
export const ATTRIBUTION_PLAN = "© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors";

/**
 * ⚠️ LE REPLI SI LE STYLE NE SE CHARGE PAS (réseau, OpenFreeMap en panne). Une carte
 * vide ne lève rien : on retombe sur les tuiles d'OpenStreetMap, ouvertes à tous.
 */
export const REPLI_PLAN = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  taille: 256 as const,
  zoomMax: 19,
};

export type FondSatellite = {
  id: "satellite";
  /** Clé de traduction du nom — ce module ne rend jamais un mot d'une langue. */
  cle: string;
  url: string;
  attribution: string;
  taille: 256 | 512;
  zoomMax: number;
};

/** Le satellite, s'il est utilisable ici et maintenant (clé MapTiler présente). */
export function satelliteDisponible(cleMapTiler?: string): FondSatellite | null {
  const source = FONDS.find((f) => f.id === "satellite");
  const url = source ? avecCle(source.url, cleMapTiler) : null;
  if (!source || !url) return null;
  return { id: "satellite", cle: "map.satellite", url, attribution: source.attribution, taille: source.taille, zoomMax: source.zoomMax };
}

/** Les fonds proposés, dans l'ordre du sélecteur. Toujours au moins le plan. */
export function fondsCarteDirecte(cleMapTiler?: string): IdFond[] {
  return satelliteDisponible(cleMapTiler) ? ["plan", "satellite"] : ["plan"];
}

// ── LA PALETTE PACEVO ─────────────────────────────────────────────────────────
type Couche = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };
type Style = { layers: Couche[]; [k: string]: unknown };

const GRIS_FOND = "#f2f1ed";
const BATI = "#dfdcd5";
const PARC = "#bfe3a3";
const BOIS = "#a3d389";
const EAU = "#9ccdf2";
const ROUTE = "#ffffff";
const BORD_ROUTE = "#d3d0c8";
const AXE = "#fff6d8";
const BORD_AXE = "#e6cf98";
const CHEMIN = "#7c9a5c";

const RETIREES = new Set(["building-3d", "poi_r20", "poi_r7", "highway-shield-non-us", "highway-shield-us-interstate", "road_shield_us"]);

// 27/11/2026, deuxième passe d'après la vidéo de Strava : verts plus francs (parcs,
// bois), eau plus bleue, et les CHEMINS en vert-olive pointillé — sur la carte de Strava,
// on voit d'abord où l'on peut courir hors des rues.
/** Couleur par identifiant de couche du style Liberty. Absente = inchangée. */
const REPEINT: Record<string, Record<string, unknown>> = {
  background: { "background-color": GRIS_FOND },
  landuse_residential: { "fill-color": "#e9e7e1", "fill-opacity": 0.4 },
  park: { "fill-color": PARC },
  park_outline: { "line-color": PARC },
  landcover_grass: { "fill-color": PARC },
  landcover_wood: { "fill-color": BOIS, "fill-opacity": 0.85 },
  landuse_pitch: { "fill-color": "#d9ead0" },
  landuse_track: { "fill-color": "#d9ead0" },
  landuse_cemetery: { "fill-color": "#dde7d3" },
  landuse_hospital: { "fill-color": "#f1e4e4" },
  landuse_school: { "fill-color": "#ebe8dc" },
  water: { "fill-color": EAU },
  waterway_river: { "line-color": EAU },
  waterway_other: { "line-color": EAU },
  waterway_tunnel: { "line-color": EAU },
  building: { "fill-color": BATI },
};

/**
 * Repeint le style Liberty aux couleurs de Pacevo. Pure : renvoie une COPIE.
 *
 * Les routes se reconnaissent à leur nom (`road_`, `bridge_`, `tunnel_`) : les petites
 * en blanc bordé de gris, les grands axes en crème doux au lieu du jaune-orange criard,
 * les chemins et voies piétonnes en brun pointillé — un coureur doit les voir.
 */
export function stylePacevo<S extends Style>(base: S): S {
  const copie = JSON.parse(JSON.stringify(base)) as S;
  copie.layers = copie.layers
    // Moins de bruit, comme Strava : pas de bâtiments en relief, pas de commerces de
    // second rang, pas de numéros de routes (« D 938 ») en pleine ville.
    .filter((c) => !RETIREES.has(c.id))
    .map((c) => {
      const paint = { ...(c.paint ?? {}), ...(REPEINT[c.id] ?? {}) };
      if (/^(road|bridge|tunnel)_/.test(c.id) && c.type === "line" && !/rail/.test(c.id)) {
        const grand = /motorway|trunk|primary|secondary|tertiary|link/.test(c.id);
        if (/path_pedestrian/.test(c.id) && !/casing/.test(c.id)) {
          paint["line-color"] = CHEMIN;
        } else if (/casing/.test(c.id)) {
          paint["line-color"] = grand ? BORD_AXE : BORD_ROUTE;
        } else {
          paint["line-color"] = grand ? AXE : ROUTE;
        }
      }
      // ⚠️ Les bâtiments à plat s'arrêtent au zoom 14 dans Liberty : au-delà, c'est la
      // couche 3D qui les dessine. Celle-ci retirée, on prolonge la couche à plat — sinon
      // la ville se vide de ses maisons dès qu'on zoome sur sa rue.
      if (c.id === "building") {
        const { maxzoom: _sansPlafond, ...reste } = c as Couche & { maxzoom?: number };
        void _sansPlafond;
        return { ...reste, paint };
      }
      return { ...c, paint };
    });
  return copie;
}


// ── LE CATALOGUE DU TIROIR ────────────────────────────────────────────────────

/** Où placer une couche d'image par rapport au plan vectoriel. */
export type Place = "dessus" | "sous-noms" | "sous-routes";

export type FondCarte = {
  id: IdFond;
  /** Clé de traduction du nom. */
  cle: string;
  /** « vecteur » = notre style repeint ; « image » = tuiles d'une source du catalogue. */
  type: "vecteur" | "image";
  urls?: string[];
  attribution?: string;
  taille?: 256 | 512;
  zoomMax?: number;
  /** « dessus » : la carte a ses propres noms, elle couvre tout (hors nos tracés).
   *  « sous-noms » : une photo, nos noms par-dessus. « sous-routes » : photo + rues + noms. */
  place?: Place;
  couverture: Couverture;
};

/** OpenTopoMap sert sur trois sous-domaines ; MapLibre ne connaît pas `{s}`. */
function sousDomaines(url: string): string[] {
  return url.includes("{s}") ? ["a", "b", "c"].map((x) => url.replace("{s}", x)) : [url];
}

const SOURCE = (id: string) => FONDS.find((f) => f.id === id);

/** Le pays (ou les pays) d'un point — boîtes larges, assez pour choisir quelles cartes proposer. */
export function paysDe(lat: number, lon: number): Couverture[] {
  const dans = (s: number, n: number, o: number, e: number) => lat >= s && lat <= n && lon >= o && lon <= e;
  const p: Couverture[] = ["monde"];
  if (dans(41.2, 51.2, -5.3, 9.7)) p.push("fr");
  if (dans(45.8, 47.9, 5.9, 10.6)) p.push("ch");
  if (dans(47.2, 55.1, 5.8, 15.1)) p.push("de");
  if (dans(35.9, 43.9, -9.4, 3.4)) p.push("es");
  if (dans(24.4, 49.4, -125, -66.9)) p.push("us");
  return p;
}

/** Les fonds proposés ici et maintenant, dans l'ordre du tiroir. */
export function fondsDisponibles(cleMapTiler: string | undefined, centre: [number, number] | null): FondCarte[] {
  const pays = centre ? paysDe(centre[0], centre[1]) : (["monde"] as Couverture[]);
  const sat = satelliteDisponible(cleMapTiler);
  const image = (id: IdFond, sourceId: string, cle: string, place: Place): FondCarte | null => {
    const src = SOURCE(sourceId);
    const url = src ? avecCle(src.url, cleMapTiler) : null;
    if (!src || !url || !pays.includes(src.couverture)) return null;
    return { id, cle, type: "image", urls: sousDomaines(url), attribution: src.attribution, taille: src.taille, zoomMax: src.zoomMax, place, couverture: src.couverture };
  };
  const plus = (id: IdFond): FondCarte | null => {
    const e = EN_PLUS.find((x) => x.id === id);
    const url = e ? avecCle(e.url, cleMapTiler) : null;
    return e && url ? { id, cle: e.cle, type: "image", urls: sousDomaines(url), attribution: e.attribution, taille: e.taille, zoomMax: e.zoomMax, place: "dessus", couverture: "monde" } : null;
  };
  const liste: (FondCarte | null)[] = [
    { id: "plan", cle: "f.plan", type: "vecteur", couverture: "monde" },
    { id: "nuit", cle: "f.nuit", type: "vecteur", couverture: "monde" },
    sat && { id: "satellite", cle: "map.satellite", type: "image", urls: [sat.url], attribution: sat.attribution, taille: sat.taille, zoomMax: sat.zoomMax, place: "sous-noms", couverture: "monde" },
    sat && { id: "hybride", cle: "f.hybride", type: "image", urls: [sat.url], attribution: sat.attribution, taille: sat.taille, zoomMax: sat.zoomMax, place: "sous-routes", couverture: "monde" },
    plus("outdoor"),
    image("topo", "opentopo", "f.topo", "dessus"),
    plus("hiver"),
    plus("cyclosm"),
    image("ign-plan", "ign-plan", "f.ignPlan", "dessus"),
    image("ign-photo", "ign-ortho", "f.ignPhoto", "sous-noms"),
    image("swisstopo", "swisstopo", "f.swisstopo", "dessus"),
    image("bkg-de", "bkg-de", "f.bkgDe", "dessus"),
    image("ign-es", "ign-es", "f.ignEs", "dessus"),
    image("us-topo", "us-topo", "f.usTopo", "dessus"),
  ];
  return liste.filter((f): f is FondCarte => !!f);
}

export type IdCalque = "rando" | "rando-ch" | "vtt" | "velo" | "ski" | "ombrage" | "pentes-fr" | "courbes-fr" | "poi";

export type CalqueCarte = {
  id: IdCalque;
  cle: string;
  groupe: "itineraires" | "relief" | "affichage";
  /** « image » : tuiles transparentes posées dessus ; « ombrage » : calculé du relief ;
   *  « style » : une partie de notre propre style, montrée ou cachée. */
  type: "image" | "ombrage" | "style";
  urls?: string[];
  attribution?: string;
  zoomMax?: number;
  couverture: Couverture;
};

/**
 * Les calques proposés ici et maintenant. ⚠️ L'OMBRAGE vient du relief MapTiler : sans
 * clé, il n'existe pas (on ne le remplace pas par une image plate). Les pentes et les
 * courbes de l'IGN ne couvrent que la France : ailleurs, on ne les propose pas.
 */
export function calquesDisponibles(cleMapTiler: string | undefined, centre: [number, number] | null): CalqueCarte[] {
  const pays = centre ? paysDe(centre[0], centre[1]) : (["monde"] as Couverture[]);
  const depuis = (id: IdCalque, cle: string, groupe: CalqueCarte["groupe"], src: { url: string; attribution: string; zoomMax: number; couverture: Couverture } | undefined): CalqueCarte | null =>
    src && pays.includes(src.couverture) ? { id, cle, groupe, type: "image", urls: sousDomaines(src.url), attribution: src.attribution, zoomMax: src.zoomMax, couverture: src.couverture } : null;
  const rando = TRACES.find((t) => t.id === "rando");
  const liste: (CalqueCarte | null)[] = [
    depuis("rando", "c.rando", "itineraires", rando),
    depuis("vtt", "c.vtt", "itineraires", TRACES.find((t) => t.id === "vtt")),
    // Vélo : même service que la randonnée (Waymarked Trails), interrogé le 27/11/2026 → 200.
    rando ? { id: "velo", cle: "c.velo", groupe: "itineraires", type: "image", urls: [rando.url.replace("/hiking/", "/cycling/")], attribution: rando.attribution, zoomMax: rando.zoomMax, couverture: "monde" } : null,
    depuis("ski", "c.ski", "itineraires", TRACES.find((t) => t.id === "ski")),
    depuis("rando-ch", "c.randoCh", "itineraires", TRACES.find((t) => t.id === "rando-ch")),
    cleMapTiler ? { id: "ombrage", cle: "c.ombrage", groupe: "relief", type: "ombrage", couverture: "monde" } : null,
    depuis("pentes-fr", "c.pentes", "relief", CALQUES.find((c) => c.id === "pentes-fr")),
    depuis("courbes-fr", "c.courbes", "relief", CALQUES.find((c) => c.id === "courbes-fr")),
    { id: "poi", cle: "c.poi", groupe: "affichage", type: "style", couverture: "monde" },
  ];
  return liste.filter((c): c is CalqueCarte => !!c);
}

/** L'adresse de la tuile qui contient un point — pour les vignettes du tiroir (vraie image du quartier). */
export function tuileDe(url: string, lat: number, lon: number, z: number): string {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return url.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

// ── PACEVO NUIT ───────────────────────────────────────────────────────────────
const NUIT: Record<string, Record<string, unknown>> = {
  background: { "background-color": "#16191e" },
  landuse_residential: { "fill-color": "#1d2128", "fill-opacity": 0.6 },
  park: { "fill-color": "#1b3324" }, park_outline: { "line-color": "#1b3324" },
  landcover_grass: { "fill-color": "#1b3324" }, landcover_wood: { "fill-color": "#183020", "fill-opacity": 0.85 },
  landuse_pitch: { "fill-color": "#1e2f24" }, landuse_track: { "fill-color": "#1e2f24" },
  landuse_cemetery: { "fill-color": "#1e2a22" }, landuse_hospital: { "fill-color": "#2a1f22" }, landuse_school: { "fill-color": "#23252a" },
  water: { "fill-color": "#0e2638" }, waterway_river: { "line-color": "#0e2638" }, waterway_other: { "line-color": "#0e2638" }, waterway_tunnel: { "line-color": "#0e2638" },
  // Le contour des bâtiments garde sinon le gris clair du jour : un quadrillage lumineux.
  building: { "fill-color": "#252a32", "fill-outline-color": "#2c323b" },
};

/**
 * Les couleurs de Pacevo Nuit, couche par couche, à partir du style de JOUR déjà repeint :
 * fond presque noir, rues gris ardoise, grands axes ambre sourd, chemins vert mousse, noms
 * en clair sur halo sombre. Pure : renvoie seulement ce qui change.
 */
export function peinturesNuit(jour: { layers: { id: string; type: string; paint?: Record<string, unknown> }[] }): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const c of jour.layers) {
    const p: Record<string, unknown> = { ...(NUIT[c.id] ?? {}) };
    if (/^(road|bridge|tunnel)_/.test(c.id) && c.type === "line" && !/rail/.test(c.id)) {
      const grand = /motorway|trunk|primary|secondary|tertiary|link/.test(c.id);
      if (/path_pedestrian/.test(c.id) && !/casing/.test(c.id)) p["line-color"] = "#5f7d45";
      else if (/casing/.test(c.id)) p["line-color"] = grand ? "#3d3422" : "#23272e";
      else p["line-color"] = grand ? "#6b5a32" : "#3a404a";
    }
    if (/rail/.test(c.id) && c.type === "line") p["line-color"] = "#3a3f47";
    if (c.type === "symbol") { p["text-color"] = "#d4d4d8"; p["text-halo-color"] = "rgba(16,18,22,0.9)"; }
    if (c.type === "line" && /boundary/.test(c.id)) p["line-color"] = "#4b5160";
    if (Object.keys(p).length) out[c.id] = p;
  }
  return out;
}
