/**
 * « UN AVIS SUR MA SEMAINE » S'APPLIQUE EN UN GESTE (Premium, Cyprien, 30/10/2026).
 *
 * « La séance est réellement modifiée, puis envoyée à la montre, toujours dans les limites
 * de sécurité du moteur. » Jusqu'ici, l'avis n'était qu'une phrase : rien ne changeait.
 *
 * Ces tests gardent les trois étages :
 *   · la PROPOSITION ne montre « Appliquer » que sur ce que le moteur accepterait ;
 *   · le MOTEUR applique (et réapplique à chaque reconstruction) avec ses garde-fous ;
 *   · la ROUTE ne croit rien du navigateur et ne dit « c'est fait » qu'après relecture.
 *
 *   npx tsx tests/ajustement-applique.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validerAjustement, contraintesDe, type JourPlan } from "../src/lib/ai/ajustement";
import { appliquerAjustement, appliquerAjustements, type AjustementApplique, type OptionsAjustement } from "../src/lib/coach/ajustementApplique";
import { changementConcret } from "../src/components/training/AvisCoach";
import { PLAN_T } from "../src/lib/ai/planI18n";
import type { PlanDay } from "../src/lib/ai/autoPlan";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
/** Le source sans ses commentaires — sans couper les `://` des adresses. */
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

// Une semaine du moteur, du lundi 2 au dimanche 8 novembre 2026.
const jour = (date: string, type: string, title: string, detail = `${title} — détail`): PlanDay => ({
  date, type, title, detail, why: `Pourquoi ${title}.`, tags: [type], confirmed: date <= "2026-11-06",
  i18n: { en: { title: `${title} (en)`, detail: `${detail} (en)`, why: `Why ${title}.`, tags: [type] } },
});
const SEMAINE: PlanDay[] = [
  jour("2026-11-02", "Repos", "Repos"),
  jour("2026-11-03", "Endurance", "Footing en endurance"),
  jour("2026-11-04", "VMA", "VMA courte"),
  jour("2026-11-05", "Repos", "Repos"),
  jour("2026-11-06", "Endurance", "Footing en endurance"),
  jour("2026-11-07", "Seuil", "Séance au seuil"),
  jour("2026-11-08", "Sortie longue", "Sortie longue"),
];
const OPTS: OptionsAjustement = { from: "2026-11-02", qBudget: 2, joursCourables: [0, 1, 2, 3, 4, 5, 6], warm: 15, cool: 10 };
const typesDe = (...dates: string[]) => Object.fromEntries(dates.map((d) => [d, SEMAINE.find((j) => j.date === d)!.type]));
const aj = (action: AjustementApplique["action"], date: string, vers?: string): AjustementApplique =>
  ({ action, date, ...(vers ? { vers } : {}), types: typesDe(date, ...(vers ? [vers] : [])), appliqueLe: "2026-11-02T08:00:00Z" });
const TEXTE = "Ta séance de VMA tombe trop près de ton seuil : la décaler te laisse un jour de plus pour récupérer.";
const jours: JourPlan[] = SEMAINE.map((d) => ({ date: d.date, type: d.type, title: d.title }));

console.log("\nLA PROPOSITION — « Appliquer » seulement sur ce que le moteur accepterait");

test("décaler et échanger exigent le second jour, dans le plan", () => {
  const c = contraintesDe(jours, 2, []);
  assert.equal(validerAjustement({ action: "decaler", date: "2026-11-04", texte: TEXTE }, c).ok, false, "décalage sans jour d'arrivée accepté");
  assert.equal(validerAjustement({ action: "decaler", date: "2026-11-04", vers: "2026-11-20", texte: TEXTE }, c).ok, false, "jour d'arrivée hors du plan accepté");
  const v = validerAjustement({ action: "decaler", date: "2026-11-04", vers: "2026-11-05", texte: TEXTE }, c);
  assert.ok(v.ok && v.ajustement.vers === "2026-11-05", "un décalage valable vers un repos est refusé, ou perd son jour d'arrivée");
});

test("on ne décale que vers un repos, on n'échange qu'entre deux séances, on n'allège pas un repos", () => {
  const c = contraintesDe(jours, 2, []);
  assert.equal(validerAjustement({ action: "decaler", date: "2026-11-04", vers: "2026-11-06", texte: TEXTE }, c).ok, false, "décalage sur un jour déjà occupé");
  assert.equal(validerAjustement({ action: "echanger", date: "2026-11-03", vers: "2026-11-05", texte: TEXTE }, c).ok, false, "échange avec un repos");
  assert.equal(validerAjustement({ action: "alleger", date: "2026-11-02", texte: TEXTE }, c).ok, false, "allègement d'un repos");
  assert.equal(validerAjustement({ action: "decaler", date: "2026-11-02", vers: "2026-11-05", texte: TEXTE }, c).ok, false, "déplacement d'un repos");
});

