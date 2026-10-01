/**
 * LE LIEN DU PARCOURS D'UNE COURSE — lu sur sa page officielle (30/09/2026).
 *
 * Cyprien : « ajoute les liens des parcours ». Les organisateurs publient leur tracé de
 * trois façons : un fichier (.gpx, .kml), un service de tracés (Openrunner, Trace de Trail,
 * VisuGPX, Strava, Komoot…), ou une page « Parcours » de leur site. On les reconnaît, on
 * préfère le TRACÉ lui-même à une page qui en parle, et on donne à chaque distance le sien
 * (« Parcours 10 km », « tracé du 25 km ») avec la même règle que les classements.
 *
 * Tout ce qui décide est ici, pur et testé ; la veille (`scripts/veille-courses.ts`) lit
 * les pages.
 */
import { lienSortantPropre } from "./lienPropre";
import { libelleDuLien, choisirParDistance } from "./resultatsSite";

/** Services de tracés : un lien vers eux EST le parcours. */
const SERVICES_TRACES = /(^|\.)(openrunner\.com|tracedetrail\.fr|visugpx\.com|ridewithgps\.com|komoot\.(com|fr|de)|plotaroute\.com|wikiloc\.com|outdooractive\.com|calculitineraires\.fr|alltrails\.com|gpx-studio\.com|utagawavtt\.com|ign\.fr)$/i;
const FICHIER_TRACE = /\.(gpx|kml|kmz|tcx)(?:[?#].*)?$/i;
// ⚠️ PAS « ITINÉRAIRE » (01/10/2026) : en français, c'est le plus souvent l'itinéraire POUR
// VENIR — relu sur le premier passage, « Itinéraire » menait à Google Maps, Mappy, Waze.
const SENS_PARCOURS = /parcours|trac[ée]s?\b|gpx|profil(?! utilisateur)|course map|route map|carte du parcours/i;
/** Ce qui parle du mot « parcours » sans être un tracé — dont le « Parcours Prévention Santé » de la FFA (PPS). */
const SENS_ECARTES = /parcours[-_ ](?:sant[ée]|du[-_ ]combattant|scolaire|professionnel|de[-_ ]soins|d'?emploi|client|(?:de[-_ ])?pr[ée]vention)|\bpps\b|id[ée]es?[-_ ]parcours|inscri|r[ée]sultat|classement|b[ée]n[ée]vole|partenaire|photo|vid[ée]o|acc[eè]s|itin[ée]raire|venir|parking|h[ée]bergement/i;

/**
 * Un lien d'ITINÉRAIRE ou de PHOTOS, pas un tracé : Google Maps « itinéraire vers… » ou
 * « recherche », Mappy, Waze, un lien raccourci maps.app.goo.gl, un album Google Photos.
 * Une carte « My Maps » (`/maps/d/`) dessinée par l'organisateur EST un tracé : gardée.
 */
export function estItineraireOuPhoto(url: string): boolean {
  let u: URL; try { u = new URL(url); } catch { return true; }
  const h = u.hostname.toLowerCase();
  if (/(^|\.)(mappy\.com|waze\.com|viamichelin\.[a-z]+)$/.test(h) || /^(photos|maps)\.app\.goo\.gl$/.test(h) || h === "photos.google.com") return true;
  // Les sites de la FFA (pps.athle.fr, bases.athle.fr) ne publient pas le tracé d'une course.
  if (/(^|\.)athle\.fr$/.test(h)) return true;
  if (h === "goo.gl" && /^\/maps/i.test(u.pathname)) return true;
  if (/(^|\.)google\.[a-z.]+$/.test(h) && (/^\/maps/i.test(u.pathname) || /^maps\./.test(h))) return !/\/maps\/d\//i.test(u.pathname);
  return false;
}

/** Un RÈGLEMENT seul n'est pas un tracé ; « parcours et règlement » sur la même page, si. */
export const reglementSeul = (x: string) => /r[eè]glement/i.test(x) && !/parcours|trac[eé]|gpx/i.test(x);

export type LienParcours = { url: string; texte: string; trace: boolean; score: number };

const sansBalises = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const decode = (u: string) => { try { return decodeURIComponent(u); } catch { return u; } };

/**
 * Les liens de parcours d'une page, notés (le meilleur d'abord). `evenement` : quand la
 * page n'est pas DÉDIÉE à la course, un lien doit la nommer (mot distinctif dans le
 * libellé ou l'adresse) — la page d'un club parle de toutes ses épreuves.
 */
export function liensParcours(html: string, base: string, evenement?: { mots: string[] }): LienParcours[] {
  const out: LienParcours[] = [];
  const vus = new Set<string>();
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (let m; (m = re.exec(html));) {
    const texte = libelleDuLien(html, m.index, sansBalises(m[2]).slice(0, 120));
    let brut: string;
    try { brut = new URL(m[1].replace(/&amp;/g, "&"), base).toString(); } catch { continue; }
    const url = lienSortantPropre(brut);
    if (!url || vus.has(url)) continue;
    let u: URL; try { u = new URL(url); } catch { continue; }
    const chemin = decode(`${u.hostname}${u.pathname}`);
    const service = SERVICES_TRACES.test(u.hostname);
    const fichier = FICHIER_TRACE.test(u.pathname);
    if (!service && !fichier && !SENS_PARCOURS.test(`${texte} ${chemin}`)) continue;
    if (SENS_ECARTES.test(`${texte} ${decode(u.pathname)}`)) continue;
    if (estItineraireOuPhoto(url) || reglementSeul(`${texte} ${decode(u.pathname)}`)) continue;
    // Un libellé LONG est une phrase d'article, pas un lien « Parcours ».
    if (texte.length > 70 && !service && !fichier) continue;
    if (evenement?.mots.length) {
      const dit = `${texte} ${decode(u.pathname + u.search)}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (!evenement.mots.some((w) => dit.includes(w))) continue;
    }
    vus.add(url);
    const score = (fichier ? 120 : service ? 100 : 0) + (/parcours|trac/i.test(texte) ? 10 : 0) + (texte.length > 0 && texte.length <= 40 ? 5 : 0);
    out.push({ url, texte, trace: fichier || service, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Le parcours d'une course de `km` : sa distance nommée d'abord, sinon le meilleur lien qui n'en nomme aucune. */
export function parcoursPour(cands: readonly LienParcours[], km: number | null | undefined): LienParcours | null {
  return choisirParDistance(cands, km);
}
