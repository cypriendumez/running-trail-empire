/**
 * LA SAISON À PLUSIEURS PICS (Cyprien, 05/11/2026 : « pour l'élite : les saisons à
 * plusieurs pics »).
 *
 * Avant : le coach ne connaissait que l'objectif déclaré. Les courses du calendrier
 * n'existaient que sur l'écran — une VMA pouvait tomber le jour d'une course inscrite —,
 * ajouter une course depuis la page Courses REMPLAÇAIT l'objectif, une VMA inconnue était
 * remplacée par 14 km/h pour prédire le chrono, et une course sans date partait au
 * calendrier dans 60 jours. Ces tests gardent la saison : priorités A/B/C, la course A la
 * plus proche visée, B avec mini-affûtage et récupération, C à la place d'une qualité.
 *
 *   npx tsx tests/saison.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { prioriteDe, coursesDeSaison, prochaineCourseA, courseSecondaireDeLaSemaine, coursesPassees } from "../src/lib/coach/saison";
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
  id: "u", preferred_language: "fr", full_name: "Test", age: 30, gender: "male", weight_kg: 66, days_per_week: 6,
  available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true, running_years: 6,
};
const BASE = [{ user_id: "u", vma_kmh: 18, max_hr: 195, resting_hr: 45, tested_at: ilYa(30) }];
/** ~60 km par semaine depuis dix semaines. */
const SEANCES = Array.from({ length: 70 }, (_, k) => k + 1).filter((k) => k % 7 !== 3).map((k) => ({
  user_id: "u", date: ilYa(k), type: "easy", sport: "run", distance_km: 10, duration_seconds: 3000,
  avg_hr: 140, max_hr: 155, tss: 55, hr_zone_seconds: [900, 2100, 0, 0, 0],
}));
const objectif = (race: string, n: number, distanceKm: number) => ({ user_id: "u", type: "race_objective",
  data: { race, raceDate: ilYa(n), distanceKm, targetTime: "3h00", targetSeconds: 10800, targetPace: "4'16/km" } });
const planifiee = (name: string, n: number, distanceKm: number, priorite?: string) => ({ user_id: "u", type: "planned_race",
  created_at: `${AUJOURDHUI}T10:00:00Z`, data: { name, date: ilYa(n), distanceKm, ...(priorite ? { priorite } : {}) } });
async function contexte(notifications: Ligne[], seances: Ligne[] = SEANCES): Promise<AthleteContext> {
  return buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: BASE, workouts: seances, notifications }), "u");
}
type Jour = ReturnType<typeof buildWeekPlan>[number];
/** Les séances du jour `i` du plan (0 = aujourd'hui), LUES PAR LEUR DATE : un jour peut en
 *  porter deux (un renforcement, un double), si bien que `plan[i]` n'est pas le jour i. */
const seancesDu = (plan: Jour[], i: number) => plan.filter((j) => j.date === ilYa(-i));
const typesDu = (plan: Jour[], i: number) => seancesDu(plan, i).map((j) => j.type);
const DUR = /VMA|Seuil|Spécifique|Sortie longue|Côtes|Fartlek|Tempo/;

