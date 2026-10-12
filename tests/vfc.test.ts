/**
 * LA VFC D'UNE APPLE WATCH N'EST PLUS JETÉE, ET AUCUNE SÉRIE NE MÉLANGE SDNN ET rMSSD
 * (12/10/2026).
 *
 * Constat du 11/10/2026 : les deux chemins de synchronisation n'écrivaient une ligne de VFC
 * que si `hrv !== undefined`. Intervals.icu Companion envoie par défaut la SDNN d'une Apple
 * Watch (`hrvSDNN`, moyenne des relevés de la journée) : un jour qui n'avait QUE elle était
 * jeté. Coureur en Apple Watch = aucune VFC, aucun signal pour le coach, graphiques vides.
 *
 * Trouvé en corrigeant :
 *  · intervals.icu renvoie `"hrv": null` les jours sans mesure — champ PRÉSENT, à null
 *    (relevé sur l'API le 12/10/2026, 12 jours sur 28). `!== undefined` les laissait passer :
 *    `hrv_ms: null` dans une colonne NOT NULL, et `Math.round(null / 60)` = 0 dans
 *    `check (total_sleep_min > 0)`. Côté navigateur, le lot ENTIER était refusé, en silence.
 *  · `physiological_state` se tranchait sur des seuils ABSOLUS (< 50 ms → récupération,
 *    > 80 → compétition) ; côté navigateur, une SDNN `null` passait pour « < 40 ». Sur les
 *    77 mesures de Cyprien (médiane 90 ms) : 49 « compétition », et 14 des 16 « récupération »
 *    au-dessus de 50 ms. Les mêmes seuils classaient une SDNN d'Apple Watch « récupération ».
 *
 * Règle retenue : SDNN et rMSSD gardent chacune SA colonne ; chaque lecture passe par
 * `serieVfc`, qui choisit UNE mesure par athlète ; l'état se calcule face à SA base.
 *
 *   npx tsx tests/vfc.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ligneVfc, ligneSommeil, ETAT_ECRIT, VFC_MAX_MS, SPO2_MIN, RESPIRATION_MAX, type IcuWellness,
} from "../src/lib/intervals/wellnessRow";
import {
  serieVfc, choisirMetrique, etatRelatif, seriesParAthlete, ZONE_NORMALE_VFC, COLONNES_VFC,
  precisionMetrique, type MetriqueVfc,
} from "../src/lib/health/vfc";
import { chuteVfc, BASE_VFC_MIN } from "../src/lib/coach/recuperation";
import { statsVfc, etatPhysiologique } from "../src/lib/dashboard/discipline";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
/** Le code sans commentaires — sans couper sur `://` (cf. tests/synchro.crash.test.ts). */
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/** Le jour civil à `n` jours d'ici, « AAAA-MM-JJ ». */
const jour = (n: number, depuis = "2026-10-12") => {
  const d = new Date(`${depuis}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
};
/** Générateur déterministe : un échec doit se rejouer à l'identique. */
function alea(graine: number) {
  let s = graine >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

console.log("\nÉCRITURE — un jour qui n'a que la SDNN n'est plus perdu");

test("un jour SDNN seul (Apple Watch, réglages par défaut) produit une ligne, SDNN dans `sdnn`", () => {
  const l = ligneVfc("u", { id: "2026-10-11", hrv: null, hrvSDNN: 42.5 });
  assert.ok(l, "le jour SDNN est encore jeté");
  assert.equal(l.sdnn, 42.5);
  assert.equal(l.rmssd, null, "la SDNN est recopiée dans la colonne rMSSD");
  assert.equal(l.date, "2026-10-11");
  // `hrv_ms` est NOT NULL en base (relevé sur le schéma réel le 12/10/2026) : une ligne
  // sans elle serait refusée — c'est pour CETTE raison seulement qu'elle est remplie.
  assert.equal(l.hrv_ms, 42.5);
});

test("rMSSD et SDNN le même jour : chacune dans SA colonne", () => {
  const l = ligneVfc("u", { id: "2026-10-11", hrv: 95, hrvSDNN: 61 });
  assert.ok(l);
  assert.equal(l.rmssd, 95);
  assert.equal(l.sdnn, 61);
  assert.equal(l.hrv_ms, 95);
});

test("un jour SANS mesure — `hrv: null`, tel que l'API le renvoie — ne produit AUCUNE ligne", () => {
  for (const j of [
    { id: "2026-10-11", hrv: null, hrvSDNN: null },
    { id: "2026-10-11" },
    { id: "2026-10-11", hrv: 0, hrvSDNN: 0 },
    { id: "2026-10-11", hrv: Number.NaN },
    { id: "2026-10-11", hrv: -40 },
    { id: "2026-10-11", hrv: "95" as unknown as number },
  ] as IcuWellness[]) {
    assert.equal(ligneVfc("u", j), null, `ligne produite pour ${JSON.stringify(j)} : la base la refuserait (NOT NULL)`);
  }
});

test("une valeur aberrante ne fait pas tomber le lot (et l'autre mesure du jour survit)", () => {
  assert.equal(ligneVfc("u", { id: "2026-10-11", hrv: 25000 }), null);
  const l = ligneVfc("u", { id: "2026-10-11", hrv: VFC_MAX_MS * 3, hrvSDNN: 48 });
  assert.ok(l && l.rmssd == null && l.sdnn === 48);
});

test("une date qui n'en est pas une ne produit pas de ligne", () => {
  for (const id of [null, undefined, "", "hier", "2026-1-1", "11/10/2026"]) {
    assert.equal(ligneVfc("u", { id: id as string, hrv: 80 }), null, `date « ${id} » acceptée`);
  }
});

test("l'état écrit ne dépend plus de la valeur : plus aucun seuil absolu à l'écriture", () => {
  for (const v of [20, 38, 45, 49, 51, 79, 81, 106, 140]) {
    assert.equal(ligneVfc("u", { id: "2026-10-11", hrv: v })!.physiological_state, ETAT_ECRIT, `${v} ms`);
    assert.equal(ligneVfc("u", { id: "2026-10-11", hrvSDNN: v })!.physiological_state, ETAT_ECRIT, `SDNN ${v} ms`);
  }
});

test("une ligne produite a TOUJOURS une valeur dans `hrv_ms` (1 000 jours tirés au sort)", () => {
  const r = alea(7);
  const tirage = () => { const x = r(); return x < 0.3 ? null : x < 0.35 ? undefined : x < 0.4 ? 0 : Math.round(r() * 150 * 10) / 10; };
  for (let i = 0; i < 1000; i++) {
    const j = { id: jour(i % 90), hrv: tirage(), hrvSDNN: tirage() } as IcuWellness;
    const l = ligneVfc("u", j);
    const attendue = [j.hrv, j.hrvSDNN].some((v) => typeof v === "number" && v > 0);
    assert.equal(!!l, attendue, `jour ${JSON.stringify(j)}`);
    if (l) assert.ok(typeof l.hrv_ms === "number" && l.hrv_ms > 0, `hrv_ms vide pour ${JSON.stringify(j)}`);
  }
});

test("la forme RÉELLE de l'API (champs à null) : 16 jours mesurés → 16 lignes, 12 vides → 0", () => {
  // Disposition des jours vides relevée sur l'API le 12/10/2026 (compte éditeur, 28 jours).
  // Les valeurs sont synthétiques : seule la FORME de la réponse compte ici.
  const vides = new Set(["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-25", "2026-09-26", "2026-09-27",
    "2026-10-01", "2026-10-02", "2026-10-06", "2026-10-09", "2026-10-11", "2026-10-12"]);
  const api: IcuWellness[] = Array.from({ length: 28 }, (_, i) => {
    const id = jour(27 - i);
    return vides.has(id)
      ? { id, hrv: null, hrvSDNN: null, sleepSecs: null, sleepScore: null }
      : { id, hrv: 80 + (i % 7) * 3, hrvSDNN: null, sleepSecs: 25000 + i * 60, sleepScore: 70 + (i % 5) };
  });
  const vfc = api.map((j) => ligneVfc("u", j)).filter(Boolean);
  const nuits = api.map((j) => ligneSommeil("u", j)).filter(Boolean);
  assert.equal(vfc.length, 16);
  assert.equal(nuits.length, 16);
  assert.ok(nuits.every((n) => n!.total_sleep_min > 0), "une nuit à 0 min partirait en base (refusée par le check)");
});

test("sommeil : une nuit sans mesure ne devient plus une nuit de 0 min", () => {
  assert.equal(ligneSommeil("u", { id: "2026-10-11", sleepSecs: null }), null);
  assert.equal(ligneSommeil("u", { id: "2026-10-11", sleepSecs: 20 }), null, "20 s = 0 min : refusé par le check");
  const n = ligneSommeil("u", { id: "2026-10-11", sleepSecs: 27120, sleepScore: 85.6 });
  assert.ok(n);
  assert.equal(n.total_sleep_min, 452);
  assert.equal(n.sleep_score, 86, "un score décimal ferait échouer le smallint");
  assert.equal(n.deep_sleep_min, null, "une phase absente devient un 0 : nuit catastrophique inventée");
  assert.equal(ligneSommeil("u", { id: "2026-10-11", sleepSecs: 27000, sleepScore: 140 })!.sleep_score, null,
    "un score hors [0, 100] ferait refuser tout le lot (check)");
  assert.equal(ligneSommeil("u", { id: "2026-10-11", sleepSecs: 27000, sleepScore: 0 })!.sleep_score, null,
    "un score de 0 n'est pas une nuit notée");
});

/** Les 47 clés d'un jour wellness telles que l'API les renvoie — relevé du 12/10/2026 sur
 *  401 jours du compte éditeur, identiques au modèle `Wellness` de /api/v1/docs. Ni phases de
 *  sommeil, ni Body Battery, ni `avgSpo2` / `avgRespiration`. */
const CHAMPS_API = ["abdomen", "atl", "atlLoad", "avgSleepingHR", "baevskySI", "bloodGlucose", "bodyFat",
  "carbohydrates", "comments", "ctl", "ctlLoad", "diastolic", "fatTotal", "fatigue", "floorsClimbed", "hrv",
  "hrvSDNN", "hydration", "hydrationVolume", "id", "injury", "kcalConsumed", "lactate", "locked",
  "menstrualPhase", "menstrualPhasePredicted", "mood", "motivation", "protein", "rampRate", "readiness",
  "respiration", "restingHR", "sleepQuality", "sleepScore", "sleepSecs", "soreness", "spO2", "sportInfo",
  "steps", "stress", "systolic", "tempRestingHR", "tempWeight", "updated", "vo2max", "weight"];
/** Un jour à la forme RÉELLE : les 47 clés présentes, à null sauf celles données. */
const jourApi = (valeurs: Record<string, unknown>) =>
  ({ ...Object.fromEntries(CHAMPS_API.map((k) => [k, null])), ...valeurs }) as IcuWellness;

test("sommeil : une réponse d'API avec `spO2` et `respiration` remplit enfin leurs colonnes", () => {
  // SpO2 en % (0-100), respiration en respirations/min — décimales comme les livre une source
  // qui les mesure. Jusqu'ici lues sous `avgSpo2` / `avgRespiration` : vides pour tous.
  const n = ligneSommeil("u", jourApi({ id: "2026-10-11", sleepSecs: 27120, sleepScore: 81, sleepQuality: 2,
    avgSleepingHR: 48.5, spO2: 95.6875, respiration: 14.16 }));
  assert.ok(n);
  assert.equal(n.spo2_avg, 95.7, "la SpO2 de l'API n'atteint pas `spo2_avg`");
  assert.equal(n.respiration_rate, 14.2, "la respiration de l'API n'atteint pas `respiration_rate`");
  assert.equal(n.sleep_score, 81);
  for (const k of ["deep_sleep_min", "light_sleep_min", "rem_sleep_min", "body_battery_start", "body_battery_end"] as const) {
    assert.equal(n[k], null, `${k} rempli alors que l'API n'a pas ce champ`);
  }
  // Le compte éditeur (Forerunner 165) : les deux champs PRÉSENTS, à null — la nuit s'écrit sans eux.
  const sans = ligneSommeil("u", jourApi({ id: "2026-10-11", sleepSecs: 27120, sleepScore: 81 }));
  assert.ok(sans && sans.spo2_avg === null && sans.respiration_rate === null);
});

test("sommeil : hors de sa plage, une mesure devient NULL — jamais 0, jamais une fraction prise pour des %", () => {
  const nuit = (v: Record<string, unknown>) => ligneSommeil("u", jourApi({ id: "2026-10-11", sleepSecs: 27000, ...v }))!;
  for (const spO2 of [0.97, 0, -95, 69.9, 100.5, 150, 950, Number.NaN, Infinity, "96"]) {
    assert.equal(nuit({ spO2 }).spo2_avg, null, `SpO2 ${spO2} acceptée`);
  }
  for (const [spO2, attendu] of [[SPO2_MIN, SPO2_MIN], [88.04, 88], [100, 100]]) assert.equal(nuit({ spO2 }).spo2_avg, attendu);
  for (const respiration of [0, 0.04, -14, 60.5, 75, 1200, Number.NaN, "14"]) {
    assert.equal(nuit({ respiration }).respiration_rate, null, `respiration ${respiration} acceptée`);
  }
  for (const [respiration, attendu] of [[6.5, 6.5], [14.16, 14.2], [RESPIRATION_MAX, RESPIRATION_MAX]]) {
    assert.equal(nuit({ respiration }).respiration_rate, attendu);
  }
});

test("sommeil : 5 000 nuits tirées au sort — chaque ligne respecte les contraintes de `sleep_data`", () => {
  const r = alea(11);
  // null, absent, 0, négatif, NaN, ou n'importe quoi jusqu'à `echelle` : tout ce qui peut arriver.
  const tirage = (echelle: number) => {
    const x = r();
    return x < 0.2 ? null : x < 0.25 ? undefined : x < 0.3 ? 0 : x < 0.35 ? -r() * echelle : x < 0.4 ? Number.NaN : r() * echelle;
  };
  let spo2 = 0, respiration = 0;
  for (let i = 0; i < 5000; i++) {
    const n = ligneSommeil("u", jourApi({ id: jour(i % 120), sleepSecs: tirage(40000), sleepScore: tirage(200),
      spO2: tirage(i % 2 ? 130 : 2000), respiration: tirage(i % 2 ? 80 : 2000) }));
    if (!n) continue;
    const ctx = JSON.stringify(n);
    assert.ok(Number.isInteger(n.total_sleep_min) && n.total_sleep_min > 0, `check (total_sleep_min > 0) : ${ctx}`);
    assert.ok(n.sleep_score === null || (Number.isInteger(n.sleep_score) && n.sleep_score > 0 && n.sleep_score <= 100),
      `smallint check 0-100 : ${ctx}`);
    // numeric(4,1) : au plus 999,9, une décimale — au-delà, le lot ENTIER est refusé.
    for (const v of [n.spo2_avg, n.respiration_rate]) {
      assert.ok(v === null || (v > 0 && /^\d{1,3}(\.\d)?$/.test(String(v))), `numeric(4,1) : ${ctx}`);
    }
    assert.ok(n.spo2_avg === null || (n.spo2_avg >= SPO2_MIN && n.spo2_avg <= 100), `SpO2 hors de 70-100 % : ${ctx}`);
    assert.ok(n.respiration_rate === null || n.respiration_rate <= RESPIRATION_MAX, `respiration aberrante : ${ctx}`);
    assert.ok([n.deep_sleep_min, n.light_sleep_min, n.rem_sleep_min, n.body_battery_start, n.body_battery_end].every((v) => v === null),
      `phase ou Body Battery inventée : ${ctx}`);
    if (n.spo2_avg !== null) spo2++;
    if (n.respiration_rate !== null) respiration++;
  }
  // Un tirage qui ne remplit jamais les colonnes ne prouverait rien.
  assert.ok(spo2 > 200 && respiration > 200, `trop peu de valeurs écrites (SpO2 ${spo2}, respiration ${respiration})`);
});

test("sommeil : `ligneSommeil` et `ligneVfc` ne lisent QUE des champs que l'API renvoie", () => {
  const lus = new Set<string>();
  const espion = new Proxy(jourApi({ id: "2026-10-11", sleepSecs: 27000, sleepScore: 80, hrv: 90, hrvSDNN: 60, spO2: 96, respiration: 14 }), {
    get: (cible, cle) => { if (typeof cle === "string") lus.add(cle); return Reflect.get(cible, cle); },
  });
  assert.ok(ligneSommeil("u", espion));
  assert.ok(ligneVfc("u", espion));
  const inventes = [...lus].filter((k) => !CHAMPS_API.includes(k));
  assert.deepEqual(inventes, [], `champ(s) que l'API n'a jamais renvoyé(s) : ${inventes.join(", ")}`);
  for (const k of ["sleepSecs", "sleepScore", "spO2", "respiration"]) assert.ok(lus.has(k), `\`${k}\` n'est plus lu`);
});

