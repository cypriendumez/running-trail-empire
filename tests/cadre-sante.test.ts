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
 * marche-course, cardiaque, covid long, grossesse, consignes du kiné) ET LEURS COMBINAISONS, dans des données
 * qui déclenchent tout (objectif ambitieux, affûtage, marathon, courses B et C de la semaine, reprise après un
 * arrêt, course passée, bilan du matin, seuil mesuré, dernière série accélérée, dérive, cadence, cycle, perte
 * de poids, terrains, monotonie, plateau…), et sur SEPT JOURS DE DÉPART (relecture du 2e tour) :
 *  · le cadre écrit en tête est exactement celui que le plan applique, confronté au PLAN produit pour la même
 *    situation (aucune séance, aucune séance intense, au plus une sous le seuil, durée maximale, nombre de
 *    sorties, marche-course posée ou bloquée, course retirée, absente, à effort contrôlé ou avec l'accord du
 *    kiné, repos d'un malaise, à la sensation) ;
 *  · aucune section du dossier ordinaire n'y figure (palette, capacités, analyse…) ;
 *  · tout le texte est passé au crible d'un vocabulaire d'intensité LARGE, sans exemption sur un marqueur :
 *    seules sont retirées des phrases EXACTES, et seulement au niveau qui les emploie (les lignes du cadre ; au
 *    seuil bas, la séance sous le seuil que le plan pose) et la ligne de données « 5 dernières séances » ;
 *  · un témoin ordinaire, avec les mêmes données, a son dossier habituel — et ce vocabulaire ;
 *  · l'enveloppe du dossier (système du coach, invite de la séance du jour, relecture, routes admin) suit le cadre.
 *
 *   npx tsx tests/cadre-sante.test.ts
 */
process.env.TZ = "UTC";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, COACH_SYSTEM, COACH_SYSTEM_CADRE, systemeCoach, type AthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan, consignesSurPlan, sansCourseCEcartee, avecCourseCEcartee, planALaSensation, type PlanDay } from "../src/lib/ai/autoPlan";
import { appliquerAjustement } from "../src/lib/coach/ajustementApplique";
import { validerAjustement } from "../src/lib/ai/ajustement";
import { composerPourquoi, LONGUEUR_MAX } from "../src/lib/ai/relectureSemaine";
import { appliquerMalaise, pourquoiCourseMalaise, POURQUOI_MAX, phraseAccordKine } from "../src/lib/coach/consignesPlan";
import { PLAN_T } from "../src/lib/ai/planI18n";
import type { Lang } from "../src/lib/i18n/translations";
import { cadreDeSante, lignesCadre, CADRE_FR, type CadreSante } from "../src/lib/coach/cadreSante";
import { missionSeanceDuJour, inviteSeanceDuJour } from "../src/lib/ai/missionSeance";
import { HEALTH_CONDITIONS, INJURY_ZONES, healthCoachLines } from "../src/data/healthCatalog";
import { weightCoachBlock } from "../src/lib/weight/coaching";
import { buildWeightPlan } from "../src/lib/weight/energy";
import { dureeSeance } from "../src/lib/coach/consignesPlan";
import { MALAISE_T } from "../src/lib/health/effortMaximal";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const LANGUES: Lang[] = ["fr", "en", "de", "es", "pt"];
/** Le texte d'un jour du plan dans la langue `l` (le français est au-dessus, les autres dans `i18n`). */
const texteDe = (d: PlanDay, l: Lang) => (l === "fr" ? d : d.i18n?.[l] ?? d);
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
/** L'horloge décalée : le dossier se rédige au jour du coureur (rejeu sur sept jours de départ). */
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
const objectif = (km: number, dans: number) => ({ user_id: "u", type: "race_objective", created_at: `${ilYa(40)}T10:00:00Z`,
  data: { race: `Course du parc ${km} km`, raceDate: ilYa(-dans), distanceKm: km, targetTime: "36:00", targetSeconds: 2160, targetPace: "3'36/km" } });
const planifiee = (name: string, dans: number, distanceKm: number, priorite: "B" | "C") => ({ user_id: "u", type: "planned_race",
  created_at: `${AUJOURDHUI}T10:00:00Z`, data: { name, date: ilYa(-dans), distanceKm, priorite } });
const aptitude = { user_id: "u", type: "aptitude", created_at: `${ilYa(10)}T10:00:00Z`, data: { oui: ["poitrine"], date: ilYa(10), avisMedecin: null } };
const kine = (o: Ligne) => ({ user_id: "u", type: "consignes_kine", created_at: `${ilYa(5)}T10:00:00Z`,
  data: { dureeMaxMin: null, sansIntensite: false, seancesMaxSemaine: null, jusquAu: ilYa(-40), majA: ilYa(5), ...o } });

type Situation = { profil?: Ligne; notifications?: Ligne[]; seances?: Ligne[] };
/** Le contexte au jour `decalage` (0 = aujourd'hui), ses données restant datées par rapport à aujourd'hui. */
async function contexte(s: Situation, decalage = 0): Promise<AthleteContext> {
  return aLInstant(`${ilYa(-decalage)}T08:00:00Z`, () => buildAthleteContext(fauxClient({ profiles: [profil(s.profil)], performance_baselines: [],
    workouts: s.seances ?? FOOTINGS, notifications: s.notifications ?? [] }), "u"));
}
const plan = (ctx: AthleteContext, decalage = 0) => buildWeekPlan(ctx, new Date(`${ilYa(-decalage)}T12:00:00Z`));

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
  // Reprise après 14 jours sans courir (lib/coach/repriseArret).
  ["reprise après 14 jours d'arrêt", { seances: [16, 19, 22, 25, 28, 31, 34, 37].map((n) => footing(n)) }],
  // Un semi couru il y a 9 jours : la récupération d'après-course (lib/coach/apresCourse).
  ["semi couru il y a 9 jours", { notifications: [objectif(21.1, -9)], seances: [...FOOTINGS, footing(9, { distance_km: 21.1, duration_seconds: 6300, avg_hr: 168, max_hr: 182, tss: 150 })] }],
  // Bilan du matin à 5/5 et 4/5, sortie hier : le covid long y voit un malaise (repos), les autres une séance allégée.
  ["bilan du matin 5/4 après une sortie hier", { seances: [footing(1), ...FOOTINGS],
    notifications: [{ user_id: "u", type: "bilan_matin", created_at: `${AUJOURDHUI}T06:00:00Z`, data: { date: AUJOURDHUI, fatigue: 5, jambes: 4, stress: 1 } }] }],
];
type Cas = { nom: string; s: Situation; niveau: CadreSante["niveau"] };
const marche = { profil: { peut_courir_30min: false } };
const sit = (conditions: string[], notifications: Ligne[] = [], autre: Ligne = {}): Situation => ({ profil: { health_conditions: conditions, ...autre }, notifications });
const EXEMPTES: Cas[] = [
  { nom: "avis d'un médecin attendu", s: { notifications: [aptitude] }, niveau: "sansSeance" },
  { nom: "programme marche-course", s: marche, niveau: "sansIntensite" },
  { nom: "antécédent cardiaque", s: sit(["cardiaque"]), niveau: "seuilBas" },
  { nom: "covid long", s: sit(["covid_long"]), niveau: "sansIntensite" },
  { nom: "grossesse", s: sit(["grossesse"]), niveau: "seuilBas" },
  { nom: "consignes du kiné « sans intensité »", s: { notifications: [kine({ sansIntensite: true })] }, niveau: "sansIntensite" },
  { nom: "consignes du kiné « 40 min au plus »", s: { notifications: [kine({ dureeMaxMin: 40 })] }, niveau: "sansIntensite" },
  // Les COMBINAISONS (relecteurs et @HeadCoach, 2e tour).
  { nom: "cardiaque + kiné « 2 sorties au plus »", s: sit(["cardiaque"], [kine({ seancesMaxSemaine: 2 })]), niveau: "seuilBas" },
  { nom: "avis médical + cardiaque", s: sit(["cardiaque"], [aptitude]), niveau: "sansSeance" },
  { nom: "avis médical + marche-course", s: sit([], [aptitude], { peut_courir_30min: false }), niveau: "sansSeance" },
  { nom: "avis médical + kiné « 40 min au plus » + tibia et surpoids", s: sit(["surpoids", "diabete"], [aptitude, kine({ dureeMaxMin: 40 })], { injury_zones: ["tibia", "genou"] }), niveau: "sansSeance" },
  { nom: "marche-course + kiné « 30 min au plus » (séance de l'étape plus longue)", s: sit([], [kine({ dureeMaxMin: 30 })], { peut_courir_30min: false }), niveau: "sansIntensite" },
  { nom: "marche-course + kiné « 1 sortie au plus »", s: sit([], [kine({ seancesMaxSemaine: 1 })], { peut_courir_30min: false }), niveau: "sansIntensite" },
  { nom: "marche-course + cardiaque", s: sit(["cardiaque"], [], { peut_courir_30min: false }), niveau: "sansIntensite" },
  { nom: "grossesse + kiné « 40 min au plus »", s: sit(["grossesse"], [kine({ dureeMaxMin: 40 })]), niveau: "sansIntensite" },
  { nom: "cardiaque + kiné « sans intensité »", s: sit(["cardiaque"], [kine({ sansIntensite: true })]), niveau: "sansIntensite" },
  { nom: "covid long + kiné « 2 sorties au plus »", s: sit(["covid_long"], [kine({ seancesMaxSemaine: 2 })]), niveau: "sansIntensite" },
];
const fusion = (a: Situation, b: Situation): Situation => ({ profil: { ...(a.profil ?? {}), ...(b.profil ?? {}) },
  notifications: [...(a.notifications ?? []), ...(b.notifications ?? [])], seances: b.seances ?? a.seances });