async function main() {
  console.log("\nLA RÈGLE — A, B, C ; la course A la plus proche visée");

  await test("une priorité inconnue est C : noter une course ne bouleverse rien", () => {
    assert.deepEqual(["A", "B", "C", undefined, "Z"].map(prioriteDe), ["A", "B", "C", "C", "C"]);
  });

  await test("la saison réunit l'objectif (A) et le calendrier, sans doublon ni date inventée", () => {
    const s = coursesDeSaison({ race: "Marathon", raceDate: ilYa(-60), distanceKm: 42.2 }, [
      { name: "Marathon", date: ilYa(-60), distanceKm: 42.2 },          // la ligne écrite par « M'entraîner »
      { name: "10 km du parc", date: ilYa(-20), distanceKm: 10, priorite: "B" },
      { name: "Trail à venir", date: "2099-01-01", distanceKm: 20 },
    ]);
    assert.deepEqual(s.map((c) => [c.nom, c.priorite, c.declaree]), [["10 km du parc", "B", false], ["Marathon", "A", true]]);
  });

  await test("la course A la plus proche, la B ou C de la semaine, les courses passées", () => {
    const s = coursesDeSaison(null, [
      { name: "Semi", date: ilYa(-40), distanceKm: 21.1, priorite: "A" },
      { name: "10 km", date: ilYa(-12), distanceKm: 10, priorite: "A" },
      { name: "5 km", date: ilYa(-3), distanceKm: 5, priorite: "C" },
      { name: "Cross", date: ilYa(10), distanceKm: 8, priorite: "B" },
    ]);
    assert.equal(prochaineCourseA(s, AUJOURDHUI)?.nom, "10 km", "la course A la plus proche n'est pas visée");
    assert.deepEqual(courseSecondaireDeLaSemaine(s, AUJOURDHUI, null), { idx: 3, course: s.find((c) => c.nom === "5 km")! });
    assert.deepEqual(coursesPassees(s, AUJOURDHUI).map((c) => c.nom), ["Cross"]);
    // Une course A n'est jamais « secondaire », et rien ne double l'objectif le jour J (le
    // même marathon noté sous un autre nom serait sinon une course C le jour de la course).
    const s2 = coursesDeSaison(null, [
      { name: "Semi", date: ilYa(-2), distanceKm: 21.1, priorite: "A" },
      { name: "Marathon Paris 2027", date: ilYa(-5), distanceKm: 42.2 },
      { name: "Cross", date: ilYa(-6), distanceKm: 8, priorite: "B" },
    ]);
    assert.equal(courseSecondaireDeLaSemaine(s2, AUJOURDHUI, ilYa(-5))?.course.nom, "Cross");
  });

  console.log("\nLE COACH — la saison change l'objectif visé, la semaine et la récupération");

  await test("deux pics : une course A du calendrier avant le marathon devient l'objectif visé", async () => {
    const ctx = await contexte([objectif("Marathon de Paris", -120, 42.2), planifiee("Semi de Lille", -30, 21.1, "A")]);
    assert.equal(ctx.objective?.race, "Semi de Lille", `objectif visé : ${ctx.objective?.race}`);
    assert.equal(ctx.daysToRace, 30);
    assert.ok(!ctx.objective?.targetPace, "un chrono inventé pour une course sans objectif chiffré");
  });

  await test("contre-épreuve : une course A APRÈS l'objectif déclaré ne le remplace pas", async () => {
    const ctx = await contexte([objectif("Marathon de Paris", -60, 42.2), planifiee("Semi d'automne", -150, 21.1, "A")]);
    assert.equal(ctx.objective?.race, "Marathon de Paris");
  });

  await test("le déclaré passé et couru : la course A suivante est visée, la récupération reste", async () => {
    const seances = [...SEANCES.filter((s) => s.date !== ilYa(5)), { ...SEANCES[0], date: ilYa(5), distance_km: 42.5, avg_hr: 168 }];
    const ctx = await contexte([objectif("Marathon de Lille", 5, 42.2), planifiee("10 km de Noël", -50, 10, "A")], seances);
    assert.equal(ctx.objective?.race, "10 km de Noël", "la saison s'arrête au premier pic");
    assert.equal(ctx.recuperation?.course, "Marathon de Lille", "la récupération du marathon couru a disparu");
  });

  await test("une course B dans la semaine : mini-affûtage, une qualité de moins, et le bandeau le dit", async () => {
    const sans = await contexte([objectif("Marathon de Paris", -120, 42.2)]);
    const avec = await contexte([objectif("Marathon de Paris", -120, 42.2), planifiee("10 km du parc", -3, 10, "B")]);
    assert.deepEqual(avec.courseSecondaire, { idx: 3, nom: "10 km du parc", distanceKm: 10, priorite: "B" });
    assert.equal(avec.weekPlan.qBudget, Math.max(0, sans.weekPlan.qBudget - 1), "la course B ne prend pas la place d'une qualité");
    assert.ok(avec.volume.targetKm < sans.volume.targetKm, `pas de mini-affûtage : ${avec.volume.targetKm} km contre ${sans.volume.targetKm}`);
    assert.ok(avec.readiness.reasons.some((r) => /^course B cette semaine : 10 km du parc/.test(r)), JSON.stringify(avec.readiness.reasons));
    assert.ok(avec.macroPlan[0]?.focus.includes("course B : 10 km du parc"), `feuille de route : ${avec.macroPlan[0]?.focus}`);
  });

  await test("dans le plan, la course B a son protocole : veille calme, repos après, pas de sortie longue", async () => {
    const ctx = await contexte([objectif("Marathon de Paris", -120, 42.2), planifiee("10 km du parc", -3, 10, "B")]);
    const plan = buildWeekPlan(ctx, new Date());
    assert.deepEqual(seancesDu(plan, 3).map((j) => [j.type, j.title]), [["Course", "10 km du parc · course B"]]);
    assert.deepEqual(typesDu(plan, 2), ["Récup"], `veille de la course B : ${typesDu(plan, 2)}`);
    assert.ok(typesDu(plan, 4).includes("Repos") && !typesDu(plan, 4).some((t) => DUR.test(t)), `lendemain de la course B : ${typesDu(plan, 4)}`);
    assert.ok(!plan.some((j) => j.type === "Sortie longue"), "sortie longue la semaine d'une course B");
  });

  await test("dans le plan, la course C remplace une qualité : veille calme, rien de dur autour", async () => {
    const ctx = await contexte([objectif("Marathon de Paris", -120, 42.2), planifiee("Cross du club", -2, 8, "C")]);
    const plan = buildWeekPlan(ctx, new Date());
    assert.deepEqual(seancesDu(plan, 2).map((j) => [j.type, j.title]), [["Course", "Cross du club · course C"]]);
    assert.deepEqual(typesDu(plan, 1), ["Récup"], `veille de la course C : ${typesDu(plan, 1)}`);
    for (const i of [1, 3]) assert.ok(!typesDu(plan, i).some((t) => DUR.test(t)), `séance dure le jour ${i}, à côté de la course C : ${typesDu(plan, i)}`);
  });

  await test("sans objectif déclaré, la course B allège aussi la semaine (volume sans feuille de route)", async () => {
    const sans = await contexte([]);
    const avec = await contexte([planifiee("10 km du parc", -3, 10, "B")]);
    assert.equal(avec.macroPlan.length, 0, "ce cas doit se calculer sans feuille de route");
    assert.ok(avec.volume.targetKm < sans.volume.targetKm, `pas de mini-affûtage : ${avec.volume.targetKm} km contre ${sans.volume.targetKm}`);
  });

  // La course C compte comme une séance dure : rien de dur dans les 48 h autour. Rejoué à
  // chaque position de la semaine — d'un jour à l'autre, la sortie longue protège parfois
  // déjà le lendemain, et masquerait une règle cassée. (Vérifié par mutation le 05/11/2026 :
  // la règle retirée ressort six jours sur sept ; un jeudi, la sortie longue du dimanche
  // couvre chaque lendemain.)
  await test("une course C, où qu'elle tombe : rien de dur la veille ni le lendemain", async () => {
    for (let k = 1; k <= 5; k++) {
      const ctx = await contexte([objectif("Marathon de Paris", -120, 42.2), planifiee("Cross du club", -k, 8, "C")]);
      assert.ok(ctx.weekPlan.qBudget >= 1, "il faut au moins une qualité à placer pour que ce test dise quelque chose");
      const plan = buildWeekPlan(ctx, new Date());
      assert.deepEqual(typesDu(plan, k), ["Course"], `course C à J+${k} : ${typesDu(plan, k)}`);
      for (const i of [k - 1, k + 1]) {
        assert.ok(!typesDu(plan, i).some((t) => DUR.test(t)), `course C à J+${k} : séance dure à J+${i} (${typesDu(plan, i)})`);
      }
    }
  });

  await test("une course notée sans priorité est une C : le coach ne la piétine plus", async () => {
    const ctx = await contexte([objectif("Marathon de Paris", -120, 42.2), planifiee("Corrida", -4, 10)]);
    assert.equal(ctx.courseSecondaire?.priorite, "C");
    assert.deepEqual(typesDu(buildWeekPlan(ctx, new Date()), 4), ["Course"], "une course du calendrier recouverte par une séance");
  });

  await test("après une course B courue, la récupération s'applique", async () => {
    const seances = [...SEANCES.filter((s) => s.date !== ilYa(2)), { ...SEANCES[0], date: ilYa(2), distance_km: 10.2, avg_hr: 172 }];
    const ctx = await contexte([objectif("Marathon de Paris", -120, 42.2), planifiee("10 km du parc", 2, 10, "B")], seances);
    assert.equal(ctx.recuperation?.course, "10 km du parc", "aucune récupération après la course B");
  });

  console.log("\nLA ROUTE ET LES ÉCRANS");

  await test("ajouter une course n'écrase plus l'objectif, et aucune VMA n'est inventée", () => {
    const src = codeNu("src/app/api/calendar-entry/route.ts");
    assert.doesNotMatch(src, /\?\? 14/, "la VMA de repli à 14 km/h est revenue");
    assert.match(src, /if \(b\.kind === "race" && prioriteDe\(b\.priorite\) === "A"\) \{/, "une course B ou C peut devenir l'objectif");
    // Une lecture en échec de l'objectif ne vaut pas « aucun objectif » : elle l'écraserait.
    assert.match(src, /if \(!eObjectif && !objectifAVenir && vma != null\) \{/, "l'objectif à venir est écrasé, ou fixé sans VMA");
    assert.match(src, /priorite: prioriteDe\(b\.priorite\)/, "la priorité n'est pas enregistrée");
    const patch = src.slice(src.indexOf("export async function PATCH"), src.indexOf("export async function DELETE"));
    assert.match(patch, /\.eq\("id", b\.id\)\.eq\("user_id", user\.id\)\.eq\("type", "planned_race"\)\.maybeSingle\(\)/, "la priorité d'une course d'un autre athlète peut changer");
    assert.match(patch, /\.update\(\{ data \}\)\.eq\("id", b\.id\)\.eq\("user_id", user\.id\)/, "l'écriture n'est pas bornée à l'athlète");
    assert.match(patch, /if \(error\) return NextResponse\.json/, "l'échec de l'écriture passe inaperçu");
  });

  await test("la page Courses n'invente plus de date et envoie la priorité A", () => {
    const src = codeNu("src/components/races/RacesHub.tsx");
    assert.doesNotMatch(src, /Date\.now\(\) \+ 60 \* 86400000/, "une date à 60 jours est encore inventée");
    assert.match(src, /if \(!r\.date \|\| r\.date\.startsWith\("2099"\)\) \{ toast\(d\["t\.sansDate"\]\); return; \}/);
    assert.match(src, /priorite: "A"/);
    const i18n = readFileSync("src/components/races/racesI18n.ts", "utf8");
    assert.equal(i18n.split('"t.sansDate":').length - 1, 5, "le message manque dans une langue");
  });

  await test("le calendrier choisit la priorité à l'ajout et la change ensuite", () => {
    const src = codeNu("src/components/training/CalendarView.tsx");
    assert.match(src, /distanceKm: race\.distanceKm, priorite: race\.priorite \}/, "la priorité n'est pas envoyée à l'ajout");
    assert.match(src, /fetch\("\/api\/calendar-entry", \{ method: "PATCH"/, "la priorité ne se change pas");
    assert.match(codeNu("src/app/dashboard/calendrier/page.tsx"), /priorite: prioriteDe\(d\.priorite\)/, "la priorité n'est pas lue");
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
