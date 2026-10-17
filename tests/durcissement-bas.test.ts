/**
 * DURCISSEMENTS « BAS » de l'audit d'octobre 2026 — invariants sur les fichiers.
 *
 *  B1 — le workflow sync-coach n'imprime plus le corps brut de /api/cron/sync-all :
 *       ce compte rendu porte un `userId` par athlète et ces journaux sont PUBLICS.
 *  B3 — la route morte api/admin/setup-storage (RPC `exec_sql` inexistante) est retirée.
 *  B5 — la migration 038 fige le search_path des 3 fonctions trigger, sans DROP.
 *
 * (B2 — `athletes_publics` : volontairement NON traité. La passer en security_invoker
 *  casserait la vitrine publique des athlètes — la vue traverse la RLS de `profiles`
 *  par conception. Voir le rapport d'audit.)
 */
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";

let passes = 0;
const fails: string[] = [];
function test(nom: string, fn: () => void): void {
  try { fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(nom); console.log(`  ✗ ${nom}\n      ${e instanceof Error ? e.message : String(e)}`); }
}

console.log("\nDURCISSEMENTS BAS");

// ── B3 : code mort supprimé ──────────────────────────────────────────────────
test("B3 — la route setup-storage (exec_sql inexistante) n'existe plus", () => {
  assert.ok(
    !existsSync("src/app/api/admin/setup-storage/route.ts"),
    "setup-storage appelait une RPC exec_sql absente : code mort à retirer",
  );
});

// ── B1 : journaux Actions sans userId ────────────────────────────────────────
test("B1 — sync-coach n'imprime plus le corps brut de sync-all", () => {
  const wf = readFileSync(".github/workflows/sync-coach.yml", "utf8");
  // `| tee reponse.json` recopiait le compte rendu par athlète (userId) sur stdout.
  assert.ok(
    !/\|\s*tee\s+reponse\.json/.test(wf),
    "le `| tee reponse.json` publiait les userId dans un log public",
  );
  // Le corps va dans un fichier (pour le contrôle anti-fuite), sans être imprimé.
  assert.ok(/-o\s+reponse\.json/.test(wf), "le corps doit aller dans un fichier, pas sur stdout");
  // Le garde-fou anti-clé reste en place.
  assert.ok(/intervals_api_key/.test(wf), "le contrôle anti-fuite de clé doit rester");
});

// ── B5 : search_path figé, sans DROP ─────────────────────────────────────────
test("B5 — la migration 038 fige le search_path des 3 fonctions, sans DROP", () => {
  const f = "supabase/migrations/038_search_path_fonctions.sql";
  assert.ok(existsSync(f), "migration 038 absente");
  const sql = readFileSync(f, "utf8");
  for (const fn of ["update_shoe_km", "maj_compteurs_publication", "maj_compteur_membres"]) {
    const re = new RegExp(`alter function public\\.${fn}\\(\\)\\s+set search_path = public`, "i");
    assert.ok(re.test(sql), `search_path non figé pour ${fn}`);
  }
  // Invariant du projet : aucune migration ≥ 007 ne contient de DROP (commentaires retirés).
  const sansCommentaires = sql.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
  assert.ok(!/\bdrop\b/i.test(sansCommentaires), "une migration ≥ 007 ne doit contenir aucun DROP");
});

console.log(`\n${passes} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
