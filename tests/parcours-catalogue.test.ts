/**
 * LE CATALOGUE DE PARCOURS : NOMS RÉPARÉS, SPORTS JUSTES, RIEN D'IMPRATICABLE.
 *
 * Cyprien, 27/11/2026 : « corrige les noms abîmés et vérifie que les 15 000 parcours
 * n'ont aucune erreur ». Audit du jour :
 *  · des noms tels qu'OpenStreetMap les porte : « Circuit de à » (from=fixme, to=fixme),
 *    « Goumois - fixme », « Circuit &quot;Etang…&quot; », « 67:1 AUTOUR DU VILLAGE… » ;
 *  · 61 « Randonnée » sur 15 708 : la collecte rangeait toute randonnée en « Trail » ;
 *  · des PROJETS de véloroute (« ID 10 Projet de Corbeil-Essonnes à Ballancourt ») et des
 *    relations supprimées d'OSM depuis la collecte.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { gunzipSync } from "node:zlib";
import { reparerNom, marqueFfrandonnee } from "../src/lib/parcours/noms";
import { aRetirer } from "../scripts/parcours-retirer-ffrandonnee";
import { doublons, nomNormalise } from "../scripts/parcours-dedoublonner";
import { sportDepuisOsm, raisonDeRetrait, auditer } from "../scripts/parcours-auditer";
import { geometrieIgn, estCleabs, ErreurIgn } from "../src/lib/parcours/geometrieIgn";
import { remesurer, ecartAcceptable, appliquerDecisions, estAllerRetour } from "../scripts/parcours-traces-appliquer";
import { juger, verdictSeule } from "../scripts/parcours-traces-controler";
import { denivele, alleger, recouvrement, sportDuCandidat, dejaAuCatalogue, longueurKm, SOURCES, penteMax,
  Grille, idHache, idsUniques, fusionner, reponseUtilisable, refusPassager, citeUnGr, enMetropole } from "../scripts/parcours-importer";
import { cleabsDuCatalogue } from "../src/lib/parcours/catalogue";
import { encoder, decoder, simplifier, traceStockee, oublierTranches, trancheDe, TRANCHES } from "../src/lib/parcours/tracesStockees";
import { aGarder, choisirOrdre } from "../scripts/parcours-traces-extraire";
import { indiceDePratique, SOURCES_OUVERTES } from "../scripts/parcours-sources-ouvertes";
import { praticableEnCourant, filterAndSort, type ParcoursHdf } from "../src/data/parcoursHdf";

let ok = 0;
const echecs: string[] = [];
const enAttente: (() => Promise<void>)[] = [];
function test(nom: string, fn: () => void | Promise<void>) {
  enAttente.push(async () => {
    try { await fn(); ok++; console.log(`  ✓ ${nom}`); }
    catch (e) { echecs.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${nom}`); }
  });
}

test("un nom tronqué se complète avec les VRAIES communes, sinon la partie vide s'en va", () => {
  assert.equal(reparerNom({ nom: "Circuit de à", depart: "Malaunay", arrivee: "Le Houlme" }), "Circuit de Malaunay à Le Houlme");
  assert.equal(reparerNom({ nom: "Circuit de Sauqueville à", depart: "Clères", arrivee: "Houppeville" }), "Circuit de Sauqueville à Houppeville");
  // Sans commune connue : on n'invente rien, on retire la préposition vide.
  assert.equal(reparerNom({ nom: "Circuit de à", depart: null, arrivee: null }), "Circuit");
  assert.equal(reparerNom({ nom: "Circuit de Sauqueville à", depart: null, arrivee: null }), "Circuit de Sauqueville");
  // Une commune « fixme » n'est pas une commune.
  assert.equal(reparerNom({ nom: "Circuit de à", depart: "fixme", arrivee: null }), "Circuit");
});

test("marqueurs OSM, entités HTML, parenthèses, majuscules", () => {
  assert.equal(reparerNom({ nom: "Goumois - fixme", depart: "Goumois" }), "Goumois");
  assert.equal(reparerNom({ nom: "Du poteau RE ?? à Belcodéne" }), "Du poteau RE à Belcodéne");
  assert.equal(reparerNom({ nom: "Barthalay - ?" }), "Barthalay");
  assert.equal(reparerNom({ nom: "Circuit &quot;Etang de Beaumont&quot;" }), "Circuit \"Etang de Beaumont\"");
  assert.equal(reparerNom({ nom: "(Sentier marron)" }), "Sentier marron");
  assert.equal(reparerNom({ nom: "67:1 AUTOUR DU VILLAGE D'AUTRAN (VERT)" }), "Autour du Village d'Autran (Vert)");
  assert.equal(reparerNom({ nom: "67:11 LE TOUR DU BOIS DE CLARET(BLEU)" }), "Le Tour du Bois de Claret (Bleu)");
  assert.equal(reparerNom({ nom: "VTT 7 - TREGUEUX" }), "VTT 7 - Tregueux", "un sigle a perdu ses majuscules");
});

test("les vrais noms ne sont PAS touchés (Toul Du, Circuit A, GR 34, noms ordinaires)", () => {
  for (const n of ["Circuit de Toul Du", "Circuit A", "GR 34", "Tour du Mont-Blanc", "Le Canal du Midi à vélo", "Circuit de Saint-Martin de Boscherville à Malaunay", "1/2 KV de la Toussuire"]) {
    assert.equal(reparerNom({ nom: n, depart: "X" }), n, `« ${n} » a été modifié`);
  }
  // Un code seul prend la commune de départ, pour être lisible dans une liste.
  assert.equal(reparerNom({ nom: "REV 6", depart: "Malaunay" }), "REV 6 · Malaunay");
});

test("le sport suit le TYPE OSM : une randonnée n'est plus rangée en « Trail » d'office", () => {
  assert.equal(sportDepuisOsm("hiking", 12, 120), "Randonnée", "rando de plaine (10 m/km)");
  assert.equal(sportDepuisOsm("hiking", 12, 600), "Trail", "rando de montagne (50 m/km)");
  assert.equal(sportDepuisOsm("foot", 8, 40), "Running", "boucle à pied courte et plate");
  assert.equal(sportDepuisOsm("foot", 30, 100), "Randonnée");
  assert.equal(sportDepuisOsm("running", 10, 500), "Running");
  assert.equal(sportDepuisOsm("bicycle", 40, 300), "Vélo (Route)");
  assert.equal(sportDepuisOsm("mtb", 25, 600), "VTT");
  assert.equal(sportDepuisOsm("bus", 10, 0), null);
});

test("supprimé d'OSM, projet ou abandonné : retiré du catalogue", () => {
  assert.equal(raisonDeRetrait(null), "supprimé d'OpenStreetMap");
  assert.equal(raisonDeRetrait({ route: "bicycle", state: "proposed" }), "projet (non réalisé)");
  assert.equal(raisonDeRetrait({ route: "hiking", state: "disused" }), "abandonné");
  assert.match(raisonDeRetrait({ route: "road" }) ?? "", /plus un itinéraire sportif/);
  assert.equal(raisonDeRetrait({ route: "hiking" }), null);
  // Audit du 27/11/2026 : deux vrais sentiers que la première règle retirait.
  assert.equal(raisonDeRetrait({ type: "route", route: "hiking;horse" }), null, "un sentier pédestre ET équestre a été retiré");
  assert.equal(raisonDeRetrait({ type: "route", route: "historic", network: "lwn" }), null, "une randonnée à thème historique a été retirée");
  assert.match(raisonDeRetrait({ type: "destination_sign" }) ?? "", /plus un itinéraire sportif/);
  assert.match(raisonDeRetrait({ type: "route", route: "horse" }) ?? "", /plus un itinéraire sportif/);
  assert.equal(raisonDeRetrait(undefined), null, "un parcours non relu est gardé tel quel");
  const { gardes, retires } = auditer([
    { osm_id: 1, nom: "Circuit de à", sport: "Vélo (Route)", distance_km: 3, denivele_positif_m: 10, depart: "Malaunay", arrivee: "Le Houlme" },
    { osm_id: 2, nom: "ID 10 Projet", sport: "Vélo (Route)", distance_km: 3, denivele_positif_m: 10 },
  ], { "1": { route: "bicycle", name: "Circuit de à" }, "2": { route: "bicycle", state: "proposed" } });
  assert.equal(gardes.length, 1);
  assert.equal(gardes[0].nom, "Circuit de Malaunay à Le Houlme");
  assert.equal(retires[0].raison, "projet (non réalisé)");
});

test("import : le dénivelé se mesure comme la certification (seuil de 4 m, pas de bruit additionné)", () => {
  assert.deepEqual(denivele([100, 101, 102, 101, 100, 110, 120, 115, 100]), { dp: 20, dm: 20, min: 100, max: 120 });
  assert.equal(denivele([null, null]), null, "une altitude absente est inventée");
  // Du bruit de ±1,5 m sur du plat (écarts de 3 m, sous le seuil) : 0 m de D+, pas 300.
  assert.equal(denivele(Array.from({ length: 200 }, (_, i) => 50 + (i % 2 ? 1.5 : -1.5)))!.dp, 0);
});

test("import : un tracé allégé garde ses extrémités et sa longueur", () => {
  const ligne: [number, number][] = Array.from({ length: 2000 }, (_, i) => [1 + i * 0.0001, 49.44]);
  const leger = alleger(ligne, 25, 300);
  assert.ok(leger.length <= 300);
  assert.deepEqual(leger[0], ligne[0]); assert.deepEqual(leger[leger.length - 1], ligne[ligne.length - 1]);
  assert.ok(Math.abs(longueurKm(leger) - longueurKm(ligne)) < 0.05, "l'allègement raccourcit le parcours");
});

test("import : un même parcours dans deux sources est reconnu par son TRACÉ", () => {
  const a: [number, number][] = Array.from({ length: 100 }, (_, i) => [1 + i * 0.0005, 49.44]);
  const decale: [number, number][] = a.map(([x, y]) => [x, y + 0.0002]);        // ~22 m à côté
  const ailleurs: [number, number][] = a.map(([x, y]) => [x, y + 0.01]);         // ~1,1 km
  assert.ok(recouvrement(a, decale) >= 0.9);
  assert.ok(recouvrement(a, ailleurs) === 0);
  const cat = [{ lat: 49.44, lng: 1.0, distance_km: 10, sport: "Randonnée" }];
  assert.equal(dejaAuCatalogue({ lat: 49.4405, lng: 1.0, distance_km: 10.5, sport: "Trail" }, cat), true, "même départ, même longueur : doublon");
  assert.equal(dejaAuCatalogue({ lat: 49.4405, lng: 1.0, distance_km: 10.5, sport: "Vélo (Route)" }, cat), false, "un vélo n'est pas le doublon d'une rando");
  assert.equal(dejaAuCatalogue({ lat: 49.46, lng: 1.0, distance_km: 10, sport: "Trail" }, cat), false);
});

test("import : le sport d'un itinéraire ouvert, et ce qui n'est pas repris", () => {
  assert.equal(sportDuCandidat({ cle: "a", source: "ign", nom: "Voie Verte de la Seine à Vélo", nature: "Itinéraire cyclable" }, 30, 50), "Vélo (Route)");
  assert.equal(sportDuCandidat({ cle: "b", source: "ign", nom: "la Table de Pierre", nature: "Itinéraire de randonnée pédestre" }, 9, 90), "Randonnée");
  assert.equal(sportDuCandidat({ cle: "c", source: "ign", nom: "x", nature: "Itinéraire équestre" }, 9, 90), null, "un itinéraire équestre n'est pas repris");
  assert.equal(sportDuCandidat({ cle: "d", source: "metropole", nom: "Balade le long du Cailly" }, 5, 40), "Randonnée");
  assert.equal(sportDuCandidat({ cle: "e", source: "osm", nom: "x", osm: { id: 1, route: "mtb" } }, 20, 300), "VTT");
  // Chaque source porte sa licence et l'attribution qu'elle exige.
  assert.equal(SOURCES.ign.licence, "Licence Ouverte 2.0");
  assert.equal(SOURCES.metropole.licence, "Licence Ouverte v2.0");
  assert.equal(SOURCES.osm.licence, "ODbL 1.0");
});

test("IGN : le tracé se relit par son identifiant, et RIEN d'autre ne part dans la requête", async () => {
  assert.equal(estCleabs("ITI_AUT_0000002150475877"), true);
  for (const x of ["ITI_AUT_1' OR '1'='1", "ITI_AUT_", "../etc", "ITI_AUT_00000021504758771"]) assert.equal(estCleabs(x), false, x);
  await assert.rejects(geometrieIgn("ITI_AUT_1' OR 1=1"), (e: unknown) => e instanceof ErreurIgn && e.status === 400);
  const reponse = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  const ok = await geometrieIgn("ITI_AUT_0000002150475877", reponse({ features: [{ geometry: { type: "MultiLineString", coordinates: [[[1.0, 49.4], [1.01, 49.4]], [[1.01, 49.4], [1.02, 49.4]]] } }] }));
  assert.equal(ok.coords.length, 3, "les deux morceaux ne sont pas raccordés");
  // Retiré de la BD TOPO : refus définitif ; panne : son statut, pour dire « réessaie ».
  await assert.rejects(geometrieIgn("ITI_AUT_0000002150475877", reponse({ features: [] })), (e: unknown) => e instanceof ErreurIgn && e.status === 404);
  await assert.rejects(geometrieIgn("ITI_AUT_0000002150475877", reponse({}, 502)), (e: unknown) => e instanceof ErreurIgn && e.status === 502);
  // Un 404 HTTP = le service introuvable, pas l'itinéraire retiré : jamais le refus définitif.
  await assert.rejects(geometrieIgn("ITI_AUT_0000002150475877", reponse({}, 404)), (e: unknown) => e instanceof ErreurIgn && e.status === 502);
});

test("import : deux itinéraires n'ont JAMAIS le même identifiant (collision réelle du hachage)", () => {
  const a = "ign-ITI_AUT_0000002223466300", b = "ign-ITI_AUT_0000002244084040";
  assert.equal(idHache(a), idHache(b), "la paire relevée le 28/11/2026 se heurte bien au hachage seul");
  const ids = idsUniques([b, a, a], []);
  assert.equal(ids.size, 2);
  assert.notEqual(ids.get(a), ids.get(b), "deux itinéraires, un seul identifiant : l'un afficherait le tracé de l'autre");
  // Une place déjà prise au catalogue n'est pas réattribuée.
  const pris = idsUniques(["ign-ITI_AUT_0000002150475166"], [idHache("ign-ITI_AUT_0000002150475166")]);
  assert.notEqual(pris.get("ign-ITI_AUT_0000002150475166"), idHache("ign-ITI_AUT_0000002150475166"));
  // Stable d'un passage à l'autre : l'ordre des candidats ne change rien.
  assert.deepEqual([...idsUniques([a, b], [])].sort(), [...idsUniques([b, a], [])].sort());
});

test("import : l'écriture finale part du catalogue D'AUJOURD'HUI, sans ressusciter un retrait", () => {
  // Au début de l'import : 1, 2, 3. Pendant l'import, l'audit retire 2. Ajouts : 9 et 3 (déjà là).
  const courant = [{ osm_id: 1 }, { osm_id: 3 }];
  const { catalogue, ecartes } = fusionner(courant, [{ osm_id: 9 }, { osm_id: 3 }]);
  assert.deepEqual(catalogue.map((p) => p.osm_id), [1, 3, 9], "le retrait de 2 est gardé, 3 n'est pas doublé");
  assert.equal(ecartes, 1);
  assert.throws(() => fusionner(courant, [{ osm_id: 9 }, { osm_id: 9 }]), /en double/);
});

test("le contrôle s'applique au catalogue RELU au dernier moment, sans écraser un ajout", () => {
  // Au début : 1, 2, 3. Décisions : 2 retiré, 3 remesuré. Pendant l'altitude, l'import ajoute 7.
  const frais = [{ osm_id: 1, d: 5 }, { osm_id: 2, d: 6 }, { osm_id: 3, d: 7 }, { osm_id: 7, d: 9 }];
  const out = appliquerDecisions(frais, new Map([[2, null], [3, { osm_id: 3, d: 8 }]]));
  assert.deepEqual(out, [{ osm_id: 1, d: 5 }, { osm_id: 3, d: 8 }, { osm_id: 7, d: 9 }], "l'ajout 7 est perdu ou le retrait de 2 ignoré");
  // Un nom réparé entre-temps survit à la remesure : seuls les champs mesurés passent.
  const nom = appliquerDecisions([{ osm_id: 3, nom: "Circuit de Malaunay", distance_km: 5, profil: [[0, 1]] }], new Map([[3, { distance_km: 8 }]]));
  assert.deepEqual(nom, [{ osm_id: 3, nom: "Circuit de Malaunay", distance_km: 8 }], "la remesure a écrasé la ligne fraîche, ou gardé l'ancien profil");
});

test("la route sert des noms RÉPARÉS et ignore une position impossible (site d'appel, pas les données)", async () => {
  // Un catalogue de travail, avec un nom tel qu'OSM peut le rendre demain.
  const dossier = mkdtempSync(join(tmpdir(), "pacevo-parcours-"));
  mkdirSync(join(dossier, "data"));
  const brut = [
    { osm_id: 11, osm_type: "relation", nom: "Circuit de à", depart: "Malaunay", arrivee: "Le Houlme", sport: "Randonnée", distance_km: 8, lat: 43.3, lng: 5.4 },
    { osm_id: 12, osm_type: "relation", nom: "Boucle du Nord", sport: "Trail", distance_km: 9, lat: 50.6, lng: 3.0 },
    { osm_id: 13, osm_type: "relation", nom: "Boucle du Centre", sport: "Trail", distance_km: 10, lat: 47.0, lng: 2.0 },
  ];
  writeFileSync(join(dossier, "data", "parcours_certifies.min.json.gz"), gzipSync(Buffer.from(JSON.stringify(brut))));
  const ici = process.cwd();
  process.chdir(dossier);
  try {
    const { GET } = await import("../src/app/api/parcours/route");
    const { NextRequest } = await import("next/server");
    const lire = async (q: string) => (await (await GET(new NextRequest(`http://localhost/api/parcours?pageSize=60${q}`))).json()) as { items: { osm_id: number; nom: string }[] };
    const tous = await lire("");
    assert.equal(tous.items.find((p) => p.osm_id === 11)?.nom, "Circuit de Malaunay à Le Houlme");
    // La route marque « praticable en courant » (8 km, plat) : sans elle, le filtre Running l'ignore.
    assert.equal((tous.items.find((p) => p.osm_id === 11) as { courable?: boolean } | undefined)?.courable, true, "randonnée plate non marquée praticable en courant");
    assert.ok((await lire("&sport=Running")).items.some((p) => p.osm_id === 11), "le filtre Running de la route ne la montre pas");
    // Latitude 95 : aucun tri « près de moi » vers le pôle (Lille d'abord), même ordre que sans position.
    // (Le catalogue de travail est rangé du sud au nord : un tri vers le pôle l'inverserait.)
    const ordre = (r: { items: { osm_id: number }[] }) => r.items.map((p) => p.osm_id);
    assert.deepEqual(ordre(await lire("&sort=proche&near=95,2")), ordre(await lire("&sort=proche")), "une position impossible a ordonné la liste");
    assert.deepEqual(ordre(await lire("&sort=proche&near=43.3,5.4")).slice(0, 1), [11], "une vraie position ordonne la liste");
  } finally { process.chdir(ici); }
});

test("doublon : la copie d'un LONG parcours se reconnaît, même contre un tracé de 60 points", () => {
  // 20 km vers l'est, en 400 points ; la copie décalée de 15 m au nord, ramenée à 60 points.
  const long: [number, number][] = Array.from({ length: 400 }, (_, k) => [1.0 + (k * 0.276) / 399, 49.4]);
  const copie = long.filter((_, k) => k % 7 === 0).map(([x, y]) => [x, y + 0.000135] as [number, number]);
  const g = new Grille();
  g.ajouter("cat-1", copie);
  assert.equal(g.doublon(long), "cat-1", "un doublon de 20 km passe pour un nouveau parcours");
  // Un parcours voisin, à 300 m, n'est PAS un doublon.
  assert.equal(g.doublon(long.map(([x, y]) => [x, y + 0.0027] as [number, number])), null);
});

test("dénivelé : une altitude trouée n'est pas une mesure", () => {
  assert.equal(denivele([100, null, null, null, 180, null, null, null, null, null]), null, "8 altitudes sur 10 manquent : un D+ inventé");
  assert.deepEqual(denivele([100, 110, 120, 130, 140, 150, 160, 170, 180, null]), { dp: 80, dm: 0, min: 100, max: 180 }, "une seule manque : mesuré");
});

test("contrôle : une relation n'est « vide » qu'après DEUX miroirs qui ne l'ont pas", () => {
  const el = { id: 5 };
  assert.equal(verdictSeule([{ elements: [] }, null]), undefined, "un seul miroir répond vide : rien de sûr");
  assert.equal(verdictSeule([{ elements: [] }]), undefined);
  assert.equal(verdictSeule([{ elements: [] }, { elements: [] }]), null, "deux miroirs d'accord : vide");
  assert.equal(verdictSeule([{ elements: [] }, { elements: [el] }]), el, "un miroir la voit : elle existe");
  assert.equal(verdictSeule([null, null]), undefined);
});

test("route IGN : catalogue illisible et tracé incomplet laissent une trace, la source s'affiche partout pareil", () => {
  const route = readFileSync("src/app/api/parcours/geometry/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const ign = route.slice(route.indexOf("async function traceIgn"), route.indexOf("export async function GET"));
  const branche = ign.slice(ign.indexOf("if (cleabs === null)"), ign.indexOf("if (!cleabs)"));
  assert.match(branche, /journaliserEchecUneFois\(/, "catalogue illisible : aucun parcours IGN ne s'ouvre, et /admin n'en dit rien");
  assert.match(ign, /PARTIELS\.set\(`ign\/\$\{id\}`/, "un tracé IGN incomplet relu au WFS à chaque clic");
  assert.match(ign, /estErreurTransitoire\(/, "un refus du service promis comme passager");
  const absent = ign.slice(ign.indexOf("e.status === 404"), ign.indexOf("definitif: true"));
  assert.match(absent, /journaliserEchecUneFois\(/, "un parcours IGN disparu de la BD TOPO, et personne ne le sait");
  const cond = (f: string, v: string) => readFileSync(f, "utf8").includes(`${v}.osm_type && ${v}.osm_type !== "relation" && ${v}.osm_type !== "way" && ${v}.source`);
  assert.ok(cond("src/components/parcours/ParcoursBrowser.tsx", "p") && cond("src/components/trail/TrailBuilder.tsx", "choisi"), "la mention de source diffère entre la liste et la carte");
});

test("Lille : une randonnée courte et plate sort au filtre Running, affichée comme telle", () => {
  // « Autour de la Citadelle » : 5,43 km, D+ 0 — était invisible au filtre Running (28/11/2026).
  assert.equal(praticableEnCourant({ sport: "Randonnée", distance_km: 5.43, denivele_positif_m: 0 }), true);
  assert.equal(praticableEnCourant({ sport: "Randonnée", distance_km: 12, denivele_positif_m: 400 }), false, "33 m/km : du relief, pas une sortie de course");
  assert.equal(praticableEnCourant({ sport: "Randonnée", distance_km: 66, denivele_positif_m: 150 }), false, "66 km : une randonnée sur plusieurs jours");
  assert.equal(praticableEnCourant({ sport: "Randonnée", distance_km: 1.2, denivele_positif_m: 0 }), false, "1,2 km : trop court");
  assert.equal(praticableEnCourant({ sport: "Randonnée", distance_km: 10, denivele_positif_m: 0, denivele_negatif_m: -400 }), false, "une descente de 400 m n'est pas plate");
  assert.equal(praticableEnCourant({ sport: "Vélo (Route)", distance_km: 8, denivele_positif_m: 10 }), false, "un itinéraire vélo n'est pas proposé en course");
  assert.equal(praticableEnCourant({ sport: "Vélo (Route)", distance_km: 8, denivele_positif_m: 10, nom: "Voie verte · Canal de Roubaix" }), true, "une voie verte (piétons admis, R110-2) se court");
  assert.equal(praticableEnCourant({ sport: "Vélo (Route)", distance_km: 60, denivele_positif_m: 100, nom: "Voie verte de la Seine" }), false, "60 km : pas une sortie de course");
  const base = { difficulte: "Facile", type_parcours: "Boucle", denivele_negatif_m: 0, temps_estime: "", calories_kcal: 0, pente_mean: "", altitude_min_m: 0, altitude_max_m: 0, localisation: { region: "", departement: "" }, description: "" } as const;
  const liste = [
    { ...base, id: 1, nom: "Autour de la Citadelle", sport: "Randonnée", distance_km: 5.43, denivele_positif_m: 0, courable: true },
    { ...base, id: 2, nom: "Boucle du Nord", sport: "Running", distance_km: 8, denivele_positif_m: 10 },
    { ...base, id: 3, nom: "Grand Tour", sport: "Randonnée", distance_km: 40, denivele_positif_m: 100 },
  ] as ParcoursHdf[];
  assert.deepEqual(filterAndSort(liste, { sport: "Running" }).map((p) => p.id).sort(), [1, 2], "le filtre Running perd la Citadelle, ou prend une longue randonnée");
  assert.deepEqual(filterAndSort(liste, { sport: "Randonnée" }).map((p) => p.id).sort(), [1, 3], "la Citadelle reste une randonnée");
});

test("tracés gardés : encodés sans perte utile, simplifiés sans déformer, contrôlés avant d'être gardés", () => {
  const ligne: [number, number][] = Array.from({ length: 200 }, (_, k) => [1 + k * 0.0005, 49.4 + Math.sin(k / 10) * 0.002]);
  const d = decoder(encoder(ligne));
  assert.equal(d.length, ligne.length);
  assert.ok(d.every(([x, y], i) => Math.abs(x - ligne[i][0]) < 6e-6 && Math.abs(y - ligne[i][1]) < 6e-6), "un point déplacé de plus d'un mètre à l'encodage");
  const droite: [number, number][] = Array.from({ length: 50 }, (_, k) => [1 + k * 0.001, 49.4]);
  assert.equal(simplifier(droite, 4).length, 2, "une ligne droite garde ses 50 points");
  const s = simplifier(ligne, 4);
  assert.ok(s.length < ligne.length && Math.abs(longueurKm(s) - longueurKm(ligne)) / longueurKm(ligne) < 0.02, "la simplification déforme le tracé de plus de 2 %");
  assert.ok("ok" in aGarder(ligne, longueurKm(ligne)), "un tracé conforme n'est pas gardé");
  assert.ok("refus" in aGarder(ligne, longueurKm(ligne) * 1.5), "un tracé qui ne fait pas la distance du catalogue est gardé");
  assert.ok("refus" in aGarder([], 5));
  // Deux chaînages du même tracé : celui qui fait la distance mesurée (« 10 - Teliere »).
  const court = droite.slice(0, 20), long = droite;
  assert.equal(choisirOrdre([court, long], longueurKm(long)), long);
  assert.equal(trancheDe(-5), TRANCHES - 5, "un identifiant négatif sort des tranches");
});

test("tracés gardés : lus depuis leur tranche, et rien pour un parcours absent", () => {
  const dossier = mkdtempSync(join(tmpdir(), "pacevo-traces-"));
  const id = 9_000_000_123, c: [number, number][] = [[1, 49.4], [1.01, 49.41], [1.02, 49.4]];
  writeFileSync(join(dossier, `${trancheDe(id)}.json.gz`), gzipSync(Buffer.from(JSON.stringify({ [id]: encoder(c) }))));
  process.env.PACEVO_DOSSIER_TRACES = dossier;
  oublierTranches();
  try {
    assert.deepEqual(traceStockee(id), c);
    assert.equal(traceStockee(id + TRANCHES), null, "un parcours de la même tranche, absent, reçoit un tracé");
    assert.throws(() => traceStockee(id + 1), "une tranche ABSENTE passe pour « aucun tracé » : la route retomberait sur Overpass sans le dire");
  } finally { delete process.env.PACEVO_DOSSIER_TRACES; oublierTranches(); }
  // La route sert le tracé gardé AVANT toute source, et seulement pour un parcours du catalogue.
  const route = readFileSync("src/app/api/parcours/geometry/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const avant = route.slice(route.indexOf("export async function GET"), route.indexOf("return traceIgn(id)"));
  assert.match(avant, /const gardee = await traceGardee\(typeCatalogue, id\);\s*if \(gardee\.coords\) return NextResponse\.json\(\{ coordinates: gardee\.coords \}/, "le tracé gardé n'est plus servi en premier");
  assert.match(route, /if \(estDuCatalogue\(type, id\) !== true\) return \{\};/, "un tracé gardé est servi pour un identifiant hors catalogue (ou sous un autre type)");
  // Tranche en panne pour une source ouverte : « réessaie », jamais « définitif ».
  assert.match(avant, /if \(sansSource && gardee\.panne\) return NextResponse\.json\(\{ error: "Géométrie indisponible pour le moment\." \}, \{ status: 503/, "une tranche cassée est annoncée « tracé définitivement indisponible »");
  assert.match(avant, /const sansSource = typeCatalogue === "ouvert" \|\| typeCatalogue === "metropole";/, "un parcours de la Métropole ou d'une source ouverte part chez Overpass sous un identifiant inventé");
  // Le nombre de tranches de la route (next.config) est celui du module.
  assert.match(readFileSync("next.config.ts", "utf8"), new RegExp(`Array\\.from\\(\\{ length: ${TRANCHES} \\}`), "next.config n'embarque pas toutes les tranches");
});

test("sources ouvertes : licence citée, pratique lue, rien d'équestre", () => {
  for (const s of SOURCES_OUVERTES) {
    assert.match(s.licence, /^(Licence Ouverte (1|2)\.0|ODbL 1\.0)$/, `${s.cle} : licence ${s.licence}`);
    assert.match(s.page, /^https:\/\//, `${s.cle} : la page de la licence manque`);
    assert.ok(s.attribution.length > 10, `${s.cle} : attribution vide`);
  }
  assert.equal(new Set(SOURCES_OUVERTES.map((s) => s.cle)).size, SOURCES_OUVERTES.length, "deux sources ont la même clé (identifiants en double)");
  for (const [p, i] of [["À pied", "à pied"], ["Pédestre", "à pied"], ["trail", "Trail"], ["VTTAE", "VTT"], ["Gravel", "VTT"], ["cyclo", "Vélo (Route)"], ["Équestre", null], ["Cheval", null], ["Alpinisme", null], ["Points-nœuds", null], ["Moto", null]] as const)
    assert.equal(indiceDePratique(p), i, p);
});

test("FFRandonnée : aucun GR®, ni au nom, ni à la référence, ni à l'opérateur — une petite randonnée locale reste", () => {
  assert.ok(marqueFfrandonnee("Accès GR 59"));
  assert.ok(marqueFfrandonnee("PR Vert Correns"), "« PR » dans le NOM : la marque serait affichée");
  assert.ok(marqueFfrandonnee("Lévignac, une Grande Randonnée en Guyenne"));
  assert.ok(marqueFfrandonnee("Voie d'Ossau", { ref: "GR 108" }), "un GR® sous un autre nom (106 cas, 28/11/2026)");
  assert.ok(marqueFfrandonnee("Tour du Mont Aigoual", { operator: "FFRP" }));
  assert.ok(marqueFfrandonnee("Au Pays de Jeanne d'Arc", { operator: "Fédération Française de la Randonnée Pédestre" }));
  assert.ok(marqueFfrandonnee("Circuit des sources", { ref: "GR® de Pays,PR" }), "un réseau « GR® de Pays » d'une source ouverte");
  assert.equal(marqueFfrandonnee("Autour de Baffie", { ref: "PR 3" }), null, "une petite randonnée numérotée PR par le département est retirée");
  assert.equal(marqueFfrandonnee("Les Grès de Fontainebleau"), null, "« Grès » pris pour un GR (le piège du \\b)");
  assert.equal(marqueFfrandonnee("Prairie du Cailly"), null);
  const retraits = aRetirer([
    { osm_id: 1, nom: "Voie d'Ossau" }, { osm_id: 2, nom: "Autour de Baffie" },
    { osm_id: 3, osm_type: "ign", nom: "PR la Voie Romaine" }, { osm_id: 4, osm_type: "ign", nom: "Voie d'Ossau" },
  ], { "1": { ref: "GR 108" }, "2": { ref: "PR 3" }, "4": { ref: "GR 108" } });
  assert.deepEqual([...retraits.keys()].sort(), [1, 3], "les étiquettes OSM s'appliquent à un parcours IGN de même numéro, ou un GR passe");
});

test("Overpass : une réponse vide ou tronquée n'est PAS une liste de relations disparues", () => {
  const elements = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));
  assert.equal(reponseUtilisable({ elements: [] }, 40), false, "200 sans éléments : 40 parcours retirés d'un coup");
  assert.equal(reponseUtilisable({ elements: elements(12) }, 40), false, "moins de la moitié revenue");
  assert.equal(reponseUtilisable({ elements: elements(40), remark: "runtime error: Query run out of memory" }, 40), false);
  assert.equal(reponseUtilisable({ elements: elements(38) }, 40), true, "deux relations vraiment absentes");
  // Un refus passager n'entre jamais dans le cache de reprise ; un vrai refus, si.
  for (const r of ["API Géo injoignable (à remesurer)", "altitude IGN indisponible", "erreur (fetch failed)", "tracé OSM absent", "tracé OSM illisible (API OSM 503)"]) assert.equal(refusPassager(r), true, r);
  for (const r of ["trop court (0.6 km)", "tracé troué (40 % écartés)", "hors de France métropolitaine"]) assert.equal(refusPassager(r), false, r);
});

test("import : ni GR®/PR® de la FFRandonnée hors OSM, ni outre-mer, ni sport deviné sur un bout de mot", () => {
  for (const n of ["GR 34", "Boucle des Huguenots GR 965", "Liaison GR 7 au GRP des Grands Crus", "Ancien GR de Pays", "PR 12 du Vexin", "Sentier GR®"]) assert.equal(citeUnGr(n), true, n);
  for (const n of ["Grande boucle de la Seine", "Les Grès de Fontainebleau", "Prairie du Cailly"]) assert.equal(citeUnGr(n), false, n);
  assert.equal(enMetropole([55.45, -20.9]), false, "La Réunion");
  assert.equal(enMetropole([9.45, 42.7]), true, "Corse");
  const ign = (nom: string, nature: string) => sportDuCandidat({ cle: "x", source: "ign", nom, nature }, 8, 100);
  assert.equal(ign("Sentier du développement durable", "Itinéraire de randonnée pédestre"), "Randonnée");
  assert.equal(ign("Sentier du Champ de Courses", "Itinéraire de randonnée pédestre"), "Randonnée");
  assert.equal(ign("Chemin du Chevalier", "Itinéraire de randonnée pédestre"), "Randonnée");
  assert.equal(ign("Les bois", "Itinéraire cyclable · Itinéraire VTT"), "VTT");
  assert.equal(ign("Le moulin, à pied ou à vélo", "Itinéraire de randonnée pédestre"), "Randonnée", "la nature de l'IGN prime sur le nom");
  assert.equal(ign("Les bois", "Itinéraire de randonnée pédestre · Parcours sportif"), "Running");
});

test("IGN : la route ne relit que les itinéraires DU CATALOGUE, et refuse un morceau", () => {
  // Sans les commentaires (sans couper « :// ») : une ligne mise en commentaire ne compte pas.
  const route = readFileSync("src/app/api/parcours/geometry/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.match(route, /if \(typeParam === "ign"\) return traceIgn\(id\);/);
  // La porte des comptes connectés passe AVANT (service gratuit de l'IGN, pas d'accès anonyme).
  assert.ok(route.indexOf("denyIfAnonymous()") < route.indexOf("return traceIgn(id)"), "la route IGN est ouverte aux anonymes");
  assert.match(route, /const cleabs = cleabsDuCatalogue\(id\);/);
  assert.match(route, /if \(distanceKm > 0 && tracePartiel\(coords, distanceKm\)\) throw new TraceIncomplet/);
  // Le catalogue livré garde l'identifiant IGN (sinon aucun tracé IGN ne s'affiche).
  assert.match(readFileSync("scripts/parcours-compacter.ts", "utf8"), /"cle_source"/);
});

test("contrôle des tracés : la longueur jugée est celle du tracé AFFICHÉ, pas la somme des morceaux", () => {
  // Un morceau isolé à 5 km (variante détachée) : écarté du tracé affiché, donc pas compté.
  // ⚠️ Un même chemin listé DEUX fois, lui, est un aller-retour réel (« Autour de la citadelle »,
  // 23 membres pour 20 chemins) : compté deux fois, comme on le court.
  const ligne = (lat: number) => Array.from({ length: 6 }, (_, k) => [1.0 + (k * 0.0137) / 5, lat] as [number, number]);
  const t = ligne(49.4);                                                     // ≈ 1 km, 6 points
  const loin = ligne(49.45);                                                 // ≈ 1 km, 5,5 km plus au nord
  const v = juger([t, loin], 1, false);
  assert.ok(v.km! < 1.2, `longueur jugée ${v.km} km pour un tracé affiché de 1 km`);
  assert.equal(v.verdict, "troué", "la moitié du tracé en morceau isolé : signalé troué");
  assert.equal(juger([t, [...t].reverse()], 2, false).verdict, "ok", "aller-retour : 2 km");
  assert.equal(juger([t], 3, false).verdict, "partiel", "1 km de tracé pour 3 annoncés : partiel");
  assert.equal(juger([t], 0.8, false).verdict, "écart");
  assert.equal(juger([], 5, true).verdict, "super-relation");
});

test("un écart remesuré porte des chiffres COHÉRENTS, et rien de l'ancien tracé", () => {
  const p = { osm_id: 1, nom: "Boucle de la Bibiche", sport: "Randonnée", distance_km: 5.55, denivele_positif_m: 40, pente_max_pct: 6, montee_max_m: 25, profil: [[0, 165]] };
  const q = remesurer(p, 8.01, { dp: 52, dm: 50, min: 159, max: 196 }, 9) as Record<string, unknown>;
  assert.equal(q.distance_km, 8.01);
  assert.equal(q.denivele_positif_m, 52);
  assert.equal(q.duree_min, Math.round((8.01 / 4.8) * 60 + 0.52 * 10));
  assert.equal(q.difficulte, "Facile");
  assert.equal(q.pente_max_pct, 9, "pente recalculée sur le nouveau tracé");
  assert.ok(!("profil" in q) && !("montee_max_m" in q), "profil et montée de l'ancien tracé effacés");
  assert.equal(q.nom, "Boucle de la Bibiche");
});

test("un tracé sans rapport avec le parcours annoncé est retiré, pas remesuré", () => {
  assert.equal(ecartAcceptable(8.01, 5.55), true, "Bibiche : × 1,44, remesurée");
  assert.equal(ecartAcceptable(41.27, 14.29), false, "Juine : × 2,9, des variantes mises bout à bout");
  assert.equal(ecartAcceptable(2, 5), false, "× 0,4");
  assert.equal(ecartAcceptable(3, 0), false, "aucune distance annoncée : rien à comparer");
});

test("un aller-retour se reconnaît (même chemin à l'aller et au retour), une vraie boucle non", () => {
  const aller = Array.from({ length: 50 }, (_, k) => [1.0 + k * 0.0006, 49.4 + k * 0.0002] as [number, number]);
  assert.equal(estAllerRetour([...aller, ...[...aller].reverse().slice(1)]), true, "Pic de Courmettes : 3,76 km d'aller, 7,54 km de tracé");
  // Une boucle : retour par un autre chemin, 1 km plus au nord.
  const retour = [...aller].reverse().map(([x, y]) => [x, y + 0.009] as [number, number]);
  assert.equal(estAllerRetour([...aller, ...retour, aller[0]]), false);
  assert.equal(estAllerRetour(aller), false, "un aller simple");
  // Un aller-retour prolongé de 500 m au-delà du départ : on ne finit plus où on a commencé.
  const prolonge: [number, number][] = [[0.993, 49.4]];   // un point, 500 m au-delà
  assert.equal(estAllerRetour([...aller, ...[...aller].reverse().slice(1), ...prolonge]), false, "fin à 500 m du départ");
});

test("la pente maximale ignore les points trop proches (bruit de l'altitude)", () => {
  const pts: [number, number][] = [[1, 49.4], [1.0001, 49.4], [1.0011, 49.4]];  // 7 m puis 73 m
  assert.equal(penteMax(pts, [100, 105, 108]), 4, "les 5 m sur 7 m (71 %) ne comptent pas");
});

// ── Le catalogue LIVRÉ (celui que lit la production) ──────────────────────────────
const livre = JSON.parse(gunzipSync(readFileSync("data/parcours_certifies.min.json.gz")).toString("utf8")) as { osm_id: number; nom: string; sport: string; distance_km: number; lat: number; lng: number }[];

test("audit : un nom OSM vide garde le nom du catalogue", () => {
  const { gardes } = auditer([{ osm_id: 4, nom: "Boucle des Étangs", sport: "Randonnée", distance_km: 8, denivele_positif_m: 40 }], { "4": { type: "route", route: "hiking", name: "  " } });
  assert.equal(gardes[0].nom, "Boucle des Étangs");
});

test("le catalogue livré (.gz) est celui des données : mêmes parcours que data/parcours_certifies.json", () => {
  const complet = JSON.parse(readFileSync("data/parcours_certifies.json", "utf8")) as { osm_id: number }[];
  const a = complet.map((p) => p.osm_id).sort((x, y) => x - y), b = livre.map((p) => p.osm_id).sort((x, y) => x - y);
  assert.equal(b.length, a.length, "le .gz n'a pas été recompacté après la dernière écriture (parcours-compacter.ts)");
  assert.deepEqual(b, a);
});

test("le catalogue livré : CHAQUE parcours a son tracé gardé, et il fait la distance affichée", () => {
  oublierTranches();
  const sans: string[] = [], faux: string[] = [];
  for (const p of livre as { osm_id: number; osm_type?: string; nom: string; distance_km: number; coordinates?: [number, number][] }[]) {
    const c = p.coordinates?.length ? p.coordinates : traceStockee(p.osm_id);
    if (!c) { sans.push(`${p.osm_id} ${p.nom}`); continue; }
    const km = longueurKm(c);
    if (Math.abs(km - p.distance_km) / p.distance_km > 0.15) faux.push(`${p.osm_id} ${p.nom} : ${p.distance_km} km affichés, ${km.toFixed(2)} km de tracé`);
  }
  assert.deepEqual(sans.slice(0, 5), [], `${sans.length} parcours sans tracé gardé (relus en direct, ou pas du tout)`);
  // Et git les VERSIONNE (relecture du 28/11/2026 : `/data/*` les ignorait — présents sur le disque,
  // absents d'un clone, de la CI et de la licence publiée).
  const ignore = (f: string) => spawnSync("git", ["check-ignore", "-q", f]).status === 0;
  const tranches = readdirSync("data/traces").filter((f) => f.endsWith(".json.gz"));
  assert.equal(tranches.length, TRANCHES, `${tranches.length} tranches sur ${TRANCHES}`);
  for (const f of ["data/LICENCE.md", ...tranches.map((t) => `data/traces/${t}`)]) assert.ok(!ignore(f), `${f} est ignoré par git : jamais publié`);
  assert.deepEqual(faux.slice(0, 5), [], `${faux.length} parcours dont le tracé ne fait pas la distance affichée`);
});

test("doublons : le même tracé une seule fois par famille de sport, deux circuits voisins gardés", () => {
  const ligne = (lat: number, n = 80) => Array.from({ length: n }, (_, k) => [1 + k * 0.001, lat] as [number, number]);
  const t = ligne(49.4);
  const P = (osm_id: number, nom: string, sport: string, osm_type = "relation") => ({ osm_id, osm_type, nom, sport, distance_km: longueurKm(t) });
  const velo = ligne(49.45);
  const traces = new Map<number, [number, number][]>([[1, t], [2, t], [3, t], [4, velo], [5, velo], [6, ligne(49.403)]]);
  const r = doublons([P(1, "Canal du Puy - 3", "Running"), P(2, "Canal du Puy - 3", "Randonnée", "ign"), P(3, "Canal du Puy 3", "VTT"),
    P(4, "Boucle A vers B", "Vélo (Route)", "ign"), P(5, "Boucle B vers A", "VTT"), P(6, "Autre circuit", "Randonnée")], (p) => traces.get(p.osm_id) ?? null);
  assert.deepEqual([...r].sort(), [[2, 1], [4, 5]], "le même tracé reste deux fois dans une famille, ou un VTT / un circuit voisin (330 m) est retiré");
  assert.equal(nomNormalise("Boucle de Thil Saint-Thibault vers Flée (CDM)"), nomNormalise("Boucle de Thil Flée vers Saint-Thibault"));
  // Deux circuits de noms différents qui partagent 75 % de leurs chemins : deux circuits (règle des 85 %).
  const long = ligne(49.5, 100), a = long.slice(0, 80), b = long.slice(20);
  const Q = (osm_id: number, nom: string) => ({ osm_id, osm_type: "relation", nom, sport: "Randonnée", distance_km: longueurKm(a) });
  assert.equal(doublons([Q(11, "Circuit des Lacs"), Q(12, "Circuit des Vignes")], (p) => (p.osm_id === 11 ? a : b)).size, 0, "deux circuits voisins sous deux noms sont fusionnés");
  assert.equal(doublons([Q(11, "Circuit des Lacs"), Q(12, "Circuit des Lacs")], (p) => (p.osm_id === 11 ? a : b)).size, 1, "précondition : sous le même nom, c'est un doublon");
});

test("le catalogue livré : aucun doublon évident (même nom, même départ, même longueur, même famille)", () => {
  const fam = (s: string) => (s === "Vélo (Route)" || s === "VTT" ? "v" : "p");
  const vus = new Map<string, number>(), doubles: string[] = [];
  for (const p of livre as { osm_id: number; nom: string; sport: string; distance_km: number; lat: number; lng: number }[]) {
    const k = `${nomNormalise(p.nom)}|${fam(p.sport)}|${Math.round(p.lat * 500)}|${Math.round(p.lng * 350)}|${Math.round(p.distance_km * 5)}`;
    // Même nom, même départ, même longueur : un doublon si les TRACÉS se recouvrent (« Brévent » depuis
    // deux départs, deux liaisons voisines : 6 et 15 % — deux parcours).
    const autre = vus.get(k);
    if (autre == null) { vus.set(k, p.osm_id); continue; }
    const a = traceStockee(p.osm_id), b = traceStockee(autre);
    if (a && b && Math.min(recouvrement(a, b), recouvrement(b, a)) >= 0.5) doubles.push(`${p.nom} (${p.osm_id} = ${autre})`);
  }
  assert.deepEqual(doubles.slice(0, 5), [], `${doubles.length} doublon(s) : ${doubles.slice(0, 5).join(" ; ")}`);
});

test("chaque source du catalogue est citée dans data/LICENCE.md (la Licence Ouverte l'exige)", () => {
  const licence = readFileSync("data/LICENCE.md", "utf8");
  assert.match(licence, /`traces\/\*\.json\.gz`[\s\S]{0,200}bases de données dérivées d'OpenStreetMap/, "les tracés publiés dans le dépôt ne sont pas sous la licence du catalogue");
  const sources = new Set((livre as { source?: string }[]).map((p) => p.source).filter((x): x is string => !!x && !/OpenStreetMap|IGN|Rouen/.test(x)));
  const absentes = [...sources].filter((x) => !licence.includes(x.replace(/ \(.*\)$/, "")));
  assert.deepEqual(absentes, [], "source non citée");
  assert.ok(sources.size >= 15, `${sources.size} sources ouvertes au catalogue`);
});

test("le catalogue livré n'a plus de nom abîmé", () => {
  const abimes = livre.filter((p) =>
    /(?:^|\s)de\s+à(?:\s|$)|\sà$|\bfixme\b|\?\?|&quot;|&amp;|^\(.*\)$/i.test(p.nom) || !p.nom.trim());
  assert.deepEqual(abimes.map((p) => `${p.osm_id} ${p.nom}`).slice(0, 10), [], `${abimes.length} nom(s) abîmé(s)`);
});

test("le catalogue livré : identifiants uniques, sports connus, coordonnées en France, distances réelles", () => {
  const ids = new Set<number>();
  const SPORTS = new Set(["Running", "Trail", "Randonnée", "Vélo (Route)", "VTT"]);
  for (const p of livre) {
    assert.ok(!ids.has(p.osm_id), `identifiant en double : ${p.osm_id}`);
    ids.add(p.osm_id);
    assert.ok(SPORTS.has(p.sport), `${p.osm_id} : sport inconnu « ${p.sport} »`);
    assert.ok(p.lat >= 41 && p.lat <= 51.2 && p.lng >= -5.3 && p.lng <= 9.7, `${p.osm_id} : hors de France métropolitaine`);
    assert.ok(p.distance_km >= 1, `${p.osm_id} : distance ${p.distance_km} km`);
  }
  // Chaque parcours IGN livré se relit à l'IGN par un identifiant valable.
  const ign = (livre as { osm_id: number; osm_type?: string }[]).filter((p) => p.osm_type === "ign");
  assert.ok(ign.length > 15000, `seulement ${ign.length} parcours IGN livrés (import du 28/11/2026 : 17 753)`);
  for (const p of ign) { const c = cleabsDuCatalogue(String(p.osm_id)); assert.ok(c && estCleabs(c), `${p.osm_id} : identifiant IGN « ${c} »`); }
  assert.equal(cleabsDuCatalogue("1"), undefined, "un identifiant hors catalogue ne se relit pas à l'IGN");
  // Les randonnées ont leur place : plus seulement 61 sur 15 708.
  const rando = livre.filter((p) => p.sport === "Randonnée").length;
  assert.ok(rando > 1000, `seulement ${rando} randonnées`);
});

(async () => {
  for (const t of enAttente) await t();
  console.log(`\n${ok} test(s) passé(s), ${echecs.length} échec(s)`);
  if (echecs.length) { for (const e of echecs) console.log(`  ✗ ${e}`); process.exit(1); }
})();
