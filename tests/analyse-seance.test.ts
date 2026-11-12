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
  faitsDeSeance, zonesEnMinutes, allureTexte, dateLisible, analyseTrail,
  PART_FC_DURE, PART_FC_FACILE, ECART_DISTANCE, COMPARABLES_MIN, FC_PLANCHER,
  courseDuJour, TYPE_COURSE,
  type SeanceBrute,
} from "../src/lib/ai/analyseSeance";
import { inviteAnalyse } from "../src/lib/ai/inviteAnalyse";
import { peut } from "../src/lib/billing/access";
import { serieDeRepetitions, blocPrincipal, BLOC_MIN_SEC, type IntervalleIcu } from "../src/lib/intervals/performance";
import { FOURCHETTE_QUALITE_SEC, FOURCHETTE_ENDURANCE_SEC, fourchetteAllure, stepsForType, parseReps } from "../src/lib/watch/intervals";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
/** La route ET la consigne (sortie dans `lib/ai/inviteAnalyse` le 31/10/2026) : leurs garanties
 *  se lisent ensemble, l'ordre de la route d'abord. */
const codeAnalyse = () => codeOf("src/app/api/ai/analyse-seance/route.ts") + "\n" + codeOf("src/lib/ai/inviteAnalyse.ts");
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
  // 12/11/2026 : « facile » = sous 0,80, la valeur commune (c'était 0,75 ici, 0,85 dans le bilan).
  assert.equal(PART_FC_FACILE, 0.80, "seuil facile : décision d'entraîneur, commune à toute l'application");
  assert.equal(faitsDeSeance({ ...SEANCE, avg_hr: 165 }, { fcMax: 212 }).intensite, "facile", "un footing à 77,8 % passe pour modéré");
  assert.equal(faitsDeSeance({ ...SEANCE, avg_hr: 170 }, { fcMax: 212 }).intensite, "moderee", "une sortie à 80,2 % passe pour facile");
  // Frontière sur la part NON arrondie : 159/200 = 79,5 % est facile, comme partout ailleurs.
  assert.equal(faitsDeSeance({ ...SEANCE, avg_hr: 159 }, { fcMax: 200 }).intensite, "facile", "79,5 % arrondi à 80 passe pour modéré");
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
  const src = codeAnalyse();
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
  const src = codeAnalyse();
  assert.match(src, /\.eq\("data->>workout_id", workoutId\)/, "la mémoire n'est plus interrogée : chaque ouverture repaierait");
  assert.match(src, /const \{ error: eIns \}/,
    "l'écriture ne lit plus son erreur — Supabase RETOURNE ses erreurs, il ne les lève pas");
  // ⚠️ L'ORDRE COMPTE : le cache AVANT le verrou, sinon un athlète dont l'essai a expiré
  // perdrait l'accès à des analyses déjà écrites et déjà payées.
  assert.ok(src.indexOf("data->>workout_id") < src.indexOf('exigeAcces(supabase, user.id, "ia")'),
    "le verrou passe avant le cache : une analyse déjà payée deviendrait inaccessible");
});

