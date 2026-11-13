/**
 * LES LIENS INTERNES VERS LES ARTICLES DU BLOG.
 *
 * ⚠️ POURQUOI CE MODULE EXISTE (Search Console, 13/11/2026). Sur 17 articles, Google n'en
 * avait indexé que 4 ; 11 lui étaient INCONNUS (« Google ne reconnaît pas cette URL »),
 * dont des articles en ligne depuis août. Aucun blocage technique : 200 pour Googlebot,
 * pas de noindex, les 17 adresses dans le plan du site. Mais un article n'était lié que
 * depuis `/blog`, elle-même explorée pour la dernière fois le 5 octobre, dans un plan de
 * 15 400 adresses faites surtout de pages de courses. Un moteur explore d'abord ce qui
 * reçoit des liens : ce module en pose depuis l'accueil, depuis chaque article et depuis
 * chaque page de course.
 *
 * Il ne dépend que de `slugs.ts` et de `posts.ts` (légers), jamais de `articles.ts` :
 * la page d'accueil est un composant client.
 */
import { SLUGS_BLOG } from "./slugs";
import { POSTS } from "./posts";

export type LienArticle = { cle: string; slug: string; href: string };

const lien = (cle: string): LienArticle | null =>
  SLUGS_BLOG[cle] ? { cle, slug: SLUGS_BLOG[cle], href: `/blog/${SLUGS_BLOG[cle]}` } : null;

/** Les articles ÉCRITS, du plus récent au plus ancien (l'identifiant de carte croît avec le temps). */
const ecritsDuPlusRecent = (): { cle: string; cat: string }[] =>
  POSTS.filter((p) => SLUGS_BLOG[p.key])
    .slice()
    .sort((a, b) => b.id - a.id)
    .map((p) => ({ cle: p.key, cat: p.cat }));

const sansDoublon = (cles: string[]): LienArticle[] =>
  [...new Set(cles)].map(lien).filter((l): l is LienArticle => l !== null);

/** Les `n` derniers articles écrits : pour l'accueil. */
export function derniersArticles(n = 3): LienArticle[] {
  return sansDoublon(ecritsDuPlusRecent().map((p) => p.cle)).slice(0, n);
}

/** Les éléments qui SUIVENT la position `i` dans la liste, en bouclant, sans l'élément lui-même. */
const suivantsEnBoucle = <T,>(liste: T[], i: number): T[] => [...liste.slice(i + 1), ...liste.slice(0, i)];

/**
 * « À lire aussi », en bas d'un article : d'abord la même rubrique, puis les autres.
 * Jamais l'article lui-même.
 *
 * ⚠️ EN BOUCLE, PAS « LES PLUS RÉCENTS ». Un premier jet prenait les trois articles les
 * plus récents de la rubrique : les anciens (Body Battery, déficit énergétique) ne
 * recevaient alors AUCUN lien, ce qui est exactement le défaut à corriger. Chaque article
 * lie donc ceux qui le SUIVENT dans l'ordre de parution, le dernier rebouclant sur le
 * premier : tout article est lié par celui qui le précède.
 */
export function articlesVoisins(slug: string, n = 3): LienArticle[] {
  const tous = ecritsDuPlusRecent().reverse(); // du plus ancien au plus récent
  const i = tous.findIndex((p) => SLUGS_BLOG[p.cle] === slug);
  if (i < 0) return derniersArticles(n);
  const rubrique = tous.filter((p) => p.cat === tous[i].cat);
  const memeRubrique = suivantsEnBoucle(rubrique, rubrique.findIndex((p) => p.cle === tous[i].cle));
  return sansDoublon([...memeRubrique, ...suivantsEnBoucle(tous, i)].map((p) => p.cle)).slice(0, n);
}

/**
 * Les articles utiles à qui prépare CETTE course. Choix par règles lisibles, pas par
 * score : un lien hors sujet sur 15 000 pages vaudrait pire que pas de lien.
 *
 *  · trail de 42 km et plus → choisir son premier ultra, chaussure de trail, GPS en forêt ;
 *  · trail plus court       → chaussure de trail, GPS en forêt, plaque carbone en trail ;
 *  · marathon sur route     → ravitaillement marathon, renforcement, VFC et charge ;
 *  · semi-marathon          → semi en moins d'1 h 45, renforcement, VFC et charge ;
 *  · tout le reste          → renforcement, VFC et charge, choisir une application.
 *
 * « Trail » se lit sur le type de la course, ou à défaut sur son dénivelé (500 m et plus).
 * Distance inconnue : on retombe sur le cas général, sans rien supposer.
 */
export function articlesPourCourse(c: {
  distanceKm?: number | null;
  deniveleM?: number | null;
  type?: string | null;
}): LienArticle[] {
  const km = Number(c.distanceKm);
  const dplus = Number(c.deniveleM);
  const trail = /trail/i.test(String(c.type ?? "")) || (Number.isFinite(dplus) && dplus >= 500);
  const connu = Number.isFinite(km) && km > 0;
  const cles = trail
    ? connu && km >= 42 ? ["p5", "p8", "p14"] : ["p8", "p14", "p15"]
    : connu && km >= 40 && km <= 45 ? ["p7", "p10", "p2"]
    : connu && km >= 20 && km <= 22.5 ? ["p3", "p10", "p2"]
    : ["p10", "p2", "p17"];
  return sansDoublon(cles);
}
