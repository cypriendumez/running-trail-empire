/**
 * LES PRÉDICTIONS DE CHRONO ET LA VMA « SÉANCES » — modèle de Daniels & Gilbert (02/10/2026).
 *
 * Cyprien : « corrige mes vitesses de prédiction, c'est faux ». Son tableau de bord
 * annonçait VMA 21,4 km/h, 5 km 14'55, 10 km 31'09, semi 1h11, marathon 2h37 — pour un
 * record de semi à 1h15. Deux causes : un barème de % de VMA en MARCHES (23,7 km divisés
 * par 0,79 au lieu de ~0,82, d'où 21,4) et une pente de barème qui gonflait les courtes
 * distances. Le modèle VDOT, validé ici contre les tables publiées, remplace le barème.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { vdotDe, tempsPourVdot, vdotDeVma, vmaDeVdot, facteurSocle, preparationLongue, PENALITE_SOCLE_MARATHON } from "../src/lib/running/vdot";
import { vmaFromEffort, predictRaceSec, racePredictions, dureeEnConditionsNeutres, meilleurEffort } from "../src/lib/running/fitness";
import { socleDesSeances } from "../src/lib/dashboard/forme";

let ok = 0, ko = 0;
function test(nom: string, f: () => void) {
  try { f(); ok++; console.log(`  ✓ ${nom}`); } catch (e) { ko++; console.error(`  ✗ ${nom}\n    ${(e as Error).message}`); }
}
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const hms = (h: number, m: number, s: number) => h * 3600 + m * 60 + s;

console.log("\nMODÈLE — fidèle aux tables publiées de Daniels");
test("VDOT 50 et 60 : 5 km, 10 km, semi et marathon à 0,1 % des tables (≤ 11 s sur 3h10)", () => {
  const TABLES: [number, number[]][] = [
    [50, [hms(0, 19, 57), hms(0, 41, 21), hms(1, 31, 35), hms(3, 10, 49)]],
    [60, [hms(0, 17, 3), hms(0, 35, 22), hms(1, 18, 9), hms(2, 43, 25)]],
  ];
  for (const [vdot, temps] of TABLES) {
    [5, 10, 21.0975, 42.195].forEach((km, i) => {
      const t = tempsPourVdot(vdot, km);
      // Les tables publiées arrondissent leurs propres calculs : la tolérance est relative.
      assert.ok(Math.abs(t - temps[i]) <= Math.max(5, temps[i] * 0.001), `VDOT ${vdot}, ${km} km : ${Math.round(t)} s au lieu de ${temps[i]} s`);
    });
  }
});

test("VDOT ↔ performance et VDOT ↔ VMA : allers-retours exacts", () => {
  for (const vdot of [35, 50, 63, 75]) {
    for (const km of [3, 10, 42.195]) assert.ok(Math.abs(vdotDe(km, tempsPourVdot(vdot, km))! - vdot) < 0.01);
    assert.ok(Math.abs(vdotDeVma(vmaDeVdot(vdot)!)! - vdot) < 0.01);
  }
});

test("hors du domaine du modèle : rien plutôt qu'un chiffre faux", () => {
  assert.equal(vdotDe(0.4, 75), null, "un 400 m (75 s) est anaérobie : hors modèle");
  assert.equal(vdotDe(10, 0), null);
  assert.equal(vdotDe(10, 60), null, "600 km/h");
  assert.equal(vdotDe(Number.NaN, 1800), null);
  assert.equal(tempsPourVdot(0, 10), 0);
  assert.equal(tempsPourVdot(50, -1), 0);
  assert.equal(predictRaceSec(0, 10), 0);
  assert.equal(vmaDeVdot(-3), null);
});

console.log("\nLE CAS RÉEL — Cyprien, 02/10/2026");
test("23,7 km à 3'45/km par 27 °C : VMA 20,1 km/h, plus 21,4", () => {
  const sec = dureeEnConditionsNeutres(5345, 23.717, 27.4, 1);
  assert.equal(vmaFromEffort(23.717, sec), 20.1);
  const best = meilleurEffort([{ date: new Date().toISOString().slice(0, 10), distance_km: 23.717, duration_seconds: 5345, avg_hr: 181, weather_temp_c: 27.4, type: "easy" }], 207);
  assert.equal(best?.vma, 20.1);
});

test("son record de semi (1h15) se relit à 19,9 km/h et se reprédit à 1h15", () => {
  const vma = vmaFromEffort(21.0975, hms(1, 15, 0))!;
  assert.equal(vma, 19.9);
  assert.ok(Math.abs(predictRaceSec(vma, 21.0975) - hms(1, 15, 0)) <= 25);
});

test("plus de 5 km en 14'55 : les courtes distances restent cohérentes avec le semi", () => {
  const [cinq, dix, semi] = racePredictions(20.1).map((p) => p.time);
  assert.equal(cinq, "16:11");
  assert.equal(dix, "33:36");
  assert.equal(semi, "1h14");
  // Rapport d'allure 5 km / semi : ~1,087 chez Daniels — l'ancien barème donnait 1,13.
  const r = (predictRaceSec(20.1, 21.0975) / 21.0975) / (predictRaceSec(20.1, 5) / 5);
  assert.ok(r > 1.06 && r < 1.10, `rapport ${r.toFixed(3)}`);
});

test("le marathon tient compte du socle réel : 2h40 pour 26 km de sortie longue et 84 km/sem", () => {
  const avec = racePredictions(20.1, { sortieLongueKm: 25.9, volumeHebdoKm: 84 })[3].time;
  const sans = racePredictions(20.1)[3].time;
  assert.equal(avec, "2h40");
  assert.equal(sans, "2h44");
});

console.log("\nCONTINUITÉ — plus de marches d'escalier");
test("même allure, 500 m de plus : la VMA lue évolue sans marche d'escalier", () => {
  // Sans arrondi : on mesure le modèle, pas l'affichage au dixième.
  const lue = (d: number, kmh: number) => vmaDeVdot(vdotDe(d, (d / kmh) * 3600)!)!;
  for (const kmh of [12, 15, 17]) {
    for (let d = 3; d <= 40; d += 0.5) {
      const a = lue(d, kmh), b = lue(d + 0.5, kmh);
      // La courbe est plus pentue sur les efforts courts (physiologie), jamais en saut.
      assert.ok((b - a) / a <= 0.015, `${d} → ${d + 0.5} km à ${kmh} km/h : ${a.toFixed(2)} → ${b.toFixed(2)}`);
      assert.ok(b >= a, "courir plus longtemps à la même allure ne peut pas révéler une VMA plus basse");
    }
    // Aux anciennes marches (11, 22, 30 km), l'ancien barème sautait de 5 à 8 %.
    for (const d of [10.9, 21.9, 29.9]) {
      const saut = (lue(d + 0.6, kmh) - lue(d, kmh)) / lue(d, kmh);
      assert.ok(saut < 0.006, `${d} km → ${d + 0.6} km à ${kmh} km/h : +${(saut * 100).toFixed(2)} %`);
    }
  }
});

test("une distance plus longue se court toujours plus lentement", () => {
  let prec = Infinity;
  for (let km = 3; km <= 42.2; km += 0.7) {
    const v = km / predictRaceSec(18, km);
    assert.ok(v < prec, `${km} km plus rapide que la distance précédente`);
    prec = v;
  }
});

console.log("\nSOCLE D'ENDURANCE");
test("le socle ne touche que ce qui dépasse le semi, et plafonne à 6 % sur marathon", () => {
  for (const km of [5, 10, 21.0975]) assert.equal(facteurSocle(km, null), 1);
  assert.equal(facteurSocle(42.195, null), 1 + PENALITE_SOCLE_MARATHON);
  assert.equal(facteurSocle(42.195, { sortieLongueKm: 35, volumeHebdoKm: 110 }), 1);
  assert.ok(facteurSocle(30, null) > 1 && facteurSocle(30, null) < facteurSocle(42.195, null));
});

test("un nombre seul est la plus longue sortie (forme historique de l'argument)", () => {
  assert.equal(predictRaceSec(20, 42.195, 32), predictRaceSec(20, 42.195, { sortieLongueKm: 32 }));
  assert.notEqual(predictRaceSec(20, 42.195, 32), predictRaceSec(20, 42.195, { volumeHebdoKm: 32 }));
});

test("le maillon faible décide : un gros volume ne remplace pas la sortie longue", () => {
  assert.equal(preparationLongue({ sortieLongueKm: 21, volumeHebdoKm: 140 }), 0);
  assert.equal(preparationLongue({ sortieLongueKm: 32, volumeHebdoKm: 40 }), 0);
  assert.equal(preparationLongue({ sortieLongueKm: 32 }), 1);
  assert.equal(preparationLongue(null), 0, "rien de connu : on ne suppose rien de favorable");
});

test("le socle se lit dans les séances : plus longue course de 6 semaines, vélo exclu", () => {
  const j = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const seances = [
    { date: j(2), sport: "Run", distance_km: 25.9 },
    { date: j(3), sport: "Ride", distance_km: 80 },
    { date: j(60), sport: "Run", distance_km: 33 },
    ...Array.from({ length: 30 }, (_, i) => ({ date: j(i * 2 + 1), sport: "Run", distance_km: 12 })),
  ];
  const s = socleDesSeances(seances as never);
  assert.equal(s.sortieLongueKm, 25.9);
  assert.ok((s.volumeHebdoKm ?? 0) > 0);
});

console.log("\nBRANCHEMENTS — le même socle partout où un marathon est prédit");
test("tableau de bord, score de forme et nutrition du coach lisent le socle réel", () => {
  assert.match(code("src/components/dashboard/BentoDashboard.tsx"), /racePredictions\(currentVma, socleDesSeances\(workouts\)\)/);
  assert.match(code("src/lib/dashboard/forme.ts"), /raceProjection\(currentVma, raceKm, objectif\.targetSeconds, null, null, \{ sortieLongueKm: longest \|\| null, volumeHebdoKm: cibleVolumeKm \}\)/);
  const f = code("src/lib/running/fitness.ts");
  assert.doesNotMatch(f, /function pctVmaBrut|return 0\.83;|return 0\.79;/, "le barème en escalier est revenu");
  assert.match(f, /return tempsPourVdot\(vdot, distanceKm\) \* facteurSocle\(distanceKm, socleDe\(socle\)\);/);
});

console.log(`\n${ok} test(s) de prédiction passé(s), ${ko} échec(s)`);
if (ko) process.exit(1);
