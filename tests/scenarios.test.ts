/**
 * BALAYAGE DE SCÉNARIOS.
 *
 * Les vingt défauts de la journée ont tous été trouvés en regardant UN athlète, dans UN
 * état. Ce fichier construit des centaines de profils synthétiques — niveaux, volumes,
 * fraîcheurs, échéances, disponibilités, météos, historiques — et vérifie sur chacun des
 * règles qui ne doivent JAMAIS être violées. Une violation = un défaut, pas un avis.
 */
import assert from "node:assert/strict";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { buildWorkoutDescription } from "../src/lib/watch/intervals";
import type { AthleteContext } from "../src/lib/ai/coachContext";

type Scenario = { name: string; ctx: AthleteContext };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addD = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

function mk(over: Record<string, unknown>): AthleteContext {
  const base = {
    text: "", objective: null, daysToRace: null, weeksToRace: null, athleteName: "T",
    vma: 16, thresholdPace: "4'10", easyPace: "5'20", hardGapHours: 48, lastHardDaysAgo: null,
    weekPlan: { qBudget: 2, quality: [
      { type: "VMA", desc: "VMA courte : 10×400 m à ~3'40/km, récup 45 s trottinés" },
      { type: "Seuil", desc: "Seuil : 3×10 min à ~4'10/km, récup 2 min" },
    ], easyPace: "5'20", eased: false },
    longRunMode: "run",
    macroPlan: [{ week: 1, phase: "Développement", volumeKm: 40, quality: ["VMA"], longRunKm: 13, focus: "" }],
    readiness: { level: "vert", reasons: [], advice: "" },
    volume: { weekKm: 40, avg4wkKm: 38, targetKm: 40, longRunKm: 13 },
    cycle: { deload: false, taper: false, label: "" }, skippedWeekdays: [],
    availability: { daysPerWeek: 5, days: [0, 1, 2, 3, 4, 5, 6] },
    forecast: [], tooMuchIntensity: null, hillyTraining: false,
    altitude: { elevationM: null, lossPct: 0 }, warmCool: { warm: 15, cool: 10 },
    heatAcclim: { hotDays: 0, factor: 1, label: "non acclimaté" },
  };
  return { ...base, ...over } as unknown as AthleteContext;
}

// ── Génération combinatoire ───────────────────────────────────────────────────
const scenarios: Scenario[] = [];
const levels = [
  { n: "débutant", vma: 12, tgt: 18, lr: 7, q: 1 },
  { n: "intermédiaire", vma: 15, tgt: 40, lr: 13, q: 2 },
  { n: "confirmé", vma: 17.6, tgt: 70, lr: 22, q: 3 },
  { n: "élite", vma: 20.5, tgt: 120, lr: 32, q: 3 },
];
const freshness = ["vert", "jaune", "orange", "rouge"] as const;
const races = [null, 2, 5, 12, 40];
const avails = [3, 4, 5, 6, 7];
const weathers = [
  { n: "tempéré", t: () => 15 },
  { n: "canicule uniforme", t: () => 31 },
  { n: "canicule avec un jour frais", t: (i: number) => (i === 0 ? 20 : 31) },
  { n: "grand froid", t: () => -4 },
];
const histories = [null, 0, 1, 7, 35];

for (const L of levels) for (const f of freshness) for (const r of races) {
  for (const a of avails) for (const w of weathers) for (const h of histories) {
    if (scenarios.length > 4000) break;
    const raceDate = r == null ? null : iso(addD(r));
    scenarios.push({
      name: `${L.n} · ${f} · ${r == null ? "sans course" : `course J-${r}`} · ${a} j/sem · ${w.n} · dernier dur ${h ?? "jamais"}`,
      ctx: mk({
        vma: L.vma, easyPace: "5'20",
        weekPlan: { qBudget: L.q, quality: [
          { type: "VMA", desc: "VMA courte : 10×400 m à ~3'40/km, récup 45 s trottinés" },
          { type: "Seuil", desc: "Seuil : 3×10 min à ~4'10/km, récup 2 min" },
          { type: "Spécifique", desc: "Allure spécifique : 5×1 km à 4'00/km, récup 1 min 30" },
        ].slice(0, L.q), easyPace: "5'20", eased: f !== "vert" },
        // La semaine de course est affûtée en production (facteur 0,55 sur le volume et
        // pas de sortie longue) : le scénario doit le refléter, sinon on teste une
        // situation qui n'existe pas.
        volume: r != null && r <= 6
          ? { weekKm: L.tgt, avg4wkKm: L.tgt, targetKm: Math.round(L.tgt * 0.55), longRunKm: 0 }
          : { weekKm: L.tgt, avg4wkKm: L.tgt, targetKm: L.tgt, longRunKm: L.lr },
        macroPlan: [{ week: 1, phase: r != null && r <= 14 ? "Affûtage" : "Développement", volumeKm: L.tgt, quality: ["VMA"], longRunKm: L.lr, focus: "" }],
        readiness: { level: f, reasons: f === "vert" ? [] : ["test"], advice: "" },
        cycle: { deload: false, taper: r != null && r <= 14, label: "" },
        availability: { daysPerWeek: a, days: [0, 1, 2, 3, 4, 5, 6] },
        lastHardDaysAgo: h,
        objective: raceDate ? { race: "Test", distanceKm: 10, raceDate, targetSeconds: 2400, targetTime: "40'00", targetPace: "4'00" } : null,
        daysToRace: r, weeksToRace: r == null ? null : Math.floor(r / 7),
        hillyTraining: L.n === "élite",
        forecast: Array.from({ length: 7 }, (_, i) => ({
          date: iso(addD(i)), tempMax: w.t(i), tempMin: w.t(i) - 8, feelsMax: w.t(i) + 2,
          humidity: 55, precipMm: 0, windMaxKmh: 10,
        })),
      }),
    });
  }
}

