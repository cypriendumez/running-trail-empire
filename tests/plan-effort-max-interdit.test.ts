/**
 * ANTÉCÉDENT QUI INTERDIT L'EFFORT MAXIMAL (cardiaque, covid long, grossesse) : NI VMA NI TEST (19/11/2026).
 *
 * Le catalogue santé (`src/data/healthCatalog.ts`) dit, pour ces coureurs : aucune séance maximale
 * (VMA à 100 % et au-delà, test d'effort, sprints), le développement par le volume facile et le seuil
 * bas. Le plan, lui :
 *  · plafonnait leur qualité à UNE séance (`qualityBudget`, `noMaxEffort`)… AVANT les planchers : le
 *    plancher « objectif court » la remontait à deux, et le menu d'un 5 ou 10 km commence par la VMA.
 *    Rejoué par @HeadCoach : coureur cardiaque, objectif 10 km, 7 semaines sur 8 avec une VMA de 100 à
 *    105 % (400 m, 30/30, pyramide), envoyée à la montre ;
 *  · posait le test « 6 min À FOND » comme seule séance quand sa VMA n'est pas mesurée (`autoCoach`) ;
 *  · et le tableau de bord l'y invitait (`testVmaAEviterDe`).
 *
 *   npx tsx tests/plan-effort-max-interdit.test.ts
 */
process.env.TZ = "UTC";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { effortMaximalInterdit } from "../src/lib/health/effortMaximal";
import { sansAllureInconnue } from "../src/lib/coach/allureInconnue";
import { buildWorkoutDescription } from "../src/lib/watch/intervals";
import { testVmaAEviter, testVmaAEviterDe } from "../src/lib/health/testVmaAEviter";
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
/** Faux client PostgREST : eq, gte, lte, gt, lt, in, order, limit, single, maybeSingle. Aucune écriture. */
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

