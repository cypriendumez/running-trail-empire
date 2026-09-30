/**
 * RAFRAÎCHISSEMENT HEBDOMADAIRE DES COURSES — sans surveillance (29/09/2026).
 *
 * La remise à niveau du catalogue avait été faite à la main, une nuit. Le workflow
 * `courses-rafraichissement` la refait chaque mardi, seul : ces tests gardent ce qui
 * l'empêche d'abîmer le catalogue (seuils AVANT toute écriture, sauvegarde AVANT
 * l'application) et ce qui l'empêche d'oublier des courses (état d'une semaine à l'autre,
 * fiches à revoir, amorce).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { seuil, depassement } from "../scripts/garde-fous";
import { slugsARelire, slugsDuPlan, AMORCE_VUS } from "../scripts/finishers-slugs";
import { dejaLu, type LigneSite } from "../scripts/resultats-sites";
import { adresseFma, defautFichier, COLONNES, TAILLE_MIN } from "../scripts/datatourisme-telecharger";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/** Le source sans commentaires — sans couper sur `://` (sinon une URL avale la fin de ligne). */
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const yml = readFileSync(".github/workflows/courses-rafraichissement.yml", "utf8")
  .split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

test("un seuil illisible retombe sur sa valeur par défaut", () => {
  const argv = ["node", "x.ts", "--max-retraits", "12", "--vide", "--texte", "abc", "--negatif", "-3"];
  assert.equal(seuil(argv, "--max-retraits", 400), 12);
  assert.equal(seuil(argv, "--absent", 400), 400);
  // « --vide » suivi d'une autre option : Number("--texte") = NaN → défaut, jamais NaN
  // (NaN comparé à n'importe quoi est FAUX : le garde-fou ne se déclencherait jamais).
  assert.equal(seuil(argv, "--vide", 400), 400);
  assert.equal(seuil(argv, "--texte", 400), 400);
  assert.equal(seuil(argv, "--negatif", 400), 400);
});

test("un seuil ATTEINT laisse écrire, un seuil DÉPASSÉ arrête tout", () => {
  assert.equal(depassement([{ quoi: "retraits", n: 400, max: 400 }]), null);
  const m = depassement([{ quoi: "retraits", n: 401, max: 400 }, { quoi: "dates", n: 3, max: 400 }]);
  assert.ok(m && m.startsWith("ARRÊT"), "le message ne commence pas par ARRÊT");
  assert.ok(m!.includes("401 retraits (seuil 400)"));
  assert.ok(!m!.includes("dates"), "un compte sous son seuil est cité comme dépassé");
});

test("on relit les connues, les nouvelles et les fiches à revoir — une fois chacune", () => {
  const plan = ["a", "b", "c", "neuve", "revoir"];
  const vus = new Set(["a", "b", "c", "revoir", "partie"]);
  const liste = slugsARelire(plan, ["b", "a"], vus, ["revoir", "partie", "a"]);
  assert.deepEqual(liste, ["b", "a", "neuve", "revoir"]);
  // « partie » est à revoir mais a quitté le plan du site : la page n'existe plus.
  assert.ok(!liste.includes("partie"));
  // Aucune nouveauté, rien à revoir : seules les connues.
  assert.deepEqual(slugsARelire(["a"], ["a"], new Set(["a"])), ["a"]);
});

test("le plan du site se lit en clair comme compressé, sans les autres adresses", () => {
  const xml = `<urlset><url><loc>https://www.finishers.com/course/marathon-de-paris</loc></url>
    <url><loc>https://www.finishers.com/course/trail-x</loc></url>
    <url><loc>https://www.finishers.com/course/trail-x</loc></url>
    <url><loc>https://www.finishers.com/blog/article</loc></url>
    <url><loc>https://www.finishers.com/course/avec-filtre?page=2</loc></url></urlset>`;
  assert.deepEqual(slugsDuPlan(Buffer.from(xml)), ["marathon-de-paris", "trail-x"]);
  assert.deepEqual(slugsDuPlan(gzipSync(Buffer.from(xml))), ["marathon-de-paris", "trail-x"]);
});

test("l'amorce des déjà-vus existe et couvre le plan lu en entier le 28/09/2026", () => {
  // Sans elle, le premier passage relirait ~7 000 fiches étrangères ou hors course à pied.
  assert.ok(existsSync(AMORCE_VUS), `${AMORCE_VUS} manque`);
  const n = gunzipSync(readFileSync(AMORCE_VUS)).toString("utf8").split("\n").filter(Boolean).length;
  assert.ok(n >= 12_000, `amorce de ${n} slugs seulement`);
  const src = code("scripts/finishers-slugs.ts");
  assert.ok(/amorce \? gunzipSync\(readFileSync\(AMORCE_VUS\)\)/.test(src), "l'amorce n'est plus lue quand l'état manque");
});

