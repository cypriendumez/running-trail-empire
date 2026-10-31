/**
 * « PREMIUM AURAIT CHANGÉ TON PLAN » — le rappel montré aux abonnés Starter (31/10/2026).
 *
 * Cyprien a choisi, parmi les stratégies de vente, la plus honnête : montrer au Starter, au
 * moment où ça compte, ce que Premium aurait changé à SON plan, avec SES chiffres. Ces tests
 * figent ce que ça interdit autant que ce que ça montre :
 *  · rien d'inventé — aucun écart, aucun rappel ; un motif ne vient que du moteur, et n'est
 *    jamais accolé à un jour qu'il n'explique pas ;
 *  · Starter seulement, décidé par les capacités et jamais par un nom de formule ;
 *  · aucun modèle, aucun appel réseau, et rien de relu tant que les entrées n'ont pas changé ;
 *  · chaque écriture lit son erreur, et un rappel périmé ne survit pas à un plan republié.
 *
 *   npx tsx tests/rappel-premium.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAthleteContext, type AthleteContext } from "../src/lib/ai/coachContext";
import { buildWeekPlan, type PlanDay } from "../src/lib/ai/autoPlan";
import { rappelPremiumPour } from "../src/lib/billing/access";
import { ecartPremium, textesRappel, rappelAffichable, TYPE_RAPPEL_PREMIUM, VERSION_RAPPEL, type EcartPremium } from "../src/lib/coach/rappelPremium";
import { actualiserRappelPremium } from "../src/lib/ai/rappelPremiumServeur";
import { tr } from "../src/lib/i18n/multi";
import { aujourdhui, formatDateCivile, FUSEAU_DEFAUT } from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

type Ligne = Record<string, unknown>;
/**
 * Le faux client de `plan-gratuit.test.ts` — il projette les colonnes demandées et applique
 * les `eq` sur les colonnes que la ligne porte —, avec en plus les ÉCRITURES (consignées et
 * appliquées, pour qu'un second passage relise ce que le premier a écrit) et des pannes à la
 * demande : une écriture refusée, une lecture en erreur, une table qui lève.
 */
function fausseBase(tables: Record<string, Ligne[]>) {
  const lus: { table: string; colonnes: string }[] = [];
  const ecrits: { table: string; op: string; valeur: unknown }[] = [];
  const pannes = { ecriture: null as string | null, lecture: null as string | null, leve: null as string | null };
  let id = 0;
  const requete = (table: string) => {
    const filtres: [string, unknown][] = [];
    let colonnes: string[] | null = null;
    let op: "select" | "insert" | "update" | "delete" = "select";
    let valeur: unknown = null;
    const toutes = () => (tables[table] ??= []);
    const garde = (l: Ligne) => filtres.every(([c, v]) => !(c in l) || l[c] === v);
    const projeter = (l: Ligne) => (colonnes ? Object.fromEntries(colonnes.filter((c) => c in l).map((c) => [c, l[c]])) : l);
    const lignes = () => toutes().filter(garde).map(projeter);
    const erreurLecture = () => (pannes.lecture === table ? { message: `lecture refusée (${table})`, code: "XX000" } : null);
    const q: Record<string, unknown> = {};
    for (const m of ["gte", "lte", "lt", "gt", "not", "in", "or", "order", "limit", "neq", "is"]) q[m] = () => q;
    q.eq = (c: string, v: unknown) => { filtres.push([c, v]); return q; };
    q.select = (c = "*") => {
      lus.push({ table, colonnes: String(c) });
      colonnes = String(c).trim() === "*" ? null : String(c).split(",").map((x) => x.trim()).filter(Boolean);
      return q;
    };
    q.insert = (v: unknown) => { op = "insert"; valeur = v; return q; };
    q.update = (v: unknown) => { op = "update"; valeur = v; return q; };
    q.delete = () => { op = "delete"; return q; };
    q.single = () => { const l = lignes(); return Promise.resolve({ data: l[0] ?? null, error: erreurLecture() ?? (l[0] ? null : { code: "PGRST116" }) }); };
    q.maybeSingle = () => { const e = erreurLecture(); return Promise.resolve({ data: e ? null : lignes()[0] ?? null, error: e }); };
    q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
      if (op === "select") return Promise.resolve({ data: lignes(), error: erreurLecture() }).then(ok, ko);
      ecrits.push({ table, op, valeur });
      const refus = pannes.ecriture && table === "notifications" ? { message: pannes.ecriture } : null;
      if (!refus) {
        if (op === "insert") for (const l of ([] as Ligne[]).concat(valeur as Ligne)) toutes().push({ id: `l${++id}`, ...l });
        if (op === "update") for (const l of toutes().filter(garde)) Object.assign(l, valeur);
        if (op === "delete") tables[table] = toutes().filter((l) => !garde(l));
      }
      return Promise.resolve({ data: null, error: refus }).then(ok, ko);
    };
    return q;
  };
  const client = { from: (t: string) => { if (pannes.leve === t) throw new Error(`panne ${t}`); return requete(t); } };
  return { client: client as never, lus, ecrits, pannes, tables };
}

