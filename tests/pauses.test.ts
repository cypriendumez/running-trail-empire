/**
 * LES PAUSES D'UNE SÉANCE (09/11/2026).
 *
 * Cyprien : « il doit prendre en compte les pauses, sur ma montre, c'est très important ».
 * La base ne garde que le temps EN MOUVEMENT : sa séance du soir (42 min 07 en mouvement,
 * 52 min 28 du départ à l'arrivée) ne disait nulle part qu'il s'était arrêté sept fois.
 * Les arrêts sont relus sur la trace GPS déjà stockée (`lib/activities/pauses`).
 *
 * Deux pièges figés ici :
 *  · la trace est ALLÉGÉE (un point tous les 10 m) : après un arrêt, le point suivant est
 *    à 30-50 m, et le seuil de vitesse des temps intermédiaires ne voyait que 2 arrêts sur 7 ;
 *  · une montée MARCHÉE (10 m en 25 s) n'est pas un arrêt.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pausesDeTrace, pointsStockes, vitesseEnMouvement, dureeCourte, PAUSE_MIN_SEC } from "../src/lib/activities/pauses";
import type { TrackPoint } from "../src/lib/segments/geo";
import { faitsDeSeance } from "../src/lib/ai/analyseSeance";
import { lignesDeFaits, inviteAnalyse } from "../src/lib/ai/inviteAnalyse";

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

// Une trace vers le nord : 1 m de latitude ≈ 1/111 320 degré.
const DEG = 1 / 111320;
/** Construit une trace : chaque étape avance de `m` mètres en `s` secondes. */
function trace(etapes: { m: number; s: number; n?: number }[]): TrackPoint[] {
  const pts: TrackPoint[] = [{ lat: 48.85, lon: 2.35, t: 0, alt: 30 }];
  for (const e of etapes) for (let k = 0; k < (e.n ?? 1); k++) {
    const p = pts[pts.length - 1];
    pts.push({ lat: p.lat + e.m * DEG, lon: p.lon, t: p.t + e.s, alt: 30 });
  }
  return pts;
}
const COURSE = { m: 10, s: 3.3 };   // ~3 m/s, un point tous les 10 m comme à l'import

console.log("\nLES ARRÊTS SUR UNE TRACE ALLÉGÉE");

test("un arrêt de 5 min est retrouvé, à sa durée et à son kilomètre", () => {
  // 900 m de course, arrêt de 300 s, reprise : le point suivant est à 40 m (13 s de course).
  const p = pausesDeTrace(trace([{ ...COURSE, n: 90 }, { m: 40, s: 313 }, { ...COURSE, n: 90 }]), 3);
  assert.ok(p, "aucun résultat sur une trace horodatée");
  assert.equal(p!.liste.length, 1, `${p!.liste.length} arrêt(s) au lieu d'un`);
  assert.ok(Math.abs(p!.liste[0].dureeSec - 300) <= 3, `arrêt de ${p!.liste[0].dureeSec} s au lieu de ~300`);
  assert.ok(Math.abs(p!.liste[0].km - 0.9) < 0.02, `arrêt placé au km ${p!.liste[0].km}`);
  assert.equal(p!.totalSec, p!.liste[0].dureeSec);
  assert.equal(p!.plusLongueSec, p!.liste[0].dureeSec);
});

test("un arrêt d'une minute suivi d'une reprise à 50 m est vu (le seuil des temps intermédiaires le ratait)", () => {
  // 72 s pour 49 m : 0,68 m/s de moyenne sur l'intervalle, au-dessus de l'ancien seuil de 0,5.
  const p = pausesDeTrace(trace([{ ...COURSE, n: 60 }, { m: 49, s: 72 }, { ...COURSE, n: 60 }]), 3);
  assert.equal(p?.liste.length, 1, "l'arrêt mêlé à la reprise n'est pas vu");
  assert.ok(p!.liste[0].dureeSec >= 50 && p!.liste[0].dureeSec <= 60, `arrêt de ${p!.liste[0].dureeSec} s`);
});

