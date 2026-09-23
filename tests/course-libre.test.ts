/**
 * COURIR À L'ALLURE OU À LA FRÉQUENCE QU'ON VEUT.
 *
 * Cyprien, 23/09/2026 : « il faut aussi permettre au client de courir à l'allure qu'il
 * veut ou la fréquence cardiaque qu'il veut ».
 *
 * L'écran n'offrait que des OBJECTIFS. En allure, la cible n'existait pas comme donnée :
 * c'était le quotient d'une distance par un temps, tous deux obligatoires. En cardio, il
 * fallait choisir parmi cinq zones. On ne pouvait donc ni partir à 5:30 sans s'engager
 * sur une distance, ni tenir une fourchette à soi (« entre 145 et 155 »).
 *
 * Ce fichier tient les pièges du mode libre, tous SILENCIEUX :
 *  · une fin automatique qui coupe une course sans fin ;
 *  · des jalons posés par une fermeture périmée (`libre` absent des dépendances) ;
 *  · un chiffre inventé à l'écran (« fin prévue » sans distance visée) ;
 *  · une voix qui annonce un objectif qui n'existe pas.
 *
 *   npx tsx tests/course-libre.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const GR = "src/components/ghost-runner/GhostRunner.tsx";
const I18 = "src/components/ghost-runner/ghostI18n.tsx";

console.log("\n=== COURSE LIBRE ===\n");

test("en libre, l'allure cible est une DONNÉE, pas le quotient d'un objectif", () => {
  const gr = codeNu(GR);
  assert.match(gr, /const targetPace = libre && targetMode === "pace"\s*\n?\s*\? paceLibre/, "l'allure libre ne pilote plus la cible : on retomberait sur distance ÷ temps");
  // Et elle doit pouvoir sortir de la plage des objectifs : marche rapide, trail en montée.
  assert.match(gr, /const PACE_LIBRE_MAX = 15;/, "l'allure libre est de nouveau plafonnée comme un objectif : exit la montée et la marche");
  assert.match(gr, /const PACE_LIBRE_MIN = 2\.5;/, "le plancher d'allure libre a changé");
  assert.match(gr, /const FC_MIN = 80;[\s\S]{0,40}const FC_MAX = 220;/, "la fourchette cardiaque libre ne couvre plus du repos au maximum réel");
});

test("aucune fin automatique : ni distance atteinte, ni durée écoulée", () => {
  const gr = codeNu(GR);
  assert.match(gr, /sessionKindRef\.current === "pace" && !libreRef\.current && km >= distance\) finishSession\(\)/, "une course libre s'arrête toute seule à une distance que personne n'a demandée");
  assert.match(gr, /if \(!libreRef\.current && el >= total\) finishHrSession\(\)/, "une séance cardio libre s'arrête toute seule à une durée que personne n'a demandée");
  // ⚠️ Le mode est FIGÉ au départ : changer d'avis en courant ne doit pas changer la séance.
  assert.equal([...gr.matchAll(/libreRef\.current = libre; dernierKmDitRef\.current = 0;/g)].length, 2, "le mode n'est plus figé au départ des deux types de séance");
});

test("aucun jalon en libre — y compris à travers la fermeture de `buildCheckpoints`", () => {
  const gr = codeNu(GR);
  assert.match(gr, /if \(libre\) return \[\];/, "les points de passage sont de nouveau construits en course libre");
  // ⚠️ LE PIÈGE MESURÉ LE 23/09/2026 : `buildCheckpoints` est un `useCallback`. Sans
  // `libre` dans ses dépendances, il gardait la valeur du PREMIER rendu et jalonnait
  // quand même — km 1 à 6 affichés sur une course sans distance.
  assert.match(gr, /\}, \[distance, targetPace, elevation, libre\]\);/, "`libre` a quitté les dépendances de buildCheckpoints : la fermeture périmée rejalonnera la course libre");
  // Et un panneau de jalons vide n'a rien à faire à l'écran.
  assert.match(gr, /\{sessionKind === "pace" && checkpoints\.length > 0 && \(/, "le panneau des points de passage s'affiche même vide");
});

test("la fourchette cardiaque choisie prime sur la zone, et elle est ordonnée", () => {
  const gr = codeNu(GR);
  assert.match(gr, /hrLoRef\.current = libre \? Math\.min\(fcLo, fcHi\)/, "la fourchette choisie ne pilote plus la cible cardiaque");
  assert.match(gr, /hrHiRef\.current = libre \? Math\.max\(fcLo, fcHi\)/, "la fourchette choisie ne pilote plus le plafond cardiaque");
  // ⚠️ min/max, PAS lo/hi : un plancher réglé au-dessus du plafond donnerait une
  // fourchette vide, donc « tu es hors zone » à chaque battement.
  assert.ok(!/hrLoRef\.current = libre \? fcLo/.test(gr), "un plancher au-dessus du plafond produirait une fourchette vide");
});

test("rien d'inventé à l'écran : pas de fin prévue, pas de barre, pas d'avance", () => {
  const gr = codeNu(GR);
  assert.match(gr, /if \(!libreRef\.current && km > 0\) setPredictedFinish/, "une fin est prédite sans distance visée : c'est un chiffre inventé");
  assert.match(gr, /\{phase === "running" && !libreRef\.current && Math\.abs\(timeDelta\) > 3 && \(/, "l'avance/retard s'affiche encore alors que rien n'est visé");
  assert.match(gr, /\{!libreRef\.current && \(<>/, "la barre de progression revient alors qu'il n'y a pas de fin");
  // À la place, une mesure vraie : l'allure moyenne.
  assert.match(gr, /\{libreRef\.current \? \(/, "la colonne « fin prévue » n'est plus remplacée en libre");
  assert.match(gr, /currentKm > 0\.05 \? formatPace\(elapsed \/ 60 \/ currentKm\) : "—"/, "l'allure moyenne n'est plus calculée, ou n'attend plus d'avoir couru pour l'afficher");
});

test("la voix ne parle pas d'un objectif qui n'existe pas", () => {
  // ⚠️ MESURÉ EN COURANT : l'annonce de départ disait « Objectif : 1:00:00 » en course
  // libre — la valeur par défaut de `targetTime`, que personne n'avait choisie.
  const gr = codeNu(GR);
  assert.match(gr, /speak\(libre \? tg\("sp\.startLibre", \{ p: formatPace\(paceLibre\) \}\)/, "le départ annonce de nouveau un objectif inexistant");
  assert.match(gr, /speak\(libre\s*\n?\s*\? tg\("sp\.hrStartLibre"/, "le départ cardio annonce de nouveau une durée et une zone inexistantes");
  assert.match(gr, /speak\(libreRef\.current\s*\n?\s*\? tg\("sp\.arret"/, "la fin d'une séance cardio libre parle encore d'une durée et d'une zone");
  // Sans jalons, la voix se tairait tout le long : on annonce chaque kilomètre entier.
  assert.match(gr, /if \(entier > dernierKmDitRef\.current\)/, "la voix ne dit plus rien pendant une course libre");
  assert.match(gr, /tg\("sp\.kmLibre", \{ km: entier, p: formatPace\(paceMinKm\) \}\)/, "l'annonce du kilomètre libre ne donne plus l'allure tenue");
});

test("rien à envoyer à la montre en libre, et on le dit", () => {
  // Une séance planifiée chez intervals.icu a besoin d'une distance ou d'une durée.
  // Fabriquer un objectif que l'athlète n'a pas donné serait pire que de s'abstenir.
  const gr = codeNu(GR);
  assert.match(gr, /\{libre \? \(\s*\n?\s*<p className="max-w-\[16rem\][^>]*>\{d\["libre\.montre"\]\}<\/p>/, "le bouton « envoyer vers ma montre » est revenu en course libre");
});

test("les mots du mode libre existent dans les cinq langues", () => {
  const src = readFileSync(I18, "utf8");
  for (const k of ["md.objectif", "md.libre", "libre.valeur", "libre.bas", "libre.haut", "libre.explPace",
    "libre.explHr", "libre.zone", "libre.vma", "libre.montre", "lb.paceLibre", "lb.fcLibre",
    "lv.avgPace", "sp.kmLibre", "sp.startLibre", "sp.hrStartLibre"]) {
    const n = [...src.matchAll(new RegExp(`"${k.replace(/\./g, "\\.")}":`, "g"))].length;
    assert.equal(n, 5, `« ${k} » présent ${n} fois, attendu 5`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
