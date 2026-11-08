/**
 * LA COURSE N'AVAIT AUCUN PLAN D'ALIMENTATION.
 *
 * La sortie longue en avait un depuis longtemps — glucides par heure, hydratation selon
 * la température du jour, sodium, collation d'avant. La COURSE, elle, n'avait rien.
 * C'est pourtant le seul jour où une erreur d'alimentation coûte des mois de
 * préparation : sur un marathon ou un trail, le mur n'est pas une affaire de jambes.
 *
 * ⚠️ LA TEMPÉRATURE DU JOUR J EST INCONNUE, et le module doit le DIRE. La colonne
 * `historical_weather` du catalogue est vide sur les 17 211 courses (vérifié) : on ne
 * dispose d'une température que si la course tombe dans la fenêtre de prévision, soit
 * la dernière semaine. Un plan d'hydratation faux par 30 °C est dangereux, pas
 * seulement inexact.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NutritionCourse } from "../src/components/health/NutritionCourse";
import { coursesPourNutrition } from "../src/lib/health/coursesNutrition";
import { predictRaceSec } from "../src/lib/running/fitness";
import {
  planNutritionCourse, DUREE_MIN_MIN, DUREE_LONGUE_MIN, PREMIER_APPORT_MIN, derouleCourse, TRANCHES_TEMPERATURE, FLASQUE_ML,
} from "../src/lib/coach/nutritionCourse";

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

console.log("\nQUAND IL N'Y A RIEN À PRESCRIRE");

test("une course courte ne demande aucun ravitaillement", () => {
  // Son 10 km en 33'30 : les réserves de glycogène y suffisent largement.
  assert.equal(planNutritionCourse({ dureeSec: 2010, distanceKm: 10, poidsKg: 68 }), null);
  assert.equal(DUREE_MIN_MIN, 75, "seuil : décision d'entraîneur, à changer sciemment");
  assert.equal(planNutritionCourse({ dureeSec: 74 * 60 }), null, "juste sous le seuil : rien");
  assert.ok(planNutritionCourse({ dureeSec: 76 * 60 }), "juste au-dessus : il y a de quoi dire");
});

test("sans durée, aucun plan inventé", () => {
  assert.equal(planNutritionCourse({ distanceKm: 42.2, poidsKg: 68 }), null);
  assert.equal(planNutritionCourse({ dureeSec: Number.NaN }), null);
  assert.equal(planNutritionCourse({ dureeSec: -100 }), null);
});

console.log("\nLES QUANTITÉS");

test("les doses montent avec la durée", () => {
  assert.equal(DUREE_LONGUE_MIN, 150);
  const semi = planNutritionCourse({ dureeSec: 4740, distanceKm: 21.1, poidsKg: 68 })!;
  const marathon = planNutritionCourse({ dureeSec: 10200, distanceKm: 42.2, poidsKg: 68 })!;
  assert.ok(marathon.glucidesParH > semi.glucidesParH,
    "au-delà de 2 h 30 il faut des doses hautes, avec des glucides multi-transportables");
  assert.ok(marathon.glucidesTotalG > semi.glucidesTotalG * 3);
});

test("la première heure ne compte pas", () => {
  // Manger tôt coûte du confort digestif sans rien apporter : les réserves y suffisent.
  assert.equal(PREMIER_APPORT_MIN, 45);
  const p = planNutritionCourse({ dureeSec: 120 * 60 })!;
  assert.equal(p.glucidesTotalG, Math.round(p.glucidesParH * 1), "une course de 2 h ne se ravitaille que sur 1 h");
  assert.equal(planNutritionCourse({ dureeSec: 80 * 60 })!.glucidesTotalG, Math.round(50 * (80 / 60 - 1)));
});

test("les gels traduisent les grammes", () => {
  const p = planNutritionCourse({ dureeSec: 10200 })!;
  assert.equal(p.gels, Math.round(p.glucidesTotalG / 25), "un athlète compte en gels, pas en grammes");
  assert.ok(p.gels >= 5 && p.gels <= 7, `${p.gels} gels sur un marathon de 2 h 50`);
});

console.log("\nL'HYDRATATION, ET CE QU'ON NE SAIT PAS");

test("la température fait monter la boisson ET le sodium", () => {
  const froid = planNutritionCourse({ dureeSec: 10800, tempC: 5 })!;
  const chaud = planNutritionCourse({ dureeSec: 10800, tempC: 30 })!;
  assert.ok(chaud.mlParH > froid.mlParH * 1.5, "l'hydratation ne suit plus la chaleur");
  assert.ok(chaud.sodiumMgParL > froid.sodiumMgParL, "les pertes sudorales ne sont plus compensées");
});

test("0 °C est une température, pas une absence", () => {
  // `fini()` exige > 0 : utilisé ici, il aurait fait passer un départ à 0 °C pour une
  // température inconnue, et donné 500 ml/h au lieu de 350.
  const p = planNutritionCourse({ dureeSec: 10800, tempC: 0 })!;
  assert.equal(p.tempConnue, true, "0 °C traité comme une donnée absente");
  assert.equal(p.tempC, 0);
  assert.ok(p.mlParH < 450, `${p.mlParH} ml/h par 0 °C : c'est la base tempérée qui s'applique`);
});

test("une température inconnue est ANNONCÉE comme telle", () => {
  const p = planNutritionCourse({ dureeSec: 10800 })!;
  assert.equal(p.tempConnue, false, "une supposition présentée comme une mesure");
  assert.equal(p.tempC, null);
  assert.equal(p.mlParH, 500, "la base tempérée doit rester prudente");
});

test("sans poids, la charge d'avant course n'est pas devinée", () => {
  assert.equal(planNutritionCourse({ dureeSec: 10200 })!.avantCourseG, null);
  assert.ok(planNutritionCourse({ dureeSec: 10200, poidsKg: 68 })!.avantCourseG! > 100);
});

console.log("\nBRANCHEMENT");

test("le prompt dit l'essentiel — y compris ce qu'il ignore", () => {
  const src = codeOf("src/lib/ai/coachContext.ts");
  // ⚠️ Le titre existe AUSSI en commentaire dans le fichier : `codeOf()` retire les
  // commentaires, donc ce qui reste ne peut être que le bloc de prompt lui-même. Sans
  // cette précaution, muter le commentaire laissait ce test au vert.
  assert.match(src, /NUTRITION DU JOUR DE COURSE \(\$\{nRaw/, "le bloc a disparu du prompt");
  const n = (src.match(/NUTRITION DU JOUR DE COURSE/g) ?? []).length;
  assert.equal(n, 1, `${n} occurrence(s) hors commentaires : le bloc n'est plus unique`);
  assert.match(src, /LA TEMPÉRATURE DU JOUR J EST INCONNUE/,
    "l'incertitude n'est plus annoncée : le modèle donnerait une hydratation supposée pour une mesure");
  assert.match(src, /RIEN DE TOUT CELA NE S'ESSAIE LE JOUR J/,
    "l'avertissement le plus important a sauté — un produit non testé se paie en course");
  assert.match(src, /MULTI-TRANSPORTABLES/, "la contrainte au-delà de 60 g\\/h n'est plus expliquée");
});

test("la durée vient de la PRÉDICTION, pas d'une saisie", () => {
  const src = codeOf("src/lib/ai/coachContext.ts");
  // Avec le SOCLE réel (02/10/2026) : la durée qui dimensionne gels et boisson est celle
  // que l'athlète lit sur sa carte de prédictions, pas une prédiction « sans préparation ».
  assert.match(src, /dureeSec: predictRaceSec\(vma, objective\.distanceKm, \{ sortieLongueKm: longestRecentKm \|\| null, volumeHebdoKm: demonstratedKm \}\)/,
    "la durée de course n'est plus prédite depuis la VMA et le socle réel");
  assert.match(src, /tempC: meteoCourse/, "la météo du jour J n'est plus transmise");
});

// ── L'écran Santé › Nutrition (refait le 30/09/2026) ─────────────────────────
test("le déroulé : autant de prises que de gels, au bon rythme, et le sac qui va avec", () => {
  const semi = planNutritionCourse({ dureeSec: 100 * 60 })!;          // < 2 h 30 : 50 g/h
  const d = derouleCourse(semi);
  assert.equal(d.prises.length, semi.gels, "la liste des horaires et le décompte des gels se contredisent");
  assert.equal(d.prises[0], PREMIER_APPORT_MIN, "le premier gel ne tombe plus avant la faim");
  assert.equal(d.intervalleMin, 30, "un gel de 25 g à 50 g/h, c'est toutes les 30 min");
  const ultra = derouleCourse(planNutritionCourse({ dureeSec: 6 * 3600, tempC: 27 })!);   // 75 g/h
  assert.equal(ultra.intervalleMin, 20, "à 75 g/h, un gel toutes les 20 min");
  assert.equal(ultra.flasques, Math.ceil(ultra.boissonTotaleMl / FLASQUE_ML), "le nombre de flasques ne suit plus la boisson");
  // 3 h par temps frais : 1 050 ml → TROIS flasques, pas deux (on arrondit vers le haut, sinon on manque).
  assert.equal(derouleCourse(planNutritionCourse({ dureeSec: 3 * 3600, tempC: 5 })!).flasques, 3, "une flasque manque dans le sac");
  for (let i = 1; i < ultra.prises.length; i++) assert.equal(ultra.prises[i] - ultra.prises[i - 1], ultra.intervalleMin);
  const p = planNutritionCourse({ dureeSec: 6 * 3600, tempC: 27 })!;
  assert.equal(ultra.sodiumMgParH, Math.round((p.sodiumMgParL * p.mlParH) / 1000), "le sodium par heure n'est plus la concentration × la boisson");
});

test("chaque tranche de météo rend LE MÊME plan sur ses deux bords (une tranche = un palier)", () => {
  for (const t of TRANCHES_TEMPERATURE) {
    const bords = [t.min ?? t.max! - 5, t.max ?? t.min! + 5];
    const ref = planNutritionCourse({ dureeSec: 3 * 3600, tempC: t.tempC })!;
    for (const b of bords) {
      const x = planNutritionCourse({ dureeSec: 3 * 3600, tempC: b })!;
      assert.equal(x.mlParH, ref.mlParH, `${t.cle} : ${b} °C ne boit pas comme ${t.tempC} °C`);
      assert.equal(x.sodiumMgParL, ref.sodiumMgParL, `${t.cle} : ${b} °C ne sale pas comme ${t.tempC} °C`);
    }
  }
});

test("les courses proposées : la durée PRÉDITE par la VMA, sinon le temps visé, sinon rien d'inventé", () => {
  const obj = { race: "Marathon de Lille", raceDate: "2026-10-25", distanceKm: 42.195, targetSeconds: 3 * 3600 };
  const cal = [{ name: "Foulées de Bondues", date: "2026-11-08", distanceKm: 10 }];
  const avecVma = coursesPourNutrition(obj, cal, "2026-09-30", 18);
  assert.equal(avecVma[0].origine, "vma");
  assert.equal(avecVma[0].dureeSec, Math.round(predictRaceSec(18, 42.195)), "la durée n'est plus celle du coach");
  const sansVma = coursesPourNutrition(obj, cal, "2026-09-30", null);
  assert.deepEqual([sansVma[0].origine, sansVma[0].dureeSec], ["cible", 3 * 3600], "le temps visé de l'objectif est ignoré");
  assert.deepEqual([sansVma[1].origine, sansVma[1].dureeSec], [null, null], "une durée est inventée pour une course sans VMA ni temps visé");
  assert.ok(coursesPourNutrition(obj, Array.from({ length: 9 }, (_, i) => ({ name: `C${i}`, date: `2026-11-${10 + i}`, distanceKm: 10 })), "2026-09-30", 18).length <= 3);
  assert.deepEqual(coursesPourNutrition(null, [], "2026-09-30", 18), []);
});

test("L'ÉCRAN : pas de chiffre inventé, pas de décor « IA », le même plan que le coach, 5 langues", () => {
  const src = readFileSync("src/components/health/NutritionCourse.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/caf[ée]ine|caffeine/i.test(src), "la caféine inventée est revenue");
  assert.ok(!/bg-gradient|Nutrition Lab|🧂|☕/.test(src), "le décor en dégradé et émojis est revenu");
  assert.ok(/planNutritionCourse\(\{ dureeSec, distanceKm: course\?\.distanceKm \?\? null, poidsKg, tempC \}\)/.test(src), "l'écran ne lit plus le calcul du coach");
  const rendu = (courses: Parameters<typeof NutritionCourse>[0]["courses"]) => renderToStaticMarkup(createElement(NutritionCourse, { courses, poidsKg: 68 }));
  // Un 10 km prédit en 40 min : rien à manger — et l'écran le dit.
  const court = rendu([{ nom: "10 km de Lille", date: "2026-10-12", distanceKm: 10, dureeSec: 40 * 60, origine: "vma" }]);
  assert.ok(court.includes("tes réserves suffisent"), "un 10 km reçoit un plan de gels");
  // Un marathon en 3 h : les gels du plan, ni plus ni moins.
  const p = planNutritionCourse({ dureeSec: 3 * 3600, distanceKm: 42.195, poidsKg: 68, tempC: null })!;
  const long = rendu([{ nom: "Marathon de Lille", date: "2026-10-25", distanceKm: 42.195, dureeSec: 3 * 3600, origine: "vma" }]);
  assert.ok(long.includes(`${p.gels} gels de 25 g`), `le sac n'annonce plus les ${p.gels} gels du plan`);
  assert.ok(long.includes("Marathon de Lille"));
  for (const l of ["fr", "en", "de", "es", "pt"]) assert.ok(new RegExp(`\\n  ${l}: \\{`).test(readFileSync("src/components/health/NutritionCourse.tsx", "utf8")), `langue ${l} absente`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
