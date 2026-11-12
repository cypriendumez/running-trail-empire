/**
 * LE PACK JOUR J (Premium, Cyprien, 30/10/2026) — tout ce qu'il faut savoir le jour J.
 *
 * Calculé, jamais inventé : ces tests gardent que chaque brique est CELLE que l'application
 * utilise déjà (le verdict de la carte d'objectif, le modèle de chaleur, la nutrition de
 * course), que le tableau de marche tombe pile sur l'objectif, qu'un trail ne reçoit pas
 * d'allure au kilomètre, et que le pack reste réservé à Premium.
 *
 *   npx tsx tests/jour-j.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { packJourJ, temps, penaliteChaleurCourse, type EntreeJourJ } from "../src/lib/coach/jourJ";
import { JOURJ_T } from "../src/lib/coach/jourJI18n";
import { raceProjection, PART_PENALITE_CHALEUR } from "../src/lib/running/fitness";
import { heatAdvice } from "../src/lib/weather/openMeteo";
import { planNutritionCourse } from "../src/lib/coach/nutritionCourse";
import { peut } from "../src/lib/billing/access";
import { T } from "../src/lib/i18n/translations";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/** Le défi de Cyprien : 5 km en 15'59 le 19/12, VMA 20,1, 50 jours avant. */
const SUB16: EntreeJourJ = {
  objectif: { nom: "sub 16 min", date: "2026-12-19", distanceKm: 5, viseSec: 959, officielle: false },
  joursRestants: 50, vma: 20.1, socle: { sortieLongueKm: 42.5, volumeHebdoKm: 66.8 }, ameliorationAttendue: null, progressionMesuree: false,
  dplusM: null, terrain: null, poidsKg: 64, meteo: null,
};
const MARATHON: EntreeJourJ = {
  objectif: { nom: "Marathon de Paris", date: "2027-04-11", distanceKm: 42.195, viseSec: 9600, officielle: true },
  joursRestants: 160, vma: 20.1, socle: { sortieLongueKm: 32, volumeHebdoKm: 80 }, ameliorationAttendue: 0.03, progressionMesuree: true,
  dplusM: 100, terrain: "route", poidsKg: 64, meteo: null,
};

console.log("\nLE CHRONO — le même verdict que la carte d'objectif");

test("le verdict et les projections sont ceux de raceProjection, avec les mêmes entrées", () => {
  const p = packJourJ(SUB16);
  const r = raceProjection(20.1, 5, 959, 50 / 7, null, SUB16.socle);
  assert.equal(p.chrono.verdict, r.verdict);
  assert.equal(p.chrono.projeteSec, r.projectedSec);
  assert.equal(p.chrono.maintenantSec, Math.round(r.nowSec));
  assert.equal(p.chrono.allureSecKm, 959 / 5, "l'allure n'est plus celle de l'objectif");
  assert.equal(temps(p.chrono.allureSecKm!), "3'12");
});

test("objectif hors de portée : l'allure vise la projection, pas le rêve", () => {
  const p = packJourJ({ ...SUB16, vma: 16 });
  assert.equal(p.chrono.verdict, "irrealiste");
  assert.equal(p.chrono.allureSecKm, p.chrono.projeteSec! / 5);
  assert.equal(p.passages[p.passages.length - 1].tempsSec, p.chrono.projeteSec, "le tableau de marche vise encore l'objectif hors de portée");
});

test("sans VMA, pas de prédiction inventée : l'allure de l'objectif, verdict inconnu", () => {
  const p = packJourJ({ ...SUB16, vma: null });
  assert.equal(p.chrono.verdict, "inconnu");
  assert.equal(p.chrono.maintenantSec, null);
  assert.equal(p.chrono.allureSecKm, 959 / 5);
});

console.log("\nLE TABLEAU DE MARCHE — pile sur l'objectif");

test("5 km : un passage par kilomètre, l'arrivée exactement à 15'59", () => {
  const p = packJourJ(SUB16);
  assert.deepEqual(p.passages.map((x) => x.km), [1, 2, 3, 4, 5]);
  assert.equal(temps(p.passages[4].tempsSec), "15'59", "l'arrondi de l'allure a décalé l'arrivée");
  assert.equal(p.strategie, "courte");
});

