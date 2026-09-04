/**
 * CE QUI ARRIVE À L'ÉCRAN QUAND LE CHIFFRE MANQUE.
 *
 * `src/lib/running/fitness.ts` et `volume.ts` produisent la VMA, les prédictions de
 * chrono, les allures et le volume AFFICHÉS. Ils n'avaient aucun crash-test, alors que
 * les modules voisins de `lib/dashboard` en ont un depuis longtemps.
 *
 * Le sondage du 04/09/2026 a relevé 73 sorties non finies, dont `racePredictions(null)`
 * qui rendait littéralement « InfinityhNaN » et « Infinity'NaN/km » — des chaînes prêtes
 * à s'afficher telles quelles.
 *
 * ⚠️ HONNÊTETÉ SUR LA PORTÉE : les quatre appelants réels gardaient tous leur entrée
 * (`vma > 0`), donc rien de tel n'était affiché. Ce n'était pas un défaut vivant mais
 * une fragilité — et ce test existe pour que le cinquième appelant, celui qui oubliera
 * la garde, tombe ici plutôt que sur le tableau de bord d'un athlète.
 *
 * ⚠️ ET LE PIÈGE MAISON : `?? 0` NE RATTRAPE PAS `NaN`. Il ne voit que `null` et
 * `undefined`. Seul `Number.isFinite` voit un NaN.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as F from "../src/lib/running/fitness";
import * as V from "../src/lib/running/volume";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/** Tout ce qu'une colonne de base peut rendre quand elle va mal. */
const MAUVAIS = [null, undefined, NaN, Infinity, -Infinity, 0, -1, 1e9, "12" as unknown as number];

/** Cherche récursivement une valeur non finie, ou son empreinte dans un texte. */
function taches(nom: string, v: unknown, out: string[] = []): string[] {
  if (typeof v === "number" && !Number.isFinite(v)) out.push(`${nom} → ${v}`);
  else if (typeof v === "string" && /NaN|Infinity|undefined/.test(v)) out.push(`${nom} → « ${v} »`);
  else if (Array.isArray(v)) v.forEach((x, i) => taches(`${nom}[${i}]`, x, out));
  else if (v && typeof v === "object") for (const [k, y] of Object.entries(v)) taches(`${nom}.${k}`, y, out);
  return out;
}

test("aucun calcul affiché ne rend NaN ni Infinity", () => {
  const sales: string[] = [];
  const essai = (nom: string, fn: () => unknown) => {
    try { sales.push(...taches(nom, fn())); }
    catch (e) { sales.push(`${nom} → LÈVE : ${(e as Error).message.slice(0, 50)}`); }
  };
  for (const x of MAUVAIS) {
    const s = String(x);
    essai(`vmaFrom6min(${s})`, () => F.vmaFrom6min(x as number));
    essai(`vmaFromVo2max(${s})`, () => F.vmaFromVo2max(x as number));
    essai(`vo2maxLabel(${s})`, () => F.vo2maxLabel(x as number));
    essai(`fmtTime(${s})`, () => F.fmtTime(x as number));
    essai(`fmtPaceSec(${s})`, () => F.fmtPaceSec(x as number));
    essai(`pctVmaForDistance(${s})`, () => F.pctVmaForDistance(x as number));
    essai(`predictRaceSec(${s},10)`, () => F.predictRaceSec(x as number, 10));
    essai(`predictRaceSec(15,${s})`, () => F.predictRaceSec(15, x as number));
    essai(`racePredictions(${s})`, () => F.racePredictions(x as number));
    essai(`vmaFromEffort(${s},1800)`, () => F.vmaFromEffort(x as number, 1800));
    essai(`vmaFromEffort(10,${s})`, () => F.vmaFromEffort(10, x as number));
    essai(`raceProjection(${s},42,12000,8)`, () => F.raceProjection(x as number, 42, 12000, 8));
    essai(`longRunShare(marathon,${s})`, () => V.longRunShare("marathon" as never, x as number));
    essai(`longRunPeakKm(marathon,${s})`, () => V.longRunPeakKm("marathon" as never, x as number));
  }
  essai("robustWeeklyKm([])", () => V.robustWeeklyKm([] as never));
  essai("demonstratedWeeklyKm([])", () => V.demonstratedWeeklyKm([] as never));
  essai("effectiveVma({})", () => F.effectiveVma({} as never));
  essai("vmaFromPaceCurve(null)", () => F.vmaFromPaceCurve(null));
  essai("vmaFromPaceCurve([{m:0,sec:0}])", () => F.vmaFromPaceCurve([{ m: 0, sec: 0 }]));
  essai("loadRisk([])", () => F.loadRisk([]));

  assert.deepEqual([...new Set(sales)], [],
    `ces sorties partiraient telles quelles à l'écran :\n    ${[...new Set(sales)].slice(0, 10).join("\n    ")}`);
});

test("le balayage éprouve vraiment quelque chose", () => {
  // ⚠️ Un fuzz qui n'appelle rien passe toujours. On compte les appels réellement faits.
  let appels = 0;
  const compter = (fn: () => unknown) => { try { fn(); } catch { /* compté quand même */ } appels++; };
  for (const x of MAUVAIS) { compter(() => F.fmtTime(x as number)); compter(() => F.racePredictions(x as number)); }
  assert.ok(appels >= 18, `seulement ${appels} appels : le balayage ne couvre plus les entrées limites`);
  // Et sur une entrée SAINE, les mêmes fonctions doivent produire un vrai résultat —
  // sinon un module qui refuse tout satisferait le test ci-dessus.
  assert.match(F.fmtTime(3725), /^\d+:\d\d(:\d\d)?$|^1h/, `fmtTime(3725) rend « ${F.fmtTime(3725)} »`);
  assert.notEqual(F.fmtTime(3725), F.NON_CHIFFRE, "fmtTime refuse une durée parfaitement valable");
  assert.ok(F.racePredictions(16).length > 0, "aucune prédiction pour une VMA de 16");
  assert.ok(F.vmaFromVo2max(56) > 15, `vmaFromVo2max(56) rend ${F.vmaFromVo2max(56)}`);
});

test("le résumé de la semaine ne somme pas des NaN", () => {
  // ⚠️ `?? 0` ne voit que null/undefined. Une seule valeur non numérique dans la colonne
  // et le total hebdomadaire s'affichait « NaN km », sur la première carte du dashboard.
  const src = readFileSync("src/components/dashboard/BentoDashboard.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  const i = src.indexOf("function computeWeekSummary");
  assert.ok(i > 0, "le résumé de la semaine a disparu");
  const bloc = src.slice(i, i + 900);
  assert.ok(/Number\.isFinite/.test(bloc), "la somme hebdomadaire ne se protège plus du NaN");
  assert.ok(!/\?\?\s*0\)/.test(bloc), "la somme est revenue à « ?? 0 », qui ne voit pas les NaN");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
