/**
 * LE COACH IA AVANCÉ — invisible, plus puissant en Premium (Cyprien, 28/09/2026 : « le
 * coach IA, c'est l'intelligence qui donne les meilleures séances, pas un onglet »).
 *
 * L'onglet de conversation est retiré ; en Premium et pendant l'essai, le modèle relit les
 * séances clés et ajoute à leur « pourquoi » un conseil d'exécution — sans jamais toucher
 * à la séance, et rejeté s'il contient un chiffre absent des données.
 *
 *   npx tsx tests/coach-avance.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  joursARelire, empreinte, chiffresInconnus, raccourcir, validerConseils, composerPourquoi,
  appliquerConseils, decisionRelecture, JOURS_MAX, APPELS_MAX_JOUR, LONGUEUR_MAX, type JourPlan,
} from "../src/lib/ai/relectureSemaine";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const j = (date: string, type: string, title = type, detail = "", why = "Motif du moteur."): JourPlan => ({ date, type, title, detail, why });
const SEMAINE = [
  j("2026-09-28", "Endurance", "Footing en endurance", "~18 km en Z2 (~5'07/km)"),
  j("2026-09-29", "Endurance", "Footing + lignes droites"),
  j("2026-09-30", "Repos"),
  j("2026-10-01", "Spécifique", "Allure spécifique objectif", "2×20 min à 3'47/km, récup 4 min"),
  j("2026-10-02", "Renfo"),
  j("2026-10-03", "Repos", "Repos complet"),
  j("2026-10-04", "Sortie longue", "Sortie longue", "~22 km"),
];
const SOURCE = "VFC 100 ms · 26 % en Z3+ · 20 °C prévus · dérive +4.8 % · allure 5'07/km · 3'47/km · D+ 300 m";

console.log("\n=== CE QUI EST RELU ===\n");

test("aujourd'hui, puis les séances CLÉS — jamais le repos ni le renfo", () => {
  const r = joursARelire(SEMAINE, "2026-09-28").map((d) => d.date);
  assert.deepEqual(r, ["2026-09-28", "2026-10-01", "2026-10-04"]);
  assert.ok(r.length <= JOURS_MAX);
  assert.deepEqual(joursARelire(SEMAINE, "2026-09-30").map((d) => d.date), ["2026-10-01", "2026-10-04"], "jour 0 au repos : rien à conseiller ce jour-là");
});

test("l'empreinte ne bouge que si les séances relues changent", () => {
  const a = empreinte(joursARelire(SEMAINE, "2026-09-28"), "fr");
  assert.equal(a, empreinte(joursARelire(SEMAINE, "2026-09-28"), "fr"));
  const autre = SEMAINE.map((d) => (d.date === "2026-10-01" ? { ...d, detail: "3×15 min à 3'47/km" } : d));
  assert.notEqual(a, empreinte(joursARelire(autre, "2026-09-28"), "fr"));
  assert.notEqual(a, empreinte(joursARelire(SEMAINE, "2026-09-28"), "en"), "changer de langue doit relancer la relecture");
});

test("coût borné : on réutilise, on relit, ou on s'arrête au plafond du jour", () => {
  const prec = { jour: "2026-09-28", empreinte: "abc", appels: 1, conseils: [] };
  assert.equal(decisionRelecture(prec, "2026-09-28", "abc"), "reutiliser");
  assert.equal(decisionRelecture(prec, "2026-09-28", "xyz"), "relire");
  assert.equal(decisionRelecture({ ...prec, appels: APPELS_MAX_JOUR }, "2026-09-28", "xyz"), "plafond");
  assert.equal(decisionRelecture({ ...prec, appels: APPELS_MAX_JOUR }, "2026-09-29", "xyz"), "relire", "le plafond se remet à zéro chaque jour");
  assert.equal(decisionRelecture(null, "2026-09-28", "abc"), "relire");
});

console.log("\n=== AUCUN CHIFFRE INVENTÉ ===\n");

test("un chiffre absent des données est repéré ; un chiffre présent ne l'est pas", () => {
  assert.deepEqual(chiffresInconnus("Tiens 3'47/km sur les blocs", SOURCE), []);
  assert.deepEqual(chiffresInconnus("Tiens 3'45/km sur les blocs", SOURCE), ["3'45"]);
  assert.deepEqual(chiffresInconnus("Pars sur 25 km", SOURCE), ["25km"]);
  assert.deepEqual(chiffresInconnus("Avec 20°C, bois", SOURCE), []);
  assert.deepEqual(chiffresInconnus("Ta VFC à 100 ms", SOURCE), []);
  assert.deepEqual(chiffresInconnus("Ta VFC à 90 ms", SOURCE), ["90ms"]);
  assert.deepEqual(chiffresInconnus("400 m de D+", SOURCE), ["400m"]);
  assert.deepEqual(chiffresInconnus("dérive +4,8 %", SOURCE), [], "la virgule décimale vaut le point");
});

test("un conseil qui invente un chiffre est rejeté ENTIER ; les autres passent", () => {
  const jours = joursARelire(SEMAINE, "2026-09-28");
  const brut = "```json\n" + JSON.stringify({ conseils: [
    { date: "2026-09-28", conseil: "Avec 20 °C, bois avant de partir et reste en Z2." },
    { date: "2026-10-01", conseil: "Pars à 3'40/km sur le premier bloc pour te tester." },
    { date: "2026-10-04", conseil: "" },
    { date: "2026-10-09", conseil: "Une date hors plan ne doit pas passer du tout." },
    { date: "2026-09-28", conseil: "Doublon de date, le premier seul compte." },
  ] }) + "\n```";
  const motifs: string[] = [];
  const r = validerConseils(brut, jours, "fr", SOURCE, motifs);
  assert.deepEqual(r.map((c) => c.date), ["2026-09-28"]);
  assert.ok(motifs.some((m) => m.includes("3'40")), `motif du rejet : ${motifs.join(" · ")}`);
  assert.deepEqual(validerConseils("pas du json", jours, "fr", SOURCE), []);
});

test("trop long : on garde les premières phrases entières, jamais une phrase coupée", () => {
  const long = "Première phrase utile et complète. " + "Deuxième phrase beaucoup trop longue ".repeat(10) + "qui finit ici.";
  assert.equal(raccourcir(long), "Première phrase utile et complète.");
  assert.equal(raccourcir("x".repeat(LONGUEUR_MAX + 50)), null, "une seule phrase trop longue n'est pas coupée au milieu");
  const court = "Court et utile, pour ta sortie de dimanche.";
  assert.equal(raccourcir(court), court);
});

console.log("\n=== OÙ LE CONSEIL S'AFFICHE ===\n");

test("le motif du moteur passe TOUJOURS en premier, et le total tient dans la borne", () => {
  const w = composerPourquoi("Motif du moteur.", "Conseil du coach.");
  assert.equal(w, "Motif du moteur. Conseil du coach.");
  assert.ok(composerPourquoi("m".repeat(600), "c".repeat(200)).length <= 640);
  assert.ok(composerPourquoi("m".repeat(600), "c".repeat(200)).endsWith("c".repeat(200)), "le conseil n'est jamais tronqué");
  assert.equal(composerPourquoi("Motif.", ""), "Motif.");
});

test("français → le pourquoi canonique ; autre langue → SA traduction, le français intact", () => {
  const semaine = [{ date: "2026-10-01", why: "Motif FR.", i18n: { en: { why: "Engine reason." } } }];
  const fr = appliquerConseils(semaine, [{ date: "2026-10-01", lang: "fr", texte: "Conseil." }]);
  assert.equal(fr[0].why, "Motif FR. Conseil.");
  const en = appliquerConseils(semaine, [{ date: "2026-10-01", lang: "en", texte: "Tip." }]);
  assert.equal(en[0].why, "Motif FR.", "le français canonique est lu par la montre et les autres modules");
  assert.equal(en[0].i18n?.en?.why, "Engine reason. Tip.");
  const de = appliquerConseils(semaine, [{ date: "2026-10-01", lang: "de", texte: "Tipp." }]);
  assert.deepEqual(de[0], semaine[0], "sans traduction de ce jour, on n'invente pas un pourquoi");
});

console.log("\n=== BRANCHEMENT ===\n");

test("Premium et essai seulement ; jamais l'aperçu gratuit ; le plan ne dépend pas du modèle", () => {
  const src = codeNu("src/lib/ai/autoCoach.ts");
  assert.match(src, /const coachAvance = !apercu && profilPeut\(acces, "plan_ia"\);/);
  assert.match(src, /const relecture = coachAvance\s*\? await relireSemaine\(/);
  assert.match(src, /const rows = semaineCoach\.filter\(/, "les conseils n'atteindraient pas les séances enregistrées");
  assert.match(src, /\.\.\.\(relecture \? \{ relecture \} : \{\}\)/, "sans mémoire, chaque republication rappellerait le modèle");
  const serveur = codeNu("src/lib/ai/relectureServeur.ts");
  assert.match(serveur, /Promise\.race\(\[appel, delai\]\)/, "le plan attendrait le modèle");
  assert.match(serveur, /catch \(e\) \{[\s\S]*return null;/, "une panne du modèle ne doit jamais empêcher le plan");
});

test("plus d'onglet ni de conversation « Coach IA »", () => {
  assert.equal(existsSync("src/app/dashboard/coach/page.tsx"), false);
  assert.equal(existsSync("src/app/api/ai/coach/route.ts"), false);
  assert.doesNotMatch(codeNu("src/components/layout/navigation.ts"), /\/dashboard\/coach/);
  assert.doesNotMatch(codeNu("src/components/dashboard/BentoDashboard.tsx"), /\/dashboard\/coach/);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
