/**
 * LES ZONES D'UN TEST DE LACTATE (Cyprien, 05/11/2026 : « pour l'élite : les zones issues
 * de tests de lactate »).
 *
 * Avant : l'allure seuil venait de la vitesse critique d'intervals.icu ou de 86 % de la VMA,
 * l'allure facile des footings récents ou de 70 % de la VMA. Un test de lactate MESURE les
 * deux seuils : il passe devant pendant six mois. Ces tests gardent la saisie (contrôlée
 * côté serveur), la durée de validité, et l'effet sur les allures du coach.
 *
 *   npx tsx tests/lactate.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { lireAllure, fmtAllure, validerTestLactate, testEnVigueur, allureFacileMaxSec, TYPE_TEST_LACTATE, type TestLactate } from "../src/lib/coach/lactate";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
/** Le source sans ses commentaires — sans couper les `://` des adresses. */
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

type Ligne = Record<string, unknown>;
/** Faux client PostgREST en mémoire : eq, gte, lte, in, order, limit, single, maybeSingle. */
function fauxClient(tables: Record<string, Ligne[]>) {
  const requete = (toutes: Ligne[]) => {
    let lignes = [...toutes]; let tri: [string, boolean] | null = null; let lim: number | null = null;
    const q: Record<string, unknown> = {};
    const cmp = (op: (a: string, b: string) => boolean) => (c: string, v: unknown) => {
      lignes = lignes.filter((l) => !(c in l) || (l[c] != null && op(String(l[c]), String(v)))); return q;
    };
    for (const m of ["select", "not", "ilike", "or", "neq", "is"]) q[m] = () => q;
    q.eq = (c: string, v: unknown) => { lignes = lignes.filter((l) => !(c in l) || l[c] === v); return q; };
    q.gte = cmp((a, b) => a >= b); q.lte = cmp((a, b) => a <= b); q.gt = cmp((a, b) => a > b); q.lt = cmp((a, b) => a < b);
    q.in = (c: string, vs: unknown[]) => { lignes = lignes.filter((l) => !(c in l) || vs.includes(l[c])); return q; };
    q.order = (c: string, o?: { ascending?: boolean }) => { tri = [c, o?.ascending !== false]; return q; };
    q.limit = (n: number) => { lim = n; return q; };
    const fin = () => {
      let r = lignes;
      if (tri) {
        const [c, asc] = tri;
        r = [...r].sort((a, b) => (String(a[c] ?? "") < String(b[c] ?? "") ? -1 : String(a[c] ?? "") > String(b[c] ?? "") ? 1 : 0) * (asc ? 1 : -1));
      }
      return lim != null ? r.slice(0, lim) : r;
    };
    q.single = () => { const r = fin(); return Promise.resolve({ data: r[0] ?? null, error: r[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: fin()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: fin(), error: null }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(tables[t] ?? []) } as never;
}

const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
const ilYa = (n: number) => {
  const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
};
const PROFIL = {
  id: "u", preferred_language: "fr", full_name: "Test", age: 30, gender: "male", weight_kg: 66, days_per_week: 5,
  available_days: [1, 2, 3, 4, 6], health_conditions: [], injury_zones: [], health_declared: true, running_years: 6,
};
const BASE = [{ user_id: "u", vma_kmh: 19, max_hr: 195, resting_hr: 45, tested_at: ilYa(30) }];
/** Des footings à 4'10/km : plus vite que le seuil 1 du test ci-dessous. */
const FOOTINGS = Array.from({ length: 30 }, (_, k) => ({
  user_id: "u", date: ilYa(k * 2 + 1), type: "easy", sport: "run", distance_km: 12, duration_seconds: 12 * 250,
  avg_hr: 140, max_hr: 155, tss: 60, hr_zone_seconds: [900, 2100, 0, 0, 0],
}));
const TEST: TestLactate = { date: ilYa(20), lt1: { allureSec: 260, fc: 148 }, lt2: { allureSec: 222, fc: 172 } };
const ligne = (t: TestLactate, creeLe = `${t.date}T18:00:00Z`) => ({ user_id: "u", type: TYPE_TEST_LACTATE, created_at: creeLe, data: t });
async function contexte(notifications: Ligne[]): Promise<AthleteContext> {
  return buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: BASE, workouts: FOOTINGS, notifications }), "u");
}

