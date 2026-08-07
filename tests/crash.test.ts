/**
 * CRASH-TESTS — profils volontairement hostiles.
 *
 * Le balayage précédent explore des combinaisons PLAUSIBLES. Celui-ci explore les
 * situations qu'on n'anticipe pas : valeurs manquantes, extrêmes, contradictoires,
 * absurdes. Un coach qui plante ou qui raconte n'importe quoi sur un profil bancal est
 * un coach dangereux — et ces profils existent (compte à moitié rempli, athlète blessé
 * la veille d'une course, coureur d'ultra à 3 sorties par semaine).
 *
 * Aucun de ces cas ne doit produire d'exception, de valeur fabriquée, ni de séance
 * physiquement absurde.
 */
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { buildWorkoutDescription } from "../src/lib/watch/intervals";
import type { AthleteContext } from "../src/lib/ai/coachContext";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addD = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const base = {
  text: "", objective: null, daysToRace: null, weeksToRace: null, athleteName: "T",
  vma: 16, thresholdPace: "4'10", easyPace: "5'20", hardGapHours: 48, lastHardDaysAgo: null,
  weekPlan: { qBudget: 2, quality: [{ type: "VMA", desc: "VMA courte : 10×400 m à ~3'40/km, récup 45 s" }], easyPace: "5'20", eased: false },
  longRunMode: "run", macroPlan: [{ week: 1, phase: "Développement", volumeKm: 40, quality: ["VMA"], longRunKm: 13, focus: "" }],
  readiness: { level: "vert", reasons: [], advice: "" },
  volume: { weekKm: 40, avg4wkKm: 38, targetKm: 40, longRunKm: 13 },
  cycle: { deload: false, taper: false, label: "" }, skippedWeekdays: [],
  availability: { daysPerWeek: 5, days: [0, 1, 2, 3, 4, 5, 6] },
  forecast: [], tooMuchIntensity: null, hillyTraining: false,
  altitude: { elevationM: null, lossPct: 0 }, warmCool: { warm: 15, cool: 10 },
  heatAcclim: { hotDays: 0, factor: 1, label: "x" },
};
const mk = (o: Record<string, unknown>) => ({ ...base, ...o }) as unknown as AthleteContext;
const race = (n: number) => ({
  objective: { race: "T", distanceKm: 10, raceDate: iso(addD(n)), targetSeconds: 2400, targetTime: "40'00", targetPace: "4'00" },
  daysToRace: n, weeksToRace: Math.floor(Math.max(0, n) / 7),
});

