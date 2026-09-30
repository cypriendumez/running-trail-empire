/**
 * COURSES : fiches finishers.com, liens d'inscription directs, classements (28/09/2026).
 *
 * Mesuré ce jour-là : aucune course importée depuis le 10/06 ; 7 002 événements du plan du
 * site finishers absents ; 7 994 formats « Date à venir » ; 510 trails à « 0 m » de D+ ;
 * des formats d'anciennes éditions mêlés aux vrais ; 78 % des « S'inscrire » vers une fiche
 * de calendrier ; aucun lien de classement.
 *
 *   npx tsx tests/courses-finishers.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lireFiche } from "../scripts/finishers-collecte";
import {
  estFerie, kmDe, estCourseAPied, dplusDe, dplusPlausible, dateDe, dateConservee, fichesJumelles, apparier, planEvenement, pasUneCourseAPied, deCetteFiche, estChrono,
  slugRegion, typeDe, formatsRetenus, cleNomVille,
  DATE_A_VENIR, type Fiche, type LigneCourse,
} from "../src/lib/races/majFinishers";
import { lienInscription, lienSiteOfficiel, lienClassement, heureLisible } from "../src/lib/races/liensCourse";
import { formatPasCourseAPied } from "../src/lib/races/nonCourse";
import { couplesDistanceDplus, dplusPourFormat } from "../src/lib/races/dplusSite";
import { doublonsParfaits, type LigneDoublon } from "../src/lib/races/doublons";
import { lienResultats, robotsAutorise, anneeDe, motsDistinctifs, entites } from "../src/lib/races/resultatsSite";
import { slugDeRegion, nomRegion, regionAvecPreposition } from "../src/lib/races/libelles";
import { REGION_OUTRE_MER } from "../src/lib/races/majFinishers";
import { DEPARTEMENTS, departementDe, departementDuCodePostal, departementParPosition, departementEtranger } from "../src/lib/races/departements";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const AUJ = "2026-09-28";

console.log("\n=== LECTURE D'UNE FICHE ===\n");

test("la fiche donne pays, lieu, formats, dénivelé, heure, site officiel et classement", () => {
  const data = { props: { pageProps: {
    event: {
      name: "10 km de Chambéry", countryName: { code: "FR" }, cityCoordinates: { lat: 45.58, lng: 5.9 },
      breadcrumb: [{ type: "country", label: "France" }, { type: "level1AdminArea", label: "Auvergne-Rhône-Alpes" }, { type: "level2AdminArea", label: "Savoie" }, { type: "city", label: "Chambéry" }],
      links: { website: "/external?url=https%3A%2F%2Fwww.10km-chambery.fr%2F&event=x", registration: "/external?url=https%3A%2F%2Fwww.njuko.net%2F10km&event=x" },
    },
    lastEdition: { year: 2026, status: "confirmed", dateRange: { start: "2026-06-14" } },
    nextEdition: { year: 2027, status: "tba", dateRange: { start: "2027-06-13" } },
    races: [{ id: "r1", formattedTitle: "10 km", discipline: "road", distance: 10000, distanceUnit: "meters", elevationGain: 25, date: "2027-06-13", time: "09:30:00", registrationUrl: null, status: "tba" }],
    customSubPages: [{ slug: "resultats-10-km", name: "Les résultats", href: "/course/10-km-de-chambery/p/resultats-10-km",
      longDescription: '<p>Classement : <a href=\\"https://www.finishers.com/course/x\\">fiche</a> <a href=\\"kavval://events/1\\">x</a> <a href=\\"https://resultats-live.com/events/10km\\">ici</a></p>' }],
  } } };
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
  const f = lireFiche("10-km-de-chambery", html);
  assert.equal(f.pays, "FR");
  assert.deepEqual([f.ville, f.departement, f.region, f.lat, f.lon], ["Chambéry", "Savoie", "Auvergne-Rhône-Alpes", 45.58, 5.9]);
  assert.deepEqual(f.formats?.map((x) => [x.distanceM, x.dplus, x.heure]), [[10000, 25, "09:30"]]);
  assert.equal(f.siteOfficiel, "https://www.10km-chambery.fr/", "le lien de redirection doit rendre l'adresse réelle");
  assert.equal(f.inscription, "https://www.njuko.net/10km");
  assert.equal(f.resultats?.classement, "https://resultats-live.com/events/10km", "le classement direct, pas un lien interne finishers ni kavval");
  assert.equal(lireFiche("x", "<html>rien</html>").ok, false);
});

test("la collecte survit à une coupure PENDANT la lecture de la page", () => {
  // Arrêtée net à 1 561/12 028 le 28/09/2026 : `await r.text()` hors du `try` a laissé
  // filer l'expiration du délai. Une coupure en pleine lecture doit être une erreur réseau.
  assert.match(codeNu("scripts/finishers-collecte.ts"), /try \{[^}]*?const r = await fetch\([\s\S]*?html = await r\.text\(\);\s*\} catch/);
  assert.doesNotMatch(codeNu("scripts/finishers-collecte.ts"), /lireFiche\(slug, await r\.text\(\)\)/);
  // …et un échec réseau (`http: 0`) est RELU à la reprise, pas tenu pour fait.
  assert.match(codeNu("scripts/finishers-collecte.ts"), /if \(o\?\.slug && \(o\.ok \|\| o\.http === 404 \|\| o\.http === 410\)\) faits\.add\(o\.slug\);/);
});

console.log("\n=== DÉCISIONS ===\n");

test("formats retenus : ni courses enfants, ni marche, ni triathlon — le KV reste", () => {
  assert.equal(kmDe(1800), null, "« 10 000 Pattes » : 1,8 km = course enfants");
  assert.equal(kmDe(4000), 4);
  assert.equal(kmDe(3200, "vertical"), 3.2, "un kilomètre vertical est court par nature");
  assert.equal(estCourseAPied("road"), true); assert.equal(estCourseAPied("trail"), true);
  // Valeurs relevées dans les fiches : walking, nordic, bike_and_run, obstacle_race, aquathlon…
  for (const d of ["walking", "nordic", "bike_and_run", "obstacle_race", "aquathlon", "swimrun", "other"]) assert.equal(estCourseAPied(d), false, d);
  // …et les composées qu'un préfixe « course » ne doit pas faire passer.
  for (const d of ["trail_walking", "road_cycling", "cross_triathlon"]) assert.equal(estCourseAPied(d), false, d);
  assert.equal(estCourseAPied("cross"), true, "le cross-country est de la course à pied");
  // ⚠️ 29/09/2026 : « Roc d'Azur VTT », « Le bélier VTT » étaient au catalogue — un PRÉFIXE
  // « mountain » laissait passer `mountain_biking` (443 formats), « cross » le ski de fond.
  for (const d of ["mountain_biking", "cross_country_skiing", "gravel_biking", "cyclo_cross", "fast_hiking", "ski_mountaineering", "", null]) {
    assert.equal(estCourseAPied(d as string), false, String(d));
  }
  assert.equal(estCourseAPied(" Trail "), true, "la casse ou un espace écartent un vrai trail");
});

test("un format étiqueté « route » ou « trail » dont le TITRE dit autre chose est écarté", () => {
  for (const t of ["Rando cyclo 56km / 1000m D+", "Vélo de route 93km", "Marche solidaire", "Marche 5 km", "Randonnée 10km",
    "9km Randonnée", "Rando des Gourmets", "Ski de randonnée - Trace étoilée", "Run & Bike", "Run & Bike Marathon", "Run'Paddle"]) {
    assert.equal(formatPasCourseAPied(t), true, t);
  }
  // Un titre MIXTE garde sa place : la course y existe.
  for (const t of ["Course ou marche relax", "Course / Marche de 4 km", "Trail ou Rando à 2", "Rando-course",
    "63 Km discipline au choix (VTT, Gravel, Trail ou Rando)", "Trail 42 km", "Skyrace 30 km", "Trail des Marcheurs", "La Petite", "10 km", null]) {
    assert.equal(formatPasCourseAPied(t), false, String(t));
  }
  const cyclo: Fiche = { slug: "l-alsacienne-cyclo", ok: true, pays: "FR", nom: "L'Alsacienne Cyclo", ville: "Kruth",
    formats: [{ id: "c1", titre: "Rando cyclo 56km / 1000m D+", discipline: "road", distanceM: 56000, dplus: 1000, date: "2027-06-06", heure: null, inscription: null, statut: "tba" },
      { id: "c2", titre: "GF 195km", discipline: "cycling", distanceM: 195000, dplus: 4900, date: "2027-06-06", heure: null, inscription: null, statut: "tba" }] };
  assert.deepEqual(formatsRetenus(cyclo), [], "« Rando cyclo 56 km » étiquetée « road » est importée comme une course");
  assert.equal(pasUneCourseAPied(cyclo), true, "une cyclosportive garde ses lignes au catalogue des courses");
});

test("le dénivelé lu sur le site officiel : juste plutôt que beaucoup", () => {
  // Formulations relevées le 29/09/2026 sur de vrais sites d'organisateurs.
  const c = (t: string) => couplesDistanceDplus(t).map((x) => [x.km, x.dplus]);
  assert.deepEqual(c("13 Km - 780 d+ - 13&euro; - 9h30 24 Km - 1450 d+ - 18"), [[13, 780], [24, 1450]]);
  assert.deepEqual(c("Distance : 32,72 km Dénivelé positif : 792 m Départ"), [[32.72, 792]]);
  assert.deepEqual(c("<p>Un trail de 27km et 1100m D+</p>"), [[27, 1100]]);
  assert.deepEqual(c("Ultra 80 km : 4 200 m D+"), [[80, 4200]], "le séparateur de milliers est perdu");
  assert.deepEqual(c("Le 42 km : D+ : 2 100 m"), [[42, 2100]]);
  // La distance d'AVANT, jamais celle d'un autre format : « 7 km avec 100 D+ et 14 km 350 D+ ».
  assert.deepEqual(c("de 7km avec 100D+ et un parcours de 14 km 350 D+ avec"), [[7, 100], [14, 350]]);
  assert.deepEqual(c("Semi 21 km puis Trail 15 km 600 D+"), [[15, 600]], "la distance la plus PROCHE n'est plus celle retenue");
  // Une seconde mention sans distance à elle ne reprend pas celle de la première.
  assert.deepEqual(c("Le 12 km : 400 D+, dont la montée finale : 150 D+"), [[12, 400]], "« 150 D+ » attribué au 12 km");
  // Ce qui n'est PAS un dénivelé positif, ou sans distance : rien.
  for (const t of ["Le 30 km descend : 1200 m de dénivelé négatif", "altitude 1450 m, 20 km", "Dénivelé 600 m sans distance"]) {
    assert.deepEqual(c(t), [], t);
  }
  const p = couplesDistanceDplus("13 Km - 780 d+ - 24 Km - 1450 d+ - 24 km duo 1500 D+");
  assert.equal(dplusPourFormat(p, 13), 780);
  assert.equal(dplusPourFormat(p, 12.8), 780, "une distance arrondie par la source ne retrouve plus son format");
  assert.equal(dplusPourFormat(p, 24), null, "deux valeurs pour 24 km : on en choisit une au hasard");
  assert.equal(dplusPourFormat(p, 50), null);
  assert.equal(dplusPourFormat([{ km: 5, dplus: 9000 }], 5), null, "un dénivelé impossible est écrit");
  // Intégration : jamais à la place d'une valeur de la source, et seulement pour un trail.
  const app = codeNu("scripts/finishers-appliquer.ts");
  assert.ok(/if \(x\.discipline !== "trail" \|\| x\.dplus != null\) continue;/.test(app), "le dénivelé du site écrase celui de la fiche");
  const sites = codeNu("scripts/resultats-sites.ts");
  assert.ok(/dplus: couplesDistanceDplus\(p\.texte\)/.test(sites), "la lecture des sites ne relève plus le dénivelé");
  assert.ok(/!besoinDplus\.has\(x\.site\) \|\| Array\.isArray\(x\.dplus\)/.test(sites), "un site lu avant le relevé n'est jamais relu");
});

test("doublons parfaits : une copie part, jamais un favori ni une ligne finishers", () => {
  const l = (id: string, x: Partial<LigneDoublon> = {}): LigneDoublon => ({ id, name: "Trail des Fontaines", city: "Le Montat", date: "2027-02-06", distance_km: 14.5, organization: "", ...x });
  // Cas réel : deux lignes identiques reprises de jogging-plus → une part (la moins renseignée).
  assert.deepEqual(doublonsParfaits([l("a"), l("b", { elevation_gain_m: 300 })], new Set()), ["a"]);
  // L'article et la typographie ne font pas deux courses : « Les Foulées Sarmates » = « Foulées Sarmates ».
  assert.deepEqual(doublonsParfaits([l("a", { name: "Les Foulées Sarmates" }), l("b", { name: "Foulées Sarmates", site_officiel: "https://x.fr" })], new Set()), ["a"]);
  // Un favori est gardé, même moins renseigné — et jamais retiré.
  assert.deepEqual(doublonsParfaits([l("a"), l("b", { elevation_gain_m: 300 })], new Set(["a"])), ["b"]);
  assert.deepEqual(doublonsParfaits([l("a"), l("b")], new Set(["a", "b"])), [], "un favori est retiré");
  // Une ligne finishers n'est jamais retirée (l'application hebdomadaire la recréerait).
  assert.deepEqual(doublonsParfaits([l("a", { organization: "finishers.com" }), l("b", { elevation_gain_m: 300 })], new Set()), ["b"]);
  assert.deepEqual(doublonsParfaits([l("a", { organization: "finishers.com" }), l("b", { organization: "finishers.com" })], new Set()), []);
  // Une seule différence — date, distance, ville ou nom — et ce ne sont plus des doublons.
  for (const x of [{ date: "2027-02-07" }, { distance_km: 15 }, { city: "Cusset" }, { name: "Trail des Sources" }]) {
    assert.deepEqual(doublonsParfaits([l("a"), l("b", x)], new Set()), [], JSON.stringify(x));
  }
});

test("fiches jumelles : même événement sous deux adresses, une seule appliquée", () => {
  const f = (slug: string, ids: string[]): Fiche => ({ slug, ok: true, pays: "FR", nom: "THP", ville: "Forcalquier",
    formats: ids.map((id, i) => ({ id, titre: `THP ${i}`, discipline: "trail", distanceM: 10000 * (i + 1), dplus: 300, date: "2027-05-08", heure: null, inscription: null, statut: "tba" })) });
  const a = f("trail-de-haute-provence", ["x1", "x2"]), b = f("trail-de-haute-provence-thp", ["x2", "x1"]);
  // Aucune des deux au catalogue : la plus courte adresse est gardée.
  assert.deepEqual([...fichesJumelles([b, a], () => false)], [["trail-de-haute-provence-thp", "trail-de-haute-provence"]]);
  // Celle qui a déjà des lignes est gardée, même plus longue — sinon on retirerait l'existant.
  assert.deepEqual([...fichesJumelles([a, b], (s) => s.endsWith("-thp"))], [["trail-de-haute-provence", "trail-de-haute-provence-thp"]]);
  // Cas réel où l'ordre alphabétique et la longueur divergent : la plus courte gagne.
  assert.deepEqual([...fichesJumelles([f("choco-trail-dhardricourt", ["c1"]), f("chocotrail-dhardricourt", ["c1"])], () => false)],
    [["choco-trail-dhardricourt", "chocotrail-dhardricourt"]]);
  // Seconde preuve : identifiants différents, même nom (article près), même ville, formats IDENTIQUES.
  const nomme = (slug: string, nom: string, ids: string[], kms: number[]): Fiche => ({ ...f(slug, ids), nom, ville: "Cahors",
    formats: ids.map((id, i) => ({ id, titre: null, discipline: "trail", distanceM: kms[i] * 1000, dplus: 300, date: "2027-02-21", heure: null, inscription: null, statut: "tba" })) });
  assert.deepEqual([...fichesJumelles([nomme("les-collines-du-diable", "Les Collines du Diable", ["a1", "a2"], [12, 25]), nomme("collines-du-diable", "Collines du diable", ["b1", "b2"], [12, 25])], () => false)],
    [["les-collines-du-diable", "collines-du-diable"]]);
  // Mêmes noms mais formats DIVERGENTS (« JURAPICS » 27 km, « Jurapics » 28 km) : on ne choisit pas.
  assert.equal(fichesJumelles([nomme("jurapics", "JURAPICS", ["a1", "a2"], [9, 27]), nomme("jurapics-2", "Jurapics", ["b1", "b2"], [9, 28])], () => false).size, 0,
    "deux fiches divergentes rapprochées : l'une des deux versions disparaît sans preuve");
  // Un seul format commun ne suffit pas : ce sont peut-être deux événements d'un même organisateur.
  assert.equal(fichesJumelles([a, { ...f("autre", ["x1", "x9"]), nom: "Autre trail" }], () => false).size, 0);
  assert.equal(fichesJumelles([a, { ...b, ok: false }], () => false).size, 0, "une fiche illisible fait une jumelle");
  const src = codeNu("scripts/finishers-appliquer.ts");
  assert.ok(/const gardee = jumelles\.get\(f\.slug\);\s*if \(gardee\) \{[\s\S]{0,120}if \(favoris\.has\(l\.id\) \|\| touchees\.has\(l\.id\)\) continue;/.test(src),
    "les lignes d'une jumelle sont retirées même en favori");
  assert.ok(/lignesJumelles\+\+;[\s\S]{0,300}\n\s*continue;\n\s*\}/.test(src), "une fiche jumelle est encore planifiée : ses formats seraient réimportés");
  // Page supprimée à la source (404/410) : seul le NOM sans ambiguïté fait partir la ligne.
  assert.ok(/if \(f\.http !== 404 && f\.http !== 410\) \{ aRevoir\.push\(f\.slug\); continue; \}/.test(src), "une fiche illisible (réseau) retire des lignes");
  assert.ok(/if \(favoris\.has\(l\.id\) \|\| touchees\.has\(l\.id\) \|\| !pasCourseAPiedParNom\(l\.name\)\) continue;/.test(src),
    "une ligne orpheline part sans que son nom le justifie, ou même en favori");
});

test("le kilomètre vertical se reconnaît à sa PENTE — la source l'étiquette « trail »", () => {
  assert.equal(kmDe(3800, "trail", 1000), 3.8, "KV du Marathon du Mont-Blanc : 3,8 km pour 1 000 m");
  assert.equal(kmDe(3800, "trail", 60), null, "3,8 km presque plat : une course enfants");
  assert.equal(kmDe(3800, "trail", null), null);
  assert.equal(kmDe(3500, "trail", 520), 3.5, "« Défi de l'Olympe » : 3,5 km pour 520 m, une vraie course d'adultes");
});

test("un dénivelé IMPOSSIBLE pour la distance devient inconnu", () => {
  assert.equal(dplusPlausible(16660, 18), false, "« Montée du Ventoux, 18 km, 16 660 m » : un zéro de trop");
  assert.equal(dplusPlausible(1000, 1.9), true, "le KV de Fully, le plus raide");
  assert.equal(dplusPlausible(1676, 25.7), true); assert.equal(dplusPlausible(5472, 42), true, "Zegama");
  assert.equal(dplusDe(16660, true, 18), null);
});

test("le dénivelé : 0 m sur un trail est une ABSENCE de donnée, pas du plat", () => {
  assert.equal(dplusDe(0, true), null);
  assert.equal(dplusDe(0, false), 0, "sur route, zéro peut être vrai");
  assert.equal(dplusDe(472.4, true), 472);
  assert.equal(dplusDe(null, true), null);
});

test("la date : passée ou absente → « Date à venir » ; estimée ≠ confirmée", () => {
  const fiche: Fiche = { slug: "x", ok: true, prochaine: { annee: 2027, debut: "2027-06-13", statut: "tba" } };
  assert.deepEqual(dateDe({ id: "a", titre: null, discipline: "road", distanceM: 10000, dplus: null, date: "2027-06-13", heure: null, inscription: null, statut: "tba" }, fiche, AUJ), { date: "2027-06-13", confirmee: false });
  assert.deepEqual(dateDe({ id: "a", titre: null, discipline: "road", distanceM: 10000, dplus: null, date: "2027-06-13", heure: null, inscription: null, statut: "confirmed" }, fiche, AUJ), { date: "2027-06-13", confirmee: true });
  assert.equal(dateDe({ id: "a", titre: null, discipline: "road", distanceM: 10000, dplus: null, date: "2026-06-14", heure: null, inscription: null, statut: "confirmed" }, fiche, AUJ).date, DATE_A_VENIR, "une date passée n'est pas une date à venir");
});

test("une date ESTIMÉE en semaine est tenue pour inconnue — 0 juste sur 28 un lundi ou un mardi", () => {
  const f = (date: string, statut: string) => ({ id: "a", titre: null, discipline: "road", distanceM: 10000, dplus: null, date, heure: null, inscription: null, statut });
  const fiche: Fiche = { slug: "x", ok: true };
  assert.equal(dateDe(f("2026-10-06", "tba"), fiche, AUJ).date, DATE_A_VENIR, "« Foulées Halluinoises » un mardi : courues le dimanche 11");
  assert.equal(dateDe(f("2026-10-08", "tba"), fiche, AUJ).date, DATE_A_VENIR, "jeudi estimé");
  assert.deepEqual(dateDe(f("2026-10-06", "confirmed"), fiche, AUJ), { date: "2026-10-06", confirmee: true }, "confirmée par l'organisateur : on la croit");
  assert.deepEqual(dateDe(f("2026-10-11", "tba"), fiche, AUJ), { date: "2026-10-11", confirmee: false }, "un dimanche estimé reste, signalé");
  assert.deepEqual(dateDe(f("2026-10-09", "tba"), fiche, AUJ), { date: "2026-10-09", confirmee: false }, "le vendredi soir aussi");
  assert.equal(dateDe(f("2026-11-11", "tba"), fiche, AUJ).date, "2026-11-11", "le 11 novembre (mercredi) est férié : on y court");
  assert.equal(estFerie("2027-05-06"), true, "Ascension 2027"); assert.equal(estFerie("2027-05-17"), true, "lundi de Pentecôte 2027");
  assert.equal(estFerie("2027-03-29"), true, "lundi de Pâques 2027"); assert.equal(estFerie("2027-05-13"), false);
});

test("appariement un pour un, par identifiant de source d'abord", () => {
  // La ligne « a » porte l'identifiant du format r2 : la distance seule l'aurait donnée à r1.
  const lignes = [{ id: "a", distance_km: 10, source_id: "r2" }, { id: "b", distance_km: 10.1, source_id: null }];
  const r = apparier(lignes, [{ id: "r1", km: 10 }, { id: "r2", km: 10.1 }]);
  assert.deepEqual(r.paires.map(([l, f]) => [l.id, f.id]).sort(), [["a", "r2"], ["b", "r1"]]);
  assert.deepEqual(apparier([{ id: "a", distance_km: 10 }], [{ id: "x", km: 21.1 }]).formatsSeuls.map((f) => f.km), [21.1]);
});

const ligne = (id: string, km: number, extra: Partial<LigneCourse> = {}): LigneCourse => ({
  id, name: "Odyssée du Tue Vaques", city: "Fermanville", date: "2026-09-28", distance_km: km, elevation_gain_m: 0, type: "trail_s",
  organization: "finishers.com", registration_url: "https://www.finishers.com/course/odyssee-du-tue-vaques",
  latitude: 49.68, longitude: -1.44, region: "normandie", department: "Manche", difficulty: "blue", ...extra,
});
const TUE: Fiche = {
  slug: "odyssee-du-tue-vaques", ok: true, pays: "FR", nom: "Odyssée du Tue Vaques", ville: "Fermanville",
  prochaine: { annee: 2026, debut: "2026-10-04", statut: "tba" },
  formats: [30400, 16000, 8900].map((m, i) => ({ id: `r${i}`, titre: null, discipline: "trail", distanceM: m, dplus: [472, 255, 103][i], date: "2026-10-04", heure: null, inscription: null, statut: "tba" })),
};

test("le cas réel : 9 formats en base pour 3 réels — les vrais mis à jour, les périmés retirés", () => {
  const base = [8, 8.9, 10, 15, 16, 27, 30, 30.4, 50].map((km, i) => ligne(`l${i}`, km));
  const p = planEvenement(TUE, base, { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false });
  assert.equal(p.majs.length, 3);
  assert.deepEqual(p.majs.map((m) => m.patch.elevation_gain_m).sort(), [103, 255, 472], "le « 0 m » laisse la place au vrai dénivelé");
  assert.equal(p.retraits.length, 6);
  assert.equal(p.ajouts.length, 0);
  for (const m of p.majs) assert.ok(!("name" in m.patch) && !("type" in m.patch) && !("city" in m.patch), "on ne réécrit ni le nom, ni le type, ni la ville");
});

test("une fiche finishers remplace les lignes DATAtourisme du même événement", () => {
  // « Luga'Trail » : 8 et 15 km lus dans le texte de l'office de tourisme ; 11 et 16 km
  // format par format chez finishers — la carte affichait les quatre.
  const dt = (id: string, km: number) => ligne(id, km, { organization: "DATAtourisme", registration_url: "https://www.brasseriedelugazaut.com/lugatrail26" });
  const p = planEvenement(TUE, [dt("d8", 8), dt("d30", 30.4)], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false });
  assert.deepEqual(p.retraits.sort(), ["d30", "d8"]);
  assert.equal(p.majs.length, 0, "une ligne DATAtourisme n'est pas réécrite en ligne finishers (sa source citée deviendrait fausse)");
  assert.equal(p.ajouts.length, 3, "les formats de la fiche sont ajoutés, sous la source finishers");
  assert.deepEqual(planEvenement(TUE, [dt("d8", 8)], { aujourdhui: AUJ, favoris: new Set(["d8"]), colonnesNouvelles: false }).retraits, [], "jamais un favori");
});

test("jamais retiré : une ligne d'une autre source, ou mise en favori par un athlète", () => {
  const base = [ligne("fav", 50), ligne("autre", 27, { organization: "le-sportif.com" }), ligne("vieux", 15)];
  const p = planEvenement(TUE, base, { aujourdhui: AUJ, favoris: new Set(["fav"]), colonnesNouvelles: false });
  assert.deepEqual(p.retraits, ["vieux"]);
});

test("hors de France ou sans format lisible : on ne touche à rien", () => {
  const be = planEvenement({ ...TUE, pays: "BE" }, [ligne("a", 10)], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false });
  assert.deepEqual([be.majs, be.ajouts, be.retraits], [[], [], []]);
  assert.deepEqual(planEvenement({ ...TUE, formats: [] }, [ligne("a", 10)], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false }).retraits, []);
});

test("un nouvel événement : lignes complètes, lien vers la fiche, région au format de la base", () => {
  const p = planEvenement({ ...TUE, slug: "nouveau", region: "Provence-Alpes-Côte d'Azur", departement: "Var", lat: 43.1, lon: 6 }, [], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: true });
  assert.equal(p.ajouts.length, 3);
  const a = p.ajouts[0];
  assert.equal(a.region, "provence-alpes-cote-d-azur");
  assert.equal(a.registration_url, "https://www.finishers.com/course/nouveau");
  assert.equal(a.organization, "finishers.com");
  assert.equal(a.source_id, "r0", "l'identifiant de format rend les mises à jour suivantes exactes");
  assert.equal(slugRegion("Provence-Alpes-Côte d'Azur"), "provence-alpes-cote-d-azur");
  assert.equal(typeDe("trail", 30.4), "trail_m"); assert.equal(typeDe("road", 21.1), "semi"); assert.equal(typeDe("road", 10), "road_10k");
  assert.equal(cleNomVille("Foulées de Bondues", "Bondues"), cleNomVille("FOULEES DE BONDUES ", "bondues"));
  // ⚠️ 275 événements affichés deux fois le 29/09/2026 : l'article et « 10 Km »/« 10km »
  // suffisaient à rater le rapprochement, et le doublon survivait à chaque passage.
  assert.equal(cleNomVille("La Gambade Escalaise", "L'Escale"), cleNomVille("Gambade Escalaise", "L'Escale"));
  assert.equal(cleNomVille("10 Km de Soustons", "Soustons"), cleNomVille("10km de Soustons", "Soustons"));
  assert.equal(cleNomVille("Foulées de St-Lô", "Saint-Lô"), cleNomVille("Foulées de Saint Lô", "Saint-Lô"));
  // … sans jamais rapprocher deux noms réellement différents.
  assert.notEqual(cleNomVille("Course de Bondues", "Bondues"), cleNomVille("Foulées de Bondues", "Bondues"));
  assert.notEqual(cleNomVille("Kids Trail d'Antibes", "Antibes"), cleNomVille("Trail d'Antibes", "Antibes"));
});

test("les nouvelles colonnes ne sont écrites QU'APRÈS la migration 032", () => {
  const avant = planEvenement(TUE, [ligne("a", 30.4)], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false });
  assert.ok(!("site_officiel" in avant.majs[0].patch) && !("date_confirmee" in avant.majs[0].patch));
  const apres = planEvenement({ ...TUE, siteOfficiel: "https://x.fr" }, [ligne("a", 30.4)], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: true });
  assert.equal(apres.majs[0].patch.site_officiel, "https://x.fr");
  assert.equal(apres.majs[0].patch.date_confirmee, false);
  assert.equal(formatsRetenus(TUE).length, 3);
});

test("un doublon venu d'ailleurs part ; une ligne d'ailleurs SANS équivalent reste", () => {
  const jp = (id: string, km: number) => ligne(id, km, { organization: "", registration_url: "https://www.jogging-plus.com/presentation-courses-trails/tue" });
  // La copie jogging-plus est listée AVANT : c'est quand même la ligne de la fiche qui garde le format.
  const p = planEvenement(TUE, [jp("jp16", 16), jp("jp21", 21), ligne("fin16", 16)], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false });
  assert.ok(p.majs.some((m) => m.id === "fin16"));
  assert.deepEqual(p.retraits, ["jp16"]); assert.equal(p.motifs.jp16, "doublon");
  assert.ok(!p.retraits.includes("jp21"), "un 21 km que la fiche ne connaît pas n'est pas un doublon");
  assert.equal(planEvenement(TUE, [jp("jp16", 16), ligne("fin16", 16)], { aujourdhui: AUJ, favoris: new Set(["jp16"]), colonnesNouvelles: false }).retraits.length, 0);
});

test("une ligne d'une AUTRE fiche finishers n'est pas « de cette fiche »", () => {
  assert.equal(deCetteFiche(ligne("a", 10), "odyssee-du-tue-vaques"), true);
  assert.equal(deCetteFiche(ligne("a", 10, { registration_url: "https://www.finishers.com/course/odyssee-du-tue-vaques-bis" }), "odyssee-du-tue-vaques"), false);
  assert.equal(deCetteFiche(ligne("a", 10, { registration_url: "https://www.jogging-plus.com/x" }), "odyssee-du-tue-vaques"), false, "organisation finishers mais lien jogging-plus");
});

test("un triathlon retire ce qu'on en avait importé ; une fiche MUETTE ne retire rien", () => {
  const tri: Fiche = { ...TUE, formats: [{ id: "t", titre: null, discipline: "triathlon", distanceM: 103000, dplus: 1200, date: null, heure: null, inscription: null, statut: null }] };
  assert.equal(pasUneCourseAPied(tri), true);
  const p = planEvenement(tri, [ligne("tri", 103), ligne("jp", 103, { organization: "" })], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false });
  assert.deepEqual(p.retraits, ["tri"]); assert.equal(p.motifs.tri, "pasCourseAPied");
  const muette: Fiche = { ...TUE, formats: [{ id: "x", titre: null, discipline: "trail", distanceM: null, dplus: null, date: null, heure: null, inscription: null, statut: null }] };
  assert.equal(pasUneCourseAPied(muette), false);
  assert.deepEqual(planEvenement(muette, [ligne("a", 20)], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false }).retraits, []);
});

test("sans la colonne « confirmée », une date ANNONCÉE n'est pas écrite comme certaine", () => {
  const annonce = planEvenement(TUE, [ligne("a", 30.4, { date: DATE_A_VENIR })], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false });
  assert.equal(annonce.majs[0].patch.date, DATE_A_VENIR);
  assert.deepEqual(annonce.ajouts.map((x) => x.date), [DATE_A_VENIR, DATE_A_VENIR], "les formats ajoutés non plus");
  assert.equal(annonce.datesEnAttente, 3, "1 mise à jour + 2 ajouts, comptés pour le rapport");
  const conf: Fiche = { ...TUE, formats: TUE.formats!.map((f) => ({ ...f, statut: "confirmed" })) };
  assert.equal(planEvenement(conf, [ligne("a", 30.4, { date: DATE_A_VENIR })], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false }).majs[0].patch.date, "2026-10-04");
  assert.equal(planEvenement(TUE, [ligne("a", 30.4, { date: DATE_A_VENIR })], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: true }).majs[0].patch.date, "2026-10-04", "après la migration, écrite AVEC son drapeau");
  const faux = planEvenement({ ...TUE, formats: TUE.formats!.map((f) => ({ ...f, dplus: null })) }, [ligne("v", 30.4, { elevation_gain_m: 16660 })], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false });
  assert.equal(faux.majs[0].patch.elevation_gain_m, null, "un dénivelé faux en base n'est pas conservé faute de mieux");
});

test("une estimation écartée n'efface pas la date déclarée par l'office de tourisme", () => {
  // Cas réel (29/09/2026) : « Boucles des Cordeliers », samedi 17/10 selon DATAtourisme ;
  // finishers estime le MARDI 27/10 (« tba »), que `dateDe` écarte. La date déclarée reste.
  const mardi = { ...TUE, prochaine: { annee: 2026, debut: "2026-10-27", statut: "tba" },
    formats: TUE.formats!.map((f) => ({ ...f, date: "2026-10-27" })) };
  const opts = { aujourdhui: AUJ, favoris: new Set<string>(), colonnesNouvelles: true };
  const garde = planEvenement(mardi, [ligne("a", 30.4, { date: "2026-10-17" })], opts).majs[0].patch;
  assert.equal(garde.date, "2026-10-17", "la date déclarée ailleurs repasse en « Date à venir »");
  assert.ok(!("date_confirmee" in garde), "le drapeau de la date déclarée est écrasé par celui d'une estimation écartée");
  // Sans date ailleurs, l'estimation en semaine reste inconnue — la règle ne change pas.
  assert.equal(planEvenement(mardi, [ligne("a", 30.4, { date: DATE_A_VENIR })], opts).majs[0].patch.date, DATE_A_VENIR);
  const f = mardi.formats![0];
  assert.equal(dateConservee("2026-10-17", f, mardi, AUJ), true);
  assert.equal(dateConservee("2027-10-16", f, mardi, AUJ), false, "une date d'une AUTRE édition (un an d'écart) est gardée");
  // « Trail des Ducs » : déclaré le 25/04/2027, estimé au lundi 08/03 — 48 jours, même saison.
  const ducs = { ...f, date: "2027-03-08" };
  assert.equal(dateConservee("2027-04-25", ducs, mardi, AUJ), true, "une épreuve qui change de mois perd sa date déclarée");
  assert.equal(dateConservee("2027-09-01", ducs, mardi, AUJ), false, "une date à 6 mois de l'estimation est gardée");
  assert.equal(dateConservee("2026-09-20", f, mardi, AUJ), false, "une date PASSÉE est gardée comme date à venir");
  assert.equal(dateConservee("2099-01-01", f, mardi, AUJ), false);
  assert.equal(dateConservee(null, f, mardi, AUJ), false);
  // Une ESTIMATION dépassée ne prouve rien (« Course des Remparts de Provins » : estimée au
  // mardi 29/09, déclarée le dimanche 4/10 — effacée le 30/09) ; une date CONFIRMÉE dépassée,
  // si : l'édition a eu lieu (« Transvésubienne », 27/09).
  const passee = { ...f, date: "2026-09-22" };   // passée, à 25 jours de la date déclarée
  assert.equal(dateConservee("2026-10-17", passee, { ...mardi, prochaine: null }, AUJ), true, "une estimation dépassée efface une date déclarée");
  assert.equal(dateConservee("2026-10-17", { ...passee, statut: "confirmed" }, { ...mardi, prochaine: null }, AUJ), false,
    "une édition CONFIRMÉE et passée garde une date future qui n'est plus la sienne");
});

const fmt = (id: string, titre: string, discipline: string, distanceM: number, dplus: number | null = null) =>
  ({ id, titre, discipline, distanceM, dplus, date: "2026-10-18", heure: null, inscription: null, statut: "confirmed" });

test("une course À DURÉE (6 h, 24 h) n'est ni importée à la longueur de sa boucle, ni retirée", () => {
  for (const t of ["6h - Solo", "24H solo (boucle de 6km)", "Course à pied de 24h", "Backyard Ultra", "12 heures"]) assert.equal(estChrono(t), true, t);
  for (const t of ["10 km - Chronométré", "Trail 21 km départ 9h30", "Semi-marathon"]) assert.equal(estChrono(t), false, t);
  const atipik: Fiche = { ...TUE, formats: [fmt("a", "6h - Solo", "trail", 3300, 110), fmt("b", "3h-Duo", "trail", 3300, 110), fmt("c", "Challenge parents/enfants", "trail", 3000)] };
  assert.equal(pasUneCourseAPied(atipik), false, "l'Atipik Trail est une course de 6 h, pas un triathlon");
  assert.deepEqual(planEvenement(atipik, [ligne("boucle", 3.3)], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false }).retraits, []);
  const mixte: Fiche = { ...TUE, formats: [fmt("x", "Trail 21 km", "trail", 21000, 600), fmt("y", "Solo 6h", "trail", 6000, 150)] };
  const p = planEvenement(mixte, [ligne("t21", 21), ligne("b6", 6), ligne("vieux", 42)], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: false });
  assert.deepEqual(p.retraits, ["vieux"], "la boucle de 6 km reste ; le 42 km disparu part");
  assert.equal(p.ajouts.length, 0, "on n'ajoute pas un « 6 km » qui est un 6 h");
  assert.deepEqual(formatsRetenus(mixte).map((x) => x.id), ["x"]);
  assert.deepEqual(p.majs.map((m) => m.id), ["t21"], "la ligne de la boucle ne reçoit pas les données d'un 6 h");
});

test("à distance égale, la course individuelle passe avant le relais", () => {
  const f: Fiche = { ...TUE, formats: [fmt("rel", "Semi-marathon relais à 3", "road", 21097), fmt("ind", "Semi-marathon", "road", 21097)] };
  assert.deepEqual(formatsRetenus(f).map((x) => x.id), ["ind"]);
});

console.log("\n=== LIENS ===\n");

test("inscription : directe, sinon site officiel, sinon la fiche du calendrier", () => {
  assert.equal(lienInscription({ inscription_url: "https://njuko.net/x", site_officiel: "https://site.fr", registration_url: "https://www.finishers.com/course/x" })?.sorte, "inscription");
  assert.equal(lienInscription({ site_officiel: "https://site.fr", registration_url: "https://www.finishers.com/course/x" })?.sorte, "officiel");
  assert.equal(lienInscription({ registration_url: "https://www.finishers.com/course/x" })?.sorte, "fiche");
  assert.equal(lienInscription({ inscription_url: "javascript:alert(1)" }), null, "seules les adresses http(s) passent");
  assert.equal(lienSiteOfficiel({ site_officiel: "https://site.fr", inscription_url: "https://njuko.net/x" }), "https://site.fr");
  assert.equal(lienSiteOfficiel({ site_officiel: "https://site.fr" }), null, "déjà le lien principal : pas deux fois");
});

test("classement : direct quand on le connaît, sinon une RECHERCHE nommée comme telle", () => {
  const d = lienClassement({ resultats_url: "https://resultats-live.com/x", resultats_annee: 2026 }, { name: "10 km de Chambéry" });
  assert.deepEqual(d, { url: "https://resultats-live.com/x", direct: true, annee: 2026 });
  const r = lienClassement({}, { name: "Corrida de Langueux", city: "Langueux" });
  assert.equal(r?.direct, false);
  assert.ok(r?.url.startsWith("https://www.google.com/search?q=") && r.url.includes(encodeURIComponent("Corrida de Langueux")));
  assert.equal(heureLisible("09:30"), "9 h 30"); assert.equal(heureLisible("25:00"), null);
});

console.log("\n=== RÉSULTATS SUR LE SITE OFFICIEL ===\n");

test("le lien « Résultats » du menu, pas le concours photo ni l'inscription", () => {
  // Le concours photo et l'inscription viennent AVANT : à égalité, l'ordre les aurait choisis.
  const menu = `<nav><a href="/concours">Résultats du concours photo</a>
    <a href="https://www.chrono-start.com/inscriptions-resultats/10-km-x">Inscrivez-vous</a>
    <a href="/inscriptions">Inscriptions</a><a href="/resultats">Résultats</a></nav>`;
  assert.deepEqual(lienResultats(menu, "https://www.10km-x.fr/", 2026), { url: "https://www.10km-x.fr/resultats", annee: null, texte: "Résultats", chronometreur: false });
  assert.equal(lienResultats(`<a href="https://www.njuko.net/event/trail-x">Je m'inscris</a>`, "https://x.fr/", 2026), null, "un chronométreur qui vend les dossards n'est pas un classement");
  assert.equal(lienResultats(`<a href="/contact">Contact</a>`, "https://x.fr/", 2026), null);
  assert.equal(lienResultats(`<a href="https://www.sportinnovation.fr/">Notre chronométreur</a>`, "https://x.fr/", 2026), null, "un chronométreur sans « résultats » n'est pas un classement");
  assert.equal(lienResultats(`<a href="https://livetrail.net/trail-x">Suivi en direct</a>`, "https://x.fr/", 2026)?.chronometreur, true, "le suivi « live » du chronométreur, si");
});

test("le chronométreur passe devant, puis l'année la plus récente — jamais une année future", () => {
  const html = `<a href="/resultats-2023">Résultats 2023</a><a href="/resultats-2025">Résultats 2025</a>
    <a href="https://www.sportinnovation.fr/resultats/trail-x-2024">Classement</a>`;
  assert.equal(lienResultats(html, "https://x.fr/", 2026)?.url, "https://www.sportinnovation.fr/resultats/trail-x-2024");
  assert.equal(lienResultats(html.split("<a href=\"https://www.sport")[0], "https://x.fr/", 2026)?.annee, 2025);
  assert.equal(anneeDe("édition 2031, résultats 2024", 2026), 2024);
  assert.equal(anneeDe("course n°120254", 2026), null, "un numéro n'est pas une année");
});

test("cas relevés le 28/09 : pagination de blog, résultats DU CLUB, vente de dossards", () => {
  const x = (html: string) => lienResultats(html, "https://x.fr/", 2026);
  assert.equal(x(`<a href="https://blog.fr/search?updated-max=2025&max-results=5">Articles plus anciens</a>`), null);
  assert.equal(x(`<a href="https://blog.fr/p?max-results=5">Suite</a>`), null, "« results » dans la requête ne dit rien");
  assert.equal(x(`<a href="/les-resultats-du-club">LES RESULTATS DU CLUB</a>`), null);
  assert.equal(x(`<a href="/resultats5km/menu.php">Résultats tests 5 km ou VMA</a>`), null);
  assert.equal(x(`<a href="https://duotrail.com/courses/le-dossard-pour-le-duo-trail">Résultats Duo Trail</a>`), null);
  assert.equal(x(`<a href="https://duotrail.com/resultats/resultats-duo-trail-isola-2000">Résultats Duo Trail</a>`)?.url, "https://duotrail.com/resultats/resultats-duo-trail-isola-2000");
});

test("le lien doit NOMMER la course : un organisateur a plusieurs épreuves, un club publie les siens", () => {
  assert.deepEqual(motsDistinctifs("10 km d'Isneauville"), ["isneauville"]);
  assert.deepEqual(motsDistinctifs("Les Foulées du Populaire"), ["populaire"]);
  const agence = `<a href="https://lvorganisation.com/bol-dor-velo-2026-cyclo">Classements</a><a href="https://lvorganisation.com/corrida-du-laudon-2025/">Résultats 2025</a>`;
  assert.equal(lienResultats(agence, "https://lvorganisation.com/", 2026, { noms: ["Corrida du Laudon"] })?.url, "https://lvorganisation.com/corrida-du-laudon-2025/");
  assert.equal(lienResultats(agence, "https://lvorganisation.com/", 2026, { noms: ["Trail des Monts"] }), null, "aucun lien ne nomme ce trail");
  // Site dédié à la course : son propre « /resultats » suffit (le nom est dans l'adresse du site).
  assert.equal(lienResultats(`<a href="/resultats-2026">Résultats 2026</a>`, "https://www.argentrail.com/", 2026, { noms: ["Argentrail"] })?.annee, 2026);
  // Site de club qui porte le nom de la ville : ce n'est pas le site de la course.
  assert.equal(lienResultats(`<a href="/resultats/">Résultats</a>`, "https://reims-athletisme.fr/", 2026, { noms: ["Run in Reims"] }), null);
});

test("les entités HTML d'un lien sont décodées — « d&#039;Issy » donnait un 404", () => {
  assert.equal(entites("Corrida%20d&#039;Issy&amp;x=1"), "Corrida%20d'Issy&x=1");
  const l = lienResultats(`<a href="https://resultats.chronocompetition.com/Corrida%20d&#039;Issy%202025/">Résultats 2025</a>`, "https://x.fr/", 2026);
  assert.equal(l?.url, "https://resultats.chronocompetition.com/Corrida%20d'Issy%202025/");
});

test("un classement de plus de deux ans ne répond plus à « comment s'est passée la course »", () => {
  assert.equal(lienResultats(`<a href="/edition-2015/resultat-2015/">RESULTAT 2015</a>`, "https://x.fr/", 2026), null);
  assert.equal(lienResultats(`<a href="/resultats-2024/">Résultats 2024</a>`, "https://x.fr/", 2026)?.annee, 2024);
});

test("robots.txt : respecté, groupe à notre nom d'abord, motifs à étoile", () => {
  assert.equal(robotsAutorise(null, "/"), true, "pas de robots.txt : permis");
  assert.equal(robotsAutorise("User-agent: *\nDisallow: /", "/"), false);
  assert.equal(robotsAutorise("User-agent: *\nDisallow: /admin", "/"), true);
  assert.equal(robotsAutorise("User-agent: pacevobot\nDisallow: /\n\nUser-agent: *\nAllow: /", "/"), false);
  assert.equal(robotsAutorise("User-agent: Googlebot\nDisallow: /", "/"), true, "une règle pour un autre robot ne nous vise pas");
  assert.equal(robotsAutorise("User-agent: *\nDisallow: /*?", "/?page=2"), false);
  assert.equal(robotsAutorise("User-agent: *\nDisallow: /*?", "/"), true);
  assert.equal(robotsAutorise("User-agent: *\nDisallow: /*/prive", "/2025/prive"), false, "l'étoile au milieu du motif");
  assert.equal(robotsAutorise("User-agent: *\nDisallow: /\nAllow: /resultats", "/resultats"), true, "la règle la plus longue l'emporte");
});

