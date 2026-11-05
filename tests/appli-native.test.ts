/**
 * L'APPLI DES STORES (iPhone, Android) — 05/11/2026.
 *
 * La coquille Capacitor (`appli/`) affiche pacevo.fr. Règles gardées ici :
 *   · dans l'appli, JAMAIS de paiement web (règle 3.1.1 d'Apple) : la page d'abonnement passe
 *     par l'achat intégré, le serveur refuse Stripe à l'appli ;
 *   · un achat store accorde l'accès au même endroit qu'un paiement Stripe
 *     (`profiles.subscription_tier`), et sa fin ne coupe pas un abonnement web en cours ;
 *   · le site n'embarque aucun paquet natif.
 *
 *   npx tsx tests/appli-native.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { estAppliNativeUA, SIGNATURE_APPLI } from "../src/lib/natif/appli";
import { formuleDuProduit, PRODUITS_STORES } from "../src/lib/billing/stores";
import { traiterEvenementStore } from "../src/lib/billing/revenuecat";
import { POST as paiement } from "../src/app/api/stripe/checkout/route";
import { POST as portail } from "../src/app/api/stripe/portal/route";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const UA_APPLI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 PacevoApp";
const UA_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

/** Faux client : enregistre les écritures, peut refuser une écriture ou une lecture. */
function fauxAdmin(o: { profil?: Record<string, unknown> | null; refuseEcriture?: boolean; refuseLecture?: boolean } = {}) {
  const ecrits: { table: string; valeurs: Record<string, unknown>; id?: unknown }[] = [];
  const client = {
    from: (table: string) => ({
      insert: (valeurs: Record<string, unknown>) => { ecrits.push({ table, valeurs }); return Promise.resolve({ error: null }); },
      update: (valeurs: Record<string, unknown>) => ({
        eq: (_c: string, id: unknown) => {
          if (!o.refuseEcriture) ecrits.push({ table, valeurs, id });
          const r = { data: o.refuseEcriture ? null : [{ id }], error: o.refuseEcriture ? { message: "refus" } : null };
          return Object.assign(Promise.resolve(r), { select: () => Promise.resolve(r) });
        },
      }),
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(o.refuseLecture
        ? { data: null, error: { message: "refus" } } : { data: o.profil ?? null, error: null }) }) }),
    }),
  };
  return { client: client as never, ecrits };
}
const ID = "ef60cb0c-e5c5-4aa5-b839-e5b5fae6c31e";
const tierEcrit = (ecrits: { table: string; valeurs: Record<string, unknown> }[]) =>
  ecrits.filter((e) => e.table === "profiles").map((e) => e.valeurs.subscription_tier);