test("sommeil : aucun fichier qui appelle l'API wellness n'y lit un champ qu'elle ne renvoie pas", () => {
  const lecteurs = fichiers("src").filter((f) => /\/wellness\?/.test(code(f)));
  // Un balayage qui ne trouve rien ne prouve rien : 3 lecteurs au 12/10/2026 (les deux
  // chemins de synchronisation et la génération de plan de l'espace coach).
  assert.ok(lecteurs.length >= 3, `seulement ${lecteurs.length} lecteur(s) de l'API wellness : le motif ne voit plus le code`);
  for (const f of [...lecteurs, "src/lib/intervals/wellnessRow.ts"]) {
    const m = code(f).match(/\.\s*(avgSpo2|avgRespiration|bbMax|bb|deepSleepSecs|lightSleepSecs|remSleepSecs)\b/);
    assert.equal(m, null, `${f} lit \`${m?.[1]}\`, absent de l'API intervals.icu`);
  }
});

console.log("\nLECTURE — une série, une mesure");

const sdnnSeul = (n: number, base = 42) => Array.from({ length: n }, (_, i) => ({ date: jour(i), rmssd: null, sdnn: base + (i % 4) }));
const rmssdSeul = (n: number, base = 90) => Array.from({ length: n }, (_, i) => ({ date: jour(i), rmssd: base + (i % 5) * 2, sdnn: null }));

