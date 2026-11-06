/**
 * « ~?/km » N'EST PAS UNE ALLURE (07/11/2026). Sans VMA, les gabarits des séances de qualité
 * écrivaient « 16 min d'un bloc à ~?/km ». On écrit « au ressenti (allure à chiffrer avec un
 * test VMA) », dans les 5 langues, sans jamais toucher une vraie question.
 *
 *   npx tsx tests/allure-inconnue.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sansAllureInconnue } from "../src/lib/coach/allureInconnue";
import { QUALITE_T } from "../src/lib/ai/qualityI18n";
import { ALL_LANGS } from "../src/lib/i18n/multi";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}

test("la séance au seuil relevée sur le plan gratuit : « à ~?/km » devient « au ressenti »", () => {
  const t = "Corps : Seuil continu (SOUS-seuil) : 16 min d'un bloc à ~?/km → le plus exigeant mentalement";
  assert.equal(sansAllureInconnue(t, "fr"), "Corps : Seuil continu (SOUS-seuil) : 16 min d'un bloc au ressenti (allure à chiffrer avec un test VMA) → le plus exigeant mentalement");
  assert.match(sansAllureInconnue("16 min in one block at ~?/km", "en"), /by feel \(pace to be set with a VO₂max test\)$/);
  assert.equal(sansAllureInconnue("16 Min am Stück zu ~?/km", "de"), "16 Min am Stück nach Gefühl (Tempo per vVO₂max-Test bestimmen)", "la préposition reste devant « nach Gefühl »");
  assert.equal(sansAllureInconnue("5×400 m a ~?/km, rec 45 s", "es"), "5×400 m por sensaciones (ritmo a fijar con un test de VAM), rec 45 s");
  assert.equal(sansAllureInconnue("Block bei ~?/km", "de"), "Block nach Gefühl (Tempo per vVO₂max-Test bestimmen)");
});

test("aucun gabarit des 5 langues ne garde de « ? » d'allure quand la VMA manque", () => {
  let vus = 0;
  for (const l of ALL_LANGS) {
    for (const [cle, f] of Object.entries((QUALITE_T as Record<string, Record<string, unknown>>)[l])) {
      if (typeof f !== "function") continue;
      const args = Array.from({ length: (f as (...a: unknown[]) => string).length }, (_, i) => (i === 0 ? 5 : "?"));
      let t: string; try { t = (f as (...a: unknown[]) => string)(...args); } catch { continue; }
      if (!t.includes("?")) continue;
      vus++;
      assert.doesNotMatch(sansAllureInconnue(t, l), /~\?|\?\/km/, `${l} ${cle} : ${sansAllureInconnue(t, l).slice(0, 120)}`);
    }
  }
  assert.ok(vus >= 50, `${vus} gabarits seulement — le test ne voit plus les séances`);
});

test("une vraie question n'est jamais touchée ; une vraie allure non plus", () => {
  for (const t of ["Tu le sens ?", "Pourquoi cette séance ?", "Ritmo ? No.", "6×1000 m à ~3'20/km, récup 2 min"])
    assert.equal(sansAllureInconnue(t, "fr"), t, t);
});

test("le coach passe chaque séance de qualité par ce filtre", () => {
  const c = readFileSync("src/lib/ai/coachContext.ts", "utf8");
  assert.match(c, /const descAll = tr\(\(l\) => sansAllureInconnue\(gabarit\(l\), l\)\);/);
  assert.match(c, /matin: tr\(\(l\) => sansAllureInconnue\(seanceDoubleSeuil\("matin"/);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
