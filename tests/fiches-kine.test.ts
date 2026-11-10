/**
 * LES FICHES DE PRÉVENTION SIGNÉES PAR UN KINÉSITHÉRAPEUTE (10/11/2026).
 *
 * Le Kiné IA est retiré (dispositif médical, conditions de Gemini). Cyprien : « ça peut pas
 * proposer des idées d'exercices ? ». Réponse retenue : une BIBLIOTHÈQUE de fiches générales,
 * identiques pour tous, signées par un masseur-kinésithérapeute, ouverte à tous (la région
 * signalée en tête) — plus l'annuaire officiel de l'Ordre. Relecture juridique du même jour :
 * signature langue par langue, RPPS affiché, rémunération dite, aucune IA sur le texte publié.
 * Ce test fige ces garde-fous.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FICHES, fichesPour, ficheSignee, regionDe, ANNUAIRE_KINE, type Fiche, type Validation } from "../src/lib/health/fichesKine";

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

const CONTENU = { titre: "Tibia : prévention chez le coureur", resume: "Résumé.", sections: [{ titre: "Charge", points: ["Augmenter progressivement."] }] };
const VALIDE: Validation = { nom: "Prénom Nom", rpps: "10101010101", date: "2026-11-10", langues: ["fr"], remuneree: true };
const SIGNEE: Fiche = { id: "tibia", regions: ["tibia"], contenu: { fr: CONTENU }, validation: VALIDE };
const GENOU: Fiche = { ...SIGNEE, id: "genou", regions: ["genou"], contenu: { fr: { ...CONTENU, titre: "Genou : prévention chez le coureur" } } };

console.log("\nAUCUNE FICHE SANS SIGNATURE COMPLÈTE");

test("une fiche sans validation, ou à la signature incomplète ou invraisemblable, n'est jamais proposée", () => {
  assert.equal(fichesPour([], "fr", [SIGNEE]).length, 1, "précondition : la fiche signée n'est pas proposée");
  const mauvaises: unknown[] = [
    null,
    { ...VALIDE, rpps: "1234" },
    { ...VALIDE, nom: "" },
    { ...VALIDE, date: "hier" },
    { ...VALIDE, date: "2026-02-30" },
    { ...VALIDE, date: "2999-01-01" },
    { nom: VALIDE.nom, rpps: VALIDE.rpps, date: VALIDE.date },
  ];
  for (const validation of mauvaises) {
    const f = { ...SIGNEE, validation } as Fiche;
    assert.equal(ficheSignee(f), false, `signature acceptée : ${JSON.stringify(validation)}`);
    assert.deepEqual(fichesPour([], "fr", [f]), [], `fiche non signée proposée : ${JSON.stringify(validation)}`);
  }
});

test("le dépôt public ne contient aucune fiche non signée", () => {
  for (const f of FICHES) assert.ok(ficheSignee(f), `fiche « ${f.id} » publiée sans signature complète`);
});

test("une traduction que le signataire n'a pas relue n'est pas affichée", () => {
  const traduite = { ...SIGNEE, contenu: { fr: CONTENU, de: CONTENU } };
  assert.equal(fichesPour([], "fr", [traduite]).length, 1);
  assert.deepEqual(fichesPour([], "de", [traduite]), [], "« relue par X » sous une traduction que X n'a pas relue");
  assert.equal(fichesPour([], "de", [{ ...traduite, validation: { ...VALIDE, langues: ["fr", "de"] } }]).length, 1, "une traduction relue n'est pas affichée");
});

test("un titre qui nomme une pathologie n'est jamais affiché, dans aucune langue", () => {
  for (const titre of ["Prévenir la périostite", "Tendinite d'Achille : que faire", "Shin splints in runners", "Entorse de cheville"]) {
    const f = { ...SIGNEE, contenu: { fr: { ...CONTENU, titre } } };
    assert.deepEqual(fichesPour([], "fr", [f]), [], `titre-diagnostic affiché : « ${titre} »`);
  }
  assert.equal(fichesPour([], "fr", [SIGNEE]).length, 1, "un titre par région est refusé");
  for (const f of FICHES) for (const c of Object.values(f.contenu)) assert.ok(c && !/p[ée]riost|tendin|fasci/i.test(c.titre), `fiche « ${f.id} » publiée avec un titre-pathologie`);
});

console.log("\nUNE BIBLIOTHÈQUE OUVERTE, LA RÉGION SIGNALÉE EN TÊTE");

test("le ressenti d'après séance et le schéma corporel se rangent à la même région", () => {
  assert.equal(regionDe("Tibia (périoste)"), "tibia");
  assert.equal(regionDe("face:shinL"), "tibia");
  assert.equal(regionDe("dos:shinR"), "tibia");
  assert.equal(regionDe("Genou (7/10)"), "genou", "l'intensité ajoutée par Santé casse le rangement");
  assert.equal(regionDe("Articulaire"), null, "un TYPE de douleur rangé comme une région");
  assert.equal(regionDe("face:head"), null);
});

test("toutes les fiches sont ouvertes à tous ; celle de la région signalée passe en tête", () => {
  const sansDouleur = fichesPour([], "fr", [SIGNEE, GENOU]);
  assert.deepEqual(sansDouleur.map((f) => f.id), ["tibia", "genou"], "la bibliothèque n'est plus ouverte sans douleur");
  assert.ok(sansDouleur.every((f) => !f.regionSignalee), "une région est marquée signalée sans douleur");
  const genou = fichesPour(["face:kneeL"], "fr", [SIGNEE, GENOU]);
  assert.deepEqual(genou.map((f) => [f.id, f.regionSignalee]), [["genou", true], ["tibia", false]], "la région signalée n'est pas en tête");
});

test("la fiche dit qui l'a signée, son RPPS, la date et si la relecture est payée", () => {
  const [f] = fichesPour([], "fr", [SIGNEE]);
  assert.deepEqual([f.signataire, f.rpps, f.relueLe, f.remuneree], ["Prénom Nom", "10101010101", "2026-11-10", true]);
});

console.log("\nL'ÉCRAN ET SES GARDE-FOUS");

test("Santé affiche la bibliothèque, la signature complète et l'annuaire officiel de l'Ordre", () => {
  const ecran = codeOf("src/components/health/HealthCenter.tsx");
  assert.match(ecran, /const fichesAffichees = fichesPour\(douleurs\.map\(\(d\) => d\.cle\), lang\);/, "les fiches ne suivent plus les douleurs signalées");
  assert.match(ecran, /<a href=\{ANNUAIRE_KINE\} target="_blank" rel="noopener noreferrer"/, "le lien vers l'annuaire a disparu");
  assert.match(ecran, /tr\("k\.ficheSignee", \{ nom: f\.signataire, rpps: f\.rpps/, "la fiche n'affiche plus qui l'a signée ni son RPPS");
  assert.match(ecran, /\{f\.remuneree && ` \$\{tr\("k\.ficheRemuneree"\)\}`\}/, "une relecture payée n'est plus dite");
  assert.match(ecran, /tr\("k\.ficheAvert"\)/, "l'avertissement « ne remplace pas une consultation » a disparu");
  assert.equal(ANNUAIRE_KINE, "https://www.ordremk.fr/je-suis-patient/trouver-un-kinesitherapeute/");
});

test("aucune IA ne choisit ni ne modifie une fiche publiée", () => {
  for (const f of ["src/lib/health/fichesKine.ts", "src/components/health/HealthCenter.tsx"]) {
    assert.doesNotMatch(codeOf(f), /gemini|generateContent|@\/lib\/ai\//, `${f} appelle une IA`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
