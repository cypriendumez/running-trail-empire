// ─────────────────────────────────────────────────────────────────────────────
//  LES NOMS DE LA MONTAGNE — sommets, refuges, points de vue, cols, lacs.
//
//  Une vue en relief sans toponymes est une image ; avec eux, c'est une carte. Savoir
//  que la pointe en face est l'Aiguille du Midi à 3 842 m est exactement ce qui sert à
//  préparer une sortie.
//
//  ⚠️ LA SOURCE EST OPENSTREETMAP, VIA OVERPASS, ET ELLE EST SOUS ODbL. L'attribution
//  est donc obligatoire — elle est déjà affichée en permanence sur la carte.
//
//  ⚠️ OVERPASS N'EST PAS UN SERVICE GARANTI. Mesuré le 07/09/2026 : le miroir principal
//  a répondu 504 (saturé) et le miroir kumi.systems 200 avec 118 objets. On essaie donc
//  plusieurs miroirs, et l'absence de réponse ne casse RIEN : la carte reste utilisable
//  sans ses étiquettes, elle ne les invente pas.
//
//  ⚠️ ET ON NE DEMANDE QUE CE QU'ON REGARDE. Une requête sur une zone trop large ramène
//  des milliers d'objets et fait tomber le service pour tout le monde ; au-delà d'un
//  certain cadrage on n'interroge simplement pas.
// ─────────────────────────────────────────────────────────────────────────────

export type Toponyme = {
  id: number;
  lat: number;
  lon: number;
  nom: string;
  /** Altitude en mètres, quand OSM la porte. `null` sinon — jamais devinée. */
  altitude: number | null;
  genre: "sommet" | "refuge" | "abri" | "vue" | "col" | "lac";
};

/**
 * Au-delà de cette étendue (en degrés), on n'interroge pas : la requête ramènerait des
 * milliers d'objets illisibles à l'écran et pèserait sur un service public gratuit.
 */
export const ETENDUE_MAX = 0.6;
/**
 * ⚠️ 0,6° A ÉTÉ ÉPROUVÉ, PAS SUPPOSÉ. Tenté à 1,0° pour laisser dézoomer sur les massifs
 * bas : la Bretagne a demandé 18,1 SECONDES à Overpass — le double du délai que le
 * serveur s'accorde, donc une carte sans noms à tous les coups. La limite reste où elle
 * est, et ce n'est pas de la prudence : c'est une mesure.
 */
/** En deçà de ce zoom, la carte est trop large pour que des noms aient un sens. */
export const ZOOM_MIN = 10;

/**
 * Miroirs Overpass, interrogés EN PARALLÈLE.
 *
 * ⚠️ LES INTERROGER L'UN APRÈS L'AUTRE NE MARCHE PAS. Mesuré en dix minutes le
 * 07/09/2026 : kumi.systems répondait 200 avec 118 objets, puis a cessé de répondre
 * (25 s d'attente, aucun code) pendant qu'overpass-api.de servait 35 sommets en 1,6 s.
 * L'ordre de la liste ne veut donc rien dire : la disponibilité bascule d'un quart
 * d'heure à l'autre. On les lance ensemble et on garde la première VRAIE réponse.
 */
export const MIROIRS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/**
 * ⚠️ `overpass.osm.ch` A ÉTÉ RETIRÉ APRÈS MESURE, et ce n'est pas une question de vitesse.
 * Il répond en 0,25 s — plus vite que tous les autres — mais avec 4 sommets là où
 * overpass-api.de en trouve 35 sur le MÊME cadrage de Chamonix. Ce n'est pas de la
 * chance : ce miroir ne porte pas la planète entière. En course parallèle, le plus rapide
 * gagne, et le plus rapide était donc le plus incomplet — une carte presque muette servie
 * en un quart de seconde. Un miroir partiel est pire qu'un miroir lent.
 */
export const MIROIRS_ECARTES = ["https://overpass.osm.ch/api/interpreter"] as const;

