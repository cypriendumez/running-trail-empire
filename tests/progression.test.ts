/**
 * LE COACH SAVAIT OÙ EN EST L'ATHLÈTE, PAS S'IL MONTE.
 *
 * Le verdict sur l'objectif — « atteignable », « ambitieux », « irréaliste » — reposait
 * sur une amélioration SUPPOSÉE de 0,4 % par semaine, la même pour tout le monde. Deux
 * athlètes de forme identique recevaient donc le même verdict, que l'un progresse et
 * l'autre stagne. Sur un compte réel : 8 % promis, 2,9 % réellement plausibles.
 *
 * ⚠️ UN PREMIER MARQUEUR A ÉTÉ ÉCARTÉ APRÈS MESURE. Estimer la forme par le « meilleur
 * effort de chaque bloc » donnait une série qui saute de 16,6 à 19,8 km/h d'un mois à
 * l'autre : elle dépend de savoir si l'athlète a fait une séance dure ce mois-là, pas
 * de sa forme. L'efficacité aérobie, mesurée à chaque footing, donne un rapport
 * signal/bruit de 3,4 sur le même compte.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  efficaciteParBloc, tendanceEfficacite, ameliorationAttendue,
  JOURS_BLOC, SEANCES_PAR_BLOC, BLOCS_MIN, SIGNAL_SUR_BRUIT_MIN, PART_FC_FACILE,
  GAIN_GENERIQUE_SEMAINE, GAIN_MAX, type CourseEfficacite,
} from "../src/lib/running/progression";
import { raceProjection } from "../src/lib/running/fitness";

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

const MAINTENANT = Date.parse("2026-09-06T12:00:00Z");
const jour = (n: number) => new Date(MAINTENANT - n * 86400000).toISOString().slice(0, 10);

/** `blocs` blocs de 4 semaines, `parBloc` sorties chacun, vitesse en km/h et FC donnée. */
function serieSimulee(blocs: number, parBloc: number, vitesse: (b: number) => number, fc = 150): CourseEfficacite[] {
  const out: CourseEfficacite[] = [];
  for (let b = 0; b < blocs; b++)
    for (let i = 0; i < parBloc; i++) {
      const v = vitesse(b);
      out.push({ date: jour(b * JOURS_BLOC + i * 2), distance_km: 10, duration_seconds: Math.round((10 / v) * 3600), avg_hr: fc });
    }
  return out;
}

console.log("\nLA MESURE — une pente, ou rien");

test("un athlète qui progresse a une pente positive", () => {
  // Bloc 0 = le plus RÉCENT : une vitesse qui baisse avec b est une progression.
  const s = efficaciteParBloc(serieSimulee(6, 5, (b) => 12 - b * 0.2), 200, MAINTENANT);
  const t = tendanceEfficacite(s)!;
  assert.ok(t, "aucune tendance sur une progression pourtant nette");
  assert.ok(t.pctParSemaine > 0, `pente ${t.pctParSemaine} %/sem sur un athlète qui accélère`);
  assert.equal(t.blocs, 6);
});

test("un athlète qui recule a une pente négative", () => {
  const t = tendanceEfficacite(efficaciteParBloc(serieSimulee(6, 5, (b) => 12 + b * 0.2), 200, MAINTENANT))!;
  assert.ok(t.pctParSemaine < 0, `pente ${t.pctParSemaine} %/sem sur un athlète qui ralentit`);
});

test("du bruit sans tendance ne donne AUCUN verdict", () => {
  // Vitesses en dents de scie : il n'y a rien à conclure, et le dire est la bonne réponse.
  const t = tendanceEfficacite(efficaciteParBloc(serieSimulee(6, 5, (b) => 12 + (b % 2 ? 0.9 : -0.9)), 200, MAINTENANT));
  assert.equal(t, null, "une tendance a été affirmée sur du bruit pur");
  assert.equal(SIGNAL_SUR_BRUIT_MIN, 2, "seuil de lisibilité : décision technique, à changer sciemment");
});

test("il faut plusieurs blocs pour parler de tendance", () => {
  // Nombres ÉCRITS EN DUR : les déduire de la constante rendrait le test aveugle.
  assert.equal(BLOCS_MIN, 4);
  assert.equal(tendanceEfficacite(efficaciteParBloc(serieSimulee(3, 5, () => 12), 200, MAINTENANT)), null,
    "3 blocs ne font pas une tendance");
  assert.equal(tendanceEfficacite([]), null);
});

