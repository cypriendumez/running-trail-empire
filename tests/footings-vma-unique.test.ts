/**
 * UNE SEULE LECTURE DES FOOTINGS, UN SEUL FILTRE « SÉANCE DURE », UNE SEULE VMA (17/11/2026).
 *
 * Trois écarts entre le coach et les autres consommateurs, relevés par @HeadCoach :
 *  1. le coach prenait les footings qui calent ses cibles de FC dans ses 60 DERNIÈRES SÉANCES tous
 *     sports ; la montre sur 60 JOURS. Avec 62 sorties de vélo récentes, le coach n'en voyait aucun
 *     (cibles théoriques, 136-146 bpm) quand la montre calait 119-129 sur les vrais footings ;
 *  2. sans effort maximal récent, le coach estimait la VMA depuis les sorties et calait le plan dessus,
 *     mais les écrans affichaient « pas de VMA » et `getEffectiveVma` rendait `null` (envois admin sans
 *     allures, course A sans chrono). Choix de Cyprien : la même partout, dite « estimée » ;
 *  3. « long tempo » ou « trail côte » : footing pour le coach, séance dure pour la montre.
 *
 *   npx tsx tests/footings-vma-unique.test.ts
 */
process.env.TZ = "UTC";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, getEffectiveVma } from "../src/lib/ai/coachContext";
import { ciblesFcPour } from "../src/lib/coach/ciblesFcServeur";
import { estTypeDur } from "../src/lib/coach/fcCible";
import { fcMaxDeLAthlete } from "../src/lib/coach/fcMaxServeur";
import { lireSeancesVma } from "../src/lib/dashboard/seancesVma";
import { vmaAffichee, JOURS_VMA_ESTIMEE } from "../src/lib/dashboard/vmaAffichee";
import { COLONNES_FOOTINGS_FC } from "../src/lib/coach/ciblesFcServeur";
import { testVmaAEviter, testVmaAEviterDe, avisMedicalEnAttenteDe } from "../src/lib/health/testVmaAEviter";
import { clePredictions } from "../src/components/profile/ProfileSettings";
import { ficheIndicateur } from "../src/lib/indicateurs/fiches";
import { TEXTES } from "../src/lib/indicateurs/textes";
import { T } from "../src/lib/i18n/translations";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const code = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