const cases: [string, AthleteContext][] = [
  ["course AUJOURD'HUI", mk(race(0))],
  ["course demain + fraîcheur rouge", mk({ ...race(1), readiness: { level: "rouge", reasons: ["douleur"], advice: "" } })],
  ["course passée (hier)", mk(race(-1))],
  ["aucune donnée : VMA, allure et volume nuls", mk({ vma: null, easyPace: null, thresholdPace: null, weekPlan: { qBudget: 0, quality: [], easyPace: null, eased: true }, volume: { weekKm: 0, avg4wkKm: 0, targetKm: 0, longRunKm: 0 }, macroPlan: [] })],
  ["volume cible à 0 mais budget qualité à 3", mk({ volume: { weekKm: 0, avg4wkKm: 0, targetKm: 0, longRunKm: 0 }, weekPlan: { ...base.weekPlan, qBudget: 3 } })],
  ["une seule sortie par semaine", mk({ availability: { daysPerWeek: 1, days: [0, 1, 2, 3, 4, 5, 6] } })],
  ["un seul jour autorisé dans la semaine", mk({ availability: { daysPerWeek: 5, days: [3] } })],
  ["aucun jour autorisé", mk({ availability: { daysPerWeek: 5, days: [] } })],
  ["tous les jours systématiquement ratés", mk({ skippedWeekdays: [0, 1, 2, 3, 4, 5, 6] })],
  ["VMA absurdement basse (8 km/h)", mk({ vma: 8, easyPace: "9'30", volume: { weekKm: 10, avg4wkKm: 10, targetKm: 10, longRunKm: 4 } })],
  ["VMA de niveau mondial (25 km/h)", mk({ vma: 25, easyPace: "3'20", volume: { weekKm: 200, avg4wkKm: 200, targetKm: 200, longRunKm: 40 } })],
  ["ultra 170 km à 3 sorties/semaine", mk({ ...race(30), availability: { daysPerWeek: 3, days: [0, 1, 2, 3, 4, 5, 6] }, volume: { weekKm: 60, avg4wkKm: 60, targetKm: 60, longRunKm: 35 } })],
  ["séance dure effectuée aujourd'hui", mk({ lastHardDaysAgo: 0 })],
  ["dernière séance dure il y a 400 jours", mk({ lastHardDaysAgo: 400 })],
  ["espacement de 96 h entre séances dures (vétéran)", mk({ hardGapHours: 96 })],
  ["canicule à 45 °C toute la semaine", mk({ forecast: Array.from({ length: 7 }, (_, i) => ({ date: iso(addD(i)), tempMax: 45, tempMin: 32, feelsMax: 50, humidity: 85, precipMm: 0, windMaxKmh: 5 })) })],
  ["grand froid à −25 °C et vent de 70 km/h", mk({ forecast: Array.from({ length: 7 }, (_, i) => ({ date: iso(addD(i)), tempMax: -25, tempMin: -32, feelsMax: -38, humidity: 60, precipMm: 0, windMaxKmh: 70 })) })],
  ["prévisions incohérentes (une seule journée)", mk({ forecast: [{ date: iso(addD(3)), tempMax: 30, tempMin: 20, feelsMax: 33, humidity: 60, precipMm: 0, windMaxKmh: 10 }] as never })],
  ["affûtage ET semaine allégée en même temps", mk({ cycle: { deload: true, taper: true, label: "" } })],
  ["sortie longue à vélo", mk({ longRunMode: "bike" } as never)],
  ["terrain vallonné + objectif 10 km", mk({ hillyTraining: true })],
  ["sortie longue plus grande que le volume hebdomadaire", mk({ volume: { weekKm: 30, avg4wkKm: 30, targetKm: 30, longRunKm: 45 } })],
  ["menu de qualité vide mais budget à 3", mk({ weekPlan: { qBudget: 3, quality: [], easyPace: "5'20", eased: false } })],
  ["altitude extrême (3500 m)", mk({ altitude: { elevationM: 3500, lossPct: 18 } })],
];

let ko = 0;
for (const [name, ctx] of cases) {
  try {
    const p = buildWeekPlan(ctx, new Date());
    const problems: string[] = [];
    if (p.length !== 7) problems.push(`${p.length} jours`);
    for (const d of p) {
      const txt = `${d.title} ${d.detail} ${d.why}`;
      for (const bad of [/undefined/, /NaN/, /\$\{/, /Infinity/, /\bnull\b/, /-\d+ (min|km)/, /~0 km/, /\b0 min\b/, /\b0 km\b/]) {
        if (bad.test(txt)) problems.push(`« ${bad.source} » dans ${d.type}`);
      }
      const b = buildWorkoutDescription(d.title, d.detail, `${d.type} ${d.tags.join(" ")}`, null, ctx.vma, 15, 10);
      if (b) for (const l of b.description.split("\n").filter((x) => x.startsWith("- "))) {
        if (!/^- \d+[ms] /.test(l)) problems.push(`étape invalide : ${l}`);
        const m = l.match(/^- (\d+)([ms])/);
        const sec = m ? Number(m[1]) * (m[2] === "m" ? 60 : 1) : 0;
        if (sec <= 0) problems.push(`étape de durée nulle : ${l}`);
        if (sec > 5 * 3600) problems.push(`étape de plus de 5 h : ${l}`);
      }
    }
    // Une sortie ne doit jamais dépasser le raisonnable, même sur un profil aberrant.
    for (const d of p) {
      const t = d.tags.find((x) => /^\d+(\.\d+)? km$/.test(x));
      const km = t ? Number(t.replace(" km", "")) : 0;
      if (km > 80) problems.push(`sortie de ${km} km`);
    }
    if (problems.length) { ko++; console.log(`  ✗ ${name}\n      ${[...new Set(problems)].slice(0, 3).join("\n      ")}`); }
    else console.log(`  ✓ ${name}`);
  } catch (e) {
    ko++; console.log(`  ✗ ${name} → EXCEPTION : ${(e as Error).message.slice(0, 100)}`);
  }
}
console.log(`\n${cases.length} crash-tests · ${ko} problème(s)`);
process.exit(ko ? 1 : 0);
