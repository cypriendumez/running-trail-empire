/**
 * LES DÉPARTEMENTS FRANÇAIS — code, nom tel qu'écrit en base, région.
 *
 * ⚠️ POURQUOI (29/09/2026). La colonne `races.department` portait 250 écritures pour ~101
 * départements (« 59 », « Seine et Marne », « Cotes d'Armor »…), et 88 lignes rangées en
 * Île-de-France n'en étaient pas : la Corse (« 20 », « Corse »), la Martinique (« 97 »),
 * et des épreuves ÉTRANGÈRES reprises de jogging-plus avec des codes postaux canadiens,
 * britanniques ou argentins (« H2 » Montréal, « EH » Édimbourg, « C1 » Buenos Aires) —
 * géolocalisées au hasard en France (« Marathon de Toronto » près de Nantes). Cette table
 * permet de ramener chaque ligne à UNE écriture et à la bonne région.
 */

export type Departement = { code: string; nom: string; region: string };

const D = (code: string, nom: string, region: string): Departement => ({ code, nom, region });
const ARA = "auvergne-rhone-alpes", BFC = "bourgogne-franche-comte", BRE = "bretagne", CVL = "centre-val-de-loire",
  COR = "corse", GE = "grand-est", HDF = "hauts-de-france", IDF = "ile-de-france", NOR = "normandie",
  NAQ = "nouvelle-aquitaine", OCC = "occitanie", PDL = "pays-de-la-loire", PACA = "provence-alpes-cote-d-azur";

export const DEPARTEMENTS: Departement[] = [
  D("01", "Ain", ARA), D("02", "Aisne", HDF), D("03", "Allier", ARA), D("04", "Alpes-de-Haute-Provence", PACA),
  D("05", "Hautes-Alpes", PACA), D("06", "Alpes-Maritimes", PACA), D("07", "Ardèche", ARA), D("08", "Ardennes", GE),
  D("09", "Ariège", OCC), D("10", "Aube", GE), D("11", "Aude", OCC), D("12", "Aveyron", OCC),
  D("13", "Bouches-du-Rhône", PACA), D("14", "Calvados", NOR), D("15", "Cantal", ARA), D("16", "Charente", NAQ),
  D("17", "Charente-Maritime", NAQ), D("18", "Cher", CVL), D("19", "Corrèze", NAQ), D("2A", "Corse-du-Sud", COR),
  D("2B", "Haute-Corse", COR), D("21", "Côte-d'Or", BFC), D("22", "Côtes-d'Armor", BRE), D("23", "Creuse", NAQ),
  D("24", "Dordogne", NAQ), D("25", "Doubs", BFC), D("26", "Drôme", ARA), D("27", "Eure", NOR),
  D("28", "Eure-et-Loir", CVL), D("29", "Finistère", BRE), D("30", "Gard", OCC), D("31", "Haute-Garonne", OCC),
  D("32", "Gers", OCC), D("33", "Gironde", NAQ), D("34", "Hérault", OCC), D("35", "Ille-et-Vilaine", BRE),
  D("36", "Indre", CVL), D("37", "Indre-et-Loire", CVL), D("38", "Isère", ARA), D("39", "Jura", BFC),
  D("40", "Landes", NAQ), D("41", "Loir-et-Cher", CVL), D("42", "Loire", ARA), D("43", "Haute-Loire", ARA),
  D("44", "Loire-Atlantique", PDL), D("45", "Loiret", CVL), D("46", "Lot", OCC), D("47", "Lot-et-Garonne", NAQ),
  D("48", "Lozère", OCC), D("49", "Maine-et-Loire", PDL), D("50", "Manche", NOR), D("51", "Marne", GE),
  D("52", "Haute-Marne", GE), D("53", "Mayenne", PDL), D("54", "Meurthe-et-Moselle", GE), D("55", "Meuse", GE),
  D("56", "Morbihan", BRE), D("57", "Moselle", GE), D("58", "Nièvre", BFC), D("59", "Nord", HDF),
  D("60", "Oise", HDF), D("61", "Orne", NOR), D("62", "Pas-de-Calais", HDF), D("63", "Puy-de-Dôme", ARA),
  D("64", "Pyrénées-Atlantiques", NAQ), D("65", "Hautes-Pyrénées", OCC), D("66", "Pyrénées-Orientales", OCC),
  D("67", "Bas-Rhin", GE), D("68", "Haut-Rhin", GE), D("69", "Rhône", ARA), D("70", "Haute-Saône", BFC),
  D("71", "Saône-et-Loire", BFC), D("72", "Sarthe", PDL), D("73", "Savoie", ARA), D("74", "Haute-Savoie", ARA),
  D("75", "Paris", IDF), D("76", "Seine-Maritime", NOR), D("77", "Seine-et-Marne", IDF), D("78", "Yvelines", IDF),
  D("79", "Deux-Sèvres", NAQ), D("80", "Somme", HDF), D("81", "Tarn", OCC), D("82", "Tarn-et-Garonne", OCC),
  D("83", "Var", PACA), D("84", "Vaucluse", PACA), D("85", "Vendée", PDL), D("86", "Vienne", NAQ),
  D("87", "Haute-Vienne", NAQ), D("88", "Vosges", GE), D("89", "Yonne", BFC), D("90", "Territoire de Belfort", BFC),
  D("91", "Essonne", IDF), D("92", "Hauts-de-Seine", IDF), D("93", "Seine-Saint-Denis", IDF), D("94", "Val-de-Marne", IDF),
  D("95", "Val-d'Oise", IDF),
  D("971", "Guadeloupe", "guadeloupe"), D("972", "Martinique", "martinique"), D("973", "Guyane", "guyane"),
  D("974", "La Réunion", "la-reunion"), D("976", "Mayotte", "mayotte"),
];

