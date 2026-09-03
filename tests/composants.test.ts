/**
 * FRONTIÈRE SERVEUR / CLIENT — un défaut qui casse la page entière.
 *
 * Constaté en production le 03/09/2026 : `/dashboard/segments` renvoyait « An error
 * occurred in the Server Components render », message masqué en production.
 * Reproduit en local : « Attempted to call useT() from the server ». `SegmentList`
 * appelait `useT()` sans porter « use client ». Le même défaut dormait dans
 * `SessionSegments`, affiché par /dashboard/activite.
 *
 * ⚠️ CE DÉFAUT NE SE VOIT NI À LA COMPILATION NI DANS LA SUITE DE TESTS : `tsc` passe,
 * le build passe, et la page ne tombe qu'à l'exécution — en production, avec un message
 * volontairement muet.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Le source sans commentaires ni chaînes : un crochet cité n'est pas un crochet appelé. */
function codeNu(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n")
    .replace(/`[^`]*`/g, "``").replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
}

test("tout composant qui appelle un crochet React porte « use client »", () => {
  // ⚠️ ON VISE L'APPEL, PAS L'IMPORT NI LE COMMENTAIRE. Une page serveur a le droit de
  // mentionner `useT` dans une explication — c'est l'invoquer qui casse le rendu.
  const CROCHETS = /\b(useT|useState|useEffect|useRef|useMemo|useCallback|useContext|useReducer|useLayoutEffect|useRouter|useSearchParams|usePathname)\s*\(/;
  const coupables: string[] = [];
  for (const f of [...fichiers("src/components"), ...fichiers("src/app")]) {
    const src = readFileSync(f, "utf8");
    if (/^\s*["']use client["']/.test(src.split("\n").slice(0, 3).join("\n"))) continue;
    if (CROCHETS.test(codeNu(src))) coupables.push(f);
  }
  assert.deepEqual(coupables, [],
    `ces composants appellent un crochet client sans « use client » — la page tombera à l'exécution :\n    ${coupables.join("\n    ")}`);
});

test("les deux composants corrigés portent bien la directive", () => {
  // Ancrage explicite sur les deux cas RÉELLEMENT constatés, pour que leur régression
  // soit nommée et non noyée dans un balayage.
  for (const f of ["src/components/segments/SegmentList.tsx", "src/components/activity/SessionSegments.tsx"]) {
    const debut = readFileSync(f, "utf8").split("\n").slice(0, 3).join("\n");
    assert.ok(/^\s*["']use client["']/.test(debut), `${f} a reperdu sa directive « use client »`);
  }
});

test("aucun titre de page ne répète « Pacevo »", () => {
  // ⚠️ LE GABARIT RACINE AJOUTE DÉJÀ « | Pacevo ». Une page qui le porte aussi affiche
  // « Segments | Pacevo | Pacevo » — constaté dans l'onglet du navigateur le
  // 03/09/2026 sur 16 pages, dont six PUBLIQUES : c'est ce que Google montre dans ses
  // résultats, et la seule ligne qu'un humain y lit.
  const gabarit = readFileSync("src/app/layout.tsx", "utf8");
  assert.ok(/template: "%s \| Pacevo"/.test(gabarit), "le gabarit de titre a changé : ce test ne garde plus rien");

  const coupables: string[] = [];
  for (const f of fichiers("src/app")) {
    // Le layout racine porte légitimement le nom complet dans ses titres de partage,
    // qui ne passent pas par le gabarit.
    if (f === "src/app/layout.tsx") continue;
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/title: "([^"]*)"/g)) {
      if (/pacevo/i.test(m[1])) coupables.push(`${f} → « ${m[1]} | Pacevo »`);
    }
  }
  assert.deepEqual(coupables, [],
    `ces titres seront doublés par le gabarit :\n    ${coupables.join("\n    ")}`);
});

console.log(`\n${passed} test(s) de composants passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