test("Apple Watch en réglages par défaut : la série EXISTE, en SDNN", () => {
  const s = serieVfc(sdnnSeul(20));
  assert.equal(s.metrique, "sdnn");
  assert.equal(s.lignes.length, 20, "des jours SDNN manquent à la série");
  assert.ok(s.lignes.every((l) => l.hrv_ms === l.sdnn));
});

test("Garmin & co. : rMSSD, comme avant", () => {
  const s = serieVfc(rmssdSeul(20));
  assert.equal(s.metrique, "rmssd");
  assert.ok(s.lignes.every((l) => l.hrv_ms === l.rmssd));
});

test("les deux mesures chaque jour : la rMSSD, et pas une seule valeur de SDNN dans la série", () => {
  const s = serieVfc(Array.from({ length: 20 }, (_, i) => ({ date: jour(i), rmssd: 70 + i, sdnn: 40 + i })));
  assert.equal(s.metrique, "rmssd");
  assert.ok(s.lignes.every((l) => l.hrv_ms === l.rmssd), "une SDNN s'est glissée dans une série rMSSD");
});

test(`l'athlète active « Sleeping HRV » : SDNN jusqu'à ${BASE_VFC_MIN} nuits de rMSSD, puis rMSSD — JAMAIS un mélange`, () => {
  for (let nuits = 0; nuits <= 12; nuits++) {
    const lignes = Array.from({ length: 30 }, (_, i) => ({
      date: jour(i), rmssd: i < nuits ? 70 + (i % 3) : null, sdnn: 44 + (i % 4),
    }));
    const s = serieVfc(lignes);
    assert.equal(s.metrique, nuits >= BASE_VFC_MIN ? "rmssd" : "sdnn", `${nuits} nuit(s) de rMSSD`);
    const col = s.metrique as MetriqueVfc;
    assert.ok(s.lignes.every((l) => l.hrv_ms === l[col]), `${nuits} nuit(s) : la série mélange les deux mesures`);
  }
});

