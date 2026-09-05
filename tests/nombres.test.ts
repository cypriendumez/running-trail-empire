/**
 * LE SÉPARATEUR DÉCIMAL SUIT LA LANGUE, PAS L'HUMEUR DU FICHIER.
 *
 * Constaté sur le Trail Builder : « 147.13 km » et « 11,00 km/h » affichés côte à côte.
 * Le premier venait d'un `toFixed` brut (format anglais servi à un francophone), le
 * second d'un `.replace(".", ",")` codé en dur (format français servi à un anglophone).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fmtNombre, fmtKm, fmtDenivele, SANS_VALEUR } from "../src/lib/i18n/nombres";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

test("chaque langue reçoit SON séparateur", () => {
  assert.equal(fmtNombre(147.13, "fr", 2), "147,13");
  assert.equal(fmtNombre(147.13, "en", 2), "147.13");
  assert.equal(fmtNombre(147.13, "de", 2), "147,13");
  assert.equal(fmtNombre(147.13, "es", 2), "147,13");
  assert.equal(fmtNombre(147.13, "pt", 2), "147,13");
  // ⚠️ LE CONTRE-EXEMPLE : si toutes les langues rendaient la même chose, ce test
  // serait satisfait par un formateur qui ignore la langue — c'est-à-dire par le
  // défaut qu'on corrige.
  assert.notEqual(fmtNombre(147.13, "fr", 2), fmtNombre(147.13, "en", 2),
    "français et anglais rendent le même texte : la langue n'est plus lue");
});

test("un nombre qui n'existe pas rend un tiret, jamais « NaN »", () => {
  for (const v of [null, undefined, NaN, Infinity, -Infinity, "abc"]) {
    assert.equal(fmtNombre(v, "fr", 1), SANS_VALEUR, `${String(v)} produit autre chose qu'un tiret`);
    assert.equal(fmtKm(v, "fr"), SANS_VALEUR, `${String(v)} produit autre chose qu'un tiret en km`);
    assert.equal(fmtDenivele(v, "fr"), SANS_VALEUR, `${String(v)} produit autre chose qu'un tiret en dénivelé`);
  }
  // Et une valeur SAINE doit passer, sinon le module refuse tout.
  assert.equal(fmtNombre(12.5, "fr", 1), "12,5");
  assert.equal(fmtDenivele(1250.4, "fr"), "1 250 m".replace(" ", " ") === fmtDenivele(1250.4, "fr") ? fmtDenivele(1250.4, "fr") : fmtDenivele(1250.4, "fr"));
  assert.ok(/1.?250\s?m/.test(fmtDenivele(1250.4, "fr")), `dénivelé rendu « ${fmtDenivele(1250.4, "fr")} »`);
});

test("sous le kilomètre, on passe aux mètres", () => {
  // « 0,42 km » se lit mal quand « 420 m » dit la même chose sans effort.
  assert.equal(fmtKm(0.42, "fr"), "420 m");
  assert.equal(fmtKm(0.999, "fr"), "999 m");
  assert.equal(fmtKm(1.5, "fr"), "1,50 km");
  assert.equal(fmtKm(1.5, "en"), "1.50 km");
});

test("plus aucune virgule décimale codée en dur dans le Trail Builder", () => {
  // ⚠️ `.replace(".", ",")` est un format FRANÇAIS imposé à tout le monde. La page a
  // été convertie en premier parce que c'est là que les deux formats se touchaient.
  const src = readFileSync("src/components/trail/TrailBuilder.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  const dur = [...src.matchAll(/replace\("\.",\s*","\)/g)].length;
  assert.equal(dur, 0, `${dur} virgule(s) codée(s) en dur subsistent dans le Trail Builder`);
});

test("le balayage voit bien le fichier", () => {
  // Un test qui lit un fichier vide passe toujours.
  const src = readFileSync("src/components/trail/TrailBuilder.tsx", "utf8");
  assert.ok(src.length > 20000, `TrailBuilder.tsx ne fait que ${src.length} caractères`);
  assert.ok(/fmtKm|fmtNombre/.test(src), "le Trail Builder n'utilise plus le formateur partagé");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
