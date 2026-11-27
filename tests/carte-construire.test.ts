/**
 * ONGLET CARTE — CONSTRUIRE UN PARCOURS (Cyprien, 27/11/2026, vidéo à l'appui).
 *
 * « Fais comme dans Enregistrer, exactement la même chose, pareil pour la carte en grand »
 * et « des fois ça relie pas du tout ce que je voulais ». Trois défauts constatés :
 *  1. le serveur de démonstration d'OSRM calculait EN VOITURE quel que soit le profil
 *     demandé (1 810 m pour 170 m dans le centre piéton de Rouen, mesuré le 27/11/2026) ;
 *  2. les tronçons étaient AJOUTÉS dans l'ordre d'arrivée des réponses : deux points posés
 *     vite pouvaient être reliés à l'envers ;
 *  3. un échec devenait une ligne droite, sans rien dire.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  serveurItineraire, urlItineraire, calculerTroncon, raccorder, accroche, ECART_REQUETES_MS, ACCROCHE_MAX_M,
  estEchec, assemblerTrace, cleTroncon, estDoubleTap, type Troncon,
} from "../src/lib/trail/itineraire";

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

const A = { lat: 49.4412, lng: 1.0953 }, B = { lat: 49.4405, lng: 1.0975 };
/** Une réponse OSRM fabriquée : le chemin, et où le serveur a accroché les deux points. */
const reponse = (coords: [number, number][], wps: [number, number][]) =>
  new Response(JSON.stringify({ code: "Ok", routes: [{ geometry: { coordinates: coords } }], waypoints: wps.map((location) => ({ location })) }), { status: 200 });

