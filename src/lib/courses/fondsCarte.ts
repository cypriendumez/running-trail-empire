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
import { FONDS, avecCle } from "@/lib/trail/couches";

export type IdFond = "plan" | "satellite";

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
const PARC = "#c6e4b0";
const BOIS = "#b5d99c";
const EAU = "#a9d2f0";
const ROUTE = "#ffffff";
const BORD_ROUTE = "#d3d0c8";
const AXE = "#fff6d8";
const BORD_AXE = "#e6cf98";
const CHEMIN = "#c4b79d";

const RETIREES = new Set(["building-3d", "poi_r20", "poi_r7", "highway-shield-non-us", "highway-shield-us-interstate", "road_shield_us"]);

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