test("une mesure qui n'arrive plus n'est plus celle de l'athlète", () => {
  // rMSSD arrêtée il y a 5 jours (montre plus portée la nuit), SDNN continue.
  const arretRmssd = Array.from({ length: 30 }, (_, i) => ({ date: jour(i), rmssd: i >= 5 ? 75 : null, sdnn: 45 }));
  assert.equal(choisirMetrique(arretRmssd), "sdnn");
  // L'inverse : la SDNN n'arrive plus.
  const arretSdnn = Array.from({ length: 30 }, (_, i) => ({ date: jour(i), rmssd: i < 3 ? 75 : null, sdnn: i >= 6 ? 45 : null }));
  assert.equal(choisirMetrique(arretSdnn), "rmssd");
  // Mais la SDNN arrive naturellement un jour APRÈS la rMSSD : un jour d'écart n'est pas un arrêt.
  const decalage = Array.from({ length: 30 }, (_, i) => ({ date: jour(i), rmssd: 75, sdnn: i >= 1 ? 45 : null }));
  assert.equal(choisirMetrique(decalage), "rmssd");
});

test("LA PREUVE : `rmssd ?? sdnn` fabriquait une fausse chute aiguë — la série, non", () => {
  // Dix nuits en rMSSD autour de 70, puis une nuit sans montre : seule la SDNN de la
  // journée (45) arrive. Lue en `hrv_ms` brut, c'est une chute de 36 % : alerte du coach.
  const lignes = [
    { date: jour(0), rmssd: null, sdnn: 45 },
    ...Array.from({ length: 10 }, (_, i) => ({ date: jour(i + 1), rmssd: 70 + (i % 3), sdnn: 46 + (i % 2) })),
  ];
  const naif = lignes.map((l) => ({ date: l.date, hrv_ms: l.rmssd ?? l.sdnn }));
  assert.ok(chuteVfc(naif, jour(0)), "le décor ne reproduit plus le défaut : le test ne prouverait rien");
  const s = serieVfc(lignes);
  assert.equal(s.metrique, "rmssd");
  assert.equal(chuteVfc(s.lignes, jour(0)), null, "la série en une seule mesure annonce encore une chute");
});

