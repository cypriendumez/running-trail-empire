// ─────────────────────────────────────────────────────────────────────────────
//  LE CATALOGUE CARTOGRAPHIQUE — fonds, calques et traces.
//
//  ⚠️ CHAQUE URL DE CE FICHIER A ÉTÉ INTERROGÉE POUR DE VRAI le 07/09/2026, et seules
//  celles qui ont répondu 200 avec une vraie image sont ici. C'est la seule façon de ne
//  pas livrer une interface qui ressemble à une carte et qui affiche du vide : un fond
//  cassé ne lève aucune erreur, il laisse un carré gris.
//
//  ⚠️ CE QUI N'Y EST PAS, ET POURQUOI. « IGN Topo 25 » (SCAN 25) répond 400 sur la
//  Géoplateforme : c'est une donnée SOUS LICENCE PAYANTE. Les applications qui
//  l'affichent la vendent dans leur formule haute parce qu'elles ont signé pour. Tant
//  qu'aucun contrat n'est signé, ce fond n'existe pas ici — l'annoncer serait promettre
//  ce qu'on n'a pas, et l'afficher serait l'utiliser sans droit.
//
//  ⚠️ L'ATTRIBUTION N'EST PAS DÉCORATIVE. IGN, Swisstopo, USGS et OpenStreetMap
//  l'exigent par licence ; l'ODbL des traces l'exige explicitement. Chaque entrée porte
//  donc la sienne, et un test vérifie qu'aucune n'est vide.
// ─────────────────────────────────────────────────────────────────────────────

/** Où la source couvre le terrain. Sert à ne pas proposer la Suisse à quelqu'un en Bretagne. */
export type Couverture = "monde" | "fr" | "ch" | "us" | "es" | "de";

export type Source = {
  id: string;
  /** Clé de traduction du nom. Le module est partagé : il ne rend jamais un mot français. */
  cle: string;
  url: string;
  /** Obligatoire par licence. Affichée en permanence sur la carte. */
  attribution: string;
  couverture: Couverture;
  /** Taille de tuile en pixels. 512 chez MapTiler, 256 partout ailleurs — se tromper
   *  décale la carte d'un facteur deux sans qu'aucune erreur ne le signale. */
  taille: 256 | 512;
  zoomMax: number;
  /** Vrai quand la source exige la clé MapTiler : sans elle, on ne la propose pas. */
  besoinCle?: boolean;
};

const K = "{cleMapTiler}";

/** ── FONDS DE CARTE ────────────────────────────────────────────────────────── */
export const FONDS: Source[] = [
  {
    id: "satellite", cle: "fond.satellite",
    url: `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${K}`,
    attribution: "© MapTiler © OpenStreetMap contributors",
    couverture: "monde", taille: 512, zoomMax: 20, besoinCle: true,
  },
  {
    id: "opentopo", cle: "fond.opentopo",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors",
    couverture: "monde", taille: 256, zoomMax: 17,
  },
  {
    id: "ign-plan", cle: "fond.ignPlan",
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    attribution: "© IGN — Géoplateforme",
    couverture: "fr", taille: 256, zoomMax: 19,
  },
  {
    id: "ign-ortho", cle: "fond.ignOrtho",
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    attribution: "© IGN — Géoplateforme",
    couverture: "fr", taille: 256, zoomMax: 19,
  },
  {
    id: "swisstopo", cle: "fond.swisstopo",
    url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    attribution: "© swisstopo",
    couverture: "ch", taille: 256, zoomMax: 18,
  },
  {
    id: "us-topo", cle: "fond.usTopo",
    url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
    attribution: "USGS — The National Map",
    couverture: "us", taille: 256, zoomMax: 16,
  },
  {
    id: "ign-es", cle: "fond.ignEs",
    url: "https://www.ign.es/wmts/mapa-raster?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=MTN&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    attribution: "© Instituto Geográfico Nacional de España",
    couverture: "es", taille: 256, zoomMax: 18,
  },
  {
    id: "bkg-de", cle: "fond.bkgDe",
    url: "https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png",
    attribution: "© BKG (GeoBasis-DE) — TopPlusOpen",
    couverture: "de", taille: 256, zoomMax: 18,
  },
];

/** ── CALQUES par-dessus le fond ────────────────────────────────────────────── */
export const CALQUES: Source[] = [
  {
    // Le calque coloré qui montre où la pente dépasse 30° : c'est LA donnée de sécurité
    // en montagne, et elle est publique en France.
    id: "pentes-fr", cle: "calque.pentesFr",
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    attribution: "© IGN — inclinaison des pentes",
    couverture: "fr", taille: 256, zoomMax: 17,
  },
  {
    // Les courbes de niveau : ce que lit un randonneur pour juger une montée avant de la
    // faire. Whympr ne les propose pas dans les captures ; l'IGN les publie librement.
    id: "courbes-fr", cle: "calque.courbesFr",
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ELEVATION.CONTOUR.LINE&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    attribution: "© IGN — courbes de niveau",
    couverture: "fr", taille: 256, zoomMax: 18,
  },
  {
    // ⚠️ LE STYLE S'APPELLE `estompage_grayscale`, PAS `normal`. Avec `normal`, la
    // Géoplateforme répond 400 — vérifié. Un style faux ne lève aucune erreur côté carte :
    // il laisse un calque vide qu'on croit allumé.
    id: "ombrage-fr", cle: "calque.ombrageFr",
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW&STYLE=estompage_grayscale&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    attribution: "© IGN — estompage du relief",
    couverture: "fr", taille: 256, zoomMax: 18,
  },
];

