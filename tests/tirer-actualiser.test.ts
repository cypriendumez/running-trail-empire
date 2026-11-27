/**
 * « TIRER POUR ACTUALISER » SUR LE TABLEAU DE BORD (Cyprien, 27/11/2026 : « pourquoi je peux
 * pas actualiser sur mon téléphone quand je suis sur le dashboard de pacevo »).
 *
 * Défaut constaté : la page était figée à la hauteur de l'écran (`h-screen overflow-hidden`)
 * et seul <main> défilait (`overflow-auto`). Safari et Chrome ne lancent le geste que sur la
 * page elle-même : il ne faisait rien. Et l'application installée n'a jamais ce geste.
 *
 * Ce test lit le code source (commentaires retirés) : la page défile, le geste maison est
 * branché pour l'application installée seulement, il ne part jamais pendant une vue plein
 * écran, et les éléments collants se calent sous l'entête.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let ok = 0;
const echecs: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); ok++; console.log(`  ✓ ${nom}`); }
  catch (e) { echecs.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${nom}`); }
}
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}
const lire = (p: string) => sansCommentaires(readFileSync(p, "utf8"));

const layout = lire("src/app/dashboard/layout.tsx");
const geste = lire("src/components/layout/TirerPourActualiser.tsx");
const css = lire("src/app/globals.css");

test("la page du tableau de bord défile elle-même (plus de hauteur figée ni de <main> qui défile)", () => {
  const racine = layout.match(/<div data-tableau-de-bord className="([^"]+)"/);
  assert.ok(racine, "conteneur racine `data-tableau-de-bord` introuvable");
  assert.ok(!/(^|\s)h-screen\b/.test(racine![1]), `racine figée à l'écran : ${racine![1]}`);
  assert.ok(!/\boverflow-(hidden|auto|scroll|y-auto|y-hidden)\b/.test(racine![1]), `racine en zone de défilement : ${racine![1]}`);
  const main = layout.match(/<main className="([^"]+)"/);
  assert.ok(main, "<main> introuvable");
  assert.ok(!/\boverflow-(auto|scroll|y-auto|y-scroll|hidden)\b/.test(main![1]), `<main> défile encore sur lui-même : ${main![1]}`);
});

test("la barre latérale et l'entête restent en place par sticky", () => {
  const side = lire("src/components/layout/Sidebar.tsx");
  assert.match(side, /"hidden md:flex sticky top-0 h-screen/);
  assert.match(lire("src/components/layout/TopBar.tsx"), /<header className="[^"]*\bsticky top-0\b/);
});

test("le geste maison est rendu par le layout et réservé à l'application installée", () => {
  assert.match(layout, /<TirerPourActualiser \/>/);
  assert.match(geste, /if \(!estApplicationInstallee\(\)\) return;/);
  assert.match(geste, /display-mode: standalone/);
  assert.match(geste, /window\.location\.reload\(\)/);
});

test("le geste ne part ni d'une page défilée, ni d'une carte, ni pendant un plein écran", () => {
  assert.match(geste, /window\.scrollY > 0\) return;/);
  assert.match(geste, /if \(document\.documentElement\.dataset\.pleinEcran\) return;/);
  assert.match(geste, /\.maplibregl-map/);
  assert.match(geste, /\.leaflet-container/);
  assert.match(geste, /zoneDefilanteNonEnHaut\(cible\)/);
});

test("Enregistrer en plein écran fige la page derrière (pas d'actualisation en pleine course)", () => {
  assert.match(lire("src/components/ghost-runner/GhostRunner.tsx"), /usePleinEcran\(plein\);/);
  assert.match(css, /html\[data-plein-ecran\], html\[data-plein-ecran\] body \{ overflow: hidden; overscroll-behavior: none; \}/);
});

test("les éléments collants du tableau de bord se calent sous l'entête (4 rem)", () => {
  const cas: [string, RegExp][] = [
    ["src/components/dashboard/BentoDashboard.tsx", /lg:sticky lg:top-\[5\.5rem\]/],
    ["src/components/shop/GearHub.tsx", /lg:sticky lg:top-20/],
    ["src/components/shop/ShoppingHub.tsx", /sticky top-20/],
    ["src/components/cours/CoursSommaire.tsx", /sticky top-\[5\.5rem\]/],
  ];
  for (const [f, re] of cas) {
    const src = lire(f);
    assert.match(src, re, `${f} : collé derrière l'entête`);
    assert.ok(!/\bsticky (lg:)?top-(4|6)\b/.test(src), `${f} : un sticky encore à 1-1,5 rem, derrière l'entête`);
  }
});

test("la messagerie garde sa hauteur sans <main> qui défile", () => {
  const m = lire("src/app/dashboard/messages/page.tsx");
  assert.ok(!/<div className="flex h-full flex-col">/.test(m), "`h-full` ne mesure plus rien");
  assert.match(m, /100dvh/);
});

console.log(`\n${ok} test(s) passé(s), ${echecs.length} échec(s)`);
if (echecs.length) { for (const e of echecs) console.log(`  ✗ ${e}`); process.exit(1); }
