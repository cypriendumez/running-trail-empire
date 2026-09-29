/**
 * COURSES LOCALES DEPUIS DATATOURISME — la base nationale des offices de tourisme.
 *
 * Pourquoi (29/09/2026) : finishers ne couvre pas les petites courses locales (22 %
 * d'absentes sur un échantillon kikourou de 12 départements). DATAtourisme publie chaque
 * jour, sous LICENCE OUVERTE 2.0 (réutilisation commerciale permise, avec mention de la
 * source), les manifestations déclarées par les offices de tourisme — dont des courses.
 * Fichier : data.gouv.fr, « datatourisme-fma.csv ».
 *
 * ⚠️ LA SOURCE EST BRUITÉE ET SANS DISTANCE STRUCTURÉE. Sur 77 484 manifestations, un
 * filtre large trouvait 558 « courses » — dont « Marathon de tarot », « Tracto Cross »,
 * randonnées et marches roses. D'où un filtre STRICT (nom de course sans ambiguïté, rien
 * qui ressemble à une marche, au moins une distance lisible ≥ 4 km) : peu de courses,
 * mais de vraies courses. Mieux vaut en manquer que d'afficher une randonnée.
 */
import { estChrono, typeDe } from "./majFinishers";
import { departementDuCodePostal, type Departement } from "./departements";
import { motsDistinctifs } from "./resultatsSite";

/** Lecture CSV (RFC 4180) : guillemets, guillemets doublés, retours à la ligne dans un champ. */
export function lireCsv(texte: string): string[][] {
  const lignes: string[][] = [];
  let champ = "", ligne: string[] = [], dansGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansGuillemets) {
      if (c === '"') { if (texte[i + 1] === '"') { champ += '"'; i++; } else dansGuillemets = false; }
      else champ += c;
    } else if (c === '"') dansGuillemets = true;
    else if (c === ",") { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ); champ = ""; lignes.push(ligne); ligne = [];
    } else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes;
}

const forme = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9,.]+/g, " ").trim();
const COURSE = /\b(trail|corrida|foulee|foulees|course pedestre|courses pedestres|course a pied|semi marathon|marathon|cross|ekiden|kilometre vertical|urban trail|10 km|10km)\b/;
const PAS_UNE_COURSE = /\b(marche|marches|rando|randonnee|randonnees|balade|promenade|initiation|vtt|velo|cyclo|equestre|cheval|kayak|canoe|natation|nage|triathlon|duathlon|aquathlon|swimrun|moto|motocross|tracto|auto|voiture|tarot|belote|petanque|orientation|tresor|chasse|enfants|jeunes|zumba|yoga|apero|kids|camarguaise|landaise|caisses|escape|jeu|jeux)\b/;
// « 5, 10 et 21 km » : toutes les valeurs d'une énumération qui se termine par « km ».
const ENUM_KM = /((?:\d{1,3}(?:[.,]\d{1,2})?\s*(?:,|et|&|\/|-|ou)\s*)*\d{1,3}(?:[.,]\d{1,2})?)\s?(?:km|kms|kilometres)\b/g;

