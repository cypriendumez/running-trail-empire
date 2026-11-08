/**
 * GARDE DE SÉCURITÉ — `profiles` : un compte connecté ne s'attribue pas la formule payante.
 *
 * Constat d'audit C1 (15/10/2026) : `authenticated` a un droit `UPDATE` au niveau de la TABLE
 * `profiles`, et `profiles_update_own` laisse chacun écrire sa propre ligne — donc un simple
 * PATCH REST posant `subscription_tier = 'premium'` débloquait les fonctions payantes sans
 * payer. Correctif : déclencheur `trg_profiles_colonnes_protegees` (migration 036), qui refuse
 * tout changement des 6 colonnes sensibles pour les rôles `authenticated`/`anon`.
 *
 * Deux garde-fous, à deux portées :
 *  1. TOUJOURS (sans réseau) : la migration 036 enregistre bien la protection des 6 colonnes.
 *     Si quelqu'un la retire ou en oublie une, ce test rougit — y compris en CI.
 *  2. PREUVE RÉELLE (opt-in) : avec RUN_DB_WRITE_TESTS=1 et les clés Supabase, on ouvre une
 *     VRAIE session, on tente l'escalade (refusée), on vérifie qu'une édition normale passe,
 *     puis on SUPPRIME le compte de test. Désactivée par défaut : la suite ne doit jamais
 *     écrire en base à chaque `npm run verify`.
 *
 *   npx tsx tests/securite-profil.test.ts
 *   RUN_DB_WRITE_TESTS=1 npx tsx tests/securite-profil.test.ts   # preuve live (compte jetable)
 */
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

let passes = 0;
const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(nom); console.log(`  ✗ ${nom}\n      ${e instanceof Error ? e.message : String(e)}`); }
}

// Les 6 colonnes que seul le service role (webhook Stripe, crons) doit écrire.
const COLONNES = [
  "subscription_tier", "stripe_subscription_id", "created_at",
  "league", "xp_points", "discipline_score",
];

const MIGRATION = "supabase/migrations/036_profils_colonnes_protegees.sql";

function depuisEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(".env.local")) return out;
  for (const ligne of readFileSync(".env.local", "utf8").split("\n")) {
    const m = ligne.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

void (async () => {
  // ── 1. TOUJOURS : la migration enregistre la protection ─────────────────────
  await test("la migration 036 protège les 6 colonnes sensibles de profiles", () => {
    assert.ok(existsSync(MIGRATION), "migration 036 absente : le correctif C1 n'est plus enregistré");
    // On retire les commentaires SQL (`--`) avant de chercher, pour ne pas valider un simple
    // commentaire. On vise `--` et jamais `//`, donc aucune URL n'est coupée.
    const sql = readFileSync(MIGRATION, "utf8")
      .split("\n").map((l) => l.replace(/\s*--.*$/, "")).join("\n");

    assert.match(sql, /create\s+trigger\s+trg_profiles_colonnes_protegees/i, "déclencheur non créé");
    assert.match(sql, /before\s+update\s+on\s+public\.profiles/i, "le déclencheur n'est pas BEFORE UPDATE sur profiles");
    assert.match(sql, /raise\s+exception/i, "aucune levée d'exception : rien n'est refusé");
    // Il ne doit brider QUE les requêtes d'un compte connecté/anonyme — jamais le service role.
    assert.match(sql, /v_role\s+in\s*\(\s*'authenticated'\s*,\s*'anon'\s*\)/i,
      "le garde ne cible pas explicitement authenticated/anon (risque de bloquer le webhook Stripe)");

    for (const c of COLONNES) {
      assert.match(sql, new RegExp(`new\\.${c}\\s+is\\s+distinct\\s+from\\s+old\\.${c}`, "i"),
        `la colonne ${c} n'est plus protégée par le déclencheur`);
    }
  });

  // ── Le secret intervals.icu ne part pas vers le navigateur (audit M1) ───────
  await test("l'export RGPD ne lit plus profiles depuis le navigateur", () => {
    const src = readFileSync("src/components/profile/ProfileSettings.tsx", "utf8");
    assert.ok(!/from\("profiles"\)\s*\.\s*select/.test(src),
      "ProfileSettings fait encore un select sur profiles côté client (le jeton intervals reviendrait dans le navigateur)");
    assert.match(src, /\/api\/account\/export/, "l'export ne passe pas par la route serveur /api/account/export");
  });

  await test("la route d'export RGPD retire les secrets avant de répondre", () => {
    const route = "src/app/api/account/export/route.ts";
    assert.ok(existsSync(route), "route d'export RGPD absente");
    const src = readFileSync(route, "utf8");
    assert.match(src, /stripProfileSecrets/, "l'export serveur ne passe pas le profil par stripProfileSecrets");
    assert.match(src, /auth\.getUser\(\)/, "l'export ne vérifie pas la session");
  });

  // ── L'avatar renifle les octets, ne croit pas le type déclaré (audit M5) ────
  await test("l'avatar déduit le type des octets et ne stocke pas file.type", () => {
    const src = readFileSync("src/app/api/profile/upload-avatar/route.ts", "utf8");
    assert.match(src, /sniffImage\(/, "l'avatar ne renifle pas les octets (sniffImage)");
    assert.ok(!/contentType:\s*file\.type/.test(src),
      "l'avatar stocke encore le Content-Type déclaré par le client (file.type)");
  });

  // ── 2. PREUVE RÉELLE (opt-in) : session authentifiée, escalade refusée ──────
  const env = { ...depuisEnvLocal(), ...process.env } as Record<string, string>;
  const URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

  if (process.env.RUN_DB_WRITE_TESTS !== "1") {
    console.log("  (preuve live ignorée : poser RUN_DB_WRITE_TESTS=1 — elle crée puis SUPPRIME un compte jetable en base)");
  } else if (!URL || !ANON || !SERVICE) {
    console.log("  (preuve live ignorée : NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / SUPABASE_SERVICE_ROLE_KEY manquants)");
  } else {
    await test("une session authentifiée NE PEUT PAS s'attribuer subscription_tier (mais édite son nom)", async () => {
      const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
      const courriel = `securite-garde-${randomUUID()}@test.pacevo.fr`;
      const motDePasse = `Gq-${randomUUID()}-9A!`;
      let uid = "";
      try {
        const { data: cree, error: eCreer } = await admin.auth.admin.createUser({
          email: courriel, password: motDePasse, email_confirm: true,
        });
        assert.ok(!eCreer && cree?.user?.id, `création du compte de test impossible : ${eCreer?.message ?? "?"}`);
        uid = cree!.user!.id;

        const sb = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error: eConnexion } = await sb.auth.signInWithPassword({ email: courriel, password: motDePasse });
        assert.ok(!eConnexion, `connexion du compte de test impossible : ${eConnexion?.message ?? "?"}`);

        // Escalade : doit être REFUSÉE par le déclencheur.
        const { error: eEscalade } = await sb.from("profiles").update({ subscription_tier: "premium" }).eq("id", uid);
        assert.ok(eEscalade, "FAILLE : l'escalade de subscription_tier a été ACCEPTÉE (déclencheur absent ou inefficace)");

        // La valeur n'a pas bougé.
        const { data: apres } = await sb.from("profiles").select("subscription_tier").eq("id", uid).single();
        assert.equal(apres?.subscription_tier, "free", `subscription_tier a changé malgré le refus : ${apres?.subscription_tier}`);

        // Contrôle positif : une édition de profil légitime passe toujours.
        const { error: eNom } = await sb.from("profiles").update({ full_name: "Garde Sécurité" }).eq("id", uid);
        assert.ok(!eNom, `une édition de profil légitime (nom) est refusée à tort : ${eNom?.message ?? ""}`);

        await sb.auth.signOut();
      } finally {
        // Nettoyage systématique, même si une assertion échoue (cascade → supprime la ligne profiles).
        if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {});
      }
    });
  }

  console.log(`\n${passes} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) process.exit(1);
})();