test("marathon : tous les 5 km, l'arrivée exactement à l'objectif, consigne de course longue", () => {
  const p = packJourJ(MARATHON);
  assert.deepEqual(p.passages.map((x) => x.km), [5, 10, 15, 20, 25, 30, 35, 40, 42.2]);
  assert.equal(p.passages[8].tempsSec, 9600);
  assert.equal(p.strategie, "longue");
});

test("trail (terrain, dénivelé ou ultra) : aucune allure au kilomètre, gestion à l'effort", () => {
  for (const e of [
    { ...MARATHON, terrain: "trail" },
    { ...MARATHON, dplusM: 1500 },                      // 35 m de D+ par km
    { ...MARATHON, objectif: { ...MARATHON.objectif, distanceKm: 80 }, dplusM: null },
  ]) {
    const p = packJourJ(e);
    assert.equal(p.mode, "trail");
    assert.equal(p.passages.length, 0, "une allure au kilomètre sur un trail");
    assert.equal(p.chrono.allureSecKm, null);
    assert.equal(p.meteo.scenarios.length, 0);
    assert.equal(p.echauffement, "marche");
  }
});

console.log("\nLA MÉTÉO — le modèle de chaleur de l'application, divisé par deux pour une course");

test("selon la température : la pénalité de chaleur × la part retenue pour un effort de course", () => {
  const p = packJourJ(SUB16);
  for (const s of p.meteo.scenarios) {
    const attendu = Math.round(heatAdvice(s.tempC, null).penaltySecPerKm * PART_PENALITE_CHALEUR);
    assert.equal(Math.round((s.allureSecKm - 959 / 5) * 100) / 100, attendu, `${s.cle} : pénalité inventée`);
  }
  assert.equal(p.meteo.scenarios.find((s) => s.cle === "doux")?.tempsSec, 959, "par temps doux, l'objectif bouge");
});

test("à sept jours, la prévision remplace les scénarios et nourrit l'hydratation", () => {
  const p = packJourJ({ ...MARATHON, joursRestants: 4, meteo: { tempC: 27, humidite: 80, ventKmh: 30 } });
  assert.equal(p.meteo.prevue?.allureSecKm, 9600 / 42.195 + penaliteChaleurCourse(27, 80));
  assert.equal(p.nutrition?.plan.tempConnue, true, "l'hydratation ignore la prévision");
  assert.equal(p.nutrition?.plan.mlParH, planNutritionCourse({ dureeSec: p.meteo.prevue!.tempsSec, distanceKm: 42.195, poidsKg: 64, tempC: 27 })!.mlParH);
});

console.log("\nLE RAVITAILLEMENT, L'ÉCHAUFFEMENT, LA VEILLE");

test("moins de 75 min : rien à manger ; un marathon : des gels, et les glucides de la veille", () => {
  assert.equal(packJourJ(SUB16).nutrition, null);
  const m = packJourJ(MARATHON);
  assert.ok(m.nutrition && m.nutrition.plan.gels > 0, "pas de gel sur un marathon");
  assert.equal(m.veilleGlucidesG, m.nutrition!.plan.avantCourseG);
});

test("l'échauffement suit la distance ; le Pass Prévention Santé, la course officielle seulement", () => {
  assert.equal(packJourJ(SUB16).echauffement, "court");
  assert.equal(packJourJ({ ...MARATHON, objectif: { ...MARATHON.objectif, distanceKm: 21.1, viseSec: 4500 } }).echauffement, "moyen");
  assert.equal(packJourJ(MARATHON).echauffement, "leger");
  assert.equal(packJourJ(SUB16).pps, false, "le PPS demandé pour un défi perso");
  assert.equal(packJourJ(MARATHON).pps, true);
});

console.log("\nLES BRANCHEMENTS — Premium, rien d'inventé, cinq langues");

