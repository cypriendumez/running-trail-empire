/**
 * LE CADRE DE SANTÉ : LE DOSSIER DE L'IA DIT CE QUE LE PLAN FAIT (refonte du 20/11/2026).
 *
 * Cinq tours de relecture ont chacun trouvé de nouvelles lignes du dossier de l'IA (`ctx.text`) qui
 * poussaient un coureur exempté vers l'intensité, et un en-tête « prime sur tout » autorisait l'endurance
 * à qui attend l'avis d'un médecin, alors que son plan lui retire toute séance (@HeadCoach, tour 6). Le
 * test d'alors cherchait une liste de mots connus et ignorait toute ligne portant « ⛔ » ou « cadre de
 * santé » : une famille de lignes nouvelle lui échappait.
 *
 * Désormais (lib/coach/cadreSante, lib/ai/coachContext `textCadre`), un coureur sous cadre reçoit un AUTRE
 * dossier, en liste blanche. Ce test le prouve STRUCTURELLEMENT, pour chaque situation (avis médical attendu,
 * marche-course, cardiaque, covid long, grossesse, consignes du kiné, combinaisons) et des données qui
 * déclenchent tout (objectif ambitieux, affûtage, marathon, course B et C de la semaine, seuil mesuré,
 * dernière série accélérée, dérive, cadence, cycle, perte de poids, terrains, monotonie, plateau…) :
 *  · le cadre écrit en tête est exactement celui que le plan applique, confronté au PLAN produit pour la même
 *    situation (aucune séance, aucune séance intense, au plus une sous le seuil, durée maximale, course
 *    retirée, absente, à effort contrôlé ou avec l'accord du kiné, à la sensation) ;
 *  · aucune section du dossier ordinaire n'y figure (palette, capacités, analyse…) ;
 *  · tout le texte est passé au crible d'un vocabulaire d'intensité LARGE, sans exemption sur un marqueur :
 *    seules sont retirées des phrases EXACTES (les lignes du cadre, les motifs des modules, la séance sous le
 *    seuil que le plan pose) et la ligne de données « 5 dernières séances » ;
 *  · un témoin ordinaire, avec les mêmes données, a son dossier habituel — et ce vocabulaire.
 *
 *   npx tsx tests/cadre-sante.test.ts
 */
