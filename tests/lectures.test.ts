/**
 * « TU N'AS RIEN » N'EST PAS « ÇA N'A PAS CHARGÉ ».
 *
 * Les quinze lectures du tableau de bord ne regardaient aucune de leurs erreurs :
 * chacune finissait par `?? []` ou `?? null`. Une lecture en panne produisait donc
 * exactement le même écran qu'un compte vide — zéro kilomètre, zéro séance, aucune VMA
 * — et le bandeau « connecte ta montre » s'affichait à un athlète qui l'a déjà
 * connectée et dont les données sont intactes.
 *
 * Le piège du correctif est le symétrique : `.single()` sur zéro ligne REND une erreur
 * (`PGRST116`, mesuré contre la vraie base le 04/09/2026). La traiter comme une panne
 * aurait collé un avertissement permanent à tout nouvel inscrit — et un avertissement
 * permanent n'avertit plus de rien.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estUnePanne, lecturesEnEchec, AUCUNE_LIGNE } from "../src/lib/dashboard/lectures";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

test("une absence de données n'est PAS une panne", () => {
  assert.equal(estUnePanne({ error: null }), false, "une lecture réussie est vue comme une panne");
  assert.equal(estUnePanne(null), false, "une lecture absente est vue comme une panne");
  // ⚠️ LE CAS QUI COMPTE : `.single()` sur zéro ligne. Un athlète sans plan actif, sans
  // ligue ou sans nuit enregistrée le déclenche à chaque affichage.
  assert.equal(estUnePanne({ error: { code: AUCUNE_LIGNE } }), false,
    "l'absence de ligne (PGRST116) est comptée comme une panne : tout nouvel inscrit verrait l'avertissement");
});

test("une vraie erreur EST une panne", () => {
  assert.equal(estUnePanne({ error: { code: "42501" } }), true, "un refus de droits passe inaperçu");
  assert.equal(estUnePanne({ error: { code: "57014" } }), true, "un délai dépassé passe inaperçu");
  // Une erreur sans code (réseau, client) doit compter : ne rien savoir n'est pas
  // une raison de rassurer.
  assert.equal(estUnePanne({ error: {} }), true, "une erreur sans code est ignorée");
});

test("seules les lectures en panne sont nommées, dans l'ordre", () => {
  const noms = lecturesEnEchec([
    ["profil", { error: null }],
    ["seances", { error: { code: "08006" } }],
    ["charge", { error: { code: AUCUNE_LIGNE } }],
    ["records", { error: { code: "42P01" } }],
  ]);
  assert.deepEqual(noms, ["seances", "records"]);
  assert.deepEqual(lecturesEnEchec([["profil", { error: null }]]), [],
    "une page saine annonce quand même des données incomplètes");
});

test("le tableau de bord ne réimplémente pas la distinction", () => {
  // Une seconde copie du critère finirait par diverger — c'est ce qui a donné trois
  // définitions différentes de « série » ailleurs dans le projet.
  const page = codeNu("src/app/dashboard/page.tsx");
  assert.ok(/lecturesEnEchec\(/.test(page), "la page ne passe plus par le module partagé");
  assert.ok(!/PGRST116/.test(page), "le code d'erreur est recopié dans la page");
  for (const attendu of ["profileRes", "workoutsRes", "chargeRes", "prRes"]) {
    assert.ok(new RegExp(`,\\s*${attendu}\\s*\\]`).test(page),
      `la lecture « ${attendu} » n'est plus surveillée`);
  }
});

test("« aucune donnée » ne s'affiche PAS pendant une panne", () => {
  // ⚠️ LES DEUX MESSAGES SE CONTREDISENT. `noData` se déduit de listes vides — or une
  // panne produit les mêmes listes vides. Sans cette exclusion, l'athlète lisait
  // « connecte ta montre » alors qu'elle l'est déjà.
  const src = codeNu("src/components/dashboard/BentoDashboard.tsx");
  assert.ok(/const\s+enPanne\s*=\s*\(donneesIncompletes\s*\?\?\s*\[\]\)\.length\s*>\s*0/.test(src),
    "le composant ne sait plus qu'une lecture a échoué");
  assert.ok(/const\s+noData\s*=\s*!enPanne\s*&&/.test(src),
    "« aucune donnée » s'affiche de nouveau par-dessus le message de panne");
  assert.ok(/\{enPanne\s*&&\s*\(/.test(src), "le bandeau de panne n'est plus rendu");
});

test("le message existe dans les cinq langues", () => {
  const i18n = readFileSync("src/lib/i18n/translations.ts", "utf8");
  for (const cle of ["dash.incomplet", "dash.inc.profil", "dash.inc.seances", "dash.inc.charge", "dash.inc.records"]) {
    const n = [...i18n.matchAll(new RegExp(`"${cle.replace(/\./g, "\\.")}"\\s*:`, "g"))].length;
    assert.equal(n, 5, `« ${cle} » présente ${n} fois au lieu de 5 : une langue afficherait la clé brute`);
  }
  // Le libellé doit porter le gabarit, sinon on annonce une panne sans dire laquelle.
  const modele = i18n.match(/"dash\.incomplet"\s*:\s*"([^"]+)"/);
  assert.ok(modele && modele[1].includes("{quoi}"), "le message n'indique plus ce qui manque");
});

test("un calendrier vide par accident le DIT", () => {
  // ⚠️ CE MOIS-LÀ EST LE PLAN D'ENTRAÎNEMENT. Sa lecture ramène tout le contenu de
  // l'écran — séances, notes, courses planifiées — et son erreur n'était pas lue : en
  // cas d'échec, `?? []` prenait le relais et l'athlète voyait un mois BLANC. Lui
  // montrer un plan vide revient à lui dire que son plan a disparu.
  const page = codeNu("src/app/dashboard/calendrier/page.tsx");
  assert.ok(/estUnePanne\(seancesRes\)/.test(page),
    "la page du calendrier ne juge plus si la lecture a échoué");
  assert.ok(/enPanne=\{lectureEnPanne\}/.test(page), "l'information n'est plus transmise à l'écran");
  assert.ok(!/PGRST116/.test(page),
    "le code d'erreur est recopié dans la page : il n'existe qu'une définition de « panne »");

  const vue = codeNu("src/components/training/CalendarView.tsx");
  assert.ok(/\{enPanne && \(/.test(vue), "le bandeau de panne du calendrier n'est plus rendu");
  assert.ok(/t\("cal\.enPanne"\)/.test(vue), "le message n'est plus traduit");
  const i18n = readFileSync("src/lib/i18n/translations.ts", "utf8");
  assert.equal([...i18n.matchAll(/"cal\.enPanne"\s*:/g)].length, 5,
    "le message du calendrier manque à une langue");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
