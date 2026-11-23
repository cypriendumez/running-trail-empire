/**
 * LES RESTES DE L'ANTÉCÉDENT QUI INTERDIT L'EFFORT MAXIMAL (cardiaque, covid long, grossesse ; 20/11/2026).
 *
 * Décisions de Cyprien, après la PR 63 (plan sans VMA ni test) :
 *  · COURSES À EFFORT CONTRÔLÉ — course A, B et C, et la page Jour J : sans lignes droites ni accélérations
 *    à l'échauffement, sans allure chiffrée, « tu dois pouvoir parler », seul le médecin lève la limite ;
 *  · GROSSESSE À LA SENSATION — ni allure chiffrée ni zone de FC dans le plan, et RIEN sur la montre (une
 *    étape sans cible n'est pas un format éprouvé chez intervals.icu) ;
 *  · COVID LONG, PLUS MAL APRÈS UNE SÉANCE — bilan du matin à 4-5/5 dans les deux jours qui suivent une
 *    sortie : la séance du jour devient un repos, et le motif oriente vers le médecin.
 * Et ce que la PR 63 laissait : les deux chemins de veille de course que son test n'atteignait pas (course à
 * J+7/J+8, course C), le « pourquoi » de l'avant-veille et le focus de la feuille de route vu par l'admin. La
 * séance du jour par l'IA (« fais converger vers l'objectif ») suit le cadre de santé : tests/cadre-sante.test.ts.
 *
 *   npx tsx tests/effort-max-restes.test.ts
 */
process.env.TZ = "UTC";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan, consignesSurPlan, planALaSensation } from "../src/lib/ai/autoPlan";
import { packJourJ } from "../src/lib/coach/jourJ";
import { JOURJ_T } from "../src/lib/coach/jourJI18n";
import { aLaSensation } from "../src/lib/coach/sensation";
import { pilotageSensation } from "../src/lib/health/effortMaximal";
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

