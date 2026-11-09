import { RUBRIQUES_LETTRE, FILTRES, PAS_ELITE, PAS_CONSEIL, CONTEXTE_COURSE, COURSE_A_PIED, PROMO, TEST_MATERIEL, HORS_COURSE } from "@/lib/news/rubriques";
import { collecterSemaine, collecterNutritionSemaine, collecterMaterielSemaine, collecterConseilsSemaine, lienGoogleNews } from "@/lib/news/actualites";
import { classerALaUne, motsDuTitre, texteDuSujet, type Sujet } from "@/lib/news/alaune";
import { ordonnerSelon, type Edition } from "@/lib/newsletter/edition";

/**
 * LA SÉLECTION DE LA LETTRE — partagée par la lettre du lundi et par les candidats
 * que lit @Gazette (`/api/newsletter/candidats`).
 *
 * Sortie de `api/newsletter/weekly/route.ts` le 10/11/2026 : @Gazette doit voir les
 * MÊMES candidats que ceux que la lettre acceptera. Deux copies de ces règles auraient
 * divergé à la première retouche, et l'édition aurait désigné des articles que la lettre
 * ne connaît pas.
 */

export type Item = { title: string; source: string; link: string; date: string; texte?: string; langue?: "fr" | "en" };

export const MINIMUM_ARTICLES = 5;
/** Sujets proposés au-delà des places de la une, pour que @Gazette ait le choix. */
export const SUJETS_EN_PLUS = 7;

// Ni promotion ni hors-sujet, nulle part dans la lettre (voir `PROMO`, `HORS_COURSE`).
export const publiable = (it: Item) => !PROMO.test(it.title) && !HORS_COURSE.test(it.title);

export type Selection = {
  parRubrique: Item[][];
  une: Sujet<Item>[];
  candidatsUne: Sujet<Item>[];
  sujetsUne: Set<string>;
  dejaALaUne: Set<string>;
  texteUne: Map<string, string>;
  mediasUne: Map<string, number>;
  recents: Item[];
  echecSemaine: string | null;
};