/**
 * Ce qu'on demande à OSM.
 *
 * ⚠️ CETTE LISTE A ÉTÉ ÉTENDUE APRÈS MESURE, et chaque ajout a rapporté. Comptés sur le
 * cirque de Gavarnie le 07/09/2026, objets NOMMÉS uniquement :
 *   avec la liste d'origine ......... 243
 *   avec `amenity=shelter` .......... +24 cabanes de montagne réelles
 *                                     (Cabane de Camplong, Cabane d'Estarous…)
 *   avec `mountain_pass=yes` ........ +1 col qu'aucun `saddle` ne portait
 *   total ........................... 268
 *
 * ⚠️ `amenity=shelter` ATTRAPE AUSSI LES ABRIBUS — en théorie. Vérifié en centre-ville
 * de Toulouse : 2 objets, ZÉRO nommé. La règle « sans nom, pas d'étiquette » les écarte
 * donc d'elle-même, et aucun filtre supplémentaire n'est nécessaire.
 *
 * `natural=volcano` ne rapporte rien dans les Pyrénées ni les Alpes, mais couvre la
 * chaîne des Puys — c'est une ligne, et l'oublier priverait toute une région.
 */
const DEMANDES: { genre: Toponyme["genre"]; filtre: string }[] = [
  { genre: "sommet", filtre: "node[natural=peak]" },
  { genre: "sommet", filtre: "node[natural=volcano]" },
  { genre: "refuge", filtre: "node[tourism=alpine_hut]" },
  { genre: "refuge", filtre: "node[tourism=wilderness_hut]" },
  { genre: "abri", filtre: "node[amenity=shelter]" },
  { genre: "vue", filtre: "node[tourism=viewpoint]" },
  { genre: "col", filtre: "node[natural=saddle]" },
  { genre: "col", filtre: "node[mountain_pass=yes]" },
  { genre: "lac", filtre: "node[natural=water][name]" },
];

export function requete(bbox: { sud: number; ouest: number; nord: number; est: number }): string {
  const b = `(${bbox.sud},${bbox.ouest},${bbox.nord},${bbox.est})`;
  const corps = DEMANDES.map((d) => `${d.filtre}${b};`).join("");
  return `[out:json][timeout:25];(${corps});out body;`;
}

/** Vrai quand le cadrage justifie une requête. */
export function interrogeable(
  bbox: { sud: number; ouest: number; nord: number; est: number }, zoom: number,
): boolean {
  if (zoom < ZOOM_MIN) return false;
  return (bbox.nord - bbox.sud) <= ETENDUE_MAX && (bbox.est - bbox.ouest) <= ETENDUE_MAX;
}

type Brut = { id?: number; lat?: number; lon?: number; tags?: Record<string, string> };

/** Le genre d'un objet OSM, ou `null` si ce n'est pas quelque chose qu'on affiche. */
function genreDe(tags: Record<string, string>): Toponyme["genre"] | null {
  // ⚠️ L'ORDRE COMPTE : un objet peut porter plusieurs étiquettes OSM. Un col marqué à la
  // fois `natural=saddle` et `mountain_pass=yes` ne doit apparaître qu'une fois, et un
  // refuge gardé comme refuge plutôt que rétrogradé en abri.
  if (tags.natural === "peak" || tags.natural === "volcano") return "sommet";
  if (tags.natural === "saddle" || tags.mountain_pass === "yes") return "col";
  if (tags.tourism === "alpine_hut" || tags.tourism === "wilderness_hut") return "refuge";
  if (tags.amenity === "shelter") return "abri";
  if (tags.tourism === "viewpoint") return "vue";
  if (tags.natural === "water") return "lac";
  return null;
}

/**
 * Altitude en mètres. OSM l'écrit librement : « 3842 », « 3842 m », « 3 842 »…
 * Une valeur illisible devient `null` — un sommet sans altitude reste un sommet.
 */
export function altitudeDe(brut: unknown): number | null {
  if (typeof brut === "number") return Number.isFinite(brut) ? Math.round(brut) : null;
  if (typeof brut !== "string") return null;
  const n = Number(brut.replace(/\s/g, "").replace(",", ".").replace(/m$/i, ""));
  // Le mont Blanc culmine à 4 807 m et la mer Morte est à −430 : hors de ces bornes,
  // c'est une saisie fautive, pas une altitude.
  return Number.isFinite(n) && n > -500 && n < 9000 ? Math.round(n) : null;
}

