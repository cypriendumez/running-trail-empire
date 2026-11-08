/**
 * GARDE — le CAPTCHA Cloudflare Turnstile (08/11/2026), en sommeil tant que les clés manquent.
 *
 * Constat d'origine : la connexion part du navigateur directement vers GoTrue ; aucune limite de
 * l'application ne s'y applique, seule celle de Supabase par adresse IP. Le CAPTCHA de Supabase
 * est vérifié par GoTrue lui-même — mais GoTrue en DISPENSE les appels faits avec la clé
 * d'administration (`verifyCaptcha` → `requireAdminCredentials`, v2.197), c'est-à-dire notre
 * inscription et notre « mot de passe oublié » (`generateLink`). Ces deux routes vérifient donc
 * le jeton elles-mêmes, et la vérification du mot de passe actuel (une connexion GoTrue faite par
 * le serveur) doit transmettre le jeton du navigateur.
 *
 *   npx tsx tests/captcha.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifierCaptcha, controlerCaptcha } from "../src/lib/auth/turnstile";
import { changerMotDePasse, type DependancesChangement } from "../src/lib/auth/changerMotDePasse";
import { AUTH } from "../src/components/auth/authI18n";

let passes = 0;
const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(nom); console.log(`  ✗ ${nom}\n      ${e instanceof Error ? e.message : String(e)}`); }
}

/** Le source sans ses commentaires — sans couper les « :// » des URL. */
function code(f: string): string {
  return readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1")).join("\n");
}

/** Un faux Cloudflare : enregistre l'appel, répond le corps JSON (ou l'erreur) donné. */
function fauxCloudflare(rep: unknown, statut = 200) {
  const appels: { url: string; corps: string }[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), corps: String(init?.body ?? "") });
    if (rep instanceof Error) throw rep;
    return new Response(JSON.stringify(rep), { status: statut });
  }) as typeof fetch;
  return { f, appels };
}

const S = "secret-de-test";

