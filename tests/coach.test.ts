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

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
