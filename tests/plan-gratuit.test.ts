/**
 * LE PLAN GRATUIT — L'OBJECTIF SEUL, AUCUNE MESURE (Cyprien, 22/10/2026).
 *
 * « Dans l'abonnement gratuit, les utilisateurs n'ont accès qu'au plan d'entraînement
 * gratuit, ou alors ils mettent leur prochaine course ou un objectif de temps ou de
 * distance, et l'IA donne les séances selon ces objectifs — mais en aucun cas le coach
 * n'analyse leurs séances, leur sommeil, leurs caractéristiques physiques et
 * physiologiques. »
 *
 * Avant, le gratuit recevait un aperçu de DEUX jours tiré de TOUTES ses mesures : il
 * profitait de l'analyse du sommeil et de la VFC que la page réserve aux formules
 * payantes. Ces tests figent l'inverse, de bout en bout, sans base ni réseau :
 *  · les lectures interdites ne sont PAS FAITES (le faux client refuse de les servir) ;
 *  · deux athlètes que tout sépare sauf l'objectif et le déclaré reçoivent le MÊME plan ;
 *  · et, contre-épreuve, le plan payant, lui, les distingue bien.
 *
 *   npx tsx tests/plan-gratuit.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, PROFIL_DECLARE } from "../src/lib/ai/coachContext";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { peut } from "../src/lib/billing/access";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/**
 * Un faux client Supabase qui NOTE ce qu'on lui demande : chaque `select` est consigné,
 * pour vérifier quelles colonnes ont été lues.
 *
 * ⚠️ IL APPLIQUE LES `eq` SUR LES COLONNES QUE LA LIGNE PORTE. Sans ça, `notifications`
 * rendait la même ligne de ressenti à la requête de l'OBJECTIF, des douleurs et des
 * séances prescrites : un « objectif » fantôme apparaissait chez un seul des deux
 * athlètes, et le test accusait le plan gratuit d'une différence que la base réelle ne
 * produirait jamais.
 */
