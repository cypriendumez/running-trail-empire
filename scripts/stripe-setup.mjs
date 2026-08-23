/**
 * MISE EN PLACE STRIPE, EN UNE COMMANDE.
 *
 *   node scripts/stripe-setup.mjs <url-du-site>
 *
 * Crée, chez Stripe, tout ce que le code attend : les deux produits, les quatre tarifs,
 * le point de terminaison du webhook et la configuration du portail client. Puis écrit
 * les six valeurs dans `.env.local`.
 *
 * ── POURQUOI CE SCRIPT PLUTÔT QUE DES CLICS ─────────────────────────────────
 * Les quatre tarifs, les six événements et les six réglages du portail se saisissent à
 * la main en une vingtaine de clics, et une seule erreur ne se voit nulle part : un
 * montant à 9,90 au lieu de 9,99, un événement oublié, une case « annulation » non
 * cochée. Ici, les montants viennent de `lib/billing/prix`, la même source que la page
 * d'offres — ils ne peuvent pas diverger de ce que le site affiche.
 *
 * ── IDEMPOTENT ──────────────────────────────────────────────────────────────
 * Relancer ne crée pas de doublons : les tarifs portent une `lookup_key` stable, les
 * produits une métadonnée, et le webhook est reconnu à son URL. C'est ce qui permet de
 * le rejouer sans crainte quand on passe du mode test au mode réel.
 *
 * ── GARDE-FOU MODE RÉEL ─────────────────────────────────────────────────────
 * ⚠️ Une clé `sk_live_` est REFUSÉE sans `--live`. Créer des produits sur un compte réel
 * par mégarde, en croyant travailler en test, laisse des tarifs fantômes qu'on ne peut
 * pas supprimer — Stripe ne permet que de les archiver. Le mode réel doit être un acte
 * volontaire, pas le résultat d'une variable oubliée.
 */
import { readFileSync, writeFileSync } from "node:fs";
import Stripe from "stripe";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);

