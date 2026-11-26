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
import { fondsCarteDirecte, satelliteDisponible, stylePacevo, REPLI_PLAN, ATTRIBUTION_PLAN, STYLE_PLAN_URL } from "../src/lib/courses/fondsCarte";
import { FONDS, avecCle } from "../src/lib/trail/couches";

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
  assert.match(carte, /attribution: SATELLITE\.attribution/, "le satellite est posé sans attribution");
  // ⚠️ EN HAUT, ET DÉPLIÉE : le bloc blanc des chiffres couvre tout le bas de la carte, et
  // une attribution recouverte ou repliée vaut une attribution absente.
  assert.match(carte, /new maplibregl\.AttributionControl\(\{ compact: false \}\), "top-left"/, "l'attribution est repassée sous le bloc blanc, ou repliée");
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
  assert.match(carte, /if \(!suivreRef\.current\) return;\s*\n\s*m\.easeTo\(\{ center: versLngLat\(position\)/, "la carte se recentre encore à chaque point GPS, suivi coupé ou non");
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
  // Plein écran avant le départ, réduite pendant la course. La carte garde la taille
  // mesurée à la création et ne dessine que dessus : le reste reste vide.
  const carte = codeNu("src/components/ghost-runner/CarteDirect.tsx");
  assert.match(carte, /new ResizeObserver\(\(\) => carte\.current\?\.resize\(\)\)/, "la carte ne se remesure plus quand sa hauteur change : la moitié reste grise");
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /phase === "setup"\s*\n?\s*\? "h-\[calc\(100dvh-13\.5rem\)\]/, "la carte ne prend plus l'écran avant le départ");
  assert.match(gr, /: "h-\[40vh\] min-h-\[220px\] w-full md:h-\[380px\]"/, "la carte ne se réduit plus pendant la course : les chiffres géants passent sous le pli");
});

test("le bloc blanc est POSÉ sur la carte, pas dedans — sinon Leaflet mange le doigt", () => {
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.ok(!/<\/CarteDirect>/.test(gr), "des commandes sont passées À L'INTÉRIEUR de la carte : appuyer dessus la déplacerait");
  const bloc = gr.indexOf('<div className="absolute inset-x-0 bottom-0 z-[500]');
  assert.ok(bloc > gr.indexOf("<CarteDirect"), "le bloc de chiffres ne suit plus la carte");
  // Les trois chiffres, et LE bouton de départ.
  assert.match(gr, /chiffresCarte\.map/, "les chiffres ont disparu du bloc posé sur la carte");
  assert.match(gr, /<GrosBouton label=\{d\["start"\]\}/, "le gros bouton « Démarrer » a quitté la carte");
  assert.match(gr, /<GrosBouton label=\{d\["ct\.stop"\]\}/, "le gros bouton d'arrêt a quitté la carte pendant la course");
});

