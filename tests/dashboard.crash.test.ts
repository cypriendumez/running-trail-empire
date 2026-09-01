/**
 * CRASH-TESTS DU TABLEAU DE BORD
 *
 * Trois calculs affichaient des chiffres faux à l'athlète sans qu'aucun test ne puisse
 * les atteindre : ils vivaient dans des composants clients. Ils sont désormais dans
 * `src/lib/dashboard/`, et ce fichier les attaque avec ce que la vraie vie envoie :
 * des colonnes vides, des dates absurdes, des sports mélangés, des séances en double,
 * des valeurs négatives, des tableaux de longueur inattendue.
 *
 * Règle de lecture : un calcul a le droit de ne PAS répondre (0, null, tableau vide).
 * Il n'a jamais le droit de répondre NaN, Infinity, un négatif impossible, ou un nombre
 * qui prétend mesurer ce qu'il n'a pas mesuré.
 */
import assert from "node:assert/strict";
import { computeHrZones } from "../src/lib/dashboard/zones";
import { computeLoad, estimateTSS } from "../src/lib/dashboard/charge";
import { computeDistancePRs } from "../src/lib/dashboard/records";
import { computeForme, butDe } from "../src/lib/dashboard/forme";

let passed = 0;
const fails: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { fails.push(`${name} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${name}`); }
}
const jour = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const sain = (v: number) => Number.isFinite(v) && !Number.isNaN(v);

console.log("\nZONES — le temps en zone ne s'invente pas");

test("aucune entrée : zéro partout, jamais NaN", () => {
  const z = computeHrZones([]);
  assert.equal(z.total, 0);
  assert.equal(z.seances, 0);
  for (const s of z.secs) assert.ok(sain(s) && s === 0, "une zone vaut NaN sur un historique vide");
});

test("des séances SANS temps en zone ne produisent aucune zone — elles sont comptées à part", () => {
  // C'est la promesse centrale : quand la montre n'a rien mesuré, on ne déduit rien
  // d'une FC moyenne. On le dit, en comptant les séances écartées.
  const z = computeHrZones([
    { date: jour(1), sport: "run", hr_zone_seconds: null },
    { date: jour(2), sport: "run" },
    { date: jour(3), sport: "run", hr_zone_seconds: [] },
    { date: jour(4), sport: "run", hr_zone_seconds: [0, 0, 0, 0, 0, 0, 0] },
  ]);
  assert.equal(z.total, 0, "des zones ont été fabriquées sans mesure");
  assert.equal(z.seances, 0);
  assert.equal(z.ecartees, 4, "les séances sans mesure ne sont pas comptées comme écartées");
});

test("vélo, rando et marche n'entrent jamais dans les zones de course", () => {
  const z = computeHrZones([
    { date: jour(1), sport: "bike", hr_zone_seconds: [9000, 0, 0, 0, 0, 0, 0] },
    { date: jour(2), sport: "hike", hr_zone_seconds: [9000, 0, 0, 0, 0, 0, 0] },
    { date: jour(3), sport: "walk", hr_zone_seconds: [9000, 0, 0, 0, 0, 0, 0] },
    { date: jour(4), sport: "run", hr_zone_seconds: [600, 0, 0, 0, 0, 0, 0] },
  ]);
  assert.equal(z.total, 600, "un sport autre que la course s'est glissé dans les zones");
  assert.equal(z.seances, 1);
});

test("une montre qui renvoie 7 tranches ne perd rien : tout au-dessus de la 5e est agrégé", () => {
  const z = computeHrZones([{ date: jour(1), sport: "run", hr_zone_seconds: [10, 20, 30, 40, 50, 60, 70] }]);
  assert.equal(z.total, 280, "du temps mesuré a été perdu en route");
  assert.equal(z.secs[4], 50 + 60 + 70, "les zones hautes ne sont pas agrégées dans la dernière bande");
});

test("une montre qui renvoie moins de tranches ne fait pas planter le calcul", () => {
  const z = computeHrZones([{ date: jour(1), sport: "run", hr_zone_seconds: [100, 200] }]);
  assert.equal(z.total, 300);
  for (const s of z.secs) assert.ok(sain(s));
});

