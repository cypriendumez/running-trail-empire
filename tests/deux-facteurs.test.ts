/**
 * GARDE — la double authentification (TOTP), facultative, avec récupération par lien e-mail
 * (choix de Cyprien, 08/11/2026).
 *
 * Ce qu'il faut empêcher : qu'un mot de passe volé (session `aal1`) suffise à entrer dans le compte
 * d'un coureur qui a activé le code — par une page, par une route serveur (dont celles qui lisent
 * avec la clé de service), ou par l'API de la base (politiques RLS `aal2`, migration 041).
 * Et qu'un coureur qui a perdu son téléphone reste enfermé dehors.
 *
 *   npx tsx tests/deux-facteurs.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { aalDuJeton, aUnSecondFacteur, secondFacteurEnAttente } from "../src/lib/auth/mfa";
import { avecGardeSecondFacteur } from "../src/lib/supabase/server";
import { demanderRetrait, retirerDeuxFacteurs, avertirActivation } from "../src/lib/auth/deuxFacteurs";
import { emailRetraitDeuxFacteurs, emailDeuxFacteursRetiree, emailDeuxFacteursActivee } from "../src/lib/auth/emailConfirmation";
import { AUTH } from "../src/components/auth/authI18n";

let passes = 0;
const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(nom); console.log(`  ✗ ${nom}\n      ${e instanceof Error ? e.message : String(e)}`); }
}

function code(f: string): string {
  return readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1")).join("\n");
}

/** Un jeton d'accès factice (signature non vérifiée : GoTrue l'a fait avant, dans le vrai code). */
function jeton(charge: Record<string, unknown>): string {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b({ alg: "HS256" })}.${b(charge)}.signature`;
}
const t = () => Math.floor(Date.now() / 1000);
const VERIFIE = [{ id: "f1", status: "verified", factor_type: "totp" }];

void (async () => {
  // ── 1. LA RÈGLE ─────────────────────────────────────────────────────────────────────────
  await test("règle : facteur VÉRIFIÉ + session non aal2 = code attendu ; sinon non", () => {
    assert.equal(aalDuJeton(jeton({ aal: "aal2" })), "aal2");
    assert.equal(aalDuJeton("n'importe quoi"), null);
    assert.equal(aUnSecondFacteur({ factors: [{ status: "unverified" }] }), false, "un enrôlement abandonné compte comme une double authentification");
    assert.equal(secondFacteurEnAttente({ factors: VERIFIE }, jeton({ aal: "aal1" })), true, "mot de passe seul accepté sur un compte protégé");
    assert.equal(secondFacteurEnAttente({ factors: VERIFIE }, jeton({ aal: "aal2" })), false, "le code donné n'est pas reconnu");
    assert.equal(secondFacteurEnAttente({ factors: VERIFIE }, "jeton-illisible"), true, "un jeton illisible vaut un code donné");
    assert.equal(secondFacteurEnAttente({ factors: VERIFIE }, undefined), true);
    assert.equal(secondFacteurEnAttente({ factors: [] }, jeton({ aal: "aal1" })), false, "un compte sans double authentification se voit demander un code");
    assert.equal(secondFacteurEnAttente({ factors: null }, jeton({ aal: "aal1" })), false);
  });

  // ── 2. LA GARDE DU SERVEUR (le point de passage de toutes les pages et routes) ──────────
  await test("garde serveur : getUser() répond « personne » tant que le code n'est pas donné", async () => {
    const faux = (user: unknown, access_token: string) => ({
      auth: {
        getUser: async (_jwt?: string) => ({ data: { user }, error: null as unknown }),
        getSession: async () => ({ data: { session: { access_token } } }),
      },
    });
    const protege = { id: "u1", factors: VERIFIE };
    assert.equal((await avecGardeSecondFacteur(faux(protege, jeton({ aal: "aal1" }))).auth.getUser()).data.user, null,
      "un mot de passe volé ouvre les pages et les routes serveur d'un compte protégé");
    assert.deepEqual((await avecGardeSecondFacteur(faux(protege, jeton({ aal: "aal2" }))).auth.getUser()).data.user, protege,
      "le coureur qui a donné son code est pris pour un intrus");
    const libre = { id: "u2", factors: [] };
    assert.deepEqual((await avecGardeSecondFacteur(faux(libre, jeton({ aal: "aal1" }))).auth.getUser()).data.user, libre,
      "un compte sans double authentification est déconnecté");
    assert.equal((await avecGardeSecondFacteur(faux(null, "")).auth.getUser()).data.user, null);
  });

  await test("un seul client serveur, et la porte sans garde n'est ouverte qu'aux routes du code", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) parcourir(p); else if (/\.(ts|tsx)$/.test(n)) fichiers.push(p); } };
    parcourir("src");
    const sansGarde = fichiers.filter((f) => code(f).includes("createClientSansGarde2fa(") && f !== join("src", "lib", "supabase", "server.ts"));
    assert.deepEqual(sansGarde.sort(), [join("src", "app", "api", "auth", "2fa", "perdu", "route.ts"), join("src", "app", "api", "auth", "2fa", "retirer", "route.ts")],
      "une autre route lit la session SANS la garde du second facteur");
    const clients = fichiers.filter((f) => /createServerClient\(/.test(code(f)));
    assert.deepEqual(clients.filter((f) => f !== join("src", "lib", "supabase", "server.ts") && f !== join("src", "lib", "supabase", "middleware.ts")), [],
      "un second client Supabase serveur contourne la garde");
    assert.match(code("src/lib/supabase/server.ts"), /export async function createClient\(\) \{\s*return avecGardeSecondFacteur\(await construire\(\)\);/, "createClient() n'applique plus la garde");
  });

  await test("connexion Google d'un compte protégé : vers l'écran du code (et plus de `user!`)", () => {
    const cb = code("src/app/auth/callback/route.ts");
    assert.match(cb, /if \(!user\) return NextResponse\.redirect\(`\$\{origin\}\/verification-2fa\?next=\$\{encodeURIComponent\(next\)\}`\);/, "le retour de Google plante ou contourne le code");
    assert.ok(!cb.includes("user!"), "`user!` est revenu : le retour de Google planterait pour un compte protégé");
  });

  await test("aiguillage : la connexion et « nouveau mot de passe » envoient vers le code", () => {
    const login = code("src/app/(auth)/login/page.tsx");
    assert.equal((login.match(/secondFacteurAttendu\(/g) ?? []).length, 2, "la page de connexion n'aiguille plus vers le code (après connexion ET à l'arrivée)");
    assert.match(code("src/app/(auth)/reset-password/page.tsx"), /secondFacteurAttendu\(supabase\)\.then\(\(attendu\) => \{ if \(attendu\) router\.replace\("\/verification-2fa\?next=\/reset-password"\)/);
    const v = code("src/app/(auth)/verification-2fa/page.tsx");
    assert.match(v, /auth\.mfa\.challengeAndVerify\(\{ factorId: facteur, code \}\)/, "l'écran du code ne vérifie plus le code");
    assert.match(v, /"\/api\/auth\/2fa\/perdu"/, "plus de recours « J'ai perdu mon téléphone »");
  });

  // ── 3. « J'AI PERDU MON TÉLÉPHONE » ──────────────────────────────────────────────────────
  await test("demande de lien : seulement pour un compte protégé, à SA propre adresse, limitée", async () => {
    const envois: string[] = [];
    const d = (user: unknown, autorise = true) => ({
      utilisateur: async () => user as never,
      autoriser: async () => autorise,
      envoyerLien: async (email: string) => { envois.push(email); return true; },
    });
    assert.equal((await demanderRetrait(d(null))).status, 401);
    assert.equal((await demanderRetrait(d({ id: "u", email: "a@b.fr", factors: [] }))).body.error, "sans_deux_facteurs");
    assert.equal((await demanderRetrait(d({ id: "u", email: "a@b.fr", factors: VERIFIE }, false))).status, 429, "les liens ne sont pas limités");
    assert.equal(envois.length, 0, "un lien est parti malgré un refus");
    assert.equal((await demanderRetrait(d({ id: "u", email: "marie@exemple.fr", factors: VERIFIE }))).status, 200);
    assert.deepEqual(envois, ["marie@exemple.fr"], "le lien ne part pas à l'adresse du compte");
  });

  await test("retrait : exige un lien e-mail RÉCENT ; un mot de passe seul ne retire rien ; avis envoyé", async () => {
    const supprimes: string[] = [];
    const avis: string[] = [];
    const notes: string[] = [];
    const revocations: string[] = [];
    const d = (jetonAcces: string, opts: { lister?: () => Promise<{ ids: string[] } | { erreur: string }>; supprimer?: (id: string) => Promise<string | null>; revoquer?: () => Promise<string | null> } = {}) => ({
      utilisateur: async () => ({ id: "u1", email: "marie@exemple.fr", factors: VERIFIE }),
      jetonAcces: async () => jetonAcces,
      autoriser: async () => true,
      listerFacteurs: opts.lister ?? (async () => ({ ids: ["f1", "f2"] })),
      supprimerFacteur: async (_u: string, id: string) => (opts.supprimer ? opts.supprimer(id) : (supprimes.push(id), null)),
      revoquerAutresSessions: opts.revoquer ?? (async () => { revocations.push(`après ${supprimes.length} retrait(s)`); return null; }),
      prevenir: async (email: string) => { avis.push(email); },
      journaliser: async (_u: string, m: string) => { notes.push(m); },
    });
    const motDePasse = await retirerDeuxFacteurs(d(jeton({ aal: "aal1", amr: [{ method: "password", timestamp: t() }] })));
    assert.deepEqual([motDePasse.status, motDePasse.body.error], [403, "lien_requis"], "un mot de passe volé retire la double authentification");
    const vieux = await retirerDeuxFacteurs(d(jeton({ aal: "aal1", amr: [{ method: "otp", timestamp: t() - 7200 }] })));
    assert.equal(vieux.status, 403, "un lien vieux de deux heures retire encore la double authentification");
    assert.equal(supprimes.length, 0);
    const ok = await retirerDeuxFacteurs(d(jeton({ aal: "aal1", amr: [{ method: "otp", timestamp: t() - 60 }] })));
    assert.equal(ok.status, 200);
    assert.deepEqual(supprimes, ["f1", "f2"], "tous les facteurs ne sont pas retirés");
    assert.deepEqual(avis, ["marie@exemple.fr"], "aucun avis de retrait au titulaire");
    // Relecture du 08/11 : la session d'un voleur, restée sur l'écran du code, ne doit pas devenir valide.
    assert.deepEqual(revocations, ["après 2 retrait(s)"], "les autres sessions restent ouvertes après le retrait (ou sont fermées AVANT)");
    assert.equal(revocations.length, 1, "des sessions sont fermées alors que le retrait a été refusé");
    const nonFermees: string[] = [];
    const sansRevoc = await retirerDeuxFacteurs({ ...d(jeton({ amr: [{ method: "otp", timestamp: t() }] }), { revoquer: async () => "session_not_found" }), prevenir: async () => {}, journaliser: async (_u, m) => { nonFermees.push(m); } });
    assert.equal(sansRevoc.status, 200, "un échec de déconnexion annule un retrait déjà fait");
    assert.ok(nonFermees.some((m) => /autres sessions/.test(m)), "un échec de déconnexion des autres sessions n'est pas journalisé");
    const echec = await retirerDeuxFacteurs(d(jeton({ amr: [{ method: "otp", timestamp: t() }] }), { supprimer: async () => "boom" }));
    assert.equal(echec.status, 500);
    const illisible = await retirerDeuxFacteurs(d(jeton({ amr: [{ method: "otp", timestamp: t() }] }), { lister: async () => ({ erreur: "down" }) }));
    assert.equal(illisible.status, 503);
    assert.equal(notes.length, 2, "un échec du retrait n'est pas journalisé");
    assert.equal(avis.length, 1, "un avis « retirée » est parti alors que rien n'a été retiré");
  });

  await test("avis d'activation : seulement si un facteur est vérifié, à SA propre adresse, limité", async () => {
    const avis: string[] = [];
    const d = (user: unknown, autorise = true) => ({
      utilisateur: async () => user as never,
      autoriser: async () => autorise,
      prevenir: async (email: string) => { avis.push(email); return true; },
    });
    assert.equal((await avertirActivation(d(null))).status, 401);
    assert.equal((await avertirActivation(d({ id: "u", email: "a@b.fr", factors: [{ status: "unverified" }] }))).body.error, "sans_deux_facteurs",
      "un avis « activée » part pour un enrôlement jamais validé");
    assert.equal((await avertirActivation(d({ id: "u", email: "a@b.fr", factors: VERIFIE }, false))).status, 429);
    assert.equal(avis.length, 0);
    assert.equal((await avertirActivation(d({ id: "u", email: "marie@exemple.fr", factors: VERIFIE }))).status, 200);
    assert.deepEqual(avis, ["marie@exemple.fr"]);
    assert.match(code("src/components/settings/DeuxFacteurs.tsx"), /toast\.success\(L\.activee\);\s*void fetch\("\/api\/auth\/2fa\/activee"/,
      "l'activation ne prévient plus le titulaire");
    assert.match(code("src/app/api/auth/2fa/activee/route.ts"), /import \{ createClient \} from "@\/lib\/supabase\/server";/,
      "la route d'avis lit la session sans la garde du second facteur");
    // Relecture du 08/11 : sans variables d'envoi, le seul garde-fou partait en silence.
    for (const f of ["src/app/api/auth/2fa/activee/route.ts", "src/app/api/auth/2fa/perdu/route.ts"]) {
      assert.match(code(f), /if \(!process\.env\.RESEND_API_KEY \|\| !FROM \|\| !BASE\) \{\s*(\/\/[^\n]*\s*)?await journaliser\(/, `${f} : un e-mail de sécurité impossible ne laisse aucune trace`);
    }
    const v = code("src/app/(auth)/verification-2fa/page.tsx");
    assert.match(v, /if \(error\) \{ toast\.error\(L\.erreur, \{ duration: 8000 \}\); return; \}/, "une panne de GoTrue renvoie en silence vers la connexion");
  });

  await test("/auth/confirm ne redirige que vers un chemin du site", () => {
    // Avant : `${origin}${next}` avec `next=@site-tiers.fr` = https://pacevo.fr@site-tiers.fr, hors du site.
    assert.match(code("src/app/auth/confirm/route.ts"), /const next = cheminSur\(searchParams\.get\("next"\)\);/, "redirection ouverte depuis un lien e-mail");
  });

  await test("le lien mène à l'écran de retrait, et le retrait passe par l'API d'administration", () => {
    const perdu = code("src/app/api/auth/2fa/perdu/route.ts");
    assert.match(perdu, /&type=recovery&next=\/verification-2fa\/retrait`/);
    assert.match(perdu, /generateLink\(\{ type: "recovery", email \}/);
    const retirer = code("src/app/api/auth/2fa/retirer/route.ts");
    assert.match(retirer, /admin\.auth\.admin\.mfa\.deleteFactor\(\{ id, userId \}\)/);
    assert.match(retirer, /supabase\.auth\.signOut\(\{ scope: "others" \}\)/, "les autres sessions ne sont pas déconnectées par GoTrue");
    assert.match(code("src/app/(auth)/verification-2fa/retrait/page.tsx"), /"\/api\/auth\/2fa\/retirer"/);
  });

  // ── 4. L'ÉCRAN DES RÉGLAGES ─────────────────────────────────────────────────────────────
  await test("réglages : activation par QR, clé cachée par défaut, désactivation par GoTrue", () => {
    const c = code("src/components/settings/DeuxFacteurs.tsx");
    assert.match(c, /auth\.mfa\.enroll\(\{ factorType: "totp"/);
    assert.match(c, /auth\.mfa\.challengeAndVerify\(\{ factorId: enrolement\.id, code \}\)/, "le facteur serait actif sans premier code vérifié");
    assert.match(c, /const \[voirCle, setVoirCle\] = useState\(false\);/, "la clé secrète s'affiche d'office (capture d'écran = fuite, vu le 23/08)");
    assert.match(c, /auth\.mfa\.unenroll\(\{ factorId: actif \}\)/);
    // Relecture du 08/11 : une lecture en échec affichait « Désactivée » — un faux état de sécurité.
    assert.match(c, /setActif\(error \? false : /, "une lecture des facteurs en échec s'affiche comme « double authentification désactivée »");
    assert.match(c, /if \(actif === false\) \{[\s\S]{0,200}\{L\.illisible\}/, "l'état illisible n'est pas dit à l'écran");
    assert.match(c, /if \(eListe\) \{ setOccupe\(false\); toast\.error\(L\.erreur\); return; \}/, "l'activation ignore l'échec de la lecture des facteurs");
    assert.match(c, /if \(eRetrait\) \{ setOccupe\(false\); toast\.error\(L\.erreur\); return; \}/, "l'activation ignore l'échec du retrait d'un enrôlement abandonné");
    assert.ok(code("src/components/settings/SettingsView.tsx").includes("<DeuxFacteurs L={AUTH_L.deuxFacteurs} lang={lang} />"), "la carte n'est plus dans les réglages");
  });

  // ── 5. LA BASE (migration 041, à exécuter par Cyprien) ───────────────────────────────────
  await test("migration 041 : politique RESTRICTIVE aal2 sur chaque table sous RLS, relançable sans DROP", () => {
    const sql = readFileSync("supabase/migrations/041_mfa_aal2.sql", "utf8").split("\n").map((l) => l.replace(/\s*--.*$/, "")).join("\n");
    assert.match(sql, /create or replace function public\.exigence_mfa_respectee\(\)/);
    assert.match(sql, /\(auth\.jwt\(\) ->> 'aal'\) = 'aal2'/);
    assert.match(sql, /f\.status = 'verified'/);
    assert.match(sql, /security definer\s+set search_path = ''/);
    assert.match(sql, /revoke all on function public\.exigence_mfa_respectee\(\) from public, anon;/);
    assert.match(sql, /as restrictive for all to authenticated/, "la politique n'est pas restrictive : elle s'ajouterait en OU aux autres");
    assert.match(sql, /c\.relrowsecurity/, "toutes les tables sous RLS ne sont pas couvertes");
    assert.match(sql, /and not exists \(\s*select 1 from pg_policies p\s*where p\.schemaname = 'public' and p\.tablename = c\.relname and p\.policyname = 'exiger_aal2_si_mfa'/,
      "le bloc n'est pas relançable : une seconde exécution échouerait sur une politique existante");
    // `storage.objects` n'a AUCUNE politique (relevé du 08/11) : aucun accès direct, rien à restreindre ;
    // y toucher risquait d'annuler tout le bloc (table de supabase_storage_admin).
    assert.ok(!/on storage\.objects/.test(sql), "la migration touche storage.objects : risque d'échec de tout le bloc");
  });

  // ── 6. LES TEXTES ───────────────────────────────────────────────────────────────────────
  await test("textes et e-mails dans les cinq langues", () => {
    for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
      const d = AUTH[lg].deuxFacteurs as Record<string, string>;
      for (const [k, fr] of Object.entries(AUTH.fr.deuxFacteurs)) assert.ok(d[k] && (lg === "fr" || d[k] !== fr), `${lg} : deuxFacteurs.${k} absent ou non traduit`);
      const lien = emailRetraitDeuxFacteurs(lg, "https://pacevo.fr", "https://pacevo.fr/auth/confirm?x=1");
      assert.ok(lien.html.includes("https://pacevo.fr/auth/confirm?x=1") && lien.objet, `${lg} : e-mail de retrait sans lien`);
      assert.ok(emailDeuxFacteursRetiree(lg, "https://pacevo.fr").html.includes("/dashboard/settings"), `${lg} : avis de retrait sans renvoi aux réglages`);
      assert.ok(emailDeuxFacteursActivee(lg, "https://pacevo.fr").html.includes("/dashboard/settings"), `${lg} : avis d'activation absent`);
    }
    // Relecture du 08/11 : l'e-mail de retrait dit D'ABORD de ne pas cliquer si on n'a rien demandé.
    assert.match(emailRetraitDeuxFacteurs("fr", "b", "l").texte, /^Téléphone perdu \?\n\nSi tu n'as rien demandé, ne clique pas/, "l'avertissement n'est plus en tête");
    assert.match(emailRetraitDeuxFacteurs("en", "b", "l").texte, /\n\nIf you didn't ask for this, don't click/);
    assert.notEqual(emailDeuxFacteursActivee("de", "b").objet, emailDeuxFacteursActivee("fr", "b").objet);
    assert.notEqual(emailRetraitDeuxFacteurs("en", "b", "l").objet, emailRetraitDeuxFacteurs("fr", "b", "l").objet, "l'e-mail anglais est en français");
  });

  console.log(`\n${passes} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) process.exit(1);
})();
