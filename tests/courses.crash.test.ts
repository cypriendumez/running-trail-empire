/**
 * CRASH-TESTS DU CATALOGUE DE COURSES.
 *
 * Le catalogue affichait une carte par DISTANCE et non par ÉVÉNEMENT : « Boucles de
 * Saint-Thonan » occupait trois cartes consécutives — 10 km, 9 km, 5 km — même ville,
 * même date, même page d'inscription. Ce ne sont pas des doublons, ce sont les formats
 * d'une seule course ; mais empilés tels quels ils se lisent comme un bug et repoussent
 * les vraies courses suivantes hors de l'écran.
 *
 * Mesuré sur les 15 000 lignes rapatriées : 8 613 événements réels, dont 3 674 à
 * plusieurs distances — 43 % de lignes en moins une fois regroupées.
 *
 * Le regroupement peut se tromper de deux façons, et les deux sont graves :
 *   · fusionner deux courses DIFFÉRENTES (l'athlète en perd une) ;
 *   · séparer deux formats d'une MÊME course (le défaut d'origine revient).
 *
 *   npx tsx tests/courses.crash.test.ts
 */
import assert from "node:assert/strict";
import { grouperEvenements, cleEvenement } from "../src/lib/races/groupes";

let passed = 0;
const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  KO ${nom}`); }
}

const c = (id: string, name: string, city: string | null, date: string | null, km: number | null) =>
  ({ id, name, city, date, distance_km: km });

console.log("\nREGROUPEMENT — un événement, plusieurs distances");

test("les trois formats de Saint-Thonan font UNE carte", () => {
  const g = grouperEvenements([
    c("a", "Boucles de Saint-Thonan", "Saint-Thonan", "2026-09-01", 10),
    c("b", "Boucles de Saint-Thonan", "Saint-Thonan", "2026-09-01", 9),
    c("d", "Boucles de Saint-Thonan", "Saint-Thonan", "2026-09-01", 5),
  ]);
  assert.equal(g.length, 1, `${g.length} cartes au lieu d'une`);
  assert.deepEqual(g[0].formats.map((f) => f.distance_km), [5, 9, 10], "les distances ne sont pas triées du plus court au plus long");
  assert.equal(g[0].principale.distance_km, 10, "la carte ne porte pas le format principal");
});

test("deux ÉDITIONS d'une même course ne fusionnent jamais", () => {
  // Une course annuelle : même nom, même ville, dates différentes. Les fusionner ferait
  // disparaître une édition entière du catalogue.
  const g = grouperEvenements([
    c("a", "Corrida de Noël", "Issy", "2026-12-20", 10),
    c("b", "Corrida de Noël", "Issy", "2027-12-19", 10),
  ]);
  assert.equal(g.length, 2, "deux éditions ont été fusionnées : une disparaît du catalogue");
});

test("deux villes homonymes ne fusionnent jamais", () => {
  const g = grouperEvenements([
    c("a", "Corrida de Noël", "Issy", "2026-12-20", 10),
    c("b", "Corrida de Noël", "Lyon", "2026-12-20", 10),
  ]);
  assert.equal(g.length, 2, "deux courses de villes différentes ont fusionné");
});

test("la casse et les espaces ne créent pas de faux doublons", () => {
  const g = grouperEvenements([
    c("a", "  Boucles de Saint-Thonan ", "Saint-Thonan", "2026-09-01", 10),
    c("b", "boucles de saint-thonan", "SAINT-THONAN", "2026-09-01", 5),
  ]);
  assert.equal(g.length, 1, "une différence de casse a produit deux cartes");
});

test("l'ordre d'arrivée des événements est conservé", () => {
  // La liste est déjà triée (date, distance, nom…) : réordonner ici ferait mentir le
  // sélecteur de tri sans que rien ne le signale.
  const g = grouperEvenements([
    c("a", "Zèbre", "V", "2026-09-03", 10),
    c("b", "Alpha", "V", "2026-09-01", 10),
    c("d", "Zèbre", "V", "2026-09-03", 5),
    c("e", "Milieu", "V", "2026-09-02", 21),
  ]);
  assert.deepEqual(g.map((x) => x.principale.name), ["Zèbre", "Alpha", "Milieu"], "l'ordre a été modifié");
});

test("aucune course n'est perdue en route", () => {
  const brut = [
    c("a", "A", "V", "2026-09-01", 10), c("b", "A", "V", "2026-09-01", 5),
    c("d", "B", "W", "2026-09-02", 21), c("e", "C", null, null, null),
  ];
  const g = grouperEvenements(brut);
  const ids = g.flatMap((x) => x.formats.map((f) => f.id)).sort();
  assert.deepEqual(ids, ["a", "b", "d", "e"], "des courses ont disparu ou ont été dupliquées");
});

console.log("\nENTRÉES ABÎMÉES — le catalogue est importé, il contient de tout");

test("ville, date ou distance absentes ne font pas planter", () => {
  const g = grouperEvenements([
    c("a", "Sans ville", null, "2026-09-01", 10),
    c("b", "Sans date", "V", null, 10),
    c("d", "Sans distance", "V", "2026-09-01", null),
  ]);
  assert.equal(g.length, 3);
  for (const x of g) assert.ok(x.principale && x.formats.length >= 1, "un événement sans course principale");
});

test("deux courses sans ville ni date ne sont pas fusionnées par leurs trous", () => {
  // Le piège : deux clés « nom::: » identiques pour des courses différentes. C'est le
  // NOM qui doit les séparer, pas les champs vides.
  const g = grouperEvenements([c("a", "Trail X", null, null, 10), c("b", "Trail Y", null, null, 10)]);
  assert.equal(g.length, 2, "deux courses différentes ont fusionné sur leurs champs vides");
});

test("une liste vide, ou des entrées invalides, ne cassent rien", () => {
  assert.deepEqual(grouperEvenements([]), []);
  const g = grouperEvenements([
    null as never, undefined as never, { id: 1 } as never,
    c("ok", "Vraie", "V", "2026-09-01", 10),
  ]);
  assert.equal(g.length, 1, "une entrée invalide a produit une carte");
  assert.equal(g[0].principale.id, "ok");
});

test("distances corrompues : la principale reste définie", () => {
  const g = grouperEvenements([
    c("a", "T", "V", "2026-09-01", NaN as never),
    c("b", "T", "V", "2026-09-01", null),
    c("d", "T", "V", "2026-09-01", 42),
  ]);
  assert.equal(g.length, 1);
  assert.ok(g[0].principale, "aucun format principal");
  assert.equal(g[0].principale.distance_km, 42, "le format principal n'est pas le plus long");
});

test("la clé est stable d'un appel à l'autre", () => {
  const r = c("a", "Trail des Cimes", "Annecy", "2026-09-01", 21);
  assert.equal(cleEvenement(r), cleEvenement({ ...r }), "la clé change entre deux appels : React remonterait les cartes à chaque rendu");
  assert.notEqual(cleEvenement(r), cleEvenement({ ...r, city: "Chamonix" }));
});

test("un très gros catalogue reste groupé correctement", () => {
  const gros = Array.from({ length: 5000 }, (_, i) =>
    c(`id${i}`, `Course ${i % 1000}`, "V", "2026-09-01", (i % 5) + 1));
  const g = grouperEvenements(gros);
  assert.equal(g.length, 1000, `${g.length} événements au lieu de 1000`);
  assert.equal(g.reduce((s, x) => s + x.formats.length, 0), 5000, "des courses ont été perdues");
});

console.log(`\n${passed} crash-test(s) du catalogue passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
