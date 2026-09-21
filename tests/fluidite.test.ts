/**
 * FLUIDITÉ — ce que le navigateur charge, et ce qu'il ne doit PAS charger (22/09/2026).
 *
 * Mesuré sur la version de production, à la largeur d'un téléphone, avant le chantier :
 * l'accueil du tableau de bord tirait 1 700 kB de JavaScript (non compressé) —
 * recharts (≈ 500 kB) pour deux petits dessins, le dictionnaire des cinq langues
 * (183 kB) importé par le provider ET par l'écran d'erreur racine, le client Supabase
 * (≈ 220 kB) pour lire soixante notifications et se déconnecter. Après : ≈ 900 kB.
 *
 * Ce fichier tient les garde-fous qui empêchent ces kilo-octets de revenir :
 *  1. Un GRAPHE D'IMPORTS STATIQUES depuis les entrées du tableau de bord : à partir
 *     d'un composant client (« use client »), tout ce qui est importé statiquement finit
 *     dans le navigateur. Aucun de ces modules ne doit être le dictionnaire complet,
 *     recharts, ou le client Supabase. Un `import()` paresseux ne compte pas.
 *  2. Le provider reçoit le dictionnaire en prop ; global-error garde ses trois phrases
 *     ALIGNÉES sur le dictionnaire.
 *  3. Le routeur garde les pages 30 s (allers-retours d'onglets instantanés) et la barre
 *     précharge ses quatre pages ; les barres fixes n'ont pas de flou d'arrière-plan sur
 *     téléphone (recomposition à chaque image pendant le défilement).
 *
 *   npx tsx tests/fluidite.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { T } from "../src/lib/i18n/translations";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

// ── Le graphe d'imports statiques ────────────────────────────────────────────
const EXT = [".tsx", ".ts", "/index.tsx", "/index.ts"];
function resoudre(depuis: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(depuis), spec);
  else return null; // un paquet npm : on le garde par son nom, pas par un fichier
  for (const e of ["", ...EXT]) { const p = base + e; if (existsSync(p) && !p.endsWith("/")) { try { if (readFileSync(p).length >= 0) return p; } catch { /* dossier */ } } }
  return null;
}
/** Les spécificateurs importés STATIQUEMENT (import … from, export … from) — pas `import()`. */
function importsStatiques(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?\sfrom\s+["']([^"']+)["']/gm)) out.push(m[1]);
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) out.push(m[1]);
  return out;
}
// `import type { X } from` ne compte pas : on retire ces lignes avant le balayage.
const sansImportsDeTypes = (s: string) => s.replace(/^\s*import\s+type\s[^;]*;?$/gm, "");
const _codeNu = codeNu;
function codeNuSansTypes(p: string) { return sansImportsDeTypes(_codeNu(p)); }

console.log("\n=== FLUIDITÉ — ce que le navigateur charge ===\n");

const ENTREES_ACCUEIL = ["src/app/layout.tsx", "src/app/dashboard/layout.tsx", "src/app/dashboard/page.tsx", "src/app/global-error.tsx"];

