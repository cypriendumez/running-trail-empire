/**
 * DEUX REPROCHES DE L'ATHLÈTE, DEUX DÉFAUTS RÉELS (06/09/2026).
 *
 * 1. « En deux jours j'ai eu les mêmes séances. » Vrai : TOUS les créneaux de footing
 *    recevaient exactement la même séance — même titre, même distance, même texte.
 *    Seule l'allure bougeait, et seulement parce que la météo changeait.
 *
 * 2. « La fréquence cardiaque à respecter est de 129 à 162, c'est beaucoup trop large. »
 *    Vrai aussi, et pire que ça : le Ghost Runner calculait ses zones avec
 *    `baseline?.max_hr ?? 190`. La table `performance_baselines` de cet athlète est
 *    VIDE — il courait donc sur un 190 générique alors que sa FC max réellement
 *    enregistrée est 212 (29 séances au-dessus de 200 : ce n'est pas un capteur qui
 *    décroche) et son seuil mesuré 192. Cibles décalées d'une vingtaine de battements,
 *    et larges de ~21 bpm par zone.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { referencesFc, plageFc, plageLisible, LARGEUR_MAX } from "../src/lib/coach/fcCible";
import { repartirFootings, varianteFooting, AMPLITUDE } from "../src/lib/coach/footings";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}
/** Le cas réel qui a déclenché tout ça. */
const REEL = { maxObservee: 212, repos: 63, seuil: 192, age: 20 };

console.log("\nLA RÉFÉRENCE — une mesure passe avant toute formule");

test("la FC max mesurée l'emporte sur l'âge", () => {
  const r = referencesFc(REEL);
  assert.equal(r.max, 212, "220 - âge aurait donné 200, et le défaut d'origine 190");
  assert.equal(r.source, "mesures");
});

test("un capteur qui décroche n'est pas un record", () => {
  // Une FC max « observée » sous 150 est un artefact, pas une performance.
  const r = referencesFc({ maxObservee: 120, seuil: 192, age: 20 });
  assert.notEqual(r.max, 120);
  assert.equal(r.source, "seuil", "on retombe sur le seuil, qui reste une MESURE");
  assert.equal(r.max, Math.round(192 / 0.92));
});

test("l'âge n'est qu'un dernier recours", () => {
  const r = referencesFc({ age: 20 });
  assert.equal(r.max, 200);
  assert.equal(r.source, "age");
});

test("sans rien, on ne prétend rien", () => {
  const r = referencesFc({});
  assert.equal(r.max, null);
  assert.equal(r.source, "aucune");
  assert.equal(plageFc("endurance", r), null, "une cible inventée serait suivie");
  assert.equal(plageLisible(null), null);
});

console.log("\nLA CIBLE — étroite, sinon elle ne cible rien");

test("toute plage tient dans la largeur annoncée", () => {
  const r = referencesFc(REEL);
  for (const i of ["recup", "endurance", "tempo", "seuil", "vma"] as const) {
    const p = plageFc(i, r)!;
    assert.ok(p, `${i} sans cible`);
    assert.ok(p.hi - p.lo <= LARGEUR_MAX, `${i} : ${p.hi - p.lo} bpm, au-delà du maximum`);
    assert.ok(p.hi > p.lo, `${i} : plage vide`);
  }
  assert.equal(LARGEUR_MAX, 12, "largeur maximale : décision d'entraîneur, à changer sciemment");
});

test("le cas réel : bien plus étroit ET bien plus haut qu'avant", () => {
  const p = plageFc("endurance", referencesFc(REEL))!;
  // AVANT : Math.round(190 * 0.60) à Math.round(190 * 0.70) = 114-133, soit 19 bpm.
  assert.ok(p.hi - p.lo <= 10, `${p.hi - p.lo} bpm de large`);
  assert.ok(p.lo > 133, `cible basse à ${p.lo} : on reste sur l'ancienne référence de 190`);
  // La RÉSERVE cardiaque, pas un simple % de FC max : 63 + (212-63) × 0,66 = 161.
  // Un % de FC max donnerait 212 × 0,66 = 140, soit 20 battements trop bas.
  const centre = (p.lo + p.hi) / 2;
  assert.ok(Math.abs(centre - 161) <= 1.5, `centre à ${centre} : la réserve cardiaque n'est plus utilisée`);
  assert.equal(plageLisible(p), `${p.lo}-${p.hi} bpm`);
});

