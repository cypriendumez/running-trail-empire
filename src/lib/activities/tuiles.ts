// ─────────────────────────────────────────────────────────────────────────────
//  VIGNETTE DE PARCOURS SUR UNE VRAIE CARTE.
//
//  Première version : un trait vert sur fond gris. Verdict de l'éditeur, et il avait
//  raison — « ça ne fait pas du tout pro ». Un tracé sans rues ni relief ne dit pas OÙ
//  l'on a couru, et c'est la moitié de ce qu'on regarde dans un fil d'activités.
//
//  L'API « cartes statiques » de MapTiler aurait fait l'image d'un coup : elle répond
//  403 sur la clé du projet (vérifié le 05/09/2026 — les TUILES, elles, répondent 200 ;
//  ce n'est donc pas la clé, c'est le plan qui n'inclut pas ce service). On compose donc
//  la carte comme le ferait Leaflet : les quelques tuiles qui couvrent le parcours,
//  posées côte à côte, et le tracé en SVG par-dessus. Aucune bibliothèque, aucun
//  JavaScript côté client, et les tuiles se partagent d'une carte à l'autre puisque
//  l'athlète court presque toujours au même endroit.
//
//  ⚠️ La taille des tuiles DÉPEND du fournisseur : 512 px chez MapTiler, 256 px sur
//  OpenStreetMap (mesuré, pas supposé). Se tromper décale toute la mosaïque.
// ─────────────────────────────────────────────────────────────────────────────
/** Un point de trace. Seul le couple lat/lon compte pour dessiner. */
export type Point = { lat: number; lon: number };

export type Tuile = { z: number; x: number; y: number; gauche: number; haut: number };
export type PlanCarte = {
  zoom: number; tailleTuile: number; largeur: number; hauteur: number;
  tuiles: Tuile[]; chemin: string;
};

/** Au-delà, on voit les pavés d'une place et plus le parcours. */
export const ZOOM_MAX = 15;
/** En deçà, ce n'est plus une carte de sortie mais une carte de pays. */
export const ZOOM_MIN = 3;
/** Latitude limite de la projection de Mercator : au-delà, y part à l'infini. */
export const LAT_MAX = 85.05112878;

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Coordonnée du point dans le « monde » en pixels, à ce zoom et pour cette tuile. */
export function mondePx(lat: number, lon: number, z: number, tailleTuile: number): { x: number; y: number } {
  const n = tailleTuile * Math.pow(2, z);
  const l = Math.max(-LAT_MAX, Math.min(LAT_MAX, lat));
  const rad = (l * Math.PI) / 180;
  // Le bornage final n'est pas de la superstition : LAT_MAX est la valeur CONVENTIONNELLE
  // (85,05112878), très légèrement supérieure à la limite exacte atan(sinh(π)). Sans lui,
  // un point au pôle ressortait à -1e-10 px, donc hors du monde — et la tuile qui le
  // contient n'existe pas.
  return {
    x: Math.min(n, Math.max(0, ((lon + 180) / 360) * n)),
    y: Math.min(n, Math.max(0, ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)),
  };
}

export type OptionsCarte = {
  largeur: number; hauteur: number; tailleTuile?: number; zoomMax?: number;
  /** Marge uniforme, ou séparée : la carte est plus large que la bande où le parcours
   *  doit tenir, pour qu'il reste entier même sur un téléphone qui rogne les côtés. */
  marge?: number; margeX?: number; margeY?: number;
};

/**
 * Plan complet d'une vignette : quelles tuiles chercher, où les poser, et le tracé
 * exprimé dans le repère de la vignette. Rend `null` quand il n'y a rien d'honnête à
 * montrer (trace trop courte, ou immobile).
 */