// Le jour du COACH (Paris), pas celui d'UTC.
const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
/** `ilYa(5)` = il y a cinq jours ; `ilYa(-15)` = dans quinze jours. */
const ilYa = (n: number) => { const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
// ⚠️ PAS DE `last_lat` : aucune requête météo. Aucun `run_years` : le plafond lié au passif ne masque rien.
const profil = (conditions: string[]) => ({ id: "u", preferred_language: "fr", full_name: "Test", age: 40, gender: "male", weight_kg: 70,
  days_per_week: 6, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: conditions, injury_zones: [], health_declared: true });
/** VMA MESURÉE (test enregistré) : 15 km/h, niveau intermédiaire. */
const BASE = [{ user_id: "u", vma_kmh: 15, max_hr: 185, resting_hr: 50, tested_at: ilYa(40) }];
/** Six sorties faciles de 10 km par semaine sur dix semaines : ~60 km, aucune fatigue. */
const SEANCES = Array.from({ length: 70 }, (_, k) => k + 1).filter((n) => n % 7 !== 3).map((n) => ({
  user_id: "u", date: ilYa(n), type: "easy", sport: "run", distance_km: 10, duration_seconds: 3300,
  elevation_gain_m: 40, avg_hr: 135, max_hr: 150, tss: 55, hr_zone_seconds: [600, 2700, 0, 0, 0] }));
const objectif = (km: number, semaines: number, cible: { temps: string; sec: number; allure: string } = { temps: "50:00", sec: 3000, allure: "5'00/km" }) => ({ user_id: "u", type: "race_objective", data: {
  race: `Course de ${km} km`, raceDate: ilYa(-7 * semaines - 3), distanceKm: km, targetTime: cible.temps, targetSeconds: cible.sec, targetPace: cible.allure } });
/** Un 5 km AMBITIEUX : 20:00, soit 4'00/km — 100 % d'une VMA de 15 km/h. */
const CINQ_AMBITIEUX = { temps: "20:00", sec: 1200, allure: "4'00/km" };
/** L'allure seuil de l'appli (86 % de la VMA de 15 km/h) : 4'39/km. Rien de plus rapide pour ces coureurs. */
const SEUIL_SEC = Math.round(3600 / (15 * 0.86));
const allures = (t: string) => [...t.matchAll(/(\d{1,2})['’](\d{2})/g)].map((m) => Number(m[1]) * 60 + Number(m[2]));
/** Ce qu'un coureur dont l'effort maximal est interdit ne doit pas lire dans un jour de son plan. */
const INTENSITE = /lignes droites|accélér|bloc spécifique|allure (de )?course|\bVMA\b|30\/30|à fond|\d+ ?[×x] ?\d+ ?s\b|footing progressif|plus vite/i;
/** Le juge porte sur la COURSE : le renforcement (gainage « 3×45 s ») est un reste déclaré, à trancher à part. */
const jugeable = (d: { type: string }) => d.type !== "Renfo";

async function contexte(conditions: string[], km: number, semaines: number): Promise<AthleteContext> {
  return buildAthleteContext(fauxClient({ profiles: [profil(conditions)], performance_baselines: BASE, workouts: SEANCES,
    notifications: [objectif(km, semaines)] }), "u");
}
/** Une séance de VMA à 100 % et plus : son type, ou une allure de répétition au-dessus de 99 % de la VMA. */
const estVma = (type: string, texte: string) => /VMA/i.test(type) || /\b(30\/30|30"\/30"|400 ?m|pyramide)\b/i.test(texte);

const ANTECEDENTS = ["cardiaque", "covid_long", "grossesse"];
// Objectifs courts (le plancher « deux qualités » s'y applique), loin et près de la course.
const CAS: [number, number][] = [[10, 10], [10, 6], [5, 8], [5, 12]];

async function main() {
  console.log("\nANTÉCÉDENT QUI INTERDIT L'EFFORT MAXIMAL : NI VMA NI TEST");

  await test("effortMaximalInterdit : cardiaque, covid long, grossesse ; pas l'asthme, ni rien", () => {
    for (const a of ANTECEDENTS) assert.equal(effortMaximalInterdit([a]), true, `${a} n'interdit plus l'effort maximal`);
    assert.equal(effortMaximalInterdit(["asthme", "cardiaque"]), true, "un antécédent parmi d'autres n'est plus vu");
    for (const v of [[], ["asthme"], null, undefined, "cardiaque", [null], [["cardiaque"]]]) assert.equal(effortMaximalInterdit(v), false, `${JSON.stringify(v)} interdit l'effort maximal`);
  });

  for (const [km, semaines] of CAS) {
    await test(`TÉMOIN — coureur sans antécédent, ${km} km dans ${semaines} semaines : deux qualités, dont la VMA (le plancher s'applique)`, async () => {
      const ctx = await contexte([], km, semaines);
      assert.equal(ctx.weekPlan.qBudget, 2, `précondition : ${ctx.weekPlan.qBudget} qualité(s) au lieu de 2 (le plancher « objectif court »)`);
      assert.ok(ctx.weekPlan.quality.some((q) => /VMA/i.test(q.type)), `précondition : aucune VMA au menu (${ctx.weekPlan.quality.map((q) => q.type).join(", ")})`);
    });
    for (const a of ANTECEDENTS) {
      await test(`${a}, ${km} km dans ${semaines} semaines : une qualité au plus, un seuil, aucune VMA ni dans le plan ni sur la feuille de route`, async () => {
        const ctx = await contexte([a], km, semaines);
        assert.ok(ctx.weekPlan.qBudget <= 1, `${ctx.weekPlan.qBudget} séances de qualité pour un coureur « ${a} » (le plancher écrase le plafond de santé)`);
        for (const q of ctx.weekPlan.quality)
          assert.equal(q.type, "Seuil", `séance « ${q.type} » au menu d'un coureur « ${a} » : ${String(q.desc ?? "").slice(0, 90)}`);
        const plan = buildWeekPlan(ctx, new Date(`${AUJOURDHUI}T12:00:00Z`));
        const dures = plan.filter((d) => /VMA|Seuil|Spécifique/i.test(d.type));
        assert.ok(dures.length <= 1, `${dures.length} séances dures en 7 jours : ${dures.map((d) => `${d.date} ${d.type}`).join(" ; ")}`);
        for (const d of plan) assert.ok(!estVma(d.type, `${d.title} ${d.detail}`), `VMA posée le ${d.date} : ${d.type} « ${d.title} »`);
        for (const w of ctx.macroPlan) assert.ok(!w.quality.some((t) => /VMA|Côtes/i.test(t)), `feuille de route, semaine ${w.week} : ${w.quality.join(", ")}`);
      });
    }
  }

  await test("sept semaines de suite (toutes les variantes tirées) : la seule qualité est un seuil BAS, jamais le seuil ni la VMA", async () => {
    // Le gabarit se tire selon la semaine ISO : on rejoue sept semaines, horloge ET séances décalées
    // (sinon le coureur paraîtrait arrêté), pour voir passer chacune des sept variantes du seuil.
    const Vrai = Date;
    const vus = new Set<string>();
    for (let k = 0; k < 7; k++) {
      const delta = k * 7 * 86400000;
      class Faux extends Vrai {
        constructor(...a: unknown[]) { if (a.length === 0) super(Vrai.now() + delta); else super(...(a as [number])); }
        static now() { return Vrai.now() + delta; }
      }
      const decale = (j: string) => new Vrai(Vrai.parse(`${j}T12:00:00Z`) + delta).toISOString().slice(0, 10);
      (globalThis as { Date: DateConstructor }).Date = Faux as DateConstructor;
      try {
        const o = objectif(10, 10);
        const ctx = await buildAthleteContext(fauxClient({ profiles: [profil(["cardiaque"])], performance_baselines: BASE,
          workouts: SEANCES.map((w) => ({ ...w, date: decale(w.date) })),
          notifications: [{ ...o, data: { ...o.data, raceDate: decale(o.data.raceDate) } }] }), "u");
        assert.equal(ctx.weekPlan.quality.length, 1, `semaine +${k} : ${ctx.weekPlan.quality.length} qualité(s)`);
        const d = ctx.weekPlan.quality[0].desc;
        assert.match(d, /^(Seuil long|Seuil continu|Tempo long) \(SOUS-seuil\)/, `semaine +${k} : « ${d.slice(0, 80)} » n'est pas un seuil bas`);
        vus.add(d.split(" :")[0]);
      } finally { (globalThis as { Date: DateConstructor }).Date = Vrai; }
    }
    assert.equal(vus.size, 3, `précondition : les trois variantes du seuil bas ne sont pas toutes passées (${[...vus].join(", ")})`);
  });

  /**
   * CE QUE LE COUREUR LIT, JOUR PAR JOUR, sur 7 jours de départ (horloge ET séances décalées) : le
   * budget de qualité ne voit ni la sortie longue (bloc à allure course, finish progressif), ni les
   * footings (lignes droites, progressif), ni l'échauffement de la qualité (lignes droites).
   */
  async function planSur7Jours(conditions: string[], km: number, semaines: number, cible?: Parameters<typeof objectif>[2]) {
    const Vrai = Date;
    const jours: { depart: number; d: ReturnType<typeof buildWeekPlan>[number] }[] = [];
    for (let k = 0; k < 7; k++) {
      const delta = k * 86400000;
      class Faux extends Vrai {
        constructor(...a: unknown[]) { if (a.length === 0) super(Vrai.now() + delta); else super(...(a as [number])); }
        static now() { return Vrai.now() + delta; }
      }
      const decale = (j: string) => new Vrai(Vrai.parse(`${j}T12:00:00Z`) + delta).toISOString().slice(0, 10);
      (globalThis as { Date: DateConstructor }).Date = Faux as DateConstructor;
      try {
        const o = objectif(km, semaines, cible);
        const ctx = await buildAthleteContext(fauxClient({ profiles: [profil(conditions)], performance_baselines: BASE,
          workouts: SEANCES.map((w) => ({ ...w, date: decale(w.date) })),
          notifications: [{ ...o, data: { ...o.data, raceDate: decale(o.data.raceDate) } }] }), "u");
        for (const d of buildWeekPlan(ctx, new Date())) jours.push({ depart: k, d });
      } finally { (globalThis as { Date: DateConstructor }).Date = Vrai; }
    }
    return jours;
  }
  const SCENARIOS: [string, number, number, Parameters<typeof objectif>[2] | undefined][] = [
    ["5 km ambitieux (4'00/km) dans 3 semaines, phase spécifique", 5, 3, CINQ_AMBITIEUX],
    ["10 km dans 10 semaines", 10, 10, undefined],
  ];
  for (const [nom, km, semaines, cible] of SCENARIOS) {
    await test(`TÉMOIN — coureur ordinaire, ${nom} : sa semaine porte de l'intensité hors qualité (lignes droites, sortie longue accélérée)`, async () => {
      const jours = await planSur7Jours([], km, semaines, cible);
      const hors = jours.filter(({ d }) => !/VMA|Seuil|Spécifique/i.test(d.type) && INTENSITE.test(`${d.title} ${d.detail}`));
      assert.ok(hors.length > 0, "précondition : aucun jour hors qualité ne porte d'intensité chez le coureur ordinaire");
      assert.ok(jours.some(({ d }) => d.type === "Sortie longue" && /bloc spécifique|accélér/i.test(`${d.title} ${d.detail}`)), "précondition : aucune sortie longue accélérée chez le coureur ordinaire");
    });
    for (const a of ["cardiaque", "grossesse"]) {
      await test(`${a}, ${nom}, 7 jours de départ : ni lignes droites, ni sortie longue accélérée, ni VMA, aucune allure plus rapide que le seuil`, async () => {
        const jours = await planSur7Jours([a], km, semaines, cible);
        assert.ok(jours.some(({ d }) => d.type === "Sortie longue"), "précondition : aucune sortie longue dans la semaine");
        for (const { depart, d } of jours) {
          const t = `${d.title} ${d.detail}`;
          const vu = jugeable(d) ? t.match(INTENSITE)?.[0] : undefined;
          assert.equal(vu, undefined, `départ +${depart}, ${d.date} ${d.type} : « ${vu} » dans « ${t.slice(0, 140)} »`);
          for (const sec of allures(t)) assert.ok(sec >= SEUIL_SEC, `départ +${depart}, ${d.date} ${d.type} : allure ${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")} plus rapide que le seuil (« ${t.slice(0, 140)} »)`);
        }
        // Par date : un jour peut porter deux séances (jamais plan[i]) — au plus UNE qualité par semaine de départ.
        for (let k = 0; k < 7; k++) {
          const dures = jours.filter((j) => j.depart === k && /VMA|Seuil|Spécifique/i.test(j.d.type));
          assert.ok(dures.length <= 1, `départ +${k} : ${dures.length} séances dures (${dures.map((j) => j.d.date).join(", ")})`);
        }
      });
    }
  }

  await test("course dans la semaine, 7 jours de départ : ni la veille (lignes droites) ni l'avant-veille (4×30 s à l'allure de course) ; le témoin les garde", async () => {
    // Un 5 km AMBITIEUX dans 3 jours (allure de course = 100 % de la VMA) : veille et avant-veille tombent
    // dans la semaine, à J+1 et J+2 de chaque départ ou presque.
    const temoin = await planSur7Jours([], 5, 0, CINQ_AMBITIEUX);
    const veillesT = temoin.filter(({ d }) => /^Déblocage/.test(d.title));
    assert.ok(veillesT.length > 0, "précondition : aucune veille de course dans la semaine du témoin");
    assert.ok(veillesT.every(({ d }) => /lignes droites/.test(d.detail)), "précondition : la veille du témoin n'a plus de lignes droites");
    assert.ok(temoin.some(({ d }) => /4×30 s/.test(d.detail)), "précondition : l'avant-veille du témoin n'a plus ses 4×30 s");
    for (const a of ANTECEDENTS) {
      const jours = await planSur7Jours([a], 5, 0, CINQ_AMBITIEUX);
      assert.ok(jours.some(({ d }) => /^Déblocage/.test(d.title)), `précondition : aucune veille de course pour « ${a} »`);
      for (const { depart, d } of jours) {
        if (d.type === "Course" || !jugeable(d)) continue; // la course elle-même et le renfo : des restes déclarés
        const vu = `${d.title} ${d.detail}`.match(INTENSITE)?.[0];
        assert.equal(vu, undefined, `« ${a} », départ +${depart}, ${d.date} ${d.type} : « ${vu} » (« ${d.title} : ${d.detail.slice(0, 100)} »)`);
      }
    }
  });

  await test("covid long : ZÉRO qualité (décision de Cyprien) — ni seuil, ni feuille de route, et le motif le dit", async () => {
    const ctx = await contexte(["covid_long"], 10, 10);
    assert.equal(ctx.weekPlan.qBudget, 0, `${ctx.weekPlan.qBudget} séance(s) de qualité pour un covid long`);
    assert.equal(ctx.weekPlan.quality.length, 0, "une qualité reste au menu d'un covid long");
    for (const w of ctx.macroPlan) assert.deepEqual(w.quality, [], `feuille de route, semaine ${w.week} : ${w.quality.join(", ")}`);
    const jours = await planSur7Jours(["covid_long"], 10, 10);
    for (const { depart, d } of jours) {
      assert.ok(!/VMA|Seuil|Spécifique/i.test(d.type), `départ +${depart}, ${d.date} : séance « ${d.type} » pour un covid long`);
      if (jugeable(d)) assert.doesNotMatch(`${d.title} ${d.detail}`, INTENSITE, `départ +${depart}, ${d.date} : intensité pour un covid long`);
    }
    assert.ok(ctx.readiness.reasons.some((r) => /aucune intensité pour l'instant/.test(r) && /seul ton médecin peut lever cette limite/.test(r)), `motif absent : ${ctx.readiness.reasons.join(" | ")}`);
  });

  await test("le motif se dit au coureur, sans nommer l'antécédent, dans les 5 langues ; aucun motif pour un coureur ordinaire", async () => {
    for (const a of ["cardiaque", "grossesse"]) {
      const ctx = await contexte([a], 10, 10);
      const motif = ctx.readiness.reasonsAll.find((r) => /ni VMA ni test/.test(r.fr));
      assert.ok(motif, `« ${a} » : le motif n'est pas dit (${ctx.readiness.reasons.join(" | ")})`);
      for (const l of ["fr", "en", "de", "es", "pt"] as const) {
        assert.ok(String(motif![l] ?? "").length > 20, `« ${a} » ${l} : motif absent`);
        assert.doesNotMatch(String(motif![l]), /cardi|heart|herz|coraz|coraç|grosses|pregnan|schwanger|embaraz|gravidez|covid/i, `« ${a} » ${l} : le motif nomme l'antécédent (« ${motif![l]} »)`);
      }
    }
    const ordinaire = await contexte([], 10, 10);
    assert.ok(!ordinaire.readiness.reasons.some((r) => /seul ton médecin peut lever cette limite/.test(r)), "un coureur ordinaire reçoit le motif de l'antécédent");
  });

  await test("seuil bas : jamais plus rapide que l'allure seuil de l'appli, même quand la vitesse critique mesurée est plus rapide", async () => {
    // Vitesse critique à 90 % de la VMA (13,5 km/h, 4'27/km) : « 8 s dessous » donnait 4'35, plus vite que 4'39.
    const ctx = await buildAthleteContext(fauxClient({ profiles: [{ ...profil(["cardiaque"]), pace_curve: { criticalSpeed: 3.75 } }],
      performance_baselines: BASE, workouts: SEANCES, notifications: [objectif(10, 10)] }), "u");
    assert.equal(ctx.weekPlan.quality.length, 1, "précondition : une qualité");
    const vues = allures(ctx.weekPlan.quality[0].desc);
    assert.ok(vues.length > 0, `précondition : aucune allure dans « ${ctx.weekPlan.quality[0].desc} »`);
    for (const sec of vues) assert.ok(sec >= SEUIL_SEC, `seuil bas à ${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}, plus rapide que le seuil 4'39 (« ${ctx.weekPlan.quality[0].desc} »)`);
  });

  await test("montre : un seuil BAS sans allure part en zone 3 (« Seuil bas »), jamais en Z4 ; avec une allure, ou un seuil classique, rien ne change", () => {
    const sansAllure = buildWorkoutDescription("Séance de qualité · Seuil", "Échauffement 15 min progressif FC Z1→Z2 → Corps : Tempo long (SOUS-seuil) : 24 min au ressenti (tu peux encore parler par phrases courtes) → Retour au calme 10 min FC Z1.", "Seuil", null, null, 15, 10, "garmin");
    assert.ok(sansAllure, "précondition : aucune séance construite");
    assert.match(sansAllure!.description, /Z3 HR Seuil bas/, `seuil bas sans allure : ${sansAllure!.description}`);
    assert.doesNotMatch(sansAllure!.description, /Z4/, `seuil bas sans allure en Z4 : ${sansAllure!.description}`);
    const avecAllure = buildWorkoutDescription("Séance de qualité · Seuil", "Échauffement 15 min progressif FC Z1→Z2 → Corps : Tempo long (SOUS-seuil) : 24 min à ~4'47/km → Retour au calme 10 min FC Z1.", "Seuil", null, 15, 15, 10, "garmin");
    assert.match(avecAllure!.description, /pace Seuil/, `seuil bas AVEC allure : la cible d'allure a disparu (${avecAllure!.description})`);
    const classique = buildWorkoutDescription("Séance de qualité · Seuil", "Échauffement 15 min progressif FC Z1→Z2 → Corps : Seuil continu : 20 min au ressenti → Retour au calme 10 min FC Z1.", "Seuil", null, null, 15, 10, "garmin");
    assert.match(classique!.description, /Z4 HR Seuil/, `seuil classique sans allure : la zone 4 a disparu (${classique!.description})`);
  });

  await test("sans VMA (ni mesurée ni estimable) : la qualité se court au ressenti, SANS renvoi au test VMA ; le témoin garde le renvoi", async () => {
    // Sorties de 3 km : trop courtes pour estimer une VMA (4 à 18 km), et aucun effort à 85 % de la FC max
    // (un pic à 190 dans la semaine : sans lui, le pic de 150 servait de FC max et 135 passait pour un effort).
    const courtes = SEANCES.map((w) => ({ ...w, distance_km: 3, duration_seconds: 1080, tss: 18, max_hr: 190 }));
    const lire = (conditions: string[]) => buildAthleteContext(fauxClient({ profiles: [profil(conditions)], performance_baselines: [],
      workouts: courtes, notifications: [objectif(10, 10)] }), "u");
    const textes = (ctx: AthleteContext) => ctx.weekPlan.quality.flatMap((q) => [q.desc, ...Object.values(q.descAll ?? {}).map(String)]);
    // TÉMOIN, sur le gabarit lui-même : sans exemption, une allure inconnue renvoie au test, dans les 5 langues.
    for (const l of ["fr", "en", "de", "es", "pt"] as const) {
      assert.match(sansAllureInconnue("16 min à ~?/km", l), /test|Test|teste/, `${l} : le témoin ne renvoie plus au test`);
      assert.doesNotMatch(sansAllureInconnue("16 min à ~?/km", l, true), /test|Test|teste|\?/, `${l} : l'allure sans test renvoie au test`);
      // Un repère concret à la place de l'allure : on peut encore parler par phrases courtes (@HeadCoach).
      assert.match(sansAllureInconnue("16 min à ~?/km", l, true), /parler|talk|sprechen|hablar|falar/, `${l} : « au ressenti » sans repère de conversation`);
    }
    // Le covid long n'a aucune qualité (son propre test) : le cardiaque et la grossesse gardent un seuil bas.
    for (const a of ["cardiaque", "grossesse"]) {
      const ctx = await lire([a]);
      assert.equal(ctx.vma ?? null, null, `précondition : VMA ${ctx.vma} pour « ${a} »`);
      assert.ok(ctx.weekPlan.quality.length >= 1, `précondition : aucune qualité pour « ${a} »`);
      assert.ok(textes(ctx).some((t) => /au ressenti/.test(t)), `précondition : la séance de « ${a} » ne passe pas par l'allure inconnue (${textes(ctx)[0]})`);
      for (const t of textes(ctx)) {
        assert.doesNotMatch(t, /test|Test|teste/i, `« ${a} » : la séance renvoie au test VMA (« ${t} »)`);
        assert.doesNotMatch(t, /\?\/km|~\?/, `« ${a} » : une allure inconnue s'écrit encore « ? » (« ${t} »)`);
      }
    }
  });

  await test("tableau de bord, Profil, fiche : le test VMA n'est plus proposé à ces coureurs ; une panne du profil vaut « à éviter »", async () => {
    const ok = { data: [], error: null }, okEtat = { data: null, error: null }, panne = { data: null, error: { message: "panne" } };
    assert.equal(testVmaAEviterDe(ok, okEtat), false, "précondition : rien de lu, rien d'écarté");
    assert.equal(testVmaAEviterDe(ok, okEtat, { data: { health_conditions: [] }, error: null }), false, "précondition : aucun antécédent");
    for (const a of ANTECEDENTS)
      assert.equal(testVmaAEviterDe(ok, okEtat, { data: { health_conditions: [a] }, error: null }), true, `« ${a} » : le bandeau propose le test`);
    assert.equal(testVmaAEviterDe(ok, okEtat, panne), true, "profil illisible : le test est proposé quand même");
    // La même règle, lectures comprises (Profil, fiche vitesse).
    const lu = (conditions: string[]) => testVmaAEviter(fauxClient({ profiles: [profil(conditions)], notifications: [] }) as never, "u");
    assert.equal(await lu([]), false, "précondition : coureur ordinaire");
    assert.equal(await lu(["grossesse"]), true, "Profil : le test est proposé pendant une grossesse");
    // Le tableau de bord passe SON profil (déjà lu, `select("*")`).
    assert.match(codeNu("src/app/dashboard/page.tsx"), /const sansTestVma = testVmaAEviterDe\(\{ data: lignesApt, error: eApt \}, etatCoachRes, profileRes\);/,
      "le tableau de bord ne passe plus son profil à la règle du test");
  });

  await test("verrou du coach : pas de test « 6 min À FOND » pour ces coureurs, même sans VMA mesurée", () => {
    const ac = codeNu("src/lib/ai/autoCoach.ts");
    assert.match(ac, /from\("profiles"\)\.select\(`\$\{COLONNES_ACCES\}, email, preferred_language, health_conditions`\)/, "le verrou ne lit plus les antécédents");
    assert.match(ac, /const effortMaxInterdit = effortMaximalInterdit\(\(profilAcces as \{ health_conditions\?: unknown \} \| null\)\?\.health_conditions\);/,
      "le verrou ne passe plus par la règle partagée des antécédents");
    assert.match(ac, /if \(!vmaMesuree && !estFondateur && !avisMedicalAttendu && !effortMaxInterdit\) \{/, "le test VMA est de nouveau prescrit à un coureur dont l'effort maximal est interdit");
  });

  await test("une seule définition des antécédents : le coach, le verrou et l'interface lisent effortMaximalInterdit", () => {
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /const noMaxEffort = effortMaximalInterdit\(p\?\.health_conditions\);/, "le coach garde sa propre liste d'antécédents");
    // Les lignes droites retirées pour l'antécédent ne sont pas attribuées à une douleur (motif affiché).
    assert.match(codeNu("src/lib/ai/autoCoach.ts"), /effortMax: !!ctx\.effortMaximalInterdit,\s*reprise: lignesRetireesParReprise\(/, "une douleur se voit attribuer des lignes droites que l'antécédent avait déjà retirées");
    // Le double seuil (deux séances au seuil le même jour, option cochée) : pas pour eux non plus.
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /&& !repriseIntensite && !marcheSortie && !marcheCourse && !noMaxEffort;/, "le double seuil est de nouveau posé à un coureur dont l'effort maximal est interdit");
    assert.match(codeNu("src/lib/health/testVmaAEviter.ts"), /effortMaximalInterdit\(/, "l'interface ne lit pas les antécédents");
    for (const f of ["src/lib/ai/coachContext.ts", "src/lib/ai/autoCoach.ts", "src/lib/health/testVmaAEviter.ts"])
      assert.doesNotMatch(codeNu(f), /\["cardiaque", "covid_long", "grossesse"\]/, `${f} recopie la liste des antécédents`);
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