test("un bloc trop maigre est écarté, pas complété", () => {
  assert.equal(SEANCES_PAR_BLOC, 3);
  const s = efficaciteParBloc(serieSimulee(6, 2, (b) => 12 - b * 0.2), 200, MAINTENANT);
  assert.equal(s.length, 0, "des blocs de 2 séances ont été retenus");
});

console.log("\nCE QU'ON REFUSE DE MESURER");

test("les séances DURES sont exclues du calcul", () => {
  // Sur une séance dure, la vitesse par battement monte sans que la forme ait bougé :
  // on mesurerait l'intensité du jour, pas le progrès.
  const fcMax = 200;
  const dures: CourseEfficacite[] = serieSimulee(6, 5, () => 12, Math.round(fcMax * PART_FC_FACILE) + 5);
  assert.equal(efficaciteParBloc(dures, fcMax, MAINTENANT).length, 0, "des séances dures sont entrées dans la mesure");
  // …et sans FC max connue, on ne peut pas trier : on garde tout plutôt que d'inventer.
  assert.ok(efficaciteParBloc(dures, null, MAINTENANT).length > 0);
});

test("marche, vélo mal étiqueté et données absurdes sont écartés", () => {
  const propre = serieSimulee(6, 5, (b) => 12 - b * 0.2);
  // ⚠️ ASSEZ D'INTRUS POUR DÉPLACER LA MÉDIANE d'un bloc : avec deux valeurs noyées dans
  // cinq séances valables, la médiane les absorbait et le test ne voyait rien.
  // ⚠️ UN SEUL TYPE D'INTRUS : sept valeurs très hautes ET sept très basses dans le même
  // bloc s'annulaient, la médiane ne bougeait pas et le test restait aveugle.
  const intrus: CourseEfficacite[] = [];
  for (let i = 0; i < 7; i++) intrus.push({ date: jour(1 + i * 2), distance_km: 30, duration_seconds: 3600, avg_hr: 130 });
  const sale: CourseEfficacite[] = [
    ...propre, ...intrus,
    { date: jour(3), distance_km: 10, duration_seconds: 3600, avg_hr: 20 },    // FC impossible
    { date: jour(4), distance_km: Number.NaN, duration_seconds: 3600, avg_hr: 140 },
    { date: "pas-une-date", distance_km: 10, duration_seconds: 3600, avg_hr: 140 },
  ];
  const attendu = tendanceEfficacite(efficaciteParBloc(propre, 200, MAINTENANT))!;
  const obtenu = tendanceEfficacite(efficaciteParBloc(sale, 200, MAINTENANT))!;
  assert.ok(obtenu, "les valeurs valables auraient dû suffire");
  assert.ok(Math.abs(obtenu.pctParSemaine - attendu.pctParSemaine) < 0.05,
    `la pente passe de ${attendu.pctParSemaine} à ${obtenu.pctParSemaine} : marche et vélo sont entrés dans la mesure`);
});

console.log("\nCE QU'ON EN FAIT — et ce qu'on ne promet pas");

test("la pente mesurée MODÈRE l'hypothèse, elle ne la remplace pas", () => {
  // ⚠️ Le marqueur baisse avec la chaleur à forme égale : une pente mesurée sur un été
  // est pessimiste. On retient la moitié de l'écart, pas la mesure brute.
  const recule = { pctParSemaine: -0.26, blocs: 9, signalSurBruit: 3.4, semaines: 32 };
  const g = ameliorationAttendue(37, recule);
  assert.ok(g > 0, "on a prédit zéro progrès sur une seule mesure d'efficacité");
  assert.ok(g < ameliorationAttendue(37, null), "la pente négative n'a pas tempéré l'hypothèse générique");
});

test("on ne promet JAMAIS de progrès à qui recule fortement", () => {
  const chute = { pctParSemaine: -2, blocs: 6, signalSurBruit: 5, semaines: 24 };
  assert.equal(ameliorationAttendue(20, chute), 0, "un gain promis à un athlète en chute libre");
  // …et on ne prédit pas non plus une dégradation : ce serait présomptueux dans l'autre sens.
  assert.ok(ameliorationAttendue(20, chute) >= 0);
});

