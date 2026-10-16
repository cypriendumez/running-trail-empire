/**
 * CRASH-TESTS DE LA SYNCHRONISATION intervals.icu ↔ Pacevo.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 * Le 23/08/2026, en vérifiant « est-ce que la synchro marche bien ? », la réponse
 * s'est révélée être : elle marche parfaitement, POUR LA MAUVAISE PERSONNE.
 *
 * Quatorze endroits du code repliaient les identifiants manquants d'un athlète sur
 * `process.env.INTERVALS_ICU_*` — le compte intervals.icu de l'ÉDITEUR. Constaté sur
 * les données réelles : le second compte de la base, qui n'a jamais saisi d'identifiants,
 * portait trois séances de l'éditeur dans sa table `workouts` (`i178186948`,
 * `i178009874`, `i177841573`), et son plan du 23/08 avait été poussé sur le calendrier
 * intervals.icu de l'éditeur (`rte-coach-19ab4adf-…` à côté de `rte-coach-ef60cb0c-…`).
 *
 * Aucune erreur, aucun log, aucune pastille orange : l'application affichait
 * « connecté ». C'est le défaut le plus dangereux qui soit — il est indiscernable du
 * bon fonctionnement, et il ne se voit qu'en comparant deux comptes.
 *
 * ── CE QUE CES TESTS COUVRENT, ET CE QU'ILS NE COUVRENT PAS ─────────────────
 * Couvert : l'isolation des identifiants, la robustesse de l'envoi (réseau, HTTP,
 * réponses malformées), la détection de montre, et la cohérence entre ce que la page
 * d'accueil PROMET et ce que le code SAIT faire.
 *
 * Non couvert, et il faut le dire : qu'une Suunto physique affiche la séance à son
 * porteur. Il faudrait la montre, un compte avec cette marque activée et une sortie
 * réelle. Ce qui est vérifié à la place, sur l'API le 23/08/2026, c'est que les champs
 * `*_upload_workouts` existent bien pour chaque destination de la table.
 *
 *   npx tsx tests/synchro.crash.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { identifiantsDe, identifiantsDePaire } from "../src/lib/intervals/identifiants";
import {
  DESTINATIONS_MONTRE, montreDe, lectureDe, estAppleWatch,
  metriquesMixtesSupportees, pushIntervalsWorkout, supprimerIntervalsWorkout, buildWorkoutDescription,
} from "../src/lib/watch/intervals";
import type { SupabaseClient } from "@supabase/supabase-js";
import { causeDuRefus, estPassager, journaliserRefus } from "../src/lib/intervals/refusSynchro";

const ROOT = join(__dirname, "..");
let passed = 0;
const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
async function atest(nom: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/**
 * Le code SANS ses commentaires ni ses imports.
 *
 * ⚠️ INDISPENSABLE ICI. La correction du 23/08/2026 laisse dans neuf fichiers un
 * commentaire qui CITE le motif interdit (« le `|| process.env.INTERVALS_ICU_*` qui était
 * ici… »). Un test qui grepperait le fichier brut trouverait ces citations et rougirait
 * sur du code sain — ou, pire, serait « corrigé » en supprimant l'explication.
 *
 * ⚠️ ET ON NE COUPE PAS SUR `://`. Le projet a déjà perdu une assertion « aucune URL en
 * dur » parce que `https://…` était pris pour un commentaire de fin de ligne.
 */
