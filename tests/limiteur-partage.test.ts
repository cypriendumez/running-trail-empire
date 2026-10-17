/**
 * GARDE — le limiteur de débit est PARTAGÉ entre instances (constat d'audit M3), avec repli mémoire.
 *
 * Le compteur en mémoire comptait une fois PAR INSTANCE (sur Vercel, la limite réelle valait un
 * multiple). `autoriserPartage` passe par la RPC atomique `rate_limit_hit` (migration 037), et
 * RETOMBE sur le compteur local `autoriser` si la base ne répond pas — jamais pire qu'avant.
 *
 *   npx tsx tests/limiteur-partage.test.ts
 */
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { autoriserPartage, autoriser } from "../src/lib/auth/limiteur";
import type { SupabaseClient } from "@supabase/supabase-js";

// Un faux client : seul `rpc` est exercé ; le cast contourne le typage strict de SupabaseClient.
const faux = (rpc: () => Promise<{ data: unknown; error: unknown }>) =>
  ({ rpc }) as unknown as SupabaseClient;

let passes = 0;
const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(nom); console.log(`  ✗ ${nom}\n      ${e instanceof Error ? e.message : String(e)}`); }
}

void (async () => {
  await test("la migration 037 définit le compteur partagé et l'incrément atomique", () => {
    const f = "supabase/migrations/037_limiteur_partage.sql";
    assert.ok(existsSync(f), "migration 037 absente");
    const sql = readFileSync(f, "utf8").split("\n").map((l) => l.replace(/\s*--.*$/, "")).join("\n");
    assert.match(sql, /create table if not exists public\.rate_limits/i, "table rate_limits absente");
    assert.match(sql, /create or replace function public\.rate_limit_hit/i, "fonction rate_limit_hit absente");
    assert.match(sql, /on conflict[\s\S]*do update set\s+compte/i, "l'incrément n'est pas atomique (on conflict … do update)");
  });

  await test("autoriserPartage suit la RPC, et retombe sur la mémoire si elle échoue", async () => {
    // a) store OK → on suit la décision de la RPC.
    assert.equal(await autoriserPartage(faux(async () => ({ data: false, error: null })), "k:1", 5, 1000), false,
      "ne respecte pas un refus de la RPC");
    assert.equal(await autoriserPartage(faux(async () => ({ data: true, error: null })), "k:2", 5, 1000), true,
      "ne respecte pas une autorisation de la RPC");

    // b) RPC en erreur → repli sur la mémoire locale.
    const t0 = 1_000_000;
    assert.equal(await autoriserPartage(faux(async () => ({ data: null, error: { message: "boom" } })), "k:repli", 2, 1000, t0), true,
      "ne retombe pas sur la mémoire quand la RPC renvoie une erreur");

    // c) RPC qui lève → repli ET la mémoire BORNE après le plafond.
    autoriser("k:plafond", 2, 1000, t0);
    autoriser("k:plafond", 2, 1000, t0);
    assert.equal(await autoriserPartage(faux(async () => { throw new Error("down"); }), "k:plafond", 2, 1000, t0), false,
      "le repli mémoire ne borne pas après le plafond");
  });

  console.log(`\n${passes} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) process.exit(1);
})();
