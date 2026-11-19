/**
 * LES FENÊTRES DE MESURE DU COACH SE COMPTENT AU JOUR DU COUREUR (16/11/2026).
 *
 * Le contexte du coach mesure le passé en fenêtres « de N jours » : km des 7 à 42 jours, charge
 * CTL/ATL, monotonie, VFC, sommeil, pics de FC, VMA… Comptées depuis l'heure du serveur (UTC sur
 * Vercel), elles gardaient un jour de trop entre minuit et 1 h (2 h l'été) à Paris : le volume visé
 * grimpait de 15 à 26 %, des séances changeaient, un débutant passait en rouge à 0 h 30 et en jaune à
 * 9 h (@HeadCoach et relecture indépendante). Celles ancrées à midi basculaient, elles, à midi UTC.
 *
 * Règle : le même jour du coureur donne le même contexte et le même plan à 0 h 30, à 9 h et à 16 h.
 * Le test la rejoue sur cinq profils à volume IRRÉGULIER (sortie longue, montre portée un jour sur
 * deux, débutant, récupération d'un semi), deux semaines de suite, l'été et aux changements d'heure,
 * serveur en UTC.
 *
 *   npx tsx tests/fenetres-jour-coureur.test.ts
 */
process.env.TZ = "UTC";   // le fuseau des fonctions Vercel — AVANT toute date
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { instantDuJour, finDuJourCoureur, jourCivil } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const code = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