async function main() {
  console.log("\nRECONNAÎTRE L'APPLI");

  await test("la signature de la coquille est reconnue, Safari ne l'est pas", () => {
    assert.equal(estAppliNativeUA(UA_APPLI), true);
    assert.equal(estAppliNativeUA(UA_SAFARI), false);
    assert.equal(estAppliNativeUA(`${UA_SAFARI} PacevoAppli`), false, "un mot qui commence pareil n'est pas l'appli");
    assert.equal(estAppliNativeUA(null), false);
  });

  await test("la coquille pose bien cette signature, et ouvre pacevo.fr", () => {
    const conf = readFileSync("appli/capacitor.config.ts", "utf8");
    assert.match(conf, new RegExp(`ios: \\{ appendUserAgent: "${SIGNATURE_APPLI}"`));
    assert.match(conf, new RegExp(`android: \\{ appendUserAgent: "${SIGNATURE_APPLI}"`));
    assert.match(conf, /url: "https:\/\/pacevo\.fr"/);
  });

  console.log("\nAUCUN PAIEMENT WEB DANS L'APPLI");

  await test("le serveur refuse le paiement Stripe et son portail à l'appli (403)", async () => {
    const req = (url: string) => new Request(url, { method: "POST", headers: { "user-agent": UA_APPLI, "content-type": "application/json" },
      body: JSON.stringify({ formule: "premium", periode: "mois" }) });
    assert.equal((await paiement(req("http://x/api/stripe/checkout"))).status, 403);
    assert.equal((await portail(req("http://x/api/stripe/portal"))).status, 403);
  });

  await test("dans l'appli, la page d'abonnement achète par le store et cache l'offre par e-mail", () => {
    const src = codeNu("src/app/pricing/page.tsx");
    assert.match(src, /if \(natif\) return souscrireDansLAppli\(formule\);/, "le bouton d'abonnement de l'appli ouvrirait Stripe");
    assert.match(src, /\{natif \? \(/, "l'offre étudiante (achat par e-mail) n'est plus masquée dans l'appli");
    assert.match(src, /onClick=\{restaurer\}/, "pas de « Restaurer mes achats » (exigé par Apple)");
    assert.match(src, /natif \? \(prixStore\[PRODUITS_STORES/, "l'appli afficherait le prix du site au lieu de celui du store");
  });

  await test("le site n'importe aucun paquet natif (la coquille fournit le pont)", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? parcourir(p) : /\.tsx?$/.test(f) && fichiers.push(p); } };
    parcourir("src");
    const fautifs = fichiers.filter((f) => /from ["']@(capacitor|revenuecat)\//.test(readFileSync(f, "utf8")));
    assert.deepEqual(fautifs, []);
  });

  console.log("\nUN ACHAT STORE ACCORDE L'ACCÈS (webhook RevenueCat)");

  await test("chaque produit des stores a sa formule ; l'offre de base Google est lue", () => {
    assert.equal(formuleDuProduit(PRODUITS_STORES.starter.mois), "starter");
    assert.equal(formuleDuProduit(PRODUITS_STORES.premium.an), "premium");
    assert.equal(formuleDuProduit(`${PRODUITS_STORES.premium.an}:annuel`), "premium");
    assert.equal(formuleDuProduit("fr.autre.produit"), null);
  });

  await test("achat et renouvellement : la formule s'écrit sur le profil", async () => {
    for (const type of ["INITIAL_PURCHASE", "RENEWAL"]) {
      const { client, ecrits } = fauxAdmin();
      const r = await traiterEvenementStore(client, { type, app_user_id: ID, product_id: PRODUITS_STORES.premium.mois });
      assert.equal(r.statut, 200);
      assert.deepEqual(tierEcrit(ecrits), ["premium"], type);
    }
    const { client, ecrits } = fauxAdmin();
    await traiterEvenementStore(client, { type: "PRODUCT_CHANGE", app_user_id: ID, product_id: PRODUITS_STORES.premium.mois, new_product_id: PRODUITS_STORES.starter.an });
    assert.deepEqual(tierEcrit(ecrits), ["starter"], "un changement de formule garde l'ancienne");
  });

  await test("une écriture refusée par la base répond 500 (RevenueCat réessaiera) et laisse une trace", async () => {
    const { client, ecrits } = fauxAdmin({ refuseEcriture: true });
    const r = await traiterEvenementStore(client, { type: "INITIAL_PURCHASE", app_user_id: ID, product_id: PRODUITS_STORES.starter.mois });
    assert.equal(r.statut, 500);
    assert.ok(ecrits.some((e) => e.table === "error_logs"), "l'échec n'est pas journalisé");
  });

  await test("fin de l'abonnement store : retour au gratuit, SAUF abonnement web en cours", async () => {
    const sans = fauxAdmin({ profil: { stripe_subscription_id: null } });
    assert.equal((await traiterEvenementStore(sans.client, { type: "EXPIRATION", app_user_id: ID })).statut, 200);
    assert.deepEqual(tierEcrit(sans.ecrits), ["free"]);
    const avec = fauxAdmin({ profil: { stripe_subscription_id: "sub_123" } });
    await traiterEvenementStore(avec.client, { type: "EXPIRATION", app_user_id: ID });
    assert.deepEqual(tierEcrit(avec.ecrits), [], "la fin de l'achat store coupe un abonnement web payé");
    const panne = fauxAdmin({ refuseLecture: true });
    assert.equal((await traiterEvenementStore(panne.client, { type: "EXPIRATION", app_user_id: ID })).statut, 500,
      "une lecture en échec ne vaut pas « pas d'abonnement web »");
    assert.deepEqual(tierEcrit(panne.ecrits), []);
  });

  await test("ni acheteur anonyme, ni produit inconnu, ni résiliation n'écrivent d'accès", async () => {
    for (const ev of [
      { type: "INITIAL_PURCHASE", app_user_id: "$RCAnonymousID:abc", product_id: PRODUITS_STORES.premium.mois },
      { type: "INITIAL_PURCHASE", app_user_id: ID, product_id: "fr.autre.produit" },
      { type: "CANCELLATION", app_user_id: ID, product_id: PRODUITS_STORES.premium.mois },
    ]) {
      const { client, ecrits } = fauxAdmin();
      assert.equal((await traiterEvenementStore(client, ev)).statut, 200);
      assert.deepEqual(tierEcrit(ecrits), [], JSON.stringify(ev));
    }
  });

  await test("le webhook refuse sans secret configuré, et avec un mauvais secret", () => {
    const src = codeNu("src/app/api/revenuecat/webhook/route.ts");
    assert.match(src, /if \(!secret\) return NextResponse\.json\(\{ error: "Webhook non configuré" \}, \{ status: 503 \}\);/);
    assert.match(src, /if \(!memeSecret\(req\.headers\.get\("authorization"\) \?\? "", secret\)\) \{\s*return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);/);
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
