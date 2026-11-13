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

test("page de course : les règles renvoient trois articles réels, adaptés à l'épreuve", () => {
  const cles = (c: Parameters<typeof articlesPourCourse>[0]) => articlesPourCourse(c).map((x) => x.cle);
  assert.deepEqual(cles({ distanceKm: 80, deniveleM: 4000, type: "trail" }), ["p5", "p8", "p14"], "ultra-trail");
  assert.deepEqual(cles({ distanceKm: 15, deniveleM: 700, type: "trail" }), ["p8", "p14", "p15"], "trail court");
  assert.deepEqual(cles({ distanceKm: 25, deniveleM: 900, type: null }), ["p8", "p14", "p15"], "dénivelé sans type");
  assert.deepEqual(cles({ distanceKm: 42.195, deniveleM: 100, type: "route" }), ["p7", "p10", "p2"], "marathon");
  assert.deepEqual(cles({ distanceKm: 21.1, deniveleM: 50, type: "route" }), ["p3", "p10", "p2"], "semi");
  assert.deepEqual(cles({ distanceKm: 10, deniveleM: 20, type: "route" }), ["p10", "p2", "p17"], "10 km");
  // Donnée absente : le cas général, sans rien supposer de l'épreuve.
  assert.deepEqual(cles({ distanceKm: null, deniveleM: null, type: null }), ["p10", "p2", "p17"], "sans donnée");
  assert.deepEqual(cles({}), ["p10", "p2", "p17"], "objet vide");
  for (const c of [{ distanceKm: 80, type: "trail" }, { distanceKm: 42.2 }, { distanceKm: 21 }, {}]) {
    for (const x of articlesPourCourse(c)) assert.ok(slugsReels.has(x.slug), `${x.slug} n'existe pas`);
  }
});

test("les trois pages appellent bien le module et rendent un lien par article", () => {
  const accueil = code("src/app/page.tsx");
  assert.match(accueil, /derniersArticles\(3\)\.map\(/, "l'accueil n'affiche plus les derniers articles");
  assert.match(accueil, /href=\{a\.href\}/, "l'accueil ne lie plus les articles");
  const article = code("src/app/blog/[slug]/VueArticle.tsx");
  assert.match(article, /articlesVoisins\(a\.slug\)/, "l'article n'appelle plus articlesVoisins");
  assert.match(article, /voisins\.map\(/, "l'article n'affiche plus « À lire aussi »");
  const course = code("src/app/courses/[slug]/page.tsx");
  assert.match(course, /articlesPourCourse\(\{ distanceKm: km, deniveleM: dplus, type: c\.type \}\)/, "la page de course n'appelle plus articlesPourCourse");
  assert.match(course, /aLire\.map\(/, "la page de course n'affiche plus les articles");
});

test("le module de liens ne tire pas le corps des articles dans le bundle de l'accueil", () => {
  const m = code("src/app/blog/maillage.ts");
  assert.ok(!/from\s+["']\.\/articles["']/.test(m), "maillage.ts importe articles.ts : 100 Ko de texte partiraient dans l'accueil");
  assert.ok(!/from\s+["']\.\/articlesI18n["']/.test(m), "maillage.ts importe articlesI18n.ts");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
