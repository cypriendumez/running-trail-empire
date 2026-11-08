/**
 * LE PROGRAMME MARCHE-COURSE (Cyprien, 05/11/2026 : « un programme marche-course pour les
 * débutants complets »).
 *
 * Avant lui, rien ne distinguait un débutant complet d'un coureur de « moins d'un an » :
 * tous recevaient d'abord « cours 6 minutes À FOND » (test VMA), puis des footings continus.
 * Ces tests gardent la réponse : la question à l'inscription, onze étapes de trois séances
 * déduites des sorties, une semaine de trois séances jamais consécutives, des étapes
 * course/marche lisibles par la montre, et aucun test VMA tant que le programme dure.
 *
 *   npx tsx tests/marche-course.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { PLAN_T } from "../src/lib/ai/planI18n";
import { programmeMarcheCourse, dureesMarcheCourse, ETAPES_MARCHE_COURSE } from "../src/lib/coach/marcheCourse";
import { etapesMarcheCourse, buildWorkoutDescription } from "../src/lib/watch/intervals";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
/** Le source sans ses commentaires — sans couper les `://` des adresses. */
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

type Ligne = Record<string, unknown>;
/** Faux client PostgREST en mémoire : eq, gte, lte, in, order, limit, single, maybeSingle. */
function fauxClient(tables: Record<string, Ligne[]>) {
  const requete = (toutes: Ligne[]) => {
    let lignes = [...toutes]; let tri: [string, boolean] | null = null; let lim: number | null = null;
    const q: Record<string, unknown> = {};
    const cmp = (op: (a: string, b: string) => boolean) => (c: string, v: unknown) => {
      lignes = lignes.filter((l) => !(c in l) || (l[c] != null && op(String(l[c]), String(v)))); return q;
    };
    for (const m of ["select", "not", "ilike", "or", "neq", "is"]) q[m] = () => q;
    q.eq = (c: string, v: unknown) => { lignes = lignes.filter((l) => !(c in l) || l[c] === v); return q; };
    q.gte = cmp((a, b) => a >= b); q.lte = cmp((a, b) => a <= b); q.gt = cmp((a, b) => a > b); q.lt = cmp((a, b) => a < b);
    q.in = (c: string, vs: unknown[]) => { lignes = lignes.filter((l) => !(c in l) || vs.includes(l[c])); return q; };
    q.order = (c: string, o?: { ascending?: boolean }) => { tri = [c, o?.ascending !== false]; return q; };
    q.limit = (n: number) => { lim = n; return q; };
    const fin = () => {
      let r = lignes;
      if (tri) {
        const [c, asc] = tri;
        r = [...r].sort((a, b) => (String(a[c] ?? "") < String(b[c] ?? "") ? -1 : String(a[c] ?? "") > String(b[c] ?? "") ? 1 : 0) * (asc ? 1 : -1));
      }
      return lim != null ? r.slice(0, lim) : r;
    };
    q.single = () => { const r = fin(); return Promise.resolve({ data: r[0] ?? null, error: r[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: fin()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: fin(), error: null }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(tables[t] ?? []) } as never;
}

const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
/** `ilYa(5)` = il y a cinq jours. */
const ilYa = (n: number) => {
  const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
};
// ⚠️ PAS DE `last_lat` : aucune requête météo.
const DEBUTANT = {
  id: "u", preferred_language: "fr", full_name: "Test", age: 41, gender: "female", weight_kg: 72,
  days_per_week: 3, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true,
  running_years: 0, peut_courir_30min: false,
};
const sortie = (n: number) => ({
  user_id: "u", date: ilYa(n), type: "easy", sport: "run", distance_km: 3, duration_seconds: 1800, avg_hr: 150, max_hr: 168, tss: 25,
});
async function contexte(profil: Ligne, seances: Ligne[] = [], notifications: Ligne[] = [], opts: { vma?: number; gratuit?: boolean } = {}): Promise<AthleteContext> {
  const base = opts.vma ? [{ user_id: "u", vma_kmh: opts.vma, max_hr: 190, resting_hr: 60, tested_at: ilYa(30) }] : [];
  return buildAthleteContext(fauxClient({ profiles: [profil], performance_baselines: base, workouts: seances, notifications }), "u",
    opts.gratuit ? { objectifSeul: true } : {});
}
/** Trois sorties par semaine depuis huit semaines : de quoi justifier une qualité hors programme
 *  (et, en marche-course, l'étape 9 — le programme n'est pas fini). */
const HUIT = Array.from({ length: 8 }, (_, s) => [1, 3, 5].map((j) => sortie(j + 7 * s))).flat();

async function main() {
  console.log("\nLE PROGRAMME — onze étapes de trois séances, déduites des sorties");

  await test("pas de programme si l'athlète court déjà 30 minutes, ou n'a pas répondu", () => {
    for (const r of [true, null, undefined]) {
      assert.equal(programmeMarcheCourse({ peutCourir30: r, joursCourus: [], aujourdhui: AUJOURDHUI }), null, `programme ouvert pour « ${r} »`);
    }
  });

  await test("première fois : étape 1, huit fois une minute de course et deux de marche", () => {
    const p = programmeMarcheCourse({ peutCourir30: false, joursCourus: [], aujourdhui: AUJOURDHUI });
    assert.deepEqual(p, { etape: 1, total: 11, seance: { reps: 8, courseMin: 1, marcheMin: 2 }, seancesFaites: 0 });
  });

  await test("trois séances par étape, et trois sorties par semaine au plus", () => {
    const etapeDe = (jours: number[]) => programmeMarcheCourse({ peutCourir30: false, joursCourus: jours.map(ilYa), aujourdhui: AUJOURDHUI })?.etape;
    assert.equal(etapeDe([1, 3, 5]), 2, "trois séances faites : l'étape 2 n'arrive pas");
    assert.equal(etapeDe([0, 1, 2, 3, 4, 5, 6]), 2, "sept sorties en une semaine comptent pour sept");
    assert.equal(etapeDe([1, 3, 5, 8, 10, 12]), 3);
  });

  await test("dix jours sans courir font redescendre d'une étape, vingt de deux", () => {
    const etapeDe = (jours: number[]) => programmeMarcheCourse({ peutCourir30: false, joursCourus: jours.map(ilYa), aujourdhui: AUJOURDHUI })?.etape;
    const deuxSemaines = [12, 14, 16, 19, 21, 23];
    assert.equal(etapeDe(deuxSemaines), 2, "douze jours sans courir n'ont rien coûté");
    assert.equal(etapeDe(deuxSemaines.map((j) => j + 10)), 1, "vingt-deux jours sans courir ont coûté moins de deux étapes");
  });

  await test("la dernière étape franchie referme le programme ; les vieilles sorties ne comptent pas", () => {
    const semaines = Array.from({ length: 12 }, (_, s) => [1, 3, 5].map((j) => j + 7 * s)).flat(); // 36 séances
    assert.equal(programmeMarcheCourse({ peutCourir30: false, joursCourus: semaines.map(ilYa), aujourdhui: AUJOURDHUI }), null,
      "36 séances en douze semaines et toujours en marche-course");
    // Trente-six séances il y a cinq mois, puis une reprise cette semaine : le recul ne voit
    // que le dernier arrêt (aucun ici) — c'est la fenêtre qui oublie les vieilles sorties.
    const anciennes = [...semaines.map((j) => j + 150), 1, 3, 5];
    assert.equal(programmeMarcheCourse({ peutCourir30: false, joursCourus: anciennes.map(ilYa), aujourdhui: AUJOURDHUI })?.etape, 2,
      "des sorties d'il y a cinq mois comptent encore");
  });

  await test("la course s'allonge d'étape en étape, jusqu'à 30 minutes d'affilée", () => {
    const course = ETAPES_MARCHE_COURSE.map((e) => dureesMarcheCourse(e).courseMin);
    assert.ok(course.every((c, i) => i === 0 || c >= course[i - 1] || "continuMin" in ETAPES_MARCHE_COURSE[i]), `course : ${course.join(", ")}`);
    const derniere = ETAPES_MARCHE_COURSE[ETAPES_MARCHE_COURSE.length - 1];
    assert.ok("continuMin" in derniere && derniere.continuMin === 30, "la dernière étape n'est pas 30 minutes de course continue");
    assert.deepEqual(dureesMarcheCourse({ reps: 8, courseMin: 1, marcheMin: 2 }), { courseMin: 8, totalMin: 32 });
  });

  console.log("\nLE PLAN — trois séances, jamais deux jours de suite, ni qualité ni test VMA");

  await test("un débutant complet reçoit SA semaine : trois séances de son étape, un renforcement, du repos", async () => {
    const ctx = await contexte(DEBUTANT);
    assert.equal(ctx.marcheCourse?.etape, 1, "le contexte n'ouvre pas le programme");
    // Avec un historique qui, hors programme, justifierait une qualité : toujours aucune.
    const avecHistorique = await contexte(DEBUTANT, HUIT, [], { vma: 11 });
    const temoin = await contexte({ ...DEBUTANT, peut_courir_30min: true }, HUIT, [], { vma: 11 });
    assert.ok(temoin.weekPlan.qBudget >= 1, `précondition : hors programme, ${temoin.weekPlan.qBudget} qualité pour ce profil`);
    assert.equal(avecHistorique.weekPlan.qBudget, 0, `${avecHistorique.weekPlan.qBudget} séance(s) de qualité en marche-course`);
    const plan = buildWeekPlan(ctx, new Date());
    const seances = plan.map((j, i) => ({ j, i })).filter(({ j }) => j.type === "Marche/course");
    assert.equal(seances.length, 3, `${seances.length} séance(s) : ${plan.map((j) => j.type).join(", ")}`);
    assert.ok(seances.every(({ i }, k) => k === 0 || i - seances[k - 1].i >= 2), `deux séances de suite : jours ${seances.map(({ i }) => i).join(", ")}`);
    assert.ok(!plan.some((j) => /VMA|Seuil|Spécifique|Sortie longue|Test/.test(j.type)), `séance hors programme : ${plan.map((j) => j.type).join(", ")}`);
    assert.match(seances[0].j.title, /^Marche\/course · étape 1\/11$/);
    assert.match(seances[0].j.detail, /8 × \(1 min de course très facile \/ 2 min de marche\)/);
    const renfo = plan.find((j) => j.type === "Renfo");
    assert.ok(renfo, "aucun renforcement dans la semaine");
    assert.match(renfo!.detail, /POUR COMMENCER/, `renforcement : ${renfo!.detail}`);
    // Les cinq langues décrivent la même séance.
    assert.match(seances[0].j.i18n?.en?.detail ?? "", /8 × \(1 min very easy running \/ 2 min walking\)/);
  });

  await test("le programme se dit, sans colorer le feu, et le modèle sait qu'il n'y a ni allure ni kilomètres", async () => {
    const ctx = await contexte(DEBUTANT);
    assert.ok(ctx.readiness.reasons.some((r) => /^programme marche-course, étape 1\/11 : ni séance de qualité ni test VMA/.test(r)),
      `le bandeau ne dit pas le programme : ${JSON.stringify(ctx.readiness.reasons)}`);
    assert.equal(ctx.readiness.level, "vert", `feu ${ctx.readiness.level} pour un simple programme`);
    assert.match(ctx.text, /PROGRAMME MARCHE-COURSE, étape 1\/11/);
    assert.doesNotMatch(ctx.text, /VOLUME CIBLE de la semaine/, "le modèle reçoit encore un volume en kilomètres");
  });

  await test("un objectif de course n'impose pas une feuille de route de VMA pendant le programme", async () => {
    const dix = { user_id: "u", type: "race_objective", data: { race: "10 km de la ville", raceDate: ilYa(-120), distanceKm: 10 } };
    const temoin = await contexte({ ...DEBUTANT, peut_courir_30min: true }, HUIT, [dix], { vma: 11 });
    assert.ok(temoin.macroPlan.length > 0, "précondition : sans programme, ce profil n'a pas de feuille de route");
    const ctx = await contexte(DEBUTANT, HUIT, [dix], { vma: 11 });
    assert.equal(ctx.macroPlan.length, 0, `feuille de route de ${ctx.macroPlan.length} semaine(s) en marche-course`);
  });

  await test("le plan gratuit aussi : la réponse est une donnée déclarée", async () => {
    const ctx = await contexte(DEBUTANT, [], [], { gratuit: true });
    assert.equal(ctx.marcheCourse?.etape, 1, "le débutant complet du plan gratuit n'a pas de marche-course");
  });

  await test("contre-épreuves : qui court déjà 30 minutes, ou a fini le programme, a le plan habituel", async () => {
    const sansProgramme = await contexte({ ...DEBUTANT, peut_courir_30min: true });
    assert.equal(sansProgramme.marcheCourse, null);
    const semaines = Array.from({ length: 12 }, (_, s) => [1, 3, 5].map((j) => sortie(j + 7 * s))).flat();
    const fini = await contexte(DEBUTANT, semaines);
    assert.equal(fini.marcheCourse, null, "le programme ne se referme pas après 36 séances");
  });

  console.log("\nLA MONTRE — chaque bascule course/marche est une étape");

  await test("l'alternance devient des étapes numérotées, encadrées de marche", () => {
    const etapes = etapesMarcheCourse(PLAN_T.fr.mcAlternance(8, 1, 2))?.split("\n") ?? [];
    assert.equal(etapes.length, 1 + 8 + 7 + 1, `${etapes.length} étape(s) :\n${etapes.join("\n")}`);
    assert.equal(etapes[0], "- 5m Z1 HR Marche active");
    assert.equal(etapes[1], "- 1m Z2 HR Course 1/8");
    assert.equal(etapes[2], "- 2m Z1 HR Marche 1/7");
    assert.equal(etapes[15], "- 1m Z2 HR Course 8/8", "pas de marche après la dernière course");
    assert.equal(etapes[16], "- 5m Z1 HR Marche pour finir");
    const continu = etapesMarcheCourse(PLAN_T.fr.mcContinu(20))?.split("\n") ?? [];
    assert.deepEqual(continu, ["- 5m Z1 HR Marche active", "- 20m Z2 HR Course continue", "- 5m Z1 HR Marche pour finir"]);
  });

  await test("la séance du plan arrive sur la montre en alternance, pas en footing continu", () => {
    const w = buildWorkoutDescription("Marche/course · étape 1/11", PLAN_T.fr.mcAlternance(8, 1, 2), "Marche/course", null, null, 15, 10, "garmin");
    assert.ok(w, "la séance n'est pas envoyée à la montre");
    assert.match(w!.description, /- 1m Z2 HR Course 1\/8\n- 2m Z1 HR Marche 1\/7/);
    assert.doesNotMatch(w!.description, /Endurance facile/, "un footing continu part encore à la montre");
    assert.equal(etapesMarcheCourse("Footing de 40 min"), null, "un texte sans alternance est pris pour une marche-course");
  });

  console.log("\nLE TEST VMA, L'INSCRIPTION ET LES RÉGLAGES");

  await test("le verrou du test VMA laisse passer le programme, et seulement lui", () => {
    const src = codeNu("src/lib/ai/autoCoach.ts");
    const verrou = src.slice(src.indexOf("if (!vmaMesuree && !estFondateur) {"), src.indexOf("const ctx = await buildAthleteContext("));
    assert.match(verrou, /if \(!\(await marcheCourseDe\(admin, userId\)\)\) \{\s*return prescrireTestVma\(/, "le test VMA est imposé au débutant en marche-course");
    const lecture = src.slice(src.indexOf("async function marcheCourseDe"), src.indexOf("async function prescrireTestVma"));
    assert.match(lecture, /if \(error \|\| \(profil[^)]*\)\?\.peut_courir_30min !== false\) return null;/, "une colonne absente ouvre le programme");
    assert.match(src, /marcheCourse: ctx\.marcheCourse \? \{ etape: ctx\.marcheCourse\.etape, total: ctx\.marcheCourse\.total \} : null/, "l'état du coach ne dit pas le programme");
    assert.match(codeNu("src/app/dashboard/page.tsx"), /<TestVmaBanner measured=\{vmaMesuree \|\| estFondateur \|\| enMarcheCourse\} \/>/,
      "le tableau de bord réclame encore le test VMA pendant le programme");
  });

  await test("l'inscription pose la question à moins d'un an de pratique, et l'écrit à part", () => {
    const src = codeNu("src/app/onboarding/page.tsx");
    assert.match(src, /\{profile\.running_years === 0 && \(\s*<Question id=\{`\$\{cid\}-trente`\}/, "la question n'est pas posée (ou l'est à tout le monde)");
    assert.match(src, /\[profile\.running_years === 0 && !profile\.peut_courir_30min, `\$\{cid\}-trente`/, "la réponse n'est pas exigée");
    // Écriture isolée et non bloquante : la colonne vient d'un SQL lancé à la main.
    assert.match(src, /\.update\(\{ peut_courir_30min: profile\.peut_courir_30min === "oui" \}\)\.eq\("id", user\.id\);\s*if \(e30\) journaliserFacultatif\(/,
      "l'écriture de la réponse n'est pas isolée, ou son échec bloque l'inscription");
    const reglages = codeNu("src/components/profile/ProfileSettings.tsx");
    assert.match(reglages, /if \(form\.peut_courir_30min !== avant30\) \{/, "les réglages écrivent la colonne même sans changement");
  });

  await test("les cinq langues ont la question et les séances", () => {
    const ob = readFileSync("src/app/onboarding/onboardingI18n.ts", "utf8");
    for (const k of ["q30Title:", "q30Hint:", "q30Oui:", "q30Non:"]) assert.equal(ob.split(k).length - 1, 5, `${k} absent de certaines langues`);
    const reg = readFileSync("src/components/profile/ProfileSettings.tsx", "utf8");
    for (const k of ['"f.q30":', '"f.q30Hint":']) assert.equal(reg.split(k).length - 1, 5, `${k} absent de certaines langues`);
    for (const l of ["fr", "en", "de", "es", "pt"] as const) {
      assert.ok(PLAN_T[l].mcAlternance(3, 8, 2).includes("3 × (8"), `alternance mal rendue en ${l}`);
      assert.ok(PLAN_T[l].renfoDebutant.length > 40, `renforcement débutant absent en ${l}`);
    }
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
