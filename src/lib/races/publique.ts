/**
 * LES COURSES EN PAGES PUBLIQUES — le principal actif du site, jusqu'ici invisible.
 *
 * ⚠️ CONSTAT DU 03/09/2026 : le sitemap déclarait SEPT adresses (l'accueil, le blog,
 * les avis, le contact et trois pages légales). Les 17 113 courses vivaient sous
 * `/dashboard/races`, c'est-à-dire derrière l'authentification ET derrière un
 * `Disallow: /dashboard/` dans notre propre robots.txt. Un coureur qui cherche
 * « trail des Vosges 2026 inscription » — exactement ce que le catalogue sait
 * répondre — ne pouvait pas nous trouver.
 *
 * ⚠️ ON NE PUBLIE PAS TOUT, ET C'EST DÉLIBÉRÉ. 6 411 courses portent la date
 * « 2099-01-01 », qui ne veut pas dire « en 2099 » mais « date encore inconnue ».
 * Les publier comme des événements datés mentirait au lecteur ET au moteur de
 * recherche, qui traite une date d'événement comme une donnée structurée vérifiable.
 * Seules les courses réellement datées et à venir obtiennent une page.
 */

export type CoursePublique = {
  id: string;
  name: string | null;
  city: string | null;
  department: string | null;
  region: string | null;
  date: string | null;
  distance_km: number | null;
  elevation_gain_m: number | null;
  type: string | null;
  terrain: string | null;
  registration_url: string | null;
  latitude: number | null;
  longitude: number | null;
  organization: string | null;
  description: string | null;
  is_itra_certified: boolean | null;
  itra_points: number | null;
};

/** La date que le catalogue emploie pour « on ne sait pas encore ». */
export const DATE_INCONNUE = "2099-01-01";

/**
 * Cette course mérite-t-elle une page publique ?
 *
 * Une page ne vaut que si elle répond à la question qu'on est venu poser : quoi, où,
 * quand, et comment s'inscrire. Sans l'un des quatre, on ne publie pas — mieux vaut
 * cent pages utiles que dix mille pages creuses, que les moteurs classent d'ailleurs
 * comme du remplissage.
 */
export function estPubliable(c: Partial<CoursePublique>, aujourdhui: string): boolean {
  const nom = String(c.name ?? "").trim();
  const ville = String(c.city ?? "").trim();
  const date = String(c.date ?? "").slice(0, 10);
  if (nom.length < 3 || !ville) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (date >= DATE_INCONNUE) return false;      // « date à venir », pas une date
  if (date < String(aujourdhui).slice(0, 10)) return false; // déjà courue
  return Boolean(String(c.registration_url ?? "").trim());
}

/** Réduit un libellé à des mots utilisables dans une adresse. */
export function motsUrl(s: string): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // accents
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

/**
 * L'adresse d'une course : des mots lisibles, PUIS son identifiant.
 *
 * ⚠️ L'IDENTIFIANT EST À LA FIN, ET C'EST LUI QUI FAIT FOI. Deux courses peuvent
 * partager nom et ville (deux distances d'un même événement, deux éditions), et un nom
 * peut être corrigé après coup. Une adresse construite uniquement sur le nom donnerait
 * des collisions aujourd'hui et des liens morts demain. En lisant l'identifiant final,
 * une ancienne adresse continue de fonctionner même si le libellé change.
 */
export function slugCourse(c: Pick<CoursePublique, "id" | "name" | "city" | "distance_km">): string {
  const morceaux = [motsUrl(String(c.name ?? "")), motsUrl(String(c.city ?? ""))];
  const km = Number(c.distance_km);
  if (Number.isFinite(km) && km > 0) morceaux.push(`${Math.round(km)}km`);
  const court = String(c.id ?? "").replace(/-/g, "").slice(0, 8);
  return [...morceaux.filter(Boolean), court].join("-");
}

/** Retrouve l'identifiant depuis une adresse. `null` si elle n'en contient pas. */
export function idDepuisSlug(slug: string): string | null {
  const dernier = String(slug ?? "").split("-").pop() ?? "";
  return /^[0-9a-f]{8}$/i.test(dernier) ? dernier.toLowerCase() : null;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 14 juin 2026 » — écrit sans dépendre du fuseau du serveur (voir lib/time/fuseau). */
export function dateEnClair(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").slice(0, 10));
  if (!m) return "";
  const mois = MOIS[Number(m[2]) - 1];
  return mois ? `${Number(m[3])} ${mois} ${m[1]}` : "";
}

/**
 * Le titre de la page.
 *
 * ⚠️ AUCUNE INFORMATION N'EST INVENTÉE POUR REMPLIR. Une distance absente ne devient
 * pas « 10 km » parce que ça sonnerait mieux ; le titre raccourcit, simplement.
 */
export function titrePage(c: Partial<CoursePublique>): string {
  const bouts = [String(c.name ?? "").trim()];
  const km = Number(c.distance_km);
  if (Number.isFinite(km) && km > 0) bouts.push(`${Math.round(km)} km`);
  if (c.city) bouts.push(String(c.city).trim());
  const annee = String(c.date ?? "").slice(0, 4);
  if (/^\d{4}$/.test(annee) && annee !== "2099") bouts.push(annee);
  return bouts.filter(Boolean).join(" · ");
}

/** La description affichée aux moteurs : ce qu'on sait, et rien d'autre. */
export function descriptionPage(c: Partial<CoursePublique>): string {
  const faits: string[] = [];
  const d = dateEnClair(String(c.date ?? ""));
  if (d) faits.push(`le ${d}`);
  if (c.city) faits.push(`à ${String(c.city).trim()}`);
  if (c.department) faits.push(`(${String(c.department).trim()})`);
  const km = Number(c.distance_km);
  if (Number.isFinite(km) && km > 0) faits.push(`— ${Math.round(km)} km`);
  const d_ = Number(c.elevation_gain_m);
  if (Number.isFinite(d_) && d_ > 0) faits.push(`${Math.round(d_)} m D+`);
  const tete = String(c.name ?? "").trim();
  // ⚠️ LA PHRASE DE FIN N'ANNONCE QUE CE QUE LA FICHE CONTIENT. Une formule figée
  // (« date, distance, dénivelé et inscription ») promettait un dénivelé sur des
  // milliers de courses qui n'en ont pas — une promesse non tenue dès le résultat de
  // recherche, avant même que le lecteur ait cliqué.
  const contenu = ["Date", Number.isFinite(km) && km > 0 ? "distance" : "",
    Number.isFinite(d_) && d_ > 0 ? "dénivelé" : "", "lien d'inscription officiel"].filter(Boolean);
  const fin = contenu.length > 1
    ? `${contenu.slice(0, -1).join(", ")} et ${contenu[contenu.length - 1]}.`
    : `${contenu[0]}.`;
  return `${tete} ${faits.join(" ")}. ${fin}`.replace(/\s+/g, " ").trim();
}
