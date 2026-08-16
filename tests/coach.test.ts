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
import { isRun, sportOf, impactOf, roleOf } from "../src/lib/intervals/sport";
import { summarizeCross } from "../src/lib/coach/crossTraining";
import { computeQualityBudget } from "../src/lib/coach/qualityBudget";
import { shardForPass, replanIfFresh } from "../src/lib/intervals/syncAndCoach";
import { buildPlanReadyEmail } from "../src/lib/notify/planReady";
import { poseAt, capLisse } from "../src/lib/segments/flyover";
import { contientGrosMot, premierGrosMot, NB_FORMES_SURVEILLEES } from "../src/lib/social/moderation";
import { avertissementAge, avertissementsAge, kmEffort } from "../src/lib/coach/ageDistance";
import { etatDouble, scinderFacile, seanceDoubleSeuil, AVERTISSEMENT_LACTATE } from "../src/lib/coach/doubleSessions";
import { oneSessionPerSlot, slotKey } from "../src/lib/coach/sessions";
import { vmaFromPaceCurve, bestVmaFromWorkouts, effectiveVma, dureeEnConditionsNeutres, PART_PENALITE_CHALEUR, pctVmaForDistance, easyPaceFromHeartRate, MIN_SEANCES_ALLURE_Z2, LONG_RUN_PRET_KM, LONG_RUN_PLANCHER_KM } from "../src/lib/running/fitness";
import { heatAdvice, windAdvice, altitudeLossPct, heatAcclimation } from "../src/lib/weather/openMeteo";
import { parseReps, parsePaceSec, stepsForType, warmCoolMin, buildWorkoutDescription } from "../src/lib/watch/intervals";
import { buildWeekPlan, CONFIRMED_DAYS } from "../src/lib/ai/autoPlan";
import { tr, ALL_LANGS, nRaw } from "../src/lib/i18n/multi";
// `T` est déjà pris plus bas dans ce fichier (une date) → alias explicite.
import { T as T_UI } from "../src/lib/i18n/translations";
import { LANDING as LANDING_T } from "../src/components/landing/landingI18n";
import { accesDe, peut, motifRefus, JOURS_ESSAI } from "../src/lib/billing/access";
import { TARIFS, FORMULES, accesDuPrice } from "../src/lib/stripe/client";
import { PLAFOND_JOUR } from "../src/lib/billing/aiQuota";
import { ppsExpiration, ppsVerdict, ppsDemandeAction, couvertureCourses, PPS_URL, PPS_PRIX_EUR, PPS_VALIDITE_MOIS } from "../src/lib/pps/status";
import { PPS_T } from "../src/lib/pps/ppsI18n";
import { PLAN_T, libelleType } from "../src/lib/ai/planI18n";
import { QUALITE_T } from "../src/lib/ai/qualityI18n";
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
import { reponseImmediate } from "../src/lib/support/fallback";
import {
  canonical, fingerprint, isCacheUsable, PROFILE_FINGERPRINT_COLUMNS, type SessionSignals,
} from "../src/lib/ai/sessionCache";
import {
  nextQuotaResetUtc, markExhausted, isExpired, selectModels, isDailyQuotaError, PROBE_INTERVAL_MS,
} from "../src/lib/ai/quotaMemory";
import { generateContent, __resetQuotaMemory, __quotaMemory, __setQuotaMark } from "../src/lib/ai/gemini";
import {
  canSee, canComment, cleanBody, isPublishable, statLine, paceOf, suggestable, timeAgo, likesLabel,
  type Post as SocialPost,
} from "../src/lib/social/feed";
import {
  computeTrophies, chronoRecords, longestStreak, type TrophyWorkout as TW,
} from "../src/lib/trophies/compute";
import {
  haversine, simplify, encodePolyline, decodePolyline, bboxOverlap, elevationGain, type TrackPoint as TP,
} from "../src/lib/segments/geo";
import { findEfforts, leaderboard, maitreDuSegment } from "../src/lib/segments/match";
import { heatCells, intensity, denseBounds, heatBounds, type HeatCell as HC } from "../src/lib/segments/heatmap";
import { computeSplits, splitPace, elevationProfile, metricSeries } from "../src/lib/segments/splits";
import { challengeProgress, challengeLeaderboard, daysLeft, notStarted, inWindow, type Challenge } from "../src/lib/challenges/progress";
import {
  computeStreak, decaleJour, ecartJours, acwrAu, jourLocal,
  type StreakWorkout as SW,
} from "../src/lib/streak/compute";

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
    weekPlan: { qBudget: 2, quality: [qual("VMA", "VMA courte : 10×400 m à ~3'20/km, récup 45 s")], easyPace: "4'52", eased: false },
    longRunMode: "run", macroPlan: [{ week: 1, phase: "Développement", volumeKm: 50, quality: ["VMA"], longRunKm: 16, focus: "" }],
    readiness: { level: "vert", ...motifs(), advice: "" },
    volume: { weekKm: 50, avg4wkKm: 48, targetKm: 50, longRunKm: 16 },
    cycle: { deload: false, taper: false, label: "" }, skippedWeekdays: [],
    availability: { daysPerWeek: 6, days: [0, 1, 2, 3, 4, 5, 6] },
    forecast: [], tooMuchIntensity: null, hillyTraining: false,
    altitude: { elevationM: null, lossPct: 0 }, warmCool: { warm: 15, cool: 10 },
    heatAcclim: { hotDays: 0, factor: 1, label: "non acclimaté" },
  } as unknown as AthleteContext;
  return { ...base, ...over };
}
/** Motifs de fraîcheur d'un contexte de test : français canonique + les 4 traductions.
 *  Sans `reasonsAll`, le plan retomberait sur le français dans toutes les langues et un
 *  test « aucune phrase à moitié française » passerait pour de mauvaises raisons. */
const motifs = (...xs: string[]) => ({ reasons: xs, reasonsAll: xs.map((x) => tr(() => x)) });
/** Séance de qualité de test SANS traduction — modélise un contexte sérialisé par une
 *  version antérieure : le plan doit alors retomber sur le français, pas sur du vide. */
const qual = (type: string, desc: string) => ({ type, desc, descAll: tr(() => desc) });
/** Séance de qualité de test issue du VRAI menu, donc réellement traduite. */
const qualT = (type: string, gabarit: (l: "fr" | "en" | "de" | "es" | "pt") => string) =>
  ({ type, desc: gabarit("fr"), descAll: tr(gabarit) });

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
  const p = buildWeekPlan(ctx({ readiness: { level: "rouge", ...motifs("test"), advice: "" } } as never), new Date());
  assert.ok(!/VMA|Seuil|Spécifique|Sortie longue/.test(p[0].type), `jour 0 = ${p[0].type}`);
});
test("une qualité annulée par la fraîcheur est DÉCALÉE, pas supprimée", () => {
  const p = buildWeekPlan(ctx({ readiness: { level: "rouge", ...motifs("test"), advice: "" } } as never), new Date());
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
import { createHash } from "node:crypto";
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
  // Le contrat a changé : une périodicité seule ne désigne plus un tarif depuis qu'il y
  // a DEUX formules. Le client envoie donc `formule` ET `periode`, et les deux doivent
  // être validées — un `priceId` construit à partir d'une entrée non vérifiée laisserait
  // choisir son tarif à l'acheteur.
  assert.ok(/estFormule\(formule\)/.test(src) && /estPeriode\(periode\)/.test(src),
    "la formule ET la périodicité reçues du client doivent être validées");
  assert.ok(/priceIdDe\(formule, periode\)/.test(src), "le tarif doit être résolu côté serveur");
});
test("la formule vendue est celle qui est ACCORDÉE", () => {
  // Le webhook écrivait « pro » EN DUR quelle que soit la formule payée : un athlète qui
  // prenait Essentiel obtenait l'IA, et l'écart de 5 € entre les deux formules ne voulait
  // plus rien dire. Un abonnement encaissé, un accès offert.
  const wh = codeOf("src/app/api/stripe/webhook/route.ts");
  assert.ok(!/subscription_tier: \[[^\]]*\]\.includes\(sub\.status\) \? "pro"/.test(wh),
    "le webhook accorde encore « pro » en dur, sans regarder le tarif acheté");
  assert.ok(/accesDuPrice\(/.test(wh), "la formule doit se lire sur le tarif acheté");
  // Et la correspondance tarif → accès doit exister pour les quatre combinaisons.
  for (const f of FORMULES) for (const p of ["mois", "an"] as const) {
    assert.ok(TARIFS[f][p].env.startsWith("STRIPE_PRICE_"), `${f}/${p} : variable de tarif mal nommée`);
  }
  assert.equal(TARIFS.starter.acces, "starter");
  assert.equal(TARIFS.premium.acces, "premium");
  // Un tarif inconnu retombe sur « complet », JAMAIS sur un accès vide : quelqu'un qui a
  // payé ne doit pas se retrouver sans rien parce qu'une variable d'environnement manque.
  assert.equal(accesDuPrice(null), "premium");
  assert.equal(accesDuPrice("price_inconnu"), "premium");
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
  // L'arbitrage a été extrait de coachContext vers lib/coach/qualityBudget pour être
  // testable ; l'ordre à protéger, lui, est le même.
  const src = readFileSync("src/lib/coach/qualityBudget.ts", "utf8");
  const iFloor = src.indexOf("if (inPrep && !i.noHistory && !alarm");
  const iCap = src.indexOf("i.weightLossMaxQuality");
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
    readiness: { level: "rouge", ...motifs("ratio aigu:chronique 2,4 (zone de risque de blessure)"), advice: "" },
    volume: { weekKm: 62, avg4wkKm: 40, targetKm: 40, longRunKm: 16, longRunPlanned: 26, longRunEased: true },
    weekPlan: { qBudget: 0, quality: [], easyPace: "4'52", eased: true, floored: false },
  });
  // DÉFAUT RÉEL trouvé un dimanche : la sortie longue va de préférence sur un dimanche,
  // or un dimanche le dimanche EST le jour 0 — que l'étape 7 convertit en récupération
  // quand la fraîcheur est au rouge. L'athlète perdait sa sortie longue pour les sept
  // jours, en silence, et seulement un jour sur sept. On vérifie donc les SEPT jours de
  // départ possibles, pas celui de l'exécution.
  for (const depart of ["2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22"]) {
    const p = buildWeekPlan(c, new Date(`${depart}T09:00:00`));
    const jour = new Date(`${depart}T09:00:00`).toLocaleDateString("fr-FR", { weekday: "long" });
    assert.ok(p.some((d) => d.type === "Sortie longue"), `départ ${jour} : la sortie longue a disparu de la semaine`);
    assert.ok(p[0].type !== "Sortie longue", `départ ${jour} : la sortie longue est posée sur le jour 0, que le rouge va écraser`);
  }
  const long = buildWeekPlan(c, new Date("2026-08-19T09:00:00")).find((d) => d.type === "Sortie longue");
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
/** Source SQL débarrassée de ses commentaires `--`, même raison que `codeOf`. */
function sqlOf(path: string): string {
  return readFileSync(path, "utf8")
    .split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nPLAN TRADUIT — l'athlète lit sa langue, la montre lit le français");
// Défaut corrigé : l'interface était traduite en 5 langues et le PLAN restait
// intégralement français — c'est-à-dire la seule chose que l'athlète vient lire.
// Le piège, lui, est que `lib/watch/intervals.ts` FABRIQUE la séance Garmin en
// analysant cette prose française (« corps : », « récup », « seuil », « N×D à A »).
// Traduire le texte lu par la montre casserait la poussée EN SILENCE.

/** Contexte de test riche : qualité, sortie longue, météo, doubles, motifs de fatigue. */
const ctxTraduit = () => ctx({
  weekPlan: { qBudget: 2, quality: [
    qualT("VMA", (l) => QUALITE_T[l].vmaCourte(10, "3'20")),
    qualT("Seuil", (l) => QUALITE_T[l].seuilReference(3, 10, "4'00")),
  ], easyPace: "4'52", eased: false, floored: false },
  hillyTraining: true,
  cycle: { deload: true, taper: false, label: "" },
  tooMuchIntensity: 29,
  forecast: Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      tempMax: 31, tempMin: 20, feelsMax: 33, humidity: 75, precipMm: 0, windMaxKmh: 38 };
  }),
} as never);

/** Ce qu'`autoCoach` envoie réellement à la montre pour un jour donné. */
const versMontre = (d: { title: string; detail: string; type: string; tags: string[] }) =>
  buildWorkoutDescription(d.title, d.detail, `${d.type} ${d.tags.join(" ")}`, null, 17.6, 15, 10);

test("les champs poussés sur la montre restent en FRANÇAIS, quelle que soit la langue", () => {
  // `lib/watch/intervals.ts` fabrique les étapes Garmin en analysant cette prose :
  // « corps : », « récup », « seuil », « repos », « N×DISTANCE à ALLURE ». Si `detail`
  // ou `title` bascule un jour dans la langue de l'athlète, la poussée montre se met à
  // renvoyer null ou des étapes fausses — sans lever la moindre erreur.
  const semaine = buildWeekPlan(ctxTraduit(), new Date());
  for (const j of semaine) {
    const canon = `${j.title} ${j.detail}`;
    assert.ok(/Échauffement|Repos|Corps :|Récupération|Renforcement|Sortie longue|Footing|Séance/.test(canon),
      `${j.type} : le texte canonique n'est plus français — « ${canon.slice(0, 100)} »`);
    for (const l of ["en", "de", "es", "pt"] as const) {
      assert.notEqual(j.i18n?.[l]?.detail, j.detail,
        `${l}/${j.type} : la traduction est identique au canonique — soit elle manque, soit le canonique a été traduit`);
    }
  }
});

test("le coach autonome pousse les champs CANONIQUES, jamais la traduction", () => {
  // C'est le seul endroit où la confusion serait fatale : `autoCoach` construit la
  // séance Garmin. Elle doit lire `d.title`/`d.detail`, jamais `d.i18n`.
  const src = codeOf("src/lib/ai/autoCoach.ts");
  const appel = src.match(/buildWorkoutDescription\(([\s\S]*?)\)/)?.[1] ?? "";
  assert.ok(appel.includes("d.title") && appel.includes("d.detail"),
    `la poussée montre doit partir des champs canoniques — trouvé « ${appel.slice(0, 120)} »`);
  assert.ok(!/i18n/.test(appel), "la poussée montre ne doit JAMAIS lire une traduction");
});



test("pousser le texte TRADUIT sur la montre casserait bien quelque chose", () => {
  // Sans ce test, le précédent serait vrai pour de mauvaises raisons : il faut
  // démontrer que la séparation est PORTEUSE, pas décorative. On vérifie donc qu'au
  // moins une séance perd ses étapes ou en change si on pousse la version allemande.
  const semaine = buildWeekPlan(ctxTraduit(), new Date());
  const casse = semaine.some((j) => {
    const de = j.i18n?.de;
    if (!de) return false;
    const attendu = versMontre(j);
    const obtenu = versMontre({ title: de.title, detail: de.detail, type: j.type, tags: j.tags });
    return JSON.stringify(attendu) !== JSON.stringify(obtenu);
  });
  assert.ok(casse, "si traduire le detail ne changeait rien pour la montre, l'analyseur ne lirait plus la prose — vérifier lib/watch/intervals.ts");
});

test("le français n'est jamais dupliqué dans les traductions", () => {
  // Deux copies du français = deux vérités, et celle qu'on oublie de mettre à jour
  // finit par contredire l'autre. Le français vit dans les champs de premier niveau.
  for (const j of buildWeekPlan(ctxTraduit(), new Date())) {
    assert.ok(j.i18n && !("fr" in j.i18n), `${j.type} : le français est dupliqué dans i18n`);
    for (const l of ["en", "de", "es", "pt"] as const) {
      assert.ok(j.i18n?.[l], `${j.type} : traduction ${l} manquante`);
    }
  }
});

