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
import type { AthleteContext } from "../src/lib/ai/coachContext";

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

console.log(`\n${passed} test(s) d'archétypes passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
