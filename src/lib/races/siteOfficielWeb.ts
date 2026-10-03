/**
 * LE SITE OFFICIEL D'UNE COURSE, RETROUVÉ SUR LE WEB — décisions pures (03/10/2026).
 *
 * POURQUOI. 3 128 courses du catalogue viennent de jogging-plus.com, qui oppose un défi
 * anti-robot à toute requête automatique : leurs fiches ne pouvaient jamais être
 * revérifiées (« Cette source empêche nos vérifications automatiques »), et seules 72
 * avaient un site officiel. On ne contourne pas une protection : on va chercher la
 * SOURCE PRIMAIRE — le site de l'organisateur — que la veille relit ensuite (dates,
 * inscription, résultats, parcours), comme pour toute autre course.
 *
 * COMMENT. Une recherche web (modèle + Google) propose des sites ; aucun n'est cru sur
 * parole. Chaque candidat est LU par notre robot (robots.txt, liste d'opposition) et
 * doit : ne pas être un calendrier, une plateforme, un chronométreur, un média ou un
 * réseau social ; NOMMER la course ; citer sa VILLE (ou son département) — une « Foulée
 * de la Saint-Martin » existe dans vingt communes. Sinon : rien n'est écrit.
 */
import { domaineDe, estCalendrierTiers } from "./destination";
import { estPlateformeInscription } from "./inscriptionSite";
import { estChronometreur, motsDistinctifs } from "./resultatsSite";
import { siteExclu } from "./robot";
import { pageNommeLaCourse, datesDeLaCourse, type PageLue } from "./veille";

export type EpreuveARechercher = {
  nom: string;
  ville: string | null;
  departement: string | null;
  /** « AAAA-MM-JJ », ou null / 2099 quand la date est à venir. */
  date: string | null;
  distances: number[];
};

/**
 * Agrégateurs et calendriers qui ne SONT PAS l'organisateur (en plus de ceux que
 * `estCalendrierTiers` connaît) : leur page nomme la course et sa ville, elle passerait
 * tous les autres contrôles.
 */
const CALENDRIERS_EN_PLUS = new Set([
  "kikourou.net", "le-sportif.com", "ahotu.com", "ahotu.fr", "betrail.run", "u-trail.com", "livetrail.net",
  "runtrail.fr", "trails-endurance.com", "courirenfrance.com", "lepape-info.com", "athle.fr", "jogging-international.net",
  "calendrier-trail.fr", "trail-passion.net", "runningheroes.com", "sportsnconnect.com", "chronotrack.com",
  "openrunner.com", "tracedetrail.fr", "visorando.com", "strava.com", "garmin.com",
  // Relevés en essai réel le 03/10/2026 : calendriers et agendas proposés comme « officiels ».
  "runtrail.run", "gotrail.run", "followmysport.com", "werun.world", "esprit-trail.com", "jds.fr", "oleno.fr",
  "infolocale.fr", "unidivers.fr", "provencemed.com", "lesportif.com", "trailrunningfrance.fr", "agenda-trail.fr",
  "ok-time.fr",
]);

/** Offices de tourisme et agendas : ils annoncent tout, n'organisent rien. */
const HOTE_AGENDA = /tourisme|tourism|office-de|(^|\.)ot-|agenda|sortir|evenements?\./i;

/** Médias et réseaux : une page qui PARLE de la course n'est pas celle qui l'organise. */
const MEDIAS_RESEAUX = new Set([
  "facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com", "youtube.com", "linkedin.com",
  "wikipedia.org", "tripadvisor.fr", "tripadvisor.com", "google.com", "helloasso.com",
  "ouest-france.fr", "lavoixdunord.fr", "leprogres.fr", "ledauphine.com", "actu.fr", "francebleu.fr",
  "sudouest.fr", "lanouvellerepublique.fr", "estrepublicain.fr", "dna.fr", "lalsace.fr", "midilibre.fr",
  "ladepeche.fr", "letelegramme.fr", "paris-normandie.fr", "courrier-picard.fr", "nicematin.com", "varmatin.com",
  "laprovence.com", "lunion.fr", "lest-eclair.fr", "lejsl.com", "bienpublic.com", "lamontagne.fr", "lepopulaire.fr",
  "larep.fr", "leberry.fr", "lyonne.fr", "centre-presse.fr", "charentelibre.fr", "corsematin.com", "lindependant.fr",
  "leparisien.fr", "lefigaro.fr", "20minutes.fr", "francetvinfo.fr", "lamarseillaise.fr", "republicain-lorrain.fr",
  "vosgesmatin.fr", "lechorepublicain.fr", "maville.com", "lavenir.net", "petitbleu.fr", "lepetitjournal.net",
]);