test("une montée marchée (10 m en 25 s) n'est pas une suite d'arrêts", () => {
  const p = pausesDeTrace(trace([{ ...COURSE, n: 40 }, { m: 10, s: 25, n: 40 }, { ...COURSE, n: 40 }]), 3);
  assert.equal(p?.liste.length, 0, `${p?.liste.length} faux arrêt(s) en côte : ${JSON.stringify(p?.liste.slice(0, 3))}`);
});

test("un vrai arrêt au milieu d'une montée marchée est retrouvé", () => {
  const p = pausesDeTrace(trace([{ m: 10, s: 25, n: 30 }, { m: 12, s: 150 }, { m: 10, s: 25, n: 30 }]), 3);
  assert.equal(p?.liste.length, 1, "l'arrêt en côte n'est pas vu");
  assert.ok(Math.abs(p!.liste[0].dureeSec - 120) <= 3, `arrêt de ${p!.liste[0].dureeSec} s au lieu de ~120`);
});

test("un ralentissement bref (feu, lacet) n'est pas compté", () => {
  const p = pausesDeTrace(trace([{ ...COURSE, n: 60 }, { m: 21, s: 21 }, { ...COURSE, n: 60 }]), 3);
  assert.equal(p?.liste.length, 0, `arrêt compté sous ${PAUSE_MIN_SEC} s`);
  const p2 = pausesDeTrace(trace([{ ...COURSE, n: 200 }]), 3);
  assert.deepEqual(p2 && { n: p2.liste.length, total: p2.totalSec }, { n: 0, total: 0 }, "une course continue a des arrêts");
});

test("sans trace horodatée ni vitesse, on ne sait pas : null, jamais « aucun arrêt »", () => {
  assert.equal(pausesDeTrace(trace([{ ...COURSE, n: 5 }]), 3), null, "trace trop courte jugée");
  assert.equal(pausesDeTrace(trace([{ ...COURSE, n: 50 }]), null), null, "vitesse inconnue jugée");
  assert.equal(pausesDeTrace(trace([{ m: 10, s: 0, n: 50 }]), 3), null, "trace sans temps jugée");
  assert.equal(vitesseEnMouvement(7.249, 2527)?.toFixed(2), "2.87");
  assert.equal(vitesseEnMouvement(null, 2527), null);
  assert.equal(vitesseEnMouvement(7, 0), null);
});

test("les points stockés sont relus dans l'ordre [lat, lon, temps, altitude]", () => {
  const pts = pointsStockes([[48.85, 2.35, 0, 30, 140], [48.8501, 2.35, 4, null], ["x"], null]);
  assert.deepEqual(pts, [{ lat: 48.85, lon: 2.35, t: 0, alt: 30 }, { lat: 48.8501, lon: 2.35, t: 4 }]);
  assert.deepEqual(pointsStockes(null), []);
});

test("les durées se lisent sans ambiguïté", () => {
  assert.equal(dureeCourte(53), "53 s");
  assert.equal(dureeCourte(302), "5 min 02");
  assert.equal(dureeCourte(3725), "1 h 02");
});

console.log("\nL'ANALYSE DE SÉANCE LES REÇOIT");

const SEANCE = { date: "2026-11-09", sport: "run", distance_km: 7.249, duration_seconds: 2527, avg_hr: 142, max_hr: 171 };
const ARRETS = pausesDeTrace(trace([{ ...COURSE, n: 90 }, { m: 40, s: 313 }, { ...COURSE, n: 90 }]), 3)!;

test("les arrêts partent au modèle, pour Starter comme pour Premium", () => {
  for (const complet of [false, true]) {
    const f = faitsDeSeance(SEANCE as never, { fcMax: 204 }, [], null, undefined, undefined, undefined, ARRETS);
    const lignes = lignesDeFaits(f, "fr", complet);
    assert.match(lignes, /Arrêts relevés sur la trace GPS : 1, 5 min 0\d au total/, `ligne absente (complet=${complet}) :\n${lignes}`);
    assert.match(inviteAnalyse(f, "fr", complet), /Les ARRÊTS sont un fait, pas une faute/, "la règle de lecture des arrêts manque");
  }
});