type Ligne = Record<string, unknown>;
/** Faux client PostgREST (lectures) : eq, gte, lte, order, limit, single, maybeSingle. */
function fauxClient(tables: Record<string, Ligne[]>, panne?: string) {
  const requete = (toutes: Ligne[]) => {
    let lignes = [...toutes]; let tri: [string, boolean] | null = null; let lim: number | null = null; let enPanne = false;
    const q: Record<string, unknown> = {};
    const cmp = (op: (a: string, b: string) => boolean) => (c: string, v: unknown) => {
      lignes = lignes.filter((l) => !(c in l) || (l[c] != null && op(String(l[c]), String(v)))); return q;
    };
    for (const m of ["not", "ilike", "or", "neq", "is"]) q[m] = () => q;
    q.select = (colonnes?: string) => { if (panne && colonnes === panne) enPanne = true; return q; };
    const ERREUR = { code: "XX000", message: "panne simulée" };
    q.eq = (c: string, v: unknown) => { lignes = lignes.filter((l) => !(c in l) || l[c] === v); return q; };
    q.gte = cmp((a, b) => a >= b); q.lte = cmp((a, b) => a <= b); q.gt = cmp((a, b) => a > b); q.lt = cmp((a, b) => a < b);
    q.in = (c: string, vs: unknown[]) => { lignes = lignes.filter((l) => !(c in l) || vs.includes(l[c])); return q; };
    q.order = (c: string, o?: { ascending?: boolean }) => { tri = [c, o?.ascending !== false]; return q; };
    q.limit = (n: number) => { lim = n; return q; };
    const fin = () => {
      let r = lignes;
      if (tri) { const [c, asc] = tri; r = [...r].sort((a, b) => (Number(a[c]) - Number(b[c]) || (String(a[c] ?? "") < String(b[c] ?? "") ? -1 : String(a[c] ?? "") > String(b[c] ?? "") ? 1 : 0)) * (asc ? 1 : -1)); }
      return lim != null ? r.slice(0, lim) : r;
    };
    q.single = () => { const r = fin(); return Promise.resolve(enPanne ? { data: null, error: ERREUR } : { data: r[0] ?? null, error: r[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve(enPanne ? { data: null, error: ERREUR } : { data: fin()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(enPanne ? { data: null, error: ERREUR } : { data: fin(), error: null }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(tables[t] ?? []) } as never;
}
async function aLInstant<T>(iso: string, fn: () => Promise<T> | T): Promise<T> {
  const Vrai = Date;
  const delta = Vrai.parse(iso) - Vrai.now();
  class Faux extends Vrai {
    constructor(...a: unknown[]) { if (a.length === 0) super(Vrai.now() + delta); else super(...(a as [number])); }
    static now() { return Vrai.now() + delta; }
  }
  (globalThis as { Date: DateConstructor }).Date = Faux as DateConstructor;
  try { return await fn(); } finally { (globalThis as { Date: DateConstructor }).Date = Vrai; }
}
const jourMoins = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

const J = "2026-11-18";
/** Un impératif d'effort, dans les 5 langues (« Enchaîne quelques sorties », « Log a few runs »…). */
const EFFORT = /\b(enchaîne|cours|fais|lance|sors|log|run|go|take|lauf|mach|absolviere|encadena|corre|haz|sal|faz|sai)\b/i;
const MATIN = "2026-11-18T08:00:00Z", NUIT = "2026-11-17T23:30:00Z";   // 9 h et 0 h 30 à Paris
const profil = (o: Ligne = {}) => ({ id: "u", preferred_language: "fr", full_name: "Test", age: 32, gender: "male", weight_kg: 70, max_hr: 188, resting_hr: 50,
  days_per_week: 5, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true, garmin_metrics: null,
  pace_curve: null, garmin_vo2max: null, last_lat: null, last_lon: null, ...o });
const footing = (n: number, type = "easy", hr = 124) => ({ user_id: "u", date: jourMoins(J, n), type, sport: "run", distance_km: 8, duration_seconds: 2700, avg_hr: hr, max_hr: 140, tss: 40 });
const velo = (n: number, k: number) => ({ user_id: "u", date: jourMoins(J, n), type: "ride", sport: "bike", distance_km: 40, duration_seconds: 5400 + k, avg_hr: 120, max_hr: 145, tss: 70 });

async function contexteEtMontre(tables: Record<string, Ligne[]>, instant = MATIN) {
  return aLInstant(instant, async () => {
    const ctx = await buildAthleteContext(fauxClient(tables), "u");
    return { coach: ctx.ciblesFc, montre: await ciblesFcPour(fauxClient(tables) as never, "u"), ctx };
  });
}

async function main() {
  console.log("\nUNE SEULE LECTURE DES FOOTINGS, UN SEUL FILTRE « DUR », UNE SEULE VMA");

  await test("estTypeDur : les types d'endurance d'abord écartés, puis les mots de la qualité", () => {
    for (const t of ["easy", "long tempo", "trail côte", "Endurance fartlek", "Footing", "récup", "", null]) assert.equal(estTypeDur(t), false, `« ${t} » jugé dur`);
    for (const t of ["tempo", "intervals", "Fractionné 10×400", "VMA", "seuil", "hill repeats", "race"]) assert.equal(estTypeDur(t), true, `« ${t} » jugé non dur`);
  });

  await test("coureur qui fait aussi du vélo : le coach voit ses footings des 60 jours, comme la montre", async () => {
    // 62 sorties de vélo dans les 31 derniers jours, puis 8 footings jusqu'à J-56 : les 60 dernières
    // séances ne sont QUE du vélo.
    const veloRecent = Array.from({ length: 62 }, (_, k) => velo(Math.floor(k / 2) + 1, k));
    const footings = [33, 36, 40, 43, 47, 50, 53, 56].map((n) => footing(n));
    const avec = { profiles: [profil()], performance_baselines: [], notifications: [], workouts: [...veloRecent, ...footings] };
    const sans = { profiles: [profil()], performance_baselines: [], notifications: [], workouts: veloRecent };
    for (const instant of [MATIN, NUIT]) {
      const a = await contexteEtMontre(avec, instant), s = await contexteEtMontre(sans, instant);
      assert.notDeepEqual(a.montre, s.montre, "précondition : les 8 footings changent les cibles de la montre");
      assert.deepEqual(a.coach, a.montre, `${instant} : coach ${JSON.stringify(a.coach)} ≠ montre ${JSON.stringify(a.montre)}`);
    }
  });

  await test("types atypiques (« long tempo », « trail côte ») : mêmes footings pour le coach et la montre", async () => {
    const workouts = [3, 8, 13, 18, 23, 28, 33, 38].map((n, k) => footing(n, k % 2 ? "long tempo" : "trail côte", 122 + (k % 3)));
    const t = { profiles: [profil()], performance_baselines: [], notifications: [], workouts };
    const r = await contexteEtMontre(t);
    const temoin = await contexteEtMontre({ ...t, workouts: [] });
    assert.notDeepEqual(r.montre, temoin.montre, "précondition : ces 8 sorties doivent compter comme footings pour la montre");
    assert.deepEqual(r.coach, r.montre, `coach ${JSON.stringify(r.coach)} ≠ montre ${JSON.stringify(r.montre)}`);
  });

  await test("sans test ni effort maximal récent : la même VMA estimée pour le coach, l'écran et getEffectiveVma, dite « estimée »", async () => {
    // Des sorties de 8 à 12 km à FC modérée (< 85 % de la FC max) : aucun effort ne compte pour la VMA
    // « séances », l'estimation des sorties des 45 jours prend le relais.
    const workouts = Array.from({ length: 30 }, (_, k) => k + 1).filter((n) => n % 3 !== 0)
      .map((n) => ({ user_id: "u", date: jourMoins(J, n), type: "easy", sport: "run", distance_km: 8 + (n % 5), duration_seconds: Math.round((8 + (n % 5)) * 320), avg_hr: 150, max_hr: 160, tss: 50 }));
    const t = { profiles: [profil()], performance_baselines: [], notifications: [], workouts };
    for (const instant of [MATIN, NUIT]) {
      const [coach, ecran, effective] = await aLInstant(instant, async () => {
        const sb = fauxClient(t);
        const ctx = await buildAthleteContext(sb, "u");
        const lues = await lireSeancesVma(sb as never, "u");
        const affichee = vmaAffichee({ seances: (lues.data ?? []) as never, baseline: null, profil: { garmin_vo2max: null, pace_curve: null }, fcMax: await fcMaxDeLAthlete(sb as never, "u") });
        return [ctx.vma, affichee, await getEffectiveVma(sb as never, "u")] as const;
      });
      assert.ok(coach != null && coach > 0, `${instant} : précondition, le coach estime une VMA (${coach})`);
      assert.equal(ecran.vma, coach, `${instant} : l'écran affiche ${ecran.vma}, le plan est calé sur ${coach}`);
      assert.equal(effective, coach, `${instant} : getEffectiveVma rend ${effective}, le plan est calé sur ${coach}`);
      assert.deepEqual(ecran.source, { type: "estimee" }, `${instant} : la source affichée n'est pas « estimée » (${JSON.stringify(ecran.source)})`);
      assert.equal(ecran.effort, null, `${instant} : un effort maximal est cité alors qu'il n'y en a pas`);
    }
  });

  await test("lecture des footings en panne : le coach se replie sur ses séances déjà lues, sans rien inventer", async () => {
    // 8 footings parmi les dernières séances : le repli les retrouve ; sans repli (`[]`), cibles théoriques.
    const t = { profiles: [profil()], performance_baselines: [], notifications: [], workouts: [3, 6, 10, 13, 17, 20, 24, 27].map((n) => footing(n)) };
    const [normal, enPanne, theorique] = await aLInstant(MATIN, async () => [
      (await buildAthleteContext(fauxClient(t), "u")).ciblesFc,
      (await buildAthleteContext(fauxClient(t, COLONNES_FOOTINGS_FC), "u")).ciblesFc,
      (await buildAthleteContext(fauxClient({ ...t, workouts: [] }), "u")).ciblesFc,
    ]);
    assert.notDeepEqual(normal, theorique, "précondition : les footings changent les cibles");
    assert.deepEqual(enPanne, normal, `en panne, les cibles ne viennent plus des séances déjà lues (${JSON.stringify(enPanne)})`);
    const coach = code("src/lib/ai/coachContext.ts");
    assert.match(coach, /if \(footingsRes\.error\) \{[\s\S]{0,300}journaliserEchecUneFois\(null, \{ source: "coach-footings", userId,/, "la panne des footings n'est plus journalisée");
  });

  await test("test VMA à éviter : avis médical attendu, marche-course ou lecture en panne — la règle du bandeau", async () => {
    const apt = (oui: string[], avisMedecin: string | null = null) => ({ user_id: "u", type: "aptitude", created_at: "2026-11-01T10:00:00Z", data: { oui, date: "2026-11-01", avisMedecin } });
    const etat = (marcheCourse: unknown) => ({ user_id: "u", type: "auto_coach_state", data: { marcheCourse } });
    const cas: [string, Record<string, Ligne[]>, boolean, string?][] = [
      ["rien de déclaré", { notifications: [] }, false],
      ["aptitude sans réserve", { notifications: [apt([])] }, false],
      ["avis médical attendu", { notifications: [apt(["poitrine"])] }, true],
      ["avis médical donné", { notifications: [apt(["poitrine"], "2026-11-05")] }, false],
      ["programme marche-course", { notifications: [etat({ etape: 3 })] }, true],
      ["les deux lectures en panne", { notifications: [] }, true, "data"],
    ];
    for (const [nom, tables, attendu, panne] of cas)
      assert.equal(await testVmaAEviter(fauxClient(tables, panne) as never, "u"), attendu, `${nom} : test VMA ${attendu ? "proposé" : "écarté"} à tort`);
    // Chaque panne, seule, protège : dans le doute, aucun effort maximal.
    const ok = { data: [], error: null }, okEtat = { data: null, error: null }, panne = { data: null, error: { message: "panne" } };
    assert.equal(testVmaAEviterDe(ok, okEtat), false, "précondition : rien de lu, rien d'écarté");
    assert.equal(testVmaAEviterDe(panne, okEtat), true, "aptitude illisible : le test est proposé quand même");
    assert.equal(testVmaAEviterDe(ok, panne), true, "état du coach illisible : le test est proposé quand même (marche-course possible)");
    // « Pas de test » n'est pas « pas de course » : la marche-course écarte le test, PAS la course.
    const marche = { data: { data: { marcheCourse: { etape: 3 } } }, error: null };
    const attente = { data: [{ data: { oui: ["poitrine"], date: "2026-11-01", avisMedecin: null } }], error: null };
    assert.equal(testVmaAEviterDe(ok, marche), true, "précondition : la marche-course écarte le test");
    assert.equal(avisMedicalEnAttenteDe(ok), false, "marche-course sans avis médical : carte « Avis médical attendu » affichée à tort");
    assert.equal(avisMedicalEnAttenteDe(attente), true, "avis médical attendu : la course est proposée quand même");
    assert.equal(avisMedicalEnAttenteDe(panne), true, "questionnaire illisible : la course est proposée quand même");
    const dash = code("src/app/dashboard/page.tsx");
    assert.match(dash, /const avisMedicalAttendu = avisMedicalEnAttenteDe\(\{ data: lignesApt, error: eApt \}\);/, "la carte « pas de course » ne lit plus le seul questionnaire");
    assert.match(dash, /sansCourse=\{avisMedicalAttendu\}/, "la carte « Avis médical attendu » suit la règle du test (marche-course, panne de l'état du coach)");
    // Le bandeau du tableau de bord applique LA règle, avec ses propres lectures.
    assert.match(code("src/app/dashboard/page.tsx"), /const sansTestVma = testVmaAEviterDe\(\{ data: lignesApt, error: eApt \}, etatCoachRes, profileRes\);/,
      "le bandeau du tableau de bord ne passe plus par la règle partagée");
  });

  await test("fiche vitesse : le conseil du test, jamais à un coureur exempté ni sur une VMA estimée", () => {
    const donnees = (source: unknown, testVmaExclu: boolean) => ({ lang: "fr", aujourdhui: J, seances: [], historique: [], vfc: [], sommeil: [], charge: [],
      vma: { vma: 15, source }, objectif: null, plan: null, fcRepos: null, testVmaExclu }) as never;
    const conseille = (source: unknown, exclu: boolean) => ficheIndicateur("vitesse", donnees(source, exclu)).conseils.includes(TEXTES.fr.vitesse.conseilTest);
    assert.equal(conseille({ type: "seances", date: "2026-11-10", km: 10 }, false), true, "précondition : VMA d'une séance, pas d'exemption : le test est conseillé");
    assert.equal(conseille({ type: "seances", date: "2026-11-10", km: 10 }, true), false, "test conseillé à un coureur exempté (avis médical attendu, marche-course)");
    assert.equal(conseille({ type: "estimee" }, false), false, "test conseillé sur la fiche d'une VMA estimée (le bandeau du tableau de bord s'en charge)");
    assert.equal(conseille({ type: "test", date: "2026-10-01" }, false), false, "test conseillé alors qu'un test est enregistré");
  });

  await test("libellés de la VMA estimée : courts, sans invitation au test ni « FC », avec la fenêtre réelle", () => {
    for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
      const dash = String((T as Record<string, Record<string, string>>)[lang]["dash.vma.src.estimee"] ?? "");
      const fiche = String(TEXTES[lang].vitesse.srcEstimee ?? "");
      assert.ok(dash.includes(String(JOURS_VMA_ESTIMEE)), `${lang} : le tableau de bord ne dit pas ${JOURS_VMA_ESTIMEE} jours (« ${dash} »)`);
      for (const [ou, txt] of [["tableau de bord", dash], ["fiche", fiche]] as const) {
        assert.ok(txt.length > 0, `${lang} : libellé ${ou} absent`);
        assert.doesNotMatch(txt, /test|\b(FC|HR|HF)\b/i, `${lang} : le libellé ${ou} invite au test ou parle de FC (« ${txt} »)`);
      }
    }
    const profil = code("src/components/profile/ProfileSettings.tsx");
    assert.match(profil, /tr\(fitness\?\.testVmaExclu \? "perf\.vmaWarnSansTest" : "perf\.vmaWarn"\)/, "le profil invite au test un coureur exempté");
    assert.match(code("src/app/dashboard/profile/page.tsx"), /const testVmaExclu = await testVmaAEviter\(supabase, user!\.id\);/, "le profil ne lit plus la règle du test à éviter");
    assert.match(code("src/lib/indicateurs/donnees.ts"), /const testVmaExclu = await testVmaAEviter\(sb, userId\);/, "la fiche ne lit plus la règle du test à éviter");
  });

  await test("Profil : aucun texte montré à un coureur exempté n'invite au test VMA, dans les 5 langues", async () => {
    // Le dictionnaire du composant, langue par langue, lu dans la source (5 blocs fr, en, de, es, pt).
    const src = readFileSync("src/components/profile/ProfileSettings.tsx", "utf8");
    const texte = (cle: string) => [...src.matchAll(new RegExp(`"${cle.replace(/\./g, "\\.")}": "([^"]*)"`, "g"))].map((m) => m[1]);
    // Les clés rendues à un exempté : avertissement, légende des prédictions (chaque source), état vide.
    const rendues = ["perf.vmaWarnSansTest", "perf.emptyDescSansTest",
      ...(["test", "séances", "courbe", "vo2max", null] as const).map((s) => clePredictions(s, true))];
    for (const cle of new Set(rendues)) {
      const textes = texte(cle);
      assert.equal(textes.length, 5, `${cle} : ${textes.length} langue(s) au lieu de 5`);
      for (const x of textes) {
        assert.doesNotMatch(x, /test/i, `${cle} invite au test un coureur exempté : « ${x} »`);
        // Deux publics aux consignes OPPOSÉES (avis médical attendu : pas de course ; marche-course :
        // courir en alternance) : un texte commun ne prescrit aucun effort (@Maestro, 19/11/2026).
        assert.doesNotMatch(x, EFFORT, `${cle} prescrit un effort à un coureur peut-être interdit de course : « ${x} »`);
      }
    }
    // Sans exemption, rien ne change : les légendes d'origine.
    assert.equal(clePredictions("séances", false), "perf.predDescSess");
    assert.equal(clePredictions("test", false), "perf.predDescTest");
    assert.match(src, /tr\(fitness\?\.testVmaExclu \? "perf\.emptyDescSansTest" : "perf\.emptyDesc"\)/, "l'état vide du Profil invite au test un coureur exempté");
    // Lisible sur le blanc de la carte : zinc-300 ≈ 1,5:1, zinc-400 ≈ 2,6:1, zinc-500 ≈ 4,8:1 (4,5 exigés).
    assert.match(src, /<p className="text-zinc-500 text-sm">\{tr\("perf\.emptyTitle"\)\}<\/p>\s*<p className="text-zinc-500 text-xs mt-1">\{tr\(fitness\?\.testVmaExclu/, "l'état vide du Profil est illisible sur fond blanc");
    assert.match(src, /tr\(clePredictions\(vmaSource, !!fitness\?\.testVmaExclu\)\)/, "la légende des prédictions ne lit plus l'exemption");
  });

  await test("une seule recherche d'effort dans tout src/ : `effortDesSeances` n'est appelée que par `vmaDesSeances`", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const appels = execSync("grep -rln 'effortDesSeances(' src || true", { encoding: "utf8" }).split("\n").filter(Boolean);
    assert.deepEqual(appels, ["src/lib/dashboard/vmaAffichee.ts"], `effortDesSeances appelée ailleurs (VMA sans estimation) : ${appels.join(", ")}`);
  });

  await test("une seule définition de chaque : coach, montre, écrans", () => {
    const coach = code("src/lib/ai/coachContext.ts"), montre = code("src/lib/coach/ciblesFcServeur.ts");
    assert.doesNotMatch(montre, /TYPE_DUR|\/interval\|vma\|tempo/, "la montre garde son propre filtre « séance dure »");
    assert.match(coach, /const isHardType = \(t\?: string \| null\) => estTypeDur\(t\);/, "le coach garde son propre filtre « séance dure »");
    assert.match(coach, /objectifSeul \? nonLu\(\) : lireFootingsFc\(sb, userId, now\)/, "le coach ne lit plus les footings comme la montre");
    assert.match(montre, /lireFootingsFc\(sb, userId, maintenant\)/, "la montre ne lit plus les footings par la lecture commune");
    assert.match(coach, /const fcFootings = fcDesFootings\(/, "le coach ne filtre plus ses footings comme la montre");
    assert.doesNotMatch(coach, /function estimateVmaFromRuns/, "le coach garde sa propre estimation de VMA");
    assert.match(coach, /fromRuns: objectifSeul \? null : vmaDesSeances\(seancesVma as never, fcMaxEst, now\)\?\.vma \?\? null,/, "la VMA du coach ne passe plus par vmaDesSeances");
    assert.match(coach, /const seances = vmaDesSeances\(\(woRes\.data \?\? \[\]\) as never, await fcMaxDeLAthlete\(sb, userId\)\);/, "getEffectiveVma ne passe plus par vmaDesSeances");
    assert.match(code("src/components/dashboard/BentoDashboard.tsx"), /sourceVma\.type === "estimee" \? t\("dash\.vma\.src\.estimee"\)/, "le tableau de bord ne dit pas que la VMA est estimée");
    assert.match(code("src/lib/indicateurs/fiches.ts"), /src\?\.type === "estimee" \? t\.srcEstimee/, "la fiche vitesse ne dit pas que la VMA est estimée");
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
