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
import { repriseApresArret, partApresArret, qualitePendantReprise, sortieHabituelleKm, sortieLongueTient, distancesAvantArret, arretLong, arretHorsEchelle, premierJourDeQualite, joursCourusPourArret, sortiesPourArret, ARRET_LONG_JOURS } from "../src/lib/coach/repriseArret";
import { computeQualityBudget } from "../src/lib/coach/qualityBudget";
import { MOTIF_T } from "../src/lib/coach/reasonsI18n";
import { varianteFooting, lignesRetireesParDouleur, lignesRetireesParReprise } from "../src/lib/coach/footings";
import { semainesAffutage, partAffutage, phaseDeSemaine, allegementDuBloc } from "../src/lib/coach/phase";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

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
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /const doseReduite = semaineAllegeeDuBloc \|\| repriseCetteSemaine \|\| qualiteReprise != null;/, "la dose des qualités a quitté la règle de la semaine allégée");
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
    assert.match(ctxSrc, /MOTIF_T\[l\]\.repriseArret\([^;]*repriseArret\.enCours, qualiteReprise\?\.max \?\? 1, arretLong\(repriseArret\)\)\)/);
    // La séance de reprise, déjà écrite courte, n'est pas en plus « sauvée par le plancher ».
    assert.match(ctxSrc, /floored: qb\.floored && qualiteReprise == null,/);
    // La sortie habituelle se lit AVANT l'arrêt : les footings de la reprise ne la font pas baisser.
    assert.match(ctxSrc, /const habituelleKm = repriseIntensite \? sortieHabituelleKm\(distancesAvantArret\(sortiesPourArret\(histRuns, runs\), repriseIntensite, todayStr\)\) : null;/);
    // Au-delà de 28 jours : la même reprise d'intensité borne le budget, la sortie longue et le double seuil.
    assert.match(ctxSrc, /const repriseIntensite = repriseArret \?\? arretHorsEchelle\(joursArret, todayStr\);\s*const qualiteReprise = qualitePendantReprise\(repriseIntensite\);/);
    assert.match(ctxSrc, /const longRunPlanned = recup \|\| repriseIntensite \? Math\.min\(longRunPrevu, Math\.round\(targetKm \* 0\.3\)\) : longRunPrevu;/, "après plus de 28 jours d'arrêt, la sortie longue dépasse de nouveau la semaine visée");
    assert.match(ctxSrc, /&& !repriseIntensite && !marcheCourse;/, "le double seuil revient pendant une reprise de plus de 28 jours");
    // Et son motif existe dans les cinq langues, distinct selon l'état.
    for (const l of Object.keys(MOTIF_T) as (keyof typeof MOTIF_T)[]) {
      const textes = [MOTIF_T[l].repriseLongArret("35", true, 0), MOTIF_T[l].repriseLongArret("34", false, 0), MOTIF_T[l].repriseLongArret("34", false, 1)];
      assert.equal(new Set(textes).size, 3, `${l} : deux états d'une longue reprise ont le même texte`);
      assert.ok(textes.every((t) => !/%/.test(t)), `${l} : un pourcentage de volume est annoncé au-delà de 28 jours, où la règle de Daniels ne s'applique plus`);
    }
    assert.match(MOTIF_T.fr.repriseLongArret("35", true, 0), /sans séance dure pendant les deux premières semaines de reprise/);
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
    assert.match(plan, /const canSpice = [^;]*&& !ctx\.weekPlan\.repriseArret;/, "la sortie longue peut de nouveau porter un bloc d'allure pendant une reprise");
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
    assert.match(ctxSrc, /\.\.\.\(qualiteReprise \? \{ repriseArret: qualiteReprise\.max === 0 \? "sans-qualite" as const : "une-qualite" as const \} : \{\}\),/);
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
    // 8ᵉ jour de reprise : la première séance dure est permise au 14ᵉ, soit le jour 6 du plan ; une seule, au seuil.
    const tard = await contexte({ seances: cas(8).seances });
    assert.deepEqual({ reprise: tard.weekPlan.repriseArret, des: tard.weekPlan.qualiteDes }, { reprise: "une-qualite", des: 6 });
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
    // 16 km sur quatre semaines = 4 km par semaine, dont la moitié : 2 km.
    assert.equal(jumeau.volume.targetKm, 2, "l'habitude d'un coureur irrégulier n'est plus la moyenne des quatre dernières semaines (16 km / 4, dont la moitié)");
    assert.match(dit(jumeau).join(" | "), /on repart à 50 % de ton volume habituel/, "précondition : le jumeau irrégulier n'annonce pas 50 %");
    assert.equal(irregulier.weekPlan.repriseArret, "sans-qualite", "l'arrêt du coureur irrégulier masqué par le vélo n'est pas vu");
    assert.equal(irregulier.volume.targetKm, jumeau.volume.targetKm, "coureur irrégulier : le vélo change le volume visé de la reprise");
    assert.deepEqual(dit(irregulier), dit(jumeau), "coureur irrégulier : le vélo change ce que dit le motif");
    // Une seconde valeur absolue, qui tombe sur un demi-kilomètre : 20 km en 28 jours = 5 km par semaine, dont
    // la moitié 2,5 km, ARRONDIE à 3 (un diviseur de 5, ou un arrondi par défaut, donneraient 2).
    const peu20 = [sortie(30, 8), sortie(25, 10), sortie(21, 10)];
    assert.equal((await contexte({ seances: peu20 })).volume.targetKm, 3, "20 km en quatre semaines ne donnent plus 3 km visés à 50 % (5 km par semaine, moitié arrondie)");
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
      assert.match(dit(ctx), /ton volume habituel n'étant pas encore connu/, `${nom} : le motif ne dit pas que l'habitude est inconnue (${dit(ctx)})`);
      assert.doesNotMatch(ctx.readiness.reasons.join(" | "), /% de ton volume habituel/, `${nom} : un pourcentage du volume habituel est annoncé au-dessus d'un plan qui ne le vise pas`);
      assert.deepEqual(dures(ctx), [], `${nom} : la garde d'intensité est tombée avec le plafond`);
    }
    // LA FEUILLE DE ROUTE AUSSI : avec un objectif à dix semaines, aucune semaine suivante n'est ramenée à 0 km.
    const avecObjectif = await contexte({ seances: sansGps(10, 80), notifications: [objectif({ race: "Semi test", raceDate: ilYa(-70), distanceKm: 21.1, targetTime: "1h45'00", targetSeconds: 6300, targetPace: "4'59/km" })] });
    assert.equal(avecObjectif.weekPlan.repriseArret, "sans-qualite", "précondition : avec un objectif, l'arrêt n'est plus vu");
    assert.ok(avecObjectif.macroPlan.length >= 4, `précondition : la feuille de route n'a que ${avecObjectif.macroPlan.length} semaine(s)`);
    assert.ok(avecObjectif.macroPlan.every((w) => w.volumeKm > 0), `habitude inconnue : une semaine de la feuille de route vise 0 km (${avecObjectif.macroPlan.map((w) => w.volumeKm).join(", ")})`);
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
    assert.match(ctxSrc, /habitudeArretInconnue \? null : nRaw\(Math\.round\(repriseArret\.part \* 100\), l\)/);
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

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
