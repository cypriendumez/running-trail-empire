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
  assert.equal(plans.length, 2, `${plans.length} entrée(s) plan, 2 attendues (deux jours distincts)`);
  const du21 = plans.find((p) => p.cle === "plan:2026-09-21")!;
  assert.ok(du21, "le regroupement du 21/09 manque");
  assert.equal(du21.titre, "Plan mis à jour");
  assert.match(du21.corps ?? "", /^5 séances — Allure spécifique objectif · Footing \+ lignes droites · Sortie longue avec bloc spécifique · \+2$/);
  assert.equal(du21.lue, false, "une seule séance non lue suffit à marquer l'entrée non lue");
  assert.equal(du21.at, "2026-09-21T07:10:04Z", "l'heure de l'entrée n'est pas celle de la séance la plus récente");
  assert.equal(plans.find((p) => p.cle === "plan:2026-09-14")!.lue, true);
});

test("le panneau est trié du plus récent au plus ancien et plafonné", () => {
  const e = construirePanneau(BASE, libelles);
  assert.deepEqual(e.map((x) => x.cle), ["plan:2026-09-21", "an1", "m1", "plan:2026-09-14"]);
  const beaucoup = Array.from({ length: 40 }, (_, i) => L(`m${i}`, "coach_message", `Message ${i}`, `2026-08-${String(1 + (i % 28)).padStart(2, "0")}T10:00:00Z`));
  assert.equal(construirePanneau(beaucoup, libelles).length, 10, "le panneau n'est plus plafonné à 10 entrées");
});

test("une croix écarte l'entrée, et la liste des écartées reste bornée", () => {
  const e = construirePanneau(BASE, libelles);
  const apres = sansMasquees(e, ["plan:2026-09-21", "m1"]);
  assert.deepEqual(apres.map((x) => x.cle), ["an1", "plan:2026-09-14"]);
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

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
