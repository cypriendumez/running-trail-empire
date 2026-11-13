/**
 * LE COACH N'ÉTAIT ÉPROUVÉ QUE SUR UN SEUL ATHLÈTE.
 *
 * Les profils déjà testés dans `coach.test.ts` sortent TOUS du même contexte de base —
 * VMA 16, 40 km par semaine, cinq jours disponibles — et n'en font varier que la
 * disponibilité, le volume et l'affûtage. Aucun n'est un débutant, un marathonien en
 * 5 h, un athlète sans montre, sans VFC, en reprise après coupure, ou au feu rouge.
 *
 * Or l'application est mise en vente : les prochains plans seront produits pour des gens
 * qui ne ressemblent pas à son auteur. Une semaine absurde chez un débutant — trois
 * séances de qualité, une sortie longue au double de son volume — ne se verrait sur
 * aucun compte existant.
 *
 * ⚠️ CE FICHIER N'INVENTE AUCUN SEUIL D'ENTRAÎNEMENT. Il ne vérifie que des invariants
 * qu'AUCUN plan ne peut violer sans être faux : pas de texte vide, pas de « NaN » servi
 * à un humain, pas deux séances le même jour, pas deux jours durs collés, une charge qui
 * ne dépasse pas ce que le module lui-même a fixé comme cible.
 */
import assert from "node:assert/strict";
import { buildWeekPlan, type PlanDay } from "../src/lib/ai/autoPlan";
import { PLAN_T } from "../src/lib/ai/planI18n";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const BASE = {
  text: "", objective: null, daysToRace: null, weeksToRace: null, athleteName: "T",
  vma: 16, thresholdPace: "4'10", easyPace: "5'20", hardGapHours: 48, lastHardDaysAgo: null,
  weekPlan: { qBudget: 2, quality: [{ type: "VMA", desc: "VMA : 10×400 m" }], easyPace: "5'20", eased: false },
  longRunMode: "run",
  macroPlan: [{ week: 1, phase: "Développement", volumeKm: 40, quality: ["VMA"], longRunKm: 13, focus: "" }],
  readiness: { level: "vert", reasons: [], advice: "" },
  volume: { weekKm: 40, avg4wkKm: 38, targetKm: 40, longRunKm: 13 },
  cycle: { deload: false, taper: false, label: "" }, skippedWeekdays: [],
  availability: { daysPerWeek: 5, days: [0, 1, 2, 3, 4, 5, 6] },
  forecast: [], tooMuchIntensity: null, hillyTraining: false,
  altitude: { elevationM: null, lossPct: 0 }, warmCool: { warm: 15, cool: 10 },
  heatAcclim: { hotDays: 0, factor: 1, label: "x" },
};
const mk = (o: Record<string, unknown>) => ({ ...BASE, ...o }) as unknown as AthleteContext;

/** Des gens qui ne ressemblent PAS à l'auteur de l'application. */
const ARCHETYPES: [string, AthleteContext][] = [
  ["débutant, 3 j/sem, 12 km", mk({
    vma: 11, thresholdPace: "6'10", easyPace: "7'40",
    availability: { daysPerWeek: 3, days: [1, 3, 6] },
    volume: { weekKm: 12, avg4wkKm: 10, targetKm: 14, longRunKm: 5 },
    weekPlan: { qBudget: 0, quality: [], easyPace: "7'40", eased: false },
    macroPlan: [{ week: 1, phase: "Base", volumeKm: 14, quality: [], longRunKm: 5, focus: "" }],
  })],
  ["marathonien en 5 h", mk({
    vma: 12.5, thresholdPace: "5'50", easyPace: "7'10", daysToRace: 84, weeksToRace: 12,
    objective: { name: "Marathon", distanceKm: 42.195, targetPace: null },
    volume: { weekKm: 45, avg4wkKm: 42, targetKm: 48, longRunKm: 24 },
    macroPlan: [{ week: 1, phase: "Spécifique", volumeKm: 48, quality: ["Allure"], longRunKm: 24, focus: "" }],
  })],
  ["élite, 7 j/sem, 110 km", mk({
    vma: 20.5, thresholdPace: "3'15", easyPace: "4'20",
    availability: { daysPerWeek: 7, days: [0, 1, 2, 3, 4, 5, 6] },
    volume: { weekKm: 110, avg4wkKm: 108, targetKm: 112, longRunKm: 32 },
    weekPlan: { qBudget: 3, quality: [{ type: "VMA", desc: "VMA : 6×1000 m" }, { type: "Seuil", desc: "Seuil : 3×10 min" }], easyPace: "4'20", eased: false },
    macroPlan: [{ week: 1, phase: "Développement", volumeKm: 112, quality: ["VMA", "Seuil"], longRunKm: 32, focus: "" }],
  })],
  ["sans montre : aucune allure connue", mk({
    vma: null, thresholdPace: null, easyPace: null, lastHardDaysAgo: null,
    weekPlan: { qBudget: 1, quality: [{ type: "Seuil", desc: "Seuil" }], easyPace: null, eased: false },
  })],
  ["sans VFC ni sommeil", mk({ readiness: { level: null, reasons: [], advice: "" } })],
  ["reprise après coupure", mk({
    volume: { weekKm: 0, avg4wkKm: 3, targetKm: 8, longRunKm: 4 },
    weekPlan: { qBudget: 0, quality: [], easyPace: "6'30", eased: true },
    macroPlan: [{ week: 1, phase: "Base", volumeKm: 8, quality: [], longRunKm: 4, focus: "" }],
  })],
  // ⚠️ DES CANDIDATS EXISTENT, ET LE BUDGET VAUT ZÉRO. Sans cette précaution le cas était
  // tautologique : une liste de séances dures VIDE reste vide quoi qu'on mute dans le plan.
  // Ici le plan doit refuser des séances qu'on lui tend.
  ["feu rouge : fatigue avérée", mk({
    readiness: { level: "rouge", reasons: ["VFC en chute"], advice: "alléger" },
    weekPlan: { qBudget: 0, quality: [{ type: "VMA", desc: "VMA : 10×400 m" }, { type: "Seuil", desc: "Seuil : 3×8 min" }], easyPace: "5'20", eased: true },
  })],
  ["traileur en montagne", mk({
    hillyTraining: true, altitude: { elevationM: 1400, lossPct: 8 },
    objective: { name: "Trail", distanceKm: 55, targetPace: null }, daysToRace: 60, weeksToRace: 9,
    volume: { weekKm: 60, avg4wkKm: 58, targetKm: 62, longRunKm: 28 },
  })],
  ["1 seul jour disponible", mk({
    availability: { daysPerWeek: 1, days: [6] },
    volume: { weekKm: 10, avg4wkKm: 9, targetKm: 10, longRunKm: 10 },
    weekPlan: { qBudget: 0, quality: [], easyPace: "6'00", eased: false },
  })],
  ["canicule annoncée", mk({
    forecast: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
      tempMax: 36, wind: 5, precip: 0, code: 0,
    })),
    heatAcclim: { hotDays: 1, factor: 0.9, label: "non acclimaté" },
  })],
];

