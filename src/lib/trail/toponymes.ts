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
  genre: "sommet" | "refuge" | "vue" | "col" | "lac";
};

/**
 * Au-delà de cette étendue (en degrés), on n'interroge pas : la requête ramènerait des
 * milliers d'objets illisibles à l'écran et pèserait sur un service public gratuit.
 */
export const ETENDUE_MAX = 0.6;
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

/** Ce qu'on demande à OSM. Chaque genre correspond à une icône et à une priorité. */
const DEMANDES: { genre: Toponyme["genre"]; filtre: string }[] = [
  { genre: "sommet", filtre: "node[natural=peak]" },
  { genre: "refuge", filtre: "node[tourism=alpine_hut]" },
  { genre: "refuge", filtre: "node[tourism=wilderness_hut]" },
  { genre: "vue", filtre: "node[tourism=viewpoint]" },
  { genre: "col", filtre: "node[natural=saddle]" },
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
  if (tags.natural === "peak") return "sommet";
  if (tags.tourism === "alpine_hut" || tags.tourism === "wilderness_hut") return "refuge";
  if (tags.tourism === "viewpoint") return "vue";
  if (tags.natural === "saddle") return "col";
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
 * Les plus utiles d'abord, puis on coupe.
 *
 * ⚠️ CE PLAFOND N'EST PAS COSMÉTIQUE : au-delà, les étiquettes se chevauchent et la
 * carte devient illisible — exactement l'inverse de ce qu'on cherche. Les sommets HAUTS
 * passent devant : c'est le repère qu'on cherche depuis un versant.
 */
export const ETIQUETTES_MAX = 60;

export function prioriser(liste: Toponyme[]): Toponyme[] {
  const rang: Record<Toponyme["genre"], number> = { sommet: 0, refuge: 1, col: 2, vue: 3, lac: 4 };
  return [...liste]
    .sort((a, b) => {
      if (rang[a.genre] !== rang[b.genre]) return rang[a.genre] - rang[b.genre];
      return (b.altitude ?? 0) - (a.altitude ?? 0);
    })
    .slice(0, ETIQUETTES_MAX);
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
      },
      geometry: { type: "Point" as const, coordinates: [t.lon, t.lat] },
    })),
  };
}
