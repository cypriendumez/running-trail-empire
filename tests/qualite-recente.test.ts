/**
 * LA MÊME SÉANCE, QUATRE MATINS DE SUITE — relevé le 28/09/2026 sur le compte réel de
 * Cyprien, à quatre semaines du marathon de Lille.
 *
 * ── 1. LA SÉANCE MANQUÉE REVENAIT CHAQUE MATIN ───────────────────────────────
 * « Séance au seuil » le 21, le 22, le 23 et le 24/09. Le plan repart d'aujourd'hui chaque
 * matin et ne connaissait du passé que la dernière séance dure COURUE : une prescription
 * non faite ne laissait aucune trace, et retombait sur le jour même le lendemain.
 *
 * ── 2. LA SÉANCE FAITE EN APPELAIT UNE AUTRE 48 H PLUS TARD ─────────────────
 * Le budget « une qualité par semaine » s'appliquait à chaque fenêtre repartant
 * d'aujourd'hui : une qualité courue avant-hier n'interdisait qu'un placement à moins de
 * 48 h. Simulé sur son contexte réel : séance faite il y a 2 jours → seuil le jour même.
 *
 * ── 3. LA FEUILLE DE ROUTE ET LE PLAN SE CONTREDISAIENT ─────────────────────
 * « Qualité prévue cette semaine : Allure mara » au-dessus d'une semaine qui posait un
 * seuil. Et la séance d'allure marathon, une fois posée un jeudi, annonçait « intégré à la
 * sortie longue ».
 *
 *   npx tsx tests/qualite-recente.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { qualiteRecente, estQualitePrescrite, fenetreRespectee, type Prescription } from "../src/lib/coach/qualiteRecente";
import { phaseDeSemaine, specifiqueEnTete } from "../src/lib/coach/phase";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { QUALITE_T } from "../src/lib/ai/qualityI18n";
import { parseReps } from "../src/lib/watch/intervals";
import { tr, ALL_LANGS } from "../src/lib/i18n/multi";
import type { AthleteContext } from "../src/lib/ai/coachContext";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const seuil = (date: string): Prescription => ({ date, sessionType: "Seuil", tags: ["Seuil", "Qualité"] });

/** Contexte minimal réaliste (même base que tests/coach.test.ts), une seule qualité au menu. */
function ctx(over: Partial<AthleteContext> = {}): AthleteContext {
  const base = {
    text: "", objective: null, daysToRace: null, weeksToRace: null, athleteName: "Test",
    vma: 17.6, thresholdPace: "3'45", easyPace: "4'52", hardGapHours: 48, lastHardDaysAgo: null,
    weekPlan: { qBudget: 1, quality: [{ type: "Seuil", desc: "Seuil : 2×10 min à 3'45/km, récup 2 min", descAll: tr(() => "Seuil : 2×10 min à 3'45/km, récup 2 min") }], easyPace: "4'52", eased: false },
    longRunMode: "run", macroPlan: [{ week: 1, phase: "Développement", volumeKm: 50, quality: ["Seuil"], longRunKm: 16, focus: "" }],
    readiness: { level: "vert", reasons: [], reasonsAll: [], advice: "" },
    volume: { weekKm: 50, avg4wkKm: 48, targetKm: 50, longRunKm: 16 },
    cycle: { deload: false, taper: false, label: "" }, skippedWeekdays: [],
    availability: { daysPerWeek: 6, days: [0, 1, 2, 3, 4, 5, 6] },
    forecast: [], tooMuchIntensity: null, hillyTraining: false,
    altitude: { elevationM: null, lossPct: 0 }, warmCool: { warm: 15, cool: 10 },
    heatAcclim: { hotDays: 0, factor: 1, label: "non acclimaté" },
  } as unknown as AthleteContext;
  return { ...base, ...over };
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const jourPlus = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const LUNDI = new Date("2026-09-21T12:00:00");

/**
 * Sept matins de suite, comme le cron : chaque matin le plan est reconstruit, et SEULE la
 * séance du jour reste figée dans l'historique (les jours suivants sont purgés et réécrits).
 * `suit` : l'athlète fait-il la qualité quand elle tombe aujourd'hui ?
 */
function septMatins(suit: boolean, qBudget = 1) {
  const historique: Prescription[] = [];
  const faites: string[] = [];
  for (let k = 0; k < 7; k++) {
    const jour = jourPlus(LUNDI, k);
    const j = iso(jour);
    const derniere = faites.length ? faites[faites.length - 1] : null;
    const c = ctx({
      lastHardDaysAgo: derniere ? Math.round((Date.parse(`${j}T12:00:00Z`) - Date.parse(`${derniere}T12:00:00Z`)) / 86400000) : null,
      qualiteRecente: qualiteRecente(historique, faites, j),
    } as Partial<AthleteContext>);
    c.weekPlan = { ...c.weekPlan, qBudget };
    const aujourdhui = buildWeekPlan(c, jour)[0];
    const p = { date: aujourdhui.date, sessionType: aujourdhui.type, tags: aujourdhui.tags };
    historique.push(p);
    if (suit && estQualitePrescrite(p)) faites.push(aujourdhui.date);
  }
  return historique.filter(estQualitePrescrite).map((p) => p.date);
}

console.log("\n=== LA QUALITÉ DES SEPT DERNIERS JOURS ===\n");

test("le cas réel : quatre seuils non faits sont reconnus comme manqués", () => {
  const r = qualiteRecente(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"].map(seuil), [], "2026-09-25");
  assert.deepEqual(r.manquees, ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]);
  assert.deepEqual(r.jours, r.manquees);
});

test("la prescription du JOUR n'est pas comptée : le plan doit pouvoir se republier à l'identique", () => {
  const r = qualiteRecente([seuil("2026-09-24")], [], "2026-09-24");
  assert.deepEqual(r.jours, [], "le plan de 7 h s'interdirait la séance que celui de 4 h venait de poser");
});

test("une séance courue avec un jour de retard est LA séance prescrite, pas une seconde", () => {
  const r = qualiteRecente([seuil("2026-09-21")], ["2026-09-22"], "2026-09-25");
  assert.deepEqual(r.jours, ["2026-09-22"]);
  assert.deepEqual(r.manquees, []);
});

test("appariement un pour un : une seule séance courue n'honore pas deux prescriptions", () => {
  const r = qualiteRecente([seuil("2026-09-21"), seuil("2026-09-23")], ["2026-09-22"], "2026-09-25");
  assert.equal(r.manquees.length, 1, "la seconde prescription passerait pour faite et reviendrait le lendemain");
  assert.equal(r.jours.length, 2);
});

test("une séance dure courue aujourd'hui compte ; une prescription vieille de 7 jours, non", () => {
  assert.deepEqual(qualiteRecente([], ["2026-09-25"], "2026-09-25").jours, ["2026-09-25"]);
  assert.deepEqual(qualiteRecente([seuil("2026-09-18")], [], "2026-09-25").jours, []);
});

test("une séance courue juste avant la fenêtre honore la prescription et sort avec elle", () => {
  const r = qualiteRecente([seuil("2026-09-19")], ["2026-09-17"], "2026-09-25");
  assert.deepEqual(r, { jours: [], manquees: [] });
});

test("ce qui est (et n'est pas) une séance de qualité", () => {
  for (const t of ["Seuil", "VMA", "Spécifique", "Test VMA", "Fractionné", "Tempo"]) assert.ok(estQualitePrescrite({ sessionType: t }), t);
  assert.ok(estQualitePrescrite({ sessionType: "Séance clé", tags: ["Qualité"] }), "le tag canonique suffit");
  // Une sortie longue avec bloc à allure marathon a son propre créneau : elle ne consomme pas le budget.
  assert.ok(!estQualitePrescrite({ sessionType: "Sortie longue", tags: ["Long", "Spécifique"] }));
  for (const t of ["Endurance", "Récupération", "Repos", "Renfo", "Vélo"]) assert.ok(!estQualitePrescrite({ sessionType: t }), t);
});

test("fenêtre glissante : une qualité hier, budget 1 → rien avant six jours", () => {
  for (let i = 0; i <= 5; i++) assert.equal(fenetreRespectee(i, [-1], 1), false, `jour ${i}`);
  assert.equal(fenetreRespectee(6, [-1], 1), true);
  assert.equal(fenetreRespectee(0, [-1], 2), true, "budget 2 : la seconde reste possible");
  assert.equal(fenetreRespectee(3, [], 0), false);
});

console.log("\n=== LE PLAN, MATIN APRÈS MATIN ===\n");

test("séance non faite : elle ne revient PAS chaque matin (le 21→24/09 de Cyprien)", () => {
  const q = septMatins(false);
  assert.ok(q.length <= 1, `qualité prescrite ${q.length} fois en 7 matins : ${q.join(", ")}`);
});

test("contre-poids : la qualité existe toujours — la règle ne la supprime pas", () => {
  const q = septMatins(false);
  assert.equal(q.length, 1, "le garde-fou se satisferait d'un plan sans aucune intensité");
  assert.equal(septMatins(false, 2).length, 2, "budget 2 : deux séances sur sept jours, pas une");
});

test("séance faite : la suivante n'arrive pas 48 h plus tard avec un budget d'une par semaine", () => {
  const q = septMatins(true);
  assert.equal(q.length, 1, `qualité ${q.length} fois en 7 jours pour un budget de 1 : ${q.join(", ")}`);
});

test("budget 2 respecté sur n'importe quels sept jours, passé compris", () => {
  const q = septMatins(true, 2);
  assert.ok(q.length <= 2, `${q.length} qualités en 7 jours : ${q.join(", ")}`);
});

console.log("\n=== PHASE : UNE SEULE VÉRITÉ ===\n");

test("la phase se lit sur le nombre de semaines restantes", () => {
  assert.equal(phaseDeSemaine(12), "Base");
  assert.equal(phaseDeSemaine(7), "Développement");
  assert.equal(phaseDeSemaine(6), "Spécifique");
  assert.equal(phaseDeSemaine(3), "Spécifique", "Lille à 4 semaines : c'est la phase spécifique");
  assert.equal(phaseDeSemaine(2), "Affûtage");
  assert.equal(phaseDeSemaine(0), "Affûtage");
});

test("en phase spécifique, l'allure de course passe en tête ; ailleurs le menu est intact", () => {
  const menu = [{ type: "Seuil" }, { type: "Spécifique" }, { type: "VMA" }];
  assert.deepEqual(specifiqueEnTete(menu, "Spécifique").map((m) => m.type), ["Spécifique", "Seuil", "VMA"]);
  assert.deepEqual(specifiqueEnTete(menu, "Affûtage").map((m) => m.type), ["Spécifique", "Seuil", "VMA"]);
  assert.deepEqual(specifiqueEnTete(menu, "Développement").map((m) => m.type), ["Seuil", "Spécifique", "VMA"]);
  assert.deepEqual(specifiqueEnTete(menu, null).map((m) => m.type), ["Seuil", "Spécifique", "VMA"]);
  assert.deepEqual(specifiqueEnTete([{ type: "VMA" }, { type: "Seuil" }], "Spécifique").map((m) => m.type), ["VMA", "Seuil"]);
});

test("coachContext : la phase s'applique au menu APRÈS le facteur limitant, AVANT le budget", () => {
  const src = codeNu("src/lib/ai/coachContext.ts");
  const limiteur = src.indexOf("if (limiter) {");
  const phase = src.indexOf("menu = specifiqueEnTete(menu, phaseSemaine)");
  const budget = src.indexOf("const chosen = menu.slice(0, qBudget)");
  assert.ok(limiteur > 0 && phase > 0 && budget > 0, "un des trois repères a disparu");
  assert.ok(limiteur < phase && phase < budget, "la phase doit passer après le facteur limitant et avant le budget");
  assert.match(src, /const ph = phaseDeSemaine\(wkUntil\)/, "la feuille de route n'utilise plus la même définition de phase que le plan");
});

test("coachContext : le plan reçoit les jours de qualité, séances dures courues comprises", () => {
  const src = codeNu("src/lib/ai/coachContext.ts");
  assert.match(src, /qualiteDesSeptJours\(\s*coachSessions,\s*workouts\.filter\(w => isHardWk\(w\)\)/);
  assert.match(src, /lastHardDaysAgo,\s*qualiteRecente,/, "le champ n'est plus transmis au plan");
});

test("le calendrier dit qu'une séance manquée ne se rattrape pas, et quand vient la suivante", () => {
  const coach = codeNu("src/lib/ai/autoCoach.ts");
  assert.match(coach, /qualiteManquee: ctx\.qualiteRecente\?\.manquees/);
  assert.match(coach, /prochaineQualite: week\.find\(/);
  const cal = codeNu("src/components/training/CalendarView.tsx");
  assert.match(cal, /t\("cal\.why\.manquee"/);
  assert.match(cal, /t\("cal\.why\.manqueeSansSuite"/);
});

test("la séance d'allure marathon est une séance de SEMAINE : aucune ne renvoie à la sortie longue", () => {
  const INTERDIT = /sortie longue|long run|langen lauf|tirada larga|\bno longo\b|\bdo longo\b/i;
  for (const l of ALL_LANGS) {
    const q = QUALITE_T[l];
    for (const txt of [q.maraBloc20("3'47"), q.maraBloc15("3'47"), q.maraFinish("3'47"), q.maraBlocLong("3'47"), q.maraSansAllure]) {
      assert.doesNotMatch(txt, INTERDIT, `${l} : « ${txt} » — posée un jeudi, elle annoncerait la sortie longue`);
    }
  }
  const r = parseReps(QUALITE_T.fr.maraBloc20("3'47"), null);
  assert.equal(r?.reps, 2); assert.equal(r?.workSec, 1200); assert.equal(r?.recSec, 240, "la montre doit recevoir la récupération annoncée");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