/** Ce site peut-il être l'organisateur ? (indépendamment de son contenu) */
export function siteCandidatAcceptable(url: unknown): url is string {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) return false;
  const d = domaineDe(url);
  if (!d || siteExclu(url)) return false;
  if (estCalendrierTiers(url) || CALENDRIERS_EN_PLUS.has(d) || MEDIAS_RESEAUX.has(d)) return false;
  let hote = ""; try { hote = new URL(url).hostname; } catch { return false; }
  if (HOTE_AGENDA.test(hote)) return false;
  return !estPlateformeInscription(url) && !estChronometreur(url);
}

const libelleDistances = (km: number[]) =>
  [...new Set(km.filter((x) => x > 0))].sort((a, b) => a - b).map((x) => `${String(x).replace(".", ",")} km`).join(", ");

/**
 * La question posée au moteur de recherche. EN CLAIR, pas en JSON : demander une forme
 * contrainte supprime la recherche elle-même (constaté pour l'heure de départ, heureWeb).
 */
export function promptSiteOfficiel(e: EpreuveARechercher): string {
  const lieu = [e.ville, e.departement].filter(Boolean).join(", ");
  const quand = e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && !e.date.startsWith("2099") ? ` (édition du ${e.date.split("-").reverse().join("/")})` : "";
  const dist = libelleDistances(e.distances);
  return [
    `Quel est le site internet OFFICIEL de la course à pied « ${e.nom} »${lieu ? ` à ${lieu}` : ""}, en France${quand} ?${dist ? ` Distances : ${dist}.` : ""}`,
    "",
    "Je cherche le site de l'ORGANISATEUR : le site propre de l'épreuve, ou la page de l'association, du club, du comité des fêtes ou de la mairie qui l'organise.",
    "Pas un calendrier de courses (Finishers, Jogging-Plus, Kikourou…), pas une plateforme d'inscription, pas un chronométreur, pas un article de presse, pas un réseau social.",
    "Donne l'adresse complète (https://…) de la page qui présente la course. Si tu ne trouves pas de site officiel, dis-le simplement.",
  ].join("\n");
}

