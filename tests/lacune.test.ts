/**
 * LE COACH COMBLAIT SES TROUS AVEC UNE HYPOTHÈSE.
 *
 * Compte réel : 23 jours (04/07 → 26/07/2026) sans AUCUNE trace — ni séance, ni nuit,
 * ni mesure de VFC. Le plan lisait ce silence comme « zéro entraînement » : la médiane
 * hebdomadaire baissait et l'athlète était traité en reprise après coupure.
 *
 * Or une coupure, une blessure et une montre restée dans un tiroir produisent
 * exactement le même vide, et appellent des plans OPPOSÉS. Rien dans les données ne
 * permet de choisir : le coach doit donc le DIRE et poser la question.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { plusLongueLacune, LACUNE_MIN_JOURS } from "../src/lib/coach/lacune";

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

console.log("\nTROU DE DONNÉES — un fait mesuré, aucune interprétation");

test("le cas réel du 04/07 au 26/07 est retrouvé au jour près", () => {
  const l = plusLongueLacune(["2026-07-03", "2026-07-27", "2026-07-02", "2026-08-15"], "2026-06-25", "2026-09-05");
  assert.deepEqual(l, { debut: "2026-07-04", fin: "2026-07-26", jours: 23 });
});

test("une semaine calme n'est pas un trou", () => {
  assert.equal(plusLongueLacune(["2026-07-01", "2026-07-08"], "2026-06-01", "2026-09-01"), null,
    `6 jours vides restent sous le seuil de ${LACUNE_MIN_JOURS}`);
});

test("le seuil est bien celui annoncé", () => {
  const finPile = new Date(Date.parse("2026-07-01T12:00:00Z") + (LACUNE_MIN_JOURS + 1) * 86400000).toISOString().slice(0, 10);
  assert.ok(plusLongueLacune(["2026-07-01", finPile], "2026-06-01", "2026-09-01"), "au seuil exact, le trou compte");
});

test("un compte quasi vide n'est pas « un trou »", () => {
  assert.equal(plusLongueLacune([], "2026-06-01", "2026-09-01"), null);
  assert.equal(plusLongueLacune(["2026-07-01"], "2026-06-01", "2026-09-01"), null,
    "une seule donnée ne borne aucun intervalle");
});

test("le silence de FIN n'est pas un trou : c'est une synchro en retard", () => {
  // Deux mois sans rien APRÈS la dernière donnée : c'est un autre fait, raconté ailleurs.
  assert.equal(plusLongueLacune(["2026-06-01", "2026-06-02"], "2026-06-01", "2026-09-01"), null);
});

test("le PLUS LONG trou gagne", () => {
  const l = plusLongueLacune(["2026-06-01", "2026-06-20", "2026-07-25", "2026-07-26"], "2026-05-01", "2026-09-01");
  assert.equal(l!.jours, 34, "le trou de juin/juillet devait l'emporter sur celui de juin");
});

test("les dates hors fenêtre ne comptent pas", () => {
  const l = plusLongueLacune(["2025-01-01", "2026-08-01", "2026-08-02"], "2026-07-01", "2026-09-01");
  assert.equal(l, null, "une date d'il y a un an ne doit pas fabriquer un trou géant");
});

test("les doublons entre sources ne créent pas de faux trou", () => {
  // La même journée arrive par la séance, la nuit ET la VFC.
  const l = plusLongueLacune(["2026-07-03", "2026-07-03", "2026-07-03", "2026-07-27"], "2026-06-01", "2026-09-01");
  assert.equal(l!.jours, 23);
});

test("une date illisible n'emporte pas la fonction", () => {
  assert.doesNotThrow(() => plusLongueLacune(["pas-une-date", "2026-07-03", "2026-07-27"], "2026-06-01", "2026-09-01"));
  assert.equal(plusLongueLacune(["2026-07-03"], "n'importe quoi", "2026-09-01"), null);
  assert.equal(plusLongueLacune(["2026-07-03", "2026-07-27"], "2026-09-01", "2026-06-01"), null, "fenêtre à l'envers");
});

console.log("\nBRANCHEMENT — et surtout, une couverture de données HONNÊTE");

test("le prompt signale le trou et demande, au lieu de supposer", () => {
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /TROU DE DONNÉES/, "le coach ne dit pas qu'il ne sait pas");
  assert.match(src, /DEMANDE-LUI ce qui s'est passé, ne suppose pas/, "il faut poser la question, pas trancher");
  assert.match(src, /plusLongueLacune\(datesConnues, iso190\(\), todayStr\)/, "le trou n'est pas calculé");
});

test("les trois sources couvrent la MÊME fenêtre que l'historique", () => {
  // Le piège : sommeil et VFC ne sont lus que sur 30 lignes pour le reste du contexte.
  // S'en servir ici ferait passer une requête courte pour une absence de données, et le
  // coach annoncerait un trou imaginaire de plusieurs mois.
  const src = codeOf("src/lib/ai/coachContext.ts");
  // On vise la REQUÊTE elle-même, pas le nombre d'occurrences de « 190 jours » :
  // `iso190` en contient une, si bien que supprimer la requête de sommeil laissait
  // encore assez d'occurrences pour que ce test reste vert. Défaut trouvé par mutation.
  for (const [table, res] of [["sleep_data", "sleepDatesRes"], ["hrv_data", "hrvDatesRes"]] as const) {
    const re = new RegExp(`from\\("${table}"\\)\\.select\\("date"\\)[\\s\\S]{0,200}?190 \\* 86400000`);
    assert.match(src, re, `${table} n'est pas chargé sur la fenêtre longue : un faux trou serait annoncé`);
    assert.match(src, new RegExp(res), `${res} n'est plus récupéré`);
  }
  assert.match(src, /\.\.\.histRuns\.map\(\(r\) => String\(r\.date\)\)/, "les séances ne comptent pas dans les dates connues");
});

test("tous les fichiers de test sont dans la chaîne npm test", () => {
  const chaine = JSON.parse(readFileSync("package.json", "utf8")).scripts.test as string;
  const oublies = readdirSync("tests").filter((f) => f.endsWith(".test.ts")).filter((f) => !chaine.includes(`tests/${f}`));
  assert.deepEqual(oublies, [], `test(s) jamais exécuté(s) : ${oublies.join(", ")}`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
