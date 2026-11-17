/**
 * LA VMA DES ÉCRANS ET LES CIBLES DE FC DE LA MONTRE SE COMPTENT AU JOUR DU COUREUR (17/11/2026).
 *
 * Le coach compte ses fenêtres depuis la fin du jour du coureur (`finDuJourCoureur`). Les fonctions
 * partagées des écrans et des routes (VMA « séances » sur 120 jours, FC max et cibles de FC sur 183
 * jours) comptaient, elles, depuis l'heure du serveur (UTC sur Vercel). Entre minuit et 1 h (2 h l'été)
 * à Paris, la nuit où le meilleur effort sortait de la fenêtre, l'écran affichait 17 km/h pendant que
 * le plan était calé sur 15,2 (@HeadCoach), et les cibles de FC envoyées à la montre pouvaient
 * reprendre un pic sorti de la fenêtre.
 *
 * Règle : par défaut, ces fonctions prennent la référence du jour du coureur (`repereDuJourCoureur`).
 * Même valeur à 0 h 30, 1 h 30, 9 h et 16 h, serveur en UTC, l'hiver et l'été.
 *
 *   npx tsx tests/vma-ecrans-jour-coureur.test.ts
 */
process.env.TZ = "UTC";   // le fuseau des fonctions Vercel — AVANT toute date
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { repereDuJourCoureur, finDuJourCoureur } from "../src/lib/time/fuseau";
import { effortDesSeances } from "../src/lib/dashboard/vmaAffichee";
import { lireSeancesVma } from "../src/lib/dashboard/seancesVma";
import { fcMaxDeLAthlete } from "../src/lib/coach/fcMaxServeur";
import { ciblesFcPour } from "../src/lib/coach/ciblesFcServeur";
import { getEffectiveVma, buildAthleteContext } from "../src/lib/ai/coachContext";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const code = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