function fauxClient(tables: Record<string, unknown[]>) {
  const lus: { table: string; colonnes: string }[] = [];
  const requete = (table: string, toutes: unknown[]) => {
    const filtres: [string, unknown][] = [];
    let colonnes: string[] | null = null;
    // ⚠️ ET IL NE REND QUE LES COLONNES DEMANDÉES, comme PostgREST. Rendre la ligne entière
    // aurait servi la FC et la charge au plan gratuit qui ne les demande pas — et le test
    // aurait accusé le moteur d'une lecture que la base réelle ne fait jamais.
    const projeter = (l: Record<string, unknown>) =>
      colonnes ? Object.fromEntries(colonnes.filter((c) => c in l).map((c) => [c, l[c]])) : l;
    const lignes = () => toutes
      .filter((l) => filtres.every(([c, v]) => !(c in (l as object)) || (l as Record<string, unknown>)[c] === v))
      .map((l) => projeter(l as Record<string, unknown>));
    const q: Record<string, unknown> = {};
    for (const m of ["gte", "lte", "lt", "gt", "not", "in", "or", "order", "limit", "neq", "is"]) q[m] = () => q;
    q.eq = (c: string, v: unknown) => { filtres.push([c, v]); return q; };
    q.select = (c = "*") => {
      lus.push({ table, colonnes: String(c) });
      colonnes = String(c).trim() === "*" ? null : String(c).split(",").map((x) => x.trim()).filter(Boolean);
      return q;
    };
    q.single = () => { const l = lignes(); return Promise.resolve({ data: l[0] ?? null, error: l[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: lignes()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: lignes(), error: null, count: lignes().length }).then(ok, ko);
    return q;
  };
  return { client: { from: (t: string) => requete(t, tables[t] ?? []) } as never, lus };
}

// Le jour du COACH (Paris), pas celui d'UTC : les fenêtres du moteur comptent en jours
// civils à partir d'aujourd'hui, une date figée sortirait de toutes ses fenêtres.
const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
const ilYa = (n: number) => {
  const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
};

// ⚠️ PAS DE `last_lat` : aucune requête météo, le test ne touche pas le réseau.
const DECLARE = {
  id: "u", preferred_language: "fr", full_name: "Test", age: 32,
  days_per_week: 5, available_days: [1, 2, 3, 4, 6], target_weekly_km: 60,
  health_conditions: [], injury_zones: [], health_declared: true,
};
/** Ce que la montre et la balance ont mesuré — tout ce que le gratuit ne doit PAS lire. */
const MESURE_A = { garmin_vo2max: 62, resting_hr: 42, max_hr: 198, weight_kg: 64, height_cm: 178, gender: "male", pace_curve: { best: [{ m: 5000, sec: 1080 }] } };
const MESURE_B = { garmin_vo2max: 38, resting_hr: 71, max_hr: 171, weight_kg: 96, height_cm: 170, gender: "female", pace_curve: { best: [{ m: 5000, sec: 1800 }] } };

/** 24 sorties, un jour sur deux : le MÊME volume pour les deux athlètes. */
const sorties = (fc: number, tss: number) => Array.from({ length: 24 }, (_, i) => ({
  date: ilYa(i * 2 + 1), type: "easy", sport: "run", distance_km: 10 + (i % 3) * 2, duration_seconds: 3300 + (i % 3) * 600,
  elevation_gain_m: 60, avg_hr: fc, max_hr: fc + 25, tss, hr_zone_seconds: [600, 2400, 200, 0, 0], cardiac_decoupling: fc > 160 ? 11 : 2,
}));
/** A : reposé. B : VFC effondrée, nuits courtes, séances lourdes et ressenties dures. */
const FRAIS = {
  hrv_data: Array.from({ length: 20 }, (_, i) => ({ date: ilYa(i), rmssd: 92 + (i % 3), sdnn: null })),
  sleep_data: Array.from({ length: 20 }, (_, i) => ({ date: ilYa(i), total_sleep_min: 480, sleep_score: 88 })),
  workouts: sorties(138, 50),
  notifications: [] as unknown[],
};
const EPUISE = {
  hrv_data: Array.from({ length: 20 }, (_, i) => ({ date: ilYa(i), rmssd: i < 4 ? 41 : 92 + (i % 3), sdnn: null })),
  sleep_data: Array.from({ length: 20 }, (_, i) => ({ date: ilYa(i), total_sleep_min: i < 4 ? 250 : 470, sleep_score: i < 4 ? 35 : 80 })),
  workouts: sorties(171, 140),
  notifications: [{ type: "session_feedback", data: { rpe: 9, note: "jambes lourdes, épuisé", pain: [] } }] as unknown[],
};
const BASE = [{ vma_kmh: 16, max_hr: 199, resting_hr: 44, lt_hr: 176, tested_at: ilYa(20) }];

async function contexte(mesures: typeof FRAIS, profilMesure: Record<string, unknown>, objectifSeul: boolean) {
  const { client, lus } = fauxClient({
    profiles: [{ ...DECLARE, ...profilMesure }],
    performance_baselines: BASE,
    ...mesures,
  });
  const ctx = await buildAthleteContext(client, "u", { objectifSeul });
  return { ctx, lus };
}
/** Le plan tel que l'athlète le lit : type, titre, détail, pour chaque jour. */
const empreinte = (ctx: Awaited<ReturnType<typeof contexte>>["ctx"]) =>
  buildWeekPlan(ctx).map((d) => `${d.date} ${d.type} | ${d.title} | ${d.detail}`).join("\n");

async function main() {
  console.log("\nLES DROITS");

  await test("le gratuit a le plan de l'objectif, pas le plan adaptatif", () => {
    assert.equal(peut("gratuit", "plan_objectif"), true, "le gratuit n'a plus de plan du tout");
    assert.equal(peut("gratuit", "plan"), false, "le gratuit reçoit le plan qui lit ses mesures");
    for (const e of ["starter", "premium", "essai"] as const) assert.equal(peut(e, "plan"), true, `${e} : plan adaptatif fermé`);
  });

  console.log("\nCE QUI EST LU");

  await test("aucune lecture de sommeil, de VFC, de chaussures ni de pesées n'est FAITE", async () => {
    const { lus } = await contexte(EPUISE, MESURE_B, true);
    const tables = new Set(lus.map((l) => l.table));
    for (const t of ["hrv_data", "sleep_data", "shoes", "weight_logs"]) {
      assert.ok(!tables.has(t), `le plan gratuit lit encore « ${t} »`);
    }
    // Contre-épreuve : le plan payant, lui, les lit bien — sinon le test ne prouve rien.
    const payant = new Set((await contexte(EPUISE, MESURE_B, false)).lus.map((l) => l.table));
    for (const t of ["hrv_data", "sleep_data"]) assert.ok(payant.has(t), `le plan payant ne lit plus « ${t} »`);
  });

  await test("des séances, le gratuit ne lit que le volume — aucune colonne du corps", async () => {
    const { lus } = await contexte(EPUISE, MESURE_B, true);
    const seances = lus.filter((l) => l.table === "workouts").map((l) => l.colonnes).join(",");
    assert.ok(seances.includes("distance_km"), "le volume n'est plus lu : le plan ne sait plus ce que l'athlète court");
    for (const c of ["avg_hr", "max_hr", "tss", "hr_zone_seconds", "cardiac_decoupling", "avg_power_watts", "avg_cadence_spm", "gap_min_km", "weather_temp_c"]) {
      assert.ok(!seances.includes(c), `le plan gratuit lit « ${c} » dans les séances`);
    }
  });

  await test("le profil gratuit est une LISTE BLANCHE de champs déclarés", () => {
    for (const c of ["garmin_vo2max", "garmin_metrics", "pace_curve", "resting_hr", "max_hr", "weight_kg", "height_cm", "gender", "last_lat", "last_lon", "last_quality_exec", "sleep_score", "is_female_cycle_sync"]) {
      assert.ok(!(PROFIL_DECLARE as readonly string[]).includes(c), `« ${c} » est une mesure, pas une déclaration`);
    }
    for (const c of ["days_per_week", "available_days", "injury_zones", "health_conditions"]) {
      assert.ok((PROFIL_DECLARE as readonly string[]).includes(c), `« ${c} » est déclaré et protège l'athlète : il doit rester lu`);
    }
  });

  console.log("\nCE QUI EN SORT");

  await test("deux athlètes que tout sépare sauf l'objectif et le déclaré : le MÊME plan gratuit", async () => {
    const ctxA = (await contexte(FRAIS, MESURE_A, true)).ctx;
    const ctxB = (await contexte(EPUISE, MESURE_B, true)).ctx;
    // Le VERDICT du jour et ses motifs aussi : un ressenti « 9/10 » qui passe en orange ne
    // change pas forcément la séance, mais il s'affiche sur le calendrier — c'est déjà
    // une analyse de séance que le gratuit ne fait pas.
    assert.equal(ctxB.readiness.level, ctxA.readiness.level, "le verdict du jour du gratuit dépend encore des mesures ou du ressenti");
    assert.deepEqual(ctxB.readiness.reasons, ctxA.readiness.reasons, "les motifs du verdict gratuit citent des mesures ou le ressenti");
    const a = empreinte(ctxA);
    const b = empreinte(ctxB);
    // Sept JOURS, pas sept lignes : un jour peut porter deux séances (renfo du soir).
    assert.equal(new Set(a.split("\n").map((l) => l.slice(0, 10))).size, 7, "le plan gratuit ne couvre plus sept jours");
    assert.equal(b, a, "le plan gratuit dépend encore du sommeil, de la VFC, de la FC ou du ressenti");
  });

  await test("contre-épreuve : le plan PAYANT, lui, ne traite pas ces deux athlètes pareil", async () => {
    const a = empreinte((await contexte(FRAIS, MESURE_A, false)).ctx);
    const b = empreinte((await contexte(EPUISE, MESURE_B, false)).ctx);
    assert.notEqual(b, a, "les jeux de données ne séparent pas les deux athlètes : le test précédent ne prouverait rien");
  });

  await test("la VMA du gratuit est celle du TEST, jamais une estimation tirée des mesures", async () => {
    const sansTest = async (objectifSeul: boolean) => {
      const { client } = fauxClient({ profiles: [{ ...DECLARE, ...MESURE_A }], performance_baselines: [], ...FRAIS });
      return (await buildAthleteContext(client, "u", { objectifSeul })).vma;
    };
    assert.equal(await sansTest(true), null, "le gratuit estime une VMA depuis la montre au lieu d'attendre le test");
    assert.ok((await sansTest(false)) != null, "contre-épreuve : le payant n'estime plus de VMA sans test");
    assert.equal((await contexte(EPUISE, MESURE_B, true)).ctx.vma, 16, "la VMA du test n'atteint plus le plan gratuit");
  });

  await test("« ce que ta dernière séance a montré » n'existe pas pour le gratuit", async () => {
    assert.equal((await contexte(EPUISE, MESURE_B, true)).ctx.lastSession, null, "le gratuit reçoit une analyse de séance");
    assert.ok((await contexte(EPUISE, MESURE_B, false)).ctx.lastSession, "contre-épreuve : le payant ne la reçoit plus");
  });

  console.log("\nLE BRANCHEMENT");

  await test("le coach autonome construit le gratuit en objectif seul, sans montre ni e-mail ni modèle", () => {
    const src = codeNu("src/lib/ai/autoCoach.ts");
    assert.match(src, /const objectifSeul = !planComplet && profilPeut\(acces, "plan_objectif"\);/);
    assert.match(src, /buildAthleteContext\([^;]*\{ objectifSeul \}\)/, "le contexte n'est plus construit en objectif seul");
    assert.match(src, /if \(athleteId && apiKey && planComplet\)/, "le plan gratuit part sur la montre");
    assert.match(src, /if \(opts\.notify && planComplet\)/, "le plan gratuit déclenche l'e-mail qui analyse la séance");
    assert.match(src, /const coachAvance = planComplet && /, "le plan gratuit est relu par un modèle");
    // Le gratuit reçoit SEPT jours : plus de troncature à un aperçu.
    assert.doesNotMatch(src, /\.slice\(0, JOURS_APERCU\)/, "le plan gratuit est de nouveau tronqué");
  });

  console.log("\nLA CARTE ET LE KINÉ");

  await test("la carte est ouverte à tous ; seul l'export GPX suit la formule, fermé par défaut", () => {
    // « l'export GPX dans les abonnements payants, mais pas la map en général et l'accès
    // à tous les parcours » (Cyprien, 22/10/2026). Avant, le gratuit voyait une porte
    // fermée À LA PLACE du constructeur de boucles.
    const page = codeNu("src/app/dashboard/trail/page.tsx");
    assert.doesNotMatch(page, /PorteFermee|return \(\s*<div[^]*?return \(/, "la carte a de nouveau deux rendus selon la formule");
    assert.match(page, /const exportGpx = profilPeut\([^)]*"gpx"\)/, "le droit d'export n'est plus lu côté serveur");
    assert.match(page, /<TrailModes[^>]*exportGpx=\{exportGpx\}/, "le constructeur ne reçoit plus le droit d'export");
    assert.match(page, /<ParcoursBrowser[^>]*exportGpx=\{exportGpx\}/, "le catalogue de parcours ne reçoit plus le droit d'export");
    // Un appelant qui OUBLIE la propriété doit fermer le bouton, pas l'offrir.
    assert.match(codeNu("src/components/trail/TrailBuilder.tsx"), /exportGpx = false/, "le constructeur exporte par défaut");
    assert.match(codeNu("src/components/parcours/ParcoursBrowser.tsx"), /exportGpx = false/, "le catalogue exporte par défaut");
    assert.match(codeNu("src/components/trail/TrailBuilder.tsx"), /if \(!exportGpx\) return;/, "le gestionnaire d'export ne vérifie plus le droit");
    assert.match(codeNu("src/components/parcours/ParcoursBrowser.tsx"), /if \(dl \|\| !exportGpx\) return;/, "le téléchargement de parcours ne vérifie plus le droit");
  });

  await test("un compte gratuit qui écrit au kiné voit une sortie, pas « essai_expire »", () => {
    const hc = codeNu("src/components/health/HealthCenter.tsx");
    // Le statut se lit AVANT le corps : un 402 ne doit jamais finir dans la conversation.
    assert.ok(hc.indexOf("res.status === 402") > 0 && hc.indexOf("res.status === 402") < hc.indexOf("await res.json()"),
      "le refus de formule n'est plus intercepté avant d'être affiché tel quel");
    assert.match(hc, /json\.error === "quota_ia_atteint" \? tr\("chat\.quota"\)/, "le plafond du jour s'affiche de nouveau en code brut");
    const brut = readFileSync("src/components/health/HealthCenter.tsx", "utf8");
    for (const cle of ["chat.verrou", "chat.verrouCta", "chat.quota"]) {
      assert.equal((brut.match(new RegExp(`"${cle.replace(".", "\\.")}":`, "g")) ?? []).length, 5, `« ${cle} » manque à une langue`);
    }
  });
}

main().then(() => {
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
});
