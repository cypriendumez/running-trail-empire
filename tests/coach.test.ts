/**
 * INVARIANTS DU COACH — figés par des tests.
 *
 * Dix-huit défauts silencieux ont été trouvés en une seule journée d'audit manuel.
 * Aucun ne levait d'erreur : réponse HTTP 200, compteur à zéro, chiffre plausible à
 * l'écran. C'est précisément ce que des tests attrapent et qu'une relecture ne voit pas.
 *
 * Chaque cas ci-dessous correspond à un bug RÉEL, constaté en production. Le nom du test
 * décrit la règle ; le commentaire rappelle ce qui s'était passé quand elle était violée.
 *
 *   npx tsx tests/coach.test.ts
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { isRun, sportOf } from "../src/lib/intervals/sport";
import { vmaFromPaceCurve, bestVmaFromWorkouts } from "../src/lib/running/fitness";
import { heatAdvice, windAdvice, altitudeLossPct, heatAcclimation } from "../src/lib/weather/openMeteo";
import { parseReps, parsePaceSec, stepsForType, warmCoolMin, buildWorkoutDescription } from "../src/lib/watch/intervals";
import { buildWeekPlan, CONFIRMED_DAYS } from "../src/lib/ai/autoPlan";
import { stripProfileSecrets } from "../src/lib/profile/safe";
import type { AthleteContext } from "../src/lib/ai/coachContext";
import {
  bmiOf, bmrMifflin, workoutKcal, weightTrend, weightModeEligibility,
  buildWeightPlan, trendVerdict,
} from "../src/lib/weight/energy";
import { weightTrainingRules, weightCoachBlock } from "../src/lib/weight/coaching";
import { robustWeeklyKm, demonstratedWeeklyKm, longRunPeakKm, longRunForWeek, longRunGap } from "../src/lib/running/volume";
import { sniffType, sniffImage } from "../src/lib/upload/sniff";
import { HELP_PAGES, HEALTH_TABS, HELP_PROBLEMS } from "../src/data/helpKb";
import { PROBLEM_KEYS, PROBLEM_T } from "../src/data/helpProblemsI18n";
import { diagnoseAccount, findingsBlock } from "../src/lib/support/diagnose";
import {
  canonical, fingerprint, isCacheUsable, PROFILE_FINGERPRINT_COLUMNS, type SessionSignals,
} from "../src/lib/ai/sessionCache";
import {
  nextQuotaResetUtc, markExhausted, isExpired, selectModels, isDailyQuotaError, PROBE_INTERVAL_MS,
} from "../src/lib/ai/quotaMemory";
import { generateContent, __resetQuotaMemory, __quotaMemory, __setQuotaMark } from "../src/lib/ai/gemini";
import {
  canSee, cleanBody, isPublishable, statLine, paceOf, suggestable, timeAgo, likesLabel,
  type Post as SocialPost,
} from "../src/lib/social/feed";
import {
  computeTrophies, chronoRecords, longestStreak, type TrophyWorkout as TW,
} from "../src/lib/trophies/compute";
import {
  haversine, simplify, encodePolyline, decodePolyline, bboxOverlap, elevationGain, type TrackPoint as TP,
} from "../src/lib/segments/geo";
import { findEfforts, leaderboard, maitreDuSegment } from "../src/lib/segments/match";

let passed = 0;
const fails: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { fails.push(`${name} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${name}`); }
}

/** Contexte minimal réaliste, surchargeable au cas par cas. */
function ctx(over: Partial<AthleteContext> = {}): AthleteContext {
  const base = {
    text: "", objective: null, daysToRace: null, weeksToRace: null, athleteName: "Test",
    vma: 17.6, thresholdPace: "3'45", easyPace: "4'52", hardGapHours: 48, lastHardDaysAgo: null,
    weekPlan: { qBudget: 2, quality: [{ type: "VMA", desc: "VMA courte : 10×400 m à ~3'20/km, récup 45 s" }], easyPace: "4'52", eased: false },
    longRunMode: "run", macroPlan: [{ week: 1, phase: "Développement", volumeKm: 50, quality: ["VMA"], longRunKm: 16, focus: "" }],
    readiness: { level: "vert", reasons: [], advice: "" },
    volume: { weekKm: 50, avg4wkKm: 48, targetKm: 50, longRunKm: 16 },
    cycle: { deload: false, taper: false, label: "" }, skippedWeekdays: [],
    availability: { daysPerWeek: 6, days: [0, 1, 2, 3, 4, 5, 6] },
    forecast: [], tooMuchIntensity: null, hillyTraining: false,
    altitude: { elevationM: null, lossPct: 0 }, warmCool: { warm: 15, cool: 10 },
    heatAcclim: { hotDays: 0, factor: 1, label: "non acclimaté" },
  } as unknown as AthleteContext;
  return { ...base, ...over };
}
const bodyMinOf = (txt: string): number | null => {
  const seg = txt.toLowerCase().split(/corps[^:]*:/)[1];
  if (!seg) return null;
  const head = seg.split(/→|\n/)[0];
  const h = head.match(/(\d+)\s*h\s*(\d{1,2})?/);
  if (h) return Number(h[1]) * 60 + Number(h[2] ?? 0);
  const m = head.match(/(\d{1,3})\s*min/);
  return m ? Number(m[1]) : null;
};

console.log("\nSPORT — le volume de course ne compte que la course");
// Bug réel : 101,8 km comptés pour 35,8 km courus (randonnées rangées en « trail »),
// d'où une sortie longue de 33 km proposée pour un objectif 10 km.
test("la randonnée et le vélo ne sont pas de la course", () => {
  assert.equal(sportOf("Hike"), "hike");
  assert.equal(sportOf("Ride"), "bike");
  assert.equal(isRun("hike"), false);
  assert.equal(isRun("bike"), false);
  assert.equal(isRun("run"), true);
});
test("une séance sans sport reste comptée comme de la course (historique)", () => {
  assert.equal(isRun(null), true);
});

console.log("\nVMA — jamais fabriquée, jamais périmée");
// Bug réel : VMA 19,8 issue d'un 10 km de mars pilotait encore les séances d'août,
// produisant « 12×400 m à 2'55/km » chez un athlète dont le record était 3'20.
test("la VMA vient des meilleurs efforts mesurés", () => {
  const v = vmaFromPaceCurve([{ m: 5000, sec: 1107 }, { m: 10000, sec: 2276 }]);
  assert.ok(v !== null && v > 17 && v < 18.5, `attendu ~17,6 — obtenu ${v}`);
});
test("aucune VMA sans donnée", () => {
  assert.equal(vmaFromPaceCurve([]), null);
  assert.equal(vmaFromPaceCurve(undefined), null);
});
test("les efforts hors fenêtre de forme sont ignorés", () => {
  const vieux = [{ date: new Date(Date.now() - 200 * 86400000).toISOString(), distance_km: 10, duration_seconds: 2038, avg_hr: 194 }];
  assert.equal(bestVmaFromWorkouts(vieux, 200), null);
});

console.log("\nMÉTÉO — la pénalité corrige le CHIFFRE, pas seulement le texte");
// Bug réel : « compte 45 s/km de plus » écrit en note, allure inchangée dans la cible
// envoyée à la montre. Le texte et le nombre se contredisaient.
test("la chaleur pénalise, le froid non", () => {
  assert.ok(heatAdvice(31, 60).penaltySecPerKm >= 40);
  assert.ok(heatAdvice(31, 80).penaltySecPerKm > heatAdvice(31, 50).penaltySecPerKm);
  assert.equal(heatAdvice(12, 50).penaltySecPerKm, 0);
});
test("le vent pénalise au-delà de 20 km/h", () => {
  assert.equal(windAdvice(12).penaltySecPerKm, 0);
  assert.ok(windAdvice(40).penaltySecPerKm >= 15);
  assert.equal(windAdvice(null).penaltySecPerKm, 0);
});
test("l'acclimatation réduit la pénalité sans l'annuler", () => {
  assert.equal(heatAcclimation(0).factor, 1);
  assert.ok(heatAcclimation(14).factor < 1 && heatAcclimation(14).factor > 0.4);
});
test("l'altitude ne compte qu'au-dessus de 500 m", () => {
  assert.equal(altitudeLossPct(300), 0);
  assert.equal(altitudeLossPct(null), 0);
  assert.ok(altitudeLossPct(1500) > altitudeLossPct(800));
});

console.log("\nMONTRE — ce que le site annonce est ce que la montre reçoit");
// Bug réel : site « 20 à 25 min », montre 10 min ; sortie longue de 1h02 réduite à 37 min.
test("la durée du corps de séance est celle du texte", () => {
  for (const [type, detail] of [
    ["Endurance", "Échauffement 15 min progressif → Corps : ~8 km (environ 39 min) en Z2 → Retour au calme 10 min FC Z1."],
    ["Sortie longue", "Échauffement 15 min progressif → Corps : ~13 km (environ 1h02) en Z2 → Retour au calme 10 min FC Z1."],
    ["Récup", "Échauffement 15 min très doux → Corps : 25 min en Z1 très facile → Retour au calme 10 min FC Z1."],
  ] as const) {
    const out = stepsForType(type, 50, 17.6, parsePaceSec(detail), 15, 10, null, detail)!;
    const lines = out.split("\n").filter((l) => l.startsWith("- "));
    const body = lines.slice(1, -1).reduce((s, l) => {
      const m = l.match(/^- (\d+)([ms])/); return s + (m ? Number(m[1]) * (m[2] === "m" ? 60 : 1) : 0);
    }, 0) / 60;
    assert.equal(body, bodyMinOf(detail), `${type} : site ${bodyMinOf(detail)} min, montre ${body} min`);
  }
});
test("une récupération n'a JAMAIS de cible d'allure", () => {
  const d = "Échauffement 15 min très doux → Corps : 25 min en Z1 très facile → Retour au calme 10 min FC Z1.";
  const out = stepsForType("Récup", 50, 17.6, 300, 15, 10, null, d)!;
  assert.ok(!/pace/.test(out), "une séance de récupération pilotée au chrono n'est plus une récupération");
});
test("une séance en côte est pilotée à la fréquence cardiaque", () => {
  const d = "Échauffement 20 min → Corps : Côtes : 8×45 s en côte à 6 %, récup descente → Retour au calme 10 min FC Z1.";
  const out = stepsForType("VMA", 50, 17.6, parsePaceSec(d), 15, 10, parseReps(d, null), d)!;
  assert.ok(!/pace/.test(out), "une allure au km n'a aucun sens en montée");
});
test("les répétitions sont écrites une par une", () => {
  // Bug réel : intervals.icu n'interprète AUCUNE syntaxe de répétition — « 12x » était
  // ignoré et l'athlète recevait UNE seule répétition.
  const d = "Corps : VMA courte : 12×400 m à ~3'20/km, récup 45 s trottinés";
  const out = stepsForType("VMA", 50, 17.6, parsePaceSec(d), 15, 10, parseReps(d, parsePaceSec(d)), d)!;
  const steps = out.split("\n").filter((l) => l.startsWith("- "));
  assert.equal(steps.length, 2 + 12 + 11, `attendu 25 étapes, obtenu ${steps.length}`);
  assert.ok(!/\d+x/i.test(out));
});
test("un over-under alterne réellement sur la montre", () => {
  // Bug réel : la montre envoyait un bloc UNIFORME de 5 min à l'allure sous-seuil.
  // L'athlète ne touchait jamais le seuil, et le format perdait tout son intérêt.
  const d = "Corps : Over-under : 3×5 min en alternant 1 min à ~4'10/km (sous-seuil) / 1 min à ~4'02/km (au seuil), récup 3 min";
  const out = stepsForType("Seuil", 55, 17.6, parsePaceSec(d), 15, 10, parseReps(d, parsePaceSec(d)), d)!;
  const lines = out.split("\n").filter((l) => l.startsWith("- "));
  assert.ok(lines.some((l) => /Sous-seuil/.test(l)), "aucune portion sous-seuil");
  assert.ok(lines.some((l) => /Au seuil/.test(l)), "aucune portion au seuil");
  const paces = new Set(lines.filter((l) => /pace/.test(l)).map((l) => l.match(/(\d+:\d{2})-/)?.[1]));
  assert.ok(paces.size >= 2, "les deux allures doivent être distinctes sur la montre");
});

test("les durées d'échauffement suivent le profil", () => {
  assert.deepEqual(warmCoolMin(20, 12), { warm: 20, cool: 12 });
  assert.deepEqual(warmCoolMin(null, null), { warm: 15, cool: 10 });
  assert.deepEqual(warmCoolMin(999, 0), { warm: 30, cool: 5 });
});
test("repos et renfo ne partent pas sur la montre", () => {
  assert.equal(stepsForType("Repos", 50, 17.6, null, 15, 10, null, ""), null);
  assert.equal(stepsForType("Renfo", 50, 17.6, null, 15, 10, null, ""), null);
});

console.log("\nPLAN — sécurité et cohérence");
// Bug réel : un compte neuf recevait une séance de VMA dès le premier jour.
test("aucune qualité quand le budget est nul", () => {
  const p = buildWeekPlan(ctx({ weekPlan: { qBudget: 0, quality: [], easyPace: null, eased: true } } as never), new Date());
  assert.equal(p.filter((d) => /VMA|Seuil|Spécifique/.test(d.type)).length, 0);
});
test("fraîcheur rouge : rien de dur aujourd'hui", () => {
  const p = buildWeekPlan(ctx({ readiness: { level: "rouge", reasons: ["test"], advice: "" } } as never), new Date());
  assert.ok(!/VMA|Seuil|Spécifique|Sortie longue/.test(p[0].type), `jour 0 = ${p[0].type}`);
});
test("une qualité annulée par la fraîcheur est DÉCALÉE, pas supprimée", () => {
  const p = buildWeekPlan(ctx({ readiness: { level: "rouge", reasons: ["test"], advice: "" } } as never), new Date());
  assert.ok(p.filter((d) => /VMA|Seuil|Spécifique/.test(d.type)).length >= 1, "la semaine ne doit pas perdre sa qualité");
});
test("une semaine entièrement caniculaire n'efface pas la qualité", () => {
  // Bug réel : `coolerExists` reportait la séance dès qu'un jour était 3 °C plus frais,
  // même quand ce jour n'était pas utilisable. Sur une semaine à 29-31 °C, TOUS les
  // créneaux valides étaient disqualifiés par le seul vendredi à 25,6 °C ; le repli
  // replaçait alors la qualité sur le jour même, que la fraîcheur rouge convertissait
  // en récupération. La séance disparaissait de la semaine.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
    return { date: d, tempMax: i === 0 ? 25.6 : 30, tempMin: 18, feelsMax: 32, humidity: 55, precipMm: 0, windMaxKmh: 5 };
  });
  const p = buildWeekPlan(ctx({
    forecast: days as never,
    readiness: { level: "rouge", reasons: ["canicule"], advice: "" },
  } as never), new Date());
  const q = p.filter((d) => /VMA|Seuil|Spécifique/.test(d.type));
  assert.equal(q.length, 1, "la qualité doit être DÉCALÉE, jamais perdue");
  assert.notEqual(q[0].date, p[0].date, "et jamais posée sur un jour que la fraîcheur va effacer");
});

