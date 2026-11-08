/**
 * LA CARTE « VITESSE & PRÉDICTIONS » DIT D'OÙ VIENT SA VMA.
 *
 * Cyprien, 28/09/2026 : « est-ce que ça se met régulièrement à jour ? ». Oui — la VMA est
 * recalculée à chaque affichage (séances des 120 derniers jours, courbe d'allure de 42 j,
 * VO2max) — mais rien ne le montrait : « 19,8 km/h · VMA estimée », sans date ni source.
 * C'était son semi de Lambersart du 24/08, relu à 23,9 °C.
 *
 *   npx tsx tests/accueil-vma.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { meilleurEffort, bestVmaFromWorkouts } from "../src/lib/running/fitness";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
// Dates RELATIVES : un test daté en dur cesse de passer le jour où la séance sort de la fenêtre.
const ilYa = (j: number) => new Date(Date.now() - j * 86400000).toISOString().slice(0, 10);

console.log("\n=== LA VMA DE L'ACCUEIL ===\n");

test("la séance qui donne la VMA est nommée : sa date et sa distance", () => {
  const semi = { date: ilYa(35), distance_km: 21.126, duration_seconds: 4742, avg_hr: 182, weather_temp_c: 23.9 };
  // Un 5 km RAPIDE mais à FC basse (descente, GPS qui saute) : s'il comptait, il battrait
  // le semi. Le filtre « ≥ 85 % de la FC max » doit l'écarter — c'est ce qui est vérifié.
  const faux = { date: ilYa(2), distance_km: 5, duration_seconds: 900, avg_hr: 150, weather_temp_c: 15 };
  const e = meilleurEffort([faux, semi], 209);
  assert.equal(e?.date, semi.date, "un effort sous 85 % de la FC max n'est pas un effort maximal");
  assert.equal(e?.distanceKm, 21.126);
  assert.ok(e && e.vma > 19 && e.vma < 20.5, `VMA ${e?.vma}`);
});

test("une seule recherche : l'ancienne fonction rend exactement la même VMA", () => {
  const w = [{ date: ilYa(10), distance_km: 10, duration_seconds: 2100, avg_hr: 185 }];
  assert.equal(bestVmaFromWorkouts(w, 209), meilleurEffort(w, 209)?.vma);
});

test("la carte suit la forme : un effort de plus de 120 jours ne compte plus", () => {
  assert.equal(meilleurEffort([{ date: ilYa(121), distance_km: 21.1, duration_seconds: 4500, avg_hr: 185 }], 209), null);
});

test("la page transmet la source, et la carte l'affiche", () => {
  // Depuis le 04/10/2026, le calcul vit dans lib/dashboard/vmaAffichee (partagé avec la
  // page détaillée) : c'est LÀ que la VMA et sa source doivent venir du même effort.
  assert.match(codeNu("src/lib/dashboard/vmaAffichee.ts"), /fromRuns: effort\?\.vma \?\? null/, "la VMA et sa source viendraient de deux recherches différentes");
  const page = codeNu("src/app/dashboard/page.tsx");
  assert.match(page, /const \{ vma: currentVma, source: sourceVma \} = vmaAffichee\(\{/);
  assert.match(page, /sourceVma=\{sourceVma\}/);
  const carte = codeNu("src/components/dashboard/BentoDashboard.tsx");
  for (const k of ["dash.vma.src.seances", "dash.vma.src.test", "dash.vma.src.courbe", "dash.vma.src.vo2max", "dash.vma.maj"]) {
    assert.ok(carte.includes(`t("${k}"`), `la carte n'affiche pas « ${k} »`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