/** Transforme la réponse Overpass en toponymes affichables. Tolère n'importe quoi. */
export function lire(reponse: unknown): Toponyme[] {
  const elements = (reponse as { elements?: Brut[] } | null)?.elements;
  if (!Array.isArray(elements)) return [];
  const out: Toponyme[] = [];
  const vus = new Set<number>();
  for (const e of elements) {
    const tags = e?.tags ?? {};
    const nom = String(tags.name ?? "").trim();
    // ⚠️ SANS NOM, PAS D'ÉTIQUETTE. Un point anonyme sur une carte de montagne est du
    // bruit : il occupe la place d'un sommet qui, lui, a un nom.
    if (!nom) continue;
    const genre = genreDe(tags);
    if (!genre) continue;
    if (typeof e.lat !== "number" || typeof e.lon !== "number") continue;
    if (typeof e.id === "number") { if (vus.has(e.id)) continue; vus.add(e.id); }
    out.push({ id: e.id ?? out.length, lat: e.lat, lon: e.lon, nom, altitude: altitudeDe(tags.ele), genre });
  }
  return out;
}

/**
 * Plafond d'étiquettes envoyées à la carte.
 *
 * ⚠️ IL ÉTAIT À 60, ET IL COUPAIT LA MONTAGNE EN DEUX. Mesuré le 07/09/2026 sur le cirque
 * de Gavarnie : 243 objets NOMMÉS dans le cadrage — 188 sommets, 47 cols, 6 refuges. En
 * n'en gardant que 60, on jetait 183 noms réels, dont des cols entiers.
 *
 * J'avais justifié ce plafond par la lisibilité. C'était une erreur de raisonnement :
 * MapLibre écarte LUI-MÊME les étiquettes qui se chevauchent (`text-allow-overlap: false`)
 * et le fait à chaque niveau de zoom. Couper la liste en amont ne rendait donc rien plus
 * lisible — cela retirait seulement des noms qui seraient apparus en zoomant.
 *
 * ⚠️ ET 400 COUPAIT ENCORE, DANS LE MAUVAIS SENS. Recompté le 10/09/2026 au cadrage
 * MAXIMAL autorisé (0,6°) sur les Alpes : 1 892 objets, dont 1 487 NOMMÉS. À 400, on en
 * jetait près de 1 100 — et comme le tri place les sommets les plus HAUTS en tête, ceux
 * qu'on jetait étaient précisément les SOMMETS BAS. Un coureur de moyenne montagne ne
 * voyait donc jamais les siens dès qu'un massif dense entrait dans le cadre.
 *
 * 1 500 couvre le cas le plus dense mesuré. Le poids reste modeste : ~200 Ko bruts, soit
 * une cinquantaine compressés — moins qu'une seule tuile satellite.
 */
export const ETIQUETTES_MAX = 1500;

/** Ordre d'importance : c'est lui qui décide qui reste visible quand deux noms se gênent. */
const RANG: Record<Toponyme["genre"], number> = { sommet: 0, refuge: 1, col: 2, abri: 3, vue: 4, lac: 5 };

export function prioriser(liste: Toponyme[]): Toponyme[] {
  return [...liste]
    .sort((a, b) => {
      if (RANG[a.genre] !== RANG[b.genre]) return RANG[a.genre] - RANG[b.genre];
      return (b.altitude ?? 0) - (a.altitude ?? 0);
    })
    .slice(0, ETIQUETTES_MAX);
}

/**
 * Clé de tri passée à MapLibre.
 *
 * ⚠️ SANS ELLE, LA COLLISION SE RÉSOUT DANS L'ORDRE DES DONNÉES, c'est-à-dire au hasard :
 * un point de vue anonyme pouvait masquer le Vignemale. Plus la clé est BASSE, plus
 * l'étiquette est prioritaire — c'est la convention de MapLibre.
 */
export function cleDeTri(t: Toponyme): number {
  // Un sommet de 3 000 m passe devant un sommet de 2 000 ; un sommet passe devant un col.
  return RANG[t.genre] * 10000 + (9000 - (t.altitude ?? 0));
}

/** Objet GeoJSON prêt pour MapLibre. */
export function versGeoJson(liste: Toponyme[]) {
  return {
    type: "FeatureCollection" as const,
    features: liste.map((t) => ({
      type: "Feature" as const,
      properties: {
        nom: t.nom,
        genre: t.genre,
        // Le libellé porte l'altitude quand elle existe, et RIEN quand elle manque.
        etiquette: t.altitude != null ? `${t.nom}\n${t.altitude} m` : t.nom,
        // Reprise par `symbol-sort-key` : décide qui survit à un chevauchement.
        tri: cleDeTri(t),
        altitude: t.altitude ?? 0,
      },
      geometry: { type: "Point" as const, coordinates: [t.lon, t.lat] },
    })),
  };
}