/** Le vocabulaire d'intensité, LARGE : ce qu'aucune ligne d'un exempté ne doit écrire hors des phrases exactes permises. */
const INTENSITE = /VMA|seuil|tempo|fractionn|\bcôtes?\b|lignes? droites?|sprint|accélér|\bZ[3-5]\b|zone [3-5]|allure (?:spécifique|de course|cible|marathon)|chrono|qualité|intensit|séances? dures?|durcir|explosi|pliométr|\btests?\b|effort maximal|record|polaris|80\/20|densit|stimulus|affûtage|VO2|fartlek|négatif split|à fond|exigeant|sous-dos|potentiel perdu|ose la|\boser\b/i;
/** Les sections du dossier ORDINAIRE : aucune n'existe dans celui d'un exempté. */
const SECTIONS_ORDINAIRES = ["VERDICT DE FRAÎCHEUR DU JOUR", "PALETTE DE SÉANCES", "CAPACITÉS (tests)", "ANALYSE APPROFONDIE", "ÂGE & RÉCUPÉRATION",
  "PASSIF, TERRAIN & DÉNIVELÉ", "STRUCTURE CIBLE DE LA SEMAINE", "GARDE-FOUS ANTI-BLESSURE", "EXÉCUTION & ADHÉRENCE", "PENTE RÉELLE"];
