/**
 * COURSES LOCALES DATATOURISME (29/09/2026) — source ouverte, bruitée, filtrée strictement.
 *
 *   npx tsx tests/datatourisme.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lireCsv, distancesLues, evenementCourse, lignesDT, dateRetrouvee, cleCommune, manifestationsDatees, type ManifestationDatee } from "../src/lib/races/datatourisme";
import { organisateurReel } from "../src/lib/races/destination";
import { pasCourseAPiedParNom } from "../src/lib/races/nonCourse";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const AUJ = "2026-09-29";
const ligne = (o: Partial<Record<string, string>>): Record<string, string> => ({
  Nom_du_POI: "Les 10 km de Cholet", Categories_de_POI: "https://www.datatourisme.fr/ontology/core#SportsEvent|http://schema.org/Event",
  Latitude: "47.06", Longitude: "-0.88", Code_postal_et_commune: "49300#Cholet", Periodes_regroupees: "2026-10-25<->2026-10-25",
  Contacts_du_POI: "#https://www.10kmcholet.fr/", Description: "", URI_ID_du_POI: "https://data.datatourisme.fr/13/abc", ...o,
} as Record<string, string>);

test("CSV : guillemets, virgules et retours à la ligne DANS un champ", () => {
  const t = 'a,b,c\n"Trail, nocturne","ligne 1\nligne 2","il dit ""go"""\r\nx,y,z\n';
  assert.deepEqual(lireCsv(t), [["a", "b", "c"], ["Trail, nocturne", "ligne 1\nligne 2", 'il dit "go"'], ["x", "y", "z"]]);
});

test("distances : les énumérations « 5 et 10 km », les décimales, jamais le parking à 2 km", () => {
  assert.deepEqual(distancesLues("Course pédestre : 5 et 10 km de Tamaris"), [5, 10]);
  assert.deepEqual(distancesLues("Parcours de 18,3 km, 24,2 km et 43,7 km"), [18.3, 24.2, 43.7]);
  assert.deepEqual(distancesLues("Parking à 2 km du départ"), []);
  assert.deepEqual(distancesLues("à 900 km de Paris"), [], "au-delà de 250 km, ce n'est pas une course");
});

test("une vraie course à venir, avec site, est retenue — département et région par le code postal", () => {
  const e = evenementCourse(ligne({}), AUJ);
  assert.ok(e);
  assert.deepEqual([e!.commune, e!.departement.nom, e!.departement.region, e!.date, e!.kms], ["Cholet", "Maine-et-Loire", "pays-de-la-loire", "2026-10-25", [10]]);
});

test("filtre STRICT : ni marche, ni tarot, ni initiation, ni course à durée, ni passé, ni sans site", () => {
  for (const nom of ["Marche Octobre Rose 10 km", "Marathon de tarot 10 km", "Octobre Rose - Initiation course à pied 5 km", "Randonnée nocturne 12 km", "Trail - Les 10h du NTTB 6 km"]) {
    assert.equal(evenementCourse(ligne({ Nom_du_POI: nom }), AUJ), null, nom);
  }
  assert.equal(evenementCourse(ligne({ Categories_de_POI: "https://www.datatourisme.fr/ontology/core#CulturalEvent" }), AUJ), null, "pas un événement sportif");
  assert.equal(evenementCourse(ligne({ Periodes_regroupees: "2026-05-01<->2026-05-01" }), AUJ), null, "passée");
  assert.equal(evenementCourse(ligne({ Contacts_du_POI: "" }), AUJ), null, "sans site : aucune fiche sans lien");
  assert.equal(evenementCourse(ligne({ Nom_du_POI: "Trail des Combrailles", Description: "Venez courir !" }), AUJ), null, "aucune distance lisible");
});

test("les lignes insérées : une par distance, source nommée, type selon le nom", () => {
  const e = evenementCourse(ligne({ Nom_du_POI: "Trail du Val des Nymphes", Description: "Deux parcours : 10 et 20 km." }), AUJ)!;
  const l = lignesDT(e, "2026-09-29T00:00:00Z");
  assert.deepEqual(l.map((x) => [x.distance_km, x.type]), [[10, "trail_s"], [20, "trail_s"]]);
  assert.equal(l[0].organization, "DATAtourisme");
  assert.equal(l[0].registration_url, "https://www.10kmcholet.fr/");
  assert.equal(l[0].source_id, "dt:https://data.datatourisme.fr/13/abc:10", "idempotent : la même distance n'est jamais réinsérée");
  assert.equal(lignesDT(evenementCourse(ligne({}), AUJ)!, "x")[0].type, "road_10k");
});

test("Licence Ouverte 2.0 : la source est CITÉE, jamais présentée comme organisateur", () => {
  assert.equal(organisateurReel("DATAtourisme"), "");
  assert.match(codeNu("src/app/courses/[slug]/page.tsx"), /\{c\.organization === "DATAtourisme" && \(\s*<p[^>]*>\{t\("source\.datatourisme"\)\}<\/p>/);
  assert.match(codeNu("src/components/races/RacesHub.tsx"), /details\[selected\.id\]\?\.organization === "DATAtourisme"\s*\?\s*"DATAtourisme \(Licence Ouverte 2\.0\)"/);
  const dico = readFileSync("src/app/courses/coursesI18n.ts", "utf8");
  assert.equal([...dico.matchAll(/"source\.datatourisme": "[^"]*Licence Ouverte 2\.0[^"]*"/g)].length, 5);
});

test("date retrouvée : la même course dans la même commune — jamais par le seul nom de la ville", () => {
  const m = (commune: string, ...evts: [string, string][]) => new Map<string, ManifestationDatee[]>([[cleCommune(commune), evts.map(([nom, date]) => ({ nom, commune, date }))]]);
  // Vrais cas du 29/09/2026 (la Rouge Flamande : le 11/10, date confirmée par kikourou).
  assert.equal(dateRetrouvee({ name: "Les foulées de la Rouge Flamande", city: "Bergues" }, m("Bergues", ["La Rouge Flamande à Bergues", "2026-10-11"])), "2026-10-11");
  assert.equal(dateRetrouvee({ name: "Trail Victor Hugo", city: "Lescar" }, m("Lescar", ["11 ème trail Victor Hugo", "2026-11-08"])), "2026-11-08");
  // Faux rapprochements mesurés : le seul mot commun était la COMMUNE.
  assert.equal(dateRetrouvee({ name: "La Foulée du Madiran", city: "Madiran" }, m("Madiran", ["Portes ouvertes en Madiran & Pacherenc du Vic-Bilh", "2026-11-14"])), null);
  assert.equal(dateRetrouvee({ name: "Urban Trail de Romans", city: "Romans-sur-Isère" }, m("Romans-sur-Isère", ["Braderie Vintage - Ville de Romans", "2026-10-16"])), null);
  // Pas un nom de course : une montée aux lanternes n'est pas le trail.
  assert.equal(dateRetrouvee({ name: "Trail du Haut-Barr", city: "Saverne" }, m("Saverne", ["Montée en lumière vers le Château du Haut-Barr", "2026-10-31"])), null);
  assert.equal(dateRetrouvee({ name: "Marche nordique du Pignada", city: "Anglet" }, m("Anglet", ["Marche nordique du Pignada", "2026-10-04"])), null);
  // Deux dates pour la même course : on ne choisit pas au hasard.
  assert.equal(dateRetrouvee({ name: "Trail des 7 Monts", city: "Septmoncel" }, m("Septmoncel", ["Trail des 7 Monts", "2026-10-10"], ["Trail des 7 Monts", "2027-10-09"])), null);
  // Une autre commune ne compte pas.
  assert.equal(dateRetrouvee({ name: "Trail Victor Hugo", city: "Pau" }, m("Lescar", ["11 ème trail Victor Hugo", "2026-11-08"])), null);
});

test("date retrouvée : une période d'UN seul jour — sur deux jours, le jour de course est incertain", () => {
  const rows = [
    ligne({ Nom_du_POI: "47e édition de la course Marseille - Cassis", Code_postal_et_commune: "13008#Marseille 8e Arrondissement", Periodes_regroupees: "2026-10-24<->2026-10-25" }),
    ligne({ Nom_du_POI: "Course Marseille-Cassis", Code_postal_et_commune: "13260#Cassis", Periodes_regroupees: "2026-10-25<->2026-10-25" }),
  ];
  const m = manifestationsDatees(rows, AUJ, "2027-10-31");
  assert.equal(m.get(cleCommune("Marseille")), undefined, "le « 24 au 25 » n'est pas une date de course");
  assert.deepEqual(m.get(cleCommune("Cassis"))?.map((x) => x.date), ["2026-10-25"]);
  assert.equal(cleCommune("Marseille 8e Arrondissement"), cleCommune("Marseille"));
});

test("pas de la course à pied, d'après le NOM — seulement sans ambiguïté", () => {
  for (const n of ["Triathlon des Roses Paris", "Roc d'Azur VTT", "Randonnée verte", "Marche nordique du Pignada", "Bike and Run de la Batterie de Merville", "Duathlon de Troyes", "Rando des Benauges"]) {
    assert.equal(pasCourseAPiedParNom(n), true, n);
  }
  // La course y existe : on garde.
  for (const n of ["Trail et Rando des Caps", "Course Nature et Marche Nordique de Chevaigné", "Cyclosportive & running Babybel", "Rando Trail de Trept", "Foulées de Bondues", "Trail du Vélodrome"]) {
    assert.equal(pasCourseAPiedParNom(n), false, n);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
