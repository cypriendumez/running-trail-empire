/**
 * LE LIEN « RÉSULTATS » D'UN SITE OFFICIEL — pour que « Classement » s'ouvre en un clic.
 *
 * Demandé par Cyprien le 28/09/2026 : « voir les classements après les courses juste en
 * cliquant sur le lien qui affiche directement ». Mesuré le même jour sur 1 590 fiches
 * finishers : 38 citent le classement du chronométreur. Pour les autres, le site officiel
 * est connu (2 291 formats), et son menu porte presque toujours « Résultats ».
 *
 * Tout ce qui DÉCIDE est ici, pur et testé ; `scripts/resultats-sites.ts` lit les pages.
 *
 * ⚠️ UN LIEN « RÉSULTATS » N'EST PAS FORCÉMENT UN CLASSEMENT : « résultats du tirage au
 * sort », « résultats du concours photo ». On écarte ces sens-là, et on préfère un
 * chronométreur connu (le classement lui-même) à une page du site.
 *
 * ⚠️ L'ANNÉE N'EST DITE QUE SI ON LA LIT. « Classement 2026 » sur une page qui ne va que
 * jusqu'à 2024 serait faux : sans année dans le lien ou son texte, l'année reste inconnue.
 */

import { domaineDe } from "./destination";
import { sansDossierDePublication } from "./editionsResultats";
import { lienClassementPropre } from "./lienPropre";

/** Plateformes de chronométrage : un lien vers elles EST le classement. */
export const CHRONOMETREURS = [
  "timeto.com", "sportinnovation.fr", "protiming.fr", "chrono-start.com", "klikego.com", "njuko.net", "ipitos.com",
  "l-chrono.com", "top-chrono.fr", "espace-competition.com", "breizhchrono.com", "chronowest.fr", "sportips.fr",
  "wiclax.com", "acn-timing.com", "yaka-inscription.com", "chronosports.fr", "chronometrage.com", "resultats-live.com",
  "livetrail.net", "livetrail.run", "sporkrono.fr", "chrono-course.fr", "g-live.fr", "nikrome.com", "athle.fr",
  "chronorace.be", "racetimer.fr", "active-timing.fr", "3wsport.com", "mychrono.fr", "chronopro.net", "endurance-chrono.com",
] as const;

const SENS_ECARTES = /tirage|loterie|concours|photo|vid[ée]o|newsletter|partenaire|sondage|quiz|jeu\b|b[ée]n[ée]vole|recherche|\bclub\b|licenci|adh[ée]rent|\btests?\b|\bvma\b|plus anciens/i;
const SENS_RESULTATS = /r[ée]sultat|classement|results?\b|ranking/i;
// klikego, njuko… chronomètrent ET vendent les dossards : leur lien « S'inscrire » n'est pas un classement.
const SENS_INSCRIPTION = /inscri|register|registration|dossard|billet|ticket|engagement|r[ée]server/i;

export type LienResultats = { url: string; annee: number | null; texte: string; chronometreur: boolean };

/** Plus vieux que ça, un classement ne répond plus à « comment s'est passée la course ». */
export const ANCIENNETE_MAX_ANS = 2;

const MOTS_VIDES = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "sur", "the", "and", "of",
  "trail", "trails", "course", "courses", "foulee", "foulees", "run", "running", "semi", "marathon", "nocturne", "nature",
  "ronde", "corrida", "tour", "grand", "petit", "petite", "boucle", "boucles", "edition", "challenge", "cross", "ultra",
  "raid", "race", "urbain", "urban", "defi", "saint", "sainte", "courir", "rose", "octobre", "solidaire", "resultats"]);

/** Les mots DISTINCTIFS d'un nom de course : « 10 km d'Isneauville » → [« isneauville »]. */
export function motsDistinctifs(nom: string): string[] {
  return [...new Set(nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 4 && !/^\d+$/.test(m) && !MOTS_VIDES.has(m)))];
}

// Un site de CLUB ou d'institution publie les résultats de ses licenciés, pas le classement
// de la course (« reims-athletisme.fr/resultats », « classement des clubs » FFA).
const HOTE_GENERIQUE = /athle|athletisme|club|federation|fftri|ligue|comite|mairie|tourisme/i;

