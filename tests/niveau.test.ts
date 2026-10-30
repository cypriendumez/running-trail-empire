/**
 * LE NIVEAU AFFICHÉ EST CELUI DU COACH (Cyprien, 30/10/2026).
 *
 * « Il me met Niveau Élite, mais pourquoi je le suis, et quels sont les autres ? »
 * L'étiquette lisait `profiles.mode`, écrit une seule fois à l'inscription : « elite » si
 * la VMA DÉCLARÉE dépassait 17 km/h jusqu'au 17/09/2026, « ludique » pour tous ensuite —
 * affiché « Intermédiaire », débutant complet compris. Rien ne le réécrivait, et le coach,
 * lui, choisissait ses séances sur une tout autre échelle (la VMA effective).
 *
 *   npx tsx tests/niveau.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { niveauDeVma, CLE_NIVEAU, SEUILS_NIVEAU } from "../src/lib/running/niveau";
import { T } from "../src/lib/i18n/translations";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
/** Le source sans ses commentaires — sans couper les `://` des adresses. */
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

console.log("\nLA RÈGLE — celle du coach, au dixième de km/h près");

test("les seuils du coach : 13, 16 et 19 km/h", () => {
  assert.deepEqual(SEUILS_NIVEAU, { intermediaire: 13, confirme: 16, elite: 19 });
  assert.equal(niveauDeVma(12.9), "debutant");
  assert.equal(niveauDeVma(13), "intermediaire");
  assert.equal(niveauDeVma(15.9), "intermediaire");
  assert.equal(niveauDeVma(16), "confirme");
  assert.equal(niveauDeVma(18.9), "confirme");
  assert.equal(niveauDeVma(19), "elite");
  assert.equal(niveauDeVma(20.1), "elite", "la VMA de Cyprien (20,1 km/h) n'est plus élite");
});

test("une VMA inconnue ne devient pas un niveau inventé", () => {
  for (const v of [null, undefined, 0, -3, Number.NaN]) assert.equal(niveauDeVma(v as number | null), null, `${v} donne un niveau`);
});

console.log("\nLES ÉCRANS — plus jamais `profiles.mode`");

test("le coach choisit ses séances avec la MÊME règle que l'étiquette", () => {
  const src = codeNu("src/lib/ai/coachContext.ts");
  assert.match(src, /const libLevel: Level = niveauDeVma\(vma\) \?\? "debutant";/, "le coach a de nouveau sa propre échelle");
  // AUCUNE borne recopiée, accent ou pas : le texte du prompt en portait une quatrième copie.
  assert.doesNotMatch(src, /vma < (13|16|19)\b/, "des seuils de niveau sont de nouveau recopiés dans le coach");
});

test("l'en-tête affiche le niveau calculé sur la VMA, plus le champ figé", () => {
  const barre = codeNu("src/components/layout/TopBar.tsx");
  assert.match(barre, /const levelLabel = t\(CLE_NIVEAU\[niveau \?\? "inconnu"\]\);/, "l'en-tête n'affiche plus le niveau calculé");
  assert.doesNotMatch(barre, /profile\?\.mode/, "l'en-tête relit `profiles.mode`, figé à l'inscription");
  const gabarit = codeNu("src/app/dashboard/layout.tsx");
  assert.match(gabarit, /const niveau = niveauDeVma\(vmaAffichee\(\{/, "le gabarit ne calcule plus le niveau sur la VMA effective");
  assert.match(gabarit, /niveau=\{niveau\}/, "le niveau n'atteint plus l'en-tête");
});

test("le tableau de bord applique la règle à la VMA qu'il affiche juste à côté", () => {
  const src = codeNu("src/components/dashboard/BentoDashboard.tsx");
  assert.match(src, /const levelLabel = t\(CLE_NIVEAU\[niveauDeVma\(currentVma\) \?\? "inconnu"\]\);/, "l'étiquette ne suit plus la VMA affichée");
  assert.doesNotMatch(src, /mode \?\? ""\) === "elite"/, "le tableau de bord relit `profiles.mode`");
});

test("les cinq libellés existent dans les cinq langues", () => {
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    for (const cle of Object.values(CLE_NIVEAU)) {
      assert.ok(T[lang][cle]?.trim(), `« ${cle} » manque en ${lang}`);
    }
  }
  assert.equal(T.fr["niveau.inconnu"], "Niveau à évaluer");
  assert.equal(T.fr["niveau.confirme"], "Niveau Confirmé");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