test("valeurs corrompues : null, négatif, texte, Infinity", () => {
  const z = computeHrZones([
    { date: jour(1), sport: "run", hr_zone_seconds: [100, null as never, "x" as never, Infinity as never, NaN as never] },
  ]);
  for (const s of z.secs) assert.ok(sain(s), `une zone vaut ${s}`);
  assert.ok(sain(z.total) && z.total >= 0, `le total vaut ${z.total}`);
});

test("hors fenêtre de 6 semaines : rien n'est compté", () => {
  const z = computeHrZones([{ date: jour(60), sport: "run", hr_zone_seconds: [3600, 0, 0, 0, 0] }]);
  assert.equal(z.total, 0, "une séance vieille de 60 jours entre encore dans la fenêtre");
});

test("une date illisible ne fait pas exploser le calcul", () => {
  for (const d of ["", "pas-une-date", "0000-00-00", "2026-13-45"]) {
    const z = computeHrZones([{ date: d, sport: "run", hr_zone_seconds: [600, 0, 0, 0, 0] }]);
    assert.ok(sain(z.total), `date « ${d} » → total ${z.total}`);
  }
});

console.log("\nCHARGE — un modèle qui ne suppose aucune forme de départ");

test("sans aucune séance, la charge est nulle — pas « 40 par défaut »", () => {
  const l = computeLoad([]);
  assert.equal(Math.round(l.ctl), 0, `CTL ${l.ctl} sur un historique vide : une amorce est revenue`);
  assert.equal(Math.round(l.atl), 0, `ATL ${l.atl} sur un historique vide`);
  assert.equal(Math.round(l.tsb), 0);
});

test("l'amorce ne pèse plus rien : deux longueurs d'historique donnent le même résultat", () => {
  // Le défaut d'origine : 42 jours de mise en route pour une constante de 42 jours,
  // donc 36 % du résultat venait du point de départ. Avec une vraie mise en route, le
  // même mois d'entraînement doit donner le même CTL, qu'on l'ait précédé de 60 jours
  // de repos ou de 300.
  const mois = Array.from({ length: 30 }, (_, i) => ({ date: jour(i), tss: 80 }));
  const court = computeLoad([...mois, { date: jour(60), tss: 0 }]);
  const long = computeLoad([...mois, { date: jour(360), tss: 0 }]);
  assert.ok(Math.abs(court.ctl - long.ctl) < 0.5,
    `la longueur de la mise en route change encore le CTL : ${court.ctl.toFixed(1)} vs ${long.ctl.toFixed(1)}`);
});

test("le TSS de la montre est utilisé tel quel, et les estimations sont comptées", () => {
  const l = computeLoad([
    { date: jour(1), tss: 100 },
    { date: jour(2), tss: null, type: "easy", duration_seconds: 3600 },
  ]);
  assert.equal(l.estimees, 1, "une séance estimée n'est pas déclarée comme telle");
  const l2 = computeLoad([{ date: jour(1), tss: 100 }]);
  assert.equal(l2.estimees, 0, "une séance mesurée est comptée comme estimée");
});

test("deux séances le même jour s'additionnent, elles ne s'écrasent pas", () => {
  const un = computeLoad([{ date: jour(1), tss: 100 }]);
  const deux = computeLoad([{ date: jour(1), tss: 50 }, { date: jour(1), tss: 50 }]);
  assert.ok(Math.abs(un.ctl - deux.ctl) < 1e-9, "une double séance perd la moitié de sa charge");
});

test("valeurs hostiles : TSS négatif, énorme, NaN, date absurde", () => {
  const l = computeLoad([
    { date: jour(1), tss: -500 },
    { date: jour(2), tss: 1e9 },
    { date: jour(3), tss: NaN },
    { date: "pas-une-date", tss: 100 },
    { date: jour(4), tss: null, type: null, duration_seconds: null },
  ]);
  for (const [k, v] of Object.entries({ ctl: l.ctl, atl: l.atl, tsb: l.tsb })) {
    assert.ok(sain(v), `${k} vaut ${v} sur des entrées corrompues`);
  }
  for (const h of l.history) {
    assert.ok(sain(h.ctl) && sain(h.atl) && sain(h.tsb), "un point de l'historique tracé vaut NaN");
  }
});

