/**
 * LE COACH PRESCRIVAIT DANS LE VIDE.
 *
 * Il vérifiait SI l'athlète avait couru le jour prévu — jamais CE QU'IL AVAIT FAIT. Il
 * pouvait demander 5×1000 m à 3'20 pendant des mois, les voir courus à 3'28, et ne rien
 * en tirer. Un entraîneur ajuste ses allures à partir de l'exécution.
 *
 * ⚠️ CE QUE CE MODULE NE PEUT PAS SAVOIR, et qui commande toute sa prudence : sans
 * ressenti post-séance — aucun enregistré sur le compte de référence — un écart ne dit
 * pas si la cible était trop rapide ou si la séance a été mal exécutée (vent, fatigue,
 * arrêt à un feu). D'où une correction de MOITIÉ, plafonnée, et trois motifs explicites
 * de ne rien faire.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  relireExecution, corrigerAllure,
  SEANCES_MIN, ECART_MIN_SEC, PART_CORRIGEE, CORRECTION_MAX_PCT, type SeanceRealisee,
} from "../src/lib/coach/relecture";

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
/** `n` séances tenues à `cible + ecart`, avec un bruit ±`bruit` alterné. */
const seances = (n: number, cible: number, ecart: number, bruit = 0): SeanceRealisee[] =>
  Array.from({ length: n }, (_, i) => ({ cibleSecKm: cible, allureSecKm: cible + ecart + (i % 2 ? bruit : -bruit) }));

console.log("\nQUAND LE COACH CORRIGE");

test("un athlète systématiquement plus lent fait baisser la cible", () => {
  // 12 footings tenus 40 s/km plus lentement que demandé : la cible est trop rapide.
  const r = relireExecution(seances(12, 300, 40, 3))!;
  assert.equal(r.motifInaction, "aucun", "aucune correction sur un écart pourtant net");
  assert.ok(r.correctionSec > 0, "la correction doit RALENTIR la cible");
  // Moitié de l'écart, jamais la totalité : voir l'avertissement du module.
  assert.equal(r.correctionSec, Math.round(40 * PART_CORRIGEE));
});

test("un athlète systématiquement plus rapide fait monter la cible", () => {
  const r = relireExecution(seances(12, 300, -30, 2))!;
  assert.ok(r.correctionSec < 0, "la correction doit ACCÉLÉRER la cible");
  assert.equal(r.correctionSec, Math.round(-30 * PART_CORRIGEE));
});

test("la correction est plafonnée", () => {
  // Un écart absurde ne doit pas déplacer une allure de plus de 8 %.
  const r = relireExecution(seances(12, 300, 200, 5))!;
  assert.ok(Math.abs(r.correctionSec) <= 300 * CORRECTION_MAX_PCT + 0.5,
    `correction de ${r.correctionSec} s/km sur une cible de 300`);
  assert.equal(CORRECTION_MAX_PCT, 0.08, "plafond : décision d'entraîneur, à changer sciemment");
});

console.log("\nQUAND IL S'ABSTIENT — et il doit DIRE pourquoi");

test("trop peu de séances : on ne conclut pas", () => {
  // Nombres ÉCRITS EN DUR : les déduire de la constante rendrait le test aveugle.
  assert.equal(SEANCES_MIN, 8);
  const r = relireExecution(seances(7, 300, 40))!;
  assert.equal(r.correctionSec, 0);
  assert.equal(r.motifInaction, "trop_peu_de_seances");
  // …mais le CONSTAT est quand même rendu : l'écart mesuré reste une information.
  assert.equal(r.seances, 7);
  assert.ok(r.ecartMedianSec > 0);
});

test("un écart minuscule ne justifie rien", () => {
  assert.equal(ECART_MIN_SEC, 10);
  // Cas réel mesuré : +7 s/km sur 39 footings — dans le bruit d'une montre.
  const r = relireExecution(seances(39, 300, 7, 2))!;
  assert.equal(r.correctionSec, 0);
  assert.equal(r.motifInaction, "ecart_negligeable");
  assert.ok(relireExecution(seances(12, 300, 12, 1))!.correctionSec !== 0, "au-delà du seuil, on agit");
});