void (async () => {
  // ── 1. LE VÉRIFICATEUR SERVEUR ──────────────────────────────────────────────────────────
  await test("sans clé secrète : en sommeil, aucun appel à Cloudflare", async () => {
    const c = fauxCloudflare({ success: true });
    assert.equal(await verifierCaptcha("jeton", "1.2.3.4", { secret: "", fetchImpl: c.f }), "inactif");
    assert.equal(c.appels.length, 0, "Cloudflare interrogé alors que le CAPTCHA est éteint");
  });

  await test("jeton absent, vide ou démesuré : refusé sans appel", async () => {
    const c = fauxCloudflare({ success: true });
    for (const j of [undefined, null, "", "   ", 42, "x".repeat(2049)]) {
      assert.equal(await verifierCaptcha(j, null, { secret: S, fetchImpl: c.f }), "refuse", `jeton ${JSON.stringify(j)?.slice(0, 20)} accepté`);
    }
    assert.equal(c.appels.length, 0);
  });

  await test("Cloudflare répond : succès → ok ; jeton faux, expiré ou rejoué → refusé", async () => {
    const ok = fauxCloudflare({ success: true });
    assert.equal(await verifierCaptcha("bon", "1.2.3.4", { secret: S, fetchImpl: ok.f }), "ok");
    assert.equal(ok.appels[0].url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const corps = new URLSearchParams(ok.appels[0].corps);
    assert.deepEqual([corps.get("secret"), corps.get("response"), corps.get("remoteip")], [S, "bon", "1.2.3.4"], "la requête siteverify est incomplète");
    for (const codes of [["invalid-input-response"], ["timeout-or-duplicate"], ["missing-input-response"]]) {
      assert.equal(await verifierCaptcha("x", null, { secret: S, fetchImpl: fauxCloudflare({ success: false, "error-codes": codes }).f }), "refuse", `${codes} accepté`);
    }
    const sansIp = fauxCloudflare({ success: true });
    await verifierCaptcha("bon", "inconnue", { secret: S, fetchImpl: sansIp.f });
    assert.equal(new URLSearchParams(sansIp.appels[0].corps).get("remoteip"), null, "« inconnue » est envoyée comme adresse IP");
  });

  await test("Cloudflare en panne → inconnu (jamais « ok », jamais « refusé »)", async () => {
    assert.equal(await verifierCaptcha("x", null, { secret: S, fetchImpl: fauxCloudflare(new Error("ECONNRESET")).f }), "inconnu");
    assert.equal(await verifierCaptcha("x", null, { secret: S, fetchImpl: fauxCloudflare({}, 503).f }), "inconnu");
    assert.equal(await verifierCaptcha("x", null, { secret: S, fetchImpl: fauxCloudflare({ success: false, "error-codes": ["internal-error"] }).f }), "inconnu");
  });

  await test("clé secrète fausse ou périmée : ce n'est pas un robot — accepté, et la cause va au journal", async () => {
    // Relecture du 08/11 : `invalid-input-secret` refusait 100 % des inscriptions, comme à des robots, sans trace.
    for (const codes of [["invalid-input-secret"], ["missing-input-secret"], ["bad-request"], [], ["invalid-input-response", "invalid-input-secret"]]) {
      assert.equal(await verifierCaptcha("x", null, { secret: S, fetchImpl: fauxCloudflare({ success: false, "error-codes": codes }).f }), "inconnu",
        `${JSON.stringify(codes)} : une erreur de NOTRE configuration refuserait tout le monde`);
    }
    const notes: string[] = [];
    await controlerCaptcha("x", null, "/t", { secret: S, fetchImpl: fauxCloudflare({ success: false, "error-codes": ["invalid-input-secret"] }).f, journal: async (m) => { notes.push(m); } });
    assert.ok(notes.length === 1 && notes[0].includes("invalid-input-secret"), "le code de Cloudflare n'arrive pas au journal : impossible de voir que la clé est fausse");
  });

  await test("contrôle d'une route : panne acceptée MAIS journalisée ; refus sans journal", async () => {
    const notes: string[] = [];
    const journal = async (m: string) => { notes.push(m); };
    assert.equal(await controlerCaptcha("x", null, "/t", { secret: S, fetchImpl: fauxCloudflare(new Error("down")).f, journal }), "accepte");
    assert.equal(notes.length, 1, "une panne de Cloudflare laisse passer EN SILENCE");
    assert.equal(await controlerCaptcha("x", null, "/t", { secret: S, fetchImpl: fauxCloudflare({ success: false, "error-codes": ["invalid-input-response"] }).f, journal }), "refuse");
    assert.equal(await controlerCaptcha("x", null, "/t", { secret: "", journal }), "accepte", "CAPTCHA éteint : la route doit fonctionner comme avant");
    assert.equal(notes.length, 1, "un refus ou un CAPTCHA éteint écrit au journal");
  });

  // ── 2. LES ROUTES QUE GOTRUE DISPENSE ───────────────────────────────────────────────────
  await test("inscription : jeton vérifié AVANT la création du compte, refus = captcha_refuse", () => {
    const src = code("src/app/api/auth/confirmation/route.ts");
    const post = src.slice(src.indexOf("export async function POST"), src.indexOf("async function envoyerConfirmation"));
    const iCaptcha = post.indexOf('controlerCaptcha(captcha, ipDe(req), "/api/auth/confirmation")');
    assert.ok(iCaptcha > 0, "l'inscription ne vérifie plus le CAPTCHA");
    assert.ok(iCaptcha < post.indexOf("domaineRecoitDuCourrier(") && iCaptcha < post.indexOf("controlerNouveauMotDePasse("), "le CAPTCHA arrive après les appels réseau coûteux");
    assert.ok(iCaptcha < post.lastIndexOf("return envoyerConfirmation(adresse, mdp"), "le compte est créé avant le CAPTCHA");
    assert.match(post.slice(iCaptcha, iCaptcha + 250), /=== "refuse"\)\s*\{\s*return NextResponse\.json\(\{ ok: false, error: "captcha_refuse" \}, \{ status: 400 \}\)/, "un CAPTCHA refusé ne bloque pas l'inscription");
  });

  await test("« mot de passe oublié » : jeton vérifié AVANT l'envoi du lien", () => {
    const src = code("src/app/api/auth/reset/route.ts");
    const iCaptcha = src.indexOf('controlerCaptcha(captcha, ipDe(req), "/api/auth/reset")');
    assert.ok(iCaptcha > 0, "« mot de passe oublié » ne vérifie plus le CAPTCHA");
    assert.ok(iCaptcha < src.indexOf("generateLink("), "le lien part avant le CAPTCHA");
    // Relecture du 08/11 : AVANT le compteur par adresse, sinon un robot sans jeton épuise le quota d'un tiers.
    assert.ok(iCaptcha < src.indexOf('cleParAdresse("reset-adresse"'), "un robot sans jeton consomme les 3 liens d'une adresse avant d'être refusé");
    assert.match(src.slice(iCaptcha, iCaptcha + 250), /=== "refuse"\)\s*\{\s*return NextResponse\.json\(\{ ok: false, error: "captcha_refuse" \}/);
  });

  // ── 3. LA VÉRIFICATION DU MOT DE PASSE ACTUEL (une connexion GoTrue faite par le serveur) ──
  await test("réglages : le jeton du navigateur accompagne la vérification du mot de passe actuel", async () => {
    const recus: (string | null)[] = [];
    const ecrits: string[] = [];
    const d: DependancesChangement = {
      utilisateur: async () => ({ id: "u1", email: "marie@exemple.fr", identities: [{ provider: "email" }] }),
      jetonAcces: async () => undefined,
      autoriser: async () => true,
      verifierActuel: async (_e, _m, captcha) => { recus.push(captcha); return captcha === "bon-jeton" ? "ok" : "captcha"; },
      controler: async () => ({ ok: true, fuiteVerifiee: true }),
      ecrire: async (mdp) => { ecrits.push(mdp); return { error: null }; },
      journaliser: async () => {},
    };
    const refus = await changerMotDePasse({ password: "Foulee-Tempo-42", actuel: "Ancien-Mdp-2025", captcha: "jeton-rejoue" }, d);
    assert.deepEqual([refus.status, refus.body.error], [400, "captcha_refuse"], "un CAPTCHA refusé par GoTrue n'est pas dit à l'écran");
    assert.equal(ecrits.length, 0, "mot de passe écrit malgré un CAPTCHA refusé");
    const ok = await changerMotDePasse({ password: "Foulee-Tempo-42", actuel: "Ancien-Mdp-2025", captcha: "bon-jeton" }, d);
    assert.equal(ok.status, 200);
    assert.deepEqual(recus, ["jeton-rejoue", "bon-jeton"], "le jeton du navigateur n'arrive pas jusqu'à la vérification");
    const route = code("src/app/api/auth/mot-de-passe/route.ts");
    assert.match(route, /signInWithPassword\(\{ email, password: motActuel, \.\.\.\(captcha \? \{ options: \{ captchaToken: captcha \} \} : \{\}\) \}\)/, "la connexion de vérification part sans le jeton : GoTrue la refuserait une fois le CAPTCHA activé");
    assert.match(route, /=== "captcha_failed"\) return "captcha"/, "un refus CAPTCHA de GoTrue est pris pour une panne");
  });

  // ── 4. LES ÉCRANS ───────────────────────────────────────────────────────────────────────
  await test("chaque écran affiche le widget, envoie le jeton et en redemande un après chaque envoi", () => {
    const login = code("src/app/(auth)/login/page.tsx");
    assert.match(login, /options: \{ captchaToken: captcha \?\? undefined \}/, "la connexion n'envoie pas le jeton à GoTrue");
    assert.match(login, /"captcha_failed"/, "un refus CAPTCHA à la connexion s'affiche comme un mauvais mot de passe");
    for (const [f, envoi] of [
      ["src/app/(auth)/login/page.tsx", null],
      ["src/app/(auth)/signup/page.tsx", /JSON\.stringify\(\{ captcha, email: form\.email/],
      ["src/app/(auth)/forgot-password/page.tsx", /lang, captcha \}\)/],
      ["src/components/settings/SettingsView.tsx", /captcha: captchaMdp/],
    ] as [string, RegExp | null][]) {
      const s = code(f);
      assert.ok(s.includes("<Turnstile ref="), `${f} n'affiche pas le widget`);
      assert.ok(/\.current\?\.reinitialiser\(\)/.test(s), `${f} réutilise un jeton déjà consommé`);
      if (envoi) assert.match(s, envoi, `${f} n'envoie pas le jeton au serveur`);
    }
    const widget = code("src/components/auth/Turnstile.tsx");
    assert.match(widget, /if \(!CLE_TURNSTILE\) return null;/, "sans clé, le widget s'affiche quand même");
    assert.match(widget, /if \(!CLE_TURNSTILE \|\| !boite\.current\) return;/, "sans clé, le script de Cloudflare est chargé quand même");
    // Relecture du 08/11 : widget bloqué (bloqueur de pub) = « patiente » sans fin, sans cause.
    assert.match(widget, /\.catch\(\(\) => \{ rappel\.current\(null\); erreur\.current\?\.\(\); \}\)/, "un script Cloudflare bloqué n'est signalé à personne");
    assert.match(widget, /"error-callback": \(\) => \{ rappel\.current\(null\); erreur\.current\?\.\(\); \}/);
    for (const f of ["src/app/(auth)/login/page.tsx", "src/app/(auth)/signup/page.tsx", "src/app/(auth)/forgot-password/page.tsx", "src/components/settings/SettingsView.tsx"]) {
      const s = code(f);
      assert.ok(/onErreur=\{\(\) => setCaptchaHs\(true\)\}/.test(s) && /captchaHs \? (C|D\.captcha|AUTH_L\.captcha)\.indisponible/.test(s), `${f} : un widget en panne laisse le coureur attendre sans cause`);
    }
  });

  await test("« mot de passe oublié » : une panne de génération du lien laisse une trace", () => {
    const src = code("src/app/api/auth/reset/route.ts");
    const branche = src.slice(src.indexOf("if (error || !jeton) {"), src.indexOf("const lien = `${BASE}/auth/confirm"));
    assert.match(branche, /await journaliser\(`Lien de réinitialisation non généré/, "un lien non généré répond 502 sans aucune trace");
    assert.match(src, /\} catch \(e\) \{\s*await journaliser\(`Réinitialisation : exception/, "une exception répond 500 sans aucune trace");
    assert.match(src, /source: "reinitialisation"/);
  });

  await test("les messages existent dans les cinq langues, et la politique ne nomme Cloudflare qu'avec la clé", () => {
    for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
      const c = AUTH[lg].captcha;
      assert.ok(c?.attente && c?.refuse && c?.indisponible && (lg === "fr" || (c.refuse !== AUTH.fr.captcha.refuse && c.indisponible !== AUTH.fr.captcha.indisponible)), `${lg} : messages CAPTCHA absents ou non traduits`);
    }
    const legal = code("src/app/legalI18n.ts");
    assert.match(legal, /const avecTurnstile = \(texte: string\): string\[\] => \(process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY \? \[texte\] : \[\]\);/);
    assert.equal((legal.match(/\.\.\.avecTurnstile\("Cloudflare/g) ?? []).length, 5, "Cloudflare n'est pas nommé dans les cinq langues");
  });

  console.log(`\n${passes} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) process.exit(1);
})();
