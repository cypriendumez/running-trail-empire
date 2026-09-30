/**
 * « TES RÉSULTATS SONT EN LIGNE » — l'e-mail après la course visée (30/09/2026).
 *
 * Cyprien : « quand une personne a mis un objectif de course, envoie-lui un mail avec le
 * lien qui envoie directement aux résultats, quelques jours juste après la course ».
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { courseTerminee, ligneDeLaCourse, lienAEnvoyer, construireEmail, type LigneCourse } from "../src/lib/notify/resultatsCourse";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const obj = { race: "La Ronda des Coudous", raceDate: "2026-09-30", distanceKm: 17 };

test("la fenêtre : de J+2 à J+10 après la course, pas avant, pas après", () => {
  assert.equal(courseTerminee(obj, "2026-10-01"), null, "envoyé le lendemain : le classement n'est souvent pas publié");
  assert.equal(courseTerminee(obj, "2026-10-02")?.ilYa, 2);
  assert.equal(courseTerminee(obj, "2026-10-10")?.ilYa, 10);
  assert.equal(courseTerminee(obj, "2026-10-11"), null, "envoyé onze jours après : l'e-mail ne veut plus rien dire");
  assert.equal(courseTerminee(obj, "2026-09-20"), null, "une course À VENIR déclenche l'e-mail");
  for (const o of [null, {}, { race: "X" }, { race: "", raceDate: "2026-09-30" }, { race: "X", raceDate: "bientôt" }]) {
    assert.equal(courseTerminee(o, "2026-10-03"), null, JSON.stringify(o));
  }
});

const l = (x: Partial<LigneCourse>): LigneCourse => ({ name: "La Ronda des Coudous", date: "2026-09-30", distance_km: 17, city: "L'Isle-Jourdain", resultats_url: null, resultats_annee: null, ...x });

test("la ligne du catalogue : même nom, même date à un jour près, distance la plus proche", () => {
  const c = { nom: "Ronda des Coudous", date: "2026-09-30", distanceKm: 17 };
  const onze = l({ distance_km: 11 }), dixSept = l({ distance_km: 17 });
  assert.equal(ligneDeLaCourse([onze, dixSept], c), dixSept, "la distance visée n'est pas retenue");
  assert.equal(ligneDeLaCourse([l({ date: "2026-10-01" })], c)?.date, "2026-10-01", "un départ le lendemain (course sur deux jours) est perdu");
  assert.equal(ligneDeLaCourse([l({ date: "2026-10-03" })], c), null, "une autre édition est prise pour celle-ci");
  assert.equal(ligneDeLaCourse([l({ name: "Trail des Coudous" })], c), null, "une AUTRE course, au nom voisin, reçoit l'e-mail");
  // À distance égale, celle qui a un classement.
  const avec = l({ resultats_url: "https://x/2026", resultats_annee: 2026 });
  assert.equal(ligneDeLaCourse([l({}), avec], c), avec);
});

test("le lien : le classement de CETTE édition, sinon on attend, sinon une recherche nommée", () => {
  const c = { nom: "La Ronda des Coudous", date: "2026-09-30", ilYa: 3 };
  assert.deepEqual(lienAEnvoyer(l({ resultats_url: "https://chrono.fr/ronda-2026", resultats_annee: 2026 }), c), { url: "https://chrono.fr/ronda-2026", direct: true });
  // Le classement de l'an DERNIER n'est pas celui de sa course.
  assert.equal(lienAEnvoyer(l({ resultats_url: "https://chrono.fr/ronda-2025", resultats_annee: 2025 }), c), null, "le classement 2025 est envoyé pour la course 2026");
  assert.equal(lienAEnvoyer(null, c), null, "à J+3 sans classement, on devrait attendre");
  const r = lienAEnvoyer(l({}), { ...c, ilYa: 6 })!;
  assert.equal(r.direct, false, "une recherche est présentée comme le classement");
  assert.ok(r.url.startsWith("https://www.google.com/search?q=") && decodeURIComponent(r.url).includes("La Ronda des Coudous") && r.url.includes("2026"));
  assert.equal(lienAEnvoyer(l({ resultats_url: "javascript:alert(1)", resultats_annee: 2026 }), c), null);
});

test("l'e-mail : le nom de la course, le bon bouton, cinq langues, rien d'injecté", () => {
  const m = construireEmail({ lang: "fr", nom: "La Ronda des Coudous", date: "2026-09-30", lien: { url: "https://chrono.fr/ronda-2026", direct: true }, appUrl: "https://pacevo.fr" });
  assert.ok(m.subject.includes("La Ronda des Coudous"));
  assert.ok(m.html.includes("https://chrono.fr/ronda-2026") && m.html.includes("Voir mon classement"));
  assert.ok(m.text.includes("https://chrono.fr/ronda-2026"));
  const rech = construireEmail({ lang: "fr", nom: "X", date: "2026-09-30", lien: { url: "https://www.google.com/search?q=x", direct: false }, appUrl: "https://pacevo.fr" });
  assert.ok(rech.html.includes("Chercher le classement") && rech.html.includes("lance une recherche"), "une recherche n'est pas annoncée comme telle");
  const pieges = construireEmail({ lang: "fr", nom: "<script>alert(1)</script>", date: "2026-09-30", lien: { url: "https://x.fr", direct: true }, appUrl: "https://pacevo.fr" });
  assert.ok(!pieges.html.includes("<script>alert(1)</script>"), "le nom de la course n'est pas échappé");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const e = construireEmail({ lang, nom: "Race", date: "2026-09-30", lien: { url: "https://x.fr", direct: true }, appUrl: "https://pacevo.fr" });
    assert.ok(e.subject.length > 5 && e.html.includes("https://x.fr"), lang);
  }
});

test("l'envoi : consentement d'abord, une seule fois par course, mémorisé après succès", () => {
  const src = code("src/lib/notify/resultatsCourse.ts");
  const i = (m: string) => src.indexOf(m);
  assert.ok(i("if (!p?.notif_coach)") > 0 && i("if (!p?.notif_coach)") < i('eq("type", "race_objective")'), "le consentement n'est plus vérifié EN PREMIER");
  assert.ok(i('eq("data->>cle", cle)') < i("construireEmail({"), "un second e-mail peut partir pour la même course");
  assert.ok(i('envoyerEmail("resultats-course"') < i("type: TYPE_ENVOI, title"), "l'envoi est mémorisé AVANT d'être parti : un échec ne serait jamais retenté");
  assert.ok(/if \(!r\.ok\) return \{ sent: false/.test(src), "un envoi refusé est compté comme parti");
  assert.ok(/if \(opts\.blanc\) return \{ sent: false, skipped: "essai à blanc"/.test(src) && i("if (opts.blanc)") < i('envoyerEmail("resultats-course"'), "l'essai à blanc envoie un vrai e-mail");
  const route = code("src/app/api/cron/resultats-course/route.ts");
  assert.ok(/if \(process\.env\.CRON_SECRET && secret !== process\.env\.CRON_SECRET\)/.test(route), "la route est ouverte à tous");
  assert.ok(/jourFrance\(\)/.test(route), "« aujourd'hui » n'est plus le jour en France");
  const wf = readFileSync(".github/workflows/resultats-course.yml", "utf8");
  assert.ok(/cron: "20 7 \* \* \*"/.test(wf) && /\/api\/cron\/resultats-course/.test(wf), "la tâche quotidienne n'appelle plus la route");
});

console.log(`\n${passed} test(s) de l'e-mail des résultats passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
