/**
 * LE JOUR 0 DU PLAN EST CELUI DU COUREUR, PAS CELUI DU SERVEUR (16/11/2026).
 *
 * Les fonctions Vercel tournent en UTC ; le contexte du coach raisonne sur le jour du coureur
 * (`aujourdhui(FUSEAU_DEFAUT)`, Paris). Entre minuit et 1 h (2 h l'été), heure de Paris, le serveur est
 * encore la veille : le plan commençait donc la veille du coureur (republiée, et renvoyée à la montre),
 * les courses B et C et le message de la course C tombaient un jour trop tôt, et `daysToRace` affichait
 * un jour de trop (la course A, elle, restait à sa date). Ce test se place sur un serveur en UTC, à
 * 23 h 30 UTC (0 h 30 à Paris le lendemain), et suit le chemin de production. Il exige ensuite que le
 * même jour du coureur reçoive le même plan à 0 h 30 et à 9 h (dernière séance dure, semaine du bloc).
 *
 *   npx tsx tests/jour0-coureur.test.ts
 */
process.env.TZ = "UTC";   // le fuseau des fonctions Vercel — AVANT toute date
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { instantDuJour, aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const code = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

type Ligne = Record<string, unknown>;
/** Faux client PostgREST (lectures seulement) : eq, gte, lte, order, limit, single, maybeSingle. */
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
      if (tri) { const [c, asc] = tri; r = [...r].sort((a, b) => (String(a[c] ?? "") < String(b[c] ?? "") ? -1 : String(a[c] ?? "") > String(b[c] ?? "") ? 1 : 0) * (asc ? 1 : -1)); }
      return lim != null ? r.slice(0, lim) : r;
    };
    q.single = () => { const r = fin(); return Promise.resolve({ data: r[0] ?? null, error: r[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: fin()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: fin(), error: null }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(tables[t] ?? []) } as never;
}

/** Exécute `fn` à l'instant `iso` exact (le coach et le plan lisent `new Date()`). */
async function aLInstant<T>(iso: string, fn: () => Promise<T>): Promise<T> {
  const Vrai = Date;
  const delta = Vrai.parse(iso) - Vrai.now();
  class Faux extends Vrai {
    constructor(...a: unknown[]) { if (a.length === 0) super(Vrai.now() + delta); else super(...(a as [number])); }
    static now() { return Vrai.now() + delta; }
  }
  (globalThis as { Date: DateConstructor }).Date = Faux as DateConstructor;
  try { return await fn(); } finally { (globalThis as { Date: DateConstructor }).Date = Vrai; }
}

const jourMoins = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
/**
 * Un coureur ordinaire : 5 jours, ~40 km/sem depuis dix semaines, un 10 km le 21/11/2026.
 * `dureVeille` : sa dernière sortie (la veille) est un fractionné. `objectif: false` : aucune course.
 * `qualiteIlYa` : sa dernière série de qualité relevée (`last_quality_exec`) date d'autant de jours.
 * `nuitCourteIlYa` : sa dernière nuit enregistrée, courte et mal notée, date d'autant de jours (les
 *   treize d'avant sont bonnes), comme une montre qu'il n'a plus portée depuis.
 * `riche` : VFC quotidienne, nuits enregistrées jusqu'à avant-hier (la dernière mauvaise), et des
 *   prescriptions passées calées sur les BORNES des fenêtres de 14 et 28 jours. Repos les jours n ≡ 0
 *   et n ≡ 3 (mod 7) au lieu de 3 et 6 : les prescriptions manquées tombent sur des jours sans sortie.
 *   - 14 j (adhérence) : faites à 2 et 4 j, manquées à 3 et 10 j, soit 2/4 = 50 %, pas « < 50 % » ;
 *     une de plus à 14 j (2/5) déclencherait le facteur limitant « régularité ».
 *   - 28 j (jours ratés) : le même jour de la semaine manqué à 14 et 21 j (2 fois, pas « ≥ 3 ») ;
 *     un 3e à 28 j retirerait ce jour du plan.
 */
type Options = { dureVeille?: boolean; objectif?: boolean; qualiteIlYa?: number; nuitCourteIlYa?: number; riche?: boolean; manquees?: number[] };
function tables(jourCoureur: string, o: Options = {}): Record<string, Ligne[]> {
  const repos = o.riche ? [0, 3] : [3, 6];
  const manquees = o.manquees ?? [];
  const nuit = (age: number, courte: boolean) => ({ user_id: "u", date: jourMoins(jourCoureur, age),
    sleep_score: courte ? 40 : 82, total_sleep_min: courte ? 300 : 470, deep_sleep_min: 80, rem_sleep_min: 90, body_battery_end: 70, respiration_rate: 14 });
  const derniereNuit = o.nuitCourteIlYa ?? (o.riche ? 2 : null);
  const prescription = (age: number) => ({ user_id: "u", type: "coach_session", data: { date: jourMoins(jourCoureur, age), sessionType: "Endurance" } });
  return {
    profiles: [{ id: "u", preferred_language: "fr", full_name: "Test", age: 30, gender: "male", weight_kg: 68, max_hr: 190,
      days_per_week: 5, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true,
      last_quality_exec: o.qualiteIlYa == null ? null
        : { date: jourMoins(jourCoureur, o.qualiteIlYa), repsSec: [230, 232, 236, 245], avgHr: 172, fadeSec: 15 } }],
    performance_baselines: [{ user_id: "u", vma_kmh: 16, max_hr: 190, tested_at: jourMoins(jourCoureur, 30) }],
    workouts: Array.from({ length: 70 }, (_, k) => k + 1).filter((n) => !repos.includes(n % 7) && !manquees.includes(n)).map((n) => ({
      user_id: "u", date: jourMoins(jourCoureur, n), type: n === 1 && o.dureVeille ? "intervals" : "easy", sport: "run",
      distance_km: 8, duration_seconds: 2640, elevation_gain_m: 30, avg_hr: 140, max_hr: 155, tss: 40 })),
    sleep_data: derniereNuit == null ? [] : Array.from({ length: 14 }, (_, k) => nuit(derniereNuit + k, k === 0)),
    hrv_data: o.riche ? Array.from({ length: 30 }, (_, k) => ({ user_id: "u", date: jourMoins(jourCoureur, k + 1), rmssd: 62 + (k % 3), sdnn: null })) : [],
    notifications: [
      ...(o.objectif === false ? [] : [{ user_id: "u", type: "race_objective", data: { race: "10 km A", raceDate: "2026-11-21", distanceKm: 10, targetTime: "42'00", targetSeconds: 2520, targetPace: "4'12/km" } }]),
      ...(o.riche ? [2, 3, 4, 10, 14, 21, 28].map(prescription) : []),
      ...manquees.map(prescription),
    ],
  };
}

/** 0 h 30 au jour `jour` à Paris, vu du serveur en UTC (`decalageH` : 1 l'hiver, 2 l'été) : la veille UTC. */
const nuitDe = (jour: string, decalageH: number) => {
  const d = new Date(`${jour}T00:30:00Z`); d.setUTCHours(d.getUTCHours() - decalageH); return d.toISOString();
};
/** Le contexte et le plan du coach à un instant donné, comme en production (jour 0 = celui du contexte). */
async function lecture(instant: string, jourCoureur: string, o: Options = {}) {
  return aLInstant(instant, async () => {
    const ctx = await buildAthleteContext(fauxClient(tables(jourCoureur, o)), "u");
    return { ctx, plan: buildWeekPlan(ctx, instantDuJour(ctx.jour0 ?? "")), jourServeur: new Date().getDate() };
  });
}
/** Ce que le coureur voit d'un jour : sa date et le type de chaque séance. */
const seances = (plan: { date: string; type: string }[]) => plan.map((d) => `${d.date} ${d.type}`);

async function main() {
  console.log("\nLE JOUR 0 DU PLAN — serveur en UTC, 23 h 30 UTC = 0 h 30 à Paris le lendemain");
  const INSTANT = "2026-11-17T23:30:00Z";   // Paris (UTC+1 en novembre) : 18/11 à 0 h 30
  const JOUR_COUREUR = "2026-11-18";

  await test("précondition : le serveur est bien la veille du coureur", async () => {
    await aLInstant(INSTANT, async () => {
      assert.equal(new Date().getDate(), 17, "le faux serveur n'est pas en UTC le 17");
      assert.equal(aujourdhui(FUSEAU_DEFAUT), JOUR_COUREUR, "le coureur n'est pas le 18 à Paris");
    });
  });

  await test("instantDuJour : un instant dont le jour LOCAL est ce jour civil, quel que soit le fuseau du serveur", () => {
    for (const tz of ["UTC", "Pacific/Auckland", "America/Los_Angeles", "Europe/Paris"]) {
      process.env.TZ = tz;
      for (const j of ["2026-11-18", "2026-03-29", "2026-10-25", "2026-01-01"]) {
        const d = instantDuJour(j);
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        assert.equal(local, j, `${tz} : instantDuJour(${j}) tombe le ${local}`);
      }
    }
    process.env.TZ = "UTC";
  });

  await test("le contexte compte les jours jusqu'à la course depuis le jour du COUREUR, et le porte (`jour0`)", async () => {
    const ctx = await aLInstant(INSTANT, () => buildAthleteContext(fauxClient(tables(JOUR_COUREUR)), "u")) as AthleteContext;
    assert.equal(ctx.jour0, JOUR_COUREUR, `le contexte ne porte pas le jour du coureur (${ctx.jour0})`);
    assert.equal(ctx.daysToRace, 3, `course le 21/11, coureur le 18/11 : J-${ctx.daysToRace} au lieu de J-3 (compté depuis l'heure du serveur)`);
  });

  await test("le plan du coach commence le jour du coureur, et sa course tombe le bon jour", async () => {
    const { plan, serveur } = await aLInstant(INSTANT, async () => {
      const ctx = await buildAthleteContext(fauxClient(tables(JOUR_COUREUR)), "u");
      return { plan: buildWeekPlan(ctx, instantDuJour(ctx.jour0 ?? "")), serveur: buildWeekPlan(ctx, new Date()) };
    });
    // Contre-épreuve : construit à l'heure du serveur (ce que faisait le coach), le plan commence la veille.
    assert.equal(serveur[0]?.date, "2026-11-17", `précondition : à l'heure du serveur, le plan devrait commencer le 17 (${serveur[0]?.date})`);
    assert.equal(plan[0]?.date, JOUR_COUREUR, `le plan commence le ${plan[0]?.date}`);
    const course = plan.find((d) => d.type === "Course");
    assert.equal(course?.date, "2026-11-21", `la course est posée le ${course?.date}`);
    assert.ok(!plan.some((d) => d.date < JOUR_COUREUR), "le plan contient un jour déjà passé pour le coureur");
  });

  // ── LE MÊME JOUR DU COUREUR, LA NUIT ET LE MATIN : LE MÊME PLAN (@HeadCoach, 16/11/2026) ──
  // Déplacer le jour 0 sans déplacer les NUMÉROS de jour et de semaine que le plan lit les rendait
  // contradictoires la nuit : une séance dure de la veille comptait « aujourd'hui », la semaine du
  // bloc restait celle d'avant le lundi.

  await test("séance dure la veille : à 0 h 30, elle date d'hier, et le jour 0 n'est pas une récupération forcée", async () => {
    const n = await lecture(INSTANT, JOUR_COUREUR, { dureVeille: true });
    const m = await lecture("2026-11-18T08:00:00Z", JOUR_COUREUR, { dureVeille: true });
    assert.equal(m.ctx.lastHardDaysAgo, 1, `précondition : à 9 h, le fractionné de la veille date de ${m.ctx.lastHardDaysAgo} j`);
    assert.equal(n.ctx.lastHardDaysAgo, 1, `à 0 h 30, le fractionné de la veille compte comme « il y a ${n.ctx.lastHardDaysAgo} j » (heure du serveur)`);
    assert.deepEqual(seances(n.plan), seances(m.plan), "à 0 h 30 et à 9 h, le même jour du coureur ne reçoit pas le même plan");
  });

  await test("la nuit du dimanche au lundi, la semaine allégée du bloc ne saute pas", async () => {
    const n = await lecture(nuitDe("2026-11-16", 1), "2026-11-16", { objectif: false });
    const m = await lecture("2026-11-16T08:00:00Z", "2026-11-16", { objectif: false });
    assert.equal(n.jourServeur, 15, "précondition : à 0 h 30 le lundi à Paris, le serveur est encore dimanche");
    assert.equal(m.ctx.cycle.deload, true, "précondition : le lundi 16/11/2026 (semaine ISO 47) ouvre la semaine allégée");
    assert.equal(n.ctx.cycle.deload, true, "à 0 h 30 le lundi, la semaine allégée a sauté (semaine du bloc prise à l'heure du serveur)");
    assert.deepEqual(seances(n.plan), seances(m.plan), "le lundi à 0 h 30 et à 9 h, le plan diffère");
  });

  await test("dernière qualité relevée (12 et 13 jours) : même verdict à 0 h 30 et à 9 h", async () => {
    // Ancrée à midi, elle ne bascule pas la nuit (elle bascule à midi UTC, suivi à part). Ce test
    // empêche de la compter un jour au jour UTC du serveur, qui la ferait basculer à minuit UTC.
    const ligne = "EXÉCUTION DE SA DERNIÈRE QUALITÉ";
    const douze = await lecture("2026-11-18T08:00:00Z", JOUR_COUREUR, { qualiteIlYa: 12 });
    assert.ok(douze.ctx.text.includes(ligne), "précondition : à 9 h, une série de 12 jours est citée au coach");
    for (const age of [12, 13]) {
      const n = await lecture(INSTANT, JOUR_COUREUR, { qualiteIlYa: age });
      const m = await lecture("2026-11-18T08:00:00Z", JOUR_COUREUR, { qualiteIlYa: age });
      assert.equal(n.ctx.text.includes(ligne), m.ctx.text.includes(ligne),
        `série de ${age} j : ${n.ctx.text.includes(ligne) ? "citée" : "écartée"} à 0 h 30, ${m.ctx.text.includes(ligne) ? "citée" : "écartée"} à 9 h`);
    }
  });

  await test("prescriptions passées : aujourd'hui et les 13 (14 j) ou 27 (28 j) jours d'avant comptent, à 0 h 30 comme à 9 h", async () => {
    const jourSemaine = (age: number) => new Date(`${jourMoins(JOUR_COUREUR, age)}T12:00:00Z`).getUTCDay();
    for (const instant of [INSTANT, "2026-11-18T08:00:00Z"]) {
      // 28 j : le même jour de la semaine manqué à 13, 20 et 27 jours, c'est 3 fois : retiré du plan.
      const rates = await lecture(instant, JOUR_COUREUR, { objectif: false, manquees: [13, 20, 27] });
      assert.deepEqual(rates.ctx.skippedWeekdays, [jourSemaine(13)],
        `${instant} : manqué à 13, 20 et 27 j, ce jour de la semaine n'est pas retiré (${JSON.stringify(rates.ctx.skippedWeekdays)})`);
      // 14 j : manquées à 3, 6, 10 et 13 jours, soit 0 sur 4 : facteur « régularité ».
      const adherence = await lecture(instant, JOUR_COUREUR, { objectif: false, manquees: [3, 6, 10, 13] });
      assert.ok(adherence.ctx.text.includes("RÉGULARITÉ, pas la physiologie"),
        `${instant} : 4 prescriptions manquées sur 14 jours (dont une à 13 j) ne déclenchent pas le facteur « régularité »`);
    }
  });

  await test("une mauvaise nuit d'avant-hier ne pèse pas plus à 0 h 30 qu'à 9 h sur le niveau de forme", async () => {
    const hier = await lecture("2026-11-18T08:00:00Z", JOUR_COUREUR, { nuitCourteIlYa: 1 });
    const n = await lecture(INSTANT, JOUR_COUREUR, { nuitCourteIlYa: 2 });
    const m = await lecture("2026-11-18T08:00:00Z", JOUR_COUREUR, { nuitCourteIlYa: 2 });
    assert.notEqual(hier.ctx.readiness.level, "vert", "précondition : une nuit courte datée d'hier abaisse le niveau de forme");
    assert.equal(m.ctx.readiness.level, "vert", `précondition : à 9 h, la nuit d'avant-hier est trop vieille pour compter (${m.ctx.readiness.level})`);
    assert.equal(n.ctx.readiness.level, m.ctx.readiness.level, `à 0 h 30, la nuit d'avant-hier compte encore : niveau ${n.ctx.readiness.level}`);
    assert.deepEqual(seances(n.plan), seances(m.plan), "à 0 h 30 et à 9 h, le même jour du coureur ne reçoit pas le même plan");
  });

  // ⚠️ « À VOLUME RÉGULIER » : les fenêtres de mesure en millisecondes (km des 7 à 42 jours, charge,
  // monotonie) basculent encore à minuit UTC. Avec des sorties de longueurs différentes (sortie longue,
  // récupération d'une course), le volume visé et certaines séances diffèrent la nuit (@HeadCoach,
  // 16/11/2026 : +15 à +26 % de volume visé), et pour un débutant à faible historique, le ratio
  // aigu:chronique fait passer le niveau de forme en rouge à 0 h 30. Défaut antérieur, suivi à part.
  await test("chaque jour de départ (7 jours × 4 semaines du bloc, puis une semaine d'été), à volume régulier : même plan à 0 h 30 et à 9 h", async () => {
    const ecarts: string[] = [];
    const jours = [
      ...Array.from({ length: 28 }, (_, k) => ({ jour: jourMoins("2026-11-16", -k), decalageH: 1, matin: "08:00:00Z" })),
      ...Array.from({ length: 7 }, (_, k) => ({ jour: jourMoins("2026-06-15", -k), decalageH: 2, matin: "07:00:00Z" })),
    ];
    const regularite = "RÉGULARITÉ, pas la physiologie";
    let preuves = 0;
    for (const { jour, decalageH, matin } of jours) {
      for (const riche of [false, true]) {
        const o = { dureVeille: true, objectif: false, riche };
        const n = await lecture(nuitDe(jour, decalageH), jour, o);
        const m = await lecture(`${jour}T${matin}`, jour, o);
        if (n.jourServeur === Number(jour.slice(8))) ecarts.push(`${jour} : précondition, le serveur n'est pas la veille à 0 h 30`);
        const sig = (x: typeof n) => JSON.stringify({ jour0: x.ctx.jour0, dur: x.ctx.lastHardDaysAgo, allegee: x.ctx.cycle.deload,
          forme: x.ctx.readiness.level, rates: x.ctx.skippedWeekdays, regularite: x.ctx.text.includes(regularite), seances: seances(x.plan) });
        if (sig(n) !== sig(m)) ecarts.push(`${jour}${riche ? " (riche)" : ""} : nuit ${sig(n)}\n        matin ${sig(m)}`);
        if (riche && m.ctx.readiness.level === "vert" && m.ctx.skippedWeekdays.length === 0 && !m.ctx.text.includes(regularite)) preuves++;
      }
    }
    // La fixture riche doit rester SOUS chaque seuil le matin, sinon une bascule de nuit ne se verrait pas.
    assert.equal(preuves, jours.length, `précondition : la fixture riche franchit un seuil le matin (${preuves}/${jours.length} jours sous les seuils)`);
    assert.equal(ecarts.length, 0, `${ecarts.length} cas sur ${jours.length * 2} diffèrent :\n      ${ecarts.slice(0, 3).join("\n      ")}`);
  });

  await test("le coach et le rappel Premium construisent le plan au jour du coureur, pas à l'heure du serveur", () => {
    const coach = code("src/lib/ai/autoCoach.ts");
    assert.match(coach, /const jourPlan = instantDuJour\(ctx\.jour0 \?\? aujourdhui\(FUSEAU_DEFAUT, maintenant\)\);/, "le coach ne calcule plus le jour du plan depuis le contexte");
    assert.match(coach, /const semaineMoteur = buildWeekPlan\(ctx, jourPlan\);/, "le coach construit le plan à l'heure du serveur");
    assert.match(coach, /const week = avecCourseCEcartee\(ctx, consignesSurPlan\(ctx, ajuste\.week, jourPlan\), jourPlan\);/, "les consignes ou le message de la course C suivent l'heure du serveur");
    assert.match(coach, /avecCourseCEcartee\(ctx, appliquerConseils\(week, relecture\.conseils\), jourPlan\)/, "le message après la relecture Premium suit l'heure du serveur");
    assert.doesNotMatch(coach, /buildWeekPlan\(ctx, maintenant\)|consignesSurPlan\([^)]*maintenant\)|avecCourseCEcartee\([^;]*, maintenant\)/, "un appel du plan lit encore l'heure du serveur");
    const rappel = code("src/lib/ai/rappelPremiumServeur.ts");
    assert.match(rappel, /semaine: buildWeekPlan\(complet, instantDuJour\(complet\.jour0 \?\? jour\)\)/, "le rappel Premium construit son plan à l'heure du serveur, ou sur un autre jour que son contexte");
    assert.match(code("src/lib/ai/coachContext.ts"), /daysToRace = ecartJours\(String\(objective\.raceDate\), todayStr\) \?\? Number\.NaN;/, "daysToRace se calcule encore avec l'heure du serveur");
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