const DURS = /VMA|Seuil|Sp[ée]cifique|Allure|C[oô]te/i;
/** Distance annoncée dans la prose d'une séance, quand elle y figure. */
function kmDe(d: PlanDay): number {
  const m = `${d.title} ${d.detail}`.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

console.log("\nCE QU'AUCUN PLAN NE PEUT VIOLER, QUEL QUE SOIT L'ATHLÈTE");

test("chaque archétype reçoit une semaine complète et lisible", () => {
  // ⚠️ ON COMPTE LES DATES, PAS LES ENTRÉES — et cette nuance m'a d'abord fait accuser le
  // code à tort. Un plan peut contenir PLUS de sept entrées : une double séance (footing
  // le matin, renforcement le soir) en pose deux le même jour. Vérifié sur l'archétype
  // débutant : 8 entrées, 7 dates, et `oneSessionPerSlot` les conserve toutes les deux
  // parce qu'elles portent un `moment` distinct. Ce qui serait un vrai défaut, c'est deux
  // séances au MÊME créneau : l'écran en supprimerait une en silence.
  for (const [nom, ctx] of ARCHETYPES) {
    const plan = buildWeekPlan(ctx, new Date("2026-09-07T08:00:00Z"));
    const dates = new Set(plan.map((d) => d.date));
    assert.equal(dates.size, 7, `${nom} : ${dates.size} jours couverts au lieu de 7`);
    const creneaux = plan.map((d) => `${d.date}#${(d as unknown as { moment?: string }).moment ?? ""}`);
    assert.equal(new Set(creneaux).size, creneaux.length,
      `${nom} : deux séances au même créneau — l'écran en effacerait une sans le dire`);
    for (const d of plan) {
      assert.ok(d.type?.trim(), `${nom} : une journée sans type`);
      assert.ok(d.title?.trim(), `${nom} : « ${d.type} » sans titre`);
      assert.ok(d.detail?.trim(), `${nom} : « ${d.type} » sans contenu`);
    }
  }
});

test("aucune valeur technique ne fuit dans le texte servi à l'athlète", () => {
  // « NaN », « undefined », « null », « Infinity » ou « [object Object] » dans une séance :
  // c'est le symptôme visible d'une donnée absente qu'un calcul a traversée sans le dire.
  const FUITES = /\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b|\[object Object\]/;
  for (const [nom, ctx] of ARCHETYPES) {
    for (const d of buildWeekPlan(ctx, new Date("2026-09-07T08:00:00Z"))) {
      const texte = `${d.title} ${d.detail} ${d.why ?? ""} ${(d.tags ?? []).join(" ")}`;
      assert.ok(!FUITES.test(texte), `${nom} : « ${texte.match(FUITES)?.[0]} » servi dans « ${d.type} »`);
    }
  }
});

test("deux jours durs ne se touchent jamais", () => {
  for (const [nom, ctx] of ARCHETYPES) {
    const plan = buildWeekPlan(ctx, new Date("2026-09-07T08:00:00Z"));
    const durs = plan.filter((d) => DURS.test(d.type)).map((d) => d.date).sort();
    for (let i = 1; i < durs.length; i++) {
      const ecart = (Date.parse(durs[i]) - Date.parse(durs[i - 1])) / 86400000;
      assert.ok(ecart >= 2, `${nom} : « ${durs[i - 1]} » et « ${durs[i]} » sont collés`);
    }
  }
});

test("le budget de qualité est respecté, jamais dépassé", () => {
  // Le module a DÉJÀ décidé combien de séances dures la semaine supporte (qBudget, qui
  // tient compte de l'ACWR et de la fraîcheur). En poser davantage annulerait la seule
  // protection contre la surcharge.
  for (const [nom, ctx] of ARCHETYPES) {
    const budget = (ctx as unknown as { weekPlan: { qBudget: number } }).weekPlan.qBudget;
    const durs = buildWeekPlan(ctx, new Date("2026-09-07T08:00:00Z")).filter((d) => DURS.test(d.type));
    assert.ok(durs.length <= budget, `${nom} : ${durs.length} séances dures pour un budget de ${budget}`);
  }
});

test("les jours indisponibles restent vides, chez tout le monde", () => {
  // ⚠️ PREMIÈRE VERSION DE CE TEST : TAUTOLOGIQUE. Elle vérifiait qu'un débutant ne reçoit
  // aucune séance dure — mais son budget de qualité vaut 0 et sa liste de séances dures
  // est VIDE en entrée : le test constatait qu'une liste vide reste vide. Prouvé par
  // mutation : supprimer le plafond de volume du plan ne le faisait pas rougir.
  // Ce que le plan décide VRAIMENT, lui, c'est le placement sur les jours disponibles.
  for (const [nom, ctx] of ARCHETYPES) {
    const jours = (ctx as unknown as { availability: { days: number[] } }).availability.days;
    if (jours.length === 7) continue;                        // rien à prouver
    const plan = buildWeekPlan(ctx, new Date("2026-09-07T08:00:00Z"));
    for (const d of plan) {
      if (/Repos|Renfo/i.test(d.type)) continue;             // possibles un jour sans course
      const jour = new Date(d.date + "T12:00:00Z").getUTCDay();
      assert.ok(jours.includes(jour),
        `${nom} : « ${d.type} » posée un jour où l'athlète a dit ne pas pouvoir courir`);
    }
  }
});

test("la charge posée ne dépasse pas la cible que le module s'est lui-même fixée", () => {
  // Marge de 20 % : les séances de qualité s'expriment en séries, leur kilométrage total
  // n'est pas toujours écrit. On ne cherche pas la précision, on cherche l'absurde.
  for (const [nom, ctx] of ARCHETYPES) {
    const cible = (ctx as unknown as { volume: { targetKm: number } }).volume.targetKm;
    const pose = buildWeekPlan(ctx, new Date("2026-09-07T08:00:00Z")).reduce((s, d) => s + kmDe(d), 0);
    assert.ok(pose <= cible * 1.2 + 5, `${nom} : ${Math.round(pose)} km posés pour une cible de ${cible}`);
  }
});

test("un athlète au feu rouge refuse les séances dures qu'on lui tend", () => {
  const rouge = ARCHETYPES.find(([n]) => n.startsWith("feu rouge"))![1];
  const wp = (rouge as unknown as { weekPlan: { qBudget: number; quality: unknown[] } }).weekPlan;
  // Le test ne vaut que si le cas est réel : budget à zéro ET candidats en attente.
  assert.equal(wp.qBudget, 0);
  assert.ok(wp.quality.length >= 2, "sans candidats, ce test ne prouverait rien");
  const durs = buildWeekPlan(rouge, new Date("2026-09-07T08:00:00Z")).filter((d) => DURS.test(d.type));
  assert.equal(durs.length, 0, `${durs.length} séance(s) dure(s) sur une fatigue avérée`);
});

test("sans montre, aucune allure n'est inventée", () => {
  // ⚠️ Le cas le plus courant chez un nouvel inscrit : ni VMA, ni allure seuil. Le plan
  // doit rester utilisable en donnant des SENSATIONS, jamais un chiffre fabriqué.
  const sans = ARCHETYPES.find(([n]) => n.startsWith("sans montre"))![1];
  for (const d of buildWeekPlan(sans, new Date("2026-09-07T08:00:00Z"))) {
    const texte = `${d.title} ${d.detail}`;
    assert.ok(!/\b0'00\b|\b0:00\b|\bà 0\b/.test(texte), `allure nulle servie dans « ${d.type} » : ${texte.slice(0, 90)}`);
  }
});


// ════════════════════════════════════════════════════════════════════════════════
// PROFIL 2 DE LA MATRICE (ops/sparring/PROFILS.md) : MARATHONIEN SUB-3 H.
//
// ⚠️ ICI LE CONTEXTE N'EST PAS FABRIQUÉ À LA MAIN. Les archétypes ci-dessus donnent à
// `buildWeekPlan` une sortie longue, un affûtage et des allures DÉJÀ décidés : ils ne
// peuvent pas voir une sortie longue trop courte ou un affûtage trop long, qui se décident
// en amont (`buildAthleteContext`, `lib/coach/phase`, `lib/running/volume`). Ce profil
// passe par le VRAI contexte, construit sur un faux client en mémoire (bornes, tri et
// limite appliqués, comme `plan-reprise.test.ts`), sans base ni réseau.
//
// Ce que le coach lit vraiment pour ce profil (vérifié dans le code le 09/11/2026) : la VMA
// du test (`performance_baselines`), l'historique des sorties (volume, plus longue sortie
// récente), l'objectif (`race_objective` : date, distance, allure visée), les jours
// disponibles. L'âge, le poids et le sexe ne changent rien à ces décisions-là.
//
// ⚠️ LE CALENDRIER BOUGE LE PLAN : la semaine allégée suit le bloc ISO de quatre semaines et
// la sortie longue préfère le dimanche. Chaque assertion se rejoue donc sur les sept jours
// d'une semaine ET un jour de chaque semaine du bloc (horloge décalée), pas sur aujourd'hui.

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

/** Exécute `fn` comme si l'horloge marquait `jour` à 10 h (le coach lit `new Date()`). */
async function aLaDate<T>(jour: string, fn: () => Promise<T>): Promise<T> {
  const Vrai = Date;
  const delta = new Vrai(`${jour}T10:00:00`).getTime() - Vrai.now();
  class Faux extends Vrai {
    constructor(...a: unknown[]) { if (a.length === 0) super(Vrai.now() + delta); else super(...(a as [number])); }
    static now() { return Vrai.now() + delta; }
  }
  (globalThis as { Date: DateConstructor }).Date = Faux as DateConstructor;
  try { return await fn(); } finally { (globalThis as { Date: DateConstructor }).Date = Vrai; }
}
const plusJours = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** « 4'13 » → 253 s/km ; `null` si la chaîne ne porte pas d'allure. */
const secParKm = (a: string | null | undefined) => { const m = a?.match(/(\d+)['’](\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

const SUB3 = {
  profil: { id: "u", preferred_language: "fr", full_name: "Test", age: 34, gender: "male", weight_kg: 66,
    days_per_week: 6, available_days: [0, 1, 2, 3, 4, 6], health_conditions: [], injury_zones: [], health_declared: true },
  vma: 17.5,
  /** 2 h 58 sur 42,195 km, enregistré comme le fait `objective.ts` : allure AVEC son unité. */
  objectif: (raceDate: string) => ({ race: "Marathon test", raceDate, distanceKm: 42.195, targetTime: "2h58", targetSeconds: 10680, targetPace: "4'13/km" }),
};
/** Le vendredi (5) est déclaré indisponible : six jours sur sept. */
const VENDREDI = 5;
/**
 * Dix semaines d'habitude (~76 km/sem) avant `jour` : cinq footings de 10,8 km et une sortie
 * longue de 26 km par semaine, un jour de repos. Footings en Z2 (FC 140 sur 190).
 */
function historiqueSub3(jour: string) {
  const sortie = (n: number, km: number, secKm: number) => ({
    user_id: "u", date: plusJours(jour, -n), type: "easy", sport: "run", distance_km: km, duration_seconds: Math.round(km * secKm),
    elevation_gain_m: 50, avg_hr: 140, max_hr: 155, tss: Math.round(km * 5), hr_zone_seconds: [300, Math.round(km * secKm) - 300, 0, 0, 0],
  });
  return Array.from({ length: 70 }, (_, k) => k + 1).filter((n) => n % 7 !== 3)
    .map((n) => (n % 7 === 0 ? sortie(n, 26, 300) : sortie(n, 10.8, 290)));
}
/** Le contexte du coach ET son plan, horloge posée sur `jour`, course dans `joursAvantCourse` jours. */
async function sub3(jour: string, joursAvantCourse: number) {
  return aLaDate(jour, async () => {
    const ctx = await buildAthleteContext(fauxClient({
      profiles: [SUB3.profil],
      performance_baselines: [{ user_id: "u", vma_kmh: SUB3.vma, max_hr: 190, resting_hr: 46, tested_at: plusJours(jour, -30) }],
      workouts: historiqueSub3(jour),
      notifications: [{ user_id: "u", type: "race_objective", data: SUB3.objectif(plusJours(jour, joursAvantCourse)) }],
    }), "u");
    return { ctx, plan: buildWeekPlan(ctx) };
  });
}
async function testA(nom: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}\n      ${(e as Error).message}`); }
}

async function profilMarathonienSub3() {
  console.log("\nPROFIL 2 — MARATHONIEN SUB-3 H (VMA 17,5, ~76 km/sem, 6 j, marathon en 2 h 58)");
  const AUJ = aujourdhui(FUSEAU_DEFAUT);
  // Les sept jours de cette semaine, puis un jour dans chacune des trois semaines suivantes :
  // toutes les positions du bloc de quatre, et tous les jours de la semaine.
  const HORLOGES = [0, 1, 2, 3, 4, 5, 6, 7, 15, 23].map((k) => plusJours(AUJ, k));

  await testA("feuille de route à 12 semaines : sortie longue au pic entre 28 et 32 km", async () => {
    for (const jour of HORLOGES) {
      const { ctx } = await sub3(jour, 7 * 12 + 3);
      const bloc = ctx.macroPlan.filter((w) => w.phase !== "Affûtage");
      assert.ok(bloc.length >= 8, `${jour} : ${bloc.length} semaine(s) avant l'affûtage dans la feuille de route`);
      const pic = Math.max(...bloc.map((w) => w.longRunKm));
      // Moins de 28 km : le mur au 30ᵉ ; plus de 32 : le plafond assumé de `longRunPeakKm`.
      assert.ok(pic >= 28 && pic <= 32, `${jour} : sortie longue au pic de ${pic} km (${bloc.map((w) => w.longRunKm).join(", ")})`);
    }
  });

  await testA("affûtage d'un marathon : trois semaines exactement, en pente, la dernière sous la moitié du pic", async () => {
    for (const jour of HORLOGES) {
      const { ctx } = await sub3(jour, 7 * 12 + 3);
      const phases = ctx.macroPlan.map((w) => w.phase);
      const v = ctx.macroPlan.map((w) => w.volumeKm);
      const debut = phases.indexOf("Affûtage");
      assert.equal(phases.filter((p) => p === "Affûtage").length, 3, `${jour} : phases ${phases.join(", ")}`);
      assert.equal(debut, phases.length - 3, `${jour} : l'affûtage n'est pas en bout de bloc (${phases.join(", ")})`);
      const pic = Math.max(...v.slice(0, debut));
      for (let i = debut; i < v.length; i++) {
        assert.ok(v[i] < (i === debut ? pic : v[i - 1]), `${jour} : l'affûtage ne descend pas (${v.join(", ")})`);
      }
      assert.ok(v[v.length - 1] <= pic * 0.5, `${jour} : semaine de course à ${v[v.length - 1]} km pour un pic de ${pic} km`);
      // En phase spécifique, l'allure marathon passe en tête — pas la VMA.
      for (const w of ctx.macroPlan.filter((x) => x.phase === "Spécifique")) {
        assert.equal(w.quality[0], "Allure mara", `${jour}, semaine ${w.week} (spécifique) : ${w.quality.join(" + ")}`);
      }
    }
  });

  await testA("semaine type : une vraie sortie longue (≥ 20 km), au moins une qualité, rien le vendredi indisponible", async () => {
    for (const jour of HORLOGES) {
      const { ctx, plan } = await sub3(jour, 7 * 12 + 3);
      assert.ok(ctx.weekPlan.quality.length >= 2, `${jour} : précondition, ${ctx.weekPlan.quality.length} qualité(s) candidate(s)`);
      assert.ok(ctx.volume.longRunKm >= 20, `${jour} : sortie longue de ${ctx.volume.longRunKm} km pour un sub-3 h à ~76 km/sem`);
      const parDate = new Map<string, PlanDay[]>();
      for (const d of plan) parDate.set(d.date, [...(parDate.get(d.date) ?? []), d]);
      const longues = plan.filter((d) => /Sortie longue/i.test(d.type));
      assert.equal(longues.length, 1, `${jour} : ${longues.length} sortie(s) longue(s) dans la semaine`);
      assert.ok(kmDe(longues[0]) >= 0.7 * ctx.volume.longRunKm,
        `${jour} : la sortie longue annonce ${kmDe(longues[0])} km de corps pour ${ctx.volume.longRunKm} km visés`);
      const qualites = plan.filter((d) => DURS.test(d.type) && !/Sortie longue/i.test(d.type));
      // « Presque tout en footing » sous-entraîne un coureur qui vise un chrono (règle 80/20 du coach).
      assert.ok(qualites.length >= 1, `${jour} : aucune séance de qualité à 12 semaines d'un marathon en 2 h 58`);
      const vendredi = [...parDate.entries()].find(([date]) => new Date(`${date}T12:00:00Z`).getUTCDay() === VENDREDI)!;
      const couru = vendredi[1].filter((d) => !/Repos|Renfo/i.test(d.type));
      assert.equal(couru.length, 0, `${jour} : « ${couru.map((d) => d.type).join(" + ")} » le vendredi ${vendredi[0]}, jour déclaré indisponible`);
    }
  });

  await testA("phase spécifique : une séance à l'allure marathon (4'13), écrite sans « /km/km »", async () => {
    let vue = 0;
    for (const jour of HORLOGES) {
      const { ctx, plan } = await sub3(jour, 7 * 5 + 3);
      const facile = secParKm(ctx.easyPace);
      assert.ok(facile != null, `${jour} : précondition, aucune allure de footing`);
      // Précondition du scénario, pas une règle prouvée ici : la relecture d'exécution recale le
      // footing sur ce que l'athlète court vraiment (4'50), une mutation de l'allure facile s'y absorbe.
      assert.ok(253 < facile!, `${jour} : précondition, l'allure marathon (4'13) n'est pas plus vive que le footing (${ctx.easyPace})`);
      assert.ok(plan.some((d) => DURS.test(d.type) && /4'13/.test(d.detail)), `${jour} : aucune séance à l'allure marathon en phase spécifique`);
      for (const d of plan) {
        const textes = [d.detail, ...Object.values(d.i18n ?? {}).map((t) => t?.detail ?? "")];
        for (const t of textes) assert.ok(!/\/km\s*\/km/.test(t), `${jour} : « /km/km » servi dans « ${d.type} » : ${t.slice(0, 120)}`);
        if (/Sortie longue/i.test(d.type) && /4'13/.test(d.detail)) vue++;
      }
    }
    // Le bloc spécifique de la sortie longue est le chemin qui doublait l'unité : il doit avoir été vu.
    assert.ok(vue > 0, "aucune sortie longue à allure marathon rencontrée : l'assertion « /km/km » ne prouve rien");
  });

  await testA("course dans 3 jours : l'allure du jour J est lisible, et aucune séance dure après la ligne d'arrivée", async () => {
    for (const jour of HORLOGES) {
      const { ctx, plan } = await sub3(jour, 3);
      assert.ok(ctx.weekPlan.quality.length >= 1, `${jour} : précondition, aucune qualité candidate`);
      const course = plan.find((d) => d.type === "Course");
      assert.ok(course, `${jour} : la course n'est pas dans le plan`);
      for (const t of [course!.detail, ...Object.values(course!.i18n ?? {}).map((x) => x?.detail ?? "")]) {
        assert.ok(/4'13\/km/.test(t) && !/\/km\s*\/km/.test(t), `${jour} : allure du jour J illisible : ${t.slice(0, 140)}`);
      }
      // `lib/coach/apresCourse` (Daniels) : aucune intensité pendant 14 jours après un marathon.
      // Le plan d'AVANT la course, qui part à la montre, doit déjà le respecter.
      const apres = plan.filter((d) => d.date > course!.date);
      assert.ok(apres.length >= 3, `${jour} : précondition, ${apres.length} jour(s) après la course dans le plan`);
      for (const d of apres) {
        assert.ok(!DURS.test(d.type) && !/Sortie longue/i.test(d.type),
          `${jour} : « ${d.type} » le ${d.date}, ${Math.round((Date.parse(d.date) - Date.parse(course!.date)) / 86400000)} jour(s) après un marathon`);
      }
    }
  });
}


// ════════════════════════════════════════════════════════════════════════════════
// @SAFERUN — UNE DOULEUR DÉCLARÉE ORIENTE TOUJOURS VERS UN PROFESSIONNEL DE SANTÉ.
// Le renvoi n'était porté que par le renforcement : une semaine SANS renfo (un seul jour
// disponible) servait un plan allégé pour une douleur sans jamais dire de consulter.
const RENVOI: Record<string, RegExp> = {
  fr: /consulte un médecin ou un masseur-kinésithérapeute/, en: /see a doctor or a physiotherapist/,
  de: /Ärztin, einem Arzt oder in die Physiotherapie/, es: /consulta a un médico o a un fisioterapeuta/,
  pt: /consulta um médico ou um fisioterapeuta/,
};
const DIAGNOSTIC = /tendinite|tendinitis|fracture|fractura|fratura|périostite|periostitis|syndrome|síndrome|Syndrom|Ermüdungsbruch/i;
async function profilDouleur() {
  console.log("\n@SAFERUN — DOULEUR DÉCLARÉE : LE RENVOI MÉDICAL NE DÉPEND PLUS DU RENFORCEMENT");
  const unJour = ARCHETYPES.find(([n]) => n === "1 seul jour disponible")![1];
  const textes = (plan: PlanDay[]) => Object.keys(RENVOI).map((l) => [l, plan.map((d) => {
    const t = l === "fr" ? d : (d.i18n as Record<string, { detail?: string; why?: string }> | undefined)?.[l] ?? d;
    return `${t.detail ?? ""} ${t.why ?? ""}`;
  }).join(" ")] as const);

  await testA("une semaine sans renfo, une douleur active : le renvoi est donné, dans les 5 langues, sans diagnostic", async () => {
    const plan = buildWeekPlan({ ...unJour, douleursActives: ["Genou gauche"] } as AthleteContext, new Date("2026-09-07T08:00:00Z"));
    assert.ok(!plan.some((d) => d.type === "Renfo"), "précondition : la semaine porte un renfo, le cas n'est pas celui visé");
    for (const [l, t] of textes(plan)) {
      assert.ok(RENVOI[l].test(t), `${l} : aucun renvoi vers un médecin ou un kinésithérapeute`);
      assert.ok(!DIAGNOSTIC.test(t), `${l} : un nom de diagnostic servi : « ${t.match(DIAGNOSTIC)?.[0]} »`);
    }
    // Jamais dans le détail : la montre analyse le détail, pas le pourquoi.
    assert.ok(!plan.some((d) => RENVOI.fr.test(d.detail)), "le renvoi est entré dans le détail lu par la montre");
  });

  await testA("contre-épreuve : sans douleur, aucun renvoi médical ajouté ; avec un renfo, un seul renvoi", async () => {
    const sans = buildWeekPlan(unJour, new Date("2026-09-07T08:00:00Z"));
    assert.ok(!textes(sans).some(([l, t]) => RENVOI[l].test(t)), "un renvoi médical sans aucune douleur déclarée");
    const base = ARCHETYPES.find(([n]) => n.startsWith("débutant"))![1];
    const avec = buildWeekPlan({ ...base, douleursActives: ["Genou gauche"] } as AthleteContext, new Date("2026-09-07T08:00:00Z"));
    assert.ok(avec.some((d) => d.type === "Renfo"), "précondition : pas de renfo dans la semaine du débutant");
    const fr = textes(avec).find(([l]) => l === "fr")![1];
    assert.equal(fr.match(new RegExp(RENVOI.fr.source, "g"))?.length, 1, "le renvoi est répété deux fois dans la même semaine");
  });

  await testA("course dans la semaine : après la ligne d'arrivée, le renfo est celui de la récupération (aucun saut)", async () => {
    const AUJ = aujourdhui(FUSEAU_DEFAUT);
    let vus = 0;
    for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 15, 23]) {
      const jour = plusJours(AUJ, k);
      const { plan } = await sub3(jour, 3);
      const course = plan.find((d) => d.type === "Course")!;
      for (const d of plan.filter((x) => x.type === "Renfo" && x.date > course.date)) {
        vus++;
        assert.ok(!/bondissement/i.test(d.detail) && /RÉCUPÉRATION/.test(d.detail), `${jour} : « ${d.detail.slice(0, 90)} » le ${d.date}, après un marathon`);
        assert.ok(!/à l'approche de la course/.test(d.detail), `${jour} : renfo « à l'approche de la course » APRÈS la course`);
      }
    }
    assert.ok(vus > 0, "aucun renfo après la course rencontré : l'assertion ne prouve rien");
    // Le renfo PRINCIPAL (un jour sans course, pas greffé le soir d'un footing) suit un autre
    // chemin : trois jours disponibles, course en début de semaine, contexte fabriqué.
    let principal = 0;
    // Deux jeux de jours : dimanche-mercredi-vendredi (course à J+0) et dimanche-lundi-jeudi (course à J+1).
    for (const jours of [[0, 3, 5], [0, 1, 4]]) for (const dtr of [0, 1, 2]) {
      const ctx = mk({
        objective: { race: "Marathon", distanceKm: 42.195, targetPace: "5'40/km", targetTime: "4h", targetSeconds: 14400 },
        daysToRace: dtr, weeksToRace: 0, cycle: { deload: false, taper: true, label: "" },
        // Avant le 13/11/2026, la reprise de J+2 était posée même un jour indisponible (avec les jours 0, 2, 4
        // et une course le lundi : le mercredi). Ces jeux-ci laissent le renfo principal tomber après la course.
        availability: { daysPerWeek: 3, days: jours },
        volume: { weekKm: 40, avg4wkKm: 40, targetKm: 20, longRunKm: 4 },
        macroPlan: [{ week: 1, phase: "Affûtage", volumeKm: 20, quality: [], longRunKm: 0, focus: "" }],
      });
      const plan = buildWeekPlan(ctx, new Date("2026-09-07T08:00:00Z"));
      const course = plan.find((d) => d.type === "Course")!;
      for (const d of plan.filter((x) => x.type === "Renfo" && x.date > course.date && !x.moment)) {
        principal++;
        assert.ok(!/bondissement/i.test(d.detail) && /RÉCUPÉRATION/.test(d.detail), `course à J+${dtr} : « ${d.detail.slice(0, 90)} » le ${d.date}, après un marathon`);
      }
    }
    assert.ok(principal >= 2, `le renfo principal n'est tombé que ${principal} fois après la course : le second chemin est à peine éprouvé`);
  });

  await testA("invite du coach IA : l'allure de course sans « /km/km », et aucun découpage sans chrono visé", async () => {
    const AUJ = aujourdhui(FUSEAU_DEFAUT);
    const { ctx } = await sub3(AUJ, 7 * 4 + 3);
    assert.ok(/PLAN DE COURSE/.test(ctx.text), "précondition : pas de plan de course dans l'invite à 4 semaines");
    assert.ok(!/\/km\s*\/km/.test(ctx.text), `« /km/km » dans l'invite : ${ctx.text.match(/.{40}\/km\s*\/km/)?.[0]}`);
    assert.ok(/= 4'13\/km/.test(ctx.text), "l'allure visée a disparu du plan de course");
    // Course sans chrono visé : on ne découpe pas une allure de 0'00.
    const sansChrono = await aLaDate(AUJ, () => buildAthleteContext(fauxClient({
      profiles: [SUB3.profil],
      performance_baselines: [{ user_id: "u", vma_kmh: SUB3.vma, max_hr: 190, resting_hr: 46, tested_at: plusJours(AUJ, -30) }],
      workouts: historiqueSub3(AUJ),
      notifications: [{ user_id: "u", type: "race_objective", data: { race: "Marathon test", raceDate: plusJours(AUJ, 31), distanceKm: 42.195, targetTime: "", targetSeconds: 0, targetPace: "" } }],
    }), "u"));
    assert.ok(!/0'00/.test(sansChrono.text), `allure inventée dans l'invite : ${sansChrono.text.match(/.{60}0'00.{20}/)?.[0]}`);
  });
}

// ── PROFIL 5 — LE CYCLISTE QUI VIENT À LA COURSE (13/11/2026) ─────────────────────────────────
// Beaucoup de vélo, peu de course. Deux invariants RELATIFS, sans seuil inventé : le vélo ne change
// ni la VMA de course (lue sur les COURSES des 120 derniers jours, pas sur les 60 dernières séances
// tous sports : 60 séances d'un multisport ne couvrent que 7 semaines), ni le volume de course prescrit.
const CYCLISTE = { id: "u", preferred_language: "fr", full_name: "Test", age: 38, gender: "female", weight_kg: 60, max_hr: 185,
  days_per_week: 4, available_days: [1, 3, 5, 6], health_conditions: [], injury_zones: [], health_declared: true };
/** Deux footings par semaine sur 17 semaines (5'30/km, FC 140/185 : facile), et un 10 km couru en 40'00
 *  il y a 9 semaines (FC 172 : l'effort qui fonde la VMA). */
function coursesCycliste(jour: string) {
  const footing = (n: number) => ({ user_id: "u", date: plusJours(jour, -n), type: "easy", sport: "run", distance_km: 8,
    duration_seconds: 8 * 330, elevation_gain_m: 40, avg_hr: 140, max_hr: 150, tss: 40 });
  const runs = Array.from({ length: 119 }, (_, k) => k + 1).filter((n) => n % 7 === 1 || n % 7 === 4).map(footing);
  runs.push({ user_id: "u", date: plusJours(jour, -63), type: "race", sport: "run", distance_km: 10, duration_seconds: 2400,
    elevation_gain_m: 30, avg_hr: 172, max_hr: 182, tss: 90 });
  return runs;
}
/** Six sorties vélo par semaine (dont deux le dimanche), 17 semaines : 1 h 30, 40 km, FC 130. */
function veloCycliste(jour: string) {
  return Array.from({ length: 119 }, (_, k) => k + 1).filter((n) => n % 7 !== 1 && n % 7 !== 4)
    .flatMap((n) => Array.from({ length: n % 7 === 0 ? 2 : 1 }, () => ({ user_id: "u", date: plusJours(jour, -n), type: "ride",
      sport: "bike", distance_km: 40, duration_seconds: 5400, elevation_gain_m: 300, avg_hr: 130, max_hr: 150, tss: 70 })));
}
async function contexteCycliste(jour: string, seances: Ligne[]) {
  return aLaDate(jour, async () => {
    const ctx = await buildAthleteContext(fauxClient({ profiles: [CYCLISTE], performance_baselines: [], workouts: seances, notifications: [] }), "u");
    return { ctx, plan: buildWeekPlan(ctx) };
  });
}
async function profilCycliste() {
  console.log("\nPROFIL 5 — CYCLISTE QUI VIENT À LA COURSE (6 vélos + 2 footings par semaine, 10 km en 40'00 il y a 9 semaines)");
  const AUJ = aujourdhui(FUSEAU_DEFAUT);
  await testA("le vélo ne change pas la VMA de course : le 10 km d'il y a 9 semaines compte, avec ou sans vélo", async () => {
    for (const jour of [AUJ, plusJours(AUJ, 3)]) {
      const seul = await contexteCycliste(jour, coursesCycliste(jour));
      const avecVelo = await contexteCycliste(jour, [...coursesCycliste(jour), ...veloCycliste(jour)]);
      assert.ok(seul.ctx.vma != null && seul.ctx.vma >= 15, `${jour} : la VMA de course seule n'est pas lue sur le 10 km (${seul.ctx.vma})`);
      assert.equal(avecVelo.ctx.vma, seul.ctx.vma, `${jour} : le vélo change la VMA de course (${seul.ctx.vma} → ${avecVelo.ctx.vma}) : le 10 km est sorti des 60 dernières séances`);
    }
  });
  await testA("le vélo ne gonfle pas le volume de COURSE prescrit (tendons) : cible et sortie longue", async () => {
    const seul = await contexteCycliste(AUJ, coursesCycliste(AUJ));
    const avecVelo = await contexteCycliste(AUJ, [...coursesCycliste(AUJ), ...veloCycliste(AUJ)]);
    assert.ok(seul.ctx.volume.targetKm > 0 && seul.ctx.volume.longRunKm > 0, `précondition : volume de course nul (${seul.ctx.volume.targetKm} km, sortie longue ${seul.ctx.volume.longRunKm})`);
    assert.ok(avecVelo.ctx.volume.targetKm <= seul.ctx.volume.targetKm, `cible de course ${seul.ctx.volume.targetKm} → ${avecVelo.ctx.volume.targetKm} km avec le vélo`);
    assert.ok(avecVelo.ctx.volume.longRunKm <= seul.ctx.volume.longRunKm, `sortie longue ${seul.ctx.volume.longRunKm} → ${avecVelo.ctx.volume.longRunKm} km avec le vélo`);
    const kmCourse = (plan: PlanDay[]) => plan.filter((d) => !/v[ée]lo|renfo|repos/i.test(`${d.type} ${d.title}`)).reduce((t, d) => t + kmDe(d), 0);
    assert.ok(kmCourse(avecVelo.plan) <= kmCourse(seul.plan) + 0.5, `km de course de la semaine : ${kmCourse(seul.plan)} → ${kmCourse(avecVelo.plan)} avec le vélo`);
  });
}

/** Historique de course régulier : `kmSem` km par semaine sur 10 semaines, les jours `jours` (0 = dimanche). */
function historiqueRegulier(jour: string, kmSem: number, jours: number[], secKm: number, fc: { avg_hr?: number; max_hr?: number } = {}) {
  return Array.from({ length: 70 }, (_, k) => k + 1).filter((n) => jours.includes(new Date(`${plusJours(jour, -n)}T12:00:00Z`).getUTCDay()))
    .map((n) => ({ user_id: "u", date: plusJours(jour, -n), type: "easy", sport: "run", distance_km: kmSem / jours.length,
      duration_seconds: Math.round((kmSem / jours.length) * secKm), elevation_gain_m: 30, avg_hr: fc.avg_hr ?? null, max_hr: fc.max_hr ?? null, tss: 40 }));
}
async function contexte(jour: string, tables: Record<string, Ligne[]>) {
  return aLaDate(jour, async () => {
    const ctx = await buildAthleteContext(fauxClient(tables), "u");
    return { ctx, plan: buildWeekPlan(ctx) };
  });
}

// ── PROFIL 6 — SENIOR (62 ans, VMA 12, 4 jours) — rejoué le 13/11/2026 ─────────────────────────────
// Ce qu'un plan sensé fait : au plus 1-2 séances dures, une récupération plus longue, le renforcement
// gardé. Absurde : 3 séances dures, ou une FC max « 220 − âge » (158) présentée comme une mesure.
const SENIOR = { id: "u", preferred_language: "fr", full_name: "Test", age: 62, gender: "male", weight_kg: 72,
  days_per_week: 4, available_days: [1, 3, 5, 6], health_conditions: [], injury_zones: [], health_declared: true };
const tablesSenior = (jour: string, profil: Ligne = SENIOR) => ({ profiles: [profil],
  performance_baselines: [{ user_id: "u", vma_kmh: 12, tested_at: plusJours(jour, -30) }],
  workouts: historiqueRegulier(jour, 30, [1, 3, 5, 6], 390), notifications: [] });
/** Les départs de référence (visa @HeadCoach du 13/11/2026) : les sept jours de la semaine, puis un jour
 *  dans chacune des semaines suivantes du bloc de quatre — comme `profilMarathonienSub3`. */
const DEPARTS = [0, 1, 2, 3, 4, 5, 6, 7, 15, 23];
async function profilSenior() {
  console.log("\nPROFIL 6 — SENIOR (62 ans, VMA 12, 4 jours, ~30 km/sem, aucune FC mesurée)");
  const AUJ = aujourdhui(FUSEAU_DEFAUT);
  const HORLOGES = DEPARTS.map((k) => plusJours(AUJ, k));
  await testA("au plus deux séances dures sur sept jours, espacées de sa récupération (plus longue qu'à 34 ans)", async () => {
    // « Au plus deux » vient du plafond par fréquence (4 jours déclarés), pas de l'âge ; l'âge, lui, allonge
    // l'espacement. Précondition : au moins un départ porte une séance dure (une liste vide passerait tout).
    let auMoinsUneDure = false;
    for (const jour of HORLOGES) {
      const { ctx, plan } = await contexte(jour, tablesSenior(jour));
      const jeune = (await contexte(jour, tablesSenior(jour, { ...SENIOR, age: 34 }))).ctx;
      assert.ok(ctx.hardGapHours > jeune.hardGapHours, `${jour} : récupération de ${ctx.hardGapHours} h à 62 ans, ${jeune.hardGapHours} h à 34 ans`);
      const durs = plan.filter((d) => DURS.test(d.type)).map((d) => d.date).sort();
      if (durs.length) auMoinsUneDure = true;
      assert.ok(durs.length <= 2, `${jour} : ${durs.length} séances dures (${durs.join(", ")}) pour un coureur de 62 ans`);
      for (let i = 1; i < durs.length; i++) {
        const h = (Date.parse(durs[i]) - Date.parse(durs[i - 1])) / 3600000;
        assert.ok(h >= ctx.hardGapHours, `${jour} : ${h} h entre deux séances dures (${durs[i - 1]}, ${durs[i]}), sa récupération est de ${ctx.hardGapHours} h`);
      }
    }
    assert.ok(auMoinsUneDure, "précondition : aucune séance dure sur aucun départ, l'espacement n'est pas éprouvé");
  });
  await testA("le renforcement est gardé chaque semaine", async () => {
    for (const jour of HORLOGES) {
      const { plan } = await contexte(jour, tablesSenior(jour));
      assert.ok(plan.some((d) => /renfo/i.test(d.type)), `${jour} : aucune séance de renforcement (${plan.map((d) => d.type).join(", ")})`);
    }
  });
  await testA("aucune FC max tirée de l'âge (220 − 62 = 158) : sans mesure, le coach dit « FC max ? »", async () => {
    const { ctx } = await contexte(AUJ, tablesSenior(AUJ));
    assert.doesNotMatch(ctx.text, /\b158\b/, "158 bpm (220 − âge) apparaît dans l'invite du coach");
    assert.match(ctx.text, /FC max \?/, "sans FC mesurée, l'invite ne dit plus que la FC max est inconnue");
  });
}

// ── PROFIL 8 — ÉLITE SUB-33' AU 10 KM (VMA 20,5, 110 km/sem) — rejoué le 13/11/2026 ─────────────────
// Ce qu'un plan sensé fait : un affûtage d'UNE semaine, de la VMA et du seuil. Absurde : 3 semaines
// d'affûtage pour un 10 km, une séance dure la veille ou l'avant-veille.
const ELITE = { id: "u", preferred_language: "fr", full_name: "Test", age: 27, gender: "male", weight_kg: 62, max_hr: 195,
  days_per_week: 7, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true };
const tablesElite = (jour: string, joursAvantCourse: number) => ({ profiles: [ELITE],
  performance_baselines: [{ user_id: "u", vma_kmh: 20.5, max_hr: 195, tested_at: plusJours(jour, -20) }],
  workouts: historiqueRegulier(jour, 110, [0, 1, 2, 3, 4, 5, 6], 250, { avg_hr: 140, max_hr: 160 }),
  notifications: [{ user_id: "u", type: "race_objective", data: { race: "10 km test", raceDate: plusJours(jour, joursAvantCourse), distanceKm: 10, targetTime: "32'50", targetSeconds: 1970, targetPace: "3'17/km" } }] });
async function profilElite10() {
  console.log("\nPROFIL 8 — ÉLITE SUB-33' AU 10 KM (VMA 20,5, 110 km/sem, 7 jours)");
  const AUJ = aujourdhui(FUSEAU_DEFAUT);
  await testA("10 km dans 8 semaines : UNE semaine d'affûtage, VMA et seuil au programme", async () => {
    for (const jour of DEPARTS.map((k) => plusJours(AUJ, k))) {
      const { ctx } = await contexte(jour, tablesElite(jour, 8 * 7 + 2));
      const affutage = ctx.macroPlan.filter((w) => w.phase === "Affûtage").length;
      assert.equal(affutage, 1, `${jour} : ${affutage} semaine(s) d'affûtage pour un 10 km`);
      const qualites = ctx.macroPlan.flatMap((w) => w.quality).join(" ");
      assert.ok(/VMA/.test(qualites) && /Seuil/.test(qualites), `${jour} : ni VMA ni seuil dans la feuille de route (${qualites})`);
    }
  });
  await testA("la course dans la semaine OU juste après (J+7, J+8) : aucune séance dure la veille ni l'avant-veille", async () => {
    // J+7 et J+8 : la course est hors des sept jours affichés, sa veille non (un seuil y tombait, 13/11/2026).
    for (const k of DEPARTS) for (const avant of [3, 4, 5, 6, 7, 8]) {
      const jour = plusJours(AUJ, k), course = plusJours(jour, avant);
      const { plan } = await contexte(jour, tablesElite(jour, avant));
      const proches = plan.filter((d) => (d.date === plusJours(course, -1) || d.date === plusJours(course, -2)) && DURS.test(d.type));
      assert.equal(proches.length, 0, `course dans ${avant} j : ${proches.map((d) => `${d.type} le ${d.date}`).join(", ")}`);
      if (avant >= 7) {
        const veille = plan.find((d) => d.date === plusJours(course, -1));
        assert.ok(!veille || /R[ée]cup|Repos/.test(veille.type), `course dans ${avant} j : la veille (${plusJours(course, -1)}) porte « ${veille?.type} »`);
      }
    }
  });
  await testA("course A à J+7 / J+8 AVEC une course B dans la semaine : aucune séance dure la veille ni l'avant-veille de la A", async () => {
    // Visa @HeadCoach (2e tour, 13/11/2026) : la protection de J+7/J+8 était conditionnée par l'indice de
    // N'IMPORTE QUELLE course de la semaine ; une B posée au jour 1 ou 2 la faisait sauter.
    const DUR_OU_LONGUE = /VMA|Seuil|Sp[ée]cifique|Allure|C[oô]te/i;
    let dures = 0, cas = 0;
    for (const k of DEPARTS) for (const bIdx of [1, 2]) for (const dtr of [7, 8]) {
      const debut = new Date(Date.parse("2026-09-07T08:00:00Z") + k * 86400000);
      const ctx = mk({
        objective: { race: "10 km A", distanceKm: 10, targetPace: "3'45/km", targetTime: "37'30", targetSeconds: 2250 },
        daysToRace: dtr, weeksToRace: 1, cycle: { deload: false, taper: true, label: "" },
        courseSecondaire: { idx: bIdx, nom: "10 km B", distanceKm: 10, priorite: "B" },
        availability: { daysPerWeek: 5, days: [0, 1, 2, 3, 4, 5, 6] },
        weekPlan: { qBudget: 2, quality: [{ type: "VMA", desc: "VMA : 10×400 m" }, { type: "Seuil", desc: "Seuil : 3×8 min" }], easyPace: "5'20", eased: false },
      });
      const plan = buildWeekPlan(ctx, debut);
      cas++;
      const jour = (n: number) => new Date(debut.getTime() + n * 86400000).toISOString().slice(0, 10);
      dures += plan.filter((d) => DUR_OU_LONGUE.test(d.type)).length;
      const proches = plan.filter((d) => (d.date === jour(dtr - 1) || d.date === jour(dtr - 2)) && DUR_OU_LONGUE.test(d.type));
      assert.equal(proches.length, 0, `départ +${k}, B au jour ${bIdx}, A à J+${dtr} : ${proches.map((d) => `${d.type} le ${d.date}`).join(", ")}`);
    }
    assert.ok(cas >= 40 && dures > 0, `précondition : ${cas} cas, ${dures} séance(s) dure(s) posée(s) — rien n'éprouve la protection`);
  });
  await testA("course C : sa veille ne tombe jamais un jour indisponible ou systématiquement raté", async () => {
    // Visa @HeadCoach (2e tour) : la veille de la course C était posée avant les étapes 1 et 1 bis, sans
    // aucun contrôle de disponibilité, et consommait une sortie.
    const debut = new Date("2026-09-07T08:00:00Z");
    const jour = (n: number) => new Date(debut.getTime() + n * 86400000);
    let vus = 0;
    for (const cIdx of [2, 3, 4, 5, 6]) {
      const veille = jour(cIdx - 1), jourSemaine = veille.getUTCDay();
      for (const variante of ["indisponible", "raté"] as const) {
        const ctx = mk({
          courseSecondaire: { idx: cIdx, nom: "Cross C", distanceKm: 8, priorite: "C" },
          availability: { daysPerWeek: 5, days: [0, 1, 2, 3, 4, 5, 6].filter((d) => variante === "raté" || d !== jourSemaine) },
          skippedWeekdays: variante === "raté" ? [jourSemaine] : [],
        });
        const plan = buildWeekPlan(ctx, debut);
        assert.ok(plan.some((d) => d.type === "Course"), `précondition : la course C du jour ${cIdx} n'est pas posée`);
        vus++;
        const ce = plan.filter((d) => d.date === veille.toISOString().slice(0, 10) && /R[ée]cup|Endurance|Sortie longue|VMA|Seuil|Sp[ée]cifique|Allure|C[oô]te/i.test(d.type));
        assert.equal(ce.length, 0, `course C au jour ${cIdx}, veille ${variante} : ${ce.map((d) => d.type).join(", ")} le ${veille.toISOString().slice(0, 10)}`);
      }
    }
    assert.equal(vus, 10, "précondition : tous les cas n'ont pas tourné");
  });
  await testA("course C à 2 jours ou moins de la course A : écartée, la semaine est celle d'un plan sans elle, ET LE PLAN LE DIT (5 langues)", async () => {
    // Décision de Cyprien (13/11/2026). Relectures du 13/11 : une C écartée bloquait encore la sortie longue
    // du lendemain et l'espacement des qualités ; posée un jour indisponible, la veille de la A n'arrêtait
    // rien ; et au feu rouge, la réécriture du jour 0 effaçait le message.
    const debut = new Date("2026-09-07T08:00:00Z");
    const iso = (n: number) => new Date(debut.getTime() + n * 86400000).toISOString().slice(0, 10);
    const NOM = "Cross du village";
    const signature = (plan: PlanDay[]) => plan.map((d) => `${d.date} ${d.type} ${d.title}`).join(" | ");
    let ecartees = 0, gardees = 0, rouges = 0, aptitudes = 0;
    for (const dtr of [0, 1, 2, 3, 4, 5, 7, 8]) for (const cIdx of [0, 1, 2, 3, 4, 5, 6]) {
      for (const variante of ["vert", "rouge", "dur aujourd'hui", "veille de la A indisponible", "aptitude en attente"] as const) {
        const veilleA = new Date(debut.getTime() + (dtr - 1) * 86400000).getUTCDay();
        const base = {
          objective: { race: "10 km A", distanceKm: 10, targetPace: "4'00/km", targetTime: "40'00", targetSeconds: 2400 },
          daysToRace: dtr, weeksToRace: 0, cycle: { deload: false, taper: true, label: "" },
          availability: { daysPerWeek: 6, days: [0, 1, 2, 3, 4, 5, 6].filter((d) => variante !== "veille de la A indisponible" || d !== veilleA) },
          readiness: variante === "rouge" ? { level: "rouge", reasons: ["test"], advice: "" } : { level: "vert", reasons: [], advice: "" },
          lastHardDaysAgo: variante === "dur aujourd'hui" ? 0 : null,
          // Avis médical attendu : `appliquerAptitude` réécrit le « pourquoi » de chaque sortie, APRÈS le plan.
          aptitude: variante === "aptitude en attente" ? { attente: true } : null,
        };
        const avecC = buildWeekPlan(mk({ ...base, courseSecondaire: { idx: cIdx, nom: NOM, distanceKm: 8, priorite: "C" } }), debut);
        const courseC = avecC.find((d) => d.type === "Course" && d.date === iso(cIdx) && d.title.includes(NOM));
        const ecartee = Math.abs(cIdx - dtr) <= 2;
        if (!ecartee) {
          if (variante === "aptitude en attente") continue;   // sans avis médical, aucune course n'est courue
          assert.ok(courseC, `A à J+${dtr}, C au jour ${cIdx} (${variante}) : course C à plus de 2 jours, elle doit rester au plan`);
          gardees++;
          continue;
        }
        ecartees++; if (variante === "rouge" && cIdx === 0) rouges++; if (variante === "aptitude en attente") aptitudes++;
        assert.ok(!courseC, `A à J+${dtr}, C au jour ${cIdx} (${variante}) : course C à ${Math.abs(cIdx - dtr)} jour(s) de la A, encore au plan`);
        // La semaine est EXACTEMENT celle d'un plan sans C (types et titres, jour par jour).
        const sansC = buildWeekPlan(mk(base), debut);
        assert.equal(signature(avecC), signature(sansC), `A à J+${dtr}, C au jour ${cIdx} (${variante}) : la C écartée pèse encore sur la semaine`);
        // …et le jour de la C le dit, dans les 5 langues, après toutes les réécritures (feu rouge compris).
        const jourC = avecC.filter((d) => d.date === iso(cIdx));
        assert.ok(jourC.some((d) => d.why.includes(PLAN_T.fr.courseCEcartee(NOM))), `A à J+${dtr}, C au jour ${cIdx} (${variante}) : la C est écartée sans que le plan le dise (${jourC.map((d) => d.why.slice(-70)).join(" | ")})`);
        for (const l of ["en", "de", "es", "pt"] as const)
          assert.ok(jourC.some((d) => d.i18n?.[l]?.why?.includes(PLAN_T[l].courseCEcartee(NOM))), `A à J+${dtr}, C au jour ${cIdx} (${variante}) : message absent en ${l}`);
        assert.equal(avecC.filter((d) => d.why.includes(PLAN_T.fr.courseCEcartee(NOM))).length, 1, `A à J+${dtr}, C au jour ${cIdx} (${variante}) : le message n'est pas posé une seule fois`);
      }
    }
    assert.ok(ecartees >= 40 && gardees >= 40 && rouges >= 2 && aptitudes >= 10, `précondition : ${ecartees} écartées, ${gardees} gardées, ${rouges} au feu rouge le jour même, ${aptitudes} sous avis médical attendu`);
    // Le message existe vraiment dans chaque langue : il nomme la course (un texte vide « contiendrait » tout).
    for (const l of ["fr", "en", "de", "es", "pt"] as const)
      assert.ok(PLAN_T[l].courseCEcartee(NOM).includes(NOM) && PLAN_T[l].courseCEcartee(NOM).trim().length > 40, `message vide ou sans le nom de la course en ${l}`);
  });
  await testA("course de J+3 à J+8 : la veille, l'avant-veille et la reprise ne tombent jamais un jour systématiquement raté", async () => {
    // Un jour « disponible » mais jamais couru (`skippedWeekdays`) reçoit « Repos » à l'étape 1 : le protocole
    // de course, posé avant, ne doit pas l'occuper (visa @HeadCoach du 13/11/2026).
    const debut = new Date("2026-09-07T08:00:00Z");
    const jourDe = (n: number) => { const d = new Date(debut); d.setUTCDate(d.getUTCDate() + n); return d; };
    let vus = 0;
    for (const dtr of [3, 4, 5, 6, 7, 8]) for (const decal of [-2, -1, 2]) {
      const cible = dtr + decal;
      if (cible < 0 || cible > 6) continue;
      vus++;
      const ctx = mk({
        objective: { race: "10 km", distanceKm: 10, targetPace: "4'00/km", targetTime: "40'00", targetSeconds: 2400 },
        daysToRace: dtr, weeksToRace: 0, cycle: { deload: false, taper: true, label: "" },
        availability: { daysPerWeek: 5, days: [0, 1, 2, 3, 4, 5, 6] }, skippedWeekdays: [jourDe(cible).getUTCDay()],
      });
      const plan = buildWeekPlan(ctx, debut);
      const date = jourDe(cible).toISOString().slice(0, 10);
      const ce = plan.filter((d) => d.date === date && /R[ée]cup|Endurance|Sortie longue|VMA|Seuil|Sp[ée]cifique|Allure|C[oô]te/i.test(d.type));
      assert.equal(ce.length, 0, `course à J+${dtr} : ${ce.map((d) => d.type).join(", ")} le ${date}, jour systématiquement raté`);
    }
    assert.ok(vus >= 10, `précondition : ${vus} cas seulement`);
  });
  await testA("course de J+3 à J+8 chez un coureur à 3 ou 4 jours : veille protégée, jours indisponibles vides, budget tenu", async () => {
    // Relecture du 13/11/2026 : la règle n'était éprouvée qu'à 7 jours sur 7 ; à 3 jours, la « Récup » de la
    // veille tombait sur un jeudi déclaré indisponible. Chaque horloge de la semaine, chaque écart.
    const COURSE = /R[ée]cup|Endurance|Sortie longue|VMA|Seuil|Sp[ée]cifique|Allure|C[oô]te|Course/i;
    for (const jours of [[1, 3, 6], [1, 3, 5, 6]]) {
      const profil = { ...ELITE, days_per_week: jours.length, available_days: jours };
      // Avant le 13/11/2026, DANS la fenêtre aussi, la veille et la reprise tombaient sur un jour indisponible.
      for (const k of DEPARTS) for (const avant of [3, 4, 5, 6, 7, 8]) {
        const jour = plusJours(AUJ, k), course = plusJours(jour, avant);
        const t = tablesElite(jour, avant);
        const { plan } = await contexte(jour, { ...t, profiles: [profil], workouts: historiqueRegulier(jour, 45, jours, 250, { avg_hr: 140, max_hr: 160 }) });
        const ctxt = `${jours.length} j, ${jour}, course le ${course}`;
        const durs = plan.filter((d) => (d.date === plusJours(course, -1) || d.date === plusJours(course, -2)) && DURS.test(d.type));
        assert.equal(durs.length, 0, `${ctxt} : ${durs.map((d) => `${d.type} le ${d.date}`).join(", ")}`);
        const sorties = plan.filter((d) => COURSE.test(d.type));
        // La course elle-même a sa date : elle peut tomber un jour « indisponible ». Pas ce qui l'entoure.
        const horsDispo = sorties.filter((d) => d.type !== "Course" && !jours.includes(new Date(`${d.date}T12:00:00Z`).getUTCDay()));
        assert.equal(horsDispo.length, 0, `${ctxt} : sortie un jour indisponible (${horsDispo.map((d) => `${d.type} le ${d.date}`).join(", ")})`);
        const datesSorties = new Set(sorties.map((d) => d.date));
        assert.ok(datesSorties.size <= jours.length, `${ctxt} : ${datesSorties.size} jours de course pour ${jours.length} déclarés`);
      }
    }
  });
}

(async () => {
  await profilMarathonienSub3();
  await profilDouleur();
  await profilCycliste();
  await profilSenior();
  await profilElite10();
  console.log(`\n${passed} test(s) d'archétypes passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
})().catch((e) => { console.log("  ✗ plantage : " + (e as Error).stack); process.exit(1); });
