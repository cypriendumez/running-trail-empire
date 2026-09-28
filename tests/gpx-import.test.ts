/**
 * IMPORT GPX — une course importée doit COMPTER (records), et une seule fois.
 *
 * Relevé le 28/09/2026 : la route écrivait la séance sans `sport`, et la carte des records
 * ne lit que `sport = run`. Le semi en 1 h 15 de Cyprien (2024, absent d'intervals.icu)
 * serait resté invisible même importé. Et l'écran annonçait « GPX / FIT » à un serveur qui
 * refuse le FIT.
 *
 *   npx tsx tests/gpx-import.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sportDuGpx, idExterneGpx, VITESSE_MAX_COURSE_KMH } from "../src/lib/intervals/gpx";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const gpx = (type: string | null) => `<gpx><trk><name>Semi</name>${type == null ? "" : `<type>${type}</type>`}<trkseg></trkseg></trk></gpx>`;

console.log("\n=== IMPORT GPX ===\n");

test("le type écrit par Garmin Connect et par Strava est reconnu", () => {
  assert.equal(sportDuGpx(gpx("running"), 21.1, 4500), "run");
  assert.equal(sportDuGpx(gpx("trail_running"), 21.1, 9000), "run");
  assert.equal(sportDuGpx(gpx("9"), 21.1, 4500), "run", "Strava : 9 = course");
  assert.equal(sportDuGpx(gpx("cycling"), 21.1, 2400), "bike");
  assert.equal(sportDuGpx(gpx("1"), 21.1, 2400), "bike", "Strava : 1 = vélo");
  assert.equal(sportDuGpx(gpx("hiking"), 12, 14400), "hike");
  assert.equal(sportDuGpx(gpx("walking"), 5, 3600), "walk");
});

test("le TYPE prime sur la vitesse : un vélo lent reste un vélo", () => {
  assert.equal(sportDuGpx(gpx("cycling"), 10, 3600), "bike", "10 km/h à vélo compterait sinon comme une course");
});

test("sans type, la vitesse tranche — et sans vitesse, on ne devine pas", () => {
  assert.equal(sportDuGpx(gpx(null), 21.1, 4500), "run", "le semi de Cyprien : 1 h 15, ~16,9 km/h");
  assert.equal(sportDuGpx(gpx(null), 40, 3600), "bike");
  assert.equal(sportDuGpx(gpx(null), 22, 3600), "run", `${VITESSE_MAX_COURSE_KMH} km/h pile reste de la course`);
  assert.equal(sportDuGpx(gpx(null), 0, 0), null);
});

test("le même fichier donne le même identifiant ; deux sorties, deux identifiants", () => {
  assert.equal(idExterneGpx("2024-03-24T09:30:00Z"), idExterneGpx("2024-03-24T10:30:00+01:00"), "même instant, fuseaux différents");
  assert.notEqual(idExterneGpx("2024-03-24T09:30:00Z"), idExterneGpx("2024-03-24T09:30:01Z"));
  assert.equal(idExterneGpx(null), null);
  assert.equal(idExterneGpx("pas une date"), null);
});

test("la route écrit le sport et l'identifiant, et refuse un doublon AVANT d'écrire", () => {
  const src = codeNu("src/app/api/intervals/import-gpx/route.ts");
  assert.match(src, /\.\.\.\(sport \? \{ sport \} : \{\}\)/, "sans sport, la course n'entre pas dans les records");
  assert.match(src, /\.\.\.\(externalId \? \{ external_id: externalId \} : \{\}\)/);
  // Ancré sur le REFUS, pas sur la requête : chercher le doublon sans en tirer la
  // conséquence laissait passer la seconde importation (mutation restée verte).
  const doublon = src.search(/if \(deja\) return NextResponse\.json\(\{[^}]*\}, \{ status: 409 \}\)/);
  const ecriture = src.indexOf('.from("workouts").insert(');
  assert.ok(doublon > 0 && ecriture > doublon, "le doublon doit être vérifié avant l'insertion");
  assert.match(src, /\.eq\("user_id", user\.id\)\.eq\("external_id", externalId\)/, "le doublon se cherche chez CET athlète");
});

test("l'écran ne promet pas le FIT que le serveur refuse", () => {
  assert.doesNotMatch(codeNu("src/app/dashboard/sync/page.tsx"), /accept="[^"]*\.fit/);
  assert.doesNotMatch(readFileSync("src/app/dashboard/sync/syncI18n.tsx", "utf8"), /"gpx\.title": "[^"]*FIT/);
  assert.match(codeNu("src/app/api/intervals/import-gpx/route.ts"), /if \(ext !== "gpx"\)/, "si le serveur accepte un jour le FIT, rouvrir l'écran");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