test("aucune série ne mélange SDNN et rMSSD — 3 000 historiques tirés au sort", () => {
  // Deux plages DISJOINTES : une valeur de la mauvaise plage dans la série = un mélange.
  const r = alea(2026);
  for (let cas = 0; cas < 3000; cas++) {
    const n = 1 + Math.floor(r() * 45), pR = r(), pS = r();
    const lignes = Array.from({ length: n }, (_, i) => ({
      date: jour(i + Math.floor(r() * 2)),
      rmssd: r() < pR ? 60 + r() * 60 : null,      // [60, 120[
      sdnn: r() < pS ? 15 + r() * 40 : null,       // [15, 55[
    }));
    // Une date par jour, comme la contrainte unique (user_id, date).
    const uniques = [...new Map(lignes.map((l) => [l.date, l])).values()];
    const s = serieVfc(uniques);
    const avecMesure = uniques.filter((l) => l.rmssd != null || l.sdnn != null).length;
    if (!avecMesure) { assert.equal(s.metrique, null); assert.equal(s.lignes.length, 0); continue; }
    assert.ok(s.metrique, `cas ${cas} : aucune mesure choisie alors qu'il y en a`);
    const [bas, haut] = s.metrique === "rmssd" ? [60, 120] : [15, 55];
    for (const l of s.lignes) {
      assert.equal(l.hrv_ms, l[s.metrique], `cas ${cas} : valeur prise hors de la mesure choisie`);
      assert.ok(l.hrv_ms >= bas && l.hrv_ms < haut, `cas ${cas} : ${l.hrv_ms} ms dans une série ${s.metrique}`);
      assert.ok(["recovery", "optimal", "competition"].includes(l.physiological_state));
    }
    for (let i = 1; i < s.lignes.length; i++) assert.ok(s.lignes[i - 1].date > s.lignes[i].date, `cas ${cas} : série mal ordonnée`);
    // Ce qu'en tirent la carte et le coach reste dans la même plage.
    const sv = statsVfc(s.lignes);
    if (sv.base != null) assert.ok(sv.base >= bas - 1 && sv.base <= haut, `cas ${cas} : base ${sv.base} hors plage`);
  }
});

test("un athlète par série : l'un en SDNN, l'autre en rMSSD, sans contagion", () => {
  const m = seriesParAthlete([
    ...sdnnSeul(10).map((l) => ({ ...l, user_id: "apple" })),
    ...rmssdSeul(10).map((l) => ({ ...l, user_id: "garmin" })),
  ]);
  assert.equal(m.get("apple")?.metrique, "sdnn");
  assert.equal(m.get("garmin")?.metrique, "rmssd");
});

console.log("\nÉTAT — face à SA base, plus de seuils absolus");

test("une SDNN d'Apple Watch dans SA normale n'est plus « récupération »", () => {
  // Base autour de 40 ms : l'ancien seuil (< 50 → recovery) la condamnait chaque jour.
  const lignes = Array.from({ length: 14 }, (_, i) => ({ date: jour(i), rmssd: null, sdnn: i === 0 ? 41 : 39 + (i % 3) }));
  assert.equal(serieVfc(lignes).lignes[0].physiological_state, "optimal");
});

test("à 90 ms pour une base de 106, c'est une BAISSE — plus une « compétition »", () => {
  const lignes = Array.from({ length: 14 }, (_, i) => ({ date: jour(i), rmssd: i === 0 ? 90 : 106 + (i % 3) - 1, sdnn: null }));
  assert.equal(serieVfc(lignes).lignes[0].physiological_state, "recovery");
});