const NON_COURUS = new Set(["Repos", "Renfo", "Mobilité"]);
const INTENSES = new Set(["VMA", "Seuil", "Spécifique", "Côtes", "Tempo", "Fartlek", "Qualité"]);
const ALLURE = /\d{1,2}['’]\d{2}/;

/** Le texte d'un exempté, sans les phrases EXACTES qui ont le droit de nommer l'intensité pour l'interdire —
 *  chacune au seul niveau qui l'emploie. */
function sansPermis(text: string, ctx: AthleteContext): string {
  const cadre = ctx.cadreSante!;
  let t = text;
  const permis = [
    ...lignesCadre(cadre).map((l) => `- ${l}`),
    // L'interdiction la plus stricte du mode perte de poids (obésité de classe 2), gardée sous cadre : elle INTERDIT.
    "AUCUNE séance de qualité pour l'instant",
    // Au seuil bas seulement : la séance sous le seuil que le plan pose (budget de qualité), ou son absence.
    ...(cadre.niveau === "seuilBas" ? [
      "• Au plus une séance sous le seuil cette semaine, en blocs longs, à la sensation.",
      "• Aucune séance sous le seuil ce cycle.",
      ...(ctx.weekPlan.quality[0] ? [`• Au plus une séance sous le seuil cette semaine : ${ctx.weekPlan.quality[0].desc}`] : []),
    ] : []),
  ];
  for (const p of permis) t = t.split(p).join("");
  // La ligne de DONNÉES des séances passées (leur étiquette dit ce qu'elles ont été, pas ce qu'il faut faire).
  return t.split("\n").filter((l) => !l.startsWith("- 5 dernières séances : ")).join("\n");
}
/** La section du dossier qui commence par `titre`, jusqu'à la suivante. */
const section = (text: string, titre: string) => { const i = text.indexOf(`\n${titre}`); if (i < 0) return ""; const j = text.indexOf("\n\n", i + 1); return text.slice(i, j < 0 ? undefined : j); };

/** TOUTES les vérifications d'un dossier d'exempté contre son PLAN. */
function verifier(ctx: AthleteContext, p: ReturnType<typeof buildWeekPlan>, cas: Cas, quand: string, jour: string) {
  const cadre = ctx.cadreSante;
  assert.ok(cadre, `${quand} : aucun cadre`);
  assert.equal(cadre!.niveau, cas.niveau, `${quand} : niveau`);
  const text = ctx.text;
  // 1. L'en-tête : exactement les lignes du cadre, puis le profil.
  assert.ok(text.startsWith(`${CADRE_FR.titre}\n${lignesCadre(cadre!).map((l) => `- ${l}`).join("\n")}\n\nPROFIL\n`), `${quand} : l'en-tête n'est pas le cadre (« ${text.slice(0, 300)} »)`);
  // 2. Aucune section du dossier ordinaire.
  for (const sec of SECTIONS_ORDINAIRES) assert.ok(!text.includes(sec), `${quand} : la section ordinaire « ${sec} » est dans le dossier`);
  // 3. Le crible, sans exemption sur un marqueur.
  const vu = sansPermis(text, ctx).split("\n").filter((l) => INTENSITE.test(l));
  assert.deepEqual(vu.map((l) => l.slice(0, 160)), [], `${quand} : vocabulaire d'intensité hors des phrases permises : ${vu.map((l) => `« ${l.slice(0, 220)} » [${l.match(INTENSITE)?.[0]}]`).join(" | ")}`);
  // 4. Le PLAN de la même situation.
  const courus = p.filter((d) => !NON_COURUS.has(d.type));
  const intenses = p.filter((d) => INTENSES.has(d.type));
  const courses = p.filter((d) => d.type === "Course");
  const mcJours = p.filter((d) => d.type === "Marche/course");
  // « Aucune séance » ⇒ aucune sortie au plan (l'inverse n'est pas vrai : une reprise ou une limite du kiné déjà
  // atteinte peut laisser une semaine sans sortie, et le dossier ne promet alors que « au plus N »).
  if (cadre!.niveau === "sansSeance") assert.deepEqual(courus.map((d) => d.type), [], `${quand} : « aucune séance » et le plan pose des sorties`);
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
  const aPied = courus.filter((d) => d.type !== "Course" && d.type !== "Vélo");
  if (cadre!.kine?.dureeMaxMin != null) for (const d of aPied) {
    const min = dureeSeance(d, ctx.easyPace ?? null);
    assert.ok(min != null && min <= cadre!.kine.dureeMaxMin, `${quand} : ${d.date} ${d.type} dure ${min} min au plan, au-delà de ${cadre!.kine.dureeMaxMin}`);
  }
  // 5. Le nombre de sorties : le dossier dit « au plus N », le plan n'en pose pas plus, le kiné borne N.
  const dispo = text.match(/📆 DISPONIBILITÉS : au plus (\d+) sortie\(s\) d'entraînement à pied sur 7 jours(, une course au calendrier à part)?/);
  if (cadre!.niveau === "sansSeance" || cadre!.marcheCourse?.bloquee) assert.equal(dispo, null, `${quand} : des disponibilités pour un coureur sans séance`);
  else {
    assert.ok(dispo, `${quand} : les disponibilités manquent`);
    assert.equal(!!dispo![2], !cadre!.marcheCourse, `${quand} : « une course au calendrier à part » ${cadre!.marcheCourse ? "en marche-course, qui n'en pose aucune" : "manque"}`);
    const n = Number(dispo![1]);
    // La valeur EXACTE (relecteur H, 4e tour) : celle du plan — ses jours par semaine, bornés par le kiné ; en
    // marche-course, les séances de son étape (2 ou 3, `construireSemaine`), bornées par le kiné.
    const maxKine = cadre!.kine?.seancesMaxSemaine ?? Infinity;
    const attendu = cadre!.marcheCourse ? Math.min(Math.max(2, Math.min(3, ctx.availability.daysPerWeek || 3)), maxKine) : Math.min(ctx.availability.daysPerWeek, maxKine);
    assert.equal(n, attendu, `${quand} : « au plus ${n} » sorties au dossier, ${attendu} au plan`);
    assert.ok(aPied.length <= n, `${quand} : le plan pose ${aPied.length} sorties à pied, le dossier « au plus ${n} »`);
    if (cadre!.kine?.seancesMaxSemaine != null) assert.ok(n <= cadre!.kine.seancesMaxSemaine, `${quand} : « au plus ${n} » au-delà des ${cadre!.kine.seancesMaxSemaine} sorties du kiné`);
  }
  // 6. La marche-course : la séance de l'étape, au plus N fois comme le plan, ou AUCUNE quand le kiné la bloque.
  if (cadre!.marcheCourse && cadre!.niveau !== "sansSeance") {
    if (cadre!.marcheCourse.bloquee) {
      assert.equal(mcJours.length, 0, `${quand} : le plan pose une marche-course que la durée du kiné bloque`);
      assert.ok(text.includes("• Aucune séance de marche-course cette semaine"), `${quand} : la structure ne dit pas la marche-course bloquée`);
    } else {
      assert.ok(!text.includes("jamais deux jours de suite"), `${quand} : « jamais deux jours de suite », que le plan ne tient pas quand seuls des jours voisins sont libres`);
      const f = text.match(/au plus (\d+) fois sur 7 jours/);
      assert.ok(f, `${quand} : la fréquence de la marche-course manque`);
      assert.equal(Number(f![1]), Math.min(Math.max(2, Math.min(3, ctx.availability.daysPerWeek || 3)), cadre!.kine?.seancesMaxSemaine ?? Infinity), `${quand} : « au plus ${f![1]} fois » au dossier, pas ce que pose son plan`);
      assert.ok(mcJours.length <= Number(f![1]), `${quand} : le plan pose ${mcJours.length} marches-courses, le dossier « au plus ${f![1]} »`);
      if (cadre!.kine?.seancesMaxSemaine != null) assert.ok(Number(f![1]) <= cadre!.kine.seancesMaxSemaine, `${quand} : la fréquence de marche-course dépasse le kiné`);
    }
  }
  // 7. La fraîcheur dans sa version du cadre : le repos d'un malaise, la marche-course sans « footing ».
  const jour0 = p.filter((d) => d.date === jour);
  const courseJour0 = jour0.some((d) => d.type === "Course");
  const fraicheur = cadre!.niveau === "sansSeance" ? "— Aucune séance d'endurance n'est prévue tant qu'un médecin ne l'a pas vu"
    : cadre!.marcheCourse?.bloquee ? "— Aucune séance de marche-course n'est prévue cette semaine (durée fixée par son kinésithérapeute)"
    : ctx.malaiseApresEffort ? "— Aujourd'hui, repos : il s'est senti nettement plus mal après sa dernière séance (bilan du matin). Si une course tombe aujourd'hui, mieux vaut qu'il ne prenne pas le départ — la décision lui appartient ; qu'il en parle à son médecin avant sa prochaine course, et sans attendre si cela se répète."
    : {
        rouge: cadre!.marcheCourse ? "🔴 ROUGE — Repos ou marche tranquille aujourd'hui" : "🔴 ROUGE — Repos, ou un footing très facile et court",
        orange: cadre!.marcheCourse ? "🟠 ORANGE — Séance de son étape raccourcie" : "🟠 ORANGE — Séance allégée : coupe son volume d'environ un tiers",
        jaune: "🟡 JAUNE — La séance prévue peut se faire telle quelle", vert: "🟢 VERT — Il est frais : la séance prévue se fait telle quelle",
      }[ctx.readiness.level];
  assert.ok(text.includes(fraicheur), `${quand} : la fraîcheur (${ctx.readiness.level}${ctx.malaiseApresEffort ? ", malaise" : ""}) n'est pas dans sa version du cadre`);
  // Le malaise (covid long), posé sur le plan FINI (après les consignes du kiné) : UN repos, avec son « pourquoi » ;
  // le jour d'une course que le plan garde, la course seule, dont le « pourquoi » conseille de ne pas prendre le départ.
  // Sous avis médical attendu, le plan ne pose aucune séance et son « pourquoi » prime.
  if (ctx.malaiseApresEffort && cadre!.niveau !== "sansSeance") {
    if (courseJour0) {
      assert.deepEqual(jour0.map((d) => d.type).filter((t) => t !== "Course"), [], `${quand} : malaise, et une séance s'ajoute à la course du jour`);
      for (const d of jour0) for (const l of LANGUES) {
        const why = texteDe(d, l).why, conseil = MALAISE_T[l].course.trim();
        assert.ok(why.startsWith(conseil), `${quand} : le conseil du malaise n'est pas EN TÊTE du « pourquoi » de la course (${l}) : « ${why.slice(0, 80)} »`);
        // Le « pourquoi » tient TOUT ENTIER dans ce que l'écriture garde (relecteur I, @HeadCoach, 5e tour) : rien n'est coupé.
        assert.ok(why.length <= POURQUOI_MAX, `${quand} : « pourquoi » de ${why.length} caractères, coupé à l'écriture (${l})`);
        // Chaque phrase de sécurité de la même course SANS malaise y est : l'accord du kiné (⚠️), l'effort contrôlé
        // (« seul ton médecin… »), et le feu rouge (au moins son motif).
        const sans = buildWeekPlan({ ...ctx, malaiseApresEffort: false }, new Date(`${jour}T12:00:00Z`)).find((x) => x.date === jour && x.type === "Course");
        if (sans) {
          const whySans = texteDe(sans, l).why;
          for (const phrase of whySans.split(/(?<=[.!])\s+(?=⚠️)/).filter((p) => p.trim().startsWith("⚠️")))
            assert.ok(why.includes(phrase.trim()), `${quand} : « ${phrase.trim().slice(0, 70)} » disparaît du jour de malaise (${l})`);
          if (whySans.includes(PLAN_T[l].courseWhyControle)) assert.ok(why.includes(PLAN_T[l].courseWhyControle), `${quand} : l'effort contrôlé disparaît (${l})`);
          const feu = PLAN_T[l].courseFeuRouge("§").split("§")[0].trim();
          if (whySans.includes(feu)) assert.ok(why.includes(feu), `${quand} : le feu rouge disparaît du jour de malaise (${l})`);
        }
        // Ce que le coach ENREGISTRE : la coupe à 640, et le conseil Premium le plus long logé dans le « pourquoi ».
        for (const enregistre of [why.slice(0, 640), composerPourquoi(why, "x".repeat(LONGUEUR_MAX)).slice(0, 640)])
          assert.ok(enregistre.includes(conseil), `${quand} : le conseil du malaise disparaît du « pourquoi » enregistré (${l}, ${why.length} caractères)`);
      }
    } else {
      assert.deepEqual(jour0.map((d) => d.type), ["Repos"], `${quand} : malaise, et le plan pose ${jour0.map((d) => d.type).join(", ")} aujourd'hui`);
      for (const l of LANGUES) assert.ok(texteDe(jour0[0], l).why.includes(MALAISE_T[l].why), `${quand} : le repos du jour n'est pas celui du malaise (${l})`);
    }
    // La mission de la séance du jour dit le même conseil, sur ce contexte réel.
    const mission = missionSeanceDuJour(ctx);
    assert.ok(mission.includes("REPOS aujourd'hui") && mission.includes("conseille-lui de ne pas prendre le départ"), `${quand} : la mission ne dit pas le repos du malaise`);
  }
  // 8. Ce que la structure dit, selon le cadre — jamais une sortie longue qu'il ne pose pas.
  assert.doesNotMatch(section(text, "STRUCTURE DE SA SEMAINE"), /sortie longue/i, `${quand} : la structure annonce une sortie longue`);
  if (cadre!.niveau === "sansSeance") {
    // Aucune séance : ni footing, ni sortie longue, ni vélo, ni « séance prévue », ni disponibilités, ni course de la semaine.
    const vus = sansPermis(text, ctx).match(/footing|sortie longue|sorties longues|vélo|volume facile|croisé|alterne course|séance prévue|séance du jour|au calendrier cette semaine|MODE PERTE DE POIDS|réduit le volume/gi);
    assert.equal(vus, null, `${quand} : le dossier d'un coureur qui attend un médecin parle encore de courir : ${vus?.join(", ")}`);
  }
  if (cadre!.marcheCourse) assert.ok(!text.includes("au calendrier cette semaine"), `${quand} : une course de la semaine est annoncée pendant la marche-course`);
  if (cadre!.marcheCourse) assert.ok(!text.includes("• Mode perte de poids :"), `${quand} : le mode poids (vélo, alternances 2/1) est annoncé à une marche-course, dont le plan n'en pose pas`);
  if (cadre!.kine?.dureeMaxMin != null && cadre!.niveau !== "sansSeance" && !cadre!.marcheCourse?.bloquee)
    assert.ok(text.includes(`${cadre!.kine.dureeMaxMin} min au plus par sortie`), `${quand} : la structure ne dit pas la durée maximale`);
  if (cadre!.sensation && cadre!.niveau === "seuilBas" && ctx.weekPlan.quality.length)
    assert.ok(text.includes("• Au plus une séance sous le seuil cette semaine, en blocs longs, à la sensation."), `${quand} : la séance sous le seuil d'une coureuse à la sensation n'est pas dite à la sensation`);
  // Le mode perte de poids : le plan pose du vélo et des alternances 2 min de course / 1 min de marche (hors
  // marche-course) ; le dossier le dit. Le « format d'entrée » du bloc poids (« 1 min / 2 min ») n'est pas celui du
  // plan : il ne s'écrit pas sous cadre.
  assert.ok(!text.includes("FORMAT D'ENTRÉE"), `${quand} : le format d'entrée du mode poids (1 min / 2 min) contredit le plan (2 min / 1 min)`);
  if (!cadre!.marcheCourse && p.some((d) => d.type === "Marche/course"))
    assert.ok(text.includes("en alternance course/marche (2 min de course / 1 min de marche), comme son plan les pose"), `${quand} : le plan pose des alternances que le dossier ne dit pas`);
  if (p.some((d) => d.type === "Vélo")) assert.ok(text.includes("en vélo (sans impact)"), `${quand} : le plan pose du vélo que le dossier ne dit pas`);
  if (cadre!.marcheCourse) assert.ok(!text.includes("volume sans impact"), `${quand} : du vélo proposé pendant la marche-course`);
  // 9. Les garde-fous du cadre, mot pour mot.
  const garde = cadre!.niveau === "sansSeance" ? "- Douleur dans la poitrine, malaise ou essoufflement anormal → un médecin sans attendre (15 ou 112 en urgence)."
    : cadre!.marcheCourse ? "- Progression : celle des étapes du programme, rien de plus."
    : `- Progressivité : +${Math.min(10, ctx.weightLoss?.rules?.maxWeeklyProgressPct ?? 10)} % de volume par semaine au plus${cadre!.intensiteInterdite ? ", plus lentement encore pour une fatigue post-virale" : ""}.`;
  assert.ok(section(text, "GARDE-FOUS").includes(garde), `${quand} : les garde-fous ne disent pas « ${garde} »`);
  // 10. À la sensation : aucune allure ni FC dans tout le dossier, séances passées comprises.
  if (cadre!.sensation) {
    assert.doesNotMatch(text, ALLURE, `${quand} : une allure est chiffrée pour une coureuse à la sensation (« ${text.match(new RegExp(`.{0,60}${ALLURE.source}.{0,20}`))?.[0]} »)`);
    assert.doesNotMatch(text, /\bbpm\b|FC ~/, `${quand} : une fréquence cardiaque est donnée à une coureuse à la sensation`);
  }
  // 11. Les avertissements d'objectif (affichés au coureur) : aucun mot d'intensité, rien qui pousse le volume.
  if (cadre!.niveau === "sansSeance" || cadre!.marcheCourse) assert.ok(!ctx.objectiveWarnings.some((w) => w.startsWith("⚠️ DISTANCE")), `${quand} : une distance à préparer pour une course que le plan retire ou ne pose pas`);
  for (const w of ctx.objectiveWarnings) {
    assert.doesNotMatch(w, INTENSITE, `${quand} : avertissement d'objectif « ${w} »`);
    assert.doesNotMatch(w, /augmente|fréquence des sorties|faire monter le volume/i, `${quand} : avertissement d'objectif qui pousse le volume « ${w} »`);
  }
}

async function main() {
  console.log("\nLE CADRE DE SANTÉ : LE DOSSIER DE L'IA DIT CE QUE LE PLAN FAIT");

  await test("cadreDeSante : le plus strict l'emporte ; des consignes qui ne bornent que le nombre de sorties ne font pas de cadre ; la marche-course bloquée par la durée du kiné", () => {
    const k = (o: Partial<{ sansIntensite: boolean; dureeMaxMin: number | null; seancesMaxSemaine: number | null }>) =>
      ({ sansIntensite: false, dureeMaxMin: null, seancesMaxSemaine: null, jusquAu: "2026-12-31", majA: "2026-11-10", ...o });
    const c = (o: Partial<Parameters<typeof cadreDeSante>[0]>) => cadreDeSante({ avisMedical: false, marcheCourse: null, consignes: null, conditions: [], ...o });
    const mc = { etape: 2, total: 11, totalMin: 35 };
    assert.equal(c({}), null);
    assert.equal(c({ consignes: k({ seancesMaxSemaine: 2 }) }), null, "le nombre de sorties seul fait un cadre");
    assert.equal(c({ avisMedical: true, conditions: ["cardiaque"], consignes: k({ sansIntensite: true }) })?.niveau, "sansSeance");
    assert.equal(c({ marcheCourse: mc, conditions: ["cardiaque"] })?.niveau, "sansIntensite");
    assert.equal(c({ conditions: ["cardiaque"], consignes: k({ dureeMaxMin: 40 }) })?.niveau, "sansIntensite");
    assert.equal(c({ conditions: ["covid_long"] })?.niveau, "sansIntensite");
    assert.equal(c({ consignes: k({ sansIntensite: true }) })?.niveau, "sansIntensite");
    assert.equal(c({ conditions: ["grossesse"] })?.niveau, "seuilBas");
    assert.equal(c({ conditions: ["grossesse"] })?.sensation, true);
    assert.equal(c({ conditions: ["cardiaque"], consignes: k({ seancesMaxSemaine: 2 }) })?.niveau, "seuilBas");
    assert.equal(c({ conditions: ["asthme"] }), null, "l'asthme (aucune limite d'intensité au plan) donne un cadre de santé");
    assert.equal(c({ marcheCourse: mc, consignes: k({ dureeMaxMin: 30 }) })?.marcheCourse?.bloquee, true, "35 min d'étape au-delà des 30 min du kiné : la marche-course n'est pas bloquée");
    assert.equal(c({ marcheCourse: mc, consignes: k({ dureeMaxMin: 35 }) })?.marcheCourse?.bloquee, false, "35 min d'étape dans les 35 min du kiné : la marche-course est bloquée");
    assert.equal(c({ marcheCourse: mc })?.marcheCourse?.bloquee, false);
  });

  await test("lignesCadre : chaque situation dit ce que son plan fait de la course (retirée, absente, à effort contrôlé, avec l'accord du kiné) et de la marche-course", () => {
    const k = { sansIntensite: false, dureeMaxMin: 40, seancesMaxSemaine: 2, jusquAu: "2026-12-31", majA: "2026-11-10" };
    const l = (o: Partial<Parameters<typeof cadreDeSante>[0]>) => lignesCadre(cadreDeSante({ avisMedical: false, marcheCourse: null, consignes: null, conditions: [], ...o })!);
    const apt = l({ avisMedical: true, consignes: k, conditions: ["grossesse"] });
    assert.deepEqual(apt, [CADRE_FR.sansSeance, CADRE_FR.courseRetiree, CADRE_FR.limite], "avis médical attendu : rien d'autre que l'absence de séance");
    assert.deepEqual(l({ marcheCourse: { etape: 3, total: 11, totalMin: 38 } }), [CADRE_FR.sansIntensite, CADRE_FR.marcheCourse(3, 11), CADRE_FR.courseMarcheCourse, CADRE_FR.limite]);
    assert.deepEqual(l({ marcheCourse: { etape: 3, total: 11, totalMin: 38 }, consignes: { ...k, dureeMaxMin: 30, seancesMaxSemaine: null } }),
      [CADRE_FR.sansIntensite, CADRE_FR.marcheCourseBloquee(3, 11, 38, 30, "2026-12-31"), CADRE_FR.dureeMax(30, "2026-12-31"), CADRE_FR.courseMarcheCourse, CADRE_FR.limite]);
    assert.deepEqual(l({ conditions: ["grossesse"], consignes: k }),
      [CADRE_FR.sansIntensite, CADRE_FR.sensation, CADRE_FR.dureeMax(40, "2026-12-31"), CADRE_FR.seancesMax(2, "2026-12-31"), CADRE_FR.courseControle, CADRE_FR.courseKine("2026-12-31"), CADRE_FR.limite]);
    assert.deepEqual(l({ conditions: ["cardiaque"] }), [CADRE_FR.seuilBas, CADRE_FR.courseControle, CADRE_FR.limite]);
    // À la sensation, pas d'« allure tenue » (relecteur J, 5e tour).
    assert.match(CADRE_FR.seuilBas, /à allure tenue/, "précondition");
    assert.ok(l({ conditions: ["grossesse"] }).some((x) => x.includes("en blocs longs à la sensation")) && !l({ conditions: ["grossesse"] }).some((x) => x.includes("allure tenue")), "grossesse : la séance sous le seuil « à allure tenue »");
    assert.match(CADRE_FR.dureeMax(40, "2026-12-31"), /40 min au plus.*course A ou B à part.*jusqu'au 31\/12/);
    assert.doesNotMatch(CADRE_FR.marcheCourse(10, 11), /alternance/, "« des alternances » est faux aux dernières étapes (course continue)");
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
      if (quand === "reprise après 14 jours d'arrêt") assert.match(ctx.text, /reprise après \d+ jours sans courir : .*séance de qualité|aucune course enregistrée depuis/, "précondition : le témoin ne voit pas la reprise");
      if (quand === "semi couru il y a 9 jours") assert.match(ctx.text, /reprise après Course du parc 21\.1 km|récupération après Course du parc 21\.1 km/, "précondition : le témoin ne voit pas la récupération d'après-course");
    }
  });

  await test("consignes du kiné qui ne bornent QUE le nombre de sorties : dossier ordinaire (l'intensité reste permise par le plan)", async () => {
    const ctx = await contexte({ notifications: [objectif(10, 30), kine({ seancesMaxSemaine: 3 })] });
    assert.equal(ctx.cadreSante, null);
    assert.match(ctx.text, /^PROFIL\n/);
    assert.ok(plan(ctx).some((d) => INTENSES.has(d.type)), "précondition : le plan pose encore une séance intense");
  });

  for (const cas of EXEMPTES) {
    await test(`${cas.nom} : le dossier dit ce que le plan applique, sans section ordinaire ni mot d'intensité hors des phrases permises — ${SCENARIOS.length} situations`, async () => {
      for (const [quand, s] of SCENARIOS) {
        const ctx = await contexte(fusion(s, cas.s));
        verifier(ctx, plan(ctx), cas, quand, AUJOURDHUI);
      }
    });
  }

  await test("préconditions des combinaisons : le malaise d'un covid long, la marche-course bloquée et bornée par le kiné, la reprise et la récupération d'après-course existent vraiment", async () => {
    const covid = await contexte(fusion(SCENARIOS.find(([q]) => q.startsWith("bilan du matin"))![1], sit(["covid_long"])));
    assert.equal(covid.malaiseApresEffort, true, "précondition : le covid long n'a pas de malaise après sa sortie d'hier");
    const bloq = await contexte(fusion(SCENARIOS[0][1], EXEMPTES.find((c) => c.nom.includes("30 min au plus"))!.s));
    assert.equal(bloq.cadreSante?.marcheCourse?.bloquee, true, "précondition : la marche-course n'est pas bloquée par 30 min");
    const un = await contexte(fusion(SCENARIOS[0][1], EXEMPTES.find((c) => c.nom.includes("1 sortie au plus"))!.s));
    assert.match(un.text, /au plus 1 fois sur 7 jours/, "la marche-course bornée à 1 sortie par le kiné ne dit pas « au plus 1 »");
    const reprise = await contexte(fusion(SCENARIOS.find(([q]) => q.startsWith("reprise"))![1], sit(["covid_long"])));
    assert.match(reprise.text, /À savoir : .*reprise après \d+ jours sans courir : son plan réduit le volume pour l'instant/, "la reprise ne se dit pas sous cadre");
    const semi = await contexte(fusion(SCENARIOS.find(([q]) => q.startsWith("semi"))![1], sit(["cardiaque"])));
    assert.match(semi.text, /récupération après Course du parc 21\.1 km \(J\+9\) : son plan réduit le volume pour l'instant/, "la récupération ne se dit pas sous cadre");
  });

  await test("marche-course avec deux jours VOISINS seulement : le plan les pose côte à côte, le dossier ne promet pas « jamais deux jours de suite »", async () => {
    const cas: Cas = { nom: "marche-course, mardi et mercredi seulement", s: { profil: { peut_courir_30min: false, days_per_week: 2, available_days: [2, 3] } }, niveau: "sansIntensite" };
    let voisins = 0;
    for (let k = 0; k <= 6; k++) {
      const ctx = await contexte(cas.s, k);
      const p = plan(ctx, k);
      verifier(ctx, p, cas, `${cas.nom} · J+${k}`, ilYa(-k));
      assert.match(ctx.text, /en évitant deux jours de suite quand ses disponibilités le permettent/, `J+${k} : la fréquence de la marche-course ne le dit plus`);
      const dates = p.filter((d) => d.type === "Marche/course").map((d) => Date.parse(d.date)).sort((x, y) => x - y);
      if (dates.some((t, i) => i > 0 && t - dates[i - 1] === 86_400_000)) voisins++;
    }
    assert.ok(voisins > 0, "précondition : le plan ne pose jamais deux marches-courses voisines");
  });

  await test("SEPT JOURS DE DÉPART : chaque situation, avec une course C, un 10 km proche, une reprise et le bilan du matin, garde un dossier fidèle à son plan", async () => {
    const choisis = SCENARIOS.filter(([q]) => /course C|J\+5|reprise|bilan du matin/.test(q));
    for (const cas of EXEMPTES) for (const [quand, s] of choisis) for (let k = 1; k <= 6; k++) {
      const ctx = await contexte(fusion(s, cas.s), k);
      verifier(ctx, plan(ctx, k), cas, `${cas.nom} · ${quand} · J+${k}`, ilYa(-k));
    }
  });

  await test("LE MALAISE DU COVID LONG sur sept jours de départ, croisé avec la marche-course, le feu rouge, le jour de course et le mode poids : le dossier dit ce que le plan pose", async () => {
    let course = 0, repos = 0, ecartee = 0;
    for (let k = 0; k <= 6; k++) {
      const jour = ilYa(-k), hier = ilYa(-k + 1);
      const bilan = { user_id: "u", type: "bilan_matin", created_at: `${jour}T06:00:00Z`, data: { date: jour, fatigue: 5, jambes: 4, stress: 1 } };
      const sortieHier = footing(-k + 1);
      const douleur = { user_id: "u", type: "session_feedback", created_at: `${hier}T18:00:00Z`, data: { rpe: 6, date: hier, pain: ["genou"] } };
      const variantes: [string, Situation][] = [
        ["covid long", sit(["covid_long"], [bilan])],
        ["covid long + marche-course", sit(["covid_long"], [bilan], { peut_courir_30min: false })],
        ["covid long + douleur (feu rouge)", sit(["covid_long"], [bilan, douleur])],
        ["covid long + course A aujourd'hui", sit(["covid_long"], [bilan, objectif(10, k)])],
        ["covid long + course C aujourd'hui", sit(["covid_long"], [bilan, objectif(42.2, 70 + k), planifiee("Foulées du canal", k, 10, "C")])],
        ["covid long + sortie longue posée aujourd'hui (mode poids coupé)", sit(["covid_long"], [bilan, objectif(42.2, 40 + k)], { weight_mode_enabled: false })],
        // Le kiné change la course C en footing (consignes), puis le malaise en repos — sur le plan FINI.
        ["covid long + kiné « 40 min au plus » + course C aujourd'hui", sit(["covid_long"], [bilan, kine({ dureeMaxMin: 40 }), objectif(42.2, 70 + k), planifiee("Foulées du canal", k, 10, "C")])],
        ["covid long + kiné « 2 sorties au plus » + course C aujourd'hui", sit(["covid_long"], [bilan, kine({ seancesMaxSemaine: 2 }), objectif(42.2, 70 + k), planifiee("Foulées du canal", k, 10, "C")])],
        // La marche-course ne pose aucune course : la A du jour non plus.
        ["covid long + marche-course + course A aujourd'hui", sit(["covid_long"], [bilan, objectif(10, k)], { peut_courir_30min: false })],
        // Une B aujourd'hui, la A trois jours plus tard ; une C aujourd'hui écartée par la A deux jours plus tard.
        ["covid long + course B aujourd'hui, A dans 3 jours", sit(["covid_long"], [bilan, objectif(10, k + 3), planifiee("Corrida du port", k, 10, "B")])],
        ["covid long + course C aujourd'hui écartée (A dans 2 jours)", sit(["covid_long"], [bilan, objectif(10, k + 2), planifiee("Foulées du canal", k, 10, "C")])],
        // Le « pourquoi » le plus long d'une course : kiné, feu rouge — le conseil doit survivre à l'enregistrement.
        ["covid long + kiné « 40 min au plus » + douleur + course A aujourd'hui", sit(["covid_long"], [bilan, douleur, kine({ dureeMaxMin: 40 }), objectif(10, k)])],
      ];
      for (const [nom, s] of variantes) {
        const ctx = await contexte({ ...s, seances: [sortieHier, ...FOOTINGS] }, k);
        assert.equal(ctx.malaiseApresEffort, true, `${nom} · J+${k} : précondition, pas de malaise`);
        const p = plan(ctx, k);
        verifier(ctx, p, { nom, s, niveau: "sansIntensite" }, `${nom} · J+${k}`, jour);
        if (p.some((d) => d.date === jour && d.type === "Course")) course++; else repos++;
        if (nom.includes("écartée") && ctx.courseCEcartee?.idx === 0) ecartee++;
        // Le coach le reprend après les ajustements du coureur : la même passe sur une semaine dont le jour 0 a été
        // réécrit (ici en footing) redonne le même jour 0 — la règle vit sur le plan FINI.
        const refait = consignesSurPlan(ctx, p.map((d) => (d.date === jour && d.type !== "Course" ? { ...d, type: "Endurance", title: "Footing", why: "" } : d)), new Date(`${jour}T12:00:00Z`));
        assert.deepEqual(refait.filter((d) => d.date === jour).map((d) => [d.type, d.why]), p.filter((d) => d.date === jour).map((d) => [d.type, sansCourseCEcartee(ctx, [d], new Date(`${jour}T12:00:00Z`))[0].why]),
          `${nom} · J+${k} : le coach, après un ajustement, ne repose pas le malaise sur le jour 0`);
      }
    }
    assert.ok(course >= 7 && repos > 0, `précondition : jours de course (${course}, au moins un par jour de départ) et de repos (${repos}) éprouvés tous deux`);
    assert.ok(ecartee > 0, "précondition : aucune course C écartée le jour même");
    // L'avis médical attendu PRIME sur le malaise : le plan ne pose aucune séance, et son « pourquoi » est le sien.
    for (let k = 0; k <= 6; k++) {
      const jour = ilYa(-k);
      const bilan = { user_id: "u", type: "bilan_matin", created_at: `${jour}T06:00:00Z`, data: { date: jour, fatigue: 5, jambes: 4, stress: 1 } };
      const ctx = await contexte({ ...sit(["covid_long"], [bilan, aptitude]), seances: [footing(-k + 1), ...FOOTINGS] }, k);
      assert.equal(ctx.malaiseApresEffort, true, `avis médical + malaise · J+${k} : précondition`);
      assert.equal(ctx.cadreSante?.niveau, "sansSeance");
      for (const d of plan(ctx, k).filter((x) => x.date === jour)) assert.ok(!d.why.includes(MALAISE_T.fr.why), `avis médical + malaise · J+${k} : le repos du malaise remplace celui de l'avis médical`);
    }
    // La composition par priorité : conseil, accord du kiné, effort contrôlé, feu rouge (entier ou son motif), reste.
    const KINE = Object.fromEntries(LANGUES.map((l) => [l, phraseAccordKine(l, "02/01")])) as Record<Lang, string>;
    // La borne est la coupe de l'ÉCRITURE (lib/ai/autoCoach), pas une constante qui pourrait s'en écarter.
    const coupe = [...codeNu("src/lib/ai/autoCoach.ts").matchAll(/why: (?:d|t)\.why\.slice\(0, (\d+)\)/g)].map((m) => Number(m[1]));
    assert.deepEqual(coupe, [POURQUOI_MAX, POURQUOI_MAX], `la coupe de l'écriture (${coupe.join(", ")}) n'est pas POURQUOI_MAX (${POURQUOI_MAX})`);
    for (const l of LANGUES) for (const motif of ["douleur au genou", "douleur au genou signalée hier, douleur à la hanche, jambes lourdes au réveil et sommeil court"]) {
      assert.ok(KINE[l].includes("02/01"), "précondition");
      const charge = `${PLAN_T[l].courseWhyControle}${PLAN_T[l].courseFeuRouge(motif)}${KINE[l]}`;
      const a = pourquoiCourseMalaise(charge, l);
      assert.ok(a.length <= POURQUOI_MAX, `${l} : ${a.length} caractères`);
      assert.ok(a.startsWith(MALAISE_T[l].course.trim()), `${l} : le conseil n'est pas en tête`);
      assert.ok(a.includes(KINE[l].trim()), `${l} : l'accord du kiné manque (« ${a} »)`);
      assert.ok(a.includes(PLAN_T[l].courseWhyControle), `${l} : l'effort contrôlé manque`);
      assert.ok(a.includes(PLAN_T[l].courseFeuRouge("§").split("§")[0].trim()), `${l} : le feu rouge manque, même réduit à son motif`);
      assert.equal(pourquoiCourseMalaise(a, l), a, `${l} : la composition n'est pas idempotente`);
      assert.ok(a.indexOf(KINE[l].trim()) < a.indexOf(PLAN_T[l].courseWhyControle), `${l} : l'ordre de priorité n'est pas tenu`);
    }
    // Un jour doublé (matin + soir) : UN repos, sans créneau ; une course et un footing du soir : la course seule.
    const jourDouble = (type: string, moment: "matin" | "soir"): PlanDay => ({ date: "2026-12-01", type, title: type, detail: "", why: "", tags: [], confirmed: true, moment });
    const doubleRepos = appliquerMalaise([jourDouble("Endurance", "matin"), jourDouble("Endurance", "soir")], "2026-12-01");
    assert.deepEqual(doubleRepos.map((d) => [d.type, d.moment]), [["Repos", undefined]], "un jour doublé garde deux entrées ou son créneau sous le malaise");
    const doubleCourse = appliquerMalaise([jourDouble("Course", "matin"), jourDouble("Endurance", "soir")], "2026-12-01");
    assert.deepEqual(doubleCourse.map((d) => d.type), ["Course"], "le footing du soir reste à côté de la course d'un jour de malaise");
    // Le conseil du jour de course (décision de Cyprien, 20/11/2026) : ne pas prendre le départ, la décision au coureur,
    // le médecin avant la course suivante — dans les cinq langues, et plus « si tu prends le départ, cours sans forcer ».
    const conseil: Record<Lang, RegExp> = {
      fr: /mieux vaut ne pas prendre le départ aujourd'hui — la décision t'appartient\. Parles-en à ton médecin avant ta prochaine course\.$/,
      en: /it is better not to start today — the decision is yours\. Talk to your doctor before your next race\.$/,
      de: /startest du heute besser nicht — die Entscheidung liegt bei dir\. Sprich vor deinem nächsten Rennen mit deiner Ärztin oder deinem Arzt\.$/,
      es: /mejor no tomar la salida hoy — la decisión es tuya\. Háblalo con tu médico antes de tu próxima carrera\.$/,
      pt: /é melhor não partir hoje — a decisão é tua\. Fala com o teu médico antes da tua próxima prova\.$/,
    };
    for (const l of LANGUES) {
      assert.match(MALAISE_T[l].course, conseil[l], `${l} : le jour de course, le malaise ne conseille plus de renoncer au départ`);
      assert.doesNotMatch(MALAISE_T[l].course, /si tu prends le départ|if you start|wenn du startest|si tomas la salida|se partires/i, `${l} : le conseil d'avant (« si tu prends le départ ») est revenu`);
    }
  });

  await test("LA SECONDE PASSE DU COACH avec de VRAIS ajustements (alléger, décaler, échanger) sur chaque jour : « alléger » ne touche pas une marche-course, et la semaine reste dans le cadre", async () => {
    // Relecteur G, 4e tour : « alléger » une marche-course la remplaçait par un footing continu de 50 min.
    const refus = validerAjustement({ date: "2026-12-01", action: "alleger", texte: "Tes jambes sont lourdes depuis deux jours. Allège la séance d'aujourd'hui pour récupérer avant la suivante." }, { qBudget: 0, typesQualite: [], dates: ["2026-12-01"], raisons: [], types: { "2026-12-01": "Marche/course" } });
    assert.equal(refus.ok ? null : refus.motif, "rien à alléger ce jour-là", "la proposition d'alléger une marche-course est acceptée");
    let mcAllegees = 0, appliques = 0;
    const cas = EXEMPTES.filter((c) => c.niveau !== "sansSeance");
    for (const c of cas) for (let k = 0; k <= 6; k++) {
      const ctx = await contexte(fusion(SCENARIOS[0][1], c.s), k);
      const p = plan(ctx, k), jour = ilYa(-k), t = new Date(`${jour}T12:00:00Z`);
      const o = { from: jour, qBudget: ctx.weekPlan.qBudget, joursCourables: ctx.availability.days.filter((d) => !ctx.skippedWeekdays.includes(d)), warm: ctx.warmCool.warm, cool: ctx.warmCool.cool };
      const dates = [...new Set(p.map((d) => d.date))];
      const typesDe = (dt: string) => Object.fromEntries([[dt, p.find((d) => d.date === dt)?.type ?? ""]]);
      for (const [i, dt] of dates.entries()) for (const a of [
        { date: dt, action: "alleger" as const, types: typesDe(dt), appliqueLe: `${jour}T08:00:00Z` },
        ...(dates[i + 1] ? [{ date: dt, action: "decaler" as const, vers: dates[i + 1], types: { ...typesDe(dt), ...typesDe(dates[i + 1]) }, appliqueLe: `${jour}T08:00:00Z` },
          { date: dt, action: "echanger" as const, vers: dates[i + 1], types: { ...typesDe(dt), ...typesDe(dates[i + 1]) }, appliqueLe: `${jour}T08:00:00Z` }] : []),
      ]) {
        const r = appliquerAjustement(p, a, o);
        if (a.action === "alleger" && /^marche/i.test(a.types[dt])) { mcAllegees++; assert.equal(r.ok, false, `${c.nom} · J+${k} · ${dt} : « alléger » change la marche-course en footing continu`); }
        if (!r.ok) continue;
        appliques++;
        const w = planALaSensation(ctx, avecCourseCEcartee(ctx, consignesSurPlan(ctx, r.week, t), t));
        const quand = `${c.nom} · J+${k} · ${a.action} ${dt}`;
        const courus = w.filter((d) => !NON_COURUS.has(d.type));
        if (c.niveau === "sansIntensite") assert.deepEqual(w.filter((d) => INTENSES.has(d.type)).map((d) => d.type), [], `${quand} : une séance intense`);
        if (ctx.cadreSante!.marcheCourse) assert.deepEqual(courus.filter((d) => d.type !== "Marche/course").map((d) => `${d.type} « ${d.detail.slice(0, 60)} »`), [], `${quand} : une sortie hors de son étape de marche-course`);
        if (ctx.cadreSante!.kine?.dureeMaxMin != null) for (const d of courus.filter((x) => x.type !== "Course" && x.type !== "Vélo")) {
          const min = dureeSeance(d, ctx.allureCalcul ?? ctx.easyPace ?? null);
          assert.ok(min != null && min <= ctx.cadreSante!.kine.dureeMaxMin, `${quand} : ${d.date} ${d.type} dure ${min} min, au-delà du kiné`);
        }
        if (ctx.pilotageSensation) for (const d of w) for (const l of LANGUES) assert.doesNotMatch(texteDe(d, l).detail, /\b(?:FC|HR|HF)\b|FRÉQUENCE CARDIAQUE|HEART RATE|HERZFREQUENZ|\d{1,2}['’]\d{2}/, `${quand} : FC ou allure à la sensation (${l})`);
      }
    }
    assert.ok(mcAllegees > 0 && appliques > 50, `précondition : ${mcAllegees} marches-courses à alléger, ${appliques} ajustements appliqués`);
  });

  await test("marche-course avec un marathon et en obésité de classe 2 : ni avertissement de distance, ni mode poids — son plan ne pose ni sortie longue, ni course, ni vélo, ni alternance 2/1 ; le témoin covid long les a", async () => {
    // Relecteur H, 4e tour : ces deux filtres n'étaient éprouvés par aucune situation.
    const lourd = { weight_kg: 110, weight_mode_enabled: true };
    const temoin = await contexte(sit(["covid_long"], [objectif(42.2, 30)], lourd));
    assert.ok(temoin.objectiveWarnings.some((w) => /DISTANCE/.test(w)), "précondition : le témoin covid long n'a pas d'avertissement de distance pour un marathon à J+30");
    assert.match(temoin.text, /• Mode perte de poids :/, "précondition : le témoin covid long en obésité de classe 2 n'a pas la ligne du mode poids");
    for (const k of [0, 3, 6]) {
      const ctx = await contexte(sit(["covid_long"], [objectif(42.2, 30 + k)], { ...lourd, peut_courir_30min: false }), k);
      assert.ok(ctx.cadreSante?.marcheCourse, "précondition : pas de marche-course");
      assert.deepEqual(ctx.objectiveWarnings.filter((w) => /DISTANCE/.test(w)), [], `J+${k} : avertissement de distance à une marche-course`);
      assert.ok(!ctx.text.includes("• Mode perte de poids :"), `J+${k} : le mode poids est annoncé à une marche-course`);
      verifier(ctx, plan(ctx, k), { nom: "marche-course lourde", s: {}, niveau: "sansIntensite" }, `marche-course, marathon, 110 kg · J+${k}`, ilYa(-k));
    }
  });

  await test("avertissements d'objectif (affichés au coureur) : ni verdict de chrono ni « augmente le volume » sous cadre ; le témoin les a", async () => {
    const s: Situation = { notifications: [objectif(10, 30)] };
    const temoin = await contexte(s);
    assert.ok(temoin.objectiveWarnings.some((w) => /CHRONO TRÈS AMBITIEUX/.test(w)), "précondition : le témoin n'a pas de verdict de chrono");
    assert.ok(temoin.objectiveWarnings.some((w) => /PRÉPARATION INSUFFISANTE/.test(w)), "précondition : le témoin n'a pas l'avertissement de préparation insuffisante");
    let distance = 0;
    for (const cas of EXEMPTES) {
      const ctx = await contexte(fusion(s, cas.s));
      const vus = ctx.objectiveWarnings.filter((w) => /CHRONO|PRÉPARATION INSUFFISANTE|VMA/.test(w));
      assert.deepEqual(vus, [], `${cas.nom} : ${vus.join(" | ")}`);
      if (ctx.cadreSante?.marcheCourse || ctx.cadreSante?.niveau === "sansSeance")
        assert.ok(!ctx.objectiveWarnings.some((w) => /DISTANCE/.test(w)), `${cas.nom} : un avertissement de distance alors que son plan ne pose ni sortie longue ni course`);
      if (ctx.objectiveWarnings.some((w) => /⚠️ DISTANCE : sous son cadre de santé, sa préparation ne l'amènera qu'à une sortie longue de ~\d+ km, quand une course de 10,0 km en demande ~\d+\.$/.test(w))) distance++;
    }
    assert.ok(distance > 0, "sous cadre, la distance hors de portée ne se dit plus du tout");
    // La carte « Objectif » : sous cadre, verdict null (le chrono n'est pas jugé), jamais « rien à signaler ».
    assert.match(codeNu("src/app/api/objective/route.ts"), /ok: ctx\.cadreSante \? null : ctx\.objectiveWarnings\.length === 0/, "sous cadre, la carte Objectif dit « rien à signaler »");
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
    assert.match(weightCoachBlock(p1!), /FORMAT D'ENTRÉE/, "précondition : l'obésité de classe 1 a un format d'entrée");
    assert.ok(!cadre1.includes("FORMAT D'ENTRÉE"), "sous cadre, le format d'entrée du mode poids reste");
  });

  await test("séance du jour par l'IA : mission d'origine pour un coureur ordinaire ; sous cadre, la mission du cadre (aucune séance, malaise, marche-course posée ou bloquée, aucune intensité, seuil bas, sensation, durée)", () => {
    assert.equal(missionSeanceDuJour({ cadreSante: null }), `- Si fatigué (VFC sous la base, sommeil bas, ou TSB très négatif) → récupération / facile.
- Si la course est proche → affûtage (fraîcheur, volume réduit, quelques rappels d'allure).
- Sinon, fais converger vers l'objectif : intègre par moments l'allure spécifique et la distance cible, en respectant le modèle polarisé et le niveau de l'athlète.
- Dose le volume sur le volume hebdomadaire réel et reste prudent si une douleur est signalée.`, "la mission d'un coureur ordinaire a changé");
    const k = { sansIntensite: false, dureeMaxMin: 40, seancesMaxSemaine: null, jusquAu: "2026-12-31", majA: "2026-11-10" };
    const cadreDe = (o: Partial<Parameters<typeof cadreDeSante>[0]>) => cadreDeSante({ avisMedical: false, marcheCourse: null, consignes: null, conditions: [], ...o });
    const m = (o: Partial<Parameters<typeof cadreDeSante>[0]>, malaise = false) => missionSeanceDuJour({ cadreSante: cadreDe(o), malaiseApresEffort: malaise });
    const mc = { etape: 2, total: 11, totalMin: 35 };
    const missions = {
      sansSeance: m({ avisMedical: true }), marche: m({ marcheCourse: mc }), marcheBloquee: m({ marcheCourse: mc, consignes: { ...k, dureeMaxMin: 30 } }),
      covid: m({ conditions: ["covid_long"] }), malaise: m({ conditions: ["covid_long"] }, true),
      cardiaque: m({ conditions: ["cardiaque"] }), grossesse: m({ conditions: ["grossesse"] }), kine: m({ consignes: k }),
    };
    for (const [nom, t] of Object.entries(missions)) {
      assert.doesNotMatch(t, /allure spécifique|rappels d'allure|converger|affûtage|alternance/, `${nom} : « ${t} »`);
      assert.match(t, /CADRE DE SANTÉ \(n'en cite pas le motif\)/, `${nom} : la mission ne dit pas le cadre`);
      assert.doesNotMatch(t, /antécédent cardiaque|maladie cardiaque|grossesse|enceinte|covid|aptitude/i, `${nom} : la mission nomme le motif`);
    }
    assert.match(missions.sansSeance, /AUCUNE séance d'endurance/);
    assert.doesNotMatch(missions.sansSeance, /footing|endurance facile|Si la course est proche/, "avis médical attendu : la mission propose encore de courir");
    assert.match(missions.marche, /si son plan pose une séance aujourd'hui, c'est celle de son étape de marche-course \(2 sur 11\)/);
    assert.match(missions.marcheBloquee, /AUCUNE séance de marche-course cette semaine/);
    assert.match(missions.malaise, /REPOS aujourd'hui/); assert.doesNotMatch(missions.malaise, /Dose le volume|endurance facile/, "malaise : la mission propose encore une séance");
    // Décision de Cyprien (20/11/2026) : une course le jour d'un malaise, mieux vaut ne pas prendre le départ —
    // la mission le dit sans rien affirmer de ce que le plan fait de la course.
    assert.match(missions.malaise, /Si une course tombe aujourd'hui, conseille-lui de ne pas prendre le départ \(la décision lui appartient\)/, "malaise : la mission ne conseille plus de renoncer au départ");
    assert.doesNotMatch(missions.malaise, /son plan la garde|sans jamais forcer/, "malaise : la mission affirme encore que le plan garde la course");
    assert.match(missions.covid, /AUCUNE intensité/); assert.match(missions.kine, /AUCUNE intensité/); assert.match(missions.kine, /40 min au plus/);
    assert.match(missions.cardiaque, /seuil bas/); assert.match(missions.grossesse, /à la sensation/);
  });

  await test("l'enveloppe du dossier sous cadre : le système du coach, l'invite de la séance du jour, la relecture Premium et les routes admin", () => {
    // Un jour de malaise, la course du jour n'est pas relue par le coach avancé (@HeadCoach, 4e tour) : son conseil
    // (« COMMENT réussir CETTE séance ») contredirait celui de ne pas prendre le départ.
    // …celle du JOUR 0 du plan (le jour du malaise), pas `from` (demain quand une séance est déjà enregistrée aujourd'hui).
    assert.match(codeNu("src/lib/ai/relectureServeur.ts"), /const jour0 = o\.week\.reduce\(\(min, d\) => \(d\.date < min \? d\.date : min\), o\.week\[0\]\?\.date \?\? o\.from\);\s*const jours = joursARelire\(o\.week, o\.from\)\.filter\(\(d\) => !\(o\.ctx\.malaiseApresEffort && d\.date === jour0\)\);/, "la relecture Premium relit la course d'un jour de malaise (ou écarte celle de demain)");
    // Le système ordinaire, mot pour mot ; celui du cadre, sans un mot d'intensité.
    assert.equal(systemeCoach({ cadreSante: null }), COACH_SYSTEM);
    assert.match(COACH_SYSTEM, /ose la qualité/, "précondition : le système ordinaire pousse à la qualité");
    const cadre = cadreDeSante({ avisMedical: false, marcheCourse: null, consignes: null, conditions: ["grossesse"] })!;
    assert.equal(systemeCoach({ cadreSante: cadre }), COACH_SYSTEM_CADRE);
    assert.doesNotMatch(COACH_SYSTEM_CADRE, INTENSITE, `le système du cadre : « ${COACH_SYSTEM_CADRE.match(INTENSITE)?.[0]} »`);
    // L'invite de la séance du jour : celle d'avant pour un coureur ordinaire, mot pour mot.
    const ordinaire = { text: "DOSSIER", cadreSante: null };
    assert.equal(inviteSeanceDuJour(ordinaire, "lundi"), `${COACH_SYSTEM}

VOICI L'ATHLÈTE (analyse CHAQUE ligne) :
DOSSIER

MISSION : recommande LA séance-clé à faire AUJOURD'HUI (lundi), parfaitement calibrée sur sa forme du jour, sa charge et son objectif de course.
${missionSeanceDuJour(ordinaire)}

Réponds UNIQUEMENT par un objet JSON valide (aucun texte autour) :
{"title":"nom court de la séance","subtitle":"description concrète : structure, allure/zone, durée/distance","tags":["2 à 3 tags très courts ex Z2, 10 km, VMA, Allure marathon"],"why":"1 phrase de justification personnalisée citant une donnée clé FOURNIE ci-dessus (sommeil, charge, objectif, ou VFC si elle y figure) — jamais une donnée absente"}`, "l'invite d'un coureur ordinaire a changé");
    const sous = inviteSeanceDuJour({ text: "DOSSIER", cadreSante: cadre }, "lundi");
    assert.ok(sous.startsWith(COACH_SYSTEM_CADRE), "sous cadre, l'invite ne commence pas par le système du cadre");
    for (const interdit of ["séance-clé", "objectif de course", "allure/zone", "VMA, Allure marathon", COACH_SYSTEM])
      assert.ok(!sous.includes(interdit), `sous cadre, l'invite garde « ${interdit.slice(0, 40)} »`);
    assert.match(sous, /structure et durée, à la sensation/);
    assert.match(inviteSeanceDuJour({ text: "D", cadreSante: cadreDeSante({ avisMedical: true, marcheCourse: null, consignes: null, conditions: [] }) }, "lundi"), /ex Repos, Mobilité, Renfo doux/, "avis médical attendu : l'exemple d'étiquettes propose de l'endurance");
    // La route, la relecture et les routes admin passent par ces fonctions, ou refusent sous cadre.
    assert.match(codeNu("src/app/api/ai/session/route.ts"), /const prompt = inviteSeanceDuJour\(ctx, jour\);/, "la route ne passe plus par l'invite");
    assert.doesNotMatch(codeNu("src/app/api/ai/session/route.ts"), /COACH_SYSTEM/, "la route écrit encore son propre système");
    assert.match(codeNu("src/lib/ai/relectureServeur.ts"), /systeme: systemeCoach\(o\.ctx\)/, "la relecture Premium garde le système ordinaire");
    for (const r of ["src/app/api/admin/analyze-session/route.ts", "src/app/api/admin/generate-plan/route.ts"]) {
      const src = codeNu(r);
      const garde = src.indexOf("if (ctx.cadreSante) return NextResponse.json(");
      const contexteLu = src.indexOf("const ctx = await buildAthleteContext(");
      const appel = src.slice(contexteLu).search(/fetch\((gUrl|GEMINI_URL)\(|\bgem\("gemini/);
      assert.ok(contexteLu > 0 && garde > contexteLu, `${r} : pas de refus sous cadre après le contexte`);
      assert.ok(appel > 0 && garde < contexteLu + appel, `${r} : le refus vient après l'appel à l'IA qui suit le contexte`);
      const illisible = src.indexOf("if (!ctx) return NextResponse.json(");
      assert.ok(illisible > contexteLu && illisible < contexteLu + appel, `${r} : contexte illisible, l'IA rédige quand même un plan`);
    }
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
