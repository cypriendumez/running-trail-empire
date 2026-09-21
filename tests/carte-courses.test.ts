/**
 * LA CARTE DES COURSES : TOUTES LES COURSES, ET UN FOND DE CARTE LISIBLE.
 *
 * Vu en production par Cyprien le 21/09/2026 :
 *  · « 90 pins · 90 courses » sur un catalogue de 17 482 courses à venir (17 475 avec
 *    coordonnées) : la carte copiait la liste UNE FOIS à l'ouverture, avant que le
 *    catalogue complet (5,9 Mo, ~4 s) ne soit arrivé ;
 *  · « API KEY REQUIRED » en filigrane sur toute la carte : CARTO exige désormais une clé
 *    pour ses tuiles Voyager, servies sans clé depuis le début.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiers(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(e)) acc.push(p);
  }
  return acc;
}

console.log("\n=== CARTE DES COURSES ===\n");

const CARTE = "src/components/races/RacesMapView.tsx";

test("la carte suit la liste reçue en props — elle ne se fige plus sur les 90 premières", () => {
  const src = codeNu(CARTE);
  assert.match(src, /useEffect\(\(\) => \{ setRaces\(initialRaces\); \}, \[initialRaces\]\)/,
    "la carte copie la liste une seule fois : ouverte avant l'arrivée du catalogue, elle reste à ~90 pins");
});

test("aucune tuile CARTO nulle part : elles sont filigranées « API KEY REQUIRED »", () => {
  const coupables = fichiers("src").filter((f) => /basemaps\.cartocdn\.com/.test(codeNu(f)));
  assert.deepEqual(coupables, [], `tuiles CARTO encore utilisées : ${coupables.join(", ")}`);
});

test("le fond de carte est MapTiler avec la clé du projet, à la bonne taille, et OSM en repli", () => {
  const src = codeNu(CARTE);
  assert.match(src, /process\.env\.NEXT_PUBLIC_MAPTILER_KEY/, "la clé MapTiler n'est plus lue");
  const i = src.indexOf("api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER}");
  assert.ok(i > 0, "les tuiles MapTiler streets-v2 ne sont plus utilisées");
  // Tuiles de 512 px : sans ces deux options Leaflet les affiche deux fois trop grandes.
  assert.match(src.slice(i, i + 200), /tileSize: 512, zoomOffset: -1/, "tuiles 512 px servies comme du 256 px : libellés géants");
  assert.match(src, /tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/, "sans clé MapTiler, la carte n'aurait aucun fond");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