const cle = env.STRIPE_SECRET_KEY;
const siteUrl = (process.argv[2] || env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
const live = process.argv.includes("--live");

if (!cle) {
  console.error("✗ STRIPE_SECRET_KEY est vide dans .env.local.");
  console.error("  Récupère une clé de TEST sur https://dashboard.stripe.com/test/apikeys");
  console.error("  (elle commence par sk_test_), colle-la, puis relance.");
  process.exit(1);
}
if (cle.startsWith("sk_live_") && !live) {
  console.error("✗ Clé de mode RÉEL détectée, et --live n'a pas été passé.");
  console.error("  Créer des tarifs par mégarde sur un compte réel laisse des lignes");
  console.error("  qu'on ne peut plus supprimer, seulement archiver. Relance avec --live");
  console.error("  si c'est bien ce que tu veux.");
  process.exit(1);
}
if (!/^https:\/\//.test(siteUrl)) {
  console.error(`✗ URL du site invalide : « ${siteUrl} ».`);
  console.error("  Passe l'adresse publique en argument, par exemple :");
  console.error("  node scripts/stripe-setup.mjs https://mon-site.vercel.app");
  process.exit(1);
}

// Les montants viennent de la MÊME source que la page d'offres. Les recopier ici aurait
// créé une deuxième vérité, et c'est précisément le défaut que ce projet traque.
const { PRIX_AFFICHES } = await import("../src/lib/billing/prix.ts");

const stripe = new Stripe(cle, { apiVersion: "2024-06-20" });
const mode = cle.startsWith("sk_live_") ? "RÉEL" : "test";
console.log(`\n▸ Compte Stripe en mode ${mode} · site ${siteUrl}\n`);

const FORMULES = [
  { cle: "starter", nom: "Pacevo Starter", desc: "Le plan complet de 7 jours, replanifié à chaque sortie." },
  { cle: "premium", nom: "Pacevo Premium", desc: "Le coach complet, plus les outils de préparation." },
];
const PERIODES = [
  { cle: "mois", interval: "month", suffixe: "MONTHLY" },
  { cle: "an", interval: "year", suffixe: "YEARLY" },
];

const trouve = async (liste, predicat) => (await liste).data.find(predicat);
const nouvelles = {};

for (const f of FORMULES) {
  // Le produit est reconnu à sa métadonnée, pas à son nom : renommer « Pacevo Starter »
  // dans le tableau de bord ne doit pas provoquer la création d'un doublon.
  const produits = stripe.products.list({ limit: 100, active: true });
  let produit = await trouve(produits, (p) => p.metadata?.pacevo_formule === f.cle);
  if (produit) {
    console.log(`  = produit ${f.nom} déjà présent (${produit.id})`);
  } else {
    produit = await stripe.products.create({
      name: f.nom, description: f.desc, metadata: { pacevo_formule: f.cle },
    });
    console.log(`  + produit ${f.nom} créé (${produit.id})`);
  }

  for (const p of PERIODES) {
    const lookup = `pacevo_${f.cle}_${p.cle}`;
    const montant = PRIX_AFFICHES[f.cle][p.cle];
    const existants = await stripe.prices.list({ lookup_keys: [lookup], limit: 1 });
    let prix = existants.data[0];
    // ⚠️ UN TARIF NE SE MODIFIE PAS chez Stripe : si le montant a changé, on en crée un
    // neuf et on archive l'ancien. Écraser serait impossible, et laisser l'ancien actif
    // ferait payer deux prix différents selon la date d'abonnement.
    if (prix && prix.unit_amount !== montant) {
      await stripe.prices.update(prix.id, { active: false, lookup_key: null });
      console.log(`  ~ ancien tarif ${lookup} archivé (${(prix.unit_amount / 100).toFixed(2)} €)`);
      prix = undefined;
    }
    if (!prix) {
      prix = await stripe.prices.create({
        product: produit.id, currency: "eur", unit_amount: montant,
        recurring: { interval: p.interval }, lookup_key: lookup,
      });
      console.log(`  + tarif ${lookup} : ${(montant / 100).toFixed(2)} € / ${p.cle} (${prix.id})`);
    } else {
      console.log(`  = tarif ${lookup} déjà au bon montant (${prix.id})`);
    }
    nouvelles[`STRIPE_PRICE_${f.cle.toUpperCase()}_${p.suffixe}`] = prix.id;
  }
}

// ── Webhook ────────────────────────────────────────────────────────────────
// Les six événements sont ceux que le code traite VRAIMENT : trois pour le cycle de vie
// de l'abonnement, `invoice.paid` et `charge.refunded` pour la comptabilité,
// `invoice.payment_failed` pour prévenir l'athlète avant de le perdre.
const EVENEMENTS = [
  "customer.subscription.created", "customer.subscription.updated",
  "customer.subscription.deleted", "invoice.paid",
  "invoice.payment_failed", "charge.refunded",
];
const urlWebhook = `${siteUrl}/api/stripe/webhook`;
const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
const dejaLa = hooks.data.find((h) => h.url === urlWebhook);
if (dejaLa) {
  await stripe.webhookEndpoints.update(dejaLa.id, { enabled_events: EVENEMENTS });
  console.log(`\n  = webhook déjà en place (${dejaLa.id}), événements remis à jour`);
  console.log("  ⚠️ Le secret d'un webhook existant n'est PLUS lisible par l'API.");
  console.log("     Récupère-le dans le tableau de bord, ou supprime le point de");
  console.log("     terminaison et relance ce script pour en obtenir un neuf.");
} else {
  const hook = await stripe.webhookEndpoints.create({
    url: urlWebhook, enabled_events: EVENEMENTS, description: "Pacevo",
  });
  nouvelles.STRIPE_WEBHOOK_SECRET = hook.secret;
  console.log(`\n  + webhook créé sur ${urlWebhook} (${hook.id})`);
}

// ── Portail client ─────────────────────────────────────────────────────────
// ⚠️ PAR DÉFAUT, LE PORTAIL NE PROPOSE PRESQUE RIEN. Sans cette configuration, le bouton
// « Gérer mon abonnement » mène à une page où l'on ne peut ni changer de formule ni
// résilier — c'est-à-dire exactement ce qu'on vient de corriger dans l'application.
const tousLesTarifs = Object.entries(nouvelles)
  .filter(([k]) => k.startsWith("STRIPE_PRICE_")).map(([, v]) => v);
const produitsPortail = [];
for (const f of FORMULES) {
  const ids = [`STRIPE_PRICE_${f.cle.toUpperCase()}_MONTHLY`, `STRIPE_PRICE_${f.cle.toUpperCase()}_YEARLY`]
    .map((k) => nouvelles[k]).filter(Boolean);
  if (!ids.length) continue;
  const prix = await stripe.prices.retrieve(ids[0]);
  produitsPortail.push({ product: prix.product, prices: ids });
}
const config = {
  business_profile: {
    privacy_policy_url: `${siteUrl}/confidentialite`,
    terms_of_service_url: `${siteUrl}/terms`,
  },
  features: {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ["email", "address", "name"] },
    // « À la fin de la période » et non « immédiatement » : l'athlète garde l'accès
    // qu'il a payé. Couper sur-le-champ, c'est encaisser un mois puis fermer la porte.
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] },
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "create_prorations",
      products: produitsPortail,
    },
  },
};
const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
const mienne = configs.data.find((c) => c.metadata?.pacevo === "1");
if (mienne) {
  await stripe.billingPortal.configurations.update(mienne.id, config);
  console.log(`  = portail client mis à jour (${mienne.id})`);
} else {
  const c = await stripe.billingPortal.configurations.create({ ...config, metadata: { pacevo: "1" }, default_return_url: `${siteUrl}/dashboard/settings` });
  await stripe.billingPortal.configurations.update(c.id, { active: true });
  console.log(`  + portail client configuré (${c.id})`);
}

// ── Écriture dans .env.local ───────────────────────────────────────────────
let contenu = readFileSync(".env.local", "utf8");
for (const [k, v] of Object.entries(nouvelles)) {
  const motif = new RegExp(`^${k}=.*$`, "m");
  contenu = motif.test(contenu) ? contenu.replace(motif, `${k}=${v}`) : `${contenu.trimEnd()}\n${k}=${v}\n`;
}
writeFileSync(".env.local", contenu);
console.log(`\n▸ ${Object.keys(nouvelles).length} valeur(s) écrite(s) dans .env.local :`);
for (const k of Object.keys(nouvelles)) console.log(`    ${k}`);
console.log("\n▸ Il reste à les pousser sur Vercel, puis à redéployer.\n");