test("l'année du classement est LUE dans le lien, jamais supposée", () => {
  const avec = (resultats: Fiche["resultats"]) => planEvenement({ ...TUE, derniere: { annee: 2026, debut: "2026-06-14", statut: "confirmed" }, resultats },
    [ligne("a", 30.4)], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: true }).majs[0].patch;
  assert.equal(avec({ page: null, classement: "https://results.timeto.com/marathon-de-paris-2026" }).resultats_annee, 2026);
  assert.equal(avec({ page: null, classement: "https://resultats-live.com/events/10km" }).resultats_annee, null, "pas « Classement 2026 » sur une page sans année");
  assert.equal(avec({ page: null, classement: "https://x.fr/resultats", annee: 2024 }).resultats_annee, 2024);
});

console.log("\n=== FILTRE PAR RÉGION ===\n");

test("chaque région du menu retrouve ses courses — accents compris", () => {
  // 29/09/2026 : cinq régions renvoyaient 0 course (≈ 6 500 introuvables) — le libellé
  // « Île-de-France » était comparé à « ile-de-france » sans retirer les accents.
  const hub = readFileSync("src/components/races/RacesHub.tsx", "utf8");
  const menu = [...(hub.match(/const REGIONS = \[([\s\S]*?)\];/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((r) => r !== "Toutes");
  assert.ok(menu.length >= 16, `menu des régions illisible (${menu.length})`);
  for (const libelle of menu) {
    const slug = slugDeRegion(libelle);
    assert.notEqual(nomRegion(slug), slug, `« ${libelle} » → « ${slug} » : aucune région connue sous cet identifiant`);
  }
  assert.equal(slugDeRegion("Auvergne-Rhône-Alpes"), slugDeRegion("auvergne-rhone-alpes"));
  assert.equal(slugDeRegion("Provence-Alpes-Côte d'Azur"), "provence-alpes-cote-d-azur");
  assert.equal(slugDeRegion("reunion"), "la-reunion", "l'alias historique rejoint la bonne région");
  assert.match(codeNu("src/components/races/RacesHub.tsx"), /const matchRegion = region === "Toutes" \|\| slugDeRegion\(r\.region\) === slugDeRegion\(region\);/);
});

test("outre-mer : la région vient du CODE PAYS, pas de l'arrondissement de la source", () => {
  const p = planEvenement({ ...TUE, slug: "grand-raid", pays: "RE", region: "Saint-Benoît" }, [], { aujourdhui: AUJ, favoris: new Set(), colonnesNouvelles: true });
  assert.equal(p.ajouts[0].region, "la-reunion");
  for (const slug of Object.values(REGION_OUTRE_MER)) assert.notEqual(nomRegion(slug), slug, `${slug} sans nom lisible`);
  assert.equal(regionAvecPreposition("saint-martin"), "à Saint-Martin");
  assert.equal(regionAvecPreposition("nouvelle-caledonie"), "en Nouvelle-Calédonie");
});

test("départements : une écriture, la bonne région — et l'étranger reconnu", () => {
  // 29/09/2026 : 250 écritures pour ~101 départements ; Corse, Martinique et des épreuves
  // canadiennes rangées en Île-de-France (« Marathon de Toronto » géolocalisé près de Nantes).
  assert.equal(DEPARTEMENTS.length, 101);
  for (const d of DEPARTEMENTS) assert.notEqual(nomRegion(d.region), d.region, `${d.nom} : région inconnue « ${d.region} »`);
  assert.equal(departementDe("59")?.nom, "Nord"); assert.equal(departementDe("59")?.region, "hauts-de-france");
  assert.deepEqual(DEPARTEMENTS.filter((d) => d.region === "ile-de-france").map((d) => d.code), ["75", "77", "78", "91", "92", "93", "94", "95"]);
  const parRegion: Record<string, number> = {}; for (const d of DEPARTEMENTS) parRegion[d.region] = (parRegion[d.region] ?? 0) + 1;
  assert.deepEqual([parRegion["auvergne-rhone-alpes"], parRegion["occitanie"], parRegion["nouvelle-aquitaine"], parRegion["grand-est"], parRegion["hauts-de-france"], parRegion["corse"]], [12, 13, 12, 10, 5, 2]);
  assert.equal(departementDe("Seine et Marne")?.nom, "Seine-et-Marne");
  assert.equal(departementDe("Cotes d'Armor")?.nom, "Côtes-d'Armor");
  assert.equal(departementDe("Réunion")?.region, "la-reunion");
  assert.equal(departementDe("Corse"), null, "« Corse » est ambigu (2A/2B) : il faut la position");
  assert.equal(departementDuCodePostal("20090")?.code, "2A"); assert.equal(departementDuCodePostal("20200")?.code, "2B");
  assert.equal(departementDuCodePostal("97410")?.code, "974"); assert.equal(departementDuCodePostal("75008")?.nom, "Paris");
  assert.equal(departementParPosition(42.31, 9.15)?.code, "2B", "Corte"); assert.equal(departementParPosition(41.92, 8.74)?.code, "2A", "Ajaccio");
  assert.equal(departementParPosition(14.8, -61.22)?.code, "972", "Le Prêcheur"); assert.equal(departementParPosition(48.85, 2.35), null);
  for (const v of ["H2", "EH", "C1", "M6", "V6"]) assert.equal(departementEtranger(v), true, v);
  for (const v of ["2A", "59", "Nord", ""]) assert.equal(departementEtranger(v), false, v);
});

console.log("\n=== BRANCHEMENTS ===\n");

test("avant la migration, la fiche et la page publique retombent sur les anciens champs", () => {
  for (const f of ["src/app/api/races/detail/route.ts", "src/app/courses/[slug]/page.tsx", "src/app/api/races/list/route.ts"]) {
    assert.match(codeNu(f), /\berror\?\.code === "42703"/, `${f} : sans repli, une colonne absente ferait tout échouer`);
  }
  assert.match(codeNu("src/components/races/RacesHub.tsx"), /<LiensCourse detail=\{details\[selected\.id\]\} course=\{selected\} d=\{d\} \/>/);
  assert.match(codeNu("src/components/races/RacesMapView.tsx"), /<LiensCourse detail=\{details\[selected\.id\]\} course=\{selected\} d=\{d\}/);
  assert.match(codeNu("src/app/api/races/list/route.ts"), /let cols = RACE_COLS \+ COLS_032;/, "la liste doit demander date_confirmee");
  assert.match(codeNu("src/components/races/RacesHub.tsx"), /race\.date_confirmee === false && !race\.date\?\.startsWith\("2099"\)/, "la liste signale une date seulement annoncée");
  assert.match(codeNu("scripts/finishers-appliquer.ts"), /if \(lien && !f\.resultats\?\.classement\) \{ f\.resultats = /, "un lien de site ne remplace jamais un classement déjà cité");
  assert.match(codeNu("scripts/resultats-sites.ts"), /if \(!robotsAutorise\(rb, u\.pathname \+ u\.search\)\) return ecrire/, "robots.txt consulté avant de lire le site");
  // Un lien prouvé mort par le contrôle n'est jamais réécrit par l'application suivante.
  const app = codeNu("scripts/finishers-appliquer.ts");
  assert.match(app, /\/\^liens-controle-\.\*\\\.json\$\//, "l'application ne lit plus les rapports de liens morts");
  assert.match(app, /if \(f\.resultats\?\.classement && morts\.has\(f\.resultats\.classement\)\)/, "un classement mort serait réécrit");
  const sql = readFileSync("supabase/migrations/032_courses_liens_resultats.sql", "utf8").replace(/--.*$/gm, "");
  assert.doesNotMatch(sql, /\bdrop\b/i);
  for (const c of ["site_officiel", "inscription_url", "resultats_url", "resultats_annee", "heure_depart", "date_confirmee", "source_id", "source_maj_at"]) {
    assert.match(sql, new RegExp(`add column if not exists ${c}\\b`), c);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
