/**
 * « AUTOUR DE MOI » — les courses à portée de chez soi (demandé le 28/09/2026).
 *
 * Et le bouton qu'il remplace : « Géolocaliser », sur la carte des courses, ne localisait
 * PAS l'athlète — il lançait le géocodage de tout le catalogue (jusqu'à 300 requêtes
 * Nominatim, 5 min, écritures en base) depuis n'importe quel compte connecté.
 *
 *   npx tsx tests/courses-proximite.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  distanceKm, pointValide, distanceDeCourse, dansLeRayon, positionArrondie, kmArrondis, RAYONS_KM, RAYON_DEFAUT_KM,
} from "../src/lib/races/proximite";
import { RX } from "../src/components/races/racesI18n";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const LILLE = { lat: 50.6292, lon: 3.0573 };
const PARIS = { lat: 48.8566, lon: 2.3522 };
const BONDUES = { latitude: 50.7036, longitude: 3.0939 };

console.log("\n=== DISTANCES ===\n");

test("la distance à vol d'oiseau est juste (Lille → Paris ≈ 204 km)", () => {
  const d = distanceKm(LILLE, PARIS);
  assert.ok(d > 200 && d < 208, `${d.toFixed(1)} km`);
  assert.equal(distanceKm(LILLE, LILLE), 0);
});

test("une course sans coordonnées n'est jamais « proche »", () => {
  const p = { centre: LILLE, source: "gps" as const, rayonKm: 200 };
  assert.equal(dansLeRayon({ latitude: null, longitude: null }, p), false, "on affirmerait ce qu'on ignore");
  // Vérifié sur la fonction elle-même : depuis Lille, (0, 0) est hors de tout rayon de
  // toute façon, et le test passait sans rien prouver (mutation restée verte).
  assert.equal(pointValide(0, 0), null, "(0, 0) est un champ vide, pas le golfe de Guinée");
  assert.equal(distanceDeCourse({ latitude: 91, longitude: 3 }, LILLE), null);
  assert.equal(pointValide("50.6", "3.05")?.lat, 50.6, "les coordonnées arrivent parfois en texte");
});

test("le rayon filtre, et sans filtre tout passe", () => {
  assert.equal(dansLeRayon(BONDUES, { centre: LILLE, source: "gps", rayonKm: 10 }), true, "Bondues est à ~9 km de Lille");
  assert.equal(dansLeRayon(BONDUES, { centre: PARIS, source: "gps", rayonKm: 100 }), false);
  assert.equal(dansLeRayon({ latitude: null, longitude: null }, null), true, "filtre inactif : on ne retire rien");
});

test("les rayons proposés vont du quartier au week-end de course, 50 km par défaut", () => {
  assert.deepEqual([...RAYONS_KM], [10, 25, 50, 100, 200]);
  assert.ok((RAYONS_KM as readonly number[]).includes(RAYON_DEFAUT_KM));
});

test("la position d'entraînement quitte le serveur arrondie au km, jamais exacte", () => {
  assert.deepEqual(positionArrondie(50.629213, 3.057341), { lat: 50.63, lon: 3.06 });
  assert.equal(positionArrondie(null, 3), null);
  const page = codeNu("src/app/dashboard/races/page.tsx");
  assert.match(page, /positionEntrainement = positionArrondie\(/, "la page doit arrondir AVANT de transmettre");
  assert.doesNotMatch(page, /positionEntrainement=\{\{/, "aucune position brute transmise");
});

test("« à 12 km » : au km près jusqu'à 20 km, puis par 5", () => {
  assert.equal(kmArrondis(0.3), 1);
  assert.equal(kmArrondis(12.4), 12);
  assert.equal(kmArrondis(47), 45);
});

console.log("\n=== LISTE ET CARTE ===\n");

test("la liste ET la carte appliquent le même filtre, dont l'état vit dans la liste", () => {
  const hub = codeNu("src/components/races/RacesHub.tsx");
  assert.match(hub, /&& dansLeRayon\(r, proximite\);/, "la liste ne filtre pas par distance");
  assert.match(hub, /proximite=\{proximite\} onProximite=\{changerProximite\}/, "la carte recevrait un autre état que la liste");
  assert.match(hub, /<AutourDeMoi valeur=\{proximite\} onChange=\{changerProximite\}/, "le bouton manque dans la liste");
  const carte = codeNu("src/components/races/RacesMapView.tsx");
  // Ancré sur le filtre des PINS : le compteur par type porte la même condition, et un motif
  // commun aux deux restait satisfait quand l'un seul la perdait.
  assert.match(carte, /return matchType && matchesDateRange\(r\.date\) && dansLeRayon\(r, proximite\);/, "la carte ne filtre pas les pins par distance");
  assert.match(carte, /if \(matchesDateRange\(r\.date\) && dansLeRayon\(r, proximite\)\) \{ const t/, "les compteurs par type ignoreraient le rayon");
  assert.match(carte, /<AutourDeMoi valeur=\{proximite\} onChange=\{onProximite\}/, "le bouton manque sur la carte");
});

test("le tri reste chronologique à l'activation ; « les plus proches » départage par date", () => {
  const hub = codeNu("src/components/races/RacesHub.tsx");
  assert.match(hub, /if \(sort === "proche" && proximite\)/);
  assert.doesNotMatch(hub, /setSort\(\(t\) => \(t === "date" \? "proche"/, "trier d'office par distance mettait en tête les courses sans date de sa ville");
  assert.match(hub, /if \(!p\) setSort\(\(t\) => \(t === "proche" \? "date" : t\)\);/, "l'option disparaît avec le filtre : le tri doit revenir à la date");
  assert.match(hub, /kmArrondis\(da\)\) - \(db == null \? Infinity : kmArrondis\(db\)\)/, "à distance affichée égale, la date doit départager");
});

test("la position n'est demandée qu'au clic, et ne part vers aucun serveur", () => {
  const b = codeNu("src/components/races/AutourDeMoi.tsx");
  assert.doesNotMatch(b, /useEffect/, "une demande d'autorisation au chargement se refuse par réflexe — et le refus est mémorisé");
  assert.match(b, /const localiser = \(\) =>[\s\S]*getCurrentPosition/);
  assert.doesNotMatch(b, /fetch\(/, "la position de l'athlète n'a rien à faire sur le réseau");
});

test("le bouton « Géolocaliser » a disparu, et le géocodage est réservé à l'administration", () => {
  for (const f of ["src/components/races/RacesMapView.tsx", "src/components/races/RacesHub.tsx"]) {
    assert.doesNotMatch(codeNu(f), /\/api\/races\/geocode/, `${f} déclenche encore le géocodage du catalogue`);
  }
  const route = codeNu("src/app/api/races/geocode/route.ts");
  assert.equal((route.match(/await denyIfNotAdmin\(req\)/g) ?? []).length, 2, "POST et GET doivent être réservés à l'administration");
  assert.doesNotMatch(route, /denyIfAnonymous/);
});

test("les libellés existent dans les 5 langues, et les anciens ont disparu", () => {
  const cles = ["near.btn", "near.locating", "near.gps", "near.training", "near.denied", "near.deniedFallback", "near.radius", "near.clear", "near.at", "sort.near", "near.empty"];
  for (const l of ["fr", "en", "de", "es", "pt"]) {
    for (const k of cles) assert.ok(RX[l]?.[k], `${l} : « ${k} » manque`);
    for (const k of ["geolocate", "geocoding", "geo.ok", "geo.err"]) assert.equal(RX[l]?.[k], undefined, `${l} : « ${k} » est orphelin`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
