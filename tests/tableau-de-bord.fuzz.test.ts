/**
 * CRASH-TEST AU HASARD DES CALCULS DU TABLEAU DE BORD (06/11/2026).
 *
 * Cinq passages successifs sur le tableau de bord ont chacun trouvé de nouveaux défauts :
 * on vérifiait module par module, avec des données choisies à la main. Ce fichier génère
 * des MILLIERS de jeux de données au hasard — valeurs nulles, négatives, NaN, énormes,
 * dates futures, invalides, chaînes absurdes — et vérifie que chaque calcul reste sain :
 * pas d'exception, pas de NaN, pas de valeur hors de son domaine.
 *
 * La graine est FIXE : un échec se rejoue à l'identique (le message donne le cas).
 *
 *   npx tsx tests/tableau-de-bord.fuzz.test.ts
 */
import assert from "node:assert/strict";
import { computeForme } from "../src/lib/dashboard/forme";
import { computeDiscipline, statsVfc, etatDuJour, etatPhysiologique, phraseDuJour } from "../src/lib/dashboard/discipline";
import { avancementObjectif, ageJours, dansFenetre } from "../src/lib/dashboard/fenetre";
import { computeHrZones } from "../src/lib/dashboard/zones";
import { computeWeeklyTrend } from "../src/lib/dashboard/semaines";
import { computeDistancePRs, lireTemps, validerRecordDeclare, BORNES_SECONDES } from "../src/lib/dashboard/records";
import { derniereAnalyse, lienSeance } from "../src/lib/dashboard/derniereAnalyse";
import { racePredictions, loadRisk } from "../src/lib/running/fitness";
import { computeStreak } from "../src/lib/streak/compute";
import { planModifie, reecritureLue } from "../src/lib/coach/planNotifie";
import { construirePanneau } from "../src/lib/notifications/panneau";
import { niveauDeVma } from "../src/lib/running/niveau";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}

