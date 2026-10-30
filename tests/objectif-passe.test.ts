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
import { apresCourse, joursSansIntensite, JOURS_MAX, partVolumeDuJour, facteurVolumeApresCourse } from "../src/lib/coach/apresCourse";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { etatDouble } from "../src/lib/coach/doubleSessions";
import type { AthleteContext } from "../src/lib/ai/coachContext";
import { computeQualityBudget } from "../src/lib/coach/qualityBudget";
import { objectifEnCours, estOfficielle } from "../src/lib/coach/prochaineCourse";
import { courseTerminee } from "../src/lib/notify/resultatsCourse";
import { avertissementsAge } from "../src/lib/coach/ageDistance";
import { coursePrecedente, debutPreparation } from "../src/lib/coach/objective";
import { avancementObjectif } from "../src/lib/dashboard/fenetre";
import { computeStreak, coursesDeLObjectif } from "../src/lib/streak/compute";
import { phraseDuJour } from "../src/lib/dashboard/discipline";
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
function fauxClient(tables: Record<string, unknown[]>, lues: string[] = []) {
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
  return { from: (t: string) => { lues.push(t); return requete(tables[t] ?? []); } } as never;
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

  console.log("\nCOURSE PASSÉE ET DÉFI PERSONNEL — partout où l'objectif est lu");

  await test("une règle unique : l'objectif expire le lendemain de sa date, jamais sans date", () => {
    assert.equal(objectifEnCours({ raceDate: ilYa(5) }, AUJOURDHUI), null, "une course passée est encore l'objectif");
    assert.deepEqual(objectifEnCours({ raceDate: AUJOURDHUI }, AUJOURDHUI), { raceDate: AUJOURDHUI }, "la course du jour a expiré avant le départ");
    assert.deepEqual(objectifEnCours({ race: "X", raceDate: "" }, AUJOURDHUI), { race: "X", raceDate: "" }, "un objectif sans date a expiré");
    assert.equal(objectifEnCours(null, AUJOURDHUI), null);
  });

  await test("un objectif est officiel sauf s'il dit le contraire — les anciens le restent", () => {
    assert.equal(estOfficielle({}), true, "un objectif enregistré avant l'option devient un défi perso");
    assert.equal(estOfficielle({ officielle: true }), true);
    assert.equal(estOfficielle({ officielle: false }), false);
    assert.equal(estOfficielle(null), true);
  });

  await test("pas d'e-mail « tes résultats sont en ligne » après un défi couru seul", () => {
    const c = { race: "Chrono 5 km", raceDate: ilYa(3), distanceKm: 5 };
    assert.ok(courseTerminee(c, AUJOURDHUI), "précondition : la course officielle déclenche l'e-mail");
    assert.equal(courseTerminee({ ...c, officielle: false }, AUJOURDHUI), null, "un classement est annoncé pour un test chrono");
  });

  const AGE16 = { ...PROFIL, age: 16 };
  const DEFI = (officielle: boolean) => ({
    user_id: "u", type: "race_objective",
    data: { race: "Défi marathon", raceDate: ilYa(-120), distanceKm: 42.2, targetTime: "3h30", targetSeconds: 12600, targetPace: "4'59/km", officielle },
  });
  const reglement = avertissementsAge({ age: 16, distanceKm: 42.2, lang: "fr", trail: false }).filter((a) => a.niveau === "reglement");
  const medical = avertissementsAge({ age: 16, distanceKm: 42.2, lang: "fr", trail: false }).filter((a) => a.niveau === "medical");

  await test("défi personnel : ni catalogue, ni règlement fédéral, mais l'avis médical reste", async () => {
    assert.ok(reglement.length && medical.length, "précondition : à 16 ans, un marathon déclenche règlement ET avis médical");
    const lues: string[] = [];
    const ctx = await buildAthleteContext(fauxClient({ profiles: [AGE16], performance_baselines: BASE, workouts: SEANCES, notifications: [DEFI(false)] }, lues), "u");
    assert.ok(!lues.includes("races"), "un défi personnel est cherché dans le catalogue des courses");
    assert.ok(!reglement.some((r) => ctx.objectiveWarnings.some((w) => w.startsWith(r.texte))), "le règlement d'inscription est opposé à un défi couru seul");
    assert.ok(medical.some((m) => ctx.objectiveWarnings.some((w) => w.startsWith(m.texte))), "l'avis médical a disparu avec le règlement");
    assert.match(ctx.text, /Défi personnel, PAS une course officielle/, "le coach n'est pas prévenu qu'il ne s'agit pas d'une course");
  });

  await test("contre-épreuve : la course officielle garde catalogue et règlement", async () => {
    const lues: string[] = [];
    const ctx = await buildAthleteContext(fauxClient({ profiles: [AGE16], performance_baselines: BASE, workouts: SEANCES, notifications: [DEFI(true)] }, lues), "u");
    assert.ok(lues.includes("races"), "la course officielle n'est plus cherchée au catalogue");
    assert.ok(reglement.some((r) => ctx.objectiveWarnings.some((w) => w.startsWith(r.texte))), "le règlement a disparu pour une vraie course");
    assert.match(ctx.text, /• Course : Défi marathon/);
  });

  await test("le formulaire propose le défi personnel et ne demande pas d'heure de départ", () => {
    const src = codeNu("src/components/dashboard/ObjectiveCard.tsx");
    // Course ou défi : un choix franc en tête du formulaire, plus une case à cocher qu'on
    // découvrait après avoir cherché sa « course » en vain dans le catalogue.
    assert.match(src, /role="radiogroup"/, "le choix course officielle / défi perso a disparu");
    assert.match(src, /choix \? t\("obj\.kindRace"\) : t\("obj\.kindChallenge"\)/, "le défi perso n'est plus proposé");
    assert.match(src, /onClick=\{\(\) => \{ setOfficielle\(choix\);/, "le choix ne change plus le formulaire");
    assert.match(src, /\{officielle && \(\s*<label className="block">\s*<span[^>]*>\{t\("obj\.startTime"\)\}/, "l'heure de départ est demandée pour un défi");
    assert.match(src, /startTime: officielle \? heure \|\| undefined : undefined, officielle \}/, "le caractère officiel n'est plus envoyé");
    assert.match(src, /officielle && !race\.trim\(\)/, "un défi sans nom est refusé");
    // Côté serveur : enregistré, et le règlement d'âge écarté de la réponse immédiate.
    const api = codeNu("src/app/api/objective/route.ts");
    assert.match(api, /setRaceObjective\(admin, user\.id, \{[^}]*officielle \}\)/, "la route n'enregistre pas le caractère officiel");
    assert.match(api, /\.filter\(\(a\) => officielle \|\| a\.niveau !== "reglement"\)/, "la réponse oppose le règlement à un défi");
    assert.match(codeNu("src/lib/coach/objective.ts"), /officielle: input\.officielle !== false/);
  });

  await test("la carte d'objectif suit la charte : ni indigo, ni bouton fait main, et un vrai chrono", () => {
    // Cyprien, 30/10/2026 : « ça fait trop IA ». La carte était la seule de l'application en
    // violet, avec ses propres boutons ; la charte (DESIGN.md) veut l'émeraude par petites
    // touches et les primitives partagées.
    const src = codeNu("src/components/dashboard/ObjectiveCard.tsx");
    assert.doesNotMatch(src, /indigo/, "l'indigo est revenu dans la carte d'objectif");
    assert.match(src, /className=\{btnClass\("primary", "md"\)\}/, "le bouton d'enregistrement ne vient plus des primitives de la charte");
    // Ancré sur le style des CASES de saisie : les deux-points portent la même police, et
    // une assertion trop large se contentait d'eux (mutation « chrono ordinaire » survivante).
    assert.match(src, /const chiffreCls = "[^"]*\bfont-sport text-\[2\.5rem\]/, "le chrono n'est plus saisi en chiffres de course");
    assert.match(src, /aria-label=\{aria\} className=\{chiffreCls\}/, "les cases du chrono n'ont plus le style des chiffres de course");
    assert.match(src, /t\("obj\.paceLive", \{ pace: allure \}\)/, "l'allure n'est plus calculée pendant la saisie");
  });

  await test("après la course, le tableau de bord ouvre un formulaire VIDE et nomme la course passée", () => {
    const page = codeNu("src/app/dashboard/page.tsx");
    assert.match(page, /const objective = objectifEnCours\(objectifEnregistre, streakToday\)/, "le tableau de bord sert encore une course passée comme objectif");
    assert.match(page, /derniereCourse=\{derniereCourse\}/);
    const carte = codeNu("src/components/dashboard/ObjectiveCard.tsx");
    assert.match(carte, /!objective && derniereCourse && \(/, "la course passée n'est plus nommée");
    // Les indicateurs suivent la même règle, sinon la carte de forme et sa page divergent.
    assert.match(codeNu("src/lib/indicateurs/donnees.ts"), /objectifEnCours\(o, aujourdhui\)/, "les indicateurs jugent encore contre une course passée");
  });

  await test("ni Pass Prévention Santé ni recherche d'heure de départ pour un défi personnel", () => {
    assert.match(codeNu("src/app/dashboard/pps/page.tsx"), /const obj = estOfficielle\(objBrut\) \? objBrut : \{\};/, "le PPS est réclamé pour un test chrono");
    assert.match(codeNu("src/app/api/cron/heure-depart/route.ts"), /if \(o\.officielle === false\) continue;/, "l'heure d'un défi est cherchée sur le web");
  });

  console.log("\nUN NOUVEL OBJECTIF N'EFFACE PAS LA COURSE QU'IL REMPLACE");

  await test("l'objectif remplacé devient la course précédente s'il est passé, et seulement alors", () => {
    const lille = { race: "Marathon International de Lille", raceDate: ilYa(5), distanceKm: 42.2 };
    assert.deepEqual(coursePrecedente(lille, AUJOURDHUI), { ...lille, officielle: true }, "le marathon couru est oublié dès qu'on fixe le suivant");
    // On corrige un objectif encore à venir : la course précédente qu'il portait est gardée.
    const sub16 = { race: "Sub 16 min sur 5 km", raceDate: ilYa(-46), distanceKm: 5, precedente: { ...lille, officielle: true } };
    assert.deepEqual(coursePrecedente(sub16, AUJOURDHUI), { ...lille, officielle: true }, "corriger son nouvel objectif efface la course précédente");
    assert.equal(coursePrecedente({ race: "X", raceDate: ilYa(-10), distanceKm: 10 }, AUJOURDHUI), null, "une course à venir est prise pour la précédente");
    assert.equal(coursePrecedente(null, AUJOURDHUI), null);
  });

  await test("nouvel objectif fixé à J+5 : la récupération du marathon tient toujours", async () => {
    const sub16 = {
      user_id: "u", type: "race_objective",
      data: { race: "Sub 16 min sur 5 km", raceDate: ilYa(-46), distanceKm: 5, targetTime: "16'00", targetSeconds: 960, targetPace: "3'12/km", officielle: false,
              precedente: { race: "Marathon International de Lille", raceDate: ilYa(5), distanceKm: 42.2, officielle: true } },
    };
    const ctx = await contexte(sub16, {
      seances: [...SEANCES, { ...SEANCES[0], date: ilYa(5), type: "race", distance_km: 42.5, duration_seconds: 9720, tss: 260 }],
    });
    assert.equal(ctx.objective?.race, "Sub 16 min sur 5 km", "précondition : le nouvel objectif est pris en compte");
    assert.equal(ctx.weekPlan.qBudget, 0, `${ctx.weekPlan.qBudget} séance(s) de qualité à J+5 du marathon, sous prétexte d'un nouvel objectif`);
    assert.ok(ctx.readiness.reasons.some((r) => /récupération après Marathon International de Lille \(J\+5\)/.test(r)), "le bandeau ne dit plus pourquoi");
    // La feuille de route : rien avant la reprise (J+27), de la qualité ensuite.
    const avant = ctx.macroPlan.filter((_, i) => i * 7 < 22);
    const apres = ctx.macroPlan.filter((_, i) => i * 7 >= 22);
    assert.ok(avant.length && avant.every((w) => w.quality.length === 0), `qualité annoncée pendant la récupération : ${avant.map((w) => w.quality.join("+")).join(" | ")}`);
    assert.ok(apres.some((w) => w.quality.length > 0), "contre-épreuve : la qualité ne revient jamais après la récupération");
  });

  await test("l'e-mail de résultats et l'enregistrement de l'objectif suivent la course précédente", () => {
    assert.match(codeNu("src/lib/notify/resultatsCourse.ts"), /courseTerminee\(o, opts\.aujourdhui\) \?\? courseTerminee\(o\?\.precedente, opts\.aujourdhui\)/,
      "un nouvel objectif fixé à J+3 prive de l'e-mail de classement");
    assert.match(codeNu("src/lib/coach/objective.ts"), /data\.precedente = coursePrecedente\(existing\?\.data/, "l'objectif remplacé n'est plus conservé");
  });

  console.log("\nLE TABLEAU DE BORD NE CONTREDIT PLUS LE PLAN");

  await test("frais pendant la récupération : la phrase rappelle la récupération, pas une séance de qualité", () => {
    // Cyprien, 30/10/2026, J+5 du marathon : « Tu es frais — bon jour pour une séance de
    // qualité » en tête du tableau de bord, « pas d'intensité avant le 21 novembre » au calendrier.
    const recup = { course: "Marathon International de Lille", reprise: "2026-11-21" };
    assert.deepEqual(phraseDuJour("top", { qBudget: 0, recuperation: recup }), { cle: "dash.ready.recup", recuperation: recup },
      "un athlète frais en récupération est encore invité à une séance de qualité");
    assert.equal(phraseDuJour("correct", { qBudget: 0, recuperation: recup }).cle, "dash.ready.recup");
    // Fatigue et absence de mesure gardent leur message : ils disent déjà « facile ».
    assert.equal(phraseDuJour("repos", { qBudget: 0, recuperation: recup }).cle, "dash.ready.rest");
    assert.equal(phraseDuJour("aucun", { qBudget: 0, recuperation: recup }).cle, "dash.ready.none");
  });

  await test("frais mais aucune qualité au plan : la phrase ne la promet plus", () => {
    assert.equal(phraseDuJour("top", { qBudget: 0, recuperation: null }).cle, "dash.ready.topSansQualite",
      "le tableau de bord promet une séance de qualité que le plan ne contient pas");
    // Contre-épreuve : quand le plan en contient, « bon jour pour une séance de qualité » est juste.
    assert.equal(phraseDuJour("top", { qBudget: 2, recuperation: null }).cle, "dash.ready.top");
    assert.equal(phraseDuJour("top", null).cle, "dash.ready.top", "sans état du coach, rien n'est présumé");
  });

  await test("le coach écrit sa récupération sous forme structurée, le tableau de bord la lit", async () => {
    const ctx = await contexte(MARATHON(ilYa(5)), {
      seances: [...SEANCES, { ...SEANCES[0], date: ilYa(5), type: "race", distance_km: 42.5, duration_seconds: 9720, tss: 260 }],
    });
    assert.deepEqual(ctx.recuperation, { course: "Marathon International de Lille", reprise: ilYa(5 - 27) },
      "le contexte du coach n'expose plus la récupération en cours");
    assert.match(codeNu("src/lib/ai/autoCoach.ts"), /recuperation: ctx\.recuperation \?\? null/, "le coach n'enregistre plus sa récupération");
    const page = codeNu("src/app/dashboard/page.tsx");
    assert.match(page, /eq\("type", "auto_coach_state"\)/, "le tableau de bord ne lit plus la décision du coach");
    assert.match(page, /recupCoach\.reprise > streakToday/, "une récupération terminée serait encore rappelée");
    assert.match(page, /planCoach=\{planCoach\}/, "la décision du coach n'atteint plus le tableau de bord");
    assert.match(codeNu("src/components/dashboard/BentoDashboard.tsx"), /phraseDuJour\(e, plan\)/, "la phrase du jour ignore de nouveau le plan");
  });

  console.log("\nLA SÉRIE — le lendemain d'une course, se reposer ne la casse plus (Cyprien, 30/10 : série à 0)");

  await test("le lendemain d'une course courue, se reposer ne casse plus la série", () => {
    const seances = [
      { date: "2026-10-23", sport: "run", type: "easy", duration_seconds: 2640, distance_km: 10.2 },
      { date: "2026-10-24", sport: "run", type: "easy", duration_seconds: 1740, distance_km: 5.3 },
      { date: "2026-10-25", sport: "run", type: "easy", duration_seconds: 9720, distance_km: 42.5 },
    ];
    // Le plan publié chaque matin : une récupération courue, y compris le lendemain du marathon.
    const prescriptions = ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"].map((date) => ({ date, sessionType: "Récupération" }));
    const lille = { raceDate: "2026-10-25", distanceKm: 42.2 };
    const verdict = (r: ReturnType<typeof computeStreak>, d: string) => r.days.find((x) => x.date === d);
    const sansCourse = computeStreak({ workouts: seances, prescriptions, today: "2026-10-30" });
    assert.equal(verdict(sansCourse, "2026-10-26")?.verdict, "rompu", "précondition : sans la course, le lendemain est manqué");
    // La course arrive par l'objectif suivant, qui la porte en course précédente.
    const avec = computeStreak({ workouts: seances, prescriptions, courses: coursesDeLObjectif({ raceDate: "2026-12-19", distanceKm: 5, precedente: lille }), today: "2026-10-30" });
    assert.equal(verdict(avec, "2026-10-26")?.reason, "protege-course", "le lendemain du marathon n'est pas protégé");
    assert.equal(avec.current, 3, `série à ${avec.current} : le repos du lendemain l'a de nouveau cassée`);
    // Une course non courue ne protège rien : il faut une sortie d'au moins la moitié de la distance.
    const nonCourue = computeStreak({ workouts: seances.slice(0, 2), prescriptions, courses: coursesDeLObjectif(lille), today: "2026-10-30" });
    assert.equal(verdict(nonCourue, "2026-10-26")?.verdict, "rompu", "une course non courue protège son lendemain");
    // Les deux pages qui calculent la série lui passent les courses : sinon elles se contrediraient.
    for (const p of ["src/app/dashboard/page.tsx", "src/app/dashboard/leagues/page.tsx"]) {
      assert.match(codeNu(p), /courses: coursesDeLObjectif\(/, `${p} ne passe plus les courses à la série`);
    }
  });

  console.log("\nL'ANNEAU « PRÉPARATION » NE SUPPOSE PLUS RIEN (Cyprien, 30/10 : « 56 % » le jour même)");

  await test("la préparation part du jour où l'objectif a été fixé, pas de 16 semaines supposées", () => {
    const sub16 = { raceDate: "2026-12-19", depuis: "2026-10-30" };
    assert.deepEqual(avancementObjectif(sub16, "2026-10-30"), { joursRestants: 50, pct: 0 }, "le jour même");
    assert.deepEqual(avancementObjectif(sub16, "2026-11-24"), { joursRestants: 25, pct: 50 }, "à mi-chemin");
    assert.deepEqual(avancementObjectif(sub16, "2026-12-19"), { joursRestants: 0, pct: 100 }, "le jour de la course");
    assert.equal(avancementObjectif(sub16, "2026-12-20"), null, "une course passée n'a plus de compte à rebours");
    // Un objectif enregistré avant le champ : sa date d'enregistrement.
    assert.equal(avancementObjectif({ raceDate: "2026-12-19", ts: "2026-11-24T08:00:00Z" }, "2026-11-24")?.pct, 0);
    // Aucune date : le compte à rebours reste, le pourcentage n'est pas inventé.
    assert.deepEqual(avancementObjectif({ raceDate: "2026-12-19" }, "2026-10-30"), { joursRestants: 50, pct: null });
    // Un plan démarré APRÈS l'objectif devient le départ ; un vieux plan ne compte pas.
    assert.equal(avancementObjectif(sub16, "2026-11-24", "2026-11-14")?.pct, 29, "le plan démarré le 14/11 n'est pas le départ");
    assert.equal(avancementObjectif(sub16, "2026-11-24", "2026-06-01")?.pct, 50, "un plan de juin fait croire à une préparation de six mois");
  });

  await test("corriger le chrono ne remet pas la préparation à zéro ; changer de date, si", () => {
    const ancien = { race: "sub 16 min", raceDate: "2026-12-19", depuis: "2026-10-30", ts: "2026-11-02T10:00:00Z" };
    assert.equal(debutPreparation(ancien, "2026-12-19", "2026-11-10"), "2026-10-30", "le chrono corrigé a remis l'anneau à zéro");
    assert.equal(debutPreparation(ancien, "2027-01-16", "2026-11-10"), "2026-11-10", "une autre date est un autre objectif");
    assert.equal(debutPreparation(null, "2026-12-19", "2026-10-30"), "2026-10-30", "premier objectif : il part d'aujourd'hui");
    // Objectif enregistré avant le champ : sa date d'enregistrement.
    assert.equal(debutPreparation({ raceDate: "2026-12-19", ts: "2026-10-30T16:12:34Z" }, "2026-12-19", "2026-11-10"), "2026-10-30");
    assert.match(codeNu("src/lib/coach/objective.ts"), /data\.depuis = debutPreparation\(existing\?\.data/, "l'enregistrement n'écrit plus le départ de la préparation");
    assert.match(codeNu("src/components/dashboard/BentoDashboard.tsx"), /avancementObjectif\(objective, jour,/, "le tableau de bord ne lit plus l'avancement commun");
    assert.doesNotMatch(codeNu("src/components/dashboard/BentoDashboard.tsx"), /112 \* 86400000/, "les 16 semaines supposées sont revenues");
  });

  console.log("\nAPRÈS LA COURSE — le volume aussi (Cyprien, 30/10 : 70 km visés à J+5, « scinde en DEUX sorties »)");

  await test("le volume repart de la moitié, puis 70 et 85 % : un palier par tiers de la récupération", () => {
    // Marathon : 26 jours, paliers de neuf, neuf et huit jours.
    assert.equal(partVolumeDuJour(1, 26), 0.5);
    assert.equal(partVolumeDuJour(9, 26), 0.5);
    assert.equal(partVolumeDuJour(10, 26), 0.7);
    assert.equal(partVolumeDuJour(18, 26), 0.7);
    assert.equal(partVolumeDuJour(19, 26), 0.85);
    assert.equal(partVolumeDuJour(26, 26), 0.85);
    assert.equal(partVolumeDuJour(27, 26), 1, "la réduction survit à la récupération");
    // 10 km : six jours, deux par palier.
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((j) => partVolumeDuJour(j, 6)), [0.5, 0.5, 0.7, 0.7, 0.85, 0.85, 1]);
    // Le plan couvre sept jours : sa cible est la moyenne de ces sept jours.
    assert.equal(facteurVolumeApresCourse({ joursDepuis: 1, joursTotal: 26 }), 0.5);
    assert.equal(Math.round(facteurVolumeApresCourse({ joursDepuis: 5, joursTotal: 26 }) * 100), 56, "J+5 : cinq jours à 50 %, deux à 70 %");
  });

  const marathonCouru = [...SEANCES, { ...SEANCES[0], date: ilYa(5), type: "race", distance_km: 42.5, duration_seconds: 9720, tss: 260 }];
  const lilleCouru = { race: "Marathon International de Lille", raceDate: ilYa(5), distanceKm: 42.2, officielle: true };
  const apresLille = (data: Record<string, unknown>, precedente: boolean) => ({
    user_id: "u", type: "race_objective", data: precedente ? { ...data, precedente: lilleCouru } : data,
  });
  const SUB16 = { race: "Sub 16 min sur 5 km", raceDate: ilYa(-46), distanceKm: 5, targetTime: "16'00", targetSeconds: 960, targetPace: "3'12/km", officielle: false };

  await test("à J+5 du marathon, le coach vise 56 % du volume, et la feuille de route remonte par paliers", async () => {
    // Mêmes séances, même objectif : seule la course précédente (donc la récupération) diffère.
    const enRecup = await contexte(apresLille(SUB16, true), { seances: marathonCouru });
    const sansRecup = await contexte(apresLille(SUB16, false), { seances: marathonCouru });
    assert.ok(enRecup.recuperation && !sansRecup.recuperation, "précondition : seule la première est en récupération");
    const proche = (a: number, b: number) => Math.abs(a - b) <= 1;
    const attendu = Math.round(sansRecup.volume.targetKm * facteurVolumeApresCourse({ joursDepuis: 5, joursTotal: 26 }));
    assert.ok(proche(enRecup.volume.targetKm, attendu),
      `${enRecup.volume.targetKm} km visés à J+5 au lieu de ~${attendu} (${sansRecup.volume.targetKm} km hors récupération)`);
    // La feuille de route dit la même chose que le plan : 70 % de l'habitude la semaine
    // suivante, puis 85 % (l'habitude = la première semaine hors récupération).
    const habitude = sansRecup.macroPlan[0].volumeKm;
    assert.ok(proche(enRecup.macroPlan[1].volumeKm, Math.round(habitude * 0.7)),
      `semaine 2 : ${enRecup.macroPlan[1].volumeKm} km au lieu de ~70 % de ${habitude}`);
    assert.ok(proche(enRecup.macroPlan[2].volumeKm, Math.round(habitude * 0.85)),
      `semaine 3 : ${enRecup.macroPlan[2].volumeKm} km au lieu de ~85 % de ${habitude}`);
    assert.equal(enRecup.macroPlan[5].volumeKm, sansRecup.macroPlan[5].volumeKm, "la réduction déborde au-delà de la récupération");
    assert.ok(enRecup.readiness.reasons.some((r) => /56 % de ton volume habituel cette semaine/.test(r)), "le bandeau ne dit pas la part du volume");
  });

  await test("sans nouvel objectif (donc sans feuille de route), le volume est réduit aussi", async () => {
    const enRecup = await contexte(MARATHON(ilYa(5)), { seances: marathonCouru });
    const sansCourse = await contexte(null, { seances: marathonCouru });
    assert.ok(enRecup.recuperation && !enRecup.macroPlan.length && !sansCourse.recuperation, "précondition : récupération sans macro-plan");
    const attendu = Math.round(sansCourse.volume.targetKm * facteurVolumeApresCourse({ joursDepuis: 5, joursTotal: 26 }));
    assert.ok(Math.abs(enRecup.volume.targetKm - attendu) <= 1,
      `${enRecup.volume.targetKm} km visés à J+5 au lieu de ~${attendu} (${sansCourse.volume.targetKm} km sans course)`);
  });

  await test("pendant la récupération, la sortie longue ne dépasse pas 30 % du volume réduit", async () => {
    // Objectif suivant : un marathon, dont le macro-plan réclame une longue sortie.
    const MARATHON_SUIVANT = { race: "Marathon de Paris", raceDate: ilYa(-70), distanceKm: 42.2, targetTime: "3h00", targetSeconds: 10800, targetPace: "4'16/km" };
    const enRecup = await contexte(apresLille(MARATHON_SUIVANT, true), { seances: marathonCouru });
    const sansRecup = await contexte(apresLille(MARATHON_SUIVANT, false), { seances: marathonCouru });
    const plafond = Math.round(enRecup.volume.targetKm * 0.3);
    assert.ok(sansRecup.volume.longRunPlanned > plafond, `précondition : la sortie longue prévue (${sansRecup.volume.longRunPlanned} km) dépasse le plafond (${plafond} km)`);
    assert.ok(enRecup.volume.longRunPlanned <= plafond, `${enRecup.volume.longRunPlanned} km de sortie longue pour ${enRecup.volume.targetKm} km dans la semaine`);
  });

  await test("la montée en charge repart APRÈS la récupération, pas pendant", async () => {
    // Récupération jusqu'à J+26 : les quatre premières semaines du plan commencent dedans.
    const MARATHON_SUIVANT = { race: "Marathon de Paris", raceDate: ilYa(-70), distanceKm: 42.2, targetTime: "3h00", targetSeconds: 10800, targetPace: "4'16/km" };
    const enRecup = await contexte(apresLille(MARATHON_SUIVANT, true), { seances: marathonCouru });
    const sansRecup = await contexte(apresLille(MARATHON_SUIVANT, false), { seances: marathonCouru });
    const habitude = sansRecup.macroPlan[0].volumeKm;
    assert.ok(sansRecup.macroPlan[4].volumeKm > habitude + 5, "précondition : hors récupération, la cinquième semaine a déjà progressé");
    // Première semaine après la récupération : l'habitude, pas quatre semaines de progression d'un coup.
    assert.ok(Math.abs(enRecup.macroPlan[4].volumeKm - habitude) <= 1,
      `${enRecup.macroPlan[4].volumeKm} km la semaine de la reprise, au lieu de ~${habitude} (l'habitude)`);
  });

  await test("pendant la récupération, le plan ne conseille plus de doubler les footings", () => {
    // Un volume visé qui déborde des footings (plafonnés par une sortie longue de 10 km).
    const ctx = {
      text: "", objective: null, daysToRace: null, weeksToRace: null, athleteName: "Test",
      vma: 17.6, thresholdPace: "3'45", easyPace: "4'52", hardGapHours: 48, lastHardDaysAgo: null,
      weekPlan: { qBudget: 0, quality: [], easyPace: "4'52", eased: false },
      longRunMode: "run", macroPlan: [],
      readiness: { level: "vert", reasons: [], reasonsAll: [], advice: "" },
      volume: { weekKm: 150, avg4wkKm: 150, targetKm: 150, longRunKm: 10 },
      cycle: { deload: false, taper: false, label: "" }, skippedWeekdays: [],
      availability: { daysPerWeek: 6, days: [0, 1, 2, 3, 4, 5, 6] },
      forecast: [], tooMuchIntensity: null, hillyTraining: false,
      altitude: { elevationM: null, lossPct: 0 }, warmCool: { warm: 15, cool: 10 },
      heatAcclim: { hotDays: 0, factor: 1, label: "non acclimaté" },
    } as unknown as AthleteContext;
    const conseille = (c: AthleteContext) => buildWeekPlan(c, new Date()).some((j) => /scinde en DEUX/.test(j.detail));
    assert.ok(conseille(ctx), "précondition : hors récupération, ce volume fait bien conseiller de doubler");
    assert.ok(!conseille({ ...ctx, recuperation: { course: "Marathon International de Lille", reprise: ilYa(-21) } }),
      "« scinde en DEUX sorties » pendant la récupération d'un marathon");
  });

  await test("les vraies séances doublées sont refusées pendant la récupération, motif à l'appui", () => {
    const apte = { optIn: true, weeklyKm: 110, runYears: 6, readiness: "vert" as const, pains: [], taper: false };
    assert.equal(etatDouble(apte).autorise, true, "précondition : cet athlète a droit aux doubles");
    const r = etatDouble({ ...apte, recuperation: "Marathon International de Lille" });
    assert.equal(r.autorise, false, "séances doublées autorisées à J+5 d'un marathon");
    assert.ok(r.manque.some((m) => /récupération après Marathon International de Lille/.test(m)), "le profil ne dit pas pourquoi");
    for (const lang of ["en", "de", "es", "pt"] as const) {
      assert.ok(etatDouble({ ...apte, recuperation: "Lille", lang }).manque.some((m) => m.includes("Lille")), `motif absent en ${lang}`);
    }
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /recuperation: recup\?\.nom \?\? null/, "le coach ne transmet plus sa récupération aux doubles");
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
