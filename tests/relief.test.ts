/**
 * LA VUE RELIEF — ce que ses garde-fous protègent.
 *
 * ⚠️ CHAQUE SOURCE DE CE CATALOGUE A ÉTÉ INTERROGÉE POUR DE VRAI avant d'être écrite :
 * MapTiler (relief et satellite), IGN (plan, ortho, inclinaison des pentes), swisstopo,
 * USGS, IGN Espagne, BKG Allemagne, Waymarked Trails. Un fond cassé ne lève AUCUNE
 * erreur — il laisse un carré gris — donc rien ne remplacerait ce contrôle.
 *
 * ⚠️ ET « IGN Topo 25 » N'EST PAS LÀ, VOLONTAIREMENT. La Géoplateforme répond 400 :
 * c'est une donnée sous licence payante. Les applications qui l'affichent l'ont achetée.
 * L'ajouter serait promettre ce qu'on n'a pas, et l'afficher serait l'utiliser sans droit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FONDS, CALQUES, TRACES, RELIEF, PALIERS_PENTE,
  avecCle, disponibles, attributionDe,
} from "../src/lib/trail/couches";
import { R, texteRelief } from "../src/components/trail/relief3dI18n";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}
const TOUTES = [...FONDS, ...CALQUES, ...TRACES];
const VUE = "src/components/trail/Relief3D.tsx";

console.log("\nLE CATALOGUE");

test("chaque source porte son attribution — c'est une obligation de licence", () => {
  // IGN, swisstopo, USGS et l'ODbL des traces l'exigent. Une carte sans attribution est
  // une carte utilisée sans droit.
  for (const s of TOUTES) {
    assert.ok(s.attribution && s.attribution.trim().length > 3, `${s.id} n'a pas d'attribution`);
  }
  const jointe = attributionDe([FONDS[0], TRACES[0]]);
  assert.ok(jointe.includes("MapTiler") && jointe.includes("ODbL"),
    `attribution incomplète : ${jointe}`);
  // Dédoublonnée : trois traces Waymarked ne doivent pas écrire trois fois la même ligne.
  assert.equal(attributionDe([TRACES[0], TRACES[1], TRACES[2]]).split(" · ").length, 1);
});

test("les traces disent leur licence ODbL, dans les cinq langues", () => {
  for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
    assert.match(R[lg]["trace.licence"], /ODbL/, `licence absente en « ${lg} »`);
  }
  for (const s of TRACES.filter((x) => x.url.includes("waymarkedtrails"))) {
    assert.match(s.attribution, /ODbL/, `${s.id} n'annonce pas sa licence`);
  }
});

test("aucune source payante ne s'est glissée dans le catalogue", () => {
  // SCAN 25 / « Topo 25 » : la Géoplateforme répond 400, c'est sous licence.
  for (const s of TOUTES) {
    assert.ok(!/GEOGRAPHICALGRIDSYSTEMS\.MAPS\b/.test(s.url), `${s.id} appelle le SCAN 25, qui est payant`);
    assert.ok(s.url.startsWith("https://"), `${s.id} n'est pas servi en HTTPS`);
  }
});

test("la clé n'est jamais écrite en dur dans une URL", () => {
  const src = codeOf("src/lib/trail/couches.ts");
  // Une clé recopiée dans le fichier partirait dans le dépôt public et dans le bundle.
  assert.ok(!/key=[A-Za-z0-9]{8,}/.test(src), "une clé cartographique est écrite en dur");
  assert.equal(avecCle("https://x/{z}?key={cleMapTiler}", undefined), null,
    "sans clé, l'URL doit être refusée — pas servie avec un trou dedans");
  assert.equal(avecCle("https://x/{z}?key={cleMapTiler}", "ABC"), "https://x/{z}?key=ABC");
  assert.equal(avecCle("https://sans-cle/{z}", undefined), "https://sans-cle/{z}",
    "une source qui n'a pas besoin de clé doit rester utilisable");
});

test("sans clé MapTiler, les sources qui en dépendent disparaissent", () => {
  const avec = disponibles(FONDS, "ABC").length;
  const sans = disponibles(FONDS, undefined).length;
  assert.ok(sans < avec, "une source qui exige une clé est proposée alors qu'elle ne peut pas fonctionner");
  assert.ok(sans >= 4, `${sans} fonds sans clé : il doit rester de quoi travailler`);
  assert.ok(!disponibles(FONDS, undefined).some((f) => f.besoinCle), "un fond à clé a survécu au filtre");
});

test("les tailles de tuile suivent le fournisseur", () => {
  // 512 chez MapTiler, 256 partout ailleurs : se tromper décale la carte d'un facteur
  // deux, sans qu'aucune erreur ne le signale.
  for (const s of TOUTES) {
    const attendu = s.url.includes("api.maptiler.com") ? 512 : 256;
    assert.equal(s.taille, attendu, `${s.id} : ${s.taille} px pour un fournisseur en ${attendu}`);
  }
});

test("les paliers d'inclinaison couvrent la montagne sans trou", () => {
  // Ce sont des seuils de sécurité : le risque d'avalanche devient significatif à 30°.
  assert.equal(PALIERS_PENTE[0].min, 30, "le premier palier ne commence plus à 30°");
  assert.equal(PALIERS_PENTE.at(-1)!.max, 90);
  for (let i = 1; i < PALIERS_PENTE.length; i++) {
    assert.equal(PALIERS_PENTE[i].min, PALIERS_PENTE[i - 1].max, "un intervalle d'inclinaison manque");
  }
  for (const p of PALIERS_PENTE) assert.match(p.couleur, /^#[0-9A-Fa-f]{6}$/);
});

console.log("\nLA VUE");

test("le relief est ajouté APRÈS le style, jamais dedans", () => {
  // ⚠️ MESURÉ À L'ÉCRAN. Déclarer la source `raster-dem` dans le style initial empêchait
  // ce style de finir de charger : cadre blanc, aucune couche, aucune erreur.
  const src = codeOf(VUE);
  const style = src.slice(src.indexOf("function construireStyle"), src.indexOf("export function Relief3D"));
  assert.ok(!/raster-dem/.test(style), "la source de relief est revenue dans le style initial");
  assert.match(src, /map\.addSource\("relief", \{ type: "raster-dem"/, "le relief n'est plus ajouté du tout");
});

test("la carte ne dépend d'aucun événement de chargement", () => {
  // `load`, `loaded()` et `isStyleLoaded()` ne passent JAMAIS à vrai dans ce navigateur —
  // vérifié sur une page de diagnostic pendant que les tuiles s'affichaient. S'y fier,
  // c'est afficher un voile de chargement pour toujours par-dessus une carte qui marche.
  const src = codeOf(VUE);
  assert.ok(!/if \([^)]*isStyleLoaded\(\)[^)]*\) return/.test(src),
    "la vue attend de nouveau un état de chargement qui n'arrive jamais");
  assert.match(src, /map\.on\("sourcedata", poserTerrain\)/, "le relief n'est plus reposé au fil des données");
});

test("le conteneur a une hauteur explicite", () => {
  // ⚠️ `absolute inset-0` NE MARCHE PAS : la feuille de MapLibre déclare
  // `.maplibregl-map { position: relative }` et gagne à spécificité égale — le conteneur
  // s'effondre à zéro pixel de haut, tuiles pourtant demandées, cadre blanc.
  const src = readFileSync(VUE, "utf8");
  assert.match(src, /ref=\{boite\} style=\{\{ width: "100%", height: "100%" \}\}/,
    "le conteneur de la carte n'a plus de hauteur explicite");
  assert.ok(!/ref=\{boite\}[^>]*absolute inset-0/.test(src), "le positionnement absolu est revenu");
});

test("la carte est redimensionnée plusieurs fois après le montage", () => {
  const src = codeOf(VUE);
  assert.match(src, /new ResizeObserver\(redim\)/, "le suivi de taille a disparu");
  assert.match(src, /\[0, 120, 350, 800, 1600\]\.map\(\(d\) => setTimeout\(redim, d\)\)/,
    "les rappels de redimensionnement ont sauté : le cadre restera blanc au chargement");
});

test("l'attribution est affichée en permanence", () => {
  const src = readFileSync(VUE, "utf8");
  assert.match(src, /\{attribution\}/, "l'attribution n'est plus rendue : la carte devient illégale");
});

console.log("\nLES TRADUCTIONS");

test("chaque source a son libellé dans les cinq langues", () => {
  for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
    for (const s of TOUTES) {
      assert.ok(R[lg][s.cle], `« ${s.cle} » manque en ${lg}`);
    }
    for (const c of ["monde", "fr", "ch", "us", "es", "de"]) {
      assert.ok(R[lg][`zone.${c}`], `« zone.${c} » manque en ${lg}`);
    }
    for (const k of ["onglet.cartes", "onglet.calques", "onglet.traces", "relief.titre", "relief.ouvrir"]) {
      assert.ok(R[lg][k], `« ${k} » manque en ${lg}`);
    }
  }
  assert.equal(texteRelief("xx"), R.fr, "une langue inconnue doit retomber sur le français");
});

test("les noms d'institutions ne sont pas traduits", () => {
  // Renommer « IGN » ou « swisstopo » rendrait l'attribution fausse.
  // ⚠️ ON COMPARE À LA VALEUR ATTENDUE, PAS LES LANGUES ENTRE ELLES. Ces libellés
  // viennent d'un objet COMMUN étalé dans les cinq langues : les comparer l'une à l'autre
  // reste vrai même quand on les renomme toutes d'un coup — mutation restée verte.
  for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
    assert.equal(R[lg]["fond.swisstopo"], "swisstopo", `nom d'institution altéré en ${lg}`);
    assert.match(R[lg]["fond.usTopo"], /USGS/);
    assert.match(R[lg]["fond.ignPlan"], /IGN/);
    assert.match(R[lg]["fond.bkgDe"], /BKG/);
  }
});

console.log(`\n${passed} test(s) de relief passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
