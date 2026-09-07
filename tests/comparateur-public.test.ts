/**
 * LE COMPARATEUR ÉTAIT INVISIBLE DEPUIS UN MOTEUR DE RECHERCHE.
 *
 * 309 modèles aux caractéristiques relevées et sourcées, aucun appel au modèle, aucun
 * coût marginal — et tout cela derrière la connexion. Les fiches répondent pourtant à ce
 * que des gens tapent chaque jour («&nbsp;drop de la Clifton 10&nbsp;», «&nbsp;poids de
 * la Speedcross&nbsp;»), et les 10 539 fiches de courses, elles, sont publiques et
 * indexées depuis le 3 septembre.
 *
 * ⚠️ CE QUE CES TESTS PROTÈGENT :
 * 1. La page publique ne touche JAMAIS au compte. Elle est servie à n'importe qui : une
 *    seule lecture de session y ferait fuiter des données personnelles.
 * 2. Une cote absente s'écrit «&nbsp;non communiqué&nbsp;», jamais une valeur inventée.
 *    C'est la règle qui a fait geler l'ancienne boutique et ses 1 167 prix fabriqués, et
 *    elle vaut DOUBLE sur une page publique où le lecteur n'a pas de compte pour nous
 *    corriger.
 * 3. La porte se déplace, elle ne disparaît pas : le verdict personnel reste derrière le
 *    compte.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { CATALOGUE, parSlug } from "../src/lib/shop/catalogue";
import { caracteristiques, connues, nomComplet, titrePage, descriptionPage, voisins } from "../src/lib/shop/publique";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}
const FICHE = "src/app/chaussures/[slug]/page.tsx";
const INDEX = "src/app/chaussures/page.tsx";

console.log("\nLES PAGES EXISTENT ET SONT PUBLIQUES");

test("les deux routes sont sur le disque", () => {
  assert.ok(existsSync(INDEX), "l'index du comparateur a disparu");
  assert.ok(existsSync(FICHE), "la fiche d'un modèle a disparu");
});

test("aucune page publique ne lit le compte de qui que ce soit", () => {
  // ⚠️ LE RISQUE PROPRE À CETTE FONCTIONNALITÉ. Ces pages sont servies à des visiteurs
  // sans compte. Lire une session ici, c'est mélanger le public et le privé sur la seule
  // surface où personne n'est authentifié.
  for (const p of [INDEX, FICHE]) {
    const src = codeOf(p);
    assert.ok(!/@\/lib\/supabase\/(server|admin)/.test(src), `${p} atteint la base : une page publique n'a rien à y faire`);
    assert.ok(!/auth\.getUser|createClient|createAdminClient/.test(src), `${p} lit une session`);
    assert.ok(!/user_id|workouts|profiles/.test(src), `${p} nomme une table personnelle`);
  }
});

test("la porte se déplace, elle ne disparaît pas", () => {
  // La page dit ce que pèse la chaussure ; elle ne dit pas si elle convient à CE coureur.
  for (const p of [INDEX, FICHE]) {
    const src = readFileSync(p, "utf8");
    assert.match(src, /href="\/signup"/, `${p} n'invite plus à créer un compte : la page ne mène à rien`);
    assert.match(src, /porte\.bouton/, `${p} ne dit plus ce que le compte apporte en plus`);
  }
});

console.log("\nAUCUNE VALEUR INVENTÉE");

test("une cote absente est ÉCRITE absente, pas retirée", () => {
  // Retirer la ligne laisserait croire que la fiche est complète.
  const nu = { slug: "x", marque: "M", nom: "N", terrain: "route" } as never;
  const c = caracteristiques(nu);
  assert.ok(c.length >= 8, `${c.length} lignes : la grille s'est vidée au lieu d'avouer`);
  assert.equal(c.filter((x) => x.valeur != null).length, 1, "seul le terrain est connu ici");
  assert.equal(connues(nu), 1);
  // ⚠️ L'AVEU EST TRADUIT : le chercher en français dans la page raterait le jour où
  // quelqu'un le supprime de la table. On vise donc l'usage ET la traduction.
  assert.match(readFileSync(FICHE, "utf8"), /t\("fiche\.inconnu"\)/, "l'aveu d'absence a disparu de la fiche");
  assert.match(readFileSync("src/app/chaussures/gearI18n.ts", "utf8"), /"fiche\.inconnu": "non communiqué"/,
    "la traduction de l'aveu d'absence a disparu");
});

test("les valeurs connues sortent avec leur unité et leur date de relevé", () => {
  const m = CATALOGUE.find((x) => x.poidsG?.valeur && x.dropMm?.valeur)!;
  const c = caracteristiques(m);
  const poids = c.find((x) => x.cle === "poidsG")!;
  assert.match(poids.valeur!, /^\d+ g$/, `« ${poids.valeur} » : un coureur lit des grammes`);
  assert.ok(poids.vu, "la date de relevé a disparu : la source n'est plus datable");
  const drop = c.find((x) => x.cle === "dropMm")!;
  assert.match(drop.valeur!, /^\d+ mm$/);
});

test("un booléen se lit Oui / Non, jamais true / false — et dans les 5 langues", () => {
  // ⚠️ LE MODULE REND UNE CLÉ, PAS UN MOT. Écrire « Oui » dans `publique.ts` le ferait
  // ressortir en français sur la page allemande — le module est partagé, la page ne l'est
  // pas. C'est la page qui traduit.
  const avec = CATALOGUE.find((x) => x.plaqueCarbone?.valeur === true);
  const sans = CATALOGUE.find((x) => x.plaqueCarbone?.valeur === false);
  assert.ok(avec || sans, "aucun modèle ne renseigne la plaque : le test ne prouve rien");
  for (const [m, attendu] of [[avec, "oui"], [sans, "non"]] as const) {
    if (!m) continue;
    const c = caracteristiques(m).find((x) => x.cle === "plaqueCarbone")!;
    assert.equal(c.valeur, attendu, "un booléen brut a été servi au lieu d'une clé");
    assert.equal(c.booleen, true, "la page ne saura pas qu'il faut traduire cette valeur");
  }
  const src = readFileSync(FICHE, "utf8");
  assert.match(src, /c\.booleen \? t\(c\.valeur\)/, "la page ne traduit plus les booléens : « oui » s'afficherait tel quel");
  const tr = readFileSync("src/app/chaussures/gearI18n.ts", "utf8");
  for (const lg of ["fr", "en", "de", "es", "pt"]) {
    assert.ok(new RegExp(`\\n  ${lg}: \\{`).test(tr), `langue « ${lg} » absente de la table du comparateur`);
  }
  for (const cle of ['"oui":', '"non":', '"fiche.inconnu":', '"porte.bouton":']) {
    const n = (tr.match(new RegExp(cle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    assert.equal(n, 5, `${cle} présent ${n} fois au lieu de 5 : une langue manque`);
  }
});

console.log("\nCE QUI PART DANS LES MOTEURS DE RECHERCHE");

test("aucun titre ni description ne contient « undefined »", () => {
  // Une page indexée garde son titre des années. Un millésime absent ne doit jamais
  // produire « Clifton 10 undefined ».
  for (const m of CATALOGUE) {
    const t = titrePage(m), d = descriptionPage(m);
    assert.ok(!/undefined|null|NaN/.test(t), `titre corrompu : ${t}`);
    assert.ok(!/undefined|null|NaN/.test(d), `description corrompue : ${d}`);
    assert.ok(t.length > 10 && t.length < 120, `titre de ${t.length} caractères : ${t}`);
  }
});

test("la description ne cite que des chiffres que le modèle possède", () => {
  const nu = { slug: "x", marque: "Marque", nom: "Modèle", terrain: "route" } as never;
  const d = descriptionPage(nu);
  assert.ok(!/\d+ g|drop \d+/.test(d), `des cotes citées sur un modèle qui n'en a aucune : ${d}`);
  const m = CATALOGUE.find((x) => x.poidsG?.valeur)!;
  assert.match(descriptionPage(m), new RegExp(`${m.poidsG!.valeur} g`));
});

test("chaque modèle du catalogue a bien une page", () => {
  assert.ok(CATALOGUE.length >= 300, `${CATALOGUE.length} modèles : le catalogue a fondu`);
  const src = codeOf(FICHE);
  assert.match(src, /export function generateStaticParams/, "les pages ne sont plus énumérées : rien à indexer");
  assert.match(src, /CATALOGUE\.map\(\(m\) => \(\{ slug: m\.slug \}\)\)/, "l'énumération ne suit plus le catalogue");
  for (const m of CATALOGUE.slice(0, 5)) assert.ok(parSlug(m.slug), `${m.slug} introuvable par son slug`);
});

test("le sitemap déclare l'index ET les fiches", () => {
  // Sans cela, elles restent invisibles : un sitemap est le seul endroit où un moteur
  // apprend l'existence de 309 pages qui ne sont liées nulle part ailleurs.
  const src = codeOf("src/app/sitemap.ts");
  assert.match(src, /CATALOGUE\.map\(\(m\) => \(\{\s*url: `\$\{BASE\}\/chaussures\/\$\{m\.slug\}`/,
    "les fiches ne sont plus dans le sitemap");
  assert.match(src, /\$\{BASE\}\/chaussures`/, "l'index n'est plus dans le sitemap");
  assert.match(src, /\.\.\.chaussures,/, "la liste est construite mais jamais servie");
});

test("robots.txt n'interdit pas ces pages", () => {
  const src = codeOf("src/app/robots.ts");
  const m = src.match(/disallow: \[([^\]]*)\]/);
  assert.ok(m, "la liste des interdictions a disparu");
  assert.ok(!/chaussures/.test(m[1]), "le comparateur public est interdit aux moteurs");
});

console.log("\nLES MODÈLES PROCHES");

test("un modèle n'est jamais son propre voisin, et reste sur son terrain", () => {
  const m = CATALOGUE.find((x) => x.terrain === "trail")!;
  const v = voisins(m);
  assert.ok(v.length > 0, "aucun voisin : la fiche devient une impasse");
  assert.ok(!v.some((x) => x.slug === m.slug), "le modèle se propose lui-même");
  assert.ok(v.every((x) => x.terrain === m.terrain), "une chaussure de route proposée à côté d'une trail");
});

test("le nom affiché ne double pas la marque", () => {
  const m = CATALOGUE[0];
  assert.equal(nomComplet(m), `${m.marque} ${m.nom}`);
  assert.ok(!/  /.test(nomComplet(m)), "double espace dans le nom");
});

console.log(`\n${passed} test(s) du comparateur public passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