test("le plan couvre 7 jours et en confirme assez pour la montre", () => {
  const p = buildWeekPlan(ctx(), new Date());
  assert.equal(p.length, 7);
  assert.equal(p.filter((d) => d.confirmed).length, CONFIRMED_DAYS);
  assert.ok(CONFIRMED_DAYS >= 3, "trop peu d'avance pour absorber la synchro Garmin");
});
test("aucune valeur fabriquée dans le plan", () => {
  const p = buildWeekPlan(ctx(), new Date());
  const all = p.map((d) => `${d.title} ${d.detail} ${d.why} ${d.tags.join(" ")}`).join("\n");
  for (const bad of [/undefined/, /NaN/, /\$\{/, /\[object Object\]/, /Infinity/, /null/]) {
    assert.ok(!bad.test(all), `« ${bad.source} » présent dans le plan`);
  }
});
test("le volume planifié respecte la cible", () => {
  const c = ctx();
  const p = buildWeekPlan(c, new Date());
  const km = p.reduce((s, d) => {
    const t = d.tags.find((x) => /^\d+(\.\d+)? km$/.test(x));
    return s + (t ? Number(t.replace(" km", "")) : 0);
  }, 0);
  // Les séances de qualité ne portent pas d'étiquette kilométrique : on tolère l'écart.
  assert.ok(km <= c.volume.targetKm * 1.1, `${km} km planifiés pour une cible de ${c.volume.targetKm}`);
});
test("un jour de course n'est jamais entouré de séances dures", () => {
  const race = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const p = buildWeekPlan(ctx({ objective: { race: "Test", distanceKm: 10, raceDate: race, targetSeconds: 2400, targetTime: "40'00", targetPace: "4'00" }, daysToRace: 3, weeksToRace: 0 } as never), new Date());
  const idx = p.findIndex((d) => d.date === race);
  if (idx > 0) for (const j of [idx - 1, idx + 1]) {
    if (p[j]) assert.ok(!/VMA|Seuil|Sortie longue/.test(p[j].type), `${p[j].type} la veille ou le lendemain de la course`);
  }
});

console.log("\nBOUT EN BOUT — site et montre disent la même chose");
test("chaque séance du plan produit une séance montre cohérente", () => {
  const p = buildWeekPlan(ctx(), new Date());
  for (const d of p) {
    const b = buildWorkoutDescription(d.title, d.detail, `${d.type} ${d.tags.join(" ")}`, null, 17.6, 15, 10);
    if (!b) continue;
    const lines = b.description.split("\n").filter((l) => l.startsWith("- "));
    assert.ok(lines.length >= 3, `${d.type} : ${lines.length} étape(s)`);
    for (const l of lines) assert.match(l, /^- \d+[ms] /, `étape mal formée : ${l}`);
    const site = bodyMinOf(d.detail);
    if (site != null) {
      const body = lines.slice(1, -1).reduce((s, l) => {
        const m = l.match(/^- (\d+)([ms])/); return s + (m ? Number(m[1]) * (m[2] === "m" ? 60 : 1) : 0);
      }, 0) / 60;
      assert.ok(Math.abs(body - site) <= 2, `${d.type} : site ${site} min, montre ${Math.round(body)} min`);
    }
  }
});


// ─────────────────────────────────────────────────────────────────────────────
//  SYNCHRONISATION — six des dix-neuf défauts s'y cachaient, aucun test ne la couvrait.
//  Les activités de référence sont RÉELLES, capturées depuis l'API intervals.icu.
// ─────────────────────────────────────────────────────────────────────────────
import { buildWorkoutRow, makeMatcher, INTEGER_COLUMNS, type IcuActivity } from "../src/lib/intervals/workoutRow";
import fixtures from "./fixtures/activities.json" with { type: "json" };

const acts = fixtures as IcuActivity[];
const run = acts.find((a) => a.type === "Run")!;
const hike = acts.find((a) => a.type === "Hike")!;

console.log("\nSYNCHRONISATION — écriture des séances");
test("aucun flottant dans une colonne entière", () => {
  // Bug réel : `average_cadence * 2` = 176.54 dans un smallint → Postgres rejetait la
  // LIGNE ENTIÈRE (22P02). 98 séances n'ont jamais été enregistrées, en silence.
  for (const a of acts) {
    const row = buildWorkoutRow(a, { userId: "u", type: "easy" });
    for (const col of INTEGER_COLUMNS) {
      const v = row[col];
      if (v == null) continue;
      assert.ok(Number.isInteger(v), `${col} = ${v} (non entier) sur l'activité ${a.start_date_local}`);
    }
  }
});
test("les noms de champs de l'API sont les bons", () => {
  // Bug réel : le code lisait `avg_stride_length` et `avg_vertical_oscillation`, qui
  // n'existent pas. Deux colonnes vides à 100 % pendant que le coach devait les analyser.
  const row = buildWorkoutRow(run, { userId: "u", type: "easy" });
  assert.ok(row.stride_length_m != null, "foulée non lue — nom de champ probablement faux");
  assert.ok(row.vertical_oscillation_cm != null, "oscillation non lue");
  assert.ok(row.avg_cadence_spm != null, "cadence non lue");
});
test("l'oscillation verticale est convertie en centimètres", () => {
  // L'API la donne en MILLIMÈTRES (88,6) ; la colonne est en centimètres.
  const row = buildWorkoutRow(run, { userId: "u", type: "easy" });
  assert.ok((row.vertical_oscillation_cm as number) < 20, `${row.vertical_oscillation_cm} cm : conversion manquante`);
});
test("la cadence est convertie en pas par minute", () => {
  // L'API donne des cycles (une jambe) ; un coureur tourne à ~160-190 pas/min.
  const row = buildWorkoutRow(run, { userId: "u", type: "easy" });
  assert.ok((row.avg_cadence_spm as number) > 150, `${row.avg_cadence_spm} spm : conversion manquante`);
});
test("le sport est enregistré et distingué du rôle de la séance", () => {
  assert.equal(buildWorkoutRow(run, { userId: "u", type: "easy" }).sport, "run");
  assert.equal(buildWorkoutRow(hike, { userId: "u", type: "trail" }).sport, "hike");
});
test("l'identifiant d'origine est conservé", () => {
  // Sans lui, une séance ne peut être reconnue que par (date, titre) — qui collisionne
  // dès qu'on court deux fois le même jour.
  assert.equal(buildWorkoutRow(run, { userId: "u", type: "easy" }).external_id, String(run.id));
});
test("les colonnes récentes sont omises si la migration est en retard", () => {
  // PostgREST rejette l'écriture ENTIÈRE pour une seule colonne inconnue (42703).
  const row = buildWorkoutRow(run, { userId: "u", type: "easy", hasNewCols: false });
  for (const c of ["sport", "external_id", "vertical_ratio_pct", "hrr_bpm"]) {
    assert.ok(!(c in row), `${c} présent alors que la migration n'est pas appliquée`);
  }
  assert.ok(row.duration_seconds != null, "le reste de la ligne doit rester écrivable");
});
test("une activité vide ne produit pas de valeur fabriquée", () => {
  const row = buildWorkoutRow({}, { userId: "u", type: "easy" });
  for (const [k, v] of Object.entries(row)) {
    assert.ok(!Number.isNaN(v as number), `${k} = NaN`);
    assert.notEqual(v, Infinity, `${k} = Infinity`);
  }
  assert.equal(row.distance_km, null);
});

console.log("\nSYNCHRONISATION — appariement des séances");
test("l'identifiant d'origine prime sur (date, titre)", () => {
  const match = makeMatcher([
    { id: "A", date: "2026-08-07", title: "Lille Course à pied", external_id: "i1" },
    { id: "B", date: "2026-08-07", title: "Lille Course à pied", external_id: null },
  ]);
  assert.equal(match({ id: "i1", date: "2026-08-07", title: "Lille Course à pied" }), "A");
});
test("une ligne ne peut être revendiquée qu'une seule fois", () => {
  // Bug réel : deux sorties le même jour portent le même titre automatique Garmin ;
  // la seconde écrasait la première au lieu de créer sa propre ligne.
  const match = makeMatcher([{ id: "A", date: "2026-08-07", title: "Le Touquet Course à pied", external_id: null }]);
  assert.equal(match({ id: "i1", date: "2026-08-07", title: "Le Touquet Course à pied" }), "A");
  assert.equal(match({ id: "i2", date: "2026-08-07", title: "Le Touquet Course à pied" }), undefined);
});
test("une activité inconnue n'est appariée à rien", () => {
  const match = makeMatcher([{ id: "A", date: "2026-08-01", title: "X", external_id: "i9" }]);
  assert.equal(match({ id: "i123", date: "2026-08-07", title: "Y" }), undefined);
});


// ─────────────────────────────────────────────────────────────────────────────
//  SÉCURITÉ — invariants vérifiés sur le CODE SOURCE, pas sur le comportement.
//  Une route d'administration sans garde ne lève aucune erreur : elle répond 200.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

console.log("\nSÉCURITÉ");
test("toute route d'administration est protégée", () => {
  // Constaté en production : POST /api/admin/migrate répondait 200 à une requête
  // ANONYME, avec un client service_role et du DDL en dur. Inoffensif seulement parce
  // que la fonction `exec_sql` n'existe pas — une protection par accident.
  const dir = "src/app/api/admin";
  if (!existsSync(dir)) return;
  const unguarded: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const f = join(dir, entry.name, "route.ts");
    if (!existsSync(f)) continue;
    const src = readFileSync(f, "utf8");
    // Deux mécanismes coexistent : en-tête secret (routes machine) et vérification de
    // l'adresse du compte connecté (routes appelées depuis le panneau admin).
    if (!/ADMIN_SECRET|x-admin-secret|ADMIN_EMAIL|is_admin|isAdmin/.test(src)) unguarded.push(entry.name);
  }
  assert.deepEqual(unguarded, [], `route(s) d'administration sans garde : ${unguarded.join(", ")}`);
});
test("le profil envoyé au navigateur ne contient jamais la clé intervals.icu", () => {
  const stripped = stripProfileSecrets({ id: "x", intervals_api_key: "SECRET", intervals_athlete_id: "i1" });
  assert.equal((stripped as Record<string, unknown>).intervals_api_key, undefined);
  assert.equal((stripped as Record<string, unknown>).intervals_athlete_id, "i1", "l'identifiant n'est pas secret, l'UI en a besoin");
});
test("aucune page du tableau de bord ne transmet le profil brut", () => {
  const pages = ["layout.tsx", "page.tsx", "settings/page.tsx", "ghost-runner/page.tsx", "profile/page.tsx"];
  for (const p of pages) {
    const f = join("src/app/dashboard", p);
    if (!existsSync(f)) continue;
    const src = readFileSync(f, "utf8");
    if (/from\("profiles"\)\.select\("\*"\)/.test(src)) {
      assert.ok(/stripProfileSecrets/.test(src), `${p} lit tout le profil sans le nettoyer`);
    }
  }
});

console.log("\nSÉCURITÉ — téléversement");
test("seuls images et PDF sont acceptés, d'après le CONTENU", () => {
  // Bug réel : le bucket est PUBLIC et le type MIME était repris tel quel du navigateur.
  // Un compte pouvait déposer un .html contenant du script en imposant « text/html ».
  const sniff = (b: Buffer): string | null => {
    if (b.length < 12) return null;
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
    if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (b.subarray(0, 6).toString("latin1").startsWith("GIF8")) return "image/gif";
    if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
    if (b.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
    return null;
  };
  const pad = (s: string) => Buffer.concat([Buffer.from(s, "latin1"), Buffer.alloc(16)]);
  assert.equal(sniff(pad("%PDF-1.7")), "application/pdf");
  assert.equal(sniff(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)])), "image/png");
  // Un fichier HTML, même nommé « photo.png » et déclaré « image/png », est refusé.
  assert.equal(sniff(pad("<html><script>alert(1)</script>")), null);
  assert.equal(sniff(pad("<svg onload=alert(1)>")), null);
});
test("le code de téléversement ne fait pas confiance au type déclaré", () => {
  const src = readFileSync("src/app/api/upload/route.ts", "utf8");
  assert.ok(!/contentType:\s*file\.type/.test(src), "le type MIME du navigateur ne doit jamais être réutilisé tel quel");
  assert.ok(/sniff/.test(src), "le type doit être déduit des premiers octets");
});
test("aucune route n'écrit dans les données d'un athlète sans preuve d'identité", () => {
  // Bug réel : /api/terra/webhook acceptait un `user_id` arbitraire et insérait des
  // séances et des données de VFC avec la clé service_role, sans signature ni secret —
  // et Terra n'était même pas intégré. N'importe qui pouvait polluer l'historique d'un
  // athlète, donc fausser toute l'analyse du coach.
  assert.equal(existsSync("src/app/api/terra"), false, "la route Terra non signée est de retour");
});

console.log("\nPAIEMENT");
test("le webhook refuse tout événement non signé", () => {
  const src = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
  assert.ok(/constructEvent/.test(src), "la signature Stripe doit être vérifiée");
  assert.ok(/STRIPE_WEBHOOK_SECRET/.test(src) && /503|400/.test(src),
    "sans secret configuré, le webhook doit REFUSER — l'accepter reviendrait à laisser n'importe qui offrir un abonnement");
  assert.ok(!/constructEvent\([^)]*!\)/.test(src), "le secret ne doit pas être forcé avec `!`");
});
test("l'abonnement n'est jamais accordé depuis le navigateur", () => {
  // Le niveau d'abonnement ne doit être écrit que par le webhook, côté serveur, après
  // vérification de signature. Une écriture depuis un composant client suffirait à
  // s'offrir le Pro gratuitement.
  for (const dir of ["src/components", "src/app/dashboard"]) {
    if (!existsSync(dir)) continue;
    const stack = [dir];
    while (stack.length) {
      const d = stack.pop()!;
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) { stack.push(p); continue; }
        if (!/\.tsx?$/.test(e.name)) continue;
        const src = readFileSync(p, "utf8");
        assert.ok(!/update\([\s\S]{0,80}subscription_tier/.test(src), `${p} écrit subscription_tier`);
      }
    }
  }
});
test("le paiement se refuse proprement quand il n'est pas configuré", () => {
  const src = readFileSync("src/app/api/stripe/checkout/route.ts", "utf8");
  assert.ok(/stripeConfigured/.test(src), "un clic sur « Passe au Pro » ne doit pas finir en erreur 500 opaque");
  assert.ok(/plan !== "monthly"/.test(src), "la formule reçue du client doit être validée");
});
test("l'athlète peut résilier son abonnement", () => {
  // Obligation légale en Europe dès lors que la souscription s'est faite en ligne — et
  // premier motif de litige bancaire quand elle manque.
  assert.ok(existsSync("src/app/api/stripe/portal/route.ts"), "aucun portail de gestion d'abonnement");
});

console.log("\nINTÉGRITÉ COMMERCIALE");
test("le catalogue simulé est signalé comme tel à l'écran", () => {
  // Bug réel : la boutique affichait des prix INVENTÉS attribués à de vraies enseignes
  // (i-Run, Alltricks, Lepape, Ekosport, Décathlon) avec leurs vraies adresses, sans
  // aucune mention visible. Le seul mot « simulé » vivait dans un commentaire de code.
  const src = readFileSync("src/components/shop/ShoppingHub.tsx", "utf8");
  assert.ok(/demo\.title/.test(src) && /demo\.body/.test(src), "aucun avertissement de démonstration rendu à l'écran");
  for (const lang of ["Catalogue de démonstration", "Demo catalogue", "Demo-Katalog", "Catálogo de demostración", "Catálogo de demonstração"]) {
    assert.ok(src.includes(lang), `avertissement manquant en une langue : ${lang}`);
  }
});
test("les services externes gratuits ne sont pas ouverts aux anonymes", () => {
  // Overpass et le géocodage sont des services communautaires à quotas stricts : une
  // route ouverte, c'est l'adresse IP de l'application bannie pour TOUS les utilisateurs.
  for (const f of ["src/app/api/parcours/geometry/route.ts", "src/app/api/races/geocode/route.ts"]) {
    if (!existsSync(f)) continue;
    assert.ok(/denyIfAnonymous|auth\.getUser/.test(readFileSync(f, "utf8")), `${f} est ouvert aux requêtes anonymes`);
  }
});

