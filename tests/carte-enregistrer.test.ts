/**
 * LA CARTE DE L'ÉCRAN « ENREGISTRER », FAÇON STRAVA.
 *
 * Cyprien, 22/09/2026, capture de l'écran d'enregistrement de Strava à l'appui : « fais
 * comme sur Strava ça rend ». Ce fichier tient les quatre choses qui, si elles cassent,
 * ne lèvent AUCUNE erreur et laissent une carte qui a l'air de marcher :
 *
 *  · un fond satellite proposé SANS clé MapTiler → 403 sur chaque tuile, carte grise ;
 *  · un style vectoriel qui ne se charge pas → carte vide, sans repli ;
 *  · une attribution vide → carte utilisée sans droit (OpenStreetMap, MapTiler) ;
 *  · un suivi automatique qu'on ne peut pas couper → la carte revient sur soi à chaque
 *    point GPS, et on ne peut rien regarder d'autre.
 *
 *   npx tsx tests/carte-enregistrer.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fondsCarteDirecte, satelliteDisponible, stylePacevo, fondsDisponibles, calquesDisponibles, tuileDe, peinturesNuit, paysDe, REPLI_PLAN, ATTRIBUTION_PLAN, STYLE_PLAN_URL } from "../src/lib/courses/fondsCarte";
import { FONDS, avecCle } from "../src/lib/trail/couches";
import { allegerParcours, parcoursDates, sortiesDepuis, MAX_POINTS } from "../src/lib/courses/mesParcours";
import { encodePolyline } from "../src/lib/segments/geo";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

console.log("\n=== CARTE « ENREGISTRER » ===\n");

test("sans clé MapTiler, le satellite n'est pas proposé — et le plan reste ouvert", () => {
  for (const sans of [undefined, ""]) {
    assert.deepEqual(fondsCarteDirecte(sans), ["plan"], "un fond payant est proposé sans clé : ses tuiles répondront 403");
    assert.equal(satelliteDisponible(sans), null);
  }
  // Le plan ne dépend d'aucune clé : OpenFreeMap, puis OpenStreetMap en repli.
  assert.ok(!/key=/.test(STYLE_PLAN_URL) && !/key=/.test(REPLI_PLAN.url), "le plan exige de nouveau une clé");
  assert.match(REPLI_PLAN.url, /tile\.openstreetmap\.org/, "le repli n'est plus une source ouverte");
});

test("avec la clé, le satellite la porte — et ne garde pas le marqueur", () => {
  assert.deepEqual(fondsCarteDirecte("CLE_TEST_123"), ["plan", "satellite"], "le satellite n'est plus proposé alors que la clé existe");
  const sat = satelliteDisponible("CLE_TEST_123")!;
  assert.match(sat.url, /key=CLE_TEST_123/, "le satellite n'emporte pas la clé : ses tuiles répondront 403");
  assert.ok(!sat.url.includes("{cleMapTiler}"), "le satellite garde le marqueur de clé : l'URL est littéralement fausse");
  assert.ok(sat.zoomMax >= 17, `le satellite plafonne au zoom ${sat.zoomMax} : on ne voit plus la rue`);
});

test("l'URL satellite vient du catalogue vérifié, pas d'une copie", () => {
  // `lib/trail/couches` est le fichier dont chaque adresse a été interrogée pour de vrai.
  // Une seconde copie de l'adresse, c'est une copie qui se périme sans prévenir.
  const source = FONDS.find((f) => f.id === "satellite");
  assert.ok(source, "l'entrée satellite a disparu du catalogue");
  const sat = satelliteDisponible("CLE_TEST_123");
  assert.equal(sat!.url, avecCle(source!.url, "CLE_TEST_123"), "l'URL satellite ne vient plus du catalogue vérifié");
  assert.equal(sat!.attribution, source!.attribution, "l'attribution ne suit plus la source");
  assert.equal(sat!.taille, source!.taille, "la taille de tuile ne suit plus la source : carte décalée d'un facteur deux");
});

test("la palette Pacevo repeint une COPIE du style, sans rien perdre d'utile", () => {
  // Cyprien, 27/11/2026 : « la carte fait vieille ». Le style Liberty est repeint façon
  // Strava. La fonction est pure : le style reçu ne doit pas bouger (il peut être en cache).
  const base = { version: 8, layers: [
    { id: "background", type: "background", paint: { "background-color": "#f8f4f0" } },
    { id: "park", type: "fill", paint: { "fill-color": "#d8e8c8" } },
    { id: "road_minor", type: "line", paint: { "line-color": "#fea" } },
    { id: "road_minor_casing", type: "line", paint: { "line-color": "#e9ac77" } },
    { id: "road_trunk_primary", type: "line", paint: { "line-color": "#fea", "line-width": 3 } },
    { id: "road_path_pedestrian", type: "line", paint: { "line-color": "#fff", "line-dasharray": [1, 1] } },
    { id: "road_major_rail", type: "line", paint: { "line-color": "#bbb" } },
    { id: "building", type: "fill", maxzoom: 14, paint: { "fill-color": "#ddd" } },
    { id: "building-3d", type: "fill-extrusion", paint: {} },
    { id: "poi_r20", type: "symbol" },
    { id: "label_city", type: "symbol", layout: { "text-field": "{name}" } },
  ] };
  const avant = JSON.stringify(base);
  const s = stylePacevo(base);
  assert.equal(JSON.stringify(base), avant, "le style d'origine a été modifié en place");
  const c = (id: string) => s.layers.find((l) => l.id === id);
  assert.notEqual(c("background")!.paint!["background-color"], "#f8f4f0", "le fond n'est plus repeint");
  assert.notEqual(c("road_trunk_primary")!.paint!["line-color"], "#fea", "les grands axes gardent le jaune criard");
  assert.equal(c("road_trunk_primary")!.paint!["line-width"], 3, "la repeinte écrase des propriétés qu'elle ne touche pas");
  assert.equal(c("road_minor")!.paint!["line-color"], "#ffffff", "les petites rues ne sont plus blanches");
  // Les chemins : c'est là qu'on court. Blancs sur fond clair, on ne les voyait pas.
  assert.notEqual(c("road_path_pedestrian")!.paint!["line-color"], "#fff", "les chemins sont de nouveau invisibles");
  assert.deepEqual(c("road_path_pedestrian")!.paint!["line-dasharray"], [1, 1], "les chemins ont perdu leur pointillé");
  assert.equal(c("road_major_rail")!.paint!["line-color"], "#bbb", "la voie ferrée est repeinte comme une route");
  assert.equal(c("building-3d"), undefined, "les bâtiments en relief encombrent de nouveau la carte");
  // …mais les bâtiments à plat continuent au-delà du zoom 14, où le relief les dessinait.
  assert.equal((c("building") as { maxzoom?: number }).maxzoom, undefined, "les maisons disparaissent dès qu'on zoome sur sa rue");
  assert.equal(c("poi_r20"), undefined, "les commerces de second rang encombrent de nouveau la carte");
  assert.ok(c("label_city"), "une étiquette a disparu : la repeinte retire plus qu'elle ne doit");
});

test("chaque fond porte son attribution — c'est une obligation de licence", () => {
  assert.match(ATTRIBUTION_PLAN, /OpenStreetMap/, "le plan n'attribue plus OpenStreetMap");
  assert.match(ATTRIBUTION_PLAN, /OpenFreeMap/, "le plan n'attribue plus OpenFreeMap");
  assert.ok(REPLI_PLAN.attribution.trim().length > 3, "le repli n'a pas d'attribution");
  assert.ok(satelliteDisponible("CLE_TEST_123")!.attribution.trim().length > 3, "le satellite n'a pas d'attribution");
  // Elle doit atteindre l'écran : MapLibre ne l'affiche que si la SOURCE la porte.
  const carte = codeNu("src/components/ghost-runner/CarteDirect.tsx");
  assert.match(carte, /if \(om\) om\.attribution = ATTRIBUTION_PLAN;/, "le style vectoriel est posé sans attribution");
  assert.match(carte, /attribution: REPLI_PLAN\.attribution/, "le repli est posé sans attribution");
  // Tout fond ou calque d'image porte l'attribution de SA source (catalogue vérifié).
  assert.match(carte, /m\.addSource\(id, \{ type: "raster", tiles: f\.urls,[^}]*attribution: f\.attribution \}\)/, "un modèle de carte est posé sans attribution");
  assert.match(carte, /m\.addSource\(id, \{ type: "raster", tiles: c\.urls,[^}]*attribution: c\.attribution \}\)/, "un calque est posé sans attribution");
  // ⚠️ EN HAUT À DROITE (le bas est couvert par le bloc de chiffres et le tiroir, le haut
  // gauche par la flèche ⌄). Repliée en ⓘ depuis le 27/11/2026, comme Strava — mais
  // EXPOSÉE EN ENTIER À L'OUVERTURE, et le repli se fait seulement après 5 s (ou au
  // premier geste) : jamais une carte qui s'ouvre sans dire d'où viennent ses données.
  assert.match(carte, /const credit = new maplibregl\.AttributionControl\(\{ compact: true \}\);\s*\n\s*m\.addControl\(credit, "top-right"\);/, "l'attribution n'est plus en haut à droite");
  // La règle de l'OSMF : en entier au démarrage (5 s), puis repliée ; jamais un crédit
  // qu'il faudrait toucher pour voir la première fois. Une fois par jour et par appareil.
  assert.match(carte, /if \(creditDejaMontre\(\)\) \{ replier\(\); m\.once\("load", replier\); \}\s*\n\s*else \{ noterCreditMontre\(\); setTimeout\(replier, 5000\); \}/, "le crédit n'est plus montré 5 s à la première ouverture du jour, ou plus replié ensuite");
  assert.match(carte, /return localStorage\.getItem\(CLE_CREDIT\) === aujourdhuiLocal\(\);/, "le crédit n'est plus montré une fois PAR JOUR");
  // Repli immédiat au premier geste de la main (toucher, glisser, zoomer) — jamais sur nos
  // propres recentrages GPS, qui le replieraient avant que l'athlète l'ait vu.
  assert.match(carte, /m\.on\("click", replier\);\s*\n\s*m\.on\("movestart", \(e\) => \{ if \(\(e as \{ originalEvent\?: unknown \}\)\.originalEvent\) replier\(\); \}\);/, "le crédit ne se replie plus au premier geste, ou se replie sur un recentrage GPS");
  assert.ok(!/setTimeout\(replier, [0-4]\d{0,3}\)/.test(carte), "le repli automatique descend sous les 5 s exigées par la règle de l'OSMF");
  // ODbL : « OpenStreetMap » renvoie à sa page de licence.
  assert.match(ATTRIBUTION_PLAN, /<a href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>OpenStreetMap<\/a>/, "le crédit ne renvoie plus à la licence d'OpenStreetMap");
});

test("si le style vectoriel ne vient pas, la carte retombe sur OpenStreetMap", () => {
  // Un style qui échoue ne lève rien à l'écran : la carte reste vide.
  const carte = codeNu("src/components/ghost-runner/CarteDirect.tsx");
  const charge = carte.slice(carte.indexOf("async function stylePlan()"), carte.indexOf("export function CarteDirect"));
  assert.match(charge, /if \(!r\.ok\) return styleRepli\(\);/, "une réponse en erreur n'a plus de repli");
  assert.match(charge, /catch \{\s*\n\s*return styleRepli\(\);/, "une panne réseau n'a plus de repli");
  assert.match(charge, /stylePacevo\(/, "le style chargé n'est plus repeint aux couleurs de Pacevo");
  // Et la politique de sécurité laisse passer la source, sinon elle est bloquée sans bruit.
  assert.match(readFileSync("next.config.ts", "utf8"), /"https:\/\/tiles\.openfreemap\.org"/, "OpenFreeMap n'est pas dans la CSP : la carte serait bloquée");
});

test("le suivi automatique se coupe à la main et se reprend au bouton", () => {
  const carte = codeNu("src/components/ghost-runner/CarteDirect.tsx");
  // Glisser la carte prévient le parent…
  assert.match(carte, /m\.on\("dragstart", \(\) => deplacementRef\.current\?\.\(\)\)/, "déplacer la carte ne coupe plus le suivi : la position suivante la ramène");
  // …et le recentrage automatique est conditionné à ce suivi.
  assert.match(carte, /if \(!suivreRef\.current \|\| doigts\.current\) return;/, "la carte se recentre encore à chaque point GPS, suivi coupé ou doigts posés");
  // ⚠️ DÉZOOM IMPOSSIBLE (Cyprien, 27/11/2026, sur téléphone) : chaque point GPS remontait
  // le zoom à 15. Le suivi garde le zoom de l'athlète ; seule la première position zoome.
  const suivi = carte.slice(carte.indexOf("if (!suivreRef.current || doigts.current) return;"), carte.indexOf("// Recentrage demandé"));
  assert.ok(!/zoom: Math\.max\(m\.getZoom\(\), 15\)(?!.*premiere)/.test(suivi.replace(/premiere \? Math\.max\(m\.getZoom\(\), 15\)/, "")), "le suivi remonte de nouveau le zoom à 15 à chaque point GPS : on ne peut plus dézoomer");
  assert.match(suivi, /zoom: premiere \? Math\.max\(m\.getZoom\(\), 15\) : m\.getZoom\(\)/, "le suivi ne garde plus le zoom choisi par l'athlète");
  // Les doigts eux-mêmes coupent le suivi : `zoomstart` ne part pas pendant un glissement.
  assert.match(carte, /cadre\.addEventListener\("touchmove", \(\) => \{ if \(suivreRef\.current\) deplacementRef\.current\?\.\(\); \}/, "un pincement sur téléphone ne coupe plus le suivi");
  assert.match(carte, /cadre\.addEventListener\("touchstart", \(\) => \{ doigts\.current = true; \}/, "un recentrage peut de nouveau partir sous les doigts");
  // ⚠️ `zoomstart` est aussi émis par NOS `easeTo` : seul un geste porte `originalEvent`.
  // Sans ce filtre, le premier recentrage automatique couperait le suivi lui-même.
  assert.match(carte, /m\.on\("zoomstart", \(e\) => \{ if \(\(e as \{ originalEvent\?: unknown \}\)\.originalEvent\) deplacementRef\.current\?\.\(\); \}\)/, "le zoom ne distingue plus la main de nos propres recentrages");
  // ⚠️ MapLibre parle en [longitude, latitude] : un oubli pose le coureur dans l'océan.
  assert.match(carte, /const versLngLat = \(p: \[number, number\]\): \[number, number\] => \[p\[1\], p\[0\]\];/, "la conversion latitude/longitude a changé");
  assert.ok(!/setLngLat\(p\)|center: position[,\s]|coordinates: t[,\s]/.test(carte), "une position part à MapLibre sans être retournée en [lng, lat]");
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /onDeplacement=\{\(\) => setSuiviCarte\(false\)\}/, "l'écran n'écoute plus le déplacement de la carte");
  assert.match(gr, /setSuiviCarte\(true\); setRecentrages\(\(n\) => n \+ 1\)/, "le bouton de recentrage ne rend plus le suivi");
});

test("la carte change de hauteur en cours de vie : elle se remesure", () => {
  // Grand écran ou non, la carte remplit la section — dont la hauteur change. La carte garde
  // la taille mesurée à la création et ne dessine que dessus : le reste resterait vide.
  const carte = codeNu("src/components/ghost-runner/CarteDirect.tsx");
  assert.match(carte, /new ResizeObserver\(\(\) => carte\.current\?\.resize\(\)\)/, "la carte ne se remesure plus quand sa hauteur change : la moitié reste vide");
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /: "relative -mx-3 -mt-3 h-\[calc\(100dvh-8\.5rem\)\] min-h-\[560px\] overflow-hidden/, "hors grand écran, la carte ne prend plus la hauteur de la fenêtre");
  assert.match(gr, /<CarteDirect[\s\S]{0,600}className="h-full w-full"/, "la carte ne remplit plus sa section");
});

test("le bloc de chiffres et le tiroir sont POSÉS sur la carte, pas dedans — sinon la carte mange le doigt", () => {
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.ok(!/<\/CarteDirect>/.test(gr), "des commandes sont passées À L'INTÉRIEUR de la carte : appuyer dessus la déplacerait");
  const bloc = gr.indexOf('<div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex flex-col">');
  assert.ok(bloc > gr.indexOf("<CarteDirect"), "le bloc de chiffres ne suit plus la carte");
  // Les chiffres, et LE bouton de départ.
  assert.match(gr, /chiffresCarte\.map/, "les chiffres ont disparu du bloc posé sur la carte");
  assert.match(gr, /<GrosBouton label=\{d\["start"\]\}/, "le gros bouton « Démarrer » a quitté le tiroir");
  // ⚠️ LE DÉZOOM QUI NE MARCHAIT PAS (Cyprien, 27/11/2026, deux fois). L'enveloppe des
  // boutons ronds était `pointer-events-auto` sur toute la largeur : une bande transparente
  // de 200 px avalait les doigts, et le pincement n'atteignait pas la carte. Les deux
  // enveloppes sont transparentes au doigt ; seuls les éléments visibles le reprennent.
  assert.match(gr, /<div className="pointer-events-none absolute inset-x-0 bottom-0 z-\[500\] flex flex-col">\s*\n\s*<div className="pointer-events-none mx-auto w-full max-w-md px-3">/, "l'enveloppe des boutons ronds reprend le doigt sur toute la largeur : la carte ne se pince plus");
  assert.match(gr, /function BtnCarte[\s\S]{0,400}className=\{`pointer-events-auto relative flex h-11 w-11/, "les boutons ronds ne reprennent plus le doigt : ils seraient morts");
  assert.match(gr, /"pointer-events-auto mb-3 overflow-hidden rounded-2xl/, "le bloc de chiffres ne reprend plus le doigt : son bouton ⤡ serait mort");
  assert.match(gr, /"pointer-events-auto rounded-t-\[28px\] bg-white px-6/, "le tiroir ne reprend plus le doigt : « Démarrer » serait mort");
  assert.match(codeNu("src/components/ghost-runner/CarteDirect.tsx"), /el\.className = "pacevo-point";\s*\n\s*el\.style\.pointerEvents = "none";/, "le point bleu avale de nouveau le doigt qui commence un pincement sur lui");
});

test("les modèles de carte : selon la clé et le PAYS, jamais une tuile 403 ni une carte hors de son pays", () => {
  const paris: [number, number] = [48.85, 2.35], zurich: [number, number] = [47.37, 8.54], ny: [number, number] = [40.71, -74.0];
  const ids = (cle: string | undefined, c: [number, number] | null) => fondsDisponibles(cle, c).map((f) => f.id);
  // Sans clé : ni satellite, ni hybride (403 sur chaque tuile) ; nos deux styles restent.
  for (const sans of [undefined, ""]) {
    const l = ids(sans, paris);
    assert.ok(l.includes("plan") && l.includes("nuit"), "Pacevo ou Pacevo Nuit a disparu sans clé");
    assert.ok(!l.includes("satellite") && !l.includes("hybride"), "un fond payant est proposé sans clé : ses tuiles répondront 403");
    assert.ok(!calquesDisponibles(sans, paris).some((c) => c.id === "ombrage"), "l'ombrage (relief MapTiler) est proposé sans clé");
  }
  // Avec la clé, à Paris : satellite, hybride, et les cartes de l'IGN — pas celles de la Suisse.
  const fr = ids("CLE_TEST_123", paris);
  for (const id of ["plan", "nuit", "satellite", "hybride", "outdoor", "topo", "hiver", "cyclosm", "ign-plan", "ign-photo"]) assert.ok(fr.includes(id as never), `${id} manque à Paris`);
  // Outdoor et Hiver sont des styles MapTiler : pas sans clé.
  assert.ok(!ids(undefined, paris).includes("outdoor") && !ids(undefined, paris).includes("hiver"), "un style MapTiler est proposé sans clé : 403 sur chaque tuile");
  assert.ok(ids(undefined, paris).includes("cyclosm"), "CyclOSM (libre) a disparu sans clé");
  // Les itinéraires du monde partout ; la rando suisse en Suisse seulement.
  const itin = (c: [number, number]) => calquesDisponibles("CLE_TEST_123", c).filter((x) => x.groupe === "itineraires").map((x) => x.id);
  for (const id of ["rando", "vtt", "velo", "ski"]) assert.ok(itin(paris).includes(id as never), `${id} manque en France`);
  assert.ok(!itin(paris).includes("rando-ch") && itin(zurich).includes("rando-ch"), "la rando suisse n'est pas réservée à la Suisse");
  // ⚠️ LES FRONTIÈRES (audit du 27/11/2026) : des boîtes proposaient swisstopo et la rando
  // suisse à Chamonix (vides), l'IGN à Barcelone et à Genève (blanc), TopPlus à Strasbourg.
  const p = (lat: number, lon: number) => paysDe(lat, lon);
  assert.ok(p(45.9237, 6.8694).includes("fr") && !p(45.9237, 6.8694).includes("ch"), "Chamonix n'est plus en France seulement");
  assert.ok(p(45.899, 6.129).includes("fr") && !p(45.899, 6.129).includes("ch"), "Annecy est pris pour la Suisse");
  assert.ok(p(46.204, 6.143).includes("ch") && !p(46.204, 6.143).includes("fr"), "Genève est prise pour la France");
  assert.ok(p(41.387, 2.170).includes("es") && !p(41.387, 2.170).includes("fr"), "Barcelone est prise pour la France");
  assert.ok(p(48.583, 7.746).includes("fr") && !p(48.583, 7.746).includes("de"), "Strasbourg est prise pour l'Allemagne");
  assert.ok(p(52.52, 13.40).includes("de"), "Berlin n'est plus en Allemagne");
  assert.ok(p(42.70, 9.45).includes("fr"), "la Corse n'est plus en France");
  assert.ok(!p(43.65, -79.38).includes("us") && p(40.71, -74.0).includes("us"), "Toronto est prise pour les États-Unis, ou New York ne l'est plus");
  const chamonix: [number, number] = [45.9237, 6.8694];
  assert.ok(!ids("CLE_TEST_123", chamonix).includes("swisstopo"), "swisstopo est proposé à Chamonix : la carte serait vide");
  assert.ok(!itin(chamonix).includes("rando-ch"), "la rando suisse est proposée à Chamonix : le calque serait vide");
  // Les fonds historiques de l'IGN : en France seulement.
  assert.ok(fr.includes("ign-1950") && fr.includes("etat-major"), "les fonds historiques de l'IGN manquent en France");
  assert.ok(!ids("CLE_TEST_123", zurich).includes("ign-1950"), "un fond historique de l'IGN est proposé hors de France");
  // Eau & toilettes : partout, sans clé (c'est notre propre plan).
  assert.ok(calquesDisponibles(undefined, ny).some((c) => c.id === "eau"), "le calque Eau & toilettes a disparu");
  // Les points d'eau sont des ANNEAUX : un rond bleu plein se confondait avec le point GPS.
  assert.match(codeNu("src/components/ghost-runner/CarteDirect.tsx"), /id: "calque-eau", type: "circle"[\s\S]{0,400}"circle-color": "#ffffff", "circle-stroke-color": "#0891b2"/, "les points d'eau redeviennent des ronds pleins, qu'on prend pour sa position");
  assert.ok(!fr.includes("swisstopo") && !fr.includes("us-topo"), "une carte nationale est proposée hors de son pays");
  assert.ok(ids("CLE_TEST_123", zurich).includes("swisstopo"), "swisstopo n'est pas proposé en Suisse");
  assert.ok(!ids("CLE_TEST_123", ny).includes("ign-plan"), "l'IGN est proposé à New York");
  assert.deepEqual(calquesDisponibles("CLE_TEST_123", ny).filter((c) => /-fr$/.test(c.id)), [], "les pentes ou courbes de l'IGN sont proposées hors de France");
  // Chaque image vient du catalogue vérifié, avec la clé et sans marqueur, et son attribution.
  const source = FONDS.find((f) => f.id === "satellite")!;
  const sat = fondsDisponibles("CLE_TEST_123", paris).find((f) => f.id === "satellite")!;
  assert.deepEqual(sat.urls, [avecCle(source.url, "CLE_TEST_123")], "l'URL satellite ne vient plus du catalogue vérifié");
  for (const f of [...fondsDisponibles("CLE_TEST_123", paris), ...fondsDisponibles("CLE_TEST_123", zurich)]) {
    if (f.type !== "image") continue;
    assert.ok((f.attribution ?? "").trim().length > 3, `${f.id} n'a pas d'attribution`);
    for (const u of f.urls ?? []) assert.ok(!u.includes("{cleMapTiler}") && !u.includes("{s}"), `${f.id} garde un marqueur dans son URL : ${u}`);
  }
  // OpenTopoMap : les trois sous-domaines, MapLibre ne connaît pas `{s}`.
  assert.equal(fondsDisponibles("CLE_TEST_123", paris).find((f) => f.id === "topo")!.urls!.length, 3, "OpenTopoMap n'est plus réparti sur ses sous-domaines");
  // Sans position ni cadrage : le monde seulement, et toujours au moins Pacevo.
  assert.equal(fondsDisponibles(undefined, null)[0].id, "plan", "sans position, la liste ne commence plus par Pacevo");
  // La vignette est la VRAIE tuile du quartier : tuile 14 de Paris = 8299/5636 (calcul indépendant).
  assert.equal(tuileDe("https://t/{z}/{x}/{y}.png", 48.8566, 2.3522, 14), "https://t/14/8299/5636.png", "la vignette ne montre plus le quartier de l'athlète");
  // Pacevo Nuit : sombre, et les noms en clair.
  const nuit = peinturesNuit({ layers: [{ id: "background", type: "background" }, { id: "road_minor", type: "line" }, { id: "label_city", type: "symbol" }] });
  assert.equal(nuit.background["background-color"], "#16191e", "le fond de Pacevo Nuit n'est plus sombre");
  assert.equal(nuit.label_city["text-color"], "#d4d4d8", "les noms de Pacevo Nuit ne sont plus en clair");
  // La clé n'est jamais écrite en dur.
  for (const f of ["src/components/ghost-runner/CarteDirect.tsx", "src/lib/courses/fondsCarte.ts", "src/components/ghost-runner/GhostRunner.tsx"]) {
    assert.ok(!/key=[A-Za-z0-9]{8,}/.test(readFileSync(f, "utf8")), `une clé MapTiler est écrite en dur dans ${f}`);
  }
});

test("chaque calque a sa vignette DESSINÉE — jamais un dégradé muet (27/11/2026)", () => {
  // La tuile d'un calque est vide là où il n'y a rien : à Rouen, VTT et Vélo n'avaient
  // qu'un dégradé. Chaque calque proposé, partout, doit avoir son propre dessin.
  const src = readFileSync("src/components/ghost-runner/vignettes.ts", "utf8");
  const dessins = src.slice(src.indexOf("const DESSINS"), src.indexOf("/** Les rues seules"));
  const alias: Record<string, string> = { "pentes-fr": "pentes", "courbes-fr": "courbes" };
  const ids = new Set<string>();
  for (const c of [[48.85, 2.35], [47.37, 8.54], [40.71, -74.0]] as [number, number][]) for (const x of calquesDisponibles("CLE_TEST_123", c)) ids.add(alias[x.id] ?? x.id);
  for (const id of [...ids, "plan", "nuit", "relief"]) {
    assert.match(dessins, new RegExp(`(^|\\n)\\s*"?${id.replace("-", "\\-")}"?: `), `le calque ou fond « ${id} » n'a pas de vignette dessinée : il retomberait sur le plan nu`);
  }
  // Le titre du tiroir reste DEVANT les vignettes qui défilent (vu sur iPhone).
  assert.match(codeNu("src/components/ghost-runner/GhostRunner.tsx"), /className="sticky top-0 z-10 -mx-5 bg-white/, "les vignettes défilent de nouveau par-dessus le titre du tiroir");
});

test("changer de modèle ne recharge JAMAIS le style : le tracé de la course resterait effacé", () => {
  const carte = codeNu("src/components/ghost-runner/CarteDirect.tsx");
  assert.ok(!/setStyle\(/.test(carte), "un changement de modèle recharge le style : tracé, point bleu et sorties disparaissent");
  // Un fond « dessus » se glisse SOUS nos sorties et notre tracé, jamais par-dessus.
  assert.match(carte, /const avant = f\.place === "dessus" \? "parcours"/, "un fond complet passe par-dessus le tracé du jour");
  assert.match(carte, /m\.addLayer\(\{ id, type: "raster", source: id, paint: \{ "raster-opacity"[^}]*\} \}, "parcours"\)/, "un calque passe par-dessus le tracé du jour");
  // Un modèle qui n'existe plus ici retombe sur Pacevo, jamais sur une carte vide.
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /const fondChoisi: FondCarte = fondsDispo\.find\(\(f\) => f\.id === fondCarte\) \?\? fondsDispo\[0\];/, "un modèle absent ici laisserait la carte sans fond");
  // Le 3D reste conditionné au relief (clé) : pas de carte inclinée déguisée.
  assert.match(gr, /const avec3d = groupe === "relief" && RELIEF_DISPO;/, "le 3D apparaît dans les calques sans relief disponible");
  assert.match(gr, /const RELIEF_DISPO = avecCle\(RELIEF\.url, process\.env\.NEXT_PUBLIC_MAPTILER_KEY[^)]*\) !== null;/, "le bouton 3D n'est plus conditionné à la clé");
});

test("la carte interactive n'est pas masquée à l'assistance vocale", () => {
  // Elle se déplace et se zoome au doigt : `aria-hidden` sur une zone interactive est
  // une faute d'accessibilité (et rend le contenu focalisable invisible au lecteur).
  const carte = codeNu("src/components/ghost-runner/CarteDirect.tsx");
  assert.ok(!/aria-hidden/.test(carte), "la carte est de nouveau masquée à l'assistance vocale alors qu'elle est manipulable");
  assert.match(carte, /aria-label=\{etiquette \?\? "Carte"\}/, "la carte n'a plus de nom pour l'assistance vocale");
});

test("React ne réécrit jamais la classe du conteneur de Leaflet", () => {
  // ⚠️ LE DÉFAUT LE PLUS SILENCIEUX DE CET ÉCRAN, mesuré le 23/09/2026 en l'exerçant.
  // Leaflet pose SES classes (`leaflet-container`, `leaflet-grab`…) sur l'élément qu'on
  // lui confie. Dès que la valeur du `className` React de cet élément change — ici la
  // hauteur, au départ de la course — React réécrit l'attribut `class` et les emporte
  // toutes. La règle `.leaflet-container .leaflet-tile-pane img { max-width: none }` ne
  // matche plus, le `max-width: 100%` de Tailwind s'applique à des tuiles dont le
  // conteneur fait 0 px de large : CARTE BLANCHE. Tuiles téléchargées, aucune en échec,
  // aucune erreur en console.
  const carte = codeNu("src/components/ghost-runner/CarteDirect.tsx");
  assert.match(carte, /<div className=\{`relative isolate overflow-hidden bg-\[#f2f1ed\] \$\{className\}`\}>/, "la mise en page variable n'est plus portée par une enveloppe");
  assert.match(carte, /<div ref=\{conteneur\}[^>]*className="h-full w-full" \/>/, "l'élément de Leaflet n'a plus de classe constante");
  assert.ok(!/ref=\{conteneur\}[^>]*className=\{/.test(carte), "le conteneur de Leaflet reçoit de nouveau une classe variable : React effacera les classes de Leaflet et la carte deviendra blanche");
});

test("la carte s'ouvre chez l'athlète, pas sur l'Europe entière", () => {
  // Cyprien, 23/09/2026, capture de son ordinateur : « ça rend pas ». Le pire n'était pas
  // la mise en page — la carte s'ouvrait sur la FRANCE ENTIÈRE au zoom 5, un rectangle
  // bleu, et y restait tant que la localisation n'était pas accordée.
  const page = codeNu("src/app/dashboard/ghost-runner/page.tsx");
  assert.match(page, /from\("activity_tracks"\)[\s\S]{0,200}min_lat,max_lat,min_lon,max_lon/, "l'emprise de la dernière trace n'est plus lue : la carte repart sur l'Europe");
  assert.match(page, /\.eq\("has_gps", true\)/, "des traces SANS GPS sont prises pour un cadrage");
  // ⚠️ LES QUATRE BORNES, toutes finies. Une seule manquante donne un NaN, et Leaflet
  // s'ouvre sur une carte vide sans lever la moindre erreur.
  assert.match(page, /bornes\.every\(\(v\) => typeof v === "number" && Number\.isFinite\(v\)\)/, "un centre peut désormais être calculé sur une borne manquante (NaN silencieux)");
  assert.match(page, /centreInitial=\{centreInitial\}/, "le cadrage n'est plus transmis à l'écran");

  const carte = codeNu("src/components/ghost-runner/CarteDirect.tsx");
  assert.match(carte, /const depart = positionRef\.current \?\? centre \?\? null;/, "la position réelle ne prime plus sur le cadrage");
  assert.match(carte, /zoom: positionRef\.current \? 15 : depart \? 13 : 5/, "le cadrage ne change plus le zoom : on reverrait l'Europe");
  // ⚠️ LE CADRAGE N'EST PAS UNE POSITION : le point bleu ne doit JAMAIS s'y afficher.
  const appels = [...carte.matchAll(/poserPoint\(m, ([^)]*)\)/g)].map((x) => x[1]);
  assert.ok(appels.length >= 2, "le point bleu n'est plus posé à la création ni au déplacement");
  for (const a of appels) assert.ok(!/centre|depart/.test(a), `le point bleu est dessiné à partir du cadrage (${a}) : l'athlète se verrait là où il n'est pas`);
});

test("un refus de localisation se dit, et se rattrape", () => {
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /\(\) => setGeoRefusee\(true\),/, "un refus de localisation est de nouveau avalé en silence");
  assert.match(gr, /setPositionCarte\(\[pos\.coords\.latitude, pos\.coords\.longitude\]\); setGeoRefusee\(false\);/, "une position obtenue n'efface plus l'avertissement");
  assert.match(gr, /\{geoRefusee && \(/, "l'écran ne dit plus que la position manque");
  assert.match(gr, /onClick=\{demanderPosition\}/, "on ne peut plus redemander la position : le refus est sans issue");
  for (const k of ["map.geoOff", "map.geoBtn"]) {
    const n = [...readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8").matchAll(new RegExp(`"${k.replace(/\./g, "\\.")}":`, "g"))].length;
    assert.equal(n, 5, `« ${k} » présent ${n} fois, attendu 5`);
  }
});

test("même composition sur téléphone et sur ordinateur (Cyprien, 27/11/2026)", () => {
  // « Pareil sur ordinateur » : une seule colonne de boutons, un seul bloc de chiffres, un
  // seul tiroir — plus de mise en page propre à l'ordinateur (`md:hidden` / `md:flex`).
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.equal([...gr.matchAll(/\{commandesCarte\}/g)].length, 1, "les boutons de la carte sont de nouveau rendus à deux endroits");
  assert.match(gr, /mb-2\.5 flex flex-col items-end gap-2">\{commandesCarte\}/, "les boutons ne sont plus en colonne à droite, au-dessus du bloc");
  assert.ok(!/hidden flex-col gap-2 md:flex">\{commandesCarte\}/.test(gr), "l'ancienne colonne réservée à l'ordinateur est revenue");
  // Une seule définition : deux copies du JSX, ce serait deux fois le même état à tenir.
  assert.equal([...gr.matchAll(/setAudioEnabled\(!audioEnabled\)/g)].length, 1, "le bouton audio est de nouveau écrit deux fois");
});

test("le plein écran ne repose pas sur une API absente d'iPhone", () => {
  // Cyprien, 23/09/2026 : « un bouton comme sur YouTube qui met la carte en grand ».
  // ⚠️ `requestFullscreen` N'EXISTE PAS sur Safari iOS pour autre chose qu'une vidéo : un
  // bouton qui ne reposerait que sur elle ne ferait RIEN sur la moitié des téléphones,
  // sans erreur. Le mécanisme est une couverture CSS ; l'API n'est qu'un bonus.
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /\? "fixed inset-0 z-\[2000\] overflow-hidden bg-white"/, "le grand écran ne repose plus sur une couverture CSS");
  assert.match(gr, /void sectionCarte\.current\?\.requestFullscreen\?\.\(\)\.catch\(\(\) => \{\}\)/, "l'appel au plein écran natif n'est plus facultatif ni protégé");
  assert.match(gr, /<CarteDirect[\s\S]{0,600}className="h-full w-full"/, "la carte ne remplit plus la couverture");
  // En grand écran, la flèche ⌄ en sort (comme Strava) ; hors grand écran, le bouton y entre.
  assert.match(gr, /\{plein && vue === "carte" && \(\s*\n?\s*<button type="button" onClick=\{basculerPlein\}/, "plus moyen de sortir du grand écran sur la carte");
  assert.match(gr, /\{!plein && \(\s*\n?\s*<BtnCarte titre=\{d\["map\.plein"\]\} onClick=\{basculerPlein\}>/, "plus moyen d'entrer dans le grand écran");
  // ⚠️ LA MARGE HÉRITÉE. La pile parente est en `space-y-6`, dont `> * + *` l'emporte sur
  // un `mt-0` : la couverture s'arrêtait 24 px avant le bas (mesuré 788 px sur 812).
  assert.match(gr, /style=\{plein \? \{ margin: 0 \} : undefined\}/, "la marge héritée de la pile n'est plus annulée : la couverture sera trop courte de 24 px");
  // Deux sorties, et elles doivent rester d'accord.
  assert.match(gr, /e\.key === "Escape" && plein/, "Échap ne sort plus du grand écran");
  assert.match(gr, /if \(!document\.fullscreenElement && plein\) setPlein\(false\)/, "quitter le plein écran natif ne referme plus la couverture");
  for (const k of ["map.plein", "map.reduire"]) {
    const n = [...readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8").matchAll(new RegExp(`"${k.replace(/\./g, "\\.")}":`, "g"))].length;
    assert.equal(n, 5, `« ${k} » présent ${n} fois, attendu 5`);
  }
});

test("sur téléphone, l'écran s'ouvre en grand — et la sécurité reste à l'écran au départ", () => {
  // Cyprien, 27/11/2026 : « mets-le en grand écran directement, comme sur Strava ».
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /window\.matchMedia\?\.\("\(max-width: 767px\)"\)\.matches\) return;\s*\n\s*pleinAuto\.current = true;\s*\n\s*setPlein\(true\);/, "l'écran ne s'ouvre plus en grand sur téléphone");
  // Le départ ouvre la vue chiffres (Strava) ; la configuration rouvre la carte.
  assert.match(gr, /setVue\(phase === "setup" \? "carte" : "chiffres"\);/, "le départ n'ouvre plus la vue chiffres");
  // ⚠️ Le lien de suivi et la limite de la veille sont DANS la couverture, dans les deux
  // vues : sinon l'athlète part sans les voir (le défaut qui faisait refermer le grand écran).
  // Sur la carte : le lien de suivi seul (l'encadré de la veille couvrait la carte —
  // Cyprien, 27/11/2026). Dans la vue chiffres, ouverte au départ : tout, veille comprise.
  assert.match(gr, /\{vue === "carte" && departPret && \(/, "le lien de suivi n'apparaît plus sur la carte au départ");
  assert.match(gr, /\{alertesSecurite\(false\)\}/, "la carte affiche de nouveau l'encadré de la veille par-dessus le parcours");
  assert.match(gr, /\{alertesSecurite\(true\)\}\{pastillesCourse\}/, "la sécurité n'apparaît plus dans la vue chiffres");
  const alertes = gr.slice(gr.indexOf("const alertesSecurite"), gr.indexOf("const pastillesCourse"));
  assert.match(alertes, /\{departPret && \(/, "le lien de suivi au départ a quitté l'écran de course");
  assert.match(alertes, /d\["veille\.limite"\]/, "la limite de la veille de choc a quitté l'écran de course");
  // Promesse et limite restent ENSEMBLE : la limite n'est jamais montrée sans la promesse, ni l'inverse.
  assert.match(alertes, /\{avecVeille && \(veilleActive \|\| capteursIndispo\) && phase === "running" && \(/, "la veille n'est plus conditionnée à la vue qui l'affiche en entier");
  // « Réglages » sort du grand écran avant de défiler, sinon rien ne bouge à l'écran.
  const vers = gr.slice(gr.indexOf("const versDetails = () =>"), gr.indexOf("const versDetails = () =>") + 500);
  assert.match(vers, /setPlein\(false\);/, "« Réglages » défile derrière la couverture : rien ne bouge à l'écran");
});

test("« Arrêter » enregistre la course — il ne la jetait pas, il la perdait de vue", () => {
  // ⚠️ DÉFAUT TROUVÉ LE 23/09/2026 EN LISANT LE CHEMIN D'ARRÊT. `finishSession` (distance
  // visée atteinte) appelait `saveRun` ; le bouton rouge, lui, coupait le GPS et remettait
  // l'écran à zéro. Arrêter après 8 km vidait l'écran sans un mot — la copie de secours
  // restait sur le téléphone, mais ne réapparaissait qu'au PROCHAIN chargement de la page.
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  const arret = gr.slice(gr.indexOf("function arreterSession()"), gr.indexOf("function nouvelleSession()"));
  assert.ok(arret.length > 100, "`arreterSession` a disparu");
  assert.match(arret, /if \(modeRef\.current === "live"\) saveRun\(fin\);/, "le bouton « Arrêter » n'enregistre plus la course");
  assert.match(arret, /setPhase\("finished"\)/, "arrêter ne mène plus à l'écran d'arrivée : on ne voit pas ce qu'on vient de courir");
  // …et repartir de zéro depuis l'écran d'arrivée ne doit PAS réenregistrer.
  const neuve = gr.slice(gr.indexOf("function nouvelleSession()"), gr.indexOf("function nouvelleSession()") + 900);
  assert.ok(!/saveRun/.test(neuve), "« Nouvelle session » enregistre une seconde fois la course déjà envoyée");
  assert.match(neuve, /setPhase\("setup"\)/, "« Nouvelle session » ne ramène plus aux réglages");
  // Comme Strava (27/11/2026) : « Terminer » n'existe QU'EN PAUSE — arrêter demande deux
  // gestes, un appui malheureux en courant ne coupe plus la séance. Un seul jeu de boutons.
  assert.equal([...gr.matchAll(/onClick=\{arreterSession\}/g)].length, 1, "les boutons d'arrêt ne pointent plus tous sur l'enregistrement");
  const boutons = gr.slice(gr.indexOf("const boutonsCourse"), gr.indexOf("const libreCourse"));
  assert.match(boutons, /paused \? \([\s\S]*onClick=\{arreterSession\}[\s\S]*d\["ct\.terminer"\][\s\S]*\) : \([\s\S]*onClick=\{pauseSession\}[\s\S]*d\["ct\.pause"\]/, "« Terminer » est accessible sans passer par la pause");
  assert.equal([...gr.matchAll(/onClick=\{nouvelleSession\}/g)].length, 1, "le bouton « Nouvelle session » ne pointe plus sur la remise à zéro");
  assert.ok(!/stopSession\(/.test(gr), "l'ancien arrêt sans enregistrement est revenu");
  const n = [...readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8").matchAll(/"sp\.arret":/g)].length;
  assert.equal(n, 5, `« sp.arret » présent ${n} fois, attendu 5`);
});

test("« Mes parcours » : ses traces, allégées, jamais inventées", () => {
  // Deux traces de 1 000 points, une absente, une vide, une d'un seul point : il en reste
  // deux, allégées.
  const longue = encodePolyline(Array.from({ length: 1000 }, (_, i) => ({ lat: 49.44 + i * 1e-5, lon: 1.1 + i * 1e-5 })));
  const point = encodePolyline([{ lat: 49.44, lon: 1.1 }]);
  const t = allegerParcours([longue, null, "", point, longue]);
  assert.equal(t.length, 2, `${t.length} traces gardées sur 2 dessinables`);
  for (const tr of t) {
    assert.ok(tr.length <= MAX_POINTS + 1, `trace de ${tr.length} points envoyée au téléphone, plafond ${MAX_POINTS}`);
    assert.deepEqual(tr[tr.length - 1], [49.44 + 999e-5, 1.1 + 999e-5].map((v) => Math.round(v * 1e5) / 1e5), "la trace s'arrête avant son arrivée");
  }
  assert.deepEqual(allegerParcours([]), [], "sans trace, la couche doit rester vide");
  // Côté page : SES traces (user_id), avec GPS, plafonnées ; une panne de lecture se dit.
  const page = codeNu("src/app/dashboard/ghost-runner/page.tsx");
  assert.match(page, /\.select\("polyline, workout_id"\)\s*\n?\s*\.eq\("user_id", user!\.id\)\.eq\("has_gps", true\)/, "les parcours ne sont plus filtrés sur l'athlète et le GPS");
  // Leurs dates : lues À PART, sur SES séances ; une sortie sans date n'entre pas dans « 30 jours ».
  assert.match(page, /from\("workouts"\)\.select\("id, date"\)\.eq\("user_id", user!\.id\)\.in\("id"/, "les dates des sorties ne sont plus lues sur les séances de l'athlète");
  const pd = parcoursDates([{ polyline: longue, date: "2026-11-20" }, { polyline: longue, date: null }, { polyline: longue, date: "pas une date" }]);
  assert.deepEqual(pd.map((p) => p.date), ["2026-11-20", null, null], "une date est inventée pour une sortie qui n'en a pas");
  assert.equal(sortiesDepuis(pd, "2026-10-28").length, 1, "« 30 derniers jours » garde des sorties sans date ou trop anciennes");
  assert.match(page, /\.limit\(MAX_PARCOURS\)/, "le nombre de parcours lus n'est plus plafonné");
  assert.match(page, /\["parcours", \{ error: parcoursRes\.error \?\? datesRes\.error \}\]/, "une panne de lecture des parcours ou de leurs dates passerait sous silence");
  // Côté carte : sous le tracé du jour et sous les étiquettes, masquée par défaut.
  const carte = codeNu("src/components/ghost-runner/CarteDirect.tsx");
  assert.match(carte, /m\.addLayer\(\{ id: "parcours"[\s\S]{0,200}visibility: "none"/, "la couche des parcours s'affiche avant qu'on la demande");
  assert.ok(carte.indexOf('id: "parcours"') < carte.indexOf('id: "trace-bord"'), "les anciens parcours passent par-dessus le tracé du jour");
});

test("le réglage « Dénivelé D+ » ne revient pas dans Enregistrer (27/11/2026)", () => {
  // Cyprien : « il ne sert à rien, ça fait trop de modes sur cet onglet ». Il ne mesurait
  // rien, et le D+ CHOISI était même enregistré comme celui de la sortie.
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.ok(!/setElevation\(parseInt/.test(gr), "le curseur de dénivelé est revenu dans Enregistrer");
  assert.ok(!/function ElevationProfile/.test(gr), "le faux profil de dénivelé est revenu");
});

test("« Mes sorties » sont masquées à l'ouverture (27/11/2026)", () => {
  // Trente traces bleues superposées couvraient la carte dès l'arrivée : on les allume à la demande.
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /const \[modeSorties, setModeSorties\] = useState<[^>]*>\("aucune"\);/, "« Mes sorties » s'affichent de nouveau d'office à l'ouverture");
});

test("l'envoi vers la montre nomme la VRAIE marque et dit où trouver la séance (27/11/2026)", () => {
  // Le message disait « via Garmin » à tous, porteurs de COROS ou de Suunto compris, et en
  // français seulement ; un envoi raté ne laissait aucune trace (Vercel garde une heure).
  const route = codeNu("src/app/api/watch/push/route.ts");
  assert.ok(!/via Garmin/.test(route), "le message d'envoi parle de nouveau de Garmin à tout le monde");
  assert.match(route, /marque = montreDe\(await a\.json\(\)\)\?\.nom \?\? null;/, "la route ne dit plus quelle montre recevra la séance");
  assert.match(route, /await journaliserEchec\(null, \{ source: "montre-envoi"/, "un envoi raté vers la montre n'est plus journalisé");
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  // Court : la marque dans le titre, une ligne dessous, ni émoji ni majuscules (« ça fait trop IA »).
  assert.match(gr, /toast\.success\(m \? tg\("w\.envoye", \{ m \}\) : d\["w\.envoyeSans"\], \{ description: ou, duration: 8000 \}\)/, "le message d'envoi n'est plus le message court");
  const fr = readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8");
  for (const k of ["w.envoye", "w.envoyeSans", "w.ou.garmin", "w.ou.coros", "w.ou.autre", "w.ou.aucune"]) {
    const v = fr.match(new RegExp(`"${k.replace(/\./g, "\\.")}": "([^"]*)"`))![1];
    assert.ok(v.length <= 115, `« ${k} » fait ${v.length} caractères : le message redevient un paragraphe`);
    // Les noms de marque s'écrivent comme les marques les écrivent (COROS) : hors contrôle.
    assert.ok(!/[✅🎯]|[A-ZÀ-Ý]{4,}/u.test(v.replace(/COROS/g, "")), `« ${k} » remet un émoji ou des MAJUSCULES : « ${v} »`);
  }
  assert.match(gr, /m === "Garmin" \? d\["w\.ou\.garmin"\] : m === "Coros" \? d\["w\.ou\.coros"\] : m \? tg\("w\.ou\.autre", \{ m \}\) : d\["w\.ou\.aucune"\]/, "l'écran ne dit plus où trouver la séance selon la marque");
});

test("les mots des commandes existent dans les cinq langues", () => {
  const src = readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8");
  for (const k of ["map.plan", "map.satellite", "map.recentrer", "map.reglages", "map.details", "map.fc",
    "map.gpsOk", "map.gpsCherche", "map.vueChiffres", "map.vueCarte", "map.3d", "map.calques", "map.fond",
    "map.mesParcours", "map.mesParcoursAide", "map.mesParcoursVide", "map.fermer", "ct.terminer", "lv.enPause",
    "map.panneau", "map.secSorties", "map.secItineraires", "map.secRelief", "map.secAffichage", "f.plan", "f.nuit", "f.hybride",
    "f.topo", "f.ignPlan", "f.ignPhoto", "f.swisstopo", "f.bkgDe", "f.ignEs", "f.usTopo", "s.toutes", "s.recentes", "s.aucune",
    "c.rando", "c.vtt", "c.velo", "c.ombrage", "c.pentes", "c.courbes", "c.poi",
    "f.outdoor", "f.hiver", "f.cyclosm", "c.ski", "c.randoCh", "s.semaine", "c.pentesAide", "c.eau", "f.ign1950", "f.etatMajor", "w.envoye", "w.envoyeSans", "w.ou.garmin", "w.ou.coros", "w.ou.autre", "w.ou.aucune"]) {
    const n = [...src.matchAll(new RegExp(`"${k.replace(/\./g, "\\.")}":`, "g"))].length;
    assert.equal(n, 5, `« ${k} » présent ${n} fois, attendu 5`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
