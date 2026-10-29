/**
 * UNE COURSE PASSÉE N'EST PLUS L'OBJECTIF (Cyprien, 30/10/2026).
 *
 * « Pourquoi il met ça encore, c'est faux. » Le marathon de Lille avait été couru le
 * 25/10 (42,5 km enregistrés). Cinq jours plus tard, le calendrier affichait :
 *   · en en-tête, « Aucune course » — juste, il lit `lib/coach/prochaineCourse` ;
 *   · dans « Pourquoi ce plan », un encadré rouge : « PRÉPARATION INSUFFISANTE POUR LA
 *     DISTANCE : la plus longue sortie de la préparation plafonnera à ~0 km pour une
 *     course de 42,2 km ».
 *
 * Trois défauts empilés :
 *  1. `race_objective` est une ligne unique que rien n'efface après la course, et le
 *     contexte du coach la prenait telle quelle : `daysToRace` = −4, donc phase
 *     « AFFÛTAGE » (−1 ≤ 2) et macro-plan vide (`daysToRace < 0`) ;
 *  2. `Math.max(0, ...[])` vaut 0 : un plan VIDE devenait un plan qui culmine à 0 km —
 *     le même « ~0 km » sortait pour tout athlète sans VMA, course à venir ou non ;
 *  3. le macro-plan ne porte que les semaines À VENIR : à trois semaines du départ, il ne
 *     contient plus que l'affûtage, et la sortie de 30 km déjà courue n'était pas comptée.
 *
 * Ces tests construisent le VRAI contexte du coach sur un faux client, sans base ni réseau.
 *
 *   npx tsx tests/objectif-passe.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext } from "../src/lib/ai/coachContext";
import { longRunGap } from "../src/lib/running/volume";
import { apresCourse, joursSansIntensite, JOURS_MAX } from "../src/lib/coach/apresCourse";
import { computeQualityBudget } from "../src/lib/coach/qualityBudget";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
/** Le source sans ses commentaires — sans couper les `://` des adresses. */
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/**
 * Faux client Supabase. ⚠️ Il applique les `eq` sur les colonnes que la ligne porte :
 * sinon la requête des douleurs ou des séances prescrites recevrait la ligne de
 * l'objectif, et le test mesurerait un contexte que la base réelle ne produit jamais.
 */
