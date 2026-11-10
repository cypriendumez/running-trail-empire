/**
 * SANTÉ, LOT 3 (Cyprien, 10/11/2026) — le questionnaire d'aptitude à l'effort.
 *
 *  · cinq situations à faire voir à un médecin avant de s'entraîner fort ; décision de Cyprien :
 *    une situation cochée → AUCUNE intensité tant que le coureur n'a pas déclaré l'avis d'un
 *    médecin ; l'application n'est pas bloquée ;
 *    exercé ici sur le vrai moteur (buildAthleteContext + buildWeekPlan, faux client en mémoire) ;
 *  · posé à l'inscription (obligatoire, écrit AVANT le premier plan) et dans Santé pour les inscrits
 *    d'avant ; la route, l'écran (site d'appel).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validerAptitude, lireAptitude, avisAttendu, APTITUDE_T } from "../src/lib/health/aptitude";
import { APTITUDE_UI } from "../src/lib/health/aptitudeI18n";
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
const APT = (oui: string[], avisMedecin: string | null = null) => ({ user_id: "u", type: "aptitude", created_at: `${ilYa(3)}T08:00:00Z`, data: { oui, date: ilYa(3), avisMedecin } });
const contexte = (notifs: unknown[]) => buildAthleteContext(fauxClient({ profiles: [PROFIL], performance_baselines: BASE, workouts: SEANCES, notifications: notifs }), "u");
const QUALITE = /^(VMA|Seuil|Spécifique|Côtes|Fartlek|Tempo)/;
const departs = () => Array.from({ length: 7 }, (_, k) => { const d = new Date(`${AUJ}T08:00:00`); d.setDate(d.getDate() + k); return d; });
const intense = (d: { type: string; title: string; tags: string[] }) => QUALITE.test(d.type) || d.tags.some((t) => /^(Qualité|Progressif|Spécifique)$/.test(t));

async function main() {
  console.log("\nLE QUESTIONNAIRE : VALIDATION");

  await test("seules les 5 situations connues sont acceptées ; une liste vide est une réponse (« aucune »)", () => {
    assert.deepEqual(validerAptitude({ oui: [] }, AUJ), { ok: true, aptitude: { oui: [], date: AUJ, avisMedecin: null } });
    assert.equal(validerAptitude({ oui: ["poitrine", "malaise"] }, AUJ).ok, true);
    for (const mauvais of [{ oui: ["inventee"] }, { oui: "poitrine" }, {}, null, { oui: ["poitrine", "poitrine"] }]) {
      assert.equal(validerAptitude(mauvais, AUJ).ok, false, `accepté : ${JSON.stringify(mauvais)}`);
    }
    assert.equal(lireAptitude({ oui: ["poitrine"], date: "pas une date" }), null, "une ligne illisible est lue comme un questionnaire");
  });

  await test("avis attendu : une situation cochée et pas d'avis ; jamais sinon", () => {
    assert.equal(avisAttendu({ oui: ["palpitations"], date: AUJ, avisMedecin: null }), true);
    assert.equal(avisAttendu({ oui: ["palpitations"], date: AUJ, avisMedecin: AUJ }), false, "l'avis du médecin ne lève pas l'attente");
    assert.equal(avisAttendu({ oui: [], date: AUJ, avisMedecin: null }), false);
    assert.equal(avisAttendu(null), false, "un questionnaire absent bride le plan");
  });

  console.log("\nLE PLAN RÉEL");

  await test("une situation cochée : aucune intensité sur les 7 jours de départ, motif affiché, l'appli n'est pas vide", async () => {
    const ctx = await contexte([APT(["poitrine"])]);
    assert.equal(ctx.aptitude?.attente, true, "le questionnaire n'est pas lu");
    assert.equal(ctx.weekPlan.qBudget, 0, `qualité gardée : ${ctx.weekPlan.qBudget}`);
    assert.ok(ctx.readiness.reasonsAll?.some((r) => r.fr === APTITUDE_T.fr.motif), "le motif n'est pas dans le bandeau");
    for (const d of departs()) {
      const plan = buildWeekPlan(ctx, d);
      for (const j of plan) assert.ok(!intense(j), `séance intense le ${j.date} : ${j.type} « ${j.title} »`);
      assert.ok(plan.some((j) => !/^(Repos)/.test(j.type)), "plus aucune séance : l'appli serait bloquée");
    }
  });

  await test("sans le questionnaire (contre-épreuve), avec « aucune » ou avec l'avis d'un médecin : la qualité est là", async () => {
    for (const notifs of [[], [APT([])], [APT(["poitrine"], ilYa(1))]]) {
      const ctx = await contexte(notifs);
      assert.equal(ctx.aptitude?.attente, false);
      assert.ok(ctx.weekPlan.qBudget >= 1, `qualité retirée à tort (${JSON.stringify(notifs[0] ?? null)})`);
      assert.ok(departs().some((d) => buildWeekPlan(ctx, d).some((j) => QUALITE.test(j.type))), "aucune séance de qualité nulle part : la contre-épreuve ne prouve rien");
    }
  });

  await test("la course objectif reste, avec « vois un médecin avant » ; les footings remplacés ont leur texte (5 langues)", async () => {
    const ctx = await contexte([APT(["malaise"])]);
    const j0 = buildWeekPlan({ ...ctx, daysToRace: 0 }, new Date(`${AUJ}T08:00:00`))[0];
    assert.equal(j0.type, "Course", "la course a été retirée");
    assert.match(j0.why, /avis d'un médecin/, "la course ne dit pas de voir un médecin");
    assert.ok(j0.i18n?.en?.why.includes("doctor"), "l'avertissement manque en anglais");
    assert.match(codeOf("src/lib/coach/consignesPlan.ts"), /const TX = c\.source === "aptitude" \? TA : T;/, "les textes du kiné servent à l'aptitude");
  });

  await test("une lecture du questionnaire en panne refuse le contexte (pas « rien à signaler »)", () => {
    assert.match(codeOf("src/lib/ai/coachContext.ts"), /if \(estUnePanne\(\{ error: eApt \}\)\) throw new Error\(`Questionnaire d'aptitude illisible/);
  });

  console.log("\nLES CHEMINS (site d'appel)");

  await test("l'inscription : réponse obligatoire, écrite AVANT le premier plan, un échec arrête l'inscription", () => {
    const ob = codeOf("src/app/onboarding/page.tsx");
    assert.match(ob, /\[!aptRepondu, `\$\{cid\}-aptitude`,/, "le questionnaire n'est plus obligatoire");
    const iEcrit = ob.indexOf("type: TYPE_APTITUDE"), iPlan = ob.indexOf('fetch("/api/coach/generate"');
    assert.ok(iEcrit > 0 && iPlan > iEcrit, "le questionnaire est écrit après le premier plan (ou plus du tout)");
    assert.match(ob, /noter\(eApt, "questionnaire d'aptitude"\);/, "un échec d'écriture passe en silence");
  });

  await test("la route : avis du médecin seulement sur un questionnaire rempli, erreurs journalisées, « plan à jour » seulement si vrai", () => {
    const r = codeOf("src/app/api/health/aptitude/route.ts");
    assert.match(r, /if \(!avant\) return NextResponse\.json\(\{ ok: false, error: "sans_questionnaire" \}/);
    assert.match(r, /\.update\(ligne\)\.eq\("id", existante\.id\)\.eq\("user_id", user\.id\)\.eq\("type", TYPE_APTITUDE\)/);
    assert.match(r, /if \(error\) \{\s*await journal\(`Questionnaire d'aptitude non enregistré/);
    assert.match(r, /replanifie = res\?\.processed === true;/);
    assert.match(codeOf("src/components/health/CarteAptitude.tsx"), /toast\.success\(j\.replanifie === true \? succes : `\$\{t\.ok\} \$\{t\.recalcul\}`\)/);
  });

  await test("Santé : la carte au-dessus des onglets ; à remplir pour un inscrit d'avant, l'attente sinon ; 5 langues", () => {
    const page = codeOf("src/app/dashboard/health/page.tsx");
    assert.match(page, /aptitude = !apt \? "absent" : avisAttendu\(apt\) \? "attente" : "ok";/);
    assert.match(codeOf("src/components/health/HealthCenter.tsx"), /<CarteAptitude etat=\{aptitude\} \/>/);
    // Lecture en panne : l'écran le dit (le coach, lui, refuse son contexte) — relecture du 10/11/2026.
    assert.match(page, /if \(eApt\) \{\s*console\.error\([^)]*\);\s*aptitude = "panne";/, "une panne de lecture se tait de nouveau");
    const carte = codeOf("src/components/health/CarteAptitude.tsx");
    assert.match(carte, /if \(etat === "panne"\) \{\s*return <p role="alert"[^>]*>\{t\.panne\}<\/p>;/);
    assert.match(carte, /if \(etat === "ok" && !modifier\) return <div>\{lienModifier\}<\/div>;/, "plus moyen de corriger ses réponses");
    assert.match(codeOf("src/app/onboarding/page.tsx"), /\{aptOui\.length > 0 && <p[^>]*>\{APTITUDE_UI\[[^\]]*\]\.urgence\}<\/p>\}/, "l'inscription n'affiche plus l'urgence");
    for (const l of ["fr", "en", "de", "es", "pt"] as const) {
      assert.equal(Object.keys(APTITUDE_UI[l].questions).length, 5, `questions incomplètes en ${l}`);
      assert.match(APTITUDE_UI[l].attente, /112/, `pas de numéro d'urgence en ${l}`);
      assert.match(APTITUDE_UI[l].urgence, /112/, `pas de numéro d'urgence à l'inscription en ${l}`);
    }
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  for (const f of fails) console.log("  ✗ " + f);
  if (fails.length) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