test("l'historique tracé fait toujours 42 points, quelle que soit la mise en route", () => {
  for (const n of [0, 1, 100, 400]) {
    const l = computeLoad(Array.from({ length: n }, (_, i) => ({ date: jour(i), tss: 50 })));
    assert.equal(l.history.length, 42, `${n} séances → ${l.history.length} points tracés`);
  }
});

test("une charge constante fait converger CTL et ATL vers cette charge", () => {
  // Vérité mathématique du modèle : à charge quotidienne constante, les deux moyennes
  // convergent vers elle et la fraîcheur tend vers zéro. Si ce n'est pas le cas, le
  // modèle n'est plus un Banister.
  const l = computeLoad(Array.from({ length: 365 }, (_, i) => ({ date: jour(i), tss: 60 })));
  assert.ok(Math.abs(l.ctl - 60) < 1, `CTL converge vers ${l.ctl.toFixed(1)} au lieu de 60`);
  assert.ok(Math.abs(l.atl - 60) < 1, `ATL converge vers ${l.atl.toFixed(1)} au lieu de 60`);
  assert.ok(Math.abs(l.tsb) < 1, `TSB vaut ${l.tsb.toFixed(1)} sur une charge parfaitement régulière`);
});

test("estimateTSS ne renvoie jamais NaN, même sans type ni durée", () => {
  for (const w of [{}, { type: "inconnu" }, { duration_seconds: null }, { duration_seconds: -3600, type: "easy" }]) {
    const v = estimateTSS(w as never);
    assert.ok(sain(v), `estimateTSS(${JSON.stringify(w)}) = ${v}`);
  }
});

console.log("\nSCORE DE FORME — un /100 doit dire contre quoi il mesure");

const seances = (n: number, km: number) => Array.from({ length: n }, (_, i) => ({ date: jour(i * 2), sport: "run", distance_km: km }));

test("sans objectif, le score annonce des repères GÉNÉRIQUES", () => {
  const f = computeForme(seances(12, 10), 17, 80, 80, null);
  assert.equal(f.reference, "general", "un repère générique est présenté comme la mesure de l'athlète");
  assert.equal(f.cibleLongueKm, null);
});

test("avec un objectif, les repères suivent la distance visée", () => {
  const dix = computeForme(seances(12, 10), 17, 80, 80, { distanceKm: 10, targetSeconds: null });
  const mara = computeForme(seances(12, 10), 17, 80, 80, { distanceKm: 42.2, targetSeconds: null });
  assert.equal(dix.reference, "objectif");
  assert.ok((dix.cibleLongueKm ?? 0) < (mara.cibleLongueKm ?? 0),
    `la cible de sortie longue ne dépend pas de l'objectif : ${dix.cibleLongueKm} vs ${mara.cibleLongueKm}`);
  // Le défaut d'origine : un coureur de 10 km bien préparé était noté sur des repères
  // de marathonien et lisait 40 % d'endurance.
  assert.ok(dix.endurance > mara.endurance,
    "à préparation égale, le coureur de 10 km n'est plus mieux noté que sur des repères marathon");
});

test("la vitesse se mesure au chrono visé quand il existe", () => {
  const sansCible = computeForme(seances(12, 10), 17, 80, 80, { distanceKm: 10, targetSeconds: null });
  const ambitieux = computeForme(seances(12, 10), 17, 80, 80, { distanceKm: 10, targetSeconds: 1800 });
  const modeste = computeForme(seances(12, 10), 17, 80, 80, { distanceKm: 10, targetSeconds: 3600 });
  assert.notEqual(ambitieux.speed, sansCible.speed, "le chrono visé ne change rien à l'axe vitesse");
  assert.ok(modeste.speed >= ambitieux.speed,
    `un objectif plus modeste doit être plus facilement atteint : ${modeste.speed} vs ${ambitieux.speed}`);
});

