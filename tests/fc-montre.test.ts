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
import { execSync } from "node:child_process";
import { vmaAffichee, effortDesSeances, acclimatationDesSeances, SEANCES_VMA } from "../src/lib/dashboard/vmaAffichee";
import { readFileSync } from "node:fs";
import { referencesFc, ciblesFcAthlete, footingTropIntense, plageFc, MARGE_FOOTING_DUR, avecFcMaxMontre, plageEnPctMax, maxDeReference, PIC_FC_JOURS, fcMaxSaison, FENETRE_SAISON_JOURS, DEMI_FENETRE_AN_DERNIER_JOURS, airFroid, BAISSE_HIVER_BPM, SEUIL_FROID_C, fcMaxConnue, picFcObserve, seuilMesure, fcMaxPourEfforts } from "../src/lib/coach/fcCible";
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
  // 12/11/2026 : l'âge n'est même plus lu — un ancien appelant qui le passerait n'obtient rien.
  assert.equal(ciblesFcAthlete(referencesFc({ age: 22 } as Parameters<typeof referencesFc>[0]), FOOTINGS), null);
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
  assert.match(c, /\.not\("max_hr", "is", null\)\.gte\("date", new Date\(Date\.now\(\) - PIC_FC_JOURS \* 86400000\)/, "le coach ne limite plus le pic aux 6 derniers mois");
  assert.match(c, /const gmFc = \(\(p as Record<string, unknown> \| null\)\?\.garmin_metrics \?\? null\) as Record<string, unknown> \| null;\s*const maxHrDeclare = maxDeReference\(num\(b\?\.max_hr\) \?\? num\(p\?\.max_hr\), gmFc\?\.maxHR\);/, "le coach ignore la FC max de la montre");
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
  // Sans FC max mesurée (l'âge ne compte plus, 12/11/2026), la saison n'en fabrique pas une.
  assert.equal(avecSaison(referencesFc({ age: 22 } as Parameters<typeof referencesFc>[0]), { recent: 190, anDernier: 185 }).max, null, "la saison invente une FC max");
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
  assert.equal(avecSaison(referencesFc({ age: 22 } as Parameters<typeof referencesFc>[0]), { recent: null, anDernier: null }, true).max, null, "l'air froid invente une FC max");
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

test("UNE seule FC max : coach, zones, discipline, montre, Jour J, bilan, analyse de séance et Ghost Runner (12/11/2026)", () => {
  // Avant : quatre chaînes (déclarée/pic > 150/âge ; test/pic > 120 ; seuil/âge ; test/pic/âge).
  // Relecture du 12/11 : vérifier la PRÉSENCE de l'appel ne suffit pas — un site appelait bien
  // `fcMaxConnue` avec un pic de tout l'historique ou un seuil d'une autre source. On vérifie donc
  // ce qui lui est PASSÉ : la déclarée (test, profil, montre), le pic des 6 mois, le seuil test → montre.
  // Le test (lt_hr) d'abord, la montre (lthr) ensuite — dans cet ordre.
  const SEUIL = /^seuil: seuilMesure\(.*\blt_hr\b.*, [^,]*\blthr\)/;
  const sites: [string, RegExp[]][] = [
    ["src/lib/ai/coachContext.ts", [/fcMaxConnue\(\{ declaree: maxHrDeclare, observee: obsMaxHr0, seuil: seuilMesure\(b\?\.lt_hr, gmFc\?\.lthr\) \}\)/,
      /\.not\("max_hr", "is", null\)\.gte\("date", new Date\(Date\.now\(\) - PIC_FC_JOURS \* 86400000\)/]],
    ["src/app/dashboard/jour-j/page.tsx", [/fcMaxConnue\(\{\s*declaree: Number\(base\?\.max_hr\) \|\| Number\(fcProfil\?\.max_hr\) \|\| null, montre: gm\?\.maxHR,\s*observee: picFcObserve\(seances, jour\), seuil: seuilMesure\(base\?\.lt_hr, gm\?\.lthr\)/]],
    ["src/lib/ai/bilanDonnees.ts", [/fcMaxConnue\(\{\s*declaree: Number\(base\?\.max_hr\) \|\| Number\(prof\?\.max_hr\) \|\| null, montre: gm\?\.maxHR,\s*observee: picFcObserve\(seances, jour\), seuil: seuilMesure\(base\?\.lt_hr, gm\?\.lthr\)/]],
    ["src/app/api/ai/analyse-seance/route.ts", [/fcMaxConnue\(\{\s*declaree: Number\(baseFc\?\.max_hr\) \|\| Number\(profFc\?\.max_hr\) \|\| null, montre: profFc\?\.garmin_metrics\?\.maxHR,\s*observee: \(picRes\.data [^)]*\)\?\.max_hr, seuil: seuilMesure\(baseFc\?\.lt_hr, profFc\?\.garmin_metrics\?\.lthr\)/,
      /\.not\("max_hr", "is", null\)\s*\.gte\("date", new Date\(Date\.now\(\) - PIC_FC_JOURS \* 86400000\)/]],
    ["src/app/dashboard/ghost-runner/page.tsx", [/\.gt\("max_hr", 150\)\s*\.gte\("date", new Date\(Date\.now\(\) - PIC_FC_JOURS \* 86400000\)/,
      /classifyRun\(w, fcMaxCommune\)/, /fcMaxConnue\(\{\s*declaree: Number\(bGr\?\.max_hr\) \|\| Number\(pGr\?\.max_hr\) \|\| null, montre: pGr\?\.garmin_metrics\?\.maxHR,\s*observee: fcMaxObservee, seuil: seuilMesure\(bGr\?\.lt_hr, pGr\?\.garmin_metrics\?\.lthr\)/]],
    ["src/components/ghost-runner/GhostRunner.tsx", [/maxDeclaree: maxDeReference\([^\n]*, gm\?\.maxHR\),/, /seuil: seuilMesure\(\(baseline as unknown as \{ lt_hr\?: number \} \| null\)\?\.lt_hr, gm\?\.lthr\)/]],
    ["src/lib/coach/ciblesFcServeur.ts", [/seuil: seuilMesure\(b\?\.lt_hr, garmin\?\.lthr\)/, /\.gte\("date", new Date\(maintenant - PIC_FC_JOURS \* 86400000\)/]],
  ];
  for (const [f, res] of sites) for (const re of res) assert.match(code(f), re, `${f} : la FC max ne reçoit plus les entrées communes (${re.source.slice(0, 60)}…)`);
  // Aucun site ne passe un seuil d'une autre source.
  for (const [f] of sites) {
    const c = code(f);
    for (const m of c.matchAll(/\bseuil: ([^\n]+)/g)) assert.match(`seuil: ${m[1]}`, SEUIL, `${f} : seuil passé hors de seuilMesure (${m[1].slice(0, 60)})`);
  }
  // Les sélections lisent bien ce que la définition commune consomme.
  assert.match(code("src/lib/ai/bilanDonnees.ts"), /select\("garmin_vo2max,pace_curve,max_hr,garmin_metrics"\)/, "le bilan ne lit plus la FC max du profil ni de la montre");
  assert.match(code("src/lib/ai/bilanDonnees.ts"), /select\("vma_kmh,max_hr,lt_hr,tested_at"\)/, "le bilan ne lit plus le seuil mesuré");
  assert.match(code("src/lib/ai/bilanDonnees.ts"), /if \(baseRes\.error \|\| profilRes\.error\) \{[\s\S]{0,160}return null;/, "le bilan ne lit plus l'erreur des lectures de FC");
  assert.match(code("src/app/dashboard/jour-j/page.tsx"), /sb\.from\("profiles"\)\.select\("max_hr, garmin_metrics"\)/, "Jour J ne lit plus la FC du profil à part (elle mettrait en jeu la porte d'accès)");
  assert.match(code("src/app/dashboard/jour-j/page.tsx"), /const ePanneFc = baseRes\.error \?\? fcProfilRes\.error;\s*if \(ePanneFc\) await journaliserEchec/, "Jour J ne lit plus l'erreur des lectures de FC");
  assert.match(code("src/app/api/ai/analyse-seance/route.ts"), /objRes\.error \?\? picRes\.error;/, "l'analyse ne lit plus l'erreur du pic de FC");
  assert.match(code("src/app/dashboard/ghost-runner/page.tsx"), /const eBase = baselineRes\.error && baselineRes\.error\.code !== "PGRST116" \? baselineRes\.error : null;\s*const ePanneFc = ePic \?\? eRecentes \?\? profileRes\.error \?\? eBase;\s*if \(ePanneFc\) await journaliserEchecUneFois/, "le Ghost Runner ne lit plus l'erreur du pic, des footings, du profil ou du test de référence");
  // Le coach : zones et discipline des footings lisent la MÊME valeur ; le seuil des zones aussi.
  const c = code("src/lib/ai/coachContext.ts");
  assert.match(c, /const maxHrEff = fcMaxEst;/, "les zones ont retrouvé leur propre FC max");
  assert.match(c, /const fcMax = fcMaxEst;/, "la discipline des footings a retrouvé sa propre FC max");
  assert.match(c, /const lthrMeasured = seuilMesure\(ltHr, gm\?\.lthr\);/, "le seuil des zones a retrouvé sa propre source");
});

test("seuilMesure : le test d'abord, puis la montre ; hors du domaine humain, rien", () => {
  assert.equal(seuilMesure(175, 180), 175, "la montre passe devant le test");
  assert.equal(seuilMesure(null, 180), 180);
  assert.equal(seuilMesure(1e9, 180), 180, "un seuil absurde est retenu");
  assert.equal(seuilMesure(null, 40), null);
  // Même coureur (seuil test 175, montre 180) : coach, Jour J, bilan, montre et Ghost lisent 175 ÷ 0,92.
  assert.equal(fcMaxConnue({ seuil: seuilMesure(175, 180) }).max, Math.round(175 / 0.92));
});

test("picFcObserve : le pic des 6 derniers mois, pas celui d'avant ni d'après", () => {
  const s = [{ date: "2026-11-01", max_hr: 180 }, { date: "2026-03-01", max_hr: 210 }, { date: "2026-11-20", max_hr: 220 }, { date: "2026-10-01", max_hr: null }];
  assert.equal(picFcObserve(s, "2026-11-12"), 180, "un pic de plus de 6 mois (ou futur) compte encore");
  assert.equal(picFcObserve([], "2026-11-12"), null);
  assert.equal(fcMaxConnue({ observee: 180 }).max, 180);
  assert.equal(fcMaxConnue({ declaree: 175, observee: 180 }).max, 180, "jamais sous le pic réellement atteint");
  assert.equal(fcMaxConnue({ montre: 195, observee: 180 }).max, 195, "la montre sert de FC max déclarée");
  assert.equal(fcMaxConnue({ observee: 145 }).max, null, "un pic de 145 n'est pas une FC max");
  assert.equal(fcMaxConnue({ seuil: 175 }).source, "seuil");
  assert.deepEqual(fcMaxConnue({}), { max: null, source: "aucune" });
});

test("la VMA estimée trie ses efforts avec la FC max COMMUNE, partout (Cyprien, 12/11/2026)", () => {
  // La FC max commune d'abord. Sans elle (inconnue OU panne), le pic > 120 des séances reste un
  // GARDE-FOU de tri (relecture du 12/11) : sans aucun tri, toute sortie passait pour un effort maximal.
  assert.equal(fcMaxPourEfforts(188, [{ max_hr: 205 }]), 188, "un pic des séances passe devant la FC max commune");
  assert.equal(fcMaxPourEfforts(null, [{ max_hr: 175 }, { max_hr: 140 }]), 175, "FC max inconnue : plus aucun tri des efforts");
  assert.equal(fcMaxPourEfforts(undefined, [{ max_hr: 175 }, { max_hr: 140 }]), 175, "en panne, plus aucun tri des efforts");
  assert.equal(fcMaxPourEfforts(null, [{ max_hr: 110 }]), null);
  // Le cycliste qui vient au running (profil 5) : sans FC max, un vélo rapide ne fait JAMAIS la VMA affichée.
  const jour = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const courses = [1, 3, 5, 8].map((n) => ({ date: jour(n), sport: "run", type: "easy", distance_km: 10, duration_seconds: 3300, avg_hr: 135, max_hr: 148 }));
  // Vélo SANS cardio : le tri par la FC ne l'écarte pas (FC moyenne absente) — seul le filtre « course » le peut.
  const velo = { date: jour(2), sport: "bike", type: "ride", distance_km: 40, duration_seconds: 5760, avg_hr: null, max_hr: null };
  for (const fcMax of [null, undefined] as const) {
    const sans = vmaAffichee({ seances: courses, baseline: null, profil: null, fcMax }).vma;
    const avec = vmaAffichee({ seances: [velo, ...courses], baseline: null, profil: null, fcMax }).vma;
    assert.ok(sans > 0, "précondition : les sorties de course doivent donner une VMA");
    assert.equal(avec, sans, `FC max ${fcMax} : la sortie vélo a changé la VMA affichée (${sans} → ${avec})`);
  }
  const v = code("src/lib/dashboard/vmaAffichee.ts");
  assert.match(v, /const courses = lues\.filter\(\(w\) => isRun\(w\.sport\)\);\s*return meilleurEffort\(courses, fcMaxPourEfforts\(fcMax, courses\), 120, acclimatationDesSeances\(lues, maintenant\)\);/, "effortDesSeances trie de nouveau avec son propre pic, lit d'autres sports ou oublie la chaleur");
  assert.match(v, /const effort = effortDesSeances\(i\.seances, i\.fcMax\);/, "vmaAffichee a de nouveau son propre calcul d'effort");
  assert.doesNotMatch(v, /obsMaxHr/, "vmaAffichee recalcule son propre pic");
  // Chaque écran passe la FC max COMMUNE (lue par fcMaxDeLAthlete, ou déjà calculée par fcMaxConnue).
  const sites: [string, RegExp[]][] = [
    ["src/app/dashboard/layout.tsx", [/fcMaxDeLAthlete\(supabase, user\.id\),/, /fcMax: fcMaxVma,/]],
    ["src/app/dashboard/page.tsx", [/fcMaxDeLAthlete\(supabase, user!\.id\),/, /fcMax: fcMaxVma,/, /seances: \(seancesVmaRes\.data \?\? \[\]\) as /, /\.limit\(SEANCES_VMA\),/]],
    ["src/lib/indicateurs/donnees.ts", [/fcMaxDeLAthlete\(sb, userId\),/, /profil: p, fcMax: fcMaxVma \}/, /vmaAffichee\(\{ seances: \(seancesVma\.data \?\? \[\]\) as /, /\.limit\(SEANCES_VMA\),/, /serieRessentis, seancesVma\]\.filter\(\(r\) => r\.error\)/]],
    ["src/app/dashboard/jour-j/page.tsx", [/seances: seances as Parameters<typeof vmaAffichee>/]],
    ["src/lib/ai/bilanDonnees.ts", [/seances: seances as Parameters<typeof vmaAffichee>/]],
    ["src/app/dashboard/jour-j/page.tsx", [/fcMax: ePanneFc \? undefined : fcMax,/]],
    ["src/lib/ai/bilanDonnees.ts", [/profil: profilRes\.data as [^\n]*,\s*fcMax,\s*\}\);/]],
    ["src/lib/ai/coachContext.ts", [/const effort = effortDesSeances\(\(woRes\.data \?\? \[\]\) as never, await fcMaxDeLAthlete\(sb, userId\)\);/, /fromRuns: effort\?\.vma \?\? null,/,
      /fromRuns: objectifSeul \? null : effortDesSeances\(workouts as never, fcMaxEst, now\)\?\.vma \?\? estimateVmaFromRuns/, /const acclimVma = acclimatationDesSeances\(workouts as never, now\);/]],
    ["src/app/dashboard/plans/page.tsx", [/fcMaxDeLAthlete\(supabase, user\.id\),/, /fromRuns: effortDesSeances\(wks, fcMaxVma\)\?\.vma \?\? null,/, /select\("date, type, sport, distance_km, duration_seconds, avg_hr, max_hr, weather_temp_c"\)/]],
    ["src/app/dashboard/layout.tsx", [/select\("date,type,sport,distance_km,duration_seconds,avg_hr,max_hr,weather_temp_c"\)\s*\.eq\("user_id", user\.id\)\.order\("date", \{ ascending: false \}\)\.limit\(SEANCES_VMA\)/]],
    ["src/app/dashboard/health/page.tsx", [/fcMaxDeLAthlete\(supabase, user\.id\),/, /fromRuns: effortDesSeances\(\(seancesRes\.data \?\? \[\]\) as never, fcMaxVma\)\?\.vma \?\? null,/, /select\("date,type,sport,distance_km,duration_seconds,avg_hr,max_hr,weather_temp_c"\)/]],
    ["src/app/dashboard/shop/page.tsx", [/fcMaxDeLAthlete\(supabase, user\.id\),/, /fromRuns: effortDesSeances\(seances as never, fcMaxVma\)\?\.vma \?\? null,/, /select\("date,type,distance_km,sport,elevation_gain_m,duration_seconds,avg_hr,max_hr,weather_temp_c"\)/]],
    ["src/app/dashboard/shop/[slug]/page.tsx", [/fcMaxDeLAthlete\(supabase, user\.id\),/, /fromRuns: effortDesSeances\(seances as never, fcMaxVma\)\?\.vma \?\? null,/, /select\("date,type,distance_km,sport,elevation_gain_m,duration_seconds,avg_hr,max_hr,weather_temp_c"\)/]],
    ["src/app/dashboard/profile/page.tsx", [/fcMaxDeLAthlete\(supabase, user!\.id\),/, /fromRuns: effortDesSeances\(rw, fcMaxCommune\)\?\.vma \?\? null,/, /select\("date, distance_km, duration_seconds, type, sport, avg_hr, max_hr, weather_temp_c"\)/,
      /const fcMaxPanne = fcMaxCommune === undefined && fcMaxZones == null;/, /fcMax: fcMaxZones, fcMaxPanne,/,
      /const fcMaxZones = fcMaxCommune !== undefined \? fcMaxCommune : \(Number\(\(baseline as \{ max_hr\?: number \} \| null\)\?\.max_hr\) \|\| null\);/, /fcMax: fcMaxZones,/]],
    ["src/components/profile/ProfileSettings.tsx", [/const maxHr = fitness\?\.fcMax \?\? 0;/, /\{!zones && \([\s\S]{0,300}tr\(fitness\?\.fcMaxPanne \? "perf\.zonesPanne" : "perf\.zonesInconnues"\)/]],
    ["src/app/api/admin/analyze-session/route.ts", [/const histFcMax = \(await fcMaxDeLAthlete\(admin, user_id\)\) \?\? null;/]],
  ];
  for (const [f, res] of sites) for (const re of res) assert.match(code(f), re, `${f} : la VMA (ou la FC max affichée) ne reçoit plus la FC max commune (${re.source.slice(0, 50)}…)`);
  // Plus aucun pic maison (> 120 / > 150) hors de fcCible.
  for (const [f] of sites) assert.doesNotMatch(code(f), /(obsMax|histMax|fcObservee)\w* *> *1[25]0/, `${f} : un pic maison est de retour`);
  // La valeur de TRI des efforts (un simple pic) ne CLASSE jamais une intensité ni ne s'affiche (directeur
  // scientifique, 12/11/2026) : ni `classifyRun(…, fcMaxPourEfforts(…))`, ni une variable qui en vient.
  const toutSrc = execSync("grep -rln 'fcMaxPourEfforts' src || true", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  for (const f of toutSrc) {
    const c = code(f);
    assert.doesNotMatch(c, /classifyRun\([^)]*fcMaxPourEfforts/, `${f} : la valeur de tri classe une intensité`);
    for (const m of c.matchAll(/const (\w+) = fcMaxPourEfforts\(/g)) assert.doesNotMatch(c, new RegExp(`classifyRun\\([^)]*\\b${m[1]}\\b`), `${f} : ${m[1]} (valeur de tri) classe une intensité`);
  }
});

test("les lectures de séances de la VMA lisent leur erreur (une panne ne fait pas retomber la VMA en silence)", () => {
  assert.match(code("src/app/dashboard/page.tsx"), /lecturesEnEchec\(\[[\s\S]{0,400}\["vma", seancesVmaRes\],/, "tableau de bord : la panne des séances de la VMA n'est plus lue");
  assert.match(code("src/app/dashboard/layout.tsx"), /\{ data: seancesVma, error: eSeancesVma \}, \{ data: testVma, error: eTestVma \}[\s\S]{0,1600}if \(eSeancesVma \|\| eTestVma\) console\.error/, "en-tête : la panne des séances de la VMA n'est plus lue");
  for (const f of ["src/app/dashboard/shop/page.tsx", "src/app/dashboard/shop/[slug]/page.tsx"])
    assert.match(code(f), /if \(seancesRes\.error\) console\.error\(/, `${f} : la panne des séances n'est plus lue`);
  assert.match(code("src/app/dashboard/jour-j/page.tsx"), /if \(seancesRes\.error\) await journaliserEchec\(/, "Jour J : la panne des séances n'est plus lue");
  assert.match(code("src/app/dashboard/plans/page.tsx"), /\[woRes, baseRes, profRes\]\.map\(\(r\) => estUnePanne\(r\) \? r\.error : null\)[\s\S]{0,80}if \(ePanne\) console\.error/, "Plans : la panne des lectures n'est plus lue");
  assert.match(code("src/app/dashboard/profile/page.tsx"), /const ePanneProfil = eRecentWk \?\? eProfil \?\? \(eBaseline && eBaseline\.code !== "PGRST116" \? eBaseline : null\);\s*if \(ePanneProfil\) console\.error/, "Profil : la panne des lectures n'est plus lue");
});

test("UN seul calcul de « meilleur effort » dans tout src/ : `effortDesSeances` (12/11/2026)", () => {
  // Avant : 40 séances au tableau de bord, 60 au coach, 120 aux Plans, 200 en Santé et en Boutique ;
  // chaleur au coach seulement ; tous sports sans tri en Santé et en Boutique. Un coureur lisait
  // 29,3 km/h en Santé quand le coach disait 19,1 (mesure en production, lecture seule).
  const sites = execSync("grep -rlnE 'meilleurEffort\\(|bestVmaFromWorkouts\\(' src || true", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  assert.deepEqual(sites.sort(), ["src/lib/dashboard/vmaAffichee.ts", "src/lib/running/fitness.ts"], `un calcul d'effort parallèle est de retour : ${sites.join(", ")}`);
});

test("effortDesSeances : 60 séances, course seulement, FC max commune, chaleur — le coach et les écrans", () => {
  const jour = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const run = (n: number, km: number, sec: number, x: Record<string, unknown> = {}) => ({ date: jour(n), sport: "run", type: "easy", distance_km: km, duration_seconds: sec, avg_hr: 170, max_hr: 185, ...x });
  // 1. LES 60 PLUS RÉCENTES : un record en 61e position (tous sports compris) ne compte plus — comme au coach.
  const recentes = Array.from({ length: 60 }, (_, k) => ({ date: jour(1 + k % 50), sport: k % 2 ? "bike" : "run", type: "x", distance_km: 10, duration_seconds: 3000, avg_hr: 170, max_hr: 185 }));
  const record = run(55, 10, 2100);
  const sansRecord = effortDesSeances(recentes, 190)!.vma;
  assert.equal(effortDesSeances([...recentes, { ...record, date: jour(51) }], 190)!.vma, sansRecord, "une 61e séance plus ancienne est lue");
  // …même quand l'appelant les passe dans le désordre : ce sont les 60 plus RÉCENTES, pas les 60 premières.
  assert.equal(effortDesSeances([{ ...record, date: jour(51) }, ...recentes], 190)!.vma, sansRecord, "les séances ne sont plus triées par date avant d'être coupées");
  assert.ok(effortDesSeances([{ ...record, date: jour(0) }, ...recentes], 190)!.vma > sansRecord, "précondition : le même record parmi les 60 doit compter");
  assert.equal(SEANCES_VMA, 60, "le coach lit 60 séances (fetchWorkouts)");
  // 2. LA CHALEUR : une course à 30 °C, chez un coureur non acclimaté, se relit plus vite qu'à 12 °C.
  const chaud = effortDesSeances([run(2, 10, 2700, { weather_temp_c: 30 })], 190)!.vma;
  const frais = effortDesSeances([run(2, 10, 2700, { weather_temp_c: 12 })], 190)!.vma;
  assert.ok(chaud > frais, `la chaleur n'est plus prise en compte (${chaud} contre ${frais})`);
  // …et l'acclimatation (≥ 12 jours chauds sur 30) en corrige moins.
  const acclimate = Array.from({ length: 12 }, (_, k) => run(3 + k, 5, 1800, { weather_temp_c: 28, avg_hr: 120 }));
  const chaudAcclimate = effortDesSeances([run(2, 10, 2700, { weather_temp_c: 30 }), ...acclimate], 190)!.vma;
  assert.ok(chaudAcclimate < chaud, "l'acclimatation à la chaleur n'est plus prise en compte");
  assert.ok(acclimatationDesSeances(acclimate) < 1 && acclimatationDesSeances([]) === 1);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
