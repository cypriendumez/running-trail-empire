/**
 * LES ÉCHECS MUETS DU 08/11/2026 — cinq défauts graves d'une même famille.
 *
 * Trouvés par l'agent `chasseur-echecs-muets` sur 15 routes d'écriture, puis relus dans
 * le code. Chaque fois, une opération ratait et personne ne le savait : ni le coureur,
 * ni `error_logs`, ni Cyprien.
 *  · une douleur déclarée au kiné IA était perdue, le kiné répondait comme si elle était
 *    notée, et le coach continuait de prescrire de l'intensité ;
 *  · « M'entraîner pour cette course » avalait l'échec de l'objectif dans un `catch {}`
 *    et répondait `ok` : le plan ne visait pas la course ;
 *  · la synchro de nuit écrasait la VO2max mesurée par `null` et l'historique d'un an
 *    par un seul point, et avalait son erreur (`.then(() => {}, () => {})`) ;
 *  · en mode poids, une panne de lecture des séances devenait « 0 séance » et la cible
 *    calorique sortait trop basse ;
 *  · une pesée dont la mise à jour du profil échouait rendait `profilAJour: false`, que
 *    AUCUN écran ne lisait : le garde-fou précédent ne vérifiait que la moitié serveur.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enregistrerDouleurDeclaree } from "../src/lib/health/douleurDeclaree";
import { journaliserEchec } from "../src/lib/journal/echecServeur";
import { fusionnerMetriquesGarmin, aDesMetriques, POINTS_MAX, type MetriquesGarmin } from "../src/lib/intervals/metriquesGarmin";
import { fetchWorkouts } from "../src/lib/weight/seances";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
/** Un test asynchrone a besoin d'un harnais qui l'ATTEND (voir tests/ecritures.test.ts). */
const enAttente: Promise<void>[] = [];
function testAsync(nom: string, fn: () => Promise<void>) {
  enAttente.push(fn().then(
    () => { passed++; console.log(`  OK ${nom}`); },
    (e: Error) => { fails.push(`${nom} — ${e.message}`); console.log(`  ✗ ${nom}`); },
  ));
}

/** Sans commentaires : une explication qui décrit le défaut n'est pas le correctif. */
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

// ── Un faux client Supabase qui RETOURNE ses erreurs, comme le vrai ─────────────
type Rep = { data?: unknown; error?: { message: string; code?: string } | null };
type Op = { table: string; action: "select" | "insert" | "update" | "upsert" | "delete"; valeur?: unknown };
function fauxClient(repondre: (op: Op) => Rep | "lever") {
  const ops: Op[] = [];
  const client = {
    from(table: string) {
      const op: Op = { table, action: "select" };
      const b: Record<string, unknown> = {};
      const chaine = () => b;
      for (const m of ["eq", "gte", "lte", "in", "limit", "order", "maybeSingle", "single", "neq"]) b[m] = chaine;
      b.select = () => b;
      for (const a of ["insert", "update", "upsert", "delete"] as const) b[a] = (v?: unknown) => { op.action = a; op.valeur = v; return b; };
      b.then = (ok: (r: Rep) => unknown, ko?: (e: unknown) => unknown) => {
        ops.push({ ...op });
        const r = repondre(op);
        if (r === "lever") return Promise.reject(new Error("coupure réseau simulée")).then(ok, ko);
        return Promise.resolve({ data: null, error: null, ...r }).then(ok, ko);
      };
      return b;
    },
  };
  return { client: client as unknown as SupabaseClient, ops };
}
const auJournal = (ops: Op[]) => ops.filter((o) => o.table === "error_logs" && o.action === "insert")
  .map((o) => o.valeur as { source: string; message: string; user_id: string | null });

const DECL = { userId: "u1", zone: "Genou gauche", zoneKey: "face:kneeL", painLevel: 6, today: "2026-11-08" };