test("la zone normale est la bande de la fiche : ± 6 %", () => {
  assert.equal(ZONE_NORMALE_VFC, 0.06);
  assert.equal(etatRelatif(100, 100), "optimal");
  assert.equal(etatRelatif(94, 100), "optimal", "−6 % pile est encore dans la zone normale");
  assert.equal(etatRelatif(93.9, 100), "recovery");
  assert.equal(etatRelatif(106, 100), "optimal");
  assert.equal(etatRelatif(106.1, 100), "competition");
  assert.equal(etatRelatif(Number.NaN, 100), "optimal", "une valeur illisible n'invente pas d'état");
});

test("sans base (moins de 3 mesures), l'état reste neutre au lieu d'être inventé", () => {
  const s = serieVfc([{ date: jour(0), rmssd: 30, sdnn: null }, { date: jour(1), rmssd: 120, sdnn: null }]);
  assert.ok(s.lignes.every((l) => l.physiological_state === "optimal"));
});

test("une mesure de plus de deux jours ne décide plus de la séance du jour", () => {
  const maintenant = Date.parse(`${jour(0)}T09:00:00`);
  const recente = Array.from({ length: 14 }, (_, i) => ({ date: jour(i), hrv_ms: i === 0 ? 60 : 100, physiological_state: (i === 0 ? "recovery" : "optimal") as "recovery" | "optimal" }));
  assert.equal(etatPhysiologique(recente, maintenant), "recovery");
  const vieille = recente.map((l, i) => ({ ...l, date: jour(i + 5) }));
  assert.equal(etatPhysiologique(vieille, maintenant), "optimal", "une « récupération » vieille de 5 jours impose encore un footing");
});

console.log("\nBRANCHEMENT — tout passe par les deux modules");

