/**
 * LE TABLEAU DE BORD DIT CE QUI EST VRAI, ET NE SE MASQUE PAS LUI-MÊME (05/11/2026).
 *
 * Relu sur le compte de Cyprien (J+11 du marathon de Lille, plus de VFC depuis le 30/10) :
 *  · « 189 bpm — Fréquence cardiaque » dans la carte VFC : la FC MOYENNE du marathon,
 *    reprise faute de FC de repos, lue comme une donnée du jour ;
 *  · « Connecte ta montre » en tête, alors qu'elle est reliée et qu'une récupération
 *    était en cours (la seule consigne qui valait ce jour-là) ;
 *  · l'âge de la VFC calculé sur l'horloge de la machine : rendu serveur (UTC) et
 *    navigateur (Paris) différaient entre minuit et 1 h → erreur React #418 ;
 *  · la pastille « Détails » posée sur le contenu de cinq cartes.
 * Crash-test des calculs : une VFC datée dans le futur passait pour « fraîche », un
 * score de sommeil NaN pour de la fatigue.
 *
 *   npx tsx tests/tableau-de-bord-coherence.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { statsVfc, etatDuJour, etatPhysiologique } from "../src/lib/dashboard/discipline";
import { computeForme } from "../src/lib/dashboard/forme";
import { T } from "../src/lib/i18n/translations";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
/** Le source sans ses commentaires — sans couper les `://` des adresses. */
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const BENTO = codeNu("src/components/dashboard/BentoDashboard.tsx");

console.log("\nÂGE DE LA VFC : LE JOUR DE L'ATHLÈTE, PAS L'HORLOGE DE LA MACHINE");

test("même jour civil, même âge, quelle que soit l'heure de la machine", () => {
  const hrv = [{ date: "2026-10-30", hrv_ms: 87 }];
  // 23 h 30 UTC le 05/11 (serveur) = 00 h 30 le 06/11 à Paris (navigateur) : le jour
  // de l'athlète est le 06/11 des deux côtés, l'âge doit l'être aussi.
  const serveur = statsVfc(hrv, Date.parse("2026-11-05T23:30:00Z"), "2026-11-06");
  const navigateur = statsVfc(hrv, Date.parse("2026-11-05T23:30:00Z") + 3_600_000, "2026-11-06");
  assert.equal(serveur.jours, 7);
  assert.equal(navigateur.jours, serveur.jours);
});

test("le tableau de bord passe son jour à statsVfc et à etatPhysiologique", () => {
  assert.match(BENTO, /statsVfc\(hrv, Date\.now\(\), jour\)/, "l'âge de la VFC suit de nouveau l'horloge de la machine (#418 la nuit)");
  assert.match(BENTO, /etatPhysiologique\(hrv, Date\.now\(\), jour\)/, "l'état physiologique suit de nouveau l'horloge de la machine");
});

test("une VFC datée APRÈS aujourd'hui n'est pas la mesure du matin", () => {
  const s = statsVfc([{ date: "2027-01-10", hrv_ms: 250 }], Date.now(), "2026-11-05");
  assert.equal(s.fraiche, false, `âge ${s.jours} jugé frais`);
  assert.equal(etatPhysiologique([{ date: "2027-01-10", hrv_ms: 250, physiological_state: "recovery" }], Date.now(), "2026-11-05"), "optimal",
    "un état venu du futur décide encore de la séance");
});

test("un âge négatif ne s'affiche jamais (« vieille de -57 jours »)", () => {
  assert.match(BENTO, /hrvJours != null && hrvJours > 0 &&/);
});

console.log("\nLA PHRASE DU JOUR");

test("un score de sommeil invalide n'est pas un signal de fatigue", () => {
  assert.equal(etatDuJour(null, null, Number.NaN), "aucun");
  assert.equal(etatDuJour(Number.NaN, 90, 80), "top");
});

test("montre reliée mais muette : on ne lui demande pas de connecter sa montre", () => {
  assert.match(BENTO, /cle === "dash\.ready\.none" && montreReliee \? "dash\.ready\.muette" : cle/);
  assert.match(codeNu("src/app/dashboard/page.tsx"), /montreReliee=\{!!\(profileRes\.data as \{ intervals_api_key\?: string \| null \} \| null\)\?\.intervals_api_key\}/,
    "la page ne dit plus au tableau de bord qu'une montre est reliée");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const dico = T[lang] as Record<string, string>;
    assert.ok(dico["dash.ready.muette"], `dash.ready.muette manque en ${lang}`);
    assert.doesNotMatch(dico["dash.ready.muette"], /connect|verbind|liga/i, `${lang} demande encore de connecter la montre`);
  }
});

console.log("\nCE QUE LES CARTES AFFICHENT");

