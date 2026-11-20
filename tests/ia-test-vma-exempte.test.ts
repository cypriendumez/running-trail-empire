/**
 * LE DOSSIER ENVOYÉ À L'IA NE RECOMMANDE PAS LE TEST VMA À UN COUREUR EXEMPTÉ (19/11/2026).
 *
 * `buildAthleteContext` rédige le dossier (`ctx.text`) que lisent les fonctions IA qui « parlent »
 * (séance-clé du jour, analyse de séance, chat des cours…). Deux de ses lignes invitaient au test à
 * TOUS les coureurs — y compris ceux à qui le même dossier l'interdisait plus loin : avis d'un médecin
 * attendu (questionnaire d'aptitude), programme marche-course, effort maximal interdit par les
 * antécédents (cardiaque, covid long, grossesse), consignes du kiné « sans intensité » ou « durée
 * maximale » :
 *  · la ligne « VMA », pour une VMA estimée : « recommande-lui un test VMA pour affiner » ;
 *  · la ligne « athlète sans historique » (l'état d'entrée de tout débutant) : « propose-lui un test
 *    simple (par exemple 6 min à effort maximal régulier) » (@HeadCoach, relecteurs, tour 1) ;
 *  · la PALETTE DE SÉANCES où l'IA « pioche » : Test VMA (demi-Cooper) 6 min à fond, Cooper 12 min,
 *    chronos, VO2max, sprints à fond (tour 2).
 * Chaque situation est donc éprouvée AVEC des séances (VMA estimée) et SANS AUCUNE séance, et le test est
 * cherché par SES PROPRES MOTS dans tout le dossier, avec un témoin : un coureur ordinaire les lit bien.
 *
 *   npx tsx tests/ia-test-vma-exempte.test.ts
 */
process.env.TZ = "UTC";
import assert from "node:assert/strict";
import { buildAthleteContext } from "../src/lib/ai/coachContext";
import { WORKOUT_LIBRARY, estEffortMaximal, horsPlafond } from "../src/data/workoutLibrary";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}

