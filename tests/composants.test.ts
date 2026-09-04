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
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
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

test("chaque page porte un titre", () => {
  // ⚠️ SANS TITRE, L'ONGLET ET GOOGLE AFFICHENT « Pacevo » TOUT COURT. Dix pages
  // étaient dans ce cas le 03/09/2026, dont /blog — pourtant déclarée au sitemap :
  // le titre est la seule ligne qu'un humain lit dans une liste de résultats.
  const sansTitre: string[] = [];
  for (const f of fichiers("src/app")) {
    if (!f.endsWith("page.tsx")) continue;
    // La page d'accueil hérite légitimement du titre par défaut du gabarit racine.
    if (f === "src/app/page.tsx") continue;
    const src = readFileSync(f, "utf8");
    if (/export (const|async function) (metadata|generateMetadata)/.test(src)) continue;
    // ⚠️ UNE PAGE « use client » NE PEUT PAS EXPORTER `metadata` — Next l'interdit, et
    // l'erreur n'apparaît QU'AU BUILD (`tsc` et les tests passent). Son titre vit alors
    // dans un `layout.tsx` voisin, ce qui est la bonne réponse et non un contournement.
    const layout = f.replace(/page\.tsx$/, "layout.tsx");
    if (existsSync(layout) && /export const metadata/.test(readFileSync(layout, "utf8"))) continue;
    sansTitre.push(f);
  }
  assert.deepEqual(sansTitre, [],
    `ces pages s'afficheront « Pacevo » sans plus de précision :\n    ${sansTitre.join("\n    ")}`);
});

test("aucune page « use client » n'exporte metadata", () => {
  // ⚠️ DÉFAUT COMMIS LE 03/09/2026 : huit pages client se sont vu ajouter un
  // `export const metadata`. `tsc` passe, la suite de tests passe, et le BUILD tombe —
  // « You are attempting to export metadata from a component marked with use client ».
  // C'est précisément ce qui distingue `npm run verify` de `npm run build`.
  const coupables: string[] = [];
  for (const f of fichiers("src/app")) {
    const src = readFileSync(f, "utf8");
    if (!/^\s*["']use client["']/.test(src.split("\n").slice(0, 3).join("\n"))) continue;
    if (/export const metadata|export async function generateMetadata/.test(src)) coupables.push(f);
  }
  assert.deepEqual(coupables, [],
    `ces fichiers « use client » exportent metadata — le build échouera :\n    ${coupables.join("\n    ")}`);
});

test("un corps vide n'efface pas le pass santé", () => {
  // ⚠️ CONSTATÉ EN SONDANT LES POINTS D'ENTRÉE le 03/09/2026 : `POST /api/pps {}`
  // répondait 200 et remettait le pass à zéro. Le formulaire qui VIDE le pass envoie
  // bien les champs, à `null` — c'est une intention. Une requête sans aucun champ
  // reconnu n'exprime rien, et l'écraser revenait à effacer le pass d'un athlète sur
  // une requête malformée, sans trace.
  const src = readFileSync("src/app/api/pps/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(/CHAMPS\.some\(\(c\) => c in \(body as Record<string, unknown>\)\)/.test(src),
    "un corps sans aucun champ reconnu est de nouveau accepté");
  const i = src.indexOf("CHAMPS.some(");
  assert.ok(/status: 400/.test(src.slice(i, i + 400)), "un corps vide n'est pas refusé");
  // La vérification doit précéder l'écriture, sinon elle ne protège rien.
  assert.ok(i < src.indexOf(".update("), "le pass est écrit avant d'être validé");
  assert.ok(i < src.indexOf(".insert("), "le pass est créé avant d'être validé");
});

test("le journal d'erreurs public ne peut pas remplir la base", () => {
  // ⚠️ MESURÉ LE 03/09/2026 : une seule requête ANONYME a stocké 500 Ko dans
  // `error_logs`. La route est publique — elle doit l'être, une erreur survient souvent
  // avant la connexion — mais elle ÉCRIT, et rien ne la bornait : `cut()` coupait les
  // chaînes, jamais l'objet `meta`. Le palier gratuit de Supabase plafonne à 500 Mo :
  // mille requêtes suffisaient à remplir la base, sans qu'aucune alerte ne le signale.
  const src = readFileSync("src/app/api/log-error/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

  // Le corps est refusé AVANT d'être analysé : `req.json()` sur un corps énorme le
  // chargerait en mémoire avant toute borne.
  // ⚠️ VISER L'USAGE, PAS LA DÉCLARATION. Premier jet : le test cherchait la constante
  // `CORPS_MAX`, qui reste déclarée même quand plus rien ne l'utilise — supprimer la
  // garde laissait le test vert. Trouvé par mutation.
  const gardeTaille = /annonce > CORPS_MAX\) return/.test(src);
  assert.ok(gardeTaille, "la taille annoncée n'est plus refusée avant lecture");
  const iGarde = src.indexOf("annonce > CORPS_MAX");
  const iLecture = src.indexOf("await req.text()");
  assert.ok(iGarde > 0 && iGarde < iLecture, "le corps est lu avant d'être borné");
  assert.ok(/brut\.length > CORPS_MAX\) return/.test(src),
    "un corps sans en-tête de taille échappe à la borne");

  // `meta` est borné, et TRONQUÉ plutôt que jeté : on garde de quoi diagnostiquer.
  assert.ok(/META_MAX/.test(src), "meta n'est plus borné");
  assert.ok(/tronque: true/.test(src), "un meta trop gros est jeté au lieu d'être tronqué");

  // Et un afflux cesse d'écrire. Le compteur est GLOBAL et non par adresse IP :
  // compter par IP obligerait à stocker une donnée personnelle.
  assert.ok(/\(count \?\? 0\) >= PAR_MINUTE_MAX\) return/.test(src),
    "le coupe-circuit est déclaré mais plus appliqué : un afflux écrirait sans limite");
  assert.ok(!/x-forwarded-for|req\.ip|realIp/i.test(src),
    "la route s'est mise à lire l'adresse IP — c'est une donnée personnelle");
});

console.log(`\n${passed} test(s) de composants passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