const sansBalises = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
  .replace(/&eacute;/g, "é").replace(/&#233;/g, "é").replace(/\s+/g, " ").trim();

/** L'année la plus récente lue dans un texte (2010 → année en cours), ou `null`. */
export function anneeDe(texte: string, anneeCourante: number): number | null {
  const ans = (texte.match(/(?<!\d)20[1-3]\d(?!\d)/g) ?? []).map(Number).filter((a) => a >= 2010 && a <= anneeCourante);
  return ans.length ? Math.max(...ans) : null;
}

const decode = (u: string) => { try { return decodeURIComponent(u); } catch { return u; } };


/**
 * Les entités HTML d'un attribut `href`. ⚠️ `&amp;` ne suffit pas : « Corrida%20d&#039;Issy »
 * est parti tel quel en base (29/09/2026) et le chronométreur répondait 404 — avec
 * l'apostrophe, la page existe.
 */
export const entites = (h: string) => h
  .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'").replace(/&quot;|&#0*34;/gi, '"').replace(/&amp;/gi, "&");

export const estChronometreur = (url: string) => {
  const h = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } })();
  return CHRONOMETREURS.some((c) => h === c || h.endsWith(`.${c}`));
};

/**
 * Le meilleur lien de résultats d'une page, ou `null`. Préférence : un chronométreur,
 * puis l'année la plus récente, puis un libellé court (un menu, pas une phrase).
 */
export function lienResultats(
  html: string, base: string, anneeCourante: number, evenement?: { noms: string[] },
): LienResultats | null {
  const cands = candidatsResultats(html, base, anneeCourante, evenement, ANCIENNETE_MAX_ANS);
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  const { score: _s, anneesLues: _a, ...meilleur } = cands[0];
  return meilleur;
}

/**
 * UN LIEN PAR ANNÉE — les classements des éditions passées publiés par l'organisateur
 * lui-même (« Résultats 2024 », « Classement 2023 ») (30/09/2026). Mêmes filtres de SENS que
 * `lienResultats` (pas de tirage au sort, pas de club, la course nommée), sans limite d'âge,
 * et l'année doit être LUE SANS AMBIGUÏTÉ : « Résultats 2019 à 2024 » n'est rangé nulle part.
 */
export function liensResultatsParAnnee(
  html: string, base: string, anneeCourante: number, evenement?: { noms: string[] },
): { annee: number; url: string }[] {
  const parAnnee = new Map<number, { url: string; score: number }>();
  for (const c of candidatsResultats(html, base, anneeCourante, evenement, Infinity)) {
    if (c.anneesLues.length !== 1) continue;
    const a = c.anneesLues[0];
    if (a < 2005 || a > anneeCourante) continue;
    const deja = parAnnee.get(a);
    if (!deja || c.score > deja.score) parAnnee.set(a, { url: c.url, score: c.score });
  }
  return [...parAnnee].map(([annee, x]) => ({ annee, url: x.url })).sort((a, b) => b.annee - a.annee);
}

/**
 * La page « Résultats » du MÊME site, sans année (le menu « Résultats » → « /resultats ») :
 * c'est là que les organisateurs rangent leurs archives « 2024 », « 2023 »… `null` si
 * l'accueil ne renvoie qu'à un chronométreur ou à une page datée.
 */