test("un site relu : le passager se retente, le durable attend, le vieux se relit", () => {
  const maintenant = Date.parse("2026-10-06T00:00:00Z");
  const il_y_a = (j: number) => new Date(maintenant - j * 864e5).toISOString();
  const l = (x: Partial<LigneSite>): LigneSite => ({ site: "https://x.fr", ok: false, lueLe: il_y_a(3), ...x });
  assert.equal(dejaLu(l({ ok: true }), maintenant, 56), true);
  assert.equal(dejaLu(l({ ok: true, lueLe: il_y_a(60) }), maintenant, 56), false, "un lien de résultats vieux de deux mois n'est jamais relu");
  assert.equal(dejaLu(l({ ok: true, lueLe: il_y_a(60) }), maintenant), true, "sans --relire-apres, une lecture reste valable");
  for (const http of [0, 403, 429, 503]) assert.equal(dejaLu(l({ http }), maintenant, 56), false, `un échec ${http} n'est jamais retenté`);
  assert.equal(dejaLu(l({ motif: "robots-illisible" }), maintenant, 56), false);
  for (const motif of ["robots-interdit", "pas-html", "adresse"]) assert.equal(dejaLu(l({ motif }), maintenant, 56), true, `« ${motif} » relu chaque semaine`);
  assert.equal(dejaLu(l({ http: 404 }), maintenant, 56), true);
  assert.equal(dejaLu(l({ ok: true, lueLe: "pas une date" }), maintenant, 56), false, "une date illisible dispense de relire");
});

test("DATAtourisme : l'adresse du jour par le titre, et un fichier vérifié avant usage", () => {
  const jeu = { resources: [
    { title: "datatourisme-tour.csv", url: "https://static.data.gouv.fr/a/datatourisme-tour.csv" },
    { title: "datatourisme-fma.csv", url: "https://static.data.gouv.fr/b/20260929/datatourisme-fma.csv" },
  ] };
  assert.equal(adresseFma(jeu), "https://static.data.gouv.fr/b/20260929/datatourisme-fma.csv");
  assert.equal(adresseFma({ resources: [{ title: "datatourisme-fma.csv", url: "ftp://x" }] }), null);
  assert.equal(adresseFma({}), null);
  assert.equal(adresseFma(null), null);
  const tete = "\uFEFF" + COLONNES.join(",") + ",Autre";
  assert.equal(defautFichier(TAILLE_MIN + 1, tete), null);
  assert.match(String(defautFichier(2_000, tete)), /trop petit/);
  assert.match(String(defautFichier(TAILLE_MIN + 1, tete.replace("Periodes_regroupees", "Periodes"))), /Periodes_regroupees/);
});

