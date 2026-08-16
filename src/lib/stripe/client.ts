import Stripe from "stripe";
import type { Acces } from "@/lib/billing/access";

/**
 * LES QUATRE TARIFS — deux formules × deux périodicités.
 *
 * ⚠️ « Annuel » n'est PAS une formule, c'est une périodicité. La page en faisait une
 * troisième carte, ce qui obligeait à lui inventer des exclusivités pour la remplir :
 * c'est de là que venaient « Posture Lab » et « Accès API développeur », deux
 * fonctionnalités qui n'existent pas. Deux formules, un sélecteur.
 *
 * L'écart de 5 € suit le COÛT RÉEL et rien d'autre : `autoPlan` et `autoCoach` sont
 * déterministes, donc Essentiel ne coûte quasiment rien à servir ; Complet ajoute l'IA
 * qui parle, seule partie dont la dépense grandit avec le nombre d'athlètes.
 *
 * Remise annuelle : deux mois offerts (−17 %). L'ancien « −33 % » (80 € contre 120 €)
 * bradait l'abonnement sans raison.
 */
export const TARIFS = {
  essentiel: {
    acces: "essentiel" as Extract<Acces, "essentiel" | "complet">,
    mois:  { centimes:  999, env: "STRIPE_PRICE_ESSENTIEL_MONTHLY" },
    an:    { centimes: 9990, env: "STRIPE_PRICE_ESSENTIEL_YEARLY" },
  },
  complet: {
    acces: "complet" as Extract<Acces, "essentiel" | "complet">,
    mois:  { centimes: 1499, env: "STRIPE_PRICE_COMPLET_MONTHLY" },
    an:    { centimes: 14990, env: "STRIPE_PRICE_COMPLET_YEARLY" },
  },
} as const;

export type Formule = keyof typeof TARIFS;
export type Periode = "mois" | "an";

export const FORMULES = Object.keys(TARIFS) as Formule[];
export const estFormule = (v: unknown): v is Formule => FORMULES.includes(v as Formule);
export const estPeriode = (v: unknown): v is Periode => v === "mois" || v === "an";

/** L'identifiant de tarif Stripe d'une combinaison, ou une chaîne vide s'il manque. */
export const priceIdDe = (f: Formule, p: Periode): string => process.env[TARIFS[f][p].env] ?? "";

/**
 * L'ACCÈS QUE DONNE UN TARIF ACHETÉ.
 *
 * Le webhook écrivait « pro » EN DUR, quelle que soit la formule payée : un athlète qui
 * prenait Essentiel obtenait donc l'IA, et l'écart de prix entre les deux formules ne
 * voulait plus rien dire. On remonte désormais du `price` de l'abonnement vers la
 * formule, et on retombe sur `complet` si le tarif est inconnu — jamais l'inverse :
 * quelqu'un qui a payé ne doit pas se retrouver sans accès parce qu'une variable
 * d'environnement manque.
 */
export function accesDuPrice(priceId: string | null | undefined): Extract<Acces, "essentiel" | "complet"> {
  const id = String(priceId ?? "");
  if (!id) return "complet";
  for (const f of FORMULES) {
    for (const p of ["mois", "an"] as const) {
      if (priceIdDe(f, p) && priceIdDe(f, p) === id) return TARIFS[f].acces;
    }
  }
  // Les deux anciens tarifs uniques donnaient tout : ils restent « complet ».
  return "complet";
}

/**
 * Le paiement est-il réellement configuré ?
 *
 * Sans cette vérification, un athlète qui clique sur « S'abonner » déclenchait un appel
 * Stripe avec une clé absente : erreur 500 opaque côté serveur, message générique côté
 * écran, aucune indication de la cause. Mieux vaut dire franchement que le paiement
 * n'est pas encore ouvert — ce qui est le cas aujourd'hui, les cinq variables étant vides.
 */
export const stripeConfigured = Boolean(
  process.env.STRIPE_SECRET_KEY
  && FORMULES.every((f) => priceIdDe(f, "mois") && priceIdDe(f, "an")),
);

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_not_configured", {
  apiVersion: "2024-06-20",
  typescript: true,
});
