/**
 * LE COACH IA SAIT QUEL JOUR ON EST — et parle naturellement (02/10/2026).
 *
 * Cyprien, à J-23 du Marathon de Lille : le coach des Cours répondait « nous sommes en
 * octobre 2026, et ton marathon est dans un an », écrivait « en tant que LE coach », et
 * l'écran affichait « ### Pourquoi… » et « **Le temps :** » tels quels. L'invite ne donnait
 * jamais la date du jour ; l'interface n'interprétait pas la mise en forme.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dateLongue, joursEntre, echeance, courseDatee, enteteTemps } from "../src/lib/ai/reperesTemps";

let ok = 0, ko = 0;
function test(nom: string, f: () => void) {
  try { f(); ok++; console.log(`  ✓ ${nom}`); } catch (e) { ko++; console.error(`  ✗ ${nom}\n    ${(e as Error).message}`); }
}
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

console.log("\nREPÈRES DE TEMPS — calculés, jamais laissés au modèle");
test("le cas de Cyprien : vendredi 2 octobre → marathon le dimanche 25, dans 23 jours", () => {
  assert.equal(dateLongue("2026-10-02"), "vendredi 2 octobre 2026");
  assert.equal(joursEntre("2026-10-02", "2026-10-25"), 23);
  assert.equal(courseDatee("Marathon de Lille", "2026-10-25", "2026-10-02"), "Marathon de Lille — dimanche 25 octobre 2026, dans 23 jours (environ 3 semaines)");
  assert.match(enteteTemps("2026-10-02"), /^AUJOURD'HUI : vendredi 2 octobre 2026\. .*reprends-les tels quels/);
});

test("les échéances se disent comme un entraîneur les dirait", () => {
  assert.equal(echeance("2026-10-02", "2026-10-02"), "aujourd'hui");
  assert.equal(echeance("2026-10-03", "2026-10-02"), "demain");
  assert.equal(echeance("2026-10-01", "2026-10-02"), "hier");
  assert.equal(echeance("2026-09-28", "2026-10-02"), "il y a 4 jours");
  assert.equal(echeance("2026-10-12", "2026-10-02"), "dans 10 jours");
  assert.equal(echeance("2027-09-26", "2026-10-02"), "dans 359 jours (environ 12 mois)");
});

test("changement d'heure et années bissextiles ne décalent pas d'un jour", () => {
  assert.equal(joursEntre("2026-10-24", "2026-10-26"), 2, "passage à l'heure d'hiver (25/10/2026)");
  assert.equal(joursEntre("2028-02-28", "2028-03-01"), 2, "29 février 2028");
  assert.equal(joursEntre("2026-03-28", "2026-03-30"), 2, "passage à l'heure d'été");
});

test("une date illisible ne produit pas un faux délai", () => {
  for (const x of ["", "25/10/2026", "2026-10", "n'importe quoi"]) {
    assert.equal(echeance(x, "2026-10-02"), "");
    assert.equal(courseDatee("Course", x, "2026-10-02"), "Course");
  }
});

console.log("\nLES INVITES — date du jour et délais calculés");
test("le coach des Cours reçoit la date du jour et des délais déjà calculés", () => {
  const src = code("src/app/api/ai/cours/route.ts");
  assert.match(src, /\$\{enteteTemps\(todayStr\)\}/, "la date du jour n'est plus donnée au modèle");
  assert.match(src, /Prochaine course : \$\{courseDatee\(/, "la prochaine course n'est plus datée en clair");
  assert.match(src, /\$\{obj\.raceDate \? `, \$\{echeance\(obj\.raceDate, todayStr\)\}` : ""\}/);
  assert.doesNotMatch(src, /le \$\{nextRace\.date\}|le \$\{obj\.raceDate\}|le \$\{plan\.race_date\}/, "une date brute à recompter est revenue");
});

test("le Kiné IA aussi : la course à venir est située dans le temps", () => {
  const src = code("src/app/api/ai/physio/route.ts");
  assert.match(src, /COURSE À VENIR : \$\{courseDatee\(/);
  assert.match(src, /aujourd'hui : \$\{dateLongue\(todayStr\)\}/);
});

test("le plan actif est lu par sa vraie colonne (`name`, pas `goal` qui n'existe pas)", () => {
  for (const f of ["src/app/api/ai/cours/route.ts", "src/app/api/admin/coach-analyze/route.ts", "src/app/api/admin/client-detail/route.ts", "src/app/api/admin/analyze-session/route.ts"]) {
    const src = code(f);
    assert.doesNotMatch(src, /from\("training_plans"\)\.select\("[^"]*\bgoal\b(?!:)[^"]*"\)/, `${f} lit encore une colonne « goal » inexistante (erreur 42703 silencieuse)`);
    assert.match(src, /goal:name/, f);
  }
});

console.log("\nLE TON — un entraîneur qui parle à son athlète");
test("l'invite interdit l'autoréférence et la flatterie, et ne se proclame plus « LE coach »", () => {
  const src = readFileSync("src/app/api/ai/cours/route.ts", "utf8");
  assert.doesNotMatch(src, /Tu es LE coach/);
  assert.match(src, /ne parle jamais de toi ni de ton rôle \(pas de « en tant que coach »/);
  assert.match(src, /aucun compliment sur la question/);
  assert.match(src, /aucun titre \(#\)/);
});

test("la réponse est mise en forme (RichText), jamais affichée brute", () => {
  const ui = code("src/components/cours/CoursChat.tsx");
  assert.match(ui, /<RichText texte=\{m\.text\}/);
  assert.match(ui, /m\.role === "user" \? \(/);
  assert.doesNotMatch(ui, /dangerouslySetInnerHTML/);
});

console.log(`\n${ok} test(s) des repères de temps passé(s), ${ko} échec(s)`);
if (ko) process.exit(1);
