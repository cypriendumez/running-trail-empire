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
});

test("séances dures espacées de 48 à 96 heures selon l'âge", () => {
  const m = un(/const hardGapH = age == null \? (\d+) : [^;]*: (\d+);/, ctx, "l'espacement des séances dures");
  assert.match(texte("semaine"), new RegExp(`${m[1]} à ${m[2]} heures`), `la page ne dit plus ${m[1]} à ${m[2]} heures`);
});

test("semaine allégée de 20 %, progression de 10 % au plus, 1, 2 ou 3 séances de qualité", () => {
  const deload = Number(un(/deload \? (0\.\d+) : growth/, ctx, "la semaine allégée")[1]);
  const croissance = Number(un(/const growth = load\.acr > 1\.5 \? 1\.0 : load\.acr > 1\.3 \? 1\.05 : (1\.\d+);/, ctx, "la progression")[1]);
  const freq = un(/const byFrequency = availDaysPerWeek <= 3 \? (\d) : availDaysPerWeek <= 5 \? (\d) : (\d);/, ctx, "le nombre de séances de qualité");
  const t = texte("semaine");
  assert.ok(t.includes(`${Math.round((1 - deload) * 100)} %`), "la semaine allégée a changé");
  assert.ok(t.includes(`${Math.round((croissance - 1) * 100)} % par semaine au plus`), "la progression a changé");
  assert.ok(t.includes(`${freq[1]}, ${freq[2]} ou ${freq[3]} séances de qualité`), "le nombre de séances de qualité a changé");
  assert.match(ctx, /une semaine sur quatre/, "la semaine allégée n'est plus « une sur quatre » dans le code");
});

test("douleur : l'intensité est retirée à partir de 4 sur 10", () => {
  assert.ok(texte("sante").includes(`${SEUIL_DOULEUR_DECLAREE} sur 10`), `le seuil de douleur est ${SEUIL_DOULEUR_DECLAREE}, la page dit autre chose`);
});

test("FC max : une valeur sous 150 battements est écartée ; Karvonen sous le seuil", () => {
  const fc = codeOf("src/lib/coach/fcCible.ts");
  const m = un(/const observeeFiable = observee != null && observee > (\d+) \? observee : null;/, fc, "le plancher de FC max observée");
  assert.ok(texte("fc").includes(`${m[1]} battements`), "le plancher de FC max a changé");
  assert.match(texte("fc"), /Karvonen/);
});

test("VMA : le test de 6 minutes, la plus haute des estimations ; le modèle de Daniels et Gilbert", () => {
  assert.match(texte("vma"), /6 minutes[\s\S]*plus haute des deux/);
  assert.match(codeOf("src/lib/running/fitness.ts"), /Math\.max\(/, "la VMA n'est plus la plus haute des estimations");
  assert.match(texte("allures"), /Daniels et Gilbert/);
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

test("« pas un dispositif médical » et le numéro d'urgence, dans chaque langue ; les sources citées", () => {
  assert.match(fr.avertissement, /pas un dispositif médical[\s\S]*15 ou 112/);
  for (const l of ["en", "de", "es", "pt"] as const) assert.match(METHODE[l].avertissement, /112/, `pas d'urgence en ${l}`);
  assert.match(METHODE.en.avertissement, /not a medical device/, "la formule attendue par Google Play manque en anglais");
  assert.ok(SOURCES.length >= 4 && SOURCES.some((s) => /Daniels/.test(s)) && SOURCES.some((s) => /Banister/.test(s)) && SOURCES.some((s) => /Karvonen/.test(s)));
});

test("dans le plan du site et le pied de page", () => {
  assert.match(codeOf("src/app/sitemap.ts"), /\{ path: "\/methode", freq: "monthly", priority: 0\.6 \}/);
  assert.match(codeOf("src/components/layout/SiteFooter.tsx"), /\{ href: "\/methode", label: f\.method \}/);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
for (const f of fails) console.log("  ✗ " + f);
if (fails.length) process.exit(1);