// ── Hasard reproductible (mulberry32) ───────────────────────────────────────────
let graine = 20261106;
const alea = () => { graine |= 0; graine = (graine + 0x6d2b79f5) | 0; let t = Math.imul(graine ^ (graine >>> 15), 1 | graine); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const entre = (a: number, b: number) => Math.floor(a + alea() * (b - a + 1));
const un = <T,>(xs: readonly T[]): T => xs[Math.floor(alea() * xs.length)];
const peut = (p = 0.5) => alea() < p;

const AUJ = "2026-11-06";
const decale = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Un nombre « sale » : réaliste le plus souvent, absurde parfois. */
const nombre = (lo: number, hi: number): number | null =>
  peut(0.75) ? lo + alea() * (hi - lo) : un([null, 0, -1, -1e6, 1e9, Number.NaN, Number.POSITIVE_INFINITY, 0.0001] as (number | null)[]);
/** Une date « sale » : récente le plus souvent, future, très ancienne ou invalide parfois. */
const date = (): string => peut(0.8) ? decale(AUJ, -entre(0, 120)) : un([decale(AUJ, entre(1, 400)), "1970-01-01", "pas-une-date", "", "2026-02-30", "2026-11-06T23:59:59Z", decale(AUJ, -3000)]);
const sport = () => un(["run", "Run", "trail_run", "bike", "swim", "walk", "hike", null, "", "VirtualRun", "weird"]);

function seance(i: number) {
  const km = nombre(0.5, 45);
  return {
    id: peut(0.9) ? `w${i}` : null, date: date(), sport: sport(), type: un(["easy", "interval", "race", "tempo", "long", null, "?"]),
    title: un(["Course à pied", "", null, "🏃‍♂️".repeat(entre(1, 40)), "x".repeat(entre(0, 300))]),
    distance_km: km, duration_seconds: nombre(60, 30000), avg_hr: nombre(80, 210), max_hr: nombre(100, 230),
    elevation_gain_m: nombre(0, 3000), tss: nombre(0, 400), avg_cadence_spm: nombre(140, 200),
    hr_zone_seconds: un([null, [], [600, 1200, 300, 60, 0], [Number.NaN, -5, 1e9], Array.from({ length: entre(0, 9) }, () => nombre(0, 4000))]),
    cardiac_decoupling: nombre(-10, 20),
  };
}
const seances = (n = entre(0, 60)) => Array.from({ length: n }, (_, i) => seance(i));
const vfc = () => Array.from({ length: entre(0, 30) }, (_, i) => ({ date: peut(0.9) ? decale(AUJ, -i - entre(0, 3)) : date(), hrv_ms: nombre(10, 200), physiological_state: un(["optimal", "recovery", "competition", null, "??"]) }));
const sain = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const dansLeDomaine = (v: unknown, lo: number, hi: number) => sain(v) && (v as number) >= lo && (v as number) <= hi;
const sansNaN = (s: unknown) => !/NaN|undefined|Infinity|null/.test(JSON.stringify(s) ?? "");

const TOURS = 2000;

console.log(`\nCRASH-TEST AU HASARD — ${TOURS} tours par calcul, graine ${graine}\n`);

test("score de forme : axes dans 0–100 ou absents, jamais NaN", () => {
  for (let k = 0; k < TOURS; k++) {
    const w = seances() as never[];
    const rec = nombre(0, 100), reg = peut(0.2) ? null : nombre(0, 100);
    const obj = peut(0.3) ? null : { distanceKm: nombre(1, 200), targetSeconds: nombre(600, 100000) };
    const f = computeForme(w, nombre(5, 30) ?? 0, rec, reg, obj, AUJ);
    for (const c of ["total", "endurance", "speed"] as const) assert.ok(dansLeDomaine(f[c], 0, 100), `tour ${k} : ${c} = ${f[c]}`);
    for (const c of ["recovery", "regularity"] as const) assert.ok(f[c] === null || dansLeDomaine(f[c], 0, 100), `tour ${k} : ${c} = ${f[c]}`);
    assert.ok(sansNaN({ ...f.details, chronoPreditSec: f.details.chronoPreditSec ?? 0 }), `tour ${k} : détails ${JSON.stringify(f.details)}`);
  }
});

test("score discipline : composantes dans 0–100 ou absentes, total sain", () => {
  const VERDICTS = ["tenu", "rompu", "attente", "protege", "hors", "??"];
  for (let k = 0; k < TOURS; k++) {
    const serie = peut(0.2) ? null : Array.from({ length: entre(0, 30) }, () => ({ date: date(), verdict: un(VERDICTS) }));
    const sommeil = peut(0.5) ? null : { sleep_score: nombre(0, 100) as number };
    const d = computeDiscipline(seances() as never[], vfc() as never[], sommeil, un(["optimal", "recovery", "competition", "??"]), { aujourdhui: AUJ, serie });
    assert.ok(dansLeDomaine(d.total, 0, 100), `tour ${k} : total ${d.total}`);
    for (const c of ["precision", "consistency", "recovery"] as const) assert.ok(d[c] === null || dansLeDomaine(d[c], 0, 100), `tour ${k} : ${c} = ${d[c]}`);
    assert.ok(d.details.tenues <= d.details.jugees, `tour ${k} : ${d.details.tenues} tenues sur ${d.details.jugees}`);
    assert.ok(sansNaN({ ...d.details, sommeil: 0, signalVfc: 0 }), `tour ${k} : ${JSON.stringify(d.details)}`);
  }
});

test("VFC : âge, fraîcheur et état restent cohérents", () => {
  for (let k = 0; k < TOURS; k++) {
    const h = vfc() as never[];
    const s = statsVfc(h, Date.now(), AUJ);
    assert.ok(s.jours === null || Number.isInteger(s.jours), `tour ${k} : âge ${s.jours}`);
    if (s.fraiche) assert.ok(s.jours != null && s.jours >= 0 && s.jours <= 2, `tour ${k} : fraîche à ${s.jours} jours`);
    assert.ok(["optimal", "recovery", "competition", "??"].includes(etatPhysiologique(h, Date.now(), AUJ)) || etatPhysiologique(h, Date.now(), AUJ) !== "", `tour ${k}`);
    const e = etatDuJour(nombre(-50, 50), nombre(0, 150), nombre(0, 100));
    assert.ok(["aucun", "top", "repos", "correct"].includes(e), `tour ${k} : état ${e}`);
    const p = phraseDuJour(e, peut() ? null : { qBudget: entre(0, 3), recuperation: peut() ? { course: "X", reprise: AUJ } : null });
    assert.match(p.cle, /^dash\.ready\./);
  }
});

test("série : jamais d'exception, série ≤ record, jours datés et ordonnés", () => {
  for (let k = 0; k < 600; k++) {
    const w = seances(entre(0, 40));
    const presc = Array.from({ length: entre(0, 40) }, () => ({ date: date(), sessionType: un(["Endurance", "Repos", "Récup", "Seuil", "VMA", "Renfo", "", null, "Sortie longue"]), subtitle: un(["", "Ou repos complet si tu le sens mieux.", null, "Corps : 8 km"]), moment: un([null, "matin", "soir"]) }));
    const s = computeStreak({ workouts: w as never, prescriptions: presc, feedbacks: peut() ? [] : [{ date: date(), pain: un(["genou", "aucune douleur", null, ""]) }], courses: peut(0.7) ? [] : [{ date: date(), distanceKm: nombre(1, 100) }], today: AUJ });
    assert.ok(Number.isInteger(s.current) && Number.isInteger(s.best) && s.current >= 0 && s.current <= s.best, `tour ${k} : série ${s.current}, record ${s.best}`);
    for (let i = 1; i < s.days.length; i++) assert.ok(s.days[i - 1].date < s.days[i].date, `tour ${k} : jours non ordonnés`);
    for (const j of s.days) assert.ok(j.date <= AUJ, `tour ${k} : un jour futur jugé (${j.date})`);
  }
});

test("objectif : jours restants ≥ 0, préparation dans 0–100", () => {
  for (let k = 0; k < TOURS; k++) {
    const a = avancementObjectif({ raceDate: date(), depuis: peut() ? date() : null }, AUJ, peut() ? date() : null);
    if (a) {
      assert.ok(Number.isInteger(a.joursRestants) && a.joursRestants >= 0, `tour ${k} : J-${a.joursRestants}`);
      assert.ok(a.pct === null || dansLeDomaine(a.pct, 0, 100), `tour ${k} : ${a.pct} %`);
    }
    const age = ageJours(date(), AUJ);
    assert.ok(age === null || Number.isInteger(age), `tour ${k} : âge ${age}`);
    assert.equal(typeof dansFenetre(date(), entre(-5, 60), AUJ), "boolean");
  }
});

test("zones, semaines, records, prédictions, charge : rien d'insensé à l'affichage", () => {
  for (let k = 0; k < TOURS; k++) {
    const w = seances();
    const z = computeHrZones(w as never, AUJ);
    assert.equal(z.secs.length, 5);
    for (const s of z.secs) assert.ok(sain(s) && s >= 0, `tour ${k} : zone ${s}`);
    assert.ok(Math.abs(z.total - z.secs.reduce((a, b) => a + b, 0)) < 1e-6, `tour ${k} : total des zones`);
    const t = computeWeeklyTrend(w as never, 6, AUJ);
    assert.equal(t.length, 6);
    for (const x of t) assert.ok(sain(x.km) && x.km >= 0, `tour ${k} : semaine ${x.km} km`);
    const pr = computeDistancePRs(w as never, un(["fr", "en", "de", "es", "pt"]), peut(0.7) ? [] : [{ distance: "semi", secondes: entre(3400, 28800), date: date() }]);
    assert.ok(sansNaN(pr.map((r) => r.time)), `tour ${k} : records ${JSON.stringify(pr)}`);
    const vma = nombre(5, 30);
    if (vma && vma > 0 && Number.isFinite(vma)) {
      const p = racePredictions(vma, peut() ? null : { sortieLongueKm: nombre(0, 50), volumeHebdoKm: nombre(0, 200) });
      assert.ok(sansNaN(p), `tour ${k} : prédictions ${JSON.stringify(p)} (VMA ${vma})`);
    }
    const r = loadRisk(w as never, AUJ);
    assert.ok(sain(r.acwr) && sain(r.monotony), `tour ${k} : charge ${JSON.stringify(r)}`);
    const n = niveauDeVma(nombre(1, 30));
    assert.ok(n === null || ["debutant", "intermediaire", "confirme", "elite"].includes(n));
  }
});

test("dernière analyse : toujours une séance de la liste, jamais un texte inventé", () => {
  for (let k = 0; k < TOURS; k++) {
    const w = seances(entre(0, 15));
    const analyses = Array.from({ length: entre(0, 5) }, () => ({ body: un(["Analyse.", "", null, "x".repeat(2000)]), data: peut(0.8) ? { workout_id: un(w)?.id ?? "rien", date: date() } : null }));
    const a = derniereAnalyse(w as never, analyses);
    if (!a) continue;
    assert.ok(w.includes(a.seance as never), `tour ${k} : séance hors liste`);
    if (a.texte !== null) assert.ok(analyses.some((x) => String(x.body ?? "").trim() === a.texte), `tour ${k} : texte inventé`);
    assert.doesNotMatch(lienSeance(a.seance), /undefined|NaN/, `tour ${k} : lien ${lienSeance(a.seance)}`);
  }
});

test("temps d'un record : n'importe quelle saisie → null ou des secondes entières ; aller-retour exact", () => {
  const CAR = "0123456789:hmsin'\".,’ -HMS";
  for (let k = 0; k < 20000; k++) {
    const brut = Array.from({ length: entre(0, 12) }, () => un(CAR.split(""))).join("");
    const v = lireTemps(brut, un(Object.values(BORNES_SECONDES)));
    assert.ok(v === null || (Number.isInteger(v) && v >= 0), `« ${brut} » → ${v}`);
  }
  for (let k = 0; k < TOURS; k++) {
    const s = entre(60, 32000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const deux = (x: number) => String(x).padStart(2, "0");
    assert.equal(lireTemps(`${h}:${deux(m)}:${deux(sec)}`), s, `${h}:${deux(m)}:${deux(sec)}`);
    if (h > 0) assert.equal(lireTemps(`${h}h${deux(m)}m${deux(sec)}`), s, `${h}h${deux(m)}m${deux(sec)}`);
    if (h > 0 && sec === 0) assert.equal(lireTemps(`${h}h${deux(m)}`), s, `${h}h${deux(m)}`);
    const r = validerRecordDeclare({ distance: un(["5k", "10k", "semi", "marathon", "trail"]), temps: `${h}h${deux(m)}`, secondes: peut(0.3) ? nombre(0, 40000) : undefined, date: date() }, AUJ);
    if (r) assert.ok(r.secondes >= BORNES_SECONDES[r.distance][0] && r.secondes <= BORNES_SECONDES[r.distance][1] && r.date <= AUJ, `tour ${k} : ${JSON.stringify(r)}`);
  }
});

test("notifications : un plan identique ne se réannonce pas ; le panneau reste borné", () => {
  for (let k = 0; k < TOURS; k++) {
    const plan = Array.from({ length: entre(1, 9) }, (_, i) => ({ date: decale(AUJ, i), title: un(["Repos", "Footing", "Seuil"]), body: un([null, "corps"]), moment: un([null, "matin"]), read: true }));
    assert.equal(planModifie(plan, plan), false, `tour ${k} : un plan identique est « modifié »`);
    assert.equal(reecritureLue(plan, plan.map((p) => ({ ...p, read: undefined }))), true);
    const lignes = Array.from({ length: entre(0, 60) }, (_, i) => ({ id: `n${i}`, type: un(["coach_session", "coach_message", "seance_analyse", "session_feedback", "ai_quota"]), title: un(["Repos", "", "Message"]), body: null, read: peut(), created_at: `${date() || AUJ}T0${entre(0, 9)}:00:00Z`, date: date() }));
    const e = construirePanneau(lignes, { planMaj: "Plan", seances: (n) => `${n}` });
    assert.ok(e.length <= 10 && e.filter((x) => x.type === "plan").length <= 1, `tour ${k} : ${e.length} entrées`);
    for (let i = 1; i < e.length; i++) assert.ok(e[i - 1].at >= e[i].at, `tour ${k} : panneau non trié`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
