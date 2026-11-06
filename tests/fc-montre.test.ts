/**
 * LES BATTEMENTS SUR LA MONTRE, ET LE FOOTING COURU TROP VITE (07/11/2026).
 *
 * Cyprien : « pour la fréquence cardiaque, fais de même : ajuste s'il y a des différences trop
 * majeures lors des séances ». Mesuré sur son compte (FC max réellement atteinte 212, repos
 * 49 d'après sa Garmin) : des « Footing en endurance » courus à 164, 166 et 170 bpm, comptés
 * faciles par le plan (seuil « dur » à 85 % de la FC max = 180 bpm), et une montre qui ne
 * recevait que « Z1 HR / Z2 HR », les zones larges d'intervals.icu.
 *
 *   npx tsx tests/fc-montre.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { referencesFc, ciblesFcAthlete, footingTropIntense, plageFc, MARGE_FOOTING_DUR } from "../src/lib/coach/fcCible";
import { stepsForType, parseReps, buildWorkoutDescription } from "../src/lib/watch/intervals";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const code = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const REFS = referencesFc({ maxObservee: 212, repos: 49 });
// Ses footings d'octobre (FC moyennes), dont trois courus trop vite.
const FOOTINGS = [143, 145, 170, 164, 166, 144, 156, 142, 150, 153, 140];
const CIBLES = ciblesFcAthlete(REFS, FOOTINGS)!;

console.log("\nLES CIBLES — mesurées, personnelles, larges de 10 battements");

test("le compte de Cyprien : footing 143-153, récup 133-143, footing « dur » dès 167 bpm", () => {
  assert.deepEqual(plageFc("endurance", REFS), { lo: 152, hi: 162 }, "endurance théorique (réserve 66 %)");
  assert.deepEqual(CIBLES.endurance, { lo: 143, hi: 153 }, "la cible suit ses footings faciles, plus bas que la théorie");
  assert.deepEqual(CIBLES.recup, { lo: 133, hi: 143 }, "la récupération reste sous l'endurance");
  assert.equal(CIBLES.plafondFooting, 162 + MARGE_FOOTING_DUR);
});

test("sans FC max mesurée (âge seul), aucune cible : la montre garde ses zones", () => {
  assert.equal(ciblesFcAthlete(referencesFc({ age: 22 }), FOOTINGS), null);
  assert.equal(ciblesFcAthlete(referencesFc({}), FOOTINGS), null);
});

test("les footings trop rapides ne tirent pas la cible vers le haut", () => {
  const tousVite = ciblesFcAthlete(REFS, [170, 172, 168, 171, 169, 175, 173, 170, 168, 172])!;
  assert.deepEqual(tousVite.endurance, { lo: 152, hi: 162 }, "un coureur qui court tout trop vite garde la cible théorique");
});

console.log("\nLE FOOTING COURU TROP VITE COMPTE COMME UNE SÉANCE DURE");

test("170 bpm sur 30 min : dur ; 164 ou 166 : non ; 170 sur 15 min : non ; sans cibles : jamais", () => {
  assert.equal(footingTropIntense(170, 30 * 60, CIBLES), true, "le footing du 09/10 à 170 bpm");
  assert.equal(footingTropIntense(167, 30 * 60, CIBLES), true, "le plafond est inclus");
  assert.equal(footingTropIntense(166, 30 * 60, CIBLES), false);
  assert.equal(footingTropIntense(164, 60 * 60, CIBLES), false);
  assert.equal(footingTropIntense(170, 15 * 60, CIBLES), false, "une course de 15 min n'est pas une séance");
  assert.equal(footingTropIntense(170, 30 * 60, null), false);
  assert.equal(footingTropIntense(null, 30 * 60, CIBLES), false, "une FC absente n'est pas une FC de 0");
});

test("le coach range ce footing parmi les séances dures, sauf au palier gratuit", () => {
  const c = code("src/lib/ai/coachContext.ts");
  assert.match(c, /\|\| \(isRun\(w\.sport\) && footingTropIntense\(w\.avg_hr, w\.duration_seconds, ciblesFc\)\)/, "le footing trop intense ne compte plus comme dur");
  assert.match(c, /const ciblesFc: CiblesFc \| null = objectifSeul \? null : ciblesFcAthlete\(/, "le palier gratuit lit de nouveau la fréquence cardiaque");
  assert.ok(c.indexOf("const ciblesFc: CiblesFc") < c.indexOf("const isHardWk"), "les cibles doivent exister avant le classement des séances");
});

console.log("\nLA MONTRE REÇOIT DES BATTEMENTS");

const etapes = (type: string, ciblesFc: typeof CIBLES | null, toutEnAllure = false, detail = "", reps: ReturnType<typeof parseReps> = null, pace: number | null = 292) =>
  stepsForType(type, 50, 20.1, pace, 10, 10, reps, detail, toutEnAllure, ciblesFc) ?? "";

test("footing sur Garmin : échauffement et retour au calme 133-143 bpm, corps 143-153 bpm", () => {
  const s = etapes("Endurance", CIBLES);
  assert.match(s, /^- 10m 133-143bpm Échauffement$/m);
  assert.match(s, /^- \d+m 143-153bpm Endurance facile$/m);
  assert.match(s, /^- 10m 133-143bpm Retour au calme$/m);
  assert.doesNotMatch(s, /pace|Z\d HR/, "un footing mêle de nouveau allure ou zones larges");
});

test("sortie longue et récupération aussi ; sans cibles, rien ne change", () => {
  assert.match(etapes("Sortie longue", CIBLES), /143-153bpm Endurance facile/);
  assert.match(etapes("Récup", CIBLES), /133-143bpm Récup/);
  const sans = etapes("Endurance", null);
  assert.match(sans, /Z1 HR Échauffement/);
  assert.match(sans, /4:44-5:00 pace Endurance facile/, "sans cibles mesurées, le footing garde son allure");
});

test("séance de qualité : échauffement en battements, corps toujours à l'allure (10 s)", () => {
  const s = etapes("Seuil", CIBLES, false, "", null, 228);
  assert.match(s, /133-143bpm Échauffement/);
  assert.match(s, /3:43-3:53 pace Seuil/, "le corps d'une qualité n'est plus à l'allure");
  const r = parseReps("6×1000 m à 3'20/km, récup 2 min", null);
  const v = etapes("VMA", CIBLES, false, "", r, 200);
  assert.match(v, /3:15-3:25 pace/);
  assert.match(v, /133-143bpm Récup/, "les récups entre répétitions repassent en zone large");
});

test("hors Garmin (tout en allure), aucune étape en battements : mêler les deux y vide une étape", () => {
  const s = etapes("Endurance", CIBLES, true);
  assert.doesNotMatch(s, /bpm/);
});

test("le vélo garde ses zones : une FC de course n'est pas une FC de vélo", () => {
  assert.doesNotMatch(etapes("Vélo endurance", CIBLES), /bpm/);
});

test("de bout en bout : la séance du 11/11 partirait en battements sur sa Garmin", () => {
  const b = buildWorkoutDescription("Footing en endurance", "Échauffement 5 min progressif FC Z1→Z2 → Corps : ~3,5 km (environ 20 min) en Z2 (~5'43/km) → Retour au calme 5 min FC Z1.", "endurance Endurance Z2", "sub 16 min", 20.1, 15, 10, "Garmin", CIBLES);
  assert.ok(b);
  assert.match(b!.description, /^- 5m 133-143bpm Échauffement$/m);
  assert.match(b!.description, /^- 20m 143-153bpm Endurance facile$/m);
});

test("les quatre envois vers la montre passent les cibles", () => {
  assert.match(code("src/lib/ai/autoCoach.ts"), /objectiveRace, ctx\.vma, warmMin, coolMin, montre, ctx\.ciblesFc\)/);
  assert.match(code("src/app/api/admin/assign-session/route.ts"), /await litMontre\(\{ athleteId, apiKey \}\), await ciblesFcPour\(admin, user_id\)\)/);
  assert.match(code("src/app/api/admin/publish-plan/route.ts"), /warmMin, coolMin, montre, ciblesFc\)/);
  assert.match(code("src/app/api/admin/repush-watch/route.ts"), /warmMin, coolMin, montre, ciblesFc,/);
  assert.match(code("src/lib/coach/ciblesFcServeur.ts"), /if \(profil\.error \|\| base\.error \|\| fcMax\.error \|\| footings\.error\) return null;/, "une lecture ratée fabriquerait des cibles");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