const codeSeul = (chemin: string): string =>
  readFileSync(join(ROOT, chemin), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((l) => !/^\s*(import\b|\/\/)/.test(l))
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");

/** Tous les fichiers `.ts`/`.tsx` de `src/`. */
function fichiersSrc(dir = join(ROOT, "src"), out: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) fichiersSrc(chemin, out);
    else if (/\.tsx?$/.test(nom)) out.push(chemin.slice(ROOT.length + 1));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔐 IDENTIFIANTS — chaque athlète, et lui seul\n");
// ─────────────────────────────────────────────────────────────────────────────

test("aucun fichier de src/ ne se replie sur les variables d'environnement intervals.icu", () => {
  // ⚠️ ANCRAGE : on vise la LECTURE de la variable, pas son nom. Le nom apparaît
  // légitimement dans neuf commentaires d'explication et dans la doc du helper — les
  // grepper ferait rougir un code sain. `codeSeul` les retire ; ce qui reste est un accès
  // réel à l'environnement, et il ne doit plus en exister un seul.
  const coupables = fichiersSrc()
    .filter((f) => f !== "src/lib/intervals/identifiants.ts")
    .filter((f) => /process\.env\.INTERVALS_ICU_/.test(codeSeul(f)));
  assert.deepEqual(coupables, [],
    `ces fichiers lisent encore le compte intervals.icu de l'éditeur : ${coupables.join(", ")}`);
});

test("le helper lui-même ne lit pas l'environnement — il ne fait que trancher", () => {
  // Le fichier d'exception ne doit pas devenir la nouvelle porte dérobée : il est exclu
  // du test ci-dessus, donc rien d'autre ne le surveille.
  assert.ok(!/process\.env/.test(codeSeul("src/lib/intervals/identifiants.ts")),
    "identifiants.ts lit l'environnement : le repli est revenu par la porte de service");
});

test("un profil sans identifiants ne vaut PAS les identifiants de quelqu'un d'autre", () => {
  assert.equal(identifiantsDe(null), null);
  assert.equal(identifiantsDe(undefined), null);
  assert.equal(identifiantsDe({}), null);
  assert.equal(identifiantsDe({ intervals_athlete_id: null, intervals_api_key: null }), null);
});

test("les deux moitiés vont ensemble — une seule ne permet aucun appel", () => {
  // Rendre un objet à moitié rempli laisserait construire une requête vouée au 401, et
  // lire ce 401 comme « intervals.icu est en panne ».
  assert.equal(identifiantsDe({ intervals_athlete_id: "i564686" }), null, "un id sans clé ne vaut rien");
  assert.equal(identifiantsDe({ intervals_api_key: "abc123" }), null, "une clé sans id ne vaut rien");
  assert.deepEqual(identifiantsDe({ intervals_athlete_id: "i564686", intervals_api_key: "abc123" }),
    { athleteId: "i564686", apiKey: "abc123" });
});

test("une clé collée avec un retour à la ligne n'est pas une clé valide déguisée", () => {
  // `" "` est vrai en JavaScript : sans le rognage, l'en-tête d'authentification partait
  // avec un blanc en fin de clé et intervals.icu répondait 401 — lu comme une panne.
  assert.equal(identifiantsDe({ intervals_athlete_id: "i1", intervals_api_key: "   " }), null);
  assert.equal(identifiantsDe({ intervals_athlete_id: "\n", intervals_api_key: "k" }), null);
  assert.equal(identifiantsDe({ intervals_athlete_id: " \t ", intervals_api_key: " k " }), null);
  assert.deepEqual(identifiantsDe({ intervals_athlete_id: " i564686\n", intervals_api_key: "\tabc " }),
    { athleteId: "i564686", apiKey: "abc" }, "les blancs sont rognés, la valeur est gardée");
});

test("une valeur qui n'est pas une chaîne ne devient pas une chaîne par accident", () => {
  // Une colonne mal typée, un JSON malformé, un `true` : `String(x)` aurait produit
  // « [object Object] » ou « true » et lancé un appel avec une clé absurde.
  for (const bidon of [123, true, false, {}, [], { toString: () => "i1" }, Symbol.iterator]) {
    assert.equal(identifiantsDe({ intervals_athlete_id: bidon, intervals_api_key: "k" }), null,
      `${String(bidon)} ne doit pas passer pour un identifiant`);
    assert.equal(identifiantsDe({ intervals_athlete_id: "i1", intervals_api_key: bidon }), null,
      `${String(bidon)} ne doit pas passer pour une clé`);
  }
});

test("la variante par paire répond exactement comme la variante par profil", () => {
  // Deux fonctions, une seule règle : le coach automatique reçoit ses valeurs séparément.
  // Si elles divergent, le repli revient par le chemin le plus fréquenté du projet.
  const cas: [unknown, unknown][] = [
    ["i1", "k"], [null, "k"], ["i1", null], [undefined, undefined], ["", ""], ["  ", "k"], [42, "k"],
  ];
  for (const [a, b] of cas) {
    assert.deepEqual(identifiantsDePaire(a, b), identifiantsDe({ intervals_athlete_id: a, intervals_api_key: b }),
      `divergence sur (${String(a)}, ${String(b)})`);
  }
});

test("chaque route qui appelle intervals.icu passe par le helper", () => {
  // ⚠️ On vise le SITE qui produit l'effet — l'APPEL `identifiantsDe(` — et non l'import,
  // qu'on peut garder en supprimant l'usage. Le test précédent interdit l'ancien repli ;
  // celui-ci interdit d'inventer un troisième chemin (relecture directe des colonnes).
  const routes = [
    "src/app/api/watch/status/route.ts",
    "src/app/api/watch/push/route.ts",
    "src/app/api/intervals/sync/route.ts",
    "src/app/api/intervals/status/route.ts",
    "src/app/api/activity-detail/route.ts",
    "src/app/api/admin/activity-detail/route.ts",
    "src/app/api/admin/analyze-session/route.ts",
    "src/app/api/admin/assign-session/route.ts",
    "src/app/api/admin/publish-plan/route.ts",
    "src/app/api/admin/repush-watch/route.ts",
  ];
  const sans = routes.filter((r) => !/identifiantsDe\s*\(/.test(codeSeul(r)));
  assert.deepEqual(sans, [], `ces routes décident seules de leurs identifiants : ${sans.join(", ")}`);
  const coach = codeSeul("src/lib/ai/autoCoach.ts");
  assert.ok(/identifiantsDePaire\s*\(/.test(coach),
    "le coach automatique — le site qui poussait le plan d'autrui sur la montre de l'éditeur — doit passer par le helper");
});

test("la route d'état ne dit plus « configuré » d'après l'environnement", () => {
  // AutoSync lance l'import des activités sur cette seule réponse. Un `true` venu de
  // l'environnement suffisait à importer les sorties de l'éditeur dans le compte d'un
  // client. La source annoncée ne peut donc plus valoir « env ».
  const code = codeSeul("src/app/api/intervals/status/route.ts");
  assert.ok(!/["']env["']/.test(code), "la route peut encore répondre source: \"env\"");
  assert.ok(/configured:\s*false/.test(code), "le visiteur anonyme doit recevoir configured: false");
});

// Les envois sont asynchrones : tout ce qui suit vit dans une IIFE, `tsx` compilant
// en CommonJS où le `await` de premier niveau n'existe pas.
void (async () => {

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n📡 ENVOI DE LA SÉANCE — ce qui arrive quand rien ne se passe bien\n");
// ─────────────────────────────────────────────────────────────────────────────

type Appel = { url: string; method: string; body?: string };
/** Remplace `fetch` par un scénario, et enregistre ce qui a été demandé. */
function stubFetch(reponse: (url: string, init?: RequestInit) => unknown): Appel[] {
  const appels: Appel[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    appels.push({ url: String(url), method: (init?.method ?? "GET"), body: init?.body as string | undefined });
    const r = reponse(String(url), init);
    if (r instanceof Error) throw r;
    return r as Response;
  };
  return appels;
}
const vraiFetch = globalThis.fetch;
const rep = (status: number, corps: unknown): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corps,
  text: async () => JSON.stringify(corps),
} as Response);

const SEANCE = {
  athleteId: "i1", apiKey: "k", userId: "u-42",
  name: "🏃 Footing", date: "2026-08-25", description: "note\n\n- 40m 5:00-5:20 pace Endurance facile",
};

await atest("intervals.icu injoignable → un échec annoncé, jamais une exception", async () => {
  // Le coach automatique appelle ceci dans une boucle sur TOUS les athlètes. Une exception
  // non rattrapée ici interromprait la nuit de tout le monde à cause d'un seul compte.
  stubFetch(() => new Error("ECONNRESET"));
  const r = await pushIntervalsWorkout(SEANCE);
  assert.equal(r.ok, false);
  assert.ok(r.error, "un échec doit dire pourquoi");
});

await atest("une clé révoquée (401) ne passe pas pour un succès", async () => {
  stubFetch((url, init) => (init?.method === "POST" ? rep(401, {}) : rep(200, [])));
  const r = await pushIntervalsWorkout(SEANCE);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /401/, "le code HTTP doit remonter tel quel");
});

await atest("un quota dépassé (429) ne passe pas pour un succès", async () => {
  stubFetch((url, init) => (init?.method === "POST" ? rep(429, {}) : rep(200, [])));
  const r = await pushIntervalsWorkout(SEANCE);
  assert.equal(r.ok, false);
});

await atest("une réponse illisible ne fait pas tomber l'envoi", async () => {
  // La création réussit (HTTP 201) mais le corps n'est pas du JSON : la séance EST sur le
  // calendrier. Rendre `ok: false` ferait recréer un doublon à la passe suivante.
  stubFetch((url, init) => init?.method === "POST"
    ? ({ ok: true, status: 201, json: async () => { throw new Error("Unexpected token"); } } as unknown as Response)
    : rep(200, []));
  const r = await pushIntervalsWorkout(SEANCE);
  assert.equal(r.ok, true, "une séance créée reste créée même si on ne sait pas lire son id");
  assert.equal(r.eventId, undefined, "et on n'invente pas d'identifiant");
});

await atest("un calendrier qui répond autre chose qu'une liste ne fait pas tomber l'envoi", async () => {
  // Vu en production sur d'autres API : un objet d'erreur là où un tableau est attendu.
  // `existing.filter` aurait jeté, et la séance du jour ne serait jamais partie.
  stubFetch((url, init) => init?.method === "POST" ? rep(200, { id: 9 }) : rep(200, { error: "nope" }));
  const r = await pushIntervalsWorkout(SEANCE);
  assert.equal(r.ok, false, "on préfère un échec annoncé à une exception silencieuse");
});

await atest("une séance identique et récente n'est PAS réécrite", async () => {
  // Le plan est recalculé plusieurs fois par jour et retombe presque toujours sur la même
  // séance. Chaque réécriture relance une synchronisation Garmin : la montre se retrouve
  // sans séance le temps du va-et-vient.
  const existant = [{
    id: 7, external_id: `rte-coach-${SEANCE.userId}-${SEANCE.date}`,
    name: SEANCE.name, description: SEANCE.description, updated: new Date().toISOString(),
  }];
  const appels = stubFetch(() => rep(200, existant));
  const r = await pushIntervalsWorkout(SEANCE);
  assert.equal(r.unchanged, true);
  assert.deepEqual(appels.filter((a) => a.method !== "GET"), [], "aucune écriture ne doit partir");
});

await atest("la même séance vieille de plus de 20 h EST recréée", async () => {
  // Sans cette recréation quotidienne, une désynchronisation Garmin devenait définitive :
  // l'application considérait tout conforme et ne pouvait plus jamais réparer.
  const existant = [{
    id: 7, external_id: `rte-coach-${SEANCE.userId}-${SEANCE.date}`,
    name: SEANCE.name, description: SEANCE.description,
    updated: new Date(Date.now() - 30 * 3600_000).toISOString(),
  }];
  const appels = stubFetch((url, init) => init?.method === "POST" ? rep(200, { id: 8 }) : rep(200, existant));
  const r = await pushIntervalsWorkout(SEANCE);
  assert.equal(r.unchanged, undefined);
  assert.ok(appels.some((a) => a.method === "DELETE"), "l'ancienne doit être retirée");
  assert.ok(appels.some((a) => a.method === "POST"), "une neuve doit être créée");
});

await atest("l'envoi ne touche QUE la séance coach de cet athlète, ce jour-là", async () => {
  // ⚠️ LE GARDE-FOU QUI A ÉVITÉ LE PIRE. Tant que les identifiants se repliaient sur le
  // compte de l'éditeur, deux athlètes écrivaient dans le MÊME calendrier. Seul
  // l'`external_id`, qui porte l'identifiant de l'athlète, les a empêchés de s'effacer
  // mutuellement — ils s'empilaient au lieu de s'écraser. Ce test fige ce garde-fou : il
  // reste la dernière barrière si un compte partagé réapparaît un jour.
  const autreAthlete = { id: 1, external_id: "rte-coach-AUTRE-2026-08-25", name: "x", description: "y" };
  const ghost = { id: 2, external_id: "ghost-runner-2026-08-25", name: "défi", description: "z" };
  const mienne = { id: 3, external_id: `rte-coach-${SEANCE.userId}-${SEANCE.date}`, name: "vieux", description: "vieux" };
  const appels = stubFetch((url, init) =>
    init?.method === "POST" ? rep(200, { id: 99 }) : rep(200, [autreAthlete, ghost, mienne]));
  await pushIntervalsWorkout(SEANCE);
  const supprimes = appels.filter((a) => a.method === "DELETE").map((a) => a.url.split("/").pop());
  assert.deepEqual(supprimes, ["3"], `seule la séance 3 doit être supprimée, or ${supprimes} l'ont été`);
});

await atest("un jour devenu repos est RETIRÉ de la montre, pas seulement ignoré", async () => {
  // ⚠️ DÉFAUT CONSTATÉ SUR LE COMPTE RÉEL DE CYPRIEN LE 31/08/2026. Le coach ne pousse
  // que les jours portant une séance courable : un jour devenu « Repos » ou
  // « Renforcement » ne produit aucun entraînement, la boucle faisait `continue`, et
  // l'ancienne séance — poussée la veille — RESTAIT sur la montre.
  //
  // Relevé : plan « Repos » les 2 et 3 septembre, montre « Footing » ces deux jours-là ;
  // plan « Renforcement » le 1er, montre « Séance au seuil ». Trois jours sur quatre
  // faux, sans la moindre erreur nulle part. Le coureur suit sa montre — il court un jour
  // où le coach avait décidé qu'il devait récupérer, soit l'inverse du service rendu.
  const mienne = { id: 7, external_id: `rte-coach-${SEANCE.userId}-${SEANCE.date}`, name: "vieux footing" };
  const autre = { id: 8, external_id: "ghost-runner-2026-08-25", name: "défi" };
  const appels = stubFetch(() => rep(200, [mienne, autre]));
  const r = await supprimerIntervalsWorkout({
    athleteId: SEANCE.athleteId, apiKey: SEANCE.apiKey, userId: SEANCE.userId, date: SEANCE.date,
  });
  assert.equal(r.ok, true);
  assert.equal(r.supprimees, 1);
  // ⚠️ ON NE SUPPRIME QUE LA NÔTRE. Un défi Ghost Runner le même jour ne doit pas partir
  // avec — même garde-fou que pour l'écriture.
  const supprimes = appels.filter((a) => a.method === "DELETE").map((a) => a.url.split("/").pop());
  assert.deepEqual(supprimes, ["7"], `seule la séance 7 devait partir, or ${supprimes} l'ont été`);
});
await atest("retirer une séance absente n'est pas une erreur", async () => {
  // Le coach appelle ce retrait pour CHAQUE jour de repos, à chaque republication du
  // plan — soit plusieurs fois par jour. Traiter « rien à supprimer » comme un échec
  // remplirait les journaux d'erreurs sur le fonctionnement normal.
  stubFetch(() => rep(200, []));
  const r = await supprimerIntervalsWorkout({ ...SEANCE, date: SEANCE.date });
  assert.equal(r.ok, true);
  assert.equal(r.supprimees, 0);
});
await atest("un calendrier injoignable ne fait pas tomber la republication", async () => {
  stubFetch(() => new Error("ECONNRESET"));
  const r = await supprimerIntervalsWorkout({ ...SEANCE, date: SEANCE.date });
  assert.equal(r.ok, false);
  assert.ok(r.error, "un échec doit dire pourquoi");
});

await atest("un nom trop long est tronqué avant de partir, pas par la montre", async () => {
  const appels = stubFetch((url, init) => init?.method === "POST" ? rep(200, { id: 1 }) : rep(200, []));
  await pushIntervalsWorkout({ ...SEANCE, name: "🏃 " + "Prépa Marathon International de Lille ".repeat(6) });
  const envoye = JSON.parse(appels.find((a) => a.method === "POST")!.body!);
  assert.ok(envoye.name.length <= 90, `nom de ${envoye.name.length} caractères envoyé (90 max côté montre)`);
});

await atest("l'identifiant externe isole les athlètes ET les jours", async () => {
  const vus: string[] = [];
  for (const [userId, date] of [["u-1", "2026-08-25"], ["u-2", "2026-08-25"], ["u-1", "2026-08-26"]] as const) {
    const appels = stubFetch((url, init) => init?.method === "POST" ? rep(200, { id: 1 }) : rep(200, []));
    await pushIntervalsWorkout({ ...SEANCE, userId, date });
    vus.push(JSON.parse(appels.find((a) => a.method === "POST")!.body!).external_id);
  }
  assert.equal(new Set(vus).size, 3, `trois séances distinctes doivent porter trois identifiants : ${vus}`);
});

globalThis.fetch = vraiFetch;

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n⌚ DÉTECTION DE MONTRE — ne jamais affirmer ce qu'on ne lit pas\n");
// ─────────────────────────────────────────────────────────────────────────────

test("un athlète sans aucune destination active n'a pas de montre prête", () => {
  assert.equal(montreDe({}), null);
  assert.equal(montreDe({ icu_garmin_upload_workouts: false }), null);
  assert.equal(montreDe({ icu_garmin_upload_workouts: null }), null);
  assert.equal(montreDe({ coros_upload_workouts: 0 }), null);
  assert.equal(montreDe({ suunto_upload_workouts: "" }), null);
});

test("Polar et Apple ne peuvent JAMAIS être détectés comme recevant la séance", () => {
  // Ce sont les deux marques que la page annonce en LECTURE SEULE. Si un champ d'envoi
  // apparaissait pour elles dans la table, la page deviendrait menteuse dans l'autre sens.
  const noms = DESTINATIONS_MONTRE.map((d) => d.nom.toLowerCase());
  assert.ok(!noms.includes("polar"), "Polar n'a aucun champ *_upload_workouts chez intervals.icu");
  assert.ok(!noms.some((n) => n.includes("apple")), "Apple n'a AUCUN champ, dans aucun sens");
  // Et même en forçant des champs inventés, rien ne doit s'allumer.
  assert.equal(montreDe({ polar_upload_workouts: true, apple_upload_workouts: true }), null);
});

test("Zwift reçoit la séance mais n'allume pas « ta montre est prête »", () => {
  // Le dire à quelqu'un qui court sur tapis sans rien au poignet serait faux.
  assert.equal(montreDe({ zwift_upload_workouts: true }), null);
  const zwift = DESTINATIONS_MONTRE.find((d) => d.nom === "Zwift");
  assert.equal((zwift as { montre?: boolean } | undefined)?.montre, false);
});

test("le préfixe de chaque champ est celui de l'API, pas celui qu'on devine", () => {
  // ⚠️ Garmin est `icu_garmin_*`, les autres n'ont pas ce préfixe. Recopier le mauvais
  // rend `undefined` — donc « pas prête » — SANS la moindre erreur.
  const attendus: Record<string, string> = {
    Garmin: "icu_garmin_upload_workouts", Coros: "coros_upload_workouts",
    Suunto: "suunto_upload_workouts", Wahoo: "wahoo_upload_workouts",
    Amazfit: "zepp_upload_workouts", Huawei: "huawei_upload_workouts",
    Zwift: "zwift_upload_workouts",
  };
  for (const d of DESTINATIONS_MONTRE) {
    assert.equal(d.actif, attendus[d.nom], `champ inattendu pour ${d.nom}`);
    assert.equal(montreDe({ [d.actif]: true }) === null, (d as { montre?: boolean }).montre === false,
      `${d.nom} : le champ relevé sur l'API n'allume pas la détection`);
  }
});

test("la date de dernier envoi n'est lue que là où l'API l'expose vraiment", () => {
  // La table annonçait autrefois `wahoo_last_upload`, un champ qui N'EXISTE PAS : la
  // lecture rendait `undefined` en silence. Seuls Garmin, Coros et Suunto l'exposent
  // (revérifié sur l'API le 23/08/2026).
  const avecDate = DESTINATIONS_MONTRE.filter((d) => d.dernier).map((d) => d.nom).sort();
  assert.deepEqual(avecDate, ["Coros", "Garmin", "Suunto"]);
  assert.equal(montreDe({ wahoo_upload_workouts: true })?.dernier, null,
    "sans champ de date, on rend null — pas undefined, pas une date inventée");
});

test("la première montre active gagne, et son nom est celui de la table", () => {
  assert.deepEqual(montreDe({ icu_garmin_upload_workouts: true, icu_garmin_last_upload: "2026-08-23T12:40:45Z" }),
    { nom: "Garmin", dernier: "2026-08-23T12:40:45Z" });
  assert.equal(montreDe({ coros_upload_workouts: true })?.nom, "Coros");
  assert.equal(montreDe({ huawei_upload_workouts: true })?.nom, "Huawei");
});

test("sans appareil ni source, on n'affirme rien du tout", () => {
  assert.equal(lectureDe([]), null);
  assert.equal(lectureDe([{}]), null);
  assert.equal(lectureDe([{ start_date_local: "2026-08-20" }]), null);
  assert.equal(lectureDe([{ device_name: "   " }]), null, "un nom d'appareil vide n'est pas un appareil");
  assert.equal(lectureDe(undefined as unknown as []), null, "une liste absente ne doit pas jeter");
});

test("Apple Watch est le seul cas « lecture seule » qui ait une issue", () => {
  // Polar ne peut PAS recevoir, point final. Lui proposer une application serait mentir.
  assert.ok(estAppleWatch({ appareil: "Apple Watch Ultra 2", source: null, date: null }));
  assert.ok(!estAppleWatch({ appareil: "Polar Vantage V3", source: null, date: null }));
  assert.ok(!estAppleWatch({ appareil: null, source: "POLAR", date: null }));
  assert.ok(!estAppleWatch(null));
  assert.ok(!estAppleWatch(undefined));
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n📣 CE QUE LA PAGE PROMET — quatre montres, et rien de plus\n");
// ─────────────────────────────────────────────────────────────────────────────

/** Les pastilles de la page d'accueil, dans l'ordre où elles s'affichent. */
function pastillesLanding(): { nom: string; pousse: boolean; appli: boolean; passerelle: boolean; app: string | null }[] {
  const code = codeSeul("src/app/page.tsx");
  const bloc = code.slice(code.indexOf("const SYNC:"), code.indexOf("export default function LandingPage"));
  return [...bloc.matchAll(/\{\s*nom:\s*"([^"]+)"([^}]*)\}/g)].map((m) => ({
    nom: m[1],
    pousse: /pousse:\s*true/.test(m[2]),
    appli: /appli:\s*true/.test(m[2]),
    passerelle: /passerelle:\s*true/.test(m[2]),
    app: (m[2].match(/passerelleApp:\s*"([^"]+)"/) ?? [])[1] ?? null,
  }));
}

test("la rangée de marques est exactement celle décidée le 23/08/2026", () => {
  // QUATRE marques, et le critère est devenu unique : la séance arrive-t-elle AU POIGNET ?
  // Garmin, COROS et Suunto par intervals.icu ; l'Apple Watch par une application tierce.
  // Polar est parti le 23/08/2026 pour cette seule raison — il lit parfaitement, mais son
  // API est en lecture seule. Wahoo, Amazfit et Huawei restent SERVIS sans être annoncés.
  const pastilles = pastillesLanding().filter((p) => !p.appli).map((p) => p.nom);
  assert.deepEqual(pastilles, ["Garmin", "COROS", "Suunto", "Apple Watch"]);
});

test("Polar a quitté la VITRINE, pas l'application", () => {
  // ⚠️ LE PIÈGE DE CE RETRAIT, et c'est le plus coûteux du lot. Polar n'a jamais été une
  // destination d'envoi — il n'est donc dans AUCUNE table à nettoyer. Mais ses sorties
  // arrivent bien dans Pacevo, et c'est ce qui fait tourner tout le produit : VMA, charge,
  // fraîcheur, plan. Le jour où quelqu'un « finira le ménage » en retirant `polar` des
  // sources d'activité ou du guide de connexion, un client Polar cessera de se synchroniser
  // — sans erreur, comme d'habitude.
  const sources = readFileSync(join(ROOT, "src/types/index.ts"), "utf8");
  assert.match(sources, /"polar"/, "`polar` doit rester une source d'activité reconnue");
  const guide = readFileSync(join(ROOT, "src/app/dashboard/sync/page.tsx"), "utf8");
  assert.match(guide, /name: "Polar"/, "le guide de connexion doit continuer d'aider un porteur de Polar");
  // Et la lecture reste agnostique de la marque : une activité Polar se décrit comme une autre.
  const l = lectureDe([{ device_name: "Polar Vantage V3", source: "POLAR", start_date_local: "2026-08-21T07:00:00" }]);
  assert.equal(l?.appareil, "Polar Vantage V3");
  assert.equal(l?.source, "Polar");
});

test("les marques retirées de la page restent servies par l'application", () => {
  // ⚠️ LE PIÈGE À ÉVITER. Retirer une marque de la vitrine est une décision commerciale.
  // La retirer du CODE priverait son porteur de sa séance : pastille orange, et un format
  // Garmin que sa montre ne sait pas lire. Le silence commercial n'est pas un retrait.
  // `as const satisfies` donne à `nom` un type union : sans l'élargir en `string[]`, retirer
  // une marque ferait échouer la COMPILATION du test au lieu de le faire rougir avec un
  // message lisible. On veut le message, pas une erreur TS2345 à déchiffrer.
  const noms: string[] = DESTINATIONS_MONTRE.map((d) => d.nom);
  for (const marque of ["Wahoo", "Amazfit", "Huawei"]) {
    assert.ok(noms.includes(marque), `${marque} a disparu du code : ses porteurs ne reçoivent plus rien`);
  }
});

test("l'Apple Watch n'est jamais dans la ligne « envoi sur ta montre »", () => {
  // La ligne est DÉRIVÉE de `pousse`, jamais recopiée. Promettre l'envoi par intervals.icu
  // à une plateforme qu'il ne sait pas atteindre est le pire des deux mensonges possibles.
  const pastilles = pastillesLanding();
  // Polar ne doit plus figurer du tout : sa présence signalerait un retour en arrière non
  // décidé, et il n'aurait alors aucune ligne d'envoi — donc une pastille sans promesse.
  assert.equal(pastilles.find((x) => x.nom === "Polar"), undefined,
    "Polar est revenu dans la vitrine : c'est une décision commerciale, pas un correctif");
  for (const nom of ["Apple Watch"]) {
    const p = pastilles.find((x) => x.nom === nom);
    assert.ok(p, `${nom} a disparu de la page`);
    assert.equal(p!.pousse, false, `${nom} est annoncé comme recevant la séance — son API ne le permet pas`);
  }
  assert.equal(pastilles.find((p) => p.nom === "Apple Watch")!.passerelle, true,
    "Apple Watch doit porter l'astérisque qui renvoie à l'application passerelle");
});

test("le compteur « les N plateformes » est calculé, jamais écrit en dur", () => {
  // Un « 8 » recopié dans le dictionnaire aurait survécu au retrait de trois marques et
  // annoncé huit plateformes sous une rangée de cinq.
  const page = codeSeul("src/app/page.tsx");
  assert.match(page, /readValue\.replace\("\{n\}",\s*String\(SYNC\.filter/,
    "le nombre de plateformes doit venir de SYNC");
  const dict = readFileSync(join(ROOT, "src/components/landing/landingI18n.ts"), "utf8");
  const valeurs = [...dict.matchAll(/readValue:\s*"([^"]*)"/g)].map((m) => m[1]);
  assert.ok(valeurs.length >= 5, `seulement ${valeurs.length} langue(s) portent readValue`);
  for (const v of valeurs) {
    assert.ok(v.includes("{n}"), `« ${v} » écrit le nombre en dur au lieu de {n}`);
    assert.ok(!/\d/.test(v.replace("{n}", "")), `« ${v} » contient un chiffre en dur`);
  }
});

test("les cinq notes disent la même chose, et ne parlent plus de Polar", () => {
  // ⚠️ CE TEST A ÉTÉ RETOURNÉ LE 23/08/2026. Il exigeait auparavant que chaque note nomme
  // Polar pour dire qu'il ne reçoit pas. Polar ayant quitté la vitrine, une note qui le
  // nomme encore expliquerait une restriction sur une marque que la page n'affiche plus —
  // et ferait surgir un nom de nulle part, en cinq langues.
  const dict = readFileSync(join(ROOT, "src/components/landing/landingI18n.ts"), "utf8");
  // ⚠️ ON VISE LA NOTE DE `sync`, PAS TOUTES LES CLÉS `note`. Un `/note:\s*"…"/` global
  // attrapait aussi les cinq `cta.note` — le test rougissait sur des traductions saines,
  // et le réflexe aurait été de l'affaiblir plutôt que de le viser correctement.
  const notes = [...dict.matchAll(/sync:\s*\{[^\n]*?note:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  assert.equal(notes.length, 5, `${notes.length} note(s) de synchronisation trouvée(s), 5 langues attendues`);
  for (const n of notes) {
    assert.match(n, /Apple Watch/, "une note ne mentionne pas l'exception Apple Watch");
    assert.match(n, /intervals\.icu/, "une note ne dit pas par où tout passe");
  }
  // Les marques retirées de la vitrine ne doivent plus apparaître dans aucune traduction.
  for (const n of notes) {
    for (const retiree of ["Wahoo", "Amazfit", "Huawei", "Zepp", "Polar"]) {
      assert.ok(!n.includes(retiree), `« ${retiree} » subsiste dans une traduction`);
    }
  }
  // ET NULLE PART AILLEURS DANS LA VITRINE. La carte de fonctionnalité et la liste du
  // palier gratuit annonçaient « Sync Garmin, Coros, Polar » en cinq langues — trois
  // endroits pour une même promesse, et deux avaient survécu au premier nettoyage.
  // ⚠️ SUR LE CODE SEUL, PAS SUR LE FICHIER BRUT. Le commentaire d'en-tête EXPLIQUE
  // pourquoi Polar est parti, et le nomme forcément pour le dire. Grepper le fichier tel
  // quel faisait rougir ce test sur sa propre documentation — et le réflexe aurait été de
  // supprimer l'explication plutôt que la promesse.
  assert.ok(!codeSeul("src/components/landing/landingI18n.ts").includes("Polar"),
    "« Polar » subsiste dans une chaîne affichable de la landing");
});

test("l'Apple Watch est annoncée comme RECEVANT la séance, sur sa propre ligne", () => {
  // ⚠️ LE DÉFAUT QUE CE TEST FIGE. L'Apple Watch n'apparaissait que dans la ligne de
  // LECTURE : son porteur en concluait que sa montre ne recevrait jamais de séance. C'est
  // faux — « Intervals Companion » (application iOS tierce) lit le calendrier
  // intervals.icu, convertit la séance planifiée et l'envoie au poignet. La capacité
  // existait, la page la cachait dans une note grise.
  const apple = pastillesLanding().find((p) => p.nom === "Apple Watch");
  assert.ok(apple, "Apple Watch a disparu de la page");
  assert.equal(apple!.passerelle, true, "sans `passerelle`, la ligne d'envoi ne s'affiche pas du tout");
  assert.equal(apple!.app, "Intervals Companion", "l'application passerelle doit être nommée dans la table, pas dans une traduction");
  // Et le drapeau `pousse` reste FAUX : cette chaîne dépend d'une application tierce, elle
  // ne vaut pas celle de Garmin, qui ne demande rien à l'athlète.
  assert.equal(apple!.pousse, false, "Apple ne doit pas rejoindre la liste des montres : intervals.icu n'a aucun champ Apple");
});

test("la ligne de passerelle est dérivée de la table, jamais recopiée", () => {
  // Une ligne écrite en dur nommerait encore « Intervals Companion » le jour où la table
  // désignerait une autre application — et la page vanterait un logiciel abandonné.
  const page = codeSeul("src/app/page.tsx");
  assert.match(page, /SYNC\.filter\(\(m\) => m\.passerelle\)/, "la ligne doit être dérivée de `passerelle`");
  assert.match(page, /pushBridgeValue\.replace\("\{app\}",\s*m\.passerelleApp/, "le nom de l'application doit venir de `passerelleApp`");
});

test("aucune traduction ne nomme l'application ni ne lui invente un prix", () => {
  // ⚠️ « GRATUITE » N'A PAS PU ÊTRE VÉRIFIÉ. L'App Store annonce l'application comme
  // gratuite mais avec deux achats intégrés (« Yearly Supporter » 9,99 $, « Support Tip »
  // 19,99 $), et ni la fiche ni le site de l'auteur ne disent si l'envoi des séances est
  // ouvert à tous ou réservé au palier soutien. Écrire un prix qu'on n'a pas vérifié, sur
  // un site mis en vente, est exactement ce que ce projet s'interdit.
  const dict = readFileSync(join(ROOT, "src/components/landing/landingI18n.ts"), "utf8");
  const valeurs = [...dict.matchAll(/pushBridgeValue:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  assert.equal(valeurs.length, 5, `${valeurs.length} traduction(s) de la ligne de passerelle, 5 attendues`);
  for (const v of valeurs) {
    assert.ok(v.includes("{app}"), `« ${v} » écrit le nom de l'application en dur au lieu de {app}`);
    assert.ok(!/gratuit|free|kostenlos|grátis|gratis|\$|€|\d/i.test(v),
      `« ${v} » avance un prix ou une gratuité qu'on n'a pas pu vérifier à la source`);
  }
  const marques = [...dict.matchAll(/pushBridge:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  assert.equal(marques.length, 5);
  for (const m of marques) assert.ok(m.includes("{marque}"), `« ${m} » écrit la marque en dur au lieu de {marque}`);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🏃 FORMAT DE SÉANCE — ce qui arrive au poignet de chaque marque\n");
// ─────────────────────────────────────────────────────────────────────────────

test("chaque marque annoncée produit une séance dont aucune étape n'est vide", () => {
  // intervals.icu n'exporte QU'UNE métrique directrice. Sur une montre non-Garmin, les
  // blocs portant l'autre arrivent SANS CIBLE : le coureur voit « 8 min » et devine.
  for (const montre of ["Garmin", "Coros", "Suunto", "Wahoo", "Amazfit", "Huawei", null]) {
    const b = buildWorkoutDescription("VMA courte", "10×400 m à ~3'40/km, récup 45 s", "VMA", null, 17, 15, 10, montre);
    assert.ok(b, `aucune séance construite pour ${montre ?? "(non détectée)"}`);
    const etapes = b!.description.split("\n").filter((l) => l.startsWith("- "));
    assert.ok(etapes.length > 0, `séance sans étape pour ${montre ?? "(non détectée)"}`);
    const sansCible = etapes.filter((l) => !/\bpace\b/.test(l) && !/\bHR\b/.test(l));
    assert.deepEqual(sansCible, [], `${montre} reçoit ${sansCible.length} étape(s) sans cible`);
    const metriques = new Set(etapes.map((l) => (/\bpace\b/.test(l) ? "pace" : "HR")));
    if (montre !== "Garmin") {
      assert.equal(metriques.size, 1, `${montre ?? "(non détectée)"} ne lit qu'une métrique, or la séance en mélange ${[...metriques]}`);
    }
  }
});

test("une montre inconnue reçoit le format qui marche partout", () => {
  // Le repli a été RETOURNÉ le 21/08/2026 : traiter l'inconnu comme une Garmin protégeait
  // la majorité en cassant les autres. Une prescription moins fine vaut mieux qu'absente.
  assert.equal(metriquesMixtesSupportees(null), false);
  assert.equal(metriquesMixtesSupportees("Polar"), false);
  assert.equal(metriquesMixtesSupportees("garmin"), false, "la casse ne doit pas décider à la place de la détection");
  assert.equal(metriquesMixtesSupportees("Garmin"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n📒 REFUS D'ÉCRITURE — du webhook et du cron jusqu'au journal de /admin\n");
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ CONSTATÉ LE 12/10/2026 : `syncIntervalsForUser` rend `failures` — chaque séance, VFC ou
// nuit que la base a refusée —, mais ses deux appelants serveur ne lisaient que `synced` et
// `error`. Un refus du chemin webhook/cron n'arrivait nulle part.

/** Fait taire la console le temps d'un appel, et rend ce qui y a été écrit. */
async function enSilence<T>(fn: () => Promise<T>): Promise<{ r: T; sortie: string[] }> {
  const sortie: string[] = [];
  const avant = { log: console.log, warn: console.warn, error: console.error };
  for (const k of ["log", "warn", "error"] as const) console[k] = (...a: unknown[]) => { sortie.push(`${k}: ${a.map(String).join(" ")}`); };
  try { return { r: await fn(), sortie }; } finally { Object.assign(console, avant); }
}

type LigneJournal = { user_id: string; source: string; message: string; url: string; meta: { canal: string; total: number; refus: string[] } };
/** Un client dont seul `error_logs` répond — ce que `journaliserRefus` touche, et rien d'autre. */
function journalSimule(reponse: () => Promise<{ error: { message: string } | null }>) {
  const ecrits: { table: string; lignes: LigneJournal[] }[] = [];
  const admin = { from: (table: string) => ({ insert: async (lignes: LigneJournal[]) => { ecrits.push({ table, lignes }); return reponse(); } }) };
  return { admin: admin as unknown as SupabaseClient, ecrits };
}

test("la cause d'un refus se lit sans la date ni le titre — c'est sur elle qu'on regroupe", () => {
  // Le titre est GOURMAND : Garmin nomme les sorties d'après la ville, et un titre peut
  // contenir « : » comme « » : ». Le message de la base, lui, n'en contient jamais.
  assert.deepEqual(causeDuRefus('2026-10-11 « Sortie « longue » : Rouen » : 22P02 invalid input syntax for type smallint: "176.54"'),
    { quoi: "séance", code: "22P02", cause: '22P02 invalid input syntax for type smallint: "176.54"' });
  assert.deepEqual(causeDuRefus('VFC du 2026-10-11 : 23502 null value in column "hrv_ms"'),
    { quoi: "VFC", code: "23502", cause: '23502 null value in column "hrv_ms"' });
  assert.deepEqual(causeDuRefus('sommeil du 2026-10-11 : 23514 new row for relation "sleep_data" violates check constraint'),
    { quoi: "sommeil", code: "23514", cause: '23514 new row for relation "sleep_data" violates check constraint' });
  // Un format inconnu n'est jamais perdu : il devient sa propre cause.
  assert.equal(causeDuRefus("quelque chose d'inattendu").cause, "quelque chose d'inattendu");
  assert.equal(causeDuRefus("quelque chose d'inattendu").quoi, "écriture");
});

test("une erreur rendue par la BASE n'est jamais « passagère », même si elle contient 502", () => {
  // ⚠️ LE PIÈGE : `estErreurTransitoire` cherche « 502 » sans bornes de mot. La violation de
  // NOT NULL — celle des jours sans montre — s'écrit 23502 : sans cette garde, elle aurait
  // été comptée comme une passerelle en panne, et jamais journalisée.
  const passager = (ligne: string) => estPassager(causeDuRefus(ligne));
  assert.equal(passager('VFC du 2026-10-11 : 23502 null value in column "hrv_ms"'), false, "23502 pris pour un 502");
  assert.equal(passager('2026-10-11 « Trail » : 22P02 invalid input syntax for type smallint: "1502.5"'), false, "une valeur refusée prise pour un 502");
  assert.equal(passager("2026-10-11 « Trail » : PGRST204 Could not find the 'hrr_bpm' column of 'workouts'"), false, "un code PostgREST pris pour un incident");
  // Ce qui EST passager : sans code de la base (réseau, passerelle).
  assert.equal(passager("2026-10-11 « Trail » : ? upstream request timeout"), true, "une passerelle qui expire n'est pas passagère");
  assert.equal(passager("sommeil du 2026-10-11 :  TypeError: fetch failed"), true, "une coupure réseau n'est pas passagère");
  assert.equal(estPassager({ code: "EPIPE", cause: "EPIPE TypeError: fetch failed" }), true, "EPIPE (cinq majuscules) pris pour un code SQL");
});

await atest("une même cause sur plusieurs jours fait UNE ligne de journal ; un incident passager n'en fait aucune", async () => {
  const { admin, ecrits } = journalSimule(async () => ({ error: null }));
  const { r: bilan, sortie } = await enSilence(() => journaliserRefus(admin, { userId: "u-42", canal: "cron", failures: [
    '2026-10-09 « Footing » : 22P02 invalid input syntax for type smallint: "176.54"',
    '2026-10-10 « Footing » : 22P02 invalid input syntax for type smallint: "176.54"',
    'VFC du 2026-10-10 : 23502 null value in column "hrv_ms" of relation "hrv_data" violates not-null constraint',
    "sommeil du 2026-10-10 : ? upstream request timeout",
  ] }));
  assert.deepEqual(bilan, { refus: 3, passagers: 1 });
  assert.equal(ecrits.length, 1, "un passage doit faire UNE écriture au journal, pas une par refus");
  assert.equal(ecrits[0].table, "error_logs");
  assert.equal(ecrits[0].lignes.length, 2, "deux causes distinctes attendues : séance 22P02, VFC 23502");
  const seance = ecrits[0].lignes.find((l) => l.message.includes("22P02"))!;
  assert.equal(seance.meta.total, 2, "les deux jours de la même cause doivent être comptés ensemble");
  assert.ok(!/2026-10-/.test(seance.message), "la date est dans le message : chaque jour ferait un défaut distinct dans /admin");
  assert.ok(ecrits[0].lignes.every((l) => l.source === "synchro" && l.user_id === "u-42" && l.url === "/api/cron/sync-all"));
  assert.ok(sortie.some((s) => s.startsWith("warn:") && /passager/.test(s)), "l'incident passager n'est noté nulle part");
});

await atest("aucun refus → RIEN au journal (un journal qui s'écrit à vide est du bruit)", async () => {
  const { admin, ecrits } = journalSimule(async () => ({ error: null }));
  assert.deepEqual(await journaliserRefus(admin, { userId: "u-42", canal: "webhook", failures: undefined }), { refus: 0, passagers: 0 });
  assert.deepEqual(await journaliserRefus(admin, { userId: "u-42", canal: "webhook", failures: [] }), { refus: 0, passagers: 0 });
  assert.equal(ecrits.length, 0);
});

await atest("un journal qui ne s'écrit pas ne fait pas tomber la synchro — la console prend le relais", async () => {
  const ligne = ['VFC du 2026-10-10 : 23502 null value in column "hrv_ms"'];
  for (const reponse of [async () => { throw new Error("réseau"); }, async () => ({ error: { message: "permission denied for table error_logs" } })]) {
    const { admin } = journalSimule(reponse);
    const { r, sortie } = await enSilence(() => journaliserRefus(admin, { userId: "u-42", canal: "cron", failures: ligne }));
    assert.deepEqual(r, { refus: 1, passagers: 0 }, "le refus doit rester compté même quand le journal est injoignable");
    assert.ok(sortie.some((s) => s.startsWith("error:") && /journal non écrit/.test(s)), "l'échec du journal n'est écrit nulle part");
  }
});

// Le banc : les VRAIES routes et le VRAI client supabase-js, devant une base et un
// intervals.icu simulés derrière `fetch`. Seul ce qui part au réseau est imité.
const ENV_BANC: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "cle-de-test",
  INTERVALS_WEBHOOK_SECRET: "secret-webhook-test", CRON_SECRET: "secret-cron-test",
};
const envAvant = Object.fromEntries(Object.keys(ENV_BANC).map((k) => [k, process.env[k]]));
Object.assign(process.env, ENV_BANC);

const PROFIL = { id: "u-42", intervals_athlete_id: "i1", intervals_api_key: "k" };
const SORTIE = { id: "i900001", name: "Sortie « longue » : Rouen", type: "Run", start_date_local: "2026-10-11T18:05:00",
  moving_time: 3600, elapsed_time: 3700, distance: 12000, average_heartrate: 141 };
const NUIT = { id: "2026-10-11", hrv: 62, sleepSecs: 27000 };
const REFUS_SEANCE = { status: 400, corps: { code: "22P02", message: 'invalid input syntax for type smallint: "176.54"', details: null, hint: null } };
const REFUS_VFC = { status: 400, corps: { code: "23502", message: 'null value in column "hrv_ms" of relation "hrv_data" violates not-null constraint', details: null, hint: null } };

type Ecrit = { methode: string; table: string; corps: unknown; filtre: string };
/** Les écritures, plus ce qui a été LU en base et DEMANDÉ à intervals.icu. */
type Banc = Ecrit[] & { lus: string[]; intervals: string[] };
/**
 * `refus` : par table (« workouts ») ou par méthode et table (« POST workouts »).
 * `intervalsStatut` : ce que rend intervals.icu à la lecture des activités (503, 401…).
 */
function banc(o: { activites?: unknown[]; wellness?: unknown[]; refus?: Record<string, { status: number; corps: unknown }>; journalHS?: boolean; intervalsStatut?: number }): Banc {
  const ecrits: Banc = Object.assign([] as Ecrit[], { lus: [] as string[], intervals: [] as string[] });
  const reponse = (status: number, corps?: unknown) => new Response(
    corps === undefined ? null : typeof corps === "string" ? corps : JSON.stringify(corps),
    { status, headers: { "content-type": typeof corps === "string" ? "text/plain" : "application/json" } });
  (globalThis as unknown as { fetch: unknown }).fetch = async (entree: string | URL | Request, init?: RequestInit) => {
    const url = new URL(entree instanceof Request ? entree.url : String(entree));
    const methode = (init?.method ?? "GET").toUpperCase();
    if (url.hostname === "intervals.icu") {
      ecrits.intervals.push(url.pathname + url.search);
      if (url.pathname.endsWith("/activities")) return o.intervalsStatut ? reponse(o.intervalsStatut, "indisponible") : reponse(200, o.activites ?? []);
      if (url.pathname.endsWith("/wellness")) return reponse(200, o.wellness ?? []);
      return reponse(404, {});
    }
    if (url.hostname !== "supabase.test") return reponse(404, {});
    const table = url.pathname.replace("/rest/v1/", "");
    if (methode === "GET" || methode === "HEAD") {
      ecrits.lus.push(`${table}${decodeURIComponent(url.search)}`);
      // Webhook : UNE lecture pour toute la livraison, `intervals_athlete_id=in.(i1,I1)`.
      const filtre = url.searchParams.get("intervals_athlete_id") ?? "";
      if (table === "profiles" && filtre.startsWith("in.(")) {
        const ids = filtre.slice(4, -1).split(",").map((s) => s.replace(/"/g, ""));
        return reponse(200, ids.includes(PROFIL.intervals_athlete_id) ? [PROFIL] : []);
      }
      if (table === "profiles" && url.searchParams.has("intervals_api_key")) return reponse(200, [PROFIL]);         // cron (liste)
      return reponse(200, []);
    }
    ecrits.push({ methode, table, corps: init?.body ? JSON.parse(String(init.body)) : null, filtre: decodeURIComponent(url.search) });
    if (table === "error_logs" && o.journalHS) return reponse(503, "upstream connect error");
    const refus = o.refus?.[`${methode} ${table}`] ?? o.refus?.[table];
    if (refus) return reponse(refus.status, refus.corps);
    return reponse(methode === "POST" ? 201 : 204);
  };
  return ecrits;
}
const auJournal = (ecrits: Ecrit[]) => ecrits.filter((e) => e.table === "error_logs").flatMap((e) => e.corps as LigneJournal[]);
/** Une livraison telle qu'intervals.icu l'envoie (guide d'intégration, forum, sujet 80090). */
const livraison = (events: unknown[], secret: unknown = "secret-webhook-test") => ({ secret, events });
const ALERTE_SORTIE = { athlete_id: "i1", type: "ACTIVITY_UPLOADED", timestamp: "2026-10-11T19:10:00.000+00:00",
  activity: { id: SORTIE.id, start_date_local: SORTIE.start_date_local } };
type ReponseWebhook = {
  ok?: boolean; fresh?: number; refus?: number; passagers?: number;
  bilans?: { athlete: string; issue: string; fresh: number }[]; raisons?: Record<string, string>;
};
const appelerWebhook = async (corps: unknown = livraison([ALERTE_SORTIE])) => {
  const { POST } = await import("../src/app/api/webhooks/intervals/route");
  const res = await POST(new Request("https://pacevo.fr/api/webhooks/intervals",
    { method: "POST", body: typeof corps === "string" ? corps : JSON.stringify(corps) }));
  return { status: res.status, j: await res.json() as ReponseWebhook };
};
type CompteRendu = { refus?: number; results?: { ok: boolean; refus?: number; passagers?: number }[] };
const appelerCron = async () => {
  const { GET } = await import("../src/app/api/cron/sync-all/route");
  const res = await GET(new Request("https://pacevo.fr/api/cron/sync-all", { headers: { authorization: "Bearer secret-cron-test" } }));
  return { status: res.status, j: await res.json() as CompteRendu };
};

await atest("webhook : une séance refusée par la base arrive au journal, avec sa cause et sa route", async () => {
  const ecrits = banc({ activites: [SORTIE], wellness: [NUIT], refus: { workouts: REFUS_SEANCE } });
  const { r: { status, j } } = await enSilence(appelerWebhook);
  assert.equal(status, 200);
  assert.ok(ecrits.some((e) => e.table === "workouts"), "le décor n'a pas exercé l'écriture de la séance : le test ne prouverait rien");
  assert.equal(j.refus, 1, "la réponse du webhook ne compte pas le refus");
  const journal = auJournal(ecrits);
  assert.equal(journal.length, 1, "le refus de la séance n'est pas arrivé au journal");
  assert.deepEqual([journal[0].source, journal[0].user_id, journal[0].url], ["synchro", "u-42", "/api/webhooks/intervals"]);
  assert.match(journal[0].message, /\(séance\) : 22P02 invalid input syntax for type smallint: "176\.54"$/);
  assert.match(journal[0].meta.refus[0], /^2026-10-11 « Sortie « longue » : Rouen » : 22P02 /, "la séance touchée n'est pas identifiable");
});

await atest("cron : une VFC refusée (23502) arrive au journal ET au compte rendu de l'exécution", async () => {
  const ecrits = banc({ wellness: [NUIT], refus: { hrv_data: REFUS_VFC } });
  const { r: { status, j } } = await enSilence(appelerCron);
  assert.equal(status, 200);
  assert.ok(ecrits.some((e) => e.table === "hrv_data"), "le décor n'a pas exercé l'écriture de la VFC : le test ne prouverait rien");
  assert.equal(j.results?.[0]?.refus, 1, "le compte rendu du cron (lu dans GitHub Actions) ne compte pas le refus");
  assert.equal(j.refus, 1);
  const journal = auJournal(ecrits);
  assert.equal(journal.length, 1, "le refus de la VFC n'est pas arrivé au journal — rangé parmi les passagers ?");
  assert.equal(journal[0].url, "/api/cron/sync-all");
  assert.match(journal[0].message, /\(VFC\) : 23502 null value in column "hrv_ms"/);
});

await atest("webhook et cron : une synchro sans refus n'écrit RIEN au journal", async () => {
  // CONTRE-POIDS : le garde-fou le plus simple à satisfaire serait de journaliser chaque
  // passage. Un jour mesuré et accepté ne doit produire aucune ligne.
  const canaux: [string, () => Promise<number | undefined>][] = [
    ["webhook", async () => (await appelerWebhook()).j.refus],
    ["cron", async () => (await appelerCron()).j.results?.[0]?.refus],
  ];
  for (const [canal, refusDe] of canaux) {
    const ecrits = banc({ wellness: [NUIT] });
    const { r: refus } = await enSilence(refusDe);
    assert.ok(ecrits.some((e) => e.table === "hrv_data"), `${canal} : le décor n'a rien écrit, le test ne prouverait rien`);
    assert.equal(auJournal(ecrits).length, 0, `${canal} : une synchro sans refus a écrit au journal`);
    assert.equal(refus, 0, `${canal} : un refus est annoncé alors qu'il n'y en a aucun`);
  }
});

await atest("cron : une passerelle qui expire est comptée comme passagère, pas journalisée", async () => {
  const ecrits = banc({ activites: [SORTIE], refus: { workouts: { status: 504, corps: "upstream request timeout" } } });
  const { r: { j } } = await enSilence(appelerCron);
  assert.ok(ecrits.some((e) => e.table === "workouts"), "le décor n'a pas exercé l'écriture de la séance");
  assert.deepEqual([j.results?.[0]?.refus, j.results?.[0]?.passagers], [0, 1]);
  assert.equal(auJournal(ecrits).length, 0, "un incident passager a été journalisé comme un refus");
});

await atest("cron : un journal injoignable ne fait pas tomber le passage", async () => {
  banc({ wellness: [NUIT], refus: { hrv_data: REFUS_VFC }, journalHS: true });
  const { r: { status, j }, sortie } = await enSilence(appelerCron);
  assert.equal(status, 200);
  assert.deepEqual([j.results?.[0]?.ok, j.results?.[0]?.refus], [true, 1]);
  assert.ok(sortie.some((s) => s.startsWith("error:") && /journal non écrit/.test(s)), "l'échec du journal n'est écrit nulle part");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n📨 ALERTES D'intervals.icu — la vraie route, au format réel (16/10/2026)\n");
// ─────────────────────────────────────────────────────────────────────────────
// Jusqu'au 16/10/2026, la route attendait `?secret=` et `athlete_id` à la racine du corps :
// elle n'aurait accepté aucune alerte réelle. Une alerte non acquittée (hors 2xx) est
// RENVOYÉE par intervals.icu : chaque statut ci-dessous est une décision, pas un détail.

await atest("alerte : une séance inédite est importée, PUIS la replanification est demandée", async () => {
  const ecrits = banc({ activites: [SORTIE] });
  const { r: { status, j } } = await enSilence(() => appelerWebhook());
  assert.equal(status, 200);
  assert.ok(ecrits.some((e) => e.methode === "POST" && e.table === "workouts"), "la séance annoncée n'a pas été écrite");
  assert.equal(j.fresh, 1, "la séance inédite n'est pas comptée");
  assert.deepEqual(j.bilans?.map((b) => b.issue), ["synchronisé"]);
  // Le garde-fou des 10 minutes se lit dans `auto_coach_state` : le lire, c'est demander la
  // replanification (après la réponse en production ; ici, hors requête, tout de suite).
  assert.ok(ecrits.lus.some((l) => l.startsWith("notifications") && l.includes("auto_coach_state")), "la replanification n'a pas été demandée");
});

await atest("alerte : un secret faux est refusé (401) sans rien lire ni appeler — et ça se voit dans /admin", async () => {
  const ecrits = banc({ activites: [SORTIE] });
  const { r: { status } } = await enSilence(() => appelerWebhook(livraison([ALERTE_SORTIE], "secret-devine")));
  assert.equal(status, 401);
  assert.deepEqual(ecrits.intervals, [], "intervals.icu a été appelé pour une alerte non authentifiée");
  assert.deepEqual(ecrits.lus, [], "la base a été lue pour une alerte non authentifiée");
  const journal = auJournal(ecrits);
  assert.equal(ecrits.length, journal.length, "une alerte non authentifiée a écrit ailleurs qu'au journal");
  assert.equal(journal.length, 1, "un secret désaccordé entre intervals.icu et Vercel doit se voir dans /admin › Bugs");
  assert.match(journal[0].message, /secret/);
  assert.equal(journal[0].user_id, null);
});

await atest("alerte : sans INTERVALS_WEBHOOK_SECRET, refus en 503 — l'alerte reviendra, elle n'est pas perdue", async () => {
  const ecrits = banc({ activites: [SORTIE] });
  const avant = process.env.INTERVALS_WEBHOOK_SECRET;
  delete process.env.INTERVALS_WEBHOOK_SECRET;
  try {
    const { r: { status } } = await enSilence(() => appelerWebhook());
    assert.equal(status, 503);
    assert.deepEqual([ecrits.length, ecrits.lus.length, ecrits.intervals.length], [0, 0, 0], "une alerte non authentifiable a touché quelque chose");
  } finally { process.env.INTERVALS_WEBHOOK_SECRET = avant; }
});

await atest("alerte : intervals.icu indisponible ou débordé → 503 pour qu'il la renvoie, rien au journal", async () => {
  // 429 est le cas qui prouve qu'on lit le STATUT : « Intervals.icu 429 » ne dit rien de
  // passager à qui ne lirait que le texte, et l'alerte serait acquittée — donc perdue.
  for (const statut of [503, 429]) {
    const ecrits = banc({ activites: [SORTIE], intervalsStatut: statut });
    const { r: { status, j } } = await enSilence(() => appelerWebhook());
    assert.equal(status, 503, `intervals.icu ${statut} : un incident passager acquitté, c'est une séance perdue jusqu'au prochain balayage`);
    assert.deepEqual(j.bilans?.map((b) => b.issue), ["passager"]);
    assert.equal(auJournal(ecrits).length, 0, `intervals.icu ${statut} : un incident passager a été journalisé`);
    assert.ok(!ecrits.lus.some((l) => l.includes("auto_coach_state")), "une synchro en échec a quand même demandé une replanification");
  }
});

await atest("alerte : autorisation retirée (401) → acquittée, mais journalisée", async () => {
  const ecrits = banc({ activites: [SORTIE], intervalsStatut: 401 });
  const { r: { status, j } } = await enSilence(() => appelerWebhook());
  assert.equal(status, 200, "réessayer ne changera rien : l'alerte reviendrait pour rien");
  assert.deepEqual(j.bilans?.map((b) => b.issue), ["refusé"]);
  const journal = auJournal(ecrits);
  assert.equal(journal.length, 1, "un athlète qu'on ne peut plus synchroniser doit se voir dans /admin");
  assert.deepEqual([journal[0].user_id, journal[0].url], ["u-42", "/api/webhooks/intervals"]);
  assert.match(journal[0].message, /Intervals\.icu 401/);
});

await atest("alerte : le calendrier, écrit par Pacevo lui-même, est acquitté sans rien toucher", async () => {
  const ecrits = banc({ activites: [SORTIE] });
  const { r: { status, j } } = await enSilence(() => appelerWebhook(livraison([{ athlete_id: "i1", type: "CALENDAR_UPDATED", events: [], deleted_events: [] }])));
  assert.equal(status, 200);
  assert.deepEqual([ecrits.length, ecrits.lus.length, ecrits.intervals.length], [0, 0, 0], "une alerte de calendrier a relancé quelque chose : boucle possible");
  assert.match(j.raisons?.CALENDAR_UPDATED ?? "", /Pacevo/);
});

await atest("alerte : un athlète sans compte Pacevo est acquitté, sans appel à intervals.icu", async () => {
  const ecrits = banc({ activites: [SORTIE] });
  const { r: { status, j } } = await enSilence(() => appelerWebhook(livraison([{ ...ALERTE_SORTIE, athlete_id: "i999" }])));
  assert.equal(status, 200);
  assert.deepEqual(j.bilans?.map((b) => b.issue), ["inconnu"]);
  assert.deepEqual(ecrits.intervals, []);
});

await atest("alerte : téléversée PUIS analysée dans la même livraison → une seule synchro", async () => {
  const ecrits = banc({ activites: [SORTIE] });
  await enSilence(() => appelerWebhook(livraison([ALERTE_SORTIE, { ...ALERTE_SORTIE, type: "ACTIVITY_ANALYZED" }])));
  // On compte les lectures du BIEN-ÊTRE : la synchro en fait une, et elle seule. La liste des
  // activités, elle, est aussi relue par l'analyse d'allure et par le coach.
  assert.equal(ecrits.intervals.filter((u) => u.includes("/wellness")).length, 1, "deux synchros du même athlète pour une seule livraison");
});

await atest("alerte : une séance déjà écrite par un passage concurrent (23505) n'est ni un refus ni une nouveauté", async () => {
  // L'alerte et le sondage du navigateur peuvent se croiser : l'index unique (user_id,
  // external_id) refuse alors la seconde insertion.
  const DOUBLON = { status: 409, corps: { code: "23505", message: 'duplicate key value violates unique constraint "workouts_user_external_idx"', details: null, hint: null } };
  const ecrits = banc({ activites: [SORTIE], refus: { "POST workouts": DOUBLON } });
  const { r: { status, j } } = await enSilence(() => appelerWebhook());
  assert.equal(status, 200);
  assert.equal(auJournal(ecrits).length, 0, "une course entre deux synchros a été journalisée comme un refus");
  assert.equal(j.fresh, 0, "une séance déjà là a été comptée comme inédite : le plan serait republié deux fois");
  assert.ok(ecrits.some((e) => e.methode === "PATCH" && e.table === "workouts" && /external_id=eq\.i900001/.test(e.filtre)),
    "la ligne existante n'a pas été mise à jour par son identifiant d'origine");
});

await atest("alerte : la séance annoncée est dans la fenêtre demandée, même courue après minuit", async () => {
  // 0 h 30 à Paris = 22 h 30 UTC la veille : la séance porte le jour SUIVANT celui du serveur.
  const ecrits = banc({ activites: [SORTIE] });
  const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const ilYa5j = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
  await enSilence(() => appelerWebhook(livraison([{ ...ALERTE_SORTIE, activity: { id: "i900002", start_date_local: `${ilYa5j}T07:00:00` } }])));
  const demande = ecrits.intervals.find((u) => u.includes("/activities"));
  assert.ok(demande, "intervals.icu n'a pas été interrogé");
  const url = new URL(`https://intervals.icu${demande}`);
  assert.ok((url.searchParams.get("newest") ?? "") >= demain, `borne newest ${url.searchParams.get("newest")} : une sortie après minuit à Paris serait manquée`);
  assert.ok((url.searchParams.get("oldest") ?? "9") <= ilYa5j, `borne oldest ${url.searchParams.get("oldest")} : la séance annoncée (${ilYa5j}) est hors fenêtre`);
});

await atest("alerte : un corps qui n'est pas une livraison est refusé (400) sans rien toucher", async () => {
  for (const corps of ["pas du json", { athlete_id: "i1", event: "activity_updated" }]) {
    const ecrits = banc({ activites: [SORTIE] });
    const { r: { status } } = await enSilence(() => appelerWebhook(corps));
    assert.equal(status, 400, `${JSON.stringify(corps)} accepté`);
    assert.deepEqual([ecrits.length, ecrits.lus.length, ecrits.intervals.length], [0, 0, 0]);
  }
});

globalThis.fetch = vraiFetch;
for (const [k, v] of Object.entries(envAvant)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`   · ${f}`); process.exit(1); }
})();