export function pageArchivesResultats(
  html: string, base: string, anneeCourante: number, evenement?: { noms: string[] },
): string | null {
  const sans = (u: string) => u.replace(/#.*$/, "").replace(/\/$/, "");
  const cands = candidatsResultats(html, base, anneeCourante, evenement, Infinity)
    .filter((c) => !c.chronometreur && c.anneesLues.length === 0 && domaineDe(c.url) === domaineDe(base) && sans(c.url) !== sans(base))
    .sort((a, b) => b.score - a.score);
  return cands[0]?.url ?? null;
}

/** Les liens de résultats d'une page qui passent les filtres de sens, notés. */
function candidatsResultats(
  html: string, base: string, anneeCourante: number, evenement: { noms: string[] } | undefined, ageMax: number,
): (LienResultats & { score: number; anneesLues: number[] })[] {
  // ⚠️ UN ORGANISATEUR A PLUSIEURS ÉPREUVES. Lu le 28/09/2026 : le menu « Classements »
  // d'une agence menait à une cyclo, pas au trail demandé. Le lien doit NOMMER la course
  // (un mot distinctif dans l'adresse ou le libellé), ou vivre sur un site qui la nomme.
  const mots = evenement ? evenement.noms.flatMap(motsDistinctifs) : null;
  const nomme = (x: string) => !mots || mots.some((m) => x.includes(m));
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const hoteBase = (() => { try { return new URL(base).hostname.toLowerCase(); } catch { return ""; } })();
  const cands: (LienResultats & { score: number; anneesLues: number[] })[] = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (let m; (m = re.exec(html));) {
    const texte = sansBalises(m[2]).slice(0, 120);
    let url: string;
    try { url = new URL(entites(m[1]), base).toString(); } catch { continue; }
    // Porte unique : bouton de partage, blog tiers, fiche d'un coureur… (lib/races/lienPropre).
    const propre = lienClassementPropre(url);
    if (!propre) continue;
    url = propre;
    const chrono = estChronometreur(url);
    const dit = `${texte} ${decode(sansDossierDePublication(url))}`;
    const chemin = (() => { const u = new URL(url); return decode(u.hostname + u.pathname + u.hash); })();
    // Le SENS se lit dans le libellé et le chemin, pas dans la requête : « ?max-results=5 »
    // (la pagination d'un blog) passait pour un lien de résultats.
    if (!SENS_RESULTATS.test(`${texte} ${chemin}`) && !(chrono && /live/i.test(url))) continue;
    // Un libellé LONG est l'accroche d'un article, pas un menu « Résultats » : lu le 30/09/2026,
    // « Des arbitrages à hauteur de 30 M€… qui scelle les résultats de l'exercice » (un conseil
    // municipal) passait pour le classement. Il faut alors que l'ADRESSE parle de résultats.
    if (texte.length > 60 && !chrono && !SENS_RESULTATS.test(chemin)) continue;
    if (SENS_ECARTES.test(texte) || SENS_INSCRIPTION.test(texte)) continue;
    // « Résultats Duo Trail » menait à « /le-dossard-pour-le-duo-trail… » : une vente de dossards.
    if (SENS_INSCRIPTION.test(chemin) && !SENS_RESULTATS.test(chemin)) continue;
    const annee = anneeDe(dit, anneeCourante);
    if (annee != null && annee < anneeCourante - ageMax) continue;
    if (/frmbase=cclubs|classement des clubs/i.test(dit)) continue;
    if (mots) {
      const u = new URL(url);
      const memeSite = u.hostname.toLowerCase() === hoteBase;
      const siteNomme = memeSite && !HOTE_GENERIQUE.test(hoteBase) && nomme(norm(hoteBase));
      if (!siteNomme && !nomme(norm(`${decode(u.pathname + u.search + u.hash)} ${texte}`))) continue;
    }
    const score = (chrono ? 100 : 0) + (annee ? annee - 2000 : 0) + (texte.length > 0 && texte.length <= 40 ? 5 : 0);
    // Les années DISTINCTES lues dans le libellé et le chemin (pas la requête ni le domaine).
    // Ni le domaine (« trail2025.fr ») ni l'ancre : seulement ce que dit la page visée.
    const anneesLues = [...new Set((`${texte} ${decode(sansDossierDePublication(new URL(url).pathname))}`.match(/(?<!\d)20[0-3]\d(?!\d)/g) ?? []).map(Number))];
    cands.push({ url, annee, texte, chronometreur: chrono, score, anneesLues });
  }
  return cands;
}

/**
 * Le robots.txt autorise-t-il cette page à un robot quelconque ? Lecture volontairement
 * PRUDENTE : groupe `*` (ou le nôtre), règle la plus longue ; au moindre doute, non.
 */
export function robotsAutorise(robots: string | null, chemin: string, agent = "pacevobot"): boolean {
  if (robots == null) return true;   // pas de robots.txt (404) : tout est permis
  const groupes: { agents: string[]; regles: { permis: boolean; motif: string }[] }[] = [];
  let courant: (typeof groupes)[number] | null = null, dernierEtaitAgent = false;
  for (const brut of robots.split(/\r?\n/)) {
    const l = brut.replace(/#.*/, "").trim();
    const m = l.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const cle = m[1].toLowerCase(), val = m[2].trim();
    if (cle === "user-agent") {
      if (!courant || !dernierEtaitAgent) { courant = { agents: [], regles: [] }; groupes.push(courant); }
      courant.agents.push(val.toLowerCase()); dernierEtaitAgent = true;
    } else if (courant) {
      dernierEtaitAgent = false;
      if (val || cle === "allow") courant.regles.push({ permis: cle === "allow", motif: val });
    }
  }
  const pour = groupes.find((g) => g.agents.includes(agent)) ?? groupes.find((g) => g.agents.includes("*"));
  if (!pour) return true;
  const colle = (motif: string) => {
    const rx = new RegExp("^" + motif.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    return rx.test(chemin);
  };
  const applicables = pour.regles.filter((r) => r.motif !== "" && colle(r.motif)).sort((a, b) => b.motif.length - a.motif.length);
  return applicables.length ? applicables[0].permis : true;
}