console.log("\nBOUTIQUE — vraies offres ou rien");
test("aucun catalogue fabriqué n'est rendu sans offres réelles", () => {
  // Décision assumée : un avertissement sur des prix inventés est un pansement. La
  // boutique n'apparaît QUE si `product_offers` contient de vraies offres importées
  // depuis un flux marchand officiel.
  const page = readFileSync("src/app/dashboard/shop/page.tsx", "utf8");
  assert.ok(/product_offers/.test(page), "la page ne vérifie pas la présence d'offres réelles");
  assert.ok(/ShopComingSoon/.test(page), "aucun écran d'attente en l'absence d'offres");
  assert.ok(existsSync("src/components/shop/ShopComingSoon.tsx"));
});
test("l'importateur de flux reste protégé et ne scrape rien", () => {
  const src = readFileSync("src/app/api/shop/import-feed/route.ts", "utf8");
  assert.ok(/CRON_SECRET|ADMIN_SECRET/.test(src), "l'import de flux doit exiger un secret");
  assert.ok(/searchParams\.get\("url"\)/.test(src), "le flux doit être fourni explicitement, jamais deviné");
});

// ─────────────────────────────────────────────────────────────────────────────
//  MODE PERTE DE POIDS
//
//  Ce module produit des nombres qui RESSEMBLENT à des mesures (« 1 950 kcal/jour »,
//  « −0,4 kg/semaine ») alors qu'une partie vient d'équations de population. C'est le
//  profil exact des défauts silencieux de l'audit : rien ne plante, le chiffre est
//  plausible, et il oriente pourtant l'alimentation de quelqu'un pendant des mois.
//  Chaque test ci-dessous fige soit un refus de fabriquer, soit un garde-fou de sécurité.
// ─────────────────────────────────────────────────────────────────────────────
const DAY = 86400000;
const NOW = new Date("2026-08-07T09:00:00Z").getTime();
const isoDay = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString().slice(0, 10);

console.log("\nPERTE DE POIDS — une donnée manquante ne devient jamais une valeur par défaut");
test("pas de taille → pas d'IMC (et non un IMC calculé sur une taille moyenne)", () => {
  assert.equal(bmiOf(95, null), null);
  assert.equal(bmiOf(null, 178), null);
  assert.equal(bmiOf(95, 178), 30.0);
});
test("pas d'âge → pas de métabolisme de base", () => {
  // Supposer 40 ans à quelqu'un qui en a 62 décale la cible d'environ 110 kcal/jour,
  // soit près de 6 kg d'erreur cumulée sur un an — totalement invisible à l'écran.
  assert.equal(bmrMifflin({ weightKg: 95, heightCm: 178, age: null, gender: "male" }), null);
  assert.equal(bmrMifflin({ weightKg: null, heightCm: 178, age: 40, gender: "male" }), null);
});
test("le métabolisme de base suit bien Mifflin-St Jeor", () => {
  // 10×95 + 6,25×178 − 5×40 + 5 = 1 867,5 → 1868
  assert.equal(bmrMifflin({ weightKg: 95, heightCm: 178, age: 40, gender: "male" })!.kcal, 1868);
  // Femme : même corps, constante −161 au lieu de +5 → 166 kcal d'écart.
  assert.equal(bmrMifflin({ weightKg: 95, heightCm: 178, age: 40, gender: "female" })!.kcal, 1702);
});
test("sexe non précisé → moyenne des deux équations, mais l'écart est ANNONCÉ", () => {
  const r = bmrMifflin({ weightKg: 95, heightCm: 178, age: 40, gender: "other" })!;
  assert.equal(r.kcal, 1785); // milieu exact entre 1868 et 1702
  assert.ok(r.assumptions.length > 0, "l'approximation doit être déclarée, pas masquée");
});

console.log("\nPERTE DE POIDS — la dépense des séances vient des données réelles");
test("une séance sans durée NI distance n'est pas chiffrée", () => {
  // Le repli tentant serait « une séance ≈ 400 kcal ». Une semaine de séances mal
  // importées gonflerait alors la dépense de 2 000 kcal et autoriserait un déficit
  // qui n'existe pas.
  assert.equal(workoutKcal({ date: isoDay(1) }, 95), null);
  assert.equal(workoutKcal({ date: isoDay(1), distance_km: 10 }, null), null);
});
test("le dénivelé compte : monter 1 200 m n'est pas une sortie plate", () => {
  const plat = workoutKcal({ date: isoDay(1), sport: "run", distance_km: 20 }, 95)!;
  const trail = workoutKcal({ date: isoDay(1), sport: "run", distance_km: 20, elevation_gain_m: 1200 }, 95)!;
  assert.ok(trail > plat + 800, `le D+ doit ajouter ~1 000 kcal (plat ${plat}, trail ${trail})`);
});
test("la marche coûte moins cher au kilomètre que la course", () => {
  const run = workoutKcal({ date: isoDay(1), sport: "Run", distance_km: 10 }, 95)!;
  const walk = workoutKcal({ date: isoDay(1), sport: "Hike", distance_km: 10 }, 95)!;
  assert.ok(walk < run, "randonnée et course ne peuvent pas coûter pareil");
});

console.log("\nPERTE DE POIDS — pas de tendance inventée à partir de bruit");
test("moins de 4 pesées → aucune tendance", () => {
  // Deux pesées à 3 jours d'écart, c'est de l'hydratation (±1 à 2 kg), pas de la graisse.
  // Afficher « −1,3 kg/semaine » là-dessus, c'est présenter du bruit comme un résultat.
  assert.equal(weightTrend([{ date: isoDay(3), weight_kg: 94 }, { date: isoDay(0), weight_kg: 92.7 }], 42, NOW), null);
});
test("4 pesées sur moins de 14 jours → toujours aucune tendance", () => {
  const logs = [0, 2, 4, 6].map((d) => ({ date: isoDay(d), weight_kg: 95 - d * 0.1 }));
  assert.equal(weightTrend(logs, 42, NOW), null);
});
test("assez de pesées → la pente mesurée est juste", () => {
  // Série strictement linéaire : −0,1 kg/jour = −0,7 kg/semaine.
  const logs = [0, 7, 14, 21, 28].map((d) => ({ date: isoDay(d), weight_kg: 95 - (28 - d) * 0.1 }));
  const t = weightTrend(logs, 42, NOW)!;
  assert.ok(Math.abs(t.ratePerWeek - -0.7) < 0.05, `pente ${t.ratePerWeek} attendue ≈ −0,7`);
  assert.equal(t.points, 5);
  assert.ok(t.spanDays >= 28);
});
test("des pesées abandonnées depuis un mois ne font plus une tendance « actuelle »", () => {
  // Série impeccable… mais qui s'arrête il y a 35 jours. Sans garde-fou, l'écran
  // affichait toujours « −0,5 kg/semaine » au présent, et le poids périmé pilotait
  // en plus la cible calorique du jour.
  const logs = [35, 42, 49, 56].map((d) => ({ date: isoDay(d), weight_kg: 100 - (56 - d) * 0.07 }));
  assert.equal(weightTrend(logs, 90, NOW), null);
});
test("sans tendance mesurable, le verdict le DIT au lieu d'afficher 0", () => {
  const plan = buildWeightPlan({
    body: { weightKg: 110, heightCm: 175, age: 40, gender: "male" },
    goalKg: 85, logs: [], workouts: [], now: NOW,
  })!;
  const v = trendVerdict(plan);
  assert.equal(v.status, "insuffisant");
  assert.ok(/pas encore assez de pesées/i.test(v.message));
  assert.equal(plan.measured, null, "aucune tendance ne doit être fabriquée");
});

console.log("\nPERTE DE POIDS — les garde-fous de sécurité ne sont pas contournables");
test("IMC sous 20 → mode refusé, avec une explication", () => {
  const el = weightModeEligibility({ weightKg: 58, heightCm: 178, age: 30, gender: "male" }, []);
  assert.equal(el.ok, false);
  assert.equal(el.ok === false && el.reason, "imc_bas");
});
test("mineur → mode refusé", () => {
  const el = weightModeEligibility({ weightKg: 90, heightCm: 175, age: 16, gender: "female" }, []);
  assert.equal(el.ok === false && el.reason, "mineur");
});
test("grossesse déclarée → mode refusé, quelle que soit la corpulence", () => {
  const el = weightModeEligibility({ weightKg: 95, heightCm: 168, age: 32, gender: "female" }, ["grossesse"]);
  assert.equal(el.ok === false && el.reason, "grossesse");
});
test("la cible calorique ne descend JAMAIS sous le métabolisme de base", () => {
  // Sous le métabolisme de base, le corps rogne sur la masse maigre : un coureur en
  // déficit sévère se blesse au lieu de progresser (faible disponibilité énergétique).
  for (const body of [
    { weightKg: 110, heightCm: 175, age: 40, gender: "male" },
    { weightKg: 140, heightCm: 165, age: 55, gender: "female" },
    { weightKg: 82, heightCm: 180, age: 25, gender: "male" },
  ]) {
    const plan = buildWeightPlan({ body, goalKg: null, logs: [], workouts: [], now: NOW })!;
    assert.ok(plan.targetKcal >= plan.bmr, `cible ${plan.targetKcal} < métabolisme de base ${plan.bmr}`);
    assert.ok(plan.targetKcal >= (body.gender === "female" ? 1200 : 1500), `cible ${plan.targetKcal} sous le plancher absolu`);
  }
});
test("le mode SAIT S'ARRÊTER : aucun déficit sous IMC 21", () => {
  // Défaut réel, relevé sur un compte de production. Le refus d'activation se joue à
  // IMC 20, mais une fois le mode actif plus RIEN ne bornait la descente : un coureur de
  // 20 ans, 70 kg pour 1,85 m (IMC 20,5), recevait 440 kcal/jour de déficit et −0,4
  // kg/semaine — soit un passage sous IMC 19 en sept semaines, très en dessous du seuil
  // qui aurait refusé l'activation. Le garde-fou d'entrée ne servait à rien une fois la
  // porte franchie.
  const plan = buildWeightPlan({
    body: { weightKg: 70, heightCm: 185, age: 20, gender: "male" },
    goalKg: null, logs: [], workouts: [], now: NOW,
  })!;
  assert.equal(plan.deficitKcal, 0, `déficit de ${plan.deficitKcal} kcal à IMC ${plan.bmi}`);
  assert.equal(plan.plannedRatePerWeek, 0, "aucune perte ne doit être projetée");
  assert.equal(plan.targetKcal, plan.tdee, "la cible doit être le maintien");
  assert.ok(plan.capCodes.some((c) => c.code === "maintien_imc_bas"), "le passage en maintien doit être expliqué");
});
test("suivi seul : dépense et protéines SANS déficit", () => {
  // Tout était derrière un unique interrupteur « perte de poids ». Un coureur mince qui
  // voulait juste suivre son poids devait donc activer un mode de PERTE ; et le désactiver
  // lui retirait la pesée, la tendance et sa cible protéines — ce qui compte le plus en
  // préparation. Le suivi ne doit dépendre d'aucune activation.
  const body = { weightKg: 95, heightCm: 178, age: 40, gender: "male" };
  const suivi = buildWeightPlan({ body, goalKg: 80, logs: [], workouts: [], now: NOW, applyDeficit: false })!;
  assert.equal(suivi.deficitKcal, 0, "aucun déficit en suivi seul");
  assert.equal(suivi.targetKcal, suivi.tdee, "la cible doit être le maintien");
  assert.equal(suivi.weeksToGoal, null, "aucune échéance ne doit être projetée sans déficit");
  // …mais tout le reste RESTE calculé : c'est l'intérêt du suivi.
  assert.ok(suivi.bmr > 0 && suivi.tdee > 0 && suivi.proteinG > 0, "la dépense et les protéines doivent rester disponibles");
  assert.ok(suivi.capCodes.some((c) => c.code === "suivi_seul"), "l'absence de déficit doit être expliquée");
});
test("un déficit nul ne s'affiche pas « −0 kcal »", () => {
  // Le signe moins était codé en dur dans le gabarit de la ligne : à IMC 20,5, où le
  // déficit est volontairement nul, l'écran affichait « Déficit −0 kcal ».
  const src = readFileSync("src/components/health/WeightMode.tsx", "utf8");
  assert.ok(/deficitOn && plan\.deficitKcal > 0 &&/.test(src), "la ligne Déficit doit disparaître quand il est nul");
});
test("au-dessus d'IMC 21, le déficit reprend normalement", () => {
  // Garde-fou du garde-fou : le plancher ne doit pas neutraliser le mode pour ceux à qui
  // il est destiné.
  const plan = buildWeightPlan({
    body: { weightKg: 95, heightCm: 178, age: 40, gender: "male" },
    goalKg: 80, logs: [], workouts: [], now: NOW,
  })!;
  assert.ok(plan.deficitKcal > 200, `déficit ${plan.deficitKcal} kcal à IMC ${plan.bmi} — le mode doit fonctionner`);
});
test("la perte prévue ne dépasse jamais 0,75 %/semaine du poids", () => {
  const plan = buildWeightPlan({
    body: { weightKg: 140, heightCm: 170, age: 35, gender: "male" },
    goalKg: 90, logs: [], workouts: [], now: NOW,
  })!;
  assert.ok(Math.abs(plan.plannedRatePerWeek) <= 140 * 0.0075 + 0.01, `${plan.plannedRatePerWeek} kg/sem est trop rapide`);
  assert.ok(plan.caps.length > 0, "un plafond appliqué doit être expliqué à l'utilisateur");
});
test("les hypothèses non mesurées sont toujours renvoyées pour affichage", () => {
  const plan = buildWeightPlan({
    body: { weightKg: 100, heightCm: 180, age: 45, gender: "male" },
    goalKg: 85, logs: [], workouts: [], now: NOW,
  })!;
  // Le facteur d'activité hors sport ne se mesure pas : il DOIT être annoncé.
  assert.ok(plan.assumptions.some((a) => /vie courante/i.test(a)));
  assert.ok(plan.assumptions.some((a) => /séance/i.test(a)));
});
test("une échéance annoncée dit sur QUOI elle est fondée", () => {
  const logs = [0, 7, 14, 21, 28].map((d) => ({ date: isoDay(d), weight_kg: 100 - (28 - d) * 0.08 }));
  const mesure = buildWeightPlan({ body: { weightKg: 100, heightCm: 180, age: 45, gender: "male" }, goalKg: 85, logs, workouts: [], now: NOW })!;
  assert.equal(mesure.weeksToGoalBasis, "mesure", "une perte réelle prime sur la projection théorique");
  const theorie = buildWeightPlan({ body: { weightKg: 100, heightCm: 180, age: 45, gender: "male" }, goalKg: 85, logs: [], workouts: [], now: NOW })!;
  assert.equal(theorie.weeksToGoalBasis, "theorique");
});
test("le poids lissé des pesées prime sur la valeur figée du profil", () => {
  // `profiles.weight_kg` est souvent saisi une fois à l'inscription puis jamais retouché.
  const logs = [0, 7, 14, 21, 28].map((d) => ({ date: isoDay(d), weight_kg: 92 }));
  const plan = buildWeightPlan({ body: { weightKg: 110, heightCm: 178, age: 40, gender: "male" }, goalKg: null, logs, workouts: [], now: NOW })!;
  assert.equal(plan.currentSource, "pesees");
  assert.ok(Math.abs(plan.currentKg - 92) < 0.2, `poids retenu ${plan.currentKg}, attendu ~92`);
});

