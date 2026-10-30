/**
 * LE TABLEAU DE BORD EST LE MÊME AU SERVEUR ET AU TÉLÉPHONE, MÊME À MINUIT (30/10/2026).
 *
 * Trois erreurs React #418 enregistrées sur le tableau de bord de Cyprien, entre 0 h 53 et
 * 0 h 58. Le serveur (Vercel, UTC) et le téléphone (Paris) rendaient le même instant, mais
 * pas le même JOUR : entre minuit et 1 h, le serveur vivait encore la veille. Rejoué ici :
 *   · « J-51 » au serveur, « J-50 » au téléphone, sur trois cartes ;
 *   · les sept barres de la semaine décalées d'un jour ;
 *   · la nuit du vendredi au samedi, une autre séance recommandée (week-end ou non).
 * React voit deux textes différents à l'hydratation, jette le rendu serveur et refait tout.
 *
 * Le test rend le VRAI tableau de bord deux fois au même instant figé, en UTC puis en
 * heure de Paris, et exige deux rendus identiques.
 *
 *   npx tsx tests/hydratation.test.ts
 */
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { BentoDashboard } from "../src/components/dashboard/BentoDashboard";
import { LanguageProvider } from "../src/lib/i18n/LanguageProvider";
import { FuseauProvider } from "../src/lib/time/FuseauProvider";
import { T } from "../src/lib/i18n/translations";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}

// ── L'horloge figée : `new Date()` et `Date.now()` rendent l'instant choisi. ──────
const DateReelle = Date;
let instant = 0;
class DateFigee extends DateReelle {
  constructor(...a: unknown[]) {
    if (a.length === 0) super(instant);
    else super(...(a as [string]));
  }
  static now() { return instant; }
}
(globalThis as { Date: DateConstructor }).Date = DateFigee as unknown as DateConstructor;

const routeur = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const jourAvant = (n: number) => new DateReelle(instant - n * 86400000).toISOString().slice(0, 10);
const seance = (date: string, km: number, min: number, sport = "run") => ({
  id: `${date}-${km}`, date, type: "easy", sport, name: "Course à pied", distance_km: km, duration_seconds: min * 60,
  avg_hr: 150, max_hr: 170, elevation_gain_m: 30, tss: Math.round(min * 0.9),
});

/** Le tableau de bord de Cyprien le 30/10 : marathon couru il y a cinq jours, défi sub 16 en cours. */
function rendu(fuseauMachine: string, jourAthlete: string, avecSeanceDuCoach: boolean, nuit = "2026-10-29", fuseauAthlete = "Europe/Paris"): string {
  process.env.TZ = fuseauMachine;
  const seances = [seance("2026-10-25", 42.5, 162), seance("2026-10-25", 2.1, 13), seance("2026-10-24", 5.3, 29),
    seance("2026-10-23", 9, 28, "bike"), seance("2026-10-22", 10.2, 44), seance("2026-10-20", 12, 55), seance("2026-10-18", 18, 85)];
  const props = {
    profile: { id: "u", full_name: "Cyprien Dumez", preferred_language: "fr" },
    hrv: Array.from({ length: 20 }, (_, i) => ({ date: jourAvant(i), hrv_ms: 70 + (i % 5), physiological_state: null })),
    metriqueVfc: null, workouts: seances, plan: null, league: null, prWorkouts: seances, recordsDeclares: [],
    premiereSeance: "2025-04-26",
    chargeHistory: Array.from({ length: 300 }, (_, i) => ({ date: jourAvant(i), tss: 40 + (i % 7) * 12, type: "easy", duration_seconds: 3000 })),
    sleep: { total_sleep_min: 410, sleep_score: 65, body_battery_end: 55, deep_sleep_min: 70, rem_sleep_min: 90, date: nuit },
    coachSession: avecSeanceDuCoach ? { title: "Footing en endurance", subtitle: "Corps : ~8,5 km en Z2", tags: ["Endurance"], why: "Le socle aérobie." } : null,
    ressenti: null,
    objective: { race: "sub 16 min", distanceKm: 5, raceDate: "2026-12-19", targetSeconds: 959, targetTime: "15'59", targetPace: "3'12/km", officielle: false, depuis: "2026-10-30" },
    derniereCourse: null, currentVma: 20.1, sourceVma: { type: "seances", date: "2026-09-29", km: 23.7 },
    newMembersWeek: 0, streak: null, acces: { etat: "premium", joursRestants: null, essaiExpire: false },
    donneesIncompletes: [], jourAujourdhui: jourAthlete,
    planCoach: { qBudget: 0, recuperation: { course: "Marathon International de Lille", reprise: "2026-11-21" } },
  };
  return renderToStaticMarkup(h(AppRouterContext.Provider, { value: routeur as never },
    h(LanguageProvider, { initialLang: "fr", dict: T.fr,
      children: h(FuseauProvider, { fuseau: fuseauAthlete, children: h(BentoDashboard, props as never) }) })));
}

