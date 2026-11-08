/**
 * LE PANNEAU DE NOTIFICATIONS N'AFFICHE QUE DES NOUVELLES, ET LES REGROUPE.
 *
 * Mesuré en base le 21/09/2026 : 123 lignes `coach_session`, 26 `session_feedback`, 22
 * analyses, 5 états du coach — pour 2 vrais messages. Le panneau listait les 20 dernières
 * lignes telles quelles : Cyprien recevait son propre ressenti (« RPE 6/10 ») comme une
 * notification, et sept « nouvelles » à chaque republication du plan.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { construirePanneau, sansMasquees, ajouterMasquee, TYPES_NOTIFIES, MASQUEES_MAX, type LigneNotification } from "../src/lib/notifications/panneau";
import { planModifie, reecritureLue, type SeanceEcrite } from "../src/lib/coach/planNotifie";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const L = (id: string, type: string, title: string, at: string, read = false): LigneNotification =>
  ({ id, type, title, body: null, read, created_at: at });
const libelles = { planMaj: "Plan mis à jour", seances: (n: number) => `${n} séance${n > 1 ? "s" : ""}` };

// Ce qu'il y avait en base ce jour-là, en miniature.
const BASE: LigneNotification[] = [
  L("f1", "session_feedback", "Ressenti séance", "2026-09-21T08:00:00Z"),
  L("s1", "coach_session", "Allure spécifique objectif", "2026-09-21T07:10:00Z"),
  L("s2", "coach_session", "Footing + lignes droites", "2026-09-21T07:10:01Z"),
  L("s3", "coach_session", "Sortie longue avec bloc spécifique", "2026-09-21T07:10:02Z"),
  L("s4", "coach_session", "Repos", "2026-09-21T07:10:03Z"),
  L("s5", "coach_session", "Footing", "2026-09-21T07:10:04Z"),
  L("a1", "auto_coach_state", "auto-coach", "2026-09-21T07:09:00Z"),
  L("q1", "ai_quota", "quota ia", "2026-09-21T06:00:00Z"),
  L("an1", "session_ai_analysis", "Analyse séance 2026-09-20", "2026-09-20T19:00:00Z"),
  L("m1", "coach_message", "Réponse du coach", "2026-09-20T12:00:00Z", true),
  L("s9", "coach_session", "Footing", "2026-09-14T07:00:00Z", true),
  L("u1", "user_settings", "Préférences", "2026-09-01T00:00:00Z"),
];

console.log("\n=== PANNEAU DE NOTIFICATIONS ===\n");

test("le ressenti saisi par l'athlète, l'état du coach, les quotas, les réglages : jamais notifiés", () => {
  for (const t of ["session_feedback", "auto_coach_state", "ai_quota", "user_settings", "race_objective", "pps_status", "support_qa", "athlete_message_sent"]) {
    assert.ok(!TYPES_NOTIFIES.has(t), `« ${t} » serait notifié — ce n'est pas une nouvelle pour la personne`);
  }
  const e = construirePanneau(BASE, libelles);
  assert.ok(!e.some((x) => /Ressenti|auto-coach|quota|Préférences/.test(x.titre)), "du bruit interne passe dans le panneau");
});

test("sept séances du même jour = UNE entrée « Plan mis à jour », qui les nomme", () => {
  const e = construirePanneau(BASE, libelles);
  const plans = e.filter((x) => x.type === "plan");
  // 06/11/2026 : seule la DERNIÈRE mise à jour du plan. Le regroupement du 14/09 n'est
  // qu'un reste (la republication suivante a effacé ses séances à venir).
  assert.equal(plans.length, 1, `${plans.length} entrée(s) plan, 1 attendue (la dernière mise à jour)`);
  const du21 = plans.find((p) => p.cle === "plan:2026-09-21")!;
  assert.ok(du21, "le regroupement du 21/09 manque");
  assert.equal(du21.titre, "Plan mis à jour");
  assert.match(du21.corps ?? "", /^5 séances — Allure spécifique objectif · Footing \+ lignes droites · Sortie longue avec bloc spécifique · \+2$/);
  assert.equal(du21.lue, false, "une seule séance non lue suffit à marquer l'entrée non lue");
  assert.equal(du21.at, "2026-09-21T07:10:04Z", "l'heure de l'entrée n'est pas celle de la séance la plus récente");
  assert.ok(!plans.some((p) => p.cle === "plan:2026-09-14"), "un reste tronqué d'une ancienne mise à jour est encore annoncé");
});

test("les séances citées suivent l'ordre des jours, pas celui de l'écriture", () => {
  // Constaté le 06/11/2026 : « Repos · Séance au seuil (reprise) · Renforcement… » — le
  // repos du 12/11 cité en premier, la séance du jour même absente.
  const ecrit = "2026-11-06T04:13:59Z";
  const lignes: LigneNotification[] = [
    { ...L("p7", "coach_session", "Repos", ecrit), date: "2026-11-12" },
    { ...L("p5", "coach_session", "Séance au seuil (reprise)", ecrit), date: "2026-11-10" },
    { ...L("p1", "coach_session", "Footing en endurance", ecrit), date: "2026-11-06" },
    { ...L("p3", "coach_session", "Sortie longue", ecrit), date: "2026-11-08" },
    { ...L("p2", "coach_session", "Repos", ecrit), date: "2026-11-07" },
  ];
  const plan = construirePanneau(lignes, libelles).find((x) => x.type === "plan")!;
  assert.equal(plan.corps, "5 séances — Footing en endurance · Repos · Sortie longue · +2");
  assert.match(codeNu("src/app/api/notifications/route.ts"), /\.select\("id, type, title, body, read, created_at, date:data->>date"\)/,
    "la route ne lit plus le jour des séances : le panneau les cite dans le désordre");
});

test("le panneau est trié du plus récent au plus ancien et plafonné", () => {
  const e = construirePanneau(BASE, libelles);
  assert.deepEqual(e.map((x) => x.cle), ["plan:2026-09-21", "an1", "m1"]);
  const beaucoup = Array.from({ length: 40 }, (_, i) => L(`m${i}`, "coach_message", `Message ${i}`, `2026-08-${String(1 + (i % 28)).padStart(2, "0")}T10:00:00Z`));
  assert.equal(construirePanneau(beaucoup, libelles).length, 10, "le panneau n'est plus plafonné à 10 entrées");
});

test("une croix écarte l'entrée, et la liste des écartées reste bornée", () => {
  const e = construirePanneau(BASE, libelles);
  const apres = sansMasquees(e, ["plan:2026-09-21", "m1"]);
  assert.deepEqual(apres.map((x) => x.cle), ["an1"]);
  let m: string[] = [];
  for (let i = 0; i < MASQUEES_MAX + 20; i++) m = ajouterMasquee(m, `k${i}`);
  assert.equal(m.length, MASQUEES_MAX, "la liste des écartées grossit sans fin");
  assert.equal(m.at(-1), `k${MASQUEES_MAX + 19}`, "ce sont les plus anciennes qui doivent sortir, pas les plus récentes");
  assert.deepEqual(ajouterMasquee(["a", "b"], "a"), ["b", "a"], "une clé déjà présente est dupliquée");
});

test("la barre lit la liste blanche en base, mémorise les croix côté serveur et lit l'erreur", () => {
  const src = codeNu("src/components/layout/TopBar.tsx");
  // Depuis le 22/09/2026 la requête vit dans /api/notifications (l'entête n'embarque
  // plus le client Supabase, ≈ 220 kB) ; la liste blanche s'applique LÀ.
  assert.match(src, /fetch\("\/api\/notifications"\)/, "l'entête ne lit plus /api/notifications");
  assert.match(codeNu("src/app/api/notifications/route.ts"), /\.in\("type", \[\.\.\.TYPES_NOTIFIES\]\)/, "la requête ne filtre plus sur la liste blanche : la table entière revient dans le panneau");
  assert.match(src, /sansMasquees\(\s*construirePanneau\(notifs/, "le panneau n'est plus construit par le module pur");
  assert.match(src, /body: JSON\.stringify\(\{ notifsMasquees: apres \}\)/, "la croix n'est plus mémorisée dans les réglages");
  assert.match(src, /if \(!r\.ok\) setMasquees\(avant\)/, "un échec d'enregistrement laisserait l'entrée masquée jusqu'au prochain rechargement");
  assert.match(src, /aria-label=\{t\("topbar\.dismiss"\)\}/, "la croix par entrée a disparu (ou n'a plus de nom accessible)");
  assert.match(src, /aria-label=\{t\("topbar\.close"\)\}/, "la croix de fermeture du panneau a disparu");
  // Sur téléphone : une feuille pleine largeur sous la barre, pas un menu de 320 px.
  assert.match(src, /fixed inset-x-3 top-\[4\.5rem\] z-50[^"]*sm:absolute[^"]*sm:w-80/, "le panneau n'a plus sa mise en page téléphone");
  assert.match(codeNu("src/app/api/settings/route.ts"), /Array\.isArray\(body\.notifsMasquees\)/, "/api/settings n'accepte plus notifsMasquees");
  const i18n = readFileSync("src/lib/i18n/translations.ts", "utf8");
  for (const k of ["topbar.planMaj", "topbar.seance1", "topbar.seanceN", "topbar.close", "topbar.dismiss"]) {
    assert.equal([...i18n.matchAll(new RegExp(`"${k.replace(/\./g, "\\.")}"\\s*:`, "g"))].length, 5, `« ${k} » manque à une langue`);
  }
});

console.log("\n=== LE PLAN RÉÉCRIT N'EST PAS FORCÉMENT MODIFIÉ ===\n");

// Le plan de Cyprien, écrit le 05/11 (05→11/11) puis réécrit le 06/11 (06→12/11).
const S = (date: string, title: string, read = true): SeanceEcrite => ({ date, title, body: `${title} — détail`, read });
const HIER = [S("2026-11-06", "Footing"), S("2026-11-07", "Repos"), S("2026-11-08", "Sortie longue"), S("2026-11-09", "Repos complet"), S("2026-11-10", "Seuil"), S("2026-11-11", "Renfo")];
const NUIT = [...HIER.map((x) => ({ ...x, read: undefined })), S("2026-11-12", "Repos")];

test("le jour qui entre au bout de la fenêtre n'est pas une modification", () => {
  assert.equal(planModifie(HIER, NUIT), false, "chaque nuit, le 7e jour fait annoncer « Plan mis à jour »");
  assert.equal(reecritureLue(HIER, NUIT), true);
});

test("une séance changée, ajoutée ou retirée dans les jours communs est annoncée", () => {
  const change = NUIT.map((x) => (x.date === "2026-11-10" ? { ...x, title: "VMA" } : x));
  assert.equal(planModifie(HIER, change), true, "une séance remplacée passe sous silence");
  assert.equal(planModifie(HIER, NUIT.filter((x) => x.date !== "2026-11-08")), true, "une séance retirée passe sous silence");
  assert.equal(planModifie(HIER, [...NUIT, { ...S("2026-11-09", "Footing du matin"), moment: "matin" }]), true, "une séance ajoutée passe sous silence");
  const detail = NUIT.map((x) => (x.date === "2026-11-06" ? { ...x, body: "Footing — 10 km au lieu de 8" } : x));
  assert.equal(planModifie(HIER, detail), true, "un détail changé (distance, allure) passe sous silence");
  assert.equal(planModifie([], NUIT), true, "le premier plan n'est pas annoncé");
});

test("une modification pas encore lue ne disparaît pas à la réécriture suivante", () => {
  const nonLue = HIER.map((x, i) => (i === 3 ? { ...x, read: false } : x));
  assert.equal(reecritureLue(nonLue, NUIT), false, "la purge efface l'annonce avant que l'athlète l'ait lue");
});

test("le coach compare au plan effacé, et le test VMA à la dernière séance écrite", () => {
  const src = codeNu("src/lib/ai/autoCoach.ts");
  const lecture = src.indexOf('select("title, body, read, data")');
  const purge = src.indexOf('.delete()\n    .eq("user_id", userId).eq("type", "coach_session").gte("data->>date", from)');
  assert.ok(lecture > 0 && purge > lecture, "le plan précédent n'est plus lu AVANT d'être effacé");
  assert.match(src, /const lue = planAvant != null && reecritureLue\(planAvant, aEcrire\.map/);
  assert.match(src, /type: "coach_session",\n    read: lue,/, "les séances réécrites naissent de nouveau non lues");
  assert.match(src, /\.order\("created_at", \{ ascending: false \}\)\.limit\(1\)\.maybeSingle\(\)/, "le test VMA ne se compare plus à la dernière séance");
  assert.match(src, /body: T\.subtitle\.slice\(0, 200\), read: lue,/, "la séance test réannonce chaque jour");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
