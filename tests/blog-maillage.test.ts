/**
 * LES LIENS INTERNES VERS LES ARTICLES DU BLOG.
 *
 * Défaut réel (Search Console, 13/11/2026) : sur 17 articles, Google n'en avait indexé que
 * 4 et 11 lui étaient inconnus. Aucun blocage technique ; simplement, un article n'était
 * lié que depuis /blog. `src/app/blog/maillage.ts` pose des liens depuis l'accueil, chaque
 * article et chaque page de course. Ce test garde ces liens : un article ajouté sans
 * adresse dans la table légère, une page qui cesse d'appeler le module, ou une règle qui
 * renvoie vers un article inexistant doivent rougir.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SLUG_PAR_CLE, ARTICLES } from "../src/app/blog/articles";
import { SLUGS_BLOG } from "../src/app/blog/slugs";
import { POSTS } from "../src/app/blog/posts";
import { BLOG } from "../src/app/blog/blogI18n";
import { derniersArticles, articlesVoisins, articlesPourCourse } from "../src/app/blog/maillage";
import type { RaceType } from "../src/types";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/** Le code d'un fichier, commentaires retirés sans couper les « :// » des adresses. */
const code = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

const slugsReels = new Set(ARTICLES.map((a) => a.slug));
const cat = (cle: string) => POSTS.find((p) => p.key === cle)?.cat;

console.log("\n— Liens internes du blog");

test("la table légère des adresses est strictement égale à celle des articles", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(SLUGS_BLOG).sort()),
    Object.fromEntries(Object.entries(SLUG_PAR_CLE).sort()),
    "slugs.ts et articles.ts ne listent pas les mêmes articles : un article resterait sans lien entrant",
  );
  assert.ok(Object.keys(SLUGS_BLOG).length >= 17, "moins de 17 articles : la source ne se lit plus");
});

test("chaque article lié a une carte et un titre dans les cinq langues", () => {
  for (const cle of Object.keys(SLUGS_BLOG)) {
    assert.ok(cat(cle), `${cle} n'a pas de carte dans posts.ts`);
    for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
      assert.ok(BLOG[lg].posts[cle]?.title, `${cle} n'a pas de titre en ${lg} : le lien s'afficherait vide`);
    }
  }
});

test("l'accueil lie les trois articles les plus récents, tous réels", () => {
  const d = derniersArticles(3);
  assert.equal(d.length, 3);
  const plusRecents = POSTS.filter((p) => SLUGS_BLOG[p.key]).sort((a, b) => b.id - a.id).slice(0, 3).map((p) => p.key);
  assert.deepEqual(d.map((x) => x.cle), plusRecents);
  for (const x of d) {
    assert.ok(slugsReels.has(x.slug), `${x.slug} n'est pas un article`);
    assert.equal(x.href, `/blog/${x.slug}`);
  }
});

test("« À lire aussi » : trois articles, jamais l'article lui-même, la même rubrique d'abord", () => {
  for (const a of ARTICLES) {
    const v = articlesVoisins(a.slug);
    assert.equal(v.length, 3, `${a.slug} : ${v.length} voisin(s)`);
    assert.ok(!v.some((x) => x.slug === a.slug), `${a.slug} se lie à lui-même`);
    assert.equal(new Set(v.map((x) => x.slug)).size, 3, `${a.slug} : doublon`);
    for (const x of v) assert.ok(slugsReels.has(x.slug), `${a.slug} → ${x.slug} n'existe pas`);
    // Tant qu'il reste des articles de la même rubrique, ils passent devant les autres.
    const memeRubrique = ARTICLES.filter((b) => b.slug !== a.slug && cat(b.cle) === cat(a.cle)).length;
    const attendus = Math.min(3, memeRubrique);
    assert.equal(v.slice(0, attendus).filter((x) => cat(x.cle) === cat(a.cle)).length, attendus,
      `${a.slug} : la même rubrique ne passe pas devant`);
  }
});