// ── 1. La douleur déclarée au kiné IA ───────────────────────────────────────────
testAsync("une douleur refusée par la base est dite PERDUE, et journalisée sans donnée de santé", async () => {
  const { client, ops } = fauxClient((op) =>
    op.table === "notifications" && op.action === "insert" ? { error: { message: "permission denied", code: "42501" } } : { data: [] });
  const notee = await enregistrerDouleurDeclaree(client, DECL, client);
  assert.equal(notee, false, "une douleur refusée est annoncée comme notée");
  const j = auJournal(ops);
  assert.equal(j.length, 1, "l'échec n'atteint pas error_logs");
  assert.equal(j[0].source, "douleur");
  assert.match(j[0].message, /42501/, "la cause de la base n'est pas dans le journal");
  assert.ok(!/Genou|6\/10|kneeL/.test(j[0].message), "la zone ou l'intensité (donnée de santé) part dans le journal");
});

testAsync("une lecture en échec n'est pas « pas encore déclarée » : rien n'est inséré", async () => {
  const { client, ops } = fauxClient((op) =>
    op.table === "notifications" && op.action === "select" ? { error: { message: "upstream connect error" } } : {});
  const notee = await enregistrerDouleurDeclaree(client, DECL, client);
  assert.equal(notee, false);
  assert.ok(!ops.some((o) => o.table === "notifications" && o.action === "insert"), "un doublon est inséré sur une lecture ratée");
  assert.equal(auJournal(ops).length, 1, "la lecture ratée n'est pas journalisée");
});

testAsync("une coupure qui LÈVE ne fait pas tomber le kiné et se journalise", async () => {
  const { client, ops } = fauxClient((op) => (op.table === "notifications" ? "lever" : {}));
  assert.equal(await enregistrerDouleurDeclaree(client, DECL, client), false);
  assert.equal(auJournal(ops).length, 1);
});

testAsync("une douleur enregistrée, ou déjà notée aujourd'hui, est dite notée", async () => {
  const neuf = fauxClient(() => ({ data: [] }));
  assert.equal(await enregistrerDouleurDeclaree(neuf.client, DECL, neuf.client), true);
  assert.equal(neuf.ops.filter((o) => o.action === "insert" && o.table === "notifications").length, 1, "la douleur n'est pas insérée");
  assert.equal(auJournal(neuf.ops).length, 0, "un succès remplit le journal");
  const deja = fauxClient((op) => (op.action === "select" ? { data: [{ id: 1, data: { slot: "face:kneeL" } }] } : {}));
  assert.equal(await enregistrerDouleurDeclaree(deja.client, DECL, deja.client), true);
  assert.ok(!deja.ops.some((o) => o.action === "insert"), "la même zone est déclarée deux fois le même jour");
});