test("l'accueil du tableau de bord n'embarque ni le dictionnaire complet, ni recharts, ni le client Supabase", () => {
  // On refait le parcours avec les imports de types retirés.
  const vus = new Set<string>(); const fichiers = new Set<string>(); const paquets = new Map<string, string>();
  const marche = (f: string, client: boolean) => {
    const cle = `${f}|${client}`; if (vus.has(cle)) return; vus.add(cle);
    const src = codeNuSansTypes(f);
    const estClient = client || /^\s*["']use client["']/m.test(src);
    if (estClient) fichiers.add(f);
    for (const spec of importsStatiques(src)) {
      const r = resoudre(f, spec);
      if (r) marche(r, estClient);
      else if (estClient && !spec.startsWith("node:")) { const nom = spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/"); if (!paquets.has(nom)) paquets.set(nom, f); }
    }
  };
  for (const e of ENTREES_ACCUEIL) marche(e, false);
  assert.ok(fichiers.size > 20, `graphe trop petit (${fichiers.size} fichiers client) : le parcours ne suit plus les imports`);
  const dico = [...fichiers].filter((f) => f.endsWith("src/lib/i18n/translations.ts"));
  assert.deepEqual(dico, [], "le dictionnaire des cinq langues (183 kB) est revenu dans le JavaScript de l'accueil");
  const sbClient = [...fichiers].filter((f) => f.endsWith("src/lib/supabase/client.ts"));
  assert.deepEqual(sbClient, [], "le client Supabase (≈ 220 kB) est revenu dans le JavaScript de l'accueil");
  assert.ok(!paquets.has("recharts"), `recharts (≈ 500 kB) est revenu sur l'accueil, importé par ${paquets.get("recharts")}`);
  assert.ok(!paquets.has("maplibre-gl") && !paquets.has("leaflet"), "une bibliothèque de cartes est chargée sur l'accueil, qui n'a pas de carte");
});

test("le dictionnaire arrive en prop du serveur ; le provider ne l'importe que paresseusement", () => {
  const prov = codeNu("src/lib/i18n/LanguageProvider.tsx");
  assert.ok(!/from\s+["']\.\/translations["']/.test(prov), "le provider importe le dictionnaire statiquement");
  assert.match(prov, /import\("\.\/translations"\)/, "le changement de langue ne charge plus les autres langues");
  assert.match(prov, /dict: Dict/, "le provider ne reçoit plus le dictionnaire en prop");
  for (const layout of ["src/app/layout.tsx", "src/app/dashboard/layout.tsx"]) {
    assert.match(codeNu(layout), /<LanguageProvider[^>]*dict=\{T\[/, `${layout} ne passe plus le dictionnaire de la langue courante`);
  }
  // La barre d'onglets (client) ne rend plus l'avertissement médical (serveur, dictionnaire).
  assert.ok(!/MedicalDisclaimer/.test(codeNu("src/components/layout/MobileTabBar.tsx")), "la barre d'onglets importe l'avertissement médical, donc le dictionnaire");
  assert.match(codeNu("src/app/dashboard/layout.tsx"), /avertissement=\{<MedicalDisclaimer lang=\{langue\} \/>\}/, "le layout ne passe plus l'avertissement en nœud");
});

test("global-error garde ses trois phrases, alignées sur le dictionnaire", () => {
  const src = readFileSync("src/app/global-error.tsx", "utf8");
  assert.ok(!/from\s+["']@\/lib\/i18n\/translations["']/.test(src), "global-error importe le dictionnaire complet (chargé avec chaque page)");
  for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
    const m = src.match(new RegExp(`\\n\\s*${lg}: \\{ title: "([^"]+)", desc: "([^"]+)", retry: "([^"]+)" \\}`));
    assert.ok(m, `global-error : phrases ${lg} introuvables`);
    assert.equal(m![1], T[lg]["err.title"], `${lg} err.title diverge du dictionnaire`);
    assert.equal(m![2], T[lg]["err.desc"], `${lg} err.desc diverge du dictionnaire`);
    assert.equal(m![3], T[lg]["err.retry"], `${lg} err.retry diverge du dictionnaire`);
  }
});

test("les deux graphiques de l'accueil sont en SVG nu, et recharts n'y est plus", () => {
  const bento = codeNu("src/components/dashboard/BentoDashboard.tsx");
  assert.ok(!/from "recharts"/.test(bento), "recharts est revenu sur l'accueil");
  assert.match(bento, /<MiniAire points=/, "la courbe de VFC n'est plus dessinée");
  assert.match(bento, /<MiniBarres barres=/, "les barres de la semaine ne sont plus dessinées");
  const mini = codeNu("src/components/dashboard/MiniGraphes.tsx");
  assert.ok(!/recharts/.test(mini));
  assert.match(mini, /<title>/, "les points et barres n'ont plus d'info-bulle native");
});

test("l'entête lit ses notifications par une route ; Supabase ne se charge qu'au clic de déconnexion ou de langue", () => {
  const top = codeNu("src/components/layout/TopBar.tsx");
  assert.ok(!/@\/lib\/supabase\/client/.test(top), "TopBar importe le client Supabase");
  assert.match(top, /fetch\("\/api\/notifications"\)/, "TopBar ne lit plus /api/notifications");
  assert.match(top, /if \(!r\.ok\) setNotifs\(avant\)/, "« tout lu » refusé ne remet plus la pastille");
  const route = codeNu("src/app/api/notifications/route.ts");
  assert.match(route, /\.in\("type", \[\.\.\.TYPES_NOTIFIES\]\)/, "la route ne filtre plus par la liste blanche");
  assert.match(route, /if \(error\) return NextResponse\.json\(\{ error: "Mise à jour impossible" \}, \{ status: 500 \}\)/);
  const deco = codeNu("src/lib/auth/deconnexion.ts");
  assert.ok(!/^\s*import .*@\/lib\/supabase\/client/m.test(deco) && /await import\("@\/lib\/supabase\/client"\)/.test(deco), "la déconnexion importe Supabase statiquement");
  const prov = codeNu("src/lib/i18n/LanguageProvider.tsx");
  assert.ok(!/^\s*import .*@\/lib\/supabase\/client/m.test(prov) && /import\("@\/lib\/supabase\/client"\)/.test(prov), "le provider importe Supabase statiquement");
});

test("allers-retours d'onglets : pages gardées 30 s, barre préchargée, pas de flou sur les barres fixes du téléphone", () => {
  assert.match(codeNu("next.config.ts"), /staleTimes: \{ dynamic: 30, static: 180 \}/, "le routeur redemande chaque page au serveur à chaque retour");
  const barre = codeNu("src/components/layout/MobileTabBar.tsx");
  assert.match(barre, /prefetch=\{true\}/, "les onglets ne préchargent plus leur page entière");
  const nav = barre.slice(barre.indexOf("<nav"), barre.indexOf("</nav>"));
  assert.ok(!/backdrop-blur/.test(nav), "la barre d'onglets a retrouvé un flou d'arrière-plan (coût à chaque image de défilement sur iPhone)");
  const top = codeNu("src/components/layout/TopBar.tsx");
  const header = top.slice(top.indexOf("<header"), top.indexOf(">", top.indexOf("<header")));
  assert.ok(!/(^|\s)backdrop-blur/.test(header.replace(/md:backdrop-blur-sm/g, "")), "l'entête a un flou d'arrière-plan sans préfixe md:");
});

test("la fonction serveur n'embarque que le catalogue compacté (1 Mo), pas les 36 Mo du crawl", () => {
  const cfg = codeNu("next.config.ts");
  for (const f of ["./data/dataset.json", "./data/dataset_france.json", "./data/parcours_certifies.json"]) {
    assert.ok(cfg.includes(`"${f}"`), `${f} n'est plus exclu du traçage : il repart dans la fonction serveur (démarrage à froid de plusieurs secondes)`);
  }
  assert.ok(cfg.includes('"/api/parcours": ["./data/parcours_certifies.min.json.gz"]'), "le catalogue compacté n'est plus inclus explicitement");
  const route = codeNu("src/app/api/parcours/route.ts");
  const i1 = route.indexOf('"parcours_certifies.min.json.gz"'), i2 = route.indexOf('"parcours_certifies.json"');
  assert.ok(i1 > 0 && i2 > i1, "le .gz n'est pas lu en premier");
  assert.match(route, /gunzipSync\(/, "la route ne sait plus lire le .gz");
  // Le compacteur garde TOUS les champs que `mapCertified` lit — sinon la production
  // servirait des parcours amputés sans qu'aucune erreur ne le dise.
  const lus = new Set([...route.slice(route.indexOf("function mapCertified"), route.indexOf("function load")).matchAll(/\bp\.([a-z_]+)/g)].map((m) => m[1]));
  const script = readFileSync("scripts/parcours-compacter.ts", "utf8");
  const gardes = new Set([...script.slice(script.indexOf("const CHAMPS"), script.indexOf("] as const")).matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
  const manquants = [...lus].filter((c) => !gardes.has(c));
  assert.deepEqual(manquants, [], `champs lus par mapCertified mais absents du compacteur : ${manquants.join(", ")}`);
  // Et le fichier compacté existe, avec le même nombre de parcours que la source.
  assert.ok(existsSync("data/parcours_certifies.min.json.gz"), "data/parcours_certifies.min.json.gz manque : lancer scripts/parcours-compacter.ts");
  const slim = JSON.parse(gunzipSync(readFileSync("data/parcours_certifies.min.json.gz")).toString("utf8")) as Record<string, unknown>[];
  const brut = JSON.parse(readFileSync("data/parcours_certifies.json", "utf8")) as Record<string, unknown>[];
  assert.equal(slim.length, brut.length, "le catalogue compacté n'a pas le même nombre de parcours que la source (le recompacter)");
  assert.equal(slim[0].osm_id, brut[0].osm_id); assert.equal(slim[slim.length - 1].osm_id, brut[brut.length - 1].osm_id);
  assert.ok(slim.every((p) => !("profil" in p)), "le profil altimétrique (12 Mo, jamais servi) est dans le catalogue compacté");
  assert.ok(slim.every((p) => p.arrivee !== "None"), "« None » (le None de Python) est encore une arrivée");
  // Et la route n'affiche plus « → None ».
  assert.match(route, /v && v !== "None"/, "« Départ → None » est de retour dans les descriptions");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
