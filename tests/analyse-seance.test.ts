/**
 * AUCUNE SÉANCE PASSÉE N'ÉTAIT JAMAIS RELUE.
 *
 * Le coach PROPOSAIT la séance du jour et s'arrêtait là. Une fois courue, la séance
 * redevenait une grille de chiffres que l'athlète devait interpréter seul — c'est-à-dire
 * faire lui-même le travail qu'il paie.
 *
 * ⚠️ CE QUE CES TESTS PROTÈGENT, dans l'ordre d'importance :
 * 1. Le modèle ne doit recevoir que des faits CALCULÉS, et la liste de ce qu'on ignore.
 * 2. L'intensité se juge à la FRÉQUENCE CARDIAQUE. Mesuré sur un compte réel : 305
 *    séances sur 334 sont dites « easy » par la montre, séances à 182 bpm comprises.
 * 3. La route est verrouillée CÔTÉ SERVEUR et mémorise son résultat : sans l'un, la
 *    formule ne verrouille rien ; sans l'autre, on repaie le même texte à chaque
 *    ouverture.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  faitsDeSeance, zonesEnMinutes, allureTexte, dateLisible,
  PART_FC_DURE, PART_FC_FACILE, ECART_DISTANCE, COMPARABLES_MIN, FC_PLANCHER,
  type SeanceBrute,
} from "../src/lib/ai/analyseSeance";

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

const SEANCE: SeanceBrute = {
  id: "a", date: "2026-08-24", sport: "run", distance_km: 21.13, duration_seconds: 4740,
  avg_pace_min_km: 3.74, gap_min_km: 3.75, avg_hr: 182, max_hr: 196,
  elevation_gain_m: 40, hr_zone_seconds: [120, 60, 1680, 2460, 360], avg_cadence_spm: 176, weather_temp_c: 19,
};

console.log("\nL'INTENSITÉ SE JUGE À LA FC, PAS À L'ÉTIQUETTE");

test("une séance à 86 % de la FC max est DURE, quoi qu'en dise la montre", () => {
  // Cas réel : ce semi à 3'44/km est étiqueté « easy » par intervals.icu.
  assert.equal(PART_FC_DURE, 0.85, "seuil partagé avec le coach : à changer des deux côtés");
  assert.equal(faitsDeSeance(SEANCE, { fcMax: 212 }).intensite, "dure");
  assert.equal(faitsDeSeance({ ...SEANCE, avg_hr: 145 }, { fcMax: 212 }).intensite, "facile");
  assert.equal(PART_FC_FACILE, 0.75);
  assert.equal(faitsDeSeance({ ...SEANCE, avg_hr: 170 }, { fcMax: 212 }).intensite, "moderee");
});

test("sans FC max connue, aucune intensité n'est affirmée", () => {
  const f = faitsDeSeance(SEANCE, {});
  assert.equal(f.intensite, null, "une intensité annoncée sans point de référence");
  assert.equal(f.partFcMax, null);
  assert.ok(f.manques.some((m) => /FC maximale/.test(m)), "l'ignorance n'est pas signalée");
});

test("une séance sans cardio le dit au lieu de se taire", () => {
  const f = faitsDeSeance({ ...SEANCE, avg_hr: null }, { fcMax: 212 });
  assert.equal(f.intensite, null);
  assert.ok(f.manques.some((m) => /fréquence cardiaque/.test(m)));
});

console.log("\nUNE SÉANCE INEXPLOITABLE NE S'INTERPRÈTE PAS");

test("une séance sans distance ni durée n'a rien à dire", () => {
  // ⚠️ CAS RÉEL, vu sur un appel en production : une séance du compte porte 64 bpm de
  // moyenne, 65 de max et aucune distance — la montre a enregistré du repos. Le coach en
  // a tiré « une bonne gestion de l'effort malgré la chaleur ». Il n'a inventé aucun
  // chiffre : il a inventé du SENS, ce qui est pire parce que ça ne se repère pas.
  const f = faitsDeSeance({ date: "2026-04-25", sport: "run", distance_km: null, duration_seconds: null, avg_hr: 64, max_hr: 65, weather_temp_c: 29 }, { fcMax: 212 });
  assert.equal(f.exploitable, false, "une ligne vide a été jugée analysable");
  assert.ok(f.manques.some((m) => /ni distance ni durée/.test(m)));
});

test("une FC moyenne de coureur au repos est signalée", () => {
  assert.equal(FC_PLANCHER, 90, "plancher : décision d'entraîneur, à changer sciemment");
  assert.equal(faitsDeSeance({ date: "2026-04-25", sport: "run", distance_km: 8, duration_seconds: 2400, avg_hr: 64 }, { fcMax: 212 }).exploitable, false);
  assert.equal(faitsDeSeance({ date: "2026-04-25", sport: "run", distance_km: 8, duration_seconds: 2400, avg_hr: 140 }, { fcMax: 212 }).exploitable, true,
    "une séance normale a été jugée inexploitable");
});

test("une séance normale reste exploitable", () => {
  assert.equal(faitsDeSeance(SEANCE, { fcMax: 212 }).exploitable, true);
});

console.log("\nLES ZONES — mesurées ou absentes, jamais devinées");

test("les secondes de la montre deviennent des minutes", () => {
  assert.deepEqual(zonesEnMinutes([120, 60, 1680]), [2, 1, 28]);
  assert.deepEqual(zonesEnMinutes({ z1: 120, z2: 60 }), [2, 1], "la montre renvoie parfois un objet");
});

test("des zones toutes à zéro ne sont pas « 100 % en zone 1 »", () => {
  // Une séance non mesurée présentée comme entièrement facile serait une invention.
  assert.equal(zonesEnMinutes([0, 0, 0, 0, 0]), null);
  assert.equal(zonesEnMinutes([]), null);
  assert.equal(zonesEnMinutes(null), null);
  assert.ok(faitsDeSeance({ ...SEANCE, hr_zone_seconds: null }, { fcMax: 212 }).manques.some((m) => /zones/.test(m)));
});

console.log("\nLE RANG — seulement quand il veut dire quelque chose");

const autres = (n: number, km: number, allure: number): SeanceBrute[] =>
  Array.from({ length: n }, (_, i) => ({ id: `x${i}`, date: "2026-01-01", sport: "run", distance_km: km, gap_min_km: allure }));

test("une séance est classée parmi ses semblables", () => {
  const f = faitsDeSeance(SEANCE, { fcMax: 212 }, [...autres(3, 21, 4.2), ...autres(2, 21, 3.5)]);
  assert.deepEqual(f.rang, { place: 3, total: 6 }, "deux séances plus rapides → 3e sur 6");
});

test("on ne compare pas un 5 km à un marathon", () => {
  assert.equal(ECART_DISTANCE, 0.15);
  // Cinq séances, mais toutes d'une autre distance : rien de comparable.
  assert.equal(faitsDeSeance(SEANCE, { fcMax: 212 }, autres(5, 5, 4.0)).rang, null,
    "des distances sans rapport ont servi à classer la séance");
});

test("trop peu de points de comparaison : aucun classement", () => {
  assert.equal(COMPARABLES_MIN, 4);
  assert.equal(faitsDeSeance(SEANCE, { fcMax: 212 }, autres(2, 21, 4.2)).rang, null);
  assert.ok(faitsDeSeance(SEANCE, { fcMax: 212 }, autres(3, 21, 4.2)).rang, "3 comparables + elle-même = 4");
});

console.log("\nLA PROSE SERVIE À UN COUREUR");

test("une allure s'écrit en minutes et secondes", () => {
  assert.equal(allureTexte(3.75), "3'45", "« 3.75 min/km » ne veut rien dire pour un coureur");
  assert.equal(allureTexte(4), "4'00");
  assert.equal(allureTexte(3.999), "4'00", "59,94 s ne doit pas devenir 3'60");
  assert.equal(allureTexte(null), null);
  assert.equal(allureTexte(0), null);
});

test("une date est écrite en toutes lettres, dans la langue du compte", () => {
  // Le modèle RECOPIE ce qu'on lui tend : avec « 2026-08-24 » dans les faits, il servait
  // cette chaîne telle quelle à l'athlète. Vérifié sur un appel réel avant correction.
  assert.equal(dateLisible("2026-08-24", "fr"), "24 août 2026");
  assert.match(dateLisible("2026-08-24", "de"), /August/);
  // ⚠️ CE QUI PROTÈGE VRAIMENT LA DATE : le formatage forcé en UTC. Mon premier
  // commentaire créditait le parse à midi ; la mutation l'a démenti — passer le parse à
  // minuit ne change rien. Le test vise donc ce qui produit l'effet.
  assert.match(dateLisible("2026-01-01", "fr"), /1 janvier 2026/, "la date a reculé d'un jour");
  assert.match(codeOf("src/lib/ai/analyseSeance.ts"), /timeZone: "UTC"/,
    "sans fuseau forcé, le serveur (aux États-Unis) reculerait la date d'un jour");
  assert.equal(dateLisible("n'importe quoi"), "n'importe quoi", "une date illisible ne devient pas une fausse date");
});

console.log("\nLA ROUTE — verrou, mémoire, et interdiction d'inventer");

test("le verrou est SERVEUR et porte sur la capacité IA", () => {
  const src = codeOf("src/app/api/ai/analyse-seance/route.ts");
  assert.match(src, /exigeAcces\(supabase, user\.id, "ia"\)/,
    "la route n'exige plus d'abonnement : elle est appelable à la main, et c'est l'appel qui coûte");
  // ⚠️ ON VISE LA REQUÊTE, PAS LE MOTIF. `.eq("user_id", user.id)` apparaît une dizaine de
  // fois dans ce fichier : le chercher n'importe où laissait passer la suppression du seul
  // qui compte. Prouvé par mutation — retirer le filtre de la lecture de la SÉANCE ne
  // faisait pas rougir ce test, alors que n'importe quel identifiant devenait analysable.
  const req = src.split("\n").findIndex((l) => l.includes('from("workouts").select(COLS)'));
  assert.ok(req >= 0, "la lecture de la séance a disparu");
  const bloc = src.split("\n").slice(req, req + 3).join(" ");
  assert.ok(/\.eq\("id", workoutId\)/.test(bloc) && /\.eq\("user_id", user\.id\)/.test(bloc),
    "la séance est lue sans vérifier qu'elle appartient à l'appelant : n'importe quel identifiant serait analysé");
});

test("l'analyse est mémorisée, et l'erreur d'écriture est LUE", () => {
  const src = codeOf("src/app/api/ai/analyse-seance/route.ts");
  assert.match(src, /\.eq\("data->>workout_id", workoutId\)/, "la mémoire n'est plus interrogée : chaque ouverture repaierait");
  assert.match(src, /const \{ error: eIns \}/,
    "l'écriture ne lit plus son erreur — Supabase RETOURNE ses erreurs, il ne les lève pas");
  // ⚠️ L'ORDRE COMPTE : le cache AVANT le verrou, sinon un athlète dont l'essai a expiré
  // perdrait l'accès à des analyses déjà écrites et déjà payées.
  assert.ok(src.indexOf("data->>workout_id") < src.indexOf('exigeAcces(supabase, user.id, "ia")'),
    "le verrou passe avant le cache : une analyse déjà payée deviendrait inaccessible");
});

test("le modèle a interdiction d'inventer un chiffre", () => {
  const src = codeOf("src/app/api/ai/analyse-seance/route.ts");
  assert.match(src, /N'écris AUCUN chiffre qui ne figure pas/, "la seule règle qui empêche le récit fabriqué a sauté");
  assert.match(src, /doit être DIT inconnu, jamais comblé/, "le modèle n'est plus tenu d'avouer ce qu'il ignore");
  assert.match(src, /jamais sur le titre de la séance/, "le modèle peut de nouveau juger l'intensité sur l'étiquette");
  assert.match(src, /f\.manques/, "la liste des inconnues n'est plus transmise");
  assert.match(src, /pas de salutation/, "le modèle recommence à saluer : chaque mot est facturé");
  assert.match(src, /faits\.exploitable \? \[\] :/,
    "le modèle n'est plus bridé sur une séance vide : il en tirera des conclusions inventées");
  assert.match(src, /N'EN TIRE AUCUNE CONCLUSION/, "l'interdiction de conclure sur une séance vide a sauté");
});

test("l'analyse est écrite dans la langue du compte", () => {
  // L'invite imposait « en français » : un client allemand voyait le bouton traduit et
  // recevait une analyse en français.
  const src = codeOf("src/app/api/ai/analyse-seance/route.ts");
  assert.match(src, /getAccountLang\(supabase, user\.id\)/, "la langue du compte n'est plus lue");
  assert.match(src, /\$\{LANGUE\[lang\]\}/, "l'invite ne demande plus la langue de l'athlète");
  // ⚠️ LES FAITS AUSSI. La date y est écrite en toutes lettres : figée en français, elle
  // repartait en français dans une analyse allemande. Mutation qui restait verte sans ça.
  assert.match(src, /lignesDeFaits\(faits, lang\)/, "les faits sont rendus dans une langue figée");
  assert.ok(!/en français, en tutoyant\.`/.test(src), "le français est redevenu codé en dur");
  for (const lg of ["fr", "en", "de", "es", "pt"]) {
    assert.ok(new RegExp(`\\b${lg}:`).test(src), `langue « ${lg} » absente de la table`);
  }
});

test("le budget de raisonnement est séparé de la réponse", () => {
  // Un `maxOutputTokens` sans `thinkingConfig` est un piège silencieux sur Gemini 2.5 :
  // le raisonnement mange la réponse, qui sort coupée en étant servie comme un succès.
  const src = codeOf("src/app/api/ai/analyse-seance/route.ts");
  assert.match(src, /budget\(\d+, /, "appel sans réserve de raisonnement : la réponse sortira tronquée");
  assert.match(src, /tronquee: r\.tronquee === true/, "la troncature n'est plus signalée à l'athlète");
});

test("l'affichage suit le verrou, il ne le remplace pas", () => {
  const src = codeOf("src/components/activity/AnalyseCoach.tsx");
  assert.match(src, /r\.status === 402/,
    "le refus d'abonnement n'est plus distingué d'une panne : un verrou commercial passerait pour un bug");
  assert.match(src, /tronquee/, "une réponse coupée serait affichée comme complète");
});

console.log(`\n${passed} test(s) d'analyse passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
