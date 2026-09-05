/**
 * L'ÉTAT DU DÉPÔT LUI-MÊME.
 *
 * ⚠️ CONSTATÉ LE 05/09/2026 : iCloud avait recopié des fichiers À L'INTÉRIEUR de `.git`
 * — six `index N` et deux références (`refs/heads/main 2`,
 * `refs/remotes/origin/main 2`). `git gc` échouait donc en boucle sur
 * « bad object refs/heads/main 2 », le dépôt restait sans packfile propre, et c'est
 * très probablement ce qui faisait se couper les `git push` (défaut déjà consigné,
 * contourné jusque-là par `--no-thin`).
 *
 * Nettoyé et repacké : 1 packfile, 0 objet en vrac, 9 051 objets. Les deux refs
 * dupliquées pointaient vers un commit ANCÊTRE de HEAD — vérifié avant suppression,
 * rien d'unique n'y était accroché.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const DOUBLON = /[^/]* [0-9](\.[^/]*)?$/;

test("le motif des doublons iCloud est GÉNÉRIQUE, pas une liste de fichiers", () => {
  // ⚠️ La version précédente nommait `/.next*` après coup, une fois les 2 106 fichiers
  // de build déjà commités. Un motif par cas connu arrive toujours trop tard.
  const ign = readFileSync(".gitignore", "utf8");
  assert.ok(/^\* \[0-9\]$/m.test(ign), "le motif « * [0-9] » (dossiers dupliqués) a disparu");
  assert.ok(/^\* \[0-9\]\.\*$/m.test(ign), "le motif « * [0-9].* » (fichiers dupliqués) a disparu");
});

test("le motif ne masque AUCUN fichier légitime", () => {
  // ⚠️ Un motif trop large est pire que le défaut : il cache un vrai fichier, et
  // personne ne s'en aperçoit avant que la production ne le réclame.
  const suivis = readFileSync(".git/index", "utf8").length > 0; // le dépôt est bien là
  assert.ok(suivis, "impossible de lire l'index git");
  // On rejoue le motif sur l'arborescence de travail.
  const coupables: string[] = [];
  (function marche(d: string, prof = 0) {
    if (prof > 4) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if ([".git", "node_modules", ".next", "data", ".sauvegardes"].includes(e.name)) continue;
      const p = `${d}/${e.name}`;
      if (DOUBLON.test(e.name)) coupables.push(p);
      if (e.isDirectory()) marche(p, prof + 1);
    }
  })("src");
  assert.deepEqual(coupables, [],
    `ces fichiers du code source portent un suffixe de doublon iCloud :\n    ${coupables.join("\n    ")}`);
});

test("aucun doublon iCloud ne traîne dans .git", () => {
  // Ceux-là échappent à `.gitignore` par construction : seule une vérification les voit.
  const suspects: string[] = [];
  for (const rep of [".git", ".git/refs/heads", ".git/refs/remotes/origin"]) {
    if (!existsSync(rep)) continue;
    for (const e of readdirSync(rep)) if (DOUBLON.test(e)) suspects.push(`${rep}/${e}`);
  }
  assert.deepEqual(suspects, [],
    `iCloud a recopié des fichiers dans .git — « git gc » échouera :\n    ${suspects.join("\n    ")}\n    Les supprimer, puis « git gc --prune=now ».`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
