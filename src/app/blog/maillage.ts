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
 * Il ne dépend que de `slugs.ts`, de `posts.ts` et de `lib/raceType` (légers), jamais de
 * `articles.ts` ni de `blogI18n.ts` (les titres seuls sont dans `titres.ts`) :
 * la page d'accueil est un composant client.
 */
import type { RaceType } from "@/types";
import { correctedRaceType } from "@/lib/raceType";
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

/** Les valeurs RÉELLES de `races.type` (`RaceType`, `src/types`). */
const TYPES_COURSE: readonly RaceType[] = ["road_5k", "road_10k", "semi", "marathon", "trail_s", "trail_m", "trail_l", "trail_xl", "ultra"];
const estTypeCourse = (t: unknown): t is RaceType => TYPES_COURSE.includes(t as RaceType);

/**
 * Les articles utiles à qui prépare CETTE course. Choix par règles lisibles, pas par
 * score : un lien hors sujet sur 15 000 pages vaudrait pire que pas de lien.
 *
 *  · trail long (type `trail_l`, `trail_xl` ou `ultra`, ou distance de 42 km et plus)
 *    → choisir son premier ultra, chaussure de trail, GPS en forêt ;
 *  · trail plus court   → chaussure de trail, GPS en forêt, plaque carbone en trail ;
 *  · marathon sur route → ravitaillement marathon, renforcement, VFC et charge ;
 *  · semi-marathon      → semi en moins d'1 h 45, renforcement, VFC et charge ;
 *  · tout le reste      → renforcement, VFC et charge, Body Battery.
 *
 * ⚠️ PAS L'ARTICLE « QUELLE APPLICATION CHOISIR » DANS LE CAS GÉNÉRAL (Cyprien, 16/11/2026).
 * Sous le titre « À lire pour préparer cette course », il tenait de la promotion sur les
 * pages de 5 km et de 10 km. « Body Battery à 20 % : faut-il courir ? » sert n'importe
 * quel coureur qui porte une montre.
 *
 * ⚠️ LE TYPE SE LIT SUR LES VRAIES VALEURS (relecture @Maestro, 13/11/2026). Un premier jet
 * cherchait « trail » dans le type : une course `ultra` sans dénivelé renseigné recevait
 * donc les trois articles génériques au lieu de « choisir son premier ultra ». Le test
 * passait, parce qu'il employait des types INVENTÉS (« trail », « route »). On passe donc
 * par `correctedRaceType`, la même correction que le catalogue (elle reclasse par la
 * distance, et par le nom quand l'organisateur a écrit « Trail »), et le test balaie les
 * neuf valeurs de `RaceType`.
 *
 * ⚠️ `semi` ET `marathon` COUVRENT LARGE EN BASE : `semi` va de 16 à 30 km, `marathon`
 * commence à 30 km. L'article sur le semi ou sur le ravitaillement du marathon n'est donc
 * proposé que si la DISTANCE le confirme, ou si elle est inconnue.
 *
 * Type absent ou inconnu : on se rabat sur le dénivelé (500 m et plus = trail), puis sur
 * la distance, puis sur le cas général, sans rien supposer.
 */
export function articlesPourCourse(c: {
  distanceKm?: number | null;
  deniveleM?: number | null;
  type?: string | null;
  nom?: string | null;
}): LienArticle[] {
  const km = Number(c.distanceKm);
  const dplus = Number(c.deniveleM);
  const connu = Number.isFinite(km) && km > 0;
  const type = estTypeCourse(c.type) ? correctedRaceType(connu ? km : null, c.type, c.nom) : null;
  const trail = type ? /trail|ultra/.test(type) : Number.isFinite(dplus) && dplus >= 500;
  const long = type === "trail_l" || type === "trail_xl" || type === "ultra" || (connu && km >= 42);
  const marathon = connu ? km >= 40 && km <= 45 : type === "marathon";
  const semi = connu ? km >= 20 && km <= 22.5 : type === "semi";
  const cles = trail
    ? long ? ["p5", "p8", "p14"] : ["p8", "p14", "p15"]
    : marathon ? ["p7", "p10", "p2"]
    : semi ? ["p3", "p10", "p2"]
    : ["p10", "p2", "p4"];
  return sansDoublon(cles);
}
