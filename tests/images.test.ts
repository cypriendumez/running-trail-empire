/**
 * UN DESCRIPTEUR `w` QUI MENT DÉGRADE L'IMAGE SANS RIEN CASSER.
 *
 * Dans un `srcSet`, `/hero-paris-2560.avif 2560w` est une PROMESSE faite au navigateur :
 * « ce fichier fait 2 560 pixels de large ». Le navigateur ne l'ouvre pas pour vérifier —
 * il choisit sa variante SUR CETTE SEULE DÉCLARATION, avant tout téléchargement. C'est
 * tout l'intérêt du procédé, et c'est aussi sa fragilité.
 *
 * ⚠️ DEUX DÉFAUTS RÉELS QUE RIEN D'AUTRE NE VOIT :
 *
 * 1. UN FICHIER ABSENT. Un `srcSet` qui désigne un fichier inexistant ne produit AUCUNE
 *    erreur : le navigateur retombe silencieusement sur une autre entrée. Rien dans le
 *    typage, le build ou la console ne le signale. Un renommage de fichier suffit.
 *
 * 2. UN DESCRIPTEUR FAUX. Écrire `2560w` devant un fichier qui fait 1 920 px est PIRE
 *    qu'absent : le navigateur croit tenir la variante haute définition, ne cherche pas
 *    mieux, et étire un fichier trop petit. Mesuré sur cette image précise : un 1 920
 *    étiré ne restitue que 82 % du détail fin du maître. La page s'affiche parfaitement,
 *    elle est simplement floue — le genre de défaut qu'on ne trouve jamais en relisant du
 *    code, seulement en ouvrant les fichiers.
 *
 * Ce fichier lit donc les DIMENSIONS RÉELLES dans les octets de chaque image (AVIF, WebP
 * et JPEG ont chacun leur en-tête) et les confronte à ce que le code déclare. On ne
 * recopie aucune liste : on balaye `src/` pour trouver les `srcSet`, sinon la liste se
 * périmerait au premier ajout de taille — ce qui est exactement le défaut visé.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/* ------------------------------------------------------------------ */
/* Lecture des dimensions DANS LES OCTETS, sans dépendance extérieure. */
/* ------------------------------------------------------------------ */

/** JPEG : la largeur vit dans le marqueur SOF (0xFFC0-0xFFCF, sauf C4/C8/CC). */
function tailleJpeg(b: Buffer): { l: number; h: number } | null {
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: b.readUInt16BE(i + 5), l: b.readUInt16BE(i + 7) };
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/** WebP : trois encodages possibles, trois emplacements différents. */
function tailleWebp(b: Buffer): { l: number; h: number } | null {
  if (b.toString("ascii", 8, 12) !== "WEBP") return null;
  const type = b.toString("ascii", 12, 16);
  if (type === "VP8X") return { l: (b.readUIntLE(24, 3) & 0xffffff) + 1, h: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
  if (type === "VP8L") {
    const n = b.readUInt32LE(21);
    return { l: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
  }
  if (type === "VP8 ") {
    // Le cadre commence après la signature de synchronisation 0x9d012a.
    for (let i = 20; i < Math.min(b.length - 7, 200); i++) {
      if (b[i] === 0x9d && b[i + 1] === 0x01 && b[i + 2] === 0x2a) {
        return { l: b.readUInt16LE(i + 3) & 0x3fff, h: b.readUInt16LE(i + 5) & 0x3fff };
      }
    }
  }
  return null;
}

/** AVIF : conteneur ISOBMFF ; la taille est dans la boîte `ispe`. */
function tailleAvif(b: Buffer): { l: number; h: number } | null {
  const i = b.indexOf("ispe", 0, "ascii");
  if (i < 0 || i + 12 > b.length) return null;
  return { l: b.readUInt32BE(i + 8), h: b.readUInt32BE(i + 12) };
}

function dimensions(chemin: string): { l: number; h: number } | null {
  const b = readFileSync(chemin);
  if (chemin.endsWith(".jpg") || chemin.endsWith(".jpeg")) return tailleJpeg(b);
  if (chemin.endsWith(".webp")) return tailleWebp(b);
  if (chemin.endsWith(".avif")) return tailleAvif(b);
  return null;
}

/* ------------------------------------------------------------------ */
/* Ce que le code DÉCLARE.                                            */
/* ------------------------------------------------------------------ */

function fichiersSource(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiersSource(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(e)) acc.push(p);
  }
  return acc;
}

type Entree = { fichier: string; url: string; largeur: number };

/** Toutes les paires « /chemin 1234w » des srcSet du code source. */
function declarations(): Entree[] {
  const out: Entree[] = [];
  for (const f of fichiersSource("src")) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/srcSet=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
      const liste = m[1] ?? m[2];
      for (const e of liste.split(",")) {
        const t = e.trim().match(/^(\/[^\s]+)\s+(\d+)w$/);
        if (t) out.push({ fichier: f, url: t[1], largeur: Number(t[2]) });
      }
    }
  }
  return out;
}

const decl = declarations();

console.log("\n=== IMAGES : ce que le srcSet promet est-il vrai ? ===\n");

