/**
 * AUDIT DU PLAN RÉEL DE CYPRIEN (05/11/2026) — « vérifie tes autres choix et autres séances,
 * je vais commercialiser mon application ».
 *
 * Le plan servi ce jour-là, J+11 du marathon de Lille, sans aucune course enregistrée depuis :
 *  · 14 km visés pour la semaine d'un coureur à 70 km, une « sortie longue » de 4 km, sous
 *    un bandeau qui annonçait « 70 % de ton volume habituel » (plafond ×1,4 d'une semaine
 *    vide tombé sur son plancher de 15 km) ;
 *  · « Tes footings sont courus trop vite » sous chaque footing : le marathon lui-même pesait
 *    80 % du temps des quatorze jours ;
 *  · le jeudi et le lundi « ne te conviennent visiblement pas » : déduit des séances manquées
 *    pendant le repos d'après-course, où aucun jour n'était couru ;
 *  · fentes sautées, bondissements et nordic curls à J+12 du marathon ;
 *  · trois semaines d'affûtage pour un 5 km ;
 *  · « ta récupération cardiaque est en baisse », tendance mesurée comme du bruit le 07/09.
 *
 * Ces tests construisent le VRAI contexte du coach sur un faux client en mémoire (filtres,
 * tri et limites appliqués), sans base ni réseau.
 *
 *   npx tsx tests/plan-reprise.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { repriseApresArret, partApresArret, qualitePendantReprise, sortieHabituelleKm, sortieLongueTient, distancesAvantArret, arretLong, arretHorsEchelle, premierJourDeQualite, joursCourusPourArret, sortiesPourArret, partApresLongArret, partPlafondLongArret, plafondReplieSurPlancher, plafondPetitVolumeKm, finRegleIntensite, sortieDeRegle, repriseVolumeLongArret, dureeRepriseLongue, joursDepuisLAvantArret, ARRET_LONG_JOURS } from "../src/lib/coach/repriseArret";
import { computeQualityBudget } from "../src/lib/coach/qualityBudget";
import { MOTIF_T } from "../src/lib/coach/reasonsI18n";
import { varianteFooting, lignesRetireesParDouleur, lignesRetireesParReprise } from "../src/lib/coach/footings";
import { semainesAffutage, partAffutage, phaseDeSemaine, allegementDuBloc } from "../src/lib/coach/phase";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";
import { testVmaAEviterDe, testVmaAttendLaReprise } from "../src/lib/health/testVmaAEviter";
import { buildWorkoutDescription } from "../src/lib/watch/intervals";
import { coutQualiteKm, footingMinKm, semaineTropPetitePourQualite, qualitesTenablesAvecFooting } from "../src/lib/coach/coutSeance";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
/** Le source sans ses commentaires — sans couper les `://` des adresses. */
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