function fauxClient(tables: Record<string, unknown[]>) {
  const requete = (toutes: unknown[]) => {
    const filtres: [string, unknown][] = [];
    const lignes = () => toutes.filter((l) => filtres.every(([c, v]) => !(c in (l as object)) || (l as Record<string, unknown>)[c] === v));
    const q: Record<string, unknown> = {};
    for (const m of ["select", "gte", "lte", "lt", "gt", "not", "in", "or", "order", "limit", "neq", "is", "ilike"]) q[m] = () => q;
    q.eq = (c: string, v: unknown) => { filtres.push([c, v]); return q; };
    q.single = () => { const l = lignes(); return Promise.resolve({ data: l[0] ?? null, error: l[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: lignes()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: lignes(), error: null, count: lignes().length }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(tables[t] ?? []) } as never;
}

// Le jour du COACH (Paris), pas celui d'UTC : c'est lui qui décide si la course est passée.
const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
/** `ilYa(5)` = il y a cinq jours ; `ilYa(-15)` = dans quinze jours. */
const ilYa = (n: number) => {
  const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
};

// ⚠️ PAS DE `last_lat` : aucune requête météo, le test ne touche pas le réseau.
const PROFIL = {
  id: "u", preferred_language: "fr", full_name: "Test", age: 20, gender: "male", weight_kg: 70,
  days_per_week: 5, available_days: [1, 2, 3, 4, 6], health_conditions: [], injury_zones: [], health_declared: true,
};
const BASE = [{ vma_kmh: 17.6, max_hr: 205, resting_hr: 45, tested_at: ilYa(20) }];
/** Une sortie tous les deux jours sur sept semaines, dont une sortie longue de 30 km il y a 10 jours. */
const SEANCES = [
  ...Array.from({ length: 24 }, (_, i) => ({
    date: ilYa(i * 2 + 1), type: "easy", sport: "run", distance_km: 10 + (i % 3) * 2, duration_seconds: 3000 + (i % 3) * 500,
    elevation_gain_m: 50, avg_hr: 145, max_hr: 170, tss: 55, hr_zone_seconds: [600, 2400, 200, 0, 0],
  })),
  { date: ilYa(10), type: "long", sport: "run", distance_km: 30, duration_seconds: 9000, elevation_gain_m: 120, avg_hr: 150, max_hr: 172, tss: 160, hr_zone_seconds: [600, 7800, 600, 0, 0] },
];
const MARATHON = (raceDate: string) => ({
  user_id: "u", type: "race_objective",
  data: { race: "Marathon International de Lille", raceDate, distanceKm: 42.2, targetTime: "3h00", targetSeconds: 10800, targetPace: "4'16/km" },
});

async function contexte(objectif: unknown | null, opts: { base?: unknown[]; seances?: unknown[] } = {}) {
  return buildAthleteContext(fauxClient({
    profiles: [PROFIL],
    performance_baselines: opts.base ?? BASE,
    workouts: opts.seances ?? SEANCES,
    notifications: objectif ? [objectif] : [],
  }), "u");
}
const ecartPrepa = (warnings: string[]) => warnings.find((w) => /PRÉPARATION INSUFFISANTE/.test(w));

async function main() {
  console.log("\nLA SORTIE LONGUE PLANIFIÉE");

  await test("un plan qui culmine à 0 km n'est pas un plan trop court : c'est l'absence de plan", () => {
    assert.equal(longRunGap(0, 32, 42.2), null, "« plafonnera à ~0 km » est de nouveau fabriqué");
    // Contre-épreuve : un vrai plan trop court reste signalé.
    assert.match(longRunGap(12, 32, 42.2) ?? "", /PRÉPARATION INSUFFISANTE/);
  });

  console.log("\nAPRÈS LA COURSE — un jour facile par mile couru");

  await test("la durée suit la distance : 26 jours après un marathon, 13 après un semi, 6 après un 10 km", () => {
    assert.equal(joursSansIntensite(42.195), 26);
    assert.equal(joursSansIntensite(21.1), 13);
    assert.equal(joursSansIntensite(10), 6);
    assert.equal(joursSansIntensite(5), 3);
    assert.equal(joursSansIntensite(1.5), 1, "une course très courte doit au moins laisser le lendemain");
    // Au-delà du marathon, le plafond assumé : pas deux mois sans intensité après un 100 km.
    assert.equal(joursSansIntensite(100), JOURS_MAX);
  });

  const LILLE = { nom: "Marathon International de Lille", date: ilYa(5), distanceKm: 42.2 };
  await test("cinq jours après un marathon COURU : footings seulement, et la date de reprise", () => {
    const r = apresCourse({ course: LILLE, sorties: [{ date: ilYa(5), distanceKm: 42.5 }], aujourdhui: AUJOURDHUI });
    assert.ok(r, "aucune récupération cinq jours après un marathon couru");
    assert.equal(r!.joursDepuis, 5);
    // Reprise au 27ᵉ jour : les jours J+1 à J+26 restent faciles.
    assert.equal(r!.reprise, ilYa(5 - 27));
  });

  await test("une course non courue n'impose aucune récupération", () => {
    // Forfait : rien d'enregistré ce jour-là. Et 15 km un jour de marathon, c'est une
    // sortie, pas la course — en dessous de la moitié de la distance, on ne suppose rien.
    assert.equal(apresCourse({ course: LILLE, sorties: [], aujourdhui: AUJOURDHUI }), null);
    assert.equal(apresCourse({ course: LILLE, sorties: [{ date: ilYa(5), distanceKm: 15 }], aujourdhui: AUJOURDHUI }), null);
    assert.equal(apresCourse({ course: LILLE, sorties: [{ date: ilYa(4), distanceKm: 42.5 }], aujourdhui: AUJOURDHUI }), null,
      "une sortie du LENDEMAIN est prise pour la course");
  });

  await test("la fenêtre se referme : rien le jour même, rien après le dernier jour facile", () => {
    const couru = (n: number) => apresCourse({
      course: { ...LILLE, date: ilYa(n) }, sorties: [{ date: ilYa(n), distanceKm: 42.5 }], aujourdhui: AUJOURDHUI,
    });
    assert.equal(couru(0), null, "le jour de la course est déjà traité comme une récupération");
    assert.ok(couru(26), "le 26ᵉ jour, dernier jour facile, a perdu sa récupération");
    assert.equal(couru(27), null, "la récupération ne se referme jamais");
  });

  await test("la récupération l'emporte sur tous les planchers du budget de qualité", () => {
    // Athlète frais, préparation en cours : sans la récupération, le plancher « objectif »
    // garantit au moins une séance. Après une course, plus rien ne doit la ramener.
    const entree = {
      level: "confirme" as const, goal: "marathon" as const, phase: "DÉVELOPPEMENT", noHistory: false, pains: [],
      hrvDown: false, hrvUp: false, badNight: false, acr: 1.0, tsb: 0, rpeHigh: false, rpeAvg: null,
      hardTimePct: null, fadeSec: null, plateau: false, noMaxEffort: false, runYears: 5,
      weightLossMaxQuality: null, hasObjective: true, daysToRace: 72, isShortGoal: true,
    };
    assert.ok(computeQualityBudget(entree).qBudget >= 1, "précondition : l'athlète frais n'a déjà plus de qualité");
    const r = computeQualityBudget({ ...entree, apresCourse: "récupération après le marathon" });
    assert.equal(r.qBudget, 0, `${r.qBudget} séance(s) de qualité pendant la récupération`);
    assert.ok(r.easeReasons.includes("récupération après le marathon"), "la raison n'est pas donnée au coach");
  });

  console.log("\nLE CONTEXTE DU COACH");

  await test("cinq jours après la course, l'objectif n'est plus l'objectif", async () => {
    const ctx = await contexte(MARATHON(ilYa(5)));
    assert.equal(ctx.objective, null, "le coach prépare encore une course déjà courue");
    assert.equal(ctx.daysToRace, null, `jours avant la course : ${ctx.daysToRace} — un compte à rebours négatif`);
    assert.equal(ecartPrepa(ctx.objectiveWarnings), undefined, `avertissement sur une course passée : ${ecartPrepa(ctx.objectiveWarnings)}`);
    assert.ok(!/Course : Marathon International de Lille/.test(ctx.text), "le prompt du coach annonce encore la course passée");
    assert.ok(!/AFFÛTAGE \(volume/.test(ctx.text), "cinq jours après la course, le coach se croit en affûtage");
  });

  await test("cinq jours après le marathon couru : zéro qualité, et le bandeau dit pourquoi", async () => {
    const ctx = await contexte(MARATHON(ilYa(5)), {
      seances: [...SEANCES, { ...SEANCES[0], date: ilYa(5), type: "race", distance_km: 42.5, duration_seconds: 9720, tss: 260 }],
    });
    assert.equal(ctx.weekPlan.qBudget, 0, `${ctx.weekPlan.qBudget} séance(s) de qualité à J+5 d'un marathon`);
    const motif = ctx.readiness.reasons.find((r) => /récupération après Marathon International de Lille \(J\+5\)/.test(r));
    assert.ok(motif, `le bandeau ne dit pas pourquoi : ${JSON.stringify(ctx.readiness.reasons)}`);
  });

  await test("course passée mais non courue : pas de récupération inventée", async () => {
    const ctx = await contexte(MARATHON(ilYa(5)));
    assert.ok(!ctx.readiness.reasons.some((r) => /récupération après/.test(r)),
      `récupération imposée sans course enregistrée : ${JSON.stringify(ctx.readiness.reasons)}`);
  });

  await test("le jour même, la course reste l'objectif", async () => {
    const ctx = await contexte(MARATHON(AUJOURDHUI));
    assert.equal(ctx.objective?.race, "Marathon International de Lille", "la course du jour a disparu avant le départ");
    // `===` et non `assert.equal` : le jour J, `Math.ceil` rend −0, qui vaut bien 0.
    assert.ok(ctx.daysToRace === 0, `jours avant la course : ${ctx.daysToRace}`);
  });

  await test("sans VMA, aucun verdict sur une préparation qui n'a pas de feuille de route", async () => {
    // Ni test, ni séance : la VMA s'estime aussi à partir des sorties, il faut les retirer.
    const ctx = await contexte(MARATHON(ilYa(-90)), { base: [], seances: [] });
    // Précondition : sans VMA, le macro-plan est vide. Si une VMA venait à être estimée
    // autrement, ce test ne vérifierait plus rien — il doit le dire.
    assert.equal(ctx.macroPlan.length, 0, `précondition : macro-plan de ${ctx.macroPlan.length} semaine(s) — le cas « sans plan » n'est plus exercé`);
    assert.equal(ecartPrepa(ctx.objectiveWarnings), undefined, `verdict inventé : ${ecartPrepa(ctx.objectiveWarnings)}`);
  });

  await test("plan gratuit sans test VMA : les sorties courues ne fabriquent pas de verdict", async () => {
    // Le palier gratuit n'estime pas la VMA à partir des séances : sans test, pas de
    // macro-plan. La plus longue sortie (14 km) ne doit pas devenir la « préparation » d'un
    // plan qui n'existe pas — « plafonnera à ~14 km » serait aussi inventé que « ~0 km ».
    const ctx = await buildAthleteContext(fauxClient({
      profiles: [PROFIL], performance_baselines: [],
      workouts: SEANCES.filter((s) => s.distance_km < 20),
      notifications: [MARATHON(ilYa(-90))],
    }), "u", { objectifSeul: true });
    assert.equal(ctx.macroPlan.length, 0, `précondition : macro-plan de ${ctx.macroPlan.length} semaine(s)`);
    assert.equal(ecartPrepa(ctx.objectiveWarnings), undefined, `verdict inventé : ${ecartPrepa(ctx.objectiveWarnings)}`);
  });

  await test("en affûtage, la sortie longue déjà courue compte dans la préparation", async () => {
    // À 16 jours, le macro-plan ne contient plus que l'affûtage. L'athlète a couru 30 km
    // il y a 10 jours : sa préparation a atteint 30 km, pas « ~16 ».
    const ctx = await contexte(MARATHON(ilYa(-16)));
    assert.ok(ctx.macroPlan.length > 0 && ctx.macroPlan.every((w) => w.phase === "Affûtage"),
      `précondition : ${ctx.macroPlan.map((w) => w.phase).join(", ")} — le cas « affûtage seul » n'est plus exercé`);
    assert.equal(ecartPrepa(ctx.objectiveWarnings), undefined, `préparation jugée insuffisante malgré 30 km courus : ${ecartPrepa(ctx.objectiveWarnings)}`);
  });

  await test("la montre ne reçoit plus « Prépa <course passée> »", () => {
    // Le titre des séances poussées relisait la ligne `race_objective` brute : après le
    // marathon, chaque footing arrivait sur la montre en « Prépa Marathon International de
    // Lille — Footing ». Il doit venir du contexte, qui écarte un objectif passé.
    const src = codeNu("src/lib/ai/autoCoach.ts");
    assert.match(src, /const objectiveRace = ctx\.objective\?\.race/, "le titre de la montre ne vient plus de l'objectif du contexte");
    assert.ok(!/eq\("type", "race_objective"\)/.test(src), "autoCoach relit l'objectif brut, course passée comprise");
  });

  await test("le bandeau montre ses motifs juste après « ce n'est pas un oubli : », même replié", () => {
    // Replié, rien ne suivait les deux-points : la ligne suivante à l'écran était
    // l'encadré de réalisme, lu comme LA raison de la semaine sans qualité.
    const src = codeNu("src/components/training/CalendarView.tsx");
    const debut = src.indexOf('t("cal.why.title")');
    const fin = src.indexOf("</summary>", debut);
    const motifs = src.indexOf("reasons.map(", debut);
    assert.ok(debut > 0 && fin > debut, "résumé du bandeau introuvable");
    assert.ok(motifs > debut && motifs < fin, "les motifs sont de nouveau cachés dans la partie repliée");
    assert.equal(src.split("reasons.map(").length - 1, 1, "les motifs s'affichent deux fois au dépliage");
  });

  await test("contre-épreuve : une préparation réellement trop courte est toujours signalée", async () => {
    // Même athlète, sans sa sortie de 30 km, à 16 jours : c'est un vrai défaut, on le dit.
    const ctx = await buildAthleteContext(fauxClient({
      profiles: [PROFIL], performance_baselines: BASE,
      workouts: SEANCES.filter((s) => s.distance_km < 20),
      notifications: [MARATHON(ilYa(-16))],
    }), "u");
    assert.ok(ecartPrepa(ctx.objectiveWarnings), "le garde-fou ne signale plus rien du tout");
  });
}

main().then(() => {
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
});