const PAR_CODE = new Map(DEPARTEMENTS.map((d) => [d.code, d]));
const cle = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const PAR_NOM = new Map(DEPARTEMENTS.map((d) => [cle(d.nom), d]));
PAR_NOM.set("reunion", PAR_CODE.get("974")!);

/**
 * Le département désigné par une valeur en base (code ou nom, avec ou sans tirets ni
 * accents), ou `null`. « 20 », « Corse » et « 97 » sont AMBIGUS : il faut les
 * coordonnées pour trancher (`departementParPosition`).
 */
export function departementDe(valeur: unknown): Departement | null {
  const brut = String(valeur ?? "").trim();
  if (/^(0[1-9]|[1-8]\d|9[0-5]|2[ab]|97[12346])$/i.test(brut)) return PAR_CODE.get(brut.toUpperCase()) ?? null;
  return PAR_NOM.get(cle(brut)) ?? null;
}

/** Le département d'un code postal français (« 2A/2B » pour la Corse, 971-976 pour l'outre-mer). */
export function departementDuCodePostal(cp: unknown): Departement | null {
  const s = String(cp ?? "").trim();
  if (!/^\d{5}$/.test(s)) return null;
  if (s.startsWith("97")) return PAR_CODE.get(s.slice(0, 3)) ?? null;
  if (s.startsWith("20")) return PAR_CODE.get(Number(s) < 20200 ? "2A" : "2B") ?? null;
  return PAR_CODE.get(s.slice(0, 2)) ?? null;
}

/**
 * Corse et outre-mer d'après les COORDONNÉES, quand la valeur en base est ambiguë
 * (« 20 », « Corse », « 97 »). Hors de ces boîtes : `null` — on ne devine pas.
 */
export function departementParPosition(lat: unknown, lon: unknown): Departement | null {
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la > 41.3 && la < 43.1 && lo > 8.5 && lo < 9.6) return PAR_CODE.get(la >= 42.2 ? "2B" : "2A")!;
  if (la > 15.8 && la < 16.6 && lo > -61.9 && lo < -60.9) return PAR_CODE.get("971")!;
  if (la > 14.3 && la < 14.95 && lo > -61.3 && lo < -60.7) return PAR_CODE.get("972")!;
  if (la > 2 && la < 6 && lo > -54.7 && lo < -51.5) return PAR_CODE.get("973")!;
  if (la > -21.5 && la < -20.8 && lo > 55.1 && lo < 55.9) return PAR_CODE.get("974")!;
  if (la > -13.1 && la < -12.6 && lo > 44.9 && lo < 45.4) return PAR_CODE.get("976")!;
  return null;
}

/**
 * Une valeur de département qui n'est PAS française : code postal étranger à lettres
 * (« H2 », « EH », « C1 »…). Les numéros de 1 à 95 et les noms connus n'y tombent jamais.
 */
export const departementEtranger = (valeur: unknown) => /^[A-Z][A-Z0-9]$/i.test(String(valeur ?? "").trim());
