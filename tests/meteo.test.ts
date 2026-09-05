/**
 * LA SÉANCE DE QUALITÉ TOMBAIT SUR LE PIRE JOUR DE LA SEMAINE.
 *
 * Le plan prenait le PREMIER jour disponible, puis ralentissait l'allure cible s'il
 * faisait 27 °C ou qu'il ventait à 45 km/h. Mais l'allure EST le stimulus d'une séance
 * de VMA : la ralentir, c'est faire une autre séance. Un entraîneur décale de 24 h.
 *
 * Semaine réelle relevée le 05/09/2026 à la position d'entraînement enregistrée :
 * 25 s/km de pénalité le dimanche (26 °C) contre 0 le mardi. Le premier jour libre
 * pouvait donc coûter la séance, alors qu'un jour propre attendait 48 h plus tard.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { choisirJourQualite, HORIZON_METEO, GAIN_METEO_MIN } from "../src/lib/coach/meteoPlacement";

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
/** Pénalités indexées par jour, comme `penaliteMeteo` dans le plan. */
const p = (tab: number[]) => (i: number) => tab[i] ?? 0;

console.log("\nCHOIX DU JOUR — la météo vote, elle ne décide pas seule");

test("aucun jour éligible : on n'invente pas de jour", () => {
  assert.equal(choisirJourQualite([], p([0, 0, 0])), -1);
});

test("météo identique partout : le premier jour libre gagne", () => {
  assert.equal(choisirJourQualite([1, 2, 3], p([0, 5, 5, 5])), 1);
});

test("la vraie semaine du 05/09 : la séance quitte les 25 s/km", () => {
  const semaine = [10, 25, 10, 0, 0, 0, 10];
  assert.equal(choisirJourQualite([1, 2, 3], p(semaine)), 3, "le jour à 0 s/km devait l'emporter");
});

test("un gain trop faible ne justifie pas de casser le rythme", () => {
  const faible = GAIN_METEO_MIN - 1;
  assert.equal(choisirJourQualite([1, 2], p([0, faible, 0])), 1, `${faible} s/km gagnés ne valent pas un décalage`);
  assert.equal(choisirJourQualite([1, 2], p([0, GAIN_METEO_MIN, 0])), 2, "au seuil exact, le décalage est justifié");
});

test("on ne repousse pas indéfiniment pour attendre le beau temps", () => {
  // Nombres ÉCRITS EN DUR volontairement. Les déduire de la constante rendrait ce test
  // incapable de voir un changement d'horizon : il suivrait le code au lieu de le juger.
  assert.equal(HORIZON_METEO, 2, "l'horizon est une décision d'entraîneur, pas un détail — à changer sciemment");
  assert.equal(GAIN_METEO_MIN, 10, "un barreau entier de l'échelle de vent");
  const tab = [30, 30, 30, 0, 0, 0, 0, 0];
  assert.equal(choisirJourQualite([1, 4], p(tab)), 1, "un jour parfait à +3 reste hors d'atteinte");
  assert.equal(choisirJourQualite([1, 3], p(tab)), 3, "à +2, le décalage est encore permis");
});

test("déplacer ne doit pas affamer les séances suivantes", () => {
  const tab = [0, 25, 0, 0];
  // Deux qualités à placer et seulement deux jours : prendre le second pour la première
  // ne laisserait aucun jour à la seconde.
  assert.equal(choisirJourQualite([1, 2], p(tab), 1), 1, "la seconde séance a été sacrifiée au confort de la première");
  assert.equal(choisirJourQualite([1, 2, 3], p(tab), 1), 2, "avec un jour de marge, le décalage redevient possible");
});

test("à égalité, le plus tôt l'emporte", () => {
  assert.equal(choisirJourQualite([1, 2, 3], p([0, 25, 0, 0]), 0), 2);
});

test("une pénalité absurde ne fait pas dérailler le choix", () => {
  const casse = (i: number) => (i === 2 ? Number.NaN : i === 1 ? 25 : 0);
  assert.equal(choisirJourQualite([1, 2, 3], casse), 2, "NaN doit valoir 0, pas contaminer la comparaison");
  assert.doesNotThrow(() => choisirJourQualite([1], () => Number.POSITIVE_INFINITY));
});

console.log("\nBRANCHEMENT — la règle doit vraiment piloter le plan");

test("le plan appelle le choix au lieu de prendre le premier jour", () => {
  const src = codeOf("src/lib/ai/autoPlan.ts");
  assert.match(src, /choisirJourQualite\(eligibles, penaliteMeteo, quality\.length - 1 - qi\)/,
    "le placement météo n'est pas branché");
  assert.doesNotMatch(src, /if \(canRun\(i\) && okSpacing\(i\) && !coolerExists\(i\)\) \{ idx = i; break; \}/,
    "l'ancien « premier jour libre » est encore là");
});

test("l'allure et le placement partagent LE MÊME calcul de pénalité", () => {
  const src = codeOf("src/lib/ai/autoPlan.ts");
  assert.match(src, /const penalty = penaliteMeteo\(i\);/,
    "l'allure recalcule la pénalité dans son coin : les deux peuvent diverger");
  const n = src.split("const penaliteMeteo").length - 1;
  assert.equal(n, 1, `${n} définitions du surcoût météo au lieu d'une seule`);
});

test("tous les fichiers de test sont dans la chaîne npm test", () => {
  const chaine = JSON.parse(readFileSync("package.json", "utf8")).scripts.test as string;
  const oublies = readdirSync("tests").filter((f) => f.endsWith(".test.ts")).filter((f) => !chaine.includes(`tests/${f}`));
  assert.deepEqual(oublies, [], `test(s) jamais exécuté(s) : ${oublies.join(", ")}`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
