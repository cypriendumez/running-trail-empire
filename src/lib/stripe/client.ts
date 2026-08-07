import Stripe from "stripe";

/**
 * Le paiement est-il réellement configuré ?
 *
 * Sans cette vérification, un athlète qui clique sur « Passe au Pro » déclenchait un
 * appel Stripe avec une clé absente : erreur 500 opaque côté serveur, message générique
 * côté écran, et aucune indication de la cause. Mieux vaut dire franchement que le
 * paiement n'est pas encore ouvert.
 */
export const stripeConfigured = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY && process.env.STRIPE_PRICE_YEARLY,
);

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_not_configured", {
  apiVersion: "2024-06-20",
  typescript: true,
});

export const PLANS = {
  monthly: {
    name: "Pro Mensuel",
    price: 1000, // centimes
    interval: "month" as const,
    priceId: process.env.STRIPE_PRICE_MONTHLY!,
  },
  yearly: {
    name: "Pro Annuel",
    price: 8000,
    interval: "year" as const,
    priceId: process.env.STRIPE_PRICE_YEARLY!,
  },
} as const;
