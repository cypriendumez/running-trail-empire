/**
 * AUCUNE FRÉQUENCE CARDIAQUE INVENTÉE (05/11/2026).
 *
 * Deux valeurs « neutres » se faisaient passer pour des mesures :
 *   · le test VMA (`/api/vma`) écrivait FC max 190 et FC de repos 50 quand l'athlète ne les
 *     saisissait pas. Le coach retenant la plus haute entre FC max déclarée et observée, un
 *     coureur à 175 recevait des zones calées sur 190 : des footings trop rapides ;
 *   · le coach jugeait la discipline des footings avec une FC de repos de 55 (`restHr ?? 55`)
 *     quand il n'en connaissait aucune.
 * Règle du projet : quand la donnée manque, on le dit, on ne la fabrique pas.
 *
 *   npx tsx tests/fc-non-inventees.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext } from "../src/lib/ai/coachContext";
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
/** Faux client PostgREST en mémoire (lecture seule). */
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
const PROFIL = { id: "u", preferred_language: "fr", full_name: "Test", age: 30, gender: "male", weight_kg: 66, days_per_week: 5,
  available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true, running_years: 6 };
const SEANCES = Array.from({ length: 30 }, (_, k) => k + 1).filter((k) => k % 7 !== 3).map((k) => ({
  user_id: "u", date: ilYa(k), type: "easy", sport: "run", distance_km: 10, duration_seconds: 3000,
  avg_hr: 150, max_hr: 165, tss: 55, hr_zone_seconds: [900, 2100, 0, 0, 0],
}));
const discipline = async (repos: number | null) => {
  const base = [{ user_id: "u", vma_kmh: 18, max_hr: 195, resting_hr: repos, tested_at: ilYa(30) }];
  const ctx = await buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: base, workouts: SEANCES, notifications: [] }), "u");
  return ctx.text.match(/- Discipline des footings : [^\n]*/)?.[0] ?? "(ligne absente)";
};

async function main() {
  console.log("\nLE TEST VMA N'ÉCRIT QUE CE QUE L'ATHLÈTE A SAISI");

  await test("FC max et FC de repos non saisies : rien d'écrit (plus de 190 ni de 50)", () => {
    const src = codeNu("src/app/api/vma/route.ts");
    assert.match(src, /max_hr: Number\.isFinite\(maxHr\) && maxHr >= 140 && maxHr <= 220 \? Math\.round\(maxHr\) : null,/,
      "une FC max par défaut est de nouveau écrite");
    assert.match(src, /resting_hr: Number\.isFinite\(restHr\) && restHr >= 30 && restHr <= 100 \? Math\.round\(restHr\) : null,/,
      "une FC de repos par défaut est de nouveau écrite");
  });

  console.log("\nLE COACH NE JUGE PAS LES FOOTINGS SUR UNE FC DE REPOS INVENTÉE");

  await test("sans FC de repos, la discipline des footings n'est pas jugée, et le prompt le dit", async () => {
    assert.match(await discipline(null), /n\/c \(FC ou séances manquantes\)/);
  });

  await test("contre-épreuve : avec une FC de repos mesurée, le plafond se calcule (Karvonen 78 %)", async () => {
    // 45 + (195 − 45) × 0,78 = 162 bpm
    assert.match(await discipline(45), /au-dessus du plafond facile \(~162 bpm\)/);
  });

  console.log("\nLE GHOST RUNNER N'INVENTE PAS DE FC MAX (07/11/2026)");

  await test("plus de « ?? 190 » : sans FC max, zones sans chiffre et séance cardiaque en libre", () => {
    const src = codeNu("src/components/ghost-runner/GhostRunner.tsx");
    assert.doesNotMatch(src, /\?\?\s*190\b/, "une FC max de 190 inventée est de retour");
    assert.match(src, /const maxHr: number \| null = refsFc\.max;/);
    assert.match(src, /if \(!libre && refsFc\.max == null\) \{ setLibre\(true\); return; \}/, "sans FC max, la séance par zone démarre sur des battements inventés");
    assert.match(src, /maxHr != null \? `\$\{Math\.round\(maxHr \* z\.lo\)\}–\$\{Math\.round\(maxHr \* z\.hi\)\}` : "—"/, "les zones affichent des bpm sans FC max");
    assert.match(src, /\{maxHr != null && HR_ZONES\.map/, "les raccourcis de zone remplissent la fourchette avec une FC max inconnue");
    assert.match(src, /: d\["hr\.maxInconnue"\]/, "l'athlète n'est pas prévenu que sa FC max est inconnue");
    const i18n = readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8");
    assert.equal((i18n.match(/"hr\.maxInconnue":/g) ?? []).length, 5, "le message manque dans une langue");
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
