/**
 * LES FICHES DE PRÉVENTION SIGNÉES PAR UN KINÉSITHÉRAPEUTE (10/11/2026).
 *
 * Le Kiné IA est retiré (dispositif médical, conditions de Gemini). Cyprien : « ça peut pas
 * proposer des idées d'exercices ? ». Réponse retenue : des fiches GÉNÉRALES, identiques pour
 * tous, signées par un masseur-kinésithérapeute, proposées selon la RÉGION signalée — plus
 * l'annuaire officiel de l'Ordre. Ce test fige les trois garde-fous :
 *  1. aucune fiche n'apparaît sans signature complète (nom, RPPS à 11 chiffres, date) ;
 *  2. le dépôt (public) ne contient aucune fiche non signée ;
 *  3. aucune IA n'écrit ni ne choisit le texte.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHES, fichesPour, ficheSignee, regionDe, ANNUAIRE_KINE, type Fiche } from "../src/lib/health/fichesKine";

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

const CONTENU = { titre: "Prévenir la périostite", resume: "Résumé.", sections: [{ titre: "Charge", points: ["Augmenter progressivement."] }] };
const SIGNEE: Fiche = { id: "tibia", regions: ["tibia"], contenu: { fr: CONTENU }, validation: { nom: "Prénom Nom", rpps: "10101010101", date: "2026-11-10" } };

console.log("\nAUCUNE FICHE SANS SIGNATURE");

test("une fiche sans validation, ou à la signature incomplète, n'est jamais proposée", () => {
  const douleur = ["Tibia (périoste)"];
  assert.equal(fichesPour(douleur, "fr", [SIGNEE]).length, 1, "précondition : la fiche signée n'est pas proposée");
  for (const validation of [null, { nom: "Prénom Nom", rpps: "1234", date: "2026-11-10" }, { nom: "Prénom Nom", rpps: "10101010101", date: "hier" }, { nom: "", rpps: "10101010101", date: "2026-11-10" }]) {
    const f = { ...SIGNEE, validation } as Fiche;
    assert.equal(ficheSignee(f), false, `signature acceptée : ${JSON.stringify(validation)}`);
    assert.deepEqual(fichesPour(douleur, "fr", [f]), [], `fiche non signée proposée : ${JSON.stringify(validation)}`);
  }
});

test("le dépôt public ne contient aucune fiche non signée", () => {
  for (const f of FICHES) assert.ok(ficheSignee(f), `fiche « ${f.id} » publiée sans signature complète`);
});

test("une langue non relue n'est pas affichée (pas de texte non signé dans une autre langue)", () => {
  assert.deepEqual(fichesPour(["Tibia (périoste)"], "de", [SIGNEE]), [], "fiche affichée dans une langue que le kinésithérapeute n'a pas relue");
});

console.log("\nLA BONNE FICHE POUR LA RÉGION SIGNALÉE");

test("le ressenti d'après séance et le schéma corporel se rangent à la même région", () => {
  assert.equal(regionDe("Tibia (périoste)"), "tibia");
  assert.equal(regionDe("face:shinL"), "tibia");
  assert.equal(regionDe("dos:shinR"), "tibia");
  assert.equal(regionDe("Genou (7/10)"), "genou", "l'intensité ajoutée par Santé casse le rangement");
  assert.equal(regionDe("Articulaire"), null, "un TYPE de douleur rangé comme une région");
  assert.equal(regionDe("face:head"), null);
});

test("seules les fiches de la région signalée sont proposées, avec leur signataire", () => {
  const r = fichesPour(["face:shinL"], "fr", [SIGNEE, { ...SIGNEE, id: "genou", regions: ["genou"] }]);
  assert.deepEqual(r.map((f) => f.id), ["tibia"]);
  assert.equal(r[0].signataire, "Prénom Nom");
  assert.equal(r[0].relueLe, "2026-11-10");
  assert.deepEqual(fichesPour(["Articulaire"], "fr", [SIGNEE]), [], "une fiche proposée sans région signalée");
});

console.log("\nL'ÉCRAN ET SES GARDE-FOUS");

test("Santé propose les fiches de la région et l'annuaire officiel de l'Ordre", () => {
  const ecran = codeOf("src/components/health/HealthCenter.tsx");
  assert.match(ecran, /const fichesAffichees = fichesPour\(\[\.\.\.douleursSeance\.map\(\(d\) => d\.zone\), \.\.\.suivi\.map\(\(z\) => z\.cle\)\], lang\);/, "les fiches ne suivent plus les douleurs signalées");
  assert.match(ecran, /<a href=\{ANNUAIRE_KINE\} target="_blank" rel="noopener noreferrer"/, "le lien vers l'annuaire a disparu");
  assert.match(ecran, /tr\("k\.ficheSignee", \{ nom: f\.signataire/, "la fiche n'affiche plus qui l'a signée");
  assert.match(ecran, /tr\("k\.ficheAvert"\)/, "l'avertissement « ne remplace pas une consultation » a disparu");
  assert.equal(ANNUAIRE_KINE, "https://www.ordremk.fr/je-suis-patient/trouver-un-kinesitherapeute/");
});

test("aucune IA n'écrit ni ne choisit une fiche", () => {
  for (const f of ["src/lib/health/fichesKine.ts", "src/components/health/HealthCenter.tsx"]) {
    assert.doesNotMatch(codeOf(f), /gemini|generateContent|@\/lib\/ai\//, `${f} appelle une IA`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