test("un athlète IRRÉGULIER ne fait pas bouger la cible", () => {
  // ⚠️ Dispersion plus large que l'écart : c'est la régularité qui manque, pas une
  // autre allure. Corriger reviendrait à poursuivre du bruit.
  const r = relireExecution(seances(20, 300, 15, 60))!;
  assert.equal(r.correctionSec, 0);
  assert.equal(r.motifInaction, "execution_irreguliere");
  assert.ok(r.dispersionSec > Math.abs(r.ecartMedianSec) * 3);
});

test("rien de comparable ne produit rien", () => {
  assert.equal(relireExecution([]), null);
  // Allures impossibles : 30 s/km, 30 min/km, valeurs illisibles.
  assert.equal(relireExecution([
    { allureSecKm: 30, cibleSecKm: 300 }, { allureSecKm: 1800, cibleSecKm: 300 },
    { allureSecKm: Number.NaN, cibleSecKm: 300 }, { allureSecKm: 300, cibleSecKm: 0 },
  ]), null, "des allures aberrantes ont été comparées");
});

test("c'est une MÉDIANE : une séance en côtes ne déplace pas la cible", () => {
  const propre = relireExecution(seances(12, 300, 30, 2))!;
  const avecIntrus = relireExecution([...seances(12, 300, 30, 2),
    { allureSecKm: 480, cibleSecKm: 300 }, { allureSecKm: 470, cibleSecKm: 300 }])!;
  assert.ok(Math.abs(avecIntrus.correctionSec - propre.correctionSec) <= 3,
    `deux séances extrêmes ont déplacé la correction de ${Math.abs(avecIntrus.correctionSec - propre.correctionSec)} s/km`);
});

console.log("\nAPPLIQUER LA CORRECTION");

test("l'allure corrigée garde son format", () => {
  assert.equal(corrigerAllure("5'00", 20), "5'20");
  assert.equal(corrigerAllure("5'00", -20), "4'40");
  assert.equal(corrigerAllure("4'50", 15), "5'05", "le passage de minute doit être géré");
});

test("une allure illisible ou absurde n'est pas fabriquée", () => {
  assert.equal(corrigerAllure(null, 20), null);
  assert.equal(corrigerAllure("n'importe quoi", 20), "n'importe quoi");
  assert.equal(corrigerAllure("5'00", 10000), "5'00", "une correction absurde laisse l'allure d'origine");
});

console.log("\nBRANCHEMENT — mesurer sans jamais agir ne servirait à rien");

test("l'allure corrigée est celle qui PART dans le plan", () => {
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /easyPace: easyPaceCorrige/, "le plan reçoit encore l'allure NON corrigée");
  const n = (src.match(/easyPace: easyPaceCorrige/g) ?? []).length;
  assert.equal(n, 2, `${n} sortie(s) corrigée(s) : le contexte ET le plan doivent la recevoir`);
  assert.match(src, /relireExecution\(/, "la relecture n'est plus calculée");
});

test("l'allure comparée est celle AJUSTÉE AU DÉNIVELÉ", () => {
  // Sans GAP, une semaine en côtes passerait pour une baisse de forme.
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /num\(w\.gap_min_km\) != null \? num\(w\.gap_min_km\)! \* 60/,
    "l'allure brute est de nouveau comparée à la cible");
  assert.match(src, /gap_min_km/, "la colonne GAP n'est plus demandée");
});

test("le prompt dit ce que la relecture a trouvé, même sans correction", () => {
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /RELECTURE DE L'EXÉCUTION/, "le prompt ne parle plus de l'exécution");
  assert.match(src, /il tient ses allures/, "le cas « tout va bien » n'est plus dit — c'est pourtant utile");
  assert.match(src, /Aucun ressenti post-séance n'est disponible/,
    "la limite n'est plus annoncée : le modèle trancherait à la place de l'athlète");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
