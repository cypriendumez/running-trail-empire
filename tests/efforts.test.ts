/**
 * MEILLEURS EFFORTS — le passage le plus rapide, pas le premier kilomètre.
 *
 * Un athlète qui s'échauffe 2 km puis accélère n'a pas son meilleur 5 km au départ :
 * afficher le premier découpage le lui volerait. C'est toute la différence entre un
 * « temps intermédiaire » et un « meilleur effort ».
 *
 * ⚠️ VÉRITÉ TERRAIN. Le calcul est confronté aux chiffres publiés par Strava pour la
 * MÊME sortie (Lambersart, 05/09/2026, 7,30 km) : 1 mile en 7:57 à 4:56/km, 5 km en
 * 25:05 à 5:01/km. Notre 1 mile tombe au chrono exact ; notre 5 km donne 25:02, soit
 * 3 s d'écart (0,2 %) — Strava lisse son flux de distance, nous mesurons sur les points
 * bruts. On fige donc une TOLÉRANCE, pas une égalité : prétendre à la seconde près
 * serait une précision qu'on n'a pas.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { meilleursEfforts, chrono, allure, DISTANCES } from "../src/lib/activities/efforts";
import type { TrackPoint } from "../src/lib/segments/geo";
import { cap, flechesLeLongDe, BASE_CAP_M } from "../src/lib/activities/fleches";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}

/** Trace synthétique : `n` points plein est, à `mParPoint` mètres et `sParPoint` secondes. */
function ligne(n: number, mParPoint: number, sParPoint: number | ((i: number) => number)): TrackPoint[] {
  const pts: TrackPoint[] = [];
  let lon = 0, t = 0;
  // À l'équateur, 1° de longitude ≈ 111 320 m.
  for (let i = 0; i < n; i++) {
    pts.push({ lat: 0, lon, t });
    lon += mParPoint / 111320;
    t += typeof sParPoint === "function" ? sParPoint(i) : sParPoint;
  }
  return pts;
}
const par = (e: ReturnType<typeof meilleursEfforts>, cle: string) => e.find((x) => x.cle === cle);

console.log("\nLE CALCUL — sur une trace dont on connaît la réponse");

test("une allure constante donne le chrono attendu", () => {
  // 1 200 points de ~5 m à 1 s : ~6 km à ~200 s/km, donc 1 km ≈ 3:20 et 5 km ≈ 16:40.
  // ⚠️ TOLÉRANCE DE 2 s ASSUMÉE : le décor convertit les degrés en mètres avec
  // 111 320 m/°, alors que `haversine` utilise son propre rayon terrestre. L'écart est
  // dans le DÉCOR, pas dans le calcul — lequel est vérifié contre les chiffres publiés
  // par Strava pour une sortie réelle (1 mile au chrono exact).
  const e = meilleursEfforts(ligne(1201, 5, 1));
  assert.ok(Math.abs(par(e, "1km")!.secondes - 200) <= 2, `1 km : ${par(e, "1km")!.secondes} s`);
  assert.ok(Math.abs(par(e, "5km")!.secondes - 1000) <= 2, `5 km : ${par(e, "5km")!.secondes} s`);
});

test("c'est le passage le PLUS RAPIDE, pas le premier", () => {
  // 3 km lents (2 s/point) puis 3 km rapides (1 s/point), 5 m par point.
  const e = meilleursEfforts(ligne(1201, 5, (i) => (i < 600 ? 2 : 1)));
  assert.equal(par(e, "1km")!.secondes, 200, "le meilleur kilomètre est dans la partie rapide");
});

test("une distance non couverte n'est PAS rendue", () => {
  const e = meilleursEfforts(ligne(250, 5, 1)); // ~1,25 km : le 1 km passe, le 5 km non
  assert.ok(par(e, "1km"), "1 km doit être là");
  assert.equal(par(e, "5km"), undefined, "un 5 km inventé sur une sortie d'1 km");
  assert.equal(par(e, "marathon"), undefined);
});

