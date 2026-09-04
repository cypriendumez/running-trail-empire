/**
 * CE QUI PART DANS LE NAVIGATEUR — la frontière que seul l'artefact révèle.
 *
 * Un composant « use client » embarque TOUT son arbre d'imports. Une lecture
 * d'environnement placée dans un module de cet arbre s'exécute donc côté navigateur,
 * où seules les variables `NEXT_PUBLIC_*` existent : la valeur y est `undefined`,
 * silencieusement.
 *
 * ⚠️ CONSTATÉ, PAS REDOUTÉ (04/09/2026). `EDITEUR.statut` appelait `statutEditeur()` au
 * chargement du module ; `ProfileSettings.tsx` (client) importait cette fiche pour
 * l'adresse de contact ; l'appel s'est retrouvé dans `.next/static/chunks/`. Le jour où
 * `EDITEUR_STATUT` serait posée sur l'hébergement, la mention légale aurait affiché le
 * vrai statut au premier rendu puis « [À COMPLÉTER] » après hydratation. Le code portait
 * pourtant un commentaire affirmant « vérifié : aucun composant use client ne les
 * importe » — un commentaire n'est pas une preuve.
 *
 * ⚠️ ET LA FORME DE L'ACCÈS TROMPE. Le motif réel était `env.EDITEUR_STATUT` avec
 * `env = process.env` en paramètre par défaut : la chaîne `process.env.EDITEUR_STATUT`
 * n'apparaît NULLE PART. Un premier jet de ce test la cherchait et rendait « 0 violation »
 * sur le code fautif. On juge donc les PROPRIÉTÉS lues dans le module.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const RACINE = resolve("src");
const rel = (f: string) => f.replace(resolve(".") + "/", "");

function tousLesFichiers(): string[] {
  const out: string[] = [];
  (function marche(d: string) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) marche(p);
      else if (/\.(ts|tsx)$/.test(p)) out.push(resolve(p));
    }
  })(RACINE);
  return out;
}

/** Sans commentaires : une explication qui cite `process.env` n'est pas un accès. */
const codeNu = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "")
   .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

function resoudre(spec: string, depuis: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(RACINE, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(depuis), spec);
  else return null; // paquet npm : hors du périmètre de ce test
  for (const c of [base + ".ts", base + ".tsx", join(base, "index.ts"), join(base, "index.tsx"), base])
    if (existsSync(c) && statSync(c).isFile()) return resolve(c);
  return null;
}

function importsDe(f: string): string[] {
  const src = codeNu(readFileSync(f, "utf8"));
  const specs: string[] = [];
  // `import type` est effacé à la compilation : il n'atteint jamais le navigateur.
  for (const m of src.matchAll(/(?:^|\n)\s*import\s+(type\s+)?([^;]*?)from\s*["']([^"']+)["']/g))
    if (!m[1] && !/^\s*\{\s*type\s/.test(m[2])) specs.push(m[3]);
  for (const m of src.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)) specs.push(m[1]);
  for (const m of src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1]);
  return specs.map((s) => resoudre(s, f)).filter((x): x is string => !!x);
}

const estClient = (f: string) =>
  /^\s*["']use client["']/.test(readFileSync(f, "utf8").split("\n").slice(0, 3).join("\n"));

/** Tout ce qu'un composant client entraîne avec lui, transitivement. */
function atteignablesDepuisLeNavigateur(fichiers: string[]): Set<string> {
  const vus = new Set<string>(); const file: string[] = [];
  for (const f of fichiers) if (estClient(f)) { vus.add(f); file.push(f); }
  while (file.length) {
    const f = file.shift()!;
    for (const d of importsDe(f)) if (!vus.has(d)) { vus.add(d); file.push(d); }
  }
  return vus;
}

const PUBLIQUE = (nom: string) => nom.startsWith("NEXT_PUBLIC_") || nom === "NODE_ENV";

/**
 * Les variables d'environnement qu'un module lit RÉELLEMENT — quelle que soit la forme.
 * Un module qui ne mentionne pas `process.env` ne lit rien : ses propriétés en
 * majuscules sont des constantes ordinaires.
 */
function variablesLues(f: string): string[] {
  const src = codeNu(readFileSync(f, "utf8"));
  if (!/process\s*\.\s*env/.test(src)) return [];
  const noms = new Set<string>();
  for (const m of src.matchAll(/\.\s*([A-Z][A-Z0-9_]{2,})\b/g)) noms.add(m[1]);
  for (const m of src.matchAll(/\[\s*["']([A-Z][A-Z0-9_]{2,})["']\s*\]/g)) noms.add(m[1]);
  return [...noms].filter((n) => !PUBLIQUE(n));
}

const FICHIERS = tousLesFichiers();
const ATTEIGNABLES = atteignablesDepuisLeNavigateur(FICHIERS);

test("aucun module atteignable par le navigateur ne lit de variable non publique", () => {
  const coupables: string[] = [];
  for (const f of ATTEIGNABLES) {
    const v = variablesLues(f);
    if (v.length) coupables.push(`${rel(f)} → ${v.join(", ")}`);
  }
  assert.deepEqual(coupables, [],
    `ces modules partent dans le navigateur ET y lisent une variable absente du navigateur :\n    ${coupables.join("\n    ")}`);
});

test("le statut juridique reste hors de portée du navigateur", () => {
  // Ancrage nommé sur le cas réellement constaté, pour que sa régression soit dite et
  // non noyée dans un balayage.
  const cible = resolve("src/lib/brand/statutEditeur.ts");
  assert.ok(existsSync(cible), "src/lib/brand/statutEditeur.ts a disparu");
  assert.ok(!ATTEIGNABLES.has(cible),
    "statutEditeur.ts est redevenu atteignable depuis un composant client : la mention légale se videra à l'hydratation");
  const fiche = readFileSync("src/lib/brand/editeur.ts", "utf8");
  assert.ok(!/statut\s*:/.test(codeNu(fiche)),
    "le statut est revenu dans EDITEUR : il serait de nouveau évalué au chargement du module, donc dans le navigateur");
});

test("le balayage porte vraiment sur quelque chose", () => {
  // ⚠️ UN TEST QUI N'EXAMINE RIEN PASSE TOUJOURS. Si la résolution des imports cassait,
  // l'ensemble atteignable se réduirait aux seuls composants clients et le premier test
  // deviendrait vert par vacuité.
  const clients = FICHIERS.filter(estClient).length;
  assert.ok(clients >= 50, `seulement ${clients} composants « use client » trouvés`);
  assert.ok(ATTEIGNABLES.size > clients + 40,
    `${ATTEIGNABLES.size} modules atteignables pour ${clients} composants : la résolution des imports ne suit plus`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