type Ligne = Record<string, unknown>;
/** Faux client PostgREST : eq, gte, lte, gt, lt, in, order, limit, single, maybeSingle. Aucune écriture. */
function fauxClient(tables: Record<string, Ligne[]>) {
  const requete = (toutes: Ligne[]) => {
    let lignes = [...toutes]; let tri: [string, boolean] | null = null; let lim: number | null = null;
    const q: Record<string, unknown> = {};
    const cmp = (op: (a: string, b: string) => boolean) => (c: string, v: unknown) => {
      lignes = lignes.filter((l) => !(c in l) || (l[c] != null && op(String(l[c]), String(v)))); return q;
    };
    for (const m of ["select", "not", "ilike", "or", "neq", "is"]) q[m] = () => q;
    q.eq = (c: string, v: unknown) => { lignes = lignes.filter((l) => !(c in l) || l[c] === v); return q; };
    q.gte = cmp((a, b) => a >= b); q.lte = cmp((a, b) => a <= b); q.gt = cmp((a, b) => a > b); q.lt = cmp((a, b) => a < b);
    q.in = (c: string, vs: unknown[]) => { lignes = lignes.filter((l) => !(c in l) || vs.includes(l[c])); return q; };
    q.order = (c: string, o?: { ascending?: boolean }) => { tri = [c, o?.ascending !== false]; return q; };
    q.limit = (n: number) => { lim = n; return q; };
    const fin = () => {
      let r = lignes;
      if (tri) {
        const [c, asc] = tri;
        r = [...r].sort((a, b) => (String(a[c] ?? "") < String(b[c] ?? "") ? -1 : String(a[c] ?? "") > String(b[c] ?? "") ? 1 : 0) * (asc ? 1 : -1));
      }
      return lim != null ? r.slice(0, lim) : r;
    };
    q.single = () => { const r = fin(); return Promise.resolve({ data: r[0] ?? null, error: r[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: fin()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: fin(), error: null }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(tables[t] ?? []) } as never;
}

/**
 * Le même faux client, mais dont la requête d'HISTORIQUE LONG (`select("date, sport, distance_km")` sur
 * `workouts`) ne rend rien : la requête a échoué. Les 60 dernières séances, elles, répondent.
 */
function fauxClientSansHistorique(tables: Record<string, Ligne[]>) {
  type Chaine = Record<string, (...a: unknown[]) => unknown>;
  const plein = fauxClient(tables) as unknown as { from: (t: string) => Chaine };
  const vide = fauxClient({}) as unknown as { from: (t: string) => Chaine };
  return { from: (t: string) => {
    const q = plein.from(t);
    if (t !== "workouts") return q;
    return { ...q, select: (cols: unknown) => (cols === "date, sport, distance_km" ? vide.from(t).select() : q) };
  } } as never;
}

// Le jour du COACH (Paris), pas celui d'UTC.
const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
/** `ilYa(5)` = il y a cinq jours ; `ilYa(-15)` = dans quinze jours. */
const ilYa = (n: number) => {
  const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
};
// ⚠️ PAS DE `last_lat` : aucune requête météo.
const PROFIL = {
  id: "u", preferred_language: "fr", full_name: "Test", age: 25, gender: "male", weight_kg: 65,
  days_per_week: 6, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true,
};
const BASE = [{ user_id: "u", vma_kmh: 19, max_hr: 200, resting_hr: 45, tested_at: ilYa(40) }];
/** Une sortie facile de 10 km. `zones` : secondes par zone (Z1→Z5). */
const sortie = (n: number, km = 10, zones = [600, 2400, 0, 0, 0]) => ({
  user_id: "u", date: ilYa(n), type: "easy", sport: "run", distance_km: km, duration_seconds: Math.round(km * 290),
  elevation_gain_m: 40, avg_hr: 140, max_hr: 160, tss: Math.round(km * 5.5), hr_zone_seconds: zones,
});
/** Six sorties de 10 km par semaine (un jour de repos sur sept) entre `de` et `a` jours. */
const reguliere = (de: number, a: number) => Array.from({ length: a - de + 1 }, (_, k) => de + k).filter((n) => n % 7 !== 3).map((n) => sortie(n));
const objectif = (data: Ligne) => ({ user_id: "u", type: "race_objective", data });
async function contexte(t: { seances: Ligne[]; notifications?: Ligne[]; profil?: Ligne }): Promise<AthleteContext> {
  return buildAthleteContext(fauxClient({
    profiles: [t.profil ?? PROFIL], performance_baselines: BASE, workouts: t.seances, notifications: t.notifications ?? [],
  }), "u");
}

async function main() {
  console.log("\nREPRISE APRÈS UN ARRÊT — Daniels : 50 % puis 75 %, aussi longtemps que l'arrêt");

  await test("moins de six jours sans courir : rien n'est perdu", () => {
    assert.equal(repriseApresArret([], AUJOURDHUI), null);
    assert.equal(repriseApresArret([ilYa(5), ilYa(6)], AUJOURDHUI), null, "cinq jours sans courir déclenchent une reprise");
  });

  await test("onze jours sans courir : reprise à 50 %, puis 75 % la semaine suivante", () => {
    // Dernière sortie il y a 12 jours : onze jours SANS COURIR (17/11/2026, l'arrêt ne compte plus aujourd'hui).
    const r = repriseApresArret([ilYa(12), ilYa(13), ilYa(15)], AUJOURDHUI);
    assert.deepEqual(r, { arretJours: 11, enCours: true, joursRepris: 0, part: 0.5, depuisJours: 12 });
    assert.equal(partApresArret(r, 7), 0.75, "la semaine suivante n'est pas à 75 %");
    assert.equal(partApresArret(r, 14), 1, "la reprise déborde la durée de l'arrêt");
  });

  await test("déjà repris : la première moitié à 50 %, la seconde à 75 %, puis plus rien", () => {
    // Onze jours sans courir (du 14ᵉ au 4ᵉ jour avant aujourd'hui), reprise il y a 3 jours.
    const avant = [ilYa(15), ilYa(16)];
    assert.equal(repriseApresArret([...avant, ilYa(3)], AUJOURDHUI)?.part, 0.5);
    assert.equal(repriseApresArret([...avant.map((d) => d), ilYa(3), ilYa(1)], AUJOURDHUI)?.arretJours, 11);
    // Après la reprise, l'athlète COURT : sinon c'est un nouvel arrêt, pas une reprise.
    const tard = [ilYa(25), ilYa(26), ilYa(13), ilYa(10), ilYa(7), ilYa(4), ilYa(1)]; // arrêt de 11 jours, reprise il y a 13 jours
    assert.equal(repriseApresArret(tard, AUJOURDHUI), null, "la reprise dure plus longtemps que l'arrêt");
    const milieu = [ilYa(20), ilYa(21), ilYa(8), ilYa(5), ilYa(2)]; // arrêt de 11 jours, reprise il y a 8 jours
    assert.equal(repriseApresArret(milieu, AUJOURDHUI)?.part, 0.75);
  });

  await test("au-delà de 28 jours, la règle change d'échelle : ce module s'abstient", () => {
    assert.equal(repriseApresArret([ilYa(35)], AUJOURDHUI), null);
    assert.equal(repriseApresArret([ilYa(50), ilYa(2)], AUJOURDHUI), null);
  });

  const HABITUDE = reguliere(11, 70); // ~60 km par semaine ; dernière sortie il y a onze jours

  await test("onze jours sans courir : la moitié de l'habitude, plus le plancher de 15 km", async () => {
    const ctx = await contexte({ seances: HABITUDE });
    const habitude = 60;
    assert.ok(Math.abs(ctx.volume.targetKm - habitude * 0.5) <= 4,
      `${ctx.volume.targetKm} km visés au lieu de ~${habitude * 0.5} (la moitié de ~${habitude} km)`);
    const motif = ctx.readiness.reasons.find((r) => /aucune course enregistrée depuis 11 jours/.test(r));
    assert.ok(motif, `l'arrêt n'est pas dit : ${JSON.stringify(ctx.readiness.reasons)}`);
    assert.match(motif!, /Si tu as couru, ta montre ne synchronise plus/, "la piste d'une montre muette n'est pas donnée");
    // Un fait, pas une fatigue : il ne colore pas le feu à lui seul.
    assert.equal(ctx.readiness.level, "vert", `feu ${ctx.readiness.level} pour un simple arrêt`);
    // Le motif part aussi dans les cinq langues du « pourquoi ».
    assert.ok(ctx.readiness.reasonsAll.some((r) => /no run recorded for 11 days/.test(r.en)), "motif absent en anglais");
  });

  await test("onze jours après un marathon sans courir : la plus basse des deux réductions, jamais leur produit", async () => {
    const lille = { race: "Marathon International de Lille", raceDate: ilYa(11), distanceKm: 42.2, officielle: true };
    const seances = [...HABITUDE.filter((s) => s.date !== ilYa(11)), { ...sortie(11, 42.5, [0, 1200, 6000, 2500, 0]), avg_hr: 172 }];
    const ctx = await contexte({ seances, notifications: [objectif(lille)] });
    assert.ok(ctx.recuperation, "précondition : pas de récupération");
    const habitude = 60;
    assert.ok(Math.abs(ctx.volume.targetKm - habitude * 0.5) <= 4,
      `${ctx.volume.targetKm} km visés au lieu de ~${habitude * 0.5} : les deux réductions se multiplient`);
    assert.ok(ctx.readiness.reasons.some((r) => /récupération après Marathon International de Lille \(J\+11\).*50 % de ton volume habituel/.test(r)),
      `le bandeau n'annonce pas la part réellement visée : ${JSON.stringify(ctx.readiness.reasons)}`);
    // La récupération borne déjà la sortie longue : son motif ne la raccourcit pas une seconde fois.
    assert.equal(ctx.volume.longRunEased, false, `sortie longue raccourcie deux fois (${ctx.volume.longRunKm} sur ${ctx.volume.longRunPlanned} km)`);
    // Le marathon n'est pas un footing couru trop vite.
    assert.equal(ctx.tooMuchIntensity, null, `« footings courus trop vite » à cause du marathon (${ctx.tooMuchIntensity} % en Z3+)`);
  });

  await test("avec un objectif à venir, la feuille de route suit aussi Daniels : 50 %, puis 75 %", async () => {
    const semi = { race: "Semi de la ville", raceDate: ilYa(-70), distanceKm: 21.1, targetTime: "1h25", targetSeconds: 5100, targetPace: "4'02/km" };
    const ctx = await contexte({ seances: HABITUDE, notifications: [objectif(semi)] });
    const [s1, s2] = ctx.macroPlan.map((w) => w.volumeKm);
    assert.ok(Math.abs(s1 - 30) <= 4, `semaine 1 : ${s1} km au lieu de ~30 (la moitié de ~60)`);
    assert.ok(Math.abs(s2 - 45) <= 5, `semaine 2 : ${s2} km au lieu de ~45 (75 % de ~60)`);
    assert.equal(ctx.volume.targetKm, s1, "le plan de la semaine ne vise pas la feuille de route");
  });

  await test("après un marathon, chaque semaine de récupération borne sa sortie longue à 30 % de son volume", async () => {
    const lille = { race: "Marathon International de Lille", raceDate: ilYa(11), distanceKm: 42.2, officielle: true };
    const cinq = { race: "5 km de la ville", raceDate: ilYa(-45), distanceKm: 5, targetTime: "17'30", targetSeconds: 1050, targetPace: "3'30/km", precedente: lille };
    const seances = [...reguliere(1, 70).filter((x) => x.date !== ilYa(11)), { ...sortie(11, 42.5, [0, 1200, 6000, 2500, 0]), avg_hr: 172 }];
    const ctx = await contexte({ seances, notifications: [objectif(cinq)] });
    assert.ok(ctx.recuperation?.fin, "précondition : pas de récupération");
    const enRecup = ctx.macroPlan.filter((_, i) => ilYa(-7 * i) < ctx.recuperation!.fin!);
    assert.ok(enRecup.length >= 2, `précondition : ${enRecup.length} semaine(s) de récupération dans la feuille de route`);
    for (const w of enRecup) {
      assert.ok(w.longRunKm <= Math.round(w.volumeKm * 0.3), `semaine ${w.week} : ${w.longRunKm} km de sortie longue pour ${w.volumeKm} km`);
    }
  });

  console.log("\nLA RÉPARTITION 80/20 NE COMPTE PAS LES COURSES");

  await test("contre-épreuve : des footings vraiment trop rapides restent signalés", async () => {
    const vite = [600, 600, 1800, 0, 0]; // 60 % du temps en Z3
    const ctx = await contexte({ seances: reguliere(1, 60).map((s) => ({ ...s, hr_zone_seconds: vite })) });
    assert.ok(ctx.tooMuchIntensity != null && ctx.tooMuchIntensity > 25, `footings à 60 % en Z3 non signalés (${ctx.tooMuchIntensity})`);
  });

  await test("deux sorties en quatorze jours ne font pas une répartition", async () => {
    const vite = [0, 600, 1800, 0, 0];
    const ctx = await contexte({ seances: [sortie(2, 10, vite), sortie(9, 10, vite), ...reguliere(20, 70)] });
    assert.equal(ctx.tooMuchIntensity, null, `verdict sur deux sorties : ${ctx.tooMuchIntensity} %`);
  });

  console.log("\nUN JOUR N'EST « RATÉ » QUE SI L'ATHLÈTE COURAIT CETTE SEMAINE-LÀ");

  const prescrit = (n: number, sessionType = "Endurance") => ({ user_id: "u", type: "coach_session", created_at: `${ilYa(n)}T04:00:00Z`, data: { date: ilYa(n), sessionType } });
  /** Les jours de la semaine (0 = dimanche) des dates `ilYa(n)`. */
  const jourDe = (n: number) => new Date(`${ilYa(n)}T12:00:00Z`).getUTCDay();

  await test("pendant un arrêt, aucun jour n'est déclaré « qui ne te convient pas »", async () => {
    // Trois semaines sans courir ; le plan prescrivait chaque jour.
    const prescriptions = Array.from({ length: 21 }, (_, k) => prescrit(k + 1));
    const ctx = await contexte({ seances: reguliere(23, 80), notifications: prescriptions });
    assert.deepEqual(ctx.skippedWeekdays, [], `jours retirés du plan pendant un arrêt : ${ctx.skippedWeekdays}`);
  });

  await test("contre-épreuve : un jour prescrit chaque semaine et jamais couru reste repéré", async () => {
    const boude = jourDe(2);
    const seances = reguliere(1, 40).filter((s) => new Date(`${s.date}T12:00:00Z`).getUTCDay() !== boude);
    const prescriptions = [2, 9, 16, 23].map((n) => prescrit(n));
    const ctx = await contexte({ seances, notifications: prescriptions });
    assert.ok(ctx.skippedWeekdays.includes(boude), `le jour boudé (${boude}) n'est plus repéré : ${ctx.skippedWeekdays}`);
  });

  console.log("\nL'AFFÛTAGE SUIT LA DISTANCE");

  await test("une semaine pour 5 et 10 km, deux pour un semi, trois pour un marathon", () => {
    assert.deepEqual([5, 10, 21.1, 42.2, null].map((d) => semainesAffutage(d)), [1, 1, 2, 3, 3]);
    assert.equal(phaseDeSemaine(0, 5), "Affûtage");
    assert.equal(phaseDeSemaine(1, 5), "Spécifique", "un 5 km affûté deux semaines");
    assert.equal(phaseDeSemaine(1, 21.1), "Affûtage");
    assert.equal(phaseDeSemaine(2, 21.1), "Spécifique", "un semi affûté trois semaines");
    assert.equal(phaseDeSemaine(2, 42.2), "Affûtage");
    assert.equal(phaseDeSemaine(2), "Affûtage", "sans distance, le comportement historique change");
    assert.deepEqual([0, 1, 2].map((s) => partAffutage(s, 42.2)), [0.40, 0.55, 0.72]);
    assert.deepEqual([0, 1].map((s) => partAffutage(s, 21.1)), [0.55, 0.75]);
    assert.deepEqual([0, 1].map((s) => partAffutage(s, 5)), [0.65, null]);
  });

  await test("un 5 km dans trois semaines : une seule semaine d'affûtage dans la feuille de route", async () => {
    const cinq = { race: "5 km de la ville", raceDate: ilYa(-20), distanceKm: 5, targetTime: "17'30", targetSeconds: 1050, targetPace: "3'30/km" };
    const ctx = await contexte({ seances: reguliere(1, 70), notifications: [objectif(cinq)] });
    const phases = ctx.macroPlan.map((w) => w.phase);
    assert.equal(phases.filter((p) => p === "Affûtage").length, 1, `phases : ${phases.join(", ")}`);
    assert.equal(ctx.cycle.taper, false, "la semaine en cours, à trois semaines d'un 5 km, est déjà un affûtage");
    // Les volumes suivent : rien n'est coupé avant la semaine de course, qui l'est.
    const v = ctx.macroPlan.map((w) => w.volumeKm);
    assert.ok(v[1] >= v[0] * 0.95, `volume coupé à deux semaines d'un 5 km : ${v.join(", ")}`);
    assert.ok(v[v.length - 1] < v[v.length - 2], `semaine de course non allégée : ${v.join(", ")}`);
  });

  // ── PAS DE SEMAINE ALLÉGÉE LA VEILLE DE L'AFFÛTAGE (09/11/2026) ──────────────────
  // Une semaine sur quatre, l'allègement du bloc tombait juste avant l'affûtage : 66 → 56 → 43 km
  // pour un 5 km dans trois semaines (ce test-ci rougissait toute la semaine ISO 46).
  await test("la règle : l'allègement du bloc saute la veille de l'affûtage, pour chaque distance", () => {
    for (const d of [5, 10, 21.1, 42.2]) {
      const n = semainesAffutage(d);
      assert.equal(allegementDuBloc(3, n, d), false, `${d} km : la veille de l'affûtage (J−${n} sem.) est de nouveau allégée`);
      assert.equal(allegementDuBloc(3, n + 1, d), true, `${d} km : une semaine allégée loin de l'affûtage a disparu`);
      assert.equal(allegementDuBloc(7, n + 5, d), true, `${d} km : la position 7 du bloc n'est plus la quatrième`);
      for (const p of [0, 1, 2]) assert.equal(allegementDuBloc(p, n + 2, d), false, `${d} km : position ${p} allégée`);
      // Pendant l'affûtage et après la course, la position 3 reste une semaine d'assimilation :
      // sinon la dose des qualités remontait en pleine semaine de course (relecture du 09/11/2026).
      for (const w of [n - 1, 0, -1]) assert.equal(allegementDuBloc(3, w, d), true, `${d} km, ${w} semaine(s) : la dose des qualités remonte pendant l'affûtage`);
    }
    assert.equal(allegementDuBloc(3, null), true, "sans objectif, la semaine allégée du bloc a disparu");
  });

  await test("la feuille de route ne coupe jamais la veille de l'affûtage, quelle que soit la semaine du bloc", async () => {
    // La course est placée à quatre échéances successives : la veille de l'affûtage tombe ainsi
    // sur chacune des quatre positions du bloc, CHAQUE jour, sans dépendre du calendrier.
    const positions = new Set<number>();
    // La semaine du bloc d'aujourd'hui, calculée comme le coach (semaine ISO).
    const blocDuJour = (() => {
      const d = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      return Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7) % 4;
    })();
    for (const d of [5, 10, 21.1, 42.2]) {
      const n = semainesAffutage(d);
      for (let k = 0; k < 4; k++) {
        const course = { race: `Course de ${d} km`, raceDate: ilYa(-(7 * (n + 1 + k) + 3)), distanceKm: d, targetTime: "1h00", targetSeconds: 3600, targetPace: "5'00/km" };
        const ctx = await contexte({ seances: reguliere(1, 70), notifications: [objectif(course)] });
        const phases = ctx.macroPlan.map((w) => w.phase);
        const v = ctx.macroPlan.map((w) => w.volumeKm);
        const iv = phases.indexOf("Affûtage") - 1;
        assert.ok(iv >= 1, `${d} km, k=${k} : pas de veille d'affûtage lisible (${phases.join(", ")})`);
        positions.add((blocDuJour + iv) % 4);
        assert.ok(v[iv] >= v[iv - 1] * 0.97, `${d} km, k=${k} : volume coupé la veille de l'affûtage : ${v.join(", ")}`);
      }
    }
    assert.ok(positions.has(3), `la veille de l'affûtage n'est jamais tombée sur la 4e semaine du bloc (${[...positions].join(", ")}) : le test ne prouve rien`);
  });

  /** Un lundi (AAAA-MM-JJ) en 4e semaine du bloc ISO, dans les cinq semaines qui viennent. */
  const lundiPosition3 = (() => {
    for (let j = 0; j < 35; j++) {
      const t = new Date(`${ilYa(-j)}T12:00:00`);
      if (t.getDay() !== 1) continue;
      const d = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      if (Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7) % 4 === 3) return ilYa(-j);
    }
    return null;
  })();
  /** Exécute `fn` comme si l'horloge marquait `jour` à 10 h (le coach lit `new Date()`). */
  async function aLaDate<T>(jour: string, fn: () => Promise<T>): Promise<T> {
    const Vrai = Date;
    const delta = new Vrai(`${jour}T10:00:00`).getTime() - Vrai.now();
    class Faux extends Vrai {
      constructor(...a: unknown[]) { if (a.length === 0) super(Vrai.now() + delta); else super(...(a as [number])); }
      static now() { return Vrai.now() + delta; }
    }
    (globalThis as { Date: DateConstructor }).Date = Faux as DateConstructor;
    try { return await fn(); } finally { (globalThis as { Date: DateConstructor }).Date = Vrai; }
  }
  const plusJours = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  await test("la semaine en cours, 4e semaine du bloc : allégée loin de la course, PAS la veille de l'affûtage", async () => {
    // L'horloge est posée sur un lundi en position 3 : le test rougit chaque jour, pas une
    // semaine sur quatre (relecture du 09/11/2026).
    assert.ok(lundiPosition3, "aucun lundi en 4e semaine du bloc dans les cinq semaines à venir");
    for (const d of [5, 21.1, 42.2]) {
      const n = semainesAffutage(d);
      // Les séances sont datées par rapport au lundi visé : sinon le coureur paraîtrait arrêté
      // (reprise), et la semaine allégée serait suspendue pour une autre raison.
      const decalage = Math.round((Date.parse(`${lundiPosition3}T12:00:00Z`) - Date.parse(`${ilYa(0)}T12:00:00Z`)) / 86400000);
      const seances = reguliere(1, 70).map((w) => ({ ...w, date: plusJours(String(w.date), decalage) }));
      const lecture = (semaines: number): Promise<AthleteContext> => aLaDate(lundiPosition3!, () => contexte({ seances, notifications: [objectif({
        race: `Course de ${d} km`, raceDate: plusJours(lundiPosition3!, 7 * semaines + 3), distanceKm: d, targetTime: "1h00", targetSeconds: 3600, targetPace: "5'00/km" })] }));
      const loin = await lecture(n + 6), veille = await lecture(n);
      assert.equal(loin.cycle.deload, true, `${d} km : précondition, la 4e semaine du bloc loin de la course n'est plus allégée`);
      assert.equal(veille.cycle.veilleAffutage, true, `${d} km à ${n} semaine(s) : la veille de l'affûtage n'est pas reconnue`);
      assert.equal(veille.cycle.deload, false, `${d} km : la veille de l'affûtage est de nouveau allégée`);
      assert.ok(/SEMAINE ALLÉGÉE/.test(loin.text) && !/SEMAINE ALLÉGÉE/.test(veille.text), `${d} km : le texte annonce une semaine allégée la veille de l'affûtage, ou plus du tout loin de la course`);
      assert.ok(veille.volume.targetKm > loin.volume.targetKm * 0.9, `${d} km : volume de la veille (${veille.volume.targetKm}) coupé comme une semaine allégée (${loin.volume.targetKm})`);
    }
  });

  await test("le renforcement de la veille de l'affûtage garde sa charge (plan bâti sur une 4e semaine du bloc)", async () => {
    // `autoPlan` calcule sa propre semaine du bloc depuis la date du plan : on lui donne un lundi
    // en position 3, et l'on compare la même semaine, veille de l'affûtage ou non.
    const lundi = lundiPosition3 ? new Date(`${lundiPosition3}T12:00:00`) : null;
    assert.ok(lundi, "aucun lundi en 4e semaine du bloc dans les cinq semaines à venir");
    const ctx = await contexte({ seances: reguliere(1, 70) });
    const series = (veille: boolean) => {
      // Quatre sorties sur sept jours disponibles : il reste des jours libres pour le renfo.
      const plan = buildWeekPlan({ ...ctx, availability: { daysPerWeek: 4, days: [0, 1, 2, 3, 4, 5, 6] }, cycle: { ...ctx.cycle, taper: false, veilleAffutage: veille } } as AthleteContext, lundi!);
      const renfo = plan.find((j) => j.type === "Renfo");
      const m = renfo?.detail.match(/(\d)×45 s/);
      return m ? Number(m[1]) : null;
    };
    const normale = series(false), veille = series(true);
    assert.equal(normale, 2, `précondition : la 4e semaine du bloc n'allège plus le renfo (${normale} séries)`);
    assert.equal(veille, 4, `la veille de l'affûtage, le renfo est encore allégé (${veille} séries au lieu de 4)`);
  });

  console.log("\nLA SORTIE LONGUE D'UN 5 KM SUIT LE VOLUME");

  await test("à 60 km par semaine, la sortie longue d'un 5 km dépasse les 12 km du pic de la course", async () => {
    const cinq = { race: "5 km de la ville", raceDate: ilYa(-70), distanceKm: 5, targetTime: "17'30", targetSeconds: 1050, targetPace: "3'30/km" };
    const seances = [...reguliere(1, 70), { ...sortie(6, 16), avg_hr: 142 }];
    const ctx = await contexte({ seances, notifications: [objectif(cinq)] });
    const plusLongue = Math.max(...ctx.macroPlan.map((w) => w.longRunKm));
    assert.ok(plusLongue > 12 && plusLongue <= 22, `sortie longue de ${plusLongue} km au plus (12 = le pic d'un 5 km pris pour un plafond)`);
  });

  console.log("\nLA SEMAINE ALLÉGÉE : UNE SEULE HORLOGE");

  /** La semaine du bloc de quatre (3 = allégée), calculée comme le coach (semaine ISO). */
  const semaineDuBloc = (() => {
    const d = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    return Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7) % 4;
  })();

  await test("feuille de route, semaine en cours et dose des qualités s'allègent la même semaine", async () => {
    const semi = { race: "Semi de la ville", raceDate: ilYa(-140), distanceKm: 21.1, targetTime: "1h25", targetSeconds: 5100, targetPace: "4'02/km" };
    const ctx = await contexte({ seances: reguliere(1, 70), notifications: [objectif(semi)] });
    const v = ctx.macroPlan.map((w) => w.volumeKm);
    assert.ok(v.length >= 8, `précondition : feuille de route de ${v.length} semaine(s)`);
    for (let i = 1; i < 7; i++) {
      const allegee = (semaineDuBloc + i) % 4 === 3;
      assert.equal(v[i] < v[i - 1], allegee, `semaine ${i + 1} : ${v[i - 1]} → ${v[i]} km, allégée attendue : ${allegee} (${v.join(", ")})`);
    }
    assert.equal(ctx.cycle.deload, semaineDuBloc === 3, "le texte « semaine allégée » ne suit pas la même horloge");
    // L'horloge se lit aussi dans le source : la date du jour ne l'exerce qu'une semaine sur quatre.
    // `semaineAllegeeDuBloc` = `allegementDuBloc(blockWeek, …)` (09/11/2026) : la même horloge.
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /const deload = !taper && semaineAllegeeDuBloc && /, "la semaine allégée a quitté l'horloge du bloc (ou ignore de nouveau la veille de l'affûtage)");
    // La dose des qualités suit la même règle, et ne fait pas de pic la veille de l'affûtage.
    // (16/11/2026 : la reprise après un ARRÊT écrit elle aussi sa séance courte.)
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /const doseReduite = semaineAllegeeDuBloc \|\| repriseCetteSemaine \|\| qualiteReprise != null \|\| marcheSortie != null;/, "la dose des qualités a quitté la règle de la semaine allégée");
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /const blocDose = veilleAffutage \? Math\.min\(blockWeek, 2\) : blockWeek;[\s\S]*base \+ blocDose \* 2/, "la veille de l'affûtage fait de nouveau un pic de qualité");
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /const semaineAllegeeDuBloc = allegementDuBloc\(blockWeek, weeksToRace, objective\?\.distanceKm\);/, "la semaine allégée a quitté l'horloge du bloc");
    assert.equal(ctx.volume.targetKm, ctx.macroPlan[0].volumeKm, "le plan de la semaine ne vise pas la feuille de route");
  });

  console.log("\nCE QUI SE DIT AU MODÈLE ET AU RENFORCEMENT");

  await test("plus aucune tendance de récupération cardiaque annoncée : c'est du bruit", async () => {
    const seances = reguliere(1, 70).map((s, k) => ({ ...s, hrr_bpm: k < 20 ? 18 : 30 }));
    const ctx = await contexte({ seances });
    assert.ok(!/RÉCUPÉRATION CARDIAQUE/.test(ctx.text), "le prompt annonce encore une tendance de récupération cardiaque");
    assert.ok(!/hrrLine/.test(codeNu("src/lib/ai/coachContext.ts")), "la ligne de tendance existe encore");
  });

  await test("pendant la récupération, ni sauts ni excentrique ; les fondations pendant la reprise", async () => {
    const ctx = await contexte({ seances: reguliere(1, 70) });
    const renfo = (c: AthleteContext) => buildWeekPlan(c, new Date()).find((j) => j.type === "Renfo")?.detail ?? "";
    const base = { ...ctx, availability: { daysPerWeek: 4, days: [0, 1, 2, 3, 4, 5, 6] } } as AthleteContext;
    const tot = renfo({ ...base, recuperation: { course: "Marathon", reprise: ilYa(-3), fin: ilYa(-15), phase: "sans-intensite" } });
    assert.ok(tot, "précondition : aucune séance de renforcement au plan");
    assert.match(tot, /RÉCUPÉRATION/);
    assert.doesNotMatch(tot, /fentes sautées|bondissements \d|nordic curls \d/i, `sauts ou excentrique pendant la récupération : ${tot}`);
    const reprise = renfo({ ...base, recuperation: { course: "Marathon", reprise: ilYa(2), fin: ilYa(-10), phase: "reprise" } });
    assert.match(reprise, /FONDATIONS/, `renforcement de reprise : ${reprise}`);
  });

  // ⚠️ 16/11/2026 (`@Sparring`, profil 7, rejoué par `@HeadCoach`) : la reprise ne bornait que le
  // volume ; le plan posait un seuil le jour même du retour après 6 à 25 jours sans courir.
  console.log("\nL'INTENSITÉ PENDANT LA REPRISE — du facile d'abord, puis une seule séance, courte");

  const reprise = (arretJours: number, joursRepris: number, enCours = false) => ({ arretJours, enCours, joursRepris, part: 0.5 });
  await test("hors reprise, aucune borne ; pas encore repris, aucune qualité", () => {
    assert.equal(qualitePendantReprise(null), null);
    assert.deepEqual(qualitePendantReprise(reprise(8, 0, true)), { max: 0, des: 7 });
    assert.deepEqual(qualitePendantReprise(reprise(25, 0, true)), { max: 0, des: 7 });
  });

  await test("arrêt court (14 jours au plus) : une qualité par semaine au plus, et pas le jour de la première sortie", () => {
    assert.equal(ARRET_LONG_JOURS, 14);
    assert.deepEqual(qualitePendantReprise(reprise(8, 0)), { max: 1, des: 1 }, "une qualité le jour même de la première sortie de reprise");
    assert.deepEqual(qualitePendantReprise(reprise(8, 2)), { max: 1, des: 0 });
    assert.deepEqual(qualitePendantReprise(reprise(14, 3)), { max: 1, des: 0 }, "14 jours d'arrêt comptent comme un arrêt long");
    // Dix jours d'arrêt ou plus : 48 h après la première sortie, pas le lendemain.
    assert.deepEqual(qualitePendantReprise(reprise(9, 0)), { max: 1, des: 1 });
    assert.deepEqual(qualitePendantReprise(reprise(12, 0)), { max: 1, des: 2 }, "un seuil le lendemain d'une seule sortie facile après douze jours d'arrêt");
    assert.deepEqual(qualitePendantReprise(reprise(12, 1)), { max: 1, des: 1 });
    assert.deepEqual(qualitePendantReprise(reprise(12, 2)), { max: 1, des: 0 });
  });

  await test("l'arrêt se compte en jours SANS COURIR, avant comme après la première sortie : 6, 14 et 28 jours bornent la même chose", () => {
    assert.equal(arretLong({ arretJours: 14 }), false);
    assert.equal(arretLong({ arretJours: 15 }), true);
    // De 4 à 32 jours depuis la dernière sortie : ce que dit la règle le jour J (pas encore repris) et ce
    // qu'elle dit une fois une sortie courue CE JOUR-LÀ doivent être la même reprise, ou la même absence.
    for (let depuis = 4; depuis <= 32; depuis++) {
      const avant = repriseApresArret([ilYa(depuis), ilYa(depuis + 2)], AUJOURDHUI);
      const apres = repriseApresArret([ilYa(depuis), ilYa(depuis + 2), AUJOURDHUI], AUJOURDHUI);
      const dedans = depuis - 1 >= 6 && depuis - 1 <= 28;
      assert.equal(avant != null, dedans, `${depuis} j depuis la dernière sortie, pas encore repris : reprise ${avant ? "annoncée" : "absente"}`);
      assert.equal(apres != null, dedans, `${depuis} j depuis la dernière sortie, sortie courue aujourd'hui : reprise ${apres ? "appliquée" : "absente"}`);
      if (!avant || !apres) continue;
      assert.deepEqual({ arret: avant.arretJours, enCours: avant.enCours, depuis: avant.depuisJours }, { arret: depuis - 1, enCours: true, depuis });
      assert.deepEqual({ arret: apres.arretJours, enCours: apres.enCours }, { arret: depuis - 1, enCours: false }, `${depuis} j : l'arrêt change en courant aujourd'hui`);
      assert.equal(arretLong(avant), arretLong(apres), `${depuis} j : arrêt long avant la sortie, court après (ou l'inverse)`);
    }
    // Les trois bornes, en clair : 6ᵉ jour (5 jours d'arrêt) rien ; 7ᵉ jour une reprise ; 15ᵉ jour encore court ; 16ᵉ long ; 29ᵉ dedans ; 30ᵉ dehors.
    assert.equal(repriseApresArret([ilYa(6)], AUJOURDHUI), null, "au 6ᵉ jour, une reprise est annoncée pour 5 jours sans courir");
    assert.equal(repriseApresArret([ilYa(7)], AUJOURDHUI)?.arretJours, 6);
    assert.equal(arretLong(repriseApresArret([ilYa(15)], AUJOURDHUI)!), false, "au 15ᵉ jour, le motif annonce la règle des arrêts longs");
    assert.equal(arretLong(repriseApresArret([ilYa(16)], AUJOURDHUI)!), true);
    assert.equal(repriseApresArret([ilYa(29)], AUJOURDHUI)?.arretJours, 28, "au 29ᵉ jour (28 jours sans courir), la reprise est oubliée");
    assert.equal(repriseApresArret([ilYa(30)], AUJOURDHUI), null);
    // Et l'intensité suit : 14 jours d'arrêt, repris aujourd'hui → une séance dans 48 h ; 15 jours → pas avant la seconde moitié.
    assert.deepEqual(qualitePendantReprise(repriseApresArret([ilYa(15), AUJOURDHUI], AUJOURDHUI)), { max: 1, des: 2 });
    assert.deepEqual(qualitePendantReprise(repriseApresArret([ilYa(16), AUJOURDHUI], AUJOURDHUI)), { max: 0, des: 7 });
  });

  // ⚠️ VISA DU DIRECTEUR SCIENTIFIQUE (17/11/2026, RENVOYÉ) : la règle d'intensité s'arrêtait à 28 jours. Après
  // 34 jours sans courir, le plan posait un seuil de 4×10 min le jour même du retour : 28 jours protégés, 29 rien.
  await test("une garde ne baisse pas quand le risque monte : au-delà de 28 jours d'arrêt, l'intensité reste bornée", () => {
    // La reprise que lit l'intensité : la règle de volume de 6 à 28 jours, l'arrêt hors échelle au-delà.
    const vue = (jours: string[]) => repriseApresArret(jours, AUJOURDHUI) ?? arretHorsEchelle(jours, AUJOURDHUI);
    // Pas encore repris, de 7 à 60 jours depuis la dernière sortie : aucune séance dure, quelle que soit la durée.
    for (let depuis = 7; depuis <= 60; depuis++) {
      assert.deepEqual(qualitePendantReprise(vue([ilYa(depuis), ilYa(depuis + 2)])), { max: 0, des: 7 }, `${depuis} j depuis la dernière sortie : une séance dure est permise avant toute sortie`);
    }
    // La règle de volume, elle, ne change pas au-delà de 28 jours : elle rend toujours `null`.
    assert.equal(repriseApresArret([ilYa(35)], AUJOURDHUI), null);
    assert.deepEqual(arretHorsEchelle([ilYa(35)], AUJOURDHUI), { arretJours: 34, enCours: true, joursRepris: 0, depuisJours: 35 });
    assert.equal(arretHorsEchelle([ilYa(20)], AUJOURDHUI), null, "un arrêt de 19 jours est lu comme hors échelle");
    // Repris depuis `repris` jours après `arret` jours sans courir : le premier jour du plan où une séance dure
    // est permise (7 = aucun dans le plan, 0 = aucune borne). JAMAIS plus tôt quand l'arrêt est plus long.
    const premierJourPermis = (arret: number, repris: number) => {
      const sorties = [ilYa(repris + arret + 1), ...Array.from({ length: Math.floor(repris / 2) + 1 }, (_, k) => ilYa(repris - 2 * k))];
      const q = qualitePendantReprise(vue(sorties));
      return q ? (q.max === 0 ? 7 : q.des) : 0;
    };
    for (let repris = 0; repris <= 30; repris++) {
      for (let arret = 6; arret < 60; arret++) {
        const court = premierJourPermis(arret, repris), long = premierJourPermis(arret + 1, repris);
        assert.ok(long >= court, `repris depuis ${repris} j : séance dure permise au jour ${long} après ${arret + 1} j d'arrêt, au jour ${court} après ${arret} j — la garde baisse quand l'arrêt s'allonge`);
      }
    }
    // 34 jours d'arrêt : rien de dur avant le 14ᵉ jour de reprise, puis une par semaine, jusqu'au 28ᵉ.
    assert.equal(premierJourDeQualite(34), 14);
    assert.equal(premierJourPermis(34, 0), 7);
    assert.equal(premierJourPermis(34, 7), 7);
    assert.equal(premierJourPermis(34, 10), 4);
    assert.equal(premierJourPermis(34, 14), 0);
    assert.deepEqual(qualitePendantReprise(vue([ilYa(34 + 14 + 1), ilYa(14), ilYa(12), ilYa(10), ilYa(8), ilYa(6), ilYa(4), ilYa(2)])), { max: 1, des: 0 });
    assert.equal(vue([ilYa(34 + 28 + 1), ...Array.from({ length: 15 }, (_, k) => ilYa(28 - 2 * k))]), null, "quatre semaines après le retour, la reprise dure encore");
    // …et pas un jour plus tôt : au 27ᵉ jour de reprise, elle est toujours en cours.
    assert.deepEqual(vue([ilYa(34 + 27 + 1), ...Array.from({ length: 14 }, (_, k) => ilYa(27 - 2 * k))]), { arretJours: 34, enCours: false, joursRepris: 27 }, "la reprise d'un arrêt de 34 jours s'arrête avant quatre semaines");
    // Même borne dans l'échelle : la reprise dure AUTANT que l'arrêt, ni un jour de moins ni un jour de plus.
    const ordinaire = (arret: number, repris: number) => repriseApresArret([ilYa(repris + arret + 1), ...Array.from({ length: Math.floor(repris / 2) + 1 }, (_, k) => ilYa(repris - 2 * k))], AUJOURDHUI);
    assert.equal(ordinaire(12, 11)?.joursRepris, 11, "une reprise de 12 jours s'arrête au 11ᵉ");
    assert.equal(ordinaire(12, 12), null, "une reprise de 12 jours dure encore au 12ᵉ jour");
    // Continuité à la borne : 28 jours d'arrêt (dans l'échelle) et 29 (hors échelle) attendent le même 14ᵉ jour.
    assert.equal(premierJourDeQualite(28), 14);
    assert.equal(premierJourDeQualite(29), 14);
    // Après dix jours d'arrêt, pas de seuil le lendemain d'une seule sortie facile : 48 h.
    assert.deepEqual([6, 9, 10, 14, 15].map(premierJourDeQualite), [1, 1, 2, 2, 8]);
  });

  await test("arrêt long (plus de 14 jours) : la qualité attend la seconde moitié de la reprise", () => {
    // 15 jours d'arrêt : la seconde moitié commence au 8ᵉ jour de reprise (`partApresArret` : jour ≥ 7,5).
    assert.deepEqual(qualitePendantReprise(reprise(15, 3)), { max: 1, des: 5 });
    assert.equal(partApresArret({ arretJours: 15, joursRepris: 3 }, 4), 0.5, "précondition : la veille est encore dans la première moitié");
    assert.equal(partApresArret({ arretJours: 15, joursRepris: 3 }, 5), 0.75, "précondition : ce jour-là est dans la seconde moitié");
    // 20 jours d'arrêt, repris aujourd'hui : la seconde moitié est à 10 jours, hors des sept jours du plan.
    assert.deepEqual(qualitePendantReprise(reprise(20, 0)), { max: 0, des: 7 });
    assert.deepEqual(qualitePendantReprise(reprise(20, 6)), { max: 1, des: 4 });
    assert.deepEqual(qualitePendantReprise(reprise(20, 10)), { max: 1, des: 0 });
  });

  await test("le budget de qualité obéit à la reprise, sans qu'aucun plancher ne le relève", () => {
    // Un coureur frais, objectif court dans trois semaines : tous les planchers jouent.
    const frais: Parameters<typeof computeQualityBudget>[0] = {
      level: "confirme", goal: "10k", phase: "SPÉCIFIQUE", noHistory: false, pains: [], seancesRecentes: 16,
      hrvDown: false, hrvUp: false, badNight: false, acr: 1, tsb: 5, rpeHigh: false, rpeAvg: 5,
      hardTimePct: null, fadeSec: null, plateau: false, noMaxEffort: false, runYears: 6,
      weightLossMaxQuality: null, hasObjective: true, daysToRace: 21, isShortGoal: true,
    };
    const libre = computeQualityBudget(frais).qBudget;
    assert.ok(libre >= 2, `précondition : ce coureur n'a que ${libre} qualité(s) hors reprise`);
    assert.equal(computeQualityBudget({ ...frais, repriseArret: { max: 0 } }).qBudget, 0);
    assert.equal(computeQualityBudget({ ...frais, repriseArret: { max: 1 } }).qBudget, 1);
    assert.equal(computeQualityBudget({ ...frais, repriseArret: null }).qBudget, libre, "sans reprise, le budget a changé");
    // La reprise ne RELÈVE rien : un budget déjà à zéro (aucun historique) y reste.
    assert.equal(computeQualityBudget({ ...frais, noHistory: true, repriseArret: { max: 1 } }).qBudget, 0);
  });

  await test("le motif de la reprise dit l'intensité, dans les cinq langues", () => {
    for (const l of Object.keys(MOTIF_T) as (keyof typeof MOTIF_T)[]) {
      const enCours = MOTIF_T[l].repriseArret("8", "50", true, 0, false), enCoursLong = MOTIF_T[l].repriseArret("20", "50", true, 0, true);
      const une = MOTIF_T[l].repriseArret("8", "50", false, 1, false), aucune = MOTIF_T[l].repriseArret("20", "50", false, 0, true);
      // Quatre situations, quatre textes : celui d'« une séance » ne sert pas à « aucune ».
      assert.equal(new Set([enCours.replace("8", "20"), enCoursLong, une, aucune]).size, 4, `${l} : deux situations de reprise ont le même texte`);
      assert.notEqual(MOTIF_T[l].repriseArret("20", "50", false, 1, true), aucune, `${l} : le texte ignore le nombre de séances permises`);
    }
    assert.match(MOTIF_T.fr.repriseArret("8", "50", true, 0, false), /sans séance dure tant que tu n'as pas refait une sortie facile/);
    // Après plus de 14 jours d'arrêt, une sortie facile ne suffit pas : le texte ne le laisse pas croire.
    assert.match(MOTIF_T.fr.repriseArret("20", "50", true, 0, true), /sans séance dure avant la seconde moitié de la reprise/);
    assert.doesNotMatch(MOTIF_T.fr.repriseArret("20", "50", true, 0, true), /tant que tu n'as pas refait une sortie facile/);
    // « Par semaine » : la borne est un budget de sept jours, pas une séance pour toute la reprise.
    assert.match(MOTIF_T.fr.repriseArret("8", "50", false, 1, false), /une seule séance de qualité par semaine au plus, courte/);
    for (const [l, mot] of [["en", /a week/], ["de", /pro Woche/], ["es", /por semana/], ["pt", /por semana/]] as const)
      assert.match(MOTIF_T[l].repriseArret("8", "50", false, 1, false), mot, `${l} : le motif promet une seule séance pour toute la reprise`);
    assert.match(MOTIF_T.fr.repriseArret("20", "50", false, 0, true), /aucune séance dure pendant la première moitié/);
    // Et le contexte lui passe le nombre que la règle a calculé, pas une constante.
    const ctxSrc = codeNu("src/lib/ai/coachContext.ts");
    assert.match(ctxSrc, /MOTIF_T\[l\]\.repriseArret\([^;]*repriseArret\.enCours, qualiteReprise\?\.max \?\? 1, arretLong\(repriseArret\), pauseAuPlancher\(\)\)\)/);
    // La séance de reprise, déjà écrite courte, n'est pas en plus « sauvée par le plancher ».
    assert.match(ctxSrc, /floored: qb\.floored && qualiteReprise == null,/);
    // La sortie habituelle se lit AVANT l'arrêt : les footings de la reprise ne la font pas baisser.
    assert.match(ctxSrc, /const habituelleKm = repriseIntensite \? sortieHabituelleKm\(distancesAvantArret\(sortiesPourArret\(histRuns, runs\), repriseIntensite, todayStr\)\) : null;/);
    // Au-delà de 28 jours : la même reprise d'intensité borne le budget, la sortie longue et le double seuil.
    assert.match(ctxSrc, /const repriseIntensite = repriseArret \?\? arretHorsEchelle\(joursArret, todayStr\);\s*const qualiteReprise = qualitePendantReprise\(repriseIntensite\);/);
    assert.match(ctxSrc, /const longRunPlanned = recup \|\| repriseIntensite \|\| plafondLongArretMord \? Math\.min\(longRunPrevu, Math\.round\(targetKm \* 0\.3\)\) : longRunPrevu;/, "après plus de 28 jours d'arrêt, la sortie longue dépasse de nouveau la semaine visée");
    assert.match(ctxSrc, /&& !repriseIntensite && !marcheSortie && !marcheCourse(?: && !noMaxEffort)?;/, "le double seuil revient pendant une reprise de plus de 28 jours");
    // Et son motif existe dans les cinq langues, distinct selon l'état.
    for (const l of Object.keys(MOTIF_T) as (keyof typeof MOTIF_T)[]) {
      const textes = [MOTIF_T[l].repriseLongArret("35", true, 0, null), MOTIF_T[l].repriseLongArret("34", false, 0, null), MOTIF_T[l].repriseLongArret("34", false, 1, null)];
      assert.equal(new Set(textes).size, 3, `${l} : deux états d'une longue reprise ont le même texte`);
      assert.ok(textes.every((t) => !/%/.test(t)), `${l} : un pourcentage de volume est annoncé au-delà de 28 jours alors qu'aucun plafond n'est passé au texte`);
    }
    assert.match(MOTIF_T.fr.repriseLongArret("35", true, 0, null), /sans séance dure pendant les deux premières semaines de reprise/);
    // La seule séance de la semaine est le seuil, comme après une course ; et l'invite ne parle
    // pas d'une « sortie longue de ~0 km » quand la reprise l'a retirée.
    assert.match(ctxSrc, /if \(repriseCetteSemaine \|\| qualiteReprise != null\) menu = \[qSeuil, \.\.\.menu\.filter\(\(m\) => m !== qSeuil\)\];/);
    assert.match(ctxSrc, /\$\{longRunKm > 0 \? `dont une sortie longue de ~\$\{longRunKm\} km` : "SANS sortie longue cette semaine/);
    // Une sortie longue retirée par la reprise n'est ni « raccourcie » ni attribuée à une douleur.
    assert.match(ctxSrc, /const longRunEased = !longueRetiree && longRunKm < longRunPlanned;/);
    assert.match(ctxSrc, /sortieLongue: !longueRetiree && longRunKm < longueSansDouleur \?/);
  });

  await test("tant qu'aucune séance dure n'est permise, les footings restent simples, et le plan reçoit l'état de la reprise", () => {
    // Précondition : hors reprise, le deuxième footing porte des lignes droites, le troisième est progressif.
    assert.equal(varianteFooting(1, 4, {}), "lignes");
    assert.equal(varianteFooting(2, 4, {}), "progressif");
    assert.equal(varianteFooting(1, 4, { reprise: true }), "base");
    assert.equal(varianteFooting(2, 4, { reprise: true }), "base");
    // La douleur n'a rien retiré que la reprise n'avait déjà retiré.
    assert.equal(lignesRetireesParDouleur(3, {}), true);
    assert.equal(lignesRetireesParDouleur(3, { reprise: true }), false);
    const plan = codeNu("src/lib/ai/autoPlan.ts"), ctxSrc = codeNu("src/lib/ai/coachContext.ts"), coach = codeNu("src/lib/ai/autoCoach.ts");
    assert.match(plan, /const canSpice = [^;]*&& !ctx\.weekPlan\.repriseArret(?: && !ctx\.effortMaximalInterdit)?;/, "la sortie longue peut de nouveau porter un bloc d'allure pendant une reprise");
    // La garde est PAR JOUR : tout footing placé avant le premier jour où une séance dure est permise.
    assert.match(plan, /const gardesDu = \(i: number\) => \(\{ \.\.\.gardes, reprise: !!ctx\.weekPlan\.repriseArret && i < debutQualite \}\);/);
    assert.equal((plan.match(/varianteFooting\(rang, easySlots\.length, gardesDu\(i\)\)/g) ?? []).length, 2, "le titre ou le détail d'un footing ne lit plus la garde du jour");
    // L'écran Santé : la reprise a déjà retiré les lignes droites si le DEUXIÈME footing tombe avant le jour permis.
    assert.equal(lignesRetireesParReprise({ reprise: false, deuxiemeFootingJour: 2, qualiteDes: 7 }), false, "hors reprise, la reprise retire quelque chose");
    assert.equal(lignesRetireesParReprise({ reprise: true, deuxiemeFootingJour: 2, qualiteDes: 4 }), true, "deuxième footing au jour 2, séance dure permise au jour 4 : la douleur se voit attribuer les lignes droites");
    assert.equal(lignesRetireesParReprise({ reprise: true, deuxiemeFootingJour: 4, qualiteDes: 4 }), false, "le jour permis, le footing peut de nouveau porter des lignes droites");
    assert.equal(lignesRetireesParReprise({ reprise: true, deuxiemeFootingJour: 5, qualiteDes: 4 }), false);
    assert.equal(lignesRetireesParReprise({ reprise: true, deuxiemeFootingJour: 2, qualiteDes: 0 }), false);
    assert.equal(lignesRetireesParReprise({ reprise: true, deuxiemeFootingJour: null, qualiteDes: 4 }), true);
    assert.match(coach, /reprise: lignesRetireesParReprise\(\{ reprise: !!ctx\.weekPlan\.repriseArret, qualiteDes: ctx\.weekPlan\.qualiteDes \?\? 0,\s*deuxiemeFootingJour: deuxieme == null \? null : ecartJours\(deuxieme, today\) \}\) \}\);/, "l'écran Santé attribue de nouveau à la douleur des lignes droites que la reprise a retirées");
    assert.match(ctxSrc, /\.\.\.\(qualiteReprise \|\| footingsSeuls \? \{ repriseArret: !qualiteReprise \|\| qualiteReprise\.max === 0 \|\| footingsSeuls \? "sans-qualite" as const : "une-qualite" as const \} : \{\}\),/);
  });

  await test("une « sortie longue » plus courte que la sortie habituelle n'en est pas une", () => {
    assert.equal(sortieHabituelleKm([9, 9, 12, 9, 6]), 9);
    assert.equal(sortieHabituelleKm([8, 10]), 9, "médiane d'un nombre pair de sorties");
    assert.equal(sortieHabituelleKm([]), null);
    assert.equal(sortieHabituelleKm([null, undefined, 0, NaN]), null, "une distance inconnue devient une sortie habituelle");
    assert.equal(sortieLongueTient(4, 9), false);
    assert.equal(sortieLongueTient(9, 9), true, "une sortie longue égale à la sortie habituelle ne tient plus");
    assert.equal(sortieLongueTient(12, 9), true);
    // Sans sortie habituelle connue, on ne tranche pas.
    assert.equal(sortieLongueTient(4, null), true);
    // La sortie habituelle se lit sur les huit semaines d'AVANT l'arrêt, jamais sur la reprise.
    const sorties = [
      { date: ilYa(1), distance_km: 5 }, { date: ilYa(3), distance_km: 5 },             // la reprise : footings courts
      { date: ilYa(15), distance_km: 12 }, { date: ilYa(17), distance_km: 10 },          // juste avant l'arrêt de 11 jours
      { date: ilYa(70), distance_km: 10 }, { date: ilYa(69), distance_km: 30 },          // dans les huit semaines d'avant (14 + 56 = 70 jours)
      { date: ilYa(71), distance_km: 40 },                                                // un jour trop ancien
    ];
    const r = repriseApresArret(sorties.map((w) => w.date), AUJOURDHUI)!;
    assert.deepEqual({ arret: r.arretJours, repris: r.joursRepris }, { arret: 11, repris: 3 }, "précondition : la reprise simulée n'est pas celle attendue");
    assert.deepEqual(distancesAvantArret(sorties, r, AUJOURDHUI), [12, 10, 10, 30], "la sortie habituelle compte la reprise, ou oublie les semaines d'avant");
    assert.equal(sortieHabituelleKm(distancesAvantArret(sorties, r, AUJOURDHUI)), 11);
    // Pas encore repris : toutes les sorties précèdent l'arrêt.
    const arrete = repriseApresArret([ilYa(8), ilYa(10)], AUJOURDHUI)!;
    assert.deepEqual(distancesAvantArret([{ date: ilYa(8), distance_km: 9 }, { date: ilYa(10), distance_km: 7 }], arrete, AUJOURDHUI), [9, 7]);
  });

  // ⚠️ RÉSERVE DU DIRECTEUR SCIENTIFIQUE (17/11/2026) : l'arrêt se lisait sur les 60 DERNIÈRES SÉANCES,
  // tous sports confondus. Un coureur blessé qui pédale chaque jour en fait sortir toutes ses courses :
  // plus d'arrêt visible, plus de garde. Ces tests passent par le VRAI contexte et le faux client, qui
  // applique la limite de 60 séances et la fenêtre de 190 jours de l'historique long.
  const velo = (n: number) => ({ user_id: "u", date: ilYa(n), type: "ride", sport: "bike", distance_km: 30,
    duration_seconds: 4200, elevation_gain_m: 200, avg_hr: 125, max_hr: 145, tss: 45 });
  /** Deux sorties à vélo par jour, du jour `de` au jour `a` (inclus). */
  const velos = (de: number, a: number) => Array.from({ length: a - de + 1 }, (_, k) => de + k).flatMap((n) => [velo(n), velo(n)]);
  const DUR = /VMA|Seuil|Sp[ée]cifique|Allure|C[oô]te/i;
  const dures = (ctx: AthleteContext) => buildWeekPlan(ctx, new Date(`${AUJOURDHUI}T08:00:00Z`)).filter((d) => DUR.test(d.type)).map((d) => `${d.date} ${d.title}`);

  await test("soixante sorties à vélo n'effacent pas l'arrêt : la garde d'intensité tient sur l'historique long", async () => {
    // Coureur régulier, puis 40 jours SANS COURIR à deux sorties à vélo par jour, puis une reprise d'une course par jour.
    const cas = (repris: number) => {
      const reprise = Array.from({ length: repris }, (_, k) => sortie(repris - k, 8));
      return { reprise, seances: [...reguliere(repris + 41, repris + 110), ...velos(repris + 1, repris + 40), ...reprise] };
    };
    const jourDe = (ctx: AthleteContext, titre: string) => {
      const jours = [...new Set(buildWeekPlan(ctx, new Date(`${AUJOURDHUI}T08:00:00Z`)).map((d) => d.date))].sort();
      return jours.indexOf(titre.slice(0, 10));
    };
    /** Rang (0 = aujourd'hui) de la première séance dure du plan ; Infinity s'il n'y en a aucune. */
    const premiereDure = (ctx: AthleteContext) => Math.min(Infinity, ...dures(ctx).map((t) => jourDe(ctx, t)));
    // `permis` : le premier jour du plan où la garde autorise une séance dure (7 = aucun), voir plus bas.
    for (const [repris, permis] of [[4, 7], [8, 6]] as const) {
      const { reprise, seances } = cas(repris);
      // Précondition : les 60 dernières séances ne portent plus que les courses de la REPRISE.
      const recentes = [...seances].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 60);
      assert.deepEqual(recentes.filter((w) => w.sport === "run").map((w) => w.date).sort(), reprise.map((w) => w.date).sort(), `repris depuis ${repris} j : précondition, les 60 dernières séances voient encore une course d'avant l'arrêt`);
      // Contre-poids : sans les courses d'avant l'arrêt (rien à protéger), le même plan pose bien une séance dure
      // AVANT le jour que la garde autorise. ⚠️ Pas « aujourd'hui » : selon le jour de la semaine, elle tombe
      // un peu plus tard (rejoué à l'horloge décalée : le test rougissait deux jours sur sept).
      const sansAvant = await contexte({ seances: [...velos(repris + 1, repris + 40), ...reprise] });
      assert.equal(sansAvant.weekPlan.repriseArret, undefined, `repris depuis ${repris} j : précondition, une reprise est vue sans aucun arrêt`);
      assert.ok(premiereDure(sansAvant) < permis, `repris depuis ${repris} j : précondition, sans la garde aucune séance dure avant le jour ${permis} du plan, le test ne prouverait rien (${dures(sansAvant).join(", ") || "aucune"})`);
    }
    // 4ᵉ jour de reprise après 40 jours d'arrêt : le 14ᵉ jour est hors des sept jours du plan, rien de dur.
    const tot = await contexte({ seances: cas(4).seances });
    assert.equal(tot.weekPlan.repriseArret, "sans-qualite", "l'arrêt de 40 jours n'est pas vu : la garde d'intensité est perdue");
    assert.deepEqual(dures(tot), [], "une séance dure est posée au 4ᵉ jour de reprise d'un arrêt de 40 jours");
    // 8ᵉ jour de reprise : la règle d'intensité permet la première séance dure au 14ᵉ, soit le jour 6 du plan ; une seule,
    // au seuil. ⚠️ Vérifié sur un coureur dont les sorties d'AVANT l'arrêt n'ont pas de distance (montre sans GPS) : son
    // volume d'avant l'arrêt est inconnu, donc aucun plafond de volume ne s'ajoute à la règle d'intensité (20/11/2026).
    const tard = await contexte({ seances: cas(8).seances.map((w) => (w.sport === "run" && w.date <= ilYa(49) ? { ...w, distance_km: null } : w)) });
    assert.deepEqual({ reprise: tard.weekPlan.repriseArret, des: tard.weekPlan.qualiteDes }, { reprise: "une-qualite", des: 6 });
    // Le même coureur AVEC ses distances : sa semaine est plafonnée à 33 % de 60 km, sa sortie longue (30 % de 20 km) est
    // plus courte que ses 10 km habituels et n'est pas posée. Une semaine trop petite pour une vraie sortie longue ne
    // porte que des footings : aucune séance dure, même le jour 6.
    const tardPlafonne = await contexte({ seances: cas(8).seances });
    assert.equal(tardPlafonne.volume.targetKm, 20, `précondition : la semaine n'est pas plafonnée à 20 km (${tardPlafonne.volume.targetKm})`);
    assert.equal(tardPlafonne.volume.longRunKm, 0, "précondition : la sortie longue de la semaine plafonnée n'est pas retirée");
    assert.deepEqual({ reprise: tardPlafonne.weekPlan.repriseArret, des: tardPlafonne.weekPlan.qualiteDes, budget: tardPlafonne.weekPlan.qBudget }, { reprise: "sans-qualite", des: 7, budget: 0 }, "le plafond a fait retirer la sortie longue, et la semaine garde une séance dure");
    assert.deepEqual(dures(tardPlafonne), [], "une séance dure est posée dans une semaine plafonnée dont la sortie longue a été retirée");
    assert.ok(buildWeekPlan(tardPlafonne, new Date(`${AUJOURDHUI}T08:00:00Z`)).filter((d) => /Endurance|R[ée]cup/i.test(d.type)).length >= 2, "la semaine plafonnée ne porte pas au moins deux footings");
    assert.ok(dures(tard).length <= 1, `plus d'une séance dure la même semaine : ${dures(tard).join(", ")}`);
    for (const t of dures(tard)) {
      assert.ok(jourDe(tard, t) >= 6, `séance dure avant le 14ᵉ jour de reprise : ${t}`);
      assert.match(t, /seuil/i, `la séance de reprise n'est pas au seuil : ${t}`);
    }
    // PAS ENCORE REPRIS : les 60 dernières séances ne portent plus AUCUNE course.
    const pasRepris = await contexte({ seances: [...reguliere(41, 110), ...velos(1, 40)] });
    assert.equal(pasRepris.weekPlan.repriseArret, "sans-qualite", "sans aucune course récente, l'arrêt en cours n'est pas vu");
    assert.deepEqual(dures(pasRepris), []);
  });

  await test("arrêt court masqué par le vélo : la reprise vise la moitié de l'habitude RÉELLE, pas la moitié de rien", async () => {
    // 20 jours sans courir à trois sorties à vélo par jour (60 séances), une course facile hier.
    const avant = reguliere(22, 110);
    const velos3 = Array.from({ length: 20 }, (_, k) => 2 + k).flatMap((n) => [velo(n), velo(n), velo(n)]);
    const masque = await contexte({ seances: [...avant, ...velos3, sortie(1, 6)] });
    // Le jumeau : les mêmes courses, sans le vélo. Les 60 dernières séances voient alors l'arrêt d'elles-mêmes.
    const visible = await contexte({ seances: [...avant, sortie(1, 6)] });
    assert.equal(visible.weekPlan.repriseArret, "sans-qualite", "précondition : le jumeau sans vélo n'est pas en reprise");
    assert.ok(visible.volume.targetKm >= 25, `précondition : le jumeau sans vélo ne vise que ${visible.volume.targetKm} km`);
    assert.equal(masque.weekPlan.repriseArret, "sans-qualite", "l'arrêt de 20 jours masqué par le vélo n'est pas vu");
    assert.equal(masque.volume.targetKm, visible.volume.targetKm, "le vélo change le volume visé de la reprise : l'habitude n'est pas lue là où l'arrêt l'est");
    const footings = buildWeekPlan(masque, new Date(`${AUJOURDHUI}T08:00:00Z`)).filter((d) => /Endurance|R[ée]cup/i.test(d.type)).length;
    assert.ok(footings >= 3, `une semaine de reprise presque vide : ${footings} footing(s)`);
    assert.deepEqual(dures(masque), []);
    // Le bandeau annonce ce que le plan vise : « 50 % », et la moitié de l'habitude du jumeau.
    const dit = (ctx: AthleteContext) => ctx.readiness.reasons.filter((r) => /sans courir|aucune course enregistrée/.test(r));
    assert.match(dit(masque).join(" | "), /reprise après 20 jours sans courir : 50 % de ton volume habituel cette semaine/);
    // LE COUREUR IRRÉGULIER (moins de trois semaines courues sur huit : pas de médiane) : ses distances sont
    // dans l'historique long. Masqué par le vélo ou non, même habitude (la moyenne de quatre semaines), donc
    // même volume visé et même texte — pas « volume habituel inconnu ».
    const peu = [sortie(30, 8), sortie(25, 8), sortie(21, 8)];
    const irregulier = await contexte({ seances: [...peu, ...Array.from({ length: 20 }, (_, k) => 1 + k).flatMap((n) => [velo(n), velo(n), velo(n)])] });
    const jumeau = await contexte({ seances: peu });
    assert.equal(jumeau.weekPlan.repriseArret, "sans-qualite", "précondition : le jumeau irrégulier n'est pas en reprise");
    // LA VALEUR ABSOLUE, pas seulement l'égalité avec le jumeau (qui passe par la même formule) : deux
    // sorties de 8 km dans les 28 derniers jours (celle d'il y a 30 jours n'en fait pas partie), soit
    // 16 km sur quatre semaines = 4 km par semaine. Depuis le plancher de la reprise (23/11/2026), une habitude plus
    // petite que deux footings n'est pas réduite : le plafond vaut l'habitude, 4 km (avant : sa moitié, 2 km).
    assert.equal(jumeau.volume.targetKm, 4, "l'habitude d'un coureur irrégulier n'est plus la moyenne des quatre dernières semaines (16 km / 4)");
    assert.match(dit(jumeau).join(" | "), /on reprend par des footings, sans réduire un volume habituel déjà petit/, `le motif ne dit pas que la petite habitude n'est pas réduite (${dit(jumeau).join(" | ")})`);
    assert.doesNotMatch(dit(jumeau).join(" | "), /%/, "un pourcentage est annoncé alors que l'habitude n'est pas réduite");
    assert.equal(irregulier.weekPlan.repriseArret, "sans-qualite", "l'arrêt du coureur irrégulier masqué par le vélo n'est pas vu");
    assert.equal(irregulier.volume.targetKm, jumeau.volume.targetKm, "coureur irrégulier : le vélo change le volume visé de la reprise");
    assert.deepEqual(dit(irregulier), dit(jumeau), "coureur irrégulier : le vélo change ce que dit le motif");
    // Une seconde valeur absolue, qui tombe sur un demi-kilomètre et au-dessus du plancher de deux footings :
    // 100 km en 28 jours = 25 km par semaine, dont la moitié 12,5 km, ARRONDIE à 13 (un diviseur de 5 donnerait
    // 10 km, ramenés à 12 par le plancher ; un arrondi par défaut, 12).
    const peu100 = [sortie(30, 8), sortie(25, 50), sortie(21, 50)];
    const ctx100 = await contexte({ seances: peu100 });
    assert.equal(ctx100.volume.targetKm, 13, "100 km en quatre semaines ne donnent plus 13 km visés à 50 % (25 km par semaine, moitié arrondie)");
    assert.match(dit(ctx100).join(" | "), /on repart à 50 % de ton volume habituel/, "au-dessus du plancher, le motif n'annonce plus 50 %");
    // Et une petite habitude au-dessus de deux footings : 14 km par semaine (56 km en 28 jours), moitié 7 km, moins
    // que deux footings. Le plafond est le plancher, 12 km, et le motif dit « deux footings courts », sans pourcentage.
    const peu56 = await contexte({ seances: [sortie(30, 8), sortie(25, 28), sortie(21, 28)] });
    assert.ok(peu56.volume.targetKm > 7 && peu56.volume.targetKm <= 12, `14 km d'habitude : ${peu56.volume.targetKm} km visés, attendu plus que la moitié (7) et au plus le plancher (12)`);
    assert.match(dit(peu56).join(" | "), /on reprend par deux footings courts, le minimum d'une semaine de reprise/, `14 km d'habitude : le motif ne dit pas le plancher (${dit(peu56).join(" | ")})`);
    assert.doesNotMatch(dit(peu56).join(" | "), /%/, "14 km d'habitude : un pourcentage est annoncé au plancher");
  });

  await test("habitude de volume inconnue : ni plafond « moitié de rien », ni pourcentage annoncé ; la garde d'intensité reste", async () => {
    const dit = (ctx: AthleteContext) => ctx.readiness.reasons.filter((r) => /sans courir|aucune course enregistrée/.test(r)).join(" | ");
    // (a) Une seule sortie, de distance inconnue, il y a dix jours.
    const inconnue = await contexte({ seances: [{ ...sortie(10), distance_km: null }] });
    // (b) Montre sans GPS : un coureur régulier dont AUCUNE sortie n'a de distance, neuf jours sans courir.
    const sansGps = (de: number, a: number) => reguliere(de, a).map((w) => ({ ...w, distance_km: null }));
    const sansDistance = await contexte({ seances: sansGps(10, 80) });
    // Contre-poids : le même coureur sans arrêt a une séance dure au plan — sinon « aucune séance dure » ne prouve rien.
    const sansArret = await contexte({ seances: sansGps(1, 80) });
    assert.equal(sansArret.weekPlan.repriseArret, undefined, "précondition : une reprise est vue chez un coureur sans GPS qui n'a pas arrêté");
    assert.ok(dures(sansArret).length >= 1, "précondition : le coureur sans GPS n'a aucune séance dure hors reprise, le test ne prouverait rien");
    for (const [nom, ctx] of [["distance inconnue", inconnue], ["montre sans GPS", sansDistance]] as const) {
      assert.equal(ctx.weekPlan.repriseArret, "sans-qualite", `${nom} : précondition, l'arrêt n'est pas vu`);
      assert.ok(ctx.volume.targetKm > 0, `${nom} : une habitude inconnue donne une semaine visée à 0 km`);
      // NI PLAFOND DU TOUT : depuis le plancher de deux footings (23/11/2026), « la moitié de rien » ne donne plus 0 km
      // mais 12 km. Une habitude inconnue ne plafonne pas : la semaine garde la cible ordinaire du plan (17 km ici).
      assert.ok(ctx.volume.targetKm > 12, `${nom} : ${ctx.volume.targetKm} km visés, une habitude inconnue est plafonnée au plancher de deux footings`);
      assert.match(dit(ctx), /ton volume habituel n'étant pas encore connu/, `${nom} : le motif ne dit pas que l'habitude est inconnue (${dit(ctx)})`);
      assert.doesNotMatch(ctx.readiness.reasons.join(" | "), /% de ton volume habituel/, `${nom} : un pourcentage du volume habituel est annoncé au-dessus d'un plan qui ne le vise pas`);
      assert.deepEqual(dures(ctx), [], `${nom} : la garde d'intensité est tombée avec le plafond`);
    }
    // LA GARDE D'INTENSITÉ NE TOMBE PAS AVEC LE PLAFOND, là où la règle des petites semaines ne joue pas. Depuis le
    // 23/11/2026, la semaine de 17 km d'une habitude inconnue est de toute façon trop petite pour une séance dure et un
    // footing : sans cette scène, rien ne prouvait plus la garde elle-même. Sous consignes du kinésithérapeute (trois
    // séances par semaine, intensité permise), la règle des petites semaines ne s'applique pas ; la garde, si.
    const consignesKine = [{ user_id: "u", type: "consignes_kine", created_at: `${ilYa(1)}T10:00:00Z`, data: { dureeMaxMin: null, sansIntensite: false, seancesMaxSemaine: 3, jusquAu: ilYa(-14), majA: ilYa(1) } }];
    const sousConsignes = await contexte({ seances: sansGps(10, 80), notifications: consignesKine });
    assert.equal(sousConsignes.weekPlan.footingExige, undefined, "précondition : sous consignes du kinésithérapeute, la règle des petites semaines s'applique, la scène ne prouve rien");
    assert.equal(sousConsignes.weekPlan.repriseArret, "sans-qualite", "habitude inconnue, sous consignes : l'arrêt n'est plus vu");
    assert.equal(sousConsignes.weekPlan.qBudget, 0, `habitude inconnue, sous consignes : ${sousConsignes.weekPlan.qBudget} séance(s) au budget, la garde d'intensité est tombée avec le plafond`);
    assert.deepEqual(dures(sousConsignes), [], "habitude inconnue, sous consignes : une séance dure est posée");
    // LA FEUILLE DE ROUTE AUSSI : avec un objectif à dix semaines, aucune semaine suivante n'est ramenée à 0 km.
    const avecObjectif = await contexte({ seances: sansGps(10, 80), notifications: [objectif({ race: "Semi test", raceDate: ilYa(-70), distanceKm: 21.1, targetTime: "1h45'00", targetSeconds: 6300, targetPace: "4'59/km" })] });
    assert.equal(avecObjectif.weekPlan.repriseArret, "sans-qualite", "précondition : avec un objectif, l'arrêt n'est plus vu");
    assert.ok(avecObjectif.macroPlan.length >= 4, `précondition : la feuille de route n'a que ${avecObjectif.macroPlan.length} semaine(s)`);
    assert.ok(avecObjectif.macroPlan.every((w) => w.volumeKm > 0), `habitude inconnue : une semaine de la feuille de route vise 0 km (${avecObjectif.macroPlan.map((w) => w.volumeKm).join(", ")})`);
    // Ni la semaine en cours ni la suivante (encore dans la reprise : neuf jours d'arrêt) ne sont plafonnées au plancher.
    assert.ok(avecObjectif.macroPlan.slice(0, 2).every((w) => w.volumeKm > 12), `habitude inconnue : une des deux premières semaines de la feuille de route est plafonnée au plancher (${avecObjectif.macroPlan.slice(0, 2).map((w) => w.volumeKm).join(", ")})`);
    // UNE HABITUDE PETITE MAIS CONNUE n'est pas « inconnue » : une sortie de 4 km il y a dix jours → 1 km par
    // semaine, le pourcentage est annoncé et le plafond s'applique (limite connue : la moitié de presque rien).
    const petite = await contexte({ seances: [sortie(10, 4)] });
    assert.match(dit(petite), /on repart à 50 % de ton volume habituel/, `une habitude de 1 km par semaine est dite inconnue (${dit(petite)})`);
    assert.ok(petite.volume.targetKm <= 1, `habitude de 1 km par semaine : ${petite.volume.targetKm} km visés sous « 50 % »`);
    // Les cinq langues : sans pourcentage quand l'habitude est inconnue, dans les deux états ; avec, sinon.
    const INCONNU = { fr: /pas encore connu/, en: /not known yet/, de: /noch nicht bekannt/, es: /aún no se conoce/, pt: /ainda não é conhecido/ } as const;
    const FOOTINGS = { fr: /footings/, en: /easy runs/, de: /lockeren? Läufen?/, es: /rodajes suaves/, pt: /corridas fáceis/ } as const;
    for (const l of Object.keys(MOTIF_T) as (keyof typeof MOTIF_T)[]) {
      for (const enCours of [true, false]) {
        const sans = MOTIF_T[l].repriseArret("8", null, enCours, enCours ? 0 : 1, false), avec = MOTIF_T[l].repriseArret("8", "50", enCours, enCours ? 0 : 1, false);
        assert.ok(!/%|50|null|undefined/.test(sans), `${l} : un pourcentage (ou une valeur vide) reste dans « ${sans} »`);
        assert.match(avec, /50\s?%/, `${l} : le pourcentage a disparu du texte ordinaire`);
        assert.notEqual(sans, avec);
        assert.ok(sans.includes("8"), `${l} : le nombre de jours a disparu`);
        assert.match(sans, INCONNU[l as keyof typeof INCONNU], `${l} : le texte ne dit plus que le volume habituel est inconnu (« ${sans} »)`);
        // « On reprend par des footings » ne se dit que tant qu'il n'a pas repris : ensuite, une séance de
        // qualité par semaine est permise, et le texte ne dit pas le contraire.
        assert.equal(FOOTINGS[l as keyof typeof FOOTINGS].test(sans), enCours, `${l} : « ${sans} » ${enCours ? "ne dit plus qu'on reprend par des footings" : "promet des footings alors qu'une séance de qualité est permise"}`);
      }
    }
    // Et le contexte ne passe le pourcentage que si l'habitude est connue ; le bandeau d'après-course suit la même part.
    const ctxSrc = codeNu("src/lib/ai/coachContext.ts");
    assert.match(ctxSrc, /habitudeArretInconnue \|\| pauseAuPlancher\(\) \? null : nRaw\(Math\.round\(repriseArret\.part \* 100\), l\), repriseArret\.enCours/);
    assert.match(ctxSrc, /const partVolumeAnnoncee = Math\.min\(partVolumeRecup, partArret\(\)\);/);
    assert.doesNotMatch(ctxSrc, /partApresArret\(repriseArret(?!, dansJours\);\n)/, "une part de volume est lue sans passer par `partArret` (habitude inconnue ignorée)");
  });

  await test("l'habitude de la reprise se lit sur l'historique long, pas sur « la plus haute des deux lectures »", async () => {
    // Trois grosses semaines (6 × 14 km) juste avant l'arrêt, des semaines à 6 × 8 km avant. Le vélo réduit
    // les 60 dernières séances aux trois grosses semaines : leur médiane dépasse celle des huit semaines.
    const semaines = (de: number, a: number, km: number) => Array.from({ length: a - de + 1 }, (_, k) => de + k).filter((n) => n % 7 !== 3).map((n) => sortie(n, km));
    for (const [arret, repris] of [[10, 0], [12, 3], [10, 8]] as const) {
      const reprise = Array.from({ length: repris }, (_, k) => sortie(repris - k, 6));
      const debut = repris + arret + 1;
      const grosses = semaines(debut, debut + 20, 14);
      const courses = [...grosses, ...semaines(debut + 21, debut + 100, 8), ...reprise];
      const velosIci = Array.from({ length: 60 - grosses.length - reprise.length }, (_, k) => velo(repris + 1 + Math.floor(k / 3)));
      const seances = [...courses, ...velosIci];
      // Précondition : les 60 dernières séances ne portent, d'avant l'arrêt, QUE les grosses semaines.
      const recentes = [...seances].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 60).filter((w) => w.sport === "run");
      assert.deepEqual([...new Set(recentes.map((w) => w.distance_km))].sort(), repris ? [14, 6] : [14], `arrêt ${arret} j, repris ${repris} j : précondition, les 60 dernières séances voient encore les petites semaines`);
      const masque = await contexte({ seances }), jumeau = await contexte({ seances: courses });
      assert.ok(jumeau.weekPlan.repriseArret, `arrêt ${arret} j, repris ${repris} j : précondition, le jumeau n'est pas en reprise`);
      assert.equal(masque.weekPlan.repriseArret, jumeau.weekPlan.repriseArret);
      assert.equal(masque.volume.targetKm, jumeau.volume.targetKm, `arrêt ${arret} j, repris ${repris} j : le vélo GONFLE le volume de la reprise (l'habitude est lue sur des séances récentes réduites aux grosses semaines)`);
    }
    // HUIT SEMAINES, PAS DOUZE : de grosses semaines (6 × 20 km) vieilles de plus de huit semaines ne
    // relèvent pas l'habitude. Même coureur, avec et sans ces vieilles semaines : même volume de reprise.
    // 12 jours sans courir ; dans les huit semaines : quatre semaines à 6 × 10 km puis deux à 6 × 20 km. Au-delà :
    // huit semaines à 6 × 20 km, qui domineraient une médiane prise sur douze semaines.
    const huit = [...semaines(13, 40, 10), ...semaines(41, 55, 20)];
    const sansVieilles = await contexte({ seances: huit }), avecVieilles = await contexte({ seances: [...huit, ...semaines(57, 110, 20)] });
    assert.equal(sansVieilles.weekPlan.repriseArret, "sans-qualite", "précondition : douze jours sans courir ne font pas une reprise");
    assert.ok(sansVieilles.volume.targetKm >= 20, `précondition : ce coureur ne vise que ${sansVieilles.volume.targetKm} km`);
    assert.equal(avecVieilles.volume.targetKm, sansVieilles.volume.targetKm, "des semaines vieilles de plus de huit semaines changent l'habitude de la reprise");
    // L'HISTORIQUE LONG EN ÉCHEC (requête vide) : les séances récentes font foi, comme avant ce changement.
    // Précondition : le faux client vide VRAIMENT l'historique long. Un arrêt que seul l'historique porte (40
    // jours masqués par le vélo, voir plus haut) n'est plus vu à travers lui, alors que le client ordinaire le voit.
    const masque40 = { profiles: [PROFIL], performance_baselines: BASE, notifications: [],
      workouts: [...reguliere(45, 110), ...velos(5, 44), ...Array.from({ length: 4 }, (_, k) => sortie(4 - k, 8))] };
    assert.equal((await buildAthleteContext(fauxClient(masque40), "u")).weekPlan.repriseArret, "sans-qualite", "précondition : l'arrêt de 40 jours masqué n'est pas vu par le client ordinaire");
    assert.equal((await buildAthleteContext(fauxClientSansHistorique(masque40), "u")).weekPlan.repriseArret, undefined, "précondition : le faux client « sans historique » rend encore l'historique long (la suite passerait à vide)");
    const HABITUDE_11 = reguliere(12, 70); // onze jours sans courir
    const tables = { profiles: [PROFIL], performance_baselines: BASE, workouts: HABITUDE_11, notifications: [] };
    const sansHist = await buildAthleteContext(fauxClientSansHistorique(tables), "u"), avecHist = await contexte({ seances: HABITUDE_11 });
    assert.equal(avecHist.weekPlan.repriseArret, "sans-qualite", "précondition : onze jours sans courir ne font pas une reprise");
    assert.ok(avecHist.volume.targetKm >= 20, `précondition : ce coureur ne vise que ${avecHist.volume.targetKm} km`);
    assert.equal(sansHist.weekPlan.repriseArret, "sans-qualite", "sans historique long, l'arrêt n'est plus vu sur les séances récentes");
    assert.equal(sansHist.volume.targetKm, avecHist.volume.targetKm, "sans historique long, l'habitude de la reprise n'est plus lue sur les séances récentes");
    assert.match(sansHist.readiness.reasons.join(" | "), /on repart à 50 % de ton volume habituel/, "sans historique long, l'habitude est dite inconnue alors que les séances récentes la portent");
  });

  await test("de vraies doubles séances ne faussent pas la sortie habituelle : la sortie longue de reprise reste posée", async () => {
    // Sept semaines identiques : deux jours à 2 × 6 km (matin et soir), trois jours à 10 km, une sortie de 16 km.
    // Dernière sortie il y a 16 jours. Sortie habituelle : la médiane de 6, 6, 6, 6, 10, 10, 10, 16, soit 8 km.
    const semaine = (j: number) => [sortie(j + 6, 16), sortie(j + 5, 6), sortie(j + 5, 6), sortie(j + 4, 10), sortie(j + 3, 6), sortie(j + 3, 6), sortie(j + 2, 10), sortie(j, 10)];
    const seances = Array.from({ length: 7 }, (_, k) => semaine(16 + 7 * k)).flat();
    assert.equal(sortieHabituelleKm(seances.map((w) => w.distance_km)), 8, "précondition : la sortie habituelle de ce coureur n'est pas de 8 km");
    assert.ok(seances.length < 60, "précondition : ce coureur a plus de 60 séances, les deux sources ne se recouvrent plus entièrement");
    const ctx = await contexte({ seances });
    assert.ok(ctx.weekPlan.repriseArret, "précondition : quinze jours sans courir ne font pas une reprise");
    assert.ok(ctx.volume.longRunPlanned >= 8, `précondition : la sortie longue prévue (${ctx.volume.longRunPlanned} km) est déjà sous la sortie habituelle de 8 km`);
    assert.ok(ctx.volume.longRunKm >= 8, `les doubles séances sont comptées une seule fois : la sortie habituelle paraît plus longue, et la sortie longue de reprise (${ctx.volume.longRunPlanned} km prévus) n'est plus posée`);
  });

  await test("les jours courus de l'arrêt : la réunion des deux sources, au site d'appel", () => {
    assert.deepEqual(joursCourusPourArret([{ date: "2026-10-01" }, { date: "2026-10-03T07:00:00Z" }], [{ date: "2026-10-03" }, { date: "2026-11-02" }, { date: null }]).filter(Boolean),
      ["2026-10-01", "2026-10-03", "2026-10-03", "2026-11-02"]);
    assert.deepEqual(joursCourusPourArret([], [{ date: "2026-11-02" }]), ["2026-11-02"]);
    assert.deepEqual(joursCourusPourArret([{ date: "2026-10-01" }], []), ["2026-10-01"]);
    // Les sorties (date + distance) des deux sources, sans compter deux fois la même.
    assert.deepEqual(sortiesPourArret([{ date: "2026-10-01", distance_km: 10 }, { date: "2026-10-03", distance_km: 8 }], [{ date: "2026-10-03T07:00:00Z", distance_km: 8 }, { date: "2026-03-01", distance_km: 12 }]),
      [{ date: "2026-10-01", distance_km: 10 }, { date: "2026-10-03", distance_km: 8 }, { date: "2026-03-01", distance_km: 12 }]);
    assert.equal(sortiesPourArret([{ date: "2026-10-03", distance_km: 8 }], [{ date: "2026-10-03", distance_km: 5 }]).length, 2, "deux sorties différentes du même jour n'en font plus qu'une");
    // ⚠️ DE VRAIES DOUBLES SÉANCES (sixième relecture, 19/11/2026) : deux sorties du même jour et de même
    // distance, matin et soir, sont DEUX sorties. Seul le recouvrement entre les deux sources est retiré.
    const matinSoir = [{ date: "2026-10-05", distance_km: 6 }, { date: "2026-10-05", distance_km: 6 }];
    assert.equal(sortiesPourArret(matinSoir, []).length, 2, "une double séance de l'historique long est comptée une seule fois");
    assert.equal(sortiesPourArret([], matinSoir).length, 2, "une double séance des séances récentes est comptée une seule fois");
    assert.equal(sortiesPourArret(matinSoir, matinSoir).length, 2, "une double séance présente dans les deux sources n'est pas comptée deux fois, ni quatre");
    assert.equal(sortiesPourArret([matinSoir[0]], matinSoir).length, 2, "la seconde sortie du jour, absente de l'historique long, est perdue");
    assert.deepEqual(sortiesPourArret([...matinSoir, { date: "2026-10-06", distance_km: 10 }], [...matinSoir, { date: "2026-10-07", distance_km: 8 }]).map((w) => w.distance_km), [6, 6, 10, 8]);
    // La clé est le JOUR, pas le mois : deux sorties de même distance à une semaine d'écart restent deux sorties.
    assert.equal(sortiesPourArret([{ date: "2026-10-01", distance_km: 10 }, { date: "2026-10-08", distance_km: 10 }], [{ date: "2026-10-15", distance_km: 10 }]).length, 3, "des sorties de même distance, à des jours différents du même mois, sont confondues");
    const ctxSrc = codeNu("src/lib/ai/coachContext.ts");
    assert.match(ctxSrc, /const joursArret = joursCourusPourArret\(histRuns, runs\);\s*const repriseArret = repriseApresArret\(joursArret, todayStr\);/);
    // Plus aucune lecture de l'arrêt sur les seules séances récentes.
    assert.doesNotMatch(ctxSrc, /(repriseApresArret|arretHorsEchelle)\(runs\b/);
  });

  await test("l'historique long ne suffit pas seul : après une coupure de plus de six mois, les séances récentes portent l'arrêt", async () => {
    // Coureur peu assidu : la dernière course d'avant l'arrêt a plus de 190 jours, hors de l'historique long,
    // mais dans ses 60 dernières séances. Repris il y a 2 jours.
    const anciennes = [200, 204, 207, 211, 214, 218, 221, 225].map((n) => sortie(n));
    const seances = [...anciennes, sortie(2, 5)];
    const jours = seances.map((w) => w.date);
    assert.deepEqual(arretHorsEchelle(jours.filter((d) => d >= ilYa(190)), AUJOURDHUI), null, "précondition : même sans les séances récentes, l'historique long voit déjà l'arrêt (le test ne prouverait rien)");
    assert.deepEqual(arretHorsEchelle(jours, AUJOURDHUI), { arretJours: 197, enCours: false, joursRepris: 2 });
    const ctx = await contexte({ seances });
    assert.equal(ctx.weekPlan.repriseArret, "sans-qualite", "en lisant le seul historique long, l'arrêt de 197 jours n'est plus vu");
    assert.deepEqual(dures(ctx), []);
    // La sortie habituelle (10 km, lue sur les sorties d'avant l'arrêt, hors de l'historique long) : une
    // « sortie longue » plus courte n'en est pas une.
    assert.ok(ctx.volume.longRunPlanned > 0 && ctx.volume.longRunPlanned < 10, `précondition : la sortie longue prévue (${ctx.volume.longRunPlanned} km) ne se compare pas à la sortie habituelle de 10 km`);
    assert.equal(ctx.volume.longRunKm, 0, "la sortie habituelle d'avant une coupure de plus de six mois n'est pas lue : une « sortie longue » plus courte qu'elle est posée");
  });

  console.log("\nAU-DELÀ DE 28 JOURS D'ARRÊT — un plafond de volume (Daniels), qui ne fait que baisser");

  /** Six sorties de 10 km par semaine pendant `jours` jours ; la DERNIÈRE, toujours courue, il y a `dernier` jours. */
  const avantArret = (dernier: number, jours = 76, km: number | null = 10) =>
    Array.from({ length: jours }, (_, k) => dernier + k).filter((n) => (n - dernier) % 7 !== 3).map((n) => ({ ...sortie(n), distance_km: km }));
  /** La reprise : six sorties de `km` par semaine, la première il y a `repris` jours, la dernière hier (aucune si `repris` vaut 0). */
  const depuisReprise = (repris: number, km = 10, jusqua = 1) =>
    Array.from({ length: Math.max(0, repris - jusqua + 1) }, (_, k) => repris - k).filter((n) => (repris - n) % 7 !== 3).map((n) => sortie(n, km));
  /** Un coureur à 60 km par semaine, `arret` jours sans courir, qui reprend D'EMBLÉE à 60 km par semaine depuis `repris` jours. */
  const longArret = (arret: number, repris: number, km = 10) => [...avantArret(repris + arret + 1), ...depuisReprise(repris, km)];
  const ditArret = (ctx: AthleteContext) => ctx.readiness.reasons.filter((r) => /sans courir|aucune course enregistrée/.test(r)).join(" | ");

  await test("les parts de Daniels au-delà de 28 jours : par tiers jusqu'à 56 jours, par paliers de trois semaines ensuite", () => {
    // LES BORNES DES TIERS, sur des arrêts multiples de trois (30 et 45 jours) : le jour qui ouvre un tiers en fait partie.
    for (const [arret, jour, part] of [[30, 9, 0.33], [30, 10, 0.5], [30, 19, 0.5], [30, 20, 0.75], [30, 29, 0.75], [30, 30, 1], [45, 14, 0.33], [45, 15, 0.5], [45, 29, 0.5], [45, 30, 0.75], [45, 44, 0.75], [45, 45, 1]] as const)
      assert.equal(partApresLongArret({ arretJours: arret, joursRepris: jour }), part, `${arret} jours d'arrêt, ${jour}ᵉ jour de reprise : la part n'est pas ${part}`);
    const part = (arret: number, repris: number, dans = 0) => partApresLongArret({ arretJours: arret, joursRepris: repris }, dans);
    assert.equal(partApresLongArret(null), 1);
    assert.equal(part(28, 0), 1, "la règle des arrêts de 6 à 28 jours est appliquée deux fois");
    // 29 jours d'arrêt : tiers à 9,67 et 19,33 jours ; la reprise dure 29 jours.
    assert.deepEqual([0, 9, 10, 19, 20, 28, 29].map((j) => part(29, j)), [0.33, 0.33, 0.5, 0.5, 0.75, 0.75, 1]);
    // 56 jours : tiers à 18,67 et 37,33 jours ; la reprise dure 56 jours.
    assert.deepEqual([0, 18, 19, 37, 38, 55, 56].map((j) => part(56, j)), [0.33, 0.33, 0.5, 0.5, 0.75, 0.75, 1]);
    // Au-delà de 56 jours : trois semaines à 33, 50, 70 puis 80 %, quelle que soit la longueur de l'arrêt.
    for (const arret of [57, 90, 300])
      assert.deepEqual([0, 20, 21, 41, 42, 62, 63, 83, 84, 200].map((j) => part(arret, j)), [0.33, 0.33, 0.5, 0.5, 0.7, 0.7, 0.8, 0.8, 1, 1], `arrêt de ${arret} jours`);
    assert.deepEqual([28, 29, 56, 57, 300].map(dureeRepriseLongue), [28, 29, 56, 84, 84]);
    // La semaine qui commence dans sept jours.
    assert.equal(part(90, 15, 7), 0.5);
    assert.equal(part(40, 10, 7), 0.5, "arrêt de 40 jours, 17ᵉ jour de reprise : le deuxième tiers");
    // UNE GARDE NE BAISSE PAS QUAND LE RISQUE MONTE : pour chaque jour de reprise, la part ne remonte jamais quand
    // l'arrêt s'allonge, de 6 à 200 jours, les deux règles réunies (28/29 et 56/57 comprises).
    const toutes = (arret: number, jour: number) => arret <= 28 ? partApresArret({ arretJours: arret, joursRepris: jour }) : part(arret, jour);
    for (let jour = 0; jour <= 100; jour++) for (let arret = 6; arret < 200; arret++)
      assert.ok(toutes(arret + 1, jour) <= toutes(arret, jour), `au ${jour}ᵉ jour de reprise, ${arret + 1} jours d'arrêt donnent ${toutes(arret + 1, jour)} et ${arret} jours ${toutes(arret, jour)}`);
  });

  await test("la reprise de volume d'un long arrêt dure autant que lui, ou douze semaines ; une pause courte survenue depuis ne l'efface pas", () => {
    assert.equal(repriseVolumeLongArret([], AUJOURDHUI), null);
    assert.equal(repriseVolumeLongArret([ilYa(29)], AUJOURDHUI), null, "28 jours sans courir sont lus comme un long arrêt");
    assert.deepEqual(repriseVolumeLongArret([ilYa(30)], AUJOURDHUI), { arretJours: 29, enCours: true, joursRepris: 0, depuisJours: 30 });
    const apres = (arret: number, repris: number) => repriseVolumeLongArret(longArret(arret, repris).map((w) => w.date), AUJOURDHUI);
    assert.deepEqual(apres(28, 5), null);
    assert.deepEqual(apres(40, 39), { arretJours: 40, enCours: false, joursRepris: 39 });
    assert.deepEqual(apres(40, 40), null, "après 40 jours d'arrêt, la reprise de volume dépasse 40 jours");
    assert.deepEqual(apres(90, 83), { arretJours: 90, enCours: false, joursRepris: 83 });
    assert.deepEqual(apres(90, 84), null, "après 90 jours d'arrêt, la reprise de volume dépasse douze semaines");
    // Le dernier jour couru avant l'arrêt : c'est là que s'ancre le volume d'avant.
    assert.equal(joursDepuisLAvantArret({ arretJours: 90, joursRepris: 15 }), 106);
    assert.equal(joursDepuisLAvantArret({ arretJours: 29, joursRepris: 0 }), 30);
    // 90 jours d'arrêt, 30 jours de reprise, puis 8 jours sans courir : la règle des arrêts courts voit ses 8 jours,
    // et la reprise du long arrêt court toujours (38ᵉ jour, deuxième palier).
    const avecPause = [...avantArret(38 + 90 + 1), ...depuisReprise(38, 10, 9)].map((w) => w.date);
    assert.deepEqual(repriseApresArret(avecPause, AUJOURDHUI), { arretJours: 8, enCours: true, joursRepris: 0, part: 0.5, depuisJours: 9 }, "précondition : la pause de 8 jours n'est pas celle attendue");
    assert.deepEqual(repriseVolumeLongArret(avecPause, AUJOURDHUI), { arretJours: 90, enCours: false, joursRepris: 38 }, "une pause de 8 jours efface la reprise d'un arrêt de 90 jours");
    assert.equal(partApresLongArret(repriseVolumeLongArret(avecPause, AUJOURDHUI)), 0.5);
    // Reparti après la pause (une sortie hier) : la pause est maintenant un écart ENTRE deux sorties, plus récent que
    // le long arrêt. La recherche ne s'arrête pas sur elle.
    const reparti = [...avantArret(39 + 90 + 1), ...depuisReprise(39, 10, 10), sortie(1)].map((w) => w.date);
    assert.equal(repriseApresArret(reparti, AUJOURDHUI)?.arretJours, 8, "précondition : la pause de 8 jours n'est pas vue une fois reparti");
    assert.deepEqual(repriseVolumeLongArret(reparti, AUJOURDHUI), { arretJours: 90, enCours: false, joursRepris: 39 }, "une pause de 8 jours, une fois reparti, efface la reprise d'un arrêt de 90 jours");
  });

  await test("après un long arrêt, le coureur qui reprend d'emblée à son volume d'avant est plafonné, et le motif le dit", async () => {
    // 60 km par semaine avant l'arrêt. [jours d'arrêt, jours de reprise, part de Daniels, plafond en km].
    for (const [arret, repris, part, plafond] of [[90, 15, 0.33, 20], [90, 30, 0.5, 30], [90, 45, 0.7, 42], [90, 70, 0.8, 48], [35, 7, 0.33, 20], [35, 15, 0.5, 30], [35, 30, 0.75, 45]] as const) {
      const seances = longArret(arret, repris);
      assert.deepEqual(repriseVolumeLongArret(seances.map((w) => w.date), AUJOURDHUI), { arretJours: arret, enCours: false, joursRepris: repris }, `arrêt ${arret} j, repris ${repris} j : précondition, la fixture n'est pas celle annoncée`);
      assert.equal(Math.round(60 * part), plafond, "précondition : le plafond attendu est mal calculé");
      const ctx = await contexte({ seances });
      assert.ok(ctx.volume.weekKm >= 50, `arrêt ${arret} j, repris ${repris} j : précondition, ce coureur n'a couru que ${ctx.volume.weekKm} km cette semaine, le plafond ne mordrait pas`);
      assert.equal(ctx.volume.targetKm, plafond, `arrêt ${arret} j, repris ${repris} j : ${ctx.volume.targetKm} km visés, le plafond de Daniels est de ${plafond} km (${Math.round(part * 100)} % de 60)`);
      assert.match(ditArret(ctx), new RegExp(`reprise après ${arret} jours sans courir : ${Math.round(part * 100)} % au plus de ton volume d'avant l'arrêt cette semaine`), `arrêt ${arret} j, repris ${repris} j : le motif ne dit pas le plafond (${ditArret(ctx)})`);
      assert.ok(ctx.volume.longRunKm <= Math.round(plafond * 0.3), `arrêt ${arret} j, repris ${repris} j : sortie longue de ${ctx.volume.longRunKm} km dans une semaine plafonnée à ${plafond} km`);
      // La borne d'intensité ne se dit que tant que la règle dure (63 jours après 90 jours d'arrêt, 28 après 35) :
      // ensuite, le motif du plafond ne parle plus que du volume.
      const sousRegle = repris < finRegleIntensite(arret);
      assert.equal(/séance de qualité|séance dure/.test(ditArret(ctx)), sousRegle, `arrêt ${arret} j, repris ${repris} j : ${sousRegle ? "la borne d'intensité n'est plus dite" : "une borne d'intensité périmée est encore dite"} (${ditArret(ctx)})`);
    }
    // La reprise de volume finie, plus de plafond ni de motif : le plan suit de nouveau ce qui est couru.
    for (const [arret, repris, dernierPlafond] of [[90, 84, 48], [35, 35, 45]] as const) {
      const ctx = await contexte({ seances: longArret(arret, repris) });
      assert.ok(ctx.volume.targetKm > dernierPlafond, `arrêt ${arret} j, repris ${repris} j : la reprise est finie et le plan vise encore ${ctx.volume.targetKm} km`);
      assert.doesNotMatch(ctx.readiness.reasons.join(" | "), /au plus de ton volume d'avant l'arrêt/, `arrêt ${arret} j, repris ${repris} j : un plafond est encore annoncé`);
    }
    // PAS ENCORE REPRIS après 90 jours : le plan vise moins que le plafond (rien n'a été couru), et l'annonce reste « au plus ».
    const pasRepris = await contexte({ seances: longArret(90, 0) });
    assert.ok(pasRepris.volume.targetKm > 0 && pasRepris.volume.targetKm <= 20, `pas encore repris : ${pasRepris.volume.targetKm} km visés pour un plafond de 20`);
    assert.match(ditArret(pasRepris), /aucune course enregistrée depuis 91 jours : on reprend par des footings, à 33 % au plus de ton volume d'avant l'arrêt cette semaine/);
  });

  await test("un plafond, pas une cible : le coureur qui reprend doucement n'est pas poussé vers le plafond", async () => {
    // Même coureur, 90 jours d'arrêt, 30 jours de reprise à 6 × 4 km par semaine (24 km) : le plafond est de 30 km.
    const doux = await contexte({ seances: longArret(90, 30, 4) });
    assert.ok(doux.volume.weekKm <= 24, `précondition : ce coureur a couru ${doux.volume.weekKm} km cette semaine`);
    assert.ok(doux.volume.targetKm < 30, `le coureur prudent est poussé à ${doux.volume.targetKm} km, le plafond de 30 km est devenu une cible`);
    assert.ok(doux.volume.targetKm >= 15, `le coureur prudent tombe à ${doux.volume.targetKm} km`);
    assert.match(ditArret(doux), /50 % au plus de ton volume d'avant l'arrêt/);
  });

  await test("la feuille de route d'un objectif reste sous le plafond, semaine après semaine", async () => {
    // 90 jours d'arrêt, 15 jours de reprise forte, un semi-marathon dans dix semaines.
    const ctx = await contexte({ seances: longArret(90, 15), notifications: [objectif({ race: "Semi test", raceDate: ilYa(-70), distanceKm: 21.1, targetTime: "1h45'00", targetSeconds: 6300, targetPace: "4'59/km" })] });
    assert.ok(ctx.macroPlan.length >= 8, `précondition : la feuille de route n'a que ${ctx.macroPlan.length} semaine(s)`);
    const plafonds = ctx.macroPlan.map((_, i) => { const p = partApresLongArret({ arretJours: 90, joursRepris: 15 }, 7 * i); return p < 1 ? Math.round(60 * p) : Infinity; });
    assert.deepEqual(plafonds.slice(0, 10), [20, 30, 30, 30, 42, 42, 42, 48, 48, 48], "précondition : les plafonds attendus sont mal calculés");
    ctx.macroPlan.forEach((w, i) => assert.ok(w.volumeKm <= plafonds[i], `semaine ${i + 1} de la feuille de route : ${w.volumeKm} km pour un plafond de ${plafonds[i]} km (${ctx.macroPlan.map((x) => x.volumeKm).join(", ")})`));
    assert.equal(ctx.macroPlan[0].volumeKm, 20, "la première semaine de la feuille de route n'est pas au plafond de 33 %");
    // Et chaque semaine a SON plafond : les suivantes montent avec les paliers, elles ne restent pas à 33 %.
    assert.deepEqual(ctx.macroPlan.slice(0, 5).map((w) => w.volumeKm), [20, 30, 30, 30, 42], "la feuille de route ne suit pas les paliers de la reprise");
    assert.equal(ctx.volume.targetKm, 20);
    assert.ok(ctx.volume.longRunKm <= 6, `sortie longue de ${ctx.volume.longRunKm} km dans une semaine plafonnée à 20 km`);
    // LA RÈGLE D'INTENSITÉ FINIE (63ᵉ jour après un arrêt de plus de 56 jours), elle ne borne plus la sortie longue :
    // le plafond de volume, si. 90 jours d'arrêt, 70 jours de reprise forte, un marathon dans douze semaines : la
    // feuille de route prévoit une sortie longue de marathonien, la semaine plafonnée à 48 km n'en porte que 30 %.
    const marathon = await contexte({ seances: longArret(90, 70), notifications: [objectif({ race: "Marathon test", raceDate: ilYa(-84), distanceKm: 42.195, targetTime: "3h30'00", targetSeconds: 12600, targetPace: "4'59/km" })] });
    assert.equal(arretHorsEchelle(longArret(90, 70).map((w) => w.date), AUJOURDHUI), null, "précondition : au 70ᵉ jour, la règle d'intensité court encore");
    assert.equal(marathon.volume.targetKm, 48);
    assert.ok(marathon.volume.longRunPlanned <= 14, `sortie longue de ${marathon.volume.longRunPlanned} km prévue dans une semaine plafonnée à 48 km`);
    // ET LA FEUILLE DE ROUTE DIT LA MÊME CHOSE : elle annonçait 15 km de sortie longue dans une semaine de 30 km.
    // Chaque semaine sous le plafond (70ᵉ au 83ᵉ jour de reprise : les deux premières) porte au plus 30 % de son volume.
    assert.deepEqual(marathon.macroPlan.slice(0, 2).map((w) => w.volumeKm), [48, 48], "précondition : la feuille de route ne suit pas le dernier palier");
    assert.ok(marathon.macroPlan[2].volumeKm > 48, `précondition : la troisième semaine (${marathon.macroPlan[2].volumeKm} km) est encore plafonnée`);
    marathon.macroPlan.slice(0, 2).forEach((w, k) => assert.ok(w.longRunKm <= Math.round(w.volumeKm * 0.3), `semaine ${k + 1} de la feuille de route : sortie longue de ${w.longRunKm} km dans une semaine de ${w.volumeKm} km`));
    assert.equal(marathon.macroPlan[0].longRunKm, 14, "la première semaine de la feuille de route ne porte pas 14 km de sortie longue (30 % de 48 km)");
  });

  await test("raccourcir la sortie longue ne fait pas de place à une séance de qualité de plus dans la feuille de route", async () => {
    // Un marathonien à petit volume (6 × 6 km par semaine), 60 jours d'arrêt, 70ᵉ jour de reprise (la règle d'intensité
    // et sa marche de sortie sont finies), marathon dans huit semaines. Sa feuille de route prévoit de longues sorties de
    // marathonien dans de petites semaines : la borne de 30 % les raccourcit pendant le dernier palier (80 %, jusqu'au
    // 83ᵉ jour). Le volume ainsi retiré ne doit pas devenir une séance de qualité de plus que pour son jumeau sans
    // plafond (les mêmes sorties, sans distance avant l'arrêt).
    const marathon8 = [objectif({ race: "Marathon test", raceDate: ilYa(-56), distanceKm: 42.2, targetTime: "3h45'00", targetSeconds: 13500, targetPace: "5'20/km" })];
    const seances = (km: number | null) => [...avantArret(70 + 60 + 1, 56, km), ...depuisReprise(70, 6)];
    assert.deepEqual(repriseVolumeLongArret(seances(6).map((w) => w.date), AUJOURDHUI), { arretJours: 60, enCours: false, joursRepris: 70 }, "précondition : la fixture n'est pas celle annoncée");
    const ctx = await contexte({ seances: seances(6), notifications: marathon8 }), libre = await contexte({ seances: seances(null), notifications: marathon8 });
    assert.equal(arretHorsEchelle(seances(6).map((w) => w.date), AUJOURDHUI), null, "précondition : au 70ᵉ jour, la règle d'intensité court encore");
    assert.equal(ctx.weekPlan.sortieReprise, undefined, "précondition : au 70ᵉ jour, la marche de sortie court encore");
    const semaines = ctx.macroPlan.slice(0, 6), reference = libre.macroPlan.slice(0, 6);
    assert.equal(semaines.length, 6, `précondition : la feuille de route n'a que ${semaines.length} semaine(s)`);
    // Précondition : la borne raccourcit bien des sorties longues (30 % d'une semaine plafonnée à 80 % de 36 km).
    assert.deepEqual(semaines.slice(0, 2).map((w) => [w.volumeKm, w.longRunKm]), [[29, 9], [29, 9]], `précondition : la borne de 30 % ne mord pas (${semaines.map((w) => w.volumeKm + "/" + w.longRunKm).join(", ")})`);
    assert.ok(reference[0].longRunKm > 9, `précondition : sans plafond, la sortie longue (${reference[0].longRunKm} km) n'est pas plus longue`);
    semaines.forEach((w, k) => assert.ok(w.quality.length <= reference[k].quality.length, `semaine ${k + 1} : la feuille de route gagne une séance de qualité là où la sortie longue a été raccourcie (${semaines.map((x) => x.volumeKm + "/" + x.longRunKm + "/" + x.quality.length).join(", ")} ; sans plafond : ${reference.map((x) => x.volumeKm + "/" + x.longRunKm + "/" + x.quality.length).join(", ")})`));
    // LA MÊME RÈGLE, EN CHIFFRES, sur un coureur à 42 km par semaine (6 × 7 km) : dernier palier à 34 km, et une sortie
    // longue raccourcie à 10 km là où son jumeau sans plafond en porte une plus longue. La place des séances de qualité
    // se compte sur la sortie longue PRÉVUE, pas sur la sortie raccourcie : la deuxième semaine porte une séance de
    // qualité, pas deux ((34 − 10) / 11 = 2 : deux séances dures et dix kilomètres de sortie longue dans 34 km).
    const seances7 = (km: number | null) => [...avantArret(70 + 60 + 1, 56, km), ...depuisReprise(70, 7)];
    const ctx7 = await contexte({ seances: seances7(7), notifications: marathon8 }), libre7 = await contexte({ seances: seances7(null), notifications: marathon8 });
    assert.deepEqual(ctx7.macroPlan.slice(0, 2).map((w) => [w.volumeKm, w.longRunKm]), [[34, 10], [34, 10]], `précondition : le dernier palier (80 % de 42 km) ou la borne de 30 % ne mordent pas (${ctx7.macroPlan.slice(0, 3).map((w) => w.volumeKm + "/" + w.longRunKm).join(", ")})`);
    assert.ok(libre7.macroPlan[1].longRunKm >= 13, `précondition : sans plafond, la sortie longue de la deuxième semaine (${libre7.macroPlan[1].longRunKm} km) ne dépasse pas celle de la semaine plafonnée`);
    assert.equal(ctx7.macroPlan[1].quality.length, 1, `deuxième semaine de 34 km, sortie longue raccourcie à 10 km : ${ctx7.macroPlan[1].quality.length} séances de qualité (${ctx7.macroPlan[1].quality.join(", ")})`);
  });

  await test("sous le plafond, le plan est celui d'avant ; au plafond, raccourcir la sortie longue n'ajoute pas de séance dure", async () => {
    // ⚠️ APRÈS LA FIN DE LA RÈGLE D'INTENSITÉ (63ᵉ jour) : tant qu'elle court, c'est elle qui borne la sortie longue et les
    // séances dures. La scène se joue donc au dernier palier (80 %), au 70ᵉ jour de la reprise d'un arrêt de 57 jours
    // (au-delà de 60 jours d'arrêt, les huit semaines d'avant sortiraient de l'historique long).
    // Une reprise prudente, avec une sortie longue par semaine : cinq sorties de `km` et une de `longue` (4 et 16 : 32 km par semaine).
    const repriseAvecLongue = (repris: number, km = 4, longue = 16) => Array.from({ length: repris }, (_, k) => repris - k).filter((n) => (repris - n) % 7 !== 3)
      .map((n) => sortie(n, (repris - n) % 7 === 5 ? longue : km));
    const semi = [objectif({ race: "Semi test", raceDate: ilYa(-84), distanceKm: 21.1, targetTime: "1h45'00", targetSeconds: 6300, targetPace: "4'59/km" })];
    const nbDures = (ctx: AthleteContext) => dures(ctx).length;
    const resume = (ctx: AthleteContext) => ({ cible: ctx.volume.targetKm, longue: ctx.volume.longRunKm, feuilleDeRoute: ctx.macroPlan.slice(0, 4).map((w) => `${w.volumeKm}/${w.longRunKm}/${w.quality.length}`), dures: dures(ctx) });
    // LE JUMEAU SANS PLAFOND : la même reprise, mais des sorties d'avant l'arrêt sans distance (montre sans GPS). Son
    // volume d'avant l'arrêt est inconnu : aucun plafond. C'est le plan que ce coureur avait avant ce changement.
    // ⚠️ Comparer au jumeau, pas à des nombres : une semaine sur quatre est allégée (la cible passe de 32 à 26 km).
    const jumeau = await contexte({ seances: [...avantArret(70 + 57 + 1, 76, null), ...repriseAvecLongue(70)], notifications: semi });
    assert.doesNotMatch(ditArret(jumeau), /% au plus/, "précondition : le jumeau a un plafond");
    const T = jumeau.volume.targetKm;
    assert.ok(T >= 20 && jumeau.volume.longRunKm > Math.round(T * 0.3), `précondition : la sortie longue du jumeau (${jumeau.volume.longRunKm} km sur ${T}) ne dépasse pas 30 % de sa semaine, la borne ne mordrait pas`);
    // (a) SOUS LE PLAFOND : 60 km par semaine avant 57 jours d'arrêt, 70ᵉ jour de reprise. Le plafond est de 48 km (80 %),
    // la semaine en vise moins : le plafond ne la touche pas. Tout le plan est celui du jumeau.
    const sous = await contexte({ seances: [...avantArret(70 + 57 + 1), ...repriseAvecLongue(70)], notifications: semi });
    assert.match(ditArret(sous), /80 % au plus de ton volume d'avant l'arrêt/, `précondition : le plafond de 80 % n'est pas annoncé (${ditArret(sous)})`);
    assert.ok(T < 48, `précondition : la semaine du jumeau (${T} km) n'est pas sous le plafond de 48 km`);
    // (L'état du plan, lui, peut valoir « sans-qualite » : une semaine allégée, une sur quatre, est trop petite pour
    // porter une séance dure et un footing. Le jumeau la reçoit de même, et la comparaison tient.)
    assert.equal(arretHorsEchelle([...avantArret(70 + 57 + 1), ...repriseAvecLongue(70)].map((w) => w.date), AUJOURDHUI), null, "précondition : au 70ᵉ jour, la règle d'intensité court encore");
    assert.equal(sous.weekPlan.repriseArret, jumeau.weekPlan.repriseArret, "sous le plafond, l'état de la semaine n'est plus celui du jumeau");
    assert.deepEqual(resume(sous), resume(jumeau), "sous le plafond, le plan n'est plus celui d'avant : un plafond qui ne s'applique pas à cette semaine l'a changé");
    // (b) AU PLAFOND, DE PEU : le même coureur, avec un volume d'avant l'arrêt choisi pour que le plafond de 80 % tombe
    // UN kilomètre sous la semaine du jumeau. La semaine perd un kilomètre, sa sortie longue est ramenée à 30 % : sans
    // réserve, le volume libéré logeait une seconde séance dure.
    // ⚠️ DEUX COUREURS, parce qu'une semaine sur quatre est allégée : le premier (32 km dont 16 de sortie longue) gagnait
    // sa séance dure les semaines ordinaires, le second (45 km dont 20) la semaine allégée. À toute date, l'un des deux
    // la gagnait sans la réserve.
    for (const [km, longue] of [[4, 16], [5, 20]] as const) {
      const reprise = repriseAvecLongue(70, km, longue);
      const libre = await contexte({ seances: [...avantArret(70 + 57 + 1, 76, null), ...reprise], notifications: semi });
      const Tl = libre.volume.targetKm;
      assert.ok(libre.volume.longRunKm > Math.round(Tl * 0.3), `sortie longue de ${longue} km : précondition, celle du jumeau (${libre.volume.longRunKm} km sur ${Tl}) ne dépasse pas 30 % de sa semaine`);
      const auPlafond = await contexte({ seances: [...avantArret(70 + 57 + 1, 76, (Tl - 1) / 4.8), ...reprise], notifications: semi });
      assert.equal(auPlafond.volume.targetKm, Tl - 1, `sortie longue de ${longue} km : précondition, la semaine n'est pas ramenée à son plafond de ${Tl - 1} km (${auPlafond.volume.targetKm})`);
      assert.equal(auPlafond.volume.longRunPlanned, Math.round((Tl - 1) * 0.3), `sortie longue de ${longue} km : au plafond, elle n'est pas bornée à 30 % de la semaine`);
      assert.equal(auPlafond.macroPlan[0].longRunKm, Math.round((Tl - 1) * 0.3), `sortie longue de ${longue} km : au plafond, celle de la feuille de route n'est pas bornée à 30 % de la semaine`);
      assert.ok(nbDures(auPlafond) <= nbDures(libre), `sortie longue de ${longue} km : au plafond, la raccourcir a ajouté une séance dure : ${dures(auPlafond).join(", ")} (sans plafond : ${dures(libre).join(", ") || "aucune"})`);
      // Les kilomètres retirés à la sortie longue sont réservés : exactement l'écart entre la sortie longue du jumeau
      // et la sortie longue bornée.
      assert.equal(auPlafond.volume.longRunReserveKm, libre.macroPlan[0].longRunKm - Math.round((Tl - 1) * 0.3), `sortie longue de ${longue} km : les kilomètres retirés à la sortie longue ne sont pas réservés`);
    }
    // (b bis) UN VOLUME CIBLE DÉCLARÉ QUI TIENT LA SEMAINE SOUS LE PLAFOND. La feuille de route atteint le plafond et
    // raccourcit sa sortie longue ; le volume cible déclaré ramène ensuite la semaine plus bas. Le plafond a bien mordu :
    // la réserve compte, sinon le plan retrouve la place d'une séance dure.
    // Une reprise qui monte : sept semaines à 20 km (cinq sorties de 2 km et une de 10), puis une à 32 km (4 km et 16).
    const repriseQuiMonte = [...repriseAvecLongue(70, 2, 10).filter((w) => w.date < ilYa(7)), ...repriseAvecLongue(70).filter((w) => w.date >= ilYa(7))];
    const profilCible = { ...PROFIL, target_weekly_km: 22 };
    const libreCible = await contexte({ seances: [...avantArret(70 + 57 + 1, 76, null), ...repriseQuiMonte], notifications: semi, profil: profilCible });
    const V0 = libreCible.macroPlan[0].volumeKm, Tc = libreCible.volume.targetKm, L0 = libreCible.macroPlan[0].longRunKm;
    assert.ok(Tc < V0, `précondition : le volume cible déclaré ne ramène pas la semaine sous celle de la feuille de route (${Tc} km pour ${V0})`);
    assert.ok(L0 > Math.round(Tc * 0.3), `précondition : la sortie longue du jumeau (${L0} km) ne dépasse pas 30 % de sa semaine de ${Tc} km`);
    // Le plafond de 80 % tombe exactement sur la semaine de la feuille de route : il mord, sans changer le volume.
    const cible = await contexte({ seances: [...avantArret(70 + 57 + 1, 76, V0 / 4.8), ...repriseQuiMonte], notifications: semi, profil: profilCible });
    assert.deepEqual({ feuilleDeRoute: cible.macroPlan[0].volumeKm, semaine: cible.volume.targetKm }, { feuilleDeRoute: V0, semaine: Tc }, "précondition : avec un volume cible déclaré, la semaine n'est pas celle du jumeau");
    assert.equal(cible.volume.longRunPlanned, Math.round(Tc * 0.3), "volume cible déclaré : la sortie longue n'est pas bornée à 30 % de la semaine");
    assert.equal(cible.volume.longRunReserveKm, L0 - Math.round(Tc * 0.3), "volume cible déclaré : les kilomètres retirés à la sortie longue ne sont pas réservés");
    assert.ok(nbDures(cible) <= nbDures(libreCible), `volume cible déclaré : raccourcir la sortie longue a ajouté une séance dure : ${dures(cible).join(", ")} (sans plafond : ${dures(libreCible).join(", ") || "aucune"})`);
    // Et le plan LIT cette réserve là où il compte ses séances dures sur le volume. ⚠️ Ancre de source, en plus du
    // comportement ci-dessus : selon la semaine du calendrier, aucun des deux coureurs ne gagnerait de séance dure.
    assert.match(codeNu("src/lib/ai/autoPlan.ts"), /const maxByVolume = Math\.max\(1, Math\.floor\(\(targetKm - longRunKm - \(ctx\.volume\.longRunReserveKm \?\? 0\)\) \/ QUALITY_KM\)\);/, "le plan ne lit plus la réserve de kilomètres de la sortie longue");
    // (c) LA RÈGLE D'INTENSITÉ FINIE, LA SORTIE LONGUE RESTE POSÉE, même plus courte que la sortie habituelle d'avant
    // l'arrêt : la retirer libérait son volume pour une séance dure (95 plans sur 2 800 tirés au hasard). 90 jours
    // d'arrêt, 70ᵉ jour d'une reprise prudente (six sorties de 4 km par semaine).
    const apresRegle = await contexte({ seances: longArret(90, 70, 4) });
    assert.equal(arretHorsEchelle(longArret(90, 70, 4).map((w) => w.date), AUJOURDHUI), null, "précondition : au 70ᵉ jour, la règle d'intensité court encore");
    assert.ok(apresRegle.volume.longRunPlanned >= 4 && apresRegle.volume.longRunPlanned < 10, `précondition : sortie longue prévue de ${apresRegle.volume.longRunPlanned} km, qui ne se compare pas aux 10 km habituels`);
    assert.ok(apresRegle.volume.longRunKm >= 4, `la règle d'intensité finie, la sortie longue (${apresRegle.volume.longRunKm} km) est retirée parce qu'elle est plus courte que la sortie habituelle`);
  });

  await test("reprise d'un long arrêt : une semaine sans sortie longue ne porte que des footings, au plafond comme dessous", async () => {
    const footings = (ctx: AthleteContext) => buildWeekPlan(ctx, new Date(`${AUJOURDHUI}T08:00:00Z`)).filter((d) => /Endurance|R[ée]cup/i.test(d.type)).length;
    // (a) TROIS JOURS DISPONIBLES, UN MARATHON : 96 km par semaine avant 107 jours d'arrêt, 19ᵉ jour d'une reprise forte
    // (six sorties de 20 km par semaine). Sans plafond, ses trois jours portent deux footings et la sortie longue. Plafonnée
    // à 33 % (32 km), sa sortie longue est plus courte que sa sortie habituelle et n'est pas posée : son jour ne doit pas
    // recevoir la séance au seuil que la règle d'intensité permet depuis le 14ᵉ jour.
    const profil3 = { ...PROFIL, days_per_week: 3 };
    const marathon = [objectif({ race: "Marathon test", raceDate: ilYa(-77), distanceKm: 42.195, targetTime: "3h30'00", targetSeconds: 12600, targetPace: "4'59/km" })];
    const troisJours = await contexte({ seances: [...avantArret(19 + 107 + 1, 76, 16), ...depuisReprise(19, 20)], notifications: marathon, profil: profil3 });
    const troisJoursLibre = await contexte({ seances: [...avantArret(19 + 107 + 1, 76, null), ...depuisReprise(19, 20)], notifications: marathon, profil: profil3 });
    assert.equal(troisJours.volume.targetKm, 32, `précondition : la semaine n'est pas plafonnée à 33 % de 96 km (${troisJours.volume.targetKm})`);
    assert.equal(troisJours.volume.longRunKm, 0, "précondition : la sortie longue de la semaine plafonnée n'est pas retirée");
    assert.ok(troisJoursLibre.volume.longRunKm > 0, "précondition : sans plafond, ce coureur n'a pas de sortie longue");
    assert.ok(dures(troisJours).length <= dures(troisJoursLibre).length, `trois jours disponibles : le jour de la sortie longue retirée reçoit une séance dure : ${dures(troisJours).join(", ")} (sans plafond : ${dures(troisJoursLibre).join(", ") || "aucune"})`);
    assert.deepEqual(dures(troisJours), [], "trois jours disponibles : une séance dure est posée dans une semaine plafonnée sans sortie longue");
    // (b) UN PETIT COUREUR : cinq sorties de 6 km par semaine (30 km) avant 70 jours d'arrêt, 16ᵉ jour de reprise. Plafonné
    // (33 % feraient 10 km, moins que deux footings : le plafond passe au palier de 50 %, 15 km), sa sortie longue est
    // retirée et il recevait une séance au seuil à sa place. Il reçoit des footings.
    const cinqJours = (dernier: number, n: number) => Array.from({ length: n }, (_, k) => dernier + k).filter((d) => (d - dernier) % 7 < 5);
    const petit = (kmAvant: number | null) => contexte({ profil: { ...PROFIL, days_per_week: 5 },
      seances: [...cinqJours(16 + 70 + 1, 76).map((n) => ({ ...sortie(n), distance_km: kmAvant })), ...Array.from({ length: 16 }, (_, k) => 16 - k).filter((n) => (16 - n) % 7 < 5).map((n) => sortie(n, 6))] });
    const petitPlafonne = await petit(6), petitLibre = await petit(null);
    assert.ok(dures(petitLibre).length >= 1, "précondition : sans plafond, ce petit coureur n'a aucune séance dure, le test ne prouverait rien");
    assert.equal(petitPlafonne.volume.targetKm, 15, `précondition : la semaine du petit coureur n'est pas plafonnée à 15 km (${petitPlafonne.volume.targetKm})`);
    assert.equal(petitPlafonne.volume.longRunKm, 0, "précondition : la sortie longue du petit coureur plafonné n'est pas retirée");
    assert.deepEqual(dures(petitPlafonne), [], "le petit coureur plafonné à 15 km reçoit une séance dure");
    assert.ok(footings(petitPlafonne) >= 2, `le petit coureur plafonné ne reçoit que ${footings(petitPlafonne)} footing(s)`);
    // L'invite de l'IA annonce la même semaine que le plan : aucune séance de qualité à tenir, là où le jumeau sans
    // plafond en reçoit une. Sans cela, l'IA lisait « Qualité 1 : seuil » pour une semaine de footings.
    for (const [nom, plafonne, libre] of [["trois jours disponibles", troisJours, troisJoursLibre], ["petit coureur", petitPlafonne, petitLibre]] as const) {
      assert.doesNotMatch(plafonne.text, /• Qualité 1/, `${nom} : l'invite de l'IA annonce une séance de qualité que le plan ne pose pas`);
      assert.match(plafonne.text, /• Aucune séance dure ce cycle/, `${nom} : l'invite de l'IA ne dit pas que la semaine est sans séance dure`);
      assert.match(plafonne.text, / 0 séance\(s\) de qualité COURTE/, `${nom} : l'invite de l'IA compte encore une séance de qualité`);
    }
    assert.match(petitLibre.text, /• Qualité 1/, "contre-poids : sans plafond, l'invite de l'IA n'annonce plus la séance de qualité du petit coureur");
    assert.match(petitLibre.text, /• 1 sortie longue/, "contre-poids : avec sa sortie longue, l'invite de l'IA ne l'annonce plus");
    assert.match(petitLibre.lastSession?.effect ?? "", /→ 1 séance de qualité/, `contre-poids : l'effet annoncé au petit coureur sans plafond (${petitLibre.lastSession?.effect})`);
    // LE MOTIF DIT LA MÊME CHOSE QUE LE PLAN, dans les cinq langues : « footings seulement », plus « une seule séance
    // de qualité par semaine au plus » au-dessus d'une semaine qui n'en porte aucune. Dans le bandeau comme dans l'invite.
    // La phrase ENTIÈRE, écrite ici en toutes lettres : elle dit la vraie cause (la sortie longue serait plus courte que la
    // sortie habituelle), pas « ce volume ne laisse pas la place », faux pour une semaine de 46 ou de 99 km.
    const PHRASE = {
      fr: "footings seulement cette semaine : ta sortie longue serait plus courte que ta sortie habituelle, elle n'est pas posée, et la séance dure attend son retour",
      en: "easy runs only this week: your long run would be shorter than your usual run, so it is not scheduled, and the hard session waits until it is back",
      de: "vorerst nur lockere Läufe: Dein langer Lauf wäre kürzer als dein üblicher Lauf und wird deshalb nicht eingeplant, die harte Einheit wartet, bis er zurück ist",
      es: "solo rodajes suaves esta semana: tu tirada larga sería más corta que tu salida habitual, así que no se programa, y la sesión dura espera a que vuelva",
      pt: "só corridas fáceis esta semana: o teu treino longo seria mais curto do que a tua corrida habitual, por isso não é marcado, e a sessão dura espera que ele volte",
    } as const;
    const UNE_AU_PLUS = { fr: /une seule séance de qualité/, en: /one quality session/, de: /Qualitätseinheit/, es: /sesión de calidad/, pt: /sessão de qualidade/ } as const;
    // Le petit coureur est à un palier RELEVÉ (50 % là où Daniels donne 33 %) : son motif ne cite pas Daniels.
    for (const [nom, plafonne, pct, daniels] of [["trois jours disponibles", troisJours, "33", " (règle de Daniels)"], ["petit coureur", petitPlafonne, "50", ""]] as const) {
      assert.equal(plafonne.weekPlan.repriseArret, "sans-qualite", `${nom} : l'état transmis au plan n'est pas « sans-qualite »`);
      assert.ok(ditArret(plafonne).endsWith(`: ${pct} % au plus de ton volume d'avant l'arrêt cette semaine${daniels} ; ${PHRASE.fr}`), `${nom} : le motif ne dit pas le plafond puis « footings seulement » (${ditArret(plafonne)})`);
      assert.equal(/Daniels/.test(plafonne.readiness.reasonsAll.map((m) => `${m.en} ${m.de} ${m.es} ${m.pt}`).join(" ")), daniels !== "", `${nom} : Daniels est cité à tort, ou ne l'est plus, dans une autre langue`);
      const motif = plafonne.readiness.reasonsAll.find((m) => /sans courir/.test(m.fr));
      assert.ok(motif, `${nom} : le motif de l'arrêt manque dans les cinq langues`);
      for (const l of Object.keys(PHRASE) as (keyof typeof PHRASE)[]) {
        assert.ok(motif[l].endsWith(PHRASE[l]), `${nom}, ${l} : le motif ne finit pas par la phrase « footings seulement » entière (« ${motif[l]} »)`);
        assert.doesNotMatch(motif[l], UNE_AU_PLUS[l], `${nom}, ${l} : le motif annonce encore une séance de qualité (« ${motif[l]} »)`);
        assert.ok(motif[l].includes(pct), `${nom}, ${l} : le pourcentage du plafond a disparu (« ${motif[l]} »)`);
      }
      assert.ok(plafonne.text.includes(PHRASE.fr), `${nom} : l'invite de l'IA ne porte pas le motif « footings seulement »`);
      // L'invite n'annonce pas non plus la sortie longue que le plan ne pose pas.
      assert.doesNotMatch(plafonne.text, /• 1 sortie longue|• 1 SORTIE LONGUE/, `${nom} : l'invite de l'IA annonce une sortie longue que le plan ne pose pas`);
      assert.match(plafonne.text, /• PAS de sortie longue cette semaine \(reprise après un arrêt\) : uniquement des footings\./, `${nom} : l'invite de l'IA ne dit pas que la semaine est sans sortie longue`);
      // Ce que le plan reçoit et ce que le coureur lit : budget à zéro, aucune séance retenue, « aucune séance de qualité ».
      assert.equal(plafonne.weekPlan.qBudget, 0, `${nom} : le budget de qualité transmis au plan n'est pas nul`);
      assert.deepEqual(plafonne.weekPlan.quality, [], `${nom} : une séance de qualité est encore transmise au plan`);
      assert.equal(plafonne.weekPlan.qualiteDes, 7, `${nom} : un jour de la semaine reste ouvert à une séance dure`);
      assert.match(plafonne.lastSession?.effect ?? "", /→ aucune séance de qualité cette semaine\.$/, `${nom} : l'effet annoncé n'est pas « aucune séance de qualité » (${plafonne.lastSession?.effect})`);
      assert.doesNotMatch(plafonne.text, /une seule séance de qualité par semaine au plus/, `${nom} : l'invite de l'IA annonce encore « une seule séance de qualité par semaine au plus »`);
    }
    // (c) CONTRE-POIDS : au palier suivant, la sortie longue tient de nouveau et la séance dure revient. 60 km par semaine
    // avant 35 jours d'arrêt, 30ᵉ jour de reprise forte : 75 %, soit 45 km, sortie longue de 13 km pour 10 km habituels.
    const palierSuivant = await contexte({ seances: longArret(35, 30) });
    assert.ok(palierSuivant.volume.longRunKm >= 10, `précondition : au palier à 75 %, la sortie longue (${palierSuivant.volume.longRunKm} km) ne tient pas`);
    assert.ok(dures(palierSuivant).length >= 1, "au palier suivant, la séance dure ne revient pas : la règle retire plus que prévu");
    // (b bis) LE COUREUR PRUDENT, JUSTE SOUS SON PLAFOND (visa RENVOYÉ du directeur scientifique, 20/11/2026) : 25 km par
    // semaine (cinq sorties de 5 km), 45 jours d'arrêt, repris depuis 10 jours au même rythme. Sa semaine reste sous le
    // plafond de 50 % et sa sortie longue est retirée : il recevait un seuil pour UNIQUE sortie, là où son jumeau qui
    // force recevait deux footings. La règle se déclenche sur la sortie longue retirée, que le plafond morde ou non.
    const prudentSeances = (kmAvant: number | null) => [...cinqJours(10 + 45 + 1, 76).map((n) => ({ ...sortie(n, 5), distance_km: kmAvant })), ...Array.from({ length: 10 }, (_, k) => 10 - k).filter((n) => (10 - n) % 7 < 5).map((n) => sortie(n, 5))];
    const prudent = await contexte({ profil: { ...PROFIL, days_per_week: 5 }, seances: prudentSeances(5) });
    const prudentLibre = await contexte({ profil: { ...PROFIL, days_per_week: 5 }, seances: prudentSeances(null) });
    assert.ok(prudent.volume.targetKm >= 12 && prudent.volume.targetKm <= 13, `précondition : le coureur prudent vise ${prudent.volume.targetKm} km, attendu de 12 à 13 (au plafond de 50 % de 25 km ou juste dessous)`);
    assert.equal(prudent.volume.longRunKm, 0, "précondition : la sortie longue du coureur prudent n'est pas retirée");
    // Précondition, lue sur la règle d'intensité elle-même : elle PERMET une séance par semaine à ce coureur. (Le
    // jumeau dont les sorties d'avant n'ont pas de distance la gardait ; depuis le 23/11/2026 sa semaine de 12-13 km
    // est trop petite pour un seuil et un footing, elle ne porte que des footings elle aussi.)
    assert.equal(qualitePendantReprise(arretHorsEchelle(prudentSeances(5).map((w) => w.date), AUJOURDHUI))?.max, 1, "précondition : la règle d'intensité ne permet aucune séance à ce coureur, le test ne prouverait rien");
    assert.equal(prudentLibre.weekPlan.repriseArret, "sans-qualite", "le jumeau sans distance, à 12-13 km visés, garde un seuil dans une semaine trop petite");
    assert.equal(prudent.weekPlan.repriseArret, "sans-qualite", "coureur prudent sous son plafond : l'état transmis au plan n'est pas « sans-qualite »");
    assert.deepEqual(dures(prudent), [], `coureur prudent sous son plafond : une séance dure est posée (${dures(prudent).join(", ")})`);
    assert.ok(footings(prudent) >= 2, `coureur prudent sous son plafond : ${footings(prudent)} footing(s) seulement`);
    assert.ok(ditArret(prudent).endsWith(PHRASE.fr), `coureur prudent sous son plafond : le motif ne dit pas « footings seulement » (${ditArret(prudent)})`);
    // UN AUTRE MOTIF À CÔTÉ : une course C inscrite cette semaine garde son propre motif, que celui de l'arrêt ne
    // remplace pas (seul le motif de l'arrêt change de fin). 60 km par semaine, 60 jours d'arrêt, 16ᵉ jour de reprise.
    const courseC = [{ user_id: "u", type: "planned_race", created_at: `${AUJOURDHUI}T10:00:00Z`, data: { name: "Corrida du quartier", date: ilYa(-4), distanceKm: 10, priorite: "C" } }];
    const avecCourse = await contexte({ seances: longArret(60, 16), notifications: courseC });
    assert.equal(avecCourse.volume.longRunKm, 0, "précondition : avec une course C, la sortie longue de la semaine plafonnée n'est pas retirée");
    assert.ok(ditArret(avecCourse).endsWith(PHRASE.fr), `avec une course C : le motif de l'arrêt ne dit pas « footings seulement » (${ditArret(avecCourse)})`);
    const motifsCourse = avecCourse.readiness.reasons.filter((m) => /course C cette semaine : Corrida du quartier/.test(m));
    assert.equal(motifsCourse.length, 1, `avec une course C : son motif a disparu ou a été remplacé par celui de l'arrêt (${avecCourse.readiness.reasons.join(" | ")})`);
    assert.equal(avecCourse.readiness.reasons.filter((m) => m.endsWith(PHRASE.fr)).length, 1, "avec une course C : le motif « footings seulement » est écrit plusieurs fois");
    assert.equal(avecCourse.readiness.reasonsAll.filter((m) => /Corrida du quartier/.test(m.en)).length, 1, "avec une course C : son motif manque dans les autres langues");
    // AVANT LE 14ᵉ JOUR, le motif d'origine est déjà juste et reste dit : 60 km par semaine, 40 jours d'arrêt, 5ᵉ jour de
    // reprise forte (33 %, 20 km, sortie longue retirée).
    const avantQuatorze = await contexte({ seances: longArret(40, 5) });
    assert.equal(avantQuatorze.volume.targetKm, 20, "précondition : le 5ᵉ jour de reprise n'est pas plafonné à 33 % de 60 km");
    assert.equal(avantQuatorze.volume.longRunKm, 0, "précondition : au 5ᵉ jour, la sortie longue de la semaine plafonnée n'est pas retirée");
    assert.match(ditArret(avantQuatorze), /33 % au plus de ton volume d'avant l'arrêt cette semaine \(règle de Daniels\) ; aucune séance dure pendant les deux premières semaines de reprise, puis une seule par semaine jusqu'à la quatrième/, `avant le 14ᵉ jour, le motif ne dit plus la règle des deux premières semaines (${ditArret(avantQuatorze)})`);
    // (c bis) CONTRE-POIDS DANS LA RÈGLE D'INTENSITÉ (condition du directeur scientifique, 20/11/2026) : la règle « une
    // séance au seuil par semaine à partir du 14ᵉ jour » reste tenue quand la sortie longue tient. 60 km par semaine,
    // 30 jours d'arrêt, 22ᵉ jour de reprise forte : palier de 75 % (45 km), sortie longue de 13 km pour 10 km habituels.
    const longueTient = await contexte({ seances: longArret(30, 22) });
    assert.equal(longueTient.volume.targetKm, 45, `précondition : le 22ᵉ jour d'une reprise de 30 jours n'est pas au palier de 75 % (${longueTient.volume.targetKm} km)`);
    assert.ok(longueTient.volume.longRunKm >= 10, `précondition : au palier de 75 %, la sortie longue (${longueTient.volume.longRunKm} km) ne tient pas`);
    assert.equal(longueTient.weekPlan.repriseArret, "une-qualite", "sous le plafond, la séance au seuil de la règle d'intensité est retirée alors que la sortie longue tient");
    // Pendant les quatre semaines de la règle d'intensité, c'est elle qui borne les séances dures : pas de réserve,
    // même quand le plafond raccourcit la sortie longue (le même coureur avec un marathon dans onze semaines, dont
    // la sortie longue prévue dépasse 30 % de la semaine plafonnée).
    const longueTientMarathon = await contexte({ seances: longArret(30, 22), notifications: marathon });
    assert.equal(longueTientMarathon.volume.targetKm, 45, "précondition : avec un marathon, le 22ᵉ jour n'est pas au palier de 75 %");
    assert.equal(longueTientMarathon.volume.longRunPlanned, 14, `précondition : la sortie longue du marathonien (${longueTientMarathon.volume.longRunPlanned} km) n'est pas bornée à 30 % de 45 km`);
    assert.equal(longueTientMarathon.weekPlan.repriseArret, "une-qualite", "précondition : le marathonien n'est pas dans la règle d'intensité");
    for (const c of [longueTient, longueTientMarathon]) assert.equal(c.volume.longRunReserveKm, undefined, `une réserve de ${c.volume.longRunReserveKm} km est comptée pendant la règle d'intensité`);
    assert.equal(dures(longueTient).length, 1, `sous le plafond avec sa sortie longue, le coureur ne reçoit pas sa séance au seuil (${dures(longueTient).join(", ") || "aucune"})`);
    assert.match(ditArret(longueTient), /75 % au plus de ton volume d'avant l'arrêt cette semaine \(règle de Daniels\) ; une seule séance de qualité par semaine au plus/, `le motif ne dit plus la règle d'intensité (${ditArret(longueTient)})`);
    // (d) CONTRE-POIDS : SANS plafond de long arrêt, une sortie longue retirée ne retire pas la séance dure. 60 km par
    // semaine, 8 jours d'arrêt, repris depuis 2 jours : la règle des arrêts courts retire la sortie longue (9 km pour
    // 10 km habituels) et permet une séance au seuil dès le premier jour de reprise.
    const arretCourt = await contexte({ seances: [...avantArret(2 + 8 + 1), ...depuisReprise(2)] });
    assert.equal(arretCourt.volume.longRunKm, 0, "précondition : la sortie longue de l'arrêt court n'est pas retirée");
    assert.equal(arretCourt.weekPlan.repriseArret, "une-qualite", "une sortie longue retirée hors de tout plafond de long arrêt retire la séance dure permise");
    assert.equal(dures(arretCourt).length, 1, `après un arrêt court, la séance au seuil permise n'est plus posée (${dures(arretCourt).join(", ") || "aucune"})`);
  });

  await test("petit volume : le plafond laisse au moins deux footings dans la semaine, et ne disparaît pas faute de palier", async () => {
    // LA PART QUI PLAFONNE. Au-dessus de 36 km par semaine, c'est celle de Daniels, à chaque jour de la reprise.
    for (const arret of [29, 40, 56, 57, 90, 200]) for (let repris = 0; repris <= 90; repris++) for (const dans of [0, 7, 14]) {
      const r = { arretJours: arret, joursRepris: repris };
      assert.equal(partPlafondLongArret(r, 60, dans), partApresLongArret(r, dans), `60 km, ${arret} jours d'arrêt, jour ${repris}+${dans} : la part n'est plus celle de Daniels`);
      assert.equal(partPlafondLongArret(r, 37, dans), partApresLongArret(r, dans), `37 km, ${arret} jours d'arrêt, jour ${repris}+${dans} : la part n'est plus celle de Daniels`);
      // Un petit volume ne fait que MONTER la part, jamais la baisser, et la part ne redescend pas avec les semaines.
      for (const v of [8, 13, 15, 16, 17, 20, 24, 30, 35]) {
        const p = partPlafondLongArret(r, v, dans);
        assert.ok(p >= partApresLongArret(r, dans), `${v} km, ${arret} jours d'arrêt, jour ${repris}+${dans} : part ${p}, plus basse que celle de Daniels`);
        assert.ok(p === 1 || Math.round(v * p) >= 12, `${v} km, ${arret} jours d'arrêt, jour ${repris}+${dans} : plafond de ${Math.round(v * p)} km, moins que deux footings`);
        assert.ok(partPlafondLongArret(r, v, dans + 7) >= p, `${v} km, ${arret} jours d'arrêt, jour ${repris}+${dans} : la part baisse la semaine suivante`);
        // LE PLAFOND NE DISPARAÎT JAMAIS FAUTE DE PALIER : tant que Daniels plafonne et que le volume d'avant dépasse
        // deux footings, il y a un plafond, de 12 km au moins. Sous 12 km d'avant (8 km ici), pas de plafond.
        if (partApresLongArret(r, dans) < 1) assert.equal(p < 1, v > 12, `${v} km, ${arret} jours d'arrêt, jour ${repris}+${dans} : ${p < 1 ? "un plafond est posé sous deux footings d'avant" : "le plafond a disparu faute de palier"}`);
        assert.equal(plafondReplieSurPlancher(r, v, dans), p < 1 && !(arret > 56 ? [0.33, 0.5, 0.7, 0.8] : [0.33, 0.5, 0.75]).includes(p), `${v} km, ${arret} jours d'arrêt, jour ${repris}+${dans} : « replié sur le plancher » ne dit pas ce que fait la part (${p})`);
        if (plafondReplieSurPlancher(r, v, dans)) assert.equal(Math.round(v * p), 12, `${v} km, ${arret} jours d'arrêt, jour ${repris}+${dans} : le plafond replié ne vaut pas 12 km`);
      }
    }
    const debut = { arretJours: 40, joursRepris: 0 }, tresLong = { arretJours: 90, joursRepris: 0 };
    assert.equal(partPlafondLongArret(debut, 36), 0.33, "36 km : 33 % font 12 km, la part de Daniels tient");
    assert.equal(partPlafondLongArret(debut, 30), 0.5, "30 km : 33 % font 10 km, le plafond ne passe pas au palier de 50 %");
    assert.equal(partPlafondLongArret(debut, 20), 0.75, "20 km : le plafond ne passe pas au palier de 75 %");
    // AUCUN PALIER NE LAISSE DEUX FOOTINGS : le plafond se replie sur 12 km (il valait 1, « pas de plafond »).
    for (const v of [13, 15]) {
      assert.equal(Math.round(v * partPlafondLongArret(debut, v)), 12, `${v} km après 40 jours : le plafond ne vaut pas 12 km (part ${partPlafondLongArret(debut, v)})`);
      assert.equal(plafondReplieSurPlancher(debut, v), true, `${v} km après 40 jours : le plafond n'est pas dit replié sur le plancher`);
    }
    for (const v of [12, 10, 0]) {
      assert.equal(partPlafondLongArret(debut, v), 1, `${v} km après 40 jours : un plafond est posé sous deux footings d'avant`);
      assert.equal(plafondReplieSurPlancher(debut, v), false);
    }
    for (const [r, v] of [[debut, 36], [debut, 30], [debut, 16], [tresLong, 15], [tresLong, 60], [null, 14], [{ arretJours: 20, joursRepris: 0 }, 14], [{ arretJours: 40, joursRepris: 40 }, 14]] as const) {
      assert.equal(plafondReplieSurPlancher(r, v), false, `${v} km, ${r ? r.arretJours + " jours d'arrêt" : "pas d'arrêt"} : un palier de l'échelle (ou aucun plafond) est dit « replié sur le plancher »`);
    }
    assert.equal(partPlafondLongArret(debut, 0), 1, "volume inconnu : un plafond est posé");
    assert.equal(partPlafondLongArret(tresLong, 30), 0.5);
    assert.equal(partPlafondLongArret(tresLong, 17), 0.7, "17 km après 90 jours : le plafond ne passe pas au palier de 70 %");
    assert.equal(partPlafondLongArret(tresLong, 15), 0.8);
    // Les deux échelles n'ont pas le même seuil : dernier palier à 75 % (29 à 56 jours) ou à 80 % (au-delà).
    assert.equal(partPlafondLongArret(tresLong, 20), 0.7, "20 km après 90 jours : le plafond ne passe pas au palier de 70 %");
    assert.equal(partPlafondLongArret({ arretJours: 90, joursRepris: 63 }, 20), 0.8, "20 km après 90 jours, dernier palier : la part n'est pas 80 %");
    for (const j of [63, 70, 83]) assert.equal(partApresLongArret({ arretJours: 90, joursRepris: j }), 0.8, `90 jours d'arrêt, ${j}ᵉ jour : le dernier palier n'est pas à 80 %`);
    assert.equal(partPlafondLongArret(tresLong, 15), 0.8, "15 km après 90 jours : 80 % font 12 km, un plafond est attendu");
    assert.equal(Math.round(14 * partPlafondLongArret(tresLong, 14)), 12, "14 km après 90 jours : le plafond a disparu avec le dernier palier à 80 % (en ligne, 85 % donnaient 12 km)");
    assert.equal(plafondReplieSurPlancher(tresLong, 14), true);
    assert.equal(partPlafondLongArret({ arretJours: 90, joursRepris: 84 }, 14), 1, "14 km après 90 jours : le plafond dure plus longtemps que la reprise de volume");
    assert.equal(partPlafondLongArret(debut, 16), 0.75, "16 km après 40 jours : 75 % font 12 km, un plafond est attendu");
    assert.equal(partPlafondLongArret(null, 60), 1);
    assert.equal(partPlafondLongArret({ arretJours: 20, joursRepris: 0 }, 60), 1, "un arrêt de 28 jours au plus reçoit le plafond des longs arrêts");

    // LE PLAN. Six sorties par semaine, comme les autres coureurs de cette section, mais courtes : 3,5 km (21 km par
    // semaine) ou 2,5 km (15 km par semaine).
    const sorties = (ctx: AthleteContext) => buildWeekPlan(ctx, new Date(`${AUJOURDHUI}T08:00:00Z`)).filter((d) => /Endurance|R[ée]cup|Sortie longue/i.test(d.type) || DUR.test(d.type)).length;
    const pourcentage = /% au plus de ton volume d'avant l'arrêt/;
    // (a) 21 km par semaine, 60 jours d'arrêt, pas encore repris : 33 % feraient 7 km, UN footing ; 50 %,
    // 11 km, un seul encore à cette allure. Le plafond est le palier de 70 % (15 km), et le motif dit ce palier.
    // La cible reste entre deux footings et ce plafond (une semaine allégée, une sur quatre, la tient à 12 km).
    const pasRepris = await contexte({ seances: avantArret(61, 76, 3.5) });
    assert.ok(pasRepris.volume.targetKm >= 12 && pasRepris.volume.targetKm <= 15, `21 km par semaine avant 60 jours d'arrêt : ${pasRepris.volume.targetKm} km visés, attendu de 12 à 15`);
    assert.ok(sorties(pasRepris) >= 2, `21 km par semaine, pas encore repris : ${sorties(pasRepris)} sortie(s) dans la semaine`);
    assert.match(ditArret(pasRepris), /à 70 % au plus de ton volume d'avant l'arrêt cette semaine/, `le motif ne dit pas le palier appliqué (${ditArret(pasRepris)})`);
    // (a bis) Le même, qui reprend fort (six sorties de 10 km par semaine) depuis 5 jours : la semaine est AU plafond, 15 km, quelle que soit la date.
    const reprisFort = await contexte({ seances: [...avantArret(5 + 60 + 1, 76, 3.5), ...depuisReprise(5)] });
    assert.equal(reprisFort.volume.targetKm, 15, `21 km par semaine, reprise forte après 60 jours : ${reprisFort.volume.targetKm} km visés, attendu le palier de 70 %`);
    assert.ok(sorties(reprisFort) >= 2, `21 km par semaine, reprise forte après 60 jours : ${sorties(reprisFort)} sortie(s) dans la semaine`);
    assert.deepEqual(dures(reprisFort), [], "une séance dure est posée au 5ᵉ jour de reprise d'un arrêt de 60 jours");
    // (b) 40 jours d'arrêt, reprise forte depuis 5 jours : palier de 75 %, 16 km.
    const repris = await contexte({ seances: [...avantArret(5 + 40 + 1, 76, 3.5), ...depuisReprise(5)] });
    assert.equal(repris.volume.targetKm, 16, `21 km par semaine, reprise forte après 40 jours : ${repris.volume.targetKm} km visés, attendu le palier de 75 %`);
    assert.ok(sorties(repris) >= 2, `21 km par semaine, reprise forte après 40 jours : ${sorties(repris)} sortie(s) dans la semaine`);
    assert.match(ditArret(repris), /reprise après 40 jours sans courir : 75 % au plus de ton volume d'avant l'arrêt cette semaine/);
    assert.deepEqual(dures(repris), [], "une séance dure est posée au 5ᵉ jour de reprise d'un arrêt de 40 jours");
    // (c) 15 km par semaine : aucun palier ne laisse deux footings. Le plafond VAUT ces deux footings, 12 km, et le
    // motif le dit en kilomètres, sans pourcentage ; la semaine n'est pas vide ; la règle d'intensité reste dite et tenue.
    for (const [nom, seances] of [["pas encore repris", avantArret(41, 76, 2.5)], ["repris depuis 5 jours", [...avantArret(5 + 40 + 1, 76, 2.5), ...depuisReprise(5, 2.5)]]] as const) {
      const petit = await contexte({ seances: [...seances] });
      assert.doesNotMatch(petit.readiness.reasons.join(" | "), pourcentage, `15 km par semaine, ${nom} : un pourcentage est annoncé pour un plafond en kilomètres`);
      assert.doesNotMatch(petit.readiness.reasons.join(" | "), /n'est pas connu/, `15 km par semaine, ${nom} : un volume connu est dit inconnu`);
      assert.match(ditArret(petit), /12 km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit/, `15 km par semaine, ${nom} : le motif ne dit pas le plafond de 12 km (${ditArret(petit)})`);
      assert.equal(petit.volume.targetKm, 12, `15 km par semaine, ${nom} : ${petit.volume.targetKm} km visés, attendu les deux footings du plancher`);
      assert.ok(sorties(petit) >= 2, `15 km par semaine, ${nom} : ${sorties(petit)} sortie(s) dans la semaine`);
      assert.match(ditArret(petit), /sans séance dure pendant les deux premières semaines|aucune séance dure pendant les deux premières semaines/, `15 km par semaine, ${nom} : la règle d'intensité n'est plus dite`);
      assert.deepEqual(dures(petit), [], `15 km par semaine, ${nom} : une séance dure est posée`);
    }
    // (c bis) Encore plus petit : 9 km par semaine, connus. Ce volume n'est pas dit inconnu, et il est plafonné à
    // LUI-MÊME (23/11/2026 : sans plafond, ce coureur recevait la cible ordinaire du plan, 17 à 20 km).
    for (const [nom, seances] of [["pas encore repris", avantArret(41, 76, 1.5)], ["repris depuis 5 jours", [...avantArret(5 + 40 + 1, 76, 1.5), ...depuisReprise(5, 1.5)]]] as const) {
      const minuscule = await contexte({ seances: [...seances] });
      assert.doesNotMatch(minuscule.readiness.reasons.join(" | "), /n'est pas connu/, `9 km par semaine, ${nom} : un volume connu est dit inconnu (${ditArret(minuscule)})`);
      assert.doesNotMatch(minuscule.readiness.reasons.join(" | "), pourcentage, `9 km par semaine, ${nom} : un pourcentage est annoncé sans plafond`);
      assert.match(ditArret(minuscule), /9 km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit/, `9 km par semaine, ${nom} : le motif ne dit pas le plafond de 9 km (${ditArret(minuscule)})`);
      assert.ok(minuscule.volume.targetKm <= 9 && minuscule.volume.targetKm >= 6, `9 km par semaine, ${nom} : ${minuscule.volume.targetKm} km visés, attendu au plus son volume d'avant`);
      assert.ok(sorties(minuscule) >= 1, `9 km par semaine, ${nom} : la semaine plafonnée à 9 km est vide`);
      assert.deepEqual(dures(minuscule), [], `9 km par semaine, ${nom} : une séance dure est posée`);
      assert.match(ditArret(minuscule), /séance dure pendant les deux premières semaines/, `9 km par semaine, ${nom} : la règle d'intensité n'est plus dite (${ditArret(minuscule)})`);
    }
    // (d) LA FEUILLE DE ROUTE du coureur de (a bis) ne descend pas non plus sous deux footings, avec un 10 km dans
    // 20 semaines : sa première semaine est au palier de 70 %, les suivantes ne passent pas dessous.
    const dixKm = [objectif({ race: "10 km test", raceDate: ilYa(-140), distanceKm: 10, targetTime: "50'00", targetSeconds: 3000, targetPace: "5'00/km" })];
    const route = await contexte({ seances: [...avantArret(5 + 60 + 1, 76, 3.5), ...depuisReprise(5)], notifications: dixKm });
    assert.ok(route.macroPlan.length >= 8, "précondition : la feuille de route du petit coureur n'a pas huit semaines");
    assert.equal(route.macroPlan[0].volumeKm, 15, `feuille de route : la première semaine (${route.macroPlan[0].volumeKm} km) n'est pas au palier de 70 %`);
    assert.ok(route.macroPlan.slice(0, 8).every((w) => w.volumeKm >= 12), `feuille de route : une semaine sous deux footings (${route.macroPlan.slice(0, 8).map((w) => w.volumeKm).join(", ")})`);
  });

  await test("le volume d'avant l'arrêt est la médiane des HUIT semaines d'avant, et la réserve se lit sur la semaine en cours", async () => {
    // UN VOLUME QUI CHANGE avant l'arrêt : 30 km par semaine les quatre dernières semaines, 60 km les quatre d'avant,
    // 90 km les quatre encore avant. La médiane des huit dernières semaines vaut 45 km ; sur quatre semaines elle
    // vaudrait 30 km, sur seize 60 km. 60 jours d'arrêt, 25ᵉ jour de reprise forte : palier de 50 %.
    const varie = (dernier: number) => Array.from({ length: 84 }, (_, k) => k).filter((k) => k % 7 !== 3).map((k) => sortie(dernier + k, k < 28 ? 5 : k < 56 ? 10 : 15));
    const fenetre = await contexte({ seances: [...varie(25 + 60 + 1), ...depuisReprise(25)] });
    assert.equal(fenetre.volume.targetKm, 23, `${fenetre.volume.targetKm} km visés : le plafond n'est pas la moitié des 45 km médians des huit semaines d'avant l'arrêt (15 km = quatre semaines, 30 km = seize)`);
    assert.match(ditArret(fenetre), /reprise après 60 jours sans courir : 50 % au plus de ton volume d'avant l'arrêt cette semaine \(règle de Daniels\)/);
    // LA RÉSERVE SE LIT SUR LA SEMAINE EN COURS de la feuille de route, pas sur la suivante. 35 jours d'arrêt, 30ᵉ jour
    // de reprise forte, un marathon dans onze semaines : cette semaine est au palier de 75 % (45 km), la suivante n'est
    // plus plafonnée. Les kilomètres retirés à la sortie longue de CETTE semaine ne font pas de place à une séance dure.
    const marathon = [objectif({ race: "Marathon test", raceDate: ilYa(-77), distanceKm: 42.195, targetTime: "3h30'00", targetSeconds: 12600, targetPace: "4'59/km" })];
    const finDePlafond = await contexte({ seances: longArret(35, 30), notifications: marathon });
    assert.equal(finDePlafond.macroPlan[0].volumeKm, 45, "précondition : la semaine en cours n'est pas au palier de 75 % de 60 km");
    assert.ok(finDePlafond.macroPlan[1].volumeKm > 45, `précondition : la semaine suivante (${finDePlafond.macroPlan[1].volumeKm} km) est encore plafonnée`);
    assert.ok((finDePlafond.volume.longRunReserveKm ?? 0) >= 2, `la réserve de la sortie longue vaut ${finDePlafond.volume.longRunReserveKm} : elle n'est pas lue sur la semaine en cours`);
  });

  await test("feuille de route : une semaine d'affûtage qui suit des semaines plafonnées ne gagne pas de séance de qualité", async () => {
    // 54 ou 60 km par semaine avant 112 jours d'arrêt, 45ᵉ jour de reprise, un 50 km dans cinq ou six semaines. Les
    // semaines plafonnées (70 % puis 80 %) ont une sortie longue plus courte ; l'affûtage, qui descend depuis la plus
    // longue sortie du bloc, en hérite, et une semaine d'affûtage de MÊME volume gagnait ainsi la place d'une séance
    // de qualité (un ultra à 37 km d'affûtage : 2 qualités au lieu de 1, double relecture du 20/11/2026). Le jumeau
    // sans plafond est le même coureur dont les sorties d'avant l'arrêt n'ont pas de distance.
    let affutagesEprouves = 0;
    for (const [kmAvant, kmReprise, semaines] of [[9, 7, 5], [10, 7, 5], [9, 9, 5], [10, 9, 6]] as const) {
      const course = [objectif({ race: "Course", raceDate: ilYa(-7 * semaines), distanceKm: 50, targetTime: "5h", targetSeconds: 18000, targetPace: "6'00/km" })];
      const seances = (km: number | null) => [...avantArret(45 + 112 + 1, 28, km), ...depuisReprise(45, kmReprise)];
      const plafonne = await contexte({ seances: seances(kmAvant), notifications: course }), libre = await contexte({ seances: seances(null), notifications: course });
      const nom = `${kmAvant * 6} km par semaine avant l'arrêt, reprise à ${kmReprise * 6} km, course dans ${semaines} semaines`;
      assert.equal(plafonne.macroPlan.length, libre.macroPlan.length, `${nom} : les deux feuilles de route n'ont pas la même longueur`);
      assert.ok(plafonne.macroPlan.some((w, k) => w.volumeKm < libre.macroPlan[k].volumeKm), `${nom} : précondition, aucune semaine de la feuille de route n'est plafonnée`);
      plafonne.macroPlan.forEach((w, k) => {
        const ref = libre.macroPlan[k];
        assert.ok(w.quality.length <= ref.quality.length, `${nom}, semaine ${k + 1} (${w.phase}, ${w.volumeKm} km, sortie longue ${w.longRunKm} km) : ${w.quality.length} séance(s) de qualité, ${ref.quality.length} sans le plafond (sortie longue ${ref.longRunKm} km)`);
        assert.ok(w.volumeKm <= ref.volumeKm && w.longRunKm <= ref.longRunKm, `${nom}, semaine ${k + 1} : volume ou sortie longue plus hauts que sans le plafond`);
        // Le cas qui mordait : affûtage de même volume, sortie longue plus courte, et une place de plus à compter dessus.
        if (/Aff/.test(w.phase) && w.volumeKm === ref.volumeKm && Math.floor((w.volumeKm - w.longRunKm) / 11) > Math.max(1, Math.floor((ref.volumeKm - ref.longRunKm) / 11)) && ref.quality.length === 1) affutagesEprouves++;
      });
    }
    assert.ok(affutagesEprouves >= 1, "précondition : aucune semaine d'affûtage n'aurait gagné de place, le test ne prouve rien");
  });

  await test("volume d'avant l'arrêt inconnu ou à moitié visible : ni plafond ni pourcentage, plutôt qu'un plafond faux", async () => {
    // (a) Montre sans GPS avant l'arrêt : aucune distance d'avant. 90 jours d'arrêt, 15 jours de reprise forte.
    const seancesA = [...avantArret(15 + 90 + 1, 76, null), ...depuisReprise(15)];
    const sansDistance = await contexte({ seances: seancesA });
    // (b) 150 jours d'arrêt, 30 jours de reprise forte, une sortie à vélo par jour depuis l'arrêt : l'historique long
    // (190 jours) ne montre plus que les dix derniers jours d'avant l'arrêt, et les 60 dernières séances aucune.
    const seancesB = [...avantArret(30 + 150 + 1), ...Array.from({ length: 179 }, (_, k) => velo(2 + k)), ...depuisReprise(30)];
    const recentesB = [...seancesB].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 60).filter((w) => w.sport === "run");
    assert.ok(recentesB.every((w) => w.date >= ilYa(30)), "précondition : les 60 dernières séances portent encore une course d'avant l'arrêt");
    assert.equal(seancesB.filter((w) => w.sport === "run" && w.date >= ilYa(190) && w.date <= ilYa(181)).length, 9, "précondition : l'historique long ne montre pas neuf sorties d'avant l'arrêt");
    const moitie = await contexte({ seances: seancesB });
    for (const [nom, ctx, seances, arret, repris] of [["sans distance avant l'arrêt", sansDistance, seancesA, 90, 15], ["dix jours visibles sur huit semaines", moitie, seancesB, 150, 30]] as const) {
      assert.deepEqual(repriseVolumeLongArret(seances.filter((w) => w.sport === "run").map((w) => w.date), AUJOURDHUI), { arretJours: arret, enCours: false, joursRepris: repris }, `${nom} : précondition, la reprise du long arrêt n'est pas en cours`);
      assert.doesNotMatch(ctx.readiness.reasons.join(" | "), /% au plus de ton volume d'avant l'arrêt/, `${nom} : un pourcentage du volume d'avant l'arrêt est annoncé alors que ce volume n'est pas connu`);
      // Sans plafond, le plan suit ce qui est couru (60 km cette semaine) : bien au-dessus de la moitié d'un volume mal lu.
      assert.ok(ctx.volume.targetKm >= 40, `${nom} : ${ctx.volume.targetKm} km visés, un plafond a été calculé sur un volume d'avant l'arrêt qui n'est pas connu`);
    }
    // (c) UNE SEULE SORTIE visible avant 40 jours d'arrêt, puis dix jours de reprise forte : une sortie n'est pas un volume
    // habituel. La diviser par quatre semaines donnait 2,5 km « d'avant l'arrêt » et une semaine plafonnée à 1 km.
    const seule = await contexte({ seances: [sortie(10 + 40 + 1), ...depuisReprise(10)] });
    assert.deepEqual(repriseVolumeLongArret([ilYa(51), ...depuisReprise(10).map((w) => w.date)], AUJOURDHUI), { arretJours: 40, enCours: false, joursRepris: 10 }, "une seule sortie avant l'arrêt : précondition, la reprise du long arrêt n'est pas en cours");
    assert.doesNotMatch(seule.readiness.reasons.join(" | "), /% au plus de ton volume d'avant l'arrêt/, "une seule sortie avant l'arrêt : un pourcentage d'un volume inconnu est annoncé");
    assert.ok(seule.volume.targetKm >= 15, `une seule sortie avant l'arrêt : ${seule.volume.targetKm} km visés, un plafond a été calculé sur une sortie isolée`);
    // (a) est encore dans les quatre semaines de la règle d'intensité : son motif reste dit, sans pourcentage.
    // Il dit aussi que le volume d'avant l'arrêt n'est pas CONNU : l'absence de plafond n'est pas une mesure.
    assert.match(ditArret(sansDistance), /reprise après 90 jours sans courir : ton volume d'avant l'arrêt n'est pas connu, aucun plafond de volume n'est posé ; une seule séance de qualité par semaine au plus/);
    // Pas encore repris, 40 jours sans courir, aucune distance avant : même aveu.
    const sansDistancePasRepris = await contexte({ seances: avantArret(41, 76, null) });
    assert.match(ditArret(sansDistancePasRepris), /aucune course enregistrée depuis 41 jours : on reprend par des footings, sans plafond de volume car ton volume d'avant l'arrêt n'est pas connu, sans séance dure pendant les deux premières semaines/, `le motif ne dit pas que le volume d'avant l'arrêt est inconnu (${ditArret(sansDistancePasRepris)})`);
    // Les cinq langues le disent.
    const INCONNU = { fr: /n'est pas connu/, en: /is not known/, de: /nicht bekannt/, es: /no conocemos/, pt: /não é conhecido/ } as const;
    for (const ctx of [sansDistance, sansDistancePasRepris]) {
      const motif = ctx.readiness.reasonsAll.find((m) => /sans courir|aucune course enregistrée/.test(m.fr));
      assert.ok(motif, "le motif de l'arrêt manque dans les cinq langues");
      for (const l of Object.keys(INCONNU) as (keyof typeof INCONNU)[]) assert.match(motif[l], INCONNU[l], `${l} : le motif ne dit pas que le volume d'avant l'arrêt est inconnu (« ${motif[l]} »)`);
    }
    // (b) aussi, depuis que la règle d'intensité dure 63 jours après un arrêt de plus de 56 jours : même aveu.
    assert.match(ditArret(moitie), /reprise après 150 jours sans courir : ton volume d'avant l'arrêt n'est pas connu, aucun plafond de volume n'est posé ; /, `(b) : le motif ne dit pas que le volume d'avant l'arrêt est inconnu (${ditArret(moitie)})`);
    // La règle d'intensité et sa marche de sortie finies (70ᵉ jour), sans plafond à annoncer : plus aucun motif d'arrêt.
    const sortiDeLaRegle = await contexte({ seances: [...avantArret(70 + 100 + 1, 19, null), ...depuisReprise(70)] });
    assert.deepEqual(repriseVolumeLongArret([...avantArret(70 + 100 + 1, 19, null), ...depuisReprise(70)].map((w) => w.date), AUJOURDHUI), { arretJours: 100, enCours: false, joursRepris: 70 }, "précondition : la reprise du long arrêt de 100 jours n'est pas en cours");
    assert.equal(ditArret(sortiDeLaRegle), "", "un motif d'arrêt est dit alors qu'aucune règle ne s'applique plus");
    // Contre-poids de (b) : le même coureur SANS vélo, dont les 60 dernières séances portent les semaines d'avant, est plafonné à 50 %.
    const visible = await contexte({ seances: longArret(150, 30) });
    assert.equal(visible.volume.targetKm, 30, "précondition : sans vélo, le coureur n'est pas plafonné à 50 % de 60 km");
  });

  await test("le coureur masqué par le vélo pendant un long arrêt reçoit le plafond de son jumeau", async () => {
    // 90 jours d'arrêt à une sortie à vélo par jour, 15 jours de reprise forte.
    const courses = longArret(90, 15);
    const masque = await contexte({ seances: [...courses, ...Array.from({ length: 90 }, (_, k) => velo(16 + k))] }), jumeau = await contexte({ seances: courses });
    assert.equal(jumeau.volume.targetKm, 20, "précondition : le jumeau n'est pas au plafond de 33 %");
    assert.equal(masque.volume.targetKm, jumeau.volume.targetKm, "le vélo change le plafond de volume d'un long arrêt");
    assert.equal(ditArret(masque), ditArret(jumeau), "le vélo change ce que dit le motif du long arrêt");
  });

  await test("une pause courte pendant la reprise d'un long arrêt ne rend pas son volume d'avant au coureur", async () => {
    // 90 jours d'arrêt, 30 jours de reprise forte, puis 8 jours sans courir : 38ᵉ jour de la reprise, plafond à 50 %.
    const ctx = await contexte({ seances: [...avantArret(38 + 90 + 1), ...depuisReprise(38, 10, 9)] });
    assert.ok(ctx.volume.targetKm > 0 && ctx.volume.targetKm <= 30, `${ctx.volume.targetKm} km visés pendant la pause, le plafond du long arrêt est de 30 km`);
    // Ici le plafond de la pause n'est pas plus haut que celui du long arrêt : c'est la pause que le bandeau annonce.
    assert.match(ditArret(ctx), /aucune course enregistrée depuis 9 jours : on repart à 50 % de ton volume habituel/, `le bandeau n'annonce plus la pause en cours (${ditArret(ctx)})`);
    // QUAND LE PLAFOND DU LONG ARRÊT EST LE PLUS BAS : 90 jours d'arrêt, huit jours de reprise forte, huit jours de
    // pause, puis quatre jours de reprise forte. La pause de 8 jours est dans sa seconde moitié (75 % du volume des
    // huit dernières semaines), le long arrêt dans son premier palier (20ᵉ jour) : 33 % de 60 km, soit 20 km.
    const serre = [...avantArret(20 + 90 + 1), ...depuisReprise(20, 10, 13), ...depuisReprise(4)];
    assert.deepEqual(repriseApresArret(serre.map((w) => w.date), AUJOURDHUI), { arretJours: 8, enCours: false, joursRepris: 4, part: 0.75 }, "précondition : la pause de 8 jours n'est pas dans sa seconde moitié");
    assert.deepEqual(repriseVolumeLongArret(serre.map((w) => w.date), AUJOURDHUI), { arretJours: 90, enCours: false, joursRepris: 20 });
    const ctxSerre = await contexte({ seances: serre });
    assert.equal(ctxSerre.volume.targetKm, 20, `${ctxSerre.volume.targetKm} km visés : la pause courte a effacé le plafond du long arrêt (33 % de 60 km)`);
    // Le bandeau annonce le plafond qui s'applique, pas celui, plus haut, de la pause courte.
    assert.match(ditArret(ctxSerre), /reprise après 90 jours sans courir : 33 % au plus de ton volume d'avant l'arrêt cette semaine/, `le motif ne dit pas le plafond du long arrêt (${ditArret(ctxSerre)})`);
    assert.doesNotMatch(ctxSerre.readiness.reasons.join(" | "), /75 % de ton volume habituel/, "le bandeau annonce 75 % au-dessus d'une semaine plafonnée à 33 %");
    // Ce motif ne dit pas la borne d'intensité « jusqu'à la quatrième semaine » du long arrêt, qui n'est pas celle de la
    // pause. Il dit ce que le plan fait : à 20 km, la sortie longue (6 km pour 10 km habituels) est retirée, la semaine
    // ne porte que des footings.
    assert.doesNotMatch(ditArret(ctxSerre), /quatrième semaine|séance de qualité/, `le motif du long arrêt dit une borne d'intensité qui n'est pas celle de la pause (${ditArret(ctxSerre)})`);
    assert.equal(ctxSerre.volume.longRunKm, 0, "précondition : la sortie longue de la semaine plafonnée à 20 km n'est pas retirée");
    assert.deepEqual(dures(ctxSerre), [], "une séance dure est posée dans une semaine plafonnée sans sortie longue");
    assert.match(ditArret(ctxSerre), /footings seulement cette semaine/, `le motif ne dit pas que la semaine ne porte que des footings (${ditArret(ctxSerre)})`);
    // PAUSE ENCORE EN COURS, plafond du long arrêt le plus bas : 42 km par semaine avant 56 jours d'arrêt, 28 jours de
    // reprise forte (60 km par semaine), puis 8 jours sans courir. Le long arrêt est à son deuxième tiers (36ᵉ jour,
    // 50 % de 42 km), la pause plafonne plus haut (50 % des 60 km repris). Le bandeau n'annonce que le plafond qui
    // s'applique, sans la borne d'intensité du long arrêt, qui n'est pas celle de la pause, et garde « ta montre ne
    // synchronise plus » : une panne de synchronisation est l'autre explication du silence.
    const enPause = await contexte({ seances: [...avantArret(36 + 56 + 1, 76, 7), ...depuisReprise(36, 10, 9)] });
    assert.equal(enPause.volume.targetKm, 21, `${enPause.volume.targetKm} km visés pendant la pause : le plafond du long arrêt (50 % de 42 km) ne s'applique pas`);
    assert.equal(ditArret(enPause), "aucune course enregistrée depuis 9 jours : 50 % au plus de ton volume d'avant l'arrêt cette semaine (règle de Daniels). Si tu as couru, ta montre ne synchronise plus : vérifie sa connexion", "le bandeau n'annonce pas le plafond du long arrêt puis l'hypothèse de la montre");
    assert.deepEqual(dures(enPause), [], "une séance dure est posée pendant une pause en cours");
    // QUAND C'EST LA PAUSE QUI PLAFONNE LE PLUS BAS : 90 jours d'arrêt, huit jours de reprise forte, neuf jours sans
    // courir, une sortie hier. Le bandeau garde le motif de la pause (50 % du volume habituel), et, la sortie longue
    // n'étant pas posée pendant la reprise du long arrêt, il finit par « footings seulement » au lieu d'annoncer une
    // séance de qualité que le plan ne pose pas.
    const pauseBasse = [...avantArret(1 + 10 + 8 + 90), ...depuisReprise(18, 10, 11), ...depuisReprise(1)];
    assert.deepEqual(repriseApresArret(pauseBasse.map((w) => w.date), AUJOURDHUI), { arretJours: 9, enCours: false, joursRepris: 1, part: 0.5 }, "précondition : la pause de 9 jours n'est pas reprise depuis hier");
    assert.deepEqual(repriseVolumeLongArret(pauseBasse.map((w) => w.date), AUJOURDHUI), { arretJours: 90, enCours: false, joursRepris: 18 });
    const ctxPauseBasse = await contexte({ seances: pauseBasse });
    assert.ok(ctxPauseBasse.volume.targetKm < 20, `précondition : ${ctxPauseBasse.volume.targetKm} km visés, la pause ne plafonne pas plus bas que le long arrêt (20 km)`);
    assert.equal(ctxPauseBasse.volume.longRunKm, 0, "précondition : la sortie longue est posée pendant la pause courte");
    assert.equal(ctxPauseBasse.weekPlan.repriseArret, "sans-qualite", "pause courte pendant la reprise d'un long arrêt, sans sortie longue : l'état n'est pas « sans-qualite »");
    assert.deepEqual(dures(ctxPauseBasse), [], "pause courte pendant la reprise d'un long arrêt, sans sortie longue : une séance dure est posée");
    assert.equal(ditArret(ctxPauseBasse), "reprise après 9 jours sans courir : 50 % de ton volume habituel cette semaine — la reprise dure autant que l'arrêt (règle de Daniels) ; footings seulement cette semaine : ta sortie longue serait plus courte que ta sortie habituelle, elle n'est pas posée, et la séance dure attend son retour");
    // UNE PAUSE APRÈS QUELQUES JOURS DE REPRISE SEULEMENT : 90 jours d'arrêt, trois ou quatre jours de reprise, puis une
    // pause de deux semaines. Les huit dernières semaines sont presque vides : la moyenne des quatre dernières (7 km)
    // n'est pas une habitude, et sa moitié plafonnait la semaine à 4 km, où le plan posait un seuil pour unique sortie
    // (version d'avant) puis, avec « footings seulement », plus rien. Pendant la reprise d'un long arrêt, le plafond
    // de la pause ne descend pas sous deux footings (12 km), et le motif n'annonce pas « 50 % » d'une telle habitude.
    const sortiesDe = (ctx: AthleteContext) => buildWeekPlan(ctx, new Date(`${AUJOURDHUI}T08:00:00Z`)).filter((d) => /Endurance|R[ée]cup|Sortie longue/i.test(d.type) || DUR.test(d.type)).length;
    for (const [nom, seances] of [
      ["pause encore en cours", [...avantArret(16 + 3 + 90 + 1), ...depuisReprise(19, 10, 17)]],
      ["pause reprise hier", [...avantArret(1 + 13 + 4 + 90 + 1), ...depuisReprise(18, 10, 15), ...depuisReprise(1)]],
    ] as const) {
      assert.ok(repriseApresArret(seances.map((w) => w.date), AUJOURDHUI) != null, `${nom} : précondition, aucune pause courte n'est vue`);
      const c = await contexte({ seances: [...seances] });
      assert.equal(c.volume.targetKm, 12, `${nom} : ${c.volume.targetKm} km visés, attendu le plancher de deux footings (12 km)`);
      assert.ok(sortiesDe(c) >= 2, `${nom} : ${sortiesDe(c)} sortie(s) dans la semaine`);
      assert.deepEqual(dures(c), [], `${nom} : une séance dure est posée`);
      assert.doesNotMatch(c.readiness.reasons.join(" | "), /% de ton volume habituel/, `${nom} : un pourcentage d'une habitude lue sur des semaines presque vides est annoncé`);
      assert.match(ditArret(c), /ton volume des dernières semaines (est|étant) trop faible pour servir de repère/, `${nom} : le motif ne dit pas que les dernières semaines ne sont pas un repère (${ditArret(c)})`);
    }
    // Volume d'avant le long arrêt INCONNU (sorties sans distance) : le plancher vaut encore deux footings.
    const avantInconnu = await contexte({ seances: [...avantArret(1 + 13 + 4 + 90 + 1, 76, null), ...depuisReprise(18, 10, 15), ...depuisReprise(1)] });
    assert.equal(avantInconnu.volume.targetKm, 12, `${avantInconnu.volume.targetKm} km visés pendant la pause quand le volume d'avant le long arrêt est inconnu, attendu le plancher de 12 km`);
    assert.ok(sortiesDe(avantInconnu) >= 2, `volume d'avant le long arrêt inconnu : ${sortiesDe(avantInconnu)} sortie(s) dans la semaine`);
    // Le plancher ne dépasse pas le volume d'avant l'arrêt quand il est connu : 9 km par semaine avant l'arrêt.
    const petitAvant = await contexte({ seances: [...avantArret(1 + 13 + 4 + 90 + 1, 76, 1.5), ...depuisReprise(18, 10, 15), ...depuisReprise(1)] });
    assert.ok(petitAvant.volume.targetKm <= 9, `${petitAvant.volume.targetKm} km visés pendant la pause, plus que les 9 km par semaine d'avant le long arrêt`);
    // Et hors de la reprise d'un long arrêt, la règle de 6 à 28 jours n'est pas touchée : même pause, sans long arrêt
    // avant (quatre jours de course, treize jours de pause, une sortie hier).
    const sansLongArret = await contexte({ seances: [...depuisReprise(18, 10, 15), ...depuisReprise(1)] });
    assert.ok(sansLongArret.volume.targetKm < 12, `${sansLongArret.volume.targetKm} km visés : le plancher s'applique hors de la reprise d'un long arrêt`);
    // Et à la reprise après la pause (une sortie hier) : toujours le plafond du long arrêt, 39ᵉ jour.
    const reparti = await contexte({ seances: [...avantArret(39 + 90 + 1), ...depuisReprise(39, 10, 10), sortie(1, 10)] });
    assert.ok(reparti.volume.targetKm > 0 && reparti.volume.targetKm <= 30, `${reparti.volume.targetKm} km visés après la pause, le plafond du long arrêt est de 30 km`);
  });

  console.log("\nLA RÈGLE D'INTENSITÉ DURE JUSQU'AU DERNIER PALIER, PUIS UNE MARCHE DE SORTIE (23/11/2026)");
  const dixKm16 = [objectif({ race: "10 km test", raceDate: ilYa(-112), distanceKm: 10, targetTime: "45'00", targetSeconds: 2700, targetPace: "4'30/km" })];
  const planDe = (ctx: AthleteContext) => buildWeekPlan(ctx, new Date(`${AUJOURDHUI}T08:00:00Z`));
  const jourPlus = (n: number) => ilYa(-n);

  await test("la fin de la règle d'intensité : 28 jours au moins, les deux tiers d'un arrêt de 29 à 56 jours, le 63ᵉ jour au-delà", () => {
    assert.deepEqual([29, 35, 42, 43, 45, 56, 57, 90, 200].map(finRegleIntensite), [28, 28, 28, 29, 30, 38, 63, 63, 63]);
    // Jamais décroissante quand l'arrêt s'allonge, jamais sous 28 jours, jamais après la fin de la reprise de volume.
    for (let a = 29; a <= 200; a++) {
      assert.ok(finRegleIntensite(a + 1) >= finRegleIntensite(a), `la règle d'intensité finit plus tôt après ${a + 1} jours d'arrêt qu'après ${a}`);
      assert.ok(finRegleIntensite(a) >= 28, `${a} jours d'arrêt : la règle finit avant le 28ᵉ jour`);
      assert.ok(finRegleIntensite(a) <= Math.max(28, dureeRepriseLongue(a)), `${a} jours d'arrêt : la règle d'intensité dure plus longtemps que la reprise de volume`);
    }
    // L'arrêt vu pour l'intensité, et la marche de sortie de sept jours qui le suit, sur de vraies dates.
    const dates = (arret: number, repris: number) => longArret(arret, repris).map((w) => w.date);
    for (const [arret, fin] of [[35, 28], [56, 38], [57, 63], [90, 63]] as const) {
      assert.deepEqual(arretHorsEchelle(dates(arret, fin - 1), AUJOURDHUI), { arretJours: arret, enCours: false, joursRepris: fin - 1 }, `${arret} jours d'arrêt : la règle ne tient plus la veille de sa fin (${fin - 1}ᵉ jour)`);
      assert.equal(arretHorsEchelle(dates(arret, fin), AUJOURDHUI), null, `${arret} jours d'arrêt : la règle court encore au ${fin}ᵉ jour`);
      assert.equal(sortieDeRegle(dates(arret, fin - 1), AUJOURDHUI), null, `${arret} jours d'arrêt : la marche de sortie commence avant la fin de la règle`);
      for (const j of [fin, fin + 3, fin + 6]) assert.deepEqual(sortieDeRegle(dates(arret, j), AUJOURDHUI), { arretJours: arret, joursRepris: j }, `${arret} jours d'arrêt, ${j}ᵉ jour : pas de marche de sortie`);
      assert.equal(sortieDeRegle(dates(arret, fin + 7), AUJOURDHUI), null, `${arret} jours d'arrêt : la marche de sortie dure plus de sept jours`);
    }
    // Pas de marche de sortie après un arrêt de 28 jours au plus, ni tant que le coureur n'a pas repris.
    assert.equal(sortieDeRegle(dates(20, 20), AUJOURDHUI), null);
    for (const [arret, j] of [[20, 28], [20, 30], [20, 34], [28, 28], [28, 31]] as const) {
      assert.equal(sortieDeRegle(dates(arret, j), AUJOURDHUI), null, `${arret} jours d'arrêt, ${j}ᵉ jour de reprise : une marche de sortie après un arrêt de 28 jours au plus`);
    }
    assert.deepEqual(sortieDeRegle(dates(29, 28), AUJOURDHUI), { arretJours: 29, joursRepris: 28 }, "29 jours d'arrêt, 28ᵉ jour de reprise : pas de marche de sortie");
    assert.equal(sortieDeRegle(dates(90, 0), AUJOURDHUI), null);
    // Le plan, la feuille de route et le motif lisent la MÊME fin.
    const ctxSrc = codeNu("src/lib/ai/coachContext.ts");
    assert.match(codeNu("src/lib/coach/repriseArret.ts"), /if \(!a\.enCours && a\.joursRepris >= finRegleIntensite\(a\.arretJours\)\) return null;/);
    assert.match(ctxSrc, /const finRegleArret = !arretRegle \? 0 : arretRegle\.arretJours > ARRET_MAX_JOURS \? finRegleIntensite\(arretRegle\.arretJours\) : arretRegle\.arretJours;/);
    assert.match(ctxSrc, /const fin = repriseIntensite && !repriseArret \? finRegleIntensite\(repriseIntensite\.arretJours\) : REPRISE_HORS_ECHELLE_JOURS;/);
  });

  await test("autour de chaque frontière : la règle, puis la marche de sortie, puis le plan normal — dans le plan et dans la feuille de route", async () => {
    let sousVu = 0, marcheVu = 0, apresVu = 0, vmaApres = 0, footingsVus = 0, seuilVu = 0, semainesJusteApres = 0, vmaJusteApres = 0;
    for (const arret of [35, 56, 57, 90]) for (const j of [13, 14, 15, 27, 28, 29, 36, 37, 38, 62, 63, 64, 69, 70, 71]) {
      const fin = finRegleIntensite(arret), sous = j < fin, marche = !sous && j < fin + 7, nom = `${arret} jours d'arrêt, ${j}ᵉ jour de reprise`;
      const ctx = await contexte({ seances: longArret(arret, j), notifications: dixKm16 });
      const plan = planDe(ctx), duresDuPlan = plan.filter((d) => DUR.test(d.type));
      assert.equal(ctx.weekPlan.repriseArret != null, sous, `${nom} : la règle d'intensité ${sous ? "ne s'applique plus" : "s'applique encore"} (fin au ${fin}ᵉ jour)`);
      assert.equal(ctx.weekPlan.sortieReprise === true, marche, `${nom} : la marche de sortie ${marche ? "manque" : "s'applique"} (du ${fin}ᵉ au ${fin + 6}ᵉ jour)`);
      assert.equal(testVmaAttendLaReprise(ctx.weekPlan), sous || marche, `${nom} : le test VMA ${sous || marche ? "n'attend pas la fin de la reprise" : "est encore retenu"}`);
      if (sous) {
        sousVu++;
        assert.ok(duresDuPlan.length <= 1, `${nom} : ${duresDuPlan.length} séances dures sous la règle`);
        assert.ok(duresDuPlan.every((d) => d.type === "Seuil"), `${nom} : une séance dure n'est pas un seuil (${duresDuPlan.map((d) => d.type).join(", ")})`);
        assert.ok(duresDuPlan.every((d) => d.date >= jourPlus(Math.max(0, 14 - j))), `${nom} : séance dure avant le 14ᵉ jour de reprise`);
        if (ctx.weekPlan.repriseArret === "sans-qualite") { footingsVus++; assert.deepEqual(duresDuPlan, [], `${nom} : état « sans-qualite » et une séance dure au plan`); }
        else seuilVu += duresDuPlan.length;
      } else if (marche) {
        marcheVu++;
        assert.ok(ctx.weekPlan.qBudget <= 2 && ctx.weekPlan.quality.length <= 2, `${nom} : ${ctx.weekPlan.quality.length} séances de qualité retenues pendant la marche de sortie`);
        assert.ok(ctx.weekPlan.quality.every((q) => q.type !== "VMA"), `${nom} : de la VMA ou des côtes pendant la marche de sortie (${ctx.weekPlan.quality.map((q) => q.type).join(", ")})`);
        assert.ok(duresDuPlan.length <= 2 && duresDuPlan.every((d) => d.type !== "VMA"), `${nom} : ${duresDuPlan.map((d) => d.type).join(", ")} au plan pendant la marche de sortie`);
        assert.match(ctx.readiness.reasons.join(" | "), new RegExp(`fin de la reprise après ${arret} jours sans courir : deux séances de qualité au plus cette semaine, sans VMA ni côtes`), `${nom} : le motif de la marche de sortie manque`);
        assert.doesNotMatch(ctx.text, /• Qualité \d+ : [^\n]*VMA/, `${nom} : l'invite de l'IA annonce de la VMA pendant la marche de sortie`);
      } else {
        apresVu++;
        assert.doesNotMatch(ctx.readiness.reasons.join(" | "), /fin de la reprise après/, `${nom} : le motif de la marche de sortie est encore dit`);
        if (ctx.weekPlan.quality.some((q) => q.type === "VMA") || ctx.macroPlan.some((w) => w.quality.includes("VMA"))) vmaApres++;
      }
      // LA FEUILLE DE ROUTE lit la même fin : un seuil au plus tant qu'une semaine COMMENCE sous la règle, ni VMA ni
      // côtes la semaine de la marche de sortie.
      ctx.macroPlan.forEach((w, k) => {
        const jr = j + 7 * k, ici = `${nom}, semaine ${k + 1} de la feuille de route (${w.quality.join(", ") || "aucune qualité"})`;
        if (jr < fin) assert.ok(w.quality.length <= 1 && w.quality.every((q) => q === "Seuil"), `${ici} : autre chose qu'un seuil sous la règle`);
        else if (jr < fin + 7) assert.ok(w.quality.length <= 2 && w.quality.every((q) => !/VMA|Côte/i.test(q)), `${ici} : VMA, côtes ou plus de deux séances pendant la marche de sortie`);
        // La semaine qui SUIT la marche de sortie est une semaine normale : la VMA y revient (compté plus bas).
        else if (jr < fin + 14) { semainesJusteApres++; if (w.quality.includes("VMA")) vmaJusteApres++; }
      });
      // Et sa semaine en cours dit ce que le plan fait, lu par type et par date, jamais par position.
      if (sous && ctx.macroPlan.length) {
        assert.equal(ctx.macroPlan[0].quality.length > 0, ctx.weekPlan.repriseArret === "une-qualite", `${nom} : la semaine en cours de la feuille de route (${ctx.macroPlan[0].quality.join(", ") || "aucune qualité"}) ne dit pas l'état du plan (${ctx.weekPlan.repriseArret})`);
        assert.equal(ctx.macroPlan[0].longRunKm > 0, plan.some((d) => /Sortie longue/i.test(d.type)), `${nom} : la feuille de route annonce ${ctx.macroPlan[0].longRunKm} km de sortie longue, le plan ${plan.some((d) => /Sortie longue/i.test(d.type)) ? "en pose une" : "n'en pose pas"}`);
        if (ctx.weekPlan.repriseArret === "sans-qualite") assert.match(ctx.macroPlan[0].focus, /^Reprise après un arrêt : footings seulement/, `${nom} : le texte de la semaine en cours (${ctx.macroPlan[0].focus})`);
      }
    }
    // Chaque branche a tourné, la séance au seuil est réellement posée quelque part, et la VMA revient ensuite.
    assert.ok(sousVu >= 20 && marcheVu >= 6 && apresVu >= 10, `précondition : ${sousVu} cas sous la règle, ${marcheVu} en marche de sortie, ${apresVu} après`);
    assert.ok(footingsVus >= 5 && seuilVu >= 3, `précondition : ${footingsVus} semaines de footings seulement, ${seuilVu} séances au seuil posées sous la règle`);
    assert.ok(vmaApres >= 5, `la VMA ne revient pas après la marche de sortie (${vmaApres} cas sur ${apresVu})`);
    assert.ok(semainesJusteApres >= 20 && vmaJusteApres >= 10, `feuille de route : la VMA ne revient pas dès la semaine qui suit la marche de sortie (${vmaJusteApres} semaines sur ${semainesJusteApres})`);
    // LE BUDGET LUI-MÊME EST BORNÉ À DEUX. À cinq semaines d'un 10 km, ce coureur a trois séances de qualité par semaine :
    // pendant la marche de sortie, le plan en retient deux et le bilan de sa dernière séance en annonce deux, pas trois.
    const dixKm5 = [objectif({ race: "10 km test", raceDate: ilYa(-35), distanceKm: 10, targetTime: "45'00", targetSeconds: 2700, targetPace: "4'30/km" })];
    // (« Après » se lit une fois la reprise de VOLUME finie aussi, au 85ᵉ jour d'un arrêt de 57 jours : tant qu'elle
    // dure, trois séances ne laisseraient pas de footing à côté, et le budget reste à deux.)
    for (const [arret, j, jApres] of [[35, 30, 36], [57, 65, 85]] as const) {
      const pendant = await contexte({ seances: longArret(arret, j), notifications: dixKm5 }), apres = await contexte({ seances: longArret(arret, jApres), notifications: dixKm5 });
      assert.equal(apres.weekPlan.sortieReprise, undefined, `précondition : ${arret} jours d'arrêt, ${jApres}ᵉ jour, la marche de sortie court encore`);
      assert.equal(apres.weekPlan.qBudget, 3, `précondition : après la marche de sortie, ce coureur n'a pas trois séances de qualité (${apres.weekPlan.qBudget}) : la borne à deux ne prouverait rien`);
      assert.equal(pendant.weekPlan.sortieReprise, true, `précondition : ${arret} jours d'arrêt, ${j}ᵉ jour, pas de marche de sortie`);
      assert.equal(pendant.weekPlan.qBudget, 2, `${arret} jours d'arrêt, ${j}ᵉ jour : ${pendant.weekPlan.qBudget} séances de qualité au budget pendant la marche de sortie`);
      assert.match(pendant.lastSession?.effect ?? "", /→ 2 séances de qualité cette semaine\.$/, `${arret} jours d'arrêt, ${j}ᵉ jour : le bilan de la dernière séance, lu par le coureur, n'annonce pas deux séances de qualité (${pendant.lastSession?.effect})`);
    }
  });

  await test("contre-poids : un coureur sans arrêt n'a ni règle, ni marche de sortie, ni motif, et garde sa VMA", async () => {
    const regulier = await contexte({ seances: reguliere(1, 100), notifications: dixKm16 });
    assert.equal(regulier.weekPlan.repriseArret, undefined);
    assert.equal(regulier.weekPlan.sortieReprise, undefined);
    assert.equal(testVmaAttendLaReprise(regulier.weekPlan), false);
    assert.doesNotMatch(regulier.readiness.reasons.join(" | "), /sans courir|fin de la reprise|footings seulement/);
    assert.ok(regulier.macroPlan.some((w) => w.quality.includes("VMA")), "précondition : la feuille de route d'un 10 km ne porte jamais de VMA, le contre-poids ne prouverait rien");
    assert.ok(regulier.macroPlan.every((w) => !/Reprise après un arrêt|Fin de reprise/.test(w.focus)), "la feuille de route d'un coureur sans arrêt parle d'une reprise");
  });

  await test("pas de test VMA pendant une reprise après un arrêt : ni prescrit par le coach, ni proposé par le bandeau", async () => {
    // Un coureur SANS VMA mesurée qui revient de 90 jours d'arrêt : son contexte se bâtit, son plan ne porte que des
    // footings, et le test « 6 minutes à fond » attend la fin de la reprise. Avant, le coach le prescrivait le jour même.
    const sansVma = await buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: [], workouts: longArret(90, 3), notifications: [] }), "u");
    assert.equal(sansVma.weekPlan.repriseArret, "sans-qualite", "précondition : sans VMA mesurée, la reprise n'est pas vue");
    assert.equal(testVmaAttendLaReprise(sansVma.weekPlan), true, "le test VMA n'attend pas la fin de la reprise");
    assert.deepEqual(planDe(sansVma).filter((d) => DUR.test(d.type) || /Test/i.test(d.type)), [], "sans VMA mesurée, le plan de reprise porte une séance dure ou un test");
    assert.ok(planDe(sansVma).some((d) => /Endurance|R[ée]cup/i.test(d.type)), "sans VMA mesurée, le plan de reprise ne porte aucun footing");
    // La règle partagée, sur ses trois états et hors reprise.
    assert.equal(testVmaAttendLaReprise({ repriseArret: "une-qualite" }), true);
    assert.equal(testVmaAttendLaReprise({ sortieReprise: true }), true);
    assert.equal(testVmaAttendLaReprise({}), false);
    assert.equal(testVmaAttendLaReprise(null), false);
    // Le bandeau du test relit l'état écrit par le coach.
    const ok = { data: [], error: null };
    const etat = (repriseArret: unknown) => ({ data: { data: { marcheCourse: null, repriseArret } }, error: null });
    assert.equal(testVmaAEviterDe(ok, etat(null)), false, "précondition : hors reprise, le test est écarté");
    for (const e of ["sans-qualite", "une-qualite", "sortie"]) assert.equal(testVmaAEviterDe(ok, etat(e)), true, `état « ${e} » : le bandeau propose le test pendant la reprise`);
    // Le coach ne prescrit le test qu'une fois le contexte bâti, et hors reprise ; il écrit l'état que le bandeau relit.
    const ac = codeNu("src/lib/ai/autoCoach.ts");
    assert.match(ac, /if \(!\(await marcheCourseDe\(admin, userId\)\)\) testVmaDu = true;/);
    assert.match(ac, /if \(testVmaDu && !testVmaAttendLaReprise\(ctx\.weekPlan\)\) \{\s*return prescrireTestVma\(/, "le test VMA est prescrit pendant une reprise après un arrêt");
    assert.ok(ac.indexOf("const ctx = await buildAthleteContext(") < ac.indexOf("if (testVmaDu && !testVmaAttendLaReprise("), "le test VMA est décidé avant que le contexte soit bâti");
    assert.equal(ac.match(/prescrireTestVma\(admin, \{/g)?.length, 1, "le test VMA est prescrit à un autre endroit, sans la garde de la reprise");
    assert.match(ac, /repriseArret: testVmaAttendLaReprise\(ctx\.weekPlan\) \? ctx\.weekPlan\.repriseArret \?\? "sortie" : null,/, "l'état du coach ne dit pas la reprise au bandeau du test");
  });

  await test("le plancher de deux footings vaut pour toute reprise, sauf consignes du kiné ou douleur qui empire", async () => {
    // Trois habitudes (six sorties par semaine) : 30, 14 et 8 km. Arrêt de 10 ou 20 jours, pas encore repris.
    const habitude = (km: number, arret: number) => avantArret(arret + 1, 56, km);
    const sorties = (ctx: AthleteContext) => planDe(ctx).filter((d) => /Endurance|R[ée]cup|Sortie longue/i.test(d.type) || DUR.test(d.type)).length;
    const dit = (ctx: AthleteContext) => ctx.readiness.reasons.filter((r) => /sans courir|aucune course enregistrée/.test(r)).join(" | ");
    for (const arret of [10, 20]) {
      // 30 km d'habitude : la moitié, 15 km, tient deux footings. Le plafond de Daniels s'applique, et il est dit.
      const trente = await contexte({ seances: habitude(5, arret) });
      assert.equal(trente.volume.targetKm, 15, `30 km d'habitude, ${arret} jours d'arrêt : ${trente.volume.targetKm} km visés`);
      assert.match(dit(trente), /on repart à 50 % de ton volume habituel cette semaine \(règle de Daniels\)/);
      // 14 km : la moitié, 7 km, ne tient qu'un footing. Le plafond est le plancher, 12 km, et le motif le dit.
      const quatorze = await contexte({ seances: habitude(14 / 6, arret) });
      assert.equal(quatorze.volume.targetKm, 12, `14 km d'habitude, ${arret} jours d'arrêt : ${quatorze.volume.targetKm} km visés, attendu le plancher de deux footings`);
      assert.ok(sorties(quatorze) >= 2, `14 km d'habitude, ${arret} jours d'arrêt : ${sorties(quatorze)} sortie(s) dans la semaine`);
      assert.match(dit(quatorze), /on reprend par deux footings courts, le minimum d'une semaine de reprise/, `14 km d'habitude : le motif ne dit pas le plancher (${dit(quatorze)})`);
      assert.doesNotMatch(dit(quatorze), /%|trop faible pour servir de repère/, "14 km d'habitude : un pourcentage, ou le texte du long arrêt, est dit au plancher");
      // 8 km : plus petit que deux footings. Le plafond vaut l'habitude, rien n'est réduit, et le motif le dit.
      const huit = await contexte({ seances: habitude(8 / 6, arret) });
      assert.equal(huit.volume.targetKm, 8, `8 km d'habitude, ${arret} jours d'arrêt : ${huit.volume.targetKm} km visés, attendu l'habitude`);
      assert.match(dit(huit), /on reprend par des footings, sans réduire un volume habituel déjà petit/, `8 km d'habitude : le motif (${dit(huit)})`);
      assert.doesNotMatch(dit(huit), /%|deux footings courts/, "8 km d'habitude : un pourcentage, ou « deux footings », est dit");
    }
    // DÉJÀ REPRIS (arrêt de 20 jours, 3ᵉ jour de reprise, première moitié) : même plancher, même texte.
    const repris = await contexte({ seances: [...avantArret(3 + 20 + 1, 56, 14 / 6), ...depuisReprise(3, 14 / 6)] });
    assert.equal(repris.volume.targetKm, 12, `14 km d'habitude, repris depuis 3 jours : ${repris.volume.targetKm} km visés`);
    assert.match(dit(repris), /reprise après 20 jours sans courir : deux footings courts cette semaine, le minimum d'une semaine de reprise — la reprise dure autant que l'arrêt/, `le motif d'une reprise au plancher (${dit(repris)})`);
    // LES CONSIGNES DU KINÉSITHÉRAPEUTE ET UNE DOULEUR QUI EMPIRE L'EMPORTENT : pas de plancher, la règle d'avant.
    const kine = [{ user_id: "u", type: "consignes_kine", created_at: `${ilYa(1)}T10:00:00Z`, data: { dureeMaxMin: null, sansIntensite: false, seancesMaxSemaine: 3, jusquAu: ilYa(-14), majA: ilYa(1) } }];
    const douleur = (etat: string) => [{ id: "d1", user_id: "u", type: "pain_report", created_at: `${ilYa(2)}T10:00:00Z`, data: { zone: "Mollet gauche", level: 5, date: ilYa(2), etat, majA: ilYa(1) } }];
    for (const [nom, notifications] of [["consignes du kiné", kine], ["douleur qui empire", douleur("pire")]] as const) {
      const ctx = await contexte({ seances: habitude(14 / 6, 10), notifications: [...notifications] });
      assert.ok(ctx.volume.targetKm <= 7, `${nom} : ${ctx.volume.targetKm} km visés, le plancher l'emporte sur ${nom === "consignes du kiné" ? "les consignes" : "la douleur"}`);
      assert.match(dit(ctx), /on repart à 50 % de ton volume habituel/, `${nom} : le motif ne dit plus la règle d'avant (${dit(ctx)})`);
    }
    // Contre-poids : une douleur « en amélioration » ne retire pas le plancher.
    const mieux = await contexte({ seances: habitude(14 / 6, 10), notifications: douleur("mieux") });
    assert.match(dit(mieux), /on reprend par deux footings courts/, `une douleur en amélioration retire le plancher (${dit(mieux)})`);
  });

  await test("le plafond d'un long arrêt ne disparaît pas faute de palier : il se replie sur 12 km, dit en kilomètres", async () => {
    // Avec le dernier palier à 80 %, un coureur à 14 km par semaine n'avait plus de plafond (80 % font 11 km) : 20 km
    // visés au 2ᵉ jour de reprise après 70 jours d'arrêt, là où la version en ligne (85 %) en visait 12.
    const scene = (v: number, arret: number, repris: number, kmReprise = v / 6) => [...avantArret(repris + arret + 1, 76, v / 6), ...depuisReprise(repris, kmReprise)];
    const motifDe = (ctx: AthleteContext) => ctx.readiness.reasonsAll.find((m) => /sans courir|aucune course enregistrée/.test(m.fr));
    const KM = { fr: /12 km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit/, en: /no more than 12 km this week, as your pre-break volume was already small/, de: /höchstens 12 km, weil dein Umfang vor der Pause schon klein war/, es: /como máximo 12 km, porque tu volumen de antes de la pausa ya era pequeño/, pt: /no máximo 12 km, porque o teu volume de antes da pausa já era pequeno/ } as const;
    const FIN = { fr: /; footings seulement cette semaine$/, en: /; easy runs only this week$/, de: /; diese Woche nur lockere Läufe$/, es: /; solo rodajes suaves esta semana$/, pt: /; só corridas fáceis esta semana$/ } as const;
    const LANGUES = ["fr", "en", "de", "es", "pt"] as const;
    // SOUS LA RÈGLE D'INTENSITÉ : 12 km au plus, footings seulement, sans sortie longue.
    for (const [nom, seances, footings] of [
      ["14 km, 70 jours d'arrêt, 2ᵉ jour", scene(14, 70, 2), false],
      ["14 km, 90 jours d'arrêt, 61ᵉ jour", scene(14, 90, 61), true],
      ["14 km, 90 jours d'arrêt, 61ᵉ jour, reprise forte", scene(14, 90, 61, 10), true],
      ["13 km, 40 jours d'arrêt, 5ᵉ jour", scene(13, 40, 5), false],
      ["15 km, 40 jours d'arrêt, 5ᵉ jour", scene(15, 40, 5), false],
      ["15 km, 40 jours d'arrêt, 20ᵉ jour", scene(15, 40, 20), true],
    ] as const) {
      for (const notifications of [[], dixKm16]) {
        const ctx = await contexte({ seances: [...seances], notifications }), plan = planDe(ctx), motif = motifDe(ctx);
        assert.ok(ctx.volume.targetKm <= 12, `${nom} : ${ctx.volume.targetKm} km visés, le plafond a disparu`);
        assert.ok(ctx.volume.targetKm >= 10, `${nom} : ${ctx.volume.targetKm} km visés, sous deux footings`);
        assert.ok(motif, `${nom} : pas de motif de reprise`);
        for (const l of LANGUES) {
          assert.match(motif![l], KM[l], `${nom}, ${l} : le motif ne dit pas le plafond en kilomètres (${motif![l]})`);
          assert.doesNotMatch(motif![l], /%|Daniels/, `${nom}, ${l} : un pourcentage ou Daniels est cité pour un plafond en kilomètres (${motif![l]})`);
          if (footings) assert.match(motif![l], FIN[l], `${nom}, ${l} : la fin du motif (${motif![l]})`);
        }
        // La semaine est « au plancher » tant que la règle d'intensité dure : ni séance dure ni sortie longue.
        assert.equal(ctx.weekPlan.repriseArret, "sans-qualite", `${nom} : l'état de la reprise`);
        assert.deepEqual(plan.filter((d) => DUR.test(d.type) || /longue/i.test(d.type)).map((d) => d.type), [], `${nom} : une séance dure ou une sortie longue dans une semaine plafonnée à deux footings`);
        assert.ok(plan.filter((d) => /^(Endurance|R[ée]cup)$/i.test(d.type)).length >= 2, `${nom} : moins de deux footings (${plan.map((d) => d.type).join(", ")})`);
        assert.doesNotMatch(ctx.text, /• Qualité \d|• 1 sortie longue|• 1 SORTIE LONGUE/, `${nom} : l'invite de l'IA annonce une séance de qualité ou une sortie longue`);
        assert.ok(ctx.text.includes(motif!.fr), `${nom} : l'invite de l'IA ne porte pas le motif du plan`);
        if (notifications.length) {
          assert.ok(ctx.macroPlan.length > 0 && ctx.macroPlan[0].volumeKm <= 12, `${nom} : la semaine en cours de la feuille de route vise ${ctx.macroPlan[0]?.volumeKm} km`);
          assert.deepEqual([ctx.macroPlan[0].quality, ctx.macroPlan[0].longRunKm], [[], 0], `${nom} : la semaine en cours de la feuille de route annonce ${ctx.macroPlan[0].quality.join(", ") || "aucune qualité"} et ${ctx.macroPlan[0].longRunKm} km de sortie longue`);
        }
      }
    }
    // LA PHRASE EN KILOMÈTRES, dans ses quatre formes et les cinq langues : pas encore repris (plafond seul, puis avec la
    // règle d'intensité), repris (plafond seul, puis avec chacun des trois états). Jamais de pourcentage ni de Daniels.
    for (const l of LANGUES) {
      const formes = [
        MOTIF_T[l].repriseLongArret("90", true, null, "86", false, true, null, "12"), MOTIF_T[l].repriseLongArret("90", true, 0, "86", false, true, "63", "12"),
        MOTIF_T[l].repriseLongArret("90", false, null, "86", false, true, null, "12"), MOTIF_T[l].repriseLongArret("90", false, 0, "86", false, true, "63", "12"),
        MOTIF_T[l].repriseLongArret("90", false, 1, "86", false, true, "63", "12"), MOTIF_T[l].repriseLongArret("90", false, "footings", "86", false, true, null, "12"),
      ];
      formes.forEach((t, k) => {
        assert.match(t, KM[l], `${l}, forme ${k + 1} : la phrase en kilomètres manque (« ${t} »)`);
        assert.doesNotMatch(t, /%|86|Daniels|null|undefined/, `${l}, forme ${k + 1} : un pourcentage, Daniels ou une valeur vide (« ${t} »)`);
      });
      assert.match(formes[5], FIN[l], `${l} : la fin « footings seulement » au plafond replié (« ${formes[5]} »)`);
      // Sans plancher, le pourcentage et la raison de la sortie longue restent.
      assert.match(MOTIF_T[l].repriseLongArret("90", false, "footings", "50", false, false, null, null), /50\s?%/, `${l} : sans plancher, le pourcentage n'est plus dit`);
      assert.doesNotMatch(MOTIF_T[l].repriseLongArret("90", false, "footings", "50", false, false, null, null), FIN[l], `${l} : sans plancher, la raison de la sortie longue n'est plus dite`);
    }
    // PAS ENCORE REPRIS : la même phrase, dans la forme « aucune course enregistrée ».
    const pasRepris = await contexte({ seances: avantArret(71, 76, 14 / 6) });
    assert.equal(pasRepris.volume.targetKm, 12);
    assert.match(motifDe(pasRepris)?.fr ?? "", /^aucune course enregistrée depuis 71 jours : on reprend par des footings, à 12 km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit, sans séance dure pendant les deux premières semaines de reprise\./);
    // UNE PAUSE EN COURS pendant cette reprise (reprise forte depuis 30 jours, rien depuis 9 jours) : le plafond du long
    // arrêt, 12 km, est plus bas que celui de la pause ; c'est lui que le bandeau annonce, en kilomètres aussi.
    const pause = await contexte({ seances: [...avantArret(30 + 90 + 1, 76, 14 / 6), ...depuisReprise(30, 10, 9)] });
    assert.equal(pause.volume.targetKm, 12, `pause en cours pendant la reprise d'un long arrêt : ${pause.volume.targetKm} km visés`);
    assert.match(motifDe(pause)?.fr ?? "", /^aucune course enregistrée depuis 9 jours : 12 km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit\. Si tu as couru, ta montre ne synchronise plus/, `pause en cours : le motif (${motifDe(pause)?.fr})`);
    for (const l of LANGUES) assert.doesNotMatch(motifDe(pause)?.[l] ?? "%", /%|Daniels/, `pause en cours, ${l} : un pourcentage ou Daniels est cité (${motifDe(pause)?.[l]})`);
    // LA RÈGLE D'INTENSITÉ FINIE (70ᵉ jour après 90 jours d'arrêt) : le volume reste plafonné, et il est dit. Une
    // semaine de 12 km est trop petite pour porter un seuil et un footing : elle ne porte que des footings, et le
    // motif le dit (avant le 23/11/2026 : un seuil, un renforcement et une « sortie longue » de 4 km).
    const apres = await contexte({ seances: scene(14, 90, 70) });
    assert.equal(arretHorsEchelle(scene(14, 90, 70).map((w) => w.date), AUJOURDHUI), null, "précondition : au 70ᵉ jour, la règle d'intensité court encore");
    assert.ok(apres.volume.targetKm <= 12, `14 km, 90 jours d'arrêt, 70ᵉ jour : ${apres.volume.targetKm} km visés`);
    assert.equal(motifDe(apres)?.fr, "reprise après 90 jours sans courir : 12 km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit ; footings seulement cette semaine : elle est trop petite pour porter une séance dure et un footing");
    assert.equal(apres.weekPlan.repriseArret, "sans-qualite", "14 km, 90 jours d'arrêt, 70ᵉ jour : l'état d'une semaine de footings seulement");
    assert.deepEqual(planDe(apres).filter((d) => DUR.test(d.type)).map((d) => d.type), [], "14 km, 90 jours d'arrêt, 70ᵉ jour : une séance dure dans une semaine de 12 km");
    // Ni « sortie longue » de 4 km, qui restait parfois seule dans la semaine : les 12 km sont des footings.
    assert.deepEqual(planDe(apres).filter((d) => /longue/i.test(d.type)).map((d) => d.type), [], "14 km, 90 jours d'arrêt, 70ᵉ jour : une « sortie longue » dans une semaine plafonnée à 12 km");
    assert.equal(apres.volume.longRunKm, 0);
    assert.ok(planDe(apres).filter((d) => /^(Endurance|R[ée]cup)$/i.test(d.type)).length >= 2, `14 km, 90 jours d'arrêt, 70ᵉ jour : moins de deux footings (${planDe(apres).map((d) => d.type).join(", ")})`);
    assert.doesNotMatch(apres.text, /• 1 sortie longue|• 1 SORTIE LONGUE/, "14 km, 70ᵉ jour : l'invite de l'IA annonce une sortie longue que le plan ne pose pas");
    // CONTRE-POIDS, un coureur LENT (11 km/h de VMA) au même plafond : sa séance au seuil pèse moins de kilomètres, la
    // semaine de 12 km la tient avec un footing. Hors de la règle d'intensité, c'est le critère qui décide, pas le plafond.
    const lent = await buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: [{ ...BASE[0], vma_kmh: 11 }],
      workouts: [...avantArret(70 + 90 + 1, 76, 14 / 6).map((w) => ({ ...w, duration_seconds: Math.round((14 / 6) * 480) })), ...depuisReprise(70, 14 / 6).map((w) => ({ ...w, duration_seconds: Math.round((14 / 6) * 480) }))], notifications: [] }), "u");
    assert.ok(lent.volume.targetKm <= 12, `coureur lent : ${lent.volume.targetKm} km visés`);
    assert.equal(lent.weekPlan.repriseArret, undefined, `coureur lent, 12 km plafonnés, hors règle d'intensité : sa semaine tient une séance et un footing (allure ${lent.easyPace}), elle est dite « footings seulement »`);
    assert.equal(planDe(lent).filter((d) => DUR.test(d.type)).length, 1, `coureur lent : ${planDe(lent).map((d) => d.type).join(", ")}`);
    assert.ok(planDe(lent).some((d) => /^(Endurance|R[ée]cup)$/i.test(d.type)), "coureur lent : aucun footing à côté de la séance");
    assert.equal(lent.readiness.reasons.find((r) => /^reprise après/.test(r)), "reprise après 90 jours sans courir : 12 km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit", "coureur lent, la règle d'intensité finie : le motif ne dit pas son plafond en kilomètres");
    // Et la reprise de volume finie (84ᵉ jour), plus de plafond ni de motif.
    const fini = await contexte({ seances: scene(14, 90, 84) });
    assert.equal(motifDe(fini), undefined, `14 km, 90 jours d'arrêt, 84ᵉ jour : un motif de reprise est encore dit (${motifDe(fini)?.fr})`);
    // 12 ET 10 KM D'AVANT : plafonnés à EUX-MÊMES (23/11/2026). Sans plafond, ils recevaient la cible ordinaire du plan,
    // 17 à 20 km au 5ᵉ jour de reprise après 40 jours d'arrêt. Ce n'est pas un plafond « replié » : c'est leur volume.
    for (const v of [12, 10]) {
      const ctx = await contexte({ seances: scene(v, 40, 5) }), motif = motifDe(ctx);
      assert.ok(ctx.volume.targetKm <= v, `${v} km d'avant : ${ctx.volume.targetKm} km visés, plus que son volume d'avant l'arrêt`);
      assert.match(motif?.fr ?? "", new RegExp(`^reprise après 40 jours sans courir : ${v} km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit ; `), `${v} km d'avant : le motif (${motif?.fr})`);
      for (const l of LANGUES) assert.doesNotMatch(motif?.[l] ?? "%", /%|Daniels/, `${v} km d'avant, ${l} : un pourcentage ou Daniels (${motif?.[l]})`);
      assert.deepEqual(planDe(ctx).filter((d) => DUR.test(d.type) || /longue/i.test(d.type)).map((d) => d.type), [], `${v} km d'avant : une séance dure ou une sortie longue dans une semaine plafonnée à ${v} km`);
      assert.ok(planDe(ctx).some((d) => /^(Endurance|R[ée]cup)$/i.test(d.type)), `${v} km d'avant : la semaine plafonnée est vide`);
      assert.equal(plafondReplieSurPlancher(repriseVolumeLongArret(scene(v, 40, 5).map((w) => w.date), AUJOURDHUI), v), false, `${v} km d'avant : le plafond est dit replié sur le plancher`);
    }
    // 30 km : le palier de 50 %.
    const trente = await contexte({ seances: scene(30, 40, 5, 10) });
    assert.equal(trente.volume.targetKm, 15);
    assert.match(motifDe(trente)?.fr ?? "", /^reprise après 40 jours sans courir : 50 % au plus de ton volume d'avant l'arrêt cette semaine ; /);
    assert.doesNotMatch(motifDe(trente)?.fr ?? "", /km au plus/);
  });

  await test("au plancher, la semaine ne porte que des footings : ni séance au seuil ni « sortie longue », et tout le dit", async () => {
    // SECONDE MOITIÉ d'une reprise de 20 jours (12ᵉ jour) : la règle d'intensité permet une séance au seuil par semaine.
    // Le plan la posait dans une semaine au plancher, sous un motif qui promet « deux footings courts » : une coureuse
    // à 20 km par semaine recevait UN seuil et un renforcement pour toute semaine ; à 11 km par semaine, un seuil et une
    // « sortie longue ». Six sorties par semaine de `km`, puis une reprise prudente.
    // Une coureuse à 14 km/h de VMA (footings vers 6'30 au km) : celle qui court 11 à 20 km par semaine, pas l'athlète à 19 km/h
    // des autres scènes, dont le plus petit footing (25 minutes) dépasse déjà 5 km.
    const contexte = (t: { seances: Ligne[]; notifications?: Ligne[] }) => buildAthleteContext(fauxClient({
      profiles: [PROFIL], performance_baselines: [{ ...BASE[0], vma_kmh: 14 }], workouts: t.seances, notifications: t.notifications ?? [] }), "u");
    const scene = (km: number) => [...avantArret(12 + 20 + 1, 56, km), ...depuisReprise(12, Math.max(1.5, km * 0.6))];
    const motifDe = (ctx: AthleteContext) => ctx.readiness.reasonsAll.find((m) => /sans courir/.test(m.fr));
    const footings = (ctx: AthleteContext) => planDe(ctx).filter((d) => /^(Endurance|R[ée]cup)$/i.test(d.type));
    const FIN = { fr: /; footings seulement cette semaine$/, en: /; easy runs only this week$/, de: /; diese Woche nur lockere Läufe$/, es: /; solo rodajes suaves esta semana$/, pt: /; só corridas fáceis esta semana$/ } as const;
    for (const [nom, km, cible, texte] of [
      ["20 km par semaine", 20 / 6, [12, 12], /^reprise après 20 jours sans courir : deux footings courts cette semaine, le minimum d'une semaine de reprise — /],
      ["11 km par semaine", 11 / 6, [9, 11], /^reprise après 20 jours sans courir : ton volume habituel est déjà petit, il n'est pas réduit cette semaine — /],
    ] as const) {
      const seances = scene(km);
      // Précondition : sans le plancher, la règle d'intensité permettrait bien UNE séance cette semaine.
      assert.equal(qualitePendantReprise(repriseApresArret(seances.map((w) => w.date), AUJOURDHUI))?.max, 1, `précondition, ${nom} : la scène n'est pas dans la seconde moitié de la reprise`);
      for (const notifications of [[], dixKm16]) {
        const ctx = await contexte({ seances, notifications }), plan = planDe(ctx), ici = `${nom}${notifications.length ? ", 10 km dans seize semaines" : ""}`;
        assert.ok(ctx.volume.targetKm >= cible[0] && ctx.volume.targetKm <= cible[1], `${ici} : ${ctx.volume.targetKm} km visés, la scène n'est pas au plancher (attendu de ${cible[0]} à ${cible[1]} km)`);
        // LE PLAN, lu par type : aucune séance dure, aucune sortie longue, au moins deux footings.
        assert.deepEqual(plan.filter((d) => DUR.test(d.type)).map((d) => `${d.date} ${d.type}`), [], `${ici} : une séance dure dans une semaine au plancher`);
        assert.deepEqual(plan.filter((d) => /longue/i.test(d.type)).map((d) => `${d.date} ${d.type}`), [], `${ici} : une « sortie longue » dans une semaine au plancher`);
        assert.ok(footings(ctx).length >= 2, `${ici} : ${footings(ctx).length} footing(s) dans la semaine (${plan.map((d) => d.type).join(", ")})`);
        assert.equal(ctx.volume.longRunKm, 0, `${ici} : ${ctx.volume.longRunKm} km de sortie longue annoncés`);
        // L'ÉTAT, le budget et le bilan de la dernière séance disent la même chose.
        assert.equal(ctx.weekPlan.repriseArret, "sans-qualite", `${ici} : l'état de la reprise`);
        assert.equal(ctx.weekPlan.qBudget, 0); assert.deepEqual(ctx.weekPlan.quality, []);
        assert.match(ctx.lastSession?.effect ?? "", /→ aucune séance de qualité cette semaine\.$/, `${ici} : le bilan de la dernière séance (${ctx.lastSession?.effect})`);
        // LE MOTIF garde sa forme de plancher ; seule sa fin change, dans les cinq langues, sans parler de sortie longue.
        const motif = motifDe(ctx);
        assert.ok(motif, `${ici} : pas de motif de reprise`);
        assert.match(motif!.fr, texte, `${ici} : le début du motif (${motif!.fr})`);
        for (const l of ["fr", "en", "de", "es", "pt"] as const) assert.match(motif![l], FIN[l], `${ici}, ${l} : la fin du motif (${motif![l]})`);
        assert.doesNotMatch(Object.values(motif!).join(" "), /sortie longue|long run|langer Lauf|tirada larga|treino longo|séance de qualité|quality session/i, `${ici} : le motif parle encore d'une sortie longue ou d'une séance de qualité`);
        assert.ok(ctx.readiness.reasons.includes(motif!.fr), `${ici} : le bandeau ne porte pas le motif du plan`);
        // L'INVITE de l'IA : ni qualité ni sortie longue annoncées, et le motif du plan.
        assert.doesNotMatch(ctx.text, /• Qualité \d|• 1 sortie longue|• 1 SORTIE LONGUE/, `${ici} : l'invite de l'IA annonce une séance de qualité ou une sortie longue`);
        assert.ok(ctx.text.includes(motif!.fr), `${ici} : l'invite de l'IA ne porte pas le motif du plan`);
        // LA FEUILLE DE ROUTE (quand il y a un objectif) : sa semaine en cours dit ce que le plan fait.
        if (notifications.length) {
          assert.ok(ctx.macroPlan.length > 0, `précondition, ${ici} : pas de feuille de route`);
          assert.deepEqual([ctx.macroPlan[0].quality, ctx.macroPlan[0].longRunKm], [[], 0], `${ici} : la semaine en cours de la feuille de route annonce ${ctx.macroPlan[0].quality.join(", ") || "aucune qualité"} et ${ctx.macroPlan[0].longRunKm} km de sortie longue`);
          assert.match(ctx.macroPlan[0].focus, /^Reprise après un arrêt : footings seulement/, `${ici} : le texte de la semaine en cours (${ctx.macroPlan[0].focus})`);
        }
        // LA MONTRE lit ces footings : chaque séance posée produit des étapes bien formées.
        for (const d of plan.filter((x) => x.type !== "Repos" && x.type !== "Renfo")) {
          const b = buildWorkoutDescription(d.title, d.detail, `${d.type} ${d.tags.join(" ")}`, null, 14, 15, 10);
          assert.ok(b, `${ici}, ${d.date} ${d.type} : aucune séance montre`);
          const etapes = b!.description.split("\n").filter((x) => x.startsWith("- "));
          assert.ok(etapes.length >= 1 && etapes.every((x) => /^- \d+[ms] /.test(x)), `${ici}, ${d.date} ${d.type} : étapes montre mal formées (${etapes.join(" | ")})`);
        }
      }
    }
    // PAS ENCORE REPRIS, au plancher : pas de « sortie longue » non plus, deux footings.
    const pasRepris = await contexte({ seances: avantArret(10 + 1, 56, 14 / 6) });
    assert.equal(pasRepris.volume.targetKm, 12, "précondition : la scène « pas encore repris » n'est pas au plancher");
    assert.deepEqual(planDe(pasRepris).filter((d) => /longue/i.test(d.type) || DUR.test(d.type)).map((d) => d.type), [], "pas encore repris, au plancher : une sortie longue ou une séance dure");
    assert.ok(footings(pasRepris).length >= 2, `pas encore repris, au plancher : ${footings(pasRepris).length} footing(s)`);
    // CONTRE-POIDS : au-dessus du plancher, la séance au seuil de la seconde moitié reste (30 et 40 km par semaine).
    for (const total of [30, 40]) {
      const ctx = await contexte({ seances: scene(total / 6) }), dursPoses = planDe(ctx).filter((d) => DUR.test(d.type));
      assert.ok(ctx.volume.targetKm > 12, `précondition, ${total} km par semaine : ${ctx.volume.targetKm} km visés, la scène est au plancher`);
      assert.equal(ctx.weekPlan.repriseArret, "une-qualite", `${total} km par semaine : la séance permise est retirée hors plancher`);
      assert.deepEqual(dursPoses.map((d) => d.type), ["Seuil"], `${total} km par semaine : le plan ne porte plus sa séance au seuil (${planDe(ctx).map((d) => d.type).join(", ")})`);
      assert.match(motifDe(ctx)?.fr ?? "", /; une seule séance de qualité par semaine au plus, courte, jusqu'à la fin de la reprise$/, `${total} km par semaine : la fin du motif`);
    }
  });

  console.log("\nUNE SEMAINE DE REPRISE TROP PETITE NE PORTE QUE DES FOOTINGS, ET UN TRÈS PETIT VOLUME EST PLAFONNÉ À LUI-MÊME (23/11/2026)");
  // ⚠️ Des coureurs aux ALLURES RÉALISTES : six sorties par semaine dont la durée suit la distance (4'50 au km).
  // `avantArret(…, km)` garde la durée d'une sortie de 10 km : un coureur à 4 km par sortie y court à 12 minutes au km,
  // et le coût d'une séance de qualité, calculé sur l'allure, tombe à 5 km.
  const avantReel = (dernier: number, km: number) => Array.from({ length: 76 }, (_, k) => dernier + k).filter((n) => (n - dernier) % 7 !== 3).map((n) => sortie(n, km));
  /** `v` km par semaine avant, `arret` jours sans courir, reprise au même rythme depuis `repris` jours. */
  const coureur = (v: number, arret: number, repris: number) => [...avantReel(repris + arret + 1, v / 6), ...depuisReprise(repris, v / 6)];
  const tropPetiteDe = (ctx: AthleteContext) => semaineTropPetitePourQualite({ targetKm: ctx.volume.targetKm, longRunKm: ctx.volume.longRunKm,
    reserveKm: ctx.volume.longRunReserveKm, easyPace: ctx.easyPace, warmMin: ctx.warmCool.warm, coolMin: ctx.warmCool.cool });
  const footingsDe = (ctx: AthleteContext) => planDe(ctx).filter((d) => /^(Endurance|R[ée]cup)$/i.test(d.type));
  const sansArretFlag = (ctx: AthleteContext) => ctx.weekPlan.footingExige;
  const duresDe = (ctx: AthleteContext) => planDe(ctx).filter((d) => DUR.test(d.type));
  const motifArret = (ctx: AthleteContext) => ctx.readiness.reasonsAll.find((m) => /sans courir|aucune course enregistrée/.test(m.fr));
  const CINQ = ["fr", "en", "de", "es", "pt"] as const;
  const PETITE = { fr: /; footings seulement cette semaine : elle est trop petite pour porter une séance dure et un footing$/, en: /; easy runs only this week: it is too small to hold a hard session and an easy run$/,
    de: /; diese Woche nur lockere Läufe: Sie ist zu klein für eine harte Einheit und einen lockeren Lauf$/, es: /; solo rodajes suaves esta semana: es demasiado corta para una sesión dura y un rodaje$/,
    pt: /; só corridas fáceis esta semana: é demasiado pequena para uma sessão dura e uma corrida fácil$/ } as const;

  await test("le coût d'une séance et le plus petit footing : une seule source, lue par le plan et par le contexte", () => {
    // 20 minutes d'échauffement, 10 de retour au calme, 25 de corps : 55 minutes à l'allure facile.
    assert.equal(coutQualiteKm("5'00", 20, 10), 11);
    assert.equal(coutQualiteKm("8'00", 15, 10), 6.3);
    assert.equal(coutQualiteKm("15'00", 15, 10), 5, "le coût d'une séance descend sous 5 km");
    assert.equal(coutQualiteKm(null, 15, 10), 11, "allure inconnue : le coût n'est pas le repli de 11 km");
    assert.equal(coutQualiteKm("facile", 15, 10), 11);
    // Le plus petit footing : 25 minutes à l'allure facile, 4 km au moins.
    assert.deepEqual(["4'10", "5'00", "6'30", "8'00", null].map(footingMinKm), [6, 5, 4, 4, 4]);
    // Le critère : ce qui reste hors sortie longue (et hors réserve) tient-il la séance PLUS le plus petit footing ?
    const o = { easyPace: "5'00", warmMin: 20, coolMin: 10 };
    assert.equal(semaineTropPetitePourQualite({ ...o, targetKm: 16, longRunKm: 0 }), false, "16 km à 5'00 au km : une séance de 11 km et un footing de 5 km tiennent");
    assert.equal(semaineTropPetitePourQualite({ ...o, targetKm: 15, longRunKm: 0 }), true);
    assert.equal(semaineTropPetitePourQualite({ ...o, targetKm: 20, longRunKm: 5 }), true, "la sortie longue compte comme un footing");
    assert.equal(semaineTropPetitePourQualite({ ...o, targetKm: 21, longRunKm: 5 }), false);
    assert.equal(semaineTropPetitePourQualite({ ...o, targetKm: 21, longRunKm: 5, reserveKm: 1 }), true, "la réserve du long arrêt fait de la place à la séance dure");
    // COMBIEN de séances la semaine tient en gardant un footing à côté (coût 11 km, footing 5 km à 5'00 au km).
    assert.deepEqual([15, 16, 26, 27, 37, 38].map((targetKm) => qualitesTenablesAvecFooting({ ...o, targetKm, longRunKm: 0 })), [0, 1, 1, 2, 2, 3]);
    assert.equal(qualitesTenablesAvecFooting({ ...o, targetKm: 30, longRunKm: 9 }), 1, "30 km dont 9 de sortie longue : deux séances de 11 km ne laissent pas de footing");
    assert.equal(qualitesTenablesAvecFooting({ ...o, targetKm: 36, longRunKm: 9 }), 2);
    assert.equal(qualitesTenablesAvecFooting({ ...o, targetKm: 36, longRunKm: 9, reserveKm: 1 }), 1);
    assert.equal(qualitesTenablesAvecFooting({ ...o, targetKm: 3, longRunKm: 4 }), 0, "un nombre de séances négatif");
    // « Trop petite » : aucune séance ne tient avec un footing. Les deux fonctions disent la même chose.
    for (let targetKm = 0; targetKm <= 40; targetKm++) assert.equal(semaineTropPetitePourQualite({ ...o, targetKm, longRunKm: 4 }), qualitesTenablesAvecFooting({ ...o, targetKm, longRunKm: 4 }) === 0);
    // Le plan et le contexte lisent CES fonctions, avec la même allure et les mêmes minutes.
    const plan = codeNu("src/lib/ai/autoPlan.ts"), ctxSrc = codeNu("src/lib/ai/coachContext.ts");
    assert.match(plan, /const QUALITY_KM = coutQualiteKm\(ctx\.easyPace, warm, cool\);/);
    assert.match(plan, /const kmMinFooting = footingMinKm\(ctx\.easyPace\);/);
    assert.doesNotMatch(plan, /warm \+ cool \+ 25|\(25 \* 60\)/, "le plan recalcule le coût d'une séance ou le plus petit footing de son côté");
    assert.match(ctxSrc, /qualitesTenablesAvecFooting\(\{\s*targetKm, longRunKm, reserveKm: longRunReserveKm, easyPace: easyPaceCorrige, warmMin: warmCool\.warm, coolMin: warmCool\.cool \}\)/);
    assert.match(ctxSrc, /\n    easyPace: easyPaceCorrige,/, "l'allure que le plan lit n'est plus celle du critère");
    assert.match(ctxSrc, /\n    warmCool,\n/, "les minutes d'échauffement que le plan lit ne sont plus celles du critère");
  });

  await test("une semaine de reprise trop petite pour un seuil et un footing ne porte que des footings", async () => {
    // (a) REPRISE DE 6 À 28 JOURS, seconde moitié, HORS plancher : 20 et 24 km par semaine, 14 jours d'arrêt, 8ᵉ jour. La
    // règle d'intensité permet une séance ; la semaine (15 à 18 km, dont 4 à 5 de sortie longue) ne tient pas un seuil
    // de 10 à 11 km ET un footing de 6 km. Avant : un seuil, un renforcement et la sortie longue, sans footing.
    for (const v of [20, 24]) for (const notifications of [[], dixKm16]) {
      const seances = coureur(v, 14, 8), ctx = await contexte({ seances, notifications }), motif = motifArret(ctx), ici = `${v} km par semaine${notifications.length ? ", 10 km dans seize semaines" : ""}`;
      assert.equal(qualitePendantReprise(repriseApresArret(seances.map((w) => w.date), AUJOURDHUI))?.max, 1, `précondition, ${ici} : la règle d'intensité ne permet aucune séance, le test ne prouverait rien`);
      assert.match(motif?.fr ?? "", /% de ton volume habituel cette semaine/, `précondition, ${ici} : la semaine est au plancher (${motif?.fr})`);
      assert.equal(tropPetiteDe(ctx), true, `précondition, ${ici} : la semaine de ${ctx.volume.targetKm} km (sortie longue ${ctx.volume.longRunKm} km) n'est pas trop petite`);
      assert.equal(ctx.weekPlan.repriseArret, "sans-qualite", `${ici} : l'état de la reprise`);
      assert.equal(ctx.weekPlan.qBudget, 0); assert.deepEqual(ctx.weekPlan.quality, []);
      assert.deepEqual(duresDe(ctx).map((d) => d.type), [], `${ici} : une séance dure dans une semaine trop petite`);
      assert.ok(footingsDe(ctx).length >= 1 && footingsDe(ctx).length + planDe(ctx).filter((d) => /longue/i.test(d.type)).length >= 2, `${ici} : moins de deux sorties faciles (${planDe(ctx).map((d) => d.type).join(", ")})`);
      for (const l of CINQ) assert.match(motif![l], PETITE[l], `${ici}, ${l} : la fin du motif (${motif![l]})`);
      assert.doesNotMatch(Object.values(motif!).join(" "), /séance de qualité|quality session|Qualitätseinheit|sesión de calidad|sessão de qualidade/, `${ici} : le motif promet encore une séance de qualité`);
      assert.match(ctx.lastSession?.effect ?? "", /→ aucune séance de qualité cette semaine\.$/, `${ici} : le bilan de la dernière séance (${ctx.lastSession?.effect})`);
      assert.doesNotMatch(ctx.text, /• Qualité \d/, `${ici} : l'invite de l'IA annonce une séance de qualité`);
      assert.ok(ctx.text.includes(motif!.fr), `${ici} : l'invite de l'IA ne porte pas le motif du plan`);
      // La sortie longue, elle, reste quand elle tient : l'invite de l'IA ne dit pas qu'il n'y en a pas.
      assert.ok(planDe(ctx).some((d) => /longue/i.test(d.type)), `précondition, ${ici} : la sortie longue n'est pas posée`);
      assert.doesNotMatch(ctx.text, /PAS de sortie longue cette semaine/, `${ici} : l'invite de l'IA annonce une semaine sans sortie longue, le plan en pose une`);
      if (notifications.length) {
        assert.deepEqual(ctx.macroPlan[0]?.quality, [], `${ici} : la semaine en cours de la feuille de route annonce ${ctx.macroPlan[0]?.quality.join(", ")}`);
        assert.match(ctx.macroPlan[0].focus, /^Reprise après un arrêt : footings seulement/, `${ici} : le texte de la semaine en cours (${ctx.macroPlan[0].focus})`);
        assert.equal(ctx.macroPlan[0].longRunKm > 0, planDe(ctx).some((d) => /longue/i.test(d.type)), `${ici} : la feuille de route et le plan ne disent pas la même sortie longue`);
      }
    }
    // (b) CONTRE-POIDS : à 36 et 60 km par semaine, la séance au seuil reste, avec au moins un footing à côté.
    for (const v of [36, 60]) {
      const ctx = await contexte({ seances: coureur(v, 14, 8) });
      assert.equal(tropPetiteDe(ctx), false, `précondition, ${v} km par semaine : la semaine de ${ctx.volume.targetKm} km est trop petite`);
      assert.equal(ctx.weekPlan.repriseArret, "une-qualite", `${v} km par semaine : la séance permise est retirée d'une semaine qui la tient`);
      assert.deepEqual(duresDe(ctx).map((d) => d.type), ["Seuil"], `${v} km par semaine : le plan (${planDe(ctx).map((d) => d.type).join(", ")})`);
      assert.ok(footingsDe(ctx).length >= 1, `${v} km par semaine : aucun footing à côté du seuil`);
      assert.match(motifArret(ctx)?.fr ?? "", /; une seule séance de qualité par semaine au plus, courte, jusqu'à la fin de la reprise$/);
    }
    // (c) L'INVARIANT, sur tous les volumes : jamais de séance dure sans footing à côté pendant une reprise, et l'état
    // suit le critère partagé avec le plan. Les deux branches doivent tourner.
    let petites = 0, tenues = 0;
    for (let v = 16; v <= 64; v += 4) for (const [arret, repris] of [[14, 8], [20, 12], [40, 20]] as const) {
      const ctx = await contexte({ seances: coureur(v, arret, repris) }), ici = `${v} km par semaine, ${arret} jours d'arrêt, ${repris}ᵉ jour`;
      if (duresDe(ctx).length) assert.ok(footingsDe(ctx).length >= 1, `${ici} : une séance dure sans aucun footing à côté (${planDe(ctx).map((d) => d.type).join(", ")})`);
      if (tropPetiteDe(ctx)) { petites++; assert.equal(ctx.weekPlan.repriseArret, "sans-qualite", `${ici} : semaine trop petite, état ${ctx.weekPlan.repriseArret}`); assert.deepEqual(duresDe(ctx).map((d) => d.type), [], `${ici} : une séance dure dans une semaine trop petite`); }
      else if (ctx.weekPlan.repriseArret === "une-qualite") tenues++;
    }
    assert.ok(petites >= 6 && tenues >= 6, `précondition : ${petites} semaines trop petites, ${tenues} semaines qui gardent leur séance`);
    // (d) PENDANT LA MARCHE DE SORTIE (90 jours d'arrêt, 64ᵉ jour) : à 24 km par semaine d'avant, la semaine plafonnée
    // à 19 km ne porte que des footings ; le motif de la marche le dit, celui du plafond ne le répète pas.
    const marchePetite = await contexte({ seances: coureur(24, 90, 64), notifications: dixKm16 });
    const motifMarche = marchePetite.readiness.reasonsAll.find((m) => /^fin de la reprise après/.test(m.fr));
    assert.equal(marchePetite.weekPlan.sortieReprise, true, "précondition : 64ᵉ jour, pas de marche de sortie");
    assert.equal(tropPetiteDe(marchePetite), true, `précondition : la semaine de ${marchePetite.volume.targetKm} km n'est pas trop petite`);
    assert.equal(marchePetite.weekPlan.repriseArret, "sans-qualite"); assert.equal(testVmaAttendLaReprise(marchePetite.weekPlan), true);
    assert.deepEqual(duresDe(marchePetite).map((d) => d.type), [], "marche de sortie, semaine trop petite : une séance dure est posée");
    assert.deepEqual(marchePetite.macroPlan[0].quality, [], "marche de sortie, semaine trop petite : la feuille de route annonce une séance");
    assert.match(marchePetite.macroPlan[0].focus, /^Reprise après un arrêt : footings seulement/);
    const FIN_MARCHE = { fr: /^fin de la reprise après 90 jours sans courir : footings seulement cette semaine, elle est trop petite pour porter une séance dure et un footing$/, en: /: easy runs only this week, it is too small to hold a hard session and an easy run$/,
      de: /: diese Woche nur lockere Läufe, sie ist zu klein für eine harte Einheit und einen lockeren Lauf$/, es: /: solo rodajes suaves esta semana, es demasiado corta para una sesión dura y un rodaje$/, pt: /: só corridas fáceis esta semana, é demasiado pequena para uma sessão dura e uma corrida fácil$/ } as const;
    for (const l of CINQ) assert.match(motifMarche?.[l] ?? "", FIN_MARCHE[l], `marche de sortie, ${l} : le motif (${motifMarche?.[l]})`);
    assert.doesNotMatch(marchePetite.readiness.reasons.join(" | "), /deux séances de qualité au plus/, "marche de sortie, semaine trop petite : le motif promet encore deux séances");
    assert.match(motifArret(marchePetite)?.fr ?? "", /^reprise après 90 jours sans courir : 80 % au plus de ton volume d'avant l'arrêt cette semaine \(règle de Daniels\)$/, "le motif du plafond répète « footings seulement » pendant la marche de sortie");
    assert.ok(marchePetite.text.includes(motifMarche!.fr), "l'invite de l'IA ne porte pas le motif de la marche de sortie");
    const marcheGrande = await contexte({ seances: coureur(60, 90, 64), notifications: dixKm16 });
    assert.equal(marcheGrande.weekPlan.repriseArret, undefined, "60 km par semaine, marche de sortie : la semaine est dite « footings seulement »");
    assert.ok(duresDe(marcheGrande).length >= 1, "60 km par semaine, marche de sortie : plus aucune séance");
    assert.match(marcheGrande.readiness.reasons.join(" | "), /deux séances de qualité au plus cette semaine, sans VMA ni côtes/);
    // (d bis) LA MARCHE DE SORTIE SEULE, la reprise de volume déjà finie (30 jours d'arrêt, 32ᵉ jour : la règle a fini
    // au 28ᵉ, le plafond au 30ᵉ) : la règle des petites semaines vaut encore, et il n'y a plus de motif de plafond.
    const marcheSeule = await contexte({ seances: coureur(14, 30, 32) });
    assert.equal(marcheSeule.weekPlan.sortieReprise, true, "précondition : 30 jours d'arrêt, 32ᵉ jour, pas de marche de sortie");
    assert.equal(repriseVolumeLongArret(coureur(14, 30, 32).map((w) => w.date), AUJOURDHUI), null, "précondition : la reprise de volume court encore");
    assert.equal(tropPetiteDe(marcheSeule), true, `précondition : la semaine de ${marcheSeule.volume.targetKm} km n'est pas trop petite`);
    assert.equal(marcheSeule.weekPlan.repriseArret, "sans-qualite", "marche de sortie seule : une semaine trop petite garde ses séances");
    assert.deepEqual(duresDe(marcheSeule).map((d) => d.type), []);
    assert.match(marcheSeule.readiness.reasons.join(" | "), /fin de la reprise après 30 jours sans courir : footings seulement cette semaine, elle est trop petite/);
    assert.deepEqual(marcheSeule.readiness.reasons.filter((r) => /^reprise après|^aucune course enregistrée/.test(r)), [], "marche de sortie seule : un motif de plafond est encore dit");
    // (d ter) UNE SÉANCE, PAS DEUX. Pendant la marche de sortie, deux séances sont permises ; une semaine qui en tient
    // une avec un footing, mais pas deux, n'en porte qu'une (elle portait un seuil, une séance spécifique et la sortie
    // longue, sans footing). 40 km par semaine d'avant, 60 jours d'arrêt, 66ᵉ jour : 32 km au plus.
    const marcheUne = await contexte({ seances: coureur(40, 60, 66), notifications: dixKm16 });
    const tenables = qualitesTenablesAvecFooting({ targetKm: marcheUne.volume.targetKm, longRunKm: marcheUne.volume.longRunKm, reserveKm: marcheUne.volume.longRunReserveKm, easyPace: marcheUne.easyPace, warmMin: marcheUne.warmCool.warm, coolMin: marcheUne.warmCool.cool });
    assert.equal(marcheUne.weekPlan.sortieReprise, true, "précondition : 60 jours d'arrêt, 66ᵉ jour, pas de marche de sortie");
    assert.equal(tenables, 1, `précondition : la semaine de ${marcheUne.volume.targetKm} km (sortie longue ${marcheUne.volume.longRunKm} km) tient ${tenables} séance(s) avec un footing, attendu une`);
    assert.equal(marcheUne.weekPlan.qBudget, 1, `marche de sortie : ${marcheUne.weekPlan.qBudget} séances au budget d'une semaine qui n'en tient qu'une avec un footing`);
    assert.equal(marcheUne.weekPlan.quality.length, 1); assert.equal(marcheUne.weekPlan.repriseArret, undefined, "une semaine qui tient une séance est dite « footings seulement »");
    assert.equal(duresDe(marcheUne).length, 1, `marche de sortie : ${duresDe(marcheUne).length} séance(s) dure(s) (${planDe(marcheUne).map((d) => d.type).join(", ")})`);
    assert.ok(footingsDe(marcheUne).length >= 1, `marche de sortie : aucun footing à côté de la séance dure (${planDe(marcheUne).map((d) => d.type).join(", ")})`);
    assert.ok(marcheUne.macroPlan[0].quality.length <= 1, `marche de sortie : la feuille de route annonce ${marcheUne.macroPlan[0].quality.join(", ")}`);
    assert.match(marcheUne.lastSession?.effect ?? "", /→ 1 séance de qualité cette semaine\.$/, `marche de sortie : le bilan de la dernière séance (${marcheUne.lastSession?.effect})`);
    assert.doesNotMatch(marcheUne.text, /• Qualité 2/, "marche de sortie : l'invite de l'IA annonce une seconde séance");
    // LA FEUILLE DE ROUTE AUSSI, à cinq semaines d'un 10 km (phase spécifique : elle annonçait deux séances, seuil et
    // allure de course, là où le plan n'en pose qu'une).
    const dixKmProche = [objectif({ race: "10 km test", raceDate: ilYa(-35), distanceKm: 10, targetTime: "45'00", targetSeconds: 2700, targetPace: "4'30/km" })];
    const marcheUneProche = await contexte({ seances: coureur(46, 60, 66), notifications: dixKmProche });
    assert.equal(marcheUneProche.weekPlan.sortieReprise, true); assert.equal(marcheUneProche.weekPlan.qBudget, 1, `10 km dans cinq semaines : ${marcheUneProche.weekPlan.qBudget} séance(s) au budget`);
    assert.equal(marcheUneProche.macroPlan[0].quality.length, 1, `10 km dans cinq semaines : la semaine en cours de la feuille de route annonce ${marcheUneProche.macroPlan[0].quality.join(", ")}, le plan pose une séance`);
    // DEUX AU PLUS, même quand la semaine en tiendrait trois : 96 km par semaine, 35 jours d'arrêt, à cinq semaines
    // d'un 10 km. Au 30ᵉ jour (marche de sortie) le budget est de deux ; au 36ᵉ (plan normal) il est de trois.
    const marcheGros = await contexte({ seances: coureur(96, 35, 30), notifications: dixKmProche }), apresGros = await contexte({ seances: coureur(96, 35, 36), notifications: dixKmProche });
    const tenablesGros = qualitesTenablesAvecFooting({ targetKm: marcheGros.volume.targetKm, longRunKm: marcheGros.volume.longRunKm, reserveKm: marcheGros.volume.longRunReserveKm, easyPace: marcheGros.easyPace, warmMin: marcheGros.warmCool.warm, coolMin: marcheGros.warmCool.cool });
    assert.equal(marcheGros.weekPlan.sortieReprise, true, "précondition : 35 jours d'arrêt, 30ᵉ jour, pas de marche de sortie");
    assert.ok(tenablesGros >= 3, `précondition : la semaine de ${marcheGros.volume.targetKm} km ne tient que ${tenablesGros} séance(s) avec un footing, la borne à deux ne prouverait rien`);
    assert.equal(apresGros.weekPlan.qBudget, 3, `précondition : après la marche de sortie, ce coureur n'a pas trois séances au budget (${apresGros.weekPlan.qBudget})`);
    assert.equal(marcheGros.weekPlan.qBudget, 2, `marche de sortie : ${marcheGros.weekPlan.qBudget} séances au budget d'un coureur à 96 km par semaine`);
    // Contre-poids : à 60 km par semaine, la marche de sortie garde ses deux séances, avec des footings.
    assert.equal(duresDe(marcheGrande).length, 2, `60 km par semaine, marche de sortie : ${duresDe(marcheGrande).length} séance(s) dure(s)`);
    assert.ok(footingsDe(marcheGrande).length >= 1);
    // L'INVARIANT hors de la règle d'intensité (marche de sortie, reprise de volume) : jamais de séance dure sans footing.
    let deuxSeances = 0, uneSeance = 0;
    for (let v = 16; v <= 64; v += 6) for (const [arret, repris] of [[90, 64], [90, 72], [40, 30], [40, 36]] as const) {
      const ctx = await contexte({ seances: coureur(v, arret, repris), notifications: dixKm16 });
      if (duresDe(ctx).length) assert.ok(footingsDe(ctx).length >= 1, `${v} km par semaine, ${arret} jours d'arrêt, ${repris}ᵉ jour : ${duresDe(ctx).length} séance(s) dure(s) sans aucun footing (${planDe(ctx).map((d) => d.type).join(", ")})`);
      if (duresDe(ctx).length >= 2) deuxSeances++; else if (duresDe(ctx).length === 1) uneSeance++;
    }
    assert.ok(deuxSeances >= 2 && uneSeance >= 2, `précondition : ${deuxSeances} semaines à deux séances, ${uneSeance} à une séance`);
    // (d quater) LE CALENDRIER. Le volume peut tenir deux séances et un footing sans que la semaine ait un JOUR pour ce
    // footing : quatre jours disponibles, deux séances dures, la sortie longue, et le repos complet que le plan pose à
    // côté d'elle (26 plans sur 12 960, relecture du 23/11/2026). Le plan ne pose une séance dure que s'il reste un jour
    // pour un footing. Tous les jeux de trois et de quatre jours disponibles, pendant la marche de sortie (deux séances
    // au budget) et pendant la règle d'intensité (une séance).
    const jeux = (n: number) => { const out: number[][] = []; const rec = (de: number, pris: number[]) => { if (pris.length === n) { out.push(pris); return; } for (let j = de; j <= 6; j++) rec(j + 1, [...pris, j]); }; rec(0, []); return out; };
    let avecSeance = 0, retenues = 0, mordu = 0;
    for (const jours of [...jeux(3), ...jeux(4)]) for (const [seances, notifications] of [[coureur(60, 90, 64), dixKmProche], [coureur(60, 14, 8), []]] as const) {
      const ctx = await contexte({ profil: { ...PROFIL, days_per_week: jours.length, available_days: jours }, seances: [...seances], notifications: [...notifications] });
      const plan = planDe(ctx), dures = plan.filter((d) => DUR.test(d.type)), faciles = plan.filter((d) => /^(Endurance|R[ée]cup)$/i.test(d.type)), ici = `jours disponibles ${jours.join(",")}, ${notifications.length ? "marche de sortie" : "règle d'intensité"}`;
      assert.equal(ctx.weekPlan.footingExige, true, `${ici} : le plan ne sait pas qu'un footing est exigé`);
      if (dures.length) { avecSeance++; assert.ok(faciles.length >= 1, `${ici} : ${dures.length} séance(s) dure(s) sans aucun footing (${plan.map((d) => `${d.date.slice(8)} ${d.type}`).join(", ")})`); }
      if (dures.length === ctx.weekPlan.quality.length) retenues++; else if (dures.length < ctx.weekPlan.quality.length) mordu++;
    }
    // MOINS DE SORTIES VOULUES QUE DE JOURS DISPONIBLES (deux, trois ou quatre sorties par semaine, sept jours libres) :
    // ce n'est plus le calendrier qui manque, c'est le budget de sorties. La dernière sortie reste au footing.
    let budgetMordu = 0;
    for (const sortiesVoulues of [2, 3, 4]) for (const [seances, notifications] of [[coureur(60, 90, 64), dixKmProche], [coureur(60, 14, 8), []]] as const) {
      const ctx = await contexte({ profil: { ...PROFIL, days_per_week: sortiesVoulues, available_days: [0, 1, 2, 3, 4, 5, 6] }, seances: [...seances], notifications: [...notifications] });
      const plan = planDe(ctx), dures = plan.filter((d) => DUR.test(d.type)), faciles = plan.filter((d) => /^(Endurance|R[ée]cup)$/i.test(d.type));
      if (dures.length) assert.ok(faciles.length >= 1, `${sortiesVoulues} sorties par semaine, sept jours libres : ${dures.length} séance(s) dure(s) sans footing (${plan.map((d) => d.type).filter((t) => t !== "Repos").join(", ")})`);
      if (dures.length < ctx.weekPlan.quality.length) budgetMordu++;
    }
    assert.ok(budgetMordu >= 1, "précondition : le budget de sorties n'a retenu aucune séance, la clause n'est pas jouée");
    assert.ok(avecSeance >= 40 && retenues >= 40, `précondition : ${avecSeance} plans avec une séance dure, ${retenues} qui posent tout leur budget`);
    assert.ok(mordu >= 1, `précondition : la garde de calendrier n'a retenu aucune séance sur 140 plans (${mordu})`);
    // HORS REPRISE, le plan n'exige rien : un coureur SANS arrêt garde les séances que la garde retiendrait. On lui
    // tend le même contexte avec l'exigence : sur les 35 jeux de quatre jours, elle retire au moins une séance, que
    // son plan à lui pose encore.
    let sansGarde = 0, avecGarde = 0;
    for (const jours of jeux(4)) {
      const ctx = await contexte({ profil: { ...PROFIL, days_per_week: 4, available_days: jours }, seances: avantReel(1, 10), notifications: dixKmProche });
      assert.equal(sansArretFlag(ctx), undefined, `jours disponibles ${jours.join(",")} : un coureur sans arrêt reçoit la garde de calendrier`);
      sansGarde += planDe(ctx).filter((d) => DUR.test(d.type)).length;
      avecGarde += planDe({ ...ctx, weekPlan: { ...ctx.weekPlan, footingExige: true } }).filter((d) => DUR.test(d.type)).length;
    }
    assert.ok(sansGarde > avecGarde, `hors reprise, le plan retient déjà les séances que la garde de calendrier retiendrait (${sansGarde} séances dures sans elle, ${avecGarde} avec)`);
    // (e) LA MARCHE FINIE, LA REPRISE DE VOLUME COURT ENCORE (72ᵉ jour) : c'est le motif du plafond qui le dit.
    const volumePetit = await contexte({ seances: coureur(24, 90, 72) });
    assert.equal(volumePetit.weekPlan.sortieReprise, undefined, "précondition : 72ᵉ jour, la marche de sortie court encore");
    assert.equal(volumePetit.weekPlan.repriseArret, "sans-qualite"); assert.deepEqual(duresDe(volumePetit).map((d) => d.type), []);
    for (const l of CINQ) assert.match(motifArret(volumePetit)?.[l] ?? "", PETITE[l], `72ᵉ jour, ${l} : le motif (${motifArret(volumePetit)?.[l]})`);
    assert.match(motifArret(volumePetit)?.fr ?? "", /^reprise après 90 jours sans courir : 80 % au plus de ton volume d'avant l'arrêt cette semaine \(règle de Daniels\) ; footings/);
    const volumeGrand = await contexte({ seances: coureur(60, 90, 72) });
    assert.equal(volumeGrand.weekPlan.repriseArret, undefined); assert.ok(duresDe(volumeGrand).length >= 1, "60 km par semaine, 72ᵉ jour : plus aucune séance dure");
    // (e ter) LA SORTIE LONGUE RETIRÉE, LA SÉANCE GARDÉE : trois sorties de 15 km par semaine, 20 jours d'arrêt, 12ᵉ jour.
    // À 75 % (34 km), la sortie longue serait plus courte que sa sortie habituelle : elle n'est pas posée ; la semaine
    // tient un seuil et un footing. La semaine en cours de la feuille de route dit les deux.
    const troisParSemaine = (de: number, a: number) => Array.from({ length: a - de + 1 }, (_, k) => de + k).filter((n) => [0, 2, 4].includes(n % 7)).map((n) => sortie(n, 15));
    const grandesSorties = await contexte({ seances: [...troisParSemaine(12 + 20 + 1, 12 + 20 + 76), ...troisParSemaine(1, 12)], notifications: dixKm16 });
    assert.equal(grandesSorties.weekPlan.repriseArret, "une-qualite", `précondition : trois sorties de 15 km, état ${grandesSorties.weekPlan.repriseArret} (cible ${grandesSorties.volume.targetKm} km)`);
    assert.equal(grandesSorties.volume.longRunKm, 0, "précondition : la sortie longue n'est pas retirée");
    assert.equal(duresDe(grandesSorties).length <= 1 && footingsDe(grandesSorties).length >= 1, true, `trois sorties de 15 km : ${planDe(grandesSorties).map((d) => d.type).join(", ")}`);
    assert.equal(grandesSorties.macroPlan[0].longRunKm, 0, `la semaine en cours de la feuille de route annonce ${grandesSorties.macroPlan[0].longRunKm} km de sortie longue, le plan n'en pose pas`);
    assert.deepEqual(grandesSorties.macroPlan[0].quality, ["Seuil"], "la semaine en cours de la feuille de route n'annonce plus la séance que le plan garde");
    // (e bis) VOLUME D'AVANT L'ARRÊT INCONNU (montre sans distance), la règle d'intensité et la marche de sortie finies :
    // il n'y a ni plafond ni motif de plafond. La semaine de footings seulement n'est pas muette pour autant
    // (relecture du 23/11/2026 : état « sans-qualite », plan sans séance, et AUCUN motif).
    const inconnuSeances = [...avantReel(75 + 90 + 1, 6).map((w) => ({ ...w, distance_km: null })), ...depuisReprise(75, 3)];
    const inconnu = await contexte({ seances: inconnuSeances });
    assert.equal(arretHorsEchelle(inconnuSeances.map((w) => w.date), AUJOURDHUI), null, "précondition : au 75ᵉ jour, la règle d'intensité court encore");
    assert.equal(inconnu.weekPlan.sortieReprise, undefined, "précondition : au 75ᵉ jour, la marche de sortie court encore");
    assert.equal(tropPetiteDe(inconnu), true, `précondition : la semaine de ${inconnu.volume.targetKm} km n'est pas trop petite`);
    assert.equal(inconnu.weekPlan.repriseArret, "sans-qualite"); assert.deepEqual(duresDe(inconnu).map((d) => d.type), []);
    const motifInconnu = motifArret(inconnu);
    assert.match(motifInconnu?.fr ?? "", /^reprise après 90 jours sans courir : ton volume d'avant l'arrêt n'est pas connu, aucun plafond de volume n'est posé ; footings seulement cette semaine : elle est trop petite pour porter une séance dure et un footing$/, `volume d'avant inconnu : le motif (${inconnu.readiness.reasons.join(" | ") || "aucun"})`);
    for (const l of CINQ) assert.match(motifInconnu?.[l] ?? "", PETITE[l], `volume d'avant inconnu, ${l} : le motif (${motifInconnu?.[l]})`);
    assert.ok(inconnu.text.includes(`• À savoir : ${motifInconnu!.fr}`) || inconnu.text.includes(` ; ${motifInconnu!.fr}`), "volume d'avant inconnu : l'invite de l'IA ne porte pas le motif");
    assert.equal(inconnu.readiness.reasons.filter((r) => /^reprise après/.test(r)).length, 1, "volume d'avant inconnu : le motif est dit deux fois");
    // AVEC UN AUTRE MOTIF D'INFORMATION (une course C inscrite cette semaine), l'invite de l'IA porte les deux.
    const inconnuCourse = await contexte({ seances: inconnuSeances, notifications: [{ user_id: "u", type: "planned_race", created_at: `${AUJOURDHUI}T10:00:00Z`, data: { name: "Corrida du quartier", date: ilYa(-4), distanceKm: 5, priorite: "C" } }] });
    const motifInconnuCourse = motifArret(inconnuCourse);
    assert.match(inconnuCourse.readiness.reasons.join(" | "), /course C cette semaine : Corrida du quartier/, "précondition : la course C n'a pas son motif");
    if (inconnuCourse.weekPlan.repriseArret === "sans-qualite") {
      assert.ok(motifInconnuCourse && /footings seulement cette semaine : elle est trop petite/.test(motifInconnuCourse.fr), `avec une course C : la semaine de footings n'a pas son motif (${inconnuCourse.readiness.reasons.join(" | ")})`);
      assert.ok(inconnuCourse.text.includes(` ; ${motifInconnuCourse!.fr}`), "avec une course C : l'invite de l'IA ne porte pas le motif ajouté à la suite des autres");
    }
    assert.equal(inconnuCourse.weekPlan.repriseArret, "sans-qualite", `précondition : avec une course C, la semaine n'est plus trop petite (cible ${inconnuCourse.volume.targetKm} km)`);
    // Contre-poids : le même, à 60 km par semaine depuis sa reprise, garde ses séances et n'a aucun motif ajouté.
    const inconnuGrand = await contexte({ seances: [...avantReel(75 + 90 + 1, 10).map((w) => ({ ...w, distance_km: null })), ...depuisReprise(75, 10)] });
    assert.equal(inconnuGrand.weekPlan.repriseArret, undefined); assert.deepEqual(inconnuGrand.readiness.reasons.filter((r) => /^reprise après/.test(r)), [], "volume d'avant inconnu, grosse semaine : un motif de reprise est ajouté");
    // (f) HORS CHAMP. Un petit coureur SANS arrêt garde ses séances ; sous consignes du kinésithérapeute, la règle
    // ne s'applique pas (leur fenêtre de séances décide déjà).
    const sansArret = await contexte({ seances: avantReel(1, 20 / 6) });
    assert.equal(sansArret.weekPlan.repriseArret, undefined, "un petit coureur sans arrêt est dit en reprise");
    assert.doesNotMatch(sansArret.readiness.reasons.join(" | "), /trop petite/);
    assert.ok(sansArret.weekPlan.qBudget >= 1, `précondition : le petit coureur sans arrêt n'a aucune séance de qualité (${sansArret.weekPlan.qBudget})`);
    const kine = [{ user_id: "u", type: "consignes_kine", created_at: `${ilYa(1)}T10:00:00Z`, data: { dureeMaxMin: null, sansIntensite: false, seancesMaxSemaine: 3, jusquAu: ilYa(-14), majA: ilYa(1) } }];
    const sousKine = await contexte({ seances: coureur(24, 14, 8), notifications: kine });
    assert.doesNotMatch(sousKine.readiness.reasons.join(" | "), /trop petite/, "sous consignes du kinésithérapeute, la règle des petites semaines s'applique");
    assert.equal(sousKine.weekPlan.footingExige, undefined, "sous consignes du kinésithérapeute, le plan exige un jour de footing");
    // Et un petit volume plafonné, hors de la règle d'intensité (15 km d'avant, 40 jours d'arrêt, 36ᵉ jour), y garde sa
    // sortie longue : la retirer laissait le seuil seul dans la semaine.
    const kinePetit = await contexte({ seances: coureur(15, 40, 36), notifications: kine });
    assert.ok(kinePetit.volume.targetKm <= 12, `précondition : sous consignes, ${kinePetit.volume.targetKm} km visés, la semaine n'est pas plafonnée`);
    assert.equal(arretHorsEchelle(coureur(15, 40, 36).map((w) => w.date), AUJOURDHUI), null, "précondition : au 36ᵉ jour, la règle d'intensité court encore");
    assert.ok(kinePetit.volume.longRunKm > 0, "sous consignes du kinésithérapeute, la sortie longue d'une semaine plafonnée est retirée");
    // Un débutant en marche-course qui revient d'un arrêt : son programme n'a aucune séance dure, sa semaine est au
    // plancher (footings seulement, déjà), et son motif ne parle pas d'une semaine « trop petite pour une séance dure ».
    // Quatre sorties, vingt jours d'arrêt, puis une sortie tous les deux jours depuis treize jours : onze sorties en
    // tout, le programme (33 séances) est en cours, et la règle d'intensité permettrait une séance.
    const sortiesDebutant = [40, 38, 36, 34, 13, 11, 9, 7, 5, 3, 1].map((n) => sortie(n, 3));
    assert.equal(qualitePendantReprise(repriseApresArret(sortiesDebutant.map((w) => w.date), AUJOURDHUI))?.max, 1, "précondition : le débutant n'est pas dans la seconde moitié de sa reprise");
    const debutant = await contexte({ profil: { ...PROFIL, running_years: 0, peut_courir_30min: false }, seances: sortiesDebutant });
    assert.doesNotMatch(debutant.readiness.reasons.join(" | "), /trop petite/, `marche-course : la règle des petites semaines s'applique (${debutant.readiness.reasons.join(" | ")})`);
    assert.match(debutant.readiness.reasons.join(" | "), /marche-course/, "précondition : le débutant n'est pas en marche-course");
    assert.deepEqual(duresDe(debutant).map((d) => d.type), [], "marche-course : une séance dure est posée");
  });

  await test("la marche de sortie écrit ses séances dans la dose courte de la reprise", async () => {
    // 60 km par semaine, 90 jours d'arrêt, un 10 km dans seize semaines. Pendant la marche de sortie (63ᵉ au 69ᵉ jour),
    // la séance qui revient est celle de la reprise ; la semaine suivante, la dose normale. On compare la MÊME séance
    // (même texte, aux chiffres près) : la dose de la marche est plus petite.
    const dose = (desc: string) => Number(desc.match(/(\d+)\s*(?:×|min)/)?.[1] ?? NaN), gabarit = (desc: string) => desc.replace(/\d+/g, "N");
    // ⚠️ La semaine de comparaison ne doit PAS être une semaine allégée du bloc (une sur quatre, calée sur le
    // calendrier) : la dose y est réduite elle aussi, et la comparaison ne dirait rien (visa RENVOYÉ, 23/11/2026).
    // On compare donc chaque jour de la marche à la semaine suivante ET à celle d'après, en écartant l'allégée.
    const semaineDe = async (jour: number) => { const ctx = await contexte({ seances: longArret(90, jour), notifications: dixKm16 }); return { allegee: ctx.cycle.deload, seances: ctx.weekPlan.quality.filter((q) => q.type !== "VMA") }; };
    let comparees = 0, normales = 0;
    for (const pendant of [63, 65, 67, 69]) {
      const m = await semaineDe(pendant);
      for (const plusTard of [7, 14]) {
        const a = await semaineDe(pendant + plusTard);
        if (a.allegee) continue;
        normales++;
        for (const q of m.seances) for (const r of a.seances) if (q.type === r.type && gabarit(q.desc) === gabarit(r.desc) && Number.isFinite(dose(q.desc)) && Number.isFinite(dose(r.desc))) {
          comparees++;
          assert.ok(dose(q.desc) < dose(r.desc), `${pendant}ᵉ jour contre ${pendant + plusTard}ᵉ : la séance de la marche de sortie (${q.desc.slice(0, 70)}) n'est pas plus courte que la séance normale (${r.desc.slice(0, 70)})`);
        }
      }
    }
    // LA SEMAINE DU CALENDRIER EST ELLE-MÊME ALLÉGÉE (une sur quatre) : la dose est réduite pour tout le monde, il n'y a
    // rien à comparer ce jour-là. Le test le dit et s'arrête là ; l'ancre de source ci-dessous tient à toute date.
    if (normales === 0) {
      assert.equal((await contexte({ seances: reguliere(1, 100), notifications: dixKm16 })).cycle.deload, true, "aucune semaine de comparaison, alors que la semaine du calendrier n'est pas allégée");
      comparees = 2;
    }
    assert.ok(comparees >= 2, `précondition : ${comparees} séance(s) comparable(s) entre la marche de sortie et la semaine suivante`);
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /const doseReduite = semaineAllegeeDuBloc \|\| repriseCetteSemaine \|\| qualiteReprise != null \|\| marcheSortie != null;/);
  });

  await test("un volume d'avant l'arrêt de 12 km ou moins est plafonné à lui-même, jamais sous un footing", async () => {
    const debut = { arretJours: 40, joursRepris: 0 }, tresLong = { arretJours: 90, joursRepris: 2 };
    for (const r of [debut, tresLong]) {
      for (let v = 1; v <= 12; v++) assert.equal(plafondPetitVolumeKm(r, v), Math.max(6, v), `${v} km d'avant, ${r.arretJours} jours d'arrêt : plafond de ${plafondPetitVolumeKm(r, v)} km`);
      assert.equal(plafondPetitVolumeKm(r, 9.4), 9); assert.equal(plafondPetitVolumeKm(r, 0), null, "volume inconnu : un plafond est posé");
    }
    // Au-dessus de 12 km : le plafond replié (12 km) tant qu'aucun palier ne laisse deux footings, puis les paliers.
    assert.deepEqual([13, 15, 16, 30].map((v) => plafondPetitVolumeKm(debut, v)), [12, 12, null, null]);
    assert.deepEqual([14, 15, 60].map((v) => plafondPetitVolumeKm(tresLong, v)), [12, null, null]);
    // Jamais hors de la reprise de volume d'un long arrêt.
    for (const r of [null, { arretJours: 20, joursRepris: 0 }, { arretJours: 40, joursRepris: 40 }, { arretJours: 90, joursRepris: 84 }]) assert.equal(plafondPetitVolumeKm(r, 10), null, `${r ? r.arretJours + " jours d'arrêt, " + r.joursRepris + "ᵉ jour" : "pas d'arrêt"} : un plafond est posé`);
    for (const [r, dans, attendu] of [[{ arretJours: 40, joursRepris: 35 }, 0, 10], [{ arretJours: 40, joursRepris: 35 }, 7, null]] as const) assert.equal(plafondPetitVolumeKm(r, 10, dans), attendu, "le plafond d'un petit volume ne suit pas la fin de la reprise de volume");
    // LE PLAN. 8 km par semaine d'avant, 90 jours d'arrêt, 2ᵉ jour de reprise : 17 à 20 km visés avant ; 8 km au plus.
    for (const [v, arret, repris] of [[8, 90, 2], [10, 40, 5], [5, 60, 3]] as const) {
      const ctx = await contexte({ seances: coureur(v, arret, repris) }), plafond = Math.max(6, v), ici = `${v} km d'avant, ${arret} jours d'arrêt, ${repris}ᵉ jour`;
      assert.ok(ctx.volume.targetKm <= plafond, `${ici} : ${ctx.volume.targetKm} km visés pour un plafond de ${plafond} km`);
      assert.ok(footingsDe(ctx).length >= 1, `${ici} : la semaine plafonnée est vide (${planDe(ctx).map((d) => d.type).join(", ")})`);
      assert.deepEqual(planDe(ctx).filter((d) => DUR.test(d.type) || /longue/i.test(d.type)).map((d) => d.type), [], `${ici} : une séance dure ou une sortie longue`);
      assert.match(motifArret(ctx)?.fr ?? "", new RegExp(`: ${plafond} km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit ; `), `${ici} : le motif (${motifArret(ctx)?.fr})`);
      for (const l of CINQ) assert.doesNotMatch(motifArret(ctx)?.[l] ?? "%", /%|Daniels/, `${ici}, ${l} : un pourcentage ou Daniels`);
    }
    // La reprise de volume finie, plus de plafond : la cible ordinaire du plan revient.
    const fini = await contexte({ seances: coureur(8, 40, 41) });
    assert.equal(motifArret(fini), undefined, `8 km d'avant, reprise finie : un motif de reprise est encore dit (${motifArret(fini)?.fr})`);
  });

  await test("les textes du plancher et de la fin de règle, phrase entière, et ce que le coureur lit", async () => {
    // Les trois textes du plancher, écrits ici en toutes lettres (forme « repris »).
    const PLANCHER = {
      court: { fr: "deux footings courts cette semaine, le minimum d'une semaine de reprise", en: "two short easy runs this week, the minimum for a comeback week", de: "diese Woche zwei kurze lockere Läufe, das Minimum einer Wiedereinstiegswoche", es: "dos rodajes cortos esta semana, lo mínimo de una semana de vuelta", pt: "duas corridas curtas esta semana, o mínimo de uma semana de retoma" },
      petit: { fr: "ton volume habituel est déjà petit, il n'est pas réduit cette semaine", en: "your usual volume is already small, so it is not cut this week", de: "dein üblicher Umfang ist ohnehin klein und wird diese Woche nicht gekürzt", es: "tu volumen habitual ya es pequeño y no se reduce esta semana", pt: "o teu volume habitual já é pequeno e não é reduzido esta semana" },
      long: { fr: "ton volume des dernières semaines est trop faible pour servir de repère", en: "your volume over the last few weeks is too low to serve as a reference", de: "dein Umfang der letzten Wochen ist zu gering, um als Maßstab zu dienen", es: "tu volumen de las últimas semanas es demasiado bajo para servir de referencia", pt: "o teu volume das últimas semanas é demasiado baixo para servir de referência" },
    } as const;
    for (const pl of ["court", "petit", "long"] as const) for (const l of ["fr", "en", "de", "es", "pt"] as const)
      assert.ok(MOTIF_T[l].repriseArret("10", null, false, 0, false, pl).includes(PLANCHER[pl][l]), `${pl}, ${l} : « ${MOTIF_T[l].repriseArret("10", null, false, 0, false, pl)} »`);
    // CE QUE LE COUREUR LIT pendant la règle prolongée : le jour où elle finit, pas « la quatrième semaine ».
    for (const [arret, attendu] of [[90, /puis une seule par semaine jusqu'au 63ᵉ jour$/], [56, /puis une seule par semaine jusqu'au 38ᵉ jour$/], [35, /puis une seule par semaine jusqu'à la quatrième$/]] as const) {
      const ctx = await contexte({ seances: longArret(arret, 5) });
      assert.match(ditArret(ctx), attendu, `${arret} jours d'arrêt, 5ᵉ jour : le motif ne dit pas la fin de la règle (${ditArret(ctx)})`);
      if (arret > 35) assert.doesNotMatch(ditArret(ctx), /quatrième/, `${arret} jours d'arrêt : le motif dit encore « la quatrième semaine »`);
    }
    // Les DEUX formes du texte, selon que la séance hebdomadaire est déjà permise ou non.
    assert.match(MOTIF_T.fr.repriseLongArret("90", false, 1, "50", false, false, "63"), /; une seule séance de qualité par semaine au plus, courte, jusqu'au 63ᵉ jour de reprise$/);
    assert.match(MOTIF_T.fr.repriseLongArret("90", false, 1, "50", false, false, null), /; une seule séance de qualité par semaine au plus, courte, jusqu'à la fin de la quatrième semaine de reprise$/);
    assert.match(MOTIF_T.fr.repriseLongArret("90", false, 0, "33", false, false, "63"), /; aucune séance dure pendant les deux premières semaines de reprise, puis une seule par semaine jusqu'au 63ᵉ jour$/);
    // Et les cinq langues portent le même jour.
    const ctx90 = await contexte({ seances: longArret(90, 5) });
    const motif90 = ctx90.readiness.reasonsAll.find((m) => /sans courir/.test(m.fr));
    assert.ok(motif90, "le motif de l'arrêt manque");
    for (const l of ["en", "de", "es", "pt"] as const) assert.match(motif90[l], /\b63\b/, `${l} : le motif ne dit pas le 63ᵉ jour (« ${motif90[l]} »)`);
  });

  await test("le motif du long arrêt dit le plafond dans les cinq langues, et se tait quand il n'y en a pas", () => {
    const AU_PLUS = { fr: /au plus de ton volume d'avant l'arrêt/, en: /no more than .* of your pre-break volume/, de: /höchstens .* deines Umfangs vor der Pause/, es: /como máximo .* de tu volumen de antes de la pausa/, pt: /no máximo .* do teu volume de antes da pausa/ } as const;
    for (const l of Object.keys(MOTIF_T) as (keyof typeof MOTIF_T)[]) {
      const cle = AU_PLUS[l as keyof typeof AU_PLUS];
      for (const [enCours, q] of [[true, 0], [false, 0], [false, 1]] as const) {
        const avec = MOTIF_T[l].repriseLongArret("90", enCours, q, "33"), sans = MOTIF_T[l].repriseLongArret("90", enCours, q, null);
        assert.match(avec, /33\s?%/, `${l} : le pourcentage manque dans « ${avec} »`);
        assert.match(avec, cle, `${l} : « ${avec} » ne dit pas que c'est un maximum du volume d'avant l'arrêt`);
        assert.ok(!/%|33|null|undefined/.test(sans), `${l} : un pourcentage (ou une valeur vide) reste dans « ${sans} »`);
        assert.ok(avec.includes("90") && sans.includes("90"), `${l} : le nombre de jours a disparu`);
        // Le pourcentage s'AJOUTE au texte d'intensité, il ne le remplace pas.
        assert.ok(avec.length > sans.length && sans.split(/[:;,.]/).filter((m) => m.trim().length > 12).every((m) => avec.includes(m.trim())), `${l} : le texte d'intensité a changé avec le pourcentage (« ${sans} » / « ${avec} »)`);
      }
      // Dans chaque langue, « aucune séance dure » et « une séance de qualité au plus » ne sont pas inversés.
      const AUCUNE = { fr: /aucune séance dure/, en: /no hard session/, de: /keine harte Einheit/, es: /ninguna sesión dura/, pt: /nenhuma sessão dura/ } as const;
      const UNE = { fr: /une seule séance de qualité/, en: /one quality session/, de: /höchstens eine kurze Qualitätseinheit/, es: /como máximo una sesión de calidad/, pt: /no máximo uma sessão de qualidade/ } as const;
      for (const v of ["33", null]) {
        const zero = MOTIF_T[l].repriseLongArret("90", false, 0, v), un = MOTIF_T[l].repriseLongArret("90", false, 1, v);
        assert.ok(AUCUNE[l as keyof typeof AUCUNE].test(zero) && !UNE[l as keyof typeof UNE].test(zero), `${l} : avec aucune séance dure permise, le texte dit « ${zero} »`);
        assert.ok(UNE[l as keyof typeof UNE].test(un), `${l} : avec une séance permise, le texte dit « ${un} »`);
      }
      // « Footings seulement » : le plafond reste dit, la séance de qualité ne l'est plus.
      const FOOT = {
        fr: "footings seulement cette semaine : ta sortie longue serait plus courte que ta sortie habituelle, elle n'est pas posée, et la séance dure attend son retour",
        en: "easy runs only this week: your long run would be shorter than your usual run, so it is not scheduled, and the hard session waits until it is back",
        de: "vorerst nur lockere Läufe: Dein langer Lauf wäre kürzer als dein üblicher Lauf und wird deshalb nicht eingeplant, die harte Einheit wartet, bis er zurück ist",
        es: "solo rodajes suaves esta semana: tu tirada larga sería más corta que tu salida habitual, así que no se programa, y la sesión dura espera a que vuelva",
        pt: "só corridas fáceis esta semana: o teu treino longo seria mais curto do que a tua corrida habitual, por isso não é marcado, e a sessão dura espera que ele volte",
      } as const;
      const foot = MOTIF_T[l].repriseLongArret("90", false, "footings", "33");
      assert.ok(foot.endsWith(FOOT[l as keyof typeof FOOT]), `${l} : « ${foot} » ne finit pas par la phrase « footings seulement » entière`);
      // La même phrase clôt le motif d'une pause courte (6 à 28 jours) survenue pendant la reprise du long arrêt.
      const footPause = MOTIF_T[l].repriseArret("9", "50", false, "footings", false);
      assert.ok(footPause.endsWith(FOOT[l as keyof typeof FOOT]) && footPause.includes("50") && !UNE[l as keyof typeof UNE].test(footPause), `${l} : « ${footPause} »`);
      assert.ok(UNE[l as keyof typeof UNE].test(MOTIF_T[l].repriseArret("9", "50", false, 1, false)), `${l} : le motif de la pause courte ne dit plus « une séance au plus »`);
      // DANIELS N'EST CITÉ QUE POUR SON CHIFFRE : un palier remonté (petit volume) ne porte pas son nom.
      for (const [enCours, q] of [[true, 0], [true, null], [false, 0], [false, 1], [false, "footings"], [false, null]] as const) {
        const cite = MOTIF_T[l].repriseLongArret("90", enCours, q, "33"), tait = MOTIF_T[l].repriseLongArret("90", enCours, q, "50", false, true);
        assert.match(cite, /Daniels/, `${l} : Daniels n'est plus cité à côté de son palier (« ${cite} »)`);
        assert.doesNotMatch(tait, /Daniels/, `${l} : Daniels est cité à côté d'un palier remonté (« ${tait} »)`);
        assert.match(tait, /50\s?%/); assert.match(tait, cle);
        assert.equal(tait.replace("50", "33").length, cite.length - cite.match(/ \([^()]*Daniels[^()]*\)/)![0].length, `${l} : hors la mention de Daniels, le texte a changé (« ${cite} » / « ${tait} »)`);
      }
      // PAUSE EN COURS sous le plafond du long arrêt : le plafond, puis l'hypothèse de la montre, sans borne d'intensité.
      const MONTRE = { fr: /ta montre ne synchronise plus/, en: /your watch is no longer syncing/, de: /synchronisiert deine Uhr nicht mehr/, es: /tu reloj ya no sincroniza/, pt: /o teu relógio deixou de sincronizar/ } as const;
      const pause = MOTIF_T[l].repriseLongArret("9", true, null, "50");
      assert.match(pause, MONTRE[l as keyof typeof MONTRE], `${l} : « ${pause} » ne dit plus que la montre a pu cesser de synchroniser`);
      assert.match(pause, cle); assert.match(pause, /50\s?%/);
      assert.ok(!AUCUNE[l as keyof typeof AUCUNE].test(pause) && !UNE[l as keyof typeof UNE].test(pause) && !/null|undefined/.test(pause) && pause.includes("9"), `${l} : « ${pause} »`);
      assert.match(foot, cle); assert.match(foot, /33\s?%/);
      assert.ok(!UNE[l as keyof typeof UNE].test(foot) && !/null|undefined/.test(foot) && foot.includes("90"), `${l} : « ${foot} »`);
      // Volume d'avant l'arrêt inconnu : c'est dit, pas encore repris comme repris, et seulement quand on le demande.
      const INC = { fr: /n'est pas connu/, en: /is not known/, de: /nicht bekannt/, es: /no conocemos/, pt: /não é conhecido/ } as const;
      for (const [enCours, q] of [[true, 0], [false, 0], [false, 1]] as const) {
        const inc = MOTIF_T[l].repriseLongArret("90", enCours, q, null, true), tu = MOTIF_T[l].repriseLongArret("90", enCours, q, null), connu = MOTIF_T[l].repriseLongArret("90", enCours, q, "33", true);
        assert.match(inc, INC[l as keyof typeof INC], `${l} : « ${inc} » ne dit pas que le volume d'avant l'arrêt est inconnu`);
        // La phrase entière, écrite ici en toutes lettres : le volume n'est pas connu ET aucun plafond n'est posé.
        const PHRASE_INC = {
          fr: [", sans plafond de volume car ton volume d'avant l'arrêt n'est pas connu", "ton volume d'avant l'arrêt n'est pas connu, aucun plafond de volume n'est posé ; "],
          en: [", with no volume cap because your pre-break volume is not known", "your pre-break volume is not known, so no volume cap is set; "],
          de: [", ohne Umfangsgrenze, weil dein Umfang vor der Pause nicht bekannt ist", "dein Umfang vor der Pause ist nicht bekannt, es gilt keine Umfangsgrenze; "],
          es: [", sin límite de volumen porque no conocemos tu volumen de antes de la pausa", "no conocemos tu volumen de antes de la pausa, así que no hay límite de volumen; "],
          pt: [", sem limite de volume porque o teu volume de antes da pausa não é conhecido", "o teu volume de antes da pausa não é conhecido, por isso não há limite de volume; "],
        } as const;
        assert.ok(inc.includes(PHRASE_INC[l as keyof typeof PHRASE_INC][enCours ? 0 : 1]), `${l} : « ${inc} » ne porte pas la phrase entière du volume inconnu`);
        assert.ok(!INC[l as keyof typeof INC].test(tu) && !INC[l as keyof typeof INC].test(connu), `${l} : le volume est dit inconnu sans raison (« ${tu} » / « ${connu} »)`);
        assert.ok(!/%|null|undefined/.test(inc) && tu.split(/[:;,.]/).filter((m) => m.trim().length > 12).every((m) => inc.includes(m.trim())), `${l} : le texte d'intensité a changé avec l'aveu du volume inconnu (« ${tu} » / « ${inc} »)`);
      }
      // LA FIN DE LA RÈGLE, quand ce n'est pas le 28ᵉ jour : le motif dit le jour, plus « la quatrième semaine ».
      const QUATRIEME = { fr: /quatrième/, en: /fourth/, de: /vierten/, es: /cuarta/, pt: /quarta/ } as const;
      for (const q of [0, 1] as const) {
        const court = MOTIF_T[l].repriseLongArret("90", false, q, "33"), long63 = MOTIF_T[l].repriseLongArret("90", false, q, "33", false, false, "63");
        assert.match(court, QUATRIEME[l as keyof typeof QUATRIEME], `${l} : sans jour de fin, « ${court} » ne dit pas la quatrième semaine`);
        assert.ok(/\b63\b/.test(long63) && !QUATRIEME[l as keyof typeof QUATRIEME].test(long63) && !/null|undefined/.test(long63), `${l} : « ${long63} » ne dit pas le 63ᵉ jour, ou dit encore la quatrième semaine`);
        assert.ok(!/\b63\b/.test(court), `${l} : « ${court} » dit un 63ᵉ jour sans qu'on le lui donne`);
      }
      // LA MARCHE DE SORTIE : le nombre de jours d'arrêt, « deux séances au plus », et la VMA nommée.
      const DEUX = { fr: /deux séances de qualité au plus/, en: /two quality sessions at most/, de: /höchstens zwei Qualitätseinheiten/, es: /como máximo dos sesiones de calidad/, pt: /no máximo duas sessões de qualidade/ } as const;
      const sortieDite = MOTIF_T[l].sortieReprise("90");
      assert.match(sortieDite, DEUX[l as keyof typeof DEUX], `${l} : « ${sortieDite} » ne dit pas « deux séances au plus »`);
      assert.ok(/VMA|VO2max/.test(sortieDite) && sortieDite.includes("90") && !/null|undefined/.test(sortieDite), `${l} : « ${sortieDite} »`);
      // LE PLANCHER D'UNE PAUSE COURTE : trois textes, sans pourcentage, distincts du volume inconnu.
      for (const enCours of [true, false]) {
        const base = MOTIF_T[l].repriseArret("10", null, enCours, 0, false);
        const variantes = (["court", "petit", "long"] as const).map((pl) => MOTIF_T[l].repriseArret("10", null, enCours, 0, false, pl));
        assert.equal(new Set([base, ...variantes]).size, 4, `${l} : deux textes du plancher sont identiques (${variantes.join(" / ")})`);
        for (const v of variantes) assert.ok(!/%|null|undefined/.test(v) && v.includes("10"), `${l} : « ${v} »`);
        // Avec un pourcentage, le plancher ne se dit pas : c'est le pourcentage qui est appliqué.
        assert.equal(MOTIF_T[l].repriseArret("10", "50", enCours, 0, false, "court"), MOTIF_T[l].repriseArret("10", "50", enCours, 0, false), `${l} : le plancher est dit à côté d'un pourcentage`);
      }
      // Reprise d'intensité finie : seul le plafond se dit.
      const seul = MOTIF_T[l].repriseLongArret("90", false, null, "70");
      assert.match(seul, /70\s?%/); assert.match(seul, cle);
      assert.ok(!/null|undefined/.test(seul) && seul.includes("90"), `${l} : « ${seul} »`);
      assert.ok(seul.length < MOTIF_T[l].repriseLongArret("90", false, 1, "70").length, `${l} : la borne d'intensité est encore dite après la quatrième semaine`);
    }
    const ctxSrc = codeNu("src/lib/ai/coachContext.ts");
    // Le plafond entre dans un `Math.min` aux trois endroits où un volume se décide : doses de qualité, feuille de route, cible.
    assert.match(ctxSrc, /const weeklyRef = Math\.min\(targetFrom\(15\), plafondArretKm\(0\), plafondLongArretKm\(0\)\);/);
    assert.match(ctxSrc, /\* partCourseB\(i\),\s*plafondArretKm\(7 \* i\), plafondLongArretKm\(7 \* i\)\)\);/);
    assert.match(ctxSrc, /partVolumeRecup \* partCourseB\(0\), plafondArretKm\(0\), plafondLongArretKm\(0\)\)\);/);
    // Le volume d'avant l'arrêt se lit sur la réunion des deux sources, ancré avant l'arrêt.
    assert.match(ctxSrc, /const avant = sortiesPourArret\(histRuns, runs\)\.filter\(\(w\) => String\(w\.date \?\? ""\)\.slice\(0, 10\) <= dernierJour\);/);
    // Et la profondeur de l'historique long est une constante nommée, lue par la requête.
    assert.match(ctxSrc, /const HISTORIQUE_LONG_JOURS = 190;/);
    assert.match(ctxSrc, /select\("date, sport, distance_km"\)\.eq\("user_id", userId\)\s*\.gte\("date", new Date\(now - HISTORIQUE_LONG_JOURS \* 86400000\)/);
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
