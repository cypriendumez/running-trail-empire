/**
 * LE RENFORCEMENT IGNORAIT LA FOULÉE DE L'ATHLÈTE.
 *
 * Il se périodisait déjà (base / développement / spécifique / affûtage) et surchargeait
 * par semaine de bloc — ce n'était donc pas un texte figé. Mais il ne regardait NI le
 * ratio vertical, NI la cadence, NI les zones déclarées fragiles : deux coureurs aux
 * fragilités opposées recevaient le même gainage.
 *
 * Trois règles gouvernent l'ajout d'un axe, et ce fichier les fige : aucun axe sans MESURE,
 * deux axes au maximum, et — depuis le 09/11/2026 — AUCUN exercice ciblé déclenché par une
 * douleur déclarée (c'était un soin : lib/coach/renforcement, règle 3 ; lib/health/kineIa).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  axesRenforcement, RATIO_VERTICAL_ELEVE, CADENCE_BASSE, AXES_MAX,
} from "../src/lib/coach/renforcement";

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

console.log("\nAUCUN AXE SANS MESURE");

test("une foulée saine ne reçoit aucun axe", () => {
  // Le cas réel : ratio 7,84 et cadence 173, rien de déclaré. Il n'y a rien à corriger,
  // et inventer un axe reviendrait à faire travailler un point qui va bien.
  assert.deepEqual(axesRenforcement({ ratioVertical: 7.84, cadence: 173, zones: [] }), []);
});

test("une mesure ABSENTE n'est pas une mesure normale", () => {
  assert.deepEqual(axesRenforcement({}), [], "un axe prescrit sans la moindre donnée");
  assert.deepEqual(axesRenforcement({ ratioVertical: null, cadence: null, zones: null }), []);
  assert.deepEqual(axesRenforcement({ ratioVertical: Number.NaN, cadence: 0 }), [],
    "des valeurs illisibles ont produit un axe");
});

console.log("\nCE QUE CHAQUE MESURE DÉCLENCHE");

test("un ratio vertical élevé fait travailler l'élasticité", () => {
  // Nombres ÉCRITS EN DUR : les déduire de la constante rendrait le test aveugle.
  assert.equal(RATIO_VERTICAL_ELEVE, 9, "seuil : décision d'entraîneur, à changer sciemment");
  assert.deepEqual(axesRenforcement({ ratioVertical: 11, cadence: 175 }), ["raideur"]);
  assert.deepEqual(axesRenforcement({ ratioVertical: 8.9, cadence: 175 }), [], "juste sous le seuil : on se tait");
});

test("une cadence basse fait travailler la fréquence", () => {
  assert.equal(CADENCE_BASSE, 165);
  assert.deepEqual(axesRenforcement({ ratioVertical: 7, cadence: 158 }), ["cadence"]);
  assert.deepEqual(axesRenforcement({ ratioVertical: 7, cadence: 166 }), [], "juste au-dessus : rien à signaler");
});

test("une douleur déclarée n'appelle AUCUN exercice ciblé, quel que soit le mot employé", () => {
  // Excentriques « pour le tendon d'Achille », abducteurs « parce que le moyen fessier laisse le
  // genou partir en dedans » : un traitement et une cause pour une blessure que personne n'a
  // examinée. La douleur allège le plan ; le soin relève d'un professionnel de santé.
  for (const zone of ["genou droit", "syndrome de l'essuie-glace (ITBS)", "douleur de hanche", "tendon d'Achille",
    "mollet gauche", "fasciite plantaire", "ischio-jambiers", "lombaires"]) {
    assert.deepEqual(axesRenforcement({ zones: [zone] }), [], `« ${zone} » déclenche de nouveau un exercice ciblé`);
  }
  const src = readFileSync("src/lib/ai/planI18n.ts", "utf8");
  assert.ok(!/genou_hanche|mollet_achille|chaine_posterieure|seul protocole|only protocol/.test(src), "un texte d'exercice ciblé sur une douleur est revenu dans le plan");
});

console.log("\nLES DEUX GARDE-FOUS");
test("une douleur ne remplace ni ne précède une MESURE : seules les métriques produisent un axe", () => {
  const a = axesRenforcement({ ratioVertical: 12, cadence: 155, zones: ["tendon d'Achille"] });
  assert.deepEqual(a, ["raideur", "cadence"], `l'ordre est ${a.join("/")} : une douleur produit de nouveau un axe`);
});
test("jamais plus de deux axes", () => {
  assert.equal(AXES_MAX, 2, "une séance qui corrige tout ne corrige rien");
  const a = axesRenforcement({ ratioVertical: 12, cadence: 150, zones: ["genou", "mollet", "ischio"] });
  assert.equal(a.length, 2, `${a.length} axes prescrits : l'athlète abandonnera devant la liste`);
});

console.log("\nBRANCHEMENT");

test("le plan ajoute l'axe, et JAMAIS pendant l'affûtage", () => {
  const src = codeOf("src/lib/ai/autoPlan.ts");
  assert.match(src, /const axes = ctx\.cycle\.taper \|\| douleur \? \[\] : axesRenforcement\(\{/,
    "du travail supplémentaire est ajouté en affûtage (où tout l'objectif est de garder du jus) ou sur une douleur active");
  assert.match(src, /PLAN_T\[l\]\.renfoAxe\[a\]/, "l'axe n'est plus rendu dans le texte de la séance");
  // Base, développement, spécifique — et la reprise d'après-course (fondations), depuis le
  // 05/11/2026. La récupération proprement dite (`renfoRecup`) et l'affûtage n'en ont pas.
  const n = (src.match(/\+ enPlus/g) ?? []).length;
  assert.equal(n, 4, `${n} phase(s) portent l'axe : base, développement, spécifique et reprise doivent toutes l'avoir`);
  assert.doesNotMatch(src, /renfoRecup \+ enPlus/, "du travail supplémentaire est ajouté pendant la récupération d'après-course");
});

test("le contexte expose des MÉDIANES, pas des valeurs isolées", () => {
  // Une seule séance en côtes ne doit pas décider d'un axe pour tout un bloc.
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /v\.length >= 5 \? v\[Math\.floor\(v\.length \/ 2\)\] : null/,
    "les mesures de foulée ne sont plus médianes, ou le minimum de séances a sauté");
  assert.match(src, /zonesFragiles: Array\.isArray\(p\?\.injury_zones\)/, "les zones déclarées ne remontent plus");
  // Les douleurs actives sont CELLES qui passent le jour au rouge (même liste `pains`).
  assert.match(src, /douleursActives: pains,/, "les douleurs actives ne remontent plus au plan : le renforcement ignore de nouveau la douleur");
});

test("les cinq langues portent les deux axes de foulée", () => {
  const i18n = readFileSync("src/lib/ai/planI18n.ts", "utf8");
  assert.equal(i18n.split("renfoAxe:").length - 1, 6, "renfoAxe : 5 langues + le type attendus");
  // Les trois axes « douleur » sont retirés le 09/11/2026 (voir plus haut).
  for (const axe of ["raideur", "cadence"])
    assert.equal(i18n.split(`${axe}:`).length - 1, 5, `${axe} absent de certaines langues`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
