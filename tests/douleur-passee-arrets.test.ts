/**
 * DEUX DEMANDES DE CYPRIEN (10/11/2026), APRÈS SA REPRISE POST-MARATHON.
 *
 * 1. « Une douleur saisie après une séance n'a pas de bouton « c'est passé » » : la douleur
 *    cochée dans le ressenti (« Tibia (périoste) ») pesait sur le plan tant que ce ressenti
 *    restait parmi les cinq derniers, sans fin. Et cochée à 22 h 31, après la replanification
 *    de 22 h 28, elle n'atteignait le plan qu'au cron de la nuit.
 * 2. « Les pauses n'ajustent pas le plan » : choix retenu, un arrêt d'au moins une minute
 *    pendant une séance de qualité retire le verdict « tu peux durcir ».
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { douleursDeSeance } from "../src/lib/health/douleursSeance";
import { recupAllongee, verdictExecution, ARRET_QUALITE_SEC } from "../src/lib/coach/arretsQualite";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}
const zones = (r: ReturnType<typeof douleursDeSeance>) => r.map((d) => d.zone).sort();

// Le ressenti réel du 09/11/2026 (sans la note).
const CYPRIEN = { date: "2026-11-09", ts: "2026-11-09T21:31:31.166Z", rpe: 1, pain: ["Articulaire", "Tibia (périoste)"] };

console.log("\nLA DOULEUR COCHÉE APRÈS UNE SÉANCE S'ÉTEINT");

test("le cas réel compte le lendemain, plus au-delà de 14 jours", () => {
  assert.deepEqual(zones(douleursDeSeance([CYPRIEN], "2026-11-10")), ["Articulaire", "Tibia (périoste)"]);
  assert.deepEqual(zones(douleursDeSeance([CYPRIEN], "2026-11-23")), ["Articulaire", "Tibia (périoste)"], "éteinte avant 14 jours");
  assert.deepEqual(douleursDeSeance([CYPRIEN], "2026-11-24"), [], "au-delà de 14 jours, la douleur compte encore");
});

test("« c'est passé » l'éteint, et seulement elle", () => {
  const r = douleursDeSeance([{ ...CYPRIEN, painPasse: ["Tibia (périoste)"] }], "2026-11-10");
  assert.deepEqual(zones(r), ["Articulaire"]);
});

test("passée sur le ressenti récent, elle s'éteint aussi sur les plus anciens", () => {
  const ancien = { date: "2026-11-05", ts: "2026-11-05T18:00:00Z", pain: ["Tibia (périoste)"] };
  const recent = { ...CYPRIEN, painPasse: ["Tibia (périoste)"] };
  assert.deepEqual(zones(douleursDeSeance([ancien, recent], "2026-11-10")), ["Articulaire"]);
});

test("recochée APRÈS « c'est passé », elle compte de nouveau", () => {
  const passe = { ...CYPRIEN, painPasse: ["Tibia (périoste)", "Articulaire"] };
  const revient = { date: "2026-11-12", ts: "2026-11-12T19:00:00Z", pain: ["Tibia (périoste)"] };
  const r = douleursDeSeance([passe, revient], "2026-11-12");
  assert.deepEqual(r, [{ zone: "Tibia (périoste)", date: "2026-11-12" }]);
});

test("un « Aucune douleur » plus récent éteint ce qui précède ; un ressenti muet, non", () => {
  const sans = { date: "2026-11-11", ts: "2026-11-11T19:00:00Z", pain: ["Aucune douleur"] };
  assert.deepEqual(douleursDeSeance([CYPRIEN, sans], "2026-11-11"), [], "« Aucune douleur » ignoré");
  const muet = { date: "2026-11-11", ts: "2026-11-11T19:00:00Z", pain: [] };
  assert.deepEqual(zones(douleursDeSeance([CYPRIEN, muet], "2026-11-11")), ["Articulaire", "Tibia (périoste)"], "ne rien cocher a effacé la douleur");
  // Le même jour, l'ordre de saisie départage.
  const avant = { ...sans, date: "2026-11-09", ts: "2026-11-09T07:00:00Z" };
  assert.deepEqual(zones(douleursDeSeance([avant, CYPRIEN], "2026-11-10")), ["Articulaire", "Tibia (périoste)"], "un « Aucune douleur » du matin a effacé la douleur du soir");
  assert.deepEqual(douleursDeSeance([sans], "2026-11-11"), [], "« Aucune douleur » compté comme une douleur");
});

console.log("\nLES ARRÊTS PENDANT UN FRACTIONNÉ");

const arrets = (...durees: number[]) => ({ liste: durees.map((d, i) => ({ debutSec: i * 600, dureeSec: d, km: i })), totalSec: durees.reduce((a, b) => a + b, 0), ecouleSec: 3600, plusLongueSec: Math.max(...durees) });

test("seuls les arrêts d'au moins une minute rallongent la récupération", () => {
  assert.equal(recupAllongee(arrets(30, 45)), null, "un feu rouge rallonge la récupération");
  assert.deepEqual(recupAllongee(arrets(30, ARRET_QUALITE_SEC, 95)), { n: 2, totalSec: 155, plusLongueSec: 95 });
  assert.equal(recupAllongee(null), null, "sans trace, on invente une récupération rallongée");
});

test("allure tenue ou accélérée AVEC arrêts : la séance ne prouve plus qu'on peut durcir", () => {
  const r = recupAllongee(arrets(75));
  assert.equal(verdictExecution(-8, r), "non_probant", "accélération avec arrêts : « tu peux durcir » reste dit");
  assert.equal(verdictExecution(2, r), "non_probant", "allure tenue avec arrêts : « charge bien calibrée » reste dit");
  assert.equal(verdictExecution(-8, null), "accelere");
  assert.equal(verdictExecution(2, null), "tenue");
});

test("une trace ILLISIBLE n'est pas « aucun arrêt » : pas de « tu peux durcir »", () => {
  assert.equal(verdictExecution(2, null, true), "arrets_inconnus", "panne de lecture prise pour une séance sans arrêt");
  assert.equal(verdictExecution(-8, null, true), "arrets_inconnus");
  assert.equal(verdictExecution(15, null, true), "decrochage", "la panne efface un décrochage");
  assert.equal(verdictExecution(2, null), "tenue", "sans trace (tapis), le verdict des allures doit rester");
});

test("un décrochage malgré des arrêts reste un décrochage", () => {
  assert.equal(verdictExecution(15, recupAllongee(arrets(120))), "decrochage");
  assert.equal(verdictExecution(null, recupAllongee(arrets(120))), null, "verdict sans décrochage mesuré");
});

console.log("\nLES CHEMINS (site d'appel)");

test("le coach lit les douleurs par la règle, et le verdict des arrêts", () => {
  const coach = codeOf("src/lib/ai/coachContext.ts");
  assert.match(coach, /\.\.\.douleursDeSeance\(feedback\.map\(\(f\) => f\.data \?\? \{\}\), aujourdhui\(FUSEAU_DEFAUT\)\)\.map\(\(d\) => d\.zone\)/, "le coach relit les douleurs d'après séance sans la règle");
  assert.doesNotMatch(coach, /feedback\.flatMap\(f => f\.data\?\.pain/, "l'ancienne lecture sans fin est revenue");
  // Relecture du 10/11 : la règle vaut 14 jours, la lecture s'arrêtait aux 5 derniers ressentis.
  assert.match(coach, /eq\("type", "session_feedback"\)\s*\.gte\("created_at", new Date\(Date\.now\(\) - \(PEREMPTION_JOURS \+ 1\) \* 86400000\)\.toISOString\(\)\)\s*\.order\("created_at", \{ ascending: false \}\)\.limit\(60\)/, "le coach ne lit plus les 15 derniers jours de ressentis");
  assert.match(coach, /const arretsQualite = qe \? await lireArrets\(seanceQualite\) : null;\s*const recupQualite = arretsQualite === "illisible" \? null : recupAllongee\(arretsQualite\);/, "les arrêts de la séance de qualité ne sont plus lus");
  assert.match(coach, /const verdictQualite = verdictExecution\(qe\?\.fadeSec, recupQualite, arretsQualite === "illisible"\);/, "une trace illisible n'est plus distinguée d'une séance sans arrêt");
  assert.match(coach, /return "illisible" as const;/, "la lecture en erreur de la trace rend « aucun arrêt »");
  // Relecture du 10/11 : une panne de lecture des douleurs rendait « aucune douleur ».
  assert.match(coach, /for \(const \[nom, r\] of \[\["ressentis", fbRes\], \["douleurs déclarées", painRes\]\] as const\) \{\s*if \(estUnePanne\(r\)\) throw new Error/, "une panne des douleurs passe pour « aucune douleur »");
  assert.match(coach, /verdictQualite === "non_probant" \? `⏸️/, "le coach ne dit plus que la séance ne prouve rien");
  assert.match(coach, /shows\.push\(verdictQualite === "decrochage"/, "le constat affiché ignore les arrêts");
});

test("« c'est passé » écrit sur ses propres ressentis, lit ses erreurs et replanifie", () => {
  const route = codeOf("src/app/api/health/douleur-seance/route.ts");
  assert.match(route, /\.update\(\{ data: \{ \.\.\.\(l\.data \?\? \{\}\), painPasse \} \}\)\s*\.eq\("id", l\.id\)\.eq\("user_id", user\.id\)/, "écriture sans filtre de propriétaire");
  assert.match(route, /if \(error\) \{\s*await journaliserEchec/, "erreur d'écriture non journalisée");
  assert.match(route, /if \(eLecture\) \{\s*await journaliserEchec/, "erreur de lecture non journalisée");
  assert.match(route, /await autoCoachForUser\(admin,/, "le plan n'est pas relancé");
  assert.match(route, /\.catch\(\(e\) => journaliserEchec\(null, \{ source: "douleur-seance"/, "replanification en échec hors de error_logs");
  assert.match(route, /if \(eCreds\) \{\s*await journaliserEchec/, "identifiants illisibles non journalisés");
});

test("une douleur cochée après une séance relance le plan tout de suite", () => {
  const fb = codeOf("src/app/api/feedback/route.ts");
  assert.match(fb, /if \(cochees\.some\(\(p\) => p\.trim\(\)\)\) \{[\s\S]{0,900}await autoCoachForUser\(admin,/, "le ressenti attend encore le cron de nuit");
  assert.match(fb, /\.catch\(\(e\) => journaliserEchec\(admin, \{ source: "feedback"/, "replanification en échec hors de error_logs");
});

test("Santé montre les douleurs d'après séance avec leur bouton, sans le dictionnaire dans le bundle", () => {
  const page = codeOf("src/app/dashboard/health/page.tsx");
  assert.match(page, /douleursSeance = douleursDeSeance\(/, "la page ne lit plus les douleurs d'après séance");
  assert.match(page, /douleursSeance=\{douleursSeance\}/, "la page ne les transmet plus");
  const ecran = codeOf("src/components/health/HealthCenter.tsx");
  assert.match(ecran, /fetch\("\/api\/health\/douleur-seance"/, "aucun bouton n'appelle la route");
  assert.match(ecran, /onClick=\{\(\) => majDouleurSeance\(d\.zone, true\)\}/, "le bouton « c'est passé » a disparu");
  assert.doesNotMatch(ecran, /painZonesI18n/, "l'écran client importe la table des zones, donc tout le dictionnaire T");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