// ── Invariants ────────────────────────────────────────────────────────────────
const HARD = /VMA|Seuil|Spécifique/;
const violations = new Map<string, { count: number; sample: string }>();
const fail = (rule: string, sample: string) => {
  const v = violations.get(rule) ?? { count: 0, sample };
  v.count++; violations.set(rule, v);
};

for (const { name, ctx } of scenarios) {
  const p = buildWeekPlan(ctx, new Date());
  const hardIdx = p.map((d, i) => (HARD.test(d.type) || d.type === "Sortie longue" ? i : -1)).filter((i) => i >= 0);

  if (p.length !== 7) fail("le plan ne fait pas 7 jours", name);

  // Espacement : jamais deux jours durs consécutifs.
  for (let k = 1; k < hardIdx.length; k++) {
    if (hardIdx[k] - hardIdx[k - 1] < 2) fail("deux jours durs consécutifs", `${name} → ${p[hardIdx[k - 1]].type} puis ${p[hardIdx[k]].type}`);
  }
  // Fraîcheur rouge : rien de dur le jour même.
  if (ctx.readiness.level === "rouge" && (HARD.test(p[0].type) || p[0].type === "Sortie longue")) {
    fail("séance dure malgré une fraîcheur rouge", `${name} → ${p[0].type}`);
  }
  // Budget de qualité respecté.
  const qCount = p.filter((d) => HARD.test(d.type)).length;
  if (qCount > ctx.weekPlan.qBudget) fail("plus de qualité que le budget", `${name} → ${qCount} > ${ctx.weekPlan.qBudget}`);
  // Une qualité disponible ne doit pas s'évaporer sans raison.
  if (ctx.weekPlan.qBudget > 0 && qCount === 0 && ctx.availability.daysPerWeek >= 4 && (ctx.daysToRace == null || ctx.daysToRace > 3)) {
    fail("qualité perdue alors que le budget l'autorisait", name);
  }
  // Jour de course : rien de dur à moins de 2 jours.
  if (ctx.objective) {
    const ri = p.findIndex((d) => d.date === ctx.objective!.raceDate);
    if (ri >= 0) for (const i of hardIdx) {
      if (Math.abs(i - ri) < 2 && i !== ri) fail("séance dure trop près de la course", `${name} → ${p[i].type} à ${Math.abs(i - ri)} j`);
    }
  }
  // Jours de course à pied ≤ disponibilité déclarée.
  const runDays = p.filter((d) => !/Repos|Renfo/.test(d.type)).length;
  if (runDays > ctx.availability.daysPerWeek) fail("plus de sorties que de jours disponibles", `${name} → ${runDays} > ${ctx.availability.daysPerWeek}`);
  // Renfo jamais la veille d'un jour dur.
  p.forEach((d, i) => {
    if (d.type === "Renfo" && p[i + 1] && HARD.test(p[i + 1].type)) fail("renfo la veille d'un jour dur", name);
  });


  // ── Invariants de dosage ────────────────────────────────────────────────────
  const kmOf = (d: { tags: string[] }) => {
    const t = d.tags.find((x) => /^\d+(\.\d+)? km$/.test(x));
    return t ? Number(t.replace(" km", "")) : 0;
  };
  const planned = p.filter((d) => d.type !== "Course").reduce((s2, d) => s2 + kmOf(d), 0);
  // Une séance de qualité ne porte pas d'étiquette kilométrique : on l'estime comme le
  // fait le moteur, sur l'allure facile de l'athlète (échauffement + corps + retour).
  const em = ctx.easyPace?.match(/(\d+)['’](\d{2})/);
  const qualityKm = em ? (15 + 10 + 25) * 60 / (Number(em[1]) * 60 + Number(em[2])) : 11;
  const withQuality = planned + p.filter((d) => HARD.test(d.type)).length * qualityKm;
  if (withQuality > ctx.volume.targetKm * 1.25) {
    fail("volume planifié très au-dessus de la cible", `${name} → ${Math.round(withQuality)} km pour ${ctx.volume.targetKm}`);
  }
  // La sortie longue doit être la plus longue sortie de la semaine.
  const longD = p.find((d) => d.type === "Sortie longue");
  if (longD) for (const d of p) {
    if (d !== longD && kmOf(d) > kmOf(longD)) fail("un footing plus long que la sortie longue", `${name} → ${kmOf(d)} > ${kmOf(longD)}`);
  }
  // Aucune séance ne doit être dérisoire ni interminable une fois sur la montre.
  for (const d of p) {
    const b = buildWorkoutDescription(d.title, d.detail, `${d.type} ${d.tags.join(" ")}`, null, ctx.vma, 15, 10);
    if (!b) continue;
    const tot = b.description.split("\n").filter((l) => l.startsWith("- "))
      .reduce((s2, l) => { const m = l.match(/^- (\d+)([ms])/); return s2 + (m ? Number(m[1]) * (m[2] === "m" ? 60 : 1) : 0); }, 0) / 60;
    if (tot < 25) fail("séance montre trop courte pour être utile", `${name} → ${d.type} : ${Math.round(tot)} min`);
    if (tot > 300) fail("séance montre déraisonnablement longue", `${name} → ${d.type} : ${Math.round(tot)} min`);
  }
  // Une semaine d'affûtage doit être plus légère qu'une semaine normale.
  if (ctx.cycle.taper) {
    const hardCount = p.filter((d) => HARD.test(d.type) || d.type === "Sortie longue").length;
    if (hardCount > 2) fail("trop de séances dures en affûtage", `${name} → ${hardCount}`);
  }
  // Terrain vallonné : aucune allure au km imposée (elle n'y veut rien dire).
  if (ctx.hillyTraining) {
    for (const d of p) if (/pace/.test(buildWorkoutDescription(d.title, d.detail, `${d.type} ${d.tags.join(" ")}`, null, ctx.vma, 15, 10)?.description ?? "")) {
      fail("allure au km imposée en terrain vallonné", `${name} → ${d.type}`);
    }
  }

  for (const d of p) {
    const txt = `${d.title} ${d.detail} ${d.why} ${d.tags.join(" ")}`;
    for (const bad of [/undefined/, /NaN/, /\$\{/, /\[object Object\]/, /Infinity/, /null/, /-\d+ min/, /~0 km/]) {
      if (bad.test(txt)) fail(`valeur fabriquée « ${bad.source} »`, `${name} → ${d.type}`);
    }
    // Séance montre exploitable et fidèle au texte.
    const b = buildWorkoutDescription(d.title, d.detail, `${d.type} ${d.tags.join(" ")}`, null, ctx.vma, 15, 10);
    if (!b) continue;
    const lines = b.description.split("\n").filter((l) => l.startsWith("- "));
    if (lines.length < 3) fail("séance montre incomplète", `${name} → ${d.type} : ${lines.length} étapes`);
    for (const l of lines) if (!/^- \d+[ms] /.test(l)) fail("étape montre mal formée", `${name} → ${l}`);
    const seg = d.detail.toLowerCase().split(/corps[^:]*:/)[1];
    // Sur une séance à répétitions (« 3×10 min »), le premier nombre est la durée d'UNE
    // répétition, pas celle du corps : la comparaison n'a de sens que sur un bloc continu.
    if (seg && !/\d+\s*[×x]\s*\d/.test(seg)) {
      const head = seg.split(/→|\n/)[0];
      const h = head.match(/(\d+)\s*h\s*(\d{1,2})?/);
      const site = h ? Number(h[1]) * 60 + Number(h[2] ?? 0) : Number(head.match(/(\d{1,3})\s*min/)?.[1] ?? 0);
      if (site > 0) {
        const body = lines.slice(1, -1).reduce((s, l) => {
          const m = l.match(/^- (\d+)([ms])/); return s + (m ? Number(m[1]) * (m[2] === "m" ? 60 : 1) : 0);
        }, 0) / 60;
        if (Math.abs(body - site) > 2) fail("site et montre en désaccord", `${name} → ${d.type} : site ${site} min, montre ${Math.round(body)} min`);
      }
    }
  }
}

console.log(`\n${scenarios.length} scénarios · ${violations.size} règle(s) violée(s)\n`);
for (const [rule, v] of [...violations.entries()].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  ✗ ${rule} — ${v.count} cas`);
  console.log(`      ex. ${v.sample}`);
}
if (!violations.size) console.log("  ✓ aucun invariant violé");
process.exit(violations.size ? 1 : 0);