const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
/** `ilYa(5)` = il y a cinq jours ; `ilYa(-15)` = dans quinze jours. */
const ilYa = (n: number) => { const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const profil = (conditions: string[]) => ({ id: "u", preferred_language: "fr", full_name: "Test", age: 40, gender: "female", weight_kg: 60,
  days_per_week: 6, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: conditions, injury_zones: [], health_declared: true });
const BASE = [{ user_id: "u", vma_kmh: 15, max_hr: 185, resting_hr: 50, tested_at: ilYa(40) }];
/** Six sorties faciles de 10 km par semaine sur dix semaines (la dernière HIER). */
const SEANCES = Array.from({ length: 70 }, (_, k) => k + 1).filter((n) => n % 7 !== 3).map((n) => ({
  user_id: "u", date: ilYa(n), type: "easy", sport: "run", distance_km: 10, duration_seconds: 3300,
  elevation_gain_m: 40, avg_hr: 135, max_hr: 150, tss: 55, hr_zone_seconds: [600, 2700, 0, 0, 0] }));
const objectif = (km: number, dansJours: number, cible = { temps: "50:00", sec: 3000, allure: "5'00/km" }) => ({ user_id: "u", type: "race_objective",
  data: { race: `Course de ${km} km`, raceDate: ilYa(-dansJours), distanceKm: km, targetTime: cible.temps, targetSeconds: cible.sec, targetPace: cible.allure } });
const planifiee = (name: string, dansJours: number, distanceKm: number, priorite: "B" | "C") => ({ user_id: "u", type: "planned_race",
  created_at: `${AUJOURDHUI}T10:00:00Z`, data: { name, date: ilYa(-dansJours), distanceKm, priorite } });
const bilan = (fatigue: number, jambes: number) => ({ user_id: "u", type: "bilan_matin", created_at: `${AUJOURDHUI}T06:00:00Z`,
  data: { date: AUJOURDHUI, fatigue, jambes, stress: 1 } });

async function contexte(conditions: string[], notifications: Ligne[], seances: Ligne[] = SEANCES): Promise<AthleteContext> {
  return buildAthleteContext(fauxClient({ profiles: [profil(conditions)], performance_baselines: BASE, workouts: seances, notifications }), "u");
}
const plan = (ctx: AthleteContext) => buildWeekPlan(ctx, new Date(`${AUJOURDHUI}T12:00:00Z`));
type Jour = ReturnType<typeof buildWeekPlan>[number];
const texte = (d: Jour) => `${d.title} ${d.detail}`;
/** Tous les textes d'un jour, dans les cinq langues. */
const textes5 = (d: Jour) => [d.title, d.detail, d.why, ...Object.values(d.i18n ?? {}).flatMap((t) => (t ? [t.title, t.detail, t.why] : []))];
const ANTECEDENTS = ["cardiaque", "covid_long", "grossesse"];
const ALLURE = /\d{1,2}['’]\d{2}/;
/** L'intensité qu'une course à effort contrôlé ne prescrit pas. */
const INTENSE = /lignes droites|accélér|à l'allure de course|cours-la vite|effort d'une séance au seuil|\d+ ?× ?\d+ ?(s|min) à/i;

async function main() {
  console.log("\nRESTES DE L'ANTÉCÉDENT QUI INTERDIT L'EFFORT MAXIMAL");

  await test("Jour J à effort contrôlé : ni chrono, ni allure, ni passages, ni scénarios, l'échauffement sans accélération ; le témoin garde tout", () => {
    const entree = { objectif: { nom: "10 km de test", date: ilYa(-3), distanceKm: 10, viseSec: 2700, officielle: true }, joursRestants: 3, vma: 15,
      socle: null, ameliorationAttendue: 0, progressionMesuree: false, dplusM: 40, terrain: "route", poidsKg: 60, meteo: null };
    const temoin = packJourJ(entree);
    assert.equal(temoin.mode, "route"); assert.ok(temoin.passages.length > 0 && temoin.chrono.allureSecKm != null, "précondition : le témoin a ses passages et son allure");
    assert.equal(temoin.echauffement, "court");
    const p = packJourJ({ ...entree, effortControle: true });
    assert.equal(p.mode, "controle", "la page n'est pas à effort contrôlé");
    assert.equal(p.chrono.allureSecKm, null, "une allure est donnée");
    assert.equal(p.chrono.projeteSec, null, "un chrono projeté est donné");
    assert.deepEqual(p.passages, [], "des temps de passage sont donnés");
    assert.deepEqual(p.meteo.scenarios, [], "des allures selon la température sont données");
    assert.equal(p.echauffement, "controle");
    for (const l of ["fr", "en", "de", "es", "pt"] as const) {
      assert.ok(JOURJ_T[l].controle.length > 40, `${l} : texte de course contrôlée absent`);
      assert.doesNotMatch(JOURJ_T[l].echauffementTexte.controle, ALLURE, `${l} : l'échauffement chiffre une allure`);
    }
    assert.match(JOURJ_T.fr.controle, /Seul ton médecin peut lever cette limite/);
    assert.match(codeNu("src/app/dashboard/jour-j/page.tsx"), /effortControle: effortMaximalInterdit\(p\?\.health_conditions\),/, "la page Jour J ne lit plus l'antécédent");
    assert.match(codeNu("src/app/dashboard/jour-j/page.tsx"), /pace_curve, last_lat, last_lon, health_conditions`\)/, "la page Jour J ne lit plus les antécédents du profil");
  });

  await test("course A dans 3 jours : à effort contrôlé (sans lignes droites ni allure), « pourquoi » qui renvoie au médecin ; le témoin garde l'échauffement et l'allure", async () => {
    const t = plan(await contexte([], [objectif(10, 3)]));
    const courseT = t.find((d) => d.type === "Course");
    assert.ok(courseT && /lignes droites/.test(courseT.detail) && ALLURE.test(courseT.detail), `précondition : la course du témoin (« ${courseT?.detail} »)`);
    assert.ok(t.some((d) => /contact avec l'allure/.test(d.why)), "précondition : l'avant-veille du témoin parle d'allure");
    for (const a of ANTECEDENTS) {
      const p = plan(await contexte([a], [objectif(10, 3)]));
      const c = p.find((d) => d.type === "Course");
      assert.ok(c, `« ${a} » : la course a disparu du plan`);
      assert.doesNotMatch(texte(c!), INTENSE, `« ${a} » : la course prescrit de l'intensité (« ${c!.detail} »)`);
      assert.doesNotMatch(c!.detail, ALLURE, `« ${a} » : la course chiffre une allure (« ${c!.detail} »)`);
      assert.match(c!.detail, /tu dois pouvoir parler/, `« ${a} » : la consigne de parole manque`);
      assert.match(c!.why, /seul ton médecin peut lever cette limite/, `« ${a} » : le « pourquoi » de la course ne renvoie pas au médecin`);
      for (const d of p) assert.doesNotMatch(d.why, /contact avec l'allure/, `« ${a} » : l'avant-veille parle encore d'allure`);
    }
  });

  await test("course B dans 4 jours et course C dans 2 jours : à effort contrôlé ; la veille de la course C sans lignes droites ; le témoin garde l'intensité", async () => {
    for (const [prio, dans, temoinRe] of [["B", 4, /cours-la vite|accélérations/], ["C", 2, /effort d'une séance au seuil/]] as const) {
      const notifs = [objectif(42.2, 70), planifiee(`Course ${prio} de test`, dans, 10, prio)];
      const t = plan(await contexte([], notifs));
      const cT = t.find((d) => d.type === "Course");
      assert.ok(cT && temoinRe.test(cT.detail), `précondition (${prio}) : la course du témoin (« ${cT?.detail} »)`);
      if (prio === "C") assert.ok(t.some((d) => /^Déblocage/.test(d.title) && /lignes droites/.test(d.detail)), "précondition : la veille de la course C du témoin a ses lignes droites");
      for (const a of ANTECEDENTS) {
        const p = plan(await contexte([a], notifs));
        const c = p.find((d) => d.type === "Course");
        assert.ok(c, `« ${a} » (${prio}) : la course a disparu du plan`);
        assert.doesNotMatch(texte(c!), INTENSE, `« ${a} » (${prio}) : la course prescrit de l'intensité (« ${c!.detail} »)`);
        assert.match(c!.detail, /effort contrôlé/, `« ${a} » (${prio}) : la course n'est pas à effort contrôlé`);
        if (prio === "C") {
          const veille = p.find((d) => /^Déblocage/.test(d.title));
          assert.ok(veille, `« ${a} » : pas de veille avant la course C`);
          assert.doesNotMatch(veille!.detail, /lignes droites/, `« ${a} » : la veille de la course C a des lignes droites`);
        }
      }
    }
  });

  await test("course A à J+7 et J+8 (veille et avant-veille posées en fin de semaine, l'autre chemin du plan) : ni lignes droites ni 4×30 s, ni « contact avec l'allure »", async () => {
    for (const [dans, jour, re] of [[7, "veille", /lignes droites/], [8, "avant-veille", /4×30 s/]] as const) {
      const t = plan(await contexte([], [objectif(10, dans)]));
      assert.ok(t.some((d) => re.test(d.detail)), `précondition (J+${dans}) : la ${jour} du témoin n'a plus ${re}`);
      if (dans === 8) assert.ok(t.some((d) => /contact avec l'allure/.test(d.why)), "précondition (J+8) : l'avant-veille du témoin parle d'allure");
      for (const a of ANTECEDENTS) {
        const p = plan(await contexte([a], [objectif(10, dans)]));
        for (const d of p) {
          assert.doesNotMatch(d.detail, re, `« ${a} » (J+${dans}) : ${d.date} ${d.type} « ${d.detail} »`);
          assert.doesNotMatch(d.why, /contact avec l'allure/, `« ${a} » (J+${dans}) : l'avant-veille parle encore d'allure (« ${d.why} »)`);
        }
      }
    }
  });

  await test("grossesse : ni allure chiffrée ni zone de FC dans aucun texte du plan (5 langues) ; le témoin en a", async () => {
    const t = plan(await contexte([], [objectif(10, 40)]));
    assert.ok(t.some((d) => textes5(d).some((x) => ALLURE.test(x))), "précondition : le plan du témoin chiffre des allures");
    assert.ok(t.some((d) => textes5(d).some((x) => /\b(FC|HR|HF) Z\d|\b(en|in|em|at) Z\d/.test(x))), "précondition : le plan du témoin parle de zones de FC");
    const ctx = await contexte(["grossesse"], [objectif(10, 40)]);
    assert.equal(ctx.pilotageSensation, true);
    // Avec une vitesse critique MESURÉE aussi : le seuil bas en tirait une allure chiffrée.
    const avecCs = await buildAthleteContext(fauxClient({ profiles: [{ ...profil(["grossesse"]), pace_curve: { criticalSpeed: 3.75 } }],
      performance_baselines: BASE, workouts: SEANCES, notifications: [objectif(10, 40)] }), "u");
    const temoinCs = await buildAthleteContext(fauxClient({ profiles: [{ ...profil(["cardiaque"]), pace_curve: { criticalSpeed: 3.75 } }],
      performance_baselines: BASE, workouts: SEANCES, notifications: [objectif(10, 40)] }), "u");
    assert.ok(temoinCs.weekPlan.quality.some((q) => ALLURE.test(q.desc)), "précondition : avec une vitesse critique, le seuil bas d'un cardiaque est chiffré");
    for (const c of [ctx, avecCs]) for (const d of plan(c)) for (const x of textes5(d)) {
      assert.doesNotMatch(x, ALLURE, `${d.date} ${d.type} : une allure est chiffrée (« ${x.slice(0, 120)} »)`);
      assert.doesNotMatch(x, /\b(FC|HR|HF) Z\d|\b(en|in|em|at) Z\d/, `${d.date} ${d.type} : une zone de FC est prescrite (« ${x.slice(0, 120)} »)`);
    }
    assert.equal(aLaSensation("Échauffement 15 min progressif FC Z1→Z2 puis footing en Z2", "fr"), "Échauffement 15 min progressif à la sensation puis footing à la sensation");
    assert.equal(aLaSensation("Warm-up HR Z1-Z2", "en"), "Warm-up by feel");
    // Un antécédent cardiaque garde ses zones (il n'est pas « à la sensation »).
    assert.equal((await contexte(["cardiaque"], [objectif(10, 40)])).pilotageSensation, false, "le cardiaque passe à la sensation");
  });

  await test("grossesse : SEPT jours de départ, cinq langues — ni fréquence cardiaque, ni « fie-toi à la FC », ni étiquette de zone, ni « calée sur ta VMA », même après la seconde passe du coach ; le témoin cardiaque en a", async () => {
    // Ce que la sensation retire, dans les cinq langues (PLAN_T.recupDetail, noteGAP, qualiteWhy ; étiquettes Z1/Z2).
    const FC = /FRÉQUENCE CARDIAQUE|HEART RATE|HERZFREQUENZ|FRECUENCIA CARDÍACA|FREQUÊNCIA CARDÍACA|\b(?:FC|HR|HF)\b|calée sur ta VMA|\bVMA\b|VO2/;
    const ZONE = /^(?:(?:FC|HR|HF)\s*)?Z\d/;
    const kine40 = { user_id: "u", type: "consignes_kine", created_at: `${ilYa(5)}T10:00:00Z`,
      data: { dureeMaxMin: 40, sansIntensite: false, seancesMaxSemaine: null, jusquAu: ilYa(-40), majA: ilYa(5) } };
    // Quatre situations : un 10 km ; les footings du kiné (récupération « pilotée à la FC ») ; un terrain vallonné
    // (note « fie-toi à la FC ») ; un bilan du matin au rouge (récupération du jour).
    const situations = (c: string): [string, Promise<AthleteContext>][] => [
      ["10 km", contexte([c], [objectif(10, 40)])],
      ["kiné « 40 min au plus »", contexte([c], [objectif(10, 40), kine40])],
      ["terrain vallonné", buildAthleteContext(fauxClient({ profiles: [{ ...profil([c]), elevation_pref: "specialiste", main_terrains: ["montagne", "trail"] }],
        performance_baselines: BASE, workouts: SEANCES, notifications: [objectif(10, 40)] }), "u")],
      ["bilan du matin au rouge", contexte([c], [objectif(10, 40), bilan(5, 5)])],
    ];
    const tousLesTextes = (p: Jour[]) => p.flatMap((d) => [[d.title, d.detail, d.why], ...Object.values(d.i18n ?? {}).map((t) => (t ? [t.title, t.detail, t.why] : []))]
      .flat().map((x) => ({ d, x })));
    const toutesLesEtiquettes = (p: Jour[]) => p.flatMap((d) => [...d.tags, ...Object.values(d.i18n ?? {}).flatMap((t) => t?.tags ?? [])].map((x) => ({ d, x })));
    const vu = { fc: 0, zone: 0, gap: 0, why: 0 };
    for (const [nom, attente] of situations("cardiaque")) {
      const ctx = await attente;
      for (let k = 0; k <= 6; k++) {
        const p = buildWeekPlan(ctx, new Date(`${ilYa(-k)}T12:00:00Z`));
        if (tousLesTextes(p).some(({ x }) => FC.test(x))) vu.fc++;
        if (toutesLesEtiquettes(p).some(({ x }) => ZONE.test(x))) vu.zone++;
        if (tousLesTextes(p).some(({ x }) => /fie-toi à la FC/.test(x))) vu.gap++;
        if (tousLesTextes(p).some(({ x }) => /calée sur ta VMA/.test(x))) vu.why++;
      }
      assert.equal(ctx.pilotageSensation, false, `${nom} : le témoin cardiaque est à la sensation`);
    }
    assert.ok(vu.fc && vu.zone && vu.gap && vu.why, `précondition : le témoin cardiaque n'a pas tout (${JSON.stringify(vu)})`);
    let semaines = 0;
    for (const [nom, attente] of situations("grossesse")) {
      const ctx = await attente;
      assert.equal(ctx.pilotageSensation, true, `${nom} : précondition, pas à la sensation`);
      for (let k = 0; k <= 6; k++) {
        const jour = new Date(`${ilYa(-k)}T12:00:00Z`);
        const p = buildWeekPlan(ctx, jour);
        // La seconde passe du coach (consignes du kiné reprises après les ajustements), puis la sensation, comme autoCoach.
        const refait = planALaSensation(ctx, consignesSurPlan(ctx, p, jour));
        for (const [quelle, semaine] of [["plan", p], ["seconde passe du coach", refait]] as const) {
          for (const { d, x } of tousLesTextes(semaine)) assert.doesNotMatch(x, FC, `${nom} · J+${k} · ${quelle} · ${d.date} ${d.type} : « ${x.slice(0, 160)} » [${x.match(FC)?.[0]}]`);
          for (const { d, x } of toutesLesEtiquettes(semaine)) assert.doesNotMatch(x, ZONE, `${nom} · J+${k} · ${quelle} · ${d.date} ${d.type} : étiquette « ${x} »`);
        }
        semaines++;
      }
    }
    assert.equal(semaines, 28);
    // Le coach refait la sensation après sa seconde passe de consignes et après les conseils du coach avancé.
    const coach = codeNu("src/lib/ai/autoCoach.ts");
    assert.match(coach, /const week = planALaSensation\(ctx, avecCourseCEcartee\(ctx, consignesSurPlan\(ctx, ajuste\.week, jourPlan\), jourPlan\)\);/, "le coach ne refait plus la sensation après sa seconde passe de consignes");
    assert.match(coach, /\? planALaSensation\(ctx, avecCourseCEcartee\(ctx, appliquerConseils\(week, relecture\.conseils\), jourPlan\)\)/, "le coach ne refait plus la sensation après les conseils");
  });

  await test("grossesse : RIEN sur la montre — le coach et les trois routes admin ne construisent aucune séance (le coach retire celle qu'il avait posée)", () => {
    assert.equal(pilotageSensation(["grossesse"]), true);
    assert.equal(pilotageSensation(["cardiaque"]), false);
    assert.equal(pilotageSensation([["grossesse"]]), false, "une liste imbriquée passe pour une grossesse");
    assert.match(codeNu("src/lib/ai/autoCoach.ts"), /const built = ctx\.pilotageSensation \? null : buildWorkoutDescription\(/, "le coach envoie à la montre d'une coureuse à la sensation");
    assert.match(codeNu("src/lib/ai/autoCoach.ts"), /if \(!built\) \{\s*await supprimerIntervalsWorkout\(/, "le coach ne retire plus la séance d'un jour sans séance montre");
    for (const r of ["assign-session", "publish-plan", "repush-watch"])
      assert.match(codeNu(`src/app/api/admin/${r}/route.ts`), /const built = pilotageSensation\(\(prof as Record<string, unknown> \| null\)\?\.health_conditions\) \? null : buildWorkoutDescription\(/, `${r} envoie à la montre d'une coureuse à la sensation`);
  });

  await test("covid long, bilan du matin à 4/5 au lendemain d'une sortie : repos aujourd'hui et orientation vers le médecin ; ni sans bilan, ni pour un cardiaque, ni trois jours après", async () => {
    const sansBilan = plan(await contexte(["covid_long"], []));
    const jour0 = (p: Jour[]) => p.filter((d) => d.date === AUJOURDHUI);
    assert.ok(jour0(sansBilan).some((d) => d.type !== "Repos"), "précondition : le covid long sans bilan court aujourd'hui");
    const ctx = await contexte(["covid_long"], [bilan(4, 2)]);
    assert.equal(ctx.malaiseApresEffort, true, "le malaise après effort n'est pas reconnu");
    const p = plan(ctx);
    assert.ok(jour0(p).every((d) => d.type === "Repos"), `aujourd'hui : ${jour0(p).map((d) => d.type).join(", ")}`);
    assert.match(jour0(p)[0].why, /parles-en à ton médecin/, "le repos n'oriente pas vers le médecin");
    assert.ok(ctx.readiness.reasons.some((r) => /parles-en à ton médecin/.test(r)), "le motif n'est pas dit");
    for (const l of ["en", "de", "es", "pt"] as const) assert.ok(String(jour0(p)[0].i18n?.[l]?.why ?? "").length > 40, `${l} : le « pourquoi » du repos manque`);
    // Un cardiaque avec le même bilan : la règle est celle du covid long.
    assert.equal((await contexte(["cardiaque"], [bilan(4, 2)])).malaiseApresEffort, false, "le cardiaque se voit appliquer la règle du covid long");
    // Trois jours sans courir : ce n'est plus « après une séance ».
    const ancien = SEANCES.filter((w) => String(w.date) <= ilYa(3));
    assert.equal((await contexte(["covid_long"], [bilan(4, 2)], ancien)).malaiseApresEffort, false, "un bilan trois jours après la sortie déclenche le repos");
    assert.equal((await contexte(["covid_long"], [bilan(3, 3)])).malaiseApresEffort, false, "un bilan à 3/5 déclenche le repos");
  });

  await test("feuille de route vue par l'admin : le focus dit le cadre de santé, pas « VMA & seuil »", async () => {
    const cardiaque = await contexte(["cardiaque"], [objectif(10, 60)]);
    const covid = await contexte(["covid_long"], [objectif(10, 60)]);
    const temoin = await contexte([], [objectif(10, 60)]);
    assert.ok(temoin.macroPlan.some((w) => /VMA|vitesse/i.test(w.focus)), "précondition : le focus du témoin parle de VMA ou de vitesse");
    for (const w of cardiaque.macroPlan) assert.match(w.focus, /seuil bas au plus — cadre de santé/, `cardiaque, semaine ${w.week} : « ${w.focus} »`);
    for (const w of covid.macroPlan) assert.match(w.focus, /Endurance facile — cadre de santé/, `covid long, semaine ${w.week} : « ${w.focus} »`);
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
