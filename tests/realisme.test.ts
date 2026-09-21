/**
 * L'AVERTISSEMENT DE RÉALISME : DIT AU BON MOMENT, ET ÉCARTABLE SANS ÊTRE PERDU.
 *
 * Cyprien, 21/09/2026 : le bloc rouge « Réalisme de l'objectif » se réaffichait à chaque
 * visite du calendrier sans pouvoir être écarté ; et le verdict (chrono hors de portée,
 * sortie longue impossible) n'était dit que là, des jours après la saisie de l'objectif.
 *
 * Trois invariants :
 *  1. la clé de masquage dépend de l'OBJECTIF et du CONTENU — un nouvel objectif ou un
 *     avertissement nouveau fait revenir le bloc (on ne cache jamais ce qui n'a pas été lu) ;
 *  2. le calendrier ne masque QUE sur clé identique, et le bouton enregistre côté serveur
 *     en lisant l'erreur ;
 *  3. l'API d'objectif renvoie le verdict au moment de l'enregistrement, et la carte le
 *     montre — y compris quand tout va bien.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleRealisme, realismeMasque, empreinte } from "../src/lib/coach/realismeCle";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

console.log("\n=== RÉALISME DE L'OBJECTIF ===\n");

test("la clé change avec l'objectif ET avec le contenu des avertissements", () => {
  const obj = { race: "Marathon de Lille", raceDate: "2026-10-25" };
  const w = ["⚠️ CHRONO TRÈS AMBITIEUX : …", "Un marathon à 20 ans, c'est autorisé…"];
  const cle = cleRealisme(obj, w);
  assert.equal(cleRealisme(obj, [...w]), cle, "la clé n'est pas stable pour un même contenu");
  assert.notEqual(cleRealisme({ race: "Semi de Paris", raceDate: "2026-10-25" }, w), cle, "changer de course ne change pas la clé");
  assert.notEqual(cleRealisme({ ...obj, raceDate: "2027-04-11" }, w), cle, "changer de date ne change pas la clé");
  assert.notEqual(cleRealisme(obj, [w[0]]), cle, "un avertissement disparu ne change pas la clé");
  assert.notEqual(cleRealisme(obj, [...w, "Nouvel avertissement"]), cle, "un avertissement NOUVEAU ne change pas la clé : il serait caché sans avoir été lu");
  // Insensible à la casse et aux espaces du nom : « marathon de lille » = « Marathon de Lille ».
  assert.equal(cleRealisme({ race: "  marathon de lille ", raceDate: "2026-10-25" }, w), cle);
  assert.ok(cle.length <= 160, `clé trop longue pour le réglage (${cle.length})`);
});

test("l'empreinte distingue des contenus proches et reste courte", () => {
  assert.notEqual(empreinte("a"), empreinte("b"));
  assert.notEqual(empreinte("chrono 3:30"), empreinte("chrono 3:31"));
  assert.ok(empreinte("x".repeat(5000)).length <= 8);
});

test("masqué seulement sur clé IDENTIQUE — jamais sur une clé vide ou absente", () => {
  const cle = cleRealisme({ race: "A", raceDate: "2026-01-01" }, ["w"]);
  assert.equal(realismeMasque(cle, cle), true);
  assert.equal(realismeMasque(null, cle), false);
  assert.equal(realismeMasque(undefined, cle), false);
  assert.equal(realismeMasque(cle + "x", cle), false);
});

test("le calendrier masque le bloc sur la clé mémorisée, et le bouton enregistre en lisant l'erreur", () => {
  const src = codeNu("src/components/training/CalendarView.tsx");
  // La condition d'affichage porte la clé, pas un simple booléen local.
  assert.match(src, /warnings\.length > 0 && !realismeCache && \(/, "le bloc rouge ne dépend plus du masquage");
  assert.match(src, /const cle = cleRealisme\(state\.objective, warnings\)/, "la clé n'est plus calculée depuis l'objectif ET les avertissements");
  assert.match(src, /estMasque\(masqueLocal \?\? realismeMasque, cle\)/, "le masquage ne compare plus la clé mémorisée à la clé courante");
  // Le bouton existe, il est nommé, et il écrit dans les réglages.
  assert.match(src, /onClick=\{masquerRealisme\}/, "le bouton « ne plus afficher » a disparu");
  assert.match(src, /t\("cal\.why\.realismHide"\)/, "le bouton n'a plus de libellé traduit");
  assert.match(src, /fetch\("\/api\/settings", \{ method: "POST"[\s\S]{0,200}?realismeMasque: cle/, "le choix n'est plus enregistré côté serveur");
  // ⚠️ L'ERREUR EST LUE : sans ça, un choix « enregistré » qui ne l'est pas ferait
  // revenir le bloc à la prochaine visite.
  assert.match(src, /if \(!r\.ok\) \{ setMasqueLocal\(null\)/, "un échec d'enregistrement laisse le bloc masqué : il reviendra sans explication");
  // Le bouton est HORS du <details> : visible replié comme déplié.
  const i = src.indexOf("onClick={masquerRealisme}");
  const j = src.lastIndexOf("</details>", i);
  assert.ok(j > 0 && j < i, "le bouton est dans le <details> : invisible tant qu'on ne déplie pas");
  // Et la page passe bien la clé mémorisée.
  assert.match(codeNu("src/app/dashboard/calendrier/page.tsx"), /realismeMasque=\{typeof us\.realismeMasque === "string" \? us\.realismeMasque : null\}/,
    "la page du calendrier ne transmet plus le réglage");
});

test("l'API des réglages accepte la clé, bornée", () => {
  const src = codeNu("src/app/api/settings/route.ts");
  assert.match(src, /if \(typeof body\.realismeMasque === "string"\) patch\.realismeMasque = body\.realismeMasque\.slice\(0, 160\)/,
    "realismeMasque n'est plus accepté (ou plus borné) par /api/settings");
});

test("l'objectif enregistré renvoie le verdict de réalisme, calculé sur le contexte coach", () => {
  const src = codeNu("src/app/api/objective/route.ts");
  assert.match(src, /buildAthleteContext\(admin, user\.id\)/, "le verdict n'est plus calculé sur le contexte coach réel");
  assert.match(src, /ok: ctx\.objectiveWarnings\.length === 0/, "« tout va bien » n'est plus déduit de l'absence d'avertissement");
  // Les avertissements d'âge, déjà renvoyés structurés, ne sont pas dupliqués en texte.
  assert.match(src, /filter\(\(w\) => !\[\.\.\.textesAge\]\.some/, "les avertissements d'âge seraient affichés deux fois");
  // Et en cas d'échec du contexte : null, pas « ok ».
  assert.match(src, /verdictOk: realisme \? realisme\.ok : null/, "un contexte en échec dirait « tout va bien »");
});

test("la carte d'objectif montre le verdict — les avertissements ET le feu vert", () => {
  const src = codeNu("src/components/dashboard/ObjectiveCard.tsx");
  assert.match(src, /setAvertissements\(\[\.\.\.age, \.\.\.realisme\]\)/, "les avertissements de réalisme ne sont plus fusionnés avec ceux de l'âge");
  assert.match(src, /verdictOk === true && avertissements\.length === 0 && \(/, "le feu vert s'afficherait à côté d'un avertissement, ou plus du tout");
  assert.match(src, /t\("obj\.verdictOk"\)/, "le feu vert n'a plus de libellé traduit");
  assert.match(src, /setVerdictOk\(typeof j\.verdictOk === "boolean" \? j\.verdictOk : null\)/, "un verdict absent serait pris pour un feu vert");
});

test("les trois libellés existent dans les cinq langues", () => {
  const i18n = readFileSync("src/lib/i18n/translations.ts", "utf8");
  for (const k of ["obj.verdictOk", "cal.why.realismHide", "cal.why.realismHideFail"]) {
    assert.equal([...i18n.matchAll(new RegExp(`"${k.replace(/\./g, "\\.")}"\\s*:`, "g"))].length, 5, `« ${k} » manque à une langue`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
