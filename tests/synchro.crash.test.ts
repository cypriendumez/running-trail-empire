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
  metriquesMixtesSupportees, pushIntervalsWorkout, buildWorkoutDescription,
} from "../src/lib/watch/intervals";

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
console.log("\n📣 CE QUE LA PAGE PROMET — cinq marques, et rien de plus\n");
// ─────────────────────────────────────────────────────────────────────────────

/** Les pastilles de la page d'accueil, dans l'ordre où elles s'affichent. */
function pastillesLanding(): { nom: string; pousse: boolean; appli: boolean; passerelle: boolean }[] {
  const code = codeSeul("src/app/page.tsx");
  const bloc = code.slice(code.indexOf("const SYNC:"), code.indexOf("export default function LandingPage"));
  return [...bloc.matchAll(/\{\s*nom:\s*"([^"]+)"([^}]*)\}/g)].map((m) => ({
    nom: m[1],
    pousse: /pousse:\s*true/.test(m[2]),
    appli: /appli:\s*true/.test(m[2]),
    passerelle: /passerelle:\s*true/.test(m[2]),
  }));
}

test("la rangée de marques est exactement celle décidée le 23/08/2026", () => {
  // Cinq marques : Garmin, COROS, Suunto (qui reçoivent), Polar et Apple Watch (lecture
  // seule). Wahoo, Amazfit et Huawei restent SERVIS par l'app mais ne sont plus annoncés.
  const pastilles = pastillesLanding().filter((p) => !p.appli).map((p) => p.nom);
  assert.deepEqual(pastilles, ["Garmin", "COROS", "Suunto", "Polar", "Apple Watch"]);
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

test("Polar et Apple ne sont jamais dans la ligne « envoi sur ta montre »", () => {
  // La ligne est DÉRIVÉE de `pousse`, jamais recopiée. Promettre l'envoi à une plateforme
  // qui ne peut pas le recevoir est le pire des deux mensonges possibles.
  const pastilles = pastillesLanding();
  for (const nom of ["Polar", "Apple Watch"]) {
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

test("les cinq langues disent toutes que Polar ne reçoit pas", () => {
  // Une traduction qui oublie la restriction promet à un porteur de Polar une séance qui
  // n'arrivera jamais à son poignet — dans sa langue.
  const dict = readFileSync(join(ROOT, "src/components/landing/landingI18n.ts"), "utf8");
  // ⚠️ ON VISE LA NOTE DE `sync`, PAS TOUTES LES CLÉS `note`. Un `/note:\s*"…"/` global
  // attrapait aussi les cinq `cta.note` — le test rougissait sur des traductions saines,
  // et le réflexe aurait été de l'affaiblir plutôt que de le viser correctement.
  const notes = [...dict.matchAll(/sync:\s*\{[^\n]*?note:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  assert.equal(notes.length, 5, `${notes.length} note(s) de synchronisation trouvée(s), 5 langues attendues`);
  for (const n of notes) {
    assert.match(n, /Polar/, "une note ne mentionne pas Polar");
    assert.match(n, /Apple Watch/, "une note ne mentionne pas l'exception Apple Watch");
    assert.match(n, /intervals\.icu/, "une note ne dit pas par où tout passe");
  }
  // Les marques retirées ne doivent plus apparaître dans aucune traduction.
  for (const n of notes) {
    for (const retiree of ["Wahoo", "Amazfit", "Huawei", "Zepp"]) {
      assert.ok(!n.includes(retiree), `« ${retiree} » subsiste dans une traduction`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🏃 FORMAT DE SÉANCE — ce qui arrive au poignet des cinq marques\n");
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
console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`   · ${f}`); process.exit(1); }
})();