test("les intensités du seuil s'ancrent sur le SEUIL MESURÉ", () => {
  const avec = plageFc("seuil", referencesFc(REEL))!;
  // 97 % de 192 = 186 : la plage doit l'encadrer.
  assert.ok(avec.lo <= 186 && avec.hi >= 186, `${avec.lo}-${avec.hi} n'encadre pas 97 % du seuil`);
  // Sans seuil mesuré, on retombe sur la réserve cardiaque — et ça doit rester cohérent.
  const sans = plageFc("seuil", referencesFc({ maxObservee: 212, repos: 63 }))!;
  assert.ok(sans.hi <= 212 && sans.lo >= 73, "hors du domaine physiologique");
});

test("une cible ne sort jamais du domaine de l'athlète", () => {
  // ⚠️ Cas où le bornage MORD : à 95 % de réserve avec une plage large, le haut de la
  // fenêtre dépasse la FC max. Sans bornage, on demanderait l'impossible.
  const r = referencesFc({ maxObservee: 190, repos: 60 });
  const p = plageFc("vma", r, 12)!;
  assert.ok(p.hi <= 190, `cible à ${p.hi} au-dessus de la FC max`);
  // FC max DÉCLARÉE : une valeur « observée » de 100 serait — à raison — rejetée
  // comme un capteur qui décroche, et on ne testerait alors plus le bornage.
  const serre = plageFc("vma", referencesFc({ maxDeclaree: 100, repos: 60 }), 12)!;
  assert.ok(serre.hi <= 100, `cible à ${serre.hi} au-dessus d'une FC max de 100`);
  assert.ok(serre.lo >= 70, `cible à ${serre.lo} sous le repos + 10`);
  assert.ok(serre.hi > serre.lo, "plage vide après bornage");
  // …et le bornage BAS doit mordre aussi : avec une réserve cardiaque étroite
  // (100 - 80 = 20 battements), la fenêtre descendrait sous le repos + 10.
  const bas = plageFc("recup", referencesFc({ maxDeclaree: 100, repos: 80 }), 12)!;
  assert.ok(bas.lo >= 90, `cible basse à ${bas.lo} : sous le plancher de repos + 10`);
});

test("les intensités montent bien dans l'ordre", () => {
  const r = referencesFc(REEL);
  const ordre = (["recup", "endurance", "tempo", "seuil", "vma"] as const).map((i) => plageFc(i, r)!.lo);
  for (let i = 1; i < ordre.length; i++)
    assert.ok(ordre[i] > ordre[i - 1], `${ordre[i]} ne dépasse pas ${ordre[i - 1]}`);
});

console.log("\nLES FOOTINGS — trois jours de suite ne peuvent pas être le même jour");

test("la répartition garde le volume de la semaine", () => {
  for (const [n, km] of [[3, 7.65], [2, 10], [5, 8], [4, 6]] as [number, number][]) {
    const r = repartirFootings(n, km, 4, 18);
    const somme = r.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(somme - n * km) <= n * 0.5, `n=${n} : ${somme} au lieu de ${n * km}`);
  }
});

test("elle varie VRAIMENT quand les bornes le permettent", () => {
  const r = repartirFootings(3, 10, 4, 18);
  assert.ok(new Set(r).size > 1, `trois fois la même distance : ${r.join("/")}`);
  assert.ok(Math.max(...r) - Math.min(...r) >= 10 * AMPLITUDE, "variation trop timide pour se voir");
});

test("le volume tient même quand le plafond mord", () => {
  // Le cas réel : 3 footings visant 7,65 km, plafonnés à 7,65 (85 % de la sortie longue).
  // Sans redistribution après bornage, la semaine perdrait des kilomètres en silence.
  const r = repartirFootings(3, 7.65, 4, 7.65);
  const somme = r.reduce((a, b) => a + b, 0);
  assert.ok(somme >= 3 * 7.65 - 0.8, `${somme} km au lieu de ${(3 * 7.65).toFixed(1)} : volume perdu au bornage`);
  const r2 = repartirFootings(4, 12, 4, 13);
  assert.ok(r2.reduce((a, b) => a + b, 0) >= 4 * 12 - 1, "volume perdu sur 4 footings");
});

