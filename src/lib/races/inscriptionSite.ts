/**
 * LE LIEN « S'INSCRIRE » LU SUR LE SITE OFFICIEL (30/09/2026).
 *
 * Demandé par Cyprien le 28/09/2026 : « les liens pour s'inscrire directement ». Mesuré le
 * 30/09 : 438 formats seulement avaient un lien d'inscription direct ; les autres menaient
 * au site de l'organisateur, ou à la fiche d'un calendrier. Or la page d'accueil de
 * l'organisateur — déjà lue chaque semaine pour le classement et le dénivelé — porte
 * presque toujours un bouton « Inscriptions », souvent vers la plateforme qui vend les
 * dossards (njuko, klikego, protiming…). Aucune requête de plus.
 *
 * ⚠️ UN LIEN D'INSCRIPTION FAUX EST PIRE QU'AUCUN. On écarte : la « liste des inscrits »,
 * l'inscription à la newsletter, des bénévoles, au club ; un bulletin à imprimer (PDF) ;
 * une édition passée (« Inscriptions 2025 ») ; les résultats ; et — comme pour le
 * classement — une page qui ne nomme pas la course chez un organisateur de plusieurs
 * épreuves. Tout ce qui DÉCIDE est ici ; `scripts/resultats-sites.ts` lit les pages.
 */
import { entites, motsDistinctifs } from "./resultatsSite";
import { domaineDe } from "./destination";

/** Plateformes qui vendent des dossards : un lien vers elles, libellé « inscription », EST l'inscription. */
export const PLATEFORMES_INSCRIPTION = [
  "njuko.net", "klikego.com", "protiming.fr", "adeorun.com", "chrono-start.com", "yaka-inscription.com", "ipitos.com",
  "espace-competition.com", "l-chrono.com", "3wsport.com", "helloasso.com", "weezevent.com", "billetweb.fr",
  "timepulse.fr", "le-sportif.com", "sportinnovation.fr", "breizhchrono.com", "top-chrono.fr", "chronowest.fr",
  "endurance-chrono.com", "mychrono.fr", "active-timing.fr", "g-live.fr", "ats-sport.com", "sportips.fr",
  "inscription-facile.com", "sporkrono-inscriptions.fr", "utmb.world", "wiclax.com", "acn-timing.com", "nikrome.com",
  "endurancechrono.com", "sportpro.re", "chronopuces.fr",
  // Relevées sur les échantillons du 30/09/2026 : njuko sert ses inscriptions en « in.njuko.com ».
  "njuko.com", "inscriptions-tiel.com", "sportsnconnect.com", "ikinoa.com", "onsinscrit.com", "chronoboost.fr", "sporkrono.fr",
] as const;

// Des calendriers, pas des inscriptions : les proposer serait revenir au point de départ.
const CALENDRIERS = /(^|\.)(finishers\.com|jogging-plus\.com|milesrepublic\.com|kikourou\.net|betrail\.run|runningmap\.org|calendrier)/i;

// ⚠️ PAS « engagement » : « Nos engagements » (valeurs d'un club) passait pour une inscription.
const SENS_INSCRIPTION = /inscri|s'inscrire|je m'inscris|register|registration|billetterie|acheter (?:mon|un|son) dossard/i;
// Relevés sur de vrais sites le 30/09/2026 : « liste des inscrits », « 451 personnes
// inscrites » (la liste des coureurs chez protiming), « inscriptions assemblée
// générale », une page d'agenda de mairie, « entraînements » d'un club… : pas la course.
const SENS_ECARTES = /inscrite?s?\b|liste des|newsletter|lettre d'info|b[ée]n[ée]vole|volontaire|\bclub\b|licence|adh[ée]si|partenaire|exposant|village|mon compte|connexion|se connecter|r[ée]sultat|classement|photo|r[èe]glement|bulletin|tirage|annul|rembours|transf[ée]r|modifi|assembl|\bstages?\b|formation|atelier|entra[iî]nement|[ée]cole|repas|soir[ée]e|pasta|d[iî]ner|agenda|actualit|\bactus?\b|\bnews\b|\bblog\b|adh[ée]rent|aux comp[ée]titions/i;
// L'adresse elle-même dit l'inscription : « /inscriptions », « /register », « …-reservez-votre-dossard ».
const CHEMIN_INSCRIPTION = /inscri|register|registration|billet|dossard|ticket|s-?inscrire/i;
const DOCUMENT = /\.(pdf|docx?|xlsx?|odt|jpe?g|png)(\?|$)/i;
// Un site de CLUB ou d'institution : ses « inscriptions » sont souvent celles du club.
const HOTE_GENERIQUE = /athle|athletisme|club|federation|ligue|comite|mairie|tourisme/i;

export type LienInscription = { url: string; texte: string; plateforme: boolean };