type Ligne = Record<string, unknown>;
/** Faux client PostgREST (lectures) ; `bornes` garde chaque `gte("date", …)` lu sur `workouts`. */
function fauxClient(tables: Record<string, Ligne[]>, bornes: string[] = []) {
  const requete = (nomTable: string, toutes: Ligne[]) => {
    let lignes = [...toutes]; let tri: [string, boolean] | null = null; let lim: number | null = null;
    const q: Record<string, unknown> = {};
    const cmp = (op: (a: string, b: string) => boolean) => (c: string, v: unknown) => {
      if (nomTable === "workouts" && c === "date" && op("b", "a")) bornes.push(String(v));
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
      if (tri) { const [c, asc] = tri; r = [...r].sort((a, b) => (Number(a[c]) - Number(b[c]) || (String(a[c] ?? "") < String(b[c] ?? "") ? -1 : String(a[c] ?? "") > String(b[c] ?? "") ? 1 : 0)) * (asc ? 1 : -1)); }
      return lim != null ? r.slice(0, lim) : r;
    };
    q.single = () => { const r = fin(); return Promise.resolve({ data: r[0] ?? null, error: r[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: fin()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: fin(), error: null }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(t, tables[t] ?? []) } as never;
}

/** Exécute `fn` à l'instant `iso` exact. */
async function aLInstant<T>(iso: string, fn: () => Promise<T> | T): Promise<T> {
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
const aParis = (jour: string, h: number, m = 0) => {
  const cible = `${jour} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const t = [1, 2].map((dec) => new Date(Date.parse(`${jour}T00:00:00Z`) + ((h - dec) * 60 + m) * 60000)).find((d) => PARIS.format(d) === cible);
  if (!t) throw new Error(`aucun instant UTC pour ${cible} à Paris`);
  return t.toISOString();
};
/** Les heures rejouées, l'hiver et l'été (1 h 30 l'été est encore la veille en UTC). */
const JOURS: [string, [number, number][]][] = [["2026-11-18", [[0, 30], [9, 0], [16, 0], [23, 30]]], ["2026-07-15", [[0, 30], [1, 30], [9, 0], [16, 0]]]];

const facile = (J: string, n: number) => ({ user_id: "u", date: jourMoins(J, n), type: "easy", sport: "run", distance_km: 8, duration_seconds: 2640, avg_hr: 140, max_hr: 152 });
/** Un 10 km couru à fond (≈ 17 km/h) à J-`age`, au milieu de footings qui ne comptent pas pour la VMA. */
const seancesAvecEffort = (J: string, age: number) => [
  ...Array.from({ length: 60 }, (_, k) => k + 1).filter((n) => n % 7 !== 3 && n !== age).map((n) => facile(J, n)),
  { user_id: "u", date: jourMoins(J, age), type: "race", sport: "run", distance_km: 10, duration_seconds: 2100, avg_hr: 176, max_hr: 186 },
];
/** Sans FC max déclarée : le pic des 183 jours fait la FC max (195 à J-183 ; 200 à J-184, hors fenêtre). */
const tablesFc = (J: string) => ({
  profiles: [{ id: "u", max_hr: null, resting_hr: 50, garmin_metrics: null, last_lat: null, last_lon: null }],
  performance_baselines: [],
  workouts: [...seancesAvecEffort(J, 30),
    { user_id: "u", date: jourMoins(J, 183), type: "tempo", sport: "run", distance_km: 10, duration_seconds: 2400, avg_hr: 178, max_hr: 195 },
    { user_id: "u", date: jourMoins(J, 184), type: "tempo", sport: "run", distance_km: 10, duration_seconds: 2400, avg_hr: 180, max_hr: 200 }],
});

async function main() {
  console.log("\nLA VMA DES ÉCRANS ET LES CIBLES DE FC — serveur en UTC, même jour du coureur à toute heure");

  await test("repereDuJourCoureur : la fin du jour du coureur, quelle que soit l'heure", async () => {
    for (const [J, heures] of JOURS) for (const [h, m] of heures) {
      const r = await aLInstant(aParis(J, h, m), () => repereDuJourCoureur());
      assert.equal(r, finDuJourCoureur(J), `${J} à ${h} h ${m} : ${new Date(r).toISOString()}`);
    }
  });

  await test("VMA « séances » des écrans (sans instant passé) : J-119 compte, J-120 non, à toute heure", async () => {
    for (const [J, heures] of JOURS) {
      const ref = await aLInstant(aParis(J, 9), () => [119, 120].map((a) => effortDesSeances(seancesAvecEffort(J, a) as never, 188)?.vma ?? null));
      assert.ok(ref[0] != null && ref[1] == null, `${J} : précondition, à 9 h l'effort de J-119 donne une VMA (${ref[0]}) et celui de J-120 aucune (${ref[1]})`);
      for (const [h, m] of heures) for (const age of [119, 120, 121]) {
        const v = await aLInstant(aParis(J, h, m), () => effortDesSeances(seancesAvecEffort(J, age) as never, 188)?.vma ?? null);
        assert.equal(v, age === 119 ? ref[0] : null, `${J}, effort à J-${age}, ${h} h ${m} : VMA ${v}`);
      }
    }
  });

  await test("lecture des séances de la VMA (sans instant passé) : bornée au même jour à toute heure", async () => {
    for (const [J, heures] of JOURS) for (const [h, m] of heures) {
      const bornes: string[] = [];
      await aLInstant(aParis(J, h, m), () => lireSeancesVma(fauxClient({ workouts: [] }, bornes) as never, "u"));
      assert.deepEqual(bornes, [jourMoins(J, 121)], `${J} à ${h} h ${m} : lue depuis ${bornes.join(", ")}`);
    }
  });

  await test("VMA effective (allures des envois admin à la montre, chrono d'une course A) : la même à toute heure", async () => {
    for (const [J, heures] of JOURS) {
      const tables = (age: number) => ({ profiles: [{ id: "u", max_hr: 188, garmin_metrics: null, pace_curve: null, garmin_vo2max: null }],
        performance_baselines: [], workouts: seancesAvecEffort(J, age) });
      const dedans = await aLInstant(aParis(J, 9), () => getEffectiveVma(fauxClient(tables(119)) as never, "u"));
      const dehors = await aLInstant(aParis(J, 9), () => getEffectiveVma(fauxClient(tables(120)) as never, "u"));
      assert.ok(dedans != null && dedans !== dehors, `${J} : précondition, l'effort de J-119 doit compter (${dedans}) et pas celui de J-120 (${dehors})`);
      for (const [h, m] of heures) {
        assert.equal(await aLInstant(aParis(J, h, m), () => getEffectiveVma(fauxClient(tables(120)) as never, "u")), dehors, `${J} à ${h} h ${m} : effort de J-120 compté`);
        assert.equal(await aLInstant(aParis(J, h, m), () => getEffectiveVma(fauxClient(tables(119)) as never, "u")), dedans, `${J} à ${h} h ${m} : effort de J-119 perdu`);
      }
    }
  });

  await test("FC max commune et cibles de FC de la montre (sans instant passé) : le pic de J-183, jamais celui de J-184", async () => {
    for (const [J, heures] of JOURS) {
      const ciblesRef = await aLInstant(aParis(J, 9), () => ciblesFcPour(fauxClient(tablesFc(J)) as never, "u"));
      assert.ok(ciblesRef != null, `${J} : précondition, des cibles de FC à 9 h`);
      for (const [h, m] of heures) {
        const fc = await aLInstant(aParis(J, h, m), () => fcMaxDeLAthlete(fauxClient(tablesFc(J)) as never, "u"));
        assert.equal(fc, 195, `${J} à ${h} h ${m} : FC max ${fc} (attendu 195, le pic de J-183)`);
        const cibles = await aLInstant(aParis(J, h, m), () => ciblesFcPour(fauxClient(tablesFc(J)) as never, "u"));
        assert.deepEqual(cibles, ciblesRef, `${J} à ${h} h ${m} : cibles de FC différentes de celles de 9 h`);
      }
    }
  });

  await test("cibles de FC des envois admin à la montre = celles du coach, footing au bord de la fenêtre de 60 jours", async () => {
    // Le coach retenait J-59 à J, la montre J-60 à J : un 8e footing pile à J-60 donnait 120-130 bpm à
    // la montre et 136-146 au plan (@HeadCoach, 17/11/2026). Une seule fenêtre : `premierJourFootingsFc`.
    const footing = (J: string, n: number) => ({ user_id: "u", date: jourMoins(J, n), type: "easy", sport: "run", distance_km: 8, duration_seconds: 2700, avg_hr: 124, max_hr: 140 });
    const tables = (J: string, huitieme: number) => ({
      profiles: [{ id: "u", preferred_language: "fr", full_name: "Test", age: 30, gender: "male", weight_kg: 68, max_hr: 188, resting_hr: 50,
        days_per_week: 4, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true, garmin_metrics: null, last_lat: null, last_lon: null }],
      performance_baselines: [], notifications: [],
      workouts: [...[3, 10, 17, 24, 31, 38, 45].map((n) => footing(J, n)), footing(J, huitieme)],
    });
    for (const [J, heures] of JOURS) {
      const avec = await aLInstant(aParis(J, 9), () => ciblesFcPour(fauxClient(tables(J, 59)) as never, "u"));
      const sans = await aLInstant(aParis(J, 9), () => ciblesFcPour(fauxClient(tables(J, 61)) as never, "u"));
      assert.notDeepEqual(avec, sans, `${J} : précondition, le 8e footing doit changer les cibles (${JSON.stringify(avec)})`);
      // La borne elle-même : 60 jours AUJOURD'HUI COMPRIS, donc J-59 dedans et J-60 dehors.
      const bord = await aLInstant(aParis(J, 9), () => ciblesFcPour(fauxClient(tables(J, 60)) as never, "u"));
      assert.deepEqual(bord, sans, `${J} : un footing à J-60 compte encore dans les cibles (fenêtre de 61 jours)`);
      for (const huitieme of [59, 60, 61]) for (const [h, m] of heures) {
        const [montre, coach] = await aLInstant(aParis(J, h, m), async () => [
          await ciblesFcPour(fauxClient(tables(J, huitieme)) as never, "u"),
          (await buildAthleteContext(fauxClient(tables(J, huitieme)), "u")).ciblesFc,
        ]);
        assert.deepEqual(montre, coach, `${J}, 8e footing à J-${huitieme}, ${h} h ${m} : montre ${JSON.stringify(montre)}, coach ${JSON.stringify(coach)}`);
      }
    }
  });

  await test("plus aucune fenêtre de VMA ou de FC à l'heure du serveur dans les fonctions partagées et les écrans", () => {
    for (const f of ["src/lib/dashboard/seancesVma.ts", "src/lib/dashboard/vmaAffichee.ts", "src/lib/coach/ciblesFcServeur.ts", "src/lib/coach/fcMaxServeur.ts", "src/lib/running/fitness.ts"])
      assert.doesNotMatch(code(f), /maintenant = Date\.now\(\)|Date\.now\(\) - PIC_FC_JOURS/, `${f} compte encore depuis l'heure du serveur`);
    for (const f of ["src/app/dashboard/ghost-runner/page.tsx", "src/app/api/ai/analyse-seance/route.ts"])
      assert.match(code(f), /new Date\(repereDuJourCoureur\(\) - PIC_FC_JOURS \* 86400000\)/, `${f} : le pic de FC n'est plus borné au jour du coureur`);
    assert.doesNotMatch(code("src/lib/coach/fcMaxServeur.ts"), /Date\.now\(\)/, "fcMaxDeLAthlete lit l'heure du serveur dans son corps");
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