test("aucune langue ne laisse passer « undefined », une clé brute ou du vide", () => {
  for (const j of buildWeekPlan(ctxTraduit(), new Date())) {
    // Le français d'abord : c'est lui qui part sur la montre, une étiquette vide y
    // passerait inaperçue jusque sur le calendrier de l'athlète.
    for (const [champ, v] of [["title", j.title], ["detail", j.detail], ["why", j.why]] as const) {
      assert.ok(v && v.trim().length > 0, `fr/${j.type} : ${champ} vide`);
      assert.ok(!/undefined|\bNaN\b|\[object |\$\{/.test(v), `fr/${j.type} : ${champ} contient un reste technique`);
    }
    assert.ok(j.tags.length > 0 && j.tags.every((x) => x.trim().length > 0), `fr/${j.type} : étiquette vide`);
    for (const l of ["en", "de", "es", "pt"] as const) {
      const t = j.i18n![l]!;
      for (const [champ, v] of [["title", t.title], ["detail", t.detail], ["why", t.why]] as const) {
        assert.ok(v && v.trim().length > 0, `${l}/${j.type} : ${champ} vide`);
        assert.ok(!/undefined|\bNaN\b|\[object |\$\{/.test(v), `${l}/${j.type} : ${champ} contient un reste technique — « ${v.slice(0, 90)} »`);
      }
      assert.ok(t.tags.length > 0 && t.tags.every((x) => x.trim().length > 0), `${l}/${j.type} : étiquette vide`);
    }
  }
});

/** Mots qui n'existent QUE dans la version française : les voir ailleurs, c'est une
 *  phrase à moitié traduite — le défaut le plus probable d'une traduction par gabarits. */
const MARQUEURS_FR = [
  "Échauffement", "Retour au calme", "Corps :", "séance", "footing", "allure",
  "récup", "jambes", "environ", "d'un tiers", "Repos.", "tenir une conversation",
  "ratio aigu:chronique", "sommeil dégradé", "Vent de", "renonce au fractionné",
  "trottin", "montée", "Côtes", "en partant à", "alternant", "d'un bloc", "sortie longue",
];

test("aucune phrase à moitié française dans les autres langues", () => {
  // Le vrai risque de cette traduction : un « pourquoi » allemand qui bascule en
  // français au milieu, parce qu'un motif de fatigue ou une note météo n'a pas suivi.
  const marqueursFr = MARQUEURS_FR;
  const c = ctxTraduit();
  // ⚠️ PAS le helper `motifs()` ici : il recopie la phrase FRANÇAISE dans les cinq
  // langues (son commentaire l'assume). Le plan cite ces motifs dans le « pourquoi »
  // d'une sortie longue raccourcie — le test trouvait donc le français qu'il avait
  // lui-même injecté, et accusait le produit. Il faut de vraies traductions pour que
  // l'assertion porte sur ce qu'elle prétend.
  const trad = (fr: string, en: string, de: string, es: string, pt: string) => ({ fr, en, de, es, pt });
  (c as unknown as { readiness: { level: string; reasons: string[]; reasonsAll: unknown[]; advice: string } }).readiness = {
    level: "orange",
    reasons: ["ratio aigu:chronique 1,9 (zone de risque de blessure)", "sommeil dégradé (58/100)"],
    reasonsAll: [
      trad("ratio aigu:chronique 1,9 (zone de risque de blessure)", "acute:chronic ratio 1.9 (injury risk zone)",
           "Akut-zu-chronisch-Verhältnis 1,9 (Verletzungsrisiko)", "ratio agudo:crónico 1,9 (zona de riesgo de lesión)",
           "rácio agudo:crónico 1,9 (zona de risco de lesão)"),
      trad("sommeil dégradé (58/100)", "degraded sleep (58/100)", "verschlechterter Schlaf (58/100)",
           "sueño degradado (58/100)", "sono degradado (58/100)"),
    ],
    advice: "",
  } as never;
  // Date FIGÉE. Avec `new Date()`, ce test ne voyait le chemin « sortie longue
  // raccourcie » que les jours où la sortie longue tombe hors du jour 0 : il ne
  // rougissait donc qu'un jour sur sept, au hasard du calendrier de l'exécution.
  for (const j of buildWeekPlan(c, new Date("2026-08-19T09:00:00"))) {
    for (const l of ["en", "de", "es", "pt"] as const) {
      const t = j.i18n![l]!;
      const texte = `${t.title} ${t.detail} ${t.why} ${t.tags.join(" ")}`;
      for (const m of marqueursFr) {
        assert.ok(!texte.includes(m), `${l}/${j.type} : reste du français (« ${m} ») dans « ${texte.slice(0, 120)}… »`);
      }
    }
  }
});

/** Libellés identiques d'une langue à l'autre POUR DE BONNES RAISONS : ce sont des noms
 *  de format universels, pas des oublis de traduction. Toute autre égalité est un oubli. */
const LIBELLES_PARTAGES = new Set(["30/30", "Over-under", "Pyramide", "Fartlek libre"]);

test("les 27 séances de qualité existent dans les 5 langues, et disent autre chose", () => {
  // Le menu de qualité tourne : un variant non traduit ne se verrait qu'une semaine
  // sur huit, en production, chez un athlète étranger.
  const cles = Object.keys(QUALITE_T.fr).filter((k) => k !== "objectif");
  assert.ok(cles.length >= 27, `menu de qualité incomplet : ${cles.length} formats`);
  for (const k of cles) {
    const rendus = ALL_LANGS.map((l) => {
      const v = (QUALITE_T[l] as unknown as Record<string, unknown>)[k];
      return typeof v === "function" ? String((v as (...a: unknown[]) => string)(6, 10, "4'00", "3'50")) : String(v);
    });
    for (const [i, r] of rendus.entries()) {
      const l = ALL_LANGS[i];
      assert.ok(r.trim().length > 0 && !/undefined/.test(r), `${k}/${l} : rendu vide ou incomplet`);
      if (l === "fr") continue;
      // Unicité ne suffit pas : une phrase à MOITIÉ traduite reste unique. On compare
      // donc au LIBELLÉ FRANÇAIS du même format — dérivé du dictionnaire, pas d'une
      // liste écrite à la main qui prendrait du retard à chaque format ajouté.
      const libelleFr = rendus[0].split(/\s*[:：]/)[0].trim();
      if (!LIBELLES_PARTAGES.has(libelleFr)) {
        assert.notEqual(r.split(/\s*[:：]/)[0].trim(), libelleFr,
          `${k}/${l} : le libellé est resté en français — « ${r.slice(0, 90)} »`);
      }
      for (const m of MARQUEURS_FR) {
        assert.ok(!r.includes(m), `${k}/${l} : reste du français (« ${m} ») dans « ${r.slice(0, 90)} »`);
      }
      // L'anglais et l'allemand n'ont aucune raison de porter un accent français.
      if (l === "en" || l === "de") {
        assert.ok(!/[àâçèéêëîïôùûœ]/i.test(r), `${k}/${l} : accent français dans « ${r.slice(0, 90)} »`);
      }
    }
    assert.equal(new Set(rendus).size, 5, `${k} : deux langues rendent le même texte — traduction manquante`);
  }
});

test("le vocabulaire traduit reste lisible par l'affichage du calendrier", () => {
  // `CalendarView.extractBody()` isole l'échauffement et le retour au calme par
  // expression régulière, dans les 5 langues. Une traduction qui s'en écarterait
  // ferait réapparaître l'échauffement au milieu du corps de séance affiché —
  // sans erreur, juste un texte faux.
  const isWarm = /échauff|warm[- ]?up|aufwärm|calent|aquec/i;
  const isCool = /retour au calme|cool[- ]?down|auslauf|vuelta a la calma|retorno|à la calma|\bcalma\b/i;
  const corps = /(?:corps|main\s*set|hauptteil|parte\s+principal)\s*[:：]/i;
  for (const j of buildWeekPlan(ctxTraduit(), new Date())) {
    if (!/Endurance|Sortie longue|VMA|Seuil|Spécifique|Récup/.test(j.type)) continue;
    for (const l of ["en", "de", "es", "pt"] as const) {
      const segs = j.i18n![l]!.detail.split("→").map((x) => x.trim());
      assert.ok(isWarm.test(segs[0]), `${l}/${j.type} : échauffement non reconnu — « ${segs[0].slice(0, 60)} »`);
      assert.ok(segs.some((x) => corps.test(x)), `${l}/${j.type} : libellé du corps de séance non reconnu`);
      assert.ok(segs.some((x) => isCool.test(x)), `${l}/${j.type} : retour au calme non reconnu`);
    }
  }
});

test("les nombres restent DANS la phrase traduite", () => {
  // Une consigne privée de ses chiffres n'apprend rien : « fais des fractionnés »
  // n'est pas une séance. C'est la règle qui distingue une traduction d'un résumé.
  const semaine = buildWeekPlan(ctxTraduit(), new Date());
  const qualite = semaine.find((d) => /VMA|Seuil/.test(d.type));
  assert.ok(qualite, "le contexte de test doit poser une séance de qualité");
  for (const l of ["en", "de", "es", "pt"] as const) {
    const d = qualite!.i18n![l]!.detail;
    assert.ok(/\d+×\d+/.test(d), `${l} : les répétitions ont disparu — « ${d.slice(0, 100)} »`);
    assert.ok(/\d+['’:]\d{2}\/km/.test(d), `${l} : l'allure a disparu — « ${d.slice(0, 100)} »`);
  }
});

test("les décimales françaises s'écrivent avec une VIRGULE, et la montre les lit encore", () => {
  // Le plan écrivait « ~17.85 km » à un lecteur français : le point décimal de
  // JavaScript, invisible tant que les distances tombent rondes — ce qui est le cas la
  // plupart du temps, et exactement pourquoi personne ne l'avait vu.
  assert.equal(nRaw(17.85, "fr"), "17,85");
  assert.equal(nRaw(17.85, "en"), "17.85");
  assert.equal(nRaw(17.85, "de"), "17,85");
  assert.equal(nRaw(21, "fr"), "21", "un entier ne gagne pas de décimale");
  // Pas de séparateur de milliers : c'est une espace insécable fine en français, qui
  // couperait le motif en deux au moment de l'analyse.
  assert.ok(!/\s/.test(nRaw(1200, "fr")), `« ${nRaw(1200, "fr")} » contient une espace`);

  // LE POINT QUI COMPTE : les deux analyseurs de prose acceptent la virgule.
  const b = parseReps("Corps : 3×2,5 km à ~4'00/km, récup 2 min", null);
  assert.ok(b && b.reps === 3, "parseReps ne lit plus une distance à virgule");
  assert.equal(Math.round(b!.workSec), 600, "2,5 km à 4'00/km = 600 s");
});

test("une sortie longue à distance décimale produit les MÊMES étapes montre", () => {
  // La virgule ne doit rien changer à ce que reçoit Garmin.
  const virgule = buildWorkoutDescription("Sortie longue",
    "Échauffement 15 min progressif FC Z1→Z2 → Corps : ~17,85 km (environ 1h35) en Z2 (~5'20/km) → Retour au calme 10 min FC Z1.",
    "Sortie longue Long Z2", null, 17.6, 15, 10);
  const point = buildWorkoutDescription("Sortie longue",
    "Échauffement 15 min progressif FC Z1→Z2 → Corps : ~17.85 km (environ 1h35) en Z2 (~5'20/km) → Retour au calme 10 min FC Z1.",
    "Sortie longue Long Z2", null, 17.6, 15, 10);
  assert.ok(virgule && point);
  assert.equal(virgule!.description.split("\n\n")[1], point!.description.split("\n\n")[1],
    "les étapes de montre diffèrent selon le séparateur décimal");
});

test("le catalogue de séances n'alimente QUE le prompt du modèle", () => {
  // Pourquoi ce test existe : `data/workoutLibrary.ts` ressemble à un catalogue
  // affichable, et il ne l'est pas — il n'est lu que par `buildSessionCatalog`, dont la
  // sortie part dans `ctx.text`, c'est-à-dire dans le prompt. Le traduire n'aurait aucun
  // intérêt et dégraderait les réponses du modèle. Si un écran vient un jour s'y brancher,
  // il faudra le traduire : ce test le signalera au lieu de laisser passer du français.
  const consommateurs = execSync("grep -rl 'workoutLibrary' src --include='*.ts' --include='*.tsx' || true")
    .toString().trim().split("\n").filter(Boolean).filter((f) => f !== "src/data/workoutLibrary.ts");
  assert.deepEqual(consommateurs, ["src/lib/ai/coachContext.ts"],
    `le catalogue a de nouveaux lecteurs : ${consommateurs.join(", ")} — s'ils affichent, il faut le traduire`);
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.ok(/const catalog = buildSessionCatalog\(/.test(src) && /\$\{catalog\}/.test(src),
    "le catalogue doit rester une variable injectée dans le prompt, pas exposée au contexte");
  assert.ok(!/catalog,/.test(src), "le catalogue ne doit pas être exposé dans AthleteContext (donc pas à l'écran)");
});

test("le TYPE de séance est affiché traduit, alors qu'il reste français en donnée", () => {
  // Défaut réel, trouvé en regardant l'écran et pas le code : le calendrier affichait
  // `s.type` BRUT. Un athlète allemand lisait « SORTIE LONGUE » en gras au-dessus d'un
  // texte entièrement allemand. La donnée, elle, doit rester française — c'est elle qui
  // décide de la catégorie, de la couleur et de la séance poussée sur la montre.
  const TYPES = ["Course", "Récup", "Repos", "Vélo", "Sortie longue", "VMA", "Seuil", "Spécifique", "Endurance", "Renfo"];
  for (const t of TYPES) {
    for (const l of ALL_LANGS) {
      const v = libelleType(t, l);
      assert.ok(v && v.trim().length > 0, `${l}/${t} : libellé vide`);
    }
    // Chaque type doit être RÉELLEMENT traduit en allemand — sinon c'est un oubli, pas
    // un choix. (Les sigles VO2max/VAM sont volontairement identiques dans plusieurs
    // langues, on ne les compare donc pas au français.)
    if (!["VMA"].includes(t)) {
      assert.notEqual(libelleType(t, "de"), libelleType(t, "fr"), `« ${t} » n'est pas traduit en allemand`);
    }
  }
  // Un type inconnu (séance publiée à la main) est rendu tel quel, jamais vide.
  assert.equal(libelleType("Séance", "de"), "Séance");
  // Et la précision ne régresse pas : « Spécifique » et « Course » ne doivent pas
  // retomber sur le même libellé que « Endurance », ce que ferait la catégorie seule.
  for (const l of ALL_LANGS) {
    assert.notEqual(libelleType("Spécifique", l), libelleType("Endurance", l), `${l} : Spécifique confondu avec Endurance`);
    assert.notEqual(libelleType("Course", l), libelleType("Endurance", l), `${l} : Course confondue avec Endurance`);
  }
});

test("le calendrier n'affiche AUCUN type brut", () => {
  // C'est la cause racine : `{s.type}` posé directement dans le JSX. Le test lit la
  // source parce qu'aucune assertion de données ne peut attraper une erreur de rendu.
  const src = codeOf("src/components/training/CalendarView.tsx");
  assert.ok(!/>\{s\.type\}</.test(src) && !/\{coach\.type\}/.test(src),
    "un type de séance est rendu brut : il s'affichera en français dans les 5 langues");
  // Le calendrier affiche DEUX types : celui de la séance et celui de la prescription du
  // coach. Chercher « libelleType( » n'importe où laissait passer la régression de l'un
  // des deux — et c'était exactement le défaut d'origine, un seul des deux affichages
  // restant en français dans les cinq langues.
  assert.equal((src.match(/libelleType\(/g) ?? []).length, 2, "les DEUX types affichés doivent être traduits");
  assert.ok(/libelleType\(s\.type/.test(src), "le type de la séance n'est plus traduit");
  assert.ok(/libelleType\(coach\.type/.test(src), "le type prescrit par le coach n'est plus traduit");
});

test("une langue inconnue retombe sur le français, jamais sur du vide", () => {
  assert.equal(PLAN_T["fr"].reposTitre, "Repos");
  assert.equal(heatAdvice(31, 80, "kl" as never).note, heatAdvice(31, 80).note,
    "une langue inconnue doit donner la note française, pas une note vide");
  assert.ok(heatAdvice(31, 80, "de").note.length > 0 && heatAdvice(31, 80, "de").note !== heatAdvice(31, 80).note,
    "l'allemand doit bien donner une autre note");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nALLURE DE FOOTING — définie par la FC, pas par un % de VMA");
// Défaut réel qui se mordait la queue : l'allure facile était déduite de 70 % de VMA.
// Mesuré sur 99 séances en zone 2 du compte de production : l'athlète y court à 4'59/km
// quand le modèle lui en prescrivait 4'26 — soit sa zone 3. L'application lui reprochait
// donc de « courir ses footings trop vite » TOUT EN lui prescrivant l'allure qui l'y
// envoyait.

const Z2 = (n: number, secParKm: number, temp: number | null = 15) =>
  Array.from({ length: n }, () => ({ distance_km: 10, duration_seconds: secParKm * 10, avg_hr: 155, weather_temp_c: temp }));

test("l'allure facile sort des séances RÉELLEMENT courues en zone 2", () => {
  // FC max 212, repos 47 → zone 2 Karvonen = 146-163 bpm. 155 bpm est dedans.
  assert.equal(easyPaceFromHeartRate(Z2(10, 300), 212, 47), 300);
});

test("les séances hors zone 2 ne comptent pas", () => {
  // 175 bpm = zone 3 : une allure tenue là n'est pas une allure de footing.
  const z3 = Array.from({ length: 10 }, () => ({ distance_km: 10, duration_seconds: 2600, avg_hr: 175, weather_temp_c: 15 }));
  assert.equal(easyPaceFromHeartRate(z3, 212, 47), null, "la zone 3 ne doit pas définir le footing");
});

test("sans assez d'historique, on ne conclut pas — on le dit", () => {
  assert.equal(easyPaceFromHeartRate(Z2(MIN_SEANCES_ALLURE_Z2 - 1, 300), 212, 47), null);
  assert.ok(easyPaceFromHeartRate(Z2(MIN_SEANCES_ALLURE_Z2, 300), 212, 47) != null);
  // Sans FC max ou FC repos, aucune zone n'est calculable : pas de mesure inventée.
  assert.equal(easyPaceFromHeartRate(Z2(10, 300), null, 47), null);
  assert.equal(easyPaceFromHeartRate(Z2(10, 300), 212, null), null);
});

test("une valeur aberrante ne déplace pas l'allure (médiane, pas moyenne)", () => {
  // Un GPS qui déraille sur une sortie ne doit pas fausser l'allure de tout un plan.
  const avec = [...Z2(9, 300), { distance_km: 10, duration_seconds: 60, avg_hr: 155, weather_temp_c: 15 }];
  assert.equal(easyPaceFromHeartRate(avec, 212, 47), 300);
});

test("l'allure renvoyée est NEUTRE — le plan rajoute la météo du jour par-dessus", () => {
  // Sinon la chaleur serait comptée deux fois : une fois dans la mesure, une fois dans
  // la prescription. L'athlète recevrait une allure doublement ralentie.
  const chaud = easyPaceFromHeartRate(Z2(10, 300, 31), 212, 47)!;
  assert.ok(chaud < 300, "un footing tenu à 31 °C valait mieux que son chrono");
});

console.log("\nPRONOSTIC LONGUE DISTANCE — le socle d'endurance décide");
test("le marathon dépend de la plus longue sortie, pas d'une constante", () => {
  // Un coureur à 150 km/sem avec des sorties de 32 km ne tient pas le même pourcentage
  // qu'un cardio équivalent dont la plus longue sortie fait 21 km. C'est ce que modélise
  // le prédicteur Garmin, et c'est pourquoi nos pronostics s'en écartaient toujours du
  // même côté — l'optimiste.
  const bas = pctVmaForDistance(42.195, LONG_RUN_PLANCHER_KM);
  const pret = pctVmaForDistance(42.195, LONG_RUN_PRET_KM);
  assert.ok(pret > bas, "une préparation aboutie doit valoir mieux qu'un plancher");
  assert.equal(Math.round(bas * 1000) / 10, 75);
  assert.equal(Math.round(pret * 1000) / 10, 79);
  // Au-delà de la référence, on plafonne : 40 km de sortie longue ne rend pas le
  // marathon plus facile que la physiologie ne le permet.
  assert.equal(pctVmaForDistance(42.195, 40), pret);
  // En dessous du plancher non plus, on ne descend pas indéfiniment.
  assert.equal(pctVmaForDistance(42.195, 10), bas);
});

test("sans sortie longue connue, on ne suppose RIEN", () => {
  // Supposer une préparation aboutie serait le sens d'erreur le plus coûteux.
  assert.equal(pctVmaForDistance(42.195), pctVmaForDistance(42.195, LONG_RUN_PLANCHER_KM));
  assert.equal(pctVmaForDistance(42.195, null), pctVmaForDistance(42.195, LONG_RUN_PLANCHER_KM));
});

test("les courtes distances ne dépendent PAS du socle d'endurance", () => {
  // Sur 5 et 10 km c'est la VMA qui décide, et nos coefficients y tombent déjà à 8 et
  // 20 s des pronostics Garmin : y toucher dégraderait ce qui marche.
  for (const km of [1, 5, 10, 21.0975]) {
    assert.equal(pctVmaForDistance(km, 15), pctVmaForDistance(km, 40), `${km} km ne doit pas bouger avec la sortie longue`);
  }
});

test("lire une performance ne suppose aucune préparation", () => {
  // `vmaFromEffort` ne doit pas appliquer le bonus de socle : on lit ce qui a été fait,
  // on ne récompense pas l'athlète d'avoir un gros volume.
  const code = codeOf("src/lib/running/fitness.ts");
  const appel = code.match(/speed \/ pctVmaForDistance\(([^)]*)\)/)?.[1] ?? "";
  assert.equal(appel.trim(), "distanceKm", `vmaFromEffort passe « ${appel} » à pctVmaForDistance`);
});

console.log("\nCHALEUR — une performance se lit DANS SES CONDITIONS");
// Défaut réel : l'app corrigeait les allures qu'elle PRESCRIT pour la chaleur, mais
// jamais celles qu'elle LIT. Un 10 km à 31,8 °C valait 16,1 km/h de VMA estimée là où le
// même coureur en donnait 19,7 sur la même distance à 13,5 °C. La VMA — et donc TOUTES
// les allures — s'effondrait chaque été, au moment où l'athlète a le plus besoin qu'on
// ne le sous-estime pas.

test("un effort par temps chaud est relu comme s'il avait eu lieu au frais", () => {
  const sec = 36 * 60;                       // 10 km en 36 min
  assert.equal(dureeEnConditionsNeutres(sec, 10, 13), sec, "à 13 °C il n'y a rien à corriger");
  const chaud = dureeEnConditionsNeutres(sec, 10, 31);
  assert.ok(chaud < sec, "à 31 °C, l'effort valait mieux que le chrono");
  // 45 s/km de pénalité à 30 °C, dont on retient LA MOITIÉ → 22,5 s/km sur 10 km.
  assert.equal(Math.round(sec - chaud), 225);
});

test("la correction ne s'invente jamais une météo", () => {
  const sec = 2160;
  assert.equal(dureeEnConditionsNeutres(sec, 10, null), sec, "sans température, aucune correction");
  assert.equal(dureeEnConditionsNeutres(sec, 10, undefined), sec);
});

test("un athlète acclimaté est MOINS corrigé — il souffre moins", () => {
  const sec = 36 * 60;
  const brut = dureeEnConditionsNeutres(sec, 10, 31, 1);
  const acclimate = dureeEnConditionsNeutres(sec, 10, 31, 0.55);
  assert.ok(acclimate > brut, "l'acclimaté doit être moins corrigé que le non-acclimaté");
  assert.ok(acclimate < sec, "mais il reste corrigé");
});

test("on ne retient que la MOITIÉ de la pénalité — la pleine donne des VMA irréelles", () => {
  // Mesuré sur le compte de production : la pénalité pleine transforme un 10 km à
  // 29,6 °C en une VMA de 21,2 km/h, que rien d'autre ne corrobore. La moitié donne
  // 19,9, soit exactement ce que vaut le même coureur par 13 °C.
  assert.equal(PART_PENALITE_CHALEUR, 0.5);
  const pleine = dureeEnConditionsNeutres(36 * 60, 10, 31, 1) ;
  const sansCorrection = 36 * 60;
  assert.ok(sansCorrection - pleine < 45 * 10, "on corrige moins que la pénalité pleine");
});

test("une séance à la distance corrompue ne produit pas un chrono de fiction", () => {
  // Le garde-fou n'existe pas pour la météo — aucune température réelle ne peut le
  // déclencher — mais pour les DONNÉES ABERRANTES, qui, elles, arrivent : une trace GPS
  // qui déraille donne 100 km en une heure. Sans borne, on retrancherait encore la
  // pénalité de chaleur à un chrono déjà impossible et on en tirerait une VMA de fiction.
  const corrompu = dureeEnConditionsNeutres(3600, 100, 31);   // 36 s/km : impossible
  assert.equal(corrompu, 1800, "la correction doit être bornée à la moitié du chrono");
  // Et sur une séance NORMALE, la borne ne s'applique jamais.
  assert.equal(dureeEnConditionsNeutres(36 * 60, 10, 31), 36 * 60 - 225);
});

test("les efforts réels CONCOURENT avec la courbe et la VO2max", () => {
  // Avant : ils n'étaient qu'un repli, donc une courbe d'allure polluée par un été à
  // 31 °C écrasait la meilleure donnée disponible. Depuis qu'ils sont relus dans leurs
  // conditions, ce sont eux la mesure la plus directe.
  const r = effectiveVma({ paceCurveBest: [{ m: 5000, sec: 1107 }], garminVo2: 63, fromRuns: 19.3 });
  assert.equal(r.vma, 19.3);
  assert.equal(r.source, "séances");
  // Et ils ne gagnent que s'ils sont RÉELLEMENT meilleurs.
  assert.equal(effectiveVma({ paceCurveBest: [{ m: 5000, sec: 1107 }], garminVo2: 63, fromRuns: 15 }).source, "vo2max");
});

test("les coefficients de longue distance restent dans la fourchette de la littérature", () => {
  // Semi 83-88 % et marathon 75-80 % de la vitesse à VO2max chez un amateur entraîné.
  // Ils étaient en HAUT de la fourchette (85 % / 79 %), donc toujours optimistes — le
  // sens d'erreur le plus coûteux pour qui cale son allure de course dessus.
  assert.ok(pctVmaForDistance(21.0975) >= 0.83 && pctVmaForDistance(21.0975) <= 0.88);
  assert.ok(pctVmaForDistance(42.195) >= 0.75 && pctVmaForDistance(42.195) <= 0.80);
  // Et l'ordre reste strictement décroissant : plus c'est long, plus le % baisse.
  const d = [1, 5, 10, 21.0975, 30, 42.195, 80];
  for (let i = 1; i < d.length; i++) {
    assert.ok(pctVmaForDistance(d[i]) < pctVmaForDistance(d[i - 1]), `${d[i]} km n'est pas plus dur que ${d[i - 1]} km`);
  }
});

console.log("\nVMA EFFECTIVE — un seul calcul pour toute l'application");
// Défaut réel : QUATRE chaînes distinctes calculaient la VMA (coach, tableau de bord,
// profil, getEffectiveVma), avec des sources et un ordre différents — le tableau de bord
// ignorait la courbe d'allure. Relevé sur le compte de production : coach 17,3 km/h,
// tableau de bord 18,7 km/h, pour le même athlète au même instant.

/** Courbe d'allure dont le meilleur point donne ~17,3 km/h (le 5 000 m réel de prod). */
const COURBE = [{ m: 400, sec: 75 }, { m: 1000, sec: 205 }, { m: 3000, sec: 662 },
                { m: 5000, sec: 1107 }, { m: 10000, sec: 2468 }];

test("un test VMA enregistré prime sur tout le reste", () => {
  // C'est la seule valeur MESURÉE ; les autres sont des déductions.
  const r = effectiveVma({ vmaStored: 16, paceCurveBest: COURBE, garminVo2: 63, fromRuns: 18.7 });
  assert.equal(r.vma, 16);
  assert.equal(r.source, "test");
});

test("la VO2max de la montre est CROISÉE avec la courbe, plus reléguée au dernier recours", () => {
  // Défaut réel : la courbe répond toujours, donc la VO2max n'était JAMAIS consultée.
  // Or la courbe ne connaît que ce que l'athlète a couru : sans effort maximal récent,
  // son meilleur 5 000 m est une sortie d'entraînement. Constaté en production :
  // courbe 17,3 km/h contre VO2max 63 → 18,0, et un « meilleur » 10 000 m à 41'08.
  const r = effectiveVma({ paceCurveBest: COURBE, garminVo2: 63, fromRuns: null });
  assert.equal(vmaFromPaceCurve(COURBE), 17.3, "la courbe donne bien 17,3");
  assert.equal(r.vma, 18, "la VO2max (63 → 18,0) doit l'emporter sur la courbe");
  assert.equal(r.source, "vo2max", "et la source doit le DIRE, sinon l'athlète subit le chiffre");
});

test("quand la courbe est la meilleure, c'est elle qui gagne", () => {
  // Le croisement n'est pas « la VO2max gagne toujours » : les deux sources ne peuvent
  // que sous-estimer, donc on retient la plus favorable, d'où qu'elle vienne.
  const r = effectiveVma({ paceCurveBest: COURBE, garminVo2: 45, fromRuns: null });
  assert.equal(r.vma, 17.3);
  assert.equal(r.source, "courbe");
});

test("sans courbe ni VO2max, on retombe sur les séances — jamais sur zéro", () => {
  assert.deepEqual(effectiveVma({ fromRuns: 15.4 }), { vma: 15.4, source: "séances" });
  // Aucune source du tout : `null`, pas `0`. Un zéro se propagerait en allures absurdes.
  assert.deepEqual(effectiveVma({}), { vma: null, source: null });
});

test("aucune chaîne parallèle ne recalcule la VMA dans son coin", () => {
  // C'est la cause RACINE des quatre chiffres divergents : chaque écran refaisait la
  // chaîne à la main, et chaque commentaire jurait pourtant qu'elle était identique.
  for (const f of ["src/app/dashboard/page.tsx", "src/app/dashboard/profile/page.tsx", "src/lib/ai/coachContext.ts"]) {
    const src = codeOf(f);
    assert.ok(/effectiveVma\(/.test(src), `${f} ne passe pas par effectiveVma`);
    // `vmaFromVo2max` ne doit plus être appelée hors de la fonction commune : c'est
    // exactement ainsi qu'une chaîne parallèle réapparaît.
    assert.ok(!/vmaFromVo2max\(/.test(src), `${f} rebâtit une chaîne de VMA à la main`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nPPS — le pass ne sert à rien s'il expire AVANT la course");
// Depuis le 1er septembre 2024, un majeur non licencié ne peut plus s'inscrire à une
// course chronométrée en France sans PPS. Depuis janvier 2026 il dure UN AN — or une
// préparation marathon en dure six. Le piège n'est donc pas d'oublier de le faire :
// c'est de le faire trop tôt et de le découvrir la veille du retrait des dossards.

test("l'expiration tombe douze mois après la délivrance, pas 365 jours", () => {
  // « +365 jours » décalerait l'échéance d'un jour sur une année bissextile — et c'est
  // exactement un jour d'écart qui fait basculer un verdict à la veille d'une course.
  assert.equal(ppsExpiration("2026-03-04"), "2027-03-04");
  assert.equal(ppsExpiration("2028-02-29"), "2029-03-01", "année bissextile : 29 février + 12 mois");
  assert.equal(ppsExpiration(null), null);
  assert.equal(ppsExpiration("pas-une-date"), null, "une date bancale ne produit pas d'échéance inventée");
});

test("le verdict répond pour LE JOUR DE LA COURSE, pas pour aujourd'hui", () => {
  const today = new Date("2026-08-15T12:00:00");
  const status = { obtainedAt: "2026-03-04" };   // expire le 04/03/2027
  // Course AVANT l'expiration : rien à signaler.
  const ok = ppsVerdict(status, "2027-02-01", today);
  assert.equal(ok.kind, "valide");
  // Course APRÈS l'expiration : c'est le cas qui coûte un dossard.
  const ko = ppsVerdict(status, "2027-04-25", today);
  assert.equal(ko.kind, "expireAvantCourse");
  assert.equal(ko.kind === "expireAvantCourse" && ko.expiresAt, "2027-03-04");
});

test("sans date de course, on ne prétend pas répondre à la question de la course", () => {
  const v = ppsVerdict({ obtainedAt: "2026-03-04" }, null, new Date("2026-08-15T12:00:00"));
  assert.equal(v.kind, "valide");
  assert.equal(v.kind === "valide" && v.joursRestants, 201);
});

test("un pass déjà périmé est annoncé périmé, même sans course prévue", () => {
  assert.equal(ppsVerdict({ obtainedAt: "2024-01-10" }, null, new Date("2026-08-15T12:00:00")).kind, "expire");
});

test("une course DÉJÀ PASSÉE ne déclenche pas d'alerte", () => {
  // Alarmer quelqu'un sur une échéance qu'il a déjà franchie, c'est le meilleur moyen
  // de lui apprendre à ignorer nos alertes.
  const v = ppsVerdict({ obtainedAt: "2026-03-04" }, "2025-05-01", new Date("2026-08-15T12:00:00"));
  assert.equal(v.kind, "valide");
});

test("un licencié FFA n'est jamais embêté avec le PPS", () => {
  // Sa licence en tient lieu. Lui réclamer un pass qu'il n'a pas à prendre, c'est le
  // pousser à payer 5 € pour rien.
  const v = ppsVerdict({ obtainedAt: null, licensed: true }, "2027-04-25", new Date("2026-08-15T12:00:00"));
  assert.equal(v.kind, "licencie");
  assert.equal(ppsDemandeAction(v), false);
});

test("rien de déclaré = « inconnu », et on le DIT au lieu de le deviner", () => {
  const v = ppsVerdict(null, "2027-04-25", new Date("2026-08-15T12:00:00"));
  assert.equal(v.kind, "inconnu");
  assert.equal(ppsDemandeAction(v), true, "un PPS non renseigné doit provoquer une action");
});

console.log("\nPPS — jusqu'à quand puis-je courir, et quelles courses sont couvertes");
// L'athlète ne demande pas « mon pass est-il valide » dans l'abstrait : il demande
// « est-ce que je peux m'inscrire à CETTE course ». Nous ne pouvons pas authentifier son
// numéro — l'API de contrôle de la FFA est réservée aux entreprises labellisées — mais
// nous connaissons ses courses, ce que la fédération ignore.

const T = new Date("2026-08-15T12:00:00");
const COURSES = [
  { date: "2026-10-25", nom: "Marathon de Lille" },
  { date: "2027-05-10", nom: "Trail des Collines" },
  { date: "2026-01-01", nom: "Course déjà passée" },
];

test("la dernière date de course est l'expiration du pass", () => {
  const r = couvertureCourses({ expiresAt: "2027-03-24", obtainedAt: null }, COURSES, T);
  assert.equal(r.derniereDate, "2027-03-24");
});

test("chaque course est jugée sur SA date, pas sur aujourd'hui", () => {
  const r = couvertureCourses({ expiresAt: "2027-03-24", obtainedAt: null }, COURSES, T);
  assert.deepEqual(r.courses.map((c) => [c.nom, c.couverte]), [
    ["Marathon de Lille", true],     // avant l'expiration
    ["Trail des Collines", false],   // après → il faudra refaire le pass
  ]);
});

test("les courses passées ne sont pas listées", () => {
  const r = couvertureCourses({ expiresAt: "2027-03-24", obtainedAt: null }, COURSES, T);
  assert.ok(!r.courses.some((c) => c.nom === "Course déjà passée"), "une course franchie n'appelle plus de décision");
});

test("sans pass, AUCUNE course n'est déclarée couverte", () => {
  // Le piège serait de renvoyer une liste vide et de la laisser passer pour « tout va
  // bien ». Un athlète sans pass n'est couvert pour rien.
  const r = couvertureCourses(null, COURSES, T);
  assert.equal(r.derniereDate, null);
  assert.ok(r.courses.every((c) => !c.couverte), "sans pass, rien ne peut être couvert");
});

test("un licencié est couvert partout, sans date à surveiller", () => {
  const r = couvertureCourses({ expiresAt: null, obtainedAt: null, licensed: true }, COURSES, T);
  assert.equal(r.derniereDate, null, "une licence n'oppose pas de date d'expiration");
  assert.ok(r.courses.every((c) => c.couverte));
});

test("un pass expiré ne couvre plus aucune course à venir", () => {
  const r = couvertureCourses({ expiresAt: "2026-06-01", obtainedAt: null }, COURSES, T);
  assert.ok(r.courses.every((c) => !c.couverte), "un pass périmé ne couvre rien");
});

test("on n'affirme JAMAIS avoir vérifié le pass auprès de la fédération", () => {
  // L'API de contrôle est réservée aux entreprises labellisées FFA : prétendre valider
  // un numéro ferait se présenter l'athlète au retrait des dossards en confiance sur la
  // foi d'une pastille qui ne vaut rien.
  const interdits = /pass vérifié|numéro validé|verified with|authentifié|certifié par la FFA/i;
  for (const l of ALL_LANGS) {
    const T2 = PPS_T[l];
    assert.ok(T2.pasDeVerification.length > 40, `${l} : l'avertissement doit être explicite`);
    for (const v of Object.values(T2)) {
      const txt = typeof v === "function" ? "" : Array.isArray(v) ? v.join(" ") : String(v);
      assert.ok(!interdits.test(txt), `${l} prétend vérifier le pass : « ${txt.slice(0, 80)} »`);
    }
  }
});

test("la date IMPRIMÉE sur le pass prime sur la déduction", () => {
  // Défaut vécu : l'athlète avait un pass valide affichant « EXPIRE LE 24/03/2027 », et
  // l'app lui réclamait sa date d'OBTENTION — donc une soustraction de douze mois de
  // tête, pour une donnée que la fédération lui donne déjà toute faite. Résultat : il
  // n'a rien saisi, et l'app affichait « PPS non renseigné » à quelqu'un qui en avait un.
  const today = new Date("2026-08-15T12:00:00");
  const v = ppsVerdict({ expiresAt: "2027-03-24", obtainedAt: null }, "2026-10-25", today);
  assert.equal(v.kind, "valide");
  assert.equal(v.kind === "valide" && v.expiresAt, "2027-03-24");

  // Si les deux sont là et se contredisent, l'IMPRIMÉE gagne : la déduction
  // « délivrance + 12 mois » suppose que la règle n'a pas changé entre-temps.
  const both = ppsVerdict({ expiresAt: "2027-03-24", obtainedAt: "2020-01-01" }, null, today);
  assert.equal(both.kind, "valide", "une vieille date d'obtention ne doit pas périmer un pass valide");

  // L'ancien format continue de fonctionner : les comptes enregistrés avant ce
  // changement ne doivent pas voir leur pass disparaître.
  const legacy = ppsVerdict({ obtainedAt: "2026-03-04" }, null, today);
  assert.equal(legacy.kind, "valide");
  assert.equal(legacy.kind === "valide" && legacy.expiresAt, "2027-03-04");

  // Une expiration bancale ne fait pas taire un repli valable — et surtout, elle ne
  // doit pas se PROPAGER : une date illisible produit un compte à rebours `NaN`, donc
  // « encore NaN jours » à l'écran, avec un verdict « valide » d'apparence normale.
  const bancal = ppsVerdict({ expiresAt: "pas-une-date", obtainedAt: "2026-03-04" }, null, today);
  assert.equal(bancal.kind, "valide");
  assert.equal(bancal.kind === "valide" && bancal.expiresAt, "2027-03-04", "la date illisible a été retenue au lieu du repli");
  assert.ok(bancal.kind === "valide" && Number.isFinite(bancal.joursRestants), "compte à rebours non calculable");
});

test("les faits réglementaires ne sont écrits QU'UNE fois", () => {
  // Une adresse ou un tarif recopié dans trois composants finit par diverger — et sur un
  // sujet réglementaire, diverger veut dire afficher une information fausse.
  assert.equal(PPS_URL, "https://pps.athle.fr");
  assert.equal(PPS_PRIX_EUR, 5);
  assert.equal(PPS_VALIDITE_MOIS, 12);
  // On vise la CONSTANTE (avec protocole) : un libellé qui cite « pps.athle.fr » en
  // toutes lettres est du texte, pas une seconde source de vérité.
  const dur = execSync(`grep -rl 'https://pps.athle.fr' src --include='*.ts' --include='*.tsx' || true`)
    .toString().trim().split("\n").filter(Boolean);
  assert.deepEqual(dur, ["src/lib/pps/status.ts"],
    `l'adresse officielle est recopiée hors du module PPS : ${dur.join(", ")}`);
});

test("les 5 langues disent la même chose, et aucune ne promet une aptitude", () => {
  // RÈGLE DE RÉDACTION : nous ne vérifions RIEN auprès de la fédération. Aucun texte ne
  // doit laisser croire à l'athlète qu'il est « apte » ou « en règle » parce que notre
  // pastille est verte — l'autorité, c'est l'organisateur.
  const interdits = /\bapte\b|\ben règle\b|autoris[ée] à courir|cleared to race|fit to race/i;
  for (const l of ALL_LANGS) {
    const T = PPS_T[l];
    assert.ok(T, `langue ${l} absente du dictionnaire PPS`);
    for (const [k, v] of Object.entries(T)) {
      const texte = typeof v === "function" ? (v as (...a: never[]) => string)(5 as never, 12 as never)
        : Array.isArray(v) ? v.join(" ") : String(v);
      assert.ok(texte.trim().length > 0, `${l}/${k} : vide`);
      assert.ok(!/undefined|\$\{/.test(texte), `${l}/${k} : reste technique — « ${texte.slice(0, 80)} »`);
      assert.ok(!interdits.test(texte), `${l}/${k} promet une aptitude : « ${texte.slice(0, 100) }»`);
    }
    assert.equal(T.etapes.length, 4, `${l} : le parcours officiel compte 4 étapes`);
    assert.ok(T.avertissement.length > 30, `${l} : l'avertissement « on ne vérifie rien » doit être explicite`);
  }
});

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
  // La constante apparaît trois fois : import, lecture, écriture. Chercher son nom seul
  // laissait supprimer l'ÉCRITURE — le cache n'aurait plus jamais été rempli, donc plus
  // jamais servi, sans que rien ne rougisse.
  assert.ok(/\.eq\("type", SESSION_CACHE_TYPE\)/.test(code), "le cache n'est plus RELU");
  assert.ok(/type: SESSION_CACHE_TYPE/.test(code), "le cache n'est plus ÉCRIT");
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

console.log("\nDÉFIS — la progression se mesure, elle ne se stocke pas");
test("le fil filtré par club ne retombe JAMAIS sur le fil général", () => {
  // Un club sans membre visible doit donner un fil VIDE, qui dit la vérité, et non
  // les publications de nos abonnements — l'athlète croirait que le club publie.
  const code = codeOf("src/app/api/social/feed/route.ts");
  const i = code.indexOf("if (clubId)");
  assert.ok(i > 0, "le filtre par club doit exister");
  const bloc = code.slice(i, i + 700);
  assert.ok(/authors = \(membres/.test(bloc), "les auteurs doivent être REMPLACÉS par les membres du club");
  assert.ok(/!authors\.length/.test(bloc), "un club sans membre doit court-circuiter vers un fil vide");
});
test("le classement des défis n'expose pas les profils en entier", () => {
  // Une colonne sensible ajoutée demain (e-mail, clé API) se retrouverait publiée
  // dans un classement visible de tous les participants.
  const code = codeOf("src/app/dashboard/clubs/page.tsx");
  assert.ok(!/from\("profiles"\)\s*\.\s*select\("\*"\)/.test(code), "colonnes de profil à énumérer");
  assert.ok(/select\("id, full_name"\)/.test(code), "seuls l'identifiant et le nom sont nécessaires");
});
test("la synchronisation importe les traces des NOUVELLES séances", () => {
  // Défaut constaté : l'import initial des 314 traces était un script lancé une fois
  // à la main. Les sorties synchronisées ensuite entraient bien en base mais restaient
  // SANS trace — donc absentes du survol, de la carte de chaleur et de l'appariement
  // de segments, sans que rien ne le signale. Deux sorties manquaient déjà.
  //
  // L'import vivait dans la route appelée par le navigateur ; il est désormais dans la
  // chaîne PARTAGÉE, parce que le balayage serveur ne l'appelait pas du tout — un
  // athlète qui n'ouvre jamais l'app n'avait donc jamais de trace. L'invariant est le
  // même, l'endroit a changé : c'est le test qui devait suivre, pas le code reculer.
  const code = codeOf("src/lib/intervals/syncAndCoach.ts");
  // Deux occurrences : la déstructuration de l'import dynamique, et l'appel. Chercher le
  // nom seul laissait supprimer l'APPEL en gardant l'import — les traces n'auraient plus
  // jamais été importées, test au vert.
  assert.ok(/importMissingTracks\(admin,/.test(code), "la chaîne importe le module mais ne l'APPELLE plus");
  // Best-effort : une trace indisponible ne doit jamais faire échouer la synchro.
  const i = code.indexOf("importMissingTracks");
  assert.ok(/try \{/.test(code.slice(Math.max(0, i - 400), i)), "l'import doit être protégé");
  assert.ok(/max: opts\.max \?\? TRACKS_PER_PASS/.test(code), "l'import doit être BORNÉ par passage");
  // Et les DEUX chemins doivent réellement y passer.
  for (const f of ["src/app/api/intervals/sync/route.ts", "src/lib/intervals/syncAndCoach.ts"]) {
    assert.ok(/importTracksBestEffort/.test(codeOf(f)), `${f} n'importe aucune trace`);
  }
});
test("une séance sans GPS est mémorisée comme telle", () => {
  // Sinon la synchro la redemanderait à intervals.icu à chaque passage, indéfiniment.
  const code = codeOf("src/lib/intervals/tracks.ts");
  assert.ok(/has_gps: false/.test(code), "une séance de tapis doit être enregistrée sans GPS");
  // `data2` figure aussi dans l'annotation de type : le chercher seul laissait supprimer
  // la LECTURE du champ sans que le test bronche.
  assert.ok(/latlng\?\.data2/.test(code), "les longitudes doivent être LUES dans data2, pas seulement déclarées");
});

test("le préchauffage du survol ne se voit JAMAIS", () => {
  // Il fait défiler la trace en six bonds pour mettre les tuiles en cache : utile,
  // mais si on le laisse visible, la caméra se téléporte à travers tout le parcours
  // dès qu'on appuie sur Lecture — ce qui se lit comme un plantage.
  const code = codeOf("src/components/segments/Flyover.tsx");
  assert.ok(/\{prechauffe && \(/.test(code), "un voile doit couvrir le préchauffage");
  const voile = code.slice(code.indexOf("{prechauffe && ("), code.indexOf("{prechauffe && (") + 500);
  assert.ok(/bg-zinc-900\/9\d/.test(voile), "le voile doit être opaque, pas translucide");
  assert.ok(/Préparation du survol/.test(voile), "un état de préparation doit être ANNONCÉ");
});

test("le survol est piloté par une HORLOGE, pas par un enchaînement d'événements", () => {
  // Les versions précédentes enchaînaient les étapes sur `moveend` avec un minuteur de
  // secours. Trois mécanismes qui peuvent se perdre — événement capté au mauvais
  // moment, `easeTo` qui ne bouge pas, double démarrage — et la lecture se figeait à
  // l'étape 0 : bouton en pause, barre à zéro, aucune erreur. Le temps écoulé, lui,
  // ne se perd pas.
  const code = codeOf("src/components/segments/Flyover.tsx");
  // Deux sites indispensables : celui qui DÉMARRE l'animation et celui qui la relance à
  // chaque image. En supprimer un laissait l'autre satisfaire le motif — sans le premier
  // rien ne part, sans le second l'animation dure une seule image.
  assert.equal((code.match(/requestAnimationFrame\(boucle\)/g) ?? []).length, 2,
    "il faut le démarrage ET la relance de boucle : l'un des deux a disparu");
  assert.ok(!/once\("moveend"/.test(code), "plus aucun enchaînement sur moveend");
  // `depuis` a été renommé `depart0` en devenant une valeur ASSAINIE (une reprise ne
  // peut plus partir d'une position non finie). L'invariant est le même : la reprise
  // se date à partir du temps déjà écoulé.
  assert.ok(/performance\.now\(\) - depart0/.test(code), "la reprise après pause ne doit rien perdre");
  assert.ok(/Number\.isFinite\(depuis\)/.test(code), "une reprise à une position non finie relançait le plantage");
  assert.ok(/fadeDuration: 0/.test(code), "le fondu des tuiles produit un scintillement permanent");
});
test("la caméra du survol interpole entre les points", () => {
  // Se caler sur le point GPS le plus proche fige la caméra puis la téléporte : avec
  // 150 points sur 26 s, cela produit six sauts par seconde.
  //
  // Le calcul a quitté le composant pour `lib/segments/flyover` : il était intestable
  // dans une boucle d'animation React, et c'est précisément là qu'un index non fini a
  // produit un plantage en production. Les deux règles sont désormais vérifiées sur le
  // COMPORTEMENT (voir « SURVOL 3D » plus bas) et non sur la présence d'une formule ;
  // il ne reste ici que l'ORDRE des appels, qui, lui, vit toujours dans le composant.
  const code = codeOf("src/components/segments/Flyover.tsx");
  const boucle = code.slice(code.indexOf("function boucle"), code.indexOf("function prechauffer"));
  assert.ok(/poseAt\(points, p\)/.test(boucle), "la position doit venir du calcul partagé et testé");
  assert.ok(/capLisse\(/.test(boucle), "le cap doit passer par le lissage partagé et testé");
  assert.ok(boucle.indexOf("setData") < boucle.indexOf("map.jumpTo"), "le marqueur avance avant la caméra");
});
test("le survol s'ouvre sur une vue PANORAMIQUE, pas collée au sol", () => {
  // Comparaison image par image avec la référence Strava : elle filme de très haut,
  // horizon et ciel dans le cadre, ce qui fait lire l'image comme un survol. Au ras
  // du sol, on ne voit qu'un fond de carte qui défile.
  const code = codeOf("src/components/segments/Flyover.tsx");
  const angles = code.slice(code.indexOf("const ANGLES"), code.indexOf("const ANGLE_DEFAUT"));
  assert.ok(/Panorama/.test(angles), "une vue panoramique doit exister");
  const zooms = [...angles.matchAll(/zoom: ([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...zooms) < 12.5, `la vue large doit vraiment reculer (min ${Math.min(...zooms)})`);
  assert.ok(/const ANGLE_DEFAUT = 2/.test(code), "c'est le panorama qu'on vient voir : il est par défaut");
});
test("le survol affiche un ciel et un marqueur de position", () => {
  // Sans ciel, le haut du cadre est un vide gris une fois la caméra relevée. Sans
  // marqueur, sur une vue large, on ne sait plus où l'on se trouve sur la trace.
  const code = codeOf("src/components/segments/Flyover.tsx");
  // `setSky` apparaît deux fois sur la même ligne : dans le typage de la conversion et
  // dans l'appel. Seul l'appel dessine quelque chose.
  assert.ok(/\.setSky\?\.\(/.test(code), "le dégradé atmosphérique n'est plus APPLIQUÉ (un type ne dessine rien)");
  assert.ok(/addSource\("position"/.test(code) && /position-point/.test(code), "un marqueur doit suivre la progression");
  // Le marqueur doit être mis à jour AVANT le mouvement, sinon il traîne d'une étape.
  const boucle = code.slice(code.indexOf("function boucle"), code.indexOf("function prechauffer"));
  assert.ok(boucle.indexOf("setData") < boucle.indexOf("map.jumpTo"), "le marqueur avance avant la caméra");
});


test("l'allure du survol est celle du MOMENT, pas la moyenne figée", () => {
  // Le bandeau affichait la moyenne de toute la sortie à un emplacement qui suggère
  // une valeur instantanée — l'altitude et la distance, elles, défilaient.
  const code = codeOf("src/components/segments/Flyover.tsx");
  // Le calcul et l'affichage, séparément : cinq occurrences rendaient l'assertion
  // insensible à la disparition de l'une d'elles.
  assert.ok(/const paceAct = /.test(code), "l'allure instantanée n'est plus CALCULÉE");
  assert.ok(/valeur=\{paceTexte\}/.test(code), "l'allure instantanée n'est plus AFFICHÉE");
  assert.ok(/paceAct != null \? "Allure" : "Allure moy\."/.test(code),
    "à défaut d'allure instantanée, le libellé doit DIRE que c'est une moyenne");
});
test("l'allure instantanée écarte les valeurs aberrantes", () => {
  // À l'arrêt le GPS produit des allures délirantes ; les afficher ferait passer une
  // pause pour un sprint ou une marche pour un arrêt.
  const code = codeOf("src/app/dashboard/survol/page.tsx");
  assert.ok(/secParKm > 1200 \|\| secParKm < 120/.test(code), "bornes d'allure attendues");
  assert.ok(/d < 5 \|\| dt <= 0/.test(code), "aucune allure ne doit être calculée à l'arrêt");
});

test("les réglages du survol s'appliquent IMMÉDIATEMENT, même en pleine lecture", () => {
  // Si la boucle lisait l'état React plutôt que des refs, une étape déjà lancée
  // continuerait avec les anciens réglages : changer la vitesse ne ferait rien
  // pendant plusieurs secondes, et l'athlète croirait le bouton cassé.
  const code = codeOf("src/components/segments/Flyover.tsx");
  const boucle = code.slice(code.indexOf("function boucle"), code.indexOf("function prechauffer"));
  assert.ok(/vitesseRef\.current/.test(boucle) && /angleRef\.current/.test(boucle),
    "la boucle doit lire les refs, pas l'état");
  assert.ok(!/\bvitesse\b(?!Ref)/.test(boucle), "l'état ne doit pas être lu dans la boucle");
});
test("le zoom du survol reste borné", () => {
  // Un zoom libre invite à se perdre : trop loin la trace disparaît, trop près on ne
  // voit plus que le sol et le survol n'apprend plus rien.
  const code = codeOf("src/components/segments/Flyover.tsx");
  assert.ok(/Math\.max\(-1\.5/.test(code) && /Math\.min\(1\.5/.test(code), "bornes de zoom attendues");
});
test("chaque inclinaison a son propre recul", () => {
  // Un angle rasant sans recul ne montre que le bitume devant soi.
  const code = codeOf("src/components/segments/Flyover.tsx");
  const angles = code.slice(code.indexOf("const ANGLES"), code.indexOf("] as const;", code.indexOf("const ANGLES")));
  assert.ok(/pitch: 0/.test(angles), "une vue carte doit rester disponible");
  // On vérifie qu'une vue TRÈS inclinée existe, sans figer sa valeur exacte : c'est
  // l'inclinaison qui fait entrer l'horizon dans le cadre, pas le nombre 74.
  const pitches = [...angles.matchAll(/pitch: (\d+)/g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...pitches) >= 70, `une vue très inclinée doit être proposée (max ${Math.max(...pitches)}°)`);
  assert.equal((angles.match(/zoom:/g) ?? []).length, 3, "chaque angle porte SON zoom");
});



const DEFI = (o: Partial<Challenge> = {}): Challenge =>
  ({ id: "d1", name: "100 km", metric: "distance", target: 100, starts_on: "2026-08-01", ends_on: "2026-08-31", ...o });
const W2 = (date: string, km: number, dplus = 0, sport = "Run") =>
  ({ date, distance_km: km, elevation_gain_m: dplus, sport });

test("les bornes du défi sont INCLUSES des deux côtés", () => {
  // Exclure le jour de clôture priverait l'athlète de son dernier effort, souvent
  // celui qui décide du résultat.
  const d = DEFI();
  assert.equal(inWindow("2026-08-01", d), true, "le premier jour compte");
  assert.equal(inWindow("2026-08-31", d), true, "le dernier jour aussi");
  assert.equal(inWindow("2026-07-31", d), false);
  assert.equal(inWindow("2026-09-01", d), false);
});
test("une séance hors période ne compte pas", () => {
  const p = challengeProgress(DEFI(), [W2("2026-07-20", 50), W2("2026-08-10", 30)]);
  assert.equal(p.value, 30, "seuls les 30 km d'août comptent");
});
test("le vélo ne remplit pas un défi de course", () => {
  const p = challengeProgress(DEFI(), [W2("2026-08-10", 200, 0, "Ride"), W2("2026-08-11", 10)]);
  assert.equal(p.value, 10);
});
test("la valeur affichée n'est JAMAIS plafonnée, seule la barre l'est", () => {
  // 150 km sur un défi de 100 doit s'afficher 150 : rogner la performance réelle
  // pour faire tenir une barre serait effacer un effort.
  const p = challengeProgress(DEFI(), [W2("2026-08-10", 150)]);
  assert.equal(p.value, 150);
  assert.equal(p.ratio, 1, "la barre, elle, est bornée");
  assert.equal(p.done, true);
});
test("un défi de régularité ignore les séances à zéro kilomètre", () => {
  // Un enregistrement lancé puis arrêté aussitôt gonflerait le compteur sans effort.
  const d = DEFI({ metric: "sessions", target: 3 });
  const p = challengeProgress(d, [W2("2026-08-02", 0), W2("2026-08-03", 5), W2("2026-08-04", 6)]);
  assert.equal(p.value, 2);
  assert.equal(p.done, false);
});
test("« plus longue sortie » retient le maximum, pas la somme", () => {
  const d = DEFI({ metric: "longest_run", target: 20 });
  const p = challengeProgress(d, [W2("2026-08-02", 12), W2("2026-08-03", 15)]);
  assert.equal(p.value, 15, "12 + 15 ne fait pas une sortie de 27 km");
});
test("un défi terminé ne dit pas « 0 jour restant »", () => {
  // Ce serait pousser l'athlète à sortir courir pour rien.
  const d = DEFI();
  assert.equal(daysLeft(d, new Date("2026-09-05T10:00:00Z")), null, "terminé ⇒ null, pas 0");
  assert.equal(daysLeft(d, new Date("2026-08-31T10:00:00Z")), 0, "le dernier jour vaut bien 0");
  assert.ok((daysLeft(d, new Date("2026-08-25T10:00:00Z")) ?? -1) >= 5);
});
test("un défi à venir se distingue d'un défi raté", () => {
  const d = DEFI();
  assert.equal(notStarted(d, new Date("2026-07-15T10:00:00Z")), true);
  assert.equal(notStarted(d, new Date("2026-08-15T10:00:00Z")), false);
});
test("les ex æquo partagent le même rang, on n'invente pas de départage", () => {
  const d = DEFI();
  const cl = challengeLeaderboard(d, [
    { userId: "a", workouts: [W2("2026-08-02", 50)] },
    { userId: "b", workouts: [W2("2026-08-02", 50)] },
    { userId: "c", workouts: [W2("2026-08-02", 80)] },
  ]);
  assert.equal(cl[0].userId, "c");
  assert.equal(cl[0].rank, 1);
  assert.equal(cl[1].rank, 2);
  assert.equal(cl[2].rank, 2, "les deux à 50 km partagent la 2e place");
});
test("la progression des défis n'est écrite dans AUCUNE table", () => {
  // La stocker, ce serait risquer qu'elle survive à la séance qui l'a produite.
  const code = codeOf("src/lib/challenges/progress.ts") + codeOf("src/app/dashboard/clubs/page.tsx");
  assert.ok(!/\.insert\(|\.upsert\(|\.update\(/.test(code), "la progression doit rester calculée à la lecture");
  // ⚠️ Commentaires SQL retirés avant l'analyse : le commentaire qui EXPLIQUE
  // l'absence de colonne de progression contient forcément le mot « progression ».
  // Même piège que sur les greps de code TypeScript, en dialecte SQL cette fois.
  const sql = sqlOf("supabase/migrations/020_clubs_et_defis.sql");
  assert.ok(!/progress|current_value/i.test(sql), "aucune colonne de progression en base");
});
test("la migration 020 ne contient AUCUNE instruction destructive", () => {
  // L'éditeur Supabase avait signalé la 019 pour deux « drop trigger ».
  const sql = sqlOf("supabase/migrations/020_clubs_et_defis.sql");
  // `on delete cascade` est une clause de clé étrangère, pas un ordre de suppression :
  // on vise les INSTRUCTIONS destructives, pas le mot « delete » partout.
  assert.ok(!/\bdrop\b|\btruncate\b|delete\s+from/i.test(sql), "aucun DROP / TRUNCATE / DELETE FROM");
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
test("un arrêt au feu rouge ne crée PAS de point brûlant", () => {
  // Trente points enregistrés à l'arrêt dans la même maille : sans dédoublonnage par
  // trace, le carrefour paraîtrait plus couru que le parcours lui-même.
  const arret: TP[] = Array.from({ length: 30 }, (_, i) => ({ lat: 50.6400, lon: 3.0362, t: i }));
  const cells = heatCells([arret]);
  assert.equal(cells.length, 1);
  assert.equal(cells[0].n, 1, "une trace ne compte qu'une fois par maille");
  // Deux sorties distinctes au même endroit, en revanche, comptent bien double.
  assert.equal(heatCells([arret, arret])[0].n, 2);
});
test("l'échelle de chaleur reste lisible quand un trajet écrase les autres", () => {
  // En linéaire, une rue vue 10 fois s'afficherait aussi pâle qu'une rue vue 1 fois
  // dès qu'un trajet quotidien atteint 200 passages. Le logarithme garde l'écart visible.
  assert.equal(intensity(200, 200), 1);
  assert.ok(intensity(10, 200) > 0.4, "10 passages doivent rester bien visibles");
  assert.ok(intensity(1, 200) < 0.1, "un passage unique reste discret");
  assert.equal(intensity(5, 1), 1, "sans écart de fréquentation, tout est à pleine intensité");
});
test("le survol 3D reste GRATUIT — aucun verrou d'abonnement", () => {
  // Décision produit du 13/08/2026 : chez Strava le survol est réservé aux abonnés
  // (c'est l'écran de la vidéo de référence). Sur Pacevo il est ouvert à tous, et
  // c'est la différence revendiquée. Un test le fige, sinon un futur écran de paywall
  // pourrait l'enfermer par simple cohérence apparente avec le reste.
  for (const f of ["src/components/segments/Flyover.tsx", "src/app/dashboard/survol/page.tsx"]) {
    const code = codeOf(f);
    assert.ok(!/subscription_tier|isPro|premium|paywall|checkout/i.test(code),
      `${f} introduit un verrou d'abonnement sur le survol 3D`);
  }
});
test("le survol n'affiche pas d'altitude qu'il ne connaît pas", () => {
  // L'altitude n'est passée que si TOUS les points en portent une : un zéro affiché
  // en gros au-dessus d'une trace sans altimétrie passerait pour une mesure.
  const code = codeOf("src/app/dashboard/survol/page.tsx");
  assert.ok(/every\(\(p\) => p\.length >= 4\)/.test(code),
    "l'altitude ne doit partir que si la trace en porte réellement");
  const vue = codeOf("src/components/segments/Flyover.tsx");
  assert.ok(/altAct != null &&/.test(vue), "le bandeau doit taire l'altitude inconnue");
});
test("la cadence est convertie en PAS par minute, pas laissée en tours", () => {
  // Défaut trouvé sur les données réelles : intervals.icu renvoie ~89 tours/min (une
  // jambe) là où la base stocke 174 pas/min (deux jambes). La courbe affichait donc 89
  // sous une carte annonçant 174 — l'athlète aurait cru sa cadence effondrée.
  const code = codeOf("src/app/dashboard/activite/page.tsx");
  const ligne = code.split("\n").find((l) => /titre: "Cadence"/.test(l)) ?? "";
  assert.ok(/\*\s*2/.test(ligne), "la cadence doit être doublée pour passer en pas/min");
});
test("le détail d'une séance ne bloque jamais sur ses blocs facultatifs", () => {
  // Carte, courbes et segments sont un BONUS : une trace absente ou une requête en
  // échec ne doit jamais empêcher l'affichage du détail existant (zones FC, courbes).
  const code = codeOf("src/app/dashboard/activite/page.tsx");
  assert.ok(/try \{/.test(code) && /\} catch/.test(code), "la section enrichie doit être protégée");
  const iCatch = code.indexOf("} catch");
  const iDetail = code.indexOf("<SessionDetail");
  assert.ok(iCatch > 0 && iCatch < iDetail, "le détail existant doit être rendu APRÈS la section facultative");
});

test("une courbe n'est tracée que si la mesure existe vraiment", () => {
  // Reconstituer une courbe à partir de quelques valeurs éparses serait une invention
  // graphique, pas une mesure : mieux vaut un bloc absent qu'une ligne inventée.
  const base: TP[] = Array.from({ length: 60 }, (_, i) => ({ lat: 50 + i * 0.0001, lon: 3, t: i * 5 }));
  assert.equal(metricSeries(base, (p) => p.hr), null, "aucune FC ⇒ aucune courbe");
  const epars = base.map((p, i) => (i % 10 === 0 ? { ...p, hr: 150 } : p));
  assert.equal(metricSeries(epars, (p) => p.hr), null, "6 points sur 60 ne font pas une courbe");
  const complet = base.map((p, i) => ({ ...p, hr: 140 + (i % 20) }));
  const serie = metricSeries(complet, (p) => p.hr);
  assert.ok(serie && serie.length > 3, "une mesure continue doit produire une courbe");
  assert.ok(serie!.every((x) => x.v >= 140 && x.v <= 160), "les valeurs doivent rester dans la plage réelle");
});

test("un arrêt au ravitaillement ne devient PAS une allure", () => {
  // Trouvé sur un ultra réel de 61 km : le kilomètre d'un ravitaillement s'affichait
  // « 91:32 /km ». Exact — c'est bien le temps écoulé — mais absurde présenté comme
  // une allure de course. On compte donc le temps EN MOUVEMENT.
  const pas = 0.0001;
  const pts: TP[] = [];
  let t = 0;
  for (let i = 0; i < 90; i++) { pts.push({ lat: 50 + i * pas, lon: 3, t }); t += 5; }
  // Arrêt de 10 minutes, sur place.
  for (let k = 0; k < 20; k++) { pts.push({ lat: 50 + 89 * pas, lon: 3, t }); t += 30; }
  for (let i = 90; i < 120; i++) { pts.push({ lat: 50 + i * pas, lon: 3, t }); t += 5; }

  const s = computeSplits(pts)[0];
  assert.ok(s.stoppedSeconds > 500, `arrêt détecté : ${s.stoppedSeconds} s`);
  assert.ok(s.seconds > 1000, "le temps ÉCOULÉ inclut bien l'arrêt");
  const p = splitPace(s) ?? 0;
  assert.ok(p < 700, `l'allure doit ignorer l'arrêt, obtenu ${Math.round(p)} s/km`);
  assert.ok(s.movingSeconds < s.seconds, "temps en mouvement < temps écoulé");
});
test("sans arrêt, temps en mouvement et temps écoulé coïncident", () => {
  const pts: TP[] = Array.from({ length: 120 }, (_, i) => ({ lat: 50 + i * 0.0001, lon: 3, t: i * 5 }));
  const s = computeSplits(pts)[0];
  assert.equal(s.stoppedSeconds, 0, "aucune pause ne doit être inventée");
  assert.equal(s.movingSeconds, s.seconds);
});

test("le dernier tronçon d'une sortie est SIGNALÉ comme partiel", () => {
  // Une sortie de 12,01 km finit sur 10 mètres. Présenter ce reste comme un
  // kilomètre plein afficherait un chrono aberrant en bas de tableau — souvent
  // spectaculairement rapide. Strava masque ce détail, on préfère le dire.
  // Trace synthétique : ligne droite plein nord, 1 point tous les ~11,1 m à 1 Hz.
  const pas = 0.0001; // ≈ 11,1 m de latitude
  const pts: TP[] = Array.from({ length: 250 }, (_, i) => ({ lat: 50 + i * pas, lon: 3, t: i * 4 }));
  const splits = computeSplits(pts);
  assert.ok(splits.length >= 2, `attendu au moins 2 tronçons, obtenu ${splits.length}`);
  assert.equal(splits[0].partial, false);
  assert.equal(splits[splits.length - 1].partial, true, "le reliquat doit être étiqueté");
  assert.ok(splits[splits.length - 1].distanceKm < 1, "un tronçon partiel fait moins d'un km");
});
test("un kilomètre mesuré fait bien un kilomètre", () => {
  const pas = 0.0001;
  const pts: TP[] = Array.from({ length: 120 }, (_, i) => ({ lat: 50 + i * pas, lon: 3, t: i * 5 }));
  const s = computeSplits(pts)[0];
  assert.ok(Math.abs(s.distanceKm - 1) < 0.02, `tronçon de ${s.distanceKm.toFixed(3)} km`);
  // 1 km à 11,1 m toutes les 5 s ⇒ ~450 s. On vérifie l'ordre de grandeur, pas le hasard.
  assert.ok(Math.abs(s.seconds - 450) < 20, `${s.seconds} s`);
  assert.ok(Math.abs((splitPace(s) ?? 0) - s.seconds) < 15, "l'allure doit coller à la durée sur 1 km");
});
test("l'allure d'un tronçon partiel est RAMENÉE au kilomètre", () => {
  // Sinon un reliquat de 200 m parcouru en 60 s s'afficherait « 1:00 /km » —
  // un record du monde apparent, en bas de chaque sortie.
  const partiel = { km: 13, seconds: 60, movingSeconds: 60, stoppedSeconds: 0, elevation: null, distanceKm: 0.2, partial: true };
  assert.equal(Math.round(splitPace(partiel) ?? 0), 300, "60 s pour 200 m = 5:00/km, pas 1:00");
});
test("sans altitude, pas de profil inventé", () => {
  // Un profil plat affiché sur une trace sans altimétrie ferait passer une montagne
  // pour une plaine.
  const sansAlt: TP[] = Array.from({ length: 60 }, (_, i) => ({ lat: 50 + i * 0.0001, lon: 3, t: i }));
  assert.equal(elevationProfile(sansAlt), null);
  const avecAlt = sansAlt.map((p, i) => ({ ...p, alt: 20 + i * 0.5 }));
  const prof = elevationProfile(avecAlt);
  assert.ok(prof && prof.length > 3);
  assert.equal(prof![prof!.length - 1].alt, avecAlt[avecAlt.length - 1].alt, "le dernier point doit être conservé");
});
test("le dénivelé d'un tronçon reste null quand la trace n'en porte pas", () => {
  const pts: TP[] = Array.from({ length: 120 }, (_, i) => ({ lat: 50 + i * 0.0001, lon: 3, t: i * 5 }));
  assert.equal(computeSplits(pts)[0].elevation, null, "« inconnu » n'est pas « plat »");
});

test("quelques sorties lointaines ne font PAS ouvrir la carte sur l'Europe", () => {
  // Mesuré sur l'historique réel : 72 % des passages dans 5 km, mais 19 % à plus de
  // 200 km (courses, vacances). Cadrer sur le tout donnait une fenêtre de 987 × 1 756 km
  // où le quartier d'entraînement — l'essentiel du contenu — tenait dans un pixel.
  const quartier: HC[] = Array.from({ length: 200 }, (_, i) => ({
    lat: 50.64 + (i % 20) * 0.0002, lon: 3.03 + Math.floor(i / 20) * 0.0002, n: 50,
  }));
  const vacances: HC[] = [{ lat: 43.30, lon: 5.37, n: 2 }, { lat: 48.85, lon: 2.35, n: 3 }];
  const b = denseBounds([...quartier, ...vacances])!;
  assert.ok(b.maxLat - b.minLat < 0.05, "le cadrage doit rester sur le quartier");
  assert.ok(b.minLat > 50 && b.maxLat < 51, `cadré hors du quartier : ${b.minLat}–${b.maxLat}`);
  // Les sorties lointaines restent DANS les données : on ne les supprime pas, on ne
  // cadre simplement pas dessus.
  assert.equal(heatBounds([...quartier, ...vacances])!.minLat, 43.30);
});
test("un point unique produit quand même une fenêtre cadrable", () => {
  const b = denseBounds([{ lat: 50.64, lon: 3.03, n: 1 }])!;
  assert.ok(b.maxLat > b.minLat && b.maxLon > b.minLon, "une zone de hauteur nulle n'est pas cadrable");
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

console.log("\nSPORTS — une montre en enregistre cinquante, la table n'en connaissait que quatre");
// La table ne couvrait que course, vélo, rando et marche. Tout le reste — natation,
// rameur, ski, elliptique, renfo, yoga, raquette — tombait en « other ».
test("les sports Garmin/Coros sont nommés, pas rangés en « autre »", () => {
  const attendu: Record<string, string> = {
    Swim: "swim", OpenWaterSwim: "swim",
    Rowing: "row", Kayaking: "row", StandUpPaddling: "row",
    NordicSki: "ski", AlpineSki: "ski", Snowshoe: "ski", InlineSkate: "ski",
    WeightTraining: "strength", Crossfit: "strength", HighIntensityIntervalTraining: "strength",
    Elliptical: "cardio", StairStepper: "cardio",
    Yoga: "mobility", Pilates: "mobility",
    Tennis: "ballsport", Soccer: "ballsport", Padel: "ballsport",
    VirtualRide: "bike", EBikeRide: "bike", GravelRide: "bike",
  };
  for (const [type, sport] of Object.entries(attendu)) {
    assert.equal(sportOf(type), sport, `${type} devrait être « ${sport} »`);
  }
  // Ce qu'on ne connaît pas reste « other » — au pire on l'exclut du volume de course,
  // ce qui est le sens prudent.
  assert.equal(sportOf("Quidditch"), "other");
});
test("aucun de ces sports ne compte comme de la course", () => {
  // C'est le point : une séance de ski ou de renfo ne doit pas gonfler le volume
  // hebdomadaire, ni servir à estimer une VMA.
  for (const t of ["Swim", "Rowing", "NordicSki", "WeightTraining", "Elliptical", "Yoga", "Tennis", "Workout"]) {
    assert.equal(isRun(sportOf(t)), false, `${t} compté comme de la course`);
  }
  for (const t of ["Run", "TrailRun", "VirtualRun"]) assert.equal(isRun(sportOf(t)), true);
});
test("l'impact sur les jambes distingue le vélo de la randonnée", () => {
  // Deux heures de vélo et deux heures de rando coûtent le même cardio ; seule la
  // seconde partage le compteur d'usure des mollets et des tendons.
  assert.equal(impactOf("bike"), "aucun");
  assert.equal(impactOf("swim"), "aucun");
  assert.equal(impactOf("hike"), "modéré");
  assert.equal(impactOf("run"), "élevé");
});
test("une séance de salle n'est plus lue comme du fractionné", () => {
  // « Workout » est le fourre-tout que Garmin envoie pour une séance de salle. Il était
  // rangé en sport COURSE et en rôle « interval » : le renfo entrait donc dans le volume
  // de course ET comptait comme une séance dure, ce qui bloquait la qualité du lendemain.
  assert.equal(sportOf("Workout"), "strength");
  assert.notEqual(roleOf("Workout"), "interval");
  assert.equal(roleOf("Workout"), "strength");
  // Les rôles historiques ne bougent pas : c'est ce qui rend le changement sûr.
  assert.equal(roleOf("Run"), "easy");
  assert.equal(roleOf("TrailRun"), "trail");
  assert.equal(roleOf("Hike"), "trail");
  assert.equal(roleOf("Walk"), "recovery");
  assert.equal(roleOf("Ride"), "easy");
});
test("la table des rôles n'existe qu'à UN endroit", () => {
  // Elle vivait en trois copies (sync, cron/sync-all, syncUser) qui divergeaient déjà :
  // « Workout » y était corrigé à un endroit et pas aux deux autres.
  for (const f of ["src/app/api/intervals/sync/route.ts", "src/app/api/cron/sync-all/route.ts", "src/lib/intervals/syncUser.ts"]) {
    assert.ok(!/function mapActivityType/.test(codeOf(f)), `${f} garde sa propre table de rôles`);
  }
});
test("les sports qui ne sont pas de la course ne remplissent pas un défi", () => {
  // Le filtre listait les sports INTERDITS : ce qui n'y figurait pas passait pour de la
  // course. Depuis l'élargissement de la table, le ski ou le renfo remplissaient un
  // défi « 100 km ». On teste maintenant l'appartenance à la course.
  const defi = { id: "d", name: "100 km", metric: "distance" as const, target: 100, starts_on: "2026-08-01", ends_on: "2026-08-31" };
  const jour = { date: "2026-08-10", distance_km: 30 };
  for (const sport of ["ski", "strength", "cardio", "ballsport", "swim", "row"]) {
    assert.equal(challengeProgress(defi, [{ ...jour, sport }]).value, 0, `${sport} compté dans un défi de course`);
  }
  assert.equal(challengeProgress(defi, [{ ...jour, sport: "run" }]).value, 30);
});

console.log("\nCROSS-TRAINING — en minutes et en TSS, jamais en kilomètres additionnés");
const CROSS_NOW = Date.parse("2026-08-14T12:00:00Z");
const cw = (o: Partial<{ date: string; sport: string; type: string; duration_seconds: number; tss: number; elevation_gain_m: number }>) =>
  ({ date: "2026-08-13", sport: "run", type: "easy", duration_seconds: 3600, tss: 60, ...o });
test("une séance SANS distance est enfin visible", () => {
  // Le défaut : le résumé se comptait en kilomètres. Un home-trainer, un rameur, du
  // renfo ou du yoga n'ont pas de distance — ils valaient donc zéro et n'apparaissaient
  // nulle part, alors qu'ils pesaient bien dans la charge. Le coach commentait une
  // fatigue dont il ne voyait pas la cause.
  const s = summarizeCross([
    cw({ sport: "bike", type: "easy", duration_seconds: 5400, tss: 90 }),   // home-trainer, 0 km
    cw({ sport: "strength", duration_seconds: 2400, tss: 30 }),
  ], CROSS_NOW);
  assert.equal(s.minutes, 130, "les minutes doivent être comptées même sans distance");
  assert.equal(s.tss, 120);
  assert.equal(s.sessions, 2);
  assert.ok(s.label && /vélo/.test(s.label) && /renforcement/.test(s.label), `libellé incomplet : ${s.label}`);
});
test("les kilomètres de natation ne s'additionnent pas à ceux du vélo", () => {
  // 40 km de vélo + 2 km de bassin faisaient « 42 km d'autres sports » : une somme qui
  // ne veut rien dire. Chaque sport est désormais compté séparément.
  const s = summarizeCross([
    cw({ sport: "bike", duration_seconds: 7200, tss: 120 }),
    cw({ sport: "swim", duration_seconds: 2700, tss: 45 }),
  ], CROSS_NOW);
  assert.equal(s.bySport.length, 2, "les sports doivent rester distincts");
  assert.ok(!/\d+\s*km/.test(s.label ?? ""), `le résumé ne doit plus parler en km : ${s.label}`);
  assert.equal(s.bySport[0].sport, "bike", "le sport le plus chargeant vient en premier");
});
test("la part de charge hors course est calculée, pas devinée", () => {
  const s = summarizeCross([
    cw({ sport: "run", tss: 300 }),
    cw({ sport: "hike", tss: 100, duration_seconds: 7200 }),
  ], CROSS_NOW);
  assert.equal(s.sharePct, 25, "100 TSS sur 400 = 25 %");
  assert.equal(s.impactMinutes, 120, "la randonnée charge les jambes, elle compte dans l'impact");
});
test("le vélo ne compte pas dans les minutes avec impact", () => {
  const s = summarizeCross([cw({ sport: "bike", duration_seconds: 3600, tss: 60 })], CROSS_NOW);
  assert.equal(s.impactMinutes, 0, "le vélo fatigue le cardio, pas les tendons");
});
test("sans cross-training, on ne dit rien du tout", () => {
  // Un contexte de coach rempli de « 0 min de cross-training » est du bruit.
  const s = summarizeCross([cw({ sport: "run" })], CROSS_NOW);
  assert.equal(s.label, null);
  assert.equal(s.minutes, 0);
  // Les séances hors fenêtre ne comptent pas : une rando d'il y a trois semaines n'est
  // pas la charge de cette semaine.
  const vieux = summarizeCross([cw({ sport: "hike", date: "2026-07-01", tss: 200 })], CROSS_NOW);
  assert.equal(vieux.label, null);
});

console.log("\nBUDGET DE QUALITÉ — la fatigue ne doit pas vider une préparation");
const qb = (o: Partial<Parameters<typeof computeQualityBudget>[0]> = {}) => computeQualityBudget({
  level: "confirme", goal: "marathon", phase: "DÉVELOPPEMENT", noHistory: false, pains: [],
  hrvDown: false, hrvUp: false, badNight: false, acr: 1.0, tsb: 0, rpeHigh: false, rpeAvg: null,
  hardTimePct: null, fadeSec: null, plateau: false, noMaxEffort: false, runYears: 5,
  weightLossMaxQuality: null, hasObjective: true, daysToRace: 72, isShortGoal: false, ...o,
});
test("le ratio aigu:chronique et le TSB ne sont plus comptés deux fois", () => {
  // Cas RÉEL du compte de production : confirmé, marathon dans 72 jours, 73 km courus
  // dans la semaine après trois semaines d'arrêt → ratio 1,9 et TSB −35. Ce sont DEUX
  // lectures de la même série de charge : quand la charge récente dépasse la charge de
  // fond, le ratio monte ET le TSB plonge, mécaniquement. Chacun retirait une séance :
  // budget structurel 2 → 0. Une montée en charge — c'est-à-dire une préparation —
  // coûtait donc toute la qualité de la semaine.
  const r = qb({ acr: 1.92, tsb: -35 });
  assert.ok(r.qBudget >= 1, `qBudget ${r.qBudget} : la même fatigue est encore comptée deux fois`);
  assert.equal(r.easeReasons.length, 1, "un seul motif pour un seul phénomène");
  assert.ok(/ratio aigu:chronique/.test(r.easeReasons[0]) && /TSB/.test(r.easeReasons[0]),
    `les deux chiffres doivent rester visibles : ${r.easeReasons[0]}`);
});
test("une préparation ne descend pas à zéro qualité sur une fatigue de charge", () => {
  // Zéro qualité pendant des semaines, à dix semaines d'un marathon, est une erreur
  // d'entraînement — pas une précaution. On garde UNE séance, raccourcie.
  const r = qb({ acr: 1.92, tsb: -35, rpeHigh: true, rpeAvg: 8, hardTimePct: 40 });
  assert.equal(r.qBudget, 1, "le plancher « préparation en cours » n'a pas joué");
  assert.equal(r.floored, true, "la séance sauvée doit être signalée comme allégée");
});
test("le plancher ne s'applique QUE si une échéance approche", () => {
  assert.equal(qb({ acr: 1.92, tsb: -35, hasObjective: false, daysToRace: null, rpeHigh: true, rpeAvg: 8, hardTimePct: 40 }).qBudget, 0);
  assert.equal(qb({ acr: 1.92, tsb: -35, daysToRace: 300, rpeHigh: true, rpeAvg: 8, hardTimePct: 40 }).qBudget, 0);
});
test("douleur, double signal VFC+sommeil et interdiction médicale gardent le dernier mot", () => {
  // Le plancher ne doit JAMAIS passer devant un vrai signal d'alerte. C'est la ligne
  // rouge de tout ce correctif.
  assert.equal(qb({ acr: 1.92, tsb: -35, pains: ["mollet droit"], rpeHigh: true, rpeAvg: 8, hardTimePct: 40 }).qBudget, 0, "une douleur doit tout arrêter");
  assert.equal(qb({ acr: 1.92, tsb: -35, hrvDown: true, badNight: true, hardTimePct: 40, rpeHigh: true, rpeAvg: 8 }).qBudget, 0, "VFC en baisse ET nuit dégradée = alerte");
  assert.equal(qb({ noHistory: true }).qBudget, 0, "un athlète sans historique n'a pas de plancher");
});
test("le passif de coureur plafonne même le plancher", () => {
  // Un cardio de confirmé sur des tendons de huit mois : le plafond n'est pas négociable.
  const r = qb({ acr: 1.92, tsb: -35, runYears: 0.5, rpeHigh: true, rpeAvg: 8 });
  assert.ok(r.qBudget <= 1, `${r.qBudget} qualité(s) pour moins d'un an de course`);
  assert.equal(qb({ runYears: 0.5 }).qBudget, 1, "moins d'un an → une seule qualité, même frais");
});
test("le plafond perte de poids reste infranchissable", () => {
  const r = qb({ acr: 1.92, tsb: -35, weightLossMaxQuality: 0, rpeHigh: true, rpeAvg: 8 });
  assert.equal(r.qBudget, 0, "le plancher a contourné le plafond perte de poids");
});
test("sans fatigue, rien ne change pour un athlète frais", () => {
  // Un correctif qui déplacerait le comportement normal serait pire que le défaut.
  const r = qb();
  assert.equal(r.qBudget, 2, "confirmé + marathon = 2 qualités");
  assert.equal(r.easeReasons.length, 0);
  assert.equal(r.floored, false, "aucune séance à raccourcir quand rien n'est allégé");
});
test("une séance déjà allégée ne l'est pas deux fois", () => {
  // Trouvé en vérifiant le plan réel : la séance sauvée par le plancher est posée
  // « (allégée) » dès sa création, et le verdict orange du jour la ré-annotait —
  // « Séance au seuil (allégée) (allégée) », sur le calendrier ET sur la montre.
  const c = ctx({
    weekPlan: { qBudget: 1, quality: [qual("Seuil", "Seuil : 3×10 min à ~4'00/km, récup 2 min")], easyPace: "5'20", eased: true, floored: true },
    readiness: { level: "orange", ...motifs("charge récente très supérieure à la charge de fond"), advice: "" },
  });
  for (const d of buildWeekPlan(c)) {
    assert.ok(!/\(allégée\).*\(allégée\)/.test(d.title), `titre annoté deux fois : « ${d.title} »`);
  }
  // Et la mention doit tout de même être là une fois : la séance EST raccourcie.
  const q = buildWeekPlan(c).find((d) => d.type === "Seuil");
  assert.ok(q && /\(allégée\)/.test(q.title), "la séance raccourcie doit être annoncée comme telle");
});
test("la VFC peut RENDRE ce qu'elle prend : le corps contredit l'arithmétique", () => {
  // La VFC ne servait qu'à punir : une baisse coûtait une séance, une hausse ne rendait
  // jamais rien. Cas réel, 14/08/2026 : VFC 7 j à +22 % et au plus haut de tout
  // l'historique, sommeil ~7 h, aucune douleur — et le plan proposait quatre footings de
  // 25 min d'affilée à un athlète qui courait 73 km cette semaine-là, parce que le ratio
  // aigu:chronique était à 2,0 APRÈS TROIS SEMAINES D'ARRÊT. Ce ratio n'est pas une
  // mesure de fatigue : c'est un indicateur de risque calculé sur une charge de fond
  // effondrée par la coupure. La VFC, elle, mesure l'état réel du système nerveux.
  const r = qb({ acr: 1.92, tsb: -35, hrvUp: true });
  assert.equal(r.qBudget, 2, "la qualité doit être maintenue quand le corps dit qu'il va bien");
  assert.equal(r.easeReasons.length, 0, "aucun allègement : ce n'est pas une fatigue mesurée");
  assert.equal(r.bodySaysFresh, true);
  // Mais on ne fait pas SEMBLANT de ne pas avoir vu la charge.
  assert.equal(r.notes.length, 1, "la charge élevée doit être ANNONCÉE, même si elle ne coûte rien");
  assert.ok(/ratio aigu:chronique/.test(r.notes[0]) && /VFC/.test(r.notes[0]), r.notes[0]);
});
test("une VFC haute n'excuse NI une douleur NI une nuit dégradée", () => {
  // Le risque du correctif précédent : que la VFC devienne un laissez-passer permanent.
  assert.equal(qb({ acr: 1.92, tsb: -35, hrvUp: true, pains: ["tendon d'Achille"] }).bodySaysFresh, false);
  assert.equal(qb({ acr: 1.92, tsb: -35, hrvUp: true, badNight: true }).bodySaysFresh, false);
  // …et dans ces deux cas la charge redevient un motif d'allègement.
  assert.ok(qb({ acr: 1.92, tsb: -35, hrvUp: true, pains: ["mollet"] }).easeReasons.some((x) => /charge récente/.test(x)));
  assert.ok(qb({ acr: 1.92, tsb: -35, hrvUp: true, badNight: true }).easeReasons.some((x) => /charge récente/.test(x)));
});
test("sans VFC en hausse, la charge coûte toujours une séance", () => {
  // Le comportement de référence ne doit pas bouger : le correctif n'ouvre une porte
  // QUE sur une preuve physiologique positive, pas par défaut.
  const r = qb({ acr: 1.92, tsb: -35 });
  assert.equal(r.bodySaysFresh, false);
  assert.equal(r.qBudget, 1);
  assert.equal(r.easeReasons.length, 1);
  assert.equal(r.notes.length, 0);
});
test("le budget STRUCTUREL ignore la fatigue du moment", () => {
  // Il porte la feuille de route des semaines suivantes : une mauvaise nuit ne doit pas
  // vider deux mois de plan.
  assert.equal(qb({ acr: 2.4, tsb: -44, pains: ["genou"] }).structuralQBudget, 2);
});

console.log("\nBALAYAGE PÉRIODIQUE — le seul chemin qui marche app fermée");
// Le sondage navigateur (AutoSync) ne tourne que tant qu'un onglet est ouvert. Un
// athlète qui termine à 18 h et ne rouvre pas l'app attendait le passage de 3 h 30.
const ath = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `u${String(i).padStart(3, "0")}` }));
test("tout le monde est balayé, et personne deux fois dans le même passage", () => {
  const all = ath(120);
  const vus = new Set<string>();
  // 6 passages = une heure à 10 min d'intervalle. 120 athlètes / 25 par passage = 5
  // tranches : tout le monde doit être vu au moins une fois dans l'heure.
  for (let k = 0; k < 6; k++) {
    const { batch } = shardForPass(all, { perPass: 25, everyMinutes: 10, now: k * 10 * 60_000 });
    assert.equal(new Set(batch.map((a) => a.id)).size, batch.length, "un athlète traité deux fois dans le même passage");
    for (const a of batch) vus.add(a.id);
  }
  assert.equal(vus.size, all.length, `${all.length - vus.size} athlète(s) jamais balayé(s) en une heure`);
});
test("le découpage ne dépend d'aucun état stocké", () => {
  // Un curseur en base peut se corrompre ou se figer ; l'horloge, non. Deux appels au
  // même instant doivent donner exactement la même tranche.
  const all = ath(60);
  const a = shardForPass(all, { perPass: 25, everyMinutes: 10, now: 1_000_000 });
  const b = shardForPass(all, { perPass: 25, everyMinutes: 10, now: 1_000_000 });
  assert.deepEqual(a.batch.map((x) => x.id), b.batch.map((x) => x.id));
  // Et l'ordre d'arrivée des profils ne doit rien changer : sans tri, deux passages
  // pourraient traiter deux fois le même athlète et jamais un autre.
  const melange = shardForPass([...all].reverse(), { perPass: 25, everyMinutes: 10, now: 1_000_000 });
  assert.deepEqual(melange.batch.map((x) => x.id), a.batch.map((x) => x.id));
});
test("un seul athlète est balayé à CHAQUE passage", () => {
  // Cas d'aujourd'hui : une seule personne inscrite. Le découpage ne doit pas la faire
  // attendre 50 minutes sur six.
  const { batch, shards } = shardForPass(ath(1), { perPass: 25, everyMinutes: 10 });
  assert.equal(shards, 1);
  assert.equal(batch.length, 1);
});

console.log("\nREPLANIFICATION — jamais en rafale, jamais sans raison");
test("la séance DÉJÀ COURUE aujourd'hui n'est pas réécrite", () => {
  // Défaut invisible tant que le plan n'était republié qu'à 3 h 30 : en replanifiant
  // juste après une séance, la prescription du jour est réécrite dans la seconde qui
  // suit son exécution — la séance au seuil que l'athlète vient de faire devient
  // « Récupération », parce que la fraîcheur tient compte de l'effort qu'il vient de
  // fournir. L'effacement ET l'insertion ET la poussée montre doivent partir de la
  // MÊME date, sans quoi le calendrier et la montre divergent.
  const src = codeOf("src/lib/ai/autoCoach.ts");
  assert.ok(/const from = dayZeroFrozen \? week\[1\]\.date : today/.test(src), "le gel du jour 0 a disparu");
  assert.ok(/\.gte\("data->>date", from\)/.test(src), "l'effacement ne part pas de la date gelée");
  assert.ok(/week\.filter\(\(d: PlanDay\) => d\.date >= from\)/.test(src), "l'insertion ne part pas de la date gelée");
  // On vérifie l'INVARIANT (la poussée part de la date gelée), pas une expression
  // exacte : la ligne s'est enrichie du filtrage par jours confirmés quand les doubles
  // séances sont arrivées, et un test qui épingle une chaîne littérale casse au premier
  // changement légitime.
  assert.ok(/filter\(\(x\) => x\.date >= from\b/.test(src), "la poussée montre ne part pas de la date gelée");
});
test("la chaîne sync → analyse → replanification → montre n'existe qu'à un endroit", () => {
  // Elle a existé en trois exemplaires divergents. Le cron n'importait aucune trace GPS
  // et ignorait le garde-fou anti-rafale : invisible à raison d'un passage par nuit,
  // ruineux à raison d'un passage toutes les 10 minutes.
  for (const f of ["src/app/api/cron/sync-all/route.ts", "src/app/api/intervals/sync/route.ts"]) {
    const src = codeOf(f);
    assert.ok(!/autoCoachForUser/.test(src), `${f} rappelle le coach directement au lieu de passer par replanIfFresh`);
    assert.ok(!/importMissingTracks/.test(src), `${f} garde sa propre importation de traces`);
  }
});

console.log("\nTRADUCTIONS — une clé manquante s'affiche telle quelle, sans rien casser");
test("le profil traduit TOUTES les clés qu'il utilise, dans les 5 langues", () => {
  // Défaut vu en production : l'écran Profil affichait « double.title » et
  // « privacy.private » en toutes lettres. Les clés avaient été ajoutées au
  // dictionnaire GLOBAL, alors que ce composant porte le SIEN, en interne.
  // Rien n'avait planté : `tr()` retombe sur la clé brute, donc le défaut s'affiche
  // sans jamais se signaler — et il aura fallu une capture d'écran pour le voir.
  const src = readFileSync("src/components/profile/ProfileSettings.tsx", "utf8");
  const utilisees = [...new Set([...src.matchAll(/\btr\("([^"]+)"/g)].map((m) => m[1]))];
  assert.ok(utilisees.length > 20, `seulement ${utilisees.length} clés trouvées : l'extraction a dû casser`);
  // Le dictionnaire interne : on vérifie chaque langue, pas seulement le français.
  const blocs = src.split(/^\s{2}(fr|en|de|es|pt):\s*\{/m);
  const parLangue: Record<string, string> = {};
  for (let i = 1; i < blocs.length; i += 2) parLangue[blocs[i]] = blocs[i + 1];
  assert.equal(Object.keys(parLangue).length, 5, "les 5 langues doivent être présentes");
  for (const [lang, bloc] of Object.entries(parLangue)) {
    const manquantes = utilisees.filter((k) => !bloc.includes(`"${k}":`));
    assert.deepEqual(manquantes, [], `${lang} : clés absentes du dictionnaire → ${manquantes.join(", ")}`);
  }
});

console.log("\nDOUBLES SÉANCES — scinder, jamais empiler");
const dbl = (o: Partial<Parameters<typeof etatDouble>[0]> = {}) => etatDouble({
  optIn: true, weeklyKm: 80, runYears: 5, readiness: "vert", pains: [], taper: false, ...o,
});
test("les motifs de refus existent dans les 5 langues", () => {
  // Ils s'affichent dans le PROFIL, à la seconde où l'athlète coche la case. Les servir
  // en français à un écran allemand revient à traduire l'étiquette et pas la réponse.
  const attendus: Record<string, RegExp> = {
    fr: /volume hebdomadaire/, en: /weekly volume/, de: /Wochenumfang/,
    es: /volumen semanal/, pt: /volume semanal/,
  };
  for (const [lang, motif] of Object.entries(attendus)) {
    const r = etatDouble({ optIn: true, weeklyKm: 30, runYears: 2, readiness: "vert", pains: [], taper: false, lang: lang as "fr" });
    assert.equal(r.autorise, false);
    assert.ok(motif.test(r.manque.join(" ")), `${lang} : motif non traduit — ${r.manque[0]?.slice(0, 60)}`);
    assert.ok(!/undefined/.test(r.manque.join(" ") + r.manqueSeuil.join(" ")), `${lang} : trou de traduction`);
    // Le chiffre doit rester : « ton volume est insuffisant » sans le nombre n'apprend rien.
    assert.ok(/30/.test(r.manque.join(" ")), `${lang} : le volume réel a disparu du motif`);
  }
});
test("une langue inconnue retombe sur le français, jamais sur du vide", () => {
  const r = etatDouble({ optIn: false, weeklyKm: 30, runYears: 2, readiness: "vert", pains: [], taper: false, lang: "kl" as "fr" });
  assert.ok(r.manque.length >= 2);
  assert.ok(/n'est pas activée/.test(r.manque[0]));
});
test("sans la case cochée, le coach ne double JAMAIS", () => {
  // Doubler impose une organisation quotidienne : ça ne s'impose pas à quelqu'un qui
  // n'a rien demandé, même si son volume s'y prête.
  const r = dbl({ optIn: false });
  assert.equal(r.autorise, false);
  assert.ok(r.manque.some((m) => /pas activée/.test(m)));
});
test("une case cochée qui ne produit rien DOIT dire pourquoi", () => {
  // C'est tout l'enjeu : sinon l'athlète coche, ne voit aucun changement, et conclut
  // que la fonction est cassée. Un réglage silencieux est un réglage qui ment.
  for (const cas of [
    { weeklyKm: 30 }, { pains: ["mollet"] }, { readiness: "rouge" as const }, { taper: true },
  ]) {
    const r = dbl(cas);
    assert.equal(r.autorise, false, `${JSON.stringify(cas)} : ne devrait pas autoriser`);
    assert.ok(r.manque.length > 0, `${JSON.stringify(cas)} : refus SANS motif`);
  }
});
test("le volume décide, et c'est le volume REPRÉSENTATIF", () => {
  assert.equal(dbl({ weeklyKm: 54 }).autorise, false, "sous le seuil : une sortie suffit");
  assert.equal(dbl({ weeklyKm: 55 }).autorise, true, "au seuil : autorisé");
  // Le motif de refus doit donner le chiffre, pas dire « volume insuffisant ».
  assert.ok(/30 km/.test(dbl({ weeklyKm: 30 }).manque.join(" ")), "le volume réel doit être cité");
});
test("on SCINDE, on n'ajoute pas : le volume total ne bouge pas", () => {
  // Un double qui AJOUTE du volume, c'est une hausse de charge déguisée en confort.
  // Ici la somme des deux sorties égale la sortie d'origine.
  for (const km of [12, 16, 18, 21, 25]) {
    const p = scinderFacile(km)!;
    assert.ok(p, `${km} km : devrait être scindable`);
    assert.equal(p.matinKm + p.soirKm, Math.round(km), `${km} km : le total a changé`);
    assert.ok(p.matinKm < p.soirKm, `${km} km : le matin doit rester la sortie SECONDAIRE`);
  }
});
test("une sortie courte n'est pas scindée", () => {
  // Deux sorties de 5 km ne valent pas deux douches et deux échauffements.
  for (const km of [0, 6, 9, 11.9]) assert.equal(scinderFacile(km), null, `${km} km scindé à tort`);
});
test("le double SEUIL a une barre bien plus haute, et on dit laquelle", () => {
  // C'est une méthode d'athlète entraîné, pas une variante de footing.
  assert.equal(dbl({ weeklyKm: 80, runYears: 5 }).doubleSeuil, false, "80 km ne suffisent pas");
  assert.equal(dbl({ weeklyKm: 95, runYears: 2 }).doubleSeuil, false, "2 ans de course ne suffisent pas");
  assert.equal(dbl({ weeklyKm: 95, runYears: 5 }).doubleSeuil, true);
  assert.ok(dbl({ weeklyKm: 80, runYears: 5 }).manqueSeuil.some((m) => /90 km/.test(m)), "le seuil chiffré doit être donné");
});
test("le double seuil est TOUJOURS accompagné de l'avertissement lactate", () => {
  // La méthode se pilote au lactate : sans lactatemètre on ne peut que l'approcher, et
  // l'erreur classique est de courir trop vite — ce qui la transforme en deux séances
  // dures et coûte la semaine. Le taire serait prescrire une méthode amputée de ce qui
  // la rend sûre.
  assert.ok(/lactate/i.test(AVERTISSEMENT_LACTATE));
  assert.ok(/trop vite/.test(AVERTISSEMENT_LACTATE), "l'erreur classique doit être nommée");
  const matin = seanceDoubleSeuil("matin", "4'00"), soir = seanceDoubleSeuil("soir", "4'00");
  assert.ok(/6 min/.test(matin) && /1 min/.test(soir), "matin long, soir court");
  assert.ok(/SOUS le seuil|MOINS 5/.test(matin + soir), "les deux séances restent sous le seuil");
});
test("la déduplication porte sur le CRÉNEAU, pas sur la date", () => {
  // Elle portait sur la seule date : la seconde séance d'un jour doublé disparaissait
  // des six écrans qui l'appellent, y compris de la poussée vers la montre.
  const rows = [
    { data: { date: "2026-08-20", moment: "soir" } },
    { data: { date: "2026-08-20", moment: "matin" } },
    { data: { date: "2026-08-20", moment: "soir" } },   // doublon réel : à écarter
    { data: { date: "2026-08-21" } },
  ];
  const gardees = oneSessionPerSlot(rows, (r) => slotKey(r.data));
  assert.equal(gardees.length, 3, "matin ET soir doivent survivre, le doublon non");
  assert.equal(slotKey({ date: "2026-08-20" }), "2026-08-20#");
  assert.equal(slotKey({ date: "2026-08-20", moment: "matin" }), "2026-08-20#matin");
  assert.equal(slotKey(null), "", "sans date, aucune clé — la ligne est écartée");
});
test("les six écrans passent par la MÊME clé de créneau", () => {
  // Si l'un d'eux oubliait le moment, il rétablirait le défaut sur son seul écran :
  // le calendrier montrerait deux séances, le tableau de bord une seule.
  for (const f of [
    "src/app/dashboard/page.tsx", "src/app/dashboard/calendrier/page.tsx",
    "src/app/api/ai/cours/route.ts", "src/app/api/ai/physio/route.ts",
  ]) {
    const src = codeOf(f);
    assert.ok(/slotKey\(/.test(src), `${f} n'utilise pas la clé de créneau partagée`);
    assert.ok(!/oneSessionPerDate/.test(src), `${f} appelle encore l'ancienne déduplication`);
  }
});

console.log("\nÂGE & DISTANCE — avertir un jeune athlète sans jamais le bloquer");
test("18 ans + marathon : la distance n'est PAS autorisée, et on le dit", () => {
  // Règlement FFA : Junior/U20 (18-19 ans) est limité à 25 km ; le marathon n'ouvre
  // qu'à partir d'Espoir/U23, soit 20 ans. Un athlète de 18 ans qui prépare un
  // marathon pendant douze semaines ne pourra pas s'inscrire — le lui taire serait
  // le laisser courir après une course à laquelle il n'a pas accès.
  const a = avertissementAge({ age: 18, distanceKm: 42.2 });
  assert.equal(a?.niveau, "reglement");
  assert.ok(/Junior/.test(a!.texte), "la catégorie doit être nommée");
  assert.ok(/25 km/.test(a!.texte), "la limite chiffrée doit figurer");
  assert.ok(/20 ans/.test(a!.texte), "on doit dire QUAND ça s'ouvre");
  assert.ok(/semi-marathon/.test(a!.texte), "on doit nommer le palier accessible AUJOURD'HUI");
});
test("18 ans + semi : autorisé — on n'invente pas d'interdiction", () => {
  // 21,1 km passe sous la limite des 25 km. Un avertissement de règlement ici serait
  // FAUX, et un athlète à qui on interdit à tort ne fait plus confiance au reste.
  const a = avertissementAge({ age: 18, distanceKm: 21.1 });
  assert.equal(a?.niveau, "progression", "le semi doit rester autorisé à 18 ans");
  assert.ok(!/NON AUTORISÉE/.test(a!.texte));
});
test("16 ans : la limite descend à 15 km", () => {
  assert.equal(avertissementAge({ age: 16, distanceKm: 21.1 })?.niveau, "reglement");
  assert.ok(/15 km/.test(avertissementAge({ age: 16, distanceKm: 21.1 })!.texte));
  assert.ok(/10 km/.test(avertissementAge({ age: 16, distanceKm: 21.1 })!.texte), "le palier accessible est le 10 km");
  assert.equal(avertissementAge({ age: 16, distanceKm: 10 }), null, "un 10 km à 16 ans ne mérite aucune alerte");
});
test("le TRAIL compte en km effort : le dénivelé alourdit, il n'allège pas", () => {
  // 20 km avec 1 000 m de D+ valent 30 km effort — au-dessus de la limite Junior,
  // alors que 20 km de plat passent. C'est le sens physiologique : grimper coûte.
  assert.equal(kmEffort(20, 1000), 30);
  assert.equal(kmEffort(23, 300), 26);
  assert.equal(avertissementAge({ age: 18, distanceKm: 20, deniveleM: 1000, trail: true })?.niveau, "reglement");
  assert.equal(avertissementAge({ age: 18, distanceKm: 20, deniveleM: 0, trail: true }), null);
  // Sans dénivelé connu, on ne majore RIEN : on n'invente pas le profil d'une course.
  assert.equal(kmEffort(20, null), 20);
});
test("un adulte n'est jamais sermonné", () => {
  // Le risque de ce genre de garde-fou est de devenir un moralisateur permanent.
  for (const age of [23, 30, 45, 60]) {
    assert.equal(avertissementAge({ age, distanceKm: 42.2 }), null, `${age} ans : avertissement injustifié`);
    assert.equal(avertissementAge({ age, distanceKm: 160 }), null, `${age} ans : ultra injustement signalé`);
  }
});
test("20-22 ans + marathon : autorisé, avec un CONSEIL clairement annoncé comme tel", () => {
  const a = avertissementAge({ age: 20, distanceKm: 42.2 });
  assert.equal(a?.niveau, "progression");
  assert.ok(/autorisé/.test(a!.texte), "il faut dire que c'est permis, sinon on décourage à tort");
  assert.ok(/paliers/.test(a!.texte), "le conseil doit être actionnable");
});
test("le conseil PARLE de la distance demandée, pas d'une autre", () => {
  // Défaut vu en lisant le rendu réel : le texte servi pour un SEMI parlait du marathon
  // (« l'effort le plus exigeant », « meilleur niveau entre 28 et 35 ans »). Un conseil
  // qui ne correspond pas à la question posée se lit comme un message automatique.
  const semi = avertissementAge({ age: 20, distanceKm: 21.1 })!.texte;
  assert.ok(/semi-marathon/.test(semi), "le semi doit être nommé");
  assert.ok(!/28 et 35 ans/.test(semi), "l'âge du pic MARATHON n'a rien à faire dans un conseil sur le semi");
  const mara = avertissementAge({ age: 20, distanceKm: 42.2 })!.texte;
  assert.ok(/28 et 35 ans/.test(mara), "sur marathon, le repère d'âge est pertinent");
  const ultra = avertissementAge({ age: 21, distanceKm: 80, trail: true })!.texte;
  assert.ok(/ultra/i.test(ultra), "un ultra ne s'appelle pas « marathon »");
});
test("les nombres sont écrits en français", () => {
  // « 42.2 km » au milieu d'une phrase française trahit une chaîne de débogage.
  const t = avertissementAge({ age: 18, distanceKm: 42.2 })!.texte;
  assert.ok(/42,2 km/.test(t), `séparateur décimal anglais : ${t.slice(0, 160)}`);
  assert.ok(!/42\.2/.test(t));
});
test("sans âge connu, on se tait", () => {
  // Deviner une catégorie pour avertir quelqu'un serait avertir sur une supposition.
  for (const age of [null, undefined, NaN, 0, 200]) {
    assert.equal(avertissementAge({ age: age as number, distanceKm: 42.2 }), null, `âge ${age} : avertissement fabriqué`);
  }
});
test("l'AVIS MÉDICAL existe, il est chiffré à 18 ans, et il est cité", () => {
  // Vérifié en ligne : l'IMMDA (directeurs médicaux de marathons) écrit que le marathon
  // doit être réservé aux 18 ans révolus. C'est un avis MÉDICAL, distinct de la règle
  // fédérale française qui, elle, fixe 20 ans.
  const a = avertissementsAge({ age: 16, distanceKm: 42.2 });
  const medical = a.find((x) => x.niveau === "medical");
  assert.ok(medical, "aucun avis médical à 16 ans sur un marathon");
  assert.ok(/IMMDA/.test(medical!.texte), "l'organisme doit être nommé");
  assert.ok(/18 ans/.test(medical!.texte), "le seuil chiffré doit figurer");
  assert.ok(medical!.sources.length > 0, "un avertissement de santé sans source ne se vérifie pas");
});
test("les DEUX autorités parlent quand elles ont chacune quelque chose à dire", () => {
  // À 16 ans, un marathon se heurte à la règle fédérale (inscription impossible) ET à
  // l'avis médical. Ce ne sont pas deux formulations du même argument : n'en montrer
  // qu'une reviendrait à cacher un fait.
  const a = avertissementsAge({ age: 16, distanceKm: 42.2 });
  assert.deepEqual(a.map((x) => x.niveau), ["reglement", "medical"]);
  // À 19 ans en revanche : la FFA bloque encore (25 km), mais l'avis médical est levé.
  const b = avertissementsAge({ age: 19, distanceKm: 42.2 });
  assert.deepEqual(b.map((x) => x.niveau), ["reglement"], "l'avis médical ne vaut plus à 19 ans");
});
test("on n'affirme PLUS que ces limites protègent le cartilage de croissance", () => {
  // C'était écrit dans la première version de ce module — et c'est une extrapolation :
  // l'Académie américaine de pédiatrie constate que les lésions du cartilage de
  // conjugaison liées à la course n'ont PAS été retrouvées de façon constante. Sur un
  // sujet de santé, une raison inventée décrédibilise l'avertissement entier.
  const tous = [
    ...avertissementsAge({ age: 16, distanceKm: 42.2 }),
    ...avertissementsAge({ age: 18, distanceKm: 42.2 }),
  ].map((x) => x.texte).join(" ");
  assert.ok(!/protéger un squelette/.test(tous), "affirmation non sourcée sur le squelette");
  assert.ok(/pas de lésion de façon constante|ne sont pas le cartilage/.test(tous),
    "la nuance de l'AAP doit être dite, pas tue");
});
test("les avertissements existent dans les 5 langues, sans trou ni français résiduel", () => {
  // Ils étaient en français uniquement. Passable pour un chrono, plus du tout quand on
  // cite un RÈGLEMENT FRANÇAIS à un athlète allemand ou portugais.
  const attendus: Record<string, RegExp> = {
    fr: /Fédération française/, en: /French athletics federation/,
    de: /französische Leichtathletikverband/, es: /federación francesa/, pt: /federação francesa/,
  };
  for (const [lang, motif] of Object.entries(attendus)) {
    const a = avertissementsAge({ age: 16, distanceKm: 42.2, lang: lang as "fr" });
    assert.equal(a.length, 2, `${lang} : les deux autorités doivent parler`);
    assert.ok(motif.test(a[0].texte), `${lang} : texte non traduit — ${a[0].texte.slice(0, 70)}`);
    assert.ok(!/undefined/.test(a[0].texte + a[1].texte), `${lang} : trou de traduction`);
    assert.ok(a.every((x) => x.sources.length > 0), `${lang} : sources manquantes`);
  }
  // Les paliers aussi : « Le semi-marathon t'est ouvert » ne doit pas arriver à moitié
  // en français chez un athlète anglophone.
  assert.ok(/half marathon/.test(avertissementsAge({ age: 18, distanceKm: 42.2, lang: "en" })[0].texte));
  assert.ok(/Halbmarathon/.test(avertissementsAge({ age: 18, distanceKm: 42.2, lang: "de" })[0].texte));
});
test("la limite française est annoncée COMME française aux étrangers", () => {
  // La limite FFA s'applique aux épreuves organisées EN FRANCE. Laisser croire à un
  // athlète allemand qu'elle est universelle serait faux — traduire ne suffit pas.
  for (const lang of ["en", "de", "es", "pt"] as const) {
    const t = avertissementsAge({ age: 16, distanceKm: 42.2, lang })[0].texte;
    assert.ok(/France|Frankreich|Francia|França/.test(t), `${lang} : le pays n'est pas nommé`);
    assert.ok(/federation|Verband|federación|federação/i.test(t), `${lang} : on n'invite pas à vérifier sa propre fédération`);
  }
});
test("les nombres suivent la locale de l'athlète", () => {
  assert.ok(/42,2/.test(avertissementsAge({ age: 18, distanceKm: 42.2, lang: "fr" })[0].texte));
  assert.ok(/42\.2/.test(avertissementsAge({ age: 18, distanceKm: 42.2, lang: "en" })[0].texte));
  assert.ok(/42,2/.test(avertissementsAge({ age: 18, distanceKm: 42.2, lang: "de" })[0].texte));
});
test("une langue inconnue retombe sur le français, jamais sur du vide", () => {
  const a = avertissementsAge({ age: 18, distanceKm: 42.2, lang: "kl" as "fr" });
  assert.equal(a.length, 1);
  assert.ok(/Fédération française/.test(a[0].texte));
});
test("on n'invente AUCUN seuil médical", () => {
  // « Le marathon, c'est mieux après 25 ans » circule beaucoup, mais aucune source
  // consultée ne l'établit. La règle vérifiable est fédérale : 20 ans. Affirmer une
  // recommandation médicale inexistante, sur un sujet de santé, serait le pire défaut
  // possible dans cette application.
  const textes = [18, 20, 22].map((age) => avertissementAge({ age, distanceKm: 42.2 })?.texte ?? "");
  for (const t of textes) {
    assert.ok(!/25 ans/.test(t), "un seuil médical de 25 ans est affirmé sans source");
    assert.ok(!/les médecins (disent|recommandent|déconseillent)/i.test(t), "prêter un avis collectif aux médecins sans source");
  }
  // Et la source de la règle, elle, doit être NOMMÉE.
  assert.ok(/Fédération française d'athlétisme/.test(textes[0]), "la source de la règle doit être citée");
});

console.log("\nMODÉRATION — bloquer les insultes SANS punir les innocents");
test("les gros mots sont bloqués, dans les six langues", () => {
  for (const t of [
    "va te faire enculer", "quel connard", "c'est de la merde",
    "what the fuck man", "you are a bitch", "eres un gilipollas",
    "so ein arschloch", "que porra é essa", "vaffanculo",
  ]) assert.equal(contientGrosMot(t), true, `laissé passer : « ${t} »`);
});
test("LE PROBLÈME DE SCUNTHORPE — les mots innocents passent", () => {
  // C'est le vrai risque d'un filtre : chercher un gros mot comme sous-chaîne bloque
  // « connexion » (con), « assez » (ass), « députe » (pute), « Bitterfeld » (bitte).
  // Un athlète dont le commentaire légitime est refusé ne réessaie pas : il s'en va.
  for (const t of [
    "super connexion GPS aujourd'hui", "j'ai assez couru cette semaine",
    "le député a coupé le ruban", "belle côte à Bitterfeld", "analyse concentrée",
    "un footing tranquille", "j'ai fait une contre-performance", "classement final",
    "Grande-Synthe", "cette montée est un vrai mur", "bravo pour ta régularité",
  ]) assert.equal(contientGrosMot(t), false, `faux positif sur : « ${t} »`);
});
test("les contournements les plus courants ne passent pas", () => {
  // Sans normalisation, un filtre n'embête que les gens honnêtes.
  for (const t of ["c0nnard", "ÇÔNNARD", "puuuute", "m e r d e", "sh1t", "f*ck", "b!tch"]) {
    assert.equal(contientGrosMot(t), true, `contournement accepté : « ${t} »`);
  }
});
test("le mot fautif est NOMMÉ, pour que l'auteur comprenne", () => {
  // Un refus sans motif se lit comme une panne : l'auteur réessaie à l'identique.
  assert.equal(premierGrosMot("tu es un connard fini"), "connard");
  assert.equal(premierGrosMot("belle sortie, bravo"), null);
});
test("la liste n'a pas été vidée par une édition malheureuse", () => {
  // Un filtre vide accepte tout, en silence — exactement le défaut qu'on traque.
  assert.ok(NB_FORMES_SURVEILLEES > 300, `seulement ${NB_FORMES_SURVEILLEES} formes surveillées`);
});

console.log("\nCOMPTE PRIVÉ — voir et commenter sont deux droits distincts");
const post = (o: Partial<{ id: string; user_id: string; visibility: "public" | "followers" | "private"; created_at: string }> = {}) =>
  ({ id: "p", user_id: "auteur", visibility: "public" as const, created_at: "2026-08-14", ...o });
const SEUL = { suit: false, estSuivi: false };
const AMI = { suit: true, estSuivi: true };
const ABONNE = { suit: true, estSuivi: false };
test("compte PUBLIC : un inconnu peut commenter", () => {
  // C'est le comportement voulu, comme sur Strava : un passant félicite une perf.
  assert.equal(canComment(post(), "inconnu", false, SEUL), true);
});
test("compte PRIVÉ : seuls les AMIS, c'est-à-dire le suivi réciproque", () => {
  // L'amitié est définie par la migration 019 comme un suivi dans les deux sens ;
  // en inventer une autre ici aurait créé deux notions d'ami concurrentes.
  assert.equal(canComment(post(), "inconnu", true, SEUL), false, "un inconnu commente un compte privé");
  assert.equal(canComment(post(), "abonne", true, ABONNE), false, "suivre ne suffit pas : il faut être suivi en retour");
  assert.equal(canComment(post(), "ami", true, AMI), true, "un ami doit pouvoir commenter");
});
test("on ne commente jamais ce qu'on n'a pas le droit de VOIR", () => {
  // Sinon le refus lui-même trahit l'existence d'une publication privée.
  assert.equal(canComment(post({ visibility: "private" }), "ami", true, AMI), false);
  assert.equal(canComment(post({ visibility: "private" }), "inconnu", false, SEUL), false);
  assert.equal(canComment(post({ visibility: "followers" }), "inconnu", false, SEUL), false);
  assert.equal(canComment(post({ visibility: "followers" }), "abonne", false, ABONNE), true);
});
test("chez soi, toujours ; et jamais sans être identifié", () => {
  assert.equal(canComment(post({ visibility: "private" }), "auteur", true, SEUL), true);
  assert.equal(canComment(post(), null, false, SEUL), false);
});
test("la règle vit AUSSI en base, pas seulement dans la route", () => {
  // La clé publique permet d'écrire directement dans PostgREST : une règle appliquée
  // uniquement dans /api/social/interact se contournerait avec un curl.
  const sql = readFileSync("supabase/migrations/021_compte_prive.sql", "utf8")
    .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.ok(/alter policy comments_ecriture/.test(sql), "aucune politique d'écriture des commentaires");
  assert.ok(/is_private/.test(sql), "la politique ignore le compte privé");
  assert.ok(/f1\.follower_id = auth\.uid\(\)/.test(sql) && /f2\.follower_id = p\.user_id/.test(sql),
    "la réciprocité du suivi n'est pas vérifiée en base");
});
test("une politique RLS ne joint JAMAIS profiles", () => {
  // Piège trouvé en production : une sous-requête dans une politique RLS est elle-même
  // soumise à la RLS de la table jointe. `profiles` n'expose que `profiles_select_own`,
  // donc `join profiles` dans une politique ne renvoie rien dès qu'il s'agit d'autrui —
  // et la condition devient fausse. La migration 021 refusait ainsi TOUT commentaire
  // sur la publication d'un autre, y compris sur un compte public.
  const sql = readFileSync("supabase/migrations/022_lecture_athletes.sql", "utf8")
    .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.ok(!/join\s+profiles/i.test(sql), "la politique joint encore profiles");
  assert.ok(/security definer/i.test(sql), "la lecture du drapeau doit passer par une fonction security definer");
  assert.ok(/set search_path = public/i.test(sql), "une fonction security definer sans search_path figé est détournable");
  assert.ok(/revoke all on function/i.test(sql), "la fonction doit être fermée avant d'être ouverte aux inscrits");
});
test("la vitrine des athlètes n'expose AUCUNE colonne sensible", () => {
  // La RLS travaille par LIGNE, pas par colonne : ouvrir `profiles` aurait exposé la
  // clé intervals.icu, l'e-mail et les identifiants Stripe à tout inscrit via PostgREST.
  const sql = readFileSync("supabase/migrations/022_lecture_athletes.sql", "utf8");
  const vue = sql.slice(sql.indexOf("create or replace view"), sql.indexOf("comment on view"));
  for (const secret of ["intervals_api_key", "email", "stripe", "last_lat", "last_lon", "health"]) {
    assert.ok(!new RegExp(secret, "i").test(vue), `la vue expose « ${secret} »`);
  }
  assert.ok(!/select\s+\*/i.test(vue), "les colonnes doivent être énumérées, jamais select *");
  // Et l'application doit réellement lire la vue, pas la table.
  const route = codeOf("src/app/api/social/follow/route.ts");
  assert.ok(!/from\("profiles"\)/.test(route), "la route lit encore profiles au lieu de la vue");
});
test("toute vue exposée est FERMÉE au rôle anon, nommément", () => {
  // Défaut trouvé en testant la 022 avec la clé publique : la vue répondait 200 et
  // livrait nom, avatar, ligue et score de tous les athlètes à un visiteur sans compte.
  // `revoke ... from public` n'y suffit pas : Supabase accorde d'office les droits à
  // `anon` sur tout nouvel objet du schéma public, et `public` (le pseudo-rôle) n'est
  // PAS `anon`.
  //
  // ⚠️ UNE VUE N'A PAS DE RLS. Sur une table, la RLS rattrape un grant trop large —
  // c'est pourquoi `profiles` ne fuyait pas. Sur une vue, le grant est la SEULE barrière.
  const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
  for (const f of migrations) {
    const sql = readFileSync(`supabase/migrations/${f}`, "utf8")
      .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const m of sql.matchAll(/create\s+or\s+replace\s+view\s+(?:public\.)?(\w+)/gi)) {
      const vue = m[1];
      const ferme = migrations.some((g) => {
        const s = readFileSync(`supabase/migrations/${g}`, "utf8");
        return new RegExp(`revoke\\s+all\\s+on\\s+(?:public\\.)?${vue}\\s+from\\s+anon`, "i").test(s);
      });
      assert.ok(ferme, `la vue « ${vue} » (${f}) n'est jamais révoquée nommément au rôle anon`);
    }
  }
});
test("un repli local ne se félicite JAMAIS", () => {
  // Défaut réel, tenu des mois : la table `user_routes` n'avait jamais été créée.
  // L'écriture échouait, le parcours partait dans le localStorage du navigateur, et
  // l'athlète lisait « Parcours sauvegardé localement ! » — un succès. Ses parcours
  // vivaient donc dans un seul navigateur : perdus au vidage du cache, invisibles
  // depuis le téléphone, absents de toute sauvegarde. Un repli silencieux qui se
  // félicite est pire qu'une erreur franche.
  const code = codeOf("src/components/trail/TrailBuilder.tsx");
  const i = code.indexOf('d["t.savedLocal"]');
  assert.ok(i > 0, "le message de repli local a disparu");
  assert.ok(/toast\.warning/.test(code.slice(i - 60, i)), "le repli local est annoncé comme un succès");
  // Et le texte lui-même doit dire que rien n'est parti en ligne, dans les 5 langues.
  const i18n = readFileSync("src/components/trail/trailI18n.ts", "utf8");
  const messages = [...i18n.matchAll(/"t\.savedLocal": "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(messages.length, 5, "les 5 langues doivent avoir le message");
  for (const m of messages) {
    assert.ok(/⚠️/.test(m), `message de repli sans avertissement : « ${m} »`);
    assert.ok(!/^(Parcours sauvegardé localement|Route saved locally)/.test(m), `message trop rassurant : « ${m} »`);
  }
});
test("les migrations récentes ne contiennent AUCUNE instruction DROP", () => {
  // L'éditeur SQL de Supabase signale toute instruction DROP comme destructive et
  // impose une confirmation « Potential issue detected ». Cette migration a été écrite
  // avec un `drop policy` : rien n'était détruit — on resserrait une règle de sécurité —
  // mais l'avertissement oblige à trancher soi-même le risque au moment de l'exécuter.
  // `alter policy` fait le même travail sans l'alerte, et sans fenêtre pendant laquelle
  // la table serait dépourvue de politique d'écriture.
  //
  // Périmètre : à partir de la migration 007. La 006 en contient douze, écrites avant
  // cette règle — les réécrire n'apporterait rien, elles sont déjà passées.
  for (const f of readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql") && x >= "007")) {
    const lignes = readFileSync(`supabase/migrations/${f}`, "utf8").split("\n")
      .filter((l) => !l.trim().startsWith("--"));
    const drops = lignes.filter((l) => /^\s*drop\b/i.test(l));
    assert.deepEqual(drops, [], `${f} contient une instruction DROP : ${drops[0]?.trim()}`);
  }
});

console.log("\nSURVOL 3D — un index non fini ne doit plus tuer le lecteur");
// Erreur RÉELLE relevée dans error_logs le 14/08 sur /dashboard/survol :
// « Cannot read properties of undefined (reading 'lat') ». Le calcul vivait dans la
// boucle d'animation d'un composant React — donc hors de portée de tout test.
const trace = [
  { lat: 45.0, lon: 6.0 }, { lat: 45.001, lon: 6.001 },
  { lat: 45.002, lon: 6.002 }, { lat: 45.003, lon: 6.003 },
];
test("un avancement NON FINI renvoie null au lieu de planter", () => {
  // `Math.floor(NaN)` vaut NaN, `Math.min(n, NaN)` vaut NaN, et `points[NaN]` vaut
  // `undefined` : c'est la chaîne exacte qui a produit l'erreur en production.
  for (const p of [NaN, Infinity, -Infinity]) {
    assert.equal(poseAt(trace, p), null, `avancement ${p} : devrait renvoyer null`);
  }
});
test("une trace trop courte ne produit aucune position", () => {
  // Sur un seul point, `points.length - 2` vaut −1 : sans ce contrôle, l'index
  // deviendrait négatif — l'autre porte d'entrée du même plantage.
  assert.equal(poseAt([{ lat: 45, lon: 6 }], 0.5), null);
  assert.equal(poseAt([], 0.5), null);
  assert.equal(poseAt(null as unknown as typeof trace, 0.5), null);
});
test("des coordonnées corrompues n'atteignent jamais la caméra", () => {
  // Une trace peut être décodée de travers ; MapLibre, lui, plante sur un NaN.
  assert.equal(poseAt([{ lat: NaN, lon: 6 }, { lat: 45, lon: 6 }], 0), null);
  assert.equal(poseAt([{ lat: 45, lon: 6 }, { lat: 45, lon: undefined as unknown as number }], 0.9), null);
});
test("aux bornes, la position reste sur la trace", () => {
  const debut = poseAt(trace, 0)!, fin = poseAt(trace, 1)!;
  assert.ok(debut && fin, "les bornes doivent produire une position");
  assert.equal(debut.lat, 45.0);
  assert.ok(Math.abs(fin.lat - 45.003) < 1e-9, `fin à ${fin.lat}`);
  // Hors bornes : on borne, on ne plante pas et on ne sort pas de la trace.
  assert.deepEqual(poseAt(trace, -5), poseAt(trace, 0));
  assert.deepEqual(poseAt(trace, 42), poseAt(trace, 1));
});
test("la position est INTERPOLÉE, pas calée sur le point le plus proche", () => {
  // Se caler sur le point le plus proche fige la caméra puis la téléporte : la trace
  // est régulière, mais le survol se lit comme une saccade.
  const p = poseAt(trace, 1 / 6)!;
  assert.ok(p.lat > 45.0 && p.lat < 45.001, `position non interpolée : ${p.lat}`);
});
test("le cap prend le PLUS COURT chemin angulaire", () => {
  // De 350° à 10°, la différence brute vaut −340° : la caméra faisait un tour complet
  // à chaque virage franchissant le nord.
  const c = capLisse(350, 10, 1);
  assert.ok(Math.abs(c - 370) < 1e-9, `${c} : la caméra repart en arrière`);
  // Et un cap corrompu ne doit pas contaminer le cap courant.
  assert.equal(capLisse(120, NaN), 120);
  assert.equal(capLisse(NaN, 45), 45);
});

console.log("\nE-MAIL « TON PLAN EST À JOUR » — un envoi ne se rattrape pas");
const iso0 = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const mailIn = (o: Partial<Parameters<typeof buildPlanReadyEmail>[0]> = {}) => buildPlanReadyEmail({
  lang: "fr", firstName: "Cyprien",
  lastSession: { date: iso0(0), label: "Seuil/Tempo · 15 km · 64 min · 4'19/km", shows: ["allure tenue du début à la fin"], effect: "Fraîcheur orange → 1 séance de qualité." },
  days: [
    { date: iso0(0), type: "Seuil", title: "Séance au seuil", detail: "" },
    { date: iso0(1), type: "Endurance", title: "Footing en endurance", detail: "" },
    { date: iso0(2), type: "Sortie longue", title: "Sortie longue", detail: "" },
    { date: iso0(3), type: "Repos", title: "Repos complet", detail: "" },
  ],
  objective: { race: "Marathon de Lille", daysToRace: 72 },
  appUrl: "https://exemple.test", ...o,
});
test("le sujet annonce la prochaine séance, pas celle d'aujourd'hui", () => {
  // Un sujet « ton plan est à jour » sans rien d'autre ne se lit pas dans une boîte de
  // réception. Et annoncer la séance du jour, déjà faite, serait une information morte.
  const m = mailIn();
  assert.ok(/Demain/.test(m.subject), `sujet sans repère de temps : ${m.subject}`);
  assert.ok(/Footing en endurance/.test(m.subject), `sujet sans la prochaine séance : ${m.subject}`);
});
test("le repos n'est jamais annoncé comme la prochaine séance", () => {
  const m = mailIn({ days: [
    { date: iso0(0), type: "Repos", title: "Repos complet", detail: "" },
    { date: iso0(1), type: "Repos", title: "Repos complet", detail: "" },
    { date: iso0(2), type: "VMA", title: "Séance VMA", detail: "" },
  ] });
  assert.ok(/VMA/.test(m.subject), `« repos » annoncé comme prochaine séance : ${m.subject}`);
});
test("rien n'est inventé quand l'analyse manque", () => {
  // Un e-mail qui affirme quelque chose de faux sur l'entraînement de quelqu'un est
  // pire que pas d'e-mail du tout.
  const m = mailIn({ lastSession: null });
  assert.ok(!/dernière séance/i.test(m.text), "un bloc d'analyse vide ne doit pas apparaître");
  assert.ok(!/undefined|null|NaN/.test(m.text + m.html), "valeur technique visible dans l'e-mail");
  // …et sans objectif non plus.
  const m2 = mailIn({ objective: null, lastSession: null });
  assert.ok(!/Objectif/.test(m2.text), "objectif inventé alors qu'il n'y en a pas");
});
test("l'e-mail existe dans les 5 langues et ne retombe jamais sur une clé", () => {
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const m = mailIn({ lang });
    assert.ok(m.subject.length > 10, `${lang} : sujet vide`);
    assert.ok(!/undefined/.test(m.subject + m.text), `${lang} : trou de traduction`);
    assert.ok(/dashboard\/calendrier/.test(m.text), `${lang} : lien manquant`);
  }
});
test("un titre de séance ne peut pas casser le HTML", () => {
  // Les titres viennent d'intervals.icu, donc du nom que Garmin a donné à la sortie —
  // une chaîne que nous ne contrôlons pas et qui finit dans une page HTML.
  const m = mailIn({ firstName: `<script>alert(1)</script>`, days: [
    { date: iso0(1), type: "Seuil", title: `Séance "test" <b>gras</b>`, detail: "" },
  ] });
  assert.ok(!/<script>/.test(m.html), "balise script non échappée dans l'e-mail");
  assert.ok(!/<b>gras<\/b>/.test(m.html), "balisage non échappé dans un titre de séance");
  assert.ok(/&lt;script&gt;/.test(m.html), "l'échappement doit conserver le texte, pas le supprimer");
});
test("l'e-mail dit comment s'en débarrasser", () => {
  // Un e-mail automatique sans porte de sortie est un e-mail qu'on signale comme spam,
  // ce qui abîme la délivrabilité de TOUS les autres.
  //
  // Le mot attendu est propre à chaque langue : chercher « Notif » partout passait en
  // français, en anglais, en espagnol et en portugais, et échouait en allemand
  // (« Benachrichtigungen ») — un test qui ne tient que par la parenté des langues
  // latines ne vérifie pas grand-chose.
  const motDeSortie = { fr: "Notifications", en: "Notifications", de: "Benachrichtigungen", es: "Notificaciones", pt: "Notificações" } as const;
  for (const [lang, mot] of Object.entries(motDeSortie) as [keyof typeof motDeSortie, string][]) {
    const m = mailIn({ lang });
    assert.ok(m.text.includes(mot), `${lang} : le pied de page ne dit pas où se désinscrire (« ${mot} » attendu)`);
  }
});
test("le silence est proscrit côté envoi, comme ailleurs", () => {
  // `sendPlanReadyEmail` doit toujours dire pourquoi il n'a rien envoyé.
  const src = codeOf("src/lib/notify/planReady.ts");
  for (const motif of ["RESEND_API_KEY absente", "notifications du coach désactivées", "aucune adresse e-mail"]) {
    assert.ok(src.includes(motif), `motif de non-envoi manquant : ${motif}`);
  }
  // Le consentement est vérifié AVANT toute construction d'e-mail.
  assert.ok(src.indexOf("notif_coach") < src.indexOf("api.resend.com"), "le consentement doit précéder l'envoi");
});
test("seule une séance NOUVELLE déclenche un e-mail", () => {
  // Le filet de nuit repasse à 3 h 30 sans qu'il se soit rien produit : écrire à cette
  // heure-là pour dire « ton plan est à jour » serait du bruit qui réveille.
  const auto = codeOf("src/lib/ai/autoCoach.ts");
  assert.ok(/if \(opts\.notify\)/.test(auto), "l'envoi n'est pas conditionné au drapeau notify");
  const chain = codeOf("src/lib/intervals/syncAndCoach.ts");
  assert.ok(/notify: true/.test(chain), "la chaîne « séance inédite » ne demande pas la notification");
  // Le cron de nuit, lui, ne doit PAS demander de notification.
  assert.ok(!/notify: true/.test(codeOf("src/app/api/cron/auto-coach/route.ts")), "le filet de nuit envoie des e-mails");
});

console.log("\nLA SÉRIE — la boucle quotidienne ne doit JAMAIS contredire le coach");
// Une flamme à la Duolingo qui compterait « avoir couru » casserait le premier jour de
// repos venu. Sur le compte de production, le plan pose 2 journées sans course sur 7
// (Repos 17/08, Renfo 21/08) : une série naïve valait 3 jours et allait casser le
// surlendemain, sur le jour de repos PRESCRIT. Ces tests figent l'inverse.
{
  const AUJ = "2026-08-15";
  /** Séance enregistrée : 45 min de footing par défaut. */
  const wk = (date: string, over: Partial<SW> = {}): SW =>
    ({ date, sport: "run", type: "easy", duration_seconds: 45 * 60, distance_km: 9, tss: 50, ...over });
  /** Prescription du coach pour une date. */
  const px = (date: string, sessionType: string, moment?: string) => ({ date, sessionType, ...(moment ? { moment } : {}) });
  /** Une semaine pleine de footings prescrits ET réalisés, du plus ancien au plus récent. */
  const semaine = (fin: string, n: number) => {
    const w: SW[] = [], p: { date: string; sessionType: string }[] = [];
    for (let i = n - 1; i >= 0; i--) { const d = decaleJour(fin, -i); w.push(wk(d)); p.push(px(d, "Endurance")); }
    return { w, p };
  };

  test("un jour de REPOS prescrit et respecté ENTRETIENT la série", () => {
    // Le cœur du modèle. Sans cette règle, l'app pousserait à courir un jour où son
    // propre coach a écrit « repos complet » — elle deviendrait la cause des blessures
    // qu'elle prétend prévenir.
    const base = semaine(decaleJour(AUJ, -1), 6);
    const r = computeStreak({
      today: AUJ,
      workouts: base.w,                                   // AUCUNE séance aujourd'hui
      prescriptions: [...base.p, px(AUJ, "Repos")],
      feedbacks: [],
    });
    assert.equal(r.today?.verdict, "tenu", "le repos respecté doit TENIR la journée");
    assert.equal(r.today?.reason, "repos-respecte");
    assert.equal(r.current, 7, "6 jours courus + le repos respecté = 7");
  });

  test("un jour de repos où l'athlète court quand même ne CASSE pas la série", () => {
    // On ne récompense pas la désobéissance au coach (le jour ne compte pas), mais
    // aucune mécanique de cette app ne doit SANCTIONNER le fait de courir.
    const base = semaine(decaleJour(AUJ, -1), 6);
    const r = computeStreak({
      today: AUJ,
      workouts: [...base.w, wk(AUJ, { duration_seconds: 110 * 60, distance_km: 22 })],
      prescriptions: [...base.p, px(AUJ, "Repos")],
      feedbacks: [],
    });
    assert.equal(r.today?.verdict, "hors", "une grosse sortie un jour de repos n'est pas « tenue »");
    assert.equal(r.today?.reason, "repos-charge");
    assert.equal(r.current, 6, "la série d'avant est intacte, elle n'est simplement pas incrémentée");
  });

  test("un jour de fraîcheur ROUGE ne casse pas la série", () => {
    // Constaté sur le compte réel le 08/08 : ratio aigu:chronique 3,16, séance de
    // récupération prescrite, rien d'enregistré. Le tableau de bord affichait
    // « Déload recommandé » le même jour — casser la série pour avoir obéi aurait été
    // une contradiction pure entre deux cartes du même écran.
    const rouge = decaleJour(AUJ, -6);
    const w: SW[] = [];
    // Base chronique crédible : 27 journées de charge modérée…
    for (let i = 40; i >= 14; i--) w.push(wk(decaleJour(AUJ, -i), { tss: 40, duration_seconds: 40 * 60 }));
    // …puis une semaine très chargée → au jour rouge, le ratio dépasse 2.
    for (let i = 13; i >= 7; i--) w.push(wk(decaleJour(AUJ, -i), { tss: 200, duration_seconds: 110 * 60 }));
    // AUJ-6 : RIEN. Puis la reprise.
    for (let i = 5; i >= 0; i--) w.push(wk(decaleJour(AUJ, -i)));
    const p = Array.from({ length: 14 }, (_, i) => px(decaleJour(AUJ, -i), "Endurance"));
    const r = computeStreak({ today: AUJ, workouts: w, prescriptions: p, feedbacks: [] });
    const jr = r.days.find((d) => d.date === rouge);
    assert.equal(jr?.verdict, "protege", "un jour manqué en surcharge doit être protégé");
    assert.equal(jr?.reason, "protege-charge");
    // 13 journées prescrites et honorées, DE PART ET D'AUTRE du jour rouge : le jour
    // protégé fait le PONT au lieu de couper.
    assert.equal(r.current, 13, "le jour rouge ne coupe pas la série, il l'enjambe");
  });

  test("une séance synchronisée 2 jours en retard ne casse PAS la série rétroactivement", () => {
    // LE défaut le plus grave de ce genre de mécanique : intervals.icu livre par
    // balayage, avec 0 à 3 jours de retard mesurés sur le compte de production. Un
    // compteur PERSISTÉ serait décrémenté à minuit et la casse serait déjà écrite quand
    // la séance arriverait. Ici, la série est recalculée depuis les faits : la séance
    // retardée RÉPARE la journée au lieu de la perdre.
    const base = semaine(decaleJour(AUJ, -3), 6);           // AUJ-8 … AUJ-3, contigus
    const retard = decaleJour(AUJ, -2);
    const presc = [...base.p, px(retard, "Seuil"), px(decaleJour(AUJ, -1), "Endurance"), px(AUJ, "Endurance")];
    const suite = [wk(decaleJour(AUJ, -1)), wk(AUJ)];

    const avant = computeStreak({ today: AUJ, workouts: [...base.w, ...suite], prescriptions: presc, feedbacks: [] });
    assert.equal(avant.days.find((d) => d.date === retard)?.verdict, "attente",
      "tant qu'elle n'est pas synchronisée, la journée attend — elle n'est pas jugée");
    assert.equal(avant.current, 8, "la journée en attente n'entame RIEN de la série existante");

    const apres = computeStreak({
      today: AUJ, workouts: [...base.w, wk(retard), ...suite], prescriptions: presc, feedbacks: [],
    });
    assert.equal(apres.days.find((d) => d.date === retard)?.verdict, "tenu");
    assert.ok(apres.current > avant.current, "la séance en retard doit ALLONGER la série, pas la casser");
    assert.equal(apres.current, 9, "elle vaut exactement un jour de plus, deux jours après coup");
  });

  test("une journée en attente de synchro n'est jamais annoncée comme une menace si elle est protégée", () => {
    // La carte annonçait « le 12/08 sera jugé le 16/08 » pour une journée qui sortait à
    // un ratio de 1,82 : elle allait être PROTÉGÉE, pas rompue. On annonçait une casse
    // qui n'aurait jamais eu lieu — exactement le compte à rebours anxiogène proscrit.
    const w: SW[] = [];
    for (let i = 34; i >= 8; i--) w.push(wk(decaleJour(AUJ, -i), { tss: 40, duration_seconds: 40 * 60 }));
    for (let i = 7; i >= 2; i--) w.push(wk(decaleJour(AUJ, -i), { tss: 240, duration_seconds: 120 * 60 }));
    const p = Array.from({ length: 12 }, (_, i) => px(decaleJour(AUJ, -i), "Endurance"));
    const r = computeStreak({ today: AUJ, workouts: w, prescriptions: p, feedbacks: [] });
    assert.ok(r.pending > 0, "il faut bien des journées en attente pour que le test ait un sens");
    assert.equal(r.threat, null, "une journée déjà protégée par la charge ne menace rien");
  });

  test("une journée doublée (matin + soir) ne compte que pour UN jour", () => {
    // Le calendrier déduplique par `date#moment`. Une série qui compterait les séances
    // afficherait 2 jours pour une seule journée — et sur-récompenserait le doublage,
    // à rebours de tout le modèle de charge.
    const j = decaleJour(AUJ, -1);
    const r = computeStreak({
      today: AUJ,
      workouts: [wk(j, { duration_seconds: 30 * 60 }), wk(j, { duration_seconds: 40 * 60 }), wk(AUJ)],
      prescriptions: [px(j, "Endurance", "matin"), px(j, "Récup", "soir"), px(AUJ, "Endurance")],
      feedbacks: [],
    });
    assert.equal(r.current, 2, "deux séances le même jour font UNE journée tenue");
    assert.equal(r.days.filter((d) => d.date === j).length, 1, "une seule entrée par date");
  });

  test("un jour sans aucune prescription ne casse rien", () => {
    // Sur le compte réel, SEPT SEMAINES (25/06 → 05/08) n'ont reçu aucun plan : le cron
    // ne tournait pas. Juger ces jours-là aurait fabriqué 49 jours manqués imputés à
    // l'athlète pour une panne d'infrastructure.
    const r = computeStreak({
      today: AUJ,
      workouts: [wk(decaleJour(AUJ, -20)), wk(decaleJour(AUJ, -19)), wk(AUJ)],
      prescriptions: [px(decaleJour(AUJ, -20), "Endurance"), px(decaleJour(AUJ, -19), "Endurance"), px(AUJ, "Endurance")],
      feedbacks: [],
    });
    assert.ok(r.days.slice(-19, -1).every((d) => d.verdict === "hors"), "sans plan, les jours sont hors contrat");
    assert.equal(r.current, 1, "la série repart à la première journée tenue, sans casse imputée");
  });

  test("une semaine ENTIÈRE sans un seul jour tenu arrête la série", () => {
    // Sans ce garde-fou, la série du compte réel traversait les sept semaines sans plan
    // et affichait plus de deux mois : une série qu'aucun comportement ne peut
    // interrompre ne veut plus rien dire.
    const vieux = semaine(decaleJour(AUJ, -20), 5);
    const r = computeStreak({
      today: AUJ, workouts: [...vieux.w, wk(AUJ)],
      prescriptions: [...vieux.p, px(AUJ, "Endurance")], feedbacks: [],
    });
    assert.equal(r.current, 1, "le trou de 19 jours coupe : seul aujourd'hui compte");
    assert.equal(r.best, 5, "le record d'avant reste lisible");
  });

  test("le renfo prescrit est accordé — il n'arrive JAMAIS dans les activités", () => {
    // Même raison que dans coachContext, qui l'exclut déjà de son calcul d'adhérence :
    // une séance de gainage au salon n'entre dans `workouts` par aucun chemin. La juger
    // fabriquerait un jour manqué chaque semaine, pour tout le monde.
    const base = semaine(decaleJour(AUJ, -1), 3);
    const r = computeStreak({
      today: AUJ, workouts: base.w, prescriptions: [...base.p, px(AUJ, "Renfo")], feedbacks: [],
    });
    assert.equal(r.today?.verdict, "tenu");
    assert.equal(r.today?.reason, "renfo");
  });

  test("une douleur déclarée protège les jours qui suivent", () => {
    // `session_feedback` est la SEULE source de douleur déclarée qui existe en base :
    // la table `pain_report` n'existe pas (vérifié sur la base de production).
    const base = semaine(decaleJour(AUJ, -6), 4);
    const p = [...base.p, px(decaleJour(AUJ, -5), "Endurance"), px(decaleJour(AUJ, -4), "Endurance"), px(AUJ, "Endurance")];
    const r = computeStreak({
      today: AUJ, workouts: [...base.w, wk(AUJ)], prescriptions: p,
      feedbacks: [{ date: decaleJour(AUJ, -6), pain: ["Genou droit"] }],
    });
    assert.equal(r.days.find((d) => d.date === decaleJour(AUJ, -5))?.reason, "protege-douleur");
    assert.equal(r.days.find((d) => d.date === decaleJour(AUJ, -4))?.reason, "protege-douleur");
    assert.equal(r.current, 5, "se reposer sur une douleur déclarée ne coûte pas la série");
  });

  test("« Aucune douleur » n'est pas une douleur", () => {
    // Le ressenti stocke littéralement `pain: ["Aucune douleur"]` quand tout va bien
    // (12 lignes sur le compte réel). Le lire comme une douleur rendrait la série
    // incassable pour quiconque remplit ses ressentis.
    const base = semaine(decaleJour(AUJ, -6), 4);
    const r = computeStreak({
      today: AUJ, workouts: [...base.w, wk(AUJ)],
      prescriptions: [...base.p, px(decaleJour(AUJ, -5), "Endurance"), px(AUJ, "Endurance")],
      feedbacks: [{ date: decaleJour(AUJ, -6), pain: ["Aucune douleur"] }],
    });
    assert.equal(r.days.find((d) => d.date === decaleJour(AUJ, -5))?.verdict, "rompu");
  });

  test("une séance prescrite, manquée, sans excuse, casse bien la série", () => {
    // Le pendant indispensable : une série que rien ne peut casser n'est pas une série.
    const base = semaine(decaleJour(AUJ, -7), 4);
    const r = computeStreak({
      today: AUJ, workouts: [...base.w, wk(decaleJour(AUJ, -1)), wk(AUJ)],
      prescriptions: [...base.p, px(decaleJour(AUJ, -6), "Endurance"), px(decaleJour(AUJ, -1), "Endurance"), px(AUJ, "Endurance")],
      feedbacks: [],
    });
    assert.equal(r.days.find((d) => d.date === decaleJour(AUJ, -6))?.verdict, "rompu");
    assert.equal(r.current, 2, "la série repart après la casse");
  });

  test("le cross-training honore un jour d'entraînement prescrit", () => {
    // Décision assumée : la série mesure la PRÉSENCE au rendez-vous, pas le contenu —
    // le contenu reste l'affaire du coach, dont l'adhérence continue de ne compter que
    // les courses. Punir 1 h de vélo parce que le plan disait « footing » serait le
    // faux négatif qui tue la confiance dans la mécanique.
    const r = computeStreak({
      today: AUJ,
      workouts: [wk(AUJ, { sport: "bike", type: "ride", duration_seconds: 70 * 60, tss: 60 })],
      prescriptions: [px(AUJ, "Endurance")], feedbacks: [],
    });
    assert.equal(r.today?.verdict, "tenu");
  });

  test("une activité de 5 minutes ne tient pas la journée", () => {
    // Garde-fou anti-artefact : un enregistrement GPS oublié 4 minutes dans une poche
    // ne doit pas valider une séance de seuil.
    const r = computeStreak({
      today: AUJ, workouts: [wk(AUJ, { duration_seconds: 5 * 60, distance_km: 0.4 })],
      prescriptions: [px(AUJ, "Seuil")], feedbacks: [],
    });
    assert.equal(r.today?.verdict, "attente", "trop courte pour compter, trop récente pour être jugée");
  });

  test("un ratio calculé sur une base chronique vide ne protège personne", () => {
    // Constaté sur le compte réel : après sept semaines sans données, la fenêtre
    // chronique ne contenait plus que trois journées et le ratio sortait à 4,00. Toute
    // la reprise se serait déclarée « protégée par la surcharge » — série incassable
    // pour cause de division par presque rien.
    const w = [wk(decaleJour(AUJ, -20)), wk(decaleJour(AUJ, -19)), wk(decaleJour(AUJ, -18))];
    const tss = new Map<string, number>();
    for (const x of w) tss.set(x.date, 300);
    assert.equal(acwrAu(decaleJour(AUJ, -18), tss), 0, "3 journées actives ne font pas une base chronique");
  });

  test("la série ne se calcule jamais en UTC — le repère est la date LOCALE", () => {
    // `iso()` (autoPlan) écrit les prescriptions en heure LOCALE ; `toISOString()` est en
    // UTC. Mélanger les deux décale la journée d'un cran passé minuit à l'est de
    // Greenwich : la série casse chez les uns et pas chez les autres, sans rien signaler.
    const src = codeOf("src/lib/streak/compute.ts");
    assert.ok(!/toISOString\(\)/.test(src), "aucune date ne doit passer par toISOString() dans ce module");
    assert.ok(/getFullYear\(\)/.test(src), "la date locale doit être construite par les accesseurs locaux");
    // Et le décalage de jours doit rester juste au changement d'heure (ancrage à midi UTC).
    assert.equal(decaleJour("2026-03-29", 1), "2026-03-30", "passage à l'heure d'été");
    assert.equal(decaleJour("2026-10-25", 1), "2026-10-26", "retour à l'heure d'hiver");
    assert.equal(decaleJour("2026-01-01", -1), "2025-12-31", "changement d'année");
    assert.equal(ecartJours("2026-08-12", "2026-08-15"), 3);
  });

  test("aucune donnée = aucune série inventée", () => {
    const r = computeStreak({ today: AUJ, workouts: [], prescriptions: [], feedbacks: [] });
    assert.equal(r.current, 0);
    assert.equal(r.since, null, "on ne prétend pas observer une fenêtre qu'on n'a pas");
  });

  test("l'essai dure 7 jours, et le dernier jour compte encore", () => {
    // SEPT et non trente, et c'est cohérent PARCE QU'IL EXISTE un palier gratuit
    // permanent : l'essai ne démontre plus le coach (gratuit pour toujours, il ne coûte
    // rien à servir) mais le seul module IA. Sept jours suffisent à poser vingt
    // questions à un assistant ; ils ne suffiraient pas à juger un plan adaptatif, dont
    // les fenêtres de mesure font 28 et 42 jours.
    const J = 86_400_000;
    const cree = (jours: number) => ({ created_at: new Date(Date.now() - jours * J).toISOString(), subscription_tier: "free" });
    assert.equal(accesDe(cree(0)).etat, "essai", "premier jour");
    assert.equal(accesDe(cree(6)).etat, "essai", "6 jours : encore en essai");
    assert.equal(accesDe({ created_at: new Date(Date.now() - (6 * J + 23 * 3600_000)).toISOString(), subscription_tier: "free" }).etat,
      "essai", "6 j 23 h : l'essai n'est pas fini");
    assert.equal(accesDe(cree(7)).etat, "gratuit", "7 jours révolus : retour au palier gratuit");
    assert.equal(accesDe(cree(0)).joursRestants, JOURS_ESSAI);
    assert.equal(accesDe(cree(6)).joursRestants, 1, "il reste un jour");
    assert.equal(accesDe(cree(45)).essaiExpire, true, "l'expiration doit rester signalable");
  });

  test("à l'expiration, le COACH continue — seule l'IA s'arrête", () => {
    // C'est tout le modèle. Le plan de sept jours est DÉTERMINISTE : le republier ne
    // consomme aucun jeton. Le mettre derrière un péage coûterait des inscriptions sans
    // économiser un centime, et priverait le produit de son meilleur hameçon.
    assert.equal(peut("gratuit", "lecture"), true);
    assert.equal(peut("gratuit", "plan"), true, "le plan doit rester gratuit POUR TOUJOURS : il ne coûte rien");
    assert.equal(peut("gratuit", "ia"), false, "l'IA est la seule capacité dont la dépense grandit avec les athlètes");
    for (const e of ["gratuit", "essai", "starter", "premium"] as const) {
      assert.equal(peut(e, "lecture"), true, `${e} : la lecture ne se refuse jamais`);
      assert.equal(peut(e, "plan"), true, `${e} : le plan ne se refuse jamais`);
    }
  });

  test("l'écart entre les deux formules est un NOMBRE d'appels, pas une porte fermée", () => {
    // Le modèle a changé volontairement : les deux formules ont l'IA, ce qui les sépare
    // est le plafond quotidien. Une formule privée d'IA se vend mal — l'acheteur ne sait
    // pas ce qu'il rate, donc il ne monte jamais en gamme.
    assert.equal(peut("starter", "plan"), true, "le plan est dans toutes les formules");
    assert.equal(peut("starter", "ia"), true, "Starter doit avoir l'IA, en quantité limitée");
    assert.equal(peut("premium", "ia"), true);
    assert.ok(PLAFOND_JOUR.premium > PLAFOND_JOUR.starter,
      "sans écart de plafond, les deux formules sont identiques et l'écart de prix est arbitraire");
    // Essentiel n'est plus refusé sur le DROIT — il l'est sur le plafond, et c'est un
    // refus 429, pas 402 : « reviens demain » et « change de formule » ne se résolvent
    // pas du même geste, et le message ne doit pas les confondre.
    assert.equal(motifRefus("starter", "ia"), null, "Starter a le droit d'appeler l'IA");
    assert.equal(motifRefus("gratuit", "ia"), "essai_expire",
      "un essai fini et un plafond atteint ne se résolvent pas par le même geste");
    assert.equal(motifRefus("premium", "ia"), null, "aucun refus quand le droit existe");
    // Le seul état qui refuse encore sur le droit est le palier gratuit, et seulement pour l'IA.
    assert.equal(motifRefus("gratuit", "plan"), null, "le plan ne se refuse à personne");
  });

  test("l'essai donne l'IA, sinon personne ne peut juger ce qu'il achète", () => {
    assert.equal(peut("essai", "ia"), true);
    assert.equal(peut("essai", "plan"), true);
  });

  test("un abonnement payant prime toujours sur la date de création", () => {
    // Un client qui paie depuis deux ans a forcément un compte de plus de 30 jours :
    // faire passer la date d'abord l'aurait rétrogradé en consultation.
    const vieux = new Date(Date.now() - 800 * 86_400_000).toISOString();
    assert.equal(accesDe({ created_at: vieux, subscription_tier: "premium" }).etat, "premium");
    assert.equal(accesDe({ created_at: vieux, subscription_tier: "starter" }).etat, "starter");
    // « pro » est l'ancien palier unique : le retirer ferait rétrograder en silence
    // tous les comptes déjà payants.
    assert.equal(accesDe({ created_at: vieux, subscription_tier: "pro" }).etat, "premium",
      "les abonnés historiques « pro » perdent leur accès");
    assert.equal(accesDe({ created_at: vieux, subscription_tier: "PRO" }).etat, "premium", "la casse ne doit pas décider");
    assert.equal(accesDe({ created_at: vieux, subscription_tier: " premium " }).etat, "premium", "les espaces non plus");
  });

  test("une donnée manquante n'enferme JAMAIS personne dehors", () => {
    // Le pire défaut possible ici n'est pas de laisser passer un fraudeur, c'est de
    // verrouiller un client légitime sur une colonne vide, sans qu'il comprenne.
    for (const p of [null, undefined, {}, { created_at: null }, { created_at: "" },
                     { created_at: "pas une date" }, { subscription_tier: "inconnu" }]) {
      assert.equal(accesDe(p as never).etat, "essai", `profil ${JSON.stringify(p)} : verrouillé à tort`);
    }
  });

  test("le plafond IA tient au 26e appel, pas seulement au 25e", () => {
    // Une clé Gemini payante SANS plafond par athlète est un chèque en blanc : le
    // risque cesse d'être une panne bruyante et devient une facture silencieuse.
    // Mesuré sur le compte réel : 4 584 jetons par appel, ≈ 0,29 centime. À 25/jour
    // le pire cas coûte 2,16 €/mois contre 14,99 € encaissés ; à 100/jour, 8,63 €.
    //
    // ⚠️ CE TEST EXISTE POUR UN BOGUE QUE J'AI ÉCRIT : la première version décidait
    // par `utilises > plafond` chez l'appelant. Au 26e appel, le compteur — déjà
    // bloqué à 25 et donc plus incrémenté — donnait 25 > 25 = faux, et l'appel
    // passait. Le plafond ne bornait rien.
    // On rejoue la décision du module SANS base : `accorde` ne doit dépendre que du
    // compteur et du plafond, et c'est cette comparaison-là qui était fausse.
    const accorde = (utilises: number, plafond: number) => utilises < plafond;
    const P = PLAFOND_JOUR.premium;
    assert.equal(accorde(P - 1, P), true, `le ${P}e appel doit passer`);
    assert.equal(accorde(P, P), false, `le ${P + 1}e appel doit être refusé`);
    // Le compteur cesse d'avancer une fois le plafond atteint : c'est ce gel qui
    // faisait échouer un test écrit en « utilises > plafond ».
    assert.equal(accorde(P, P), accorde(P + 5, P), "le refus doit tenir même si le compteur est gelé au plafond");
    // Et le module doit bien décider ainsi, pas autrement.
    const src = codeOf("src/lib/billing/aiQuota.ts");
    assert.ok(/accorde: utilises < plafond/.test(src), "la décision d'octroi a changé de forme");
    assert.ok(!/depasse/.test(src), "le drapeau ambigu « depasse » est revenu");
    // Un changement de jour remet le compteur à zéro : sans ça, le plafond serait une
    // coupure définitive déguisée.
    assert.ok(/d\?\.jour === aujourdhui \? Number\(d\?\.n \?\? 0\) : 0/.test(src),
      "le compteur ne se réinitialise plus au changement de jour");
  });

  test("le palier gratuit donne TOUT le déterministe, et rien qui coûte", () => {
    // La décision structurante du modèle, et elle repose sur une mesure : `autoPlan` et
    // `autoCoach` n'appellent aucun modèle. Republier sept jours de plan pour un athlète
    // gratuit coûte donc zéro. Le mettre derrière un péage ferait perdre des inscriptions
    // sans économiser un centime — et priverait le produit de son meilleur hameçon.
    const auto = codeOf("src/lib/ai/autoPlan.ts") + codeOf("src/lib/ai/autoCoach.ts");
    assert.ok(!/generateContent\(/.test(auto),
      "le plan appelle désormais un modèle : il ne peut plus être gratuit, tout le modèle économique change");
    assert.equal(peut("gratuit", "plan"), true);
    assert.equal(PLAFOND_JOUR.gratuit, 0);
    // Et l'essai ne verrouille RIEN d'autre que l'IA : à son terme on retombe au gratuit.
    const J = 86_400_000;
    const expire = accesDe({ created_at: new Date(Date.now() - 60 * J).toISOString(), subscription_tier: "free" });
    assert.equal(expire.etat, "gratuit", "un essai fini ne doit pas fermer le coach");
    assert.equal(peut(expire.etat, "plan"), true, "le plan doit survivre à l'essai");
  });

  test("chaque plafond reste RENTABLE dans son pire cas", () => {
    // L'invariant qui protège vraiment Cyprien. Un plafond n'est pas un curseur de
    // confort : c'est ce qui borne la facture Gemini quand un athlète, une boucle ou un
    // script sature son quota tous les jours du mois. Sans lui, une clé payante est un
    // chèque en blanc.
    //
    // Coût MESURÉ sur le compte de production : 4 584 jetons d'entrée + ~700 de sortie,
    // soit ≈ 0,29 centime l'appel. Revenu NET après TVA 20 % et commission Stripe.
    const COUT_APPEL = 0.0029;
    const net = (ttc: number) => { const ht = ttc / 1.2; return ht - (ht * 0.029 + 0.25); };
    const PART_MAX = 0.25;   // au-delà d'un quart du net, la marge ne tient plus

    for (const [formule, etat] of [["starter", "starter"], ["premium", "premium"]] as const) {
      const ttc = TARIFS[formule].mois.centimes / 100;
      const pireCas = PLAFOND_JOUR[etat] * 30 * COUT_APPEL;
      const part = pireCas / net(ttc);
      assert.ok(part <= PART_MAX,
        `${formule} : ${PLAFOND_JOUR[etat]} appels/j coûtent ${pireCas.toFixed(2)} €/mois au pire, `
        + `soit ${(part * 100).toFixed(0)} % des ${net(ttc).toFixed(2)} € nets — au-delà de ${PART_MAX * 100} %, la marge ne tient plus`);
    }
    assert.equal(PLAFOND_JOUR.gratuit, 0, "le palier gratuit ne doit consommer aucun jeton");
    assert.ok(PLAFOND_JOUR.essai > 0, "sans crédits pendant l'essai, personne ne peut juger ce qu'il achète");
    assert.equal(PLAFOND_JOUR.essai, PLAFOND_JOUR.premium, "l'essai doit montrer le niveau Premium");
  });

  test("le plafond annoncé sur la vitrine est celui qui est APPLIQUÉ", () => {
    // Vendre « 40 échanges par jour » et en accorder 25 est la même faute que d'afficher
    // un prix différent de celui qu'on débite.
    // ⚠️ Ancré sur CHAQUE formule et sur le motif « <N> échanges / questions », pas sur
    // le blob des deux cartes : chercher « 40 » quelque part laissait passer une liste de
    // fonctionnalités annonçant 100, parce que l'accroche de la même carte disait encore
    // 40 — constaté par mutation.
    // Un ou deux mots peuvent s'intercaler entre le nombre et le nom : « 15 AI exchanges »,
    // « 15 KI-Dialoge », « 15 échanges avec l'IA ».
    const CHIFFRE = /(\d+)\s+(?:[\w'’-]+[\s-]){0,2}(échanges|questions|exchanges|Dialoge|Fragen|intercambios|preguntas|trocas|perguntas)/gi;
    for (const l of ALL_LANGS) {
      for (const plan of LANDING_T[l].pricing.plans) {
        // Le palier gratuit n'annonce aucun crédit : il n'en a pas, et c'est le message.
        if (plan.cle === "gratuit") {
          assert.equal(PLAFOND_JOUR.gratuit, 0, "le palier gratuit ne doit accorder aucun appel IA");
          continue;
        }
        const n = PLAFOND_JOUR[plan.cle];
        const texte = `${plan.pitch} ${plan.features.join(" ")}`;
        const annonces = [...texte.matchAll(CHIFFRE)].map((m) => Number(m[1]));
        assert.ok(annonces.length >= 1, `${l}/${plan.cle} : la vitrine n'annonce aucun nombre d'échanges IA`);
        for (const a of annonces) {
          assert.equal(a, n,
            `${l}/${plan.cle} : la vitrine annonce ${a} échanges par jour, le code en accorde ${n}`);
        }
      }
    }
  });

  test("le plafond est CONSOMMÉ par le verrou, pas seulement calculé", () => {
    // Un module de quota que personne n'appelle est un commentaire.
    const g = codeOf("src/lib/billing/guard.ts");
    assert.ok(/consommerAppelIA\(/.test(g), "le verrou ne consomme aucun crédit");
    assert.ok(/status: 429/.test(g), "un plafond atteint doit répondre 429, pas 402 : ce n'est pas un problème d'abonnement");
    // Et il ne doit pas se contenter de lire : `quotaDuJour` n'incrémente rien.
    assert.ok(!/quotaDuJour\(supabase/.test(g), "le verrou lit le compteur au lieu de le consommer");
  });

  test("le compteur de quota n'invente aucune contrainte de base", () => {
    // `upsert({ onConflict: "user_id,type" })` exigerait une contrainte unique sur
    // (user_id, type) qui n'existe PAS — `notifications` porte plusieurs lignes du même
    // type par athlète (les séances du coach). L'upsert aurait échoué en production, ou
    // pire, inséré un doublon par appel.
    const q = codeOf("src/lib/billing/aiQuota.ts");
    assert.ok(!/upsert\(/.test(q), "upsert sur notifications : la contrainte unique n'existe pas");
    assert.ok(/\.update\(/.test(q) && /\.insert\(/.test(q), "il faut chercher puis mettre à jour ou insérer");
  });

  test("le prix AFFICHÉ est celui qui sera DÉBITÉ", () => {
    // Afficher un montant différent de celui qu'on prélève n'est pas un défaut
    // d'affichage, c'est un litige. Les vitrines ne peuvent pas importer `TARIFS`
    // (ce module tire le SDK Stripe et la clé secrète), elles recopient donc les
    // centimes — et c'est exactement le genre de copie qui dérive en silence.
    for (const f of ["src/app/page.tsx", "src/app/pricing/page.tsx"]) {
      const src = codeOf(f);
      const debut = src.indexOf("const PRIX");
      const bloc = src.slice(debut, src.indexOf("};", debut));
      assert.ok(bloc.length > 20, `${f} : bloc PRIX introuvable`);
      for (const formule of FORMULES) {
        for (const [cle, periode] of [["mois", "mois"], ["an", "an"]] as const) {
          const attendu = TARIFS[formule][periode].centimes;
          const m = new RegExp(`${formule}: \\{[^}]*${cle}: (\\d+)`).exec(bloc);
          assert.ok(m, `${f} : ${formule}/${cle} absent de la vitrine`);
          assert.equal(Number(m![1]), attendu,
            `${f} : ${formule}/${cle} affiche ${m![1]} centimes alors que Stripe débitera ${attendu}`);
        }
      }
    }
    // La remise annuelle doit valoir DEUX MOIS OFFERTS, ni plus ni moins : l'ancien
    // « −33 % » (80 € contre 120 €) bradait l'abonnement sans raison.
    for (const f of FORMULES) {
      assert.equal(TARIFS[f].an.centimes, TARIFS[f].mois.centimes * 10,
        `${f} : la remise annuelle ne vaut pas deux mois offerts`);
    }
    // Et l'écart entre les deux formules doit rester positif — Premium contient Starter.
    assert.ok(TARIFS.premium.mois.centimes > TARIFS.starter.mois.centimes,
      "Premium doit coûter plus cher que Starter");
  });

  test("les deux vitrines de tarifs racontent la MÊME chose", () => {
    // `/pricing` avait son propre dictionnaire, et les deux avaient divergé au point de
    // ne plus vendre le même produit : trois paliers d'un côté, trois autres de l'autre,
    // et une liste de fonctionnalités inexistantes (« Nutrition Lab », « Posture Lab »,
    // « API Access », « Dashboard équipe », « Life Stress Sync »…).
    assert.ok(!existsSync("src/app/pricing/pricingI18n.ts"), "le dictionnaire de tarifs en double est revenu");
    const pricing = codeOf("src/app/pricing/page.tsx");
    assert.ok(/from "@\/components\/landing\/landingI18n"/.test(pricing),
      "la page /pricing doit lire le dictionnaire de la landing, pas le sien");
    // Deux formules et pas trois : « annuel » est une périodicité, pas un palier.
    for (const l of ALL_LANGS) {
      const p = LANDING_T[l].pricing;
      // TROIS paliers, dont un gratuit permanent — et « annuel » n'en est toujours pas un :
      // c'est une périodicité, et le sélecteur reste là pour ça.
      assert.equal(p.plans.length, 3, `${l} : ${p.plans.length} formules attendues (gratuit, starter, premium)`);
      assert.deepEqual(p.plans.map((x) => x.cle), ["gratuit", "starter", "premium"], `${l} : clés de formule inattendues`);
      assert.ok(p.gratuitNote.length > 10, `${l} : le palier gratuit n'annonce pas qu'il ne demande pas de carte`);
      for (const plan of p.plans) {
        assert.ok(plan.name && plan.pitch && plan.cta && plan.features.length >= 4, `${l}/${plan.cle} : formule incomplète`);
      }
      // Ce qui se passe APRÈS l'essai doit être écrit, dans chaque langue.
      assert.ok(p.apres.length > 40, `${l} : la dégradation en consultation n'est pas expliquée`);
      assert.ok(p.essai.length > 10, `${l} : la durée d'essai n'est pas annoncée`);
    }
  });

  test("le plan ne se régénère plus pour un compte en consultation", () => {
    // `autoCoachForUser` a QUATRE appelants (génération manuelle, webhook intervals.icu,
    // cron de nuit, chaîne de synchronisation). Le verrou est posé dans la fonction, pas
    // dans les routes : garder chacune aurait laissé la même occasion d'en oublier une,
    // et un seul oubli suffit à republier gratuitement un plan.
    const src = codeOf("src/lib/ai/autoCoach.ts");
    assert.ok(/profilPeut\(.*"plan"\)/.test(src), "aucun contrôle d'abonnement avant de produire un plan");
    // Et il doit précéder la construction du plan, sinon on paie le calcul pour rien.
    assert.ok(src.indexOf("profilPeut(") < src.indexOf("buildWeekPlan("),
      "le verrou est posé APRÈS la construction du plan");
    assert.ok(/reason: "essai_expire"/.test(src), "le refus doit être motivé, pas silencieux");
  });

  test("le support répond sans jeton — mais JAMAIS sur un dépannage", () => {
    // Économiser des jetons est facile ; économiser sans rien dégrader ne l'est pas.
    // La base sait déjà répondre aux questions de NAVIGATION : le chemin de clics vient
    // de `helpKb`, le modèle ne fait que le recopier. En revanche, sur un dépannage,
    // l'assistant lit l'état RÉEL du compte (`diagnoseAccount`) et sait, lui, que la clé
    // intervals.icu est absente. Servir la fiche générique économiserait un appel en
    // détruisant exactement ce qui fait la valeur de l'assistant.
    for (const q of ["où je vois le détail d'une séance", "comment connecter ma montre",
                     "c'est quoi le ghost runner", "comment partager ma position en direct"]) {
      assert.ok(reponseImmediate(q), `navigation non pré-emptée : « ${q} » — un appel payé pour rien`);
    }
    for (const q of ["mes séances n'arrivent pas sur ma montre", "la synchronisation ne marche pas",
                     "mes activités n'apparaissent pas", "je ne peux pas m'abonner",
                     "pourquoi pas de fractionné cette semaine", "mon kilométrage compte mes randonnées"]) {
      assert.equal(reponseImmediate(q), null,
        `DÉPANNAGE pré-empté : « ${q} » — la réponse générique remplace un diagnostic du compte réel`);
    }
    // Et rien hors périmètre : une pré-emption sur « j'ai mal au genou » serait pire
    // qu'un appel au modèle.
    for (const q of ["quelle est la capitale du japon", "j'ai mal au genou", "raconte-moi une blague",
                     "azertyuiop", "quel est mon TSB"]) {
      assert.equal(reponseImmediate(q), null, `hors périmètre pré-empté : « ${q} »`);
    }
    // La garantie est STRUCTURELLE, pas affaire de seuil : le code doit vérifier la source.
    const src = codeOf("src/lib/support/fallback.ts");
    assert.ok(/t\.source !== "page"/.test(src),
      "la pré-emption ne vérifie plus la SOURCE : un dépannage pourrait passer");
  });

  test("la route de support interroge la base AVANT le modèle", () => {
    // La base savait déjà répondre, mais n'était consultée qu'APRÈS l'échec du modèle,
    // en dernier recours : on payait l'appel avant de découvrir qu'on n'en avait pas
    // besoin. L'ordre est tout l'intérêt du changement.
    const src = codeOf("src/app/api/ai/support/route.ts");
    assert.ok(/reponseImmediate\(/.test(src), "le support n'interroge plus la base avant le modèle");
    assert.ok(src.indexOf("reponseImmediate(") < src.indexOf("generateContent("),
      "la base est interrogée APRÈS le modèle — l'appel est déjà payé");
    // Et le repli de dernier recours doit rester : ce sont deux chemins distincts.
    assert.ok(/fallbackAnswer\(/.test(src), "le repli en cas de modèle indisponible a disparu");
  });

  test("deux routes ne peuvent pas être le MÊME fichier", () => {
    // DÉFAUT RÉEL, ET C'EST MOI QUI L'AI CAUSÉ. Une moulinette de mutation sauvegardait
    // les fichiers dans /tmp par NOM DE BASE : `coach/route.ts` et `training-plan/route.ts`
    // s'appellent tous deux « route.ts ». La sauvegarde de l'un a écrasé l'autre, puis la
    // restauration a recopié le même contenu dans les deux chemins. `/api/ai/coach` a été
    // commité ET DÉPLOYÉ en servant le code du plan d'entraînement.
    //
    // Rien ne pouvait le voir : les deux fichiers compilent, les deux répondent 200, et
    // les tests de couverture passaient puisque le contenu recopié portait lui aussi son
    // verrou et son appel au modèle. Seule une empreinte les distingue.
    const empreintes = new Map<string, string>();
    for (const d of readdirSync("src/app/api/ai")) {
      const f = `src/app/api/ai/${d}/route.ts`;
      if (!existsSync(f)) continue;
      const h = createHash("md5").update(readFileSync(f)).digest("hex");
      const jumeau = empreintes.get(h);
      assert.ok(!jumeau, `« ${d} » et « ${jumeau} » sont le MÊME fichier — l'une des deux routes a été écrasée`);
      empreintes.set(h, d);
    }
    assert.ok(empreintes.size >= 7, `seulement ${empreintes.size} routes IA : le balayage est cassé`);
  });

  test("l'historique renvoyé au modèle est borné en NOMBRE et en LONGUEUR", () => {
    // Les routes à conversation renvoient l'historique à chaque question. Leur
    // profondeur était bornée (6 à 10 messages), pas la longueur de chaque message :
    // une description de douleur de 4 000 caractères repartait en entier à CHAQUE tour.
    // Mesuré : jusqu'à 10 000 jetons d'historique par question — plus que le contexte
    // complet de l'athlète, et payés à chaque fois.
    for (const d of ["physio", "cours", "support"]) {
      const src = codeOf(`src/app/api/ai/${d}/route.ts`);
      const m = src.match(/history[^\n]*\)\.slice\(-(\d+)\)/);
      assert.ok(m, `${d} : l'historique n'est plus borné en nombre de messages`);
      assert.ok(Number(m![1]) <= 10, `${d} : ${m![1]} messages d'historique, c'est trop`);
      assert.ok(/String\(m\.text\)\.slice\(0, \d+\)|String\(m\.text\)\.slice\(0, 1500\)/.test(src),
        `${d} : chaque message d'historique doit être TRONQUÉ, pas seulement compté`);
    }
  });

  test("le budget de sortie de chaque route reste proportionné", () => {
    // La sortie coûte HUIT FOIS l'entrée au jeton : c'est elle qui décide de la facture,
    // pas la taille du contexte. Un `maxOutputTokens` large ne rend pas la réponse
    // meilleure, il la rend plus chère — et `coach` est le cas d'école : son propre
    // prompt demande « max 4 phrases ».
    const PLAFONDS: Record<string, number> = {
      coach: 600, session: 600, "journal-analyze": 500, support: 1200, cours: 1400,
      physio: 1600,
      // Le plan complet rend un JSON de plusieurs semaines : c'est la seule route qui
      // justifie un budget large, et elle n'est appelée qu'à la demande.
      "training-plan": 8192,
    };
    for (const d of readdirSync("src/app/api/ai")) {
      const f = `src/app/api/ai/${d}/route.ts`;
      if (!existsSync(f)) continue;
      const m = codeOf(f).match(/maxOutputTokens:\s*(\d+)/);
      if (!m) continue;
      const attendu = PLAFONDS[d];
      assert.ok(attendu != null, `${d} : route IA inconnue de la table des budgets`);
      assert.ok(Number(m[1]) <= attendu,
        `${d} : ${m[1]} jetons de sortie autorisés pour un budget de ${attendu} — la sortie coûte 8× l'entrée`);
    }
  });

  test("TOUTE route qui fait parler un modèle est verrouillée côté serveur", () => {
    // Le verrou n'existait pas : `subscription_tier` servait à afficher un badge et
    // chaque route servait tout le monde. Une formule payante qui ne verrouille rien
    // n'est pas une formule.
    //
    // ⚠️ Ce test se fonde sur la CONSOMMATION RÉELLE, pas sur une liste recopiée :
    // il balaie les routes, garde celles qui appellent Gemini, et exige le verrou.
    // Une nouvelle route IA sera donc couverte le jour où elle est écrite, sans que
    // personne ait à penser à l'ajouter ici.
    const dossier = "src/app/api/ai";
    const routes = readdirSync(dossier)
      .filter((d) => existsSync(`${dossier}/${d}/route.ts`))
      .map((d) => ({ nom: d, code: codeOf(`${dossier}/${d}/route.ts`) }))
      // ⚠️ Deux façons d'appeler Gemini coexistent dans ce projet : le client partagé
      // `generateContent` (qui porte la mémoire de quota et la bascule de modèle) et,
      // dans trois routes, un `fetch` vers une URL construite à la main. On détecte les
      // DEUX — sinon le balayage laisserait passer précisément les routes qui échappent
      // déjà au reste des garde-fous.
      .filter((r) => /generateContent\(|generativelanguage\.googleapis\.com/.test(r.code));
    assert.ok(routes.length >= 6, `seulement ${routes.length} routes IA trouvées : le balayage est cassé`);

    // L'assistant de support reste OUVERT, et c'est un choix assumé : c'est par lui
    // qu'un compte en consultation demande comment se réabonner. Le fermer reviendrait
    // à couper la parole à quelqu'un qui cherche à payer.
    // ── PLUS AUCUNE URL GEMINI BÂTIE À LA MAIN ───────────────────────────────
    // Trois routes construisaient l'URL elles-mêmes : elles échappaient à la mémoire de
    // quota (elles rappelaient donc Google après épuisement, pour rien) et à la bascule
    // de modèle, en codant `gemini-2.5-flash` en dur. Google a déjà retiré `2.0-flash` ;
    // le jour où `2.5` suivra, une URL figée tombe en silence.
    for (const r of routes) {
      assert.ok(!/generativelanguage\.googleapis\.com/.test(r.code),
        `${r.nom} : URL Gemini codée en dur — cette route échappe au client partagé`);
    }

    const OUVERTES = new Set(["support"]);
    for (const r of routes) {
      if (OUVERTES.has(r.nom)) {
        assert.ok(!/exigeAcces\(/.test(r.code), `${r.nom} : cette route doit rester ouverte (voir le commentaire)`);
        continue;
      }
      assert.ok(/exigeAcces\(supabase, user\.id, "ia"\)/.test(r.code), `${r.nom} : route IA NON verrouillée`);
      // Et le verrou doit précéder l'appel au modèle, sinon il ne protège pas la dépense.
      const appel = Math.min(...[r.code.indexOf("generateContent("), r.code.indexOf("await fetch(")]
        .filter((i) => i >= 0).concat([Number.MAX_SAFE_INTEGER]));
      assert.ok(r.code.indexOf("exigeAcces(") < appel,
        `${r.nom} : le verrou est posé APRÈS l'appel au modèle — la dépense a déjà eu lieu`);
    }
  });

  test("la landing ne vend AUCUNE fonctionnalité qui n'existe pas", () => {
    // Deux cartes annonçaient des choses que le code ne fait pas. Sur un site vendu à
    // des milliers de personnes, et sur le Play Store, c'est plus grave qu'un design daté.
    //
    //  · « Guardian Mode — Détection de chute, alerte des contacts d'urgence avec ta
    //    position GPS ». Vérifié : `guardian_mode_enabled` et `emergency_contact_*` ne
    //    sont lus QUE par ProfileSettings. Aucun accéléromètre, aucun DeviceMotion,
    //    aucune détection, aucun envoi d'alerte. C'était une promesse de SÉCURITÉ.
    //  · « Shopping Hub — Comparateur i-Run, Alltricks, Lepape ». Les prix sont
    //    codés en dur avec `simulated: true` dans api/shop/prices : des tarifs inventés
    //    attribués à des enseignes nommées, avec des liens vers leurs sites.
    for (const l of ALL_LANGS) {
      const t = JSON.stringify(LANDING_T[l].features);
      for (const promesse of [/détection de chute/i, /fall detection/i, /Sturzerkennung/i,
                              /detección de caídas/i, /deteção de quedas/i,
                              /Guardian Mode/i, /Shopping Hub/i,
                              /i-Run|Alltricks|Lepape/i]) {
        assert.ok(!promesse.test(t), `${l} : la landing annonce à nouveau « ${promesse.source} »`);
      }
    }
    // Et la preuve que ces fonctions restent absentes du produit : le jour où elles
    // existeront, ce test devra être mis à jour EN MÊME TEMPS que la vitrine.
    // ⚠️ Sentinelle. Elle doit rougir le JOUR où un prix cesse d'être simulé, pour
    // qu'on revienne rouvrir la vitrine. Chercher « simulated: true » quelque part ne
    // le faisait pas : le motif apparaît 68 fois, en changer un laissait les 67 autres
    // satisfaire l'assertion. On fige donc le RAPPORT, pas la présence.
    // ⚠️ Précision : la boutique n'est pas ENTIÈREMENT inventée. `tryDecathlonPrices`
    // interroge une vraie API et marque `simulated: false`. Ce sont les quatre autres
    // enseignes, calculées par un simple multiplicateur, qui sont fictives — et c'était
    // exactement celles que la vitrine citait nommément.
    //
    // La liste interdite est donc DÉRIVÉE DU CODE plutôt que recopiée : le jour où une
    // enseigne quitte la table simulée, elle devient citable sans qu'on ait à y penser,
    // et le jour où la table disparaît, ce test le dit.
    const shop = codeOf("src/app/api/shop/prices/route.ts");
    const fictives = [...shop.matchAll(/retailer_name: "([^"]+)",\s*multiplier:/g)].map((m) => m[1]);
    assert.ok(fictives.length >= 4,
      "la table de prix simulés a disparu : la boutique devient réelle, la vitrine peut "
      + "à nouveau en parler et ce test doit être rouvert");
    for (const nom of fictives) {
      for (const l of ALL_LANGS) {
        assert.ok(!JSON.stringify(LANDING_T[l].features).includes(nom),
          `${l} : la vitrine cite « ${nom} », dont le prix est calculé par multiplicateur`);
      }
    }
  });

  test("la vitrine des programmes est complète : photo, catégorie, 5 langues", () => {
    // Trois défauts SILENCIEUX possibles sur cette grille, et elle est la première
    // chose qu'un client voit :
    //  · un programme sans traduction affiche `undefined` comme titre ;
    //  · un programme sans photo laissait un aplat dégradé au milieu de photographies ;
    //  · une catégorie sans libellé rend une puce de filtre vide.
    const page = codeOf("src/app/page.tsx");
    const i18n = codeOf("src/components/landing/landingI18n.ts");

    const cles = [...(i18n.match(/export const PROGRAM_KEYS = \[([\s\S]*?)\]/)?.[1] ?? "")
      .matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]);
    const cats = [...(i18n.match(/export const CATEGORY_CODES = \[([\s\S]*?)\]/)?.[1] ?? "")
      .matchAll(/"([A-Z0-9]+)"/g)].map((m) => m[1]);
    assert.ok(cles.length >= 8, `PROGRAM_KEYS illisible (${cles.length})`);

    // Chaque programme déclaré possède une entrée dans PROGRAMS, avec une photo.
    const entrees = [...page.matchAll(/\{ key: "([a-z0-9]+)", category: "([A-Z0-9]+)", photo: "(photo-[\w-]+)" \}/g)]
      .map((m) => ({ key: m[1], cat: m[2], photo: m[3] }));
    assert.deepEqual(entrees.map((e) => e.key).sort(), [...cles].sort(),
      "PROGRAM_KEYS et le tableau PROGRAMS de page.tsx ne décrivent pas les mêmes programmes");
    for (const e of entrees) assert.ok(cats.includes(e.cat), `${e.key} : catégorie « ${e.cat} » absente de CATEGORY_CODES`);

    // Aucune photo en double : deux cartes identiques dans une même grille se voient.
    const photos = entrees.map((e) => e.photo);
    assert.equal(new Set(photos).size, photos.length, "deux programmes partagent la même photo");

    // ── LE RECADRAGE EST IMPOSÉ, ET IL VAUT LE FORMAT DE LA CARTE ──────────────
    // Les URL étaient écrites à la main en « ?w=600&fit=crop » : une largeur SANS
    // hauteur laisse Unsplash choisir son cadrage, et il rendait un panoramique
    // 600×275 pour une tuile en 3/4. Le navigateur en étirait une tranche centrale sur
    // 699 px en Retina — 3,4× d'agrandissement, d'où le flou. Rien ne signalait quoi que
    // ce soit : l'image se chargeait, la carte s'affichait.
    assert.ok(!/images\.unsplash\.com\/\$\{?[\w.]*\}?photo-|img: "https:\/\/images\.unsplash\.com/.test(page)
      || /const photoCarte/.test(page), "les URL de photos sont reconstruites à la main");
    const helper = page.match(/const photoCarte = \([^)]*\) =>\s*`([^`]+)`/)?.[1] ?? "";
    assert.ok(/w=\$\{largeur\}/.test(helper) && /h=\$\{[^}]*largeur[^}]*\}/.test(helper),
      "photoCarte doit imposer la LARGEUR ET LA HAUTEUR, sinon Unsplash recadre comme il veut");
    assert.ok(/largeur \* 4\) \/ 3/.test(helper), "le recadrage doit valoir le 3/4 de la carte (aspect-[3/4])");
    // ⚠️ Ancré sur la balise <img> DES CARTES, et pas sur le fichier entier : le hero
    // porte lui aussi un srcSet et un sizes. Chercher « srcSet= » n'importe où laissait
    // le test au vert alors qu'on venait de le retirer des cartes — vérifié par mutation.
    const deb = page.indexOf("photoCarte(p.photo");
    assert.ok(deb > 0, "la balise <img> des cartes n'utilise plus photoCarte");
    const balise = page.slice(page.lastIndexOf("<img", deb), page.indexOf("/>", deb) + 2);
    assert.ok(/srcSet=/.test(balise), "sans srcset, un téléphone télécharge l'image du grand écran");
    assert.ok(/sizes=/.test(balise), "un srcset sans `sizes` fait choisir au navigateur la plus grande image");

    // La grille est en 3 colonnes : un nombre non multiple de 3 laisse un trou dans la
    // dernière rangée. C'est ce trou qui a motivé le neuvième programme.
    //
    // ⚠️ On ancre la vérification sur le conteneur qui rend RÉELLEMENT les programmes
    // (celui juste avant `filtered.map`). Chercher « lg:grid-cols-3 » n'importe où dans
    // le fichier ne prouvait rien : la page en contient deux, et faire passer la grille
    // des programmes en 2 colonnes laissait le test au vert — vérifié par mutation.
    const avantGrille = page.slice(0, page.indexOf("filtered.map"));
    const conteneur = avantGrille.slice(avantGrille.lastIndexOf("<div className="));
    assert.ok(/lg:grid-cols-3/.test(conteneur),
      `la grille des programmes n'est plus en 3 colonnes : ${conteneur.slice(0, 90)}`);
    assert.equal(entrees.length % 3, 0,
      `${entrees.length} programmes sur 3 colonnes laissent ${3 - (entrees.length % 3)} case(s) vide(s)`);

    // Et tout cela existe dans les 5 langues.
    for (const l of ALL_LANGS) {
      const dict = LANDING_T[l];
      for (const k of cles) {
        assert.ok(dict.programs.items[k]?.title, `${l} : titre manquant pour « ${k} »`);
        assert.ok(dict.programs.items[k]?.subtitle, `${l} : sous-titre manquant pour « ${k} »`);
      }
      for (const c of cats) assert.ok(dict.programs.cats[c], `${l} : libellé manquant pour la catégorie « ${c} »`);
    }
  });

  test("la carte n'affiche que des clés de traduction qui EXISTENT", () => {
    // Une clé absente ne lève rien : `t()` renvoie la clé elle-même, et l'athlète lit
    // « streak.today.rest » à l'écran. C'est précisément le genre de défaut qu'aucune
    // relecture n'attrape et qu'aucune exception ne signale.
    const src = codeOf("src/components/dashboard/StreakCard.tsx");
    const cles = [...new Set([...src.matchAll(/"(streak\.[a-zA-Z0-9.]+)"/g)].map((m) => m[1]))];
    assert.ok(cles.length >= 12, `trop peu de clés détectées (${cles.length}) : le test ne prouverait rien`);
    for (const k of cles) assert.ok(k in T_UI.fr, `clé absente des traductions : ${k}`);
  });

  test("la série parle les 5 langues, sans trou", () => {
    // 5 langues obligatoires. Une langue incomplète retomberait sur le français au
    // milieu d'une carte espagnole, sans que rien ne le signale.
    const cles = Object.keys(T_UI.fr).filter((k) => k.startsWith("streak."));
    assert.ok(cles.length >= 18, "le jeu de clés de référence est trop maigre");
    for (const l of ALL_LANGS) {
      const manquantes = cles.filter((k) => !(k in T_UI[l]));
      assert.deepEqual(manquantes, [], `${l} : ${manquantes.length} clé(s) manquante(s)`);
    }
  });

  test("aucun badge ne récompense de courir N jours d'affilée", () => {
    // Défaut RÉEL trouvé en inventoriant l'existant : `/dashboard/leagues` distribuait
    // deux badges « légendaires » pour 50 puis 100 jours de course consécutifs. Dans une
    // application qui prescrit deux journées sans course par semaine, ces badges
    // n'étaient atteignables qu'en désobéissant au coach pendant sept à quatorze
    // semaines. Les tables `badges` et `user_badges` étant vides en production, ils
    // n'existaient que dans ce fichier.
    const src = codeOf("src/app/dashboard/leagues/page.tsx");
    // Sept badges vivaient là : 3, 7, 14, 21, 30, 50 et 100 jours de COURSE d'affilée.
    assert.deepEqual([...src.matchAll(/badge\("(streak_\d+)"/g)].map((m) => m[1]), [],
      "un badge récompense à nouveau des jours de course consécutifs");
    for (const mort of ["jours consécutifs", "jours d'affilée\", \"🔥\", \"rare\", \"Courir"]) {
      assert.ok(!src.includes(mort), `formulation « cours tous les jours » réintroduite : ${mort}`);
    }
    // Le décompte naïf lui-même doit avoir disparu : il calculait « aujourd'hui » en UTC.
    assert.ok(!/while \(dates\.has\(/.test(src), "le décompte naïf de jours courus d'affilée est de retour");
    // Et la série de cette page doit être LA MÊME que celle du tableau de bord.
    assert.ok(/computeStreak\(/.test(src), "la page ligues ne calcule plus la série sur le plan");
    assert.ok(/workouts: \(workouts \?\? \[\]\)/.test(src),
      "la série doit lire les activités BRUTES : `allWorkouts` est filtré aux courses, "
      + "le vélo casserait la série ici et la tiendrait sur le tableau de bord");
    assert.ok(/streak: serie\.current/.test(src), "la statistique d'en-tête doit être la même série");
    // Chaque badge affiché doit être traduit dans les 4 langues (le français est le
    // repli codé dans page.tsx). Une clé manquante afficherait l'anglais à un Allemand.
    const i18n = codeOf("src/components/gamification/leaguesBadgesI18n.ts");
    const ids = [...new Set([...src.matchAll(/badge\("(plan_streak_\d+)"/g)].map((m) => m[1]))];
    assert.ok(ids.length >= 5, `échelle de série trop courte (${ids.length})`);
    for (const id of ids) {
      assert.equal((i18n.match(new RegExp(`${id}:`, "g")) ?? []).length, 4, `${id} n'est pas traduit dans les 4 langues`);
    }
    assert.ok(!/\bstreak_\d+:/.test(i18n), "traductions des anciens badges laissées derrière");
  });

  test("le tableau de bord charge VRAIMENT la fenêtre de la série", () => {
    // Les requêtes existantes sont plafonnées à 40 lignes : l'auto-coach accumule ~1
    // prescription par jour écoulé, donc 40 lignes ne couvrent qu'un mois. Réutiliser
    // ces requêtes aurait tronqué la série au-delà, en silence.
    const page = codeOf("src/app/dashboard/page.tsx");
    assert.ok(/computeStreak\(/.test(page), "la série n'est pas calculée sur le tableau de bord");
    assert.ok(/streakFrom/.test(page) && /gte\("data->>date", streakFrom\)/.test(page),
      "les prescriptions ne sont pas chargées sur la fenêtre de la série");
    // Le tri par created_at décroissant conditionne `oneSessionPerSlot` : trier par date
    // garderait une prescription périmée, donc un mauvais verdict.
    assert.ok(/coach_session"\)\.gte\("data->>date", streakFrom\)\s*\n?\s*\.order\("created_at", \{ ascending: false \}\)/.test(page),
      "les prescriptions de la série doivent être triées par created_at décroissant");
    // ⚠️ Le tableau de bord appelle `oneSessionPerSlot` DEUX fois : pour la prochaine
    // séance affichée, et pour les prescriptions de la série. Chercher le nom seul
    // laissait retirer celui de la série sans rougir.
    assert.ok(/prescriptions: oneSessionPerSlot\(/.test(page),
      "les prescriptions de la série ne sont plus dédoublonnées par créneau");
    // Et l'AUTRE appel — celui qui choisit la prochaine séance affichée — doit rester,
    // sinon le tableau de bord réafficherait les doublons du plan republié. Deux appels,
    // deux rôles : on fige le compte plutôt que la simple présence du nom.
    assert.equal((page.match(/oneSessionPerSlot\(/g) ?? []).length, 2,
      "le tableau de bord doit dédoublonner DEUX fois : la prochaine séance, et la série");
  });
}

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
  // ── GARDE-FOU ANTI-RAFALE DE LA REPLANIFICATION ────────────────────────────
  // Client Supabase minimal : seule la lecture de `auto_coach_state` compte ici.
  console.log("\nGARDE-FOU ANTI-RAFALE — une republication pousse 5 séances sur la montre");
  const sbStub = (lastAt: string | null) => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: lastAt ? { data: { at: lastAt } } : null }) }),
        }),
      }),
    }),
  }) as unknown as Parameters<typeof replanIfFresh>[0];

  await atest("aucune séance inédite → aucune republication", async () => {
    // `synced.workouts` compte aussi les MISES À JOUR : la synchro rafraîchit les
    // derniers jours à chaque passage, ce qui republierait le plan toutes les 10 min.
    const r = await replanIfFresh(sbStub(null), { userId: "u", fresh: 0 });
    assert.equal(r.replanned, false);
    assert.equal(r.skipped, "rien de neuf");
  });
  await atest("deux séances coup sur coup ne republient qu'une fois", async () => {
    const r = await replanIfFresh(sbStub(new Date(Date.now() - 60_000).toISOString()), { userId: "u", fresh: 1 });
    assert.equal(r.replanned, false);
    assert.equal(r.skipped, "republié il y a moins de 10 min");
  });
  await atest("le garde-fou laisse passer au-delà de 10 minutes", async () => {
    // On ne vérifie pas la republication elle-même (elle appelle toute la chaîne coach) :
    // on vérifie le POINT DE BASCULE, qui est la seule chose que le garde-fou décide.
    const r = await replanIfFresh(sbStub(new Date(Date.now() - 11 * 60_000).toISOString()), { userId: "u", fresh: 1 });
    assert.notEqual(r.skipped, "republié il y a moins de 10 min");
  });
  await atest("on sait TOUJOURS pourquoi on n'a pas republié", async () => {
    // C'est le silence qui a masqué pendant des mois qu'un chemin n'écrivait rien.
    for (const [lastAt, fresh] of [[null, 0], [new Date().toISOString(), 1]] as [string | null, number][]) {
      const r = await replanIfFresh(sbStub(lastAt), { userId: "u", fresh });
      assert.ok(r.replanned || r.skipped, "ni republication ni motif : personne ne saura ce qui s'est passé");
    }
  });

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
