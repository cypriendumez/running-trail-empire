/**
 * SANTÉ, LOT 2 (Cyprien, 10/11/2026) — l'onglet Récupération et le bilan du matin.
 *
 *  · le bilan du matin (fatigue, jambes, stress, 1 = très bien … 5 = très mal) : décision de
 *    Cyprien — fatigue ou jambes à 4-5/5 remplacent la séance DURE du jour par une récupération
 *    facile, le stress seul s'affiche ; jamais de feu rouge sur le seul ressenti ;
 *    exercé ici sur le vrai moteur (buildAthleteContext + buildWeekPlan, faux client en mémoire) ;
 *  · l'onglet Récupération : forme et VFC par les mêmes fiches que les pages Indicateurs, sommeil
 *    et FC de repos sans valeur inventée ;
 *  · la carte du tableau de bord, la route, l'écran (site d'appel).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validerBilan, lireBilan, bilanDuJour, effetBilan, BILAN_T } from "../src/lib/health/bilanMatin";
import { bilansRecents, resumeSommeil } from "../src/lib/health/recuperation";
import { buildAthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan } from "../src/lib/ai/autoPlan";
import { aujourdhui, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeOf = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const AUJ = aujourdhui(FUSEAU_DEFAUT);
const ilYa = (n: number) => { const d = new Date(`${AUJ}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// ── Faux client Supabase en mémoire (le même que tests/sante-lot1) ──
type L = Record<string, unknown>;
function fauxClient(tables: Record<string, unknown[]>) {
  const requete = (table: string, toutes: unknown[]) => {
    const filtres: [string, unknown][] = []; const bornes: [string, string, unknown][] = [];
    let tri: { col: string; asc: boolean } | null = null; let plafond: number | null = null;
    const borne = (l: L) => bornes.every(([c, o, v]) => { if (!(c in l) || l[c] == null) return !(c in l); const a = l[c] as string, b = v as string; return o === "gte" ? a >= b : o === "lte" ? a <= b : o === "lt" ? a < b : a > b; });
    const lignes = () => { let r = (toutes as L[]).filter((l) => filtres.every(([c, v]) => !(c in l) || l[c] === v) && borne(l)); if (tri) { const { col, asc } = tri; r = [...r].sort((x, y) => (x[col] === y[col] ? 0 : ((x[col] as never) > (y[col] as never) ? 1 : -1) * (asc ? 1 : -1))); } if (plafond != null) r = r.slice(0, plafond); return r; };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "not", "in", "or", "neq", "is", "ilike"]) q[m] = () => q;
    for (const o of ["gte", "lte", "lt", "gt"]) q[o] = (c: string, v: unknown) => { bornes.push([c, o, v]); return q; };
    for (const m of ["insert", "update", "upsert", "delete"]) q[m] = () => { throw new Error(`écriture interdite (${table}.${m})`); };
    q.order = (c: string, o?: { ascending?: boolean }) => { if (!tri) tri = { col: c, asc: o?.ascending !== false }; return q; };
    q.limit = (n: number) => { plafond = n; return q; };
    q.eq = (c: string, v: unknown) => { filtres.push([c, v]); return q; };
    q.single = () => { const l = lignes(); return Promise.resolve({ data: l[0] ?? null, error: l[0] ? null : { code: "PGRST116" } }); };
    q.maybeSingle = () => Promise.resolve({ data: lignes()[0] ?? null, error: null });
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: lignes(), error: null }).then(ok, ko);
    return q;
  };
  return { from: (t: string) => requete(t, tables[t] ?? []) } as never;
}
const PROFIL = { id: "u", preferred_language: "fr", full_name: "Test", age: 25, gender: "male", weight_kg: 70, days_per_week: 5, available_days: [0, 1, 2, 3, 4, 5, 6], health_conditions: [], injury_zones: [], health_declared: true };
const BASE = [{ user_id: "u", vma_kmh: 18, max_hr: 200, resting_hr: 45, tested_at: ilYa(20) }];
const SEANCES = Array.from({ length: 24 }, (_, i) => ({ id: `w${i}`, user_id: "u", date: ilYa(i * 2 + 1), type: "easy", sport: "run", distance_km: 12, duration_seconds: 3600, elevation_gain_m: 40, avg_hr: 145, max_hr: 165, tss: 60, hr_zone_seconds: [600, 3000, 0, 0, 0] }));
const BILAN = (b: { fatigue: number; jambes: number; stress: number }, date = AUJ) =>
  ({ user_id: "u", type: "bilan_matin", created_at: `${date}T07:00:00Z`, data: { date, ...b } });
const DUR = /^(VMA|Seuil|Spécifique|Sortie longue)/;
const contexte = (notifs: unknown[]) => buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: BASE, workouts: SEANCES, notifications: notifs }), "u");
/** Les jours de départ (0 à 6 jours après aujourd'hui) où le plan SANS bilan commence par une séance dure. */
async function departsDurs() {
  const sans = await contexte([]);
  const departs: Date[] = [];
  for (let k = 0; k <= 6; k++) {
    const d = new Date(`${AUJ}T08:00:00`); d.setDate(d.getDate() + k);
    if (DUR.test(buildWeekPlan(sans, d)[0].type)) departs.push(d);
  }
  return { sans, departs };
}