/** Les sites proposés : adresses écrites dans la réponse, puis domaines des sources consultées. */
export function candidatsSite(texte: string, sources: readonly string[] = [], max = 4): string[] {
  const urls = [...String(texte ?? "").matchAll(/https?:\/\/[^\s<>"'()\]\[]+/gi)]
    .map((m) => m[0].replace(/[.,;:!?*»]+$/, ""));
  // Le titre d'une source de recherche est presque toujours son domaine (« foulees-x.fr »).
  const domaines = sources.map((s) => String(s ?? "").trim().toLowerCase())
    .filter((s) => /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(s))
    .map((s) => `https://${s}/`);
  const vus = new Set<string>();
  const out: string[] = [];
  for (const u of [...urls, ...domaines]) {
    if (!siteCandidatAcceptable(u)) continue;
    const d = domaineDe(u);
    if (vus.has(d)) continue;
    vus.add(d);
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** La page cite-t-elle le LIEU de la course (ville, ou à défaut département) ? */
export function citeLeLieu(page: Pick<PageLue, "url" | "titre" | "texte">, ville: string | null, departement: string | null): boolean {
  const corpus = ` ${norm(`${page.titre} ${page.texte} ${decodeURIComponent(page.url.replace(/%(?![0-9a-f]{2})/gi, ""))}`)} `;
  // Une ville de trois lettres ou moins (« Ay », « Eu ») se retrouve partout : seule, elle
  // ne prouve rien — il faut alors le département.
  const v = norm(ville ?? "");
  if (v.length >= 4 && corpus.includes(` ${v} `)) return true;
  const d = norm(departement ?? "");
  return d.length >= 3 && corpus.includes(` ${d} `);
}

/**
 * La page date-t-elle la course au MÊME jour que notre fiche (à 2 jours près) ? Le nom et la
 * date ensemble identifient l'épreuve aussi sûrement que la ville — c'est ce qui sauve le
 * « Top Porquerolles Trail » (fiche à Hyères, site qui ne parle que de Porquerolles).
 */
export function dateConcorde(e: EpreuveARechercher, page: Pick<PageLue, "url" | "dates">): boolean {
  if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || e.date.startsWith("2099")) return false;
  const ref = Date.parse(`${e.date}T12:00:00Z`);
  return datesDeLaCourse(page.dates ?? [], page.url, e.nom)
    .some((d) => Math.abs(Date.parse(`${d.date}T12:00:00Z`) - ref) <= 2 * 864e5);
}

const ARTICLES = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "sur", "the", "and", "of", "d", "l"]);
const mots = (x: string) => norm(x).split(" ").filter((m) => m.length >= 3 && !ARTICLES.has(m) && !/^\d+$/.test(m));

/**
 * ⚠️ UNE COURSE QUI NE PORTE QUE LE NOM DE SA VILLE (« Corrida du SOA Arles » : « corrida »
 * est banal, « SOA » trop court, reste « arles ») rend `pageDediee` aveugle : tout site dont
 * le domaine contient « arles » passait pour dédié — `arlesassociations.fr` en tête
 * (03/10/2026). Il faut alors qu'un AUTRE mot du nom (« corrida ») figure dans l'adresse ou
 * le titre de la page.
 */
export function dedicaceFiable(e: EpreuveARechercher, page: Pick<PageLue, "url" | "titre">): boolean {
  const deVille = new Set(mots(e.ville ?? ""));
  if (motsDistinctifs(e.nom).some((m) => !deVille.has(m))) return true;
  // Le domaine reprend le nom COMPLET, chiffres compris : « 20kmparis.com » pour « 20 km de
  // Paris » (03/10/2026) — aucun mot distinctif hors la ville, mais aucun doute non plus.
  let hote = ""; try { hote = new URL(page.url).hostname.replace(/[^a-z0-9]/gi, "").toLowerCase(); } catch { /* */ }
  const complet = compact(e.nom), sansArticles = compact(e.nom, true);
  if (hote && ((complet.length >= 6 && hote.includes(complet)) || (sansArticles.length >= 6 && hote.includes(sansArticles)))) return true;
  const autres = mots(e.nom).filter((m) => !deVille.has(m));
  if (!autres.length) return false;
  let ou = page.titre;
  try { const u = new URL(page.url); ou += ` ${u.hostname} ${decodeURIComponent(u.pathname.replace(/%(?![0-9a-f]{2})/gi, ""))}`; } catch { /* */ }
  const corpus = norm(ou);
  return autres.some((m) => corpus.includes(m));
}

/** « 20 km de Paris » → « 20kmdeparis » (ou « 20kmparis » sans articles). */
export function compact(nom: string, sansArticles = false): string {
  const ms = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  return (sansArticles ? ms.filter((m) => !ARTICLES.has(m)) : ms).join("");
}

/**
 * LES ADRESSES QU'UN ORGANISATEUR CHOISIT LE PLUS SOUVENT : le nom de la course, collé ou
 * avec des tirets, avec ou sans articles, en .fr / .com / .org. Mesuré le 03/10/2026 sur 60
 * courses : 5 sites justes (coursedumarais.fr, runinclaye.fr, grandraidcamargue.fr…), aucun
 * faux — les domaines homonymes (bellerose.fr) sont écartés par `verdictSite`.
 */
export function domainesDevines(nom: string): string[] {
  const ms = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const sans = ms.filter((m) => !ARTICLES.has(m));
  const bases = [...new Set([ms.join(""), ms.join("-"), sans.join(""), sans.join("-")])]
    .filter((b) => b.length >= 6 && b.length <= 50 && !/^-|-$/.test(b));
  return bases.flatMap((b) => ["fr", "com", "org"].map((t) => `https://${b}.${t}/`));
}

/** Une adresse sans ses paramètres de pistage (fbclid, utm_…), qui n'ont rien d'officiel. */
export function sansPistage(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(fbclid|gclid|utm_|mc_|igshid)/i.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch { return url; }
}

/** Un événement de DATAtourisme réduit à ce qui sert : son nom, sa commune, son site. */
export type EvenementOuvert = { nom: string; commune: string; site: string };

/**
 * Les sites que DATAtourisme (Licence Ouverte) donne pour des événements de la MÊME commune
 * dont le nom partage un mot distinctif avec la course. Ce ne sont que des CANDIDATS : chacun
 * est ensuite lu et jugé par `verdictSite`, comme ceux de la recherche web.
 */
export function candidatsOuverts(e: EpreuveARechercher, parCommune: ReadonlyMap<string, readonly EvenementOuvert[]>): string[] {
  const evts = parCommune.get(norm(e.ville ?? "")) ?? [];
  const nos = new Set(motsDistinctifs(e.nom));
  const out: string[] = [];
  for (const ev of evts) {
    if (!motsDistinctifs(ev.nom).some((m) => nos.has(m))) continue;
    const u = sansPistage(ev.site);
    if (siteCandidatAcceptable(u) && !out.includes(u)) out.push(u);
  }
  return out.slice(0, 3);
}

/** L'index par commune, construit une fois pour tout le fichier. */
export function indexOuvert(evts: readonly EvenementOuvert[]): Map<string, EvenementOuvert[]> {
  const m = new Map<string, EvenementOuvert[]>();
  for (const ev of evts) { const k = norm(ev.commune); if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(ev); }
  return m;
}

/**
 * L'ADRESSE PORTE-T-ELLE LE NOM DE LA COURSE, sans ambiguïté ? Le nom complet (« coursedumarais »,
 * « 20kmparis »), ou au moins DEUX de ses mots distinctifs hors la ville (« lesraidsdingues85 »).
 * Un seul mot ne suffit pas : « vincennes-hippodrome.com » contient « vincennes », et ce n'est
 * pas le site du semi-marathon du Bois de Vincennes (03/10/2026).
 */
export function adresseAuNom(e: EpreuveARechercher, url: string): boolean {
  let hote = ""; try { hote = new URL(url).hostname.replace(/[^a-z0-9]/gi, "").toLowerCase(); } catch { return false; }
  const complet = compact(e.nom), sansArticles = compact(e.nom, true);
  if ((complet.length >= 6 && hote.includes(complet)) || (sansArticles.length >= 6 && hote.includes(sansArticles))) return true;
  const deVille = new Set(mots(e.ville ?? ""));
  return motsDistinctifs(e.nom).filter((m) => !deVille.has(m) && hote.includes(m)).length >= 2;
}

/**
 * Le TITRE ou le CHEMIN de la page porte-t-il TOUS les mots distinctifs du nom (hors la
 * ville) ? « Hippodrome de Vincennes » ne porte pas « bois » : ce n'est pas la page du
 * semi-marathon du Bois de Vincennes, même s'il en annonce la date.
 */
export function titreAuNom(e: EpreuveARechercher, page: Pick<PageLue, "url" | "titre">): boolean {
  const deVille = new Set(mots(e.ville ?? ""));
  let ms = motsDistinctifs(e.nom).filter((m) => !deVille.has(m));
  if (!ms.length) ms = mots(e.nom).filter((m) => !deVille.has(m));
  if (!ms.length) return false;
  let ou = page.titre;
  try { const u = new URL(page.url); ou += ` ${decodeURIComponent(u.pathname.replace(/%(?![0-9a-f]{2})/gi, ""))}`; } catch { /* */ }
  const corpus = norm(ou).replace(/ /g, "");
  return ms.every((m) => corpus.includes(m));
}

export type Verdict = { ok: true; force: "site" | "page" | "texte" } | { ok: false; motif: string };

/** Cette page lue est-elle le site officiel de cette épreuve ? */
export function verdictSite(e: EpreuveARechercher, page: Pick<PageLue, "url" | "titre" | "texte" | "dates">): Verdict {
  if (!siteCandidatAcceptable(page.url)) return { ok: false, motif: "calendrier, plateforme, média ou site opposé" };
  if (!pageNommeLaCourse(`${page.titre} ${page.texte}`, page.url, e.nom)) return { ok: false, motif: "ne nomme pas la course" };
  if (!citeLeLieu(page, e.ville, e.departement) && !dateConcorde(e, page)) return { ok: false, motif: "ne cite ni la ville ni le département, ni la même date (homonyme possible)" };
  // Hors une adresse au nom de la course, il faut que la page DATE la course au même jour que
  // notre fiche : le nom d'un lieu (« Vincennes », « Malagar ») se retrouve sur bien des sites.
  if (!adresseAuNom(e, page.url) && !dateConcorde(e, page)) return { ok: false, motif: "ni adresse au nom de la course, ni la même date sur la page" };
  // « site » : l'adresse porte le nom ; « page » : le titre ou le chemin porte TOUS ses mots.
  if (adresseAuNom(e, page.url)) return { ok: true, force: "site" };
  if (dedicaceFiable(e, page) && titreAuNom(e, page)) return { ok: true, force: "page" };
  // Ici, la page n'est pas DÉDIÉE (agenda d'une mairie, page « nos événements » d'un club) :
  // elle a passé la règle ci-dessus, donc elle DATE la course au jour de notre fiche.
  // La PAGE D'ACCUEIL d'un site qui ne fait que citer la course (vertou.fr, 03/10/2026) :
  // la mention disparaît avec l'actualité suivante. Seule une page précise vaut.
  // « /fr/ », « /en » : une page d'accueil aussi.
  let racine = true; try { racine = /^\/?(?:[a-z]{2}(?:-[a-z]{2})?)?\/?$/i.test(new URL(page.url).pathname); } catch { /* */ }
  if (racine) return { ok: false, motif: "page d'accueil qui cite la course en passant" };
  return { ok: true, force: "texte" };
}
