/**
 * DEUX FAITS QUE L'APPLICATION SE RACONTAIT DE TRAVERS, mesurés le 23/09/2026 sur le
 * compte réel de Cyprien.
 *
 * ── 1. « TA PROCHAINE COURSE » AVAIT DEUX SOURCES ────────────────────────────
 * `race_objective` disait « Marathon International de Lille, 25/10/2026 » ; `planned_race`
 * disait « Foulées de Bondues, 23/05/2027 », et Lille n'y figurait pas. Le kiné IA et le
 * cours ne lisaient QUE la seconde : ils conseillaient donc sur une échéance située huit
 * mois trop loin.
 *
 * ── 2. UNE DOULEUR DÉCLARÉE NE POUVAIT PAS ÊTRE RETIRÉE ──────────────────────
 * Elle ne s'éteignait que par péremption (14 jours). Entre-temps elle retirait de
 * l'intensité à chaque replanification. Cyprien en avait déclaré une POUR TESTER : son
 * plan a été allégé pendant deux semaines sur une douleur qui n'existait pas.
 *
 *   npx tsx tests/douleurs-course.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prochaineCourse, coursesAVenir, joursAvant } from "../src/lib/coach/prochaineCourse";
import { etatDe, pese, actives, libelleEtat, libellesActifs, etatValide, PEREMPTION_JOURS } from "../src/lib/health/douleurs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const MOTS = { mieux: "en amélioration", pire: "en aggravation" };

console.log("\n=== PROCHAINE COURSE & ÉTAT DES DOULEURS ===\n");

test("le cas réel : l'objectif déclaré passe devant une course lointaine du calendrier", () => {
  // Exactement ce qu'il y avait en base le 23/09/2026.
  const objectif = { race: "Marathon International de Lille", raceDate: "2026-10-25", distanceKm: 42.195 };
  const planifiees = [{ name: "Foulées de Bondues", date: "2027-05-23" }];
  const c = prochaineCourse(objectif, planifiees, "2026-09-23");
  assert.equal(c?.nom, "Marathon International de Lille", "le kiné parlerait encore des Foulées de Bondues");
  assert.equal(c?.source, "objectif");
  assert.equal(joursAvant(c!, "2026-09-23"), 32, "le décompte des jours ne correspond pas au J‑32 du tableau de bord");
});

test("une course du calendrier plus proche que l'objectif passe devant", () => {
  // L'objectif n'est pas prioritaire par principe : c'est la DATE qui tranche.
  const c = prochaineCourse(
    { race: "Marathon de Lille", raceDate: "2026-10-25" },
    [{ name: "10 km du port", date: "2026-10-04" }],
    "2026-09-23",
  );
  assert.equal(c?.nom, "10 km du port");
  assert.equal(c?.source, "calendrier");
});

test("le passé ne compte pas, et une absence totale rend null", () => {
  assert.equal(prochaineCourse({ race: "Hier", raceDate: "2026-09-22" }, [{ name: "Avant-hier", date: "2026-09-21" }], "2026-09-23"), null);
  assert.equal(prochaineCourse(null, [], "2026-09-23"), null);
  // Le jour MÊME de la course compte encore : elle n'est pas passée à minuit.
  assert.equal(prochaineCourse({ race: "Aujourd'hui", raceDate: "2026-09-23" }, [], "2026-09-23")?.nom, "Aujourd'hui");
});

test("la même course dans les deux sources n'apparaît qu'une fois — côté objectif", () => {
  // ⚠️ Garder la version « calendrier » perdrait la distance et le fait que c'est LA
  // course préparée.
  //
  // ⚠️ CETTE ASSERTION EST TENUE PAR DEUX PROTECTIONS REDONDANTES : l'objectif est empilé
  // en premier, ET la règle de départage le fait gagner. Retirer l'une des deux laisse
  // donc ce test au vert — vérifié le 23/09/2026 en mutant la règle seule. La règle EST
  // porteuse : ordre d'empilement inversé + règle retirée = rouge. Si quelqu'un réordonne
  // les empilements un jour, c'est elle qui rattrape.
  const l = coursesAVenir(
    { race: "Marathon de Lille", raceDate: "2026-10-25", distanceKm: 42.195 },
    [{ name: "marathon de lille", date: "2026-10-25" }, { name: "Trail des crêtes", date: "2026-12-01" }],
    "2026-09-23",
  );
  assert.equal(l.length, 2, `${l.length} course(s) : le dédoublonnage ne tient pas`);
  assert.equal(l[0].source, "objectif", "la version calendrier a gagné : la distance est perdue");
  assert.equal(l[0].distanceKm, 42.195);
});

test("des données abîmées ne fabriquent pas de course fantôme", () => {
  const l = coursesAVenir(
    { race: "   ", raceDate: "2026-10-25" },
    [{ name: "Sans date" }, { date: "2026-11-01" }, null, { name: "Bonne", date: "2026-11-02T08:00:00Z" }],
    "2026-09-23",
  );
  assert.deepEqual(l.map((c) => c.nom), ["Bonne"], "une entrée sans nom ou sans date a produit une course");
  assert.equal(l[0].date, "2026-11-02", "une date horodatée n'est pas ramenée au jour civil");
});

test("une douleur résolue ne pèse plus — mais « mieux » pèse encore", () => {
  // ⚠️ LE PIÈGE : faire disparaître une gêne qui s'améliore rendrait la séance dure le
  // jour même où l'athlète dit « ça va un peu mieux ». C'est comme ça qu'on rechute.
  assert.equal(pese({ etat: "resolu" }), false);
  assert.equal(pese({ etat: "mieux" }), true, "« ça va mieux » a fait disparaître la douleur du budget de qualité");
  assert.equal(pese({ etat: "pire" }), true);
  assert.equal(pese({ etat: "actif" }), true);
  // Les lignes écrites AVANT l'existence du champ valent « actif », pas « inconnu ».
  assert.equal(etatDe({}), "actif");
  assert.equal(etatDe({ etat: "n'importe quoi" }), "actif");
  assert.equal(etatDe(null), "actif");
});

test("la péremption ET l'état, parce qu'aucun des deux ne couvre l'autre cas", () => {
  const base = { zone: "Mollet gauche", level: 6 };
  const liste = [
    { ...base, date: "2026-09-22" },                      // récente, active
    { ...base, zone: "Genou droit", date: "2026-09-01" }, // périmée (21 j)
    { ...base, zone: "Bras droit", date: "2026-09-22", etat: "resolu" }, // récente mais passée
  ];
  const a = actives(liste, "2026-09-23");
  assert.deepEqual(a.map((d) => d.zone), ["Mollet gauche"], "la péremption ou l'état ne filtre plus");
  assert.equal(PEREMPTION_JOURS, 14, "la fenêtre de péremption a changé sans que le coach le sache");
  // Une déclaration sans zone ou sans date n'est pas exploitable.
  assert.equal(actives([{ level: 5, date: "2026-09-22" }, { zone: "X" }], "2026-09-23").length, 0);
});

test("la tendance fait partie du fait transmis au coach", () => {
  assert.equal(libelleEtat({ zone: "Mollet gauche", level: 6 }, MOTS), "Mollet gauche (6/10)");
  assert.equal(libelleEtat({ zone: "Mollet gauche", level: 6, etat: "mieux" }, MOTS), "Mollet gauche (6/10), en amélioration");
  assert.equal(libelleEtat({ zone: "Mollet gauche", level: 6, etat: "pire" }, MOTS), "Mollet gauche (6/10), en aggravation");
  // Sans niveau, on n'invente pas de chiffre.
  assert.equal(libelleEtat({ zone: "Dos" }, MOTS), "Dos");
  // Et la liste dédoublonne sans perdre la tendance.
  const l = libellesActifs([
    { zone: "Dos", level: 5, date: "2026-09-22" },
    { zone: "Dos", level: 5, date: "2026-09-22" },
    { zone: "Pied", level: 4, date: "2026-09-22", etat: "pire" },
  ], "2026-09-23", MOTS);
  assert.deepEqual(l, ["Dos (5/10)", "Pied (4/10), en aggravation"]);
});

test("un état envoyé par un client n'est accepté que s'il est connu", () => {
  for (const bon of ["actif", "mieux", "pire", "resolu", " RESOLU "]) assert.ok(etatValide(bon), `« ${bon} » refusé`);
  for (const mauvais of ["", null, undefined, "guéri", "<script>", 7, {}]) {
    assert.equal(etatValide(mauvais), null, `« ${JSON.stringify(mauvais)} » accepté`);
  }
});

test("les deux sources de course sont réunies là où elles étaient séparées", () => {
  for (const f of ["src/app/api/ai/physio/route.ts", "src/app/api/ai/cours/route.ts"]) {
    const src = codeNu(f);
    assert.match(src, /prochaineCourse\(/, `${f} choisit encore sa course tout seul : il ignorera l'objectif déclaré`);
    assert.match(src, /eq\("type", "race_objective"\)/, `${f} ne lit plus l'objectif déclaré`);
  }
});

test("le coach et le kiné ignorent une douleur résolue", () => {
  const coach = codeNu("src/lib/ai/coachContext.ts");
  assert.match(coach, /libellesActifs\(/, "le coach ne passe plus par le filtre des douleurs : une douleur résolue briderait encore le plan");
  assert.match(coach, /\.select\("id, ?data"\)[\s\S]{0,120}"pain_report"/, "le coach ne lit plus l'identifiant des douleurs : impossible de les rattacher à leur état");
  const kine = codeNu("src/app/api/ai/physio/route.ts");
  assert.match(kine, /actives\(|libellesActifs\(/, "le kiné ressort encore une douleur que l'athlète a déclarée passée");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
