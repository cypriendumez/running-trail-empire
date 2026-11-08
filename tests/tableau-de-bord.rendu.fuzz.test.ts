/**
 * CRASH-TEST AU HASARD DU RENDU — le tableau de bord ENTIER, rendu des centaines de fois.
 *
 * `tableau-de-bord.fuzz.test.ts` attaque les calculs un par un. Ce fichier attaque ce que
 * l'athlète VOIT : `BentoDashboard` rendu côté serveur avec des comptes tirés au hasard
 * (vide, débutant, cycliste, marathonien, montre muette, données absurdes), dans les cinq
 * langues. Le 06/11/2026, une page entière tombait en 500 pour un cycliste sans sommeil
 * récent (`fillers[1].node`) : aucun test de calcul ne pouvait le voir.
 *
 * Ce qui est interdit dans le texte rendu (et dans les `aria-label` / `title`) :
 *   NaN, Infinity, undefined, null, [object Object], une clé i18n brute (« dash.xxx »),
 *   et — hors français — les mots français de l'interface.
 *
 * Profondeur : `FUZZ_RENDUS=5000 npx tsx tests/tableau-de-bord.rendu.fuzz.test.ts`
 * (et `FUZZ_GRAINE=…` pour une autre série). Par défaut, assez court pour `npm test`.
 */
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { BentoDashboard } from "../src/components/dashboard/BentoDashboard";
import { LanguageProvider } from "../src/lib/i18n/LanguageProvider";
import { FuseauProvider } from "../src/lib/time/FuseauProvider";
import { T } from "../src/lib/i18n/translations";
import { computeStreak } from "../src/lib/streak/compute";
import { seancesSansRessenti } from "../src/lib/dashboard/ressenti";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}

// ── Horloge figée sur le jour de l'athlète (midi, Paris) ─────────────────────────
const AUJ = "2026-11-06";
const DateReelle = Date;
const INSTANT = DateReelle.parse(`${AUJ}T11:00:00Z`);
class DateFigee extends DateReelle {
  constructor(...a: unknown[]) { if (a.length === 0) super(INSTANT); else super(...(a as [string])); }
  static now() { return INSTANT; }
}
(globalThis as { Date: DateConstructor }).Date = DateFigee as unknown as DateConstructor;
process.env.TZ = "Europe/Paris";

