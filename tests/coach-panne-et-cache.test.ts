/**
 * LE CONTEXTE DU COACH, EXERCÉ EN VRAI (et plus seulement lu par un grep).
 *
 * Deux suites de la PR 33 (Cyprien, 10/11/2026) :
 *  1. Une panne de lecture des ressentis ou des douleurs déclarées ne doit JAMAIS passer pour
 *     « aucune douleur » : `buildAthleteContext` refuse de se bâtir (le coach automatique
 *     laisse le plan en place). Seul « aucune ligne » (PGRST116) n'est pas une panne.
 *  2. Les arrêts d'une séance sont relus sur sa trace GPS : ils sont mémorisés pour ne pas
 *     relire des milliers de points à chaque synchro (toutes les deux minutes).
 *
 * Faux client Supabase EN MÉMOIRE : aucune base touchée, aucune écriture (elles lèvent).
 */
import assert from "node:assert/strict";
import { buildAthleteContext } from "../src/lib/ai/coachContext";
import { viderCacheArrets, memoriserArrets, arretsMemorises, CAPACITE_CACHE_ARRETS } from "../src/lib/activities/cacheArrets";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}

type L = Record<string, unknown>;
type Panne = { table: string; type?: string; error: { code: string; message: string } };

/**
 * Faux client : filtres `eq`, bornes, tri et plafond appliqués comme la vraie base (repris de
 * tests/objectif-passe). `panne` fait répondre `{ data: null, error }` à une lecture précise ;
 * `lues` compte les tables interrogées.
 */