test("le modèle a interdiction d'inventer un chiffre", () => {
  const src = codeAnalyse();
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
  const src = codeAnalyse();
  assert.match(src, /getAccountLang\(supabase, user\.id\)/, "la langue du compte n'est plus lue");
  assert.match(src, /\$\{LANGUE\[lang\]\}/, "l'invite ne demande plus la langue de l'athlète");
  // ⚠️ LES FAITS AUSSI. La date y est écrite en toutes lettres : figée en français, elle
  // repartait en français dans une analyse allemande. Mutation qui restait verte sans ça.
  assert.match(src, /lignesDeFaits\(faits, lang[,)]/, "les faits sont rendus dans une langue figée");
  assert.ok(!/en français, en tutoyant\.`/.test(src), "le français est redevenu codé en dur");
  for (const lg of ["fr", "en", "de", "es", "pt"]) {
    assert.ok(new RegExp(`\\b${lg}:`).test(src), `langue « ${lg} » absente de la table`);
  }
});

test("le budget de raisonnement est séparé de la réponse", () => {
  // Un `maxOutputTokens` sans `thinkingConfig` est un piège silencieux sur Gemini 2.5 :
  // le raisonnement mange la réponse, qui sort coupée en étant servie comme un succès.
  const src = codeAnalyse();
  assert.match(src, /budget\(\d+, /, "appel sans réserve de raisonnement : la réponse sortira tronquée");
  assert.match(src, /tronquee: r\.tronquee === true/, "la troncature n'est plus signalée à l'athlète");
});

test("l'affichage suit le verrou, il ne le remplace pas", () => {
  const src = codeOf("src/components/activity/AnalyseCoach.tsx");
  assert.match(src, /r\.status === 402/,
    "le refus d'abonnement n'est plus distingué d'une panne : un verrou commercial passerait pour un bug");
  assert.match(src, /tronquee/, "une réponse coupée serait affichée comme complète");
  // Starter voit, sous son analyse, ce que Premium y ajouterait — et Premium ne le voit pas.
  assert.match(src, /setComplete\(j\.complete !== false\)/, "l'écran ne sait plus si l'analyse est l'essentielle");
  assert.match(src, /\{!complete && \(/, "l'analyse essentielle ne dit plus ce que Premium ajoute");
  const route = codeAnalyse();
  assert.match(route, /memorise: true, complete: memoComplet \}/, "une analyse mémorisée ne dit plus si elle est complète");
  assert.match(route, /tronquee: r\.tronquee === true, complete: complet \}/, "une analyse fraîche ne dit plus si elle est complète");
});

test("Premium reçoit des DIMENSIONS en plus, pas des mots en plus", () => {
  // ⚠️ UNE ANALYSE « PLUS LONGUE » SUR LES MÊMES DONNÉES EST DU REMPLISSAGE : le client
  // à 14,99 € paierait des phrases, pas du service. L'écart doit porter sur ce que le
  // modèle a le droit de REGARDER — rang parmi les séances semblables, zones, cadence,
  // température — pas sur le nombre de phrases qu'il écrit.
  const src = codeAnalyse();
  assert.match(src, /function lignesDeFaits\(f: FaitsSeance, lang: Lang, complet: boolean\)/,
    "les faits ne dépendent plus de la formule : les deux clients voient la même chose");
  assert.match(src, /if \(complet\) \{/, "le bloc réservé à la formule haute a disparu");
  // Les dimensions doivent être DANS ce bloc, pas avant lui ni après.
  const bloc = src.slice(src.indexOf("if (complet) {"), src.indexOf("if (f.prescrit)"));
  // ⚠️ ON VISE LA CONDITION, PAS LE MOTIF. Chercher « f.rang » quelque part restait vert
  // quand la ligne devenait `if (false) l.push(\`… ${f.rang.place} …\`)` : le champ
  // apparaissait encore dans le gabarit de texte. C'est le TEST qui décide de l'affichage.
  for (const [motif, quoi] of [
    [/if \(f\.rang\) l\.push/, "le rang"], [/if \(f\.zonesMin\) l\.push/, "les zones"],
    [/if \(f\.cadence != null\) l\.push/, "la cadence"], [/if \(f\.tempC != null\) l\.push/, "la température"],
    [/if \(foulee\.length\) l\.push/, "la foulée"], [/if \(f\.derive != null\) l\.push/, "la dérive cardiaque"],
    [/if \(f\.repetitions\) \{/, "les répétitions"], [/if \(f\.ecart\) \{/, "l'écart à la séance prévue"], [/if \(f\.zoneVisee\) \{/, "la zone visée"],
    [/if \(f\.contexte\) \{/, "le contexte du jour"], [/if \(f\.progression\) \{/, "la progression"], [/if \(f\.trail\) \{/, "les montées et descentes"],
  ] as const) {
    assert.match(bloc, motif, `${quoi} n'est plus réservé à la formule haute`);
  }
  assert.match(src, /lignesDeFaits\(faits, lang, complet\)/, "la formule ne commande plus le contenu des faits");
  // Les colonnes de la foulée et de la dérive sont LUES : sinon le bloc Premium est vide.
  const cols = src.match(/const COLS = "([^"]+)"/)?.[1].split(",") ?? [];
  for (const c of ["cardiac_decoupling", "avg_power_watts", "ground_contact_ms", "vertical_oscillation_cm", "stride_length_m"]) {
    assert.ok(cols.includes(c), `« ${c} » n'est plus lu : l'analyse Premium ne peut pas en parler`);
  }
});

test("la foulée et la dérive : lues quand la montre les mesure, jamais supposées", () => {
  const f = faitsDeSeance({ ...SEANCE, cardiac_decoupling: 4.26, avg_power_watts: 301.4, ground_contact_ms: 228, vertical_oscillation_cm: 8.4, stride_length_m: 1.32 }, { fcMax: 212 });
  assert.equal(f.derive, 4.3);
  assert.deepEqual(f.foulee, { puissanceW: 301.4, contactSolMs: 228, oscillationCm: 8.4, longueurM: 1.32 });
  const rien = faitsDeSeance(SEANCE, { fcMax: 212 });
  assert.equal(rien.derive, null, "une dérive annoncée sans mesure");
  assert.deepEqual(rien.foulee, { puissanceW: null, contactSolMs: null, oscillationCm: null, longueurM: null }, "une foulée annoncée sans mesure");
  // Une dérive NULLE mesurée reste une mesure : 0 % n'est pas « inconnu ».
  assert.equal(faitsDeSeance({ ...SEANCE, cardiac_decoupling: 0 }, { fcMax: 212 }).derive, 0);
});

test("Starter reçoit l'essentiel, Premium et l'essai l'analyse complète", () => {
  assert.ok(!peut("starter", "analyse_complete"), "Starter reçoit l'analyse complète, réservée à Premium");
  assert.ok(peut("premium", "analyse_complete") && peut("essai", "analyse_complete"), "Premium ou l'essai ne reçoit plus l'analyse complète");
});

test("passé à Premium, une séance relue en Starter est relue EN ENTIER, dans la même ligne", () => {
  // Sans ça, l'abonné qui monte en gamme rouvrait ses séances et lisait pour toujours
  // l'analyse courte, mémorisée du temps de Starter.
  const src = codeAnalyse();
  assert.match(src, /if \(memo\?\.body && \(memoComplet \|\| !complet\) && \(memoCourse \|\| !\(await estJourDeCourse\(supabase, user\.id, workoutId\)\)\)\) return/, "l'analyse essentielle est resservie à Premium");
  assert.match(src, /const memoComplet = memo\?\.data\?\.complete \?\? memo\?\.data\?\.longue \?\? false;/, "les analyses complètes d'avant le 30/10 seraient refaites et repayées");
  assert.match(src, /memo\?\.id\s*\?\s*await admin\.from\("notifications"\)\.update\(ligne\)\.eq\("id", memo\.id\)/, "la version complète s'ajoute au lieu de remplacer : le cache n'en lit qu'une, au hasard");
  assert.match(src, /data: \{ workout_id: workoutId, date: [^}]*complete: complet/, "la ligne ne dit plus si l'analyse est complète");
  // Et pendant la mise à niveau, l'analyse déjà écrite n'est jamais remplacée par une erreur :
  // plafond du jour atteint, ou modèle en panne, on la ressert telle quelle.
  assert.match(src, /if \(refus\) return memo\?\.body \? resservir\(\) : refus\.reponse;/, "le plafond du jour fait perdre l'analyse déjà écrite");
  assert.match(src, /if \(!r\.ok \|\| !r\.text\?\.trim\(\)\) \{\s*if \(memo\?\.body\) return resservir\(\);/, "une panne du modèle fait perdre l'analyse déjà écrite");
});

test("l'écart de formule repose sur une capacité, pas sur un nom écrit en dur", () => {
  // Un `tier === "premium"` en dur diverge le jour où une formule est renommée, et il
  // laisserait l'essai — qui montre le niveau Premium — sur la version basse.
  const src = codeAnalyse();
  assert.match(src, /profilPeut\([^)]*"analyse_complete"\)/, "la capacité n'est plus interrogée");
  assert.ok(!/"premium"/.test(src), "le nom d'une formule est codé en dur dans la route");
});

console.log("\nLES RÉPÉTITIONS ET L'ÉCART À LA SÉANCE PRÉVUE (Premium, 31/10/2026)");

// Une séance de 6×1000 m à 3'20/km : échauffement, six efforts qui ralentissent un peu,
// récupérations, puis QUATRE tours de retour au calme que la FC encore haute classe en zone 4.
const v = (secParKm: number) => 1000 / secParKm;
const SERIE_6x1000: IntervalleIcu[] = [
  { zone: 2, average_speed: v(330), moving_time: 900, average_heartrate: 140 },
  ...[200, 200, 202, 202, 204, 206].flatMap((a, i) => [
    { zone: 5, average_speed: v(a), moving_time: a, distance: 1000, average_heartrate: 180 + i },
    { zone: 2, average_speed: v(420), moving_time: 120, average_heartrate: 150 },
  ]),
  ...[275, 280, 282, 285].map((a) => ({ zone: 4, average_speed: v(a), moving_time: 300, average_heartrate: 183 })),
];

test("la série : les six répétitions, sans les tours de retour au calme classés en zone 4", () => {
  const sr = serieDeRepetitions(SERIE_6x1000)!;
  assert.deepEqual(sr.reps.map((r) => r.allureSec), [200, 200, 202, 202, 204, 206], "les tours de retour au calme sont comptés comme répétitions");
  assert.equal(sr.fadeSec, 5, "décrochage du premier au dernier tiers");
  assert.equal(sr.fcMoy, 183);
  assert.equal(serieDeRepetitions(SERIE_6x1000.slice(0, 5)), null, "deux efforts ne font pas une série");
  assert.equal(serieDeRepetitions(SERIE_6x1000.map((x) => ({ ...x, zone: Math.min(3, x.zone ?? 0) }))), null, "une série sans effort en zone 4 est une sortie régulière");
});

test("le corps d'un seuil : le plus long effort en zone 3+, d'au moins six minutes", () => {
  const seuil: IntervalleIcu[] = [
    { zone: 2, average_speed: v(320), moving_time: 900 },
    { zone: 3, average_speed: v(245), moving_time: 1200, average_heartrate: 175 },
    { zone: 4, average_speed: v(230), moving_time: 300 },
  ];
  assert.deepEqual(blocPrincipal(seuil), { allureSec: 242, dureeSec: 1500, fc: 175, tours: [245, 230] },
    "deux efforts ENCHAÎNÉS en zone 3+ forment un seul corps de séance, à l'allure pondérée par leur durée (242 s/km)");
  assert.equal(blocPrincipal([{ zone: 4, average_speed: v(230), moving_time: BLOC_MIN_SEC - 1 }]), null, "un tour de cinq minutes pris pour un corps de séance");
  // Un fractionné : les récupérations coupent la suite, aucune répétition ne fait six minutes.
  assert.equal(blocPrincipal(SERIE_6x1000.slice(0, 13)), null, "un fractionné pris pour un bloc continu");
});

// LE CAS RÉEL DU 14/10/2026 : « Tempo marathon : 30 min continues à 3'47/km », que la montre a
// découpé en tours d'un kilomètre (relu chez intervals.icu). Les tours de retour au calme sont
// en zone 2 : ils coupent la suite.
const TEMPO_14_10: IntervalleIcu[] = [
  ...[302, 288, 293].map((a) => ({ zone: 1, average_speed: v(a), moving_time: a, average_heartrate: 140 })),
  ...([[219, 3, 220, 173], [219, 4, 221, 183], [221, 4, 222, 186], [222, 4, 221, 188], [219, 4, 222, 189], [223, 4, 225, 190], [227, 4, 225, 191], [219, 5, 221, 192]] as const)
    .map(([a, z, d, fc]) => ({ zone: z, average_speed: v(a), moving_time: d, average_heartrate: fc })),
  ...[263, 268, 261, 269, 261, 275].map((a) => ({ zone: 2, average_speed: v(a), moving_time: a, average_heartrate: 168 })),
];

test("cas réel : un tempo de 30 min découpé en 8 tours est UN corps de séance, pas 8 répétitions", () => {
  const prevu = { type: "Spécifique", titre: "Allure spécifique objectif", detail: "Échauffement 20 min progressif FC Z1→Z2 + 3 à 5 lignes droites de 80 m → Corps : Tempo marathon : 30 min continues à 3'47/km → Retour au calme 10 min FC Z1." };
  const f = faitsDeSeance(SEANCE, { fcMax: 212 }, [], prevu, { liste: TEMPO_14_10 });
  assert.equal(f.repetitions, null, "les tours d'un tempo continu sont présentés comme des répétitions");
  assert.equal(f.ecart?.sur, "bloc");
  assert.equal(f.ecart?.blocMin, 30);
  assert.equal(f.ecart?.tours?.length, 8);
  assert.equal(f.ecart?.ecartSec, -6, "3'41 de moyenne pour 3'47 prévus : 6 s/km plus vite");
  assert.ok(!f.manques.some((m) => /corps de la séance/.test(m)), "le corps du tempo est déclaré introuvable");
});

const PREVU_6x1000 = { type: "VMA", titre: "6×1000 m", detail: "Échauffement 20 min progressif → Corps : 6×1000 m à 3'20/km, récup 2 min trottinée → Retour au calme 10 min." };

test("répétitions prévues et relevées : l'écart moyen, et combien tombent dans la fourchette de la montre", () => {
  const f = faitsDeSeance(SEANCE, { fcMax: 212 }, [], PREVU_6x1000, { liste: SERIE_6x1000 });
  assert.deepEqual(f.repetitions?.allures, [200, 200, 202, 202, 204, 206]);
  assert.equal(f.ecart?.sur, "repetitions");
  assert.equal(f.ecart?.allureCibleSec, 200, "la cible n'est pas celle que la montre affichait");
  assert.equal(f.ecart?.ecartSec, 2, "écart moyen faux (202 contre 200)");
  assert.equal(f.ecart?.repsPrevues, 6);
  // Fourchette de qualité ±5 s (07/11/2026) : 3'20 à 3'22 et 3'24 y sont ; la dernière, à 3'26
  // (+6 s), est hors des 3:15-3:25 que la montre affichait.
  assert.equal(f.ecart?.dansLaFourchette, 5, `cinq sur six à moins de ${FOURCHETTE_QUALITE_SEC} s/km de la cible`);
  // Une répétition hors fourchette ne compte pas.
  const lente = faitsDeSeance(SEANCE, { fcMax: 212 }, [], PREVU_6x1000,
    { liste: SERIE_6x1000.map((x) => (x.average_speed === v(204) ? { ...x, average_speed: v(215) } : x)) });
  assert.equal(lente.ecart?.dansLaFourchette, 4, "une répétition à +15 s/km est comptée dans la cible");
});

test("ce qu'on ne sait pas se dit : intervalles illisibles, série introuvable, ou rien demandé (Starter)", () => {
  const illisible = faitsDeSeance(SEANCE, { fcMax: 212 }, [], PREVU_6x1000, "illisible");
  assert.equal(illisible.ecart, null, "un écart inventé sans les répétitions");
  assert.ok(illisible.manques.some((m) => /répétitions n'a pas pu être lu/.test(m)), "l'illisibilité n'est pas signalée");
  const introuvable = faitsDeSeance(SEANCE, { fcMax: 212 }, [], PREVU_6x1000, { liste: [] });
  assert.ok(introuvable.manques.some((m) => /aucune série de répétitions reconnue/.test(m) && /ne suppose pas/.test(m)), "une série introuvable devient un fractionné « pas fait »");
  const starter = faitsDeSeance(SEANCE, { fcMax: 212 }, [], PREVU_6x1000);
  assert.equal(starter.ecart, null);
  assert.equal(starter.repetitions, null);
  assert.ok(!starter.manques.some((m) => /répétitions|corps de/.test(m)), "Starter reçoit un « inconnu » sur ce qu'il n'a pas demandé");
});

test("footing : l'allure de toute la séance face à la cible ; plusieurs allures prévues : on ne compare pas", () => {
  const footing = { ...SEANCE, distance_km: 10, duration_seconds: 3000, avg_pace_min_km: 5, gap_min_km: null };
  const f = faitsDeSeance(footing, { fcMax: 212 }, [], { type: "Endurance", titre: "Footing", detail: "Échauffement 10 min → Corps : 50 min en Z2 à ~5'05/km → Retour au calme 5 min." }, { liste: [] });
  assert.equal(f.ecart?.sur, "seance");
  assert.equal(f.ecart?.ecartSec, -5, "5'00 pour 5'05 prévus : 5 s/km plus vite");
  const ambigu = faitsDeSeance(footing, { fcMax: 212 }, [], { type: "Sortie longue", titre: "SL", detail: "Corps : 24 km en Z2 à ~5'05/km, dont les 5 derniers km à ~4'05/km." }, { liste: [] });
  assert.equal(ambigu.ecart, null, "deux allures prévues : la comparaison choisit au hasard");
});

test("over-under : la cible est la moyenne des deux allures, et deux répétitions prévues suffisent", () => {
  const prevu = { type: "Seuil", titre: "Séance au seuil", detail: "Échauffement 20 min → Corps : Over-under : 2×5 min en alternant 1 min à ~3'57/km (sous-seuil) / 1 min à ~3'49/km (au seuil), récup 3 min → Retour au calme 10 min FC Z1." };
  const liste: IntervalleIcu[] = [
    { zone: 2, average_speed: v(320), moving_time: 1200 },
    { zone: 4, average_speed: v(233), moving_time: 300, average_heartrate: 178 },
    { zone: 2, average_speed: v(400), moving_time: 180 },
    { zone: 4, average_speed: v(231), moving_time: 300, average_heartrate: 181 },
    { zone: 1, average_speed: v(360), moving_time: 600 },
  ];
  const f = faitsDeSeance(SEANCE, { fcMax: 212 }, [], prevu, { liste });
  assert.equal(f.ecart?.sur, "repetitions", "une série de deux répétitions prévues n'est pas reconnue");
  assert.equal(f.ecart?.allureCibleSec, 233, "la cible d'un over-under est la moyenne pondérée des deux allures (3'53)");
  assert.deepEqual(f.ecart?.alternance, [237, 229]);
  assert.equal(f.ecart?.dansLaFourchette, null, "une répétition entière jugée contre l'une des deux fourchettes");
  assert.equal(f.ecart?.ecartSec, -1);
});

test("répétitions prévues, effort continu couru à la place : on le dit, on ne juge pas le fractionné", () => {
  // Cas réel du 21/09/2026 : over-under 2×5 min prévu, 62 min d'effort continu relevées.
  const prevu = { type: "Seuil", titre: "Séance au seuil", detail: "Corps : Over-under : 2×5 min en alternant 1 min à ~4'02/km (sous-seuil) / 1 min à ~3'54/km (au seuil), récup 3 min." };
  const liste: IntervalleIcu[] = [{ zone: 2, average_speed: v(300), moving_time: 1200 }, { zone: 3, average_speed: v(238), moving_time: 3720, average_heartrate: 172 }];
  const f = faitsDeSeance(SEANCE, { fcMax: 212 }, [], prevu, { liste });
  assert.equal(f.ecart?.sur, "bloc");
  assert.equal(f.ecart?.repsPrevues, 2);
  assert.equal(f.ecart?.blocMin, 62);
  assert.ok(!f.manques.some((m) => /aucune série/.test(m)), "on prétend ignorer ce qui a été couru alors que le bloc est relevé");
  assert.match(codeAnalyse(), /au lieu des \$\{e\.repsPrevues\} répétitions prévues[\s\S]{0,400}?ne juge pas le fractionné/, "le modèle juge un fractionné qui n'a pas été couru");
});

test("la zone visée : celle du corps de séance, et le temps passé au-dessus", () => {
  const footing = { ...SEANCE, hr_zone_seconds: [600, 2400, 300, 120, 0] };
  const prevu = { type: "Endurance", titre: "Footing", detail: "Échauffement 10 min progressif FC Z1→Z2 → Corps : 50 min en Z2 à ~5'05/km → Retour au calme 5 min FC Z1." };
  const f = faitsDeSeance(footing, { fcMax: 212 }, [], prevu, { liste: [] });
  assert.deepEqual(f.zoneVisee, { zone: 2, minutesDans: 40, minutesAuDessus: 7, minutesTotal: 57 });
  assert.equal(faitsDeSeance(footing, { fcMax: 212 }, [], PREVU_6x1000, { liste: [] }).zoneVisee, null, "une zone inventée pour un fractionné qui n'en prescrit pas");
  assert.equal(faitsDeSeance(footing, { fcMax: 212 }, [], prevu).zoneVisee, null, "Starter reçoit la zone visée, réservée à l'analyse complète");
});

test("seuil : le corps de séance face à sa cible, jamais la moyenne avec l'échauffement", () => {
  const prevu = { type: "Seuil", titre: "Seuil", detail: "Échauffement 20 min → Corps : 20 min à 4'10/km → Retour au calme 10 min." };
  const f = faitsDeSeance(SEANCE, { fcMax: 212 }, [], prevu, { liste: [{ zone: 2, average_speed: v(320), moving_time: 900 }, { zone: 3, average_speed: v(245), moving_time: 1200, average_heartrate: 175 }] });
  assert.equal(f.ecart?.sur, "bloc");
  assert.equal(f.ecart?.ecartSec, -5);
  assert.equal(f.ecart?.blocMin, 20);
  const sansBloc = faitsDeSeance(SEANCE, { fcMax: 212 }, [], prevu, { liste: [] });
  assert.equal(sansBloc.ecart, null, "la moyenne de la séance comparée à la cible du seuil");
  assert.ok(sansBloc.manques.some((m) => /corps de la séance n'a pas pu être isolé/.test(m)));
});

test("le branchement : intervalles lus pour Premium seulement, clé jamais renvoyée, une seule détection", () => {
  const src = codeAnalyse();
  assert.match(src, /const intervalles = complet\s*\?\s*\(s\.external_id && creds \? await intervallesDeSeance\(String\(s\.external_id\), creds\.apiKey\) : "illisible" as const\)\s*:\s*undefined;/,
    "les intervalles sont lus pour Starter, ou leur absence n'est plus dite");
  assert.ok(src.indexOf("const intervalles = complet") > src.indexOf(`exigeAcces(supabase, user.id, "ia")`), "intervals.icu est appelé avant le contrôle du quota");
  assert.match(src, /detail: p\.data\?\.subtitle \?\? p\.body \?\? null/, "la séance prévue n'est plus transmise en entier");
  assert.ok((src.match(/const COLS = "([^"]+)"/)?.[1] ?? "").split(",").includes("external_id"), "l'identifiant d'activité n'est plus lu");
  // La clé ne sert qu'à l'appel : elle n'apparaît dans aucune réponse.
  for (const m of src.matchAll(/NextResponse\.json\(([^;]*)\);/g)) assert.ok(!/creds|intervals_api_key|apiKey/.test(m[1]), "une réponse contient la clé intervals.icu");
  const perf = codeOf("src/lib/intervals/performance.ts");
  assert.match(perf, /async function analyseQualityExecution[\s\S]*?const serie = serieDeRepetitions\(j\.icu_intervals \?\? \[\]\)/, "le coach et l'analyse n'ont plus la même définition d'une répétition");
  const montre = codeOf("src/lib/watch/intervals.ts");
  assert.equal((montre.match(/paceSec - fourchetteAllure\(zone\)/g) ?? []).length, 2, "la montre n'affiche plus la fourchette que l'analyse juge");
  // Les répétitions sont jugées avec la fourchette de QUALITÉ, celle que la montre leur affiche.
  assert.match(codeOf("src/lib/ai/analyseSeance.ts"), /Math\.abs\(a - allureCible\) <= FOURCHETTE_QUALITE_SEC/, "l'analyse ne juge plus les répétitions avec la fourchette de la montre");
});

test("fourchette d'allure : 10 s d'écart en qualité, 16 s en endurance (Cyprien, 07/11/2026)", () => {
  // « je préférerais 3'45 à 3'55 » : la séance spécifique du 07/10 (3'47/km) partait en 3:39-3:55.
  assert.equal(FOURCHETTE_QUALITE_SEC, 5);
  assert.equal(FOURCHETTE_ENDURANCE_SEC, 8);
  for (const z of [3, 4, 5]) assert.equal(fourchetteAllure(z), 5, `zone ${z}`);
  for (const z of [1, 2]) assert.equal(fourchetteAllure(z), 8, `zone ${z}`);
  // Seuil à 3'47 : le corps part en 3:42-3:52 sur la montre.
  const seuil = stepsForType("Seuil", 60, 20, 227, 15, 10) ?? "";
  assert.match(seuil, /3:42-3:52 pace/, `séance de seuil : ${seuil}`);
  // Répétitions 6 × 1000 m à 3'20 : chaque répétition en 3:15-3:25.
  const reps = parseReps("6×1000 m à 3'20/km, récup 2 min", null);
  const vma = stepsForType("VMA", 60, 20, 200, 15, 10, reps) ?? "";
  assert.match(vma, /3:15-3:25 pace/, `répétitions : ${vma}`);
  assert.doesNotMatch(vma, /3:12-3:28/, "les répétitions gardent l'ancienne fourchette de 16 s");
  // Footing à 4'52 : 4:44-5:00, l'endurance garde sa tolérance.
  const footing = stepsForType("Endurance", 50, 20, 292, 15, 10) ?? "";
  assert.match(footing, /4:44-5:00 pace/, `footing : ${footing}`);
});

console.log("\nLE CONTEXTE DU JOUR, LE RESSENTI, LA PROGRESSION, LE TRAIL (Premium, 31/10/2026)");

const FACILE: SeanceBrute = { ...SEANCE, date: "2026-08-24", distance_km: 10, duration_seconds: 3000, avg_pace_min_km: 5, gap_min_km: null, avg_hr: 145, max_hr: 160, hr_zone_seconds: [600, 2400, 0, 0, 0] };
const CTX = { ressenti: { rpe: 8 }, nuit: { score: 58, minutes: 330 }, vfc: { matin: 58, base: 71 }, forme: { tsb: -14, ctl: 52, atl: 66 } };

test("ressenti : un 8/10 sur un footing que la FC dit facile est un signal de fatigue", () => {
  const f = faitsDeSeance(FACILE, { fcMax: 212 }, [], null, { liste: [] }, CTX);
  assert.equal(f.intensite, "facile");
  assert.equal(f.contexte?.signalRessenti, "fatigue");
  assert.deepEqual(f.contexte?.vfc, { matin: 58, base: 71 });
  // Un 2/10 sur une séance que la FC dit dure : l'autre contradiction.
  assert.equal(faitsDeSeance(SEANCE, { fcMax: 212 }, [], null, { liste: [] }, { ...CTX, ressenti: { rpe: 2 } }).contexte?.signalRessenti, "facilite");
  // Un ressenti cohérent ne déclenche rien.
  assert.equal(faitsDeSeance(FACILE, { fcMax: 212 }, [], null, { liste: [] }, { ...CTX, ressenti: { rpe: 4 } }).contexte?.signalRessenti, null);
});

test("contexte : ce qui manque est dit ; Starter (rien demandé) n'a ni contexte ni « inconnu »", () => {
  const f = faitsDeSeance(FACILE, { fcMax: 212 }, [], null, { liste: [] }, { ressenti: null, nuit: null, vfc: null, forme: null });
  for (const motif of [/aucun ressenti/, /sommeil de la nuit précédente non mesuré/, /VFC du matin non mesurée/, /fraîcheur du jour inconnue/, /humidité non mesurée/]) {
    assert.ok(f.manques.some((m) => motif.test(m)), `manque non dit : ${motif}`);
  }
  const starter = faitsDeSeance(FACILE, { fcMax: 212 });
  assert.equal(starter.contexte, null);
  assert.ok(!starter.manques.some((m) => /sommeil|VFC|ressenti|humidité/.test(m)), "Starter reçoit des « inconnus » sur ce qu'il n'a pas demandé");
});

test("progression : à intensité égale et distance proche, l'efficacité face à la médiane des 12 semaines", () => {
  const sembl = (date: string, fc = 146) => ({ date, sport: "run", distance_km: 10, duration_seconds: 3120, avg_hr: fc, max_hr: 160 });
  const comparables = [sembl("2026-08-10"), sembl("2026-07-30"), sembl("2026-07-15"), sembl("2026-06-20"),
    sembl("2026-04-01"), /* hors des 12 semaines */ sembl("2026-08-12", 190) /* séance dure, pas comparable */];
  const f = faitsDeSeance(FACILE, { fcMax: 212 }, comparables, null, { liste: [] });
  assert.deepEqual(f.progression, { classe: "facile", n: 4, ecartPct: 5 }, "200 m/min à 145 contre 192 m/min à 146 : +5 %");
  assert.equal(faitsDeSeance(FACILE, { fcMax: 212 }, comparables.slice(0, 2), null, { liste: [] }).progression, null, "une progression annoncée sur deux séances");
  assert.equal(faitsDeSeance(FACILE, { fcMax: 212 }, comparables).progression, null, "Starter reçoit la progression, réservée à l'analyse complète");
});

// Un parcours de 9 km : 2 km de plat à 100 m, une montée de 200 m sur 2 km en 20 min, une
// descente de 180 m sur 2 km en 9 min, puis du plat — avec ±2 m de bruit GPS à chaque point.
function parcours(): import("../src/lib/intervals/performance").FluxSeance {
  const temps: number[] = [], distance: number[] = [], altitude: number[] = [], fc: number[] = [];
  let t = 0;
  for (let d = 0; d <= 9000; d += 10) {
    const [alt, vit] = d < 2000 ? [100, 3.5] : d < 4000 ? [100 + (d - 2000) * 0.1, 2000 / 1200] : d < 6000 ? [300 - (d - 4000) * 0.09, 2000 / 540] : [120, 3.5];
    temps.push(Math.round(t)); distance.push(d); altitude.push(alt + (d % 20 === 0 ? 2 : -2)); fc.push(d >= 2000 && d < 4000 ? 172 : 150);
    t += 10 / vit;
  }
  return { temps, distance, altitude, fc };
}

test("trail : vitesse ascensionnelle sur les MONTÉES seulement, allure en descente, bruit GPS ignoré", () => {
  const t = analyseTrail(parcours())!;
  assert.equal(t.montees.nombre, 1);
  assert.ok(Math.abs(t.montees.dPlus - 200) <= 10, `D+ de la montée faux : ${t.montees.dPlus}`);
  assert.ok(Math.abs((t.montees.vam ?? 0) - 600) <= 45, `vitesse ascensionnelle fausse : ${t.montees.vam} m/h pour 200 m en 20 min`);
  assert.equal(t.montees.fc, 172);
  assert.equal(t.descentes.nombre, 1);
  assert.ok(Math.abs((t.descentes.allureSec ?? 0) - 270) <= 20, `allure de descente fausse : ${t.descentes.allureSec}`);
  // Du plat bruité ne fait ni montée ni descente.
  const plat = parcours(); plat.altitude = plat.altitude.map((_, i) => 100 + (i % 2 ? 2 : -2));
  assert.equal(analyseTrail(plat), null, "le bruit du GPS fabrique des montées");
  // De VRAIES petites bosses (12 m tous les 400 m, des ponts, un faux plat) : en dessous de
  // 30 m de dénivelé, ce ne sont pas des montées qu'on chronomètre.
  const bosses = parcours(); bosses.altitude = bosses.distance.map((d) => 100 + 12 * Math.abs(((d % 400) / 200) - 1));
  assert.equal(analyseTrail(bosses), null, "des bosses de 12 m comptées comme des montées");
  // Dans les faits : demandé et lu, demandé et illisible, ou pas demandé.
  assert.ok(faitsDeSeance(FACILE, {}, [], null, undefined, undefined, parcours()).trail);
  assert.ok(faitsDeSeance(FACILE, {}, [], null, undefined, undefined, "illisible").manques.some((m) => /flux d'altitude/.test(m)));
  assert.equal(faitsDeSeance(FACILE, {}).trail, null);
});

test("branchement : contexte et flux lus pour l'analyse complète seulement, le ressenti de CETTE séance", () => {
  const src = codeAnalyse();
  assert.match(src, /const contexte: ContexteSeance \| undefined = complet \? await/, "le contexte du jour est lu pour Starter");
  assert.match(src, /const trailLike = complet && dplus >= 150/, "les flux sont lus pour Starter ou pour une sortie plate");
  assert.match(src, /fbs\.find\(\(d\) => d\.workout_id === workoutId\) \?\? \(fbs\.length === 1 && !fbs\[0\]\.workout_id \? fbs\[0\] : null\)/,
    "le ressenti d'une autre séance du même jour serait attribué à celle-ci");
  assert.match(src, /computeLoad\(charge, decaleJour\(jourSeance, -1\)\)/, "la fraîcheur n'est plus celle de la veille, avec le modèle du tableau de bord");
});

test("le jour de la course visée, la séance est jugée comme la course, pas contre l'entraînement du coach", () => {
  // Marathon de Lille, 25/10/2026 : le coach avait publié une « Récupération » ce jour-là, et
  // l'analyse a écrit « intensité totalement inappropriée pour une séance de récupération ».
  const obj = { race: "sub 16 min", raceDate: "2026-12-19", distanceKm: 5,
    precedente: { race: "Marathon International de Lille", raceDate: "2026-10-25", distanceKm: 42.2 } };
  assert.deepEqual(courseDuJour(obj, "2026-10-25", 42.47), { nom: "Marathon International de Lille", distanceKm: 42.2 }, "le marathon n'est pas reconnu comme la course");
  assert.equal(courseDuJour(obj, "2026-10-25", 2.1), null, "le retour au calme de 2,1 km est pris pour le marathon");
  assert.equal(courseDuJour(obj, "2026-10-24", 42.47), null, "la veille est prise pour le jour de course");
  assert.ok(courseDuJour(obj, "2026-12-19", 5.08), "l'objectif lui-même n'est pas reconnu");
  assert.equal(courseDuJour(null, "2026-10-25", 42), null);
  assert.ok(courseDuJour({ race: "Trail", raceDate: "2026-10-25" }, "2026-10-25", 18), "objectif sans distance : une vraie sortie ce jour-là est la course");
  // L'invite dit que c'était LA course, et ne présente plus la Récup comme le prescrit.
  const faits = faitsDeSeance({ ...SEANCE, date: "2026-10-25" }, { fcMax: 204 }, [], { type: TYPE_COURSE, titre: "Marathon International de Lille", detail: null });
  const invite = inviteAnalyse(faits, "fr", true);
  assert.match(invite, /C'ÉTAIT LA COURSE VISÉE CE JOUR-LÀ : Marathon International de Lille/, "l'invite ne dit pas au modèle que c'était la course");
  assert.doesNotMatch(invite, /Ce qui était PRESCRIT ce jour-là/, "l'invite présente encore un entraînement prescrit le jour de course");
  // La route : objectif lu avec le reste, course prioritaire sur la séance du coach, mémoire marquée.
  const src = codeOf("src/app/api/ai/analyse-seance/route.ts");
  assert.match(src, /course \? \{ type: TYPE_COURSE, titre: course\.nom \|\| null, detail: null \}\s*: p \?/, "la séance du coach passe encore avant la course");
  assert.match(src, /complete: complet, lang, course: course != null \}/, "l'analyse mémorisée ne dit pas si elle a reconnu la course");
});

console.log(`\n${passed} test(s) d'analyse passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
