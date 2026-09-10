/**
 * UNE OPACITÉ TAILWIND HORS ÉCHELLE NE PRODUIT RIEN, ET NE LE DIT PAS.
 *
 * ⚠️ DÉFAUT RÉEL, TROUVÉ LE 10/09/2026 PARCE QUE CYPRIEN A VU LE HAUT DE LA PAGE DÉLAVÉ.
 * Trois voiles sombres couvrent la photo du hero. DEUX rendaient `background-image: none`
 * en production :
 *
 *   from-black/44, via-black/14   → le voile du HAUT n'existait pas : la barre de
 *                                   navigation blanche reposait sur le ciel clair.
 *   from-black/52, to-black/28    → le voile MOBILE n'existait pas : sur téléphone, le
 *                                   texte du hero se posait sur la photo nue.
 *   via-black/12                  → le voile du BAS perdait son point milieu.
 *
 * La cause : l'échelle `opacity` de Tailwind vaut exactement 0, 5, 10 … 100. Écrire `/44`
 * en clair ne lève NI ERREUR NI AVERTISSEMENT — la classe n'est simplement jamais
 * engendrée, et la règle CSS n'existe pas. Le typage n'y peut rien : `className` est une
 * chaîne. Le build passe. Les tests passaient. Seul l'œil, sur la page en ligne, voyait
 * qu'un dégradé manquait.
 *
 * Hors échelle, Tailwind exige les crochets : `from-black/[0.44]`. Cette forme est
 * acceptée ici, puisqu'elle produit bien du CSS.
 *
 * ⚠️ L'ÉCHELLE EST LUE DANS TAILWIND, PAS RECOPIÉE. Une liste écrite à la main se
 * périmerait à la première mise à jour — et une liste périmée qui dit « tout va bien » est
 * pire que pas de test du tout.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/** L'échelle réelle de l'installation, jamais une copie. */
const exiger = createRequire(import.meta.url);
const ECHELLE: Set<string> = new Set(
  Object.keys(exiger("tailwindcss/stubs/config.full.js").theme.opacity as Record<string, string>),
);

/**
 * ⚠️ LES COMMENTAIRES SONT RETIRÉS, ET C'EST INDISPENSABLE ICI : le commentaire qui
 * explique ce défaut dans `page.tsx` CITE les classes fautives. Sans ce nettoyage, le test
 * se déclencherait sur sa propre explication et deviendrait impossible à satisfaire.
 *
 * ⚠️ ET ON NE COUPE PAS SUR `://`. Une URL contient deux barres obliques ; les traiter
 * comme un commentaire amputerait des lignes de code entières.
 */
function sansCommentaires(src: string): string {
  return src
    // ⚠️ ON REMPLACE PAR AUTANT DE SAUTS DE LIGNE, PAS PAR UNE ESPACE. Écraser un bloc de
    // commentaire multi-ligne décale tout ce qui suit : le premier jet annonçait la ligne
    // 347 pour un défaut situé ligne 381. Un numéro faux fait perdre plus de temps qu'il
    // n'en fait gagner.
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");      // lignes, sauf après « : » (URL)
}

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiers(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(e)) acc.push(p);
  }
  return acc;
}

/** Toute classe de couleur portant un modificateur d'opacité écrit en clair. */
const MOTIF =
  /\b(?:bg|text|border|ring|divide|outline|decoration|shadow|accent|caret|fill|stroke|placeholder|from|via|to)-[a-z]+(?:-\d{2,3})?\/(\d{1,3})\b/g;

type Trouvaille = { fichier: string; ligne: number; classe: string; valeur: string };

function relever(): Trouvaille[] {
  const out: Trouvaille[] = [];
  for (const f of fichiers("src")) {
    const lignes = sansCommentaires(readFileSync(f, "utf8")).split("\n");
    lignes.forEach((l, i) => {
      for (const m of l.matchAll(MOTIF)) out.push({ fichier: f, ligne: i + 1, classe: m[0], valeur: m[1] });
    });
  }
  return out;
}

const releve = relever();

console.log("\n=== OPACITÉS TAILWIND : la classe existe-t-elle vraiment ? ===\n");

/**
 * ⚠️ SANS CE PLANCHER, LE TEST SUIVANT SERAIT TAUTOLOGIQUE. Si le motif cessait de
 * reconnaître quoi que ce soit — un renommage, une regex cassée — « aucune classe hors
 * échelle » deviendrait vrai parce qu'on n'aurait rien regardé.
 */
test("le balayage reconnaît réellement des classes à opacité", () => {
  assert.ok(releve.length >= 20, `seulement ${releve.length} classes trouvées dans src/ — le motif ne reconnaît plus rien`);
});

test("l'échelle est bien lue dans Tailwind et n'est pas vide", () => {
  assert.ok(ECHELLE.size >= 10, `échelle lue : ${ECHELLE.size} valeurs`);
  assert.ok(ECHELLE.has("50"), "l'échelle ne contient même pas 50 — lecture ratée");
});

test("aucune classe n'utilise une opacité absente de l'échelle Tailwind", () => {
  const hors = releve.filter((t) => !ECHELLE.has(t.valeur));
  const detail = hors.map((t) => `${t.fichier}:${t.ligne} ${t.classe}`);
  assert.deepEqual(detail, [], `classes qui ne produiront AUCUN CSS : ${detail.join(" ; ")}`);
});

/**
 * Les trois voiles du hero sont la raison d'être de ce fichier : on vérifie qu'ils sont
 * toujours là ET toujours valides. Un voile supprimé ne casse rien visiblement en test,
 * mais rend le texte blanc illisible sur une photo claire.
 */
test("les trois voiles du hero existent, chacun identifié par son ancrage", () => {
  const src = sansCommentaires(readFileSync("src/app/page.tsx", "utf8"));
  // ⚠️ ON IDENTIFIE CHAQUE VOILE PAR SON ANCRAGE, PAS PAR UN COMPTE. Mon premier jet
  // comptait « 3 dégradés from-black » et rougissait à tort : la page en contient un
  // quatrième, sans rapport, sur les cartes Programmes. Un compte global rend un test
  // sensible à du code étranger — et donc faux.
  const voiles: [string, RegExp][] = [
    ["bas (lisibilité du titre)", /absolute inset-0 bg-gradient-to-t from-black\/(\d+)/],
    ["mobile (colonne de gauche)", /absolute inset-y-0 left-0 [^"]*bg-gradient-to-r from-black\/(\d+)/],
    ["haut (barre de navigation)", /absolute inset-x-0 top-0 [^"]*bg-gradient-to-b from-black\/(\d+)/],
  ];
  for (const [nom, re] of voiles) {
    const m = src.match(re);
    assert.ok(m, `voile ${nom} : introuvable dans le hero`);
    assert.ok(ECHELLE.has(m![1]), `voile ${nom} à from-black/${m![1]} : hors échelle, ne rendra RIEN`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
for (const f of fails) console.log(`  ✗ ${f}`);
if (fails.length) process.exit(1);
