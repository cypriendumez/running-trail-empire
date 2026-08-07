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

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
