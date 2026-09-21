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

test("la liste des courses est dense et sur deux colonnes en large — sauf quand un détail est ouvert", () => {
  // Cyprien, 21/09/2026 : « trouve un moyen de voir plus de courses ». Mesuré à 1440 px :
  // 4 courses visibles avant, 10 après.
  const hub = codeNu("src/components/races/RacesHub.tsx");
  assert.match(hub, /\$\{selected \? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"\}/,
    "la liste n'est plus sur deux colonnes en large (ou le reste quand le panneau de détail est ouvert)");
  assert.match(hub, /bento-card cursor-pointer !p-4 !rounded-2xl/, "les cartes ont repris leurs marges de 24 px : quatre courses par écran");
  // ⚠️ `col-span-2` sur la pagination CRÉAIT une deuxième colonne implicite même en
  // `grid-cols-1` (vu en local : carte sélectionnée écrasée à 193 px). `col-span-full`
  // s'adapte au nombre de colonnes déclarées.
  assert.ok(!/xl:col-span-2/.test(hub), "col-span-2 est revenu : il fabrique une colonne fantôme quand le panneau est ouvert");
  assert.equal([...hub.matchAll(/col-span-full/g)].length, 2, "la pagination et l'état vide ne couvrent plus toutes les colonnes");
  // Et sur téléphone, le compteur + le bouton Carte passent sous la recherche au lieu de sortir de l'écran.
  assert.match(hub, /<div className="flex flex-wrap items-center gap-3 mb-3">/, "l'entête de recherche ne se replie plus sur téléphone : le bouton Carte sort de l'écran");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