/** Les textes qui diffèrent entre les deux rendus (vide = hydratation sans erreur). */
function ecarts(a: string, b: string): string[] {
  const la = a.split("><"), lb = b.split("><");
  const out: string[] = [];
  for (let i = 0; i < Math.max(la.length, lb.length) && out.length < 4; i++) {
    if (la[i] !== lb[i]) out.push(`serveur « ${(la[i] ?? "").slice(0, 70)} » ≠ téléphone « ${(lb[i] ?? "").slice(0, 70)} »`);
  }
  return out;
}

console.log("\nMINUIT À PARIS, LA VEILLE EN UTC");

test("précondition : changer de fuseau change bien le jour lu par l'horloge", () => {
  instant = DateReelle.parse("2026-10-29T23:53:00Z");
  process.env.TZ = "UTC"; const utc = new Date().getDate();
  process.env.TZ = "Europe/Paris"; const paris = new Date().getDate();
  assert.notEqual(utc, paris, "le fuseau du processus ne change pas : ce test ne prouverait rien");
});

test("jeudi 23 h 53 UTC (vendredi 0 h 53 à Paris) : J-50 partout, la même semaine", () => {
  instant = DateReelle.parse("2026-10-29T23:53:00Z");
  const serveur = rendu("UTC", "2026-10-30", true), telephone = rendu("Europe/Paris", "2026-10-30", true);
  assert.deepEqual(ecarts(serveur, telephone), []);
  assert.match(telephone, /J‑50/, "précondition : le compte à rebours est rendu");
  // La nuit de l'avant-veille : 47 h 53 au serveur, 48 h 53 au téléphone — la limite des 48 h.
  assert.deepEqual(ecarts(rendu("UTC", "2026-10-30", true, "2026-10-28"), rendu("Europe/Paris", "2026-10-30", true, "2026-10-28")), [],
    "la carte du sommeil n'est pas la même au serveur et au téléphone");
});

test("vendredi 23 h 30 UTC (samedi 0 h 30 à Paris), sans séance du coach : la même séance recommandée", () => {
  instant = DateReelle.parse("2026-10-30T23:30:00Z");
  const serveur = rendu("UTC", "2026-10-31", false), telephone = rendu("Europe/Paris", "2026-10-31", false);
  assert.deepEqual(ecarts(serveur, telephone), []);
});

test("un coureur à Montréal vit SON jour, pas celui de Paris : jeudi 19 h 53, J-51", () => {
  // 23 h 53 UTC : vendredi à Paris, encore jeudi à Montréal. Le serveur fournit le jour de
  // l'athlète (cookie de fuseau) ; l'horloge de Paris lui aurait volé un jour.
  instant = DateReelle.parse("2026-10-29T23:53:00Z");
  const html = rendu("UTC", "2026-10-29", true, "2026-10-29", "America/Montreal");
  assert.match(html, /J‑51/, "le compte à rebours suit Paris, pas le jour de l'athlète");
  assert.doesNotMatch(html, /J‑50/);
});

test("l'anneau de préparation part du jour où l'objectif a été fixé : 0 % le jour même", () => {
  instant = DateReelle.parse("2026-10-30T16:15:00Z");
  const html = rendu("Europe/Paris", "2026-10-30", true);
  assert.doesNotMatch(html, />56<span/, "« 56 % » : la préparation supposée de 16 semaines est revenue");
  assert.match(html, />0<span[^>]*>%</, "l'anneau n'affiche pas 0 % le jour où l'objectif est fixé");
});

process.env.TZ = "UTC";
console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