test("la proposition qui enchaînerait deux séances dures est écartée avant d'être montrée", () => {
  const c = contraintesDe(jours, 2, []);
  // Échanger le footing du vendredi et la VMA du mercredi : VMA vendredi, seuil samedi.
  assert.equal(validerAjustement({ action: "echanger", date: "2026-11-06", vers: "2026-11-04", texte: TEXTE }, c).ok, false);
  // Contre-épreuve : échanger les deux footings ne crée rien.
  assert.equal(validerAjustement({ action: "echanger", date: "2026-11-03", vers: "2026-11-06", texte: TEXTE }, c).ok, true);
});

test("budget qualité à zéro : seul un allègement est recevable", () => {
  const c = contraintesDe(jours, 0, ["fatigue"]);
  assert.equal(validerAjustement({ action: "decaler", date: "2026-11-04", vers: "2026-11-05", texte: TEXTE }, c).ok, false);
  assert.equal(validerAjustement({ action: "alleger", date: "2026-11-04", texte: TEXTE }, c).ok, true);
});

console.log("\nLE MOTEUR — la séance change vraiment, dans les cinq langues");

test("alléger : la séance devient la récupération du moteur, que la montre sait lire", () => {
  const r = appliquerAjustement(SEMAINE, aj("alleger", "2026-11-04"), OPTS);
  assert.ok(r.ok, r.ok ? "" : r.motif);
  const d = r.week[2];
  assert.equal(d.type, "Récup");
  assert.equal(d.title, PLAN_T.fr.recupTitre);
  assert.equal(d.detail, PLAN_T.fr.recupDetail(15, 10), "le détail n'est pas celui du moteur : la montre ne saurait pas le lire");
  assert.equal(d.i18n?.en?.title, PLAN_T.en.recupTitre, "l'anglais garde l'ancienne séance");
  assert.match(d.why, /à ta demande/, "l'athlète ne sait pas d'où vient le changement");
  assert.equal(d.confirmed, SEMAINE[2].confirmed);
});

test("décaler : la séance passe au jour de repos, le repos prend sa place, chaque jour garde son statut", () => {
  const r = appliquerAjustement(SEMAINE, aj("decaler", "2026-11-04", "2026-11-05"), OPTS);
  assert.ok(r.ok, r.ok ? "" : r.motif);
  assert.equal(r.week[2].type, "Repos");
  assert.equal(r.week[3].type, "VMA");
  assert.equal(r.week[3].detail, SEMAINE[2].detail, "la séance déplacée n'est plus celle du moteur");
  assert.equal(r.week[3].i18n?.en?.title, "VMA courte (en)");
  assert.equal(r.week[3].date, "2026-11-05");
  assert.equal(r.week[3].confirmed, SEMAINE[3].confirmed, "la confirmation suit la séance au lieu du jour");
  assert.match(r.week[3].why, /à ta demande/);
});

test("échanger : deux séances changent de jour", () => {
  // Footing du vendredi ⇄ sortie longue du dimanche (la sortie longue reste à côté du seuil, pas plus).
  const r = appliquerAjustement(SEMAINE, aj("echanger", "2026-11-06", "2026-11-08"), OPTS);
  assert.ok(r.ok, r.ok ? "" : r.motif);
  assert.equal(r.week[4].type, "Sortie longue");
  assert.equal(r.week[4].date, "2026-11-06");
  assert.equal(r.week[6].type, "Endurance");
  assert.equal(r.week[6].date, "2026-11-08");
  assert.match(r.week[6].i18n?.en?.why ?? "", /at your request/, "l'anglais ne dit pas d'où vient le changement");
});

console.log("\nLES GARDE-FOUS — refusés à chaque reconstruction, pas seulement au clic");

test("deux séances dures d'affilée : refusé", () => {
  const r = appliquerAjustement(SEMAINE, aj("echanger", "2026-11-06", "2026-11-04"), OPTS);
  assert.equal(r.ok, false, "VMA posée la veille du seuil");
});