function fauxClient(tables: Record<string, unknown[]>, opts: { panne?: Panne; lues?: string[] } = {}) {
  const requete = (table: string, toutes: unknown[]) => {
    const filtres: [string, unknown][] = [];
    const bornes: [string, "gte" | "lte" | "lt" | "gt", unknown][] = [];
    let tri: { col: string; asc: boolean } | null = null;
    let plafond: number | null = null;
    const borne = (l: L) => bornes.every(([c, o, v]) => {
      if (!(c in l) || l[c] == null) return !(c in l);
      const a = l[c] as string | number, b = v as string | number;
      return o === "gte" ? a >= b : o === "lte" ? a <= b : o === "lt" ? a < b : a > b;
    });
    const lignes = () => {
      let r = (toutes as L[]).filter((l) => filtres.every(([c, v]) => !(c in l) || l[c] === v) && borne(l));
      if (tri) { const { col, asc } = tri; r = [...r].sort((x, y) => { const a = x[col] as never, b = y[col] as never; return a === b ? 0 : (a > b ? 1 : -1) * (asc ? 1 : -1); }); }
      if (plafond != null) r = r.slice(0, plafond);
      return r;
    };
    const enPanne = () => {
      const p = opts.panne;
      return !!p && p.table === table && (p.type == null || filtres.some(([c, v]) => c === "type" && v === p.type));
    };
    const reponse = () => (enPanne() ? { data: null, error: opts.panne!.error } : { data: lignes(), error: null, count: lignes().length });
    const q: Record<string, unknown> = {};
    for (const m of ["select", "not", "in", "or", "neq", "is", "ilike"]) q[m] = () => q;
    for (const o of ["gte", "lte", "lt", "gt"] as const) q[o] = (c: string, v: unknown) => { bornes.push([c, o, v]); return q; };
    for (const m of ["insert", "update", "upsert", "delete"]) q[m] = () => { throw new Error(`écriture interdite dans ce test (${table}.${m})`); };
    q.order = (c: string, o?: { ascending?: boolean }) => { if (!tri) tri = { col: c, asc: o?.ascending !== false }; return q; };
    q.limit = (n: number) => { plafond = n; return q; };
    q.eq = (c: string, v: unknown) => { filtres.push([c, v]); return q; };
    q.single = () => { if (enPanne()) return Promise.resolve(reponse()); const l = lignes(); return Promise.resolve({ data: l[0] ?? null, error: l[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve(enPanne() ? reponse() : { data: lignes()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(reponse()).then(ok, ko);
    return q;
  };
  return { from: (t: string) => { opts.lues?.push(t); return requete(t, tables[t] ?? []); } } as never;
}

const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
const ilYa = (n: number) => { const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// ⚠️ PAS DE `last_lat` : aucune requête météo, le test ne touche pas le réseau.
const PROFIL = { id: "u", preferred_language: "fr", full_name: "Test", age: 25, gender: "male", weight_kg: 70, days_per_week: 5, available_days: [1, 2, 3, 4, 6], health_conditions: [], injury_zones: [], health_declared: true };
const BASE = [{ user_id: "u", vma_kmh: 18, max_hr: 200, resting_hr: 45, tested_at: ilYa(20) }];
const SEANCES = Array.from({ length: 20 }, (_, i) => ({
  id: `w${i}`, user_id: "u", date: ilYa(i * 2), type: "easy", sport: "run", distance_km: 10, duration_seconds: 3000,
  elevation_gain_m: 40, avg_hr: 145, max_hr: 165, tss: 50, hr_zone_seconds: [600, 2400, 0, 0, 0],
}));
/** La trace de la séance d'aujourd'hui (w0) : 10 km à ~3,3 m/s, un point tous les 10 m, un arrêt de 5 min au km 2. */
const TRACE = (() => {
  const pts: unknown[][] = []; let t = 0, lat = 48.85;
  for (let i = 0; i <= 1000; i++) {
    pts.push([lat, 2.35, Math.round(t), 30]);
    lat += 10 / 111320; t += i === 200 ? 300 + 3 : 3;
  }
  return pts;
})();
const RESSENTI = { user_id: "u", type: "session_feedback", created_at: `${ilYa(1)}T19:00:00Z`, data: { date: ilYa(1), ts: `${ilYa(1)}T19:00:00Z`, rpe: 3, pain: ["Tibia (périoste)"] } };

const tables = (extra: Partial<Record<string, unknown[]>> = {}) => ({
  profiles: [PROFIL], performance_baselines: BASE, workouts: SEANCES,
  notifications: [RESSENTI], activity_tracks: [{ workout_id: "w0", user_id: "u", has_gps: true, points: TRACE }],
  ...extra,
});
const PANNE = { code: "57014", message: "canceling statement due to statement timeout" };

async function main() {
  console.log("\nUNE PANNE N'EST PAS « AUCUNE DOULEUR »");

  await test("sans panne, la douleur cochée hier atteint le coach (le faux client fonctionne)", async () => {
    const ctx = await buildAthleteContext(fauxClient(tables()), "u");
    assert.ok(ctx.douleursActives?.includes("Tibia (périoste)"), `douleurs vues : ${JSON.stringify(ctx.douleursActives)}`);
  });

  await test("ressentis illisibles : le contexte refuse de se bâtir", async () => {
    await assert.rejects(buildAthleteContext(fauxClient(tables(), { panne: { table: "notifications", type: "session_feedback", error: PANNE } }), "u"),
      /Douleurs illisibles \(ressentis\)/, "une panne des ressentis a donné un plan sans douleur");
  });

  await test("douleurs déclarées illisibles : le contexte refuse de se bâtir", async () => {
    await assert.rejects(buildAthleteContext(fauxClient(tables(), { panne: { table: "notifications", type: "pain_report", error: PANNE } }), "u"),
      /Douleurs illisibles \(douleurs déclarées\)/, "une panne des douleurs déclarées a donné un plan sans douleur");
  });

  await test("« aucune ligne » (PGRST116) n'est pas une panne", async () => {
    const ctx = await buildAthleteContext(fauxClient(tables(), { panne: { table: "notifications", type: "pain_report", error: { code: "PGRST116", message: "no rows" } } }), "u");
    assert.ok(ctx, "« aucune ligne » a été prise pour une panne");
  });

  console.log("\nLES ARRÊTS SONT MÉMORISÉS");

  await test("la trace d'une séance n'est lue qu'une fois d'une reconstruction à l'autre", async () => {
    viderCacheArrets();
    const lues1: string[] = [], lues2: string[] = [];
    const ctx1 = await buildAthleteContext(fauxClient(tables(), { lues: lues1 }), "u");
    const ctx2 = await buildAthleteContext(fauxClient(tables(), { lues: lues2 }), "u");
    const n = (l: string[]) => l.filter((t) => t === "activity_tracks").length;
    assert.equal(n(lues1), 1, `1re reconstruction : ${n(lues1)} lecture(s) de trace`);
    assert.equal(n(lues2), 0, `2e reconstruction : ${n(lues2)} lecture(s) de trace — rien n'est mémorisé`);
    const arrets = (c: typeof ctx1) => (c.lastSession?.shows ?? []).find((s) => /arrêt/.test(s));
    assert.ok(arrets(ctx1), "l'arrêt de 5 min n'est pas dit");
    assert.equal(arrets(ctx2), arrets(ctx1), "la valeur mémorisée diffère de la valeur lue");
  });

  await test("une séance corrigée (autre durée) est recalculée ; une absence de trace n'est pas mémorisée", async () => {
    viderCacheArrets();
    await buildAthleteContext(fauxClient(tables()), "u");
    const corrigee = SEANCES.map((s, i) => (i === 0 ? { ...s, duration_seconds: 3100 } : s));
    const lues: string[] = [];
    await buildAthleteContext(fauxClient(tables({ workouts: corrigee }), { lues }), "u");
    assert.equal(lues.filter((t) => t === "activity_tracks").length, 1, "la durée a changé et l'ancien calcul a servi");
    viderCacheArrets();
    await buildAthleteContext(fauxClient(tables({ activity_tracks: [] })), "u");
    const lues2: string[] = [];
    await buildAthleteContext(fauxClient(tables(), { lues: lues2 }), "u");
    assert.equal(lues2.filter((t) => t === "activity_tracks").length, 1, "« pas encore de trace » a été mémorisé : la trace importée ensuite ne serait jamais lue");
  });

  await test("seul le définitif est mémorisé : tapis oui ; trace trop courte et erreur de lecture, non", async () => {
    const lectures = async (extra: Partial<Record<string, unknown[]>>, panne?: Panne) => {
      const lues: string[] = [];
      await buildAthleteContext(fauxClient(tables(extra), { lues, panne }), "u");
      return lues.filter((t) => t === "activity_tracks").length;
    };
    // Séance sur tapis : « pas de GPS » est définitif, la seconde reconstruction ne relit rien.
    viderCacheArrets();
    const tapis = { activity_tracks: [{ workout_id: "w0", user_id: "u", has_gps: false, points: [] }] };
    assert.equal(await lectures(tapis), 1);
    assert.equal(await lectures(tapis), 0, "une séance sans GPS est relue à chaque synchro");
    // Trace trop courte : inexploitable aujourd'hui, peut-être complétée demain → jamais mémorisée.
    viderCacheArrets();
    const courte = { activity_tracks: [{ workout_id: "w0", user_id: "u", has_gps: true, points: TRACE.slice(0, 5) }] };
    assert.equal(await lectures(courte), 1);
    assert.equal(await lectures(courte), 1, "une trace inexploitable a été mémorisée");
    // Erreur de lecture : passagère → jamais mémorisée.
    viderCacheArrets();
    assert.equal(await lectures({}, { table: "activity_tracks", error: PANNE }), 1);
    assert.equal(await lectures({}), 1, "une erreur de lecture a été mémorisée");
  });

  await test("la mémoire est bornée : au-delà de sa capacité, les plus anciennes séances partent", () => {
    viderCacheArrets();
    const vide = { liste: [], totalSec: 0, ecouleSec: 100, plusLongueSec: 0 };
    for (let i = 0; i <= CAPACITE_CACHE_ARRETS; i++) memoriserArrets(`s${i}`, 10, 3000, vide);
    assert.equal(arretsMemorises("s0", 10, 3000), undefined, "la plus ancienne séance n'est jamais évincée : la mémoire grossit sans fin");
    assert.deepEqual(arretsMemorises(`s${CAPACITE_CACHE_ARRETS}`, 10, 3000), vide, "la plus récente a été évincée");
    viderCacheArrets();
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main();
