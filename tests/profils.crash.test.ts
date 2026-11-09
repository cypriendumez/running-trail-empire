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

(async () => {
  await profilMarathonienSub3();
  console.log(`\n${passed} test(s) d'archétypes passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
})().catch((e) => { console.log("  ✗ plantage : " + (e as Error).stack); process.exit(1); });
