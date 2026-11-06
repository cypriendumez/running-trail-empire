/**
 * LES BATTEMENTS SUR LA MONTRE, ET LE FOOTING COURU TROP VITE (07/11/2026).
 *
 * Cyprien : « pour la fréquence cardiaque, fais de même : ajuste s'il y a des différences trop
 * majeures lors des séances ». Mesuré sur son compte (FC max réellement atteinte 212, repos
 * 49 d'après sa Garmin) : des « Footing en endurance » courus à 164, 166 et 170 bpm, comptés
 * faciles par le plan (seuil « dur » à 85 % de la FC max = 180 bpm), et une montre qui ne
 * recevait que « Z1 HR / Z2 HR », les zones larges d'intervals.icu.
 *
 *   npx tsx tests/fc-montre.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { referencesFc, ciblesFcAthlete, footingTropIntense, plageFc, MARGE_FOOTING_DUR, avecFcMaxMontre, plageEnPctMax, maxDeReference, PIC_FC_JOURS, fcMaxSaison, FENETRE_SAISON_JOURS, DEMI_FENETRE_AN_DERNIER_JOURS, airFroid, BAISSE_HIVER_BPM, SEUIL_FROID_C } from "../src/lib/coach/fcCible";
import { avecSaison } from "../src/lib/coach/ciblesFcServeur";
import { stepsForType, parseReps, buildWorkoutDescription } from "../src/lib/watch/intervals";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const code = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const REFS = referencesFc({ maxObservee: 212, repos: 49 });
// Ses footings d'octobre (FC moyennes), dont trois courus trop vite.
const FOOTINGS = [143, 145, 170, 164, 166, 144, 156, 142, 150, 153, 140];
const CIBLES = ciblesFcAthlete(REFS, FOOTINGS)!;
// Telles qu'elles partent : avec la FC max réglée dans SON intervals.icu (212, relue le 07/11/2026).
const MONTRE = avecFcMaxMontre(CIBLES, 212)!;

console.log("\nLES CIBLES — mesurées, personnelles, larges de 10 battements");

test("le compte de Cyprien : footing 143-153, récup 133-143, footing « dur » dès 167 bpm", () => {
  assert.deepEqual(plageFc("endurance", REFS), { lo: 152, hi: 162 }, "endurance théorique (réserve 66 %)");
  assert.deepEqual(CIBLES.endurance, { lo: 143, hi: 153 }, "la cible suit ses footings faciles, plus bas que la théorie");
  assert.deepEqual(CIBLES.recup, { lo: 133, hi: 143 }, "la récupération reste sous l'endurance");
  assert.equal(CIBLES.plafondFooting, 162 + MARGE_FOOTING_DUR);
});

test("sans FC max mesurée (âge seul), aucune cible : la montre garde ses zones", () => {
  assert.equal(ciblesFcAthlete(referencesFc({ age: 22 }), FOOTINGS), null);
  assert.equal(ciblesFcAthlete(referencesFc({}), FOOTINGS), null);
});

test("les footings trop rapides ne tirent pas la cible vers le haut", () => {
  const tousVite = ciblesFcAthlete(REFS, [170, 172, 168, 171, 169, 175, 173, 170, 168, 172])!;
  assert.deepEqual(tousVite.endurance, { lo: 152, hi: 162 }, "un coureur qui court tout trop vite garde la cible théorique");
});

console.log("\nLE FOOTING COURU TROP VITE COMPTE COMME UNE SÉANCE DURE");

test("170 bpm sur 30 min : dur ; 164 ou 166 : non ; 170 sur 15 min : non ; sans cibles : jamais", () => {
  assert.equal(footingTropIntense(170, 30 * 60, CIBLES), true, "le footing du 09/10 à 170 bpm");
  assert.equal(footingTropIntense(167, 30 * 60, CIBLES), true, "le plafond est inclus");
  assert.equal(footingTropIntense(166, 30 * 60, CIBLES), false);
  assert.equal(footingTropIntense(164, 60 * 60, CIBLES), false);
  assert.equal(footingTropIntense(170, 15 * 60, CIBLES), false, "une course de 15 min n'est pas une séance");
  assert.equal(footingTropIntense(170, 30 * 60, null), false);
  assert.equal(footingTropIntense(null, 30 * 60, CIBLES), false, "une FC absente n'est pas une FC de 0");
});

test("le coach range ce footing parmi les séances dures, sauf au palier gratuit", () => {
  const c = code("src/lib/ai/coachContext.ts");
  assert.match(c, /\|\| \(isRun\(w\.sport\) && footingTropIntense\(w\.avg_hr, w\.duration_seconds, ciblesFc\)\)/, "le footing trop intense ne compte plus comme dur");
  assert.match(c, /const ciblesFc: CiblesFc \| null = objectifSeul \? null : ciblesFcAthlete\(/, "le palier gratuit lit de nouveau la fréquence cardiaque");
  assert.ok(c.indexOf("const ciblesFc: CiblesFc") < c.indexOf("const isHardWk"), "les cibles doivent exister avant le classement des séances");
});

console.log("\nLA MONTRE REÇOIT DES BATTEMENTS — écrits comme intervals.icu les comprend");

test("« 133-143bpm » n'est PAS compris par intervals.icu : on écrit des % de SA FC max, au dixième", () => {
  // Vérifié le 07/11/2026 sur son compte : « - 8m 133-143bpm Échauffement » arrivait SANS cible,
  // « - Échauffement 8m 62.7-67.5% HR » arrivait avec { hr: { start: 62.7, end: 67.5, units: "%hr" } }.
  assert.equal(plageEnPctMax({ lo: 133, hi: 143 }, 212), "62.7-67.5% HR");
  assert.equal(plageEnPctMax({ lo: 143, hi: 153 }, 212), "67.5-72.2% HR");
  assert.equal(avecFcMaxMontre(CIBLES, null), null, "sans la FC max de la montre, on ne convertit pas");
  assert.equal(avecFcMaxMontre(CIBLES, 60), null, "une FC max absurde ne sert pas de base");
  assert.equal(avecFcMaxMontre(null, 212), null);
});

const etapes = (type: string, ciblesFc: typeof MONTRE | null, toutEnAllure = false, detail = "", reps: ReturnType<typeof parseReps> = null, pace: number | null = 292) =>
  stepsForType(type, 50, 20.1, pace, 10, 10, reps, detail, toutEnAllure, ciblesFc) ?? "";

test("footing sur Garmin : échauffement et retour au calme 133-143 bpm, corps 143-153 bpm, libellé lu par la montre", () => {
  const s = etapes("Endurance", MONTRE);
  assert.match(s, /^- Échauffement 10m 62\.7-67\.5% HR$/m);
  assert.match(s, /^- Endurance facile \d+m 67\.5-72\.2% HR$/m);
  assert.match(s, /^- Retour au calme 10m 62\.7-67\.5% HR$/m);
  assert.doesNotMatch(s, /pace|Z\d HR|bpm/, "un footing mêle de nouveau allure, zones larges ou battements bruts");
});

test("sortie longue et récupération aussi ; sans cibles ou sans la FC max de la montre, rien ne change", () => {
  assert.match(etapes("Sortie longue", MONTRE), /- Endurance facile \d+m 67\.5-72\.2% HR/);
  assert.match(etapes("Récup", MONTRE), /- Récup \d+m 62\.7-67\.5% HR/);
  for (const c of [null, CIBLES]) {
    const sans = etapes("Endurance", c);
    assert.match(sans, /Z1 HR Échauffement/);
    assert.match(sans, /4:44-5:00 pace Endurance facile/, "sans FC max de la montre, le footing garde son allure");
  }
});

test("séance de qualité : échauffement en battements, corps toujours à l'allure (10 s)", () => {
  const s = etapes("Seuil", MONTRE, false, "", null, 228);
  assert.match(s, /- Échauffement 10m 62\.7-67\.5% HR/);
  assert.match(s, /3:43-3:53 pace Seuil/, "le corps d'une qualité n'est plus à l'allure");
  const r = parseReps("6×1000 m à 3'20/km, récup 2 min", null);
  const v = etapes("VMA", MONTRE, false, "", r, 200);
  assert.match(v, /3:15-3:25 pace/);
  assert.match(v, /62\.7-67\.5% HR Récup/, "les récups entre répétitions repassent en zone large");
});

test("hors Garmin (tout en allure), aucune étape en battements : mêler les deux y vide une étape", () => {
  assert.doesNotMatch(etapes("Endurance", MONTRE, true), /% HR|bpm/);
});

test("le vélo garde ses zones : une FC de course n'est pas une FC de vélo", () => {
  assert.doesNotMatch(etapes("Vélo endurance", MONTRE), /% HR|bpm/);
});

test("de bout en bout : la séance du 11/11 partirait en battements sur sa Garmin", () => {
  const b = buildWorkoutDescription("Footing en endurance", "Échauffement 5 min progressif FC Z1→Z2 → Corps : ~3,5 km (environ 20 min) en Z2 (~5'43/km) → Retour au calme 5 min FC Z1.", "endurance Endurance Z2", "sub 16 min", 20.1, 15, 10, "Garmin", MONTRE);
  assert.ok(b);
  assert.match(b!.description, /^- Échauffement 5m 62\.7-67\.5% HR$/m);
  assert.match(b!.description, /^- Endurance facile 20m 67\.5-72\.2% HR$/m);
  assert.doesNotMatch(b!.description, /\dbpm/, "des battements bruts, qu'intervals.icu ignore");
});

test("les quatre envois vers la montre passent les cibles, avec la FC max de la montre", () => {
  assert.match(code("src/lib/ai/autoCoach.ts"), /const ciblesFc = avecFcMaxMontre\(ctx\.ciblesFc, await fcMaxMontre\(\{ athleteId, apiKey \}\)\)/);
  assert.match(code("src/lib/ai/autoCoach.ts"), /objectiveRace, ctx\.vma, warmMin, coolMin, montre, ciblesFc\)/);
  assert.match(code("src/app/api/admin/assign-session/route.ts"), /avecFcMaxMontre\(await ciblesFcPour\(admin, user_id\), await fcMaxMontre\(\{ athleteId, apiKey \}\)\)\)/);
  for (const f of ["src/app/api/admin/publish-plan/route.ts", "src/app/api/admin/repush-watch/route.ts"]) {
    const c = code(f);
    assert.match(c, /const ciblesFc = avecFcMaxMontre\(await ciblesFcPour\(admin, user_id\), await fcMaxMontre\(\{ athleteId, apiKey \}\)\)/, f);
    assert.match(c, /warmMin, coolMin, montre, ciblesFc[,)]/, f);
  }
  assert.match(code("src/lib/coach/ciblesFcServeur.ts"), /if \(profil\.error \|\| base\.error \|\| fcMax\.error \|\| footings\.error\) return null;/, "une lecture ratée fabriquerait des cibles");
});

console.log("\nLA FC MAX ACTUELLE — montre d'abord, sinon le pic des six derniers mois");

test("ordre : déclarée, sinon la montre ; et jamais sous le pic des 6 derniers mois", () => {
  assert.equal(PIC_FC_JOURS, 183);
  assert.equal(maxDeReference(null, 212), 212, "la FC max de la montre sert quand rien n'est déclaré");
  assert.equal(maxDeReference(205, 212), 205, "la déclarée passe avant la montre");
  assert.equal(maxDeReference(null, null), null);
  assert.equal(maxDeReference(null, 0), null, "un réglage vide n'est pas une FC max");
  // Son compte : réglage montre 212, pic des 6 derniers mois 209 (04/08), 212 atteint le 04/04 (7 mois).
  assert.equal(referencesFc({ maxDeclaree: maxDeReference(null, 212), maxObservee: 209 }).max, 212);
  assert.equal(referencesFc({ maxDeclaree: maxDeReference(null, null), maxObservee: 209 }).max, 209, "sans montre : le pic des 6 mois, pas celui d'il y a 7 mois");
  assert.equal(referencesFc({ maxDeclaree: maxDeReference(null, 190), maxObservee: 205 }).max, 205, "jamais sous un pic réellement atteint ces 6 mois");
});

test("la synchro garde la FC max de la montre ; coach et envois lisent 6 mois et la montre", () => {
  for (const f of ["src/lib/intervals/syncUser.ts", "src/app/api/intervals/sync/route.ts"])
    assert.match(code(f), /maxHR: Number\(lastRun(Act)?\?\.athlete_max_hr\) \|\| null,/, `${f} ne garde plus la FC max de la montre`);
  const c = code("src/lib/ai/coachContext.ts");
  assert.match(c, /\.not\("max_hr", "is", null\)\.gte\("date", new Date\(Date\.now\(\) - PIC_FC_JOURS \* 86400000\)/, "le coach relit le pic de TOUT l'historique");
  assert.match(c, /const maxHrDeclare = maxDeReference\(num\(b\?\.max_hr\) \?\? num\(p\?\.max_hr\),\s*\(\(\(p as Record<string, unknown> \| null\)\?\.garmin_metrics\) as Record<string, unknown> \| null\)\?\.maxHR\)/, "le coach ignore la FC max de la montre");
  assert.match(c, /\.filter\(w => now - new Date\(String\(w\.date\)\.slice\(0, 10\) \+ "T12:00:00Z"\)\.getTime\(\) <= PIC_FC_JOURS \* 86400000\)/, "les 60 séances lues peuvent remonter au-delà de 6 mois");
  const srv = code("src/lib/coach/ciblesFcServeur.ts");
  assert.match(srv, /\.gte\("date", new Date\(maintenant - PIC_FC_JOURS \* 86400000\)/);
  assert.match(srv, /maxDeclaree: maxDeReference\(num\(b\?\.max_hr\) \?\? num\(p\?\.max_hr\), garmin\?\.maxHR\)/);
});

console.log("\nLA FC MAX DE SAISON — l'hiver, on atteint moins haut");

test("son historique : pic 202 en décembre, 199 en janvier ; janvier 2027 serait calé vers 202, pas 212", () => {
  assert.equal(FENETRE_SAISON_JOURS, 42);
  assert.equal(DEMI_FENETRE_AN_DERNIER_JOURS, 21);
  // Début novembre : 204 ces 6 semaines, 212 aux mêmes semaines l'an dernier (15/11/2025) → 212.
  assert.equal(fcMaxSaison(212, 204, 212), 212);
  // Janvier : ~200 ces 6 semaines, 202 aux mêmes semaines l'an dernier → 202.
  assert.equal(fcMaxSaison(212, 200, 202), 202);
  // Jamais au-dessus de la référence.
  assert.equal(fcMaxSaison(205, 210, 212), 205);
  // Un effort maximal récent l'emporte sur l'an dernier.
  assert.equal(fcMaxSaison(212, 208, 199), 208);
});

test("sans saison déjà vécue (rien aux mêmes semaines l'an dernier), la référence reste", () => {
  assert.equal(fcMaxSaison(212, 180, null), 212, "6 semaines sans effort dur ne font pas une FC max de 180");
  assert.equal(fcMaxSaison(null, 200, 202), null);
  assert.equal(fcMaxSaison(212, null, 120), 212, "un pic absurde n'est pas une saison");
});

test("les cibles suivent la saison : en janvier, footing et plafond descendent de 2 à 3 battements", () => {
  const ete = ciblesFcAthlete(REFS, FOOTINGS)!;
  const hiver = ciblesFcAthlete(avecSaison(REFS, { recent: 200, anDernier: 202 }), FOOTINGS)!;
  assert.ok(hiver.plafondFooting < ete.plafondFooting, `plafond ${hiver.plafondFooting} contre ${ete.plafondFooting}`);
  assert.ok(ete.plafondFooting - hiver.plafondFooting <= 8, "la saison ne doit pas effondrer les zones");
  // Des pics plus bas que 220 − âge : recaler une estimation d'âge sur eux la ferait passer pour une mesure.
  assert.equal(avecSaison(referencesFc({ age: 22 }), { recent: 190, anDernier: 185 }).max, 198, "une FC max tirée de l'âge n'est pas recalée sur la saison");
  assert.equal(avecSaison(REFS, null), REFS, "une lecture ratée garde la référence");
});

test("le coach et les envois vers la montre appliquent la saison, sauf au palier gratuit", () => {
  const c = code("src/lib/ai/coachContext.ts");
  assert.match(c, /const picsDeSaison = objectifSeul \? null : await picsSaison\(sb as never, userId, now\);/);
  assert.match(c, /ciblesFcAthlete\(\s*avecSaison\(referencesFc\(/, "le coach ignore la saison");
  assert.match(c, /\}\), picsDeSaison, /, "le coach ne passe plus les pics de saison");
  const srv = code("src/lib/coach/ciblesFcServeur.ts");
  assert.match(srv, /const refs = avecSaison\(refs0, await picsSaison\(sb, userId, maintenant\), froid\);/);
  assert.match(srv, /if \(recent\.error \|\| anDernier\.error\) return null;/, "un pic à moitié lu fabriquerait une saison");
});

console.log("\nSANS HIVER ENREGISTRÉ : −5 bpm QUAND L'AIR EST FROID");

const semaine = (min: number, max: number) => Array.from({ length: 7 }, () => ({ tempMin: min, tempMax: max }));

test("l'air froid se lit dans les prévisions (moyenne sous 8 °C), jamais sur le calendrier", () => {
  assert.equal(SEUIL_FROID_C, 8);
  assert.equal(airFroid(semaine(1, 7)), true, "Lille en décembre : 4 °C de moyenne");
  assert.equal(airFroid(semaine(9, 16)), false, "Nice en décembre : 12,5 °C");
  assert.equal(airFroid(semaine(6, 10)), false, "8 °C pile n'est pas froid");
  assert.equal(airFroid([]), false, "sans prévisions, pas de baisse");
  assert.equal(airFroid(semaine(1, 7).slice(0, 2)), false, "deux jours ne font pas une semaine");
  assert.equal(airFroid(null), false);
});

test("−5 bpm pour qui n'a pas d'hiver enregistré, par temps froid ; son effort récent l'emporte", () => {
  assert.equal(BAISSE_HIVER_BPM, 5);
  assert.equal(fcMaxSaison(212, 190, null, true), 207, "212 − 5");
  assert.equal(fcMaxSaison(212, 210, null, true), 210, "jamais sous une FC réellement atteinte ces 6 semaines");
  assert.equal(fcMaxSaison(212, 190, null, false), 212, "sans froid, rien ne bouge");
  assert.equal(fcMaxSaison(212, 200, 202, true), 202, "avec un hiver enregistré, ce sont SES données qui comptent, pas la baisse");
  assert.equal(fcMaxSaison(null, 190, null, true), null);
  assert.equal(avecSaison(REFS, { recent: null, anDernier: null }, true).max, 207);
  assert.equal(avecSaison(referencesFc({ age: 22 }), { recent: null, anDernier: null }, true).max, 198, "une FC max tirée de l'âge ne bouge pas");
});

test("le coach et les envois lisent la météo de sa position, avant les cibles de FC", () => {
  const c = code("src/lib/ai/coachContext.ts");
  assert.match(c, /\}\), picsDeSaison, airFroid\(forecast\)\),/, "le coach ignore l'air froid");
  assert.ok(c.indexOf("const forecast = weather.days;") > 0 && c.indexOf("const forecast = weather.days;") < c.indexOf("const ciblesFc: CiblesFc"), "les prévisions doivent être lues avant les cibles");
  const srv = code("src/lib/coach/ciblesFcServeur.ts");
  assert.match(srv, /const froid = lat != null && lon != null \? airFroid\(await forecastWeek\(lat, lon\)\.catch\(\(\) => \[\]\)\) : false;/);
  assert.match(srv, /const refs = avecSaison\(refs0, await picsSaison\(sb, userId, maintenant\), froid\);/);
});

console.log("\nDÉFAUTS TROUVÉS PAR LE CRASH-TEST DU 07/11/2026");

test("une FC hors du domaine humain n'est pas une mesure (repos à 1e9 → cibles de 1e9 bpm)", () => {
  const r = referencesFc({ maxObservee: 190, repos: 1e9 });
  assert.equal(r.repos, null, "une FC de repos absurde est lue");
  const c = ciblesFcAthlete(r, [])!;
  assert.ok(c.endurance.hi <= 190 && c.recup.hi <= 190, `cibles ${JSON.stringify(c)}`);
  assert.equal(referencesFc({ maxObservee: 190, repos: 170 }).repos, null, "une réserve de 20 bpm est absurde");
  assert.equal(referencesFc({ maxObservee: 190, repos: 10 }).repos, null, "une FC de repos de 10 n'existe pas (capteur, saisie)");
  assert.equal(referencesFc({ maxDeclaree: 9999 }).source, "aucune");
  assert.equal(referencesFc({ maxObservee: 190, seuil: 5 }).seuil, null);
});

test("une FC max de montre plus basse que nos cibles : on garde ses zones plutôt qu'un % impossible", () => {
  assert.equal(avecFcMaxMontre(CIBLES, 150), null, "« 94-100.7% HR » partirait sur la montre");
  assert.ok(avecFcMaxMontre(CIBLES, 212));
});

test("« air froid » : une case vide n'est pas 0 °C", () => {
  assert.equal(airFroid([{ tempMin: "", tempMax: "" }, { tempMin: "", tempMax: "" }, { tempMin: "", tempMax: "" }] as never), false);
  assert.equal(airFroid([{ tempMin: "1", tempMax: "2" }, { tempMin: 1, tempMax: 2 }, { tempMin: 1, tempMax: 2 }] as never), false, "du texte n'est pas une prévision");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
