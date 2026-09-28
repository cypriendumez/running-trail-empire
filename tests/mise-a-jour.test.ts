/**
 * UN ONGLET OUVERT PASSE À LA NOUVELLE VERSION (29/09/2026).
 *
 * Les captures de Cyprien montraient l'ANCIEN menu des heures après la mise en ligne :
 * Next navigue sans recharger, et le JavaScript du premier affichage continuait de tourner.
 *
 *   npx tsx tests/mise-a-jour.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { versionPlusRecente } from "../src/components/layout/MiseAJour";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

test("une version en ligne DIFFÉRENTE et lisible déclenche la mise à jour — rien d'autre", () => {
  assert.equal(versionPlusRecente("fbe697a", "41b3a07"), true);
  assert.equal(versionPlusRecente("41b3a07", "41b3a07"), false);
  assert.equal(versionPlusRecente(undefined, "41b3a07"), false, "version.json illisible : on ne recharge pas");
  assert.equal(versionPlusRecente("<html>", "41b3a07"), false, "une page d'erreur n'est pas une version");
  assert.equal(versionPlusRecente("fbe697a", ""), false, "un build sans version ne recharge jamais (sinon, en boucle)");
});

test("le build EMBARQUE sa version, lue dans le tampon", () => {
  const conf = codeNu("next.config.ts");
  assert.match(conf, /readFileSync\("public\/version\.json", "utf8"\)/);
  assert.match(conf, /env: \{ NEXT_PUBLIC_VERSION: VERSION_BUILD \}/);
});

test("rechargement à la navigation SUIVANTE seulement, jamais en pleine saisie", () => {
  const src = codeNu("src/components/layout/MiseAJour.tsx");
  assert.match(src, /if \(cheminPrecedent\.current === pathname\) return;[\s\S]{0,120}if \(dispoRef\.current\) window\.location\.reload\(\);\s*\}, \[pathname\]\);/);
  assert.match(src, /fetch\("\/version\.json", \{ cache: "no-store" \}\)/, "la version en ligne peut être lue en cache");
  assert.match(codeNu("src/app/dashboard/layout.tsx"), /<MiseAJour \/>/, "le détecteur n'est plus monté");
});

test("le service worker ne garde pas version.json en cache", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  const immuable = sw.match(/const IMMUABLE = (\/.*\/);/)?.[1];
  assert.ok(immuable, "motif IMMUABLE introuvable");
  const rx = new Function(`return ${immuable}`)() as RegExp;
  assert.equal(rx.test("/version.json"), false, "version.json serait servi depuis le cache : la mise à jour ne serait jamais vue");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
