/**
 * TRACÉ D'UN PARCOURS — plus d'une minute d'attente, puis un tracé INVENTÉ (09/11/2026).
 *
 * Capture de Cyprien : « Chargement du tracé… » depuis une minute. La route n'interrogeait
 * qu'Overpass, un serveur après l'autre (30 s chacun) ; ce jour-là overpass-api.de répondait
 * 502 et les miroirs ne répondaient plus. Le navigateur fabriquait ensuite une boucle
 * « déterministe » autour du départ (`generateTrace`) et l'affichait sous le nom du parcours.
 *
 * Désormais : l'API officielle d'OpenStreetMap ET Overpass en même temps, la première géométrie
 * valable gagne ; cache persistant ; et rien d'inventé côté navigateur.
 *
 *   npx tsx tests/parcours-geometrie.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { geometrieParcours, geometrieVerifiee, depuisApiOsm, depuisOverpass, refusDefinitif, causes, ErreurSource, echecPassager } from "../src/lib/parcours/geometrie";
import { tracePartiel, longueurKm, PART_MIN } from "../src/lib/parcours/trace";
import { estDuCatalogue, distanceDuCatalogue } from "../src/lib/parcours/catalogue";
import { MemoireJournal } from "../src/lib/parcours/journalTraces";
import os from "os";

let passed = 0; const fails: string[] = [];
// ⚠️ UNE LIMITE PAR TEST, ET ELLE GARDE LE PROGRAMME EN VIE. Les délais réseau (`AbortSignal.timeout`)
// ne retiennent pas Node : un test suspendu le faisait QUITTER en code 0, sans résumé — un « vert »
// qui n'avait rien vérifié (vu en éprouvant ce fichier par mutation, 09/11/2026).
async function test(nom: string, fn: () => Promise<void> | void) {
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rej) => { minuterie = setTimeout(() => rej(new Error("suspendu plus de 20 s")), 20_000); });
  try { await Promise.race([fn(), limite]); passed++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}\n      ${(e as Error).message}`); }
  finally { clearTimeout(minuterie); }
}
// Filet final : si le programme s'arrête sans avoir écrit son résumé, c'est un échec.
let resume = false;
process.on("exit", () => { if (!resume) { console.log("  ✗ arrêt sans résumé : un test ne s'est pas terminé"); process.exitCode = 1; } });
const codeNu = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

// ── Un faux réseau : chaque test dit ce que répondent l'API officielle et Overpass ──────────
type Reponse = { status: number; body?: unknown } | "jamais";
const vrai = globalThis.fetch;
function reseau(api: (url: string) => Reponse, overpass: Reponse) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const r = url.includes("api.openstreetmap.org") ? api(url) : overpass;
    if (r === "jamais") {
      // Un serveur qui ne répond plus : seule la limite de temps (signal) l'arrête.
      return new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("délai"))));
    }
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

// Une relation de deux chemins qui se touchent, au format de l'API officielle (`/full.json`).
const n = (id: number, lon: number, lat: number) => ({ type: "node", id, lon, lat });
const RELATION_SIMPLE = { elements: [
  n(1, 5.600, 43.520), n(2, 5.601, 43.521), n(3, 5.602, 43.522), n(4, 5.603, 43.523),
  { type: "way", id: 10, nodes: [1, 2] }, { type: "way", id: 11, nodes: [2, 3, 4] },
  { type: "relation", id: 100, members: [{ type: "way", ref: 10 }, { type: "way", ref: 11 }] },
] };
// Une super-relation (sentier en étapes) : la racine n'a que des sous-relations.
const SUPER = { elements: [{ type: "relation", id: 200, members: [{ type: "relation", ref: 201 }, { type: "relation", ref: 202 }] }] };
const ETAPE1 = { elements: [n(1, 5.6, 43.5), n(2, 5.61, 43.51), { type: "way", id: 21, nodes: [1, 2] }, { type: "relation", id: 201, members: [{ type: "way", ref: 21 }] }] };
const ETAPE2 = { elements: [n(2, 5.61, 43.51), n(3, 5.62, 43.52), { type: "way", id: 22, nodes: [2, 3] }, { type: "relation", id: 202, members: [{ type: "way", ref: 22 }] }] };
const OVERPASS_OK = { elements: [{ type: "way", geometry: [{ lat: 43.5, lon: 5.6 }, { lat: 43.51, lon: 5.61 }, { lat: 43.52, lon: 5.62 }] }] };

console.log("\nTRACÉ D'UN PARCOURS — deux sources, rien d'inventé\n");

(async () => {
  await test("API officielle seule (Overpass en panne, comme le 09/11/2026) : le tracé arrive", async () => {
    reseau(() => ({ status: 200, body: RELATION_SIMPLE }), { status: 502 });
    const c = await geometrieParcours("relation", "100");
    assert.deepEqual(c, [[5.6, 43.52], [5.601, 43.521], [5.602, 43.522], [5.603, 43.523]], "les deux chemins ne sont pas chaînés bout à bout");
  });

  await test("Overpass seule (API officielle en panne) : le tracé arrive aussi", async () => {
    reseau(() => ({ status: 503 }), { status: 200, body: OVERPASS_OK });
    const c = await geometrieParcours("relation", "100");
    assert.equal(c.length, 3);
  });

  await test("un serveur qui ne répond plus n'empêche pas l'autre de gagner", async () => {
    // Avant : un miroir muet faisait attendre 30 s avant d'essayer le suivant.
    reseau(() => ({ status: 200, body: RELATION_SIMPLE }), "jamais");
    const t0 = Date.now();
    const c = await geometrieParcours("relation", "100");
    assert.equal(c.length, 4);
    assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0} ms : on a attendu le serveur muet`);
  });

  await test("les deux sources en panne : une ERREUR, jamais un tracé vide ni inventé", async () => {
    reseau(() => ({ status: 502 }), { status: 502 });
    await assert.rejects(geometrieParcours("relation", "100"));
    // Une géométrie vide n'est pas un succès (sinon le cache la garderait 30 jours).
    reseau(() => ({ status: 200, body: { elements: [] } }), { status: 200, body: { elements: [] } });
    await assert.rejects(geometrieParcours("relation", "100"), "une géométrie vide passe pour un tracé");
  });

  await test("super-relation (sentier en étapes) : les sous-relations sont relues et chaînées", async () => {
    reseau((url) => ({ status: 200, body: url.includes("/201/") ? ETAPE1 : url.includes("/202/") ? ETAPE2 : SUPER }), { status: 502 });
    const c = await depuisApiOsm("relation", "200");
    assert.deepEqual(c, [[5.6, 43.5], [5.61, 43.51], [5.62, 43.52]], "les étapes ne sont pas relues ou pas chaînées");
  });

  await test("super-relation sur DEUX niveaux et 30 étapes : tout est relu, rien n'est tronqué", async () => {
    // Avant : un seul niveau et 25 sous-relations au plus — un tracé PARTIEL gagnait la course,
    // était montré comme « tracé réel » et gardé 30 jours en cache.
    const etapes = Array.from({ length: 30 }, (_, i) => 1000 + i);
    const corps = (url: string) => {
      const id = Number(url.match(/relation\/(\d+)\//)?.[1]);
      if (id === 300) return { elements: [{ type: "relation", id: 300, members: [{ type: "relation", ref: 301 }] }] };
      if (id === 301) return { elements: [{ type: "relation", id: 301, members: etapes.map((ref) => ({ type: "relation", ref })) }] };
      const k = id - 1000;
      return { elements: [n(k, 5 + k / 100, 43), n(k + 1, 5 + (k + 1) / 100, 43), { type: "way", id: 5000 + k, nodes: [k, k + 1] }, { type: "relation", id, members: [{ type: "way", ref: 5000 + k }] }] };
    };
    reseau((url) => ({ status: 200, body: corps(url) }), { status: 502 });
    const c = await depuisApiOsm("relation", "300");
    assert.equal(c.length, 31, `${c.length} points : des étapes manquent (30 tronçons bout à bout = 31 points)`);
  });

  await test("au-delà de la limite, l'API officielle RENONCE (Overpass répond) au lieu de rendre un morceau", async () => {
    const enorme = { elements: [{ type: "relation", id: 400, members: Array.from({ length: 400 }, (_, i) => ({ type: "relation", ref: 2000 + i })) }] };
    reseau(() => ({ status: 200, body: enorme }), { status: 200, body: OVERPASS_OK });
    await assert.rejects(depuisApiOsm("relation", "400"), "un tracé partiel est rendu au lieu d'un refus");
    assert.equal((await geometrieParcours("relation", "400")).length, 3, "Overpass ne prend pas le relais");
  });

  await test("un nœud manquant : tracé refusé, pas raccourci", async () => {
    const troue = { elements: [n(1, 5.6, 43.5), n(2, 5.61, 43.51), { type: "way", id: 10, nodes: [1, 2, 99] }, { type: "relation", id: 100, members: [{ type: "way", ref: 10 }] }] };
    reseau(() => ({ status: 200, body: troue }), { status: 502 });
    // La raison exacte : un plantage plus loin (lecture d'un point absent) ne vaut pas un refus voulu.
    await assert.rejects(depuisApiOsm("relation", "100"), /nœud manquant/);
  });

  await test("parcours retiré d'OpenStreetMap (404) : refus DÉFINITIF ; panne (502) : passagère", async () => {
    reseau(() => ({ status: 404 }), { status: 200, body: { elements: [] } });
    const e404 = await geometrieParcours("relation", "100").then(() => null, (e) => e);
    assert.ok(e404 && refusDefinitif(e404), "un parcours supprimé passe pour une panne passagère");
    reseau(() => ({ status: 502 }), { status: 502 });
    const e502 = await geometrieParcours("relation", "100").then(() => null, (e) => e);
    assert.ok(e502 && !refusDefinitif(e502), "une panne passe pour un refus définitif");
  });

  await test("la source qui perd est annulée dès que l'autre a gagné", async () => {
    let annulee = false;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("api.openstreetmap.org")) return new Response(JSON.stringify(RELATION_SIMPLE), { status: 200 });
      return new Promise((_, rej) => init?.signal?.addEventListener("abort", () => { annulee = true; rej(new Error("annulé")); }));
    }) as typeof fetch;
    await geometrieParcours("relation", "100");
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(annulee, "Overpass reste interrogé après la victoire de l'API officielle");
  });

  await test("Overpass interrompue (« remark » en 200) : le fragment ne gagne jamais", async () => {
    const fragment = { remark: "runtime error: Query timed out in \"recurse\" at line 1 after 25 seconds.", elements: [{ type: "way", geometry: [{ lat: 43.5, lon: 5.6 }, { lat: 43.51, lon: 5.61 }] }] };
    reseau(() => ({ status: 502 }), { status: 200, body: fragment });
    await assert.rejects(geometrieParcours("relation", "100"), "un tracé partiel d'Overpass passe pour le tracé complet");
  });

  await test("tracé troué : la chaîne principale, comme au catalogue ; un fragment est arrêté par le navigateur", async () => {
    // Deux tronçons d'environ 10 km séparés de 20 km : seul le premier est gardé (jamais de trait droit).
    const troue = { elements: [
      n(1, 5.0, 43.5), n(2, 5.124, 43.5), n(3, 5.372, 43.5), n(4, 5.496, 43.5),
      { type: "way", id: 10, nodes: [1, 2] }, { type: "way", id: 11, nodes: [3, 4] },
      { type: "relation", id: 100, members: [{ type: "way", ref: 10 }, { type: "way", ref: 11 }] },
    ] };
    reseau(() => ({ status: 200, body: troue }), { status: 502 });
    assert.equal((await geometrieParcours("relation", "100")).length, 2, "la chaîne principale n'est plus rendue");
    // Le navigateur compare à la distance AFFICHÉE : ~10 km gardés pour 20 annoncés = fragment.
    const nav = codeNu("src/components/parcours/ParcoursBrowser.tsx");
    assert.equal((nav.match(/if \(tracePartiel\((coordinates|coords), p\.distance_km\)\)/g) ?? []).length, 2, "la carte ou l'export GPX ne vérifie plus la longueur du tracé");
  });

  await test("le contrôle « tracé partiel », seuil par seuil (4 points, 400 m, 75 % de la distance affichée)", () => {
    // Une ligne droite d'est en ouest : n points régulièrement espacés sur `km` kilomètres.
    const ligne = (km: number, n = 10): [number, number][] => Array.from({ length: n }, (_, i) => [5 + (km / 80.6) * (i / (n - 1)), 43.5]);
    const dix = ligne(10);
    assert.ok(Math.abs(longueurKm(dix) - 10) < 0.2, `longueur de la ligne d'essai : ${longueurKm(dix)}`);
    assert.equal(tracePartiel(dix, 10), false, "un tracé conforme à la distance affichée est refusé");
    assert.equal(tracePartiel(dix, 10 / PART_MIN - 0.5), false, "juste au-dessus des 75 % : refusé à tort");
    assert.equal(tracePartiel(dix, 10 / PART_MIN + 0.5), true, "juste sous les 75 % : un fragment passe");
    assert.equal(tracePartiel(dix, 0), false, "sans distance affichée, la longueur seule ne doit pas refuser");
    assert.equal(tracePartiel(ligne(10, 3), 10), true, "moins de 4 points passe pour un tracé");
    assert.equal(tracePartiel(ligne(0.3), 0), true, "moins de 400 m passe pour un tracé");
    assert.equal(PART_MIN, 0.75);
  });

  await test("les causes d'Overpass (une par miroir) remontent à plat, statuts compris", async () => {
    reseau(() => ({ status: 429 }), { status: 403 });
    const e = await geometrieParcours("relation", "100").then(() => null, (x) => x);
    const statuts = causes(e).map((c) => (c instanceof ErreurSource ? `${c.source}:${c.status}` : String(c)));
    assert.ok(statuts.includes("api-osm:429"), `statuts : ${statuts.join(", ")}`);
    assert.ok(statuts.filter((x) => x === "overpass:403").length >= 2, `les miroirs d'Overpass sont perdus : ${statuts.join(", ")}`);
  });

  await test("les étapes d'un long sentier sont relues par lots de 10, jamais en rafale", async () => {
    const etapes = Array.from({ length: 40 }, (_, i) => 3000 + i);
    let enCours = 0, max = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("api.openstreetmap.org")) return new Response("{}", { status: 502 });
      enCours++; max = Math.max(max, enCours);
      await new Promise((r) => setTimeout(r, 5));
      enCours--;
      const id = Number(url.match(/relation\/(\d+)\//)?.[1]);
      const body = id === 500 ? { elements: [{ type: "relation", id: 500, members: etapes.map((ref) => ({ type: "relation", ref })) }] }
        : { elements: [n(id, 5 + (id - 3000) / 100, 43), n(id + 1, 5 + (id - 2999) / 100, 43), { type: "way", id: 9000 + id, nodes: [id, id + 1] }, { type: "relation", id, members: [{ type: "way", ref: 9000 + id }] }] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    const c = await depuisApiOsm("relation", "500");
    assert.equal(c.length, 41, `${c.length} points`);
    assert.ok(max <= 10, `${max} requêtes simultanées vers OpenStreetMap`);
  });

  await test("parcours supprimé d'OpenStreetMap : annoncé tout de suite, sans attendre un Overpass muet", async () => {
    reseau(() => ({ status: 410 }), "jamais");
    const t0 = Date.now();
    const e = await geometrieParcours("relation", "100").then(() => null, (x) => x);
    assert.ok(e && refusDefinitif(e), "le refus définitif est perdu");
    assert.ok(Date.now() - t0 < 2000, `${Date.now() - t0} ms : on a attendu Overpass pour annoncer un parcours supprimé`);
  });

  await test("une ÉTAPE supprimée d'un long sentier n'est pas le sentier supprimé", async () => {
    reseau((url) => (url.includes("/201/") ? { status: 404 } : { status: 200, body: url.includes("/202/") ? ETAPE2 : SUPER }), { status: 502 });
    const e = await geometrieParcours("relation", "200").then(() => null, (x) => x);
    assert.ok(e, "précondition : les deux sources échouent");
    assert.equal(refusDefinitif(e), false, "une étape supprimée fait annoncer tout le sentier comme supprimé");
  });

  await test("le même tracé quelle que soit la source et l'ordre d'arrivée des tronçons", async () => {
    // Deux morceaux de MÊME longueur séparés de 20 km : l'ordre décidait lequel était gardé.
    // Des coordonnées EXACTES en binaire (5,125 − 5 = 5,5 − 5,375) : une égalité parfaite, sinon le plus
    // long gagne quel que soit l'ordre et le test ne prouve rien (vu en l'éprouvant par mutation).
    const pts = { 1: [5.0, 43.5], 2: [5.125, 43.5], 3: [5.375, 43.5], 4: [5.5, 43.5] } as Record<number, [number, number]>;
    const ways = [{ id: 11, nodes: [3, 4] }, { id: 10, nodes: [1, 2] }];
    const api = (ordre: typeof ways) => ({ elements: [
      ...Object.entries(pts).map(([k, [lon, lat]]) => n(Number(k), lon, lat)),
      ...ordre.map((w) => ({ type: "way", ...w })),
      { type: "relation", id: 100, members: ordre.map((w) => ({ type: "way", ref: w.id })) },
    ] });
    const overpass = (ordre: typeof ways) => ({ elements: ordre.map((w) => ({ type: "way", id: w.id, geometry: w.nodes.map((k) => ({ lon: pts[k][0], lat: pts[k][1] })) })) });
    reseau(() => ({ status: 200, body: api(ways) }), { status: 502 });
    const a1 = await depuisApiOsm("relation", "100");
    reseau(() => ({ status: 200, body: api([...ways].reverse()) }), { status: 502 });
    const a2 = await depuisApiOsm("relation", "100");
    reseau(() => ({ status: 502 }), { status: 200, body: overpass(ways) });
    const o1 = await depuisOverpass("relation", "100");
    reseau(() => ({ status: 502 }), { status: 200, body: overpass([...ways].reverse()) });
    const o2 = await depuisOverpass("relation", "100");
    assert.equal(longueurKm(a1.slice(0, 2)), longueurKm([[5.375, 43.5], [5.5, 43.5]]), "précondition : les deux morceaux ont exactement la même longueur");
    assert.deepEqual(a2, a1, "l'API officielle rend un autre morceau selon l'ordre des tronçons");
    assert.deepEqual(o1, a1, "Overpass et l'API officielle ne gardent pas le même morceau");
    assert.deepEqual(o2, a1, "Overpass rend un autre morceau selon l'ordre des tronçons");
  });

  // ── Un morceau de parcours : l'autre source, puis jamais en cache ─────────────────────────
  // Deux chemins bout à bout d'environ 10 km chacun (0,124° de longitude à 43,5° N).
  const COMPLET = { elements: [
    n(1, 5.0, 43.5), n(2, 5.124, 43.5), n(3, 5.248, 43.5), n(4, 5.372, 43.5),
    { type: "way", id: 10, nodes: [1, 2] }, { type: "way", id: 11, nodes: [2, 3, 4] },
    { type: "relation", id: 100, members: [{ type: "way", ref: 10 }, { type: "way", ref: 11 }] },
  ] };
  const PTS: Record<number, [number, number]> = { 1: [5.0, 43.5], 2: [5.124, 43.5], 3: [5.248, 43.5], 4: [5.372, 43.5] };
  const geo = (ids: number[][]) => ids.map((w) => w.map((k) => ({ lon: PTS[k][0], lat: PTS[k][1] })));
  /** Overpass rapide qui ne rend qu'un morceau ; l'API officielle, plus lente, a le parcours entier. */
  function courseInegale(apiCorps: unknown, overpassWays: number[][], apiMs: number) {
    let appels = 0; // appels à l'API officielle (Overpass, lui, part vers chaque miroir)
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("api.openstreetmap.org")) appels++;
      const corps = url.includes("api.openstreetmap.org") ? apiCorps
        : { elements: geo(overpassWays).map((g, i) => ({ type: "way", id: 10 + i, geometry: g })) };
      const attente = url.includes("api.openstreetmap.org") ? apiMs : 0;
      await new Promise<void>((ok, ko) => {
        const t = setTimeout(ok, attente);
        init?.signal?.addEventListener("abort", () => { clearTimeout(t); ko(new Error("annulé")); });
      });
      return new Response(JSON.stringify(corps), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    return () => appels;
  }

  await test("la source rapide n'a qu'un MORCEAU : on attend l'autre et on garde le parcours entier", async () => {
    courseInegale(COMPLET, [[1, 2]], 150);
    // Précondition : la source rapide (Overpass) gagne bien avec son morceau.
    assert.ok(longueurKm(await geometrieParcours("relation", "100")) < 11, "précondition : la source rapide ne rend pas le morceau");
    const appels = courseInegale(COMPLET, [[1, 2]], 150);
    const v = await geometrieVerifiee("relation", "100", 30);
    assert.equal(v.partiel, false, "l'API officielle avait le parcours entier, il est déclaré incomplet");
    assert.equal(appels(), 1, `${appels()} appels à l'API officielle : la recherche a été relancée au lieu d'attendre la source déjà partie`);
    assert.ok(longueurKm(v.coords) > 29, `${longueurKm(v.coords).toFixed(1)} km gardés pour 30 : le morceau a gagné`);
  });

  await test("les deux sources n'ont qu'un morceau : il est dit PARTIEL (donc jamais mis en cache), le plus long gardé", async () => {
    const MOITIE = { elements: [COMPLET.elements[0], COMPLET.elements[1], COMPLET.elements[2], COMPLET.elements[4], COMPLET.elements[5], { type: "relation", id: 100, members: [{ type: "way", ref: 10 }, { type: "way", ref: 11 }] }] };
    courseInegale({ elements: MOITIE.elements.map((e) => e.type === "way" && e.id === 11 ? { ...e, nodes: [2, 3] } : e) }, [[1, 2]], 50);
    const v = await geometrieVerifiee("relation", "100", 30);
    assert.equal(v.partiel, true, "un morceau de 20 km pour 30 annoncés passe pour le parcours");
    assert.ok(longueurKm(v.coords) > 19, "le plus court des deux morceaux est gardé");
  });

  await test("un tracé conforme, ou sans distance connue : une seule recherche, aucune attente de plus", async () => {
    courseInegale(COMPLET, [[1, 2], [2, 3, 4]], 2000);
    const t0 = Date.now();
    const v = await geometrieVerifiee("relation", "100", 30);
    assert.equal(v.partiel, false);
    assert.ok(Date.now() - t0 < 1000, `${Date.now() - t0} ms : on a attendu l'autre source pour un tracé conforme`);
    const appels = courseInegale(COMPLET, [[1, 2]], 2000);
    const t1 = Date.now();
    const w = await geometrieVerifiee("relation", "100", 0);
    assert.equal(w.partiel, false, "sans distance du catalogue, le serveur ne peut pas juger (le navigateur le fait)");
    assert.ok(Date.now() - t1 < 1000 && appels() === 1, "sans distance connue, une seconde recherche a été lancée");
  });

  await test("l'autre source en PANNE n'est pas un parcours troué ; un fait du tracé, si", () => {
    for (const [e, attendu, quoi] of [
      [new ErreurSource("Overpass 429", 429, "overpass"), true, "429 (trop de requêtes)"],
      [new ErreurSource("Overpass 504", 504, "overpass"), true, "504"],
      [new ErreurSource("API OSM 500", 500, "api-osm"), true, "500"],
      [new ErreurSource("API OSM : TimeoutError", 0, "api-osm"), true, "délai dépassé"],
      [new ErreurSource("Overpass : TypeError", 0, "overpass"), true, "coupure réseau"],
      [new ErreurSource("Overpass : runtime error: Query timed out", 0, "overpass"), true, "Overpass interrompue (remark)"],
      [new AggregateError([new ErreurSource("Overpass 403", 403, "overpass"), new ErreurSource("Overpass 503", 503, "overpass")]), true, "un miroir en panne parmi d'autres"],
      [new ErreurSource("API OSM : nœud manquant", 0, "api-osm"), false, "nœud manquant"],
      [new ErreurSource("API OSM : plus de 300 relations", 0, "api-osm"), false, "trop de relations"],
      [new ErreurSource("Overpass : géométrie vide", 0, "overpass"), false, "géométrie vide"],
      [new ErreurSource("Overpass 403", 403, "overpass"), false, "403 (refus)"],
      [new ErreurSource("API OSM 404", 404, "api-osm"), false, "étape supprimée (404)"],
      [new AggregateError([new ErreurSource("Overpass 503", 503, "overpass"), new ErreurSource("Overpass : géométrie vide", 0, "overpass")]), false, "un miroir en panne, l'autre dit « géométrie vide » (le fait l'emporte)"],
      [new AggregateError([new ErreurSource("API OSM : nœud manquant", 0, "api-osm"), new ErreurSource("Overpass 429", 429, "overpass")]), false, "nœud manquant d'un côté, 429 de l'autre (le fait l'emporte)"],
      [new SyntaxError("Unexpected token <"), true, "page HTML illisible d'un Overpass surchargé"],
    ] as [unknown, boolean, string][]) assert.equal(echecPassager(e), attendu, `${quoi} : ${attendu ? "une panne prise pour un fait du tracé" : "un fait du tracé pris pour une panne"}`);
  });

  await test("un morceau dont l'autre source est en panne : l'échec est rendu, et reconnu passager", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.openstreetmap.org")) return new Response("{}", { status: 503 });
      return new Response(JSON.stringify({ elements: geo([[1, 2]]).map((g, i) => ({ type: "way", id: 10 + i, geometry: g })) }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const v = await geometrieVerifiee("relation", "100", 30);
    assert.equal(v.partiel, true);
    assert.ok(v.echecs.length > 0 && v.echecs.some(echecPassager), "la panne de l'API officielle (503) n'est pas rendue comme passagère");
  });

  await test("journal des tracés : plafond compté en LIGNES écrites, fenêtre d'une heure, rien en double", () => {
    const H = 60 * 60_000, J = 24 * H;
    const m = new MemoireJournal(3, H, J);
    assert.deepEqual(["a", "b", "c"].map((k) => m.incomplet(k, 0)), ["lister", "lister", "lister"]);
    // Un parcours déjà listé, redemandé : rien, et il ne mange pas la place des autres.
    for (let i = 1; i <= 5; i++) assert.equal(m.incomplet("a", i * 11 * 60_000), "rien", "un parcours déjà listé est réécrit ou consomme le plafond");
    assert.equal(m.incomplet("d", 1000), "synthese", "au-delà du plafond, pas de ligne de synthèse");
    assert.equal(m.incomplet("e", 2000), "rien", "la ligne de synthèse part plusieurs fois dans l'heure");
    // Une heure plus tard : la fenêtre repart (place pour de nouveaux parcours, synthèse redevenue possible).
    assert.equal(m.incomplet("f", H), "lister", "la fenêtre d'une heure ne se renouvelle pas (ou s'inverse)");
    assert.equal(m.incomplet("f", H + 1), "rien");
    assert.equal(m.incomplet("a", H + 2), "rien", "un parcours listé ce jour est relisté après une heure");
    assert.equal(m.incomplet("a", J), "lister", "un parcours toujours troué le lendemain n'est plus jamais listé");
    // Messages constants : une fois par fenêtre, garde posée dès le premier appel (avant tout await).
    assert.equal(m.uneFois("panne overpass:503", 0), true);
    assert.equal(m.uneFois("panne overpass:503", 1), false, "deux pannes simultanées écrivent deux lignes");
    assert.equal(m.uneFois("panne api-osm:429", 2), true, "une cause différente est masquée par la première");
    assert.equal(m.uneFois("panne overpass:503", H), true, "une panne qui dure n'est plus jamais redite");
  });

  await test("un catalogue illisible n'est ni pris pour vide, ni retenu", () => {
    const ici = process.cwd();
    process.chdir(os.tmpdir()); // pas de data/ ici : lecture impossible
    try {
      assert.equal(estDuCatalogue("relation", "6105302"), null, "un catalogue illisible passe pour un catalogue lu (vide)");
      assert.equal(distanceDuCatalogue("relation", "6105302"), null, "un catalogue illisible donne une distance 0 : le morceau repart en cache 30 jours sans contrôle");
    } finally { process.chdir(ici); }
    assert.equal(estDuCatalogue("relation", "6105302"), true, "l'échec de lecture est retenu : plus aucun parcours mort ne sera jamais signalé");
  });

  await test("la distance du catalogue est celle qu'affiche la carte", () => {
    assert.equal(distanceDuCatalogue("relation", "6105302"), 7.75, "« (Sentier marron) » : la distance du catalogue n'est pas lue");
    assert.equal(distanceDuCatalogue("relation", "123"), 0, "un parcours hors catalogue reçoit une distance");
  });

  await test("seuls les parcours du catalogue Pacevo peuvent être journalisés « supprimés »", () => {
    assert.equal(estDuCatalogue("relation", "6105302"), true, "« (Sentier marron) » n'est pas reconnu au catalogue");
    assert.equal(estDuCatalogue("relation", "123"), false, "un identifiant inventé passe pour un parcours du catalogue");
    assert.equal(estDuCatalogue("way", "6105302"), false, "le type n'est pas vérifié : un chemin passe pour la relation");
    const conf = codeNu("next.config.ts");
    assert.match(conf, /"\/api\/parcours\/geometry": \["\.\/data\/parcours_certifies\.min\.json\.gz"\]/, "le catalogue n'est plus embarqué dans la route du tracé : rien ne serait plus journalisé en production");
  });

  globalThis.fetch = vrai;

  await test("la route : connectée seulement, cache persistant, 503 sans rien mettre en cache", () => {
    const route = codeNu("src/app/api/parcours/geometry/route.ts");
    assert.match(route, /const denied = await denyIfAnonymous\(\);/, "la route s'ouvre aux anonymes (quotas d'OpenStreetMap)");
    // « v2 » depuis le chaînage dans un ordre fixe : avec « v1 », 30 jours de tracés chaînés selon l'ancien ordre.
    assert.match(route, /const geometrieEnCache = unstable_cache\(tracePourCache, \["parcours-geometrie-v3"\], \{ revalidate: 60 \* 60 \* 24 \* 30 \}\);/, "plus de cache persistant, ou cache resté sur une version qui gardait des morceaux de parcours");
    // Un MORCEAU de parcours : une exception (jamais gardée par unstable_cache), puis 422 sans CACHE.set.
    assert.match(route, /const v = await geometrieVerifiee\(type, id, distanceKm\);\s*if \(v\.partiel\) throw new TraceIncomplet\(/, "un morceau de parcours est de nouveau mis en cache 30 jours");
    // Catalogue illisible : pas de contrôle possible, donc PAS de cache persistant, et /admin le sait.
    assert.match(route, /const signaler = distance === null && MEMOIRE\.uneFois\("catalogue illisible \(tracés\)", Date\.now\(\)\);/, "le signalement d'un catalogue illisible n'est plus borné avant le premier await");
    // Plusieurs parcours en panne au même moment : une ligne par cause, garde synchrone avant l'écriture.
    assert.match(route, /if \(!MEMOIRE\.uneFois\(`panne \$\{cause\}`, Date\.now\(\)\)\) return;\s*await journaliserEchecUneFois\(null, \{\s*\.\.\.base, message: `Tracé de parcours indisponible/, "une panne sur plusieurs parcours à la fois écrit de nouveau une ligne par recherche");
    assert.match(route, /else if \(auCatalogue === null && MEMOIRE\.uneFois\("catalogue illisible \(supprimés\)", Date\.now\(\)\)\) await/, "le signalement « parcours supprimés non repérés » n'est plus borné");
    assert.match(route, /if \(signaler\) await journaliserEchecUneFois\(null, \{[\s\S]{0,120}message: "Catalogue des parcours illisible : tracés non vérifiés, cache coupé"/, "un catalogue illisible laisse de nouveau des morceaux non vérifiés sans rien dire");
    assert.match(route, /await \(distance === null \? tracePourCache\(type, id, 0\) : geometrieEnCache\(type, id, distance\)\);\s*return \{ coords, verifie: distance !== null \};/, "un catalogue illisible remet le tracé non vérifié dans le cache persistant");
    assert.match(route, /if \(!verifie\) return NextResponse\.json\(\{ coordinates: coords \}, \{ headers: \{ "Cache-Control": "no-store" \} \}\);\s*if \(CACHE\.size > 2000\) CACHE\.clear\(\);\s*CACHE\.set\(key, coords\);/, "un tracé non vérifié (catalogue illisible) est gardé dans la mémoire de l'instance ou par le navigateur");
    // Clics simultanés sur un même parcours : une seule recherche vers OpenStreetMap, UN seul journal.
    assert.match(route, /let enCours = EN_COURS\.get\(key\);\s*if \(!enCours\) \{[\s\S]{0,2000}EN_COURS\.set\(key, enCours\);\s*enCours\.finally\(\(\) => EN_COURS\.delete\(key\)\)/, "deux clics simultanés relancent deux recherches vers OpenStreetMap");
    assert.match(route, /\} catch \(e\) \{\s*if \(\(e as \{ partiel\?: unknown \}\)\?\.partiel === true\) \{[\s\S]{0,500}PARTIELS\.set\(key, \{ jusqua: Date\.now\(\) \+ \(transitoire \? PARTIEL_PASSAGER_MS : PARTIEL_MS\), transitoire \}\);\s*\}\s*await journaliserRecherche\(e, type, id\);\s*throw e;/, "la recherche partagée ne journalise plus son échec, ou une panne passagère bloque le parcours 10 min");
    // Morceau + autre source EN PANNE : « réessaie », jamais « parcours troué » (ni pour le coureur, ni dans /admin).
    assert.match(route, /if \(v\.partiel\) throw new TraceIncomplet\(`tracé incomplet : \$\{type\} \$\{id\}`, v\.echecs, v\.echecs\.some\(echecPassager\)\);/, "la panne de l'autre source n'est plus distinguée d'un parcours troué");
    assert.match(route, /if \(p\.transitoire\) e = new AggregateError\(p\.echecs, "autre source en panne"\);/, "une panne de l'autre source est journalisée comme un parcours troué");
    assert.match(route, /partiel: true, transitoire: \(e as TraceIncomplet\)\.transitoire === true \}, \{ status: 422 \}/, "le navigateur ne sait plus qu'il peut réessayer");
    assert.match(route, /partiel: true, transitoire: vuPartiel\.transitoire \}, \{ status: 422 \}/, "la réponse en mémoire perd l'indication de panne passagère");
    assert.match(route, /const PARTIEL_PASSAGER_MS = 60_000;/, "une panne passagère bloque de nouveau le parcours 10 minutes");
    // Plafond des lignes « Tracé incomplet » : /admin reste lisible si OSM se troue partout.
    assert.match(route, /const decision = MEMOIRE\.incomplet\(`\$\{type\}\/\$\{id\}`, Date\.now\(\)\);\s*if \(decision === "rien"\) return;\s*if \(decision === "synthese"\) \{\s*await journaliserEchecUneFois\(null, \{[\s\S]{0,80}message: `Tracés incomplets : plus de \$\{INCOMPLETS_MAX_HEURE\} parcours en une heure/, "le nombre de lignes « Tracé incomplet » n'est plus plafonné");
    assert.match(route, /const MEMOIRE = new MemoireJournal\(INCOMPLETS_MAX_HEURE\);/, "le plafond du journal n'est plus celui annoncé");
    assert.match(route, /const INCOMPLETS_MAX_HEURE = 20;/, "plafond des lignes « Tracé incomplet » changé sans le dire");
    const reponses = route.slice(route.indexOf("const { coords, verifie } = await enCours;"));
    assert.ok(reponses.length > 50 && !/journaliser/.test(reponses), "chaque requête qui attend la recherche journalise de nouveau : N requêtes simultanées, N lignes");
    assert.match(route, /await journaliserEchecUneFois\(null, \{\s*\.\.\.base, message: `Tracé incomplet sur OpenStreetMap : \$\{type\} \$\{id\}`,\s*meta: \{ type, id, autreSource: \[\.\.\.new Set\(p\.echecs/, "un tracé incomplet n'est plus listé dans /admin, ou sans la cause de l'échec de l'autre source");
    assert.match(route, /if \(\(e as \{ partiel\?: unknown \}\)\?\.partiel === true\) \{\s*return NextResponse\.json\(\{ error: "Tracé incomplet sur OpenStreetMap\.", partiel: true, transitoire:/, "un tracé incomplet n'est plus dit au navigateur (422)");
    assert.match(route, /const vuPartiel = PARTIELS\.get\(key\);\s*if \(vuPartiel && Date\.now\(\) < vuPartiel\.jusqua\) return/, "chaque clic sur un parcours incomplet réinterroge de nouveau OpenStreetMap");
    const navi = codeNu("src/components/parcours/ParcoursBrowser.tsx");
    assert.equal((navi.match(/if \(res\?\.status === 422\) \{ toast\.error\(L\[\(await res\.json\(\)\.catch\(\(\) => \(\{\}\)\)\)\.transitoire \? "t\.traceIndispo" : "t\.traceIncomplete"\]/g) ?? []).length, 2, "la carte ou l'export GPX confond un tracé incomplet (422), une panne passagère et une panne");
    // Un parcours supprimé d'OSM est listé dans /admin (pour le retirer du catalogue).
    assert.match(route, /if \(refusDefinitif\(e\)\) \{[\s\S]{0,400}const auCatalogue = estDuCatalogue\(type, id\);\s*if \(auCatalogue\) await journaliserEchecUneFois\(null, \{[\s\S]{0,200}message: `Parcours supprimé d'OpenStreetMap : \$\{type\} \$\{id\}`/,
      "un parcours mort n'est plus listé dans /admin, ou n'importe quel identifiant inventé peut remplir error_logs");
    assert.match(route, /else if \(auCatalogue === null && MEMOIRE\.uneFois\("[^"]*", Date\.now\(\)\)\) await journaliserEchecUneFois\(null, \{[\s\S]{0,200}message: "Catalogue des parcours illisible/,
      "un catalogue illisible fait taire la liste des parcours morts sans laisser de trace");
    assert.match(route, /: c instanceof SyntaxError \? "réponse illisible"/, "une page HTML illisible remet un extrait variable dans le message du journal");
    // Une erreur sans statut HTTP garde son libellé : « délai » et « tracé troué » ne se confondent plus.
    assert.match(route, /c\.status \? `\$\{c\.source\}:\$\{c\.status\}` : `\$\{c\.source\}:\$\{c\.message/, "toutes les erreurs sans réponse HTTP redeviennent « api-osm:0 » dans le journal");
    assert.match(route, /const \{ coords, verifie \} = await enCours;/, "la route n'attend plus la recherche partagée");
    assert.match(route, /status: 503, headers: \{ "Retry-After": "60" \}/, "un échec n'est plus dit comme tel");
    const lib = codeNu("src/lib/parcours/geometrie.ts");
    assert.match(lib, /const sources = \[valable\(api\), valable\(depuisOverpass\(type, id, fin\.signal\)\)\];\s*const premier = await Promise\.any\(sources\);/, "les deux sources ne partent plus en même temps");
    // Un morceau : on attend l'AUTRE source déjà partie, sans relancer de recherche (quotas d'OSM).
    assert.match(lib, /const r = await Promise\.allSettled\(sources\);/, "un morceau relance une recherche au lieu d'attendre l'autre source");
    assert.match(route, /message: `Tracé de parcours indisponible : \$\{cause\}`/, "le journal redevient une seule ligne par jour, quelle que soit la cause");
    assert.match(route, /return NextResponse\.json\(\{ error: "Ce parcours n'a plus de tracé sur OpenStreetMap\.", definitif: true \}, \{ status: 404 \}\);/, "un parcours retiré d'OpenStreetMap redevient « réessaie dans quelques minutes »");
    assert.match(route, /await journaliserEchecUneFois\(null, \{\s*source: "parcours-geometrie"/, "une panne durable d'OpenStreetMap n'arrive plus à /admin");
    assert.match(route, /const statuts = causes\(e\)\.map\(/, "les statuts d'Overpass sont de nouveau perdus dans le journal");
    assert.match(route, /export const maxDuration = 30;/, "sans durée maximale, Vercel coupe la fonction avant le 503 et le journal");
    assert.match(lib, /const butoir = setTimeout\(\(\) => fin\.abort\(\), DUREE_MAX_MS\);/, "la recherche n'a plus de durée totale bornée");
    assert.match(lib, /return Promise\.any\(ENDPOINTS\.map\(/, "les miroirs d'Overpass sont de nouveau essayés l'un après l'autre");
  });

  await test("le navigateur n'invente plus de tracé et ne tourne plus sans fin", () => {
    assert.ok(!existsSync("src/lib/parcoursTrace.ts"), "le générateur de tracés inventés est revenu");
    const nav = codeNu("src/components/parcours/ParcoursBrowser.tsx");
    assert.doesNotMatch(nav, /generateTrace/, "un tracé fabriqué peut de nouveau s'afficher sous le nom d'un vrai parcours");
    // Chargement sur la carte ET export GPX : les deux disent la panne comme telle.
    assert.equal((nav.match(/toast\.error\(L\["t\.traceIndispo"\], \{ id: tid \}\);/g) ?? []).length, 2, "l'absence de tracé n'est plus dite partout");
    const appels = nav.match(/fetch\(`\/api\/parcours\/geometry[^)]*\)/g) ?? [];
    assert.ok(appels.length >= 2, `${appels.length} appel(s) de la route trouvés`);
    for (const a of appels) assert.match(a, /signal: AbortSignal\.timeout\(25_000\)/, `appel sans limite de temps : ${a}`);
    // Chaque échec dit SA cause : session expirée, parcours retiré, panne.
    assert.equal((nav.match(/if \(res\?\.status === 401\) \{ toast\.error\(L\["t\.sessionExpiree"\], \{ id: tid \}\); return; \}/g) ?? []).length, 2, "une session expirée est de nouveau prise pour une panne d'OpenStreetMap");
    assert.match(nav, /if \(res\?\.status === 404\) \{ toast\.error\(L\["t\.gpxNa"\], \{ id: tid \}\); return; \}/, "un parcours retiré est de nouveau annoncé « réessaie plus tard »");
    // « Réessaie dans quelques minutes » pour une panne seulement ; un 400 ou un 500 a son message.
    assert.match(nav, /if \(res && !res\.ok && res\.status !== 503\) \{ toast\.error\(L\["t\.traceErr"\], \{ id: tid \}\); return; \}/, "une erreur non passagère est annoncée « réessaie dans quelques minutes »");
    assert.match(nav, /if \(res && !res\.ok && res\.status !== 503 && res\.status !== 404\) \{ toast\.error\(L\["t\.gpxFail"\], \{ id: tid \}\); return; \}/, "export GPX : une erreur non passagère est annoncée comme une panne");
  });

  resume = true;
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
})();
