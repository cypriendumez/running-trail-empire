/**
 * LE DOUBLE SEUIL, ENFIN POSÉ (Cyprien, 05/11/2026 : « pour l'élite : le double seuil,
 * méthode norvégienne »).
 *
 * Avant : l'éligibilité se calculait et s'affichait dans le profil, le texte des séances
 * existait — et le plan n'en produisait aucune. Le texte du matin disait en plus « à ton
 * allure seuil MOINS 5 à 8 s/km », c'est-à-dire plus vite que le seuil, à l'inverse du
 * principe. Ces tests gardent la méthode : option explicite, deux journées matin + soir
 * toutes deux sous le seuil, dose selon le volume, montre lisible, suspendue quand la
 * fraîcheur ou la récupération l'exigent, et le reste de la semaine facile.
 *
 *   npx tsx tests/double-seuil.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { etatDouble, seanceDoubleSeuil, doseDoubleSeuil, ECART_MATIN_SEC, ECART_SOIR_SEC } from "../src/lib/coach/doubleSessions";
import { parseReps, parsePaceSec } from "../src/lib/watch/intervals";
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
/** Faux client PostgREST en mémoire : eq, gte, lte, in, order, limit, single, maybeSingle. */
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

const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
const ilYa = (n: number) => {
  const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
};
// ⚠️ PAS DE `last_lat` : aucune requête météo.
const ELITE = {
  id: "u", preferred_language: "fr", full_name: "Élite", age: 28, gender: "male", weight_kg: 64, days_per_week: 7,
  available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true,
  running_years: 6, double_sessions: true, double_seuil: true,
};
/** ~105 km par semaine depuis dix semaines : six sorties, dont une longue. */
const VOLUME = Array.from({ length: 70 }, (_, k) => k + 1).filter((k) => k % 7 !== 3).map((k) => ({
  user_id: "u", date: ilYa(k), type: "easy", sport: "run", distance_km: k % 7 === 0 ? 24 : 16,
  duration_seconds: (k % 7 === 0 ? 24 : 16) * 270, avg_hr: 142, max_hr: 160, tss: 80, hr_zone_seconds: [900, 3300, 120, 0, 0],
}));
const BASE = [{ user_id: "u", vma_kmh: 21, max_hr: 195, resting_hr: 42, tested_at: ilYa(20) }];
async function contexte(profil: Ligne, opts: { seances?: Ligne[]; notifications?: Ligne[] } = {}): Promise<AthleteContext> {
  return buildAthleteContext(fauxClient({
    profiles: [profil], performance_baselines: BASE, workouts: opts.seances ?? VOLUME, notifications: opts.notifications ?? [],
  }), "u");
}
const sec = (p: string) => { const m = p.match(/(\d+)'(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };

async function main() {
  console.log("\nLA RÈGLE — une option explicite, des séances sous le seuil, une dose selon le volume");

  await test("éligible ET coché : actif ; éligible sans l'option, ou coché sans le volume : non", () => {
    const base = { optIn: true, weeklyKm: 105, runYears: 6, readiness: "vert" as const, pains: [], taper: false };
    assert.equal(etatDouble({ ...base, optInSeuil: true }).seuilActif, true);
    assert.equal(etatDouble({ ...base, optInSeuil: false }).seuilActif, false, "le double seuil s'impose sans qu'on l'ait demandé");
    assert.equal(etatDouble({ ...base, weeklyKm: 70, optInSeuil: true }).seuilActif, false, "70 km suffisent au double seuil");
  });

  await test("le matin et le soir restent SOUS le seuil, le matin plus lent que le soir", () => {
    const matin = seanceDoubleSeuil("matin", "3'40", "fr", 5), soir = seanceDoubleSeuil("soir", "3'40", "fr", 7);
    assert.equal(sec(matin), sec("3'40") + ECART_MATIN_SEC, `allure du matin : ${matin}`);
    assert.equal(sec(soir), sec("3'40") + ECART_SOIR_SEC, `allure du soir : ${soir}`);
    assert.ok(ECART_MATIN_SEC > ECART_SOIR_SEC && ECART_SOIR_SEC > 0, "un matin plus rapide que le soir, ou un soir au-dessus du seuil");
    assert.doesNotMatch(matin, /MOINS 5/, "le matin redevient plus rapide que le seuil");
  });

  await test("la dose suit le volume, dans des bornes", () => {
    assert.deepEqual(doseDoubleSeuil(90), { matin: 4, soir: 5 });
    assert.deepEqual(doseDoubleSeuil(120), { matin: 5, soir: 7 });
    assert.deepEqual(doseDoubleSeuil(400), { matin: 6, soir: 10 }, "le plafond saute");
    assert.deepEqual(doseDoubleSeuil(0), { matin: 3, soir: 4 }, "le plancher saute");
  });

  await test("la montre lit les deux séances : répétitions, durée ou distance, allure, récupération", () => {
    const matin = parseReps(seanceDoubleSeuil("matin", "3'40", "fr", 5), parsePaceSec(seanceDoubleSeuil("matin", "3'40", "fr", 5)));
    assert.deepEqual([matin?.reps, matin?.workSec, matin?.recSec, matin?.paceSec], [5, 360, 60, sec("3'50")]);
    const soirTxt = seanceDoubleSeuil("soir", "3'40", "fr", 7);
    const soir = parseReps(soirTxt, parsePaceSec(soirTxt));
    assert.deepEqual([soir?.reps, soir?.recSec, soir?.paceSec], [7, 60, sec("3'43")]);
    assert.equal(soir?.workSec, sec("3'43"), "1000 m à 3'43/km ne durent pas 3 min 43");
  });

  console.log("\nLE PLAN — deux journées matin + soir, le reste facile");

  await test("l'élite qui a coché reçoit deux journées de double seuil, matin ET soir", async () => {
    const ctx = await contexte(ELITE);
    assert.equal(ctx.doubles?.seuilActif, true, "précondition : le double seuil n'est pas actif");
    const plan = buildWeekPlan(ctx, new Date());
    const jours = [...new Set(plan.filter((j) => j.type === "Seuil").map((j) => j.date))];
    assert.equal(jours.length, 2, `${jours.length} journée(s) de seuil : ${plan.map((j) => `${j.date} ${j.moment ?? ""} ${j.type}`).join(" | ")}`);
    for (const d of jours) {
      const matin = plan.find((j) => j.date === d && j.moment === "matin" && j.type === "Seuil");
      const soir = plan.find((j) => j.date === d && j.moment === "soir" && j.type === "Seuil");
      assert.ok(matin && soir, `${d} : il manque le matin ou le soir`);
      assert.equal(matin!.title, "Double seuil · matin");
      assert.equal(soir!.title, "Double seuil · soir");
      assert.match(matin!.detail, /× 6 min à ~/);
      assert.match(soir!.detail, /× 1000 m à ~/);
      assert.match(soir!.why, /lactate/, "l'avertissement sur le lactate a disparu");
      assert.ok(soir!.i18n?.en?.title === "Double threshold · evening", "le soir n'est pas traduit");
    }
    // Deux journées dures ne se suivent pas.
    const ecart = Math.abs(Date.parse(jours[1]) - Date.parse(jours[0])) / 86400000;
    assert.ok(ecart >= 2, `journées de double seuil à ${ecart} jour(s) d'écart`);
    // Le reste de la semaine reste facile : pas de sortie longue progressive ni à allure.
    const longue = plan.find((j) => j.type === "Sortie longue");
    assert.ok(longue, "précondition : aucune sortie longue");
    assert.doesNotMatch(longue!.title, /progressive|allure/i, `sortie longue : ${longue!.title}`);
  });

  await test("le volume compte la séance du matin : la semaine ne déborde pas de sa cible", async () => {
    const ctx = await contexte(ELITE);
    const avec = buildWeekPlan(ctx, new Date());
    const sans = buildWeekPlan(await contexte({ ...ELITE, double_seuil: false }), new Date());
    const kmFaciles = (p: ReturnType<typeof buildWeekPlan>) => p.filter((j) => j.type === "Endurance")
      .reduce((s, j) => s + Number(/~?(\d+(?:[.,]\d+)?)\s*km/.exec(j.detail)?.[1]?.replace(",", ".") ?? 0), 0);
    assert.ok(kmFaciles(avec) < kmFaciles(sans), `footings : ${kmFaciles(avec)} km avec le double seuil, ${kmFaciles(sans)} sans`);
    assert.match(codeNu("src/lib/ai/autoPlan.ts"), /qualityKept\.length \* QUALITY_KM \+ matinsSeuilKm/, "le constat d'écart de volume oublie les matins");
  });

  await test("sans l'option, aucun double seuil, même éligible", async () => {
    const ctx = await contexte({ ...ELITE, double_seuil: false });
    assert.equal(ctx.doubles?.doubleSeuil, true, "précondition : l'athlète est éligible");
    assert.ok(!buildWeekPlan(ctx, new Date()).some((j) => /Double seuil/.test(j.title)), "double seuil posé sans l'option");
  });

  await test("après une course, il se suspend et le bandeau le dit", async () => {
    const lille = { user_id: "u", type: "race_objective", data: { race: "Marathon de Lille", raceDate: ilYa(6), distanceKm: 42.2 } };
    const seances = [...VOLUME.filter((s) => s.date !== ilYa(6)), { ...VOLUME[0], date: ilYa(6), distance_km: 42.5, avg_hr: 168 }];
    const ctx = await contexte(ELITE, { seances, notifications: [lille] });
    assert.ok(ctx.recuperation, "précondition : pas de récupération");
    assert.ok(!ctx.weekPlan.quality.some((q) => q.matin), "double seuil posé pendant la récupération");
    assert.ok(ctx.readiness.reasons.some((r) => /double seuil est suspendu/.test(r)), `rien ne dit la suspension : ${JSON.stringify(ctx.readiness.reasons)}`);
  });

  console.log("\nLE PROFIL — une option à part, écrite à part");

  await test("l'option vit sous « deux séances par jour », s'écrit seule et seulement si elle change", () => {
    const src = codeNu("src/components/profile/ProfileSettings.tsx");
    assert.match(src, /\{form\.double_sessions && \(\s*<div className="mt-3 border-t border-zinc-200 pt-3">\s*<Toggle enabled=\{form\.double_seuil\}/,
      "l'option n'est pas sous les doubles séances");
    assert.match(src, /if \(form\.double_seuil !== \(profile\?\.double_seuil === true\)\) \{/, "l'option s'écrit même sans changement");
    assert.match(codeNu("src/lib/ai/coachContext.ts"), /optInSeuil: \(p as Record<string, unknown> \| null\)\?\.double_seuil === true/,
      "le coach ne lit plus l'option");
    const textes = readFileSync("src/components/profile/ProfileSettings.tsx", "utf8");
    for (const k of ['"double.seuilTitle":', '"double.seuilHint":', '"double.seuilOk":']) assert.equal(textes.split(k).length - 1, 5, `${k} absent de certaines langues`);
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