/** Les distances lues dans un texte (4 à 250 km), dédoublonnées, triées. */
export function distancesLues(texte: string): number[] {
  const out = new Set<number>();
  for (const m of forme(texte).matchAll(ENUM_KM)) {
    for (const n of m[1].match(/\d{1,3}(?:[.,]\d{1,2})?/g) ?? []) {
      const km = Number(n.replace(",", "."));
      if (km >= 4 && km <= 250) out.add(Math.round(km * 10) / 10);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export type EvenementDT = {
  nom: string; commune: string; departement: Departement; date: string; kms: number[];
  lat: number | null; lon: number | null; site: string; uri: string;
};

/**
 * Une ligne du fichier DATAtourisme est-elle une COURSE À PIED à venir, exploitable ?
 * Sinon `null`. Les distances du NOM priment (« Les 10 km de Cholet ») ; à défaut, celles
 * de la description.
 */
export function evenementCourse(r: Record<string, string>, aujourdhui: string): EvenementDT | null {
  if (!/SportsEvent/.test(r.Categories_de_POI ?? "")) return null;
  const nom = String(r.Nom_du_POI ?? "").trim();
  const n = forme(nom);
  if (!COURSE.test(n) || PAS_UNE_COURSE.test(n) || estChrono(nom)) return null;
  const dates = [...String(r.Periodes_regroupees ?? "").matchAll(/(\d{4}-\d{2}-\d{2})<->/g)].map((m) => m[1]).filter((d) => d >= aujourdhui).sort();
  if (!dates.length) return null;
  const kms = distancesLues(nom).length ? distancesLues(nom) : distancesLues(String(r.Description ?? "").slice(0, 1500));
  if (!kms.length) return null;
  const [cp, commune] = String(r.Code_postal_et_commune ?? "").split("|")[0].split("#");
  const departement = departementDuCodePostal(cp);
  if (!departement || !commune) return null;
  // ⚠️ SANS SITE, PAS DE COURSE : l'identifiant DATAtourisme (data.datatourisme.fr/…) ne
  // s'ouvre pas dans un navigateur (vérifié le 29/09/2026) — la fiche n'aurait aucun lien.
  const site = String(r.Contacts_du_POI ?? "").match(/https?:\/\/[^\s#|<>"]+/)?.[0] ?? null;
  if (!site) return null;
  const lat = Number(r.Latitude), lon = Number(r.Longitude);
  return {
    nom, commune: commune.trim(), departement, date: dates[0], kms: kms.slice(0, 6),
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null, lon: Number.isFinite(lon) && lon !== 0 ? lon : null,
    site, uri: String(r.URI_ID_du_POI ?? ""),
  };
}

/** Les lignes à insérer — une par distance — marquées comme venant de DATAtourisme. */
export function lignesDT(e: EvenementDT, maintenant: string): Record<string, unknown>[] {
  const trail = /trail|nature|cross|montagne|sky|vertical/.test(forme(e.nom));
  return e.kms.map((km) => {
    const type = typeDe(trail ? "trail" : "road", km);
    return {
      name: e.nom, city: e.commune, department: e.departement.nom, region: e.departement.region,
      date: e.date, distance_km: km, type, elevation_gain_m: null,
      difficulty: /trail|ultra/.test(type) ? "blue" : "green", terrain: [], time_limits: [],
      registration_url: e.site, organization: "DATAtourisme", description: null,
      latitude: e.lat, longitude: e.lon, is_itra_certified: false, itra_points: null,
      site_officiel: e.site, source_id: `dt:${e.uri}:${km}`, source_maj_at: maintenant,
      // Date publiée par l'office de tourisme pour CETTE édition : ni estimée, ni confirmée par nous.
      date_confirmee: null,
    };
  });
}

/** Une manifestation sportive datée, pour rapprochement : nom, commune, prochaine date. */
export type ManifestationDatee = { nom: string; commune: string; date: string };

/** Les manifestations SPORTIVES à venir du fichier, par commune (clé de comparaison). */
export function manifestationsDatees(rows: Record<string, string>[], aujourdhui: string, jusquA: string): Map<string, ManifestationDatee[]> {
  const out = new Map<string, ManifestationDatee[]>();
  for (const r of rows) {
    if (!/SportsEvent/.test(r.Categories_de_POI ?? "")) continue;
    // ⚠️ UN SEUL JOUR. Sur « 24 au 25 octobre » (Marseille-Cassis vu par la mairie de
    // Marseille : le village, puis la course le dimanche), le jour de course est incertain.
    const date = [...String(r.Periodes_regroupees ?? "").matchAll(/(\d{4}-\d{2}-\d{2})<->(\d{4}-\d{2}-\d{2})/g)]
      .filter((m) => m[1] === m[2]).map((m) => m[1]).filter((d) => d >= aujourdhui && d <= jusquA).sort()[0];
    const commune = String(r.Code_postal_et_commune ?? "").split("|")[0].split("#")[1] ?? "";
    if (!date || !commune) continue;
    const k = cleCommune(commune);
    (out.get(k) ?? out.set(k, []).get(k)!).push({ nom: String(r.Nom_du_POI ?? ""), commune, date });
  }
  return out;
}

/** « Saint-Maurice-la-Clouère », « Paris 8e arrondissement » → clé de comparaison. */
export const cleCommune = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/\b(\d+)(e|er|eme)?\b/g, " ").replace(/\barrondissement\b/g, " ").replace(/[^a-z]+/g, " ").trim();

/**
 * La date DATAtourisme d'une course du catalogue restée « Date à venir », ou `null`.
 *
 * ⚠️ LE NOM DE LA VILLE NE COMPTE PAS. Mesuré le 29/09/2026 : « La Foulée du Madiran »
 * rapprochée de « Portes ouvertes en Madiran », « Urban Trail de Romans » d'une braderie —
 * le seul mot commun était la commune. On retire les mots de la ville, on exige que la
 * manifestation porte un NOM DE COURSE (« Montée en lumière vers le château du Haut-Barr »
 * n'est pas le « Trail du Haut-Barr »), et au moins deux mots communs quand il y en a deux.
 */
export function dateRetrouvee(course: { name: string; city: string | null }, parCommune: Map<string, ManifestationDatee[]>): string | null {
  const motsVille = new Set(motsDistinctifs(String(course.city ?? "")));
  const mots = motsDistinctifs(course.name).filter((m) => !motsVille.has(m));
  if (!mots.length) return null;
  const candidates = (parCommune.get(cleCommune(course.city)) ?? []).filter((e) => {
    if (PAS_UNE_COURSE.test(forme(e.nom).replace(/\b(trail|course|courses)\b.*$/, ""))) return false;
    const m = motsDistinctifs(e.nom).filter((x) => !motsVille.has(x));
    const communs = mots.filter((x) => m.includes(x)).length;
    if (communs < Math.min(2, mots.length)) return false;
    // Un nom de course… ou un nom qui n'ajoute RIEN à celui de la course (« La Rouge
    // Flamande à Bergues ») — pas « Montée en lumière vers le château du Haut-Barr ».
    return NOM_DE_COURSE.test(forme(e.nom)) || m.every((x) => mots.includes(x));
  });
  const dates = [...new Set(candidates.map((c) => c.date))].sort();
  // Deux dates différentes pour la même course : on ne choisit pas au hasard.
  return dates.length === 1 ? dates[0] : null;
}
const NOM_DE_COURSE = /\b(trail|corrida|foulee|foulees|course|courses|semi|marathon|cross|ekiden|run|running|km|kilometres?)\b/;