test("chaque script d'écriture vérifie ses seuils AVANT d'écrire", () => {
  // ⚠️ VISER L'APPEL, PAS L'IMPORT : `arreterSiDepasse` figure aussi dans la ligne
  // d'import, placée tout en haut — elle précéderait toujours l'écriture.
  const cas: [string, RegExp][] = [
    ["scripts/finishers-appliquer.ts", /\.from\("races"\)\.(update|insert|delete)\(/],
    ["scripts/datatourisme-importer.ts", /\.from\("races"\)\.insert\(/],
    ["scripts/datatourisme-dates.ts", /\.from\("races"\)\.update\(/],
    ["scripts/retirer-non-course.ts", /\.from\("races"\)\.delete\(/],
    ["scripts/verifier-liens-courses.ts", /\.from\("races"\)\.update\(/],
    ["scripts/dedoublonner-courses.ts", /\.from\("races"\)\.delete\(/],
  ];
  for (const [f, ecriture] of cas) {
    const src = code(f);
    const iGarde = src.search(/\n\s*arreterSiDepasse\(/);
    const iEcriture = src.search(ecriture);
    assert.ok(iGarde > 0, `${f} n'appelle plus arreterSiDepasse`);
    assert.ok(iEcriture > 0, `${f} : écriture introuvable (motif à revoir)`);
    assert.ok(iGarde < iEcriture, `${f} écrit AVANT de vérifier ses seuils`);
  }
});

test("finishers-appliquer : garde-fous de forme, fiches à revoir, échec visible", () => {
  const src = code("scripts/finishers-appliquer.ts");
  for (const q of ["retraits", "dates futures", "fiches illisibles", "sans aucun format"]) {
    assert.ok(new RegExp(`quoi: "[^"]*${q}`).test(src), `seuil « ${q} » disparu`);
  }
  // Le compte de dates PERDUES : une vraie date future remplacée par 2099.
  assert.ok(/String\(avant\.date\) >= aujourdhui && String\(m\.patch\.date\)\.startsWith\("2099"\)\) \{\s*datesPerdues\+\+/.test(src),
    "les dates futures renvoyées en « Date à venir » ne sont plus comptées");
  // Les fiches à revoir s'écrivent en lecture à blanc AUSSI (avant le retour anticipé).
  const iRevoir = src.indexOf('"a-revoir.txt"'), iBlanc = src.indexOf("if (!ECRIRE)");
  assert.ok(iRevoir > 0 && iRevoir < iBlanc, "a-revoir.txt n'est plus écrit avant le retour « à blanc »");
  // Illisible (réseau, 403, 5xx) : à revoir ; ABSENTE (404/410) : la page n'existe plus.
  assert.ok(/if \(!f\.ok\) \{\s*st\.erreurs\+\+;\s*if \(f\.http !== 404 && f\.http !== 410\) \{ aRevoir\.push\(f\.slug\); continue; \}/.test(src),
    "les fiches illisibles ne sont plus mises à revoir");
  assert.ok(/else \{ st\.sansFormat\+\+; aRevoir\.push\(f\.slug\); \}/.test(src), "les fiches françaises sans format ne sont plus mises à revoir");
  // Une requête sans délai a figé l'écriture le 29/09 (1 016 màj sur 11 589, puis plus rien).
  assert.ok(/global: \{ fetch: [^}]*AbortSignal\.timeout\(/.test(src), "les requêtes Supabase n'ont plus de délai maximal : une coupure fige le script");
  // Supabase REND ses erreurs : sans code de sortie, un run qui n'a rien écrit passe au vert.
  assert.ok(/if \(refus > 0 \|\| ko > [^)]*\)\) \{[\s\S]{0,200}?process\.exit\(1\)/.test(src), "un lot refusé ne fait plus rougir l'exécution");
});

test("le contrôle des liens ne publie pas de « mortes » au-delà de son seuil", () => {
  // `finishers-appliquer` ne réécrit jamais une adresse déclarée morte dans un rapport :
  // un rapport emballé effacerait la semaine suivante ce que le seuil a protégé.
  const src = code("scripts/verifier-liens-courses.ts");
  assert.ok(/mortes: trop \? \[\] : liste/.test(src), "le rapport garde les mortes quand le seuil est dépassé");
  assert.ok(src.search(/\n\s*arreterSiDepasse\(/) < src.indexOf("if (!ECRIRE)"), "le seuil n'est vérifié qu'en écriture");
});

test("la collecte s'arrête proprement : durée maximale et source qui refuse", () => {
  const src = code("scripts/finishers-collecte.ts");
  assert.ok(/if \(Date\.now\(\) - debut > dureeMaxMs\)/.test(src), "plus de durée maximale : l'exécuteur serait tué à 6 h");
  assert.ok(/if \(\+\+echecsDeSuite >= abandonApres\)[\s\S]{0,200}process\.exit\(3\)/.test(src), "plus d'abandon quand la source refuse");
  // Une fiche lue, ou une page absente, remet le compteur à zéro.
  assert.equal((src.match(/echecsDeSuite = 0; break/g) ?? []).length, 2, "le compteur d'échecs de suite n'est plus remis à zéro");
});

test("le workflow sauvegarde AVANT d'appliquer, garde son état, respecte le plafond de 6 h", () => {
  const i = (motif: string) => yml.indexOf(motif);
  assert.ok(i("scripts/sauvegarder-courses.ts") > 0 && i("scripts/sauvegarder-courses.ts") < i("scripts/finishers-appliquer.ts"),
    "la table n'est plus sauvegardée avant l'application");
  assert.ok(i("courses-avant-rafraichissement") < i("scripts/finishers-appliquer.ts"), "la sauvegarde n'est publiée qu'après l'écriture");
  assert.ok(/finishers-appliquer\.ts "\$ETAT\/fiches-semaine\.jsonl" --ecrire/.test(yml));
  // L'état : un artefact de 90 jours, jamais `actions/cache` (effacé après 7 jours sans usage).
  assert.ok(!/actions\/cache@/.test(yml), "l'état repose sur actions/cache, qui l'efface au rythme même du workflow");
  assert.ok(/artifacts\?name=etat-courses/.test(yml), "l'état de la semaine précédente n'est plus repris");
  assert.ok(/name: etat-courses[\s\S]*?retention-days: 90/.test(yml));
  for (const f of ["slugs-vus.txt", "a-revoir.txt", "resultats-sites.jsonl", "liens-controle-*.json"]) {
    assert.ok(yml.includes(`.cache-courses/${f}`), `${f} ne voyage plus d'une semaine à l'autre`);
  }
  // Dossiers à point initial : ignorés par upload-artifact sans cette ligne (vécu le 03/09).
  assert.equal((yml.match(/include-hidden-files: true/g) ?? []).length, 2);
  const minutes = Number(yml.match(/timeout-minutes:\s*(\d+)/)?.[1]);
  const collecte = Number(yml.match(/--duree-max (\d+)/)?.[1]);
  assert.ok(minutes > 0 && minutes < 360, "délai absent ou au-delà du plafond GitHub (360 min)");
  assert.ok(collecte > 0 && collecte + 90 <= minutes, "la collecte ne laisse plus le temps aux étapes suivantes");
  assert.ok(/shell: bash/.test(yml), "sans « shell: bash », pipefail n'est pas garanti");
  assert.ok(i("scripts/dedoublonner-courses.ts --ecrire") > i("scripts/finishers-appliquer.ts"), "les doublons parfaits ne sont plus retirés chaque semaine");
  assert.ok(readFileSync(".gitignore", "utf8").includes("/.cache-courses/"), "l'état local n'est pas ignoré par git");
});

console.log(`\n${passed} test(s) du rafraîchissement hebdomadaire passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