console.log("\nPERTE DE POIDS — l'entraînement change vraiment, pas seulement l'affichage");
test("plus l'IMC est haut, plus la qualité et la progression sont bridées", () => {
  const mk = (w: number, h: number) => weightTrainingRules(buildWeightPlan({
    body: { weightKg: w, heightCm: h, age: 40, gender: "male" }, goalKg: null, logs: [], workouts: [], now: NOW })!);
  const obese2 = mk(120, 175);   // IMC 39,2
  const surpoids = mk(85, 175);  // IMC 27,8
  assert.equal(obese2.maxQualityPerWeek, 0, "aucun fractionné tant que la base n'est pas là");
  assert.ok(obese2.walkRunAdvised, "l'alternance course/marche est la porte d'entrée");
  assert.ok(obese2.lowImpactSharePct > surpoids.lowImpactSharePct);
  assert.ok(obese2.maxWeeklyProgressPct <= surpoids.maxWeeklyProgressPct);
  assert.ok(surpoids.strengthPerWeek >= 2, "le renforcement protège le muscle pendant le déficit");
});
test("le plafond de qualité du mode est appliqué APRÈS les planchers du coach", () => {
  // Sans cet ordre, le plancher « objectif chrono → 2 qualités » redonnait deux séances
  // de fractionné par semaine à quelqu'un dont les articulations encaissent près de
  // 300 kg par appui. Le cardio suivait ; les tendons, non.
  const src = readFileSync("src/lib/ai/coachContext.ts", "utf8");
  const iFloor = src.indexOf("qBudget === 0 && libLevel !== \"debutant\") floor(1)");
  const iCap = src.indexOf("weightLoss.rules.maxQualityPerWeek");
  assert.ok(iFloor > 0 && iCap > 0, "plancher ou plafond introuvable");
  assert.ok(iCap > iFloor, "le plafond perte de poids doit venir après les planchers");
});
test("le coach reçoit des consignes, pas un simple constat de poids", () => {
  const plan = buildWeightPlan({
    body: { weightKg: 115, heightCm: 175, age: 42, gender: "male" },
    goalKg: 90, logs: [], workouts: [], now: NOW,
  })!;
  const block = weightCoachBlock(plan);
  // Le piège n°1 du coureur en déficit : sous-alimenter la séance de qualité.
  assert.ok(/JAMAIS autour d'une séance de qualité/.test(block), "la règle de non-restriction autour des séances dures manque");
  // Cadre du discours — repris et durci depuis la consigne « surpoids » du catalogue santé.
  assert.ok(/JAMAIS esthétique/.test(block), "le cadre de discours manque");
  assert.ok(/N'ES PAS DIÉTÉTICIEN/.test(block), "la limite de compétence doit être explicite");
  // Signaux de déficit trop agressif : c'est ce qui distingue un coach d'un compteur.
  assert.ok(/REMONTER l'apport/.test(block));
});
test("mode désactivé ou profil non éligible → RIEN dans le prompt du coach", () => {
  // Le coach ne parle jamais de poids de sa propre initiative : c'est un sujet qui
  // appartient à l'athlète, pas à l'application.
  const src = readFileSync("src/lib/ai/coachContext.ts", "utf8");
  assert.ok(/if \(!p\?\.weight_mode_enabled\) return null;/.test(src), "l'activation volontaire doit conditionner le bloc");
  assert.ok(/weightModeEligibility\(body, p\?\.health_conditions\)\.ok\) return null;/.test(src), "les garde-fous doivent être revérifiés côté coach");
});
test("un poids cible sous IMC 20 est refusé, comme l'est l'activation à IMC 20", () => {
  // Sans cette symétrie, l'app refusait le mode à quelqu'un déjà mince mais acceptait
  // de projeter quelqu'un VERS cette corpulence — échéance affichée à l'appui.
  const src = readFileSync("src/app/api/weight/route.ts", "utf8");
  assert.ok(/20 \* \(h \/ 100\) \*\* 2/.test(src), "aucun plancher d'IMC sur le poids cible");
});
test("la route /api/weight revérifie l'éligibilité côté serveur", () => {
  // Masquer un bouton dans l'interface n'empêche personne d'appeler la route.
  const src = readFileSync("src/app/api/weight/route.ts", "utf8");
  assert.ok(/weightModeEligibility/.test(src), "activation sans revérification serveur");
  assert.ok(!/from\("profiles"\)\.select\("\*"\)/.test(src), "le profil complet ne doit jamais être lu ici (secrets)");
  assert.ok(/createClient/.test(src) && !/createAdminClient/.test(src), "les lectures doivent passer par la RLS, pas par la clé de service");
});

// ─────────────────────────────────────────────────────────────────────────────
//  VOLUME DE RÉFÉRENCE & SORTIE LONGUE
//
//  Défaut réel du 07/08/2026, relevé sur un compte de production. Un athlète rentre de
//  24 jours sans courir, enchaîne 62 km en une semaine dont une sortie de 26 km, et
//  bascule son objectif sur un marathon à 11 semaines. Le plan produit : 35 km/semaine,
//  sortie longue 9 km, pic de préparation à 49 km avec 12 km de plus longue sortie —
//  28 % de la distance de course. Aucune erreur, aucun écran ne signalait quoi que ce
//  soit. La cause : « moyenne 4 semaines » = 23 km (la coupure écrasait la référence),
//  et sortie longue = 25 % du volume, un plafond pris pour une prescription.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nVOLUME — une coupure n'est pas un niveau");
test("la médiane ignore les semaines de coupure ET le pic de reprise", () => {
  // Semaines (de la plus récente à la plus ancienne) : 62, 31, 0, 0, 0, 37, 40, 38.
  const runs = [
    ...[1, 3, 5].map((d) => ({ date: isoDay(d), distance_km: 62 / 3 })),
    ...[8, 10, 12].map((d) => ({ date: isoDay(d), distance_km: 31 / 3 })),
    ...[36, 38, 40].map((d) => ({ date: isoDay(d), distance_km: 37 / 3 })),
    ...[43, 45, 47].map((d) => ({ date: isoDay(d), distance_km: 40 / 3 })),
    ...[50, 52, 54].map((d) => ({ date: isoDay(d), distance_km: 38 / 3 })),
  ];
  const r = robustWeeklyKm(runs, NOW, 8)!;
  assert.equal(r.weeksOff, 3, "les 3 semaines sans course doivent être comptées comme coupure");
  // Moyenne brute sur 28 j = 23 km : un chiffre qui ne décrit AUCUNE de ses semaines.
  assert.ok(r.km >= 35 && r.km <= 45, `médiane ${r.km} km — attendue entre 35 et 45, jamais 23 ni 62`);
});
test("moins de 3 semaines courues → aucune médiane, on garde l'ancien calcul", () => {
  // Deux points ne décrivent pas un niveau d'entraînement : on refuse d'en déduire un.
  const runs = [{ date: isoDay(2), distance_km: 40 }, { date: isoDay(9), distance_km: 35 }];
  assert.equal(robustWeeklyKm(runs, NOW, 8), null);
});
test("une semaine à 1 km ne compte pas comme une semaine d'entraînement", () => {
  const runs = [
    { date: isoDay(2), distance_km: 40 }, { date: isoDay(9), distance_km: 38 },
    { date: isoDay(16), distance_km: 1 }, { date: isoDay(23), distance_km: 42 },
  ];
  const r = robustWeeklyKm(runs, NOW, 8)!;
  assert.equal(r.weeksRun, 3, "la semaine à 1 km doit être écartée");
  assert.equal(r.km, 40);
});

test("un passé à 80 km/semaine n'est pas effacé par 8 semaines creuses", () => {
  // Défaut réel : athlète de 20 ans tournant à 71-80 km/sem quatre mois plus tôt, décrit
  // comme un coureur à 31 km/sem parce que le coach ne chargeait que 60 séances (~12 sem.).
  // Son plan marathon plafonnait à 56 km/sem alors qu'il avait déjà tenu 77.
  const recent = [0, 1, 5, 6, 7].flatMap((w) => [0, 2, 4].map((d) => ({ date: isoDay(w * 7 + d), distance_km: 10 })));
  const past = [16, 17, 19, 20, 21, 26].flatMap((w) => [0, 2, 4, 6].map((d) => ({ date: isoDay(w * 7 + d), distance_km: 19 })));
  const runs = [...recent, ...past];
  // Sur 8 semaines, seules les semaines récentes existent : la fonction répond, mais bas.
  const court = demonstratedWeeklyKm(runs, NOW, 8)!;
  assert.ok(court < 40, `fenêtre courte : ${court} km — le passé à 76 km doit être invisible`);
  // Sur 26 semaines, la capacité réellement démontrée ressort.
  const demo = demonstratedWeeklyKm(runs, NOW, 26)!;
  assert.ok(demo >= 70, `capacité démontrée ${demo} km — les semaines à 76 km doivent ressortir`);
});
test("une seule grosse semaine ne « démontre » aucune capacité", () => {
  // Quatre semaines sont exigées : un exploit isolé n'est pas un niveau tenu.
  const runs = [
    ...[0, 2, 4].map((d) => ({ date: isoDay(d), distance_km: 30 })),
    ...[10, 12].map((d) => ({ date: isoDay(d), distance_km: 5 })),
  ];
  assert.equal(demonstratedWeeklyKm(runs, NOW, 26), null);
});

console.log("\nSORTIE LONGUE — le plafond de Daniels n'est pas une prescription");
test("le pic de sortie longue dépend de la distance visée", () => {
  assert.equal(longRunPeakKm("marathon", 42.2), 32);   // ~75 %, plafonné à 32
  assert.equal(longRunPeakKm("semi", 21.1), 19);       // ~90 %
  assert.equal(longRunPeakKm("10k", 10), 15);          // on court PLUS long que la course
  assert.equal(longRunPeakKm("ultra", 100), 40);       // jamais la distance : plafond 40
  assert.equal(longRunPeakKm("general", null), null);  // sans course, aucun pic imposé
});
test("on ne prescrit JAMAIS moins long que ce que l'athlète court déjà", () => {
  // Le défaut d'origine : 9 km prescrits deux jours après une sortie de 26 km.
  const lr = longRunForWeek({ weekIndex: 0, weeksToPeak: 8, current: 26, peak: 32, weeklyKm: 44, share: 0.35, taper: false });
  assert.ok(lr >= 26, `${lr} km prescrits alors qu'il en court déjà 26`);
});
test("la montée vers le pic reste bornée à +2 km/semaine", () => {
  let prev = 10;
  for (let i = 0; i < 8; i++) {
    const lr = longRunForWeek({ weekIndex: i, weeksToPeak: 8, current: 10, peak: 32, weeklyKm: 70, share: 0.35, taper: false });
    assert.ok(lr - prev <= 2.5, `bond de ${prev} à ${lr} km en une semaine`);
    prev = lr;
  }
});
test("la sortie longue ne dépasse jamais la moitié du volume hebdomadaire", () => {
  // Un débutant à 25 km/semaine ne doit PAS se voir prescrire 30 km parce que le
  // marathon l'exigerait : c'est la blessure assurée, pas une préparation.
  const lr = longRunForWeek({ weekIndex: 10, weeksToPeak: 10, current: 8, peak: 32, weeklyKm: 25, share: 0.35, taper: false });
  assert.ok(lr <= 13, `${lr} km pour 25 km/semaine — au-delà de la moitié du volume`);
});
test("quand la préparation ne suffit pas pour la distance, on le DIT", () => {
  // C'est le cœur du correctif : plafonner en silence reviendrait à remplacer un
  // mauvais chiffre par un autre. Le plan doit avouer qu'il ne prépare pas la course.
  const gap = longRunGap(12, 32, 42.2);
  assert.ok(gap && /PRÉPARATION INSUFFISANTE/.test(gap), "aucun avertissement sur une prépa marathon plafonnée à 12 km");
  // Distance mise en forme en français : ce message s'AFFICHE, il ne part plus seulement
  // au prompt de l'IA. « 42.2 km » au milieu d'une phrase française trahissait la sortie
  // brute d'un calcul.
  assert.ok(gap!.includes("42,2"), `distance non formatée en français : ${gap}`);
  assert.ok(gap!.includes("32"));
  // À l'inverse, une prépa qui atteint 28 km sur 32 visés est acceptable : pas d'alarme.
  assert.equal(longRunGap(28, 32, 42.2), null);
  assert.equal(longRunGap(10, null, null), null, "sans objectif, aucun avertissement");
});
test("le feu rouge de fraîcheur raccourcit la sortie longue, et l'explique", () => {
  // Le rouge ne retirait que le bloc d'allure DANS la sortie longue, jamais sa distance.
  // Inoffensif tant qu'elle valait 25 % du volume (9 km) ; plus du tout depuis qu'elle se
  // déduit de la distance visée : 26 km prescrits le dimanche à un athlète en ratio
  // aigu:chronique 2,4 et TSB −44, deux jours après une sortie de 26 km.
  const c = ctx({
    readiness: { level: "rouge", reasons: ["ratio aigu:chronique 2,4 (zone de risque de blessure)"], advice: "" },
    volume: { weekKm: 62, avg4wkKm: 40, targetKm: 40, longRunKm: 16, longRunPlanned: 26, longRunEased: true },
    weekPlan: { qBudget: 0, quality: [], easyPace: "4'52", eased: true },
  });
  const long = buildWeekPlan(c).find((d) => d.type === "Sortie longue");
  assert.ok(long, "aucune sortie longue dans le plan");
  assert.ok(/RACCOURCIE/.test(long!.why), "la réduction doit être expliquée, pas subie en silence");
  assert.ok(/26 km prévus/.test(long!.why), "le chiffre initial doit être rappelé");
  assert.ok(/ratio aigu:chronique/.test(long!.why), "le motif réel doit être cité");
});
test("l'affûtage coupe la sortie longue au lieu de la faire monter", () => {
  const lr = longRunForWeek({ weekIndex: 10, weeksToPeak: 8, current: 30, peak: 32, weeklyKm: 25, share: 0.35, taper: true });
  assert.ok(lr <= 6, `${lr} km en semaine d'affûtage — la fraîcheur prime`);
});

// ─────────────────────────────────────────────────────────────────────────────
//  PHOTOS ENVOYÉES AU KINÉ IA
//
//  Une image invite le modèle à affirmer plus que ce qu'elle montre : c'est le risque
//  principal, pas l'erreur de lecture. Et une photo de blessure est une donnée de santé —
//  ce qui n'est jamais écrit ne peut jamais fuiter.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nPHOTOS KINÉ — le type vient des octets, jamais de ce qu'on déclare");
const bytesOf = (...n: number[]) => Uint8Array.from([...n, ...new Array(16).fill(0)]);
test("les signatures réelles sont reconnues", () => {
  assert.equal(sniffType(bytesOf(0xff, 0xd8, 0xff)), "image/jpeg");
  assert.equal(sniffType(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "image/png");
  assert.equal(sniffType(Uint8Array.from([...Buffer.from("RIFF0000WEBP"), ...new Array(8).fill(0)])), "image/webp");
  assert.equal(sniffType(Uint8Array.from([...Buffer.from("%PDF-1.7"), ...new Array(8).fill(0)])), "application/pdf");
});
test("un fichier HTML déguisé en image est refusé", () => {
  // L'extension et l'en-tête Content-Type sont sous le contrôle de l'appelant ; les
  // octets, non. C'est ce contrôle qui a fermé le téléversement de fichiers arbitraires.
  const html = Uint8Array.from(Buffer.from("<html><script>alert(1)</script>"));
  assert.equal(sniffType(html), null);
  assert.equal(sniffImage(html), null);
});
test("le kiné accepte des images mais JAMAIS un PDF", () => {
  // Gemini lit les PDF : sans ce filtre, on relaierait un document arbitraire au modèle.
  const pdf = Uint8Array.from([...Buffer.from("%PDF-1.7"), ...new Array(8).fill(0)]);
  assert.equal(sniffType(pdf), "application/pdf");
  assert.equal(sniffImage(pdf), null, "le PDF ne doit pas passer par le chat kiné");
  assert.equal(sniffImage(bytesOf(0xff, 0xd8, 0xff)), "image/jpeg");
});
test("un fichier tronqué ne passe pas", () => {
  assert.equal(sniffType(Uint8Array.from([0xff, 0xd8])), null);
});

console.log("\nPHOTOS KINÉ — rien n'est stocké, et le modèle est cadré");
test("la photo ne touche aucun stockage", () => {
  // Une photo de cheville gonflée dans un bucket PUBLIC (ce que fait /api/upload) resterait
  // accessible à vie sans authentification. Ne rien garder règle accès ET rétention.
  //
  // Les COMMENTAIRES sont retirés avant l'analyse : la première version de ce test
  // échouait sur le commentaire qui explique justement pourquoi on ne stocke rien — il y
  // cite « /api/upload » et « getPublicUrl ». Un test qui lit la prose et pas le code se
  // déclenche sur des mots, pas sur des faits.
  const code = readFileSync("src/app/api/ai/physio/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  assert.ok(!/storage|getPublicUrl|createAdminClient/.test(code), "la route kiné ne doit rien écrire ni publier");
  // La route enregistre bien UNE chose : le signalement de douleur (zone + intensité),
  // fonctionnalité antérieure qui fait remonter la douleur jusqu'au coach. On vérifie donc
  // le CONTENU des écritures, pas leur existence — interdire tout `insert` aurait fait
  // échouer le test sur une écriture parfaitement légitime.
  const payloads = [...code.matchAll(/\.(insert|upsert)\(([\s\S]{0,400}?)\)/g)].map((m) => m[2]);
  assert.ok(payloads.length > 0, "le signalement de douleur doit toujours être enregistré");
  for (const pl of payloads) {
    assert.ok(!/photo|b64|imagePart|inline_data|base64/i.test(pl), `une écriture embarque la photo : ${pl.slice(0, 60)}`);
  }
  assert.ok(/inline_data/.test(code), "la photo doit partir en inline_data, pas par une URL");
});
test("le modèle reçoit les limites de ce qu'une photo permet", () => {
  const src = readFileSync("src/app/api/ai/physio/route.ts", "utf8");
  assert.ok(/CE QU'UNE PHOTO NE PERMET PAS/.test(src), "sans ce cadre, une image rend le modèle affirmatif à tort");
  // La phlébite est le drapeau rouge qui compte ici : un mollet gonflé d'un seul côté
  // ressemble à une contracture et se rééduque… jusqu'à l'embolie pulmonaire.
  assert.ok(/PHLÉBITE/.test(src), "le drapeau rouge vasculaire doit être explicite");
  assert.ok(/floue|trop sombre/.test(src), "une image inexploitable doit être signalée, pas interprétée");
});
test("un refus du filtre de sécurité ne se déguise pas en surcharge", () => {
  // Gemini refuse souvent les images corporelles et renvoie du VIDE. Sans ce cas,
  // l'utilisateur lisait « le kiné est très sollicité » et réessayait sans fin.
  const src = readFileSync("src/app/api/ai/physio/route.ts", "utf8");
  assert.ok(/filtre de sécurité sur les images corporelles/.test(src));
  assert.ok(/status: 422/.test(src), "le refus doit être distinct du 503 de saturation");
});
test("la photo est redimensionnée côté client, EXIF compris", () => {
  // 3 à 8 Mo par photo de téléphone, et des coordonnées GPS dans les métadonnées d'une
  // image de santé. Le passage par canvas règle les deux.
  const src = readFileSync("src/components/health/HealthCenter.tsx", "utf8");
  assert.ok(/createElement\("canvas"\)/.test(src), "aucun redimensionnement avant envoi");
  assert.ok(/EXIF/.test(src), "la suppression des métadonnées doit être documentée, pas accidentelle");
});

// ─────────────────────────────────────────────────────────────────────────────
//  ASSISTANT DE SUPPORT
//
//  Le risque n'est pas la panne : c'est la réponse fluide et FAUSSE. « Va dans Réglages ›
//  Appareils » à propos d'un écran qui n'existe pas fait chercher dix minutes puis
//  conclure que l'app est cassée — sans qu'aucune erreur soit levée.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nSUPPORT — la base de connaissances ne peut pas mentir");
test("chaque page citée existe VRAIMENT dans l'app", () => {
  // C'est LE test qui protège de l'invention : si une page est renommée ou supprimée
  // sans mettre à jour helpKb, l'assistant enverrait les gens dans le vide.
  for (const p of HELP_PAGES) {
    const rel = p.dir ?? p.path.replace(/^\//, "");
    const dir = `src/app/${rel}`;
    assert.ok(existsSync(`${dir}/page.tsx`), `${p.path} cité dans helpKb mais ${dir}/page.tsx n'existe pas`);
  }
});
test("aucune consigne de prompt ne fuit dans un texte affiché", () => {
  // Les champs de helpKb servent DEUX usages : le prompt du modèle et, quand l'IA est
  // indisponible, l'affichage direct à l'utilisateur. Un « voir la liste ci-dessous »
  // rédigé pour le modèle s'affichait tel quel dans une réponse de repli.
  const LEAK = /ci-dessous|ci-dessus|voir la liste|TRADUITE|tu as le droit|n'invente|prompt/i;
  for (const p of HELP_PAGES) {
    assert.ok(!LEAK.test(p.what), `consigne de prompt visible dans « ${p.path} » : ${p.what.slice(0, 70)}`);
    if (p.how) assert.ok(!LEAK.test(p.how), `consigne de prompt visible dans l'accès de « ${p.path} »`);
  }
  for (const pb of HELP_PROBLEMS) assert.ok(!LEAK.test(pb.a), `consigne de prompt visible dans « ${pb.q} »`);
});
test("chaque page du menu porte un chemin de clics", () => {
  // « Tu peux changer la langue dans Paramètres » est exact et inutile : la personne ne
  // sait pas où cliquer. Rendre l'assistant plus détaillé SANS lui fournir la structure
  // reviendrait à l'inviter à l'inventer.
  const sansAcces = HELP_PAGES.filter((p) => p.navKey && !p.how).map((p) => p.path);
  assert.deepEqual(sansAcces, [], `pages du menu sans chemin d'accès : ${sansAcces.join(", ")}`);
  for (const p of HELP_PAGES) {
    if (p.how) assert.ok(p.how.length > 15, `chemin trop vague pour ${p.path}`);
  }
});
test("le prompt impose un guidage, pas un télégramme", () => {
  const src = readFileSync("src/app/api/ai/support/route.ts", "utf8");
  assert.ok(/CHEMIN DE CLICS/.test(src), "le chemin de clics doit être exigé");
  assert.ok(/Ne le devine JAMAIS/.test(src), "le détail supplémentaire ne doit pas ouvrir la porte à l'invention");
  assert.ok(/ÉTAPES NUMÉROTÉES/.test(src));
  assert.ok(/x\.how/.test(src), "le champ « Accès » doit être injecté dans le prompt");
});
test("les onglets Santé cités correspondent aux VRAIS libellés de l'écran", () => {
  // Deux sources de vérité (helpKb et le dictionnaire local de HealthCenter) ne peuvent
  // pas diverger sans être signalées. Sans cette copie traduite, l'assistant recopiait le
  // nom français : « no separador "Poids" » à un lusophone dont l'onglet affiche « Peso ».
  const hc = readFileSync("src/components/health/HealthCenter.tsx", "utf8");
  for (const [lg, labels] of Object.entries(HEALTH_TABS)) {
    assert.equal(labels.length, 5, `${lg} : 5 onglets attendus`);
    for (const label of labels) {
      assert.ok(hc.includes(`"${label}"`), `onglet « ${label} » (${lg}) absent de HealthCenter.tsx`);
    }
  }
});
test("AUCUNE page utilisateur n'est absente de la base de connaissances", () => {
  // Le test précédent attrape l'INVENTION (une page citée qui n'existe pas). Celui-ci
  // attrape l'OMISSION, qui est passée inaperçue : /dashboard/activite et /suivre/[id]
  // existaient sans être documentés, donc l'assistant répondait « je ne connais pas »
  // sur des écrans bien réels. Un support qui ignore la moitié de l'app est inutile.
  const known = new Set(HELP_PAGES.map((p) => p.dir ?? p.path.replace(/^\//, "")));
  const found = execSync("find src/app -name page.tsx", { encoding: "utf8" })
    .split("\n").filter(Boolean)
    .map((f) => f.replace(/^src\/app\/?/, "").replace(/\/?page\.tsx$/, ""))
    // Hors périmètre : l'accueil public, l'espace admin (réservé au coach) et les routes
    // jetables de prévisualisation.
    .filter((d) => d !== "" && !d.startsWith("admin") && !d.startsWith("preview-"));
  const missing = found.filter((d) => !known.has(d));
  assert.deepEqual(missing, [], `pages absentes de helpKb : ${missing.join(", ")}`);
});
test("le repli traduit couvre EXACTEMENT les problèmes de la base", () => {
  // Deux fichiers, une seule vérité. Lors de l'écriture, une entrée « Strava » s'est
  // retrouvée dans les traductions sans exister dans HELP_PROBLEMS : le repli l'aurait
  // ignorée en silence. Ce test rend la divergence impossible.
  const qs = new Set(HELP_PROBLEMS.map((p) => p.q));
  for (const k of Object.keys(PROBLEM_KEYS)) assert.ok(qs.has(k), `PROBLEM_KEYS orphelin : « ${k} »`);
  for (const k of Object.keys(PROBLEM_T)) assert.ok(qs.has(k), `PROBLEM_T orphelin : « ${k} »`);
  for (const p of HELP_PROBLEMS) {
    assert.ok(PROBLEM_KEYS[p.q]?.length, `aucun mot-clé de repli pour « ${p.q} »`);
    for (const lg of ["en", "de", "es", "pt"]) {
      assert.ok(PROBLEM_T[p.q]?.[lg]?.length > 30, `traduction ${lg} manquante pour « ${p.q} »`);
    }
  }
});
test("l'assistant a l'interdiction explicite d'inventer", () => {
  const src = readFileSync("src/app/api/ai/support/route.ts", "utf8");
  assert.ok(/NE RIEN INVENTER/.test(src), "la consigne anti-invention doit être dans le prompt");
  assert.ok(/Je ne trouve pas cette fonctionnalité/.test(src), "aucune formule de repli prévue");
  assert.ok(/HELP_PAGES/.test(src) && /HELP_FACTS/.test(src), "le prompt doit être ancré sur la base de connaissances");
});
test("la clé API n'entre JAMAIS dans le prompt", () => {
  // Elle est lue pour en déduire un booléen ; l'envoyer à un service tiers serait la
  // même faute que celle corrigée par stripProfileSecrets.
  const src = readFileSync("src/app/api/ai/support/route.ts", "utf8");
  assert.ok(/hasIntervalsKey: Boolean\(p\?\.intervals_api_key\)/.test(src), "la clé doit être réduite à un booléen");
  const diag = readFileSync("src/lib/support/diagnose.ts", "utf8");
  assert.ok(!/intervals_api_key/.test(diag), "le module de diagnostic ne doit jamais voir la clé");
});
test("le plan est généré à la FIN DE L'ONBOARDING, pas seulement par le cron", () => {
  // Un athlète inscrit à 10 h attendait 3 h 30 du matin pour voir son calendrier. Pire :
  // tant qu'aucune séance n'existe, le tableau de bord interroge Gemini à CHAQUE affichage
  // (BentoDashboard : `if (coachSession) return`) — sur un quota de 20 requêtes/jour,
  // quelques inscriptions le même après-midi épuisaient toute l'IA de l'app.
  const ob = readFileSync("src/app/onboarding/page.tsx", "utf8");
  assert.ok(/\/api\/coach\/generate/.test(ob), "l'onboarding doit déclencher la génération");
  assert.ok(existsSync("src/app/api/coach/generate/route.ts"));
});
test("la génération ne peut pas être déclenchée pour AUTRUI", () => {
  // Une route acceptant un `userId` du corps laisserait écraser le plan d'un autre —
  // exactement la faille trouvée sur quatre routes pendant l'audit.
  const code = readFileSync("src/app/api/coach/generate/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  assert.ok(/userId: user\.id/.test(code), "l'identifiant doit venir de la session");
  assert.ok(!/req\.json\(\)|body\./.test(code), "la route ne doit lire aucun corps de requête");
  assert.ok(/COOLDOWN_MS/.test(code), "un délai anti-martèlement protège intervals.icu");
});
test("la chaîne de repli ne contient aucun modèle mort", () => {
  // `gemini-2.0-flash` : annoncé arrêté par Google le 1ᵉʳ juin 2026 et absent du tableau
  // de bord des limites du projet — quota inconnu ou nul. Sur un palier gratuit plafonné
  // à 20 requêtes/jour/modèle, chaque tentative vers lui gaspillait 5 % de la capacité.
  // Commentaires retirés avant l'analyse : le commentaire qui EXPLIQUE le retrait cite
  // forcément le modèle. Deuxième fois que ce piège se présente dans cette suite.
  //
  // ⚠️ ET SURTOUT : on ne regarde plus le SEUL wrapper. La version précédente de ce test
  // ne lisait que `gemini.ts` — pendant ce temps, `/api/ai/support` passait sa PROPRE
  // liste en dur, `gemini-2.0-flash` compris. Le test était vert et le modèle mort était
  // appelé à chaque question de support. Un invariant qui ne couvre qu'un fichier ne
  // protège que ce fichier.
  const files = ["src/lib/ai/gemini.ts", ...readdirSync("src/app/api/ai")
    .map((d) => `src/app/api/ai/${d}/route.ts`).filter((p) => existsSync(p))];
  assert.ok(files.length >= 4, "la liste des routes IA à contrôler ne doit pas être vide");
  for (const f of files) {
    assert.ok(!/gemini-2\.0-flash/.test(codeOf(f)), `${f} référence un modèle arrêté par Google`);
  }
});
test("aucune route IA ne fige sa propre liste de modèles", () => {
  // C'est la cause RACINE du point précédent : une liste locale ne suit ni les retraits
  // de modèles ni la variable GEMINI_MODELS, et diverge en silence de la chaîne commune.
  for (const d of readdirSync("src/app/api/ai")) {
    const p = `src/app/api/ai/${d}/route.ts`;
    if (!existsSync(p)) continue;
    assert.ok(!/models:\s*\[/.test(codeOf(p)), `${p} impose ses modèles au lieu de suivre la chaîne commune`);
  }
});
test("la chaîne garde PLUSIEURS modèles — les quotas sont par modèle", () => {
  // Erreur de raisonnement évitée ici : réduire la chaîne à un seul modèle semblait
  // économiser des requêtes, alors que les quotas sont comptés PAR MODÈLE (20 + 20).
  // Basculer vers le second DOUBLE la capacité ; n'en garder qu'un la diviserait par deux.
  const src = readFileSync("src/lib/ai/gemini.ts", "utf8");
  const defaults = (src.match(/GEMINI_MODELS \?\? "([^"]+)"/) || [])[1] ?? "";
  assert.ok(defaults.split(",").length >= 2, `chaîne trop courte : « ${defaults} »`);
  assert.ok(/GEMINI_MODELS/.test(src), "la liste doit être ajustable sans redéploiement");
});
test("un quota JOURNALIER épuisé ne déclenche aucun réessai", () => {
  // Un 429 « par minute » se dissipe en secondes : réessayer a du sens. Un 429 « par
  // jour » ne se libère qu'à minuit Pacifique — chaque réessai est une requête brûlée
  // pour rien. L'ancien comportement consommait jusqu'à 6 requêtes par question au lieu
  // de 3, une fois le quota atteint : il creusait le trou qu'il prétendait combler.
  // La distinction par-jour / par-minute a été extraite dans `quotaMemory.ts`
  // (`isDailyQuotaError`) et elle est désormais vérifiée sur le COMPORTEMENT, plus haut,
  // avec un `fetch` factice — ce qui vaut mieux qu'un grep de regex. Ici on ne fige plus
  // que ce qui doit rester vrai DANS LA BOUCLE : le court-circuit avant tout réessai.
  const src = codeOf("src/lib/ai/gemini.ts");
  // On vise le SITE D'APPEL, pas l'import en tête de fichier : ancré sur le simple nom,
  // l'assertion serait trivialement vraie et ne pourrait plus jamais échouer.
  const iDaily = src.indexOf("if (isDailyQuotaError(");
  const iRetry = src.indexOf("if (attempt < retries)");
  assert.ok(iDaily > 0 && iDaily < iRetry, "le court-circuit doit précéder la boucle de réessai");
  // La bascule vers un AUTRE modèle reste utile : il a son propre quota journalier.
  assert.ok(/for \(const model of models\)/.test(src), "la bascule de modèle doit être conservée");
});
test("la réponse est optimisée pour la VITESSE", () => {
  const src = readFileSync("src/app/api/ai/support/route.ts", "utf8");
  assert.ok(/thinkingBudget: 0/.test(src), "aucun budget de réflexion sur une question de support");
  assert.ok(/maxOutputTokens: 1200/.test(src), "la réponse doit rester bornée");
});

console.log("\nSUPPORT — le diagnostic lit le compte réel, il ne récite pas");
const okState = {
  age: 30, heightCm: 180, weightKg: 72, onboardingCompleted: true, healthDeclared: true,
  hasIntervalsKey: true, hasIntervalsAthleteId: true, lastWorkoutDate: isoDay(1),
  workoutCount30d: 14, upcomingSessions: 7, lastAutoCoachAt: isoDay(0),
  objective: { race: "Marathon", raceDate: isoDay(-60) }, weighInCount: 0, weightModeEnabled: false,
};
test("un compte sain ne produit AUCUN constat", () => {
  // Sinon l'assistant commenterait des problèmes inexistants — l'inverse du but.
  assert.deepEqual(diagnoseAccount(okState, NOW), []);
});
test("montre non connectée = constat BLOQUANT prioritaire", () => {
  const f = diagnoseAccount({ ...okState, hasIntervalsKey: false }, NOW);
  assert.equal(f[0].code, "montre_non_connectee");
  assert.equal(f[0].severity, "bloquant");
  assert.ok(/Sync Montre/.test(f[0].fact), "le constat doit nommer la page où agir");
});
test("le diagnostic distingue « jamais synchronisé » de « synchronisation en retard »", () => {
  const jamais = diagnoseAccount({ ...okState, workoutCount30d: 0, lastWorkoutDate: null }, NOW);
  assert.ok(jamais.some((x) => x.code === "aucune_activite"));
  const retard = diagnoseAccount({ ...okState, lastWorkoutDate: isoDay(12) }, NOW);
  assert.ok(retard.some((x) => x.code === "sync_en_retard"), "12 jours sans import doit être signalé");
  assert.ok(!retard.some((x) => x.code === "aucune_activite"), "il a bien des activités : ne pas dire le contraire");
});
test("un objectif dépassé est signalé, pas ignoré", () => {
  const f = diagnoseAccount({ ...okState, objective: { race: "Semi", raceDate: isoDay(30) } }, NOW);
  assert.ok(f.some((x) => x.code === "objectif_passe"));
});
test("le bloc de constats pousse à traiter le bloquant d'abord", () => {
  const block = findingsBlock(diagnoseAccount({ ...okState, hasIntervalsKey: false }, NOW));
  assert.ok(/BLOQUANT/.test(block));
  assert.equal(findingsBlock([]), "", "un compte sain ne doit rien ajouter au prompt");
});

/**
 * Source d'un fichier DÉBARRASSÉE DE SES COMMENTAIRES, pour les tests qui lisent le code.
 *
 * Deux pièges, rencontrés l'un après l'autre :
 *  1. sans retirer les commentaires, le test se déclenche sur la prose qui explique
 *     justement la correction (celle de la route cite « gemini-2.5-flash » en toutes lettres) ;
 *  2. retirer bêtement tout ce qui suit `//` MUTILE LES URL du code : `https://…` devient
 *     `https:`. L'assertion « aucune URL de modèle en dur » devenait alors increvable —
 *     elle passait même sur le code fautif. On ne coupe donc pas sur `://`.
 */
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}

console.log("\nSÉANCE IA — mémorisée un jour, périmée dès que le contexte bouge");
// Le tableau de bord appelait /api/ai/session à CHAQUE montage : trois visites =
// trois requêtes Gemini, sur un palier gratuit plafonné à 20 par jour et par modèle.
// Ces tests figent les deux moitiés du contrat : ça doit servir le cache quand rien
// n'a changé, et SURTOUT le jeter dès qu'un fait de la prescription a changé.
const SIG: SessionSignals = {
  day: "2026-08-08",
  lastWorkoutDate: "2026-08-07", workoutCount: 412,
  lastHrvDate: "2026-08-08", lastHrvMs: 71,
  lastSleepDate: "2026-08-08", lastSleepScore: 82,
  objective: { race: "Marathon de Paris", raceDate: "2027-04-11", targetSeconds: 10800 },
  baselineTestedAt: "2026-06-01T00:00:00Z",
  profile: { age: 34, weight_kg: 72, health_notes: "", main_terrains: ["route", "trail"], days_per_week: 5 },
};
const fpOf = (over: Partial<SessionSignals> = {}) => fingerprint({ ...SIG, ...over });

test("mêmes signaux = même empreinte (sinon le cache ne sert jamais)", () => {
  assert.equal(fpOf(), fpOf());
});
test("l'ordre des clés d'un objet jsonb ne change pas l'empreinte", () => {
  // PostgREST peut rendre les clés dans un autre ordre d'une lecture à l'autre. Sans
  // canonicalisation, l'empreinte changerait toute seule et on rappellerait Gemini
  // à chaque visite — le cache aurait coûté du code sans économiser une requête.
  assert.equal(
    canonical({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } }),
    canonical({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }),
  );
  assert.equal(fpOf({ objective: { raceDate: "2027-04-11", targetSeconds: 10800, race: "Marathon de Paris" } }), fpOf());
});
test("le changement de jour périme la mémorisation", () => {
  assert.notEqual(fpOf({ day: "2026-08-09" }), fpOf());
});
test("une séance importée périme la recommandation", () => {
  // Le vrai défaut de l'ancien cache mémoire : indexé sur utilisateur+jour seulement,
  // il servait jusqu'au soir un conseil calculé AVANT la sortie du matin.
  assert.notEqual(fpOf({ lastWorkoutDate: "2026-08-08", workoutCount: 413 }), fpOf());
  assert.notEqual(fpOf({ workoutCount: 413 }), fpOf(), "même à date égale, une séance de plus compte");
});
test("la VFC et le sommeil du matin périment la recommandation", () => {
  // Ils arrivent souvent APRÈS la première ouverture du tableau de bord, et c'est
  // d'eux que sort le verdict « fatigué → récupération ». Les ignorer, ce serait
  // servir toute la journée un conseil donné sans savoir comment il avait dormi.
  assert.notEqual(fpOf({ lastHrvMs: 58 }), fpOf());
  assert.notEqual(fpOf({ lastSleepDate: "2026-08-08", lastSleepScore: 41 }), fpOf());
});
test("un nouvel objectif ou un nouveau test de VMA périme la recommandation", () => {
  assert.notEqual(fpOf({ objective: { race: "Semi de Boulogne", raceDate: "2026-11-15" } }), fpOf());
  assert.notEqual(fpOf({ objective: null }), fpOf());
  assert.notEqual(fpOf({ baselineTestedAt: "2026-08-08T09:00:00Z" }), fpOf());
});
test("une donnée de santé ou de disponibilité périme la recommandation", () => {
  assert.notEqual(fpOf({ profile: { ...SIG.profile, health_notes: "douleur tendon d'Achille droit" } }), fpOf());
  assert.notEqual(fpOf({ profile: { ...SIG.profile, days_per_week: 3 } }), fpOf());
  assert.notEqual(fpOf({ profile: { ...SIG.profile, weight_kg: 69 } }), fpOf());
});
test("les colonnes réécrites à chaque synchro NE périment PAS la mémorisation", () => {
  // Le piège inverse : empreindre la position GPS, la courbe d'allure ou le score de
  // discipline ferait sauter le cache plusieurs fois par jour sans qu'aucun conseil
  // ne change. Un cache qui ne sert jamais est un cache inutile.
  assert.equal(fpOf({ profile: { ...SIG.profile, last_lat: 48.85, last_lon: 2.35, last_loc_at: "2026-08-08T11:00:00Z" } }), fpOf());
  assert.equal(fpOf({ profile: { ...SIG.profile, pace_curve: { at: "2026-08-08T11:00:00Z", pts: [1, 2, 3] } } }), fpOf());
  assert.equal(fpOf({ profile: { ...SIG.profile, discipline_score: 88, xp_points: 1240 } }), fpOf());
});
test("la clé intervals.icu n'entre JAMAIS dans l'empreinte", () => {
  assert.equal(fpOf({ profile: { ...SIG.profile, intervals_api_key: "secret-abc" } }), fpOf());
  assert.ok(!PROFILE_FINGERPRINT_COLUMNS.includes("intervals_api_key" as never));
});
test("une entrée mémorisée n'est réutilisée que si jour ET empreinte collent", () => {
  const good = { day: "2026-08-08", fp: "abc", session: { title: "Seuil 3×8'", subtitle: "", tags: ["Z4"], why: "" } };
  assert.equal(isCacheUsable(good, "2026-08-08", "abc"), true);
  assert.equal(isCacheUsable(good, "2026-08-09", "abc"), false, "le lendemain, on recalcule");
  assert.equal(isCacheUsable(good, "2026-08-08", "xyz"), false, "empreinte différente = contexte changé");
  assert.equal(isCacheUsable(null, "2026-08-08", "abc"), false);
});
test("une entrée à moitié écrite provoque un nouvel appel, pas une carte vide", () => {
  const day = "2026-08-08";
  assert.equal(isCacheUsable({ day, fp: "abc", session: null }, day, "abc"), false);
  assert.equal(isCacheUsable({ day, fp: "abc", session: { title: "", tags: [] } }, day, "abc"), false);
  assert.equal(isCacheUsable({ day, fp: "abc", session: { title: "Seuil" } }, day, "abc"), false, "sans tags, la carte s'affiche cassée");
});
test("la route mémorise en base et passe par la chaîne de repli", () => {
  const code = codeOf("src/app/api/ai/session/route.ts");
  assert.ok(!/generativelanguage\.googleapis\.com/.test(code),
    "la route ne doit pas appeler un modèle en dur : elle se priverait de la bascule vers flash-lite, donc de la moitié du quota");
  assert.ok(/generateContent\(/.test(code), "l'appel doit passer par la chaîne de repli commune");
  assert.ok(!/new Map\(/.test(code),
    "un cache mémoire ne survit pas à une instance Vercel et ignore les changements de contexte");
  assert.ok(/SESSION_CACHE_TYPE/.test(code) && /fingerprint\(/.test(code),
    "la mémorisation doit être en base et empreinte au contexte");
  // La lecture du cache doit précéder la construction du contexte : celle-ci coûte une
  // quinzaine de requêtes DB et un appel météo, tout ça pour préparer l'appel évité.
  assert.ok(code.indexOf("isCacheUsable") < code.indexOf("buildAthleteContext(supabase"),
    "on doit rendre la réponse mémorisée AVANT de construire le contexte complet");
});
test("deux appareils simultanés ne cassent pas le cache définitivement", () => {
  const code = readFileSync("src/app/api/ai/session/route.ts", "utf8");
  const read = code.slice(code.indexOf(`eq("type", SESSION_CACHE_TYPE)`));
  assert.ok(/limit\(1\)/.test(read.slice(0, 200)) && !/maybeSingle/.test(read.slice(0, 200)),
    "maybeSingle() échouerait DÉFINITIVEMENT si deux onglets ont inséré deux lignes");
});

console.log("\nSEGMENTS — un chrono attribué à tort est pire qu'aucun chrono");
// Cette brique ne plante jamais : elle se trompe en silence, et le mensonge s'affiche
// dans un classement public où d'autres se comparent.

test("la distance géodésique colle à des repères RÉELS", () => {
  // Paris (Notre-Dame) → Lyon (Bellecour) : 391 km à vol d'oiseau, valeur connue.
  const parisLyon = haversine(48.8530, 2.3499, 45.7578, 4.8320) / 1000;
  assert.ok(Math.abs(parisLyon - 391) < 6, `attendu ~391 km, obtenu ${parisLyon.toFixed(1)} km`);
  // Un degré de latitude vaut ~111,2 km partout sur le globe.
  assert.ok(Math.abs(haversine(45, 5, 46, 5) / 1000 - 111.2) < 0.5);
  assert.equal(haversine(48.85, 2.35, 48.85, 2.35), 0, "un point avec lui-même : zéro");
});
test("l'encodage polyline survit à l'aller-retour", () => {
  const pts = [{ lat: 48.8566, lon: 2.3522 }, { lat: 48.8570, lon: 2.3530 }, { lat: 48.8580, lon: 2.3510 }];
  const back = decodePolyline(encodePolyline(pts));
  assert.equal(back.length, pts.length);
  for (let i = 0; i < pts.length; i++) {
    assert.ok(Math.abs(back[i].lat - pts[i].lat) < 1e-5, "la latitude doit survivre au décodage");
    assert.ok(Math.abs(back[i].lon - pts[i].lon) < 1e-5);
  }
  assert.equal(decodePolyline(encodePolyline([])).length, 0);
});
test("la simplification garde TOUJOURS le dernier point", () => {
  // Perdre le point final déplacerait l'arrivée du segment, donc fausserait le chrono.
  const droite: TP[] = Array.from({ length: 200 }, (_, i) => ({ lat: 48.85 + i * 0.00002, lon: 2.35, t: i }));
  const light = simplify(droite, 10);
  assert.ok(light.length < droite.length, "une ligne droite doit se compresser");
  assert.deepEqual(light[light.length - 1], droite[droite.length - 1]);
  assert.deepEqual(light[0], droite[0]);
  assert.deepEqual(simplify([droite[0]], 10), [droite[0]], "une trace d'un point reste intacte");
});
test("le bruit GPS ne fabrique PAS de dénivelé", () => {
  // LE défaut à empêcher : l'altitude GPS oscille de ±2-3 m à l'arrêt. Sommer
  // naïvement toutes les hausses transforme une sortie plate en 300 m de D+ —
  // un chiffre plausible, faux, et flatteur. Lille est plat : ses segments doivent
  // afficher 0, pas un relief inventé.
  const plat: TP[] = Array.from({ length: 300 }, (_, i) => ({
    lat: 50.64, lon: 3.03, t: i, alt: 20 + Math.sin(i) * 2.5,   // ±2,5 m de bruit
  }));
  assert.equal(elevationGain(plat), 0, "une oscillation sous le seuil n'est pas une montée");

  // Une vraie côte de 50 m doit être vue.
  const cote: TP[] = Array.from({ length: 100 }, (_, i) => ({ lat: 50.64, lon: 3.03, t: i, alt: 20 + i * 0.5 }));
  const g = elevationGain(cote);
  assert.ok(g != null && Math.abs(g - 49.5) < 4, `attendu ~50 m, obtenu ${g}`);
});
test("« je ne sais pas » et « c'est plat » ne se confondent pas", () => {
  // Renvoyer 0 pour une trace sans altitude afficherait « plat » sur une montagne.
  const sansAlt: TP[] = Array.from({ length: 50 }, (_, i) => ({ lat: 50.64, lon: 3.03, t: i }));
  assert.equal(elevationGain(sansAlt), null, "aucune altitude ⇒ null, jamais 0");
  assert.equal(elevationGain([]), null);
  // Altitude trop partielle : on refuse plutôt que d'extrapoler sur une minorité.
  const partiel: TP[] = sansAlt.map((p, i) => (i < 5 ? { ...p, alt: 20 + i } : p));
  assert.equal(elevationGain(partiel), null, "5 points sur 50 ne suffisent pas à conclure");
});
test("le préfiltre par zone écarte ce qui est loin, garde ce qui est proche", () => {
  const paris = { minLat: 48.85, maxLat: 48.86, minLon: 2.35, maxLon: 2.36 };
  const lyon = { minLat: 45.75, maxLat: 45.76, minLon: 4.83, maxLon: 4.84 };
  assert.equal(bboxOverlap(paris, lyon), false, "Paris et Lyon ne partagent aucun segment");
  assert.equal(bboxOverlap(paris, { ...paris, minLat: 48.8505 }), true);
});

// Un segment droit de ~500 m, et une trace qui le parcourt à vitesse constante.
const SEG = { id: "s1", distance_m: 556, start_lat: 48.8500, start_lon: 2.3500, end_lat: 48.8550, end_lon: 2.3500 };
const traceDroite = (secParPoint = 3): TP[] =>
  Array.from({ length: 51 }, (_, i) => ({ lat: 48.8500 + i * 0.0001, lon: 2.35, t: i * secParPoint }));

test("un passage réel produit un chrono juste", () => {
  const efforts = findEfforts(traceDroite(3), SEG);
  assert.equal(efforts.length, 1);
  assert.equal(efforts[0].elapsed_seconds, 150, "51 points espacés de 3 s = 150 s du premier au dernier");
  assert.ok(Math.abs(efforts[0].covered_m - SEG.distance_m) < 30);
});
test("passer PRÈS du départ et de l'arrivée ne suffit pas", () => {
  // LE faux positif à empêcher : entrer dans le portique, filer ailleurs, revenir
  // près de l'arrivée. La distance parcourue trahit le détour.
  const detour: TP[] = [
    { lat: 48.8500, lon: 2.3500, t: 0 },      // au départ
    { lat: 48.8600, lon: 2.3800, t: 300 },    // très loin
    { lat: 48.8550, lon: 2.3500, t: 600 },    // à l'arrivée
  ];
  assert.deepEqual(findEfforts(detour, SEG), [], "un itinéraire différent ne mérite aucun chrono");
});
test("une trace sans horodatage exploitable ne produit AUCUN chrono", () => {
  // Mieux vaut pas d'effort qu'un effort inventé à partir d'un temps nul.
  const figee = traceDroite(0).map((p) => ({ ...p, t: 0 }));
  assert.deepEqual(findEfforts(figee, SEG), []);
});
test("une boucle parcourue deux fois donne DEUX efforts, jamais un chrono négatif", () => {
  const aller = traceDroite(3);
  const retour = aller.map((p, i) => ({ ...p, t: 200 + i * 3 }));
  const efforts = findEfforts([...aller, ...retour], SEG);
  assert.equal(efforts.length, 2, "chaque passage doit compter");
  for (const e of efforts) assert.ok(e.elapsed_seconds > 0, "un chrono négatif signale une sortie cherchée avant l'entrée");
});
test("le classement retient le MEILLEUR temps de chacun, pas tous ses passages", () => {
  // Sinon celui qui court le segment tous les jours occupe les dix premières places.
  const efforts = [
    { user_id: "a", elapsed_seconds: 200, started_at: "2026-08-01T10:00:00Z" },
    { user_id: "a", elapsed_seconds: 180, started_at: "2026-08-05T10:00:00Z" },
    { user_id: "b", elapsed_seconds: 190, started_at: "2026-08-03T10:00:00Z" },
  ];
  const l = leaderboard(efforts);
  assert.deepEqual(l.map((e) => e.user_id), ["a", "b"]);
  assert.equal(l[0].elapsed_seconds, 180);
  assert.equal(l.filter((e) => e.user_id === "a").length, 1, "un athlète n'apparaît qu'une fois");
});
test("le Maître du segment récompense la RÉGULARITÉ, pas la vitesse", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  const efforts = [
    // « b » est plus lent mais y va bien plus souvent : c'est lui le maître.
    ...Array.from({ length: 5 }, (_, i) => ({ user_id: "b", elapsed_seconds: 300, started_at: `2026-08-0${i + 1}T10:00:00Z` })),
    { user_id: "a", elapsed_seconds: 120, started_at: "2026-08-02T10:00:00Z" },
    { user_id: "a", elapsed_seconds: 121, started_at: "2026-08-04T10:00:00Z" },
  ];
  const m = maitreDuSegment(efforts, now);
  assert.deepEqual(m?.userIds, ["b"]);
  assert.equal(m?.count, 5);
});
test("hors des 90 jours, les passages ne comptent plus", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  const vieux = Array.from({ length: 9 }, (_, i) => ({ user_id: "a", elapsed_seconds: 300, started_at: `2026-01-0${i + 1}T10:00:00Z` }));
  assert.equal(maitreDuSegment(vieux, now), null, "un titre ne se garde pas sur des passages de janvier");
});
test("une égalité ne désigne PAS un vainqueur inventé", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  const efforts = ["a", "b"].flatMap((u) =>
    [1, 2].map((d) => ({ user_id: u, elapsed_seconds: u === "a" ? 100 : 300, started_at: `2026-08-0${d}T10:00:00Z` })));
  const m = maitreDuSegment(efforts, now);
  assert.deepEqual(m?.userIds.sort(), ["a", "b"], "départager par le chrono serait inventer un critère");
});
test("un seul passage ne fait pas un maître", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  assert.equal(maitreDuSegment([{ user_id: "a", elapsed_seconds: 100, started_at: "2026-08-10T10:00:00Z" }], now), null);
});
test("l'import de traces ne renvoie JAMAIS la clé intervals.icu", () => {
  const code = codeOf("src/app/api/tracks/import/route.ts");
  const reponses = [...code.matchAll(/NextResponse\.json\(([\s\S]{0,300}?)\)/g)].map((m) => m[1]);
  assert.ok(reponses.length > 0);
  for (const r of reponses) assert.ok(!/apiKey|intervals_api_key/.test(r), `une réponse expose la clé : ${r.slice(0, 60)}`);
});

console.log("\nTROPHÉES — aucun trophée sans preuve");
// Le risque d'une vitrine, ce n'est pas de planter : c'est de décerner. Un mur de
// médailles offertes ne récompense plus rien et ment sur le niveau de l'athlète.
const W = (o: Partial<TW>): TW => ({ date: "2026-03-08", sport: "Run", ...o }) as TW;

test("un compte vide ne reçoit AUCUN trophée", () => {
  assert.deepEqual(computeTrophies([]), []);
  assert.deepEqual(computeTrophies([W({ distance_km: 0, duration_seconds: 0 })]).filter(t => t.kind !== "palier"), []);
});
test("les sports qui ne sont pas de la course ne décernent rien", () => {
  // 200 km de vélo ne font pas un coureur de 200 km.
  assert.deepEqual(computeTrophies([W({ sport: "Ride", distance_km: 200, duration_seconds: 25000 })]), []);
  assert.deepEqual(computeTrophies([W({ sport: "Swim", distance_km: 5, duration_seconds: 6000 })]), []);
});
test("un chrono de référence exige la distance RÉELLE, pas une approchante", () => {
  // Le défaut à éviter : faire passer un 9,2 km pour un record sur 10 km. Sans les
  // découpes kilométriques (elles vivent dans les flux GPS non importés), on ne peut
  // pas connaître le temps de passage au 10ᵉ km d'une sortie plus longue.
  assert.deepEqual(chronoRecords([W({ distance_km: 9.2, duration_seconds: 2400 })]), [], "9,2 km n'est pas un 10 km");
  assert.deepEqual(chronoRecords([W({ distance_km: 14, duration_seconds: 3600 })]), [], "14 km non plus : +40 % hors tolérance");
  const ok = chronoRecords([W({ distance_km: 10.1, duration_seconds: 2038 })]);
  assert.equal(ok.length, 1);
  assert.equal(ok[0].label, "10 km");
  assert.equal(ok[0].value, "33 min 58", "chrono réel relevé sur les 314 séances");
  assert.ok(/10,1 km/.test(ok[0].detail ?? ""), "la distance réelle doit être AFFICHÉE, pas masquée");
});
test("seul le palier le plus haut s'affiche, pas l'escalier", () => {
  const runs = Array.from({ length: 120 }, (_, i) => W({ date: `2026-0${(i % 9) + 1}-01`, distance_km: 20 }));
  const paliers = computeTrophies(runs).filter((t) => t.id.startsWith("palier-km-"));
  assert.equal(paliers.length, 1, "2 400 km ne doivent pas produire 4 médailles empilées");
  assert.equal(paliers[0].id, "palier-km-1000");
});
test("un palier n'est jamais décerné par anticipation", () => {
  const presque = computeTrophies([W({ distance_km: 99 })]).filter((t) => t.id.startsWith("palier-km-"));
  assert.deepEqual(presque, [], "99 km ne valent pas le palier des 100 km");
});
test("la série se compte en SEMAINES, jamais en jours", () => {
  // Une série quotidienne pousse à courir blessé : un coach ne récompense pas ça.
  const troisSemaines = ["2026-01-05", "2026-01-13", "2026-01-19"].map((d) => W({ date: d, distance_km: 10 }));
  const s = longestStreak(troisSemaines);
  assert.equal(s?.value, "3 semaines");
  assert.equal(longestStreak([W({ distance_km: 10 })]), null, "une semaine isolée n'est pas une série");
  const trouee = ["2026-01-05", "2026-02-16"].map((d) => W({ date: d, distance_km: 10 }));
  assert.equal(longestStreak(trouee), null, "deux semaines non consécutives ne font pas une série");
});
test("les trophées ne sont écrits dans AUCUNE table", () => {
  // Persister une conclusion, c'est risquer qu'elle survive à la séance qui l'a
  // produite : une vitrine qui affiche une performance effacée.
  const code = codeOf("src/lib/trophies/compute.ts") + codeOf("src/app/dashboard/trophees/page.tsx");
  assert.ok(!/\.insert\(|\.upsert\(|\.update\(/.test(code), "les trophées doivent rester calculés à la lecture");
});

console.log("\nSOCIAL — qui voit quoi, et rien d'inventé sur les cartes");
const P = (over: Partial<SocialPost> = {}): SocialPost =>
  ({ id: "p1", user_id: "alice", visibility: "followers", created_at: "2026-08-13T10:00:00Z", ...over });

test("« privé » ne souffre AUCUNE exception", () => {
  // Même un abonné accepté ne doit pas voir une publication privée : c'est le seul
  // réglage qui doit être absolu, sinon il ne veut rien dire.
  assert.equal(canSee(P({ visibility: "private" }), "bob", new Set(["alice"])), false);
  assert.equal(canSee(P({ visibility: "private" }), "alice", new Set()), true, "son auteur la voit toujours");
});
test("« mes abonnés » exige un abonnement RÉEL, pas un drapeau porté par la publication", () => {
  // La relation fait foi et peut avoir été rompue APRÈS la publication.
  assert.equal(canSee(P(), "bob", new Set(["alice"])), true);
  assert.equal(canSee(P(), "bob", new Set()), false, "ne plus suivre doit refermer l'accès");
  assert.equal(canSee(P({ visibility: "public" }), "bob", new Set()), true);
  assert.equal(canSee(P({ visibility: "public" }), null, new Set()), true);
});
test("un texte fait d'espaces ne crée pas de publication fantôme", () => {
  assert.equal(cleanBody("   \n\n  "), null);
  assert.equal(cleanBody("  "), null, "les espaces insécables aussi");
  assert.equal(cleanBody("  Belle sortie  "), "Belle sortie");
  assert.equal(cleanBody("x".repeat(2000))?.length, 1000, "le texte doit rester borné");
  assert.equal(cleanBody(42), null, "une valeur non textuelle n'est pas un texte");
});
test("publier exige un contenu : un texte OU une séance", () => {
  assert.equal(isPublishable(null, null), false);
  assert.equal(isPublishable("Sortie tranquille", null), true);
  assert.equal(isPublishable(null, "w1"), true);
});
test("la carte n'affiche QUE les chiffres qui existent", () => {
  // Le défaut à éviter : une séance sans distance affichée « 0,0 km », qui ment sur
  // la sortie de quelqu'un devant ses abonnés.
  assert.deepEqual(statLine({}), []);
  assert.deepEqual(statLine({ distance_km: 0, duration_seconds: 0 }), [], "zéro n'est pas une mesure");
  // Chiffres repris de la vidéo Strava : 11,8 km à 4:34/km. Si notre calcul retombe
  // dessus, c'est qu'il est juste sur un cas réel et non sur un cas inventé.
  const s = statLine({ distance_km: 11.8, duration_seconds: 3234 });
  assert.equal(s[0].value, "11,8 km");
  assert.equal(s[1].value, "54 min", "3 234 s = 53 min 54 s, arrondi à 54");
  assert.equal(s[2].value, "4'34\"/km");
});
test("l'allure n'est calculée que si elle a un sens", () => {
  assert.equal(paceOf(3600, 0), null, "aucune distance = aucune allure");
  assert.equal(paceOf(null, 10), null);
  assert.equal(paceOf(3600, 0.5), null, "2 h/km : donnée aberrante, on ne l'affiche pas");
  assert.equal(paceOf(600, 2), "5'00\"");
  assert.equal(paceOf(359.4, 1), "5'59\"");
  assert.equal(paceOf(359.6, 1), "6'00\"", "59,6 s ne doit pas s'afficher 5'60\"");
});
test("les suggestions ne proposent jamais quelqu'un de déjà suivi", () => {
  // Sinon le bouton « Suivre » semble cassé : on clique, rien ne change à l'écran.
  const out = suggestable([{ id: "moi" }, { id: "alice" }, { id: "bob" }], "moi", new Set(["alice"]));
  assert.deepEqual(out.map((a) => a.id), ["bob"]);
});
test("les temps relatifs basculent sur une date au-delà d'une semaine", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  assert.equal(timeAgo("2026-08-13T11:59:30Z", now), "à l'instant");
  assert.equal(timeAgo("2026-08-13T11:30:00Z", now), "il y a 30 min");
  assert.equal(timeAgo("2026-08-13T06:00:00Z", now), "il y a 6 h");
  assert.equal(timeAgo("2026-08-10T12:00:00Z", now), "il y a 3 j");
  assert.ok(!/il y a/.test(timeAgo("2025-09-01T12:00:00Z", now)), "« il y a 346 j » n'apprend rien");
  assert.equal(timeAgo("pas-une-date", now), "");
});
test("les compteurs sociaux ne sont JAMAIS écrits par les routes", () => {
  // Ils sont tenus par trigger (migration 019). Une route qui oublie de décrémenter
  // laisse un compteur faux à l'écran pour toujours.
  for (const f of ["interact", "post", "feed", "follow"]) {
    const code = codeOf(`src/app/api/social/${f}/route.ts`);
    // On vise l'ÉCRITURE (`kudos_count: …` dans un objet), pas la lecture : le fil
    // sélectionne légitimement ces colonnes pour les afficher. Un motif plus large
    // aurait interdit de les lire, ce qui n'a aucun sens.
    assert.ok(!/(kudos_count|comments_count)\s*:/.test(code),
      `src/app/api/social/${f}/route.ts écrit un compteur que le trigger tient déjà`);
  }
});
test("aucune route sociale ne renvoie un profil en select(*)", () => {
  // Une colonne sensible ajoutée demain au profil (clé intervals.icu, e-mail,
  // identifiants Stripe) se retrouverait exposée sans que personne ne le voie.
  for (const f of ["interact", "post", "feed", "follow"]) {
    const code = codeOf(`src/app/api/social/${f}/route.ts`);
    assert.ok(!/from\("profiles"\)\s*\.\s*select\("\*"\)/.test(code), `${f} expose tout le profil`);
    assert.ok(!/intervals_api_key/.test(code), `${f} manipule la clé intervals.icu`);
  }
});
test("la publication par défaut n'est PAS publique", () => {
  // Une séance porte une trace GPS qui part du domicile : le défaut doit protéger.
  const code = codeOf("src/app/api/social/post/route.ts");
  assert.ok(/:\s*"followers"/.test(code), "le repli de visibilité doit être « followers »");
  const ui = codeOf("src/components/social/SocialHub.tsx");
  assert.ok(/useState<[^>]*>\("followers"\)/.test(ui), "le compositeur doit s'ouvrir sur « Mes abonnés »");
});
test("publier la séance d'autrui est impossible", () => {
  const code = codeOf("src/app/api/social/post/route.ts");
  // La vérification d'appartenance doit précéder l'insertion, sinon elle ne protège rien.
  const iCheck = code.indexOf('eq("user_id", user.id)');
  const iInsert = code.indexOf('.insert(');
  assert.ok(iCheck > 0 && iCheck < iInsert, "la séance doit être vérifiée AVANT la publication");
});

console.log("\nQUOTA ÉPUISÉ — mémorisé jusqu'à minuit AU PACIFIQUE, pas à minuit UTC");
// Sans mémoire, chaque ouverture du tableau de bord refaisait la découverte : un
// aller-retour réseau par modèle, pour un échec connu d'avance. Et mémoriser « pour la
// journée » avec la clé UTC utilisée ailleurs dans l'app aurait été faux deux fois.
const laStamp = (d: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
}).format(d);

test("la réinitialisation tombe TOUJOURS à minuit à Los Angeles", () => {
  for (const iso of ["2026-08-09T12:00:00Z", "2026-01-15T12:00:00Z", "2026-05-01T03:00:00Z", "2026-12-31T23:59:00Z"]) {
    const now = new Date(iso);
    const reset = nextQuotaResetUtc(now);
    assert.ok(laStamp(reset).endsWith("00:00"), `${iso} → ${laStamp(reset)} n'est pas minuit au Pacifique`);
    assert.ok(reset > now, "la réinitialisation doit être dans le futur");
    assert.ok(reset.getTime() - now.getTime() <= 25 * 3600_000, "jamais plus de 25 h d'attente");
  }
});
test("l'heure d'été est prise en compte (07 h UTC l'été, 08 h l'hiver)", () => {
  assert.equal(nextQuotaResetUtc(new Date("2026-08-09T12:00:00Z")).toISOString(), "2026-08-10T07:00:00.000Z");
  assert.equal(nextQuotaResetUtc(new Date("2026-01-15T12:00:00Z")).toISOString(), "2026-01-16T08:00:00.000Z");
  // Jours de bascule : minuit tombe AVANT le changement d'heure (2 h du matin), donc
  // c'est encore l'ancien décalage qui s'applique. Un calcul naïf se trompe d'une heure.
  assert.equal(nextQuotaResetUtc(new Date("2026-03-07T20:00:00Z")).toISOString(), "2026-03-08T08:00:00.000Z");
  assert.equal(nextQuotaResetUtc(new Date("2026-03-08T20:00:00Z")).toISOString(), "2026-03-09T07:00:00.000Z");
  assert.equal(nextQuotaResetUtc(new Date("2026-10-31T20:00:00Z")).toISOString(), "2026-11-01T07:00:00.000Z");
  assert.equal(nextQuotaResetUtc(new Date("2026-11-01T20:00:00Z")).toISOString(), "2026-11-02T08:00:00.000Z");
});
test("LE POINT CENTRAL : le marqueur SURVIT à minuit UTC", () => {
  // Posé à 23 h 50 UTC (16 h 50 au Pacifique), il doit tenir jusqu'à 07 h UTC. Une
  // mémorisation indexée sur le jour UTC aurait rouvert le robinet à 00 h 00 pour
  // sept heures d'échecs supplémentaires, en croyant bien faire.
  const mark = markExhausted(new Date("2026-08-08T23:50:00Z"));
  assert.equal(isExpired(mark, Date.parse("2026-08-09T00:30:00Z")), false, "à 00 h 30 UTC il reste 6 h 30 de disette");
  assert.equal(isExpired(mark, Date.parse("2026-08-09T06:59:00Z")), false);
  assert.equal(isExpired(mark, Date.parse("2026-08-09T07:00:00Z")), true, "minuit au Pacifique : le quota est rendu");
});
test("un plafond PAR MINUTE ne se confond pas avec un plafond PAR JOUR", () => {
  // Confondre les deux couperait l'IA pour la journée à cause d'une bourrasque de
  // quelques secondes — un dégât sans commune mesure avec l'économie visée.
  assert.equal(isDailyQuotaError(429, "Quota exceeded for quota metric GenerateRequestsPerDay"), true);
  assert.equal(isDailyQuotaError(429, "limit: 20 per day"), true);
  assert.equal(isDailyQuotaError(429, "GenerateRequestsPerMinute exceeded"), false);
  assert.equal(isDailyQuotaError(503, "model overloaded, per day irrelevant"), false, "un 503 n'est pas un quota");
});
const CHAIN2 = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const T0 = Date.parse("2026-08-08T18:00:00Z");
const memWith = (models: string[], now: number, nextProbeAt = 0) => ({
  marks: new Map(models.map((m) => [m, markExhausted(new Date(now))] as const)),
  nextProbeAt,
});

test("un modèle épuisé est écarté, l'autre garde sa chance", () => {
  const sel = selectModels(CHAIN2, memWith(["gemini-2.5-flash"], T0), T0);
  assert.deepEqual(sel.models, ["gemini-2.5-flash-lite"], "inutile de retoquer un modèle déjà à sec");
  assert.equal(sel.probing, false);
});
test("tous épuisés : plus aucun appel, mais une sonde périodique", () => {
  const mem = memWith(CHAIN2, T0, T0 + PROBE_INTERVAL_MS);
  assert.deepEqual(selectModels(CHAIN2, mem, T0).models, [], "rien à tenter dans l'immédiat");
  // Quinze minutes plus tard, UNE sonde repart : un faux positif ne peut pas nous
  // rendre aveugles jusqu'au lendemain.
  const later = T0 + PROBE_INTERVAL_MS + 1;
  const probe = selectModels(CHAIN2, mem, later);
  assert.deepEqual(probe.models, ["gemini-2.5-flash"], "on sonde le modèle le moins récemment sondé");
  assert.equal(probe.probing, true);
});
test("la sonde ALTERNE entre les modèles au lieu de toujours tester le même", () => {
  // Sinon un modèle marqué à tort resterait exclu jusqu'à la réinitialisation, sans
  // qu'on lui redonne jamais sa chance.
  const mem = memWith(CHAIN2, T0, 0);
  const first = T0 + PROBE_INTERVAL_MS;
  assert.deepEqual(selectModels(CHAIN2, mem, first).models, ["gemini-2.5-flash"]);
  mem.marks.set("gemini-2.5-flash", { ...mem.marks.get("gemini-2.5-flash")!, probedAt: first });
  mem.nextProbeAt = first + PROBE_INTERVAL_MS;
  const second = first + PROBE_INTERVAL_MS + 1;
  assert.deepEqual(selectModels(CHAIN2, mem, second).models, ["gemini-2.5-flash-lite"], "au tour de l'autre");
});
test("une seule sonde par quart d'heure pour TOUTE la chaîne", () => {
  // Avec un droit de sonde par modèle, deux modèles marqués produisaient deux sondes
  // coup sur coup : autant de requêtes inutiles qu'il y a de modèles, exactement ce
  // qu'on prétendait supprimer.
  const mem = memWith(CHAIN2, T0, 0);
  const at = T0 + PROBE_INTERVAL_MS;
  assert.equal(selectModels(CHAIN2, mem, at).probing, true);
  mem.nextProbeAt = at + PROBE_INTERVAL_MS; // ce que fait la chaîne avant d'appeler
  assert.deepEqual(selectModels(CHAIN2, mem, at + 1).models, [], "pas de seconde sonde dans la foulée");
});
test("après la réinitialisation, la chaîne complète revient d'elle-même", () => {
  const mem = memWith(CHAIN2, T0, 0);
  const after = Date.parse("2026-08-09T07:30:00Z");
  assert.deepEqual(selectModels(CHAIN2, mem, after).models, CHAIN2, "aucun modèle ne doit rester exclu");
});

console.log("\nQUOTA ÉPUISÉ — la chaîne cesse vraiment d'appeler le réseau");
// Ces tests-là passent par generateContent avec un `fetch` factice : ils vérifient le
// COMPORTEMENT (combien d'appels partent), pas seulement les fonctions pures.
process.env.GEMINI_API_KEY ??= "cle-de-test";
const realFetch = globalThis.fetch;
let calls: string[] = [];
function stubFetch(reply: (model: string, n: number) => { status: number; body: string }) {
  calls = [];
  globalThis.fetch = (async (url: unknown) => {
    const model = String(url).match(/models\/([^:]+):/)?.[1] ?? "?";
    calls.push(model);
    const { status, body } = reply(model, calls.length);
    return { ok: status === 200, status, json: async () => JSON.parse(body), text: async () => body } as unknown as Response;
  }) as typeof fetch;
}
const perDay = { status: 429, body: "Quota exceeded for GenerateRequestsPerDay, limit: 20" };
const okBody = { status: 200, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: "séance" }] } }] }) };
const CHAIN = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const gen = () => generateContent([{ role: "user", parts: [{ text: "x" }] }], {}, { models: CHAIN, retriesPerModel: 1 });

/** Variante asynchrone de `test` — sans elle, un échec dans une promesse passerait inaperçu. */
async function atest(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { fails.push(`${name} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${name}`); }
}

// Pas de `await` au sommet du fichier (tsx compile ce test en CJS) : le résumé final
// est donc rattaché à la suite du bloc, sans quoi il s'afficherait avant les résultats.
void (async () => {
  await atest("quota épuisé sur toute la chaîne → l'appel suivant ne touche PAS le réseau", async () => {
    __resetQuotaMemory();
    stubFetch(() => perDay);
    const first = await gen();
    assert.equal(first.ok, false);
    assert.deepEqual(calls, CHAIN, "un essai par modèle, sans réessai sur un plafond journalier");
    assert.equal((first as { dailyExhausted?: boolean }).dailyExhausted, true);

    calls = [];
    const second = await gen();
    assert.deepEqual(calls, [], "AUCUNE requête : c'est tout l'objet de la mémorisation");
    assert.equal(second.ok, false);
    assert.equal((second as { dailyExhausted?: boolean }).dailyExhausted, true);
    // Et on dit la VÉRITÉ à l'appelant : un quota journalier n'est pas une panne
    // « momentanée ». Annoncer « réessayez » à quelqu'un qui ne peut pas avant
    // minuit au Pacifique, c'est inventer une disponibilité qui n'existe pas.
    assert.equal(second.status, 429, "un quota épuisé n'est pas un 503 de saturation");
    assert.match((second as { error: string }).error, /journalier/i);
  });

  await atest("un seul modèle épuisé → l'appel suivant part DIRECTEMENT sur l'autre", async () => {
    __resetQuotaMemory();
    stubFetch((model) => (model === "gemini-2.5-flash" ? perDay : okBody));
    const first = await gen();
    assert.equal(first.ok, true);
    assert.deepEqual(calls, CHAIN, "la première fois, il faut bien découvrir que le premier est à sec");

    calls = [];
    const second = await gen();
    assert.equal(second.ok, true);
    assert.deepEqual(calls, ["gemini-2.5-flash-lite"], "le modèle à sec ne doit plus être retoqué");
  });

  await atest("un plafond PAR MINUTE ne fait poser aucun marqueur", async () => {
    __resetQuotaMemory();
    stubFetch(() => ({ status: 429, body: "GenerateRequestsPerMinute exceeded" }));
    const r = await gen();
    assert.equal(r.ok, false);
    assert.equal(__quotaMemory().size, 0, "une bourrasque d'une minute ne doit pas couper la journée");
    assert.equal((r as { dailyExhausted?: boolean }).dailyExhausted, undefined);
  });

  await atest("la sonde repart après 15 min et réhabilite le modèle qui répond", async () => {
    // Les deux modèles marqués, mais l'heure de sonde est passée : une détection
    // erronée ne doit pas nous rendre aveugles jusqu'au lendemain.
    __resetQuotaMemory();
    const now = Date.now();
    for (const m of CHAIN) __setQuotaMark(m, { until: now + 3600_000, probedAt: now - 3600_000 });
    stubFetch(() => okBody);
    const r = await gen();
    assert.equal(r.ok, true);
    assert.deepEqual(calls, ["gemini-2.5-flash"], "UNE seule sonde, sur le modèle prioritaire");
    assert.equal(__quotaMemory().has("gemini-2.5-flash"), false, "le modèle qui répond est réhabilité");
  });

  await atest("deux visites simultanées ne sondent qu'une fois", async () => {
    // Le droit de sonde est consommé AVANT l'appel : sinon la sonde coûte autant de
    // requêtes qu'il y a d'onglets ouverts, et l'économie disparaît.
    __resetQuotaMemory();
    const now = Date.now();
    for (const m of CHAIN) __setQuotaMark(m, { until: now + 3600_000, probedAt: now - 3600_000 });
    stubFetch(() => perDay);
    await gen();
    const afterProbe = calls.length;
    calls = [];
    await gen();
    assert.equal(afterProbe, 1, "la sonde ne teste QU'UN modèle, pas toute la chaîne");
    assert.deepEqual(calls, [], "la seconde visite ne re-sonde pas dans la foulée");
  });

  await atest("sans quota épuisé, le comportement d'avant est inchangé", async () => {
    __resetQuotaMemory();
    stubFetch(() => okBody);
    const r = await gen();
    assert.equal(r.ok, true);
    assert.deepEqual(calls, ["gemini-2.5-flash"], "le modèle prioritaire répond, on s'arrête là");
    assert.equal(__quotaMemory().size, 0);
  });
})().then(() => {
  globalThis.fetch = realFetch;
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
});
