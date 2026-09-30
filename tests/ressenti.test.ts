/**
 * LE RESSENTI APRÈS UNE SÉANCE — nommer la séance, et compter les kilomètres des chaussures.
 *
 * Cyprien, 30/09/2026 : « j'ai mis 3 courses, il me demandait mon ressenti, mais on ne savait
 * pas de laquelle il parlait ». Et : « un bouton facultatif pour dire quelle paire j'ai
 * utilisée, avec son nombre de kilomètres — si la paire n'est pas au Garage, pas possible ».
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seancesSansRessenti, kmApres } from "../src/lib/dashboard/ressenti";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const w = (id: string, date: string, x: Record<string, unknown> = {}) =>
  ({ id, date, title: "Course à pied", type: "easy", sport: "Run", distance_km: 10, duration_seconds: 3000, ...x });

test("trois séances importées : trois questions, dans l'ordre où on les a courues", () => {
  const s = seancesSansRessenti([w("c", "2026-09-29"), w("b", "2026-09-28"), w("a", "2026-09-27")], [], "2026-09-26");
  assert.deepEqual(s.map((x) => x.id), ["a", "b", "c"], "l'ordre ne suit plus la chronologie");
});

test("deux sorties le MÊME jour sont deux séances, pas une", () => {
  const s = seancesSansRessenti([w("soir", "2026-09-29", { distance_km: 5 }), w("matin", "2026-09-29", { distance_km: 12 })], [{ date: "2026-09-29", workout_id: "matin" }], "2026-09-26");
  assert.deepEqual(s.map((x) => x.id), ["soir"], "répondre pour le matin a effacé la question du soir");
});

test("une réponse ANCIENNE, rangée par date, couvre encore sa journée", () => {
  const s = seancesSansRessenti([w("a", "2026-09-29"), w("b", "2026-09-28")], [{ date: "2026-09-29" }], "2026-09-26");
  assert.deepEqual(s.map((x) => x.id), ["b"], "on redemande ce qui a déjà été dit");
});

test("au plus trois, les plus récentes ; rien au-delà de la fenêtre", () => {
  const cinq = ["2026-09-29", "2026-09-28", "2026-09-27", "2026-09-26", "2026-09-25"].map((d, i) => w(`s${i}`, d));
  assert.deepEqual(seancesSansRessenti(cinq, [], "2026-09-20").map((x) => x.date), ["2026-09-27", "2026-09-28", "2026-09-29"]);
  assert.deepEqual(seancesSansRessenti([w("vieille", "2026-09-20")], [], "2026-09-26"), []);
});

test("ce qui DÉSIGNE la séance voyage : nom, distance, durée", () => {
  const [s] = seancesSansRessenti([w("a", "2026-09-29", { title: "Sortie longue Lille", distance_km: 18.4, duration_seconds: 5520 })], [], "2026-09-26");
  assert.equal(s.titre, "Sortie longue Lille");
  assert.equal(s.distanceKm, 18.4);
  assert.equal(s.dureeSec, 5520);
  const [sansNom] = seancesSansRessenti([w("b", "2026-09-29", { title: "", type: "tempo" })], [], "2026-09-26");
  assert.equal(sansNom.titre, "tempo", "une séance sans nom n'a plus de libellé");
});

test("les chaussures n'ont de sens qu'à pied", () => {
  const s = seancesSansRessenti([
    w("course", "2026-09-29"),
    w("velo", "2026-09-28", { sport: "Ride", title: "Sortie vélo" }),
    w("muscu", "2026-09-27", { type: "strength", sport: null, title: "Séance du jour" }),
  ], [], "2026-09-20");
  // « muscu » n'est reconnue QUE par son type : ni son sport ni son titre ne le disent.
  assert.deepEqual(Object.fromEntries(s.map((x) => [x.id, x.aPied])), { course: true, velo: false, muscu: false });
});

test("le kilométrage d'une paire après une sortie, au dixième", () => {
  assert.equal(kmApres(412, 10.24), 422.2);
  assert.equal(kmApres(null, 5), 5, "une paire sans kilométrage part de zéro");
  assert.equal(kmApres(300, null), 300, "sans distance, on n'invente rien");
  assert.equal(kmApres(-4, 5), 5);
});

test("le serveur : la distance vient de la SÉANCE, la paire de l'ATHLÈTE, une seule fois", () => {
  const src = code("src/app/api/feedback/route.ts");
  // La distance est relue en base, filtrée par propriétaire — jamais reçue du navigateur.
  assert.ok(/from\("workouts"\)\.select\("id, distance_km"\)\.eq\("id", workout_id\)\.eq\("user_id", user\.id\)/.test(src), "la séance n'est plus relue chez nous");
  assert.ok(!/distance_?km\s*\}\s*=\s*await req\.json|distanceKm\s*\}\s*=\s*await req\.json/.test(src), "la distance est reçue du navigateur");
  assert.ok(/const km = Number\(seance\?\.distance_km\)/.test(src), "les kilomètres ajoutés ne viennent plus de la séance relue");
  // La paire : celle de CET athlète, active — à la lecture comme à l'écriture.
  assert.ok(/from\("shoes"\)\.select\("id, current_km"\)\.eq\("id", chaussure_id\)\.eq\("user_id", user\.id\)\.eq\("is_active", true\)/.test(src), "la paire d'un autre athlète pourrait être modifiée");
  assert.ok(/from\("shoes"\)\.update\(\{ current_km: nouveau \}\)\.eq\("id", chaussure_id\)\.eq\("user_id", user\.id\)/.test(src), "l'écriture ne vérifie plus le propriétaire");
  // Une même séance n'est pas comptée deux fois (double clic, deux onglets).
  const iDeja = src.indexOf('.eq("data->>workout_id", seance.id)'), iInsert = src.indexOf('from("notifications").insert(');
  assert.ok(iDeja > 0 && iDeja < iInsert, "une séance déjà renseignée peut l'être deux fois");
  assert.ok(/if \(deja\?\.length\) return NextResponse\.json\(\{ ok: true, deja: true \}\)/.test(src));
  // Les erreurs de la base sont lues (elles sont RENDUES, pas levées).
  for (const e of ["ew", "ed", "eu"]) assert.ok(new RegExp(`if \\(${e}\\)`).test(src), `l'erreur ${e} n'est plus lue`);
});

test("l'écran : la séance nommée, « 1 sur 3 », « Plus tard », et le Garage exigé", () => {
  const src = code("src/components/dashboard/SessionFeedback.tsx");
  assert.ok(/t\("fb\.of", \{ i: index \+ 1, n: seances\.length \}\)/.test(src), "plus de repère « séance 1 sur 3 »");
  assert.ok(/\{seance\.titre\}/.test(src) && /seance\.distanceKm/.test(src) && /duree\(seance\.dureeSec\)/.test(src), "la séance n'est plus nommée");
  assert.ok(/body: JSON\.stringify\(\{ workout_id: seance\.id,/.test(src), "la réponse n'est plus rattachée à la séance");
  // Sans paire au Garage : aucune case à cocher, seulement le chemin du Garage.
  assert.ok(/garage\.length === 0 \? \([\s\S]{0,300}\/dashboard\/profile\?onglet=garage/.test(src), "sans paire, le questionnaire propose quand même un choix");
  assert.ok(/role="radio" aria-checked=\{choisie\}/.test(src), "la paire choisie n'est plus annoncée aux lecteurs d'écran");
  assert.ok(/onClick=\{\(\) => setChaussure\(choisie \? null : c\.id\)\}/.test(src), "une paire cochée par erreur ne se décoche plus : le choix n'est plus facultatif");
  assert.ok(/\{seance\.aPied && \(/.test(src), "on propose des chaussures pour une sortie vélo");
  // Le Garage s'ouvre sur son onglet.
  assert.ok(/get\("onglet"\) === "garage"\) setTab\("shoes"\)/.test(code("src/components/profile/ProfileSettings.tsx")));
});

console.log(`\n${passed} test(s) du ressenti passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