test("chaque article reçoit au moins un lien depuis un autre article", () => {
  const recus = new Map<string, number>();
  for (const a of ARTICLES) for (const v of articlesVoisins(a.slug)) recus.set(v.slug, (recus.get(v.slug) ?? 0) + 1);
  // Seuls les liens ENTRE ARTICLES comptent ici : ceux de l'accueil et des pages de
  // course s'y ajoutent, mais ne doivent pas masquer un article qu'aucun autre ne cite.
  const orphelins = ARTICLES.filter((a) => !recus.get(a.slug)).map((a) => a.slug);
  assert.deepEqual(orphelins, [], `article(s) qu'aucun autre article ne lie : ${orphelins.join(", ")}`);
});

/** Les NEUF valeurs réelles de `races.type` : le test balaie l'énumération, pas des types inventés. */
const TYPES: RaceType[] = ["road_5k", "road_10k", "semi", "marathon", "trail_s", "trail_m", "trail_l", "trail_xl", "ultra"];
const cles = (c: Parameters<typeof articlesPourCourse>[0]) => articlesPourCourse(c).map((x) => x.cle);
const ULTRA = ["p5", "p8", "p14"], TRAIL = ["p8", "p14", "p15"], MARATHON = ["p7", "p10", "p2"], SEMI = ["p3", "p10", "p2"], GENERAL = ["p10", "p2", "p17"];

test("page de course : chaque type réel de course reçoit trois articles réels", () => {
  // Défaut relevé par @Maestro le 13/11/2026 : la règle cherchait « trail » dans le type, donc
  // `ultra` tombait dans le cas général ; le test employait « trail » et « route », deux
  // valeurs qui n'existent pas en base, et ne voyait rien.
  const sansDistance: Record<RaceType, string[]> = {
    road_5k: GENERAL, road_10k: GENERAL, semi: SEMI, marathon: MARATHON,
    trail_s: TRAIL, trail_m: TRAIL, trail_l: ULTRA, trail_xl: ULTRA, ultra: ULTRA,
  };
  for (const type of TYPES) {
    assert.deepEqual(cles({ type }), sansDistance[type], `type ${type}, sans distance ni dénivelé`);
    for (const km of [null, 5, 10, 21.1, 42.195, 60, 160]) {
      const l = articlesPourCourse({ type, distanceKm: km, deniveleM: null });
      assert.equal(l.length, 3, `type ${type}, ${km} km : ${l.length} lien(s)`);
      for (const x of l) assert.ok(slugsReels.has(x.slug), `type ${type}, ${km} km → ${x.slug} n'existe pas`);
    }
  }
});

test("page de course : un ultra sans dénivelé renseigné reçoit bien l'article sur le premier ultra", () => {
  assert.deepEqual(cles({ distanceKm: 160, deniveleM: null, type: "ultra" }), ULTRA);
  assert.deepEqual(cles({ distanceKm: 100, deniveleM: 0, type: "ultra" }), ULTRA);
  assert.deepEqual(cles({ distanceKm: 85, deniveleM: null, type: "trail_xl" }), ULTRA);
  assert.deepEqual(cles({ distanceKm: 55, deniveleM: null, type: "trail_l" }), ULTRA);
});

