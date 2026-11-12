/**
 * « COMMENT PACEVO CALCULE » (/methode, 10/11/2026) — la page dit ce que fait le code.
 *
 * Chaque chiffre affiché est RELU dans le code qui l'applique : si le moteur change (fenêtre
 * de charge, seuil du ratio, espacement des séances dures, semaine allégée, progression,
 * seuil de douleur, FC max écartée…), ce test rougit tant que la page n'a pas suivi.
 * Et la page existe dans les 5 langues, avec la même structure, l'avertissement « pas un
 * dispositif médical » et le numéro d'urgence, dans le plan du site et le pied de page.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { METHODE, SOURCES } from "../src/app/methode/methodeI18n";
import { SEUIL_DOULEUR_DECLAREE } from "../src/lib/health/seuilDouleur";
import { effectiveVma } from "../src/lib/running/fitness";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeOf = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const fr = METHODE.fr;
const texte = (id: string) => { const r = fr.rubriques.find((x) => x.id === id); assert.ok(r, `rubrique ${id} absente`); return [...r!.paras, ...(r!.points ?? [])].join(" "); };
const ctx = codeOf("src/lib/ai/coachContext.ts");
const un = (re: RegExp, src: string, quoi: string) => { const m = re.exec(src); assert.ok(m, `${quoi} introuvable dans le code`); return m!; };

console.log("\nLES CHIFFRES DE LA PAGE SONT CEUX DU CODE");

test("charge : forme sur 42 jours, fatigue sur 7 (modèle de Banister)", () => {
  const m = un(/ctl \+= \(tss - ctl\) \/ (\d+); atl \+= \(tss - atl\) \/ (\d+);/, ctx, "le modèle de charge");
  assert.match(texte("charge"), new RegExp(`${m[1]} jours[\\s\\S]*${m[2]} jours`), `la page ne dit plus ${m[1]} et ${m[2]} jours`);
});

test("ratio aigu/chronique : orange au-dessus de 1,5, rouge au-dessus de 1,8", () => {
  const rouge = un(/if \(load\.acr > (\d\.\d)\) loadFlag\(/, ctx, "le seuil rouge")[1];
  const orange = un(/if \(load\.acr > (\d\.\d) && load\.acr <= \d\.\d\) orangeFlags\.push/, ctx, "le seuil orange")[1];
  const t = texte("charge");
  assert.ok(t.includes(orange.replace(".", ",")) && t.includes(rouge.replace(".", ",")), `la page ne dit plus ${orange} / ${rouge}`);
  // Sa DÉFINITION : fatigue (7 j) / forme (42 j), moyennes exponentielles — pas « 7 jours contre 4 semaines ».
  assert.match(ctx, /acr: ctl > 0 \? atl \/ ctl : 0/, "le ratio n'est plus fatigue / forme dans le code");
  assert.match(t, /fatigue \(7 jours\) et ta forme \(42 jours\)/, "la page ne définit plus le ratio comme fatigue / forme");
  assert.doesNotMatch(JSON.stringify(METHODE), /4 dernières semaines|last 4 weeks|letzten 4 Wochen|últimas 4 semanas/, "la page parle de nouveau de « 4 dernières semaines »");
  assert.match(t, /pèse davantage les jours récents/, "la page présente de nouveau la forme comme une moyenne simple");
  // Rouge seulement si le corps ne dit pas « frais » ; un repère, pas un prédicteur.
  assert.match(ctx, /const loadFlag = \(msg: I18nText\) => \{ if \(loadRedOnly\) orangeFlags\.push\(msg\); else redFlags\.push\(msg\); \};/);
  assert.match(t, /orange seulement si[\s\S]*pas un prédicteur de blessure/, "la nuance sur le ratio a disparu");
});

test("séances dures espacées de 48 à 96 heures selon l'âge", () => {
  const m = un(/const hardGapH = age == null \? (\d+) : [^;]*: (\d+);/, ctx, "l'espacement des séances dures");
  assert.match(texte("semaine"), new RegExp(`${m[1]} à ${m[2]} heures`), `la page ne dit plus ${m[1]} à ${m[2]} heures`);
});

test("semaine allégée de 20 %, progression de 10 % au plus, 1, 2 ou 3 séances de qualité", () => {
  const deload = Number(un(/&& !semaineBornee\) factor \*= (0\.\d+);/, ctx, "la semaine allégée de la feuille de route")[1]);
  const debutant = un(/const growthBase = .*? \? (1\.\d+) : (1\.\d+);/, ctx, "la progression");
  const croissance = Number(debutant[2]);
  const freq = un(/const byFrequency = availDaysPerWeek <= 3 \? (\d) : availDaysPerWeek <= 5 \? (\d) : (\d);/, ctx, "le nombre de séances de qualité");
  const t = texte("semaine");
  assert.ok(t.includes(`${Math.round((1 - deload) * 100)} %`), "la semaine allégée a changé");
  assert.ok(t.includes(`${Math.round((croissance - 1) * 100)} % par semaine au plus (${Math.round((Number(debutant[1]) - 1) * 100)} %`), "la progression (ou celle des débutants) a changé");
  assert.ok(t.includes(`jusqu'à ${freq[1]}, ${freq[2]} ou ${freq[3]} séances de qualité`), "le nombre de séances de qualité a changé (ou n'est plus dit comme un plafond)");
  // La sortie longue : la moitié du volume, SAUF si on court déjà plus long.
  assert.match(codeOf("src/lib/running/volume.ts"), /const ceiling = Math\.max\(weeklyKm \* 0\.5, current\);/);
  assert.match(t, /moitié de ton volume, sauf si tu cours déjà plus long/, "la page tait l'exception de la sortie longue");
  assert.match(ctx, /une semaine sur quatre/, "la semaine allégée n'est plus « une sur quatre » dans le code");
});

test("douleur : l'intensité est retirée à partir de 4 sur 10", () => {
  assert.ok(texte("sante").includes(`${SEUIL_DOULEUR_DECLAREE} sur 10`), `le seuil de douleur est ${SEUIL_DOULEUR_DECLAREE}, la page dit autre chose`);
  assert.match(codeOf("src/lib/coach/qualityBudget.ts"), /qBudget = Math\.min\(qBudget, Math\.max\(0, sansDouleur - 1\)\);/, "la douleur ne retire plus UNE séance de qualité");
  assert.match(texte("sante"), /retire une séance de qualité de ta semaine/, "la page dit de nouveau « retire l'intensité »");
});

test("FC max : une valeur sous 150 battements est écartée ; Karvonen sous le seuil", () => {
  const fc = codeOf("src/lib/coach/fcCible.ts");
  const m = un(/const observeeFiable = observee != null && observee > (\d+) \? observee : null;/, fc, "le plancher de FC max observée");
  assert.ok(texte("fc").includes(`${m[1]} battements`), "le plancher de FC max a changé");
  assert.match(fc, /max: Math\.max\(declaree \?\? 0, observeeFiable \?\? 0\)/, "la FC max n'est plus la plus haute des deux");
  assert.match(texte("fc"), /la plus haute entre ce que tu as déclaré et ce que ta montre a mesuré/, "la page présente de nouveau un ordre de priorité");
  assert.match(texte("fc"), /sans fréquence de repos, un pourcentage de ta FC max/, "la page tait le repli sans FC de repos");
  assert.match(texte("fc"), /Karvonen/);
});

test("VMA : le test de 6 minutes, la plus haute des estimations ; le modèle de Daniels et Gilbert", () => {
  assert.match(texte("vma"), /6 minutes[\s\S]*la plus haute de ces estimations[\s\S]*VO2max de la montre est elle-même une estimation/);
  assert.equal(effectiveVma({ garminVo2: 40, fromRuns: 17.5 }).vma, 17.5, "la VMA n'est plus la plus haute des estimations");
  assert.equal(effectiveVma({ vmaStored: 15, fromRuns: 17.5 }).vma, 15, "le test n'a plus la priorité");
  // Daniels et Gilbert : les PRÉDICTIONS seulement ; les allures viennent du seuil mesuré, de la VMA, de la FC.
  const [predictions, entrainement] = fr.rubriques.find((r) => r.id === "allures")!.paras;
  assert.match(predictions, /Daniels et Gilbert[\s\S]*VO2max/, "les prédictions ne sont plus attribuées à Daniels et Gilbert (part de la VO2max)");
  assert.doesNotMatch(entrainement, /Daniels/, "les allures d'entraînement sont de nouveau attribuées à Daniels");
  assert.match(ctx, /const sPace = thresholdPace \?\? paceAt\(86\);/, "l'allure seuil ne vient plus du seuil mesuré puis de la VMA");
  assert.match(entrainement, /test de lactate[\s\S]*vitesse critique[\s\S]*pourcentage de ta VMA/);
});

console.log("\nLA PAGE ELLE-MÊME");

test("5 langues, même structure (rubriques, paragraphes, points)", () => {
  for (const l of ["en", "de", "es", "pt"] as const) {
    const M = METHODE[l];
    assert.deepEqual(M.rubriques.map((r) => r.id), fr.rubriques.map((r) => r.id), `rubriques différentes en ${l}`);
    M.rubriques.forEach((r, i) => {
      assert.equal(r.paras.length, fr.rubriques[i].paras.length, `paragraphes différents en ${l} (${r.id})`);
      assert.equal(r.points?.length ?? 0, fr.rubriques[i].points?.length ?? 0, `points différents en ${l} (${r.id})`);
    });
  }
});

test("les 4 traductions portent les mêmes chiffres que le français, rubrique par rubrique", () => {
  const chiffres = (r: { paras: string[]; points?: string[] }) => [...[...r.paras, ...(r.points ?? [])].join(" ").matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(",", "."));
  for (const l of ["en", "de", "es", "pt"] as const) {
    METHODE[l].rubriques.forEach((r, i) => assert.deepEqual(chiffres(r), chiffres(fr.rubriques[i]), `chiffres différents en ${l} (${r.id})`));
  }
});

test("« pas un dispositif médical » et le numéro d'urgence, dans chaque langue ; les sources citées", () => {
  assert.match(fr.avertissement, /pas un dispositif médical[\s\S]*15 ou 112/);
  for (const l of ["en", "de", "es", "pt"] as const) assert.match(METHODE[l].avertissement, /112/, `pas d'urgence en ${l}`);
  assert.match(METHODE.en.avertissement, /not a medical device/, "la formule attendue par Google Play manque en anglais");
  assert.ok(SOURCES.length >= 4 && SOURCES.some((s) => /Daniels/.test(s)) && SOURCES.some((s) => /Banister/.test(s)) && SOURCES.some((s) => /Karvonen/.test(s)));
});

test("l'aide du support ne reprend pas les formulations corrigées de la page", () => {
  const kb = codeOf("src/data/helpKb.ts");
  assert.ok(kb.includes('path: "/methode"'), "la page a disparu de l'aide du support");
  assert.doesNotMatch(kb, /deux estimations|allures et prédictions \(modèle de Daniels|fraîcheur \(modèle de Banister\)/, "l'aide du support reprend une formulation inexacte de la page");
});

test("dans le plan du site et le pied de page", () => {
  assert.match(codeOf("src/app/sitemap.ts"), /\{ path: "\/methode", freq: "monthly", priority: 0\.6 \}/);
  assert.match(codeOf("src/components/layout/SiteFooter.tsx"), /\{ href: "\/methode", label: f\.method \}/);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
for (const f of fails) console.log("  ✗ " + f);
if (fails.length) process.exit(1);