export function planCarte(points: readonly Point[], o: OptionsCarte): PlanCarte | null {
  const { largeur, hauteur } = o;
  const margeX = o.margeX ?? o.marge ?? 8;
  const margeY = o.margeY ?? o.marge ?? 8;
  const tailleTuile = o.tailleTuile ?? 512;
  const zoomMax = Math.min(o.zoomMax ?? ZOOM_MAX, ZOOM_MAX);
  if (!(largeur > 2 * margeX) || !(hauteur > 2 * margeY) || !(tailleTuile > 0)) return null;

  const pts = (points ?? []).filter((p) => p && fini(p.lat) && fini(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
  if (pts.length < 8) return null;
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  if (Math.max(...lats) === Math.min(...lats) && Math.max(...lons) === Math.min(...lons)) return null;

  // Le plus GRAND zoom auquel le parcours tient encore dans la vignette : on veut voir
  // les rues, pas la région.
  const utileX = largeur - 2 * margeX, utileY = hauteur - 2 * margeY;
  let zoom = ZOOM_MIN;
  for (let z = zoomMax; z >= ZOOM_MIN; z--) {
    const a = mondePx(Math.min(...lats), Math.min(...lons), z, tailleTuile);
    const b = mondePx(Math.max(...lats), Math.max(...lons), z, tailleTuile);
    if (Math.abs(b.x - a.x) <= utileX && Math.abs(b.y - a.y) <= utileY) { zoom = z; break; }
  }

  const coins = [
    mondePx(Math.min(...lats), Math.min(...lons), zoom, tailleTuile),
    mondePx(Math.max(...lats), Math.max(...lons), zoom, tailleTuile),
  ];
  const centre = { x: (coins[0].x + coins[1].x) / 2, y: (coins[0].y + coins[1].y) / 2 };
  const origine = { x: centre.x - largeur / 2, y: centre.y - hauteur / 2 };

  const dernier = Math.pow(2, zoom) - 1;
  const tuiles: Tuile[] = [];
  for (let tx = Math.floor(origine.x / tailleTuile); tx <= Math.floor((origine.x + largeur - 1) / tailleTuile); tx++) {
    for (let ty = Math.floor(origine.y / tailleTuile); ty <= Math.floor((origine.y + hauteur - 1) / tailleTuile); ty++) {
      // Hors du monde : il n'existe pas de tuile à demander, et en réclamer une donne
      // un 404 affiché comme une image cassée.
      if (ty < 0 || ty > dernier) continue;
      const x = ((tx % (dernier + 1)) + dernier + 1) % (dernier + 1); // le monde s'enroule en longitude
      tuiles.push({ z: zoom, x, y: ty, gauche: tx * tailleTuile - origine.x, haut: ty * tailleTuile - origine.y });
    }
  }

  const arrondi = (v: number) => Math.round(v * 10) / 10;
  const chemin = pts.map((p, i) => {
    const w = mondePx(p.lat, p.lon, zoom, tailleTuile);
    return `${i === 0 ? "M" : "L"}${arrondi(w.x - origine.x)} ${arrondi(w.y - origine.y)}`;
  }).join("");

  return { zoom, tailleTuile, largeur, hauteur, tuiles, chemin };
}

/** Style choisi EN LE REGARDANT, pas d'après son poids. Premier essai : `dataviz-light`,
 *  le plus léger — et quasiment blanc, donc un rectangle vide à la taille d'une vignette
 *  (constaté à l'écran). `basic-v2` montre routes, eau et espaces verts sans les écussons
 *  d'autoroute, illisibles à cette échelle. */
export const STYLE_TUILE = "basic-v2";

/** URL d'une tuile. Sans clé, repli sur OpenStreetMap — dont les tuiles font 256 px. */
export function urlTuile(t: Tuile, cle: string): string {
  return cle
    ? `https://api.maptiler.com/maps/${STYLE_TUILE}/${t.z}/${t.x}/${t.y}.png?key=${cle}`
    : `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
}

/** Taille des tuiles du fournisseur retenu. MESURÉE, pas supposée. */
export function tailleTuileDe(cle: string): number { return cle ? 512 : 256; }

/** Mention obligatoire, dans la formulation déjà employée par les cartes du projet. */
export function attributionCarte(cle: string): string {
  return cle ? "© MapTiler © OpenStreetMap" : "© OpenStreetMap";
}