test("un jour où l'athlète ne court pas : refusé", () => {
  const sansJeudi = { ...OPTS, joursCourables: [0, 1, 2, 3, 5, 6] }; // le 05/11/2026 est un jeudi (4)
  assert.equal(appliquerAjustement(SEMAINE, aj("decaler", "2026-11-04", "2026-11-05"), sansJeudi).ok, false);
});

test("le plan a changé depuis, le jour est passé ou le budget est tombé à zéro : refusé", () => {
  const change = { ...aj("decaler", "2026-11-04", "2026-11-05"), types: { "2026-11-04": "Seuil", "2026-11-05": "Repos" } };
  assert.equal(appliquerAjustement(SEMAINE, change, OPTS).ok, false, "appliqué sur un plan qui n'est plus celui qu'on a vu");
  assert.equal(appliquerAjustement(SEMAINE, aj("alleger", "2026-11-04"), { ...OPTS, from: "2026-11-05" }).ok, false, "jour gelé modifié");
  assert.equal(appliquerAjustement(SEMAINE, aj("decaler", "2026-11-04", "2026-11-05"), { ...OPTS, qBudget: 0 }).ok, false);
  assert.equal(appliquerAjustement(SEMAINE, aj("alleger", "2026-11-04"), { ...OPTS, qBudget: 0 }).ok, true, "l'allègement doit rester possible quand le budget est nul");
});

test("plusieurs ajustements : les valables tiennent, les passés sortent, les autres tombent avec leur motif", () => {
  const passe = { ...aj("alleger", "2026-11-03"), date: "2026-10-28", types: { "2026-10-28": "Endurance" } };
  const invalide = aj("echanger", "2026-11-06", "2026-11-04");
  const r = appliquerAjustements(SEMAINE, [passe, aj("decaler", "2026-11-04", "2026-11-05"), invalide], OPTS);
  assert.equal(r.gardes.length, 1);
  assert.equal(r.ecartes.length, 1, "un ajustement passé est compté comme refusé, ou un invalide est gardé");
  assert.equal(r.week[3].type, "VMA");
});

console.log("\nLES BRANCHEMENTS — le coach réapplique, la route ne croit rien du navigateur");

test("le coach réapplique les ajustements AVANT de publier le plan et de l'envoyer à la montre", () => {
  const src = codeNu("src/lib/ai/autoCoach.ts");
  const iApplique = src.indexOf("appliquerAjustements(semaineMoteur");
  const iPurge = src.indexOf(`.eq("type", "coach_session").gte("data->>date", from)`);
  assert.ok(iApplique > 0 && iPurge > iApplique, "les ajustements ne sont plus appliqués avant la publication");
  assert.match(src, /const week = ajuste\.week;/, "le plan publié n'est plus le plan ajusté");
  assert.match(src, /joursCourables: ctx\.availability\.days\.filter\(\(d\) => !ctx\.skippedWeekdays\.includes\(d\)\)/);
});

test("la route Appliquer : Premium, rien du navigateur, et « c'est fait » seulement après relecture", () => {
  const src = codeNu("src/app/api/ai/ajustement/appliquer/route.ts");
  assert.match(src, /exigeAcces\(supabase, user\.id, "plan_ia"\)/, "la route n'est plus réservée à Premium");
  assert.doesNotMatch(src, /req\.json\(|request\.json\(/, "la route lit de nouveau ce qu'envoie le navigateur");
  assert.match(src, /eq\("type", TYPE_PROPOSITION\)/, "la route n'applique plus la proposition mémorisée par le serveur");
  assert.match(src, /await autoCoachForUser\(admin/, "la route ne fait plus appliquer par le moteur");
  assert.match(src, /if \(!tenu\)/, "la route ne vérifie plus que la séance a changé");
  assert.match(src, /await ecrire\(anciens\)/, "un ajustement refusé par le moteur reste enregistré");
});

test("l'écran montre le changement concret, lu sur le plan et non sur la phrase du modèle", () => {
  const t = { recup25: "récup", deux: " : " } as never;
  assert.equal(changementConcret({ action: "decaler", date: "2026-11-04", vers: "2026-11-05" }, jours, t, "fr"), "VMA courte : mercredi → jeudi");
  assert.equal(changementConcret({ action: "alleger", date: "2026-11-08" }, jours, t, "fr"), "dimanche : Sortie longue → récup");
  assert.equal(changementConcret({ action: "decaler", date: "2026-11-04", vers: "2026-12-01" }, jours, t, "fr"), null, "un bouton s'affiche pour un jour hors du plan");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