type Ligne = Record<string, unknown>;
/** Faux client PostgREST (lectures seulement) : eq, gte, lte, order, limit, single, maybeSingle. */
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
      if (tri) { const [c, asc] = tri; r = [...r].sort((a, b) => (String(a[c] ?? "") < String(b[c] ?? "") ? -1 : String(a[c] ?? "") > String(b[c] ?? "") ? 1 : 0) * (asc ? 1 : -1)); }
      return lim != null ? r.slice(0, lim) : r;
    };
    q.single = () => { const r = fin(); return Promise.resolve({ data: r[0] ?? null, error: r[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: fin()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: fin(), error: null }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(tables[t] ?? []) } as never;
}

/** Exécute `fn` à l'instant `iso` exact (le coach et le plan lisent `new Date()` et `Date.now()`). */
async function aLInstant<T>(iso: string, fn: () => Promise<T>): Promise<T> {
  const Vrai = Date;
  const delta = Vrai.parse(iso) - Vrai.now();
  class Faux extends Vrai {
    constructor(...a: unknown[]) { if (a.length === 0) super(Vrai.now() + delta); else super(...(a as [number])); }
    static now() { return Vrai.now() + delta; }
  }
  (globalThis as { Date: DateConstructor }).Date = Faux as DateConstructor;
  try { return await fn(); } finally { (globalThis as { Date: DateConstructor }).Date = Vrai; }
}

const jourMoins = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const PARIS = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
/** L'instant UTC où il est `h` h `m` à Paris le jour `jour` (hiver comme été). */
const aParis = (jour: string, h: number, m = 0) => {
  const cible = `${jour} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const t = [1, 2].map((dec) => new Date(Date.parse(`${jour}T00:00:00Z`) + ((h - dec) * 60 + m) * 60000)).find((d) => PARIS.format(d) === cible);
  if (!t) throw new Error(`aucun instant UTC pour ${cible} à Paris`);
  return t.toISOString();
};

// ── Les profils : du volume IRRÉGULIER, que les fenêtres en millisecondes faisaient varier la nuit ──
const nn = (n: number) => Array.from({ length: n }, (_, k) => k + 1);
const sortie = (J: string, n: number, type: string, km: number) => ({ user_id: "u", date: jourMoins(J, n), type, sport: "run",
  distance_km: km, duration_seconds: Math.round(km * 330), elevation_gain_m: 30 + km * 5, avg_hr: type === "easy" ? 140 : 165, max_hr: type === "easy" ? 155 : 182, tss: Math.round(km * (type === "easy" ? 5 : 8)) });
const nuit = (J: string, n: number, courte: boolean) => ({ user_id: "u", date: jourMoins(J, n),
  sleep_score: courte ? 45 : 80, total_sleep_min: courte ? 320 : 465, deep_sleep_min: 80, rem_sleep_min: 90, body_battery_end: 70, respiration_rate: 14 });
const vfc = (J: string, n: number) => ({ user_id: "u", date: jourMoins(J, n), rmssd: 58 + (n % 5), sdnn: null });
const profil = (jours: number, o: Ligne = {}) => ({ id: "u", preferred_language: "fr", full_name: "Test", age: 34, gender: "female", weight_kg: 60, max_hr: 188,
  days_per_week: jours, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true, ...o });
const objectif = (race: string, raceDate: string, distanceKm: number) => ({ user_id: "u", type: "race_objective",
  data: { race, raceDate, distanceKm, targetTime: "", targetSeconds: 0, targetPace: "" } });
const base = (J: string) => [{ user_id: "u", vma_kmh: 15, max_hr: 188, tested_at: jourMoins(J, 50) }];

const PROFILS: Record<string, (J: string) => Record<string, Ligne[]>> = {
  /** 5 jours, sortie longue de 18 km chaque semaine, une séance au seuil, montre portée chaque nuit,
   *  dernière série de qualité relevée il y a 13 jours (citée au coach jusqu'à 12 jours seulement). */
  sortieLongue: (J) => ({ profiles: [profil(5, { last_quality_exec: { date: jourMoins(J, 13), repsSec: [230, 232, 236, 245], avgHr: 172, fadeSec: 15 } })], performance_baselines: base(J),
    workouts: nn(70).filter((n) => n % 7 !== 3 && n % 7 !== 5).map((n) => sortie(J, n, n % 7 === 2 ? "tempo" : "easy", n % 7 === 0 ? 18 : n % 7 === 2 ? 10 : 7)),
    sleep_data: nn(21).map((n) => nuit(J, n, n === 4)), hrv_data: nn(30).map((n) => vfc(J, n)),
    notifications: [objectif("Semi A", jourMoins(J, -40), 21.1)] }),
  /** Montre portée un jour sur deux, sorties de 6 à 14 km. */
  unSurDeux: (J) => ({ profiles: [profil(4)], performance_baselines: base(J),
    workouts: nn(60).filter((n) => n % 7 !== 2 && n % 7 !== 5).map((n) => sortie(J, n, n === 2 ? "tempo" : "easy", n % 7 === 0 ? 14 : 6 + (n % 3))),
    sleep_data: nn(15).map((k) => nuit(J, 2 * k, k === 1)), hrv_data: nn(15).map((k) => vfc(J, 2 * k)),
    notifications: [objectif("10 km A", jourMoins(J, -9), 10)] }),
  /** Débutant : six sorties de 3 km, deux nuits, sans test de VMA ni 30 minutes de course. */
  debutant: (J) => ({ profiles: [profil(3, { peut_courir_30min: false })], performance_baselines: [],
    workouts: nn(6).map((k) => sortie(J, 3 * k - 1, "easy", 3)),
    sleep_data: [nuit(J, 1, false), nuit(J, 2, true)] }),
  /** Semi couru il y a deux jours, en récupération. */
  semi: (J) => ({ profiles: [profil(4)], performance_baselines: base(J),
    workouts: [sortie(J, 2, "race", 21.1), ...nn(60).filter((n) => n > 2 && n % 7 !== 3).map((n) => sortie(J, n, "easy", n % 7 === 0 ? 16 : 9))],
    sleep_data: nn(10).map((n) => nuit(J, n, n === 2)), hrv_data: nn(20).map((n) => vfc(J, n)),
    notifications: [objectif("Semi", jourMoins(J, 2), 21.1)] }),
  /** Montre chaque nuit, séance dure la veille, charge en hausse sur deux semaines. */
  chargeMontante: (J) => ({ profiles: [profil(5)], performance_baselines: base(J),
    workouts: nn(56).filter((n) => n % 7 !== 4).map((n) => sortie(J, n, n === 1 || n % 7 === 1 ? "intervals" : "easy", n <= 14 ? 12 : 6)),
    sleep_data: nn(21).map((n) => nuit(J, n, n === 1 || n === 6)), hrv_data: nn(30).map((n) => vfc(J, n)) }),
};

type Lecture = { ctx: AthleteContext; plan: ReturnType<typeof buildWeekPlan> };
async function lecture(instant: string, J: string, nom: string): Promise<Lecture> {
  return aLInstant(instant, async () => {
    const ctx = await buildAthleteContext(fauxClient(PROFILS[nom](J)), "u");
    return { ctx, plan: buildWeekPlan(ctx, instantDuJour(ctx.jour0 ?? "")) };
  });
}
/** Tout ce que le plan lit du contexte, et tout ce que le coureur voit du plan. */
const signature = ({ ctx, plan }: Lecture) => JSON.stringify({
  jour0: ctx.jour0, forme: ctx.readiness.level, motifs: ctx.readiness.reasons, cycle: ctx.cycle, volume: ctx.volume,
  budget: ctx.weekPlan?.qBudget, vma: ctx.vma, dur: ctx.lastHardDaysAgo, jRace: ctx.daysToRace, rates: ctx.skippedWeekdays,
  qualiteCitee: ctx.text.includes("EXÉCUTION DE SA DERNIÈRE QUALITÉ"),
  seances: plan.map((d) => `${d.date} ${d.type} ${d.title}`),
});

async function main() {
  console.log("\nLES FENÊTRES DE MESURE — serveur en UTC, même jour du coureur à 0 h 30, 9 h et 16 h");

  await test("finDuJourCoureur : le dernier instant qui est encore ce jour en UTC ET à Paris, toute l'année", () => {
    assert.equal(new Date(finDuJourCoureur("2026-11-18")).toISOString(), "2026-11-18T22:59:59.999Z");   // 23:59:59.999 à Paris
    assert.equal(new Date(finDuJourCoureur("2026-06-18")).toISOString(), "2026-06-18T21:59:59.999Z");
    assert.ok(Number.isNaN(finDuJourCoureur("illisible")), "une date illisible ne doit pas donner un instant");
    for (let k = 0; k < 365; k++) {   // 2026 entière, les deux changements d'heure compris
      const J = jourMoins("2026-01-01", -k);
      const t = finDuJourCoureur(J);
      // Le jour UTC compte : les dates stockées sont lues à minuit UTC. Le jour de Paris aussi : le
      // volume en semaines de calendrier relit le jour du coureur depuis l'instant (`jourLocal`).
      assert.equal(new Date(t).toISOString().slice(0, 10), J, `${J} : la référence n'est pas ce jour en UTC`);
      assert.equal(jourCivil(t, "Europe/Paris"), J, `${J} : la référence n'est pas ce jour à Paris (${jourCivil(t, "Europe/Paris")})`);
      assert.notEqual(jourCivil(t + 1, "Europe/Paris"), J, `${J} : ce n'est pas le DERNIER instant du jour à Paris`);
      assert.ok(t > Date.parse(`${J}T12:00:00Z`), `${J} : avant midi UTC, les fenêtres ancrées à midi changeraient de comportement`);
    }
  });

  await test("le contexte compte ses fenêtres depuis la fin du jour du coureur, ses requêtes comprises", () => {
    const c = code("src/lib/ai/coachContext.ts");
    assert.match(c, /const todayStr = aujourdhui\(FUSEAU_DEFAUT\);\s*const now = finDuJourCoureur\(todayStr\);/, "`now` n'est plus la fin du jour du coureur");
    assert.ok(c.indexOf("const now = finDuJourCoureur(todayStr);") < c.indexOf("const [profileRes"), "`now` est déclaré après les requêtes bornées par date");
    assert.doesNotMatch(c, /\.gte\("date", new Date\(Date\.now\(\)/, "une requête bornée par DATE lit encore l'heure du serveur");
    assert.match(c, /const load = computeLoad\(workouts, now\);/, "la charge CTL/ATL n'est pas comptée depuis la référence");
    assert.doesNotMatch(c.slice(c.indexOf("function computeLoad"), c.indexOf("function computeLoad") + 1500), /Date\.now\(\)/, "computeLoad lit encore l'heure du serveur");
    assert.match(c, /lireSeancesVma\(sb, userId, now\)/, "les séances de la VMA du coach sont lues depuis l'heure du serveur");
    // Un HORODATAGE reste à l'instant réel : `now` est jusqu'à 24 h dans le futur.
    assert.match(c, /const at = paceCurve\?\.at \? new Date\(paceCurve\.at\)\.getTime\(\) : Date\.now\(\);/,
      "le point courant de la courbe de VMA est daté de la fin du jour du coureur, et non de l'instant réel");
  });

  await test("capacité démontrée (semaines de calendrier) : comptée depuis le jour du coureur, pas depuis demain", async () => {
    // Semaines de 7 jours finissant AUJOURD'HUI (`jourLocal(now)`) : 40 (10 km à J, 30 à J-6), 35, 30, 25,
    // 5 → médiane des 4 meilleures (35 + 30) / 2 = 33. Comptées depuis demain : 10, 65, 30, 25 → 28.
    const J = "2026-11-18";
    const tables = { profiles: [profil(4)], performance_baselines: base(J),
      workouts: [sortie(J, 0, "easy", 10), sortie(J, 6, "easy", 30), sortie(J, 10, "easy", 35), sortie(J, 17, "easy", 30), sortie(J, 24, "easy", 25), sortie(J, 31, "easy", 5)] };
    for (const [h, m] of [[0, 30], [9, 0], [16, 0], [23, 30]]) {
      const ctx = await aLInstant(aParis(J, h, m), () => buildAthleteContext(fauxClient(tables), "u"));
      const km = ctx.text.match(/CAPACITÉ DÉJÀ DÉMONTRÉE : (\d+) km\/semaine/)?.[1];
      assert.equal(km, "33", `${h} h ${m} : capacité démontrée ${km} km/sem (attendu 33)`);
    }
  });

  await test("une fenêtre de 7 (28) jours retient aujourd'hui et les 6 (27) jours d'avant, à toute heure", async () => {
    // Ce que retenait le calcul de journée, et pas une fenêtre stable mais décalée d'un jour.
    // Le km se compte depuis minuit UTC ; la moyenne de sommeil (`dansLesJours`) depuis MIDI UTC :
    // à l'heure du serveur, elle retenait 8 nuits le matin (73/100) et 7 l'après-midi (80/100).
    const J = "2026-11-18";
    const tables = { profiles: [profil(5)], performance_baselines: base(J),
      workouts: [...[0, 1, 2, 3, 4, 5, 6].map((n) => sortie(J, n, "easy", 5)), sortie(J, 7, "easy", 30), sortie(J, 28, "easy", 40)],
      sleep_data: [...[0, 1, 2, 3, 4, 5, 6].map((n) => nuit(J, n, false)), { ...nuit(J, 7, true), sleep_score: 20 }] };
    for (const [h, m] of [[0, 30], [9, 0], [16, 0], [23, 30]]) {
      const ctx = await aLInstant(aParis(J, h, m), () => buildAthleteContext(fauxClient(tables), "u"));
      assert.equal(ctx.volume.weekKm, 35, `${h} h ${m} : ${ctx.volume.weekKm} km sur 7 jours (attendu 35 : 5 km d'aujourd'hui à J-6, pas les 30 km de J-7)`);
      assert.equal(ctx.volume.avg4wkKm, 16, `${h} h ${m} : ${ctx.volume.avg4wkKm} km/sem sur 28 jours (attendu 16 : 65 km / 4, pas les 40 km de J-28)`);
      const sommeil = ctx.text.match(/moyenne 7j (\S+)\/100/)?.[1];
      assert.equal(sommeil, "80", `${h} h ${m} : sommeil moyen sur 7 jours ${sommeil}/100 (attendu 80, sans la nuit à 20 de J-7)`);
    }
  });

  await test("VMA « séances » (fenêtre de 120 jours) : un effort à J-119 compte, à J-120 non, à toute heure", async () => {
    // La fenêtre est appliquée DANS `meilleurEffort` : une ancre sur l'appel ne la prouvait pas
    // (@HeadCoach, 16/11/2026 : 17 km/h à 0 h 30, 15,2 à 9 h, avec un 10 km à J-120).
    const vmaAvec = async (J: string, age: number, h: number, m: number) => {
      const tables = { profiles: [profil(5)], performance_baselines: [],
        workouts: [...nn(60).filter((n) => n % 7 !== 3).map((n) => sortie(J, n, "easy", 8)),
          { ...sortie(J, age, "race", 10), duration_seconds: 2100, avg_hr: 176, max_hr: 186 }] };
      const ctx = await aLInstant(aParis(J, h, m), () => buildAthleteContext(fauxClient(tables), "u"));
      return ctx.vma;
    };
    for (const [J, heures] of [["2026-11-18", [[0, 30], [9, 0], [16, 0]]], ["2026-07-15", [[0, 30], [1, 30], [9, 0], [16, 0]]]] as const) {
      const dedans = await vmaAvec(J, 119, 9, 0), dehors = await vmaAvec(J, 120, 9, 0);
      assert.ok(dedans != null && dehors != null && dedans > dehors, `${J} : précondition, à 9 h l'effort de J-119 doit compter (${dedans}) et pas celui de J-120 (${dehors})`);
      for (const age of [119, 120, 121]) {
        const ref = await vmaAvec(J, age, 9, 0);
        for (const [h, m] of heures) {
          const v = await vmaAvec(J, age, h, m);
          assert.equal(v, ref, `${J}, effort à J-${age} : VMA ${v} à ${h} h ${m}, ${ref} à 9 h`);
        }
      }
    }
  });

  await test("acclimatation à la chaleur (météo passée des 21 jours) : la veille comptée à toute heure", async () => {
    // L'archive Open-Meteo se lit de J-21 à la VEILLE. Bornée à l'heure du serveur, elle s'arrêtait la
    // nuit à l'avant-veille : la sortie de la veille sous la chaleur ne comptait pas (relecture du 17/11).
    const J = "2026-07-15";
    const vraiFetch = globalThis.fetch;
    const archives: string[] = [];
    globalThis.fetch = (async (adresse: unknown) => {
      const u = new URL(String(adresse));
      if (u.hostname.startsWith("archive-api")) {
        const debut = u.searchParams.get("start_date") ?? "", fin = u.searchParams.get("end_date") ?? "";
        archives.push(`${debut}…${fin}`);
        const time: string[] = [];
        for (let d = debut; d && d <= fin; d = jourMoins(d, -1)) time.push(d);
        return { ok: true, json: async () => ({ daily: { time, temperature_2m_max: time.map(() => 30) } }) } as unknown as Response;
      }
      return { ok: false, json: async () => ({}) } as unknown as Response;   // prévisions : aucune
    }) as typeof fetch;
    try {
      const tables = { profiles: [profil(5, { last_lat: 48.85, last_lon: 2.35 })], performance_baselines: base(J),
        workouts: nn(30).filter((n) => n % 7 !== 3).map((n) => sortie(J, n, "easy", 8)) };
      const attendu = nn(20).filter((n) => n % 7 !== 3).length;   // sorties de J-1 à J-20, toutes à 30 °C
      for (const [h, m] of [[0, 30], [1, 30], [9, 0], [16, 0]]) {
        const ctx = await aLInstant(aParis(J, h, m), () => buildAthleteContext(fauxClient(tables), "u"));
        assert.equal(ctx.heatAcclim.hotDays, attendu, `${h} h ${m} : ${ctx.heatAcclim.hotDays} jours chauds courus (attendu ${attendu}, de J-1 à J-20)`);
      }
      assert.ok(archives.length >= 4 && archives.every((a) => a === `${jourMoins(J, 21)}…${jourMoins(J, 1)}`),
        `précondition : l'archive doit être lue de J-21 à la veille à chaque fois (${archives.join(", ")})`);
    } finally { globalThis.fetch = vraiFetch; }
  });

  await test("pic de FC des 183 derniers jours (requête bornée par date) : le même à toute heure", async () => {
    // Sans FC max déclarée, le coach retient le plus haut battement des 183 derniers jours, lu par une
    // requête dédiée. Bornée à l'heure du serveur, elle remontait d'un jour la nuit.
    const J = "2026-11-18";
    const pic = (n: number, max: number) => ({ ...sortie(J, n, "tempo", 10), max_hr: max });
    const tables = { profiles: [profil(5, { max_hr: null })], performance_baselines: [],
      workouts: [...nn(40).filter((n) => n % 7 !== 3).map((n) => sortie(J, n, "easy", 8)), pic(183, 190), pic(184, 200)] };
    for (const [h, m] of [[0, 30], [9, 0], [16, 0]]) {
      const ctx = await aLInstant(aParis(J, h, m), () => buildAthleteContext(fauxClient(tables), "u"));
      const fc = ctx.text.match(/FC max ~(\d+) \(obs\.\)/)?.[1];
      assert.equal(fc, "190", `${h} h ${m} : FC max ~${fc} (attendu 190, le pic de J-183 ; celui de J-184 est hors fenêtre)`);
    }
  });

  await test("même jour du coureur : même contexte et même plan à 0 h 30, 9 h et 16 h (5 profils, 19 jours)", async () => {
    const jours = [
      ...Array.from({ length: 14 }, (_, k) => jourMoins("2026-11-16", -k)),   // deux semaines, un lundi en tête
      "2026-03-29", "2026-10-25",                                              // nuits des changements d'heure
      ...Array.from({ length: 3 }, (_, k) => jourMoins("2026-06-15", -k)),    // l'été (UTC+2)
    ];
    const ecarts: string[] = [];
    let cas = 0;
    for (const nom of Object.keys(PROFILS)) {
      for (const J of jours) {
        const [nuitL, matin, apresMidi] = [await lecture(aParis(J, 0, 30), J, nom), await lecture(aParis(J, 9), J, nom), await lecture(aParis(J, 16), J, nom)];
        cas++;
        const ref = signature(matin);
        for (const [heure, l] of [["0 h 30", nuitL], ["16 h", apresMidi]] as const) {
          if (signature(l) !== ref) ecarts.push(`${nom} ${J} à ${heure} :\n        ${signature(l).slice(0, 400)}\n      à 9 h :\n        ${ref.slice(0, 400)}`);
        }
      }
    }
    assert.equal(ecarts.length, 0, `${ecarts.length} écart(s) sur ${cas * 2} :\n      ${ecarts.slice(0, 2).join("\n      ")}`);
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