test("page de course : la distance et le nom corrigent le type, comme dans le catalogue", () => {
  // « L'Ardéchoise · 51 km » étiquetée ultra : c'est un trail long, il garde l'article ultra.
  assert.deepEqual(cles({ distanceKm: 51, type: "ultra" }), ULTRA);
  // Un « ultra » de 15 km est un trail court.
  assert.deepEqual(cles({ distanceKm: 15, type: "ultra" }), TRAIL);
  assert.deepEqual(cles({ distanceKm: 15, deniveleM: 700, type: "trail_s" }), TRAIL);
  assert.deepEqual(cles({ distanceKm: 45, type: "trail_m" }), ULTRA, "trail de 42 km et plus");
  assert.deepEqual(cles({ distanceKm: 35, type: "trail_m" }), TRAIL);
  // Typée route mais nommée « Trail … » par l'organisateur : c'est un trail.
  assert.deepEqual(cles({ distanceKm: 15, deniveleM: 500, type: "road_10k", nom: "Trail des 7 Monts" }), TRAIL);
  // Le trail URBAIN reste une course sur route.
  assert.deepEqual(cles({ distanceKm: 10, type: "road_10k", nom: "Trail urbain de Lyon" }), GENERAL);
  // Une course sur route vallonnée n'est PAS un trail : le type réel prime sur le dénivelé.
  assert.deepEqual(cles({ distanceKm: 42.195, deniveleM: 800, type: "marathon" }), MARATHON);
});

test("page de course : semi et marathon ne valent que si la distance le confirme", () => {
  assert.deepEqual(cles({ distanceKm: 42.195, deniveleM: 100, type: "marathon" }), MARATHON);
  assert.deepEqual(cles({ distanceKm: 21.1, deniveleM: 50, type: "semi" }), SEMI);
  assert.deepEqual(cles({ distanceKm: 10, deniveleM: 20, type: "road_10k" }), GENERAL);
  // En base, `semi` va de 16 à 30 km et `marathon` commence à 30 km.
  assert.deepEqual(cles({ distanceKm: 27, type: "semi" }), GENERAL, "27 km typé semi");
  assert.deepEqual(cles({ distanceKm: 33, type: "marathon" }), GENERAL, "33 km typé marathon");
});

test("page de course : type absent ou inconnu, on ne suppose rien", () => {
  assert.deepEqual(cles({ distanceKm: null, deniveleM: null, type: null }), GENERAL, "sans donnée");
  assert.deepEqual(cles({}), GENERAL, "objet vide");
  assert.deepEqual(cles({ distanceKm: 10, type: "route" }), GENERAL, "type inconnu");
  // Sans type, le dénivelé (500 m et plus) puis la distance tranchent.
  assert.deepEqual(cles({ distanceKm: 25, deniveleM: 900, type: null }), TRAIL);
  assert.deepEqual(cles({ distanceKm: 80, deniveleM: 4000 }), ULTRA);
  assert.deepEqual(cles({ distanceKm: 42.195 }), MARATHON);
  assert.deepEqual(cles({ distanceKm: 21.1 }), SEMI);
});

test("les trois pages appellent bien le module et rendent un lien par article", () => {
  const accueil = code("src/app/page.tsx");
  assert.match(accueil, /derniersArticles\(3\)\.map\(/, "l'accueil n'affiche plus les derniers articles");
  assert.match(accueil, /href=\{a\.href\}/, "l'accueil ne lie plus les articles");
  const article = code("src/app/blog/[slug]/VueArticle.tsx");
  assert.match(article, /articlesVoisins\(a\.slug\)/, "l'article n'appelle plus articlesVoisins");
  assert.match(article, /voisins\.map\(/, "l'article n'affiche plus « À lire aussi »");
  const course = code("src/app/courses/[slug]/page.tsx");
  assert.match(course, /articlesPourCourse\(\{ distanceKm: km, deniveleM: dplus, type: c\.type, nom: c\.name \}\)/, "la page de course n'appelle plus articlesPourCourse avec le type et le nom");
  assert.match(course, /aLire\.map\(/, "la page de course n'affiche plus les articles");
});

test("le module de liens ne tire pas le corps des articles dans le bundle de l'accueil", () => {
  const m = code("src/app/blog/maillage.ts");
  assert.ok(!/from\s+["']\.\/articles["']/.test(m), "maillage.ts importe articles.ts : 100 Ko de texte partiraient dans l'accueil");
  assert.ok(!/from\s+["']\.\/articlesI18n["']/.test(m), "maillage.ts importe articlesI18n.ts");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