const SRC = "src";
function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}
const TOUS = fichiers(SRC).map((f) => ({ f, src: code(f) }));
const ACCES = /from\(\s*["']hrv_data["']\s*\)\s*\.\s*(select|upsert|insert|update|delete)\(\s*([^)]*)\)/g;

test("aucune lecture de `hrv_data` ne lit `hrv_ms` ni l'état stocké, et toutes passent par la série", () => {
  let lectures = 0;
  for (const { f, src } of TOUS) {
    for (const m of src.matchAll(ACCES)) {
      if (m[1] !== "select") continue;
      lectures++;
      const arg = m[2].trim();
      assert.ok(!/hrv_ms|physiological_state/.test(arg), `${f} lit encore ${arg} : mesure mélangée ou état absolu`);
      if (/^["'`]date["'`]$/.test(arg)) continue;   // dates seules : repérage des trous de données
      assert.ok(/\b(serieVfc|seriesParAthlete)\(/.test(src), `${f} lit des valeurs de VFC sans passer par serieVfc`);
      if (arg !== "COLONNES_VFC" && !/^["'`]\*["'`]$/.test(arg)) {
        assert.ok(/rmssd/.test(arg) && /sdnn/.test(arg), `${f} : ${arg} ne lit pas les DEUX colonnes — impossible de choisir la mesure`);
      }
    }
  }
  // Un balayage qui ne trouve rien ne prouve rien : 14 lectures au 12/10/2026 (coach ×2,
  // accueil, fiche, Sync, kiné, cours, séance du jour, et six dans l'espace coach).
  assert.ok(lectures >= 14, `seulement ${lectures} lecture(s) trouvée(s) : le motif ne voit plus le code`);
});

test("`COLONNES_VFC` lit les deux mesures, jamais `hrv_ms`", () => {
  assert.match(COLONNES_VFC, /\brmssd\b/);
  assert.match(COLONNES_VFC, /\bsdnn\b/);
  assert.doesNotMatch(COLONNES_VFC, /hrv_ms|physiological_state/);
});

test("seuls les deux chemins de synchronisation ÉCRIVENT la VFC, et par `ligneVfc`", () => {
  const ecrivains = TOUS.filter(({ src }) => [...src.matchAll(ACCES)].some((m) => m[1] !== "select")).map(({ f }) => f).sort();
  assert.deepEqual(ecrivains, ["src/app/api/intervals/sync/route.ts", "src/lib/intervals/syncUser.ts"],
    "un troisième écrivain contournerait le tri des jours sans mesure");
  for (const f of ecrivains) {
    const src = code(f);
    assert.match(src, /ligneVfc\(/, `${f} construit encore ses lignes de VFC lui-même`);
    assert.match(src, /ligneSommeil\(/, `${f} construit encore ses nuits lui-même`);
    assert.doesNotMatch(src, /\.hrv\s*!==\s*undefined|sleepSecs\s*!==\s*undefined/, `${f} : \`null\` passe de nouveau le filtre`);
  }
});

test("plus aucun seuil ABSOLU de VFC dans le code", () => {
  for (const { f, src } of TOUS) {
    assert.doesNotMatch(src, /derivePhysiologicalState/, `${f}`);
    assert.doesNotMatch(src, /\bhrv\s*<\s*50\b|\.hrv\s*>\s*(80|55)\b|sdnn\s*<\s*40\b/, `${f} : seuil absolu de VFC`);
  }
});

test("le coach lit la série, et dit QUELLE mesure il lit", () => {
  const src = code("src/lib/ai/coachContext.ts");
  assert.match(src, /from\("hrv_data"\)\.select\(COLONNES_VFC\)/);
  assert.match(src, /serieVfc\(/);
  assert.match(src, /chuteVfc\(hrv, todayStr\)/, "la chute aiguë ne lit plus la série normalisée");
  assert.match(src, /VFC \(\$\{precisionMetrique\(metriqueVfc\)\}\)/, "le prompt ne nomme plus la mesure");
  assert.match(precisionMetrique("sdnn"), /SDNN/);
  assert.match(precisionMetrique("sdnn"), /SA propre base/);
});

test("la carte et la fiche partagent la même règle d'état", () => {
  assert.match(code("src/components/dashboard/BentoDashboard.tsx"), /const state = etatPhysiologique\(hrv\)/);
  assert.match(code("src/lib/indicateurs/fiches.ts"), /etatPhysiologique\(d\.vfc, maintenant\)/);
  assert.match(code("src/app/dashboard/page.tsx"), /hrv=\{vfc\.lignes\}/);
  assert.match(code("src/lib/indicateurs/donnees.ts"), /vfc: serie\.lignes/);
});

console.log("\nTEXTES — le réglage « Sleeping HRV (rMSSD) » est donné là où on le cherche");

const occurrences = (src: string, cle: string) => [...src.matchAll(new RegExp(`["']?${cle.replace(/\./g, "\\.")}["']?\\s*:\\s*"([^"]+)"`, "g"))].map((m) => m[1]);

test("questionnaire : le conseil existe dans les 5 langues, et dit ce qui se passe sans lui", () => {
  const textes = occurrences(readFileSync("src/app/onboarding/onboardingI18n.ts", "utf8"), "mApple4");
  assert.equal(textes.length, 5);
  for (const t of textes) {
    assert.match(t, /Sleeping HRV \(rMSSD\)/);
    assert.match(t, /Experimental/);
    assert.match(t, /SDNN/, `« ${t.slice(0, 40)}… » ne dit plus que Pacevo se rabat sur la SDNN`);
  }
});

test("Sync Montre : le conseil dans le guide Apple Watch ET quand la série est en SDNN", () => {
  const i18n = readFileSync("src/app/dashboard/sync/syncI18n.tsx", "utf8");
  for (const cle of ["s1.appleVfc", "well.sdnn"]) {
    const textes = occurrences(i18n, cle);
    assert.equal(textes.length, 5, `« ${cle} » manque à une langue`);
    for (const t of textes) assert.match(t, /Sleeping HRV \(rMSSD\)/, `${cle} : réglage absent`);
  }
  const page = code("src/app/dashboard/sync/page.tsx");
  assert.match(page, /d\["s1\.appleVfc"\]/, "le conseil n'est pas rendu dans le guide");
  assert.match(page, /metriqueVfc === "sdnn" && \(\s*<p[^>]*>\{d\["well\.sdnn"\]\}/, "le bandeau SDNN n'est pas rendu");
  assert.doesNotMatch(page, /w\.hrv > (80|55)/, "la page colore encore la VFC sur des seuils absolus");
});

test("tableau de bord et fiche VFC : la mesure est nommée, le réglage donné", () => {
  const dico = readFileSync("src/lib/i18n/translations.ts", "utf8");
  const carte = occurrences(dico, "dash.hrv.sdnn");
  assert.equal(carte.length, 5);
  for (const t of carte) assert.match(t, /Sleeping HRV \(rMSSD\)/);
  assert.match(code("src/components/dashboard/BentoDashboard.tsx"), /metriqueVfc === "sdnn"[\s\S]{0,120}t\("dash\.hrv\.sdnn"\)/);
  const fiche = occurrences(readFileSync("src/lib/indicateurs/textes.ts", "utf8"), "conseilSdnn");
  assert.equal(fiche.length, 5);
  for (const t of fiche) assert.match(t, /Sleeping HRV \(rMSSD\)/);
});

test("le coach lit sa tendance dans la MÊME zone normale que l'état, et la chute ne dit plus « ce matin »", () => {
  assert.match(code("src/lib/ai/coachContext.ts"), /const hrvTrend = [\s\S]{0,260}etatRelatif\(hrvLatest, hrvBase\)/,
    "« sous sa base → fatigue possible » à −4 % contredit de nouveau « état : optimal »");
  // Une SDNN est la moyenne de la VEILLE : « ce matin » serait faux pour un porteur d'Apple Watch.
  const motifs = [...readFileSync("src/lib/coach/reasonsI18n.ts", "utf8").matchAll(/vfcChute: \(c, v, b\) => `([^`]+)`/g)].map((m) => m[1]);
  assert.equal(motifs.length, 5);
  for (const m of motifs) assert.doesNotMatch(m, /ce matin|this morning|heute Morgen|esta mañana|esta manhã/, m);
});

console.log("\nBOUT EN BOUT — de l'API intervals.icu au coach, sans base ni réseau");

/** Un faux client Supabase : chaque table rend ses lignes, quelle que soit la requête. */
function fauxClient(tables: Record<string, unknown[]>) {
  const requete = (lignes: unknown[]) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lte", "lt", "gt", "not", "in", "or", "order", "limit", "neq", "is"]) q[m] = () => q;
    q.single = () => Promise.resolve({ data: lignes[0] ?? null, error: lignes[0] ? null : { code: "PGRST116" } });
    q.maybeSingle = () => Promise.resolve({ data: lignes[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: lignes, error: null, count: lignes.length }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(tables[t] ?? []) } as never;
}
// Le jour du COACH (Paris), pas celui d'UTC : entre minuit à Paris et minuit UTC, ils diffèrent.
const aujourdHui = () => aujourdhui(FUSEAU_DEFAUT);
const ilYa = (n: number) => jour(n, aujourdHui());
// Pas de `last_lat` : aucune requête météo, le test ne touche pas le réseau.
const PROFIL = { id: "u", age: 32, gender: "male", weight_kg: 68, preferred_language: "fr" };
const SEANCES = Array.from({ length: 24 }, (_, i) => ({
  date: ilYa(i * 2 + 1), type: "easy", sport: "run", distance_km: 10 + (i % 3) * 2, duration_seconds: 3300 + (i % 3) * 600,
  avg_hr: 145, max_hr: 172, elevation_gain_m: 60, tss: 55, hr_zone_seconds: [600, 2400, 200, 0, 0],
}));
const NUITS = Array.from({ length: 20 }, (_, i) => ({ date: ilYa(i), total_sleep_min: 430, sleep_score: 78 }));
/** Ce que la synchro écrit pour ces jours d'API — par le VRAI constructeur de lignes. */
const ecrit = (api: IcuWellness[]) => api.map((j) => ligneVfc("u", j)).filter((l): l is NonNullable<typeof l> => l != null);
async function contexteCoach(api: IcuWellness[]) {
  const { buildAthleteContext } = await import("../src/lib/ai/coachContext");
  return (await buildAthleteContext(fauxClient({ profiles: [PROFIL], workouts: SEANCES, sleep_data: NUITS, hrv_data: ecrit(api) }), "u")).text;
}
const ligneVfcDuPrompt = (texte: string) => texte.split("\n").find((l) => l.startsWith("- VFC (")) ?? "";

async function boutEnBout() {
  const cas: [string, () => Promise<void>][] = [
    ["Apple Watch par défaut (SDNN seule, un jour sur cinq sans mesure) : le coach VOIT sa VFC et sa chute", async () => {
      // La SDNN de la veille arrive le lendemain ; hier, −30 % sous sa base.
      const api: IcuWellness[] = Array.from({ length: 30 }, (_, i) => ({
        id: ilYa(i + 1), hrv: null, hrvSDNN: i % 5 === 4 ? null : i === 0 ? 30 : 41 + (i % 4),
      }));
      const texte = await contexteCoach(api);
      const vfc = ligneVfcDuPrompt(texte);
      assert.match(vfc, /^- VFC \(SDNN/, `le coach ne sait pas qu'il lit une SDNN : « ${vfc.slice(0, 60)} »`);
      assert.match(vfc, /: 30 ms/, "la dernière SDNN n'atteint pas le coach");
      assert.match(texte, /État physiologique[^\n]*: recovery/);
      assert.match(texte, /VFC en chute nette \(-30 %/, "la chute aiguë n'est pas signalée au coach");
    }],
    ["Sleeping HRV activé depuis 6 nuits : le coach lit la rMSSD seule, aucune valeur SDNN", async () => {
      const api: IcuWellness[] = Array.from({ length: 30 }, (_, i) => ({
        id: ilYa(i), hrv: i < 6 ? 68 + (i % 3) : null, hrvSDNN: i === 0 ? null : 43 + (i % 3),
      }));
      const vfc = ligneVfcDuPrompt(await contexteCoach(api));
      assert.match(vfc, /^- VFC \(rMSSD\) : 6[89] ms \(base 14j 6[89] ms/, `mélange ou mauvaise mesure : « ${vfc} »`);
    }],
    ["montre portée un jour sur deux, vieille valeur basse : l'état et la ligne VFC disent LA MÊME chose", async () => {
      // Le cas réel du 12/10/2026 : 14 MESURES remontent à près d'un mois (et à un 38 ms),
      // 14 JOURS non. L'état ne doit pas lire une autre base que la ligne qui l'accompagne.
      const api: IcuWellness[] = Array.from({ length: 40 }, (_, i) => ({
        id: ilYa(i), hrv: i % 2 ? null : i === 0 ? 83 : i === 26 ? 38 : 91, hrvSDNN: null,
      }));
      const texte = await contexteCoach(api);
      assert.match(ligneVfcDuPrompt(texte), /^- VFC \(rMSSD\) : 83 ms \(base 14j 90 ms → sous sa zone normale/);
      assert.match(texte, /État physiologique[^\n]*: recovery/, "l'état lit une autre base que la ligne VFC du même prompt");
    }],
    ["Garmin à −4 % de sa base : « dans sa zone normale », plus « fatigue possible »", async () => {
      const api: IcuWellness[] = Array.from({ length: 30 }, (_, i) => ({ id: ilYa(i), hrv: i === 0 ? 88 : 92, hrvSDNN: null }));
      const texte = await contexteCoach(api);
      assert.match(ligneVfcDuPrompt(texte), /^- VFC \(rMSSD\) : 88 ms \(base 14j 92 ms → dans sa zone normale/);
      assert.match(texte, /État physiologique[^\n]*: optimal/);
    }],
  ];
  for (const [nom, fn] of cas) {
    try { await fn(); passed++; console.log(`  OK ${nom}`); }
    catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
  }
}

boutEnBout().then(() => {
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
});