// Le jour du COACH (Paris) : les données glissent avec le calendrier, comme dans plan-gratuit.
const AUJOURDHUI = aujourdhui(FUSEAU_DEFAUT);
const ilYa = (n: number) => { const d = new Date(`${AUJOURDHUI}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// ⚠️ PAS DE `last_lat` dans le profil de base : aucune requête météo, sauf dans le test qui la mesure.
const PROFIL = {
  id: "u", preferred_language: "fr", full_name: "Test", age: 32, days_per_week: 5, available_days: [1, 2, 3, 4, 6],
  target_weekly_km: 60, health_conditions: [], injury_zones: [], health_declared: true,
  garmin_vo2max: 62, resting_hr: 42, max_hr: 198, weight_kg: 64, height_cm: 178, gender: "male",
  pace_curve: { best: [{ m: 5000, sec: 1080 }] },
};
const BASE = [{ vma_kmh: 16, max_hr: 199, resting_hr: 44, lt_hr: 176, tested_at: ilYa(20) }];
const sorties = () => Array.from({ length: 24 }, (_, i) => ({
  date: ilYa(i * 2 + 1), type: "easy", sport: "run", distance_km: 10 + (i % 3) * 2, duration_seconds: 3300 + (i % 3) * 600,
  elevation_gain_m: 60, avg_hr: 138, max_hr: 163, tss: 50, hr_zone_seconds: [600, 2400, 200, 0, 0], cardiac_decoupling: 2,
}));
/** Rien que Premium lirait de plus : VFC stable, dérive faible, foulée non mesurée. */
const NEUTRE = () => ({
  hrv_data: Array.from({ length: 20 }, (_, i) => ({ date: ilYa(i), rmssd: 92 + (i % 3), sdnn: null })) as Ligne[],
  sleep_data: Array.from({ length: 20 }, (_, i) => ({ date: ilYa(i), total_sleep_min: 480, sleep_score: 88 })) as Ligne[],
  workouts: sorties() as Ligne[],
  notifications: [] as Ligne[],
});
/** La VFC effondrée depuis quatre matins — ce que seul Premium voit. */
const VFC_BASSE = () => ({ ...NEUTRE(), hrv_data: Array.from({ length: 20 }, (_, i) => ({ date: ilYa(i), rmssd: i < 4 ? 41 : 92 + (i % 3), sdnn: null })) as Ligne[] });
/** La dérive cardiaque et la foulée seules, la VFC restant stable. */
const FOULEE = () => ({ ...NEUTRE(), workouts: sorties().map((w) => ({ ...w, cardiac_decoupling: 12, avg_cadence_spm: 150, vertical_ratio_pct: 11, ground_contact_ms: 300 })) as Ligne[] });

type Mesures = ReturnType<typeof NEUTRE>;
const base = (m: Mesures, profil: Ligne = PROFIL) => fausseBase({ profiles: [profil], performance_baselines: BASE as Ligne[], ...m });
/** Les deux lectures d'un même athlète : Starter, puis le contexte complet sur la MÊME météo. */
async function deuxLectures(m: Mesures) {
  const starter = await buildAthleteContext(base(m).client, "u", { essentielle: true });
  const complet = await buildAthleteContext(base(m).client, "u", { meteo: { forecast: starter.forecast, altitude: starter.altitude, heatAcclim: starter.heatAcclim } });
  return { starter, complet };
}
/** L'écart, avec la semaine bâtie comme si aujourd'hui tombait `k` jours plus tard : le
 *  placement des séances dépend du jour de la semaine, un test qui ne tiendrait qu'un samedi
 *  rougirait seul quand le calendrier avance. */
const SEPT = Array.from({ length: 7 }, (_, k) => k);
function ecartDecale(l: { starter: AthleteContext; complet: AthleteContext }, k: number) {
  const t = new Date(Date.now() + k * 86_400_000);
  const s = buildWeekPlan(l.starter, t), p = buildWeekPlan(l.complet, t);
  return ecartPremium({ starter: { ctx: l.starter, semaine: s }, premium: { ctx: l.complet, semaine: p }, depuis: s[0].date });
}

// ── Données synthétiques : des semaines écrites à la main, indépendantes du calendrier ──
const J = (date: string, type: string, title: string, detail = "", extra: Partial<PlanDay> = {}): PlanDay =>
  ({ date, type, title, detail, why: "", tags: [type], confirmed: true, ...extra });
const motif = (fr: string) => tr((l) => (l === "fr" ? fr : `${l}:${fr}`));
const lecture = (level: AthleteContext["readiness"]["level"], reasons: string[]) =>
  ({ readiness: { level, reasons, reasonsAll: reasons.map(motif), advice: "" } });
const SEMAINE = [
  J("2026-11-02", "VMA", "Séance VMA", "Corps : 8×400 m"),
  J("2026-11-03", "Endurance", "Footing en endurance", "Corps : ~8 km (environ 43 min)"),
  J("2026-11-04", "Renfo", "Renforcement musculaire", "Gainage 3×"),
  J("2026-11-05", "Seuil", "Séance au seuil", "Corps : 3×10 min"),
  J("2026-11-06", "Repos", "Repos", "Repos complet"),
  J("2026-11-07", "Sortie longue", "Sortie longue", "Corps : ~14 km (environ 1h16)"),
];
const remplace = (s: readonly PlanDay[], date: string, d: PlanDay) => s.map((x) => (x.date === date ? d : x));

async function main() {
  console.log("\nQUI LE VOIT");

  await test("Starter seulement : ni le gratuit, ni l'essai, ni Premium — décidé par les capacités", () => {
    const vieux = new Date(Date.now() - 60 * 86_400_000).toISOString();
    assert.equal(rappelPremiumPour({ subscription_tier: "starter" }), true, "un abonné Starter ne voit pas ce que Premium aurait changé");
    assert.equal(rappelPremiumPour({ subscription_tier: "essentiel" }), true, "l'ancien palier « essentiel » (Starter) perd le rappel");
    for (const t of ["premium", "pro", "elite", "complet"]) assert.equal(rappelPremiumPour({ subscription_tier: t }), false, `« ${t} » lit déjà tout : il ne doit pas lire ce que Premium « aurait » changé`);
    assert.equal(rappelPremiumPour({ created_at: new Date().toISOString(), subscription_tier: null }), false, "l'essai lit déjà tout");
    assert.equal(rappelPremiumPour({ created_at: vieux, subscription_tier: null }), false, "le gratuit n'a pas de plan adaptatif à comparer");
    // Jamais un nom de formule écrit en dur : la décision passe par `rappelPremiumPour`.
    for (const f of ["src/lib/coach/rappelPremium.ts", "src/lib/ai/rappelPremiumServeur.ts", "src/app/dashboard/calendrier/page.tsx"]) {
      assert.doesNotMatch(codeNu(f), /["']starter["']|["']premium["']/i, `${f} décide sur un nom de formule`);
    }
  });

  console.log("\nRIEN D'INVENTÉ");

  await test("rien de plus à lire pour Premium : aucun écart, quel que soit le jour", async () => {
    const l = await deuxLectures(NEUTRE());
    for (const k of SEPT) assert.equal(ecartDecale(l, k), null, `jour +${k} : un rappel est fabriqué alors que les deux plans sont identiques`);
  });

  await test("VFC effondrée : Premium aurait allégé un jour précis, et le motif est celui du moteur", async () => {
    const l = await deuxLectures(VFC_BASSE());
    const vus = new Set(l.starter.readiness.reasonsAll.map((r) => r.fr));
    const enPlus = l.complet.readiness.reasonsAll.filter((r) => !vus.has(r.fr));
    const chute = enPlus.find((r) => /\d/.test(r.fr));
    assert.ok(chute, "le jeu de données ne fait plus produire au moteur un motif chiffré de VFC : le test ne prouve rien");
    for (const k of SEPT) {
      const e = ecartDecale(l, k);
      assert.ok(e, `jour +${k} : la VFC effondrée ne change rien au plan Premium`);
      const j = e.jours.find((x) => x.sens === "allege");
      assert.ok(j, `jour +${k} : aucun jour allégé alors que Premium protège l'athlète`);
      assert.deepEqual(e.motifs.map((m) => m.fr), enPlus.map((m) => m.fr), `jour +${k} : les motifs ne sont pas exactement ceux que seul Premium a produits`);
      const t = textesRappel(e);
      const jour = formatDateCivile(j.date, "fr", { weekday: "long" });
      assert.ok(t.phrase.fr.startsWith(`Premium aurait allégé ta séance de ${jour} : `), `jour +${k} : « ${t.phrase.fr} »`);
      assert.ok(t.phrase.fr.includes(chute.fr), `jour +${k} : la phrase ne cite pas le chiffre de SA VFC (« ${chute.fr} »)`);
      assert.ok(t.phrase.en.includes(chute.en), `jour +${k} : le motif anglais n'est pas celui du moteur`);
      // Le titre du jour vient du plan, dans la langue : pas le français recopié partout.
      assert.notEqual(j.premium.titre.en, j.premium.titre.fr, `jour +${k} : le titre anglais du jour est le titre français`);
      assert.ok(t.detail?.en.includes(j.premium.titre.en), `jour +${k} : le détail anglais ne reprend pas le titre traduit du plan`);
    }
  });

  await test("un motif que Starter voyait déjà n'est pas vendu comme un apport de Premium", () => {
    const e = ecartPremium({
      starter: { ctx: lecture("jaune", ["sommeil dégradé (55/100)"]), semaine: SEMAINE },
      premium: { ctx: lecture("orange", ["sommeil dégradé (55/100)", "VFC sous sa base"]), semaine: SEMAINE },
      depuis: "2026-11-01",
    });
    assert.deepEqual(e?.motifs.map((m) => m.fr), ["VFC sous sa base"], "le sommeil, que Starter lit aussi, est présenté comme ce que Premium a vu");
    // Un motif du moteur qui finit déjà sa phrase ne la termine pas deux fois.
    const long = textesRappel({ ...e!, motifs: [motif("la qualité est maintenue. À surveiller si la VFC redescend.")] });
    assert.ok(long.phrase.fr.endsWith("si la VFC redescend.") && !long.phrase.fr.endsWith(".."), `« ${long.phrase.fr} »`);
  });

  await test("la foulée et la dérive seules : le jour est nommé, sans prêter à la VFC ce qu'elle n'a pas dit", async () => {
    const l = await deuxLectures(FOULEE());
    for (const k of SEPT) {
      const e = ecartDecale(l, k);
      assert.ok(e, `jour +${k} : la dérive cardiaque et la foulée ne changent plus le plan Premium — le test ne prouve rien`);
      assert.deepEqual(e.motifs, [], `jour +${k} : un motif de fraîcheur apparaît sans aucun signal de VFC`);
      const t = textesRappel(e);
      assert.doesNotMatch(t.phrase.fr, /VFC|:/, `jour +${k} : « ${t.phrase.fr} » invente un motif`);
      assert.ok(t.detail?.fr.includes("au lieu de"), `jour +${k} : le détail ne dit plus ce qui change`);
    }
  });

  await test("un motif n'est jamais accolé à un jour qu'il n'explique pas", () => {
    const fatigue = lecture("orange", ["VFC sous sa base"]);
    const avec = (p: readonly PlanDay[]) => textesRappel(ecartPremium({ starter: { ctx: lecture("vert", []), semaine: SEMAINE }, premium: { ctx: fatigue, semaine: p }, depuis: "2026-11-01" })!);
    // Le renforcement suit la foulée, le type de qualité suit la dérive : pas la VFC.
    const renfo = avec(remplace(SEMAINE, "2026-11-04", J("2026-11-04", "Renfo", "Renforcement musculaire", "Gainage 3× + cadence")));
    assert.doesNotMatch(renfo.phrase.fr, /VFC/, `« ${renfo.phrase.fr} » attribue un renforcement à la VFC`);
    const permute = avec(remplace(SEMAINE, "2026-11-02", J("2026-11-02", "Seuil", "Séance au seuil", "Corps : 3×10 min")));
    assert.doesNotMatch(permute.phrase.fr, /VFC/, `« ${permute.phrase.fr} » attribue un changement de qualité à la VFC`);
    // Contre-épreuve : une séance raccourcie par le verdict, elle, s'explique par lui.
    const allegee = avec(remplace(SEMAINE, "2026-11-02", J("2026-11-02", "VMA", "Séance VMA (allégée)", "Corps : 6×400 m")));
    assert.ok(allegee.phrase.fr.endsWith(": VFC sous sa base."), `« ${allegee.phrase.fr} » ne dit plus pourquoi`);
  });

  await test("le sens dit ce qui change vraiment : moins de charge, la marque « allégée », moins de kilomètres", () => {
    const sens = (date: string, d: PlanDay) => ecartPremium({ starter: { ctx: lecture("vert", []), semaine: SEMAINE }, premium: { ctx: lecture("vert", []), semaine: remplace(SEMAINE, date, d) }, depuis: "2026-11-01" })!.jours[0].sens;
    assert.equal(sens("2026-11-05", J("2026-11-05", "Endurance", "Footing en endurance", "Corps : ~8 km")), "allege", "une qualité retirée n'est pas un allègement");
    assert.equal(sens("2026-11-03", J("2026-11-03", "Seuil", "Séance au seuil", "Corps : 3×10 min")), "intensifie", "une qualité ajoutée n'est pas une hausse");
    assert.equal(sens("2026-11-02", J("2026-11-02", "VMA", "Séance VMA (allégée)", "Corps : 8×400 m")), "allege", "la marque « allégée » du moteur est ignorée");
    assert.equal(sens("2026-11-07", J("2026-11-07", "Sortie longue", "Sortie longue", "Corps : ~11 km (environ 1h00)")), "allege", "une sortie longue raccourcie n'est pas un allègement");
    assert.equal(sens("2026-11-07", J("2026-11-07", "Sortie longue", "Sortie longue", "Corps : ~16 km (environ 1h27)")), "intensifie", "une sortie longue allongée n'est pas une hausse");
    assert.equal(sens("2026-11-04", J("2026-11-04", "Renfo", "Renforcement musculaire", "Gainage 3× + cadence")), "ajuste");
    // La distance se dit quand elle seule change.
    const e = ecartPremium({ starter: { ctx: lecture("vert", []), semaine: SEMAINE }, premium: { ctx: lecture("vert", []), semaine: remplace(SEMAINE, "2026-11-07", J("2026-11-07", "Sortie longue", "Sortie longue", "Corps : ~11 km (environ 1h00)")) }, depuis: "2026-11-01" })!;
    assert.equal(textesRappel(e).detail?.fr, "« Sortie longue » : ~11 km au lieu de ~14 km");
  });

  await test("le jour mis en avant est celui qu'on protège, et son chiffre passe en premier", () => {
    const p = remplace(remplace(SEMAINE, "2026-11-04", J("2026-11-04", "Endurance", "Footing en endurance", "Corps : ~6 km")), "2026-11-05", J("2026-11-05", "Endurance", "Footing en endurance", "Corps : ~7 km"));
    const e = ecartPremium({ starter: { ctx: lecture("vert", []), semaine: SEMAINE }, premium: { ctx: lecture("orange", ["VFC sous sa base", "VFC en chute nette (-42 % sous ta base : 41 contre 71 ms)"]), semaine: p }, depuis: "2026-11-01" })!;
    assert.deepEqual(e.jours.map((j) => j.sens), ["intensifie", "allege"], "le jeu de données ne met plus une hausse AVANT l'allègement");
    const t = textesRappel(e);
    assert.ok(t.phrase.fr.startsWith("Premium aurait allégé ta séance de jeudi"), `« ${t.phrase.fr} » met en avant le renforcement déplacé`);
    assert.ok(t.phrase.fr.includes(": VFC en chute nette (-42 % sous ta base : 41 contre 71 ms), VFC sous sa base."), `« ${t.phrase.fr} »`);
    assert.equal(t.detail?.fr, "« Footing en endurance » au lieu de « Séance au seuil » · un autre jour change aussi");
  });

  await test("un jour déjà couru ou ajusté par l'athlète n'est pas comparé ; le verdict seul suffit", () => {
    const p = remplace(SEMAINE, "2026-11-02", J("2026-11-02", "Endurance", "Footing en endurance", "Corps : ~8 km"));
    const vert = lecture("vert", []);
    assert.equal(ecartPremium({ starter: { ctx: vert, semaine: SEMAINE }, premium: { ctx: vert, semaine: p }, depuis: "2026-11-03" }), null, "le jour gelé (séance déjà enregistrée) est regretté");
    const affichee = remplace(SEMAINE, "2026-11-02", J("2026-11-02", "Récup", "Récupération", "25 min"));
    assert.equal(ecartPremium({ starter: { ctx: vert, semaine: SEMAINE }, premium: { ctx: vert, semaine: p }, depuis: "2026-11-01", affichee }), null, "on compare un jour que l'athlète voit autrement que le moteur");
    const v = ecartPremium({ starter: { ctx: vert, semaine: SEMAINE }, premium: { ctx: lecture("orange", ["VFC sous sa base"]), semaine: SEMAINE }, depuis: "2026-11-01" });
    assert.ok(v, "un verdict différent, séances identiques : le rappel se tait");
    const t = textesRappel(v);
    assert.equal(t.phrase.fr, "Avec Premium, ton verdict du jour serait orange au lieu de vert : VFC sous sa base.");
    assert.equal(t.phrase.de, "Mit Premium wäre deine Tagesbewertung orange statt grün: de:VFC sous sa base.");
    assert.equal(t.detail, null);
  });

  await test("les 5 langues, sans un mot de français ailleurs qu'en français", () => {
    const e: EcartPremium = {
      jours: [{ date: "2026-11-05", sens: "allege", starter: { types: ["Seuil"], titre: tr((l) => `S-${l}`), km: null }, premium: { types: ["Endurance"], titre: tr((l) => `P-${l}`), km: null } }],
      verdict: null, motifs: [],
    };
    for (const sens of ["allege", "intensifie", "ajuste"] as const) {
      const t = textesRappel({ ...e, jours: [{ ...e.jours[0], sens }] });
      for (const l of ["en", "de", "es", "pt"] as const) {
        assert.doesNotMatch(t.phrase[l], /aurait|séance|ta |jeudi/, `${sens} en ${l} : « ${t.phrase[l]} »`);
        assert.ok(t.phrase[l].includes(formatDateCivile("2026-11-05", l, { weekday: "long" })), `${sens} en ${l} : le jour n'est pas écrit dans la langue`);
        assert.ok(t.detail?.[l].includes(`P-${l}`) && t.detail[l].includes(`S-${l}`), `${sens} en ${l} : le détail ne reprend pas les titres traduits du plan`);
      }
    }
  });

  console.log("\nCE QUE LE CALENDRIER AFFICHE");

  await test("seulement le rappel calculé aujourd'hui, de cette version, et porteur d'une phrase", () => {
    const phrase = tr((l) => `phrase ${l}`);
    const bon = { v: VERSION_RAPPEL, jour: "2026-10-31", phrase, detail: null };
    assert.deepEqual(rappelAffichable(bon, "2026-10-31"), { phrase, detail: null });
    assert.equal(rappelAffichable(bon, "2026-11-01"), null, "le rappel de la veille décrit une semaine qui a glissé");
    assert.equal(rappelAffichable({ ...bon, v: VERSION_RAPPEL + 1 }, "2026-10-31"), null, "une autre version est affichée");
    assert.equal(rappelAffichable({ ...bon, phrase: null }, "2026-10-31"), null, "une ligne sans écart affiche quelque chose");
    assert.equal(rappelAffichable(null, "2026-10-31"), null);
  });

  await test("la page ne le montre qu'au plan essentiel, dans le bandeau, avec le lien vers les tarifs", () => {
    const page = codeNu("src/app/dashboard/calendrier/page.tsx");
    assert.match(page, /\.eq\("type", TYPE_RAPPEL_PREMIUM\)/, "la page ne lit plus le rappel");
    assert.match(page, /rappelPremiumPour\(profileRow[^)]*\)\s*\?\s*rappelAffichable\(/, "le rappel s'affiche sans vérifier la formule : un abonné passé à Premium le verrait encore");
    assert.match(page, /select\(`[^`]*\$\{COLONNES_ACCES\}/, "la page ne lit plus les colonnes d'accès");
    assert.match(page, /<CalendarView[^>]*rappelPremium=\{rappelPremium\}/, "le calendrier ne reçoit plus le rappel");
    const vue = codeNu("src/components/training/CalendarView.tsx");
    assert.equal((vue.match(/\{rappel && <RappelPremium /g) ?? []).length, 2, "le bandeau « pourquoi ce plan » n'affiche plus le rappel dans ses deux formes");
    assert.match(vue, /function RappelPremium[\s\S]*?<Link href="\/pricing"/, "le rappel ne mène plus aux tarifs");
  });

  console.log("\nLE CALCUL : COÛT, EMPREINTE, ÉCRITURES");

  async function scene(m: Mesures, profil: Ligne = PROFIL, maintenant = new Date()) {
    const db = base(m, profil);
    const ctx = await buildAthleteContext(db.client, "u", { essentielle: true });
    const semaine = buildWeekPlan(ctx, maintenant);
    const passe = (c: AthleteContext = ctx) => actualiserRappelPremium(db.client, { userId: "u", ctx: c, semaine, affichee: semaine, depuis: semaine[0].date, maintenant });
    const rappels = () => (db.tables.notifications ?? []).filter((l) => l.type === TYPE_RAPPEL_PREMIUM);
    const relectures = () => db.lus.filter((l) => l.table === "profiles").length;
    return { db, ctx, passe, rappels, relectures };
  }

  await test("premier passage : le rappel est écrit, daté du jour du coach, et la semaine complète n'a coûté aucun modèle", async () => {
    // 23 h 30 UTC : déjà le lendemain à Paris. Un jour daté en UTC se trahit ici.
    const tard = new Date(`${AUJOURDHUI}T23:30:00Z`);
    assert.notEqual(aujourdhui(FUSEAU_DEFAUT, tard), tard.toISOString().slice(0, 10), "l'instant choisi ne sépare plus Paris d'UTC : le test ne prouve rien");
    const s = await scene(VFC_BASSE(), PROFIL, tard);
    assert.equal(await s.passe(), "ecrit");
    const r = s.rappels();
    assert.equal(r.length, 1, `${r.length} ligne(s) de rappel au lieu d'une`);
    const d = r[0].data as { v: number; jour: string; empreinte: string; phrase: { fr: string } };
    assert.equal(d.v, VERSION_RAPPEL);
    assert.equal(d.jour, aujourdhui(FUSEAU_DEFAUT, tard), "le rappel n'est pas daté du jour civil du coach");
    assert.match(d.empreinte, /^[0-9a-f]{32}$/);
    assert.ok(d.phrase.fr.startsWith("Premium aurait allégé ta séance de"), `« ${d.phrase.fr} »`);
    for (const f of ["src/lib/ai/rappelPremiumServeur.ts", "src/lib/coach/rappelPremium.ts"]) {
      assert.doesNotMatch(codeNu(f), /gemini|generateContent|relireSemaine/, `${f} fait parler un modèle`);
    }
  });

  await test("rien n'a changé : rien n'est relu ni réécrit (le coach repasse toutes les dix minutes)", async () => {
    const s = await scene(VFC_BASSE());
    await s.passe();
    const lus = s.relectures(), ecrits = s.db.ecrits.length;
    assert.equal(await s.passe(), "inchange");
    assert.equal(s.relectures(), lus, "le contexte complet est relu alors que rien n'a changé");
    assert.equal(s.db.ecrits.length, ecrits, "le rappel est réécrit alors que rien n'a changé");
  });

  await test("une nouvelle VFC ou un autre briefing Starter : recalculé, dans la MÊME ligne", async () => {
    const s = await scene(VFC_BASSE());
    await s.passe();
    const lus = s.relectures();
    s.db.tables.hrv_data[0] = { ...s.db.tables.hrv_data[0], rmssd: 38 };
    assert.equal(await s.passe(), "ecrit", "une VFC mesurée depuis le dernier calcul ne le refait pas");
    assert.ok(s.relectures() > lus, "le contexte complet n'a pas été relu");
    assert.equal(await s.passe({ ...s.ctx, text: `${s.ctx.text}\nnouvelle séance` }), "ecrit", "ce que Starter a lu a changé, et le rappel ne suit pas");
    assert.equal(s.rappels().length, 1, "chaque calcul ajoute une ligne au lieu de mettre à jour la sienne");
  });

  await test("aucun écart : une ligne sans phrase garde l'empreinte, et le calendrier n'affiche rien", async () => {
    const s = await scene(NEUTRE());
    assert.equal(await s.passe(), "ecrit");
    const d = s.rappels()[0]?.data as { phrase: unknown; jour: string } | undefined;
    assert.ok(d, "sans écart, l'empreinte n'est pas gardée : chaque passage relirait tout");
    assert.equal(d.phrase, null, "un rappel est écrit alors que les deux plans sont identiques");
    assert.equal(rappelAffichable(d, d.jour), null);
    assert.equal(await s.passe(), "inchange");
  });

  await test("la météo n'est pas relue : aucun appel réseau pour le plan complet", async () => {
    const vraiFetch = globalThis.fetch;
    let appels = 0;
    globalThis.fetch = (async () => { appels++; return new Response("{}", { status: 503 }); }) as typeof fetch;
    try {
      const s = await scene(VFC_BASSE(), { ...PROFIL, last_lat: 48.85, last_lon: 2.35 });
      const avant = appels;
      assert.ok(avant > 0, "le contexte Starter n'interroge plus la météo : le test ne prouve rien");
      assert.equal(await s.passe(), "ecrit");
      assert.equal(appels, avant, `${appels - avant} appel(s) réseau pendant le calcul du rappel`);
    } finally { globalThis.fetch = vraiFetch; }
  });

  await test("chaque écriture lit son erreur ; un échec se journalise et ne casse rien", async () => {
    const s = await scene(VFC_BASSE());
    s.db.pannes.ecriture = "refus simulé";
    assert.equal(await s.passe(), "echec", "une écriture refusée est déclarée réussie");
    assert.ok(s.db.ecrits.some((e) => e.table === "error_logs" && /refus simulé/.test(String((e.valeur as { message?: string }).message))), "l'échec n'atteint pas error_logs");
    // Lecture de l'ancienne ligne en erreur : on n'écrit pas à l'aveugle (deux rappels).
    const t = await scene(VFC_BASSE());
    t.db.pannes.lecture = "notifications";
    assert.equal(await t.passe(), "echec");
    assert.equal(t.relectures(), 1, "le plan complet est calculé alors que l'ancienne ligne est illisible");
    assert.ok(!t.db.ecrits.some((e) => e.table === "notifications"), "un rappel est écrit à l'aveugle");
  });

  await test("le plan complet ne se calcule pas : l'ancien rappel est effacé, pas laissé sous un plan republié", async () => {
    const s = await scene(VFC_BASSE());
    await s.passe();
    assert.equal(s.rappels().length, 1);
    s.db.pannes.leve = "profiles";
    assert.equal(await s.passe({ ...s.ctx, text: `${s.ctx.text}\nplan republié` }), "echec");
    assert.equal(s.rappels().length, 0, "le rappel de l'ancien plan reste affiché");
    assert.ok(s.db.ecrits.some((e) => e.table === "error_logs"), "l'échec n'est pas journalisé");
  });

  console.log("\nLE BRANCHEMENT DANS LE COACH");

  await test("le coach le calcule pour le plan essentiel, APRÈS avoir publié, pour le même jour", () => {
    const src = codeNu("src/lib/ai/autoCoach.ts");
    assert.match(src, /rappelPremiumPour\(acces\)\s*\?\s*await actualiserRappelPremium\(/, "le rappel n'est plus réservé au plan essentiel");
    assert.match(src, /const semaineMoteur = buildWeekPlan\(ctx, maintenant\)/, "le plan Starter n'est plus daté par l'instant partagé");
    assert.match(src, /actualiserRappelPremium\([^;]*semaine: semaineMoteur[^;]*depuis: from[^;]*maintenant/, "le rappel ne compare plus la semaine du moteur, depuis le premier jour modifiable, au même instant");
    const iPlan = src.indexOf(".insert(rows)"), iRappel = src.indexOf("await actualiserRappelPremium(");
    assert.ok(iPlan > 0 && iRappel > iPlan, "le plan de l'athlète attend le calcul d'un rappel commercial");
  });
}

main().then(() => {
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
});
