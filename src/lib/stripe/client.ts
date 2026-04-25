import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
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