test("le plafond de progrès tient", () => {
  const fusee = { pctParSemaine: 5, blocs: 6, signalSurBruit: 9, semaines: 24 };
  assert.equal(ameliorationAttendue(100, fusee), GAIN_MAX, "un athlète ne gagne pas 40 % en un bloc");
  assert.equal(ameliorationAttendue(0, fusee), 0, "aucune course en vue, aucun progrès à projeter");
  assert.equal(ameliorationAttendue(null, null), 0);
  assert.equal(GAIN_GENERIQUE_SEMAINE, 0.004, "hypothèse générique : décision, à changer sciemment");
});

test("la projection de course accepte la pente mesurée", () => {
  // Même forme, même échéance : le verdict doit DIFFÉRER selon la pente.
  const generique = raceProjection(19.6, 10, 2010, 37);
  const mesuree = raceProjection(19.6, 10, 2010, 37, 0.029);
  assert.ok(mesuree.projectedSec > generique.projectedSec,
    "la pente mesurée n'influence pas la projection : le verdict reste générique");
  // ⚠️ Comparer les SENS ne suffit pas : ignorer complètement la pente donne aussi une
  // projection plus lente. On exige la valeur exacte — 2,9 % de mieux que l'actuel.
  assert.equal(mesuree.projectedSec, Math.round(mesuree.nowSec * (1 - 0.029)),
    "la projection n'applique pas l'amélioration mesurée");
  // Une valeur illisible ne doit pas casser la projection.
  assert.equal(raceProjection(19.6, 10, 2010, 37, Number.NaN).projectedSec, generique.projectedSec);
});

console.log("\nBRANCHEMENT");

test("le contexte mesure la pente sur une fenêtre ASSEZ LONGUE", () => {
  // ⚠️ Défaut rencontré : branché sur les 60 séances de la requête principale (deux
  // mois), la tendance était « non mesurable » chez un athlète qui en avait pourtant
  // une, nette, sur 32 semaines.
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /280 \* 86400000/, "la fenêtre de mesure de la pente a été raccourcie");
  assert.match(src, /tendanceEfficacite\(efficaciteParBloc\(coursesForme, fcMaxEst, now\)\)/,
    "la pente n'est plus calculée sur la requête dédiée");
  // ⚠️ Le repli « PAS ENCORE MESURABLE » contient AUSSI « PENTE RÉELLE DE L'ATHLÈTE » :
  // chercher ce seul libellé laissait passer la suppression du bloc principal.
  assert.match(src, /PENTE RÉELLE DE L'ATHLÈTE \(mesurée, pas supposée\)/,
    "le bloc qui ANNONCE la pente a disparu du prompt");
  assert.match(src, /CE MARQUEUR BAISSE AVEC LA CHALEUR/,
    "le biais saisonnier n'est plus annoncé : le modèle conclurait à une perte de forme");
  assert.match(src, /PAS ENCORE MESURABLE/, "le cas « on ne sait pas » n'est plus dit");
});

test("l'efficacité aérobie n'est pas mesurée sur des séances dures", () => {
  // ⚠️ L'ÉTIQUETTE MENT, ET LE FICHIER LE SAIT. `isHardType` ne reconnaît que des mots
  // qu'intervals.icu n'écrit pas : mesuré sur le compte réel, 305 séances sur 334 sont
  // dites « easy », y compris à 180 bpm de moyenne. `easyEF` filtrait sur cette seule
  // étiquette alors que `isHardWk`, vingt lignes plus haut, croise déjà la FC.
  const src = codeOf("src/lib/ai/coachContext.ts");
  // ⚠️ On prend la LIGNE entière : `[^;]*` s'arrêtait au premier point-virgule, qui se
  // trouve À L'INTÉRIEUR du filtre (`const age = …;`) — la fenêtre examinée n'atteignait
  // jamais le test d'intensité, et le test échouait sur du code pourtant correct.
  const m = src.split("\n").find((l) => l.includes("const easyRuns = runs.filter"));
  assert.ok(m, "le filtre des footings a disparu");
  assert.ok(/!isHardWk\(w\)/.test(m),
    "l'efficacité aérobie retient les séances sur la seule étiquette : une séance dure entrera dans une mesure censée être à faible intensité");
  assert.ok(!/!isHardType\(w\.type\)/.test(m),
    "le filtre par étiquette seule est revenu");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
