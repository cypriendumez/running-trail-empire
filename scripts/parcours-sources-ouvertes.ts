/**
 * LES SOURCES OUVERTES DE PARCOURS (métropoles, villes, parcs, départements) — 28/11/2026.
 *
 * Cyprien : « quand je vais à Lille il met aucun parcours de running… trouve bien plus de
 * parcours, vérifie à chaque fois, aucune erreur et aucun doublon ». Chaque jeu ci-dessous a été
 * relu À SA SOURCE : licence permettant l'usage commercial avec attribution (Licence Ouverte /
 * Etalab, ou ODbL — le catalogue est lui-même sous ODbL, data/LICENCE.md), page de la licence
 * notée dans `page`. Écartés : les jeux sans licence écrite, les API Geotrek sans licence (seul
 * l'export publié sur data.gouv.fr porte la sienne), l'équestre, l'alpinisme, la moto, les réseaux
 * « points-nœuds », et tout ce qui relève de la FFRandonnée (`marqueFfrandonnee`).
 *
 * Chaque adaptateur rend des candidats bruts ; la mesure (chaînage, tracé troué refusé, altitude
 * IGN, commune, sport) et le dédoublonnage sont ceux de l'import national (parcours-importer.ts).
 */
type LL = [number, number];
type Geometrie = { type: string; coordinates?: unknown; geometries?: Geometrie[] };
type Objet = { properties: Record<string, unknown>; geometry: Geometrie | null };

/** Le sport donné par la source : précis (`Running`, `Trail`…), « à pied » (le relief tranche), ou `null` (écarté). */
export type Indice = "Running" | "Trail" | "VTT" | "Vélo (Route)" | "à pied" | null;

export type CandidatOuvert = { id: string; nom: string; indice: Indice; segments: LL[][]; reseau?: string };

export type SourceOuverte = {
  cle: string;                 // court, stable : entre dans l'identifiant de chaque parcours
  url: string;
  attribution: string;         // « Producteur, jeu (date) » : la Licence Ouverte exige source ET date
  licence: "Licence Ouverte 2.0" | "Licence Ouverte 1.0" | "ODbL 1.0";
  page: string;                // où la licence est écrite
  lire: (objets: Objet[]) => CandidatOuvert[];
};

/** Toutes les lignes d'une géométrie (LineString, MultiLineString, GeometryCollection). */
export function lignes(g: Geometrie | null | undefined): LL[][] {
  if (!g) return [];
  if (g.type === "LineString") return [g.coordinates as LL[]];
  if (g.type === "MultiLineString") return g.coordinates as LL[][];
  if (g.type === "GeometryCollection") return (g.geometries ?? []).flatMap(lignes);
  return [];
}

const txt = (v: unknown) => (v == null || v === "None" ? "" : String(v)).trim();

/** « À pied », « Pédestre », « pedestre », « A pied », « piéton » … */
export function indiceDePratique(p: string): Indice {
  const s = p.toLowerCase();
  if (/équestre|equestre|cheval|alpinisme|moto|points?-n(œ|oe)uds|raquette|ski/.test(s)) return null;
  if (/trail/.test(s)) return "Trail";
  if (/vtt|gravel/.test(s)) return "VTT";
  if (/running|jogging|course/.test(s)) return "Running";
  if (/v[ée]lo|cyclo/.test(s)) return "Vélo (Route)";
  if (/pied|p[ée]destre|pi[ée]ton|marche|randonn/.test(s)) return "à pied";
  return null;
}

const ODS = (portail: string, jeu: string) => `https://${portail}/api/explore/v2.1/catalog/datasets/${jeu}/exports/geojson`;
const parObjet = (o: Objet, i: number, cle: string) => txt(o.properties[cle]) || String(i);