test("réservé à Premium (et à l'essai) : la page renvoie la vue verrouillée avant tout calcul", () => {
  assert.ok(!peut("starter", "jour_j") && !peut("gratuit", "jour_j"));
  assert.ok(peut("premium", "jour_j") && peut("essai", "jour_j"));
  const page = codeNu("src/app/dashboard/jour-j/page.tsx");
  const iVerrou = page.indexOf(`"jour_j")) return <VerrouJourJ`);
  assert.ok(iVerrou > 0 && iVerrou < page.indexOf("packJourJ("), "le pack se calcule avant le verrou");
  // La course du catalogue : nom ET date exacts ; la météo : seulement dans la fenêtre de prévision.
  assert.match(page, /\.eq\("name", objectif\.race\)\.eq\("date", objectif\.raceDate\)/);
  assert.match(page, /joursRestants >= 0 && joursRestants <= 6/, "une météo est cherchée hors de la fenêtre de prévision");
  assert.match(codeNu("src/components/dashboard/ObjectiveCard.tsx"), /href="\/dashboard\/jour-j"/, "la carte d'objectif ne mène plus au pack");
});

test("les textes existent dans les cinq langues, avec les mêmes clés", () => {
  const cles = (o: object) => Object.keys(o).sort().join(",");
  for (const l of ["en", "de", "es", "pt"] as const) {
    assert.equal(cles(JOURJ_T[l]), cles(JOURJ_T.fr), `${l} : des textes manquent`);
    assert.equal(cles(JOURJ_T[l].echauffementTexte), cles(JOURJ_T.fr.echauffementTexte));
    assert.equal(cles(JOURJ_T[l].tranche), cles(JOURJ_T.fr.tranche));
  }
  for (const l of ["fr", "en", "de", "es", "pt"] as const) assert.ok(T[l]["obj.packJourJ"], `obj.packJourJ manque en ${l}`);
});

test("la pente de Jour J passe par la règle unique : FC max sans valeur par défaut, aucune mesure sans elle", () => {
  // 12/11/2026 : sans FC max, la pente mêlait séances dures et faciles. La règle vit dans
  // `efficaciteParBloc` (tests/progression) ; ici, le site d'appel lui passe la VRAIE FC max ou null.
  const src = codeNu("src/app/dashboard/jour-j/page.tsx");
  // 12/11/2026 : la MÊME FC max que le coach (`fcMaxConnue`) — déclarée (test, profil, montre),
  // pic des 6 mois, seuil — et rien d'autre (ni âge, ni valeur par défaut).
  assert.match(src, /const fcMax = fcMaxConnue\(\{\s*declaree: Number\(base\?\.max_hr\) \|\| Number\(p\?\.max_hr\) \|\| null, montre: gm\?\.maxHR,\s*observee: picFcObserve\(seances, jour\), seuil: [^}]*\}\)\.max;/,
    "la FC max de Jour J a quitté la définition commune (ou reçu une valeur par défaut)");
  assert.match(src, /max_hr, garmin_metrics`\)/, "Jour J ne lit plus la FC max du profil ni celle de la montre");
  assert.match(src, /tendanceEfficacite\(efficaciteParBloc\([^;]*?, fcMax, /, "Jour J ne passe plus sa FC max à la mesure de pente");
});

test("la projection au jour J dit si la progression est MESURÉE ou SUPPOSÉE (12/11/2026)", () => {
  // Sans pente mesurée, `ameliorationAttendue` renvoie l'hypothèse générique (+0,4 %/semaine) :
  // elle déplace le chrono « au jour J » sans que rien ne le dise. Désormais l'écran le dit.
  const page = codeNu("src/app/dashboard/jour-j/page.tsx");
  assert.match(page, /progressionMesuree: tendance != null,/, "la page ne dit plus si la pente a été mesurée");
  const vue = codeNu("src/components/jourJ/PackJourJVue.tsx");
  assert.match(vue, /c\.progressionMesuree \? t\.progressionMesuree : t\.progressionSupposee\(n\(GAIN_GENERIQUE_SEMAINE \* 100\)\)/,
    "l'écran ne distingue plus une progression mesurée d'une progression supposée");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const sup = JOURJ_T[lang].progressionSupposee("0,4");
    assert.ok(sup.includes("0,4") && JOURJ_T[lang].progressionMesuree.length > 20, `${lang} : texte manquant`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
