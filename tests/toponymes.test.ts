/**
 * LES NOMS DE LA MONTAGNE — sommets, refuges, cols, points de vue.
 *
 * Une vue en relief sans toponymes est une image ; avec eux, c'est une carte. Savoir que
 * la pointe en face est l'Aiguille du Midi à 3 842 m est exactement ce qui sert à
 * préparer une sortie.
 *
 * ⚠️ TROIS CHOSES MESURÉES LE 07/09/2026 QUE CES TESTS VERROUILLENT :
 * 1. Overpass EXIGE un User-Agent identifiable. Sans lui : « 429 — Please include a
 *    meaningful User-Agent string with your requests to avoid rate-limiting », refus en
 *    217 ms.
 * 2. Le miroir `overpass.osm.ch` répond en 0,25 s — plus vite que tous — avec 4 sommets
 *    là où overpass-api.de en trouve 35 sur le MÊME cadrage. Il ne porte pas la planète
 *    entière. En course parallèle, le plus rapide était donc le plus incomplet.
 * 3. Appeler Overpass depuis le NAVIGATEUR expire au bout de 45 s. La route serveur, elle,
 *    borne le délai et met en cache.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  requete, interrogeable, lire, prioriser, versGeoJson, altitudeDe,
  MIROIRS, MIROIRS_ECARTES, ETENDUE_MAX, ZOOM_MIN, ETIQUETTES_MAX, cleDeTri,
} from "../src/lib/trail/toponymes";

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
const ROUTE = "src/app/api/trail/toponymes/route.ts";
const CHAMONIX = { sud: 45.88, ouest: 6.80, nord: 45.96, est: 6.94 };

console.log("\nCE QU'ON DEMANDE, ET QUAND");

test("on n'interroge pas une zone trop large", () => {
  // Une requête sur un pays entier ramène des milliers d'objets illisibles et pèse sur un
  // service public gratuit.
  assert.equal(ETENDUE_MAX, 0.6);
  assert.equal(ZOOM_MIN, 10);
  assert.ok(interrogeable(CHAMONIX, 13));
  assert.ok(!interrogeable({ sud: 42, ouest: 0, nord: 49, est: 8 }, 13), "la France entière a été jugée interrogeable");
  assert.ok(!interrogeable(CHAMONIX, 8), "à ce zoom, des noms n'ont aucun sens");
});

test("la requête demande bien tout ce qu'on affiche", () => {
  const q = requete(CHAMONIX);
  // ⚠️ CHAQUE FILTRE A ÉTÉ AJOUTÉ APRÈS MESURE, pas par précaution. Comptés sur le cirque
  // de Gavarnie, objets NOMMÉS : 243 avec la liste d'origine, 268 avec celle-ci —
  // `amenity=shelter` rapporte 24 cabanes de montagne réelles, `mountain_pass=yes` un col
  // qu'aucun `saddle` ne portait.
  for (const attendu of [
    "natural=peak", "natural=volcano", "tourism=alpine_hut", "tourism=wilderness_hut",
    "amenity=shelter", "tourism=viewpoint", "natural=saddle", "mountain_pass=yes",
  ]) {
    assert.ok(q.includes(attendu), `« ${attendu} » absent de la requête`);
  }
  assert.ok(q.includes("45.88,6.8,45.96,6.94"), `cadrage absent : ${q.slice(0, 80)}`);
  assert.ok(q.startsWith("[out:json]"), "la réponse ne serait pas du JSON");
});

console.log("\nLES MIROIRS");

test("le miroir partiel est écarté, et on dit pourquoi", () => {
  // ⚠️ MESURÉ : osm.ch répond en 0,25 s avec 4 sommets là où overpass-api.de en trouve 35
  // sur le même cadrage. Le plus rapide était le plus incomplet.
  assert.ok(!MIROIRS.some((m) => m.includes("osm.ch")), "le miroir partiel est revenu dans la course");
  assert.ok(MIROIRS_ECARTES.some((m) => m.includes("osm.ch")), "la trace de ce qui a été écarté a disparu");
  assert.ok(MIROIRS.length >= 2, "un seul miroir : une panne coupe la fonction");
});

test("les miroirs sont interrogés EN PARALLÈLE, pas l'un après l'autre", () => {
  // En série, un miroir mort coûtait NEUF SECONDES avant même d'essayer celui qui marche.
  const src = codeOf(ROUTE);
  assert.match(src, /Promise\.any\(MIROIRS\.map\(essai\)\)/, "les miroirs sont redevenus séquentiels");
  assert.match(src, /if \(!liste\.length\) throw new Error\("vide"\)/,
    "une réponse vide peut de nouveau gagner la course");
});

test("la requête s'annonce — Overpass l'exige", () => {
  // Sans User-Agent : « 429 — Please include a meaningful User-Agent string ».
  const src = codeOf(ROUTE);
  assert.match(src, /"User-Agent": "Pacevo\//, "l'agent identifiable a disparu : Overpass refusera tout");
  assert.match(src, /https:\/\/running-trail-empire/, "l'agent ne dit plus d'où viennent les requêtes");
  assert.match(src, /AbortSignal\.timeout\(DELAI_MS\)/, "plus de délai : une requête pourrait pendre indéfiniment");
});

test("le navigateur n'appelle jamais Overpass en direct", () => {
  // Mesuré : 45 secondes d'attente depuis la page, une seconde depuis le serveur.
  const vue = codeOf("src/components/trail/Relief3D.tsx");
  assert.ok(!/overpass/i.test(vue), "la vue appelle de nouveau Overpass directement");
  assert.match(vue, /\/api\/trail\/toponymes/, "la vue n'utilise plus la route serveur");
  assert.match(vue, /AbortSignal\.timeout\(12000\)/, "aucun délai côté navigateur : l'écran pourrait geler");
});

console.log("\nCE QU'ON LIT, ET CE QU'ON REFUSE");

test("un objet sans nom n'est pas affiché", () => {
  const r = lire({ elements: [
    { id: 1, lat: 45.9, lon: 6.8, tags: { natural: "peak", name: "Aiguille du Midi", ele: "3842" } },
    { id: 2, lat: 45.9, lon: 6.8, tags: { natural: "peak" } },
  ] });
  assert.equal(r.length, 1, "un sommet anonyme a été retenu : c'est du bruit sur la carte");
  assert.equal(r[0].nom, "Aiguille du Midi");
  assert.equal(r[0].altitude, 3842);
});

test("une altitude illisible devient absente, jamais inventée", () => {
  assert.equal(altitudeDe("3842"), 3842);
  assert.equal(altitudeDe("3842 m"), 3842);
  assert.equal(altitudeDe("3 842"), 3842);
  assert.equal(altitudeDe("environ 3800"), null, "un texte libre a produit une altitude");
  assert.equal(altitudeDe("99999"), null, "aucun sommet terrestre ne fait 99 999 m");
  assert.equal(altitudeDe(undefined), null);
  // Un sommet sans altitude reste un sommet.
  const r = lire({ elements: [{ id: 1, lat: 45.9, lon: 6.8, tags: { natural: "peak", name: "X" } }] });
  assert.equal(r[0].altitude, null);
  assert.equal(versGeoJson(r).features[0].properties.etiquette, "X", "une altitude absente a été écrite quand même");
});

test("une réponse absurde ne casse rien", () => {
  for (const brut of [null, undefined, {}, { elements: "pas un tableau" }, { elements: [null] }]) {
    assert.deepEqual(lire(brut), [], `entrée ${JSON.stringify(brut)} mal tolérée`);
  }
});

test("les doublons sont écartés", () => {
  const e = { id: 7, lat: 45.9, lon: 6.8, tags: { natural: "peak", name: "A" } };
  assert.equal(lire({ elements: [e, e, e] }).length, 1, "le même objet a été compté trois fois");
});

console.log("\nCE QU'ON AFFICHE EN PREMIER");

test("les sommets hauts passent devant, et on plafonne", () => {
  // ⚠️ LE PLAFOND ÉTAIT À 60 ET IL COUPAIT LA MONTAGNE. Mesuré sur Gavarnie : 268 objets
  // NOMMÉS dans un seul cadrage — 188 sommets, 48 cols, 24 cabanes, 6 refuges. En n'en
  // gardant que 60, on jetait plus de 200 noms réels. MapLibre écarte lui-même les
  // étiquettes qui se chevauchent : couper en amont ne rendait rien plus lisible.
  assert.ok(ETIQUETTES_MAX >= 300, `${ETIQUETTES_MAX} étiquettes : un massif dense en compte 268`);
  const beaucoup = Array.from({ length: 200 }, (_, i) => ({
    id: i, lat: 45, lon: 6, nom: `P${i}`, altitude: i, genre: "sommet" as const,
  }));
  const p = prioriser(beaucoup);
  assert.equal(p.length, Math.min(200, ETIQUETTES_MAX));
  assert.equal(p[0].altitude, 199, "le plus haut n'est plus en tête");

  // ⚠️ LES ALTITUDES SONT INVERSÉES EXPRÈS. Une première version donnait 2000 au sommet et
  // 1500 au refuge : trier par la seule altitude produisait alors le MÊME ordre que trier
  // par genre, et supprimer le classement par genre laissait le test au vert. Ici le lac
  // est le plus haut : seul le genre peut le renvoyer en dernier.
  const melange = prioriser([
    { id: 1, lat: 45, lon: 6, nom: "lac", altitude: 9000, genre: "lac" as const },
    { id: 2, lat: 45, lon: 6, nom: "sommet", altitude: 100, genre: "sommet" as const },
    { id: 3, lat: 45, lon: 6, nom: "refuge", altitude: 5000, genre: "refuge" as const },
  ]);
  assert.deepEqual(melange.map((x) => x.genre), ["sommet", "refuge", "lac"], "l'ordre d'importance a changé");
});

test("un objet portant plusieurs étiquettes OSM n'apparaît qu'une fois", () => {
  // Un col est souvent marqué `natural=saddle` ET `mountain_pass=yes` : sans ordre
  // explicite dans la reconnaissance, il ressortirait deux fois, ou changerait de genre
  // d'une requête à l'autre.
  const r = lire({ elements: [
    { id: 1, lat: 45, lon: 6, tags: { natural: "saddle", mountain_pass: "yes", name: "Col du Midi", ele: "3532" } },
    { id: 2, lat: 45, lon: 6, tags: { tourism: "alpine_hut", amenity: "shelter", name: "Refuge X" } },
  ] });
  assert.equal(r.length, 2);
  assert.equal(r[0].genre, "col", "un col est devenu autre chose");
  assert.equal(r[1].genre, "refuge", "un refuge a été rétrogradé en simple abri");

  // ⚠️ LES CAS ISOLÉS, ET C'EST CE QUI MANQUAIT. Les deux objets ci-dessus portent CHACUN
  // deux étiquettes : `natural=saddle` suffisait à reconnaître le col, et `alpine_hut` à
  // reconnaître le refuge. Retirer la reconnaissance de `mountain_pass` ou de `shelter` ne
  // changeait donc RIEN, et les mutations restaient vertes. Il faut des objets qui ne
  // portent QUE l'étiquette qu'on veut éprouver.
  const seuls = lire({ elements: [
    { id: 3, lat: 45, lon: 6, tags: { mountain_pass: "yes", name: "Port de Vénasque", ele: "2444" } },
    { id: 4, lat: 45, lon: 6, tags: { amenity: "shelter", name: "Cabane de Camplong" } },
    { id: 5, lat: 45, lon: 6, tags: { natural: "volcano", name: "Puy de Dôme", ele: "1465" } },
  ] });
  assert.equal(seuls.length, 3, "un objet à étiquette unique a été perdu");
  assert.equal(seuls.find((x) => x.nom === "Port de Vénasque")?.genre, "col",
    "un col marqué seulement `mountain_pass` n'est plus reconnu");
  assert.equal(seuls.find((x) => x.nom === "Cabane de Camplong")?.genre, "abri",
    "une cabane de montagne n'est plus reconnue : 24 d'entre elles disparaissent sur Gavarnie");
  assert.equal(seuls.find((x) => x.nom === "Puy de Dôme")?.genre, "sommet",
    "un volcan n'est plus un sommet : la chaîne des Puys disparaît");
});

test("la clé de tri décide qui survit à un chevauchement", () => {
  // ⚠️ SANS ELLE, MapLibre tranche dans l'ordre des données, c'est-à-dire au hasard : un
  // point de vue anonyme pouvait masquer le Vignemale. Plus BAS = plus prioritaire.
  const sommetHaut = cleDeTri({ id: 1, lat: 0, lon: 0, nom: "A", altitude: 3400, genre: "sommet" });
  const sommetBas = cleDeTri({ id: 2, lat: 0, lon: 0, nom: "B", altitude: 1200, genre: "sommet" });
  const vue = cleDeTri({ id: 3, lat: 0, lon: 0, nom: "C", altitude: 3900, genre: "vue" });
  assert.ok(sommetHaut < sommetBas, "un sommet bas passe devant un sommet haut");
  assert.ok(sommetBas < vue, "un point de vue passe devant un sommet, même très haut");
  const g = versGeoJson([{ id: 1, lat: 45, lon: 6, nom: "A", altitude: 3400, genre: "sommet" }]);
  assert.equal(g.features[0].properties.tri, sommetHaut, "la clé n'est plus transmise à la carte");
  assert.equal(g.features[0].properties.altitude, 3400, "l'altitude ne sert plus à dimensionner l'étiquette");
});

test("la carte hiérarchise vraiment les étiquettes", () => {
  const vue = readFileSync("src/components/trail/Relief3D.tsx", "utf8");
  assert.match(vue, /"symbol-sort-key": \["get", "tri"\]/,
    "les chevauchements se résolvent de nouveau au hasard");
  assert.match(vue, /"text-size": \[\s*"case"/, "toutes les étiquettes ont repris la même taille");
  // ⚠️ L'ÉCHELLE PART DE 500 M. Mesuré sur toute la France : calée depuis zéro, elle
  // écrasait les moyennes montagnes — Vosges 1 424 m, Jura 1 721 m, Puys 1 464 m — où
  // toutes les étiquettes tombaient autour de 11 px, sans aucune hiérarchie.
  assert.match(vue, /\["get", "altitude"\], 500, 10\.5, 1500, 12, 3500, 14\]/,
    "l'échelle de taille est repartie de zéro : le relief bas redevient uniforme");
});

test("l'étiquette porte l'altitude quand elle existe", () => {
  const g = versGeoJson([{ id: 1, lat: 45.9, lon: 6.8, nom: "Mont Buet", altitude: 3096, genre: "sommet" }]);
  assert.equal(g.features[0].properties.etiquette, "Mont Buet\n3096 m");
  assert.deepEqual(g.features[0].geometry.coordinates, [6.8, 45.9], "longitude et latitude inversées");
  assert.equal(g.type, "FeatureCollection");
});

console.log("\nLA ROUTE NE TOMBE JAMAIS EN PANNE");

test("l'absence de noms n'est pas une erreur HTTP", () => {
  // La carte reste entièrement utilisable sans ses étiquettes : rendre une erreur ferait
  // croire à une panne de l'application.
  const src = codeOf(ROUTE);
  assert.match(src, /toponymes: \[\], raison: "indisponible"/, "l'échec ne se dit plus");
  assert.ok(!/status: 5\d\d/.test(src), "la route rend une erreur serveur alors que la carte fonctionne");
  assert.match(src, /raison: "trop_large"/, "le refus de cadrage ne se distingue plus d'une panne");
});

test("le cache existe et il est borné", () => {
  const src = codeOf(ROUTE);
  assert.match(src, /cache\.set\(k, \{ a: Date\.now\(\), liste \}\)/, "plus de mise en cache : on martèlerait un service gratuit");
  assert.match(src, /cache\.size >= CACHE_MAX/, "le cache n'est plus borné : fuite mémoire sur le serveur");
  // ⚠️ ET UN CACHE RÉSEAU EN PLUS. Mesuré sur le site déployé : la `Map` en mémoire ne
  // survit pas au sans-serveur — premier appel 5,4 s, second 10,0 s, aucun gain. Sans
  // en-tête de cache, chaque athlète qui ouvre la même vallée retape Overpass.
  assert.match(src, /"Cache-Control": `public, s-maxage=\$\{secondes\}/,
    "l'en-tête de cache a disparu : le cache mémoire seul ne sert à rien en production");
  assert.match(src, /stale-while-revalidate/, "on ferait attendre quelqu'un pendant le rafraîchissement");
  // Un échec ne se fige pas pour la journée : Overpass revient en quelques minutes.
  assert.match(src, /raison: "indisponible" \}, 120\)/, "une panne d'Overpass serait mise en cache six heures");
});

console.log(`\n${passed} test(s) de toponymes passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
