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

test("aucune RÉFÉRENCE dupliquée ne traîne dans .git", () => {
  /**
   * ⚠️ ON NE FAIT ÉCHOUER QUE SUR LES RÉFÉRENCES, ET C'EST DÉLIBÉRÉ.
   *
   * `git gc` s'est arrêté sur « bad object refs/heads/main 2 » : ce sont les REFS qui
   * cassent le dépôt. Les copies de `.git/index` sont, elles, inertes — git n'ouvre que
   * `.git/index`. Or iCloud en recrée six toutes les vingt minutes : les compter comme
   * des échecs rendrait cette suite ROUGE en permanence, et on apprendrait à ignorer
   * son alerte. Un garde-fou qui crie au loup ne garde plus rien.
   *
   * Les copies d'index sont donc SIGNALÉES, pas sanctionnées.
   */
  const refs: string[] = [];
  for (const rep of [".git/refs/heads", ".git/refs/remotes/origin"]) {
    if (!existsSync(rep)) continue;
    for (const e of readdirSync(rep)) if (DOUBLON.test(e)) refs.push(`${rep}/${e}`);
  }
  const index = existsSync(".git")
    ? readdirSync(".git").filter((e) => /^index [0-9]+$/.test(e))
    : [];
  if (index.length) {
    console.log(`     ⓘ ${index.length} copie(s) inerte(s) de .git/index laissées par iCloud — sans effet, mais signe que .git est synchronisé.`);
  }
  assert.deepEqual(refs, [],
    `iCloud a recopié des RÉFÉRENCES dans .git — « git gc » va échouer :\n    ${refs.join("\n    ")}\n    Les supprimer, puis « git gc --prune=now ».`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