const sansBalises = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
  .replace(/&eacute;/g, "é").replace(/&#233;/g, "é").replace(/&agrave;/g, "à").replace(/&#0*39;|&#x0*27;|&rsquo;|&apos;|&#8217;|&#x2019;/gi, "'")
  .replace(/\s+/g, " ").trim();
const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const decode = (u: string) => { try { return decodeURIComponent(u); } catch { return u; } };

export const estPlateformeInscription = (url: string) => {
  const h = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } })();
  return PLATEFORMES_INSCRIPTION.some((p) => h === p || h.endsWith(`.${p}`));
};

/**
 * Le meilleur lien d'inscription d'une page, ou `null`. Préférence : une plateforme de
 * dossards, puis l'année la plus récente, puis un libellé court (un bouton, pas une phrase).
 */
export function lienInscriptionSite(
  html: string, base: string, anneeCourante: number, evenement?: { noms: string[] },
): LienInscription | null {
  const mots = evenement ? evenement.noms.flatMap(motsDistinctifs) : null;
  const nomme = (x: string) => !mots || mots.some((m) => x.includes(m));
  const hoteBase = (() => { try { return new URL(base).hostname.toLowerCase(); } catch { return ""; } })();
  const cands: (LienInscription & { score: number })[] = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (let m; (m = re.exec(html));) {
    const texte = sansBalises(m[2]).slice(0, 120);
    let url: string;
    try { url = new URL(entites(m[1]), base).toString(); } catch { continue; }
    if (!/^https?:\/\//i.test(url) || DOCUMENT.test(url)) continue;
    const u = new URL(url);
    // Un billet de blog DATÉ (« /2025/11/17/ouverture-des-inscriptions-2026/ ») annonce les
    // inscriptions ; il n'inscrit pas.
    if (/\/20\d{2}\/\d{2}\/(?:\d{2}\/)?/.test(u.pathname)) continue;
    if (CALENDRIERS.test(u.hostname)) continue;
    const chemin = decode(u.hostname + u.pathname);
    // Le SENS se lit dans le libellé, et à défaut dans le chemin (« /inscriptions »).
    if (!SENS_INSCRIPTION.test(texte) && !SENS_INSCRIPTION.test(chemin)) continue;
    if (SENS_ECARTES.test(texte) || SENS_ECARTES.test(decode(u.pathname))) continue;
    // Une édition PASSÉE : « Inscriptions 2025 » n'inscrit plus personne. L'ADRESSE prime :
    // « Inscription Hello-asso 2026 » menait à « …/2025/01/lien-inscription-2025.html ».
    const an = (x: string) => x.match(/(?<!\d)20[2-3]\d(?!\d)/g)?.map(Number) ?? [];
    const anneesAdresse = an(decode(u.pathname + u.search)), annees = [...an(texte), ...anneesAdresse];
    if (anneesAdresse.length && Math.max(...anneesAdresse) < anneeCourante) continue;
    if (annees.length && Math.max(...annees) < anneeCourante) continue;
    const plateforme = estPlateformeInscription(url);
    // La preuve : une plateforme de dossards, une adresse qui dit « inscription », ou un
    // BOUTON court vers un autre site (« Inscriptions ouvertes » → le chronométreur). Un
    // libellé seul, sur le même site, menait à « /2-circuits » ou « /entrainements-1 ».
    // Même SITE, pas même nom d'hôte : « boutique.bagnolesdelorne.com » (la boutique de
    // l'office de tourisme) n'est pas un autre site que « www.bagnolesdelorne.com ».
    const memeHote = domaineDe(url) === domaineDe(base);
    const bouton = !memeHote && texte.length > 0 && texte.length <= 30 && SENS_INSCRIPTION.test(texte);
    if (!plateforme && !CHEMIN_INSCRIPTION.test(chemin) && !bouton) continue;
    if (mots) {
      const memeSite = u.hostname.toLowerCase() === hoteBase;
      const siteNomme = memeSite && !HOTE_GENERIQUE.test(hoteBase) && nomme(norm(hoteBase));
      // L'adresse d'un site de CLUB ne nomme pas la course : « athle-caluire.net/inscriptions-
      // aux-competitions » n'inscrit pas au DIXkm de Caluire.
      const hote = HOTE_GENERIQUE.test(u.hostname) ? "" : u.hostname;
      if (!siteNomme && !nomme(norm(`${decode(hote + u.pathname + u.search)} ${texte}`))) continue;
    }
    const score = (plateforme ? 100 : 0) + (annees.length ? Math.max(...annees) - 2000 : 0)
      + (texte.length > 0 && texte.length <= 30 ? 5 : 0);
    cands.push({ url, texte, plateforme, score });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  const { score: _s, ...meilleur } = cands[0];
  return meilleur;
}
