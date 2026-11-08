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
import { repriseApresArret, partApresArret } from "../src/lib/coach/repriseArret";
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
    const r = repriseApresArret([ilYa(11), ilYa(12), ilYa(14)], AUJOURDHUI);
    assert.deepEqual(r, { arretJours: 11, enCours: true, joursRepris: 0, part: 0.5 });
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
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /const doseReduite = semaineAllegeeDuBloc \|\| repriseCetteSemaine;/, "la dose des qualités a quitté la règle de la semaine allégée");
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

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