export async function preparerSelection({ base, edition }: { base: string; edition: Edition | null }): Promise<Selection> {
  // ── 1. L'actualité, PAR RUBRIQUE ───────────────────────────────────────────
  // Une seule liste à plat mélangeait un test de chaussure et un résultat d'ultra. Les
  // rubriques existent déjà dans l'agrégateur du fil Communauté : on les réutilise plutôt
  // que d'inventer un classement, qui serait forcément approximatif.
  const ilYaUneSemaine = Date.now() - 7 * 24 * 3600 * 1000;
  const recentsDe = async (cat: string): Promise<Item[]> => {
    try {
      const r = await fetch(`${base}/api/community/news?cat=${cat}&avecTexte=1`, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) return [];
      const items = ((await r.json()) as { items?: Item[] }).items ?? [];
      return items.filter((it) => {
        const t = new Date(it.date).getTime();
        return Number.isFinite(t) && t >= ilYaUneSemaine;
      });
    } catch { return []; }
  };

  // Le sommaire vit dans `lib/news/rubriques` : la lettre ne nomme plus ses rubriques
  // à la main, elle parcourt la liste. Une rubrique inexistante y serait refusée par le
  // typage, plus seulement silencieusement remplacée par l'actualité générale.
  let echecSemaine: string | null = null;
  const [parRubrique, semaineBrute, nutritionSemaine, materielSemaine, conseilsSemaine] = await Promise.all([
    Promise.all(RUBRIQUES_LETTRE.map((r) => recentsDe(r.cat))),
    // Une panne ici ne doit pas annuler la lettre : la une retombe sur le fil, et la
    // réponse (lue dans le journal de l'action GitHub) dit pourquoi.
    collecterSemaine().catch((e: unknown) => { echecSemaine = e instanceof Error ? e.message : String(e); return [] as Item[]; }),
    // Même règle : une panne ne coûte que la rubrique, qui retombe sur le fil.
    collecterNutritionSemaine().catch(() => [] as Item[]),
    collecterMaterielSemaine().catch(() => [] as Item[]),
    collecterConseilsSemaine().catch(() => [] as Item[]),
  ]);
  const tempsDe = (it: Item) => new Date(it.date).getTime() || 0;
  // ⚠️ Un article dont on peut lire le texte (fourni par le flux, ou lien direct vers une
  // page que l'éditeur autorise) passe devant un lien Google News, qui partira en titre
  // seul : son robots.txt interdit d'ouvrir ses pages d'articles (vérifié le 10/11/2026),
  // et Ouest-France refuse PacevoBot. À égalité, le plus récent.
  const resumable = (it: Item) => ((it.texte ?? "").trim().length >= 320 || !lienGoogleNews(it.link) ? 1 : 0);
  const parInteret = (a: Item, b: Item) => resumable(b) - resumable(a) || tempsDe(b) - tempsDe(a);
  // Pour un abonné français : un article français résumable d'abord, puis un article
  // anglais résumable (titre et résumé seront traduits), puis un titre français seul.
  const interetFr = (it: Item) => resumable(it) * 2 + (it.langue === "en" ? 0 : 1);
  const parInteretFr = (a: Item, b: Item) => interetFr(b) - interetFr(a) || tempsDe(b) - tempsDe(a);
  // Un média, un article : Runner's World publie une dizaine de conseils par semaine et
  // aurait occupé toute la rubrique.
  const unParMedia = (liste: Item[]) => {
    const vus = new Set<string>();
    return liste.filter((it) => !vus.has(it.source) && (vus.add(it.source), true));
  };
  const semaine = semaineBrute.filter(publiable);

  // ── 1 bis. LA UNE : les sujets dont le plus de médias ont parlé ────────────
  // ⚠️ La une prenait les 5 articles les plus RÉCENTS du fil (coupé à 48). Le 9/11/2026,
  // la backyard de Clem qui court — 26 médias en une semaine — en était absente, au
  // profit de quatre articles américains publiés dans la demi-heure. Voir `lib/news/alaune`.
  // Si la collecte de la semaine échoue, on retombe sur le fil, comme avant.
  const maxUne = RUBRIQUES_LETTRE[0].max;
  // Plus de sujets que de places : @Gazette peut en préférer un autre (voir `lib/newsletter/edition`).
  // Sans édition, les `maxUne` premiers sont exactement ceux du classement : il est glouton.
  const candidatsUne = semaine.length >= MINIMUM_ARTICLES ? classerALaUne(semaine, maxUne + SUJETS_EN_PLUS) : [];
  const une = ordonnerSelon(candidatsUne, edition?.rubriques.une, (s) => s.article.link).slice(0, maxUne);
  if (une.length) parRubrique[0] = une.map((s) => s.article);
  // Les mots des sujets de la une : un autre article sur le même sujet n'y revient pas
  // par une autre rubrique (la backyard en « Trail », Bordeaux en « Élites »).
  const sujetsUne = new Set(une.filter((s) => s.mot).map((s) => s.mot));
  // Et tous les articles rattachés à ces sujets, même sans leur mot (Le Parisien titrait
  // « les 25 heures de Clem qui court », sans « backyard », et revenait en « Élites »).
  const dejaALaUne = new Set(une.flatMap((s) => s.membres.map((m) => m.link)));
  const recents = une.length ? semaine : parRubrique[0];

  // ── 1 ter. ÉLITES : les résultats de la semaine, par nombre de médias ──────
  // ⚠️ La rubrique est sortie VIDE le 9/11/2026. Elle lisait le fil « elite » du site :
  // une requête Google News sans borne de date (ses articles dataient de 2024 à
  // septembre) et trois flux anglophones dont les titres passent rarement le filtre.
  // Une fois gardés les seuls articles de la semaine, il ne restait rien. Elle puise
  // désormais dans la semaine entière, comme la une, avec le filtre des résultats.
  const iElite = RUBRIQUES_LETTRE.findIndex((r) => r.cle === "elite");
  let sujetsElites: typeof une = [];
  if (iElite > 0 && semaine.length) {
    const resultats = semaine.filter((it) =>
      FILTRES.elite!.test(it.title) && !PAS_ELITE.test(it.title) && !dejaALaUne.has(it.link)
      && !motsDuTitre(it.title).some((m) => sujetsUne.has(m)));
    sujetsElites = classerALaUne(resultats, RUBRIQUES_LETTRE[iElite].max + 3);
    if (sujetsElites.length) parRubrique[iElite] = sujetsElites.map((s) => s.article);
  }

  // ── 1 quater. NUTRITION : la semaine, la course, pas la charcuterie ──────────
  // ⚠️ Vide le 9/11/2026 pour la même raison qu'Élites (voir `collecterNutritionSemaine`).
  // Classée par DATE, pas par nombre de médias : « nutrition » est le thème de la
  // rubrique, il réunirait tous ses articles en un seul « sujet » et n'en garderait qu'un.
  const iNutrition = RUBRIQUES_LETTRE.findIndex((r) => r.cle === "nutrition");
  if (iNutrition > 0 && nutritionSemaine.length) {
    const nutrition = nutritionSemaine
      .filter((it) => FILTRES.nutrition!.test(it.title) && CONTEXTE_COURSE.test(it.title) && !PROMO.test(it.title) && !dejaALaUne.has(it.link))
      .sort(parInteret);
    if (nutrition.length) parRubrique[iNutrition] = nutrition;
  }

  // ── 1 quinquies. MATÉRIEL : des tests en français d'abord ──────────────────
  // ⚠️ Entièrement anglophone le 9/11/2026 (voir `collecterMaterielSemaine`). Les tests
  // français de la semaine passent devant ; les tests anglophones complètent, parce que
  // leur flux fournit le texte et qu'ils seront résumés (un titre français de Google
  // News, lui, part seul : son robots.txt interdit d'ouvrir ses pages d'articles).
  const iMateriel = RUBRIQUES_LETTRE.findIndex((r) => r.cle === "materiel");
  if (iMateriel > 0 && materielSemaine.length) {
    // Un média, un test : Run Actu en publie plusieurs par semaine.
    const francais = unParMedia(materielSemaine
      .filter((it) => it.langue !== "en" && FILTRES.gear!.test(it.title) && TEST_MATERIEL.test(it.title) && publiable(it) && !dejaALaUne.has(it.link))
      .sort(parInteret))
      .slice(0, RUBRIQUES_LETTRE[iMateriel].max - 1);
    if (francais.length) {
      const liens = new Set(francais.map((it) => it.link));
      parRubrique[iMateriel] = [...francais, ...parRubrique[iMateriel].filter((it) => !liens.has(it.link))];
    }
  }

  // ── 1 sexies. CONSEILS D'ENTRAÎNEMENT : ce que cherche un coureur coaché ────────
  // ⚠️ Rubrique ajoutée le 10/11/2026 (voir `FILTRES.conseils`). Elle passe juste après
  // la une : c'est la plus proche de ce que Pacevo fait pour ses coureurs.
  const iConseils = RUBRIQUES_LETTRE.findIndex((r) => r.cle === "conseils");
  if (iConseils > 0 && conseilsSemaine.length) {
    const conseils = conseilsSemaine
      // Le contexte de course n'est exigé que de la presse générale (Google News) : un flux
      // spécialisé n'écrit que pour des coureurs (« The easy way to find your easy pace »).
      .filter((it) => FILTRES.conseils!.test(it.title) && !PAS_CONSEIL.test(it.title)
        && (!lienGoogleNews(it.link) || COURSE_A_PIED.test(it.title)) && publiable(it) && !dejaALaUne.has(it.link))
      .sort(parInteretFr);
    if (conseils.length) parRubrique[iConseils] = unParMedia(conseils);
  }

  // ── 1 septies. L'ÉDITION DE @GAZETTE, pour les autres rubriques ──────────────
  // Elle ne fait que réordonner des candidats déjà filtrés (voir `ordonnerSelon`).
  RUBRIQUES_LETTRE.forEach((r, n) => {
    if (n > 0) parRubrique[n] = ordonnerSelon(parRubrique[n], edition?.rubriques[r.cle], (it) => it.link);
  });

  // Le texte à résumer pour chaque sujet de la une : ce qu'en titrent les médias (voir
  // `texteDuSujet`). Seulement quand l'article retenu n'apporte pas déjà son texte.
  const texteUne = new Map<string, string>();
  const mediasUne = new Map<string, number>();
  // Les résultats d'Élites couverts par plusieurs médias aussi : sans eux, la rubrique
  // partait en titres seuls (Google News ne donne pas le texte des articles).
  for (const s of [...une, ...sujetsElites]) {
    if (s.medias >= 2) mediasUne.set(s.article.link, s.medias);
    if ((s.article.texte ?? "").trim().length >= 320) continue;
    const t = texteDuSujet(s);
    if (t) texteUne.set(s.article.link, t);
  }

  return { parRubrique, une, candidatsUne, sujetsUne, dejaALaUne, texteUne, mediasUne, recents, echecSemaine };
}