type Ligne = Record<string, unknown>;
/** Faux client PostgREST (lectures) : eq, gte, lte, order, limit, single, maybeSingle. */
function fauxClient(tables: Record<string, Ligne[]>) {
  const requete = (toutes: Ligne[]) => {
    let lignes = [...toutes]; let tri: [string, boolean] | null = null; let lim: number | null = null;
    const q: Record<string, unknown> = {};
    const cmp = (op: (a: string, b: string) => boolean) => (c: string, v: unknown) => {
      lignes = lignes.filter((l) => !(c in l) || (l[c] != null && op(String(l[c]), String(v)))); return q;
    };
    for (const m of ["not", "ilike", "or", "neq", "is", "select"]) q[m] = () => q;
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
/** Un jour fixe, passé à `Date` : le dossier se rédige au jour du coureur. */
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

const J = "2026-11-18", MATIN = "2026-11-18T08:00:00Z";
const profil = (o: Ligne = {}) => ({ id: "u", preferred_language: "fr", full_name: "Test", age: 32, gender: "male", weight_kg: 70, max_hr: 188, resting_hr: 50,
  days_per_week: 5, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true, garmin_metrics: null,
  pace_curve: null, garmin_vo2max: null, last_lat: null, last_lon: null, ...o });
/** Des footings seuls (aucun effort à ≥ 85 % de la FC max) : la VMA est ESTIMÉE depuis les sorties. */
const footings = [3, 6, 9, 12, 15, 18, 21, 24].map((n) => ({ user_id: "u", date: jourMoins(J, n), type: "easy", sport: "run",
  distance_km: 8, duration_seconds: 2700, avg_hr: 124, max_hr: 140, tss: 40 }));
const aptitude = (oui: string[]) => ({ user_id: "u", type: "aptitude", created_at: "2026-11-01T10:00:00Z", data: { oui, date: "2026-11-01", avisMedecin: null } });

/** Les consignes du kiné en vigueur (`lib/health/consignesKine`), jusqu'à la fin de l'année. */
const consignesKine = (o: Ligne) => ({ user_id: "u", type: "consignes_kine", created_at: "2026-11-10T10:00:00Z",
  data: { dureeMaxMin: null, sansIntensite: false, seancesMaxSemaine: null, jusquAu: "2026-12-31", majA: "2026-11-10", ...o } });

type Situation = { profil?: Ligne; notifications?: Ligne[]; baselines?: Ligne[]; sansSeance?: boolean; seances?: Ligne[] };
async function dossier(o: Situation = {}) {
  return aLInstant(MATIN, async () => {
    const ctx = await buildAthleteContext(fauxClient({ profiles: [profil(o.profil)], performance_baselines: o.baselines ?? [],
      workouts: o.sansSeance ? [] : o.seances ?? footings, notifications: o.notifications ?? [] }), "u");
    const ligne = (debut: string) => ctx.text.split("\n").find((l) => l.startsWith(debut)) ?? "";
    return { ctx, text: ctx.text, ligneVma: ligne("- VMA : "), ligneNeuf: ligne("- 🆕 ATHLÈTE SANS HISTORIQUE") };
  });
}
/** Ce que l'IA ne doit pas lire pour un exempté : une invitation au test, le test lui-même (ses mots propres :
 *  « à fond », Cooper, la catégorie « Test / évaluation »), ou une séance VO2max de la palette. */
const INVITE_TEST = /recommande-lui un test|propose-lui un test|fais(-lui)? (faire )?un test VMA|test VMA pour affiner|6 min à effort maximal|à fond|Cooper|Test \/ évaluation|^• VO2max :/im;
/** Le motif de l'exemption : la consigne ne le dit pas (aucune donnée de santé de plus vers le modèle). */
const MOTIF = /médecin|aptitude|cardiaque|covid|grossesse|marche-course|kiné/i;

async function main() {
  console.log("\nLE DOSSIER DE L'IA NE RECOMMANDE PAS LE TEST VMA À UN EXEMPTÉ");

  await test("estEffortMaximal : chaque test, chaque VO2max, toute zone 5, l'allure de course, « à fond », les lignes droites ; ni la cadence, ni le seuil, ni le tempo, ni les côtes longues, ni le footing", () => {
    const seance = (id: string) => { const w = WORKOUT_LIBRARY.find((x) => x.id === id); assert.ok(w, `séance ${id} absente de la bibliothèque`); return w!; };
    // Chaque partie de la règle, seule : un test SANS « à fond » (seuil 30 min), un « à fond » HORS test (sprints).
    assert.equal(estEffortMaximal(seance("test-seuil")), true, "le test de seuil (30 min contre la montre) n'est plus un effort maximal");
    assert.doesNotMatch(seance("test-seuil").structure, /à fond/i, "précondition : le test de seuil ne dit pas « à fond »");
    assert.equal(estEffortMaximal(seance("spd-flying")), true, "les sprints lancés (« à fond ») ne sont plus un effort maximal");
    assert.equal(estEffortMaximal(seance("spd-hillsprint")), true, "les sprints en côte (« à fond ») ne sont plus un effort maximal");
    assert.notEqual(seance("spd-flying").category, "test", "précondition : les sprints ne sont pas un test");
    for (const w of WORKOUT_LIBRARY.filter((x) => x.category === "test" || x.category === "vo2max"))
      assert.equal(estEffortMaximal(w), true, `${w.name} (${w.category}) n'est plus un effort maximal`);
    // Juger sur l'INTENSITÉ (la zone), pas sur l'étiquette : le même travail vit sous d'autres catégories (@HeadCoach).
    for (const id of ["hill-short", "hill-mid", "rs-5k", "spd-fartlek", "spd-fartlek-struct", "thr-mona", "rs-10k-cutdown", "tr-kv", "hill-fartlek", "spd-inout", "test-5k"]) {
      assert.notEqual(seance(id).category, "vo2max", `précondition : ${id} n'est pas rangée en VO2max`);
      assert.equal(estEffortMaximal(seance(id)), true, `${seance(id).name} (${seance(id).zone}) n'est plus écartée`);
    }
    // Les lignes droites (Z5+) aussi, seules ou dans un footing : le plan de ces coureurs les retire (PR 63).
    for (const id of ["spd-strides", "end-strides"]) assert.equal(estEffortMaximal(seance(id)), true, `${seance(id).name} n'est plus écartée`);
    for (const w of WORKOUT_LIBRARY.filter((x) => /Z5/.test(x.zone))) assert.equal(estEffortMaximal(w), true, `${w.name} (${w.zone}) n'est plus écartée`);
    for (const id of ["spd-cadence", "end-fond", "seuil-long", "tempo-cont", "hill-long", "hill-tempo", "env-incline"])
      assert.equal(estEffortMaximal(seance(id)), false, `${seance(id).name} (${seance(id).zone}) est comptée comme un effort maximal`);
  });

  await test("coureur ordinaire, VMA estimée : le test VMA lui est recommandé, comme avant", async () => {
    const { ligneVma, ctx } = await dossier();
    assert.equal(ctx.marcheCourse ?? null, null, "précondition : pas de marche-course");
    assert.equal(ctx.aptitude?.attente, false, "précondition : aucun avis médical attendu");
    assert.match(ligneVma, /ESTIMÉE depuis ses séances/, `précondition : VMA estimée (« ${ligneVma} »)`);
    assert.match(ligneVma, /recommande-lui un test VMA pour affiner/, `le coureur ordinaire n'est plus invité au test (« ${ligneVma} »)`);
  });

  await test("TÉMOIN — coureur ordinaire : sa palette garde le test, le VO2max et les sprints (les mots que l'on cherche y sont)", async () => {
    const { text } = await dossier();
    assert.match(text, /PALETTE DE SÉANCES/, "précondition : la palette est dans le dossier");
    assert.match(text, /Test VMA \(demi-Cooper\)/, "le coureur ordinaire n'a plus le test VMA dans sa palette");
    assert.match(text, /Test Cooper \(12 min\)/, "le coureur ordinaire n'a plus le Cooper dans sa palette");
    assert.match(text, /^• VO2max :/m, "le coureur ordinaire n'a plus le VO2max dans sa palette");
    assert.match(text, /à fond/, "le coureur ordinaire n'a plus de séance « à fond » dans sa palette");
    assert.match(text, INVITE_TEST, "l'expression ne reconnaît plus le test dans le dossier d'un coureur ordinaire");
  });

  await test("coureur ordinaire SANS AUCUNE SÉANCE : le test simple lui est proposé, comme avant", async () => {
    const { ligneNeuf } = await dossier({ sansSeance: true });
    assert.ok(ligneNeuf, "précondition : la ligne « athlète sans historique » est absente du dossier");
    assert.match(ligneNeuf, /propose-lui un test simple \(par exemple 6 min à effort maximal régulier\)/, `le coureur ordinaire n'est plus invité au test (« ${ligneNeuf} »)`);
  });

  const exemptes: [string, Situation][] = [
    ["avis d'un médecin attendu (questionnaire d'aptitude)", { notifications: [aptitude(["poitrine"])] }],
    ["programme marche-course", { profil: { peut_courir_30min: false } }],
    ["effort maximal interdit (antécédent cardiaque)", { profil: { health_conditions: ["cardiaque"] } }],
    ["effort maximal interdit (covid long)", { profil: { health_conditions: ["covid_long"] } }],
    ["effort maximal interdit (grossesse)", { profil: { health_conditions: ["grossesse"] } }],
    ["consignes du kiné « sans intensité »", { notifications: [consignesKine({ sansIntensite: true })] }],
    ["consignes du kiné « durée maximale »", { notifications: [consignesKine({ dureeMaxMin: 40 })] }],
  ];
  for (const [nom, o] of exemptes) {
    await test(`${nom}, VMA estimée : ni test ni effort maximal dans tout le dossier (palette comprise), et la consigne de ne pas le proposer`, async () => {
      const { ligneVma, text } = await dossier(o);
      assert.match(ligneVma, /ESTIMÉE depuis ses séances/, `précondition : VMA estimée (« ${ligneVma} »)`);
      assert.match(text, /PALETTE DE SÉANCES/, "précondition : la palette est dans le dossier");
      assert.match(text, /^• Endurance :/m, "précondition : la palette garde les séances faciles");
      const vu = text.match(INVITE_TEST)?.[0];
      assert.equal(vu, undefined, `le dossier d'un coureur exempté propose encore le test ou un effort maximal (« ${vu} »)`);
      assert.match(ligneVma, /ne lui propose PAS de test VMA ni aucun effort maximal/, `la consigne de ne pas proposer le test manque (« ${ligneVma} »)`);
      // Aucune donnée de santé de plus vers le modèle : la ligne ne dit pas POURQUOI il est exempté.
      assert.doesNotMatch(ligneVma, MOTIF, `la ligne VMA dévoile le motif de l'exemption (« ${ligneVma} »)`);
    });
    await test(`${nom}, SANS AUCUNE SÉANCE : aucune invitation au test dans tout le dossier`, async () => {
      const { ligneNeuf, text } = await dossier({ ...o, sansSeance: true });
      assert.ok(ligneNeuf, "précondition : la ligne « athlète sans historique » est absente du dossier");
      assert.doesNotMatch(text, INVITE_TEST, `l'IA est invitée à proposer un test à un débutant exempté (« ${ligneNeuf} »)`);
      assert.match(ligneNeuf, /Ne lui propose ni test ni effort maximal/, `la consigne de ne pas proposer le test manque (« ${ligneNeuf} »)`);
      assert.doesNotMatch(ligneNeuf, MOTIF, `la ligne « sans historique » dévoile le motif de l'exemption (« ${ligneNeuf} »)`);
    });
  }

  await test("palette avec un OBJECTIF (10 km, trail), niveaux intermédiaire et confirmé : aucune séance d'effort maximal ou de zone 5 nommée ; le témoin en a", async () => {
    // Sans objectif, la palette « générale » ne contient pas ces séances : le test d'avant ne les voyait pas (@HeadCoach).
    const interdites = WORKOUT_LIBRARY.filter(estEffortMaximal).map((w) => w.name);
    const objectifCourse = (km: number, race: string) => ({ user_id: "u", type: "race_objective", created_at: "2026-11-01T10:00:00Z",
      data: { race, raceDate: "2027-02-14", distanceKm: km, targetTime: "45:00", targetSeconds: 2700, targetPace: "4'30/km" } });
    const cas: [number, number, string][] = [[15, 10, "10 km de test"], [18, 10, "10 km de test"], [15, 55, "Trail de test 55 km"], [18, 55, "Trail de test 55 km"]];
    for (const [vma, km, race] of cas) {
      const lire = (o: Situation) => dossier({ ...o, baselines: [{ user_id: "u", vma_kmh: vma, tested_at: "2026-10-01T10:00:00Z", max_hr: 188, resting_hr: 50 }],
        notifications: [...(o.notifications ?? []), objectifCourse(km, race)] });
      const temoin = await lire({});
      assert.ok(interdites.some((n) => temoin.text.includes(n)), `précondition (VMA ${vma}, ${race}) : le témoin n'a aucune séance de zone 5 dans sa palette`);
      for (const [nom, o] of exemptes) {
        const { text } = await lire(o);
        const vues = interdites.filter((n) => text.includes(n));
        assert.deepEqual(vues, [], `${nom} (VMA ${vma}, ${race}) : ${vues.join(", ")}`);
      }
    }
  });

  await test("horsPlafond lit la ZONE ET LA STRUCTURE : « aucune » écarte tout ce qui monte en Z3 ; « seuil bas » écarte la Z4, le travail au seuil, l'allure de course et l'over-under ; « normal » ne touche à rien", () => {
    const seance = (id: string) => { const w = WORKOUT_LIBRARY.find((x) => x.id === id); assert.ok(w, `séance ${id} absente`); return w!; };
    for (const id of ["tempo-cont", "seuil-long", "hill-long", "hill-tempo", "env-incline", "rs-marathon-blocks"])
      assert.equal(horsPlafond(seance(id), "aucune"), true, `« aucune » garde ${seance(id).name} (${seance(id).zone})`);
    for (const id of ["end-fond", "long-classic", "rec-easy", "beg-walkrun", "beg-continu", "cr-swim"])
      assert.equal(horsPlafond(seance(id), "aucune"), false, `« aucune » retire ${seance(id).name} (${seance(id).zone})`);
    // La zone dit « Z2 », la STRUCTURE monte en Z3 ou se court à l'allure marathon (relecteurs, tour 5).
    for (const id of ["end-prog", "end-bialure", "long-trail", "long-mp"]) {
      assert.doesNotMatch(seance(id).zone, /Z[3-5]/, `précondition : la zone de ${id} ne dit rien de l'intensité`);
      assert.equal(horsPlafond(seance(id), "aucune"), true, `« aucune » garde ${seance(id).name} (${seance(id).structure})`);
    }
    // Une préparation spécifique « à l'effort cible », zone Z2 : écartée sous les deux plafonds.
    assert.equal(seance("rs-ultra-effort").zone, "Z2", "précondition : la zone de rs-ultra-effort est Z2");
    for (const p of ["aucune", "seuilBas"] as const) assert.equal(horsPlafond(seance("rs-ultra-effort"), p), true, `« ${p} » garde la préparation à l'effort cible`);
    for (const w of WORKOUT_LIBRARY.filter((x) => /Z[3-5]/.test(`${x.zone} ${x.structure}`))) assert.equal(horsPlafond(w, "aucune"), true, `« aucune » garde ${w.name} (${w.zone} · ${w.structure.slice(0, 60)})`);
    for (const id of ["rs-5k", "thr-overunder", "rs-marathon-blocks", "long-mp", "thr-2x20", "seuil-long", "thr-broken", "seuil-ladder", "tempo-surges", "long-seuil", "hill-long", "tr-vertical", "cr-aqua-quality", "hill-downhill", "tempo-cont"])
      assert.equal(horsPlafond(seance(id), "seuilBas"), true, `« seuil bas » garde ${seance(id).name} (${seance(id).zone})`);
    // Du seuil, du tempo, du VO2max ou de la vitesse sans zone écrite : écartés par leur catégorie sans intensité permise.
    for (const category of ["tempo", "threshold", "vo2max", "speed"] as const)
      assert.equal(horsPlafond({ id: "x", category, zone: "Z2", structure: "20 min régulier" }, "aucune"), true, `« aucune » garde une séance « ${category} » sans zone écrite`);
    // Une préparation spécifique sans zone ni allure écrites : écartée par sa catégorie.
    for (const p of ["aucune", "seuilBas"] as const) assert.equal(horsPlafond({ id: "x", category: "race_specific", zone: "Z2", structure: "60 min à l'aise sur le parcours" }, p), true, `« ${p} » garde une préparation spécifique`);
    // « Au seuil » sans zone écrite : écarté aussi.
    assert.equal(horsPlafond({ id: "x", category: "endurance", zone: "Z2", structure: "45 min dont 3 × 5 min au seuil" }, "seuilBas"), true, "« seuil bas » garde du travail « au seuil » sans zone écrite");
    for (const w of WORKOUT_LIBRARY.filter((x) => /Z[45]/.test(`${x.zone} ${x.structure}`))) assert.equal(horsPlafond(w, "seuilBas"), true, `« seuil bas » garde ${w.name} (${w.zone} · ${w.structure.slice(0, 60)})`);
    // Le seuil bas garde ce qui reste SOUS le seuil : la Z3 pure, les progressions, l'endurance.
    assert.match(seance("env-incline").structure, /Z3-Z4/, "précondition : le tapis incliné monte en Z4 dans sa structure");
    assert.equal(horsPlafond(seance("env-incline"), "seuilBas"), true, "« seuil bas » garde le tapis incliné (Z4 dans sa structure)");
    for (const id of ["end-fond", "long-prog", "end-prog", "end-bialure", "long-trail", "spd-cadence"])
      assert.equal(horsPlafond(seance(id), "seuilBas"), false, `« seuil bas » retire ${seance(id).name} (${seance(id).zone})`);
    for (const w of WORKOUT_LIBRARY) assert.equal(horsPlafond(w, "normal"), false, `« normal » retire ${w.name}`);
  });

  await test("TOUT LE DOSSIER, sans objectif et avec un objectif à J+88 et J+53, dénivelé « spécialiste » : aucune ligne n'invite un exempté à l'intensité ; le témoin, si", async () => {
    // Le vocabulaire qui PRESCRIT de l'intensité, cherché ligne par ligne — sauf dans les lignes qui l'INTERDISENT.
    const PRESCRIT = /VMA courte|développement progressif de la VMA|VMA, seuil, côtes|2 qualités\/sem|2-3 qualités|1-2 qualités|jamais 100 ?% facile|refuse-le|enchaîne la qualité|côtes courtes|lignes droites|explosiv|avec un bloc à|30\/30/i;
    const INTERDIT = /⛔|ne lui propose|ni VMA|INTERDIT|AUCUNE séance de qualité ni test|ni côtes courtes|cadre de santé/i;
    const prescrit = (text: string) => text.split("\n").filter((l) => !INTERDIT.test(l) && PRESCRIT.test(l));
    const objectifCourse = (km: number, date: string) => ({ user_id: "u", type: "race_objective", created_at: "2026-11-01T10:00:00Z",
      data: { race: `Course de test ${km} km`, raceDate: date, distanceKm: km, targetTime: "45:00", targetSeconds: 2700, targetPace: "4'30/km" } });
    const objectifs: [string, Ligne[]][] = [["sans objectif", []], ["10 km à J+88", [objectifCourse(10, "2027-02-14")]], ["10 km à J+53", [objectifCourse(10, "2027-01-10")]], ["5 km à J+53", [objectifCourse(5, "2027-01-10")]], ["10 km à J+30 (phase spécifique)", [objectifCourse(10, "2026-12-18")]], ["marathon à J+30", [objectifCourse(42.2, "2026-12-18")]]];
    const plafondDe: Record<string, "aucune" | "seuilBas"> = {};
    for (const [quand, objectif] of objectifs) {
      const lire = (o: Situation) => dossier({ ...o, profil: { ...(o.profil ?? {}), elevation_pref: "specialiste", pace_curve: { criticalSpeed: 4.0 } }, notifications: [...(o.notifications ?? []), ...objectif] });
      const temoin = await lire({});
      assert.ok(prescrit(temoin.text).length > 0, `précondition (${quand}) : le dossier du témoin ne prescrit aucune intensité`);
      // Vitesse critique à plus de 93 % de la VMA : le facteur limitant « vitesse » (« VMA courte, 30/30 ») se déclenche.
      assert.match(temoin.text, /VITESSE PURE/, `précondition (${quand}) : le facteur limitant « vitesse » ne se déclenche pas`);
      for (const [nom, o] of exemptes) {
        const { text } = await lire(o);
        const vues = prescrit(text);
        assert.deepEqual(vues.map((l) => l.slice(0, 140)), [], `${nom} (${quand}) : le dossier prescrit encore de l'intensité : ${vues.map((l) => l.slice(0, 160)).join(" | ")}`);
        // La palette, selon le plafond : « aucune » n'a rien en Z3 ou au-delà, « seuil bas » pas d'allure de course.
        // Covid long : « aucune intensité », plus « le développement passe par le seuil bas » (@HeadCoach).
        if (/covid/.test(nom)) {
          assert.match(text, /Aucune intensité : de l'endurance facile seulement/, `${nom} (${quand}) : la ligne d'effort maximal ne dit pas « aucune intensité »`);
          assert.doesNotMatch(text, /passe par le volume et le seuil bas/, `${nom} (${quand}) : le seuil bas est proposé à un covid long`);
        }
        const plafond = /cardiaque|grossesse/.test(nom) ? "seuilBas" : "aucune";
        // La phase dit le plafond du PLAN : un seuil bas pour cardiaque et grossesse, aucune qualité sinon.
        assert.match(text, plafond === "seuilBas" ? /Phase d'entraînement recommandée : SEUIL BAS AU PLUS/ : /Phase d'entraînement recommandée : AUCUNE QUALITÉ/,
          `${nom} (${quand}) : la phase ne dit pas le plafond « ${plafond} »`);
        plafondDe[nom] = plafond;
        const horsPalette = WORKOUT_LIBRARY.filter((w) => horsPlafond(w, plafond)).map((w) => w.name).filter((n) => text.includes(`${n} [`));
        assert.deepEqual(horsPalette, [], `${nom} (${quand}) : la palette dépasse le plafond « ${plafond} »`);
      }
    }
    assert.ok(Object.values(plafondDe).includes("aucune") && Object.values(plafondDe).includes("seuilBas"), "précondition : les deux plafonds sont éprouvés");
  });

  await test("UN DOSSIER QUI DÉCLENCHE TOUT (tour 5) : fraîcheur, âge, passif, objectif ambitieux, affûtage, seuil mesuré, dernière série accélérée, dérive, cadence, répartition, cycle, perte de poids, monotonie, plateau — rien ne pousse un exempté à l'intensité ; le témoin a chacune de ces lignes", async () => {
    // Le vocabulaire qui pousse à l'intensité, cherché ligne par ligne — sauf dans les lignes qui l'interdisent.
    const PRESCRIT = new RegExp([
      "VMA courte", "développement progressif de la VMA", "VMA, seuil, côtes", "qualités/sem", "refuse-le", "enchaîne la qualité", "côtes courtes", "lignes droites", "explosiv", "avec un bloc à", "30/30",
      "tu peux durcir", "durcir le spécifique", "Ne sous-dose pas", "garde la qualité", "\\boser\\b", "blocs denses", "doubles séances", "travail de VMA", "bloc (?:de )?VMA", "séances VMA",
      "on garde l'intensité", "VOLUME au seuil", "UTILISE CETTE VALEUR", "CHANGE le stimulus", "GAMMES", "ne progressera pas sans qualité", "varier? l'intensité", "folliculaire",
      "adapte l'intensité", "un peu soutenue", "Entraînement classique", "qualité maximum", "allure de course", "(?<!jamais d'|AUCUNE )allure cible", "recherche de vitesse", "périodisation classique",
      "\\d séances de qualité(?! d'affilée)", "qualité en pâtit", "qualité chiffrée", "travail calibré", "Travaille la montée", "chercher des côtes", "Privilégie le seuil", "plus ambitieux", "spécificité", "Temps visé",
    ].join("|"), "i");
    const INTERDIT = /⛔|ne lui propose|ni VMA|INTERDIT|AUCUNE séance de qualité ni test|ni côtes courtes|cadre de santé/i;
    const prescrit = (text: string) => text.split("\n").filter((l) => !INTERDIT.test(l) && PRESCRIT.test(l));
    // Ce qui ne s'écrit JAMAIS pour un exempté, pas même dans une ligne qui parle par ailleurs du cadre de santé
    // (la ligne de la dernière série porte deux phrases : l'une pouvait masquer l'autre).
    const JAMAIS = /tu peux durcir|Ne sous-dose pas|garde la qualité|\boser\b|VOLUME au seuil|UTILISE CETTE VALEUR|CHANGE le stimulus|pousser en folliculaire|on garde l'intensité|recherche de vitesse|GROS travail de VMA|bloc de VMA/i;
    const objectifCourse = (km: number, date: string) => ({ user_id: "u", type: "race_objective", created_at: "2026-11-01T10:00:00Z",
      data: { race: `Course de test ${km} km`, raceDate: date, distanceKm: km, targetTime: "36:00", targetSeconds: 2160, targetPace: "3'36/km" } });
    // Des footings qui portent leur cadence (basse), leur dérive (faible) et leur temps en zone (tout en Z1-Z2).
    const footingsMesures = footings.map((w) => ({ ...w, avg_cadence_spm: 160, cardiac_decoupling: 2, hr_zone_seconds: [1500, 1200, 0, 0, 0] }));
    // Une charge identique chaque jour de la semaine (monotonie) qui monte (plateau, avec une VMA plate sur 33 jours).
    const quotidiens = [0, 1, 2, 4, 5].map((n) => ({ user_id: "u", date: jourMoins(J, n), type: "easy", sport: "run", distance_km: 8, duration_seconds: 2700, avg_hr: 124, max_hr: 140, tss: 40 }));
    const tousLesJours = Array.from({ length: 60 }, (_, n) => ({ user_id: "u", date: jourMoins(J, n), type: "easy", sport: "run", distance_km: 8, duration_seconds: 2700, avg_hr: 124, max_hr: 140, tss: 40 }));
    const plateVma = [35, 20, 2].map((n, i) => ({ at: `${jourMoins(J, n)}T10:00:00Z`, vma: 14 + i * 0.01 }));
    const scenarios: [string, Situation, RegExp[]][] = [
      ["10 km à J+30", { seances: footingsMesures, notifications: [objectifCourse(10, "2026-12-18")] },
        [/Ne sous-dose pas/, /\boser le volume et la densité/, /oser des blocs denses/, /GROS travail de VMA/, /gros bloc de VMA/, /Temps visé/, /VOLUME au seuil/, /UTILISE CETTE VALEUR/,
          /tu peux durcir la prochaine/, /tu peux durcir \(allure ou volume/, /tu peux durcir le spécifique/, /6-8 lignes droites/, /ne progressera pas sans qualité/, /pousser en folliculaire/,
          /^ENTRAÎNEMENT — /m, /idéale pour la qualité chiffrée/, /pratique pour le travail calibré/, /Travaille la montée \(côtes longues/, /aller chercher des côtes/]],
      // La nutrition du jour de course ne se pose que sur une course longue (un 10 km n'en a pas).
      ["marathon à J+30", { seances: footingsMesures, notifications: [objectifCourse(42.2, "2026-12-18")] }, [/testé en sortie longue, à l'allure de course/]],
      ["10 km à J+5 (affûtage)", { seances: footingsMesures, notifications: [objectifCourse(10, "2026-11-23")] }, [/on garde l'intensité pour arriver frais/]],
      // Sans suivi du cycle, et une dérive cardiaque forte sur ses footings.
      ["sans objectif, charge monotone, VMA en plateau, 45 ans", { seances: [...footings.map((w) => ({ ...w, cardiac_decoupling: 9 })), ...quotidiens], profil: { age: 45, is_female_cycle_sync: false } },
        [/trop uniforme → varie l'intensité/, /Monotonie élevée → varier l'intensité/, /CHANGE le stimulus/, /2 séances de qualité bien récupérées/,
          /si elle synchronise son cycle, adapte l'intensité selon la phase/, /AVANT toute recherche de vitesse/]],
      // Des footings courus à 44 % du temps en Z3+ : le facteur limitant « discipline ».
      ["footings courus trop vite", { seances: footings.map((w) => ({ ...w, hr_zone_seconds: [600, 900, 900, 300, 0] })) }, [/sa qualité en pâtit/]],
      // Deux signaux orange (charge identique chaque jour depuis deux mois, dernier ressenti à 9/10) sans signal rouge.
      ["verdict orange (charge monotone, ressenti 9/10)", { seances: tousLesJours, notifications: [{ user_id: "u", type: "session_feedback", created_at: `${jourMoins(J, 1)}T18:00:00Z`, data: { rpe: 9, date: jourMoins(J, 1) } }] },
        [/🟠 ORANGE — Séance allégée : garde la qualité SI elle était prévue/]],
    ];
    const commun: Ligne = { main_terrains: ["piste", "montagne", "tapis", "plat"], running_years: 10, gender: "female", is_female_cycle_sync: true, current_phase: "folliculaire", elevation_pref: "specialiste",
      last_quality_exec: { date: jourMoins(J, 3), repsSec: [250, 248, 245, 240], avgHr: 165, fadeSec: -10 },
      weight_mode_enabled: true, height_cm: 165, weight_kg: 85 };
    for (const [quand, s, attendus] of scenarios) {
      const lire = (o: Situation) => dossier({ ...s, ...o, profil: { ...commun, ...(s.profil ?? {}), ...(o.profil ?? {}),
        pace_curve: { criticalSpeed: 4.0, ...(quand.includes("plateau") ? { history: plateVma } : {}) } },
        notifications: [...(s.notifications ?? []), ...(o.notifications ?? [])] });
      const temoin = await lire({});
      for (const r of attendus) assert.match(temoin.text, r, `précondition (${quand}) : le témoin n'a pas la ligne ${r}`);
      assert.match(temoin.text, /^PROFIL\n/, `précondition (${quand}) : le dossier du témoin ne commence plus par son profil`);
      assert.doesNotMatch(temoin.text, /CADRE DE SANTÉ — PRIME/, `${quand} : le témoin reçoit l'en-tête du cadre de santé`);
      for (const [nom, o] of exemptes) {
        const { text } = await lire(o);
        const vues = prescrit(text);
        assert.deepEqual(vues.map((l) => l.slice(0, 140)), [], `${nom} (${quand}) : le dossier pousse encore à l'intensité : ${vues.map((l) => l.slice(0, 200)).join(" | ")}`);
        const jamais = text.match(JAMAIS)?.[0];
        assert.equal(jamais, undefined, `${nom} (${quand}) : « ${jamais} » est écrit pour un exempté`);
        const plafond = /cardiaque|grossesse/.test(nom) ? "seuilBas" : "aucune";
        assert.match(text, /^⛔ CADRE DE SANTÉ — PRIME SUR TOUT LE RESTE DE CE DOSSIER\n- Plafond d'intensité : /, `${nom} (${quand}) : l'en-tête du cadre de santé manque`);
        assert.match(text, /^- ⛔ Cadre de santé : le terrain ne relève jamais le plafond d'intensité de ce dossier/m, `${nom} (${quand}) : la ligne du terrain manque`);
        assert.match(text.split("\n")[1], plafond === "seuilBas" ? /SEUIL BAS au plus/ : /AUCUNE intensité/, `${nom} (${quand}) : l'en-tête ne dit pas le plafond « ${plafond} »`);
        // Le seuil mesuré reste un repère ; le sous-seuil est la limite haute du seuil bas, et disparaît sans intensité.
        if (/ALLURE SEUIL \*\*MESURÉE\*\*/.test(temoin.text) && /grossesse/.test(nom)) {
          // Grossesse : tout à la sensation (décision de Cyprien, 20/11/2026) — ni seuil mesuré ni sous-seuil chiffrés.
          assert.doesNotMatch(text, /ALLURE SEUIL|ALLURE SOUS-SEUIL/, `${nom} (${quand}) : une allure de seuil est chiffrée pour une grossesse`);
        } else if (/ALLURE SEUIL \*\*MESURÉE\*\*/.test(temoin.text)) {
          assert.match(text, /ALLURE SEUIL \*\*MESURÉE\*\*.*Repère seulement : cadre de santé, aucune séance à cette allure\./, `${nom} (${quand}) : le seuil mesuré n'est pas un simple repère`);
          if (plafond === "seuilBas") assert.match(text, /ALLURE SOUS-SEUIL : \d+'\d{2}\/km — la LIMITE HAUTE de ses séances de seuil bas/, `${nom} (${quand}) : le sous-seuil n'est pas la limite du seuil bas`);
          else assert.doesNotMatch(text, /ALLURE SOUS-SEUIL/, `${nom} (${quand}) : une allure sous-seuil est donnée sans intensité permise`);
        }
      }
    }
  });

  await test("consignes du kiné ÉCHUES : l'exemption tombe", async () => {
    const { ligneVma } = await dossier({ notifications: [consignesKine({ sansIntensite: true, jusquAu: "2026-11-10" })] });
    assert.match(ligneVma, /recommande-lui un test VMA pour affiner/, `consignes échues : le test n'est plus recommandé (« ${ligneVma} »)`);
  });

  await test("avis médical DONNÉ : l'exemption tombe, le test redevient recommandable", async () => {
    const donne = { ...aptitude(["poitrine"]), data: { oui: ["poitrine"], date: "2026-11-01", avisMedecin: "2026-11-05" } };
    const { ligneVma } = await dossier({ notifications: [donne] });
    assert.match(ligneVma, /recommande-lui un test VMA pour affiner/, `avis donné : le test n'est plus recommandé (« ${ligneVma} »)`);
  });

  await test("VMA d'un test enregistré : aucune des deux consignes (rien à affiner)", async () => {
    const { ligneVma } = await dossier({ baselines: [{ user_id: "u", vma_kmh: 15, tested_at: "2026-10-01T10:00:00Z", max_hr: 188, resting_hr: 50 }] });
    assert.doesNotMatch(ligneVma, /ESTIMÉE|test VMA/, `VMA testée, consigne de test quand même (« ${ligneVma} »)`);
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
