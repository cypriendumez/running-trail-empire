/**
 * ÉCRAN DE LANCEMENT ET BULLE D'AIDE — deux corrections d'interface du 28/09/2026.
 *
 *  · « Sur toutes les applications mobiles il y a un chargement quand on entre » : un écran
 *    de lancement, rendu par le serveur, qui s'efface quand la page est prête et en profite
 *    pour précharger le lourd (Leaflet, catalogue des courses).
 *  · La bulle d'aide masquait le bouton « M'entraîner pour cette course » de la carte.
 *
 *   npx tsx tests/lancement.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reseauGenereux, DUREE_MIN_MS, DUREE_MAX_MS } from "../src/components/layout/EcranLancement";
import { CLE_SESSION_LANCEMENT, SLOGAN_LANCEMENT } from "../src/lib/ui/lancement";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const CSS = readFileSync("src/app/globals.css", "utf8");

console.log("\n=== ÉCRAN DE LANCEMENT ===\n");

test("il est rendu par le serveur, AVANT la page, et masqué d'office s'il a déjà été vu", () => {
  const layout = codeNu("src/app/dashboard/layout.tsx");
  const decor = layout.indexOf("<DecorLancement langue={langue} />");
  const script = layout.indexOf("sessionStorage.getItem(${JSON.stringify(CLE_SESSION_LANCEMENT)})");
  const page = layout.indexOf("{children}");
  assert.ok(decor > 0 && script > decor && page > script, "le décor et son script doivent précéder la page");
  assert.match(layout, /<EcranLancement \/>/);
  // Le décor est un composant SERVEUR (refait le 02/10/2026) : sans « use client », il est
  // dans le HTML de la première réponse — rien n'attend le JavaScript.
  const decorSrc = codeNu("src/components/layout/DecorLancement.tsx");
  assert.doesNotMatch(decorSrc, /"use client"/);
  assert.match(decorSrc, /id="lancement" aria-hidden="true" suppressHydrationWarning/);
  assert.match(decorSrc, /\{SLOGAN_LANCEMENT\[langue\]\}/);
  for (const l of ["fr", "en", "de", "es", "pt"] as const) assert.ok(SLOGAN_LANCEMENT[l]?.trim(), `slogan ${l}`);
});

test("la clé de session vit dans un module neutre, pas dans le composant client", () => {
  assert.equal(CLE_SESSION_LANCEMENT, "pacevo_lancement");
  assert.doesNotMatch(readFileSync("src/lib/ui/lancement.ts", "utf8"), /"use client"/);
  assert.doesNotMatch(codeNu("src/app/dashboard/layout.tsx"), /CLE_SESSION\b(?!_LANCEMENT)/, "une constante lue d'un module client n'est qu'une référence côté serveur");
});

test("ni clignotement, ni otage : durée minimale et durée maximale", () => {
  assert.ok(DUREE_MIN_MS >= 400 && DUREE_MIN_MS <= 1000, `${DUREE_MIN_MS} ms`);
  assert.ok(DUREE_MAX_MS > DUREE_MIN_MS && DUREE_MAX_MS <= 3000, `${DUREE_MAX_MS} ms — un réseau lent ne doit pas bloquer l'entrée`);
  const src = codeNu("src/components/layout/EcranLancement.tsx");
  assert.match(src, /window\.setTimeout\(terminer, Math\.max\(0, DUREE_MAX_MS - performance\.now\(\)\)\)/);
  assert.match(src, /window\.addEventListener\("load", terminer, \{ once: true \}\)/);
  assert.match(src, /sessionStorage\.setItem\(CLE_SESSION, "1"\)/, "sans mémoire de session, chaque rechargement rejouerait l'ouverture");
});

test("le préchauffage respecte l'économie de données et les réseaux lents", () => {
  assert.equal(reseauGenereux(undefined), true);
  assert.equal(reseauGenereux({ effectiveType: "4g" }), true);
  assert.equal(reseauGenereux({ saveData: true, effectiveType: "4g" }), false);
  for (const t of ["slow-2g", "2g", "3g"]) assert.equal(reseauGenereux({ effectiveType: t }), false, t);
  const src = codeNu("src/components/layout/EcranLancement.tsx");
  assert.match(src, /if \(reseauGenereux\(c\)\) \{\s*void fetch\("\/api\/races\/list"\)/, "le catalogue (~1 Mo) ne se télécharge pas sans y être invité");
  assert.match(src, /void import\("leaflet"\)/);
});

test("l'animation s'efface pour qui a demandé moins de mouvement", () => {
  // CHAQUE classe animée de l'écran doit figurer dans la règle « moins de mouvement » :
  // une animation ajoutée sans y être continuerait de tourner pour qui l'a refusée.
  const regle = CSS.match(/@media \(prefers-reduced-motion: reduce\) \{\s*([^{]*)\{ animation: none; \}\s*#lancement, \.lancement-contenu \{ transition: none; \}/);
  assert.ok(regle, "la règle « moins de mouvement » de l'écran de lancement a disparu");
  const figees = new Set(regle![1].split(",").map((x) => x.trim()));
  const animees = [...CSS.matchAll(/^(\.lancement-[\w-]+) \{[^}]*animation:/gm)].map((m) => m[1]);
  assert.ok(animees.length >= 6, `${animees.length} classes animées trouvées`);
  for (const c of animees) assert.ok(figees.has(c), `${c} s'anime encore pour qui a demandé moins de mouvement`);
  assert.match(CSS, /#lancement\[data-vu\] \{ display: none; \}/);
  // Le démarrage natif de l'application installée prend le vert de l'écran : pas de flash.
  const fondNatif = JSON.parse(readFileSync("public/manifest.json", "utf8")).background_color.toLowerCase();
  assert.match(CSS.match(/\.lancement-fond \{[\s\S]*?\n\}/)![0].toLowerCase(), new RegExp(fondNatif), "le démarrage natif et l'écran de lancement n'ont plus le même vert");
  assert.match(CSS, /#lancement\[data-sortie\] \{ opacity: 0; visibility: hidden; pointer-events: none; \}/, "l'écran qui s'efface ne doit plus capter les clics");
});

console.log("\n=== BULLE D'AIDE ET CARTE ===\n");

test("la bulle se retire tant qu'une vue plein écran est ouverte", () => {
  assert.match(CSS, /html\[data-plein-ecran\] \[data-bulle-aide\] \{ display: none !important; \}/);
  const bulle = codeNu("src/components/support/SupportBubble.tsx");
  assert.equal((bulle.match(/data-bulle-aide/g) ?? []).length, 2, "le bouton ET le panneau de la bulle doivent porter le marqueur");
  assert.match(codeNu("src/components/races/RacesMapView.tsx"), /\n\s*usePleinEcran\(\);/);
  // Le drapeau est `data-plein-ecran` : la clé du dataset doit rester « pleinEcran ».
  assert.match(codeNu("src/lib/ui/pleinEcran.ts"), /const CLE = "pleinEcran";/);
});

test("les points de la carte se visent sans précision chirurgicale", () => {
  assert.match(codeNu("src/components/races/RacesMapView.tsx"), /L\.canvas\(\{ padding: 0\.5, tolerance: 6 \}\)/);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
