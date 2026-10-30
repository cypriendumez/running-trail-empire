/**
 * LE BILAN DE LA SEMAINE (Premium, Cyprien, 30/10/2026) — plusieurs séances lues ensemble.
 *
 * « Je dois savoir s'il y a réellement une différence d'analyse entre les abonnements. »
 * Vérifié : l'analyse d'UNE séance est la même à 9,99 € et à 14,99 €. Ce bilan est ce que
 * Premium lit EN PLUS : intensité, dérive cardiaque, efficacité, sommeil, VFC, objectif.
 *
 * Le modèle rédige, il ne calcule pas : ces tests gardent les FAITS qu'il reçoit, ce qui est
 * dit inconnu plutôt qu'inventé, et le rejet d'un bilan qui contiendrait un chiffre absent.
 *
 *   npx tsx tests/bilan-semaine.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faitsDuBilan, lignesDuBilan, chrono, type EntreeBilan } from "../src/lib/ai/bilanSemaine";
import { chiffresInconnus } from "../src/lib/ai/relectureSemaine";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const AUJ = "2026-11-08";
const sortie = (date: string, km: number, min: number, x: Record<string, unknown> = {}) =>
  ({ date, sport: "run", distance_km: km, duration_seconds: min * 60, avg_hr: 145, elevation_gain_m: 40, ...x });
const ENTREE: EntreeBilan = {
  aujourdhui: AUJ,
  seances: [
    // Cette semaine (2 → 8 novembre) : trois sorties, et un vélo qui ne compte pas dans le volume.
    sortie("2026-11-08", 15, 75, { hr_zone_seconds: [600, 3600, 300, 0, 0], cardiac_decoupling: 3.1 }),
    sortie("2026-11-05", 10, 48, { hr_zone_seconds: [300, 2400, 180, 0, 0], cardiac_decoupling: 4.3 }),
    sortie("2026-11-03", 8, 40, { hr_zone_seconds: [600, 1200, 300, 300, 0] }),
    // Une sortie à effort de course (FC moyenne 189 pour 200 de max) : sa dérive n'est pas une dérive d'endurance.
    sortie("2026-11-02", 12, 50, { avg_hr: 189, cardiac_decoupling: 5.5 }),
    { date: "2026-11-04", sport: "bike", distance_km: 30, duration_seconds: 3600, avg_hr: 120 },
    // Les quatre semaines d'avant : 40, 50, 0 (coupure), 60 km.
    sortie("2026-10-30", 40, 200, { cardiac_decoupling: 6.2 }),
    sortie("2026-10-22", 50, 250, { cardiac_decoupling: 5.8 }),
    sortie("2026-10-08", 60, 300),
  ],
  sommeil: [{ date: "2026-11-07", sleep_score: 70 }, { date: "2026-11-06", sleep_score: 60 }, { date: "2026-10-28", sleep_score: 80 }],
  vfc: [{ date: "2026-11-07", hrv_ms: 62 }, { date: "2026-10-25", hrv_ms: 70 }],
  fcMax: 200,
  objectif: { nom: "sub 16 min", date: "2026-12-19", distanceKm: 5, viseSec: 959, predictionSec: 978 },
  recuperation: { course: "Marathon International de Lille", reprise: "2026-11-21" },
  courses: [{ nom: "Semi de Bondues", date: "2026-11-08", distanceKm: 21.1 }, { nom: "Sub 16", date: "2026-12-19", distanceKm: 5 }],
};

console.log("\nLES FAITS — calculés ici, jamais par le modèle");

test("la semaine : sept jours civils, la course seulement", () => {
  const f = faitsDuBilan(ENTREE);
  assert.equal(f.debut, "2026-11-02");
  assert.equal(f.seances, 4, "le vélo est compté comme une séance de course");
  assert.equal(f.km, 45);
  assert.equal(f.minutes, 213);
});

test("le volume habituel : médiane des semaines RÉELLEMENT courues", () => {
  // 40, 50 et 60 km (la semaine de coupure n'entre pas) : médiane 50.
  assert.equal(faitsDuBilan(ENTREE).kmHabitude, 50);
});

test("l'intensité, la dérive cardiaque, le sommeil et la VFC, semaine contre semaines d'avant", () => {
  const f = faitsDuBilan(ENTREE);
  assert.deepEqual(f.intensite, { facile: 89, modere: 8, dur: 3 });
  // La sortie à 189 de FC moyenne (5,5 %) n'entre pas : seules les sorties faciles disent l'endurance.
  assert.deepEqual(f.derive, { semaine: 3.7, n: 2, avant: 6 }, "la dérive d'une sortie à effort de course est comptée comme une dérive d'endurance");
  assert.deepEqual(f.sommeil, { semaine: 65, avant: 80 });
  assert.deepEqual(f.vfc, { semaine: 62, avant: 70 });
});

test("l'objectif : jours restants, chrono visé, prédiction, et la récupération en cours", () => {
  const f = faitsDuBilan(ENTREE);
  assert.equal(f.objectif?.joursRestants, 41);
  const l = lignesDuBilan(f);
  assert.match(l, /visé en 15'59/);
  assert.match(l, /16'18, soit 19 s plus lent que l'objectif/);
  assert.match(l, /Récupération après Marathon International de Lille en cours : footings seulement, pas d'intensité avant le 21 novembre/);
  assert.match(l, /Semaine du 2 novembre au 8 novembre/, "les dates sont servies en ISO : le modèle les recopie telles quelles");
  assert.match(l, /Course disputée cette semaine : Semi de Bondues, 15 km le 8 novembre/, "la course de la semaine n'est pas nommée");
  assert.match(l, /Dérive cardiaque moyenne \(sorties faciles[^)]*\) : 3,7 %/, "décimale à l'anglaise dans un texte français");
  assert.equal(chrono(9720), "2h42");
});

console.log("\nCE QU'ON NE SAIT PAS — dit, jamais comblé");

test("sans zones ni dérive ni sommeil, le bilan le dit au lieu d'inventer", () => {
  const nu: EntreeBilan = { ...ENTREE, seances: ENTREE.seances.map((s) => ({ ...s, hr_zone_seconds: null, cardiac_decoupling: null })), sommeil: [], vfc: [], objectif: null };
  const f = faitsDuBilan(nu);
  assert.equal(f.intensite, null);
  assert.equal(f.derive.semaine, null);
  const l = lignesDuBilan(f);
  assert.doesNotMatch(l, /Dérive cardiaque moyenne/, "une dérive inventée sur une semaine sans mesure");
  assert.match(l, /CE QU'ON NE SAIT PAS : [\s\S]*dérive cardiaque[\s\S]*sommeil[\s\S]*VFC[\s\S]*objectif/);
});

test("une récupération terminée n'est plus rappelée", () => {
  assert.equal(faitsDuBilan({ ...ENTREE, recuperation: { course: "Lille", reprise: "2026-11-01" } }).recuperation, null);
  // Une course prévue mais pas courue (aucune sortie ce jour-là d'au moins la moitié de la distance) n'est pas nommée.
  assert.equal(faitsDuBilan({ ...ENTREE, courses: [{ nom: "10 km", date: "2026-11-06", distanceKm: 10 }] }).course, null);
});

console.log("\nLE MODÈLE RÉDIGE — un chiffre absent des faits rejette le bilan");

test("un bilan fidèle passe, un chiffre inventé est repéré", () => {
  const l = lignesDuBilan(faitsDuBilan(ENTREE));
  assert.deepEqual(chiffresInconnus("Ta dérive est tombée à 3,7 % contre 6 % avant, pour 45 km cette semaine.", l), []);
  assert.ok(chiffresInconnus("Ta dérive de 7 % inquiète.", l).length > 0, "un chiffre inventé passe le contrôle");
});

console.log("\nLES BRANCHEMENTS — Premium seulement, mémorisé, jour de l'athlète");

test("la route : formule d'abord, mémoire avant le plafond, contrôle des chiffres", () => {
  const src = codeNu("src/app/api/ai/bilan/route.ts");
  const iFormule = src.indexOf(`exigeAcces(supabase, user.id, "bilan")`);
  const iMemo = src.indexOf("prec?.empreinte === empreinte");
  const iPlafond = src.indexOf(`exigeAcces(supabase, user.id, "ia")`);
  const iModele = src.indexOf("generateContent(");
  assert.ok(iFormule > 0 && iFormule < iMemo, "le bilan n'est plus réservé à Premium, ou la formule est vérifiée trop tard");
  assert.ok(iMemo < iPlafond && iPlafond < iModele, "un bilan resservi décompte de nouveau un échange, ou le modèle part sans plafond");
  assert.match(src, /chiffresInconnus\(texte, lignes\)/, "un bilan aux chiffres inventés serait servi");
  assert.match(src, /aujourdhui\(fuseauOuDefaut\(/, "la semaine n'est plus celle du jour civil de l'athlète");
});

test("le tableau de bord montre la carte à tous, ouverte seulement en Premium", () => {
  assert.match(codeNu("src/components/dashboard/BentoDashboard.tsx"), /<BilanSemaine ouvert=\{!!acces && peut\(acces\.etat, "bilan"\)\} \/>/);
  const carte = readFileSync("src/components/dashboard/BilanSemaine.tsx", "utf8");
  for (const l of ["fr", "en", "de", "es", "pt"]) assert.match(carte, new RegExp(`\\n  ${l}: \\{ titre: "`), `la carte n'existe pas en ${l}`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
