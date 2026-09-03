/**
 * LE PLAFOND DE 1 000 LIGNES DE POSTGREST — quatre défauts en une journée.
 *
 * Une réponse s'arrête à 1 000 lignes QUEL QUE SOIT le `limit` demandé, et SANS erreur.
 * Constaté le 03/09/2026 sur quatre lectures différentes :
 *  · le sitemap déclarait 1 022 adresses au lieu de 10 700 ;
 *  · la navigation par région perdait La Réunion (une seule course) ;
 *  · la sauvegarde aurait écrit 1 000 courses sur 17 131 en paraissant réussir ;
 *  · les classements de segments lisaient 1 000 efforts sur 1 063 — 63 passages
 *    disparus, un record et un « Maître du segment » faux, et de plus en plus faux
 *    à mesure que l'historique grandit.
 *
 * Le point commun : AUCUN ne lève d'erreur. C'est le silence qui les rend dangereux.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}
const codeNu = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

test("les efforts de segments se lisent TOUJOURS par le lecteur paginé", () => {
  // ⚠️ MESURÉ : la base comptait 1 063 efforts et les écrans en lisaient 1 000. Un
  // classement amputé n'a l'air de rien — il affiche un record, un rang et un maître,
  // tous faux. On interdit donc toute lecture directe de cette table hors du lecteur.
  const coupables: string[] = [];
  for (const f of [...fichiers("src/app"), ...fichiers("src/components")]) {
    const src = codeNu(readFileSync(f, "utf8"));
    for (const m of src.matchAll(/from\("segment_efforts"\)[\s\S]{0,200}/g)) {
      const bloc = m[0];
      // Les ÉCRITURES n'ont pas de plafond de lecture.
      if (/\.(insert|upsert|update|delete)\(/.test(bloc)) continue;
      // Un simple comptage non plus.
      if (/count: "exact", head: true/.test(bloc)) continue;
      // Une lecture bornée par une séance précise reste petite et explicite.
      if (/\.eq\("workout_id"/.test(bloc)) continue;
      if (!/\.range\(/.test(bloc)) coupables.push(`${f} — lecture sans pagination`);
    }
  }
  assert.deepEqual(coupables, [],
    `ces lectures s'arrêteront à 1 000 efforts sans le dire :\n    ${coupables.join("\n    ")}`);
});

test("le lecteur paginé pagine vraiment, et s'arrête proprement", () => {
  const src = codeNu(readFileSync("src/lib/segments/efforts.ts", "utf8"));
  assert.ok(/\.range\(debut, debut \+ PAS - 1\)/.test(src), "le lecteur ne pagine plus");
  // ⚠️ `range` SANS `order` FAIT GLISSER LA PAGINATION : deux pages peuvent se recouvrir
  // ou sauter des lignes, et le classement changerait à chaque chargement.
  assert.ok(/\.order\("id", \{ ascending: true \}\)/.test(src), "la pagination n'est plus ordonnée");
  assert.ok(/if \(error\) break;/.test(src), "une erreur ferait boucler la lecture jusqu'à la borne haute");
  assert.ok(/if \(lot\.length < PAS\) break;/.test(src), "la boucle ne s'arrête pas sur un lot incomplet");
});

test("les lectures massives du catalogue de courses paginent", () => {
  // Le sitemap et la sauvegarde lisent les 17 131 courses : sans pagination, ils en
  // publieraient 1 000 en paraissant complets.
  for (const f of ["src/app/sitemap.ts", "scripts/sauvegarde.ts", "src/lib/races/catalogue.ts"]) {
    const src = codeNu(readFileSync(f, "utf8"));
    if (!/from\("races"\)/.test(src)) continue;
    assert.ok(/\.range\(/.test(src), `${f} lit les courses sans pagination`);
    assert.ok(/\.order\(/.test(src), `${f} pagine sans ordre explicite : la pagination glisserait`);
  }
});

console.log(`\n${passed} test(s) de pagination passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