/**
 * CE QUE JE N'AI PAS PU SOURCER, ET QUI EXISTE POURTANT AILLEURS.
 *
 * ⚠️ TROIS COUCHES DE WHYMPR MANQUENT ICI, ET CE N'EST PAS UN OUBLI :
 *
 * • ORIENTATION DES PENTES et ZONES DE PLAT — le catalogue WMTS de la Géoplateforme a
 *   été interrogé en entier le 07/09/2026 (2,9 Mo de capacités) : il contient
 *   `SLOPES.MOUNTAIN`, `CONTOUR.LINE`, `SHADOW`… et AUCUNE couche d'orientation ni de
 *   zones plates. Elles n'existent pas côté français ; Whympr les calcule ou les achète
 *   ailleurs.
 * • BULLETIN D'AVALANCHES — l'API publique de Météo-France répond 401 : elle exige un
 *   jeton que ce projet n'a pas. Un bulletin d'avalanches approximatif serait pire que
 *   pas de bulletin du tout : on ne l'invente pas.
 *
 * Cette liste est écrite ici pour qu'on sache POURQUOI elles manquent, et pour qu'on
 * n'aille pas les rechercher une seconde fois.
 */
export const NON_SOURCEES = ["orientation des pentes", "zones de plat", "bulletin d'avalanches"] as const;

/** ── TRACES ────────────────────────────────────────────────────────────────── */
export const TRACES: Source[] = [
  {
    id: "rando", cle: "trace.rando",
    url: "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png",
    attribution: "Waymarked Trails — données OpenStreetMap sous ODbL",
    couverture: "monde", taille: 256, zoomMax: 18,
  },
  {
    id: "vtt", cle: "trace.vtt",
    url: "https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png",
    attribution: "Waymarked Trails — données OpenStreetMap sous ODbL",
    couverture: "monde", taille: 256, zoomMax: 18,
  },
  {
    id: "ski", cle: "trace.ski",
    url: "https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png",
    attribution: "Waymarked Trails — données OpenStreetMap sous ODbL",
    couverture: "monde", taille: 256, zoomMax: 18,
  },
  {
    id: "rando-ch", cle: "trace.randoCh",
    url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-wanderwege/default/current/3857/{z}/{x}/{y}.png",
    attribution: "© swisstopo — sentiers de randonnée",
    couverture: "ch", taille: 256, zoomMax: 18,
  },
];

/**
 * LE RELIEF. Une seule source, et c'est elle qui rend la 3D possible : chaque pixel de
 * la tuile encode une altitude. Sans clé MapTiler, il n'y a pas de 3D — et on le DIT
 * plutôt que d'afficher une carte plate en prétendant le contraire.
 */
export const RELIEF = {
  url: `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${K}`,
  attribution: "© MapTiler — modèle numérique de terrain",
  /** Encodage MapTiler : identique à celui de Mapbox (R*256² + G*256 + B) / 10 − 10000. */
  encodage: "mapbox" as const,
  // ⚠️ 256 ET NON 512, bien que MapTiler serve du 512. C'est la valeur avec laquelle le
  // survol 3D de l'application fonctionne depuis des mois : la changer décalerait le
  // relief d'un facteur deux sans qu'aucune erreur ne le signale.
  taille: 256,
  zoomMax: 12,
};

/** Remplace le marqueur de clé. Rend `null` quand la source en exige une et qu'elle manque. */
export function avecCle(url: string, cle: string | undefined): string | null {
  if (!url.includes(K)) return url;
  if (!cle) return null;
  return url.replaceAll(K, cle);
}

/** Sources utilisables ici et maintenant, dans l'ordre d'affichage. */
export function disponibles(liste: Source[], cleMapTiler?: string): Source[] {
  return liste.filter((s) => !s.besoinCle || !!cleMapTiler);
}

/**
 * Attribution à afficher, dédoublonnée et jointe.
 *
 * ⚠️ ELLE EST OBLIGATOIRE, PAS DÉCORATIVE. IGN, swisstopo, USGS et l'ODbL des traces
 * l'exigent. Une carte sans attribution est une carte utilisée sans droit.
 */
export function attributionDe(sources: (Source | null | undefined)[]): string {
  const vues = new Set<string>();
  for (const s of sources) if (s?.attribution) vues.add(s.attribution);
  return [...vues].join(" · ");
}

/**
 * Les paliers d'inclinaison, tels que la montagne les lit.
 *
 * ⚠️ CE SONT DES SEUILS DE SÉCURITÉ RECONNUS, PAS UN CHOIX GRAPHIQUE : le risque
 * d'avalanche devient significatif à partir de 30°, et la très grande majorité des
 * départs se produisent entre 30 et 45°. La légende doit donc rester lisible et ne
 * jamais être « améliorée » en fondu continu.
 */
export const PALIERS_PENTE = [
  { min: 30, max: 35, couleur: "#F2E205" },
  { min: 35, max: 40, couleur: "#F29D0C" },
  { min: 40, max: 45, couleur: "#E8471C" },
  { min: 45, max: 90, couleur: "#A0329B" },
] as const;