test("les bornes sont respectées, même serrées", () => {
  for (const v of repartirFootings(3, 7.65, 7, 8)) {
    assert.ok(v >= 7 && v <= 8, `${v} hors des bornes`);
  }
  assert.deepEqual(repartirFootings(0, 10, 4, 18), []);
  assert.deepEqual(repartirFootings(3, 0, 4, 18), [0, 0, 0], "sans volume, pas de distance inventée");
});

test("la répartition est DÉTERMINISTE", () => {
  // Un plan qui change à chaque rafraîchissement de page n'est plus un plan.
  assert.deepEqual(repartirFootings(3, 7.65, 4, 15), repartirFootings(3, 7.65, 4, 15));
});

test("chaque footing de la semaine a sa propre intention", () => {
  const v = [0, 1, 2].map((i) => varianteFooting(i, 3, {}));
  assert.equal(new Set(v).size, 3, `intentions répétées : ${v.join("/")}`);
  assert.equal(v[1], "lignes");
  assert.equal(v[2], "progressif");
  assert.equal(v[0], "base", "le premier suit souvent une séance dure : on n'y met pas d'accélérations");
});

test("aucune intensité ajoutée quand ce serait une faute", () => {
  for (const garde of [{ taper: true }, { semaineCourse: true }, { sansHistorique: true }])
    for (const rang of [0, 1, 2])
      assert.equal(varianteFooting(rang, 3, garde), "base", `${JSON.stringify(garde)} rang ${rang}`);
  assert.equal(varianteFooting(0, 1, {}), "base", "un seul footing : rien à varier");
  assert.equal(varianteFooting(Number.NaN, 3, {}), "base");
});

console.log("\nBRANCHEMENT");

test("le Ghost Runner n'utilise plus une FC max générique", () => {
  const src = codeOf("src/components/ghost-runner/GhostRunner.tsx");
  assert.doesNotMatch(src, /baseline\?\.max_hr \?\? 190/,
    "le 190 par défaut est revenu : les zones d'un athlète sans test seraient fausses");
  assert.match(src, /referencesFc\(\{/, "les références mesurées ne sont plus lues");
  assert.match(src, /plageFc\(intensite, refsFc\)/, "la cible n'est plus calculée");
  // …et elle doit PILOTER les bornes : calculer la cible sans s'en servir ne change rien.
  assert.match(src, /hrLoRef\.current = cible \? cible\.lo/, "la borne basse ignore la cible resserrée");
  assert.match(src, /hrHiRef\.current = cible \? cible\.hi/, "la borne haute ignore la cible resserrée");
  const page = codeOf("src/app/dashboard/ghost-runner/page.tsx");
  assert.match(page, /gt\("max_hr", 150\)/, "la FC max observée n'est plus transmise, ou n'écarte plus les capteurs qui décrochent");
});

test("le plan varie ses footings", () => {
  const src = codeOf("src/lib/ai/autoPlan.ts");
  assert.match(src, /repartirFootings\(easySlots\.length/, "la distance ne varie plus");
  // ⚠️ Le titre ET le détail dépendent de la variante : compter les occurrences, sinon
  // en remplacer une seule laisse ce test au vert (défaut trouvé par mutation).
  const n = (src.match(/varianteFooting\(rang, easySlots\.length, gardes\)/g) ?? []).length;
  assert.equal(n, 2, `${n} appel(s) à varianteFooting : le titre et le détail doivent tous deux en dépendre`);
  assert.doesNotMatch(src, /for \(const i of easySlots\) put\(i, \{\n\s*type: "Endurance", title: \(l\) => PLAN_T\[l\]\.enduranceTitre,/,
    "l'ancienne boucle qui posait la même séance partout est revenue");
});

test("les deux variantes sont traduites dans les 5 langues", () => {
  const i18n = readFileSync("src/lib/ai/planI18n.ts", "utf8");
  for (const cle of ["enduranceTitreLignes", "lignesDroites", "enduranceTitreProg", "footingProgressif"])
    assert.equal(i18n.split(`${cle}:`).length - 1, 6, `${cle} : 5 langues + le type attendus`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