export const SOURCES_OUVERTES: SourceOuverte[] = [
  // ── Course à pied en ville ────────────────────────────────────────────────────────────────
  { cle: "strasbourg", url: ODS("data.strasbourg.eu", "boucles_sportives_vitaboucle"),
    attribution: "Eurométropole de Strasbourg, boucles sportives Vitaboucle", licence: "Licence Ouverte 2.0",
    page: "https://data.strasbourg.eu/explore/dataset/boucles_sportives_vitaboucle/information/",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "id"), nom: `Vitaboucle · ${txt(o.properties.nom)}`, indice: "Running", segments: lignes(o.geometry) })) },
  { cle: "mulhouse", url: ODS("data.mulhouse-alsace.fr", "68224_sport_running-mulhouse"),
    attribution: "Ville de Mulhouse, parcours de running (2024)", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/les-parcours-de-running-de-la-ville-de-mulhouse",
    lire: (os) => os.map((o, i) => ({ id: String(i), nom: txt(o.properties.nom_circui), indice: "Running", segments: lignes(o.geometry) })) },
  { cle: "cannes-ut", url: ODS("data.cannes.fr", "parcours-cannes-urban-trail"),
    attribution: "Ville de Cannes, Cannes Urban Trail", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/parcours-sportifs-cannes-urban-trail",
    lire: (os) => os.map((o, i) => ({ id: String(i), nom: `Cannes Urban Trail · ${txt(o.properties.parcours)}`, indice: "Running", segments: lignes(o.geometry) })) },
  { cle: "cannes-sp", url: ODS("data.cannes.fr", "parcours-super-parc"),
    attribution: "Ville de Cannes, Super Parcours", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/parcours-sportifs-cannes-urban-trail",
    lire: (os) => os.map((o, i) => ({ id: String(i), nom: `Super Parcours · ${txt(o.properties.parcours)}`, indice: "Running", segments: lignes(o.geometry) })) },
  { cle: "bayonne", url: "https://www.bayonne.fr/fileadmin/open-data/geojson/bayonne_parcours_trace.geojson",
    attribution: "Ville de Bayonne, parcours sportifs urbains", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/parcours-sportifs-urbains-bayonne",
    lire: (os) => os.filter((o) => !/ferm/i.test(txt(o.properties.statut))).map((o, i) => ({ id: parObjet(o, i, "ogc_fid"), nom: txt(o.properties.nom_parcours), indice: "Running", segments: lignes(o.geometry) })) },
  { cle: "sqy", url: "https://opendata.sqy.fr/data-fair/api/v1/datasets/parcours-sportifs-ca-saint-quentin-en-yvelines/raw",
    attribution: "Saint-Quentin-en-Yvelines, parcours sportifs", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/parcours-sportifs-ca-saint-quentin-en-yvelines",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "ID"), nom: txt(o.properties.NOM), indice: "Running", segments: lignes(o.geometry) })) },
  { cle: "rennes", url: ODS("data.rennesmetropole.fr", "parcours-pedestres-sur-la-ville-de-rennes"),
    attribution: "Ville de Rennes, parcours pédestres (2018)", licence: "ODbL 1.0",
    page: "https://data.rennesmetropole.fr/explore/dataset/parcours-pedestres-sur-la-ville-de-rennes/information/",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "objectid"), nom: txt(o.properties.denomination),
      indice: /jogging/i.test(txt(o.properties.type)) ? "Running" : /rustique/i.test(txt(o.properties.type)) ? "Running" : "à pied", segments: lignes(o.geometry) })) },
  { cle: "toulouse-balade", url: ODS("data.toulouse-metropole.fr", "balade"),
    attribution: "Toulouse Métropole, itinéraires des balades", licence: "Licence Ouverte 2.0",
    page: "https://data.toulouse-metropole.fr/explore/dataset/balade/information/",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "id"), nom: txt(o.properties.nom), indice: /sport/i.test(txt(o.properties.nom)) ? "Running" : "à pied", segments: lignes(o.geometry) })) },
  { cle: "toulouse-velo", url: ODS("data.toulouse-metropole.fr", "randonnees-velos"),
    attribution: "Toulouse Métropole, rando-vélos", licence: "Licence Ouverte 2.0",
    page: "https://data.toulouse-metropole.fr/explore/dataset/randonnees-velos/information/",
    lire: (os) => os.map((o, i) => ({ id: String(i), nom: txt(o.properties.nom), indice: "Vélo (Route)", segments: lignes(o.geometry) })) },
  { cle: "lyon", url: "https://data.grandlyon.com/geoserver/metropole-de-lyon/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=metropole-de-lyon:boucle-de-randonnee&outputFormat=application/json&SRSNAME=EPSG:4326",
    attribution: "Métropole de Lyon, boucles communales de randonnée", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/boucles-communales-de-randonnee-de-la-metropole-de-lyon-1",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "gid"), nom: txt(o.properties.nom), indice: "à pied", segments: lignes(o.geometry) })) },
  { cle: "paris", url: ODS("opendata.paris.fr", "paris-autrement-balades-dans-les-arrondissements-peripheriques-parcours"),
    attribution: "Ville de Paris, Paris autrement – balades", licence: "ODbL 1.0",
    page: "https://opendata.paris.fr/explore/dataset/paris-autrement-balades-dans-les-arrondissements-peripheriques-parcours/information/",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "identifiant"), nom: txt(o.properties.titre_balade), indice: "à pied", segments: lignes(o.geometry) })) },
  { cle: "idf-loisirs", url: ODS("data.iledefrance.fr", "iles_de_loisirs_itineraires"),
    attribution: "Région Île-de-France, itinéraires des îles de loisirs", licence: "Licence Ouverte 2.0",
    page: "https://data.iledefrance.fr/explore/dataset/iles_de_loisirs_itineraires/information/",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "idl") + `-${i}`, nom: txt(o.properties.nom_iti), indice: indiceDePratique(txt(o.properties.type_iti)), segments: lignes(o.geometry) })) },
  { cle: "tours", url: ODS("data.tours-metropole.fr", "circuit-de-randonnee-pedestre"),
    attribution: "Tours Métropole Val de Loire, circuits de randonnée pédestre (2020)", licence: "Licence Ouverte 2.0",
    page: "https://data.tours-metropole.fr/explore/dataset/circuit-de-randonnee-pedestre/information/",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "id_circuit"), nom: txt(o.properties.libelle).replace(/\s+/g, " "), indice: "à pied", segments: lignes(o.geometry) })) },
  { cle: "clermont", url: ODS("opendata.clermontmetropole.eu", "21-circuits-de-randonnee-la-metro-en-balade"),
    attribution: "Clermont Auvergne Métropole, la Métro en balade", licence: "Licence Ouverte 2.0",
    page: "https://opendata.clermontmetropole.eu/explore/dataset/21-circuits-de-randonnee-la-metro-en-balade/information/",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "id"), nom: txt(o.properties.nom_itineraire), indice: indiceDePratique(txt(o.properties.pratique)), segments: lignes(o.geometry) })) },
  // ── Trail et montagne ─────────────────────────────────────────────────────────────────────
  { cle: "isere-trail", url: ODS("opendata.isere.fr", "pdesi_trail"),
    attribution: "Département de l'Isère, PDESI Trail", licence: "Licence Ouverte 2.0",
    page: "https://opendata.isere.fr/explore/dataset/pdesi_trail/information/",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "id"), nom: txt(o.properties.nom_parcours), indice: "Trail", segments: lignes(o.geometry) })) },
  { cle: "cevennes", url: "https://static.data.gouv.fr/resources/itineraires-de-randonnee-du-parc-national-des-cevennes/20260529-132416/itineraires-rando-export.json",
    attribution: "Parc national des Cévennes, itinéraires de randonnée (05/2026)", licence: "Licence Ouverte 1.0",
    page: "https://www.data.gouv.fr/datasets/itineraires-de-randonnee-du-parc-national-des-cevennes",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "id_local"), nom: txt(o.properties.nom_itineraire), indice: indiceDePratique(txt(o.properties.pratique)), segments: lignes(o.geometry), reseau: `${txt(o.properties.balisage)} ${txt(o.properties.reseaux)}` })) },
  { cle: "ecrins", url: "https://data.ecrins-parcnational.fr/files/randos_pne.geojson",
    attribution: "Parc national des Écrins, randonnées", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/randonnees-du-parc-national-des-ecrins",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "id_source"), nom: txt(o.properties.nom), indice: indiceDePratique(txt(o.properties.pratique)), segments: lignes(o.geometry), reseau: `${txt(o.properties.balisage)} ${txt(o.properties.reseaux)}` })) },
  { cle: "pnr-paca", url: "https://www.datasud.fr/geoserver/parcs-naturels-regionaux-de-provence-alpes-cote-dazur/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=parcs-naturels-regionaux-de-provence-alpes-cote-dazur:itineraires-de-randonnees-a-pied-a-velo-a-vtt-et-a-cheval&outputFormat=application/json&srsName=EPSG:4326",
    attribution: "Parcs naturels régionaux de Provence-Alpes-Côte d'Azur, Chemins des Parcs", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/parcs-naturels-regionaux-itineraires-de-randonnees-a-pied-a-velo-a-vtt-et-a-cheval-publie-dans-chemins-des-parcs",
    // Le nom porte la commune en tête, en majuscules (« ARLES - Le marais… ») : on garde le titre.
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "id"), nom: txt(o.properties.name_fr).replace(/^[A-ZÀ-Ü' -]{3,}\s-\s/, ""), indice: indiceDePratique(txt(o.properties.practice)), segments: lignes(o.geometry), reseau: txt(o.properties.network) })) },
  { cle: "nice-vtt", url: "https://opendata.nicecotedazur.org/data/storage/f/2015-10-21T08%3A57%3A22.609Z/sentiers-vtt-nca-1.geojson",
    attribution: "Métropole Nice Côte d'Azur, sentiers VTT (2015)", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/cartographie-des-sentiers-vtt-des-communes-de-la-metropole",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "ID_NCA"), nom: txt(o.properties.NOM), indice: "VTT", segments: lignes(o.geometry) })) },
  // ── Départements ─────────────────────────────────────────────────────────────────────────
  { cle: "loire-atlantique", url: ODS("data.loire-atlantique.fr", "224400028_itineraires-de-promenade-et-de-randonnee-en-loire-atlantique-pdipr"),
    attribution: "Département de Loire-Atlantique, PDIPR (2021)", licence: "Licence Ouverte 2.0",
    page: "https://data.loire-atlantique.fr/explore/dataset/224400028_itineraires-de-promenade-et-de-randonnee-en-loire-atlantique-pdipr/information/",
    lire: (os) => os.map((o, i) => {
      const cat = txt(o.properties.cat);
      return { id: parObjet(o, i, "gencomm"), nom: txt(o.properties.nomoffre), indice: /p[ée]destre/i.test(cat) ? "à pied" as const : /vtt/i.test(cat) ? "VTT" as const : null, segments: lignes(o.geometry), reseau: txt(o.properties.type_ffrp) };
    }) },
  { cle: "doubs", url: ODS("opendata.doubs.fr", "itineraires-randonnee-exploredoubs"),
    attribution: "Département du Doubs, itinéraires de randonnée", licence: "ODbL 1.0",
    page: "https://www.data.gouv.fr/datasets/itineraires-de-randonnee",
    lire: (os) => os.map((o, i) => ({ id: String(i), nom: txt(o.properties.name_fr), indice: indiceDePratique(txt(o.properties.practice)), segments: lignes(o.geometry), reseau: txt(o.properties.network) })) },
  { cle: "calvados", url: "https://data.calvados.fr/environnement/itineraires_randonnees.geojson",
    attribution: "Département du Calvados, circuits qualité", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/itineraires-de-randonnee-circuits-qualite-departement-du-calvados",
    lire: (os) => os.map((o, i) => ({ id: parObjet(o, i, "id"), nom: txt(o.properties.nom), indice: indiceDePratique(txt(o.properties.pratique_defaut)), segments: lignes(o.geometry) })) },
  // ── Lille : voies vertes de la MEL (regroupées par liaison, seulement celles qui EXISTENT) ──
  { cle: "mel-voies-vertes", url: "https://data.lillemetropole.fr/geoserver/ogc/features/v1/collections/mel_espacepublic:voies_vertes_chemins/items?f=json&limit=5000",
    attribution: "Métropole Européenne de Lille, voies vertes", licence: "Licence Ouverte 2.0",
    page: "https://www.data.gouv.fr/datasets/voies-vertes-mel-a-horizon-2026-1",
    lire: (os) => {
      const par = new Map<string, LL[][]>();
      for (const o of os) {
        if (txt(o.properties.etat2020) !== "EXI") continue;            // « PRO » : en projet, pas encore praticable
        const n = txt(o.properties.nom_liaiso);
        if (!n) continue;
        par.set(n, [...(par.get(n) ?? []), ...lignes(o.geometry)]);
      }
      return [...par].map(([n, segs]) => ({ id: n, nom: `Voie verte · ${n}`, indice: "Vélo (Route)" as const, segments: segs }));
    } },
];
