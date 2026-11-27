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
    const t = await calculerTroncon(A, B, "course", fake);
    assert.ok(t, "aucun tronçon");
    assert.equal(t!.points.length, 3);
    assert.deepEqual(t!.depart, { lat: 49.4411, lng: 1.0954 });
    assert.deepEqual(t!.arrivee, { lat: 49.4406, lng: 1.0974 });
  });

  await test("un refus ou une réponse sans chemin rend null (l'écran dit « ligne droite »)", async () => {
    const refus = (async () => new Response("x", { status: 429 })) as unknown as typeof fetch;
    assert.equal(await calculerTroncon(A, B, "course", refus), null);
    const sansChemin = (async () => new Response(JSON.stringify({ code: "NoRoute" }), { status: 200 })) as unknown as typeof fetch;
    assert.equal(await calculerTroncon(A, B, "course", sansChemin), null);
    const panne = (async () => { throw new Error("réseau"); }) as unknown as typeof fetch;
    assert.equal(await calculerTroncon(A, B, "course", panne), null);
  });

  await test("une requête par seconde au plus (conditions de FOSSGIS), même posées d'un coup", async () => {
    const departs: number[] = [];
    const fake = (async () => { departs.push(Date.now()); return reponse([[A.lng, A.lat], [B.lng, B.lat]], [[A.lng, A.lat], [B.lng, B.lat]]); }) as unknown as typeof fetch;
    await Promise.all([calculerTroncon(A, B, "course", fake), calculerTroncon(B, A, "course", fake)]);
    assert.equal(departs.length, 2);
    assert.ok(departs[1] - departs[0] >= ECART_REQUETES_MS - 5, `écart ${departs[1] - departs[0]} ms`);
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

  const tb = lire("src/components/trail/TrailBuilder.tsx");

  await test("les tronçons sont RANGÉS sous leurs deux points, jamais empilés dans l'ordre d'arrivée", () => {
    assert.match(tb, /const cleTroncon = \(a: Repere, b: Repere\) => `\$\{a\.id\}>\$\{b\.id\}`/);
    assert.match(tb, /setTroncons\(\(x\) => \(\{ \.\.\.x, \[cle\]: points \}\)\)/);
    assert.ok(!/setSegments\(\s*s\s*=>\s*\[\.\.\.s/.test(tb), "les tronçons sont de nouveau empilés à l'arrivée");
    // Un point annulé pendant le calcul laisse la réponse sans effet.
    assert.match(tb, /if \(!reperesRef\.current\.some\(\(r\) => r\.id === vers\.id\)\) return;/);
    // Un second tap rapide se relie au point qui vient d'être posé.
    assert.match(tb, /reperesRef\.current = \[\.\.\.reperesRef\.current, r\];/);
  });

  await test("un échec du calcul se DIT (ligne droite annoncée)", () => {
    assert.match(tb, /if \(!t\) \{\s*toast\.error\(d\["t\.routeFail"\]\);/);
    const i18n = readFileSync("src/components/trail/trailI18n.ts", "utf8");
    assert.equal((i18n.match(/"t\.routeFail":/g) ?? []).length, 5, "t.routeFail manque dans une langue");
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
