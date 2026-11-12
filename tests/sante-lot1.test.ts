/**
 * SANTÉ, LOT 1 (Cyprien, 10/11/2026) — l'onglet des douleurs pensé pour le coureur qui a mal.
 *
 *  · une seule liste (l'écran disait « aucune douleur déclarée » au-dessus d'une douleur signalée) ;
 *  · ce que le coach a changé, quand consulter, la charge des semaines d'avant ;
 *  · LES CONSIGNES DU KINÉSITHÉRAPEUTE, saisies par le coureur et RESPECTÉES par le plan :
 *    exercé ici sur le vrai moteur (buildAthleteContext + buildWeekPlan, faux client en mémoire) ;
 *  · le carnet imprimable pour le rendez-vous.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validerConsignes, consignesEnVigueur, kmPourDuree } from "../src/lib/health/consignesKine";
import { doitConsulter, chargeAvantDouleur, JOURS_AVANT_CONSULTER, type DouleurUnifiee } from "../src/lib/health/santeDouleurs";
import { computeQualityBudget } from "../src/lib/coach/qualityBudget";
import { buildAthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { lignesRetireesParDouleur } from "../src/lib/coach/footings";
import { appliquerConsignes } from "../src/lib/coach/consignesPlan";
import { PLAN_T } from "../src/lib/ai/planI18n";
import { buildWorkoutDescription } from "../src/lib/watch/intervals";
import type { PlanDay } from "../src/lib/ai/autoPlan";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeOf = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const AUJ = aujourdhui(FUSEAU_DEFAUT);
const ilYa = (n: number) => { const d = new Date(`${AUJ}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// ── Faux client Supabase en mémoire (filtres, bornes, tri, plafond ; écritures interdites) ──
type L = Record<string, unknown>;
function fauxClient(tables: Record<string, unknown[]>) {
  const requete = (table: string, toutes: unknown[]) => {
    const filtres: [string, unknown][] = []; const bornes: [string, string, unknown][] = [];
    let tri: { col: string; asc: boolean } | null = null; let plafond: number | null = null;
    const borne = (l: L) => bornes.every(([c, o, v]) => { if (!(c in l) || l[c] == null) return !(c in l); const a = l[c] as string, b = v as string; return o === "gte" ? a >= b : o === "lte" ? a <= b : o === "lt" ? a < b : a > b; });
    const lignes = () => { let r = (toutes as L[]).filter((l) => filtres.every(([c, v]) => !(c in l) || l[c] === v) && borne(l)); if (tri) { const { col, asc } = tri; r = [...r].sort((x, y) => (x[col] === y[col] ? 0 : ((x[col] as never) > (y[col] as never) ? 1 : -1) * (asc ? 1 : -1))); } if (plafond != null) r = r.slice(0, plafond); return r; };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "not", "in", "or", "neq", "is", "ilike"]) q[m] = () => q;
    for (const o of ["gte", "lte", "lt", "gt"]) q[o] = (c: string, v: unknown) => { bornes.push([c, o, v]); return q; };
    for (const m of ["insert", "update", "upsert", "delete"]) q[m] = () => { throw new Error(`écriture interdite (${table}.${m})`); };
    q.order = (c: string, o?: { ascending?: boolean }) => { if (!tri) tri = { col: c, asc: o?.ascending !== false }; return q; };
    q.limit = (n: number) => { plafond = n; return q; };
    q.eq = (c: string, v: unknown) => { filtres.push([c, v]); return q; };
    q.single = () => { const l = lignes(); return Promise.resolve({ data: l[0] ?? null, error: l[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: lignes()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: lignes(), error: null }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(t, tables[t] ?? []) } as never;
}
// ⚠️ PAS DE `last_lat` : aucune requête météo. Un coureur régulier, 5 jours dispo.
const PROFIL = { id: "u", preferred_language: "fr", full_name: "Test", age: 25, gender: "male", weight_kg: 70, days_per_week: 5, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true };
const BASE = [{ user_id: "u", vma_kmh: 18, max_hr: 200, resting_hr: 45, tested_at: ilYa(20) }];
const SEANCES = Array.from({ length: 24 }, (_, i) => ({ id: `w${i}`, user_id: "u", date: ilYa(i * 2 + 1), type: "easy", sport: "run", distance_km: 12, duration_seconds: 3600, elevation_gain_m: 40, avg_hr: 145, max_hr: 165, tss: 60, hr_zone_seconds: [600, 3000, 0, 0, 0] }));
const CONSIGNES = (c: Record<string, unknown>) => ({ user_id: "u", type: "consignes_kine", data: { dureeMaxMin: null, sansIntensite: false, seancesMaxSemaine: null, jusquAu: ilYa(-14), majA: AUJ, ...c } });
const QUALITE = /^(VMA|Seuil|Spécifique|Côtes|Fartlek|Tempo)/;
const COURSE = (t: string) => !/^(Repos|Renfo|Vélo|Natation|Croisé|Mobilité)/.test(t);

async function main() {
  console.log("\nLES CONSIGNES DU KINÉSITHÉRAPEUTE");

  await test("la saisie est bornée, et une consigne qui ne contraint rien est refusée", () => {
    assert.deepEqual(validerConsignes({ dureeMaxMin: 30, jusquAu: ilYa(-10) }, AUJ).ok, true);
    assert.deepEqual(validerConsignes({ jusquAu: ilYa(-10) }, AUJ), { ok: false, motif: "vide" });
    assert.deepEqual(validerConsignes({ dureeMaxMin: 2, jusquAu: ilYa(-10) }, AUJ), { ok: false, motif: "duree" });
    // 3e relecture : sous 15 min, la plus courte séance (5 + 5 + 5) ne tiendrait pas.
    assert.deepEqual(validerConsignes({ dureeMaxMin: 14, jusquAu: ilYa(-10) }, AUJ), { ok: false, motif: "duree" }, "une durée de 14 min acceptée");
    assert.equal(validerConsignes({ dureeMaxMin: 15, jusquAu: ilYa(-10) }, AUJ).ok, true);
    assert.deepEqual(validerConsignes({ seancesMaxSemaine: 0, jusquAu: ilYa(-10) }, AUJ), { ok: false, motif: "seances" }, "0 séance accepté alors que le plan en pose toujours une");
    assert.deepEqual(validerConsignes({ sansIntensite: true, jusquAu: ilYa(1) }, AUJ), { ok: false, motif: "date" }, "une date passée acceptée");
    assert.deepEqual(validerConsignes({ sansIntensite: true, jusquAu: ilYa(-200) }, AUJ), { ok: false, motif: "date" }, "une consigne de plus de 6 mois acceptée");
    assert.equal(consignesEnVigueur({ sansIntensite: true, jusquAu: ilYa(1) }, AUJ), null, "une consigne expirée s'applique encore");
    assert.equal(kmPourDuree(30, "5'00"), 6);
    assert.equal(kmPourDuree(30, null), null, "une distance devinée sans allure connue");
  });

  await test("« pas d'intensité » ou une durée maximale : aucune qualité, aucun plancher ne la relève", () => {
    const base = { level: "confirme" as const, goal: "10k" as const, phase: "DÉVELOPPEMENT", noHistory: false, pains: [], hrvDown: false, hrvUp: false, badNight: false, acr: 1, tsb: 0, rpeHigh: false, rpeAvg: null, hardTimePct: null, fadeSec: null, plateau: false, noMaxEffort: false, runYears: 5, weightLossMaxQuality: null, hasObjective: true, daysToRace: 40, isShortGoal: true };
    assert.ok(computeQualityBudget(base).qBudget >= 2, "précondition : l'athlète a de la qualité");
    const r = computeQualityBudget({ ...base, consignesKine: { motif: "consignes de ton kinésithérapeute", sansQualite: true } });
    assert.equal(r.qBudget, 0, "la consigne n'a pas retiré la qualité");
    assert.ok(r.easeReasons.includes("consignes de ton kinésithérapeute"), "le motif n'est pas dit");
    assert.ok(computeQualityBudget({ ...base, consignesKine: { motif: "m", sansQualite: false } }).qBudget >= 1, "une consigne sans interdiction a retiré la qualité");
  });

  await test("le plan RÉEL respecte les consignes : pas de qualité, sorties bornées en nombre et en durée", async () => {
    const tables = { profiles: [PROFIL], performance_baselines: BASE, workouts: SEANCES, notifications: [CONSIGNES({ dureeMaxMin: 30, sansIntensite: true, seancesMaxSemaine: 3 })] };
    const ctx = await buildAthleteContext(fauxClient(tables), "u");
    assert.ok(ctx.consignes, "les consignes ne sont pas lues");
    assert.ok(ctx.consignes!.kmMax != null && ctx.consignes!.kmMax > 0, "la durée maximale n'a pas donné de distance");
    assert.ok(ctx.volume.longRunKm <= ctx.consignes!.kmMax!, `sortie longue de ${ctx.volume.longRunKm} km pour ${ctx.consignes!.kmMax} km permis`);
    const plan = buildWeekPlan(ctx, new Date(`${AUJ}T08:00:00`));
    const qualite = plan.filter((d) => QUALITE.test(d.type));
    assert.deepEqual(qualite.map((d) => d.type), [], "une séance de qualité malgré « pas d'intensité »");
    const sorties = plan.filter((d) => COURSE(d.type));
    assert.ok(sorties.length <= 3, `${sorties.length} sorties de course pour 3 permises : ${sorties.map((d) => `${d.date} ${d.type}`).join(", ")}`);
    for (const d of sorties) {
      const km = Number((d.tags ?? []).map((t) => /^(\d+(?:,\d+)?) km$/.exec(String(t))?.[1]).find(Boolean)?.replace(",", "."));
      if (Number.isFinite(km)) assert.ok(km <= ctx.consignes!.kmMax! + 0.5, `${d.date} ${d.type} : ${km} km pour ${ctx.consignes!.kmMax} km permis`);
      if (d.type === "Récup") {
        const m = /Échauffement (\d+) min[\s\S]*Corps : (\d+) min[\s\S]*Retour au calme (\d+) min/.exec(d.detail);
        assert.ok(m && Number(m[1]) + Number(m[2]) + Number(m[3]) <= 30, `la récupération dépasse la durée maximale : ${d.detail}`);
      }
    }
  });

  await test("à la durée minimale (15 min), la récupération y tient : 5 + 5 + 5", async () => {
    const ressenti = { user_id: "u", type: "session_feedback", created_at: `${ilYa(1)}T19:00:00Z`, data: { date: ilYa(1), ts: `${ilYa(1)}T19:00:00Z`, rpe: 3, pain: ["Tibia (périoste)"] } };
    const ctx = await buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: BASE, workouts: SEANCES, notifications: [ressenti, CONSIGNES({ dureeMaxMin: 15 })] }), "u");
    const recup = buildWeekPlan(ctx, new Date(`${AUJ}T08:00:00`)).filter((d) => d.type === "Récup");
    assert.ok(recup.length > 0, "précondition : aucune journée de récupération");
    for (const d of recup) assert.match(d.detail, /Échauffement 5 min[\s\S]*Corps : 5 min[\s\S]*Retour au calme 5 min/, `récupération de plus de 15 min : ${d.detail}`);
  });

  await test("sans allure facile connue, la durée maximale s'applique quand même, en minutes", async () => {
    // Aucun historique ni test : l'allure facile est inconnue, donc aucune distance n'en découle…
    const ctx = await buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: [], workouts: [], notifications: [CONSIGNES({ dureeMaxMin: 30 })] }), "u");
    assert.ok(ctx.consignes, "les consignes ne sont pas lues");
    assert.equal(ctx.consignes!.kmMax, null, `distance inventée sans allure : ${ctx.consignes!.kmMax}`);
    // …mais chaque sortie du plan est prescrite en minutes, dans la durée.
    const plan = buildWeekPlan(ctx, new Date(`${AUJ}T08:00:00`));
    const sorties = plan.filter((d) => COURSE(d.type) && d.type !== "Repos" && d.type !== "Course");
    assert.ok(sorties.length > 0, "précondition : aucune sortie dans le plan");
    for (const d of sorties) {
      const m = /Échauffement (\d+) min[\s\S]*Corps : (\d+) min[\s\S]*Retour au calme (\d+) min/.exec(d.detail);
      assert.ok(m && Number(m[1]) + Number(m[2]) + Number(m[3]) <= 30, `sortie hors durée sans allure : ${d.type} « ${d.detail} »`);
    }
  });

  await test("sous une durée maximale, la journée de récupération y tient aussi", async () => {
    // Une douleur signalée hier met le jour au rouge : le plan pose une « Récup » (50 min sans consigne).
    const ressenti = { user_id: "u", type: "session_feedback", created_at: `${ilYa(1)}T19:00:00Z`, data: { date: ilYa(1), ts: `${ilYa(1)}T19:00:00Z`, rpe: 3, pain: ["Tibia (périoste)"] } };
    const tables = { profiles: [PROFIL], performance_baselines: BASE, workouts: SEANCES, notifications: [ressenti, CONSIGNES({ dureeMaxMin: 30 })] };
    const ctx = await buildAthleteContext(fauxClient(tables), "u");
    const recup = buildWeekPlan(ctx, new Date(`${AUJ}T08:00:00`)).filter((d) => d.type === "Récup");
    assert.ok(recup.length > 0, "précondition : aucune journée de récupération dans le plan");
    for (const d of recup) {
      const m = /Échauffement (\d+) min[\s\S]*Corps : (\d+) min[\s\S]*Retour au calme (\d+) min/.exec(d.detail);
      assert.ok(m, `récupération illisible : ${d.detail}`);
      assert.ok(Number(m![1]) + Number(m![2]) + Number(m![3]) <= 30, `récupération hors consigne : ${d.detail}`);
    }
  });

  await test("sans consigne, le même coureur garde sa qualité (le test ne passe pas par hasard)", async () => {
    const ctx = await buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: BASE, workouts: SEANCES, notifications: [] }), "u");
    assert.equal(ctx.consignes, null);
    assert.ok(ctx.weekPlan.qBudget >= 1, `précondition : budget de qualité ${ctx.weekPlan.qBudget}`);
  });

  console.log("\nLE CONTRÔLE FINAL : TOUS LES CHEMINS DU PLAN (relecture du directeur scientifique)");
  // Une semaine qui passe par tous les chemins qui produisent une séance de course.
  const J = (n: number) => ilYa(-n);
  const jour = (n: number, type: string, title: string, tags: string[], detail = "Corps : 40 min") =>
    ({ date: J(n), type, title, detail, why: "parce que", tags, confirmed: n < 2,
      i18n: { en: { title: `${title} (en)`, detail, why: "because", tags } } }) as unknown as PlanDay;
  const SEMAINE: PlanDay[] = [
    jour(0, "Endurance", PLAN_T.fr.enduranceTitreLignes, ["Endurance", "Z2", "10 km"]),
    jour(1, "Marche/course", "Marche-course", ["Marche/course", "35 min"]),
    jour(2, "Seuil", "Seuil", ["Seuil", "Qualité", "11 km"]),
    jour(3, "Renfo", "Renfo", ["Renfo"], "Squats, bonds"),
    jour(4, "Récup", PLAN_T.fr.veilleTitre, ["Récup", "Veille de course"]),
    jour(5, "Course", "🏁 Course C", ["Course"]),
    jour(6, "Course", "🏁 Marathon", ["Course", "Objectif"]),
  ];
  const consignes = (c: Partial<{ dureeMaxMin: number | null; sansIntensite: boolean; seancesMaxSemaine: number | null }>) =>
    ({ dureeMaxMin: null, sansIntensite: false, seancesMaxSemaine: null, jusquAu: J(30), majA: AUJ, ...c });
  const total = (d: PlanDay) => {
    const m = /Échauffement (\d+) min[\s\S]*Corps : (\d+) min[\s\S]*Retour au calme (\d+) min/.exec(d.detail);
    return m ? Number(m[1]) + Number(m[2]) + Number(m[3]) : null;
  };
  const fenetre = (date: string) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 6); return d.toISOString().slice(0, 10); };

  await test("durée maximale (15 et 20 min) : chaque sortie tient, la montre reçoit la même durée, la marche-course trop longue devient repos", () => {
    for (const max of [15, 20]) {
      const plan = appliquerConsignes(SEMAINE, { consignes: consignes({ dureeMaxMin: max }), allureFacile: "5'00", sortiesRecentes: [], courseC: J(5) });
      for (const d of plan) {
        if (!COURSE(d.type) || d.type === "Repos" || d.title === "🏁 Marathon") continue;
        const t = total(d);
        assert.ok(t != null && t <= max, `${max} min : ${d.date} ${d.type} « ${d.detail} »`);
        // La montre lit la prose française : elle doit recevoir la même durée.
        const montre = buildWorkoutDescription(d.title, d.detail, `${d.type} ${d.tags.join(" ")}`, null, 16, 15, 10)?.description ?? "";
        const minutes = [...montre.matchAll(/^- (\d+)m /gm)].reduce((s, m) => s + Number(m[1]), 0);
        assert.ok(minutes > 0 && minutes <= max, `${max} min : la montre reçoit ${minutes} min pour ${d.date}`);
      }
      assert.equal(plan[1].type, "Repos", `${max} min : la marche-course de 35 min est restée`);
      assert.equal(plan[5].type, "Récup", "la course C n'est pas devenue un footing");
      assert.equal(plan[6].type, "Course", "la course objectif a été retirée");
      assert.match(plan[6].why, /accord avant de la courir/, "la course objectif ne dit pas de demander l'accord");
      assert.ok(plan[6].i18n?.en?.why.includes("go-ahead"), "l'avertissement manque en anglais");
    }
    // Une marche-course qui tient dans la durée est gardée telle quelle.
    const mc = appliquerConsignes(SEMAINE, { consignes: consignes({ dureeMaxMin: 40 }), allureFacile: "5'00", sortiesRecentes: [], courseC: null });
    assert.equal(mc[1].type, "Marche/course");
    assert.ok((total(mc[0]) ?? 99) <= 40);
    // Jamais plus long que la séance remplacée : 3 km à 5'00 = 15 min, sous 60 min permises.
    const court = appliquerConsignes([jour(0, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "3 km"], "Footing facile")],
      { consignes: consignes({ dureeMaxMin: 60 }), allureFacile: "5'00", sortiesRecentes: [], courseC: null });
    assert.ok((total(court[0]) ?? 99) <= 15, `un footing de 15 min devenu ${total(court[0])} min`);
  });

  await test("sans intensité (sans durée) : lignes droites, progressif, qualité, veille et course C deviennent un footing ; le reste ne bouge pas", () => {
    const simple = jour(7, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "Z2", "10 km"]);
    const prog = jour(8, "Endurance", PLAN_T.fr.enduranceTitreProg, ["Endurance", "Z2", "10 km"]);
    const longue = jour(9, "Sortie longue", "Sortie longue", ["Long", "18 km"]);
    const plan = appliquerConsignes([...SEMAINE, simple, prog, longue],
      { consignes: consignes({ sansIntensite: true }), allureFacile: "5'00", sortiesRecentes: [], courseC: J(5) });
    for (const i of [0, 2, 4, 5, 8]) {
      assert.equal(plan[i].type, "Récup", `séance intense gardée : n° ${i} « ${plan[i].title} »`);
      assert.match(plan[i].detail, /Corps : \d+ min/, "le footing n'est pas lisible par la montre");
    }
    assert.equal(plan[1].type, "Marche/course", "la marche-course n'a pas d'intensité");
    assert.equal(plan[7].title, PLAN_T.fr.enduranceTitre, "un footing simple a été réécrit");
    assert.equal(plan[9].type, "Sortie longue", "la sortie longue n'a pas d'intensité");
    assert.equal(plan[6].type, "Course", "la course objectif a été retirée");
    assert.match(plan[3].detail, /aucun saut/, "le renforcement garde ses sauts");
    assert.ok(plan[3].i18n?.en?.detail.includes("no jumps"), "la consigne de renfo manque en anglais");
    assert.equal(plan[0].i18n?.en?.title, "Run within your physio's limits", "le footing n'est pas traduit");
  });

  await test("nombre de sorties : 7 jours GLISSANTS, sorties déjà courues comprises ; la course objectif n'est jamais retirée", () => {
    const tous = Array.from({ length: 7 }, (_, n) => jour(n, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"]));
    for (const [max, recentes] of [[1, []], [2, [ilYa(1)]], [3, [ilYa(1), ilYa(3), ilYa(6)]]] as [number, string[]][]) {
      const plan = appliquerConsignes(tous, { consignes: consignes({ seancesMaxSemaine: max }), allureFacile: "5'00", sortiesRecentes: recentes, courseC: null });
      const courues = [...recentes, ...plan.filter((d) => d.type !== "Repos").map((d) => d.date)];
      for (const d of plan) {
        const n = courues.filter((x) => x >= fenetre(d.date) && x <= d.date).length;
        assert.ok(n <= max, `${max} sortie(s) max, ${n} sur les 7 jours finissant le ${d.date} (déjà courues : ${recentes.join(", ") || "aucune"})`);
      }
      assert.ok(plan.some((d) => d.type !== "Repos"), `${max} : plus aucune sortie`);
      if (max === 2) assert.equal(plan[0].type, "Endurance", "une sortie permise aujourd'hui a été retirée");
    }
    const avecCourse = [...tous.slice(0, 6), jour(6, "Course", "🏁 Marathon", ["Course", "Objectif"])];
    const plan = appliquerConsignes(avecCourse, { consignes: consignes({ seancesMaxSemaine: 1 }), allureFacile: null, sortiesRecentes: [], courseC: null });
    assert.equal(plan[6].type, "Course", "la course objectif a été retirée pour tenir le nombre de sorties");
  });

  await test("une récupération sans distance n'est jamais rallongée (25 min sous une consigne de 120 min)", () => {
    const recup = jour(0, "Récup", PLAN_T.fr.recupTitre, ["Récup", "Z1"], PLAN_T.fr.recupDetail(10, 10, 5));
    const [r] = appliquerConsignes([recup], { consignes: consignes({ dureeMaxMin: 120 }), allureFacile: null, sortiesRecentes: [], courseC: null });
    assert.ok((total(r) ?? 99) <= 25, `récupération de 25 min devenue ${total(r)} min : ${r.detail}`);
    assert.equal(total(r), 25, `récupération de 25 min raccourcie sans raison à ${total(r)} min`);
  });

  await test("consigne haute (60 min) ou « sans intensité » seule : aucune séance courte n'est rallongée", () => {
    const cas: [string, PlanDay, number][] = [
      ["récupération d'un jour rouge", jour(0, "Récup", PLAN_T.fr.recupTitre, ["Récup", "Z1"], PLAN_T.fr.recupDetail(5, 5)), 35],
      ["récupération d'après-course (20 à 30 min)", jour(1, "Récup", PLAN_T.fr.recupTitre, ["Récup", "Z1"], PLAN_T.fr.recupCourseDetail), 20],
      ["veille de course (20 min)", jour(2, "Récup", PLAN_T.fr.veilleTitre, ["Récup", "Veille de course"], PLAN_T.fr.veilleDetail), 20],
      ["avant-veille (30 min)", jour(3, "Récup", PLAN_T.fr.avantVeilleTitre, ["Récup"], PLAN_T.fr.avantVeilleDetail), 30],
      ["footing sans allure ni durée lisible", jour(4, "Endurance", PLAN_T.fr.enduranceTitreLignes, ["Endurance", "8 km"], "Footing facile"), 25],
    ];
    for (const c of [consignes({ dureeMaxMin: 60 }), consignes({ sansIntensite: true })]) {
      const plan = appliquerConsignes(cas.map((x) => x[1]), { consignes: c, allureFacile: null, sortiesRecentes: [], courseC: null });
      cas.forEach(([nom, , max], i) => {
        if (plan[i].type !== "Récup" || plan[i].title !== "Footing encadré par ton kiné") return;
        assert.ok((total(plan[i]) ?? 99) <= max, `${nom} rallongée à ${total(plan[i])} min (${JSON.stringify(c)})`);
      });
    }
  });

  await test("nombre de sorties : une course gardée prend sa place AVANT les footings (1 sortie, course à J6)", () => {
    const semaine = [...Array.from({ length: 6 }, (_, n) => jour(n, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile")),
      jour(6, "Course", "🏁 10 km", ["Course", "Objectif"])];
    const plan = appliquerConsignes(semaine, { consignes: consignes({ seancesMaxSemaine: 1 }), allureFacile: "5'00", sortiesRecentes: [], courseC: null });
    assert.equal(plan[6].type, "Course", "la course a été retirée");
    const courues = plan.filter((d) => d.type !== "Repos").map((d) => d.date);
    for (const d of plan) assert.ok(courues.filter((x) => x >= fenetre(d.date) && x <= d.date).length <= 1, `2 sorties sur les 7 jours finissant le ${d.date}`);
  });

  await test("les consignes s'arrêtent à leur date de fin : après, rien n'est bridé ni annoncé", () => {
    const semaine = [jour(0, "Seuil", "Seuil", ["Seuil", "Qualité", "11 km"]), jour(1, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"),
      jour(2, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"), jour(3, "Seuil", "Seuil", ["Seuil", "Qualité", "11 km"]),
      jour(4, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"), jour(5, "Renfo", "Renfo", ["Renfo"], "Squats"), jour(6, "Course", "🏁 10 km", ["Course"])];
    const c = { ...consignes({ dureeMaxMin: 20, sansIntensite: true, seancesMaxSemaine: 1 }), jusquAu: J(2) };
    const plan = appliquerConsignes(semaine, { consignes: c, allureFacile: "5'00", sortiesRecentes: [], courseC: null });
    assert.equal(plan[0].type, "Récup", "pendant les consignes, le seuil reste");
    for (const i of [3, 4, 5, 6]) assert.deepEqual(plan[i], semaine[i], `après la fin des consignes, le jour ${i} a été modifié`);
  });

  await test("réappliqué après un ajustement de l'athlète : la limite tient, et rien n'est doublé", () => {
    const tous = Array.from({ length: 7 }, (_, n) => jour(n, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"));
    const c = { consignes: consignes({ seancesMaxSemaine: 3, sansIntensite: true }), allureFacile: "5'00", sortiesRecentes: [], courseC: null };
    const plan = appliquerConsignes([...tous.slice(0, 3), jour(3, "Renfo", "Renfo", ["Renfo"], "Squats"), ...tous.slice(4, 6), jour(6, "Course", "🏁 Marathon", ["Course"])], c);
    // « Décaler » : l'athlète déplace une sortie sur un jour de repos, après le moteur.
    const iRepos = plan.findIndex((d) => d.type === "Repos");
    assert.ok(iRepos >= 0, "précondition : aucun repos posé par la limite");
    const decale = plan.map((d, i) => (i === iRepos ? { ...plan[0], date: d.date } : d));
    const apres = appliquerConsignes(decale, c);
    const courues = apres.filter((d) => d.type !== "Repos" && d.type !== "Renfo").map((d) => d.date);
    for (const d of apres.filter((x) => x.type !== "Repos" && x.type !== "Renfo" && x.type !== "Course")) {
      assert.ok(courues.filter((x) => x >= fenetre(d.date) && x <= d.date).length <= 3, `4e sortie après l'ajustement, le ${d.date}`);
    }
    // Idempotent : réappliquer ne double ni l'avertissement de course ni la consigne de renfo.
    assert.deepEqual(appliquerConsignes(plan, c), plan, "le contrôle n'est pas idempotent");
    assert.match(codeOf("src/lib/ai/autoCoach.ts"), /const week = consignesSurPlan\(ctx, ajuste\.week, maintenant\);/, "le coach ne réapplique plus les consignes après les ajustements");
  });

  await test("une sortie courue aujourd'hui compte, même si le plan du jour n'en prévoyait pas", () => {
    const semaine = [jour(0, "Repos", PLAN_T.fr.reposTitre, ["Repos"]), ...Array.from({ length: 6 }, (_, n) => jour(n + 1, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"))];
    const plan = appliquerConsignes(semaine, { consignes: consignes({ seancesMaxSemaine: 2 }), allureFacile: "5'00", sortiesRecentes: [ilYa(1), AUJ], courseC: null });
    assert.equal(plan[1].type, "Repos", "demain : 3e sortie en 7 jours (hier + ce matin)");
    // La sortie prévue aujourd'hui ET courue n'est pas comptée deux fois.
    const avecJ0 = appliquerConsignes(semaine.map((d, i) => (i === 0 ? { ...semaine[1], date: d.date } : d)),
      { consignes: consignes({ seancesMaxSemaine: 2 }), allureFacile: "5'00", sortiesRecentes: [AUJ], courseC: null });
    assert.notEqual(avecJ0[1].type, "Repos", "la sortie du jour a été comptée deux fois");
  });

  await test("l'écran ne dit « recalculé » que si la route l'a fait", () => {
    const route = codeOf("src/app/api/health/consignes/route.ts");
    assert.match(route, /replanifie = res\?\.processed === true;/, "la route ne lit plus le résultat du coach");
    assert.match(route, /NextResponse\.json\(\{ ok: true, replanifie,/);
    assert.match(codeOf("src/components/health/HealthCenter.tsx"), /j\.replanifie === true\s*\? \(retirer \? "k\.consRetirees" : "k\.consOk"\)\s*: \(retirer \? "k\.consRetireesAttente" : "k\.consAttente"\)/, "l'écran affirme le recalcul sans le savoir");
  });

  await test("le plan RÉEL compte les sorties déjà courues : jamais plus de 2 sorties sur 7 jours glissants", async () => {
    const tables = { profiles: [PROFIL], performance_baselines: BASE, workouts: SEANCES, notifications: [CONSIGNES({ seancesMaxSemaine: 2 })] };
    const ctx = await buildAthleteContext(fauxClient(tables), "u");
    assert.ok((ctx.sortiesRecentes ?? []).length >= 3, `sorties récentes non lues : ${JSON.stringify(ctx.sortiesRecentes)}`);
    // Une sortie de ce matin est lue, et le plan la compte (jour d'aujourd'hui compris).
    const ctxMatin = await buildAthleteContext(fauxClient({ ...tables, workouts: [{ ...SEANCES[0], id: "matin", date: AUJ }, ...SEANCES] }), "u");
    assert.ok(ctxMatin.sortiesRecentes?.includes(AUJ), "la sortie de ce matin n'est pas lue");
    assert.match(codeOf("src/lib/ai/autoPlan.ts"), /sortiesRecentes: \(ctx\.sortiesRecentes \?\? \[\]\)\.filter\(\(d\) => d <= iso\(debut\)\)/, "les sorties d'aujourd'hui ne sont plus comptées");
    const plan = buildWeekPlan(ctx, new Date(`${AUJ}T08:00:00`));
    const courues = [...(ctx.sortiesRecentes ?? []).filter((d) => d < AUJ), ...plan.filter((d) => COURSE(d.type) && d.type !== "Repos").map((d) => d.date)];
    // Seules les sorties POSÉES sont jugées : l'historique peut déjà dépasser (3 sorties ici).
    for (const d of plan.filter((x) => COURSE(x.type) && x.type !== "Repos")) {
      const n = courues.filter((x) => x >= fenetre(d.date) && x <= d.date).length;
      assert.ok(n <= 2, `${n} sorties sur les 7 jours finissant le ${d.date}, celle du plan comprise`);
    }
    assert.ok(plan.filter((d) => d.date === AUJ).every((d) => !COURSE(d.type) || d.type === "Repos"), "aujourd'hui, 3 sorties déjà courues sur 7 jours : une 4e a été posée");
    // Rejoué sur les 7 jours de départ : la limite tient quel que soit le jour où le plan est bâti.
    for (let k = 1; k <= 6; k++) {
      const depart = new Date(`${AUJ}T08:00:00`); depart.setDate(depart.getDate() + k);
      const p = buildWeekPlan(ctx, depart);
      const c2 = [...(ctx.sortiesRecentes ?? []), ...p.filter((d) => COURSE(d.type) && d.type !== "Repos").map((d) => d.date)];
      for (const d of p.filter((x) => COURSE(x.type) && x.type !== "Repos")) {
        assert.ok(c2.filter((x) => x >= fenetre(d.date) && x <= d.date).length <= 2, `départ J+${k} : 3 sorties sur les 7 jours finissant le ${d.date}`);
      }
    }
    assert.ok(plan.some((d) => COURSE(d.type) && d.type !== "Repos"), "plus aucune sortie dans le plan");
  });

  await test("une sortie qui ne tient pas dans la limite est DÉCALÉE vers un repos où elle tient, pas seulement retirée", () => {
    // Deux sorties courues hier et avant-hier, 2 au plus sur 7 jours : celles du début de semaine ne
    // tiennent pas ; la semaine ne doit pas finir sans course (constaté le 12/11/2026).
    const semaine = [jour(0, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"), jour(1, "Repos", PLAN_T.fr.reposTitre, ["Repos"]),
      jour(2, "Repos", PLAN_T.fr.reposTitre, ["Repos"]), jour(3, "Repos", PLAN_T.fr.reposTitre, ["Repos"]), jour(4, "Repos", PLAN_T.fr.reposTitre, ["Repos"]),
      jour(5, "Repos", PLAN_T.fr.reposTitre, ["Repos"]), jour(6, "Repos", PLAN_T.fr.reposTitre, ["Repos"])];
    const c = { consignes: consignes({ seancesMaxSemaine: 2 }), allureFacile: "5'00", sortiesRecentes: [ilYa(1), ilYa(2)], courseC: null };
    const plan = appliquerConsignes(semaine, c);
    assert.equal(plan[0].type, "Repos", "la sortie qui ne tient pas est restée");
    const posees = plan.filter((d) => d.type !== "Repos");
    assert.equal(posees.length, 1, `la sortie n'a pas été décalée : ${plan.map((d) => d.type).join(", ")}`);
    const courues = [...c.sortiesRecentes, ...posees.map((d) => d.date)];
    for (const d of posees) assert.ok(courues.filter((x) => x >= fenetre(d.date) && x <= d.date).length <= 2, `décalée sur un jour où elle ne tient pas : ${d.date}`);
    // Jamais sur un jour où l'athlète ne court pas.
    const dispo = [0, 1, 2, 3, 4, 5, 6].filter((w) => w !== new Date(`${posees[0].date}T12:00:00Z`).getUTCDay());
    const plan2 = appliquerConsignes(semaine, { ...c, joursDispo: dispo });
    for (const d of plan2.filter((x) => x.type !== "Repos")) assert.notEqual(d.date, posees[0].date, "décalée sur un jour où l'athlète ne court pas");
  });

  await test("décalage : jamais une marche-course en course continue ; le pourquoi le dit ; les jours dispo passent par le vrai plan", async () => {
    const R = (n: number) => jour(n, "Repos", PLAN_T.fr.reposTitre, ["Repos"]);
    const mc = [jour(0, "Marche/course", "Marche-course", ["Marche/course", "30 min"]), R(1), R(2), R(3), R(4), R(5), R(6)];
    const p = appliquerConsignes(mc, { consignes: consignes({ seancesMaxSemaine: 2 }), allureFacile: "5'00", sortiesRecentes: [ilYa(1), ilYa(2)], courseC: null });
    assert.ok(p.every((d) => d.type === "Repos"), `une marche-course est devenue de la course : ${p.map((d) => d.type).join(", ")}`);
    const f = [jour(0, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"), R(1), R(2), R(3), R(4), R(5), R(6)];
    const q = appliquerConsignes(f, { consignes: consignes({ seancesMaxSemaine: 2 }), allureFacile: "5'00", sortiesRecentes: [ilYa(1), ilYa(2)], courseC: null });
    const decalee = q.find((d) => d.type !== "Repos");
    assert.ok(decalee && /décalée ici/.test(decalee.why) && decalee.i18n?.en?.why.includes("moved here"), "le pourquoi ne dit pas que la sortie a été décalée");
    assert.deepEqual(appliquerConsignes(q, { consignes: consignes({ seancesMaxSemaine: 2 }), allureFacile: "5'00", sortiesRecentes: [ilYa(1), ilYa(2)], courseC: null }), q, "réappliqué, le contrôle déplace encore");
    // Idempotence AVEC une durée maximale (fuzz du relecteur : le pourquoi « décalée ici » disparaissait).
    for (const duree of [30, 45, 60]) {
      const cd = { consignes: consignes({ seancesMaxSemaine: 2, dureeMaxMin: duree }), allureFacile: "5'00", sortiesRecentes: [ilYa(1), ilYa(2)], courseC: null };
      const une = appliquerConsignes(f, cd);
      assert.ok(une.some((d) => /décalée ici/.test(d.why)), `précondition (${duree} min) : aucune sortie décalée`);
      assert.deepEqual(appliquerConsignes(une, cd), une, `réappliqué avec ${duree} min, le plan change`);
    }
    // Site d'appel : consignesSurPlan passe les jours déclarés MOINS ceux que l'athlète rate.
    assert.match(codeOf("src/lib/ai/autoPlan.ts"), /joursDispo: ctx\.availability\?\.days\?\.filter\(\(d\) => !\(ctx\.skippedWeekdays \?\? \[\]\)\.includes\(d\)\),/, "les jours disponibles ne passent plus (ou incluent les jours ratés)");
    // Et le vrai plan : 2 jours déclarés, aucune sortie hors de ces jours.
    const tables = { profiles: [{ ...PROFIL, days_per_week: 2, available_days: [2, 6] }], performance_baselines: BASE, workouts: SEANCES, notifications: [CONSIGNES({ seancesMaxSemaine: 2 })] };
    const ctx = await buildAthleteContext(fauxClient(tables), "u");
    for (let k = 0; k <= 6; k++) {
      const d0 = new Date(`${AUJ}T08:00:00`); d0.setDate(d0.getDate() + k);
      for (const d of buildWeekPlan(ctx, d0).filter((x) => COURSE(x.type) && x.type !== "Repos")) {
        assert.ok([2, 6].includes(new Date(`${d.date}T12:00:00Z`).getUTCDay()), `départ J+${k} : sortie le ${d.date}, jour non déclaré`);
      }
    }
  });

  await test("une sortie décalée ne remplace jamais un repos protecteur (après une course, lendemain de sortie longue)", () => {
    const R = (n: number) => jour(n, "Repos", PLAN_T.fr.reposTitre, ["Repos"]);
    // Cas reproduit par le directeur scientifique : course A le jour 3, 3 sorties juste avant, 4 au plus.
    const avecCourse = [jour(0, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"),
      jour(1, "Récup", PLAN_T.fr.avantVeilleTitre, ["Récup"], PLAN_T.fr.avantVeilleDetail), jour(2, "Récup", PLAN_T.fr.veilleTitre, ["Récup"], PLAN_T.fr.veilleDetail),
      jour(3, "Course", "🏁 Marathon", ["Course", "Objectif"]), R(4), jour(5, "Récup", PLAN_T.fr.recupTitre, ["Récup"], PLAN_T.fr.recupDetail(5, 5)), R(6)];
    const p = appliquerConsignes(avecCourse, { consignes: consignes({ seancesMaxSemaine: 4 }), allureFacile: "5'00", sortiesRecentes: [ilYa(3), ilYa(2), ilYa(1)], courseC: null });
    assert.equal(p[4].type, "Repos", `le lendemain de la course porte une sortie : ${p[4].title}`);
    assert.equal(p[6].type, "Repos", `trois jours après la course, une sortie décalée : ${p[6].title}`);
    assert.equal(p[3].type, "Course");
    // Sortie longue puis repos complet : ce repos ne reçoit pas de sortie décalée.
    const avecLongue = [jour(0, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"), R(1),
      jour(2, "Sortie longue", "Sortie longue", ["Long", "14 km"]), R(3), R(4), R(5), R(6)];
    const q = appliquerConsignes(avecLongue, { consignes: consignes({ seancesMaxSemaine: 2 }), allureFacile: "5'00", sortiesRecentes: [ilYa(5), ilYa(6)], courseC: null });
    assert.equal(q[0].type, "Repos", "précondition : le footing du jour 0 ne tient pas");
    assert.ok(q.slice(4).some((d) => d.type !== "Repos"), "la sortie retirée n'a pas été décalée sur un jour non protecteur");
    assert.equal(q[3].type, "Repos", "le lendemain de la sortie longue porte une sortie décalée");
    assert.equal(q[2].type, "Sortie longue", "la séance du moteur a été évincée par une sortie décalée (deux passes)");
    // Seul jour de repos restant : le lendemain de la sortie longue. La sortie reste retirée.
    const Rf = (n: number) => jour(n, "Renfo", "Renfo", ["Renfo"], "Gainage");
    const seulLendemain = [jour(0, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"), Rf(1),
      jour(2, "Sortie longue", "Sortie longue", ["Long", "14 km"]), R(3), Rf(4), Rf(5), Rf(6)];
    const q2 = appliquerConsignes(seulLendemain, { consignes: consignes({ seancesMaxSemaine: 2 }), allureFacile: "5'00", sortiesRecentes: [ilYa(5), ilYa(6)], courseC: null });
    assert.equal(q2[3].type, "Repos", "la sortie retirée est posée le lendemain de la sortie longue");
    // Seul repos restant : la veille d'une course. La sortie reste retirée (48 h avant une course).
    const veilleSeule = [jour(0, "Endurance", PLAN_T.fr.enduranceTitre, ["Endurance", "8 km"], "Footing facile"), Rf(1), Rf(2), Rf(3), Rf(4), R(5),
      jour(6, "Course", "🏁 10 km", ["Course", "Objectif"])];
    const q3 = appliquerConsignes(veilleSeule, { consignes: consignes({ seancesMaxSemaine: 2 }), allureFacile: "5'00", sortiesRecentes: [ilYa(1), ilYa(2)], courseC: null });
    assert.equal(q3[0].type, "Repos", "précondition : le footing du jour 0 ne tient pas");
    assert.equal(q3[5].type, "Repos", "la sortie retirée est posée la veille de la course");
  });

  console.log("\nCE QUE LA DOULEUR A CHANGÉ, QUAND CONSULTER, LA CHARGE D'AVANT");

  await test("avec une douleur, le contexte dit ce qu'elle a retiré ; sans, il ne dit rien", async () => {
    const ressenti = { user_id: "u", type: "session_feedback", created_at: `${ilYa(1)}T19:00:00Z`, data: { date: ilYa(1), ts: `${ilYa(1)}T19:00:00Z`, rpe: 3, pain: ["Tibia (périoste)"] } };
    const avec = await buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: BASE, workouts: SEANCES, notifications: [ressenti] }), "u");
    assert.ok(avec.effetsDouleur, "les effets de la douleur manquent");
    assert.ok(avec.effetsDouleur!.qualiteRetiree >= 1, `aucune qualité retirée : ${JSON.stringify(avec.effetsDouleur)}`);
    // La douleur est ici le SEUL signal : la sortie longue réduite lui est bien due.
    const sl = avec.effetsDouleur!.sortieLongue;
    assert.ok(sl && sl.prevueKm > sl.reduiteKm, `réduction de la sortie longue non attribuée à la douleur : ${JSON.stringify(sl)}`);
    assert.equal(sl!.reduiteKm, avec.volume.longRunKm, "la sortie longue réduite affichée n'est pas celle du plan");
    const sans = await buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: BASE, workouts: SEANCES, notifications: [] }), "u");
    assert.equal(sans.effetsDouleur, null, "des effets inventés sans douleur");
  });

  await test("les lignes droites ne sont dites retirées que si, sans douleur, un footing en aurait porté", () => {
    assert.equal(lignesRetireesParDouleur(3, {}), true);
    assert.equal(lignesRetireesParDouleur(1, {}), false, "un seul footing n'en porte jamais");
    assert.equal(lignesRetireesParDouleur(3, { taper: true }), false, "l'affûtage n'en porte pas");
    assert.equal(lignesRetireesParDouleur(3, { semaineCourse: true }), false, "la semaine de course n'en porte pas");
    assert.equal(lignesRetireesParDouleur(3, { sansHistorique: true }), false);
    assert.match(codeOf("src/lib/ai/autoCoach.ts"), /lignesDroites: lignesRetireesParDouleur\(\s*week\.filter\(\(d: PlanDay\) => d\.date >= from && d\.type === "Endurance"\)\.length,/, "l'état du coach n'utilise plus le plan réel");
  });

  await test("« consulte » après 10 jours ou si elle empire ; jamais sinon", () => {
    const d = (x: Partial<DouleurUnifiee>): DouleurUnifiee => ({ cle: "face:shinL", source: "declaree", depuisJours: 3, derniereIlYaJours: 0, ...x });
    assert.equal(doitConsulter([d({})]), null);
    assert.deepEqual(doitConsulter([d({ depuisJours: JOURS_AVANT_CONSULTER })]), { motif: "duree", cle: "face:shinL" });
    assert.deepEqual(doitConsulter([d({ etat: "pire" })]), { motif: "pire", cle: "face:shinL" });
    assert.deepEqual(doitConsulter([d({ tendance: "aggravation" })]), { motif: "pire", cle: "face:shinL" });
  });

  await test("la charge d'avant : deux semaines contre les deux d'avant, en course seulement ; rien sans données", () => {
    const debut = "2026-11-09";
    const s = [
      { date: "2026-11-02", distance_km: 30, sport: "run" }, { date: "2026-10-28", distance_km: 26, sport: "run" },
      { date: "2026-10-20", distance_km: 40, sport: "run" },
      { date: "2026-11-03", distance_km: 80, sport: "bike" },
      { date: "2026-11-09", distance_km: 7, sport: "run" },
    ];
    assert.deepEqual(chargeAvantDouleur(s, debut), { kmAvant: 56, kmPrecedent: 40, variationPct: 40 });
    assert.equal(chargeAvantDouleur([], debut), null, "« 0 km » affiché sans aucune donnée");
    assert.deepEqual(chargeAvantDouleur([{ date: "2026-11-02", distance_km: 10, sport: "run" }], debut), { kmAvant: 10, kmPrecedent: 0, variationPct: null });
  });

  console.log("\nLES CHEMINS (site d'appel)");

  await test("l'écran : une seule liste, les effets, le rappel, la charge, les consignes et le carnet", () => {
    const ecran = codeOf("src/components/health/HealthCenter.tsx");
    assert.match(ecran, /tr\("k\.pese"\)/, "la liste unique a disparu");
    assert.doesNotMatch(ecran, /tr\("k\.seance"\)|tr\("k\.suivi"\)/, "une seconde liste des douleurs est revenue");
    assert.match(ecran, /\{douleurs\.map\(\(d\) => \{/, "la liste ne parcourt plus les douleurs réunies");
    assert.match(ecran, /tr\("k\.effetQualite", \{ n: effets\.qualiteRetiree \}\)/, "les effets ne sont plus dits");
    assert.match(ecran, /\{rappel && \(/, "le rappel « consulte » a disparu");
    assert.match(ecran, /fetch\("\/api\/health\/consignes"/, "le formulaire des consignes n'écrit plus");
    assert.match(ecran, /href="\/dashboard\/health\/carnet"/, "le lien vers le carnet a disparu");
    const page = codeOf("src/app/dashboard/health/page.tsx");
    assert.match(page, /rappel = doitConsulter\(douleurs\);/);
    assert.match(page, /douleurEffets/, "la page ne lit plus ce que le coach a changé");
  });

  await test("les consignes : écrites sur SA ligne, erreurs journalisées, plan relancé ; état du coach enregistré", () => {
    const route = codeOf("src/app/api/health/consignes/route.ts");
    assert.match(route, /\.update\(ligne\)\.eq\("id", existante\.id\)\.eq\("user_id", user\.id\)/, "mise à jour sans filtre de propriétaire");
    assert.match(route, /\.delete\(\)\.eq\("user_id", user\.id\)\.eq\("type", TYPE_CONSIGNES\)/, "suppression sans filtre de propriétaire, ou qui laisse des doublons");
    assert.match(route, /if \(eLecture\) \{\s*await journal\(/);
    assert.match(route, /await autoCoachForUser\(admin,/, "le plan n'est pas relancé");
    const coach = codeOf("src/lib/ai/autoCoach.ts");
    assert.match(coach, /douleurEffets: ctx\.effetsDouleur \? \{\s*\.\.\.ctx\.effetsDouleur,/, "l'état du coach n'enregistre plus ce que la douleur a changé");
    const ctx = codeOf("src/lib/ai/coachContext.ts");
    assert.match(ctx, /if \(estUnePanne\(\{ error: eConsignes \}\)\) throw new Error/, "une panne de lecture des consignes passe pour « aucune consigne »");
  });

  await test("le carnet : une page imprimable, aucune donnée envoyée, une panne dite", () => {
    // L'effort de la séance (RPE) n'est jamais présenté comme l'intensité d'une douleur.
    assert.doesNotMatch(codeOf("src/app/dashboard/health/carnet/page.tsx"), /niveau:[^\n]*rpe/, "le carnet donne le RPE de la séance comme intensité de la douleur");
    const carnet = codeOf("src/app/dashboard/health/carnet/page.tsx");
    assert.match(carnet, /\{enPanne && <p/, "une lecture ratée n'est pas dite sur le carnet");
    assert.doesNotMatch(carnet, /fetch\(|resend|envoyerEmail/i, "le carnet envoie des données");
    assert.doesNotMatch(carnet, /<header/, "le titre est dans un <header>, masqué à l'impression");
    assert.match(codeOf("src/app/dashboard/health/carnet/BoutonImprimer.tsx"), /window\.print\(\)/);
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main();
