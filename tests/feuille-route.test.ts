/**
 * LA FEUILLE DE ROUTE JUSQU'AU JOUR J — semaine de course et affûtage.
 *
 * Relevé le 28/09/2026 sur le marathon de Lille de Cyprien : la feuille de route omettait
 * la SEMAINE DE COURSE (arrondi vers le bas de `weeksToRace`), si bien que la semaine la
 * plus légère tombait à J−13 et que la vraie semaine de course remontait à −35 % ; et
 * l'affûtage coupait la sortie longue à 20 % du volume dès J−20 (10 km puis 8 km pour un
 * bloc à 26 km).
 *
 *   npx tsx tests/feuille-route.test.ts
 */
import assert from "node:assert/strict";
import { partAffutage } from "../src/lib/coach/phase";
import { readFileSync } from "node:fs";
import { longRunForWeek } from "../src/lib/running/volume";
import { lireUsage } from "../src/lib/ai/gemini";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

console.log("\n=== FEUILLE DE ROUTE ===\n");

test("la feuille de route compte la semaine de course, et l'affûtage descend jusqu'au bout", () => {
  const src = codeNu("src/lib/ai/coachContext.ts");
  assert.match(src, /const semainesAvecCourse = Math\.floor\(daysToRace \/ 7\) \+ 1;/);
  assert.match(src, /const W = Math\.min\(semainesAvecCourse, 26\);/);
  // Depuis le 05/11/2026, la marche-course n'a pas de feuille de route (le programme en tient lieu).
  assert.match(src, /if \(daysToRace == null \|\| daysToRace < 0 \|\| !vma \|\| marcheCourse\) return \[\];/, "la semaine de course (0 à 6 jours) n'aurait pas de feuille de route");
  // Les parts d'affûtage vivent dans `lib/coach/phase` depuis qu'elles dépendent de la distance
  // (05/11/2026) : la feuille de route doit les lire là, et elles doivent descendre jusqu'au bout.
  assert.match(src, /const partTaper = partAffutage\(wkUntil, objective\?\.distanceKm\);/, "la feuille de route ne lit plus les parts d'affûtage");
  for (const d of [42.2, 21.1, 5]) {
    const parts = [2, 1, 0].map((s) => partAffutage(s, d)).filter((x): x is number => x != null);
    assert.ok(parts.length >= 1 && parts.every((x, i) => i === 0 || x < parts[i - 1]), `affûtage non décroissant pour ${d} km : ${parts.join(" → ")}`);
  }
});

test("l'affûtage garde une sortie longue en DÉCRUE depuis la plus longue du bloc (Lille : 26 → 20 → 14)", () => {
  const j20 = longRunForWeek({ weekIndex: 1, weeksToPeak: 1, current: 23, peak: 32, weeklyKm: 50, share: 0.35, taper: true, semainesAvantCourse: 2, reference: 26 });
  const j13 = longRunForWeek({ weekIndex: 2, weeksToPeak: 1, current: 23, peak: 32, weeklyKm: 39, share: 0.35, taper: true, semainesAvantCourse: 1, reference: 26 });
  assert.equal(j20, 20, "75 % de 26 km à J−20 (il était de 10 km)");
  assert.equal(j13, 14, "55 % de 26 km à J−13 (il était de 8 km)");
  assert.ok(26 > j20 && j20 > j13, "la sortie longue doit décroître, pas s'effondrer ni remonter");
  assert.equal(longRunForWeek({ weekIndex: 1, weeksToPeak: 1, current: 30, peak: 32, weeklyKm: 25, share: 0.35, taper: true, semainesAvantCourse: 2, reference: 30 }), 13);
  assert.equal(longRunForWeek({ weekIndex: 1, weeksToPeak: 1, current: 30, peak: 32, weeklyKm: 50, share: 0.35, taper: true }), 10);
});

test("la feuille de route transmet la référence d'affûtage et ne pose rien en semaine de course", () => {
  const src = codeNu("src/lib/ai/coachContext.ts");
  assert.match(src, /const longRunPrevuSemaine = wkUntil <= 0 \? 0 : longRunForWeek\(/);
  assert.match(src, /semainesAvantCourse: wkUntil, reference: Math\.max\(lrCurrent, longueDuBloc\)/);
  assert.match(src, /if \(ph !== "Affûtage"\) longueDuBloc = Math\.max\(longueDuBloc, longRunKm\);/);
});

console.log("\n=== MESURE DES JETONS ===\n");

test("la consommation réelle est lue telle que Google la compte", () => {
  assert.deepEqual(lireUsage({ promptTokenCount: 10560, candidatesTokenCount: 323, thoughtsTokenCount: 217, cachedContentTokenCount: 10202 }),
    { entree: 10560, sortie: 323, raisonnement: 217, cache: 10202 });
  assert.deepEqual(lireUsage({ promptTokenCount: 5 }), { entree: 5, sortie: 0, raisonnement: 0, cache: 0 });
  assert.equal(lireUsage(null), undefined);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