test("le balayage trouve au moins un srcSet en largeurs", () => {
  assert.ok(decl.length >= 3, `aucun srcSet exploitable trouvé dans src/ (${decl.length})`);
});

test("chaque fichier déclaré dans un srcSet existe dans public/", () => {
  const manquants = decl.filter((d) => !existsSync(join("public", d.url))).map((d) => `${d.url} (${d.fichier})`);
  assert.deepEqual(manquants, [], `déclarés mais absents : ${manquants.join(", ")}`);
});

test("la largeur annoncée par le descripteur w est la vraie largeur du fichier", () => {
  const menteurs: string[] = [];
  for (const d of decl) {
    const p = join("public", d.url);
    if (!existsSync(p)) continue;
    const dim = dimensions(p);
    if (!dim) { menteurs.push(`${d.url} — en-tête illisible`); continue; }
    if (dim.l !== d.largeur) menteurs.push(`${d.url} annoncé ${d.largeur}w, mesuré ${dim.l}px`);
  }
  assert.deepEqual(menteurs, [], menteurs.join(" ; "));
});

/**
 * ⚠️ CE TEST EXISTE PARCE QU'UN LECTEUR D'EN-TÊTE QUI REND TOUJOURS `null` RENDRAIT LE
 * TEST PRÉCÉDENT TAUTOLOGIQUE : sans lui, « aucun menteur » serait vrai simplement parce
 * qu'on n'aurait rien su lire. On exige donc que les trois formats soient RÉELLEMENT
 * décodés au moins une fois.
 */
test("les trois formats sont réellement décodés (le lecteur ne rend pas null en silence)", () => {
  const lus = new Set<string>();
  for (const d of decl) {
    const p = join("public", d.url);
    if (existsSync(p) && dimensions(p)) lus.add(p.split(".").pop()!);
  }
  for (const f of ["avif", "webp", "jpg"]) {
    assert.ok(lus.has(f), `aucun fichier ${f} n'a pu être décodé — le lecteur d'en-tête est cassé`);
  }
});

/**
 * UN AGRANDISSEMENT DÉGUISÉ : un fichier qui a la bonne largeur sans avoir l'information.
 *
 * ⚠️ DÉFAUT RÉELLEMENT COMMIS, LE 10/09/2026, PENDANT L'ÉCRITURE DE CE FICHIER. Un script
 * qui éprouvait ce test a fabriqué un 2 560 px en étirant le 750 px, puis a restauré le
 * code source SANS restaurer l'image. Le vrai fichier de 200 Ko a passé une demi-heure
 * remplacé par un flou de 74 Ko. Tout était vert : la largeur déclarée était juste, le
 * fichier existait, le typage et le build n'ont rien vu. Seul l'œil, ou ce test, peut le
 * voir.
 *
 * Le signal retenu est le rapport OCTETS PAR PIXEL. Un encodeur ne dépense pas d'octets
 * pour du flou : agrandir n'ajoute aucun détail, seulement des pixels, et le rapport
 * s'effondre. Les deux bornes, mesurées sur cette image :
 *
 *     vrai 2 560 (depuis le maître)   200 Ko   0,0560 octet/pixel
 *     faux 2 560 (agrandi du 750)      74 Ko   0,0209 octet/pixel
 *
 * ⚠️ ET C'EST UN INDICE, PAS UNE PREUVE — il faut le savoir pour ne pas s'y fier trop.
 * Le rapport dépend du réglage de qualité de l'encodeur autant que du contenu. 0,035 est
 * placé entre les deux bornes ci-dessus, soit une marge de 1,6× de chaque côté. Baisser
 * franchement la qualité d'une variante rapprocherait une image LÉGITIME du seuil : si ce
 * test se met à rougir après un changement de qualité, c'est le seuil qu'il faut
 * revérifier avec les deux mesures ci-dessus, pas l'image qu'il faut alourdir.
 *
 * Mon premier seuil valait 0,02 — SOUS le faux à 0,0209. Il n'attrapait donc rien, et
 * n'a été démasqué qu'en fabriquant un vrai agrandissement pour le lui soumettre.
 */
test("aucune variante n'est un agrandissement déguisé", () => {
  const suspects: string[] = [];
  for (const d of decl) {
    const p = join("public", d.url);
    if (!existsSync(p)) continue;
    const dim = dimensions(p);
    if (!dim) continue;
    const octetsParPixel = statSync(p).size / (dim.l * dim.h);
    if (octetsParPixel < 0.035) suspects.push(`${d.url} — ${octetsParPixel.toFixed(4)} octet/pixel`);
  }
  assert.deepEqual(suspects, [], `probablement agrandi depuis plus petit : ${suspects.join(", ")}`);
});

test("le hero propose une variante d'au moins 2560 px aux écrans retina", () => {
  const hero = decl.filter((d) => d.url.includes("hero-paris") && d.url.endsWith(".avif"));
  assert.ok(hero.length > 0, "aucune variante AVIF du hero déclarée");
  const max = Math.max(...hero.map((d) => d.largeur));
  assert.ok(max >= 2560, `la plus grande variante AVIF fait ${max}px : un écran 1280@2x en demande 2560`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
for (const f of fails) console.log(`  ✗ ${f}`);
if (fails.length) process.exit(1);