test("le bouton satellite n'apparaît que si la clé existe", () => {
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /const SATELLITE_DISPO = fondsCarteDirecte\(process\.env\.NEXT_PUBLIC_MAPTILER_KEY[^)]*\)\.includes\("satellite"\)/, "la disponibilité du satellite n'est plus déduite de la clé");
  assert.match(gr, /\{SATELLITE_DISPO && \(\s*\n?\s*<BtnCarte/, "le bouton de fond n'est plus conditionné à la clé : il basculerait sur des tuiles 403");
  // Et la clé n'est jamais écrite en dur nulle part.
  for (const f of ["src/components/ghost-runner/CarteDirect.tsx", "src/lib/courses/fondsCarte.ts", "src/components/ghost-runner/GhostRunner.tsx"]) {
    assert.ok(!/key=[A-Za-z0-9]{8,}/.test(readFileSync(f, "utf8")), `une clé MapTiler est écrite en dur dans ${f}`);
  }
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

test("sur ordinateur, le bloc s'ancre à gauche et les commandes montent sur la carte", () => {
  // Un bloc de 512 px centré au milieu de 1 200 px de carte flottait dans le vide.
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /rounded-\[26px\][^"]*md:mx-0 md:max-w-sm/, "le bloc blanc est redevenu centré et large sur ordinateur");
  assert.match(gr, /absolute right-3 top-3 z-\[500\] hidden flex-col gap-2 md:flex">\{commandesCarte\}/, "les commandes ne remontent plus sur la carte sur ordinateur");
  assert.match(gr, /mx-auto mb-2\.5 flex max-w-lg justify-end gap-2 md:hidden">\{commandesCarte\}/, "les commandes ne sont plus dans la pile du bas sur téléphone");
  // Une seule définition : deux copies du JSX, ce serait deux fois le même état à tenir.
  assert.equal([...gr.matchAll(/setAudioEnabled\(!audioEnabled\)/g)].length, 1, "le bouton audio est de nouveau écrit deux fois");
});

test("le plein écran ne repose pas sur une API absente d'iPhone", () => {
  // Cyprien, 23/09/2026 : « un bouton comme sur YouTube qui met la carte en grand ».
  // ⚠️ `requestFullscreen` N'EXISTE PAS sur Safari iOS pour autre chose qu'une vidéo : un
  // bouton qui ne reposerait que sur elle ne ferait RIEN sur la moitié des téléphones,
  // sans erreur. Le mécanisme est une couverture CSS ; l'API n'est qu'un bonus.
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /\? "fixed inset-0 z-\[2000\] bg-white"/, "le grand écran ne repose plus sur une couverture CSS");
  assert.match(gr, /void sectionCarte\.current\?\.requestFullscreen\?\.\(\)\.catch\(\(\) => \{\}\)/, "l'appel au plein écran natif n'est plus facultatif ni protégé");
  assert.match(gr, /className=\{plein\s*\n?\s*\? "h-full w-full"/, "la carte ne remplit plus la couverture");
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

test("sur téléphone, l'écran s'ouvre en grand — et rend la page au départ", () => {
  // Cyprien, 27/11/2026 : « mets-le en grand écran directement, comme sur Strava ».
  const gr = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  assert.match(gr, /window\.matchMedia\?\.\("\(max-width: 767px\)"\)\.matches\) return;\s*\n\s*pleinAuto\.current = true;\s*\n\s*setPlein\(true\);/, "l'écran ne s'ouvre plus en grand sur téléphone");
  // ⚠️ Le lien de suivi et la limite de la veille s'affichent HORS de la carte : sous la
  // couverture, l'athlète partirait sans les voir. Le grand écran automatique se referme.
  assert.match(gr, /if \(phase !== "setup" && pleinAuto\.current\) \{ pleinAuto\.current = false; setPlein\(false\); \}/, "le grand écran automatique cache le lien de suivi au départ");
  // Celui que l'athlète a demandé lui-même reste : basculer efface la marque « automatique ».
  assert.match(gr, /function basculerPlein\(\) \{\s*\n\s*const suivant = !plein;\s*\n\s*pleinAuto\.current = false;/, "un grand écran demandé à la main se refermerait seul au départ");
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
  // Les quatre boutons vont au bon endroit : 2 pendant la course, 2 à l'arrivée.
  assert.equal([...gr.matchAll(/onClick=\{arreterSession\}|onClick=\{\(\) => arreterSession/g)].length + [...gr.matchAll(/teinte="rouge" onClick=\{arreterSession\}/g)].length, 3, "les boutons d'arrêt ne pointent plus tous sur l'enregistrement");
  assert.equal([...gr.matchAll(/onClick=\{nouvelleSession\}/g)].length, 2, "les boutons « Nouvelle session » ne pointent plus tous sur la remise à zéro");
  assert.ok(!/stopSession\(/.test(gr), "l'ancien arrêt sans enregistrement est revenu");
  const n = [...readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8").matchAll(/"sp\.arret":/g)].length;
  assert.equal(n, 5, `« sp.arret » présent ${n} fois, attendu 5`);
});

test("les mots des commandes existent dans les cinq langues", () => {
  const src = readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8");
  for (const k of ["map.plan", "map.satellite", "map.recentrer", "map.reglages", "map.details", "map.fc"]) {
    const n = [...src.matchAll(new RegExp(`"${k.replace(/\./g, "\\.")}":`, "g"))].length;
    assert.equal(n, 5, `« ${k} » présent ${n} fois, attendu 5`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