test("la vignette de FC ne montre que la FC de repos, jamais la FC moyenne d'une séance", () => {
  const ligne = BENTO.split("\n").find((l) => /const restingHr =/.test(l)) ?? "";
  assert.ok(ligne, "restingHr introuvable");
  assert.doesNotMatch(ligne, /avg_hr|workouts/, "la FC moyenne de la dernière séance repasse pour la FC du jour");
  assert.match(BENTO, /fr: \{ hr: "FC de repos" \}/);
});

test("l'en-tête dit sur quelle distance porte l'objectif", () => {
  assert.match(BENTO, /objective\.distanceKm > 0 && <>\{objective\.distanceKm\.toLocaleString\(lang\)\} km · <\/>/);
});

test("aucune pastille flottante ne se pose sur le contenu des cartes", () => {
  const vers = BENTO.slice(BENTO.indexOf("function VersPage("), BENTO.indexOf("function VersFiche("));
  assert.ok(vers.length > 0);
  assert.doesNotMatch(vers, /<span[^>]*absolute/, "une pastille positionnée en absolu revient dans les cartes");
  assert.match(vers, /title=\{l\}/, "le lien de la carte n'annonce plus « Détails »");
});

test("libellé et pourcentage des barres de forme ne se collent plus", () => {
  assert.match(BENTO, /mb-1 flex justify-between gap-2 text-xs/);
});

console.log("\nLA CARTE DU RAIL (score discipline)");

test("« Voir les recommandations » ouvre les conseils de CE score, pas le Kiné IA", () => {
  // Constaté le 06/11/2026 : le bouton menait à /dashboard/health (Kiné IA), sans rapport
  // avec le score, alors que la carte entière ouvrait déjà sa page détaillée.
  assert.match(BENTO, /<Link href="\/dashboard\/indicateurs\/discipline#conseils" className="relative z-\[3\]/);
  assert.doesNotMatch(BENTO, /href="\/dashboard\/health"/, "un lien du tableau de bord renvoie de nouveau au Kiné IA");
  assert.match(codeNu("src/components/indicateurs/FicheIndicateur.tsx"), /<Section id="conseils" icone=\{Lightbulb\} titre=\{c\.conseils\}>/,
    "la section Conseils n'a plus d'ancre : le bouton tombe en haut de page");
});

test("le titre de la carte suit l'état du jour, dans les cinq langues", () => {
  // « Prêt à performer » était écrit en dur, au-dessus de « Récupération… pas d'intensité ».
  assert.doesNotMatch(BENTO, /\{rl\.ready\}/, "le titre figé « Prêt à performer » revient");
  assert.match(BENTO, /\(TITRES_ETAT\[lang\] \?\? TITRES_ETAT\.fr\)\[readiness\.cle\]/);
  const table = BENTO.slice(BENTO.indexOf("const TITRES_ETAT"), BENTO.indexOf("};", BENTO.indexOf("const TITRES_ETAT")));
  const cles = ["dash.ready.recup", "dash.ready.rest", "dash.ready.top", "dash.ready.topSansQualite", "dash.ready.ok", "dash.ready.none"];
  for (const lang of ["fr", "en", "de", "es", "pt"]) {
    const ligne = table.split("\n").find((l) => l.trim().startsWith(`${lang}: {`)) ?? "";
    for (const c of cles) assert.ok(ligne.includes(`"${c}":`), `${c} sans titre en ${lang}`);
  }
  assert.match(table, /fr: \{ "dash\.ready\.recup": "En récupération"/, "en récupération, la carte ne le dit plus");
  assert.match(BENTO, /return \{ accent: "#0d9488", tagline: phrase, cle \};/);
});

console.log("\nCRASH-TEST DU SCORE DE FORME");

test("aucune entrée absurde ne fait sortir un axe de 0–100 ni n'en fait un NaN", () => {
  const seances = [[], [{ date: "2026-11-05", sport: "run", distance_km: Number.NaN }], [{ date: "x", sport: "run", distance_km: -5 }],
    Array.from({ length: 200 }, (_, i) => ({ date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, sport: "run", distance_km: 1000 }))];
  const objectifs = [null, { distanceKm: 0, targetSeconds: 0 }, { distanceKm: 5, targetSeconds: 1 }, { distanceKm: Number.NaN, targetSeconds: Number.NaN }, { distanceKm: 1000, targetSeconds: 100 }];
  for (const w of seances) for (const vma of [0, -3, Number.NaN, 20.1, 1e9]) for (const o of objectifs) for (const r of [-50, 72, 500, Number.NaN]) {
    const f = computeForme(w, vma, r, r, o, "2026-11-05");
    for (const c of ["total", "endurance", "speed", "recovery", "regularity"] as const)
      assert.ok(f[c] >= 0 && f[c] <= 100, `${c} = ${f[c]} (vma ${vma}, r ${r}, objectif ${JSON.stringify(o)})`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