test("l'interpolation est vraiment faite", () => {
  // Points de 300 m : sans interpolation, le 1 km ne pourrait valoir qu'un multiple de
  // 300 m (donc 1 200 m parcourus, 4 unités de temps). Avec, on doit tomber juste.
  const e = meilleursEfforts(ligne(20, 300, 30));
  assert.equal(par(e, "1km")!.secondes, 100, "1 000 m à 10 m/s = 100 s, pas 120");
});

test("une trace inexploitable ne rend rien, elle n'invente pas", () => {
  assert.deepEqual(meilleursEfforts([]), []);
  assert.deepEqual(meilleursEfforts(ligne(2, 5, 1)), []);
  // Horloge qui recule : la trace est corrompue, on refuse en bloc plutôt que de
  // produire des durées négatives.
  const cassee = ligne(400, 5, 1);
  cassee[200] = { ...cassee[200], t: 0 };
  assert.deepEqual(meilleursEfforts(cassee), [], "une horloge qui recule doit être refusée");
  const nan = ligne(400, 5, 1);
  nan[100] = { ...nan[100], lat: Number.NaN };
  assert.ok(!JSON.stringify(meilleursEfforts(nan)).includes("null"), "un point illisible ne doit pas contaminer");
});

test("l'allure rendue est cohérente avec le chrono", () => {
  const e = par(meilleursEfforts(ligne(1201, 5, 1)), "5km")!;
  assert.equal(e.allureSecKm, Math.round((e.secondes / e.m) * 1000));
  assert.equal(e.allureSecKm, 200);
});

console.log("\nMISE EN FORME");

test("un chrono se lit", () => {
  assert.equal(chrono(1505), "25:05");
  assert.equal(chrono(477), "7:57");
  assert.equal(chrono(4782), "1 h 19:42");
  assert.equal(chrono(-1), "—");
  assert.equal(chrono(Number.NaN), "—");
});

test("une allure se lit", () => {
  assert.equal(allure(301), "5:01 /km");
  assert.equal(allure(0), "—");
});

console.log("\nLES DISTANCES DE RÉFÉRENCE");

test("le mile et le semi sont à leur vraie longueur", () => {
  // Un mile arrondi à 1 600 m fausserait le chrono de 3 secondes à 5:00/km.
  assert.equal(DISTANCES.find((d) => d.cle === "1mile")!.m, 1609.34);
  assert.equal(DISTANCES.find((d) => d.cle === "semi")!.m, 21097.5);
  assert.equal(DISTANCES.find((d) => d.cle === "marathon")!.m, 42195);
  // …et elles sont TRADUITES, pas écrites en dur dans l'écran.
  const i18n = readFileSync("src/lib/i18n/translations.ts", "utf8");
  for (const d of DISTANCES)
    assert.equal(i18n.split(`"eff.${d.cle}"`).length - 1, 5, `eff.${d.cle} absente des 5 langues`);
});

console.log("\nBRANCHEMENT — la flèche, les efforts, et rien d'inventé");

