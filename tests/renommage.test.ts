/**
 * RENOMMER SA SORTIE — ET CE QU'ON REFUSE D'ÉCRIRE.
 *
 * La montre appelle tout « Rouen Course à pied ». Rendre le nom modifiable est légitime,
 * mais ouvre un champ libre affiché à côté d'une carte. Deux exigences donc : que le
 * renommage SURVIVE (la synchro réécrit `title` toutes les 10 minutes — d'où une colonne
 * à part), et qu'il soit filtré.
 *
 * ⚠️ Défaut trouvé en écrivant ces tests, et qui ne concernait pas cette page :
 * `premierGrosMot` NOMME le mot fautif mais ne rattrape PAS les lettres espacées
 * (« m e r d e »), que seul `contientGrosMot` recolle. Les routes des publications ET
 * des commentaires ne se servaient que de la première. Le contournement le plus évident
 * passait donc en entier, sans que rien ne le signale.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  verifierTitre, verifierDescription, nettoyerTitre, nettoyerDescription, nomAffiche,
  TITRE_MAX, DESCRIPTION_MAX, REPETITIONS_MAX,
} from "../src/lib/activities/renommage";
import { verdictGrossierete, contientGrosMot, premierGrosMot } from "../src/lib/social/moderation";
import { COLONNES_EDITION, COLONNE_INCONNUE } from "../src/lib/activities/colonnes";

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
const motif = (v: ReturnType<typeof verifierTitre>) => (v.ok ? "accepté" : v.motif);

console.log("\nCE QU'ON ACCEPTE — et ce qu'on nettoie sans le dire");

test("un nom normal passe, proprement", () => {
  const v = verifierTitre("  Sortie   longue au bord de Seine  ");
  assert.equal(motif(v), "accepté");
  assert.equal(v.ok && v.valeur, "Sortie longue au bord de Seine", "espaces multiples non normalisés");
});

test("les caractères invisibles sont retirés", () => {
  // Un caractère de contrôle ne se voit pas à la relecture : c'est précisément ce qui
  // sert à masquer du contenu dans un champ modéré.
  assert.equal(nettoyerTitre("Foo\u0007ting du soir"), "Foo ting du soir");
  assert.equal(nettoyerTitre("Footing\ndu soir"), "Footing du soir", "un titre n'a pas de retour à la ligne");
});

test("une description garde ses paragraphes", () => {
  assert.equal(nettoyerDescription("Bien parti.\n\n\n\nFini difficile."), "Bien parti.\n\nFini difficile.");
  assert.equal(nettoyerDescription("  ligne  \r\n  suivante "), "ligne\nsuivante");
});

console.log("\nCE QU'ON REFUSE — et on dit toujours pourquoi");

test("un nom vide n'est pas une faute : c'est le retour au nom d'origine", () => {
  assert.equal(motif(verifierTitre("   ")), "vide");
  assert.equal(motif(verifierTitre(null)), "vide");
});

test("un nom trop long est refusé au caractère près", () => {
  assert.equal(motif(verifierTitre("a".repeat(TITRE_MAX + 1))), "trop_long");
  // ⚠️ « aaaa… » déclencherait d'abord la règle de répétition : on alterne les lettres.
  const juste = "ab".repeat(60).slice(0, TITRE_MAX);
  assert.equal(TITRE_MAX, 80, "TITRE_MAX vaut 80 : décision produit, à changer sciemment");
  assert.equal(motif(verifierTitre(juste)), "accepté");
});

test("un nom sans lettres n'est pas un nom", () => {
  assert.equal(motif(verifierTitre("!!! ### $$$")), "sans_lettre");
  assert.equal(motif(verifierTitre("12 34")), "sans_lettre");
  assert.equal(motif(verifierTitre("5 km")), "accepté", "deux lettres suffisent");
});

test("les liens et adresses sont refusés — c'est de la publicité", () => {
  for (const t of ["Voir https://spam.test", "Ecris-moi a@b.fr", "promo sur monsite.com", "www.truc.io"])
    assert.equal(motif(verifierTitre(t)), "lien", `« ${t} » aurait dû être refusé`);
  assert.equal(motif(verifierDescription("Rendez-vous sur www.spam.ru")), "lien");
});

test("les caractères répétés en rafale sont refusés", () => {
  assert.equal(motif(verifierTitre("Duuuuuuur ce footing")), "repetition");
  assert.equal(motif(verifierTitre("Duur ce footing")), "accepté");
  assert.equal(REPETITIONS_MAX, 4, "seuil de répétition : décision produit");
});

test("une grossièreté est refusée ET nommée", () => {
  const v = verifierTitre("Sortie de merde");
  assert.equal(motif(v), "grossierete");
  assert.equal(!v.ok && v.motif === "grossierete" && v.mot, "merde", "le mot fautif doit être rendu");
});

test("les lettres ESPACÉES ne passent pas la porte", () => {
  // Le contournement le plus évident. `premierGrosMot` seul le laissait passer.
  assert.equal(motif(verifierTitre("sortie m e r d e")), "grossierete");
  assert.equal(motif(verifierDescription("c'etait m.e.r.d.e")), "grossierete", "apostrophe : le contournement passait");
});

test("une description vide EFFACE, elle ne bloque pas", () => {
  const v = verifierDescription("   ");
  assert.equal(v.ok && v.valeur, "");
  assert.equal(motif(verifierDescription("a".repeat(DESCRIPTION_MAX + 1))), "trop_long");
});

console.log("\nLA PORTE DE MODÉRATION — une seule, partout");

test("les lettres isolées sont recollées par SUITES, pas globalement", () => {
  // Défaut mesuré le 06/09/2026 : « m.e.r.d.e » était attrapé, mais « c'etait m.e.r.d.e »
  // ne l'était plus — le « c » de l'apostrophe se collait devant et donnait « cmerde ».
  // Il suffisait donc d'écrire un mot avec une apostrophe avant pour désarmer le filtre.
  assert.equal(contientGrosMot("m.e.r.d.e"), true);
  assert.equal(contientGrosMot("c'etait m.e.r.d.e"), true, "une apostrophe désarmait le filtre");
  assert.equal(contientGrosMot("j ai dit m e r d e hier"), true, "des mots autour ne doivent rien changer");
  // …et le découpage en suites ne doit PAS inventer de mots là où il n'y en a pas.
  for (const t of ["a b c d e f g", "belle sortie a l aube", "Course a pied", "Footing tranquille"])
    assert.equal(contientGrosMot(t), false, `faux positif sur « ${t} »`);
});

test("verdictGrossierete combine bien les deux fonctions", () => {
  // C'est le cœur du défaut : les deux fonctions ne voient PAS la même chose.
  assert.equal(contientGrosMot("sortie m e r d e"), true);
  assert.equal(premierGrosMot("sortie m e r d e"), null, "c'est bien la faiblesse de cette fonction-ci");
  const v = verdictGrossierete("sortie m e r d e");
  assert.equal(v.propre, false, "la porte doit refuser ce que contientGrosMot voit");
  assert.equal(verdictGrossierete("Footing tranquille").propre, true);
  const nomme = verdictGrossierete("sortie de merde");
  assert.equal(nomme.propre === false && nomme.mot, "merde", "quand le mot est nommable, on le nomme");
});

test("publications et commentaires passent par CETTE porte", () => {
  for (const f of ["src/app/api/social/post/route.ts", "src/app/api/social/interact/route.ts"]) {
    const src = codeOf(f);
    assert.match(src, /verdictGrossierete\(/, `${f} ne passe pas par la porte commune`);
    assert.doesNotMatch(src, /premierGrosMot\(/,
      `${f} filtre encore avec premierGrosMot seul : « m e r d e » y passerait`);
  }
});

console.log("\nLE RENOMMAGE DOIT SURVIVRE À LA SYNCHRO");

test("la synchro réécrit `title` — donc on n'y écrit JAMAIS le nom choisi", () => {
  // Sans colonne séparée, le renommage disparaîtrait tout seul en 10 minutes, sans
  // erreur nulle part. C'est LE défaut que cette architecture existe pour éviter.
  assert.match(codeOf("src/lib/intervals/workoutRow.ts"), /\btitle,/,
    "la synchro n'écrit plus le titre : la colonne séparée n'a peut-être plus lieu d'être");
  const route = codeOf("src/app/api/workouts/renommer/route.ts");
  assert.doesNotMatch(route, /patch\["title"\]/,
    "la route écrit dans `title` : la synchro effacera le renommage");
  assert.match(route, /COLONNES_EDITION\.titre/, "la route n'utilise plus la colonne dédiée");
  assert.equal(COLONNES_EDITION.titre, "title_custom");
});

test("le nom choisi l'emporte, sans jamais effacer celui de la montre", () => {
  assert.equal(nomAffiche("Mon 10 km", "Rouen Course à pied", "Sortie"), "Mon 10 km");
  assert.equal(nomAffiche("", "Rouen Course à pied", "Sortie"), "Rouen Course à pied");
  assert.equal(nomAffiche("   ", null, "Sortie"), "Sortie");
  assert.equal(nomAffiche(null, "", "Sortie"), "Sortie");
});

console.log("\nLA ROUTE — propriété, écriture, et colonnes qui peuvent manquer");

test("on n'écrit jamais chez quelqu'un d'autre", () => {
  const src = codeOf("src/app/api/workouts/renommer/route.ts");
  assert.match(src, /seance\.user_id !== user\.id/, "la propriété de la séance n'est plus vérifiée");
  assert.match(src, /\.eq\("id", id\)\.eq\("user_id", user\.id\)/,
    "l'écriture n'est plus bornée à l'utilisateur : la RLS serait le seul rempart");
});

test("une écriture muette est impossible", () => {
  // Supabase RETOURNE son erreur au lieu de la lever : sans lecture, la route
  // répondrait « enregistré » sur une écriture qui n'a rien écrit.
  const src = codeOf("src/app/api/workouts/renommer/route.ts");
  assert.match(src, /const \{ error \} = await sb\.from\("workouts"\)\.update/, "l'erreur d'écriture n'est plus lue");
  assert.match(src, /if \(error\) return NextResponse\.json/, "l'échec d'écriture n'est plus signalé");
});

test("une colonne absente se DIT, elle ne plante pas", () => {
  const src = codeOf("src/lib/activities/colonnes.ts");
  assert.equal(COLONNE_INCONNUE, "42703", "code PostgreSQL « colonne inconnue »");
  assert.match(src, /error\.code === COLONNE_INCONNUE\) return false/, "l'absence de colonne n'est plus détectée");
  assert.match(codeOf("src/app/api/workouts/renommer/route.ts"), /colonnes_absentes/,
    "la route ne distingue plus « pas encore activé » d'une vraie panne");
});

test("le fil annonce le VRAI total, pas la taille de la page", () => {
  // « 15 sorties enregistrées » chez un athlète qui en a 332 : la phrase décrivait la
  // page et laissait croire que la synchro avait perdu des séances.
  const src = codeOf("src/app/dashboard/activites/page.tsx");
  assert.match(src, /count: "exact", head: true/, "le total n'est plus compté");
  assert.match(src, /feed\.subTotal/, "le sous-titre n'affiche plus le total");
  const i18n = readFileSync("src/lib/i18n/translations.ts", "utf8");
  assert.equal(i18n.split('"feed.subTotal"').length - 1, 5, "la clé n'existe pas dans les 5 langues");
  assert.ok(/"feed\.subTotal": "[^"]*\{n\}[^"]*\{t\}/.test(i18n), "le libellé français ne porte pas les deux nombres");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