test("la déclaration d'une douleur transmet son issue, et l'écran la dit", () => {
  // La consultation du kiné IA est retirée (09/11/2026) : la douleur se déclare sans IA.
  const route = codeNu("src/app/api/health/declarer/route.ts");
  assert.match(route, /const ok = await enregistrerDouleurDeclaree\(/, "la route n'appelle plus l'enregistrement qui rend son issue");
  assert.match(route, /if \(!ok\) return NextResponse\.json\([\s\S]{0,120}status: 503/, "une douleur perdue n'est pas renvoyée comme un échec");
  const ecran = codeNu("src/components/health/HealthCenter.tsx");
  assert.match(ecran, /if \(r\.ok\) \{ toast\.success\(tr\("k\.declOk"\)\); router\.refresh\(\); \} else toast\.error\(tr\("k\.declErr"\)\);/, "l'écran Santé ne dit pas qu'une douleur est perdue");
});

// ── 2. L'objectif de « M'entraîner pour cette course » ──────────────────────────
test("l'échec de l'objectif de course est journalisé, renvoyé et affiché", () => {
  const route = codeNu("src/app/api/calendar-entry/route.ts");
  const post = route.slice(route.indexOf("export async function POST"), route.indexOf("export async function PATCH"));
  assert.ok(!/catch\s*\{\s*\}/.test(post), "un `catch` vide avale encore l'échec de l'objectif");
  assert.match(post, /catch\s*\(e\)\s*\{\s*await\s+echec\(/, "l'exception de setRaceObjective n'est plus traitée comme un échec");
  assert.match(post, /if\s*\(eObjectif\)\s*await\s+echec\(/, "une lecture ratée de l'objectif repasse en silence");
  assert.match(post, /journaliserEchec\(admin,/, "l'échec n'atteint pas error_logs");
  assert.match(post, /NextResponse\.json\(\{ ok: true, id: data\?\.id, objectifPose \}\)/, "l'issue n'est pas renvoyée");
  for (const [f, cle] of [["src/components/training/CalendarView.tsx", 't\\("cal\\.toast\\.objectifRate"\\)'], ["src/components/races/RacesHub.tsx", 'd\\["t\\.objectifRate"\\]']]) {
    assert.match(codeNu(f), new RegExp(`j\\.objectifPose === false\\)\\s*toast\\.error\\(${cle}\\)`), `${f} annonce « ton coach en tiendra compte » sur un objectif raté`);
  }
});

// ── 3. Les métriques de la montre ───────────────────────────────────────────────
const vides = (o: Partial<MetriquesGarmin> = {}): MetriquesGarmin => ({
  vo2max: null, restingHR: null, lthr: null, maxHR: null, thresholdPaceSecPerKm: null,
  ctl: null, atl: null, rampRate: null, vo2maxHistory: [], updatedAt: "2026-11-08T05:00:00Z", ...o,
});

test("une fenêtre d'un jour sans VO2max ne l'efface pas, ni sa courbe", () => {
  const enBase = vides({ vo2max: 54.2, restingHR: 48, vo2maxHistory: Array.from({ length: 90 }, (_, i) => ({ date: `2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, "0")}`, v: 52 + i / 100 })) });
  const nuit = vides({ restingHR: 46, ctl: 61, vo2maxHistory: [] });
  const f = fusionnerMetriquesGarmin(enBase, nuit);
  assert.equal(f.vo2max, 54.2, "la VO2max mesurée est écrasée par l'absence de mesure");
  assert.equal(f.restingHR, 46, "une valeur nouvelle ne remplace pas l'ancienne");
  assert.equal(f.ctl, 61);
  assert.equal(f.vo2maxHistory.length, 90, `la courbe passe de 90 à ${f.vo2maxHistory.length} points`);
  assert.equal(f.updatedAt, nuit.updatedAt);
});

test("l'historique fusionne par date, la mesure nouvelle l'emporte, borné et trié", () => {
  const ancien = { vo2maxHistory: [{ date: "2026-11-01", v: 53 }, { date: "2026-11-05", v: 53.5 }, { date: "x", v: "abîmé" }, null] };
  const f = fusionnerMetriquesGarmin(ancien, vides({ vo2max: 54, vo2maxHistory: [{ date: "2026-11-05", v: 54 }, { date: "2026-11-07", v: 54.1 }] }));
  assert.deepEqual(f.vo2maxHistory, [{ date: "2026-11-01", v: 53 }, { date: "2026-11-05", v: 54 }, { date: "2026-11-07", v: 54.1 }]);
  const long = Array.from({ length: 200 }, (_, i) => ({ date: `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`, v: 50 }));
  const g = fusionnerMetriquesGarmin({ vo2maxHistory: long }, vides());
  assert.equal(g.vo2maxHistory.length, POINTS_MAX);
  assert.equal(g.vo2maxHistory.at(-1)!.date, long.at(-1)!.date, "ce sont les points ANCIENS qui doivent tomber");
  assert.equal(aDesMetriques(vides()), false, "une fenêtre vide réécrirait le profil");
  assert.equal(fusionnerMetriquesGarmin(null, vides({ ctl: 3 })).vo2max, null, "sans existant, rien n'est inventé");
});

test("la synchro serveur fusionne et n'avale plus ses erreurs", () => {
  const src = codeNu("src/lib/intervals/syncUser.ts");
  assert.ok(!/\.then\(\s*\(\)\s*=>\s*\{\s*\}\s*,\s*\(\)\s*=>\s*\{\s*\}\s*\)/.test(src), "une écriture avale encore son erreur");
  assert.match(src, /fusionnerMetriquesGarmin\(/, "la synchro serveur écrase de nouveau les métriques");
  assert.ok(!/update\(\{\s*garmin_vo2max:[^}]*garmin_metrics/.test(src), "les deux colonnes ajoutées à la main repartent dans le même update");
  for (const e of ["eLecture", "eVo2", "eMetriques"]) {
    assert.match(src, new RegExp(`if \\(${e}\\)[\\s\\S]{0,40}failures\\.push`), `l'erreur ${e} n'atteint pas failures (donc pas error_logs)`);
  }
  const nav = codeNu("src/app/api/intervals/sync/route.ts");
  assert.match(nav, /fusionnerMetriquesGarmin\(/, "la route du navigateur écrase de nouveau les métriques");
  assert.equal([...nav.matchAll(/from\("profiles"\)\.update\(\{ garmin_(vo2max|metrics)[\s\S]{0,140}?syncErrors\.push/g)].length, 2,
    "une écriture des métriques de la montre ne lit pas son erreur");
});

// ── 4 et 5. Le mode poids ───────────────────────────────────────────────────────
testAsync("une panne de lecture des séances n'est pas « 0 séance »", async () => {
  const panne = fauxClient(() => ({ error: { message: "upstream connect error" } }));
  assert.equal(await fetchWorkouts(panne.client, "u1"), null, "une panne devient une liste vide, et la cible calorique sort fausse");
  let n = 0;
  const repli = fauxClient(() => (n++ === 0 ? { error: { message: "column sport does not exist", code: "42703" } } : { data: [{ date: "2026-11-07" }] }));
  assert.deepEqual(await fetchWorkouts(repli.client, "u1"), [{ date: "2026-11-07" }], "le repli sans `sport` ne rend plus les séances");
  const rien = fauxClient(() => ({ data: [] }));
  assert.deepEqual(await fetchWorkouts(rien.client, "u1"), [], "zéro séance réelle n'est plus zéro");
});

test("la route poids ne calcule rien sur des séances illisibles, et l'écran le dit", () => {
  const route = codeNu("src/app/api/weight/route.ts");
  const iLecture = route.indexOf("await fetchWorkouts(");
  const iPlan = route.indexOf("buildWeightPlan(", iLecture);
  assert.ok(iLecture > 0 && iPlan > iLecture, "la lecture des séances a disparu");
  assert.match(route.slice(iLecture, iPlan), /if \(workouts == null\)[\s\S]{0,420}return illisible\("seances_illisibles"\)/, "un plan est calculé sans séances lisibles");
  assert.match(route, /const illisible = [\s\S]{0,160}status: 503/, "une lecture ratée ne répond plus 503");
  assert.match(route.slice(iLecture, iPlan), /if \(workouts == null\) \{[\s\S]{0,120}await journaliserEchec\(/, "une panne qui dure ne se verrait jamais dans /admin › Bugs");
  const ecran = codeNu("src/components/health/WeightMode.tsx");
  assert.match(ecran, /seances_illisibles: "err\.seances", pesees_illisibles: "err\.pesees", profil_illisible: "err\.profil"/, "l'écran affiche une clé brute");
  assert.equal([...ecran.matchAll(/toast\.error\(messageErreur\(json\.error\)\)/g)].length, 2, "une lecture de /api/weight affiche encore la clé brute");
});

test("une pesée dont le profil n'est pas mis à jour se voit à l'écran et au journal", () => {
  const route = codeNu("src/app/api/weight/route.ts");
  assert.match(route, /if \(eProfil\) \{\s*profilAJour = false;\s*await journaliserEchec\(/, "l'échec ne part que dans la console");
  assert.match(codeNu("src/components/health/WeightMode.tsx"), /json\.profilAJour === false\)\s*toast\.error\(tr\("warn\.profil"\)\)/,
    "AUCUN écran ne lit `profilAJour` : « Pesée enregistrée » cache des zones calculées sur l'ancien poids");
});

// ── Le journal lui-même ─────────────────────────────────────────────────────────
testAsync("le journal d'un échec ne fait jamais tomber la route", async () => {
  const refuse = fauxClient(() => ({ error: { message: "permission denied for table error_logs" } }));
  await journaliserEchec(refuse.client, { source: "un-nom-de-source-bien-trop-long", message: "x" });
  assert.equal(auJournal(refuse.ops)[0].source.length, 24, "la source dépasse la colonne");
  const coupe = fauxClient(() => "lever");
  await journaliserEchec(coupe.client, { source: "kine", message: "x" }); // ne doit pas lever
});

// ── Deuxième passe du 08/11/2026 : les 13 défauts moyens et faibles ─────────────
test("la montre branchée ne devient pas « non configurée » sur une panne", () => {
  const statut = codeNu("src/app/api/intervals/status/route.ts");
  assert.match(statut, /const \{ data: profile, error \} = await supabase[\s\S]{0,200}if \(error\) return NextResponse\.json\(\{ error: "statut_illisible" \}, \{ status: 503 \}\)/,
    "une lecture ratée du profil répond encore « non configuré »");
  const auto = codeNu("src/components/AutoSync.tsx");
  assert.match(auto, /if \(r\.ok\) configured\.current = /, "AutoSync met en cache une réponse ratée");
  assert.ok(!/configured\.current = false/.test(auto), "une coupure arrête encore AutoSync pour toute la visite");
  const page = codeNu("src/app/dashboard/sync/page.tsx");
  assert.ok(!/\.catch\(\(\) => setConfigured\(false\)\)/.test(page), "l'onglet Sync affiche « Non configuré » sur une panne");
  assert.match(page, /if \(!r\.ok\) throw/, "l'onglet Sync lit une réponse ratée comme une réponse");
  const sync = codeNu("src/app/api/intervals/sync/route.ts");
  assert.match(sync, /if \(eProfil\) return NextResponse\.json\([\s\S]{0,80}status: 503/, "la route de synchro répond « pas de montre » sur une panne");
});

test("la synchro du navigateur ne crée pas de doublons, dit chaque refus et les journalise", () => {
  const sync = codeNu("src/app/api/intervals/sync/route.ts");
  assert.match(sync, /if \(repli\.error\) return NextResponse\.json\([\s\S]{0,100}status: 503/, "des séances en base illisibles font tout réinsérer");
  assert.match(sync, /\.update\(payload\)\.eq\("id", id\)[\s\S]{0,120}else syncErrors\.push\(/, "le refus d'une mise à jour de séance disparaît");
  assert.match(sync, /if \(!wellnessRes\.ok\) syncErrors\.push\(/, "un bien-être refusé passe pour « aucune mesure »");
  assert.match(sync, /journaliserRefus\(admin, \{ userId: user\.id, canal: "navigateur", failures: syncErrors \}\)/, "les refus de la synchro du navigateur n'atteignent pas error_logs");
  assert.match(codeNu("src/lib/intervals/refusSynchro.ts"), /navigateur: "\/api\/intervals\/sync"/);
  assert.match(codeNu("src/lib/intervals/syncUser.ts"), /if \(!wellnessRes\.ok\) failures\.push\(/, "la synchro serveur tait un bien-être refusé");
});

// (09/11/2026) « une mémoire de consultation illisible n'est pas dupliquée » : test retiré avec la consultation du « kiné IA », supprimée (lib/health/kineIa).

test("mode poids : pesées illisibles, panne du profil et garde-fou de l'IMC", () => {
  const route = codeNu("src/app/api/weight/route.ts");
  assert.match(route, /if \(full\.error\.code !== "42703"\) return \{ profile: null, migrated: true, panne: true \}/, "une panne passagère passe pour une migration en retard");
  assert.match(route, /if \(migrated && logs == null\) \{[\s\S]{0,200}return illisible\("pesees_illisibles"\)/, "des pesées illisibles s'affichent « aucune pesée »");
  // Le garde-fou de l'IMC 20 lit la taille : sans profil lisible, il ne doit pas être sauté.
  const iGarde = route.indexOf("const h = profile?.height_cm");
  assert.ok(iGarde > 0, "le garde-fou de l'IMC a disparu");
  assert.match(route.slice(iGarde - 260, iGarde), /if \(panne\) return illisible\("profil_illisible"\)/, "une panne saute le garde-fou de l'IMC 20");
  assert.equal([...route.matchAll(/if \(panne\) return illisible\("profil_illisible"\)/g)].length, 3, "une lecture du profil prend encore une panne pour « introuvable »");
});

test("un nouveau plan refusé ne laisse pas un calendrier vide", () => {
  const src = codeNu("src/lib/ai/autoCoach.ts");
  const i = src.indexOf('const { error } = await admin.from("notifications").insert(rows);');
  assert.ok(i > 0, "l'écriture du plan a changé de forme");
  const suite = src.slice(i, i + 1200);
  // Le retour arrière doit être DANS la branche d'échec, avant son `return` : ailleurs il
  // réinsérerait l'ancien plan à côté du nouveau, et la montre recevrait des doublons.
  const branche = suite.slice(suite.indexOf("if (error) {"), suite.indexOf("return { processed: false, reason: error.message };"));
  assert.ok(suite.indexOf("if (error) {") >= 0 && branche.length > 0, "la branche d'échec du nouveau plan a changé de forme");
  assert.match(branche, /if \(lignesAvant\?\.length\) \{\s*const \{ error: eRetour \} = await admin\.from\("notifications"\)\.insert\(lignesAvant\.map\(/, "le plan précédent n'est pas remis après un refus");
  assert.match(suite, /journaliserEchec\(admin,/, "le refus du nouveau plan n'est pas journalisé");
  assert.match(src, /if \(ePurge\) \{[\s\S]{0,200}journaliserEchec\(admin,/, "la purge ratée n'est pas journalisée");
});

test("l'analyse de séance n'analyse pas à l'aveugle, et ses coûts cachés se voient", () => {
  const src = codeNu("src/app/api/ai/analyse-seance/route.ts");
  assert.match(src, /if \(eCache \|\| eAcces\) \{[\s\S]{0,400}status: 503/, "un abonné Premium reçoit l'analyse essentielle sur une panne");
  assert.match(src, /const eRepere = profilRes\.error \?\? baseRes\.error \?\? compRes\.error \?\? prescritRes\.error \?\? objRes\.error \?\? picRes\.error;\s*if \(eRepere\) \{[\s\S]{0,400}status: 503/,
    "la FC max de référence illisible devient le pic de cette seule sortie");
  assert.match(src, /if \(eIns\) \{[\s\S]{0,200}journaliserEchec\(/, "une analyse non mémorisée (quota repayé) reste invisible");
  assert.match(codeNu("src/app/api/ai/session/route.ts"), /if \(eCache\) \{[\s\S]{0,200}journaliserEchec\(/, "un cache de séance IA non écrit (quota repayé) reste invisible");
});

test("une paire cochée qui ne reçoit pas ses kilomètres se dit", () => {
  const src = codeNu("src/app/api/feedback/route.ts");
  assert.match(src, /if \(paireCochee && !\(seance && Number\.isFinite\(km\) && km > 0\)\) chaussureErreur = true;/, "une séance introuvable laisse croire que la paire est créditée");
  assert.match(src, /if \(chaussureErreur\) \{[\s\S]{0,160}journaliserEchec\(admin,/, "le refus du kilométrage n'atteint pas error_logs");
});

testAsync("une VMA illisible n'est pas une VMA inconnue", async () => {
  const { getEffectiveVma } = await import("../src/lib/ai/coachContext");
  const panne = fauxClient((op) => (op.table === "performance_baselines" ? { error: { message: "upstream connect error" } } : { data: null }));
  await assert.rejects(getEffectiveVma(panne.client, "u1"), /VMA illisible/, "une panne rend encore « pas de VMA »");
  const vide = fauxClient(() => ({ data: null }));
  assert.equal(await getEffectiveVma(vide.client, "u1"), null, "sans aucune donnée, la VMA doit rester inconnue, pas inventée");
});

// ── Relecture de la deuxième passe : boucle de réessai et bruit du journal ───────
testAsync("le canal navigateur n'écrit une même cause qu'une fois par fenêtre", async () => {
  const { journaliserRefus } = await import("../src/lib/intervals/refusSynchro");
  const ligne = "2026-11-07 « Footing » : 22P02 invalid input syntax";
  const message = "Écriture refusée à la synchro (séance) : 22P02 invalid input syntax";
  const deja = fauxClient((op) => (op.table === "error_logs" && op.action === "select" ? { data: [{ message }] } : {}));
  await journaliserRefus(deja.client, { userId: "u1", canal: "navigateur", failures: [ligne] });
  assert.equal(auJournal(deja.ops).length, 0, "le même refus se réécrit à chaque passage d'AutoSync (toutes les 2 min)");
  const neuf = fauxClient((op) => (op.action === "select" ? { data: [] } : {}));
  await journaliserRefus(neuf.client, { userId: "u1", canal: "navigateur", failures: [ligne] });
  assert.equal(auJournal(neuf.ops).length, 1, "un refus nouveau n'est plus journalisé");
  const aveugle = fauxClient((op) => (op.action === "select" ? { error: { message: "timeout" } } : {}));
  await journaliserRefus(aveugle.client, { userId: "u1", canal: "navigateur", failures: [ligne] });
  assert.equal(auJournal(aveugle.ops).length, 1, "une lecture ratée du journal fait taire le refus");
  const cron = fauxClient((op) => (op.action === "select" ? { data: [{ message }] } : {}));
  await journaliserRefus(cron.client, { userId: "u1", canal: "cron", failures: [ligne] });
  assert.equal(auJournal(cron.ops).length, 1, "le cron ne journalise plus à chaque passage");
});

test("l'onglet Sync dit « illisible » sur une panne, sans réessai qui survive à la page", () => {
  const page = codeNu("src/app/dashboard/sync/page.tsx");
  const i = page.indexOf("function checkStatus()");
  assert.ok(i > 0, "checkStatus a changé de forme");
  const corps = page.slice(i, page.indexOf("useEffect(() => () => { generationStatut.current++; }, []);", i) + 70);
  // Trois relectures ont trouvé un minuteur qui survivait : il n'y en a plus du tout.
  assert.ok(!/setTimeout|setInterval/.test(corps), "un réessai automatique est revenu (minuteur orphelin, Strict Mode, appels en vol)");
  assert.match(corps, /const g = \+\+generationStatut\.current;/, "un appel n'invalide plus les réponses précédentes");
  assert.match(corps, /const d = await r\.json\(\);\s*if \(g !== generationStatut\.current\) return;/, "une vieille réponse écrase encore la nouvelle");
  assert.match(corps, /\.catch\(\(\) => \{\s*if \(g !== generationStatut\.current\) return;\s*setConfigured\(null\); setStatutIllisible\(true\);/, "une panne s'affiche « Non configuré », ou un vieil échec efface un succès");
  assert.match(corps, /useEffect\(\(\) => \(\) => \{ generationStatut\.current\+\+; \}, \[\]\)/, "une réponse arrivée après le démontage touche encore l'état");
  assert.match(page, /statutIllisible \? d\["st\.illisible"\] : d\["st\.checking"\]/, "un statut illisible reste « Vérification… » pour toujours");
  const i18n = readFileSync("src/app/dashboard/sync/syncI18n.tsx", "utf8");
  assert.equal(i18n.split('"st.illisible":').length - 1, 5, "le message manque dans une langue");
});

test("une panne de la synchro ne montre pas le message brut de la base", () => {
  const sync = codeNu("src/app/api/intervals/sync/route.ts");
  for (const e of ["eProfil", "repli.error"]) {
    const m = new RegExp(`if \\(${e.replace(".", "\\.")}\\) return NextResponse\\.json\\(\\{ error: ([^}]+) \\}`).exec(sync);
    assert.ok(m, `la réponse de ${e} a changé de forme`);
    assert.ok(!/\.message/.test(m![1]), `${e} renvoie le message brut de la base à l'écran`);
  }
});

Promise.all(enAttente).then(() => {
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
});
