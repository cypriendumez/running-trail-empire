/**
 * LES RÉGLAGES DE L'INSCRIPTION AGISSENT VRAIMENT SUR LE PLAN (11/10/2026).
 *
 * Audit du questionnaire, à la demande de Cyprien (« est-ce que le coach le prend en compte ? ») :
 *  · le DÉNIVELÉ promettait « la place des côtes et du D+ » mais le moteur l'ignorait ;
 *  · le VOLUME VISÉ n'était enregistré nulle part (la colonne n'existait pas) ;
 *  · le CHRONOTYPE ne changeait aucune séance — retiré du questionnaire ;
 *  · la FC max déclarée pouvait passer SOUS la plus haute FC réellement enregistrée.
 *
 *   npx tsx tests/inscription-reglages.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { menuSelonDenivele, preferenceDenivele } from "../src/lib/coach/denivele";
import { volumeAvecCible, volumeCible } from "../src/lib/coach/volumeCible";
import { referencesFc } from "../src/lib/coach/fcCible";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

// Des séances factices : seule leur IDENTITÉ compte pour le menu.
const VMA = { n: "vma" }, SEUIL = { n: "seuil" }, SPEC = { n: "spec" }, COTE = { n: "cote" };
const noms = (m: { n: string }[]) => m.map((x) => x.n).join(",");
const route = [VMA, SEUIL, SPEC], trail = [COTE, SEUIL, VMA];

console.log("\nDÉNIVELÉ — la réponse déplace vraiment les côtes");

test("seules les quatre réponses du questionnaire sont reconnues", () => {
  for (const v of ["evite", "modere", "aime", "specialiste"]) assert.equal(preferenceDenivele(v), v);
  for (const v of [null, undefined, "", "EVITE", "montagne", 3]) assert.equal(preferenceDenivele(v), null);
});

test("sans réponse, le menu ne bouge pas (aucun athlète existant n'est changé en silence)", () => {
  assert.equal(noms(menuSelonDenivele(route, { vma: VMA, cote: COTE }, null, { objectifDenivele: false, semainePaire: true })), "vma,seuil,spec");
});

test("« Je l'évite » : aucune côte sur route, les côtes en dernier pour un trail", () => {
  assert.equal(noms(menuSelonDenivele(route, { vma: VMA, cote: COTE }, "evite", { objectifDenivele: false, semainePaire: true })), "vma,seuil,spec");
  assert.equal(noms(menuSelonDenivele(trail, { vma: VMA, cote: COTE }, "evite", { objectifDenivele: true, semainePaire: true })), "seuil,vma,cote");
});

test("« Modéré » : les côtes remplacent la VMA une semaine sur deux, pas l'autre", () => {
  assert.equal(noms(menuSelonDenivele(route, { vma: VMA, cote: COTE }, "modere", { objectifDenivele: false, semainePaire: true })), "cote,seuil,spec");
  assert.equal(noms(menuSelonDenivele(route, { vma: VMA, cote: COTE }, "modere", { objectifDenivele: false, semainePaire: false })), "vma,seuil,spec");
});

test("« J'aime ça » : les côtes remplacent la VMA chaque semaine", () => {
  for (const semainePaire of [true, false]) {
    assert.equal(noms(menuSelonDenivele(route, { vma: VMA, cote: COTE }, "aime", { objectifDenivele: false, semainePaire })), "cote,seuil,spec");
  }
});

test("« C'est mon terrain » : les côtes EN TÊTE, quel que soit l'objectif", () => {
  assert.equal(noms(menuSelonDenivele(route, { vma: VMA, cote: COTE }, "specialiste", { objectifDenivele: false, semainePaire: false })), "cote,seuil,spec");
  assert.equal(noms(menuSelonDenivele([SEUIL, VMA, COTE], { vma: VMA, cote: COTE }, "specialiste", { objectifDenivele: true, semainePaire: false })), "cote,seuil,vma");
});

test("le budget de séances dures ne bouge pas : les côtes REMPLACENT, elles ne s'ajoutent pas", () => {
  for (const pref of ["evite", "modere", "aime", "specialiste"] as const) {
    for (const objectifDenivele of [true, false]) {
      const m = objectifDenivele ? trail : route;
      const r = menuSelonDenivele(m, { vma: VMA, cote: COTE }, pref, { objectifDenivele, semainePaire: true });
      assert.ok(r.length <= m.length, `${pref} : ${r.length} séances pour ${m.length}`);
      assert.equal(new Set(r).size, r.length, `${pref} : une séance en double`);
    }
  }
});

test("le menu reçu n'est jamais modifié (fonction pure)", () => {
  const m = [...route];
  menuSelonDenivele(m, { vma: VMA, cote: COTE }, "specialiste", { objectifDenivele: false, semainePaire: true });
  assert.equal(noms(m), "vma,seuil,spec");
});

console.log("\nVOLUME VISÉ — un plafond de progression, jamais une coupe");

test("la cible déclarée n'est lue que dans ses bornes (5 à 300 km)", () => {
  assert.equal(volumeCible(50), 50);
  assert.equal(volumeCible("40"), 40);
  for (const v of [null, undefined, 0, 4, 301, "abc", NaN]) assert.equal(volumeCible(v), null);
});

test("sous la cible, le plan progresse jusqu'à elle puis s'y tient", () => {
  assert.equal(volumeAvecCible(33, 50, 30), 33, "la progression normale continue sous la cible");
  assert.equal(volumeAvecCible(55, 50, 48), 50, "elle s'arrête à la cible");
});

test("au-dessus de la cible, on ne coupe RIEN : on cesse seulement de monter", () => {
  assert.equal(volumeAvecCible(77, 50, 70), 70, "70 km déjà courus : ni 77, ni 50");
  assert.equal(volumeAvecCible(56, 50, 70), 56, "une semaine allégée reste allégée");
});

test("sans cible, le plan est inchangé", () => {
  assert.equal(volumeAvecCible(77, null, 70), 77);
});

console.log("\nFC MAX — jamais sous une valeur réellement atteinte");

test("une FC max déclarée SOUS l'observée cède la place à l'observée", () => {
  assert.equal(referencesFc({ maxDeclaree: 180, maxObservee: 195 }).max, 195);
});

test("une FC max déclarée AU-DESSUS de l'observée est gardée", () => {
  assert.equal(referencesFc({ maxDeclaree: 200, maxObservee: 190 }).max, 200);
});

test("une observée qui décroche (< 150) ne remplace pas la déclarée", () => {
  assert.equal(referencesFc({ maxDeclaree: 185, maxObservee: 120 }).max, 185);
});

console.log("\nBRANCHEMENTS — le moteur, l'inscription et Ghost Runner s'en servent");

test("le moteur du plan applique le dénivelé AVANT le facteur limitant et la phase", () => {
  const src = code("src/lib/ai/coachContext.ts");
  const iDen = src.indexOf("menu = menuSelonDenivele(menu, { vma: qVMA, cote: qCote }, preferenceDenivele(p?.elevation_pref)");
  const iLim = src.indexOf("if (limiter) {");
  const iPhase = src.indexOf("menu = specifiqueEnTete(menu, phaseSemaine)");
  assert.ok(iDen > 0, "le dénivelé déclaré n'atteint plus le menu des séances");
  assert.ok(iDen < iLim && iDen < iPhase, "le dénivelé passe après le facteur limitant ou la phase : il écraserait l'objectif");
});

test("le moteur plafonne le volume par la cible, sur le volume réellement couru", () => {
  const src = code("src/lib/ai/coachContext.ts");
  assert.ok(/const targetKm = volumeAvecCible\(/.test(src), "le volume de la semaine n'est plus plafonné par la cible");
  assert.ok(/volumeCible\(\(p as Record<string, unknown> \| null\)\?\.target_weekly_km\)/.test(src), "la cible n'est plus lue sur le profil");
});

test("l'inscription ENREGISTRE le volume visé, sans bloquer si la migration 035 manque", () => {
  const src = code("src/app/onboarding/page.tsx");
  assert.ok(/update\(\{ target_weekly_km: volume \}\)/.test(src), "le volume visé n'est plus écrit");
  assert.ok(/if \(eVol\) journaliserFacultatif\(/.test(src), "l'échec d'écriture du volume est muet");
  assert.ok(!/noter\(eVol/.test(src), "un échec du volume bloquerait « Terminer » (défaut du 14/09/2026)");
  assert.ok(/useState<number \| null>\(null\)/.test(src), "un curseur jamais touché enregistrerait une cible");
});

test("le chronotype a disparu du questionnaire et de la consigne de l'IA", () => {
  assert.ok(!/chronotype/.test(code("src/app/onboarding/page.tsx")), "le questionnaire demande encore le chronotype");
  assert.ok(!/chronotype \$\{p\?\.chronotype/.test(code("src/lib/ai/coachContext.ts")), "la consigne de l'IA cite encore le chronotype");
});

test("Ghost Runner lit la FC max déclarée à l'inscription", () => {
  const src = code("src/components/ghost-runner/GhostRunner.tsx");
  assert.ok(/maxDeclaree: baseline\?\.max_hr \?\? \(profile as unknown as \{ max_hr\?: number \} \| null\)\?\.max_hr/.test(src),
    "Ghost Runner ignore la FC max déclarée au profil");
});

test("la migration 035 crée la colonne, bornée comme le curseur", () => {
  const sql = readFileSync("supabase/migrations/035_volume_cible.sql", "utf8");
  assert.ok(/add column if not exists target_weekly_km integer/.test(sql));
  assert.ok(/target_weekly_km between 5 and 300/.test(sql));
});

console.log("\nAPPLE WATCH — le chemin existe là où on le cherche");

test("l'étape Montre du questionnaire explique l'Apple Watch, avec le lien de l'app", () => {
  // Le 11/10/2026, Cyprien a cherché une carte Apple sur intervals.icu : il n'y en a pas.
  // Depuis le 12/10/2026, l'Apple Watch a SON chemin dans l'étape par marque (EtapeMontre).
  const src = code("src/app/onboarding/EtapeMontre.tsx");
  assert.ok(/m\.chemin === "companion"/.test(src) && /tr\("mAppleIntro"\)/.test(src), "l'étape Montre ne dit plus rien de l'Apple Watch");
  assert.ok(/href=\{APP_STORE_COMPANION\}/.test(src), "le lien vers Intervals Companion a disparu du questionnaire");
  assert.ok(/APP_STORE_COMPANION = "https:\/\/apps\.apple\.com\/app\/id6739638454"/.test(code("src/app/onboarding/marquesMontre.ts")),
    "l'adresse App Store d'Intervals Companion a changé");
  const ob = readFileSync("src/app/onboarding/onboardingI18n.ts", "utf8");
  assert.equal((ob.match(/mAppleIntro: /g) ?? []).length, 5, "le texte Apple Watch manque dans une langue");
  assert.equal((ob.match(/mAppleStore: /g) ?? []).length, 5, "le libellé du lien manque dans une langue");
});

test("la page Sync Montre donne le même lien direct", () => {
  const src = code("src/app/dashboard/sync/page.tsx");
  assert.ok(/href="https:\/\/apps\.apple\.com\/app\/id6739638454"/.test(src), "le lien App Store manque sur la page Sync Montre");
  assert.equal((readFileSync("src/app/dashboard/sync/syncI18n.tsx", "utf8").match(/"s1\.appleLien": /g) ?? []).length, 5);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