(async () => {
  await test("à pied et en trail : le serveur PIÉTON ; à vélo : le serveur vélo", () => {
    assert.equal(serveurItineraire("course"), "https://routing.openstreetmap.de/routed-foot");
    assert.equal(serveurItineraire("trail"), "https://routing.openstreetmap.de/routed-foot");
    assert.equal(serveurItineraire("marche"), "https://routing.openstreetmap.de/routed-foot");
    assert.equal(serveurItineraire("velo"), "https://routing.openstreetmap.de/routed-bike");
  });

  await test("l'adresse est en [longitude, latitude] et ne vise plus le serveur « voiture »", () => {
    const u = urlItineraire(A, B, "course");
    assert.ok(u.includes(`${A.lng},${A.lat};${B.lng},${B.lat}`), u);
    assert.ok(!u.includes("project-osrm"), u);
  });

  await test("le tronçon rend le chemin ET les points accrochés au chemin", async () => {
    const fake = (async () => reponse([[1.0954, 49.4411], [1.0965, 49.4409], [1.0974, 49.4406]], [[1.0954, 49.4411], [1.0974, 49.4406]])) as unknown as typeof fetch;
    const r = await calculerTroncon(A, B, "course", fake);
    assert.ok(!estEchec(r), "aucun tronçon");
    const t = r as Troncon;
    assert.equal(t.points.length, 3);
    assert.deepEqual(t.depart, { lat: 49.4411, lng: 1.0954 });
    assert.deepEqual(t.arrivee, { lat: 49.4406, lng: 1.0974 });
  });

  await test("l'échec dit SA raison : « aucun chemin » n'est pas « serveur en panne »", async () => {
    const refus = (async () => new Response("x", { status: 429 })) as unknown as typeof fetch;
    assert.deepEqual(await calculerTroncon(A, B, "course", refus), { echec: "panne" });
    const sansChemin = (async () => new Response(JSON.stringify({ code: "NoRoute" }), { status: 200 })) as unknown as typeof fetch;
    assert.deepEqual(await calculerTroncon(A, B, "course", sansChemin), { echec: "aucun" });
    const panne = (async () => { throw new Error("réseau"); }) as unknown as typeof fetch;
    assert.deepEqual(await calculerTroncon(A, B, "course", panne), { echec: "panne" });
  });

  await test("une requête devenue inutile (point annulé, tracé effacé) ne part PAS", async () => {
    let appels = 0;
    const fake = (async () => { appels++; return reponse([[A.lng, A.lat], [B.lng, B.lat]], [[A.lng, A.lat], [B.lng, B.lat]]); }) as unknown as typeof fetch;
    // Trois requêtes en file ; les deux premières deviennent inutiles avant leur tour.
    let utile1 = true, utile2 = true;
    const p1 = calculerTroncon(A, B, "course", fake, () => utile1);
    const p2 = calculerTroncon(A, B, "course", fake, () => utile2);
    utile1 = false; utile2 = false; // « Effacer »
    const debut = Date.now();
    const p3 = calculerTroncon(A, B, "course", fake);
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    assert.deepEqual(r1, { echec: "inutile" });
    assert.deepEqual(r2, { echec: "inutile" });
    assert.ok(!estEchec(r3), "la requête utile n'a pas abouti");
    assert.equal(appels, 1, `${appels} requêtes envoyées au lieu d'une`);
    // Les requêtes inutiles n'ont pas fait attendre la suivante d'une seconde chacune.
    assert.ok(Date.now() - debut < 2 * ECART_REQUETES_MS, `la requête utile a attendu ${Date.now() - debut} ms derrière des requêtes inutiles`);
  });

  await test("une requête par seconde au plus (conditions de FOSSGIS), même posées d'un coup", async () => {
    const departs: number[] = [];
    const fake = (async () => { departs.push(Date.now()); return reponse([[A.lng, A.lat], [B.lng, B.lat]], [[A.lng, A.lat], [B.lng, B.lat]]); }) as unknown as typeof fetch;
    await Promise.all([calculerTroncon(A, B, "course", fake), calculerTroncon(B, A, "course", fake)]);
    assert.equal(departs.length, 2);
    // ⚠️ Comparé à 1 000 ms ÉCRITS ICI, pas à la constante importée : sinon passer la
    // constante à 300 ms laisserait le test vert (seconde relecture, 27/11/2026).
    assert.ok(ECART_REQUETES_MS >= 1000, `ECART_REQUETES_MS = ${ECART_REQUETES_MS} : moins d'une seconde entre deux requêtes`);
    assert.ok(departs[1] - departs[0] >= 995, `écart ${departs[1] - departs[0]} ms entre deux requêtes`);
  });

  await test("un point posé à côté d'une rue se pose SUR la rue ; loin de tout chemin, il reste où il est", () => {
    const t = { points: [{ lat: 49.4411, lng: 1.0954 }, { lat: 49.4406, lng: 1.0974 }], depart: { lat: 49.4411, lng: 1.0954 }, arrivee: { lat: 49.4406, lng: 1.0974 } };
    const pres = raccorder(A, B, t);
    assert.deepEqual(pres.repere, t.arrivee, "le repère n'est pas accroché au chemin");
    assert.equal(pres.points.length, 1, "une ligne droite a été ajoutée pour un point tout près");
    const loin = { lat: B.lat + 0.002, lng: B.lng }; // ≈ 220 m au nord
    const r = raccorder(A, loin, t);
    assert.deepEqual(r.repere, loin, "un point visé loin du chemin a été déplacé");
    assert.deepEqual(r.points[r.points.length - 1], loin, "le point visé n'est pas rejoint");
    assert.ok(ACCROCHE_MAX_M >= 30 && ACCROCHE_MAX_M <= 100);
    assert.deepEqual(accroche(A, { lat: A.lat + 0.0001, lng: A.lng }), { lat: A.lat + 0.0001, lng: A.lng });
  });

  await test("le tracé suit l'ORDRE DES POINTS, quel que soit l'ordre d'arrivée des réponses", () => {
    const p = (id: number, lat: number) => ({ id, lat, lng: 1 });
    const r1 = p(1, 49.0), r2 = p(2, 49.1), r3 = p(3, 49.2);
    const t12 = [{ lat: 49.05, lng: 1 }, { lat: 49.1, lng: 1 }], t23 = [{ lat: 49.15, lng: 1 }, { lat: 49.2, lng: 1 }];
    // Le tronçon 2→3 est arrivé AVANT le tronçon 1→2 (deux points posés vite).
    const desordre: Record<string, typeof t12> = {};
    desordre[cleTroncon(r2, r3)] = t23;
    desordre[cleTroncon(r1, r2)] = t12;
    const attendu = [{ lat: 49.0, lng: 1 }, ...t12, ...t23];
    assert.deepEqual(assemblerTrace([r1, r2, r3], desordre), attendu);
    // Tant qu'un tronçon manque, une ligne droite jusqu'à son point, à sa place.
    assert.deepEqual(assemblerTrace([r1, r2, r3], { [cleTroncon(r2, r3)]: t23 }), [{ lat: 49.0, lng: 1 }, { lat: 49.1, lng: 1 }, ...t23]);
    // Un point annulé : son tronçon n'est plus lu, même s'il est arrivé après.
    assert.deepEqual(assemblerTrace([r1, r2], desordre), [{ lat: 49.0, lng: 1 }, ...t12]);
  });

  await test("un double-tap n'est pas deux points ; deux taps espacés, si", () => {
    const t0 = { t: 1000, lat: 49.44, lng: 1.09 };
    assert.equal(estDoubleTap(t0, { t: 1250, lat: 49.44001, lng: 1.09 }), true);
    assert.equal(estDoubleTap(t0, { t: 1700, lat: 49.44001, lng: 1.09 }), false, "un tap lent au même endroit est un vrai point");
    assert.equal(estDoubleTap(t0, { t: 1250, lat: 49.45, lng: 1.09 }), false, "deux taps rapides éloignés sont deux points");
    assert.equal(estDoubleTap(null, t0), false);
  });

  const tb = lire("src/components/trail/TrailBuilder.tsx");

  await test("l'écran branche ces garde-fous : file annulable, double-tap, D+ en attente, feuille ouverte", () => {
    assert.match(tb, /const allPoints = useMemo<LatLng\[\]>\(\(\) => assemblerTrace\(reperes, troncons\), \[reperes, troncons\]\);/);
    assert.match(tb, /await calculerTroncon\(depuis, vers, activity, fetch, utile\)/);
    assert.match(tb, /if \(double\) return;/);
    assert.match(lire("src/components/ghost-runner/CarteDirect.tsx"), /doubleClickZoom: !onClic,/);
    // « … » et pas « 0 m » pendant la lecture d'altitude ; pas d'enregistrement à ce moment.
    assert.match(tb, /altitudeIndispo \? "—" : profilEnCours \? "…" : elevGain/);
    assert.match(tb, /if \(profilEnCours \|\| routeLoading\) return;/);
    assert.match(tb, /onClic=\{feuille \? fermerFeuille : navMode \? undefined : handleMapClick\}/);
  });

  await test("les tronçons sont RANGÉS sous leurs deux points, jamais empilés dans l'ordre d'arrivée", () => {
    assert.match(tb, /setTroncons\(\(x\) => \(\{ \.\.\.x, \[cle\]: points \}\)\)/);
    assert.ok(!/setSegments\(\s*s\s*=>\s*\[\.\.\.s/.test(tb), "les tronçons sont de nouveau empilés à l'arrivée");
    // Un point annulé pendant le calcul laisse la réponse sans effet.
    assert.match(tb, /if \(!utile\(\)\) return;/);
    // Un second tap rapide se relie au point qui vient d'être posé.
    assert.match(tb, /reperesRef\.current = \[\.\.\.reperesRef\.current, r\];/);
  });

  await test("un échec du calcul se DIT (ligne droite annoncée)", () => {
    assert.match(tb, /if \(estEchec\(t\)\) \{\s*toast\.error\(t\.echec === "panne" \? d\["t\.routeDown"\] : d\["t\.routeFail"\], \{ id: "itineraire" \}\);/);
    const i18n = readFileSync("src/components/trail/trailI18n.ts", "utf8");
    assert.equal((i18n.match(/"t\.routeFail":/g) ?? []).length, 5, "t.routeFail manque dans une langue");
    assert.equal((i18n.match(/"t\.routeDown":/g) ?? []).length, 5, "t.routeDown manque dans une langue");
    assert.equal((i18n.match(/openstreetmap\.org\/fixthemap/g) ?? []).length, 5, "le lien « corriger la carte » de FOSSGIS manque dans une langue");
  });

  await test("la Carte est celle d'Enregistrer : MapLibre, même tiroir des modèles, en grand sur téléphone", () => {
    assert.ok(!/from "leaflet"|import\("leaflet"\)/.test(tb), "Leaflet est revenu dans la Carte");
    assert.match(tb, /import\("@\/components\/ghost-runner\/CarteDirect"\)/);
    assert.match(tb, /<TiroirModeles/);
    assert.match(lire("src/components/ghost-runner/GhostRunner.tsx"), /<TiroirModeles/);
    assert.match(tb, /usePleinEcran\(plein\);/);
    assert.match(tb, /"fixed inset-0 z-\[2000\] overflow-hidden bg-white"/);
    assert.match(tb, /matchMedia\?\.\("\(max-width: 767px\)"\)\.matches\) setPlein\(true\)/);
    assert.match(tb, /creditPlus=\{d\["credit"\]\}/);
  });

  await test("la CSP autorise le serveur d'itinéraire, plus le serveur de démonstration", () => {
    const conf = readFileSync("next.config.ts", "utf8");
    assert.ok(conf.includes("https://routing.openstreetmap.de"), "routing.openstreetmap.de absent de connect-src");
    assert.ok(!conf.includes("router.project-osrm.org"), "le serveur « voiture » est encore autorisé");
  });

  console.log(`\n${ok} test(s) passé(s), ${echecs.length} échec(s)`);
  if (echecs.length) { for (const e of echecs) console.log(`  ✗ ${e}`); process.exit(1); }
})();
