/**
 * TRAIL BUILDER — ce que voit l'athlète en arrivant, et ce qui le coupe.
 *
 * Trois défauts relevés le 05/09/2026 en EXERÇANT la page, pas en la regardant.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const TB = "src/components/trail/TrailBuilder.tsx";

test("la carte s'ouvre sur la zone de l'athlète, avec ses trois gardes", () => {
  // ⚠️ `coordinates` EST STOCKÉ EN [lng, lat]. Le code qui charge un parcours le montre
  // sans ambiguïté (`map(([lng, lat]) => ...)`). Inverser ces deux-là ouvrirait la
  // carte au milieu de l'océan Indien — une erreur invisible en relecture, évidente à
  // l'écran, et qu'aucun type ne peut attraper puisque ce sont deux `number`.
  const src = codeNu(TB);
  const i = src.indexOf("vueAutoFaite.current = true");
  assert.ok(i > 0, "le recentrage sur le dernier parcours a disparu : la carte rouvre sur la France entière");
  const bloc = src.slice(Math.max(0, i - 700), i + 200);
  assert.ok(/const \[lng, lat\] = premier;/.test(bloc),
    "l'ordre [lng, lat] n'est plus explicite : une inversion passerait inaperçue");
  assert.ok(/map\.setView\(\[lat, lng\]/.test(bloc),
    "Leaflet reçoit les coordonnées dans le mauvais ordre : la carte s'ouvrira dans l'océan");
  // Les trois gardes.
  assert.ok(/if \(vueAutoFaite\.current\) return;/.test(bloc), "le recentrage peut se rejouer et contrarier l'athlète");
  assert.ok(/waypoints\.length > 0/.test(bloc), "le recentrage écraserait un tracé déjà commencé");
  assert.ok(/Math\.abs\(lat\) > 90 \|\| Math\.abs\(lng\) > 180/.test(bloc),
    "des coordonnées hors bornes ne sont plus écartées");
});

test("les contrôles d'édition n'occupent le regard que s'ils servent", () => {
  // À l'arrivée il n'y a aucun tracé : les trois boutons s'affichaient grisés au milieu
  // de la carte. Ils restent MONTÉS (pas de saut de mise en page) mais transparents.
  const src = codeNu(TB);
  assert.ok(/hasRoute \|\| redoStack\.length > 0 \? "opacity-100" : "pointer-events-none opacity-0"/.test(src),
    "le panneau d'édition est de nouveau affiché en permanence, grisé et inutile");
});

test("les nombres affichés passent par le formateur de la langue", () => {
  const src = codeNu(TB);
  assert.equal([...src.matchAll(/replace\("\.",\s*","\)/g)].length, 0,
    "une virgule décimale codée en dur est revenue : elle est fausse pour quatre langues sur cinq");
  assert.ok(/fmtKm\(|fmtNombre\(/.test(src), "le Trail Builder n'utilise plus le formateur partagé");
});

test("la barre latérale n'anime que ce qui change", () => {
  // `transition-all` sur un élément pleine hauteur recalcule la mise en page à chaque
  // image. Seules la translation (tiroir mobile) et la largeur (repli bureau) bougent.
  const src = codeNu("src/components/layout/Sidebar.tsx");
  assert.ok(/transition-\[transform,width\]/.test(src), "la barre latérale est revenue à transition-all");
  assert.ok(!/h-screen[^"]*transition-all/.test(src), "transition-all subsiste sur la barre pleine hauteur");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