// ── Hasard reproductible (mulberry32) ───────────────────────────────────────────
let graine = Number(process.env.FUZZ_GRAINE) || 20261107;
const GRAINE = graine;
const alea = () => { graine |= 0; graine = (graine + 0x6d2b79f5) | 0; let t = Math.imul(graine ^ (graine >>> 15), 1 | graine); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const entre = (a: number, b: number) => Math.floor(a + alea() * (b - a + 1));
const un = <T,>(xs: readonly T[]): T => xs[Math.floor(alea() * xs.length)];
const peut = (p = 0.5) => alea() < p;
const decale = (iso: string, n: number) => { const d = new DateReelle(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** `sale` : de temps en temps, une valeur absurde au lieu d'une vraie. */
let sale = false;
const nombre = (lo: number, hi: number): number | null =>
  !sale || peut(0.8) ? lo + alea() * (hi - lo) : un([null, 0, -1, -1e6, 1e9, 0.0001] as (number | null)[]);
// ⚠️ Ni NaN ni Infinity ici : la base les sert en JSON, qui ne sait pas les écrire. Les
// calculs, eux, y sont exposés (tableau-de-bord.fuzz.test.ts) ; le rendu reçoit du JSON.
const passe = (max = 90) => decale(AUJ, -entre(0, max));
const date = (): string => !sale || peut(0.85) ? passe(120) : un([decale(AUJ, entre(1, 400)), "1970-01-01", "pas-une-date", "", "2026-02-30", decale(AUJ, -3000)]);

// Données NEUTRES (aucun mot d'une langue) : hors français, tout mot français à l'écran
// vient donc de l'interface, pas des données de l'athlète.
const SPORTS = ["run", "Run", "trail_run", "bike", "swim", "walk", "hike", "VirtualRun", "weird"];
function seance(i: number) {
  const run = peut(0.75);
  const km = run ? nombre(2, 44) : nombre(0.5, 120);
  const min = km && km > 0 && Number.isFinite(km) ? km * (run ? entre(3, 8) : entre(2, 5)) : entre(10, 300);
  return {
    id: `w${i}`, date: date(), sport: run ? un(["run", "Run", "trail_run", "VirtualRun"]) : un(SPORTS),
    type: un(["easy", "interval", "race", "tempo", "long_run", "recovery", null]),
    name: un(["X-1", "Z-77", "", "🏃".repeat(entre(1, 5)), "Q".repeat(entre(1, 120))]),
    title: un(["X-1", "Z-77", "", "Q".repeat(entre(1, 120))]),
    distance_km: km, duration_seconds: nombre(min * 60 * 0.9, min * 60 * 1.1), avg_hr: nombre(110, 185), max_hr: nombre(150, 205),
    elevation_gain_m: nombre(0, 2500), tss: nombre(10, 350), avg_cadence_spm: nombre(150, 190),
    hr_zone_seconds: peut(0.5) ? null : Array.from({ length: 5 }, () => nombre(0, 3000)),
    cardiac_decoupling: nombre(-3, 15), training_effect: null,
  };
}

const LANGS = ["fr", "en", "de", "es", "pt"] as const;
const RAPIDE = Number(process.env.FUZZ_RENDUS) || 250;

function compte(k: number) {
  const profil = un(["vide", "debutant", "regulier", "cycliste", "marathonien", "chaos"]);
  sale = profil === "chaos";
  const n = profil === "vide" ? 0 : profil === "debutant" ? entre(0, 4) : entre(3, 40);
  const workouts = Array.from({ length: n }, (_, i) => {
    const s = seance(i);
    if (profil === "cycliste") { s.sport = "bike"; }
    if (profil === "marathonien" && i === 0) { s.sport = "run"; s.distance_km = 42.2; s.duration_seconds = entre(9000, 16000); s.date = passe(20); }
    return s;
  }).sort((a, b) => (a.date < b.date ? 1 : -1));
  const hrv = profil === "vide" || peut(0.3) ? [] : Array.from({ length: entre(1, 25) }, (_, i) => ({
    user_id: "u", date: peut(0.9) ? decale(AUJ, -i - entre(0, sale ? 30 : 2)) : date(), hrv_ms: nombre(25, 140) as number, rmssd: null, sdnn: null,
    physiological_state: un(["optimal", "recovery", "competition", null]),
  }));
  const presc = Array.from({ length: entre(0, 30) }, (_, i) => ({ date: decale(AUJ, -i), sessionType: un(["Endurance", "Repos", "Récup", "Seuil", "VMA", "Renfo", "Sortie longue"]), subtitle: un(["", "Ou repos complet si tu le sens mieux."]), moment: null }));
  const streak = peut(0.2) ? null : computeStreak({ workouts: workouts as never, prescriptions: presc, feedbacks: [], courses: [], today: AUJ });
  const avecObjectif = peut(0.6);
  const dist = un([5, 10, 21.1, 42.2, 25, 1.5]);
  const objective = avecObjectif ? {
    race: un(["Race-A", "Défi-B".replace("é", "e"), "R".repeat(entre(1, 90))]), distanceKm: dist,
    raceDate: un([decale(AUJ, entre(0, 200)), decale(AUJ, 1), AUJ, ...(sale ? ["", "2026-02-30"] : [])]),
    targetSeconds: Math.round(dist * entre(180, 420)), targetTime: "1:00:00", targetPace: "4'00/km",
    officielle: peut(), depuis: peut() ? passe(60) : null,
  } : null;
  const traductions = Object.fromEntries(LANGS.map((l) => [l, { title: `T-${l}`, subtitle: `S-${l}`, tags: [`G-${l}`], why: `W-${l}` }]));
  const coachSession = peut(0.3) ? null : {
    title: "T-fr", subtitle: "S-fr", tags: ["G-fr"], why: "W-fr", i18n: traductions,
    date: un([AUJ, decale(AUJ, 1), decale(AUJ, 2), null]),
  };
  const sleep = peut(0.4) ? null : { total_sleep_min: nombre(200, 600) as number, sleep_score: nombre(20, 100) as number, body_battery_end: nombre(5, 100) as number, deep_sleep_min: nombre(10, 150) as number, rem_sleep_min: nombre(10, 150) as number, date: un([AUJ, decale(AUJ, -1), decale(AUJ, -entre(2, 30))]) };
  return {
    profile: peut(0.05) ? null : { id: "u", full_name: un(["Ana", "", "N".repeat(60)]), preferred_language: "fr", vma: peut() ? nombre(10, 24) : null, max_hr: peut() ? nombre(170, 205) : null, created_at: `${passe(200)}T08:00:00Z` },
    hrv, metriqueVfc: un([null, "rmssd", "sdnn"]), workouts, plan: peut(0.2) ? { race_date: decale(AUJ, entre(5, 90)) } : null,
    league: peut(0.4) ? { leagues: { name: un(["bronze", "silver", "gold", "platinum", "diamond", "??"]) }, points: entre(0, 999) } : null,
    prWorkouts: workouts, recordsDeclares: peut(0.8) ? [] : [{ distance: un(["5k", "10k", "semi", "marathon"] as const), secondes: entre(1000, 15000), date: passe(900), course: un([null, "Race-Z"]) }],
    premiereSeance: n ? workouts[workouts.length - 1].date : null,
    chargeHistory: workouts.map((w) => ({ date: w.date, tss: w.tss, type: w.type, duration_seconds: w.duration_seconds })),
    sleep, coachSession,
    ressenti: peut(0.5) ? null : {
      // Par la même fonction que la page : c'est elle qui filtre et nomme les séances.
      seances: seancesSansRessenti(workouts as never, [], decale(AUJ, -4)),
      chaussures: peut() ? [] : [{ id: "c1", nom: "C-1", km: entre(0, 900), maxKm: 800 }],
    },
    objective, derniereCourse: !avecObjectif && peut(0.3) ? { race: "Race-P", raceDate: passe(20) } : null,
    currentVma: peut(0.25) ? null : nombre(9, 24), sourceVma: un([null, { type: "seances", date: passe(30), km: nombre(3, 30) }, { type: "test", date: passe(30) }, { type: "courbe" }, { type: "vo2max" }]),
    newMembersWeek: entre(0, sale ? 100000 : 30), streak,
    acces: un([null, { etat: "gratuit", joursRestants: null, essaiExpire: false }, { etat: "essai", joursRestants: entre(0, 7), essaiExpire: false }, { etat: "gratuit", joursRestants: null, essaiExpire: true }, { etat: "premium", joursRestants: null, essaiExpire: false }, { etat: "starter", joursRestants: null, essaiExpire: false }]),
    donneesIncompletes: peut(0.9) ? [] : un([["seances"], ["profil", "charge", "records"], ["inconnu"]]),
    jourAujourdhui: AUJ,
    planCoach: un([null, { qBudget: entre(0, 3), recuperation: null }, { qBudget: 0, recuperation: { course: "Race-R", reprise: decale(AUJ, entre(1, 20)) } }]),
    montreReliee: peut(0.7), cibleVolumeKm: peut(0.5) ? null : nombre(10, 120),
    analyses: workouts.slice(0, entre(0, 2)).map((w) => ({ body: "Lorem-ipsum.", data: { workout_id: w.id, date: w.date } })),
    _profil: profil, _k: k,
  };
}

const routeur = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
function rendre(props: Record<string, unknown>, lang: string): string {
  return renderToStaticMarkup(h(AppRouterContext.Provider, { value: routeur as never },
    h(LanguageProvider, { initialLang: lang as never, dict: (T as Record<string, unknown>)[lang] as never,
      children: h(FuseauProvider, { fuseau: "Europe/Paris", children: h(BentoDashboard, props as never) }) })));
}

const entites = (s: string) => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;| | /g, " ");
/** Ce que l'athlète lit : le texte, plus les libellés d'accessibilité et les bulles. */
function lisible(html: string): string {
  const attrs = [...html.matchAll(/\s(?:aria-label|title|alt|placeholder)="([^"]*)"/g)].map((m) => m[1]);
  const texte = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, "\n");
  return entites([texte, ...attrs].join("\n")).replace(/[ \t]+/g, " ");
}

const INTERDITS = /\bNaN\b|\bInfinity\b|\bundefined\b|\bnull\b|\[object Object\]/;
const CLE_BRUTE = /\b(?:dash|obj|streak|nav|common|fb|tap|kpi|acwr)\.[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*\b/;
// Mots de l'INTERFACE française qui n'ont rien à faire dans une autre langue.
const FRANCAIS = /\b(?:séance|séances|semaine|aujourd'hui|demain|récupération|prochaine|objectif|entraînement|sommeil|jours?|voir|ta|ton|tes|ajouter|aucune?|données)\b/i;

console.log(`\nCRASH-TEST DU RENDU — ${RAPIDE} comptes × 5 langues, graine ${GRAINE}\n`);

const vus = { rendus: 0, profils: {} as Record<string, number> };
test(`${RAPIDE} comptes au hasard × 5 langues : aucun plantage, aucun texte cassé`, () => {
  const erreurs: string[] = [];
  for (let k = 0; k < RAPIDE && erreurs.length < 8; k++) {
    const props = compte(k);
    vus.profils[props._profil] = (vus.profils[props._profil] ?? 0) + 1;
    for (const lang of LANGS) {
      let html: string;
      try { html = rendre(props, lang); vus.rendus++; }
      catch (e) { erreurs.push(`compte ${k} (${props._profil}, ${lang}) : PLANTAGE ${(e as Error).message.split("\n")[0]}`); continue; }
      const txt = lisible(html);
      const ligne = (re: RegExp) => txt.split("\n").find((l) => re.test(l))?.trim().slice(0, 140);
      if (INTERDITS.test(txt)) erreurs.push(`compte ${k} (${props._profil}, ${lang}) : « ${ligne(INTERDITS)} »`);
      if (CLE_BRUTE.test(txt)) erreurs.push(`compte ${k} (${props._profil}, ${lang}) : clé brute « ${ligne(CLE_BRUTE)} »`);
      if (lang !== "fr" && FRANCAIS.test(txt)) erreurs.push(`compte ${k} (${props._profil}, ${lang}) : français « ${ligne(FRANCAIS)} »`);
      if (/-\d+(?:[.,]\d+)?\s?(?:km|min|h\b|bpm|ms)/.test(txt)) erreurs.push(`compte ${k} (${props._profil}, ${lang}) : mesure négative « ${ligne(/-\d+(?:[.,]\d+)?\s?(?:km|min|h\b|bpm|ms)/)} »`);
    }
  }
  assert.equal(erreurs.length, 0, "\n      " + erreurs.join("\n      "));
});

test("tous les profils de compte ont été tirés", () => {
  for (const p of ["vide", "debutant", "regulier", "cycliste", "marathonien", "chaos"]) assert.ok((vus.profils[p] ?? 0) > 0, `profil ${p} jamais tiré`);
  assert.ok(vus.rendus >= RAPIDE * 5 * 0.99, `${vus.rendus} rendus seulement`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s) — ${vus.rendus} rendus`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f.slice(0, 3000)); process.exit(1); }
