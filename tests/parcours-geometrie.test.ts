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
import { geometrieParcours, depuisApiOsm, refusDefinitif, causes, ErreurSource } from "../src/lib/parcours/geometrie";

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
    assert.match(nav, /return coords\.length < 4 \|\| km < 0\.4 \|\| \(distanceAnnonceeKm > 0 && km < distanceAnnonceeKm \* 0\.75\);/, "un morceau de parcours passe pour le tracé complet");
    assert.equal((nav.match(/if \(tracePartiel\((coordinates|coords), p\.distance_km\)\)/g) ?? []).length, 2, "la carte ou l'export GPX ne vérifie plus la longueur du tracé");
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

  globalThis.fetch = vrai;

  await test("la route : connectée seulement, cache persistant, 503 sans rien mettre en cache", () => {
    const route = codeNu("src/app/api/parcours/geometry/route.ts");
    assert.match(route, /const denied = await denyIfAnonymous\(\);/, "la route s'ouvre aux anonymes (quotas d'OpenStreetMap)");
    assert.match(route, /const geometrieEnCache = unstable_cache\(geometrieParcours, \["parcours-geometrie-v1"\], \{ revalidate: 60 \* 60 \* 24 \* 30 \}\);/, "plus de cache persistant : chaque redémarrage reperd les tracés");
    assert.match(route, /const coords = await geometrieEnCache\(type, id\);/, "la route n'interroge plus le cache persistant");
    assert.match(route, /status: 503, headers: \{ "Retry-After": "60" \}/, "un échec n'est plus dit comme tel");
    const lib = codeNu("src/lib/parcours/geometrie.ts");
    assert.match(lib, /return await Promise\.any\(\[valable\(depuisApiOsm\(type, id, fin\.signal\)\), valable\(depuisOverpass\(type, id, fin\.signal\)\)\]\);/, "les deux sources ne partent plus en même temps");
    assert.match(route, /if \(refusDefinitif\(e\)\) return NextResponse\.json\(\{[^}]*definitif: true \}, \{ status: 404 \}\);/, "un parcours retiré d'OpenStreetMap redevient « réessaie dans quelques minutes »");
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
  });

  resume = true;
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
})();