async function main() {
  console.log("\nLA SAISIE — contrôlée côté serveur, erreurs en codes que l'écran traduit");

  await test("les allures s'écrivent comme sur une montre", () => {
    assert.equal(lireAllure("3'45"), 225);
    assert.equal(lireAllure("3:45"), 225);
    assert.equal(lireAllure("3’45/km"), 225);
    assert.equal(lireAllure("345"), null);
    assert.equal(lireAllure("3'75"), null, "75 secondes acceptées");
    assert.equal(fmtAllure(225), "3'45");
  });

  await test("un test complet et cohérent passe ; chaque incohérence a son code", () => {
    const bon = { date: ilYa(10), lt1: { allure: "4'20", fc: "148" }, lt2: { allure: "3'42", fc: 172 } };
    assert.deepEqual(validerTestLactate(bon, AUJOURDHUI), { test: { date: ilYa(10), lt1: { allureSec: 260, fc: 148 }, lt2: { allureSec: 222, fc: 172 } } });
    const sansFc = { ...bon, lt1: { allure: "4'20", fc: "" }, lt2: { allure: "3'42" } };
    assert.ok("test" in validerTestLactate(sansFc, AUJOURDHUI), "la fréquence cardiaque est devenue obligatoire");
    const erreur = (b: unknown) => { const v = validerTestLactate(b, AUJOURDHUI); return "erreur" in v ? v.erreur : null; };
    assert.equal(erreur({ ...bon, date: ilYa(-3) }), "date", "un test daté du futur passe");
    assert.equal(erreur({ ...bon, date: ilYa(800) }), "date", "un test de plus de deux ans passe");
    assert.equal(erreur({ ...bon, lt2: { allure: "2'10" } }), "allure", "une allure hors bornes passe");
    assert.equal(erreur({ ...bon, lt1: { allure: "3'44" } }), "ordre", "un seuil 1 à peine plus lent que le seuil 2 passe");
    assert.equal(erreur({ ...bon, lt1: { allure: "4'20", fc: 300 } }), "fc", "une FC de 300 passe");
    assert.equal(erreur({ ...bon, lt1: { allure: "4'20", fc: 175 } }), "ordreFc", "une FC du seuil 1 au-dessus du seuil 2 passe");
  });

  await test("un test pilote six mois, pas plus, et jamais daté du futur", () => {
    assert.ok(testEnVigueur({ ...TEST, date: ilYa(170) }, AUJOURDHUI));
    assert.equal(testEnVigueur({ ...TEST, date: ilYa(200) }, AUJOURDHUI), null, "un test de sept mois pilote encore");
    assert.equal(testEnVigueur({ ...TEST, date: ilYa(-1) }, AUJOURDHUI), null);
    assert.equal(allureFacileMaxSec(TEST), 270, "le footing peut atteindre le seuil 1");
  });

  console.log("\nLE COACH — le test passe devant la vitesse critique et la VMA");

  await test("le seuil 2 devient l'allure seuil, et le modèle sait d'où elle vient", async () => {
    const ctx = await contexte([ligne(TEST)]);
    assert.equal(ctx.thresholdPace, "3'42", `allure seuil ${ctx.thresholdPace}, pas le seuil 2 du test`);
    assert.match(ctx.text, /TEST DE LACTATE du .* seuil 1 \(aérobie\) 4'20\/km à 148 bpm, seuil 2 3'42\/km à 172 bpm/);
    assert.match(ctx.text, /ALLURE SEUIL \*\*MESURÉE\*\* : 3'42\/km \(seuil 2 du test de lactate/);
    assert.doesNotMatch(ctx.text, /vitesse critique NaN/, "« vitesse critique NaN km/h » sans courbe d'allure");
  });

  await test("le footing reste sous le seuil 1, même s'il court plus vite d'habitude", async () => {
    const sans = await contexte([]);
    const avec = await contexte([ligne(TEST)]);
    const sec = (p: string | null) => { const m = p?.match(/(\d+)'(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
    assert.ok(sec(sans.easyPace) < 270, `précondition : footing habituel à ${sans.easyPace}, déjà plus lent que le seuil 1`);
    assert.equal(avec.easyPace, "4'30", `footing à ${avec.easyPace} au lieu de 4'30 (seuil 1 + 10 s)`);
  });

  await test("le plus récent fait foi ; un test périmé ne pilote plus rien", async () => {
    const ancien: TestLactate = { date: ilYa(60), lt1: { allureSec: 280, fc: null }, lt2: { allureSec: 240, fc: null } };
    const ctx = await contexte([ligne(ancien, `${ilYa(60)}T18:00:00Z`), ligne(TEST, `${ilYa(20)}T18:00:00Z`)]);
    assert.equal(ctx.thresholdPace, "3'42", "un test plus ancien l'emporte");
    const perime = await contexte([ligne({ ...TEST, date: ilYa(200) })]);
    assert.notEqual(perime.thresholdPace, "3'42", "un test de sept mois pilote encore l'allure seuil");
  });

  console.log("\nLA ROUTE ET LA CARTE");

  await test("la route prend l'athlète dans la session, contrôle la saisie et lit son erreur", () => {
    const src = codeNu("src/app/api/lactate/route.ts");
    assert.match(src, /const \{ data: \{ user \} \} = await sb\.auth\.getUser\(\);/);
    assert.match(src, /validerTestLactate\(body, aujourdhui\(FUSEAU_DEFAUT\)\)/, "la saisie n'est pas contrôlée côté serveur");
    assert.match(src, /user_id: user\.id, type: TYPE_TEST_LACTATE/, "l'identifiant ne vient pas de la session");
    assert.match(src, /if \(error\) \{\s*console\.error\(/, "l'échec de l'écriture est muet");
    const exports = [...src.matchAll(/^export (?:const|async function|function) (\w+)/gm)].map((m) => m[1]);
    assert.deepEqual(exports.sort(), ["GET", "POST", "dynamic"], `export interdit dans une route Next : ${exports}`);
  });

  await test("la carte lit le jour dans le fuseau de l'athlète et parle les cinq langues", () => {
    const src = codeNu("src/components/profile/TestLactateCard.tsx");
    assert.match(src, /const aujourdhui = jourDans\(useFuseau\(\)\);/, "le jour vient de l'horloge du navigateur (#418 vers minuit)");
    assert.doesNotMatch(src, /new Date\(\)/);
    assert.match(src, /fetch\("\/api\/lactate", \{\s*method: "POST"/);
    const brut = readFileSync("src/components/profile/TestLactateCard.tsx", "utf8");
    assert.equal(brut.split("ordreFc:").length - 1, 5, "un message d'erreur manque dans une langue");
    assert.match(codeNu("src/components/profile/ProfileSettings.tsx"), /<TestLactateCard \/>/, "la carte n'est plus dans le profil");
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