test("sans trace, l'analyse dit qu'elle ne sait pas ; non demandés, elle se tait", () => {
  const sans = faitsDeSeance(SEANCE as never, { fcMax: 204 }, [], null, undefined, undefined, undefined, null);
  assert.ok(sans.manques.some((m) => /arrêts éventuels sont inconnus/.test(m)), "l'inconnu n'est pas dit");
  assert.doesNotMatch(lignesDeFaits(sans, "fr", true), /Aucun arrêt/, "« aucun arrêt » inventé sans trace");
  const nonDemandes = faitsDeSeance(SEANCE as never, { fcMax: 204 }, []);
  assert.ok(!nonDemandes.manques.some((m) => /arrêts/.test(m)), "des arrêts non demandés sont comptés comme inconnus");
  const continue_ = faitsDeSeance(SEANCE as never, { fcMax: 204 }, [], null, undefined, undefined, undefined, { liste: [], totalSec: 0, ecouleSec: 2527, plusLongueSec: 0 });
  assert.match(lignesDeFaits(continue_, "fr", false), /Aucun arrêt relevé sur la trace GPS/);
});

console.log("\nLES TROIS ÉCRANS LES LISENT (site d'appel)");

test("l'analyse, le coach et la page de séance appellent le calcul des arrêts", () => {
  const route = codeOf("src/app/api/ai/analyse-seance/route.ts");
  assert.match(route, /from\("activity_tracks"\)\.select\("points"\)\.eq\("workout_id", workoutId\)/, "la route ne lit plus la trace");
  assert.match(route, /intervalles, contexte, flux, arrets\)/, "les arrêts ne partent plus aux faits");
  const coach = codeOf("src/lib/ai/coachContext.ts");
  assert.match(coach, /const arretsLusDerniere = [^;]*await lireArrets\(runs\[0\]\)[^;]*;\s*const arretsDerniere = arretsLusDerniere === "illisible" \? null : arretsLusDerniere;/, "le coach ne lit plus les arrêts de la dernière séance");
  assert.match(coach, /if \(arretsDerniere\?\.liste\.length\) \{\s*const n = /, "les arrêts ne sont plus dits dans la dernière séance");
  assert.match(coach, /const COLONNES_ESSENTIELLES = "id,/, "sans l'identifiant de séance, la trace ne peut pas être lue");
  const page = codeOf("src/app/dashboard/activite/page.tsx");
  assert.match(page, /const arrets = pausesDeTrace\(pts, vitesseEnMouvement\(wk\.distance_km, wk\.duration_seconds\)\)/, "la page de séance ne calcule plus les arrêts");
  assert.match(page, /T\[langue\]\["act\.arrets"\]/, "la page n'affiche plus les arrêts");
});

test("une trace illisible part dans error_logs, sur les trois chemins", () => {
  // Relecture du 09/11 : l'erreur était avalée (coach) ou laissée à la console (route, page).
  assert.match(codeOf("src/app/api/ai/analyse-seance/route.ts"), /if \(eTrace\) \{[\s\S]{0,200}await journaliserEchec\(null, \{ source: "analyse-seance"/, "route : trace illisible non journalisée");
  assert.match(codeOf("src/lib/ai/coachContext.ts"), /if \(error\) \{[\s\S]{0,200}await journaliserEchecUneFois\(null, \{ source: "coach-arrets"/, "coach : trace illisible non journalisée");
  assert.match(codeOf("src/app/dashboard/activite/page.tsx"), /if \(eTrace\) await journaliserTraceIllisible\(user\.id, /, "page : trace illisible non journalisée");
  assert.match(codeOf("src/lib/journal/traceIllisible.ts"), /await journaliserEchecUneFois\(null, \{\s*source: "seance-trace"/, "le module de la page n'écrit plus dans error_logs");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
