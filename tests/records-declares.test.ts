/**
 * RECORDS DÉCLARÉS — « mon record au semi est de 1 h 15, il date de 2024 ».
 *
 * L'historique de montre de Cyprien (intervals.icu) ne remonte qu'au 26/04/2025 : aucune
 * donnée ne contient ce semi. Seul l'athlète le connaît ; il le déclare, et la carte le
 * montre comme « Déclaré » — jamais comme une mesure, et sans rien piloter.
 *
 *   npx tsx tests/records-declares.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lireTemps, validerRecordDeclare, computeDistancePRs, BORNES_SECONDES, type RecordDeclare } from "../src/lib/dashboard/records";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const AUJ = "2026-09-28";
const semi1h19 = { date: "2026-08-24", distance_km: 21.126, duration_seconds: 4742 };

console.log("\n=== SAISIE ===\n");

test("le temps se lit sous les formes qu'on tape vraiment", () => {
  assert.equal(lireTemps("1:15:32"), 4532);
  assert.equal(lireTemps("1h15m32"), 4532);
  assert.equal(lireTemps("75:32"), 4532, "minutes:secondes au-delà de l'heure");
  assert.equal(lireTemps("16'07"), 967);
  assert.equal(lireTemps("1:75:00"), null, "75 minutes dans une heure : faute de frappe");
  assert.equal(lireTemps("abc"), null);
});

test("un record invraisemblable, futur ou sur une distance inconnue est refusé", () => {
  assert.ok(validerRecordDeclare({ distance: "semi", temps: "1:15:00", date: "2024-03-24" }, AUJ));
  assert.equal(validerRecordDeclare({ distance: "semi", temps: "0:50:00", date: "2024-03-24" }, AUJ), null, "plus rapide que le record du monde");
  assert.equal(validerRecordDeclare({ distance: "semi", temps: "1:15:00", date: "2026-09-29" }, AUJ), null, "un record de demain");
  assert.equal(validerRecordDeclare({ distance: "trail", temps: "1:15:00", date: "2024-03-24" }, AUJ), null);
  assert.equal(validerRecordDeclare({ distance: "5k", secondes: BORNES_SECONDES["5k"][1] + 1, date: "2024-03-24" }, AUJ), null);
  assert.equal(validerRecordDeclare({ distance: "semi", temps: "1:15:00", date: "2024-02-30" }, AUJ), null, "le 30 février se lirait « 1er mars »");
  const r = validerRecordDeclare({ distance: "semi", temps: "1:15:00", date: "2024-03-24", course: "  Semi   de Paris  " }, AUJ);
  assert.equal(r?.course, "Semi de Paris", "le nom de course est nettoyé");
});

console.log("\n=== AFFICHAGE ===\n");

test("le semi de 2024 déclaré en 1 h 15 remplace le 1 h 19 mesuré — et se dit « déclaré »", () => {
  const decl: RecordDeclare = { distance: "semi", secondes: 4500, date: "2024-03-24", course: "Semi de Paris" };
  const semi = computeDistancePRs([semi1h19], "fr", [decl]).find((r) => r.cle === "semi");
  assert.equal(semi?.time, "1h15");
  assert.equal(semi?.source, "declare", "un record saisi ne doit jamais passer pour une mesure de montre");
  assert.equal(semi?.course, "Semi de Paris");
});

test("un record déclaré MOINS bon que la mesure ne la masque pas ; à égalité, la mesure gagne", () => {
  const moinsBon = computeDistancePRs([semi1h19], "fr", [{ distance: "semi", secondes: 5000, date: "2024-03-24" }]).find((r) => r.cle === "semi");
  assert.equal(moinsBon?.source, "mesure");
  const egal = computeDistancePRs([semi1h19], "fr", [{ distance: "semi", secondes: 4742, date: "2024-03-24" }]).find((r) => r.cle === "semi");
  assert.equal(egal?.source, "mesure");
});

test("sans aucune séance mesurée, le record déclaré s'affiche seul", () => {
  const r = computeDistancePRs([], "fr", [{ distance: "marathon", secondes: 9600, date: "2023-10-15" }]);
  assert.deepEqual(r.map((x) => [x.cle, x.source]), [["marathon", "declare"]]);
});

console.log("\n=== ROUTE ET ÉCRAN ===\n");

test("la route valide AVANT d'écrire, et ne touche qu'aux lignes de l'athlète", () => {
  const src = codeNu("src/app/api/records/route.ts");
  const valide = src.indexOf("validerRecordDeclare(");
  const ecrit = src.search(/\.update\(\{ data: rec \}\)|\.insert\(\{ user_id/);
  assert.ok(valide > 0 && ecrit > valide, "une saisie non validée atteindrait la base");
  assert.equal((src.match(/\.eq\("user_id", user\.id\)/g) ?? []).length, 3, "lecture, mise à jour et suppression doivent filtrer par user_id");
  assert.match(src, /if \(eLecture\)/); assert.match(src, /if \(error\)/);
});

test("un record déclaré ne pilote rien : ni VMA, ni allures, ni plan", () => {
  for (const f of ["src/lib/ai/coachContext.ts", "src/lib/ai/autoPlan.ts", "src/lib/running/fitness.ts"]) {
    assert.doesNotMatch(codeNu(f), /record_declare|recordsDeclares/, `${f} lit les records déclarés`);
  }
  const page = codeNu("src/app/dashboard/page.tsx");
  assert.match(page, /recordsDeclares=\{recordsDeclares\}/);
  assert.doesNotMatch(page, /effectiveVma\([^)]*recordsDeclares/);
});

test("la carte marque « Déclaré » et propose de l'ajouter ou de le retirer", () => {
  const carte = codeNu("src/components/dashboard/BentoDashboard.tsx");
  assert.match(carte, /computeDistancePRs\(prWorkouts, lang, recordsDeclares\)/);
  assert.match(carte, /pr\.source === "declare" \?/);
  assert.match(carte, /t\("dash\.rec\.declare"\)/);
  assert.match(carte, /<AjoutRecord aujourdhui=\{jourAujourdhui\} \/>/);
  assert.match(carte, /fetch\(`\/api\/records\?distance=\$\{encodeURIComponent\(cle\)\}`, \{ method: "DELETE" \}\)/);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
