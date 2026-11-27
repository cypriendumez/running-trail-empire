/**
 * ONGLET CARTE — PARCOURS PROPOSÉS ET CRASH-TESTS DU TRACÉ (Cyprien, 27/11/2026).
 *
 * « Pourquoi ça ne propose plus les parcours comme avant ? Trouve un moyen de les proposer
 * et en même temps ne pas être perdu. Il y a encore des petits bugs quand je veux créer mes
 * tracés : fais plein d'essais et de crash-tests, course à pied, VTT, vélo, trail, rando. »
 *
 * Défauts trouvés en crash-test (vraie carte, vrai serveur d'itinéraire) :
 *  1. Calanques : deux points loin des sentiers → 20 km de tracé pour 1,9 km à vol d'oiseau ;
 *  2. le D+ passait à « — » : 13 lectures d'altitude sur 34 refusées (429), relues à chaque
 *     changement intermédiaire du tracé ;
 *  3. passer de Course à Vélo laissait le tracé piéton (point pour point identique) ;
 *  4. après un parcours chargé puis « Effacer », le nouveau tracé portait encore son nom ;
 *  5. ni VTT ni randonnée dans le constructeur (un parcours VTT se chargeait en vélo de route).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loinDuChemin, LOIN_CHEMIN_M, type Troncon } from "../src/lib/trail/itineraire";
import { chargerProfil } from "../src/lib/trail/altitude";
import { SPORT_ACTIVITY } from "../src/data/parcoursHdf";

let ok = 0;
const echecs: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); ok++; console.log(`  ✓ ${nom}`); }
  catch (e) { echecs.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${nom}`); }
}
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}
const lire = (p: string) => sansCommentaires(readFileSync(p, "utf8"));

(async () => {
  await test("un point loin de tout chemin n'est pas « accroché » à un chemin lointain (Calanques)", () => {
    const a = { lat: 43.2140, lng: 5.4480 }, b = { lat: 43.2100, lng: 5.4600 };
    // Réponse vue au crash-test : le serveur accroche b à 421 m de là.
    const loin: Troncon = { points: [a, b], depart: { lat: 43.21406, lng: 5.44803 }, arrivee: { lat: 43.2138, lng: 5.4600 } };
    assert.equal(loinDuChemin(a, b, loin), true, "un point à ~420 m du chemin est routé comme s'il était dessus");
    const pres: Troncon = { points: [a, b], depart: a, arrivee: { lat: 43.2101, lng: 5.4601 } };
    assert.equal(loinDuChemin(a, b, pres), false, "un point à côté du chemin passe en ligne droite");
    // Le départ compte aussi : un point de départ hors-piste.
    assert.equal(loinDuChemin(a, b, { ...pres, depart: { lat: 43.2170, lng: 5.4480 } }), true);
    assert.ok(LOIN_CHEMIN_M >= 100 && LOIN_CHEMIN_M <= 300, `seuil ${LOIN_CHEMIN_M} m`);
  });

  const pts = [{ lat: 45.92, lng: 6.86 }, { lat: 45.93, lng: 6.87 }, { lat: 45.94, lng: 6.88 }];
  const reponse = (n: number) => new Response(JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => 1000 + i * 50) }), { status: 200 });
  const nb = (u: string) => new URL(u).searchParams.get("latitude")!.split(",").length;

  await test("un refus passager de l'altitude (429) est réessayé une fois : le D+ ne passe plus à « — »", async () => {
    let appels = 0;
    const f = (async (u: string) => { appels++; return appels === 1 ? new Response("trop", { status: 429 }) : reponse(nb(u)); }) as unknown as typeof fetch;
    const p = await chargerProfil(pts, { fetch: f, pauseMs: 5 });
    assert.ok(p, "un seul 429 fait perdre tout le profil");
    assert.equal(appels, 2);
    assert.ok(p!.gain > 0);
  });

  await test("deux refus de suite : l'altitude est dite indisponible (jamais un profil inventé)", async () => {
    let appels = 0;
    const f = (async () => { appels++; return new Response("trop", { status: 429 }); }) as unknown as typeof fetch;
    assert.equal(await chargerProfil(pts, { fetch: f, pauseMs: 5 }), null);
    assert.equal(appels, 2, `${appels} appels : on ne martèle pas un service qui refuse`);
    // Une vraie erreur (400) n'est pas réessayée.
    let appels400 = 0;
    const f400 = (async () => { appels400++; return new Response("x", { status: 400 }); }) as unknown as typeof fetch;
    assert.equal(await chargerProfil(pts, { fetch: f400, pauseMs: 5 }), null);
    assert.equal(appels400, 1, "une erreur définitive est réessayée");
  });

  await test("un tracé abandonné pendant la pause ne relance pas de lecture", async () => {
    let appels = 0;
    const ctrl = new AbortController();
    const f = (async () => { appels++; return new Response("trop", { status: 429 }); }) as unknown as typeof fetch;
    const p = chargerProfil(pts, { fetch: f, pauseMs: 200, signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 20);
    assert.equal(await p, null);
    assert.equal(appels, 1, "la lecture repart après l'abandon");
  });

  const tb = lire("src/components/trail/TrailBuilder.tsx");

  await test("l'altitude n'est lue que sur un tracé STABLE (fin des calculs, puis 700 ms)", () => {
    assert.match(tb, /if \(routeLoading\) return;\s*\n\s*const ctrl = new AbortController\(\);\s*\n\s*const minuterie = setTimeout\(\(\) => \{\s*\n\s*chargerProfil\(allPoints/);
    assert.match(tb, /\}, 700\);\s*\n\s*return \(\) => \{ clearTimeout\(minuterie\); ctrl\.abort\(\); \};\s*\n\s*\}[\s\S]{0,120}\}, \[allPoints, routeLoading\]\);/);
  });

  await test("changer d'activité recalcule le tracé posé — sauf un parcours chargé (vrai tracé GPS)", () => {
    assert.match(tb, /const profilTrace = followPaths \? profilOsrm\(activity\) : "droit";/);
    assert.match(tb, /if \(!tronconsFixes\.current\.has\(cleTroncon\(rs\[i - 1\], rs\[i\]\)\)\) void relier\(rs\[i - 1\], rs\[i\], true\);/);
    assert.match(tb, /tronconsFixes\.current = new Set\(\[cleTroncon\(a, b\)\]\);/, "un parcours chargé serait recalculé, et son vrai tracé perdu");
    // Un recalcul raté garde le chemin déjà calculé (pas de ligne droite à sa place).
    assert.match(tb, /void relier\(rs\[i - 1\], rs\[i\], true\);/);
    assert.match(tb, /if \(recalcul\) return;\s*\n\s*setTroncons\(\(x\) => \(\{ \.\.\.x, \[cle\]: \[\{ lat: vers\.lat, lng: vers\.lng \}\] \}\)\);/);
  });

  await test("un point loin de tout chemin est relié en ligne droite, et c'est dit", () => {
    assert.match(tb, /if \(loinDuChemin\(depuis, vers, t\)\) \{\s*toast\(d\["t\.loinChemin"\], \{ id: "itineraire" \}\);/);
  });

  await test("« Effacer » oublie le nom du parcours chargé", () => {
    const clear = tb.slice(tb.indexOf("const handleClear = useCallback"), tb.indexOf("}, []);", tb.indexOf("const handleClear = useCallback")));
    assert.match(clear, /setRouteName\(""\);/, "le tracé suivant garderait le nom du parcours effacé");
  });

  await test("course, trail, randonnée, vélo ET VTT ; un parcours VTT se charge en VTT", () => {
    for (const k of ["course", "trail", "marche", "velo", "vtt"]) assert.match(tb, new RegExp(`\\n  ${k}: +\\{ label:`), `activité ${k} absente`);
    assert.equal(SPORT_ACTIVITY["VTT"], "vtt");
    assert.equal(SPORT_ACTIVITY["Randonnée"], "marche");
    const i18n = readFileSync("src/components/trail/trailI18n.ts", "utf8");
    assert.equal((i18n.match(/"act\.vtt":/g) ?? []).length, 5, "« VTT » manque dans une langue");
    assert.ok(/"act\.marche": "Randonnée"/.test(i18n), "« Randonnée » n'est plus le libellé français");
    assert.match(lire("src/components/parcours/IconeSport.tsx"), /vtt: Bike/);
  });

  await test("les parcours sont PROPOSÉS dans la carte : pastilles, ligne « voir », liste par sport", () => {
    assert.match(tb, /const montrerPropositions = !navMode && reperes\.length === 0;/, "les pastilles s'affichent pendant un tracé, ou jamais");
    assert.match(tb, /propositions=\{pastilles\}\s*\n\s*onProposition=\{toucherProposition\}\s*\n\s*onVue=\{changerCentreVu\}/);
    // 27/11/2026 (Cyprien) : plus de ligne « Voir les N parcours » ni de bouton rond. La
    // POIGNÉE du tiroir ouvre tous les parcours de France, les plus proches d'abord.
    assert.ok(!/tb\("parcoursVoir"/.test(tb), "la ligne « Voir les N parcours autour d'ici » est revenue");
    assert.ok(!/titre=\{d\["parcoursProches"\]\}/.test(tb), "le bouton rond « Parcours » est revenu (doublon du tiroir)");
    assert.match(tb, /<button type="button" \{\.\.\.poignee\} aria-expanded=\{tiroirOuvert\}/, "la poignée du tiroir n'ouvre plus les parcours");
    assert.match(tb, /if \(dy < -25\) \{ e\.preventDefault\(\); setTiroirOuvert\(true\); \}\s*\n\s*else if \(dy > 25\) \{ e\.preventDefault\(\); setTiroirOuvert\(false\); \}/, "la poignée ne s'ouvre plus d'un glissé vers le haut");
    assert.match(tb, /const besoinPropositions = montrerPropositions \|\| tiroirOuvert;/);
    // Toute la France, triée par distance : recherche, puis pages suivantes.
    assert.match(tb, /sort: "proche", sport: sportPropose, q: rechercheDiff, pageSize: "20", page: "1"/);
    assert.match(tb, /page: String\(pagePropo \+ 1\)/, "« Afficher plus » ne lit plus la page suivante");
    assert.match(tb, /\{propositions\.length < totalPropo && \(/, "« Afficher plus » a disparu");
    // Tiroir ouvert, un tap sur la carte le referme au lieu de poser un point dessous.
    assert.match(tb, /onClic=\{feuille \? fermerFeuille : tiroirOuvert \? fermerTiroir : navMode \? undefined : handleMapClick\}/);
    assert.match(tb, /new URLSearchParams\(\{ near: `\$\{lat\.toFixed\(3\)\},\$\{lng\.toFixed\(3\)\}`, sort: "proche", sport: sportPropose/);
    // Une panne n'est pas « aucun parcours ici ».
    assert.match(tb, /if \(!r\.ok \|\| !Array\.isArray\(j\.items\)\) \{ setEtatPropositions\("erreur"\); return; \}/);
    const i18n = readFileSync("src/components/trail/trailI18n.ts", "utf8");
    for (const k of ["parcoursProches", "parcoursAucun", "parcoursErreur", "parcoursCharger", "parcoursRecherche", "parcoursPlus", "parcoursTotal", "tiroirOuvrir", "tiroirFermer", "t.loinChemin"]) {
      assert.equal((i18n.match(new RegExp(`"${k.replace(".", "\\.")}":`, "g")) ?? []).length, 5, `« ${k} » manque dans une langue`);
    }
  });

  await test("un parcours proposé se charge par la liste du dessous : mêmes contrôles, aucun tracé inventé", () => {
    assert.match(tb, /window\.dispatchEvent\(new CustomEvent\("te:chargerParcours", \{ detail: p \}\)\);/);
    const pb = lire("src/components/parcours/ParcoursBrowser.tsx");
    assert.match(pb, /window\.addEventListener\("te:chargerParcours", demande\);/, "la liste n'écoute plus les demandes de la carte : toucher un parcours ne ferait rien");
    assert.match(pb, /if \(p && typeof p\.id === "number"\) void loadOnMap\(p\);/);
  });

  await test("une pastille touchée prend le tap (aucun point posé dessous), sur une zone à la taille du doigt", () => {
    const cd = lire("src/components/ghost-runner/CarteDirect.tsx");
    assert.match(cd, /const f = m\.queryRenderedFeatures\(\[\[x - 14, y - 14\], \[x \+ 14, y \+ 14\]\], \{ layers: \["propositions"\] \}\)\[0\];\s*\n\s*if \(f\) \{ propositionRef\.current\(Number\(f\.properties\?\.id\)\); return; \}/);
    // Le cadrage d'un parcours chargé laisse l'arrivée AU-DESSUS du bloc de chiffres.
    assert.match(cd, /bottom: Math\.min\(380, h \* 0\.5\)/);
  });

  console.log(`\n${ok} test(s) passé(s), ${echecs.length} échec(s)`);
  if (echecs.length) { for (const e of echecs) console.log(`  ✗ ${e}`); process.exit(1); }
})();