test("tous les axes restent bornés entre 0 et 100, quoi qu'on envoie", () => {
  const cas = [
    computeForme([], 0, 0, 0, null),
    computeForme(seances(200, 60), 30, 100, 100, { distanceKm: 5, targetSeconds: 1 }),
    computeForme(seances(1, 0), -5, -50, 500, { distanceKm: -10, targetSeconds: -1 }),
    computeForme([{ date: "pas-une-date", sport: "run", distance_km: NaN }], NaN, NaN, NaN, { distanceKm: NaN, targetSeconds: NaN }),
    computeForme([{ date: jour(1), sport: "bike", distance_km: 200 }], 17, 80, 80, null),
  ];
  for (const f of cas) {
    for (const [k, v] of Object.entries({ total: f.total, endurance: f.endurance, speed: f.speed, recovery: f.recovery, regularity: f.regularity })) {
      assert.ok(sain(v) && v >= 0 && v <= 100, `${k} vaut ${v}`);
    }
  }
});

test("le vélo n'entre pas dans le score d'un coureur", () => {
  const velo = computeForme([{ date: jour(1), sport: "bike", distance_km: 120 }], 17, 80, 80, null);
  assert.equal(velo.endurance, 0, "une sortie vélo de 120 km fait grimper l'endurance de course");
});

test("le classement des distances est cohérent", () => {
  assert.deepEqual(
    [null, 5, 10, 21.1, 42.2, 80].map((k) => butDe(k)),
    ["general", "5k", "10k", "semi", "marathon", "ultra"],
  );
});

console.log("\nRECORDS — un record est le meilleur de TOUT l'historique, ou rien");

test("aucune séance dans les bornes : aucun record annoncé", () => {
  const r = computeDistancePRs([{ date: jour(1), distance_km: 7, duration_seconds: 2000 }], "fr");
  assert.equal(r.length, 0, "un 7 km a été présenté comme un record de distance officielle");
});

test("le meilleur temps gagne, même s'il est ancien", () => {
  // C'est le défaut corrigé : la carte ne voyait que les activités récentes et
  // couronnait un footing tranquille en le nommant « record personnel ».
  const r = computeDistancePRs([
    { date: jour(1), distance_km: 10.0, duration_seconds: 2480 },   // 41:20, récent
    { date: jour(300), distance_km: 10.0, duration_seconds: 2038 }, // 33:58, ancien
  ], "fr");
  assert.equal(r.length, 1);
  assert.equal(r[0].time, "33:58", `le record annoncé est ${r[0].time} au lieu du vrai meilleur temps`);
});

test("durée nulle ou absente : la séance est ignorée, pas divisée par zéro", () => {
  const r = computeDistancePRs([
    { date: jour(1), distance_km: 10, duration_seconds: 0 },
    { date: jour(2), distance_km: 10, duration_seconds: null },
  ], "fr");
  assert.equal(r.length, 0, "une séance sans durée a produit un record");
});

test("distance nulle : aucun plantage, aucun record", () => {
  const r = computeDistancePRs([{ date: jour(1), distance_km: null, duration_seconds: 2000 }], "fr");
  assert.equal(r.length, 0);
});

test("les quatre distances sont indépendantes", () => {
  const r = computeDistancePRs([
    { date: jour(1), distance_km: 5.0, duration_seconds: 967 },
    { date: jour(2), distance_km: 10.0, duration_seconds: 2038 },
    { date: jour(3), distance_km: 21.1, duration_seconds: 4742 },
    { date: jour(4), distance_km: 42.2, duration_seconds: 10800 },
  ], "fr");
  assert.deepEqual(r.map((x) => x.label), ["5 km", "10 km", "Semi", "Marathon"]);
});

test("une date illisible ne casse pas l'affichage du record", () => {
  const r = computeDistancePRs([{ date: "pas-une-date", distance_km: 10, duration_seconds: 2038 }], "fr");
  assert.equal(r.length, 1);
  assert.ok(typeof r[0].date === "string", "la date du record n'est pas une chaîne");
});

console.log(`\n${passed} crash-test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
