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
  // Le garde s'est ÉTENDU : il coupe court aussi quand la page a déjà fourni un centre
  // (traces GPS). Le repli sur les parcours enregistrés ne sert plus que sans traces.
  assert.ok(/if \(vueAutoFaite\.current \|\| centre\) return;/.test(bloc),
    "le recentrage de repli peut se rejouer, ou écraser le centre venu des traces GPS");
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

test("le centre de la carte vient des traces GPS, pas des parcours enregistrés", () => {
  /**
   * ⚠️ MA PREMIÈRE VERSION ÉTAIT INERTE. Elle se recentrait sur le dernier parcours
   * ENREGISTRÉ — or `user_routes` est vide en base, y compris pour un compte actif
   * depuis des mois : le recentrage n'aurait jamais eu lieu. Vérifié, pas supposé.
   * Les traces GPS, elles, sont 330, et leurs bornes sont déjà stockées.
   */
  const page = codeNu("src/app/dashboard/trail/page.tsx");
  assert.ok(/from\("activity_tracks"\)/.test(page),
    "la page ne lit plus les traces GPS : la carte rouvrira sur la France entière");
  assert.ok(/min_lat, max_lat, min_lon, max_lon/.test(page), "les bornes ne sont plus lues");
  assert.ok(/Math\.abs\(lat\) <= 90 && Math\.abs\(lon\) <= 180/.test(page),
    "un centre hors bornes n'est plus écarté : la carte pourrait s'ouvrir dans l'océan");
  assert.ok(/centre=\{centre\}/.test(page), "le centre n'est plus transmis au composant");

  const tb = codeNu("src/components/trail/TrailBuilder.tsx");
  assert.ok(/center: centre \? \[centre\.lat, centre\.lon\] : \[46\.85, 2\.35\]/.test(tb),
    "la carte n'utilise plus le centre reçu, ou l'ordre lat/lon a changé");
  assert.ok(/zoom: centre \? 12 : 6/.test(tb), "le zoom ne s'adapte plus à la présence d'un centre");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