async function main() {
  console.log("\nLE BILAN DU MATIN : VALIDATION ET EFFET");

  await test("trois notes entières de 1 à 5, la date est celle du serveur ; rien d'autre n'est accepté", () => {
    assert.deepEqual(validerBilan({ fatigue: 2, jambes: 5, stress: 1 }, AUJ), { ok: true, bilan: { date: AUJ, fatigue: 2, jambes: 5, stress: 1 } });
    for (const mauvais of [{ fatigue: 0, jambes: 3, stress: 3 }, { fatigue: 6, jambes: 3, stress: 3 }, { fatigue: 2.5, jambes: 3, stress: 3 }, { fatigue: 3, jambes: 3 }, { fatigue: "", jambes: 3, stress: 3 }, null]) {
      assert.equal(validerBilan(mauvais, AUJ).ok, false, `accepté : ${JSON.stringify(mauvais)}`);
    }
    // Une date envoyée par le navigateur est ignorée : c'est celle passée par le serveur qui compte.
    const v = validerBilan({ fatigue: 1, jambes: 1, stress: 1, date: "2020-01-01" }, AUJ);
    assert.ok(v.ok && v.bilan.date === AUJ, "la date du navigateur a été prise");
    assert.equal(lireBilan({ date: AUJ, fatigue: 9, jambes: 1, stress: 1 }), null, "une ligne invalide est lue comme un bilan");
  });

  await test("allège si fatigue OU jambes à 4-5 ; le stress seul ne retire rien ; 3 partout ne fait rien", () => {
    const e = (f: number, j: number, s: number) => effetBilan({ date: AUJ, fatigue: f, jambes: j, stress: s });
    assert.deepEqual(e(4, 1, 1), { allege: true, stressHaut: false });
    assert.deepEqual(e(1, 4, 1), { allege: true, stressHaut: false });
    assert.deepEqual(e(3, 3, 5), { allege: false, stressHaut: true });
    assert.deepEqual(e(3, 3, 3), { allege: false, stressHaut: false });
    assert.deepEqual(effetBilan(null), { allege: false, stressHaut: false });
  });

  await test("seul le bilan de CE jour compte (celui d'hier est ignoré)", () => {
    const lignes = [BILAN({ fatigue: 5, jambes: 5, stress: 5 }, ilYa(1)), BILAN({ fatigue: 2, jambes: 2, stress: 2 })];
    assert.equal(bilanDuJour([lignes[0]], AUJ), null, "le bilan d'hier est pris pour celui du jour");
    assert.equal(bilanDuJour(lignes, AUJ)?.fatigue, 2);
  });

  console.log("\nLE BILAN DANS LE PLAN RÉEL");

  await test("fatigue 5/5 : la séance dure du jour devient une récupération facile, motif du bilan dit ; le feu n'est pas rouge", async () => {
    const { departs } = await departsDurs();
    assert.ok(departs.length > 0, "précondition : aucun jour de départ ne commence par une séance dure");
    const avec = await contexte([BILAN({ fatigue: 5, jambes: 2, stress: 2 })]);
    assert.ok(avec.bilanMatin?.allege, `bilan non lu : ${JSON.stringify(avec.bilanMatin)}`);
    assert.notEqual(avec.readiness.level, "rouge", "le seul ressenti a mis le feu au rouge");
    assert.ok(avec.readiness.reasonsAll?.some((r) => r.fr === BILAN_T.fr.motif(5, 2)), "le motif du bilan n'est pas dans le bandeau");
    for (const d of departs) {
      const j0 = buildWeekPlan(avec, d)[0];
      assert.equal(j0.type, "Récup", `séance dure gardée malgré le bilan : ${j0.type} « ${j0.title} »`);
      assert.equal(j0.why, BILAN_T.fr.recupWhy(5, 2), `le pourquoi ne cite pas le bilan : ${j0.why}`);
      assert.match(j0.detail, /Corps : \d+ min/, "la montre ne saurait pas lire la récupération");
      assert.ok(j0.i18n?.en?.why.includes("check-in"), "le pourquoi n'est pas traduit");
    }
  });

  await test("le bilan ne touche QUE la séance dure du jour : un footing reste, les autres jours ne deviennent pas des récupérations", async () => {
    const { sans } = await departsDurs();
    const avec = await contexte([BILAN({ fatigue: 2, jambes: 5, stress: 1 })]);
    for (let k = 0; k <= 6; k++) {
      const d = new Date(`${AUJ}T08:00:00`); d.setDate(d.getDate() + k);
      const p0 = buildWeekPlan(sans, d), p1 = buildWeekPlan(avec, d);
      if (!DUR.test(p0[0].type)) assert.equal(p1[0].type, p0[0].type, `départ J+${k} : un jour facile a été changé (${p0[0].type} → ${p1[0].type})`);
      for (let i = 1; i < p0.length; i++) {
        if (p1[i].type === "Récup" && p0[i].type !== "Récup") assert.fail(`départ J+${k} : le jour ${p1[i].date} est devenu une récupération`);
      }
    }
  });

  await test("le stress seul (5/5) s'affiche sans rien retirer ; le bilan d'hier ne fait rien", async () => {
    const { sans, departs } = await departsDurs();
    for (const notifs of [[BILAN({ fatigue: 2, jambes: 2, stress: 5 })], [BILAN({ fatigue: 5, jambes: 5, stress: 1 }, ilYa(1))]]) {
      const ctx = await contexte(notifs);
      for (const d of departs) assert.equal(buildWeekPlan(ctx, d)[0].type, buildWeekPlan(sans, d)[0].type, `séance du jour changée par ${JSON.stringify(notifs[0])}`);
    }
    const stresse = await contexte([BILAN({ fatigue: 2, jambes: 2, stress: 5 })]);
    assert.equal(stresse.readiness.level, sans.readiness.level, "le stress seul a changé la couleur du feu");
    assert.ok(stresse.readiness.reasonsAll?.some((r) => r.fr === BILAN_T.fr.stress(5)), "le stress n'est pas affiché");
  });

  await test("une lecture du bilan en panne refuse le contexte (pas « aucun bilan »)", () => {
    assert.match(codeOf("src/lib/ai/coachContext.ts"), /if \(estUnePanne\(\{ error: eBilan \}\)\) throw new Error\(`Bilan du matin illisible/, "une panne passerait pour « aucun bilan »");
  });

  console.log("\nL'ONGLET RÉCUPÉRATION");

  await test("sommeil : la dernière nuit MESURÉE, la moyenne des nuits mesurées ; rien d'inventé", () => {
    const nuits = [
      { date: AUJ, sleep_score: null, total_sleep_min: null },
      { date: ilYa(1), sleep_score: 80, total_sleep_min: 420 },
      { date: ilYa(2), sleep_score: null, total_sleep_min: 0 },
      { date: ilYa(3), sleep_score: 70, total_sleep_min: 360 },
      { date: ilYa(9), sleep_score: 60, total_sleep_min: 600 },
    ];
    const s = resumeSommeil(nuits, AUJ);
    assert.deepEqual(s.derniere, { date: ilYa(1), min: 420, score: 80 }, "une nuit vide est prise pour la dernière nuit");
    assert.equal(s.moyenneMin, 390, `moyenne fausse (nuit à 0 ou hors fenêtre comptée) : ${s.moyenneMin}`);
    assert.equal(s.nuits, 2);
    assert.deepEqual(resumeSommeil([], AUJ), { derniere: null, moyenneMin: null, nuits: 0 });
  });

  await test("historique : un bilan par jour sur 14 jours, le plus récent d'abord ; celui du jour à part", () => {
    const lignes = [BILAN({ fatigue: 3, jambes: 3, stress: 3 }), BILAN({ fatigue: 1, jambes: 1, stress: 1 }), BILAN({ fatigue: 4, jambes: 2, stress: 2 }, ilYa(2)), BILAN({ fatigue: 2, jambes: 2, stress: 2 }, ilYa(20)), { data: { date: ilYa(1), fatigue: 0 } }];
    const r = bilansRecents(lignes, AUJ);
    assert.deepEqual(r.bilans.map((b) => b.date), [AUJ, ilYa(2)], `historique faux : ${JSON.stringify(r.bilans)}`);
    assert.equal(r.bilanJour?.fatigue, 3, "le bilan du jour n'est pas le plus récent");
  });

  await test("forme et VFC : les MÊMES fiches que les pages Indicateurs ; FC de repos jamais inventée", () => {
    const src = codeOf("src/lib/health/recuperation.ts");
    assert.match(src, /forme: resume\(ficheIndicateur\("forme", d\)\)/);
    assert.match(src, /vfc: resume\(ficheIndicateur\("vfc", d\)\)/);
    assert.match(src, /fcRepos: positif\(d\.fcRepos\)/);
    assert.doesNotMatch(src, /\?\? (45|50|60|190)\b/, "une valeur par défaut affichée comme mesure");
  });

  console.log("\nLES CHEMINS (site d'appel)");

  await test("la route : date du serveur (fuseau de l'athlète), sa ligne seulement, erreurs journalisées, « plan à jour » seulement si vrai", () => {
    const route = codeOf("src/app/api/health/bilan-matin/route.ts");
    assert.match(route, /const jour = jourLocal\(new Date\(\), fuseau\);\s*const valide = validerBilan\(await req\.json\(\)\.catch\(\(\) => \(\{\}\)\), jour\);/, "la date ne vient plus du serveur");
    assert.match(route, /\.update\(ligne\)\.eq\("id", existante\.id\)\.eq\("user_id", user\.id\)\.eq\("type", TYPE_BILAN\)/);
    assert.match(route, /if \(error\) \{\s*await journal\(`Bilan du matin non enregistré/);
    assert.match(route, /replanifie = res\?\.processed === true;/);
    assert.match(codeOf("src/components/health/BilanMatin.tsx"), /j\.replanifie === true \? \(j\.allege === true \? t\.okAllege : t\.ok\) : t\.attente/, "l'écran affirme un recalcul sans le savoir");
  });

  await test("la carte du tableau de bord tant que le bilan du jour manque ; l'onglet Récupération dans Santé", () => {
    const dash = codeOf("src/app/dashboard/page.tsx");
    assert.match(dash, /\.eq\("type", TYPE_BILAN\)\.eq\("data->>date", today\)/, "le tableau de bord ne cherche plus le bilan du jour de l'athlète");
    assert.match(dash, /\{bilanAFaire && <BilanMatin variante="carte" \/>\}/);
    const hc = codeOf("src/components/health/HealthCenter.tsx");
    assert.match(hc, /\{tab === "recup" && recup && \(/);
    assert.equal((hc.match(/"tab\.recup": "/g) ?? []).length, 5, "l'onglet n'est pas traduit dans les 5 langues");
    assert.match(codeOf("src/app/dashboard/health/page.tsx"), /recup = donneesRecup\(donnees, \(bilanRes\.data \?\? \[\]\) as \{ data\?: unknown \}\[\], jourAthlete, bilanPanne\);/);
  });

  await test("douleur à la reprise : « pas couru avant » plutôt que « 0 km, -100 % »", () => {
    const hc = codeOf("src/components/health/HealthCenter.tsx");
    assert.match(hc, /\{charge\.kmAvant === 0 && charge\.kmPrecedent > 0\s*\? tr\("k\.chargeArret", \{ b: charge\.kmPrecedent \}\)/, "l'écran affiche de nouveau « 0 km, -100 % » à la reprise");
    assert.equal((hc.match(/"k\.chargeArret": "/g) ?? []).length, 5, "le texte n'est pas dans les 5 langues");
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  for (const f of fails) console.log("  ✗ " + f);
  if (fails.length) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