process.env.TZ = "UTC";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { cadreDeSante, lignesCadre, CADRE_FR, type CadreSante } from "../src/lib/coach/cadreSante";
import { missionSeanceDuJour } from "../src/lib/ai/missionSeance";
import { EFFORT_MAX_T, MALAISE_T } from "../src/lib/health/effortMaximal";
import { APTITUDE_T } from "../src/lib/health/aptitude";
import { HEALTH_CONDITIONS, INJURY_ZONES, healthCoachLines } from "../src/data/healthCatalog";
import { weightCoachBlock } from "../src/lib/weight/coaching";
import { buildWeightPlan } from "../src/lib/weight/energy";
import { dureeSeance } from "../src/lib/coach/consignesPlan";
import { MOTIF_T } from "../src/lib/coach/reasonsI18n";
import { nRaw } from "../src/lib/i18n/multi";
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
/** Faux client PostgREST (lectures) : eq, gte, lte, gt, lt, in, order, limit, single, maybeSingle. */
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
      if (tri) { const [c, asc] = tri; r = [...r].sort((a, b) => (Number(a[c]) - Number(b[c]) || (String(a[c] ?? "") < String(b[c] ?? "") ? -1 : String(a[c] ?? "") > String(b[c] ?? "") ? 1 : 0)) * (asc ? 1 : -1)); }
      return lim != null ? r.slice(0, lim) : r;
    };
    q.single = () => { const r = fin(); return Promise.resolve({ data: r[0] ?? null, error: r[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: fin()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: fin(), error: null }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(tables[t] ?? []) } as never;
}

// Le jour du coureur : le plan se construit pour lui, et chaque date de fixture en dérive.
const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
/** `ilYa(5)` = il y a cinq jours ; `ilYa(-15)` = dans quinze jours. */
const ilYa = (n: number) => { const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/** Un profil qui déclenche tout : passif, terrains, dénivelé, cycle suivi, perte de poids (obésité de classe 1),
 *  vitesse critique mesurée, dernière série accélérée. */
const profil = (o: Ligne = {}) => ({ id: "u", preferred_language: "fr", full_name: "Camille", age: 32, gender: "female", weight_kg: 85, height_cm: 165,
  max_hr: 188, resting_hr: 50, days_per_week: 5, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true,
  running_years: 10, main_terrains: ["piste", "montagne", "tapis", "plat"], elevation_pref: "specialiste", is_female_cycle_sync: true, current_phase: "folliculaire",
  weight_mode_enabled: true, pace_curve: { criticalSpeed: 4.0 }, garmin_metrics: null, garmin_vo2max: null, last_lat: null, last_lon: null,
  last_quality_exec: { date: ilYa(3), repsSec: [250, 248, 245, 240], avgHr: 165, fadeSec: -10 }, ...o });
/** Des footings tous les trois jours : cadence basse, dérive faible, tout le temps en Z1-Z2. */
const footing = (n: number, o: Ligne = {}) => ({ user_id: "u", date: ilYa(n), type: "easy", sport: "run", distance_km: 8, duration_seconds: 2700,
  avg_hr: 124, max_hr: 140, tss: 40, avg_cadence_spm: 160, cardiac_decoupling: 2, hr_zone_seconds: [1500, 1200, 0, 0, 0], ...o });
const FOOTINGS = [3, 6, 9, 12, 15, 18, 21, 24].map((n) => footing(n));
const objectif = (km: number, dans: number) => ({ user_id: "u", type: "race_objective", created_at: `${ilYa(20)}T10:00:00Z`,
  data: { race: `Course du parc ${km} km`, raceDate: ilYa(-dans), distanceKm: km, targetTime: "36:00", targetSeconds: 2160, targetPace: "3'36/km" } });
const planifiee = (name: string, dans: number, distanceKm: number, priorite: "B" | "C") => ({ user_id: "u", type: "planned_race",
  created_at: `${AUJOURDHUI}T10:00:00Z`, data: { name, date: ilYa(-dans), distanceKm, priorite } });
const aptitude = { user_id: "u", type: "aptitude", created_at: `${ilYa(10)}T10:00:00Z`, data: { oui: ["poitrine"], date: ilYa(10), avisMedecin: null } };
const kine = (o: Ligne) => ({ user_id: "u", type: "consignes_kine", created_at: `${ilYa(5)}T10:00:00Z`,
  data: { dureeMaxMin: null, sansIntensite: false, seancesMaxSemaine: null, jusquAu: ilYa(-40), majA: ilYa(5), ...o } });

type Situation = { profil?: Ligne; notifications?: Ligne[]; seances?: Ligne[] };
async function contexte(s: Situation): Promise<AthleteContext> {
  return buildAthleteContext(fauxClient({ profiles: [profil(s.profil)], performance_baselines: [], workouts: s.seances ?? FOOTINGS,
    notifications: s.notifications ?? [] }), "u");
}
const plan = (ctx: AthleteContext) => buildWeekPlan(ctx, new Date(`${AUJOURDHUI}T12:00:00Z`));

// Les données : chaque scénario déclenche des lignes que le dossier ORDINAIRE pousse vers l'intensité.
const quotidiens = [0, 1, 2, 4, 5].map((n) => footing(n, { cardiac_decoupling: null, hr_zone_seconds: null }));
const plate = [35, 20, 2].map((n, i) => ({ at: `${ilYa(n)}T10:00:00Z`, vma: 14 + i * 0.01 }));
const SCENARIOS: [string, Situation][] = [
  ["10 km à J+30, chrono très ambitieux", { notifications: [objectif(10, 30)] }],
  ["marathon à J+30", { notifications: [objectif(42.2, 30)] }],
  ["10 km à J+5 (affûtage)", { notifications: [objectif(10, 5)] }],
  ["course C dans 3 jours, marathon à J+70", { notifications: [objectif(42.2, 70), planifiee("Foulées du canal", 3, 10, "C")] }],
  ["course B dans 4 jours, marathon à J+70", { notifications: [objectif(42.2, 70), planifiee("Corrida du port", 4, 10, "B")] }],
  ["sans aucune séance", { seances: [] }],
  ["charge monotone, VMA en plateau, 45 ans, dérive forte, sans suivi du cycle",
    { profil: { age: 45, is_female_cycle_sync: false, pace_curve: { criticalSpeed: 4.0, history: plate } }, seances: [...FOOTINGS.map((w) => ({ ...w, cardiac_decoupling: 9 })), ...quotidiens] }],
  ["footings courus trop vite", { seances: FOOTINGS.map((w) => ({ ...w, hr_zone_seconds: [600, 900, 900, 300, 0] })) }],
  // Deux signaux orange (charge identique chaque jour depuis deux mois, dernier ressenti à 9/10), aucun rouge.
  ["verdict orange", { seances: Array.from({ length: 60 }, (_, n) => footing(n, { cardiac_decoupling: null, hr_zone_seconds: null })),
    notifications: [{ user_id: "u", type: "session_feedback", created_at: `${ilYa(1)}T18:00:00Z`, data: { rpe: 9, date: ilYa(1) } }] }],
];
type Cas = { nom: string; s: Situation; niveau: CadreSante["niveau"] };
const EXEMPTES: Cas[] = [
  { nom: "avis d'un médecin attendu", s: { notifications: [aptitude] }, niveau: "sansSeance" },
  { nom: "programme marche-course", s: { profil: { peut_courir_30min: false } }, niveau: "sansIntensite" },
  { nom: "antécédent cardiaque", s: { profil: { health_conditions: ["cardiaque"] } }, niveau: "seuilBas" },
  { nom: "covid long", s: { profil: { health_conditions: ["covid_long"] } }, niveau: "sansIntensite" },
  { nom: "grossesse", s: { profil: { health_conditions: ["grossesse"] } }, niveau: "seuilBas" },
  { nom: "consignes du kiné « sans intensité »", s: { notifications: [kine({ sansIntensite: true })] }, niveau: "sansIntensite" },
  { nom: "consignes du kiné « 40 min au plus »", s: { notifications: [kine({ dureeMaxMin: 40 })] }, niveau: "sansIntensite" },
  { nom: "antécédent cardiaque + kiné « 2 sorties au plus »", s: { profil: { health_conditions: ["cardiaque"] }, notifications: [kine({ seancesMaxSemaine: 2 })] }, niveau: "seuilBas" },
];
const fusion = (a: Situation, b: Situation): Situation => ({ profil: { ...(a.profil ?? {}), ...(b.profil ?? {}) },
  notifications: [...(a.notifications ?? []), ...(b.notifications ?? [])], seances: b.seances ?? a.seances });

/** Le vocabulaire d'intensité, LARGE : ce qu'aucune ligne d'un exempté ne doit écrire hors des phrases exactes permises. */
const INTENSITE = /VMA|seuil|tempo|fractionn|\bcôtes?\b|lignes? droites?|sprint|accélér|\bZ[3-5]\b|zone [3-5]|allure (?:spécifique|de course|cible|marathon)|chrono|qualité|intensit|séances? dures?|durcir|explosi|pliométr|\btests?\b|effort maximal|record|polaris|80\/20|densit|stimulus|affûtage|VO2|fartlek|négatif split|à fond|exigeant|sous-dos|potentiel perdu/i;
/** Les sections du dossier ORDINAIRE : aucune n'existe dans celui d'un exempté. */
const SECTIONS_ORDINAIRES = ["VERDICT DE FRAÎCHEUR DU JOUR", "PALETTE DE SÉANCES", "CAPACITÉS (tests)", "ANALYSE APPROFONDIE", "ÂGE & RÉCUPÉRATION",
  "PASSIF, TERRAIN & DÉNIVELÉ", "STRUCTURE CIBLE DE LA SEMAINE", "GARDE-FOUS ANTI-BLESSURE", "EXÉCUTION & ADHÉRENCE", "PENTE RÉELLE"];
const NON_COURUS = new Set(["Repos", "Renfo", "Mobilité"]);
const INTENSES = new Set(["VMA", "Seuil", "Spécifique", "Côtes", "Tempo", "Fartlek", "Qualité"]);
const ALLURE = /\d{1,2}['’]\d{2}/;

/** Le texte d'un exempté, sans les phrases EXACTES qui ont le droit de nommer l'intensité pour l'interdire. */
function sansPermis(text: string, ctx: AthleteContext): string {
  const cadre = ctx.cadreSante!;
  let t = text;
  const permis = [
    ...lignesCadre(cadre).map((l) => `- ${l}`),
    EFFORT_MAX_T.fr.motif(true), EFFORT_MAX_T.fr.motif(false), MALAISE_T.fr.motif, APTITUDE_T.fr.motif,
    ...(cadre.marcheCourse ? [MOTIF_T.fr.marcheCourse(nRaw(cadre.marcheCourse.etape, "fr"), nRaw(cadre.marcheCourse.total, "fr"))] : []),
    "• Au plus une séance sous le seuil cette semaine, en blocs longs, à la sensation.",
    "• Aucune séance sous le seuil ce cycle.",
    // La séance sous le seuil est CELLE du plan (budget de qualité), vérifiée par ailleurs.
    ...(ctx.weekPlan.quality[0] ? [`• Au plus une séance sous le seuil cette semaine : ${ctx.weekPlan.quality[0].desc}`] : []),
  ];
  for (const p of permis) t = t.split(p).join("");
  // La ligne de DONNÉES des séances passées (leur étiquette dit ce qu'elles ont été, pas ce qu'il faut faire).
  return t.split("\n").filter((l) => !l.startsWith("- 5 dernières séances : ")).join("\n");
}

async function main() {
  console.log("\nLE CADRE DE SANTÉ : LE DOSSIER DE L'IA DIT CE QUE LE PLAN FAIT");

  await test("cadreDeSante : le plus strict l'emporte ; des consignes qui ne bornent que le nombre de sorties ne font pas de cadre", () => {
    const k = (o: Partial<{ sansIntensite: boolean; dureeMaxMin: number | null; seancesMaxSemaine: number | null }>) =>
      ({ sansIntensite: false, dureeMaxMin: null, seancesMaxSemaine: null, jusquAu: "2026-12-31", majA: "2026-11-10", ...o });
    const c = (o: Partial<Parameters<typeof cadreDeSante>[0]>) => cadreDeSante({ avisMedical: false, marcheCourse: null, consignes: null, conditions: [], ...o });
    assert.equal(c({}), null);
    assert.equal(c({ consignes: k({ seancesMaxSemaine: 2 }) }), null, "le nombre de sorties seul fait un cadre");
    assert.equal(c({ avisMedical: true, conditions: ["cardiaque"], consignes: k({ sansIntensite: true }) })?.niveau, "sansSeance");
    assert.equal(c({ marcheCourse: { etape: 2, total: 11 }, conditions: ["cardiaque"] })?.niveau, "sansIntensite");
    assert.equal(c({ conditions: ["cardiaque"], consignes: k({ dureeMaxMin: 40 }) })?.niveau, "sansIntensite");
    assert.equal(c({ conditions: ["covid_long"] })?.niveau, "sansIntensite");
    assert.equal(c({ consignes: k({ sansIntensite: true }) })?.niveau, "sansIntensite");
    assert.equal(c({ conditions: ["grossesse"] })?.niveau, "seuilBas");
    assert.equal(c({ conditions: ["grossesse"] })?.sensation, true);
    assert.equal(c({ conditions: ["cardiaque"], consignes: k({ seancesMaxSemaine: 2 }) })?.niveau, "seuilBas");
    assert.equal(c({ conditions: ["asthme"] }), null, "un antécédent sans limite d'intensité fait un cadre");
  });

  await test("lignesCadre : chaque situation dit ce que son plan fait de la course (retirée, absente, à effort contrôlé, avec l'accord du kiné)", () => {
    const k = { sansIntensite: false, dureeMaxMin: 40, seancesMaxSemaine: 2, jusquAu: "2026-12-31", majA: "2026-11-10" };
    const l = (o: Partial<Parameters<typeof cadreDeSante>[0]>) => lignesCadre(cadreDeSante({ avisMedical: false, marcheCourse: null, consignes: null, conditions: [], ...o })!);
    const apt = l({ avisMedical: true, consignes: k, conditions: ["grossesse"] });
    assert.deepEqual(apt, [CADRE_FR.sansSeance, CADRE_FR.courseRetiree, CADRE_FR.limite], "avis médical attendu : rien d'autre que l'absence de séance");
    assert.deepEqual(l({ marcheCourse: { etape: 3, total: 11 } }), [CADRE_FR.sansIntensite, CADRE_FR.marcheCourse(3, 11), CADRE_FR.courseMarcheCourse, CADRE_FR.limite]);
    assert.deepEqual(l({ conditions: ["grossesse"], consignes: k }),
      [CADRE_FR.sansIntensite, CADRE_FR.sensation, CADRE_FR.dureeMax(40, "2026-12-31"), CADRE_FR.seancesMax(2, "2026-12-31"), CADRE_FR.courseControle, CADRE_FR.courseKine("2026-12-31"), CADRE_FR.limite]);
    assert.deepEqual(l({ conditions: ["cardiaque"] }), [CADRE_FR.seuilBas, CADRE_FR.courseControle, CADRE_FR.limite]);
    assert.match(CADRE_FR.dureeMax(40, "2026-12-31"), /40 min au plus.*jusqu'au 31\/12/);
  });

  await test("TÉMOIN — coureur ordinaire, mêmes données : aucun cadre, son dossier habituel, ses sections et le vocabulaire d'intensité", async () => {
    for (const [quand, s] of SCENARIOS) {
      const ctx = await contexte(s);
      assert.equal(ctx.cadreSante, null, `${quand} : un cadre pour un coureur ordinaire`);
      assert.match(ctx.text, /^PROFIL\n/, `${quand} : le dossier ordinaire ne commence plus par son profil`);
      assert.ok(!ctx.text.includes(CADRE_FR.titre), `${quand} : le témoin reçoit l'en-tête du cadre`);
      for (const sec of SECTIONS_ORDINAIRES.filter((x) => x !== "PENTE RÉELLE")) assert.ok(ctx.text.includes(sec), `${quand} : précondition, le témoin n'a pas la section « ${sec} »`);
      assert.match(ctx.text, INTENSITE, `${quand} : précondition, le crible ne voit rien dans le dossier du témoin`);
      if (quand === "verdict orange") assert.ok(ctx.text.includes("🟠 ORANGE — Séance allégée : garde la qualité SI"), "précondition : le scénario orange n'est pas orange");
    }
  });

  await test("consignes du kiné qui ne bornent QUE le nombre de sorties : dossier ordinaire (l'intensité reste permise par le plan)", async () => {
    const ctx = await contexte({ notifications: [objectif(10, 30), kine({ seancesMaxSemaine: 3 })] });
    assert.equal(ctx.cadreSante, null);
    assert.match(ctx.text, /^PROFIL\n/);
    assert.ok(plan(ctx).some((d) => INTENSES.has(d.type)), "précondition : le plan pose encore une séance intense");
  });

  for (const cas of EXEMPTES) {
    await test(`${cas.nom} : le cadre écrit est celui que le plan applique, aucune section ordinaire, aucun mot d'intensité hors des phrases permises — dans ${SCENARIOS.length} situations`, async () => {
      for (const [quand, s] of SCENARIOS) {
        const ctx = await contexte(fusion(s, cas.s));
        const cadre = ctx.cadreSante;
        assert.ok(cadre, `${quand} : aucun cadre`);
        assert.equal(cadre!.niveau, cas.niveau, `${quand} : niveau`);
        const text = ctx.text;
        // 1. L'en-tête : exactement les lignes du cadre, puis le profil.
        assert.ok(text.startsWith(`${CADRE_FR.titre}\n${lignesCadre(cadre!).map((l) => `- ${l}`).join("\n")}\n\nPROFIL\n`), `${quand} : l'en-tête n'est pas le cadre (« ${text.slice(0, 300)} »)`);
        // 2. Aucune section du dossier ordinaire.
        for (const sec of SECTIONS_ORDINAIRES) assert.ok(!text.includes(sec), `${quand} : la section ordinaire « ${sec} » est dans le dossier`);
        // 3. Le crible, sans exemption sur un marqueur.
        const reste = sansPermis(text, ctx);
        const vu = reste.split("\n").filter((l) => INTENSITE.test(l));
        assert.deepEqual(vu.map((l) => l.slice(0, 160)), [], `${quand} : vocabulaire d'intensité hors des phrases permises : ${vu.map((l) => `« ${l.slice(0, 200)} » [${l.match(INTENSITE)?.[0]}]`).join(" | ")}`);
        // 4. Le PLAN de la même situation.
        const p = plan(ctx);
        const courus = p.filter((d) => !NON_COURUS.has(d.type));
        const intenses = p.filter((d) => INTENSES.has(d.type));
        const courses = p.filter((d) => d.type === "Course");
        assert.equal(cadre!.niveau === "sansSeance", courus.length === 0, `${quand} : « aucune séance » (${cadre!.niveau}) contre ${courus.length} jour(s) courus au plan : ${courus.map((d) => d.type).join(", ")}`);
        if (cadre!.niveau !== "seuilBas") assert.deepEqual(intenses.map((d) => d.type), [], `${quand} : le plan pose une séance intense sous « ${cadre!.niveau} »`);
        else {
          assert.ok(intenses.length <= 1, `${quand} : ${intenses.length} séances intenses au plan sous « seuil bas »`);
          if (text.includes("• Aucune séance sous le seuil ce cycle.")) assert.equal(intenses.length, 0, `${quand} : le dossier dit « aucune » et le plan en pose une`);
        }
        if (cadre!.avisMedical || cadre!.marcheCourse) assert.deepEqual(courses, [], `${quand} : une course reste au plan (« ${courses[0]?.detail} »)`);
        for (const c of courses) {
          if (cadre!.effortMaxInterdit) {
            // À effort contrôlé (décision de Cyprien, 20/11/2026) : « sans jamais forcer » (courses A, B et C), ni allure ni accélération.
            assert.match(c.detail, /sans jamais forcer/, `${quand} : la course du plan n'est pas à effort contrôlé (« ${c.detail} »)`);
            assert.doesNotMatch(c.detail, /lignes droites|accélér|\d{1,2}['’]\d{2}/, `${quand} : la course du plan chiffre ou accélère (« ${c.detail} »)`);
          }
          if (cadre!.kine) assert.match(c.why, /kinésithérapeute/, `${quand} : la course du plan ne demande pas l'accord du kiné`);
        }
        if (cadre!.kine?.dureeMaxMin != null) for (const d of courus.filter((x) => x.type !== "Course")) {
          const min = dureeSeance(d, ctx.easyPace ?? null);
          assert.ok(min != null && min <= cadre!.kine.dureeMaxMin, `${quand} : ${d.date} ${d.type} dure ${min} min au plan, au-delà de ${cadre!.kine.dureeMaxMin}`);
        }
        // La fraîcheur dans sa version du cadre, quel que soit son niveau.
        const fraicheur = cadre!.niveau === "sansSeance" ? "— Aucune séance d'endurance n'est prévue tant qu'un médecin ne l'a pas vu" : {
          rouge: "🔴 ROUGE — Repos, ou un footing très facile et court", orange: "🟠 ORANGE — Séance allégée : coupe son volume d'environ un tiers",
          jaune: "🟡 JAUNE — La séance prévue peut se faire telle quelle", vert: "🟢 VERT — Il est frais : la séance prévue se fait telle quelle",
        }[ctx.readiness.level];
        assert.ok(text.includes(fraicheur), `${quand} : la fraîcheur (${ctx.readiness.level}) n'est pas dans sa version du cadre`);
        if (quand === "verdict orange") assert.equal(ctx.readiness.level, "orange", "précondition : le scénario orange n'est pas orange pour l'exempté");
        // 5. Ce que la structure dit, selon le cadre.
        if (cadre!.niveau === "sansSeance") {
          // Aucune séance : ni footing, ni sortie longue, ni « séance prévue », ni disponibilités, ni course de la semaine.
          const vus = sansPermis(text, ctx).match(/footing|sortie longue|alterne course|séance prévue|séance du jour|séance\(s\) de course|au calendrier cette semaine|MODE PERTE DE POIDS/gi);
          assert.equal(vus, null, `${quand} : le dossier d'un coureur qui attend un médecin parle encore de courir : ${vus?.join(", ")}`);
        }
        if (cadre!.marcheCourse) assert.ok(!text.includes("au calendrier cette semaine"), `${quand} : une course de la semaine est annoncée pendant la marche-course`);
        if (cadre!.kine?.dureeMaxMin != null) assert.ok(text.includes(`${cadre!.kine.dureeMaxMin} min au plus par sortie`), `${quand} : la structure ne dit pas la durée maximale`);
        if (cadre!.sensation && cadre!.niveau === "seuilBas" && ctx.weekPlan.quality.length)
          assert.ok(text.includes("• Au plus une séance sous le seuil cette semaine, en blocs longs, à la sensation."), `${quand} : la séance sous le seuil d'une coureuse à la sensation n'est pas dite à la sensation`);
        // 6. À la sensation : aucune allure ni FC dans le dossier non plus.
        if (cadre!.sensation) {
          assert.doesNotMatch(sansPermis(text, ctx).split("\n").filter((l) => !l.startsWith("- 5 dernières séances")).join("\n"), ALLURE, `${quand} : une allure est chiffrée pour une coureuse à la sensation`);
          assert.doesNotMatch(text.split("\n").filter((l) => !l.startsWith("- 5 dernières séances")).join("\n"), /\bbpm\b|FC ~/, `${quand} : une cible de FC est donnée à une coureuse à la sensation`);
        }
      }
    });
  }

  await test("avertissements d'objectif (affichés au coureur) : ni verdict de chrono ni « augmente le volume » sous cadre ; le témoin les a", async () => {
    const s: Situation = { notifications: [objectif(10, 30)] };
    const temoin = await contexte(s);
    assert.ok(temoin.objectiveWarnings.some((w) => /CHRONO TRÈS AMBITIEUX/.test(w)), "précondition : le témoin n'a pas de verdict de chrono");
    assert.ok(temoin.objectiveWarnings.some((w) => /PRÉPARATION INSUFFISANTE/.test(w)), "précondition : le témoin n'a pas l'avertissement de préparation insuffisante");
    for (const cas of EXEMPTES) {
      const ctx = await contexte(fusion(s, cas.s));
      const vus = ctx.objectiveWarnings.filter((w) => /CHRONO|PRÉPARATION INSUFFISANTE|VMA/.test(w));
      assert.deepEqual(vus, [], `${cas.nom} : ${vus.join(" | ")}`);
    }
  });

  await test("catalogue santé : sous cadre, chaque consigne d'antécédent et de blessure passe le crible ; hors cadre, la consigne d'origine", () => {
    for (const [nom, cat] of [["antécédent", HEALTH_CONDITIONS], ["blessure", INJURY_ZONES]] as const) {
      for (const item of cat) {
        const [ligne] = healthCoachLines([item.slug], cat, true).rules;
        assert.doesNotMatch(ligne, INTENSITE, `${nom} « ${item.slug} » sous cadre : « ${ligne} » [${ligne.match(INTENSITE)?.[0]}]`);
        assert.equal(healthCoachLines([item.slug], cat).rules[0], item.coach, `${nom} « ${item.slug} » : la consigne ordinaire a changé`);
      }
    }
    // Précondition : la règle d'origine de l'antécédent cardiaque nomme bien ce que le crible cherche.
    assert.match(HEALTH_CONDITIONS.find((c) => c.slug === "cardiaque")!.coach, INTENSITE);
  });

  await test("perte de poids sous cadre : la règle la plus STRICTE reste dite (« AUCUNE séance de qualité », obésité de classe 2) ; la règle permissive non", () => {
    const corps = (kg: number) => ({ weightKg: kg, heightCm: 165, age: 32, gender: "female" });
    const p2 = buildWeightPlan({ body: corps(110), goalKg: null, logs: [], workouts: [] });
    const p1 = buildWeightPlan({ body: corps(85), goalKg: null, logs: [], workouts: [] });
    assert.ok(p1 && p2, "précondition : les plans de poids se construisent");
    assert.match(weightCoachBlock(p2!), /AUCUNE séance de qualité pour l'instant/, "précondition : l'obésité de classe 2 interdit la qualité");
    assert.match(weightCoachBlock(p2!, true), /AUCUNE séance de qualité pour l'instant/, "sous cadre, l'interdiction du mode poids a disparu");
    assert.match(weightCoachBlock(p1!), /un peu soutenue|qualité maximum/, "précondition : l'obésité de classe 1 permet une séance soutenue");
    const cadre1 = weightCoachBlock(p1!, true);
    assert.doesNotMatch(cadre1, INTENSITE, `sous cadre, le mode poids parle d'intensité : « ${cadre1.match(INTENSITE)?.[0]} »`);
    assert.match(cadre1, /progression du volume ≤ \+5 %\/semaine/, "sous cadre, la limite de volume du mode poids a disparu");
  });

  await test("séance du jour par l'IA : mission d'origine pour un coureur ordinaire ; sous cadre, la mission du cadre (aucune séance, marche-course, aucune intensité, seuil bas, sensation, durée)", () => {
    assert.equal(missionSeanceDuJour({ cadreSante: null }), `- Si fatigué (VFC sous la base, sommeil bas, ou TSB très négatif) → récupération / facile.
- Si la course est proche → affûtage (fraîcheur, volume réduit, quelques rappels d'allure).
- Sinon, fais converger vers l'objectif : intègre par moments l'allure spécifique et la distance cible, en respectant le modèle polarisé et le niveau de l'athlète.
- Dose le volume sur le volume hebdomadaire réel et reste prudent si une douleur est signalée.`, "la mission d'un coureur ordinaire a changé");
    const k = { sansIntensite: false, dureeMaxMin: 40, seancesMaxSemaine: null, jusquAu: "2026-12-31", majA: "2026-11-10" };
    const m = (o: Partial<Parameters<typeof cadreDeSante>[0]>) => missionSeanceDuJour({ cadreSante: cadreDeSante({ avisMedical: false, marcheCourse: null, consignes: null, conditions: [], ...o }) });
    const missions = {
      sansSeance: m({ avisMedical: true }), marche: m({ marcheCourse: { etape: 2, total: 11 } }), covid: m({ conditions: ["covid_long"] }),
      cardiaque: m({ conditions: ["cardiaque"] }), grossesse: m({ conditions: ["grossesse"] }), kine: m({ consignes: k }),
    };
    for (const [nom, t] of Object.entries(missions)) {
      assert.doesNotMatch(t, /allure spécifique|rappels d'allure|converger|affûtage/, `${nom} : la mission pousse vers l'allure : « ${t} »`);
      assert.match(t, /CADRE DE SANTÉ \(n'en cite pas le motif\)/, `${nom} : la mission ne dit pas le cadre`);
      assert.doesNotMatch(t, /antécédent cardiaque|maladie cardiaque|grossesse|enceinte|covid|aptitude|kinésithérapeute/i, `${nom} : la mission nomme le motif`);
    }
    assert.match(missions.sansSeance, /AUCUNE séance d'endurance/);
    assert.doesNotMatch(missions.sansSeance, /footing|endurance facile|Si la course est proche/, "avis médical attendu : la mission propose encore de courir");
    assert.match(missions.marche, /marche-course \(2 sur 11\)/);
    assert.match(missions.covid, /AUCUNE intensité/); assert.match(missions.kine, /AUCUNE intensité/); assert.match(missions.kine, /40 min au plus/);
    assert.match(missions.cardiaque, /seuil bas/); assert.match(missions.grossesse, /à la sensation/);
    assert.match(codeNu("src/app/api/ai/session/route.ts"), /\$\{missionSeanceDuJour\(ctx\)\}/, "la route ne passe plus par la mission");
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