test("la flèche de la carte ouvre le survol DE CETTE sortie", () => {
  const src = codeOf("src/app/dashboard/activite/page.tsx");
  assert.match(src, /survolHref = `\/dashboard\/survol\?w=\$\{encodeURIComponent\(wk\.id\)\}`/,
    "le lien ne cible plus la séance affichée");
  const blocs = codeOf("src/components/activity/StravaBlocks.tsx");
  assert.match(blocs, /survolHref && \(/, "le bouton de lecture a disparu de la carte");
  assert.match(blocs, /<Play /, "l'icône de lecture n'est plus là");
});

test("le survol VA CHERCHER la sortie demandée", () => {
  // La liste du survol est plafonnée à 300 traces triées par nombre de points : une
  // sortie absente de ce lot faisait retomber sur `sorties[0]`, donc ouvrait une AUTRE
  // activité sans le dire. Depuis qu'un bouton y mène, ce cas n'est plus théorique.
  const src = codeOf("src/app/dashboard/survol/page.tsx");
  assert.match(src, /if \(!choisie && w\) \{/, "la sortie demandée n'est plus recherchée hors liste");
  assert.match(src, /\.eq\("id", w\)\.eq\("user_id", user\.id\)/,
    "la recherche hors liste n'est plus bornée à l'utilisateur");
  assert.doesNotMatch(src, /const choisie = sorties\.find\(\(s\) => s\.id === w\) \?\? sorties\[0\];/,
    "l'ancien repli silencieux est revenu");
});

test("aucune métrique NULLE n'est affichée", () => {
  // Mesuré sur 60 séances : `training_effect` et `ground_contact_ms` sont nuls partout.
  // Les afficher reviendrait à inventer une donnée que la montre n'envoie pas.
  const src = codeOf("src/app/dashboard/activite/page.tsx");
  for (const mort of ["training_effect", "ground_contact_ms"])
    assert.doesNotMatch(src, new RegExp(`forme\\.push[^;]*${mort}`), `${mort} est nul sur toutes les séances`);
  assert.match(src, /const nb = \(v: unknown\)[^;]*Number\.isFinite\(v\) && v > 0 \? v : null/,
    "le garde « mesure absente ≠ zéro » a disparu");
});

test("les colonnes lues sont DEMANDÉES à la base", () => {
  // Sans elles dans le select, le bloc « forme » serait vide sans la moindre erreur.
  const src = codeOf("src/app/dashboard/activite/page.tsx");
  for (const c of ["max_hr", "gap_min_km", "tss", "intensity_pct", "stride_length_m", "vertical_ratio_pct"])
    assert.ok(new RegExp(`const champs[\\s\\S]{0,400}${c}`).test(src), `${c} lue mais jamais demandée`);
});

test("les libellés de forme sont traduits, pas écrits en dur", () => {
  const src = codeOf("src/app/dashboard/activite/page.tsx");
  assert.doesNotMatch(src, /label: "Longueur de foulée"/, "libellé français en dur");
  const i18n = readFileSync("src/lib/i18n/translations.ts", "utf8");
  for (const c of ["frm.gap", "frm.foulee", "frm.ratio", "frm.tss"])
    assert.equal(i18n.split(`"${c}"`).length - 1, 5, `${c} absente des 5 langues`);
});

console.log("\nLA CARTE — dans quel sens la sortie a-t-elle été courue ?");

test("le cap est juste, et corrigé de la latitude", () => {
  assert.equal(Math.round(cap({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })), 0, "plein nord");
  assert.equal(Math.round(cap({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })), 90, "plein est");
  assert.equal(Math.round(cap({ lat: 0, lon: 0 }, { lat: -1, lon: 0 })), 180, "plein sud");
  assert.equal(Math.round(cap({ lat: 0, lon: 0 }, { lat: 0, lon: -1 })), 270, "plein ouest");
  // ⚠️ À 60° de latitude, un degré de longitude ne vaut que la moitié d'un degré de
  // latitude : sans la correction, ce déplacement paraîtrait à 45° au lieu de ~27°.
  const nordEst = cap({ lat: 60, lon: 0 }, { lat: 60.01, lon: 0.01 });
  assert.ok(Math.abs(nordEst - 26.6) < 2, `cap ${nordEst.toFixed(1)}° : la latitude n'est pas prise en compte`);
  assert.equal(cap({ lat: 1, lon: 1 }, { lat: 1, lon: 1 }), 0, "deux points identiques ne pointent nulle part");
});

test("les chevrons suivent la DISTANCE, pas le nombre de points", () => {
  // Un athlète arrêté à un feu accumule des points au même endroit : des chevrons
  // « tous les N points » s'y entasseraient tous.
  const trace = [
    ...Array.from({ length: 200 }, () => ({ lat: 49, lon: 1 })),          // 200 points à l'arrêt
    ...Array.from({ length: 60 }, (_, i) => ({ lat: 49, lon: 1 + i * 0.001 })), // puis 4 km plein est
  ];
  const f = flechesLeLongDe(trace, 4);
  assert.equal(f.length, 4);
  // ⚠️ Compter les positions distinctes ne suffit PAS : espacés « tous les N points »,
  // les chevrons tombent quand même sur 4 longitudes différentes — mais toutes groupées
  // au tout début du trajet. Ce qu'il faut vérifier, c'est qu'ils COUVRENT le parcours.
  const lons = f.map((x) => x.lon);
  const etendue = Math.max(...lons) - Math.min(...lons);
  const parcours = 59 * 0.001;
  assert.ok(etendue > parcours * 0.5,
    `chevrons répartis sur ${(etendue / parcours * 100).toFixed(0)} % du parcours : ils suivent les POINTS, pas la distance`);
  for (const x of f) assert.ok(Math.abs(x.cap - 90) < 5, `cap ${x.cap} : la direction réelle est plein est`);
});

test("aucun chevron sur un parcours qui ne va nulle part", () => {
  assert.deepEqual(flechesLeLongDe(Array.from({ length: 50 }, () => ({ lat: 49, lon: 1 })), 6), []);
  assert.deepEqual(flechesLeLongDe([], 6), []);
  assert.deepEqual(flechesLeLongDe([{ lat: 49, lon: 1 }, { lat: 49.1, lon: 1 }], 6), [], "deux points ne font pas un itinéraire");
});

test("les coordonnées absurdes sont écartées", () => {
  // Les points absurdes sont placés AU MILIEU : en fin de trace, aucun chevron ne
  // tomberait dessus et le filtre ne serait jamais éprouvé.
  const sale = [
    ...Array.from({ length: 20 }, (_, i) => ({ lat: 49, lon: 1 + i * 0.001 })),
    { lat: Number.NaN, lon: 1.02 }, { lat: 999, lon: 1.02 }, { lat: 49, lon: 500 },
    ...Array.from({ length: 20 }, (_, i) => ({ lat: 49, lon: 1.02 + i * 0.001 })),
  ];
  for (const f of flechesLeLongDe(sale, 4)) {
    assert.ok(Number.isFinite(f.cap) && Number.isFinite(f.lat), "un point illisible a contaminé un chevron");
    assert.ok(Math.abs(f.lat) <= 90);
  }
});

test("le cap se mesure sur une base assez longue pour ignorer le bruit GPS", () => {
  assert.equal(BASE_CAP_M, 25, "base de calcul du cap : décision technique, à changer sciemment");
  const src = codeOf("src/lib/activities/fleches.ts");
  assert.match(src, /cumul\[j\] - cumul\[i\] < BASE_CAP_M/,
    "le cap se calcule de nouveau sur deux points consécutifs : ce serait le bruit du GPS qui déciderait");
});

console.log("\nLA CARTE — ce qu'elle doit montrer, et ce qu'elle doit créditer");

test("les tuiles sont CRÉDITÉES", () => {
  // `attributionControl={false}` affichait des tuiles MapTiler/OpenStreetMap sans le
  // moindre crédit, alors que la licence l'exige — et le commentaire voisin affirmait
  // le contraire.
  const src = codeOf("src/components/segments/SegmentMap.tsx");
  assert.doesNotMatch(src, /attributionControl=\{false\}/, "les tuiles sont de nouveau affichées sans crédit");
  assert.match(src, /attribution=\{TUILES\.attribution\}/, "la mention n'est plus transmise à la couche de tuiles");
});

test("la carte montre le sens de parcours et se laisse manipuler", () => {
  const src = codeOf("src/components/segments/SegmentMap.tsx");
  assert.match(src, /flechesLeLongDe\(pts, 6\)/, "les chevrons de direction ont disparu");
  assert.doesNotMatch(src, /dragging=\{false\}/, "la carte est de nouveau figée");
});

test("le survol 3D s'atteint par la FLÈCHE, plus par un onglet", () => {
  const src = codeOf("src/components/segments/PerfTabs.tsx");
  assert.doesNotMatch(src, /dashboard\/survol/, "l'onglet Survol 3D est revenu : la flèche le rend inutile");
  // …mais il doit rester ATTEIGNABLE, sinon on a supprimé la fonction, pas l'onglet.
  assert.match(codeOf("src/components/activity/StravaBlocks.tsx"), /survolHref/, "plus aucun chemin vers le survol");
  assert.doesNotMatch(readFileSync("src/data/helpKb.ts", "utf8"), /Barre latérale gauche › Survol 3D/,
    "l'aide envoie encore vers un onglet supprimé");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
