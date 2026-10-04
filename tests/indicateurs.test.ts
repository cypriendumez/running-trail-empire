/**
 * LES PAGES DÉTAILLÉES DES INDICATEURS (04/10/2026).
 *
 * Cyprien : « quand on clique sur ces modules, une page qui donne les valeurs précises et
 * qui explique pourquoi ». Ce que ces tests figent :
 *   - la page ne contredit JAMAIS la carte : même fonction, mêmes séances, même chiffre ;
 *   - aucune fiche n'affiche NaN, undefined ou Infinity, quelles que soient les données ;
 *   - sans données, la fiche le DIT au lieu d'afficher des zéros ;
 *   - les neuf cartes du tableau de bord mènent à leur page, et leurs liens internes restent
 *     cliquables ;
 *   - les séances sont classées facile / qualité d'après les zones MESURÉES par la montre.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { INDICATEURS, estIndicateur, type CleIndicateur, type Fiche } from "../src/lib/indicateurs/types";
import { ficheIndicateur, titresIndicateurs, ecartTemps, type DonneesFiche } from "../src/lib/indicateurs/fiches";
import { TEXTES } from "../src/lib/indicateurs/textes";
import { computeDiscipline, statsVfc, isQualityWorkout, etatDuJour } from "../src/lib/dashboard/discipline";
import { computeForme } from "../src/lib/dashboard/forme";
import { loadRisk, chargesQuotidiennes } from "../src/lib/running/fitness";
import { computeLoad } from "../src/lib/dashboard/charge";
import { computeWeeklyTrend } from "../src/lib/dashboard/semaines";
import type { Workout } from "../src/types";

let ok = 0, ko = 0;
function test(nom: string, f: () => void) {
  try { f(); ok++; console.log(`  ✓ ${nom}`); } catch (e) { ko++; console.error(`  ✗ ${nom}\n    ${(e as Error).message}`); }
}
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const jour = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const AUJ = jour(0);
const LANGUES = ["fr", "en", "de", "es", "pt"] as const;

function seance(n: number, km: number, x: Partial<Workout> = {}): Workout {
  return { id: `s${n}-${km}`, user_id: "u", title: `Sortie ${km} km`, type: "easy", sport: "run", source: "garmin", date: jour(n), duration_seconds: Math.round(km * 300), distance_km: km, elevation_gain_m: 20, avg_hr: 145, max_hr: 175, tss: Math.round(km * 5), hr_zone_seconds: [Math.round(km * 240), Math.round(km * 60), 0, 0, 0], ...x } as Workout;
}
function donnees(x: Partial<DonneesFiche> = {}): DonneesFiche {
  const seances = [
    seance(0, 12), seance(1, 8), seance(2, 16, { hr_zone_seconds: [900, 600, 1200, 1500, 600], type: "easy" }), seance(4, 10), seance(5, 25), seance(7, 10),
    seance(8, 14), seance(9, 8), seance(11, 18), seance(12, 10), seance(14, 22), seance(16, 12), seance(18, 9), seance(20, 24), seance(23, 10), seance(26, 30),
  ];
  return {
    lang: "fr", aujourdhui: AUJ, seances, historique: seances,
    vfc: Array.from({ length: 30 }, (_, i) => ({ date: jour(i), hrv_ms: 80 + (i % 5) * 3 - (i === 0 ? -6 : 0), physiological_state: "optimal" as const })),
    sommeil: [{ date: jour(0), sleep_score: 82, total_sleep_min: 470 }],
    charge: seances.map((w) => ({ date: w.date, tss: w.tss, type: w.type, duration_seconds: w.duration_seconds })),
    vma: { vma: 17.5, source: { type: "seances", date: jour(5), km: 25 } },
    objectif: { race: "Marathon de test", distanceKm: 42.195, raceDate: jour(-30), targetSeconds: 3 * 3600 + 5 * 60, targetTime: "3h05" },
    plan: null, fcRepos: 48,
    ...x,
  };
}
const VIDE = (): DonneesFiche => ({ lang: "fr", aujourdhui: AUJ, seances: [], historique: [], vfc: [], sommeil: [], charge: [], vma: { vma: 0, source: null }, objectif: null, plan: null, fcRepos: null });
const textes = (f: Fiche) => JSON.stringify(f);

console.log("\nCOHÉRENCE — la page dit le même chiffre que la carte");
test("Score de forme : même total que computeForme avec les mêmes entrées", () => {
  // Trois profils : objectif à peine tenable, objectif hors de portée (l'axe vitesse n'est
  // pas saturé à 100), pas d'objectif du tout (l'axe vitesse lit la VMA).
  const cibles = [3 * 3600 + 5 * 60, 2 * 3600 + 35 * 60, null];
  const totaux = new Set<number>();
  for (const cible of cibles) {
    const d = donnees(cible == null ? { objectif: null } : { objectif: { ...donnees().objectif!, targetSeconds: cible } });
    const disc = computeDiscipline(d.seances, d.vfc.slice(0, 14) as never, { sleep_score: 82 }, "optimal");
    const f = computeForme(d.seances, d.vma.vma, disc.recovery, disc.consistency, d.objectif ? { distanceKm: 42.195, targetSeconds: d.objectif.targetSeconds } : null);
    assert.equal(ficheIndicateur("forme", d).valeur, String(f.total), `cible ${cible}`);
    assert.equal(ficheIndicateur("discipline", d).valeur, String(disc.total));
    assert.ok(f.speed < 100 || cible !== cibles[1], "le profil ambitieux doit laisser l'axe vitesse sous 100");
    totaux.add(f.total);
  }
  assert.ok(totaux.size >= 2, "les trois profils donnent le même total : le test ne distingue rien");
});

test("VFC, ACWR, charge et vitesse : les mêmes valeurs que les cartes", () => {
  const d = donnees();
  assert.equal(ficheIndicateur("vfc", d).valeur, String(statsVfc(d.vfc).dernier));
  assert.equal(ficheIndicateur("acwr", d).valeur, loadRisk(d.seances).acwr.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const { tsb } = computeLoad(d.charge, d.aujourdhui);
  assert.match(ficheIndicateur("charge", d).valeur, new RegExp(`${Math.abs(Math.round(tsb))}$`));
  assert.equal(ficheIndicateur("vitesse", d).valeur, "17,5");
});

test("la charge quotidienne de la page est celle que l'ACWR additionne", () => {
  // Une séance CHAQUE jour, charge différente : une fenêtre décalée d'un jour se voit.
  const d = donnees({ seances: Array.from({ length: 30 }, (_, i) => seance(i, 6 + (i % 7) * 2)) });
  const q = chargesQuotidiennes(d.seances, 28);
  assert.equal(q.length, 28);
  assert.ok(q.every((v) => v > 0), "un jour couru compté à zéro");
  const r = (q.slice(0, 7).reduce((a, b) => a + b, 0)) / (q.reduce((a, b) => a + b, 0) / 4);
  assert.equal(Math.round(r * 100) / 100, loadRisk(d.seances).acwr);
});

test("le volume par semaine est celui de la carte (12 semaines, la dernière en cours)", () => {
  const t = computeWeeklyTrend(donnees().seances, 12);
  assert.equal(t.length, 12);
  assert.equal(t[11].isCurrent, true);
  assert.ok(t.reduce((a, s) => a + s.km, 0) > 0);
});

console.log("\nROBUSTESSE — jamais de NaN, jamais de zéro trompeur");
test("les neuf fiches, dans les cinq langues, ne contiennent ni NaN, ni undefined, ni Infinity", () => {
  for (const lang of LANGUES) for (const cle of INDICATEURS) {
    for (const d of [donnees({ lang }), VIDE()]) {
      const f = ficheIndicateur(cle, { ...d, lang });
      assert.equal(f.cle, cle);
      assert.ok(f.titre && f.mesure && f.pourquoi, `${lang}/${cle} : texte manquant`);
      assert.doesNotMatch(textes(f), /NaN|undefined|Infinity|\[object Object\]/, `${lang}/${cle}`);
    }
  }
});

test("sans données, chaque fiche le dit (pas de « 0 » présenté comme une mesure)", () => {
  for (const cle of INDICATEURS) {
    const f = ficheIndicateur(cle, VIDE());
    assert.ok(f.vide, `${cle} affiche une valeur sans aucune donnée`);
    assert.equal(f.composantes, undefined, `${cle} : des composantes sans données`);
  }
});

test("données hostiles (dates illisibles, zones corrompues, VMA négative) : rien ne plante", () => {
  const d = donnees({ seances: [seance(0, 10, { date: "pas-une-date" }), seance(1, Number.NaN as never, { title: "Sortie sans distance", tss: Number.NaN as never }), seance(2, 8, { hr_zone_seconds: [Infinity, -5, Number.NaN, 0, 0] as never })], vma: { vma: -3, source: null } });
  for (const cle of INDICATEURS) assert.doesNotMatch(textes(ficheIndicateur(cle, d)), /NaN|Infinity/, cle);
});

console.log("\nCONTENU — ce qu'un client doit trouver");
test("chaque fiche remplie montre son calcul, des conseils, et ce qu'elle mesure", () => {
  for (const cle of INDICATEURS) {
    const f = ficheIndicateur(cle, donnees());
    if (f.vide) continue;
    assert.ok(f.calcul.length >= 2, `${cle} : calcul trop court`);
    assert.ok(f.conseils.length >= 1, `${cle} : aucun conseil`);
    assert.ok(f.verdict.length > 20, `${cle} : verdict vide`);
  }
});

test("Score de forme : le premier conseil vise le point faible que le verdict désigne", () => {
  // Constaté le 04/10 : « À travailler : Endurance » dans le verdict, puis « Profil
  // équilibré » en conseil. Deux profils, deux points faibles différents.
  const t = TEXTES.fr.forme;
  const parAxe: Record<string, (c: string) => boolean> = {
    [t.endurance]: (c) => c === t.conseilEnduranceAffutage || /sortie longue/i.test(c),
    [t.vitesse]: (c) => c === t.conseilVitesse,
    [t.recuperation]: (c) => c === t.conseilRecuperation,
    [t.regularite]: (c) => c === t.conseilRegularite,
  };
  const vus = new Set<string>();
  for (const d of [donnees(), donnees({ vma: { vma: 11, source: null }, seances: donnees().seances.slice(0, 5) })]) {
    const f = ficheIndicateur("forme", d);
    const faible = f.composantes!.slice().sort((a, b) => Number(a.valeur) - Number(b.valeur))[0];
    assert.match(f.verdict, new RegExp(faible.libelle), "le verdict ne nomme pas le point faible");
    assert.ok(parAxe[faible.libelle](f.conseils[0]), `point faible ${faible.libelle}, premier conseil : ${f.conseils[0]}`);
    vus.add(faible.libelle);
  }
  assert.equal(vus.size, 2, "les deux profils doivent avoir des points faibles différents");
});

test("Vitesse : six distances, cinq allures d'entraînement + l'allure marathon prédite", () => {
  const f = ficheIndicateur("vitesse", donnees());
  assert.equal(f.tableaux![0].lignes.length, 6);
  assert.equal(f.tableaux![1].lignes.length, 6);
  for (const lang of LANGUES) assert.match(ficheIndicateur("vitesse", donnees({ lang })).tableaux![1].lignes[0].cellules[1], /60 – 70 %/, `${lang} : le footing doit rester lent (60–70 % de VMA)`);
  assert.doesNotMatch(f.verdict, /— D'/, "la source garde sa majuscule en milieu de phrase");
});

test("Objectif : J-x, prédit et projeté ; l'écart d'allure se lit PAR KILOMÈTRE, puis sur la course", () => {
  const f = ficheIndicateur("objectif", donnees());
  assert.equal(f.valeur, "J-30");
  // L'écart total (« 1 min ») affiché seul sous « Allure visée » se lisait « 1 min au kilomètre ».
  const allure = f.composantes!.find((c) => c.unite === "/km")!;
  assert.match(allure.detail, /^\d+,\d s\/km (plus vite|de marge).*, soit (\d+ s|\d+ min( \d\d)?) sur la course\.$/, allure.detail);
  // Et les deux chiffres se tiennent : l'écart par kilomètre × la distance = l'écart sur la course.
  const m = allure.detail.match(/^(\d+),(\d) s\/km.*soit (?:(\d+) s|(\d+) min(?: (\d\d))?) sur/)!;
  const parKm = Number(`${m[1]}.${m[2]}`), total = m[3] != null ? Number(m[3]) : Number(m[4]) * 60 + Number(m[5] ?? 0);
  assert.ok(Math.abs(parKm * 42.195 - total) <= 0.05 * 42.195 + 0.5, `${parKm} s/km × 42,195 km ≠ ${total} s`);
  assert.doesNotMatch(textes(f), /\b0:\d\d\b/, "« 0:22 » au lieu de « 22 s »");
  assert.ok(ficheIndicateur("objectif", donnees({ objectif: null })).vide);
  assert.ok(ficheIndicateur("objectif", donnees({ objectif: { ...donnees().objectif!, raceDate: jour(3) } })).vide, "une course passée n'est plus un objectif");
});

test("un écart de temps se lit comme on le dit : « 22 s », « 1 min », « 1 min 05 »", () => {
  assert.equal(ecartTemps(22.4), "22 s");
  assert.equal(ecartTemps(-60), "1 min");
  assert.equal(ecartTemps(65), "1 min 05");
  assert.equal(ecartTemps(3725), "1h02");
  assert.equal(ecartTemps(Number.NaN), "0 s");
});

test("les titres des neuf fiches existent dans les cinq langues", () => {
  for (const lang of LANGUES) {
    const t = titresIndicateurs(lang);
    for (const cle of INDICATEURS) assert.ok(t[cle]?.trim(), `${lang}/${cle}`);
    assert.ok(TEXTES[lang].commun.vide.length > 20);
  }
});

console.log("\nCLASSEMENT FACILE / QUALITÉ — les zones mesurées priment");
test("une séance typée « easy » mais passée en Z3–Z5 est une séance de QUALITÉ", () => {
  // Le 29/09 de Cyprien : 23,7 km à 3'45/km, typé « easy » par la montre, 93 % en Z3+.
  assert.equal(isQualityWorkout(seance(0, 23.7, { type: "easy", hr_zone_seconds: [100, 300, 2400, 2500, 50] })), true);
  assert.equal(isQualityWorkout(seance(0, 12, { type: "easy", hr_zone_seconds: [2800, 600, 300, 200, 0] })), false, "4 % en Z4 : facile");
  assert.equal(isQualityWorkout(seance(0, 12, { type: "easy", hr_zone_seconds: [2000, 700, 1200, 0, 0] })), true, "31 % en Z3 : qualité");
  // Des fractions courtes : 14 % en Z4–Z5, récupérations en Z1 — le Z3 seul (16 %) ne le dirait pas.
  assert.equal(isQualityWorkout(seance(0, 10, { type: "easy", hr_zone_seconds: [2400, 700, 100, 500, 0] })), true, "14 % en Z4+ : qualité");
  // Une case illisible est ignorée ; elle ne fait pas perdre la mesure des autres zones.
  assert.equal(isQualityWorkout(seance(0, 10, { type: "easy", hr_zone_seconds: [1000, "x", 0, 900, 0] as never })), true);
  // Moins de 10 minutes mesurées : on retombe sur le type et l'effet d'entraînement.
  assert.equal(isQualityWorkout(seance(0, 2, { type: "interval", hr_zone_seconds: [300, 0, 0, 0, 0] })), true);
  assert.equal(isQualityWorkout(seance(0, 8, { type: "easy", hr_zone_seconds: null })), false);
});

test("l'état du jour : VFC au-dessus de la base et bon sommeil → « top »", () => {
  assert.equal(etatDuJour(5, 80, 85), "top");
  assert.equal(etatDuJour(3, 80, 60), "top", "un signal bon, un neutre : la moyenne 0,5 suffit");
  assert.equal(etatDuJour(-2, 80, 60), "correct", "−2,5 % sous la base reste dans la marge de 6 %");
  assert.equal(etatDuJour(-10, 80, 60), "repos", "un signal mauvais, un neutre : la moyenne −0,5 suffit");
  assert.equal(etatDuJour(-10, 80, 40), "repos");
  assert.equal(etatDuJour(null, null, null), "aucun");
});

console.log("\nBRANCHEMENTS");
test("la route existe, refuse une clé inconnue et lit les mêmes séances que la carte", () => {
  assert.ok(existsSync("src/app/dashboard/indicateurs/[cle]/page.tsx"));
  const page = code("src/app/dashboard/indicateurs/[cle]/page.tsx");
  assert.match(page, /if \(!estIndicateur\(cle\)\) notFound\(\);/);
  assert.equal(estIndicateur("forme"), true);
  assert.equal(estIndicateur("../admin"), false);
  const d = code("src/lib/indicateurs/donnees.ts");
  assert.match(d, /from\("workouts"\)\.select\("\*"\)\.eq\("user_id", userId\)\.order\("date", \{ ascending: false \}\)\.limit\(40\)/, "la page ne lit plus les 40 séances de la carte");
  assert.match(d, /vmaAffichee\(\{/);
  assert.match(code("src/app/dashboard/page.tsx"), /vmaAffichee\(\{/);
  // La carte VFC et la page partagent leur calcul (base 14 j, écart, âge de la mesure).
  assert.match(code("src/components/dashboard/BentoDashboard.tsx"), /const sv = statsVfc\(hrv\);/);
});

test("les neuf cartes du tableau de bord mènent à leur fiche ; leurs liens internes passent au-dessus", () => {
  const b = code("src/components/dashboard/BentoDashboard.tsx");
  for (const cle of INDICATEURS) assert.match(b, new RegExp(`<VersFiche cle="${cle}"`), `la carte « ${cle} » ne mène nulle part`);
  assert.match(b, /href=\{`\/dashboard\/indicateurs\/\$\{cle\}`\}/);
  assert.match(b, /className="absolute inset-0 z-\[1\] rounded-3xl/);
  assert.match(b, /<Link href="\/dashboard\/health" className="relative z-\[3\]/, "« Voir les recommandations » serait recouvert par le lien de la carte");
  assert.match(b, /<Link href="\/dashboard\/calendrier" className="relative z-\[3\]/, "« Voir mon plan » serait recouvert par le lien de la carte");
});

test("un lien peut ouvrir l'onglet Nutrition de Santé", () => {
  assert.match(code("src/components/health/HealthCenter.tsx"), /new URLSearchParams\(window\.location\.search\)\.get\("onglet"\)/);
  assert.ok(ficheIndicateur("objectif", donnees()).liens!.some((l) => l.href === "/dashboard/health?onglet=nutrition"));
});

test("aucun lien d'une fiche ne pointe vers une page qui n'existe pas", () => {
  for (const cle of INDICATEURS) for (const l of ficheIndicateur(cle, donnees()).liens ?? []) {
    const chemin = l.href.split("?")[0].replace(/^\/dashboard\/?/, "");
    assert.ok(existsSync(`src/app/dashboard/${chemin}/page.tsx`) || existsSync(`src/app/dashboard/${chemin}page.tsx`) || (chemin === "" && existsSync("src/app/dashboard/page.tsx")), `${cle} → ${l.href}`);
  }
});

console.log(`\n${ok} test(s) des indicateurs passé(s), ${ko} échec(s)`);
if (ko) process.exit(1);
