/**
 * LE PLAN IGNORAIT LE TERRAIN DE LA COURSE.
 *
 * Le catalogue porte le dénivelé de 6 369 courses sur 17 211 — dont 2 781 au-dessus de
 * 500 m — mais l'objectif de l'athlète n'en transportait que le NOM, la date et la
 * distance. Un coureur préparant un trail à 1 200 m de D+ recevait exactement le même
 * plan qu'un coureur de 10 km sur route.
 *
 * ⚠️ LA DISTINCTION QUI COMMANDE TOUT LE MODULE : `null` veut dire « le catalogue ne
 * sait pas », `0` veut dire « la course est annoncée plate ». Confondre les deux ferait
 * préparer un trail comme une course sur route — la faute la plus coûteuse qu'un plan
 * puisse commettre.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  exigenceTerrain, denivelePartSemaine,
  VALLONNE_M_PAR_KM, MONTAGNEUX_M_PAR_KM, DPLUS_NEGLIGEABLE, PART_HEBDO_CIBLE,
} from "../src/lib/coach/terrain";

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
const MAINTENANT = Date.parse("2026-09-06T12:00:00Z");
const jour = (n: number) => new Date(MAINTENANT - n * 86400000).toISOString().slice(0, 10);

console.log("\nINCONNU N'EST PAS PLAT");

test("un dénivelé absent ne prescrit RIEN", () => {
  assert.equal(exigenceTerrain(null, 10, 500), null, "un plan de côtes bâti sur une donnée absente");
  assert.equal(exigenceTerrain(undefined, 10, 500), null);
  assert.equal(exigenceTerrain(Number.NaN, 10, 500), null);
});

test("une course annoncée plate ne prescrit rien non plus", () => {
  assert.equal(DPLUS_NEGLIGEABLE, 150, "seuil : décision d'entraîneur, à changer sciemment");
  assert.equal(exigenceTerrain(0, 10, 500), null);
  assert.equal(exigenceTerrain(140, 10, 500), null, "sous le seuil, aucun travail spécifique");
  assert.ok(exigenceTerrain(160, 10, 500), "au-dessus, il y a quelque chose à préparer");
});

test("une distance absurde ne produit pas de m/km absurde", () => {
  assert.equal(exigenceTerrain(1200, 0, 500), null);
  assert.equal(exigenceTerrain(1200, null, 500), null);
});

console.log("\nLE PROFIL DE LA COURSE");

test("les trois profils tombent sur les bons seuils", () => {
  // Nombres écrits en dur : les déduire des constantes rendrait le test aveugle.
  assert.equal(VALLONNE_M_PAR_KM, 10);
  assert.equal(MONTAGNEUX_M_PAR_KM, 30);
  assert.equal(exigenceTerrain(200, 21.1, null)!.profil, "plat", "9,5 m/km reste plat");
  assert.equal(exigenceTerrain(250, 10, null)!.profil, "vallonne", "25 m/km");
  assert.equal(exigenceTerrain(1200, 30, null)!.profil, "montagneux", "40 m/km");
});

test("la cible hebdomadaire dépasse le D+ de la course", () => {
  // Le corps doit voir PLUS de dénivelé à l'entraînement que le jour J : une semaine à
  // l'exact D+ de la course ne prépare pas à l'encaisser d'un seul tenant.
  assert.equal(PART_HEBDO_CIBLE, 1.5);
  const e = exigenceTerrain(1200, 30, null)!;
  assert.equal(e.cibleHebdoM, 1800);
  assert.ok(e.cibleHebdoM > e.dplusCourse, "la cible hebdomadaire ne dépasse plus le D+ de la course");
});

test("le manque est calculé, et jamais négatif", () => {
  assert.equal(exigenceTerrain(1200, 30, 400)!.manqueHebdoM, 1400);
  assert.equal(exigenceTerrain(1200, 30, 2500)!.manqueHebdoM, 0, "un athlète en avance ne « manque » de rien");
  assert.equal(exigenceTerrain(1200, 30, null)!.manqueHebdoM, 0, "aucun manque annoncé quand on ne mesure pas");
  assert.equal(exigenceTerrain(1200, 30, null)!.actuelHebdoM, null, "une mesure absente doit rester absente");
});

console.log("\nLE D+ HEBDOMADAIRE DE L'ATHLÈTE");

const sorties = (n: number, dplus: number) =>
  Array.from({ length: n }, (_, i) => ({ date: jour(i * 2), elevation_gain_m: dplus }));

test("il se mesure sur des semaines glissantes", () => {
  // 100 m tous les deux jours ≈ 350 m par semaine.
  const d = denivelePartSemaine(sorties(28, 100), MAINTENANT)!;
  assert.ok(Math.abs(d - 350) <= 60, `${d} m au lieu de ~350`);
});

test("trop peu de sorties : on ne conclut pas", () => {
  assert.equal(denivelePartSemaine(sorties(3, 100), MAINTENANT), null);
  assert.equal(denivelePartSemaine([], MAINTENANT), null);
});

test("une sortie en montagne ne fait pas une préparation en montagne", () => {
  // MÉDIANE et non moyenne : une seule sortie à 2 000 m ne doit pas déplacer le verdict.
  const propre = denivelePartSemaine(sorties(28, 100), MAINTENANT)!;
  // Pic ÉNORME et tolérance serrée : avec 2 000 m et 300 m de marge, une moyenne
  // passait le test aussi bien qu'une médiane (trouvé par mutation).
  const avecPic = denivelePartSemaine([...sorties(28, 100), { date: jour(5), elevation_gain_m: 20000 }], MAINTENANT)!;
  assert.ok(Math.abs(avecPic - propre) <= 60,
    `une sortie extrême a déplacé le D+ hebdomadaire de ${Math.abs(avecPic - propre)} m : ce n'est pas une médiane`);
});

test("les valeurs illisibles sont écartées", () => {
  const sale = [...sorties(28, 100), { date: "n'importe quoi", elevation_gain_m: 500 }, { date: jour(2), elevation_gain_m: Number.NaN }];
  assert.ok(Number.isFinite(denivelePartSemaine(sale, MAINTENANT)!), "une valeur absurde a contaminé le calcul");
});

console.log("\nBRANCHEMENT");

test("la course est retrouvée par NOM, DATE ET DISTANCE", () => {
  // ⚠️ Une même épreuve publie plusieurs formats le même jour : « Foulées de Bondues »
  // existe en 1,5 / 5 / 10 km à la même date. Sans le filtre de distance, la recherche
  // rendait 3 lignes, était jugée ambiguë, et le dénivelé passait pour inconnu.
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /\.gte\("distance_km", objective\.distanceKm - 0\.5\)\.lte\("distance_km", objective\.distanceKm \+ 0\.5\)/,
    "la recherche ne filtre plus sur la distance : plusieurs formats la rendront ambiguë");
  // ⚠️ Le test EXIGE les deux occurrences : le dénivelé et le drapeau « connu » en
  // dépendent tous deux, et n'en muter qu'une laissait ce test au vert.
  const n = (src.match(/courseCible\.length === 1/g) ?? []).length;
  assert.equal(n, 2, `${n} contrôle(s) d'unicité : une recherche ambiguë serait exploitée`);
});

test("le prompt distingue les TROIS cas", () => {
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /TERRAIN DE LA COURSE \(dénivelé du catalogue/, "le cas « terrain exigeant » a disparu");
  assert.match(src, /plate ou presque/, "le cas « course plate » a disparu");
  assert.match(src, /n'est PAS renseigné au catalogue/, "le cas « on ne sait pas » a disparu — le pire des trois à perdre");
  assert.match(src, /Ne suppose ni plat ni montagne/, "le modèle n'est plus averti de ne pas deviner");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
