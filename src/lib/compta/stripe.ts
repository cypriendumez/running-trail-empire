import type { Ecriture } from "./model";

/**
 * UN PAIEMENT STRIPE → DES ÉCRITURES COMPTABLES.
 *
 * Fonction PURE, volontairement séparée du webhook : elle se teste avec de vrais
 * événements en fixture, sans compte Stripe, sans réseau et sans base. C'est la seule
 * façon d'avoir confiance dans un code qui ne s'exécutera pour de bon qu'au premier
 * encaissement — c'est-à-dire le jour où une erreur coûte de l'argent.
 *
 * ⚠️ ON ENREGISTRE LE MONTANT BRUT, ET LES FRAIS STRIPE À PART. Ne garder que ce qui
 * arrive sur le compte bancaire sous-estime le chiffre d'affaires : les frais sont une
 * charge déductible, pas une recette qui n'a jamais existé. Un CA amputé de ses frais,
 * c'est un CA faux — et c'est lui qu'on déclare.
 *
 * ⚠️ ET ON NE CONVERTIT AUCUNE DEVISE. Un paiement en dollars dont on enregistrerait le
 * montant tel quel entrerait dans le journal comme des euros. On refuse d'écrire, et on
 * le SIGNALE : une ligne manquante se répare, une ligne fausse ne se voit pas.
 */

/** Vue minimale d'un événement Stripe — ce qu'on lit, et rien d'autre. */
export type EvenementStripe = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export type NouvelleEcriture = Omit<Ecriture, "id"> & { stripeId: string; origine: "stripe" };

export type Conversion = {
  ecritures: NouvelleEcriture[];
  /** À signaler à l'éditeur : quelque chose s'est passé, mais rien n'a pu être écrit. */
  alerte?: string;
  /** Événement sans portée comptable : on l'ignore, sans bruit. */
  ignore?: string;
};

const nb = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const txt = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Horodatage Stripe (secondes) → date française.
 *
 * ⚠️ En heure de PARIS, pas en UTC. Un abonnement payé à 23 h 30 le 31 janvier serait
 * daté du 1ᵉʳ février en UTC — donc compté sur le mauvais mois, et au changement
 * d'année, sur le mauvais EXERCICE.
 */
export function dateParis(unixSecondes: number): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(unixSecondes * 1000));
}

export function ecrituresDeLEvenement(ev: EvenementStripe, fraisCents?: number | null): Conversion {
  const o = ev.data?.object ?? {};

  // ── Encaissement d'une facture d'abonnement ────────────────────────────────
  // ⚠️ `invoice.paid` UNIQUEMENT. Stripe émet aussi `invoice.payment_succeeded` pour la
  // même facture : traiter les deux enregistrerait chaque abonnement DEUX FOIS, et le
  // chiffre d'affaires serait doublé sans qu'aucune ligne n'ait l'air anormale.
  if (ev.type === "invoice.paid") {
    const devise = txt(o.currency).toLowerCase();
    const brut = nb(o.amount_paid);
    const facture = txt(o.number) || txt(o.id);
    const quand = nb((o.status_transitions as Record<string, unknown> | undefined)?.paid_at) || nb(o.created);
    const client = txt(o.customer_email) || txt(o.customer_name) || "Client Stripe";

    // Un coupon à 100 % produit une facture payée de 0 € : rien n'a été encaissé.
    if (brut <= 0) return { ecritures: [], ignore: `Facture ${facture} payée 0 € (remise totale)` };
    if (devise !== "eur") {
      return {
        ecritures: [],
        alerte: `Paiement de ${brut / 100} ${devise.toUpperCase()} reçu (facture ${facture}). Aucune écriture créée : l'application ne convertit pas les devises. À saisir à la main.`,
      };
    }

    const ecritures: NouvelleEcriture[] = [{
      date: dateParis(quand),
      libelle: `Abonnement — ${client}`,
      sens: "entree",
      categorie: "abonnements",
      montantCents: brut,
      moyen: "Stripe",
      tiers: client,
      piece: facture,
      note: "Enregistré automatiquement depuis Stripe.",
      origine: "stripe",
      stripeId: `invoice:${txt(o.id)}`,
    }];

    // Les frais Stripe : une charge, enregistrée à part, le même jour.
    if (typeof fraisCents === "number" && fraisCents > 0) {
      ecritures.push({
        date: dateParis(quand),
        libelle: `Frais Stripe — facture ${facture}`,
        sens: "sortie",
        categorie: "frais_bancaires",
        montantCents: fraisCents,
        moyen: "Stripe",
        tiers: "Stripe",
        piece: facture,
        note: "Commission prélevée par Stripe sur cet encaissement.",
        origine: "stripe",
        stripeId: `fee:${txt(o.id)}`,
      });
    } else {
      // ⚠️ Le dire, plutôt que de laisser croire que l'encaissement n'a rien coûté.
      ecritures[0].note = "Enregistré automatiquement depuis Stripe. Frais de commission non récupérés : à saisir à la main.";
    }
    return { ecritures };
  }

  // ── Remboursement ──────────────────────────────────────────────────────────
  // Un remboursement n'ANNULE pas la recette d'origine : celle-ci a bien eu lieu, et le
  // journal doit garder les deux mouvements. C'est une sortie, pas une gomme.
  if (ev.type === "charge.refunded") {
    const devise = txt(o.currency).toLowerCase();
    const montant = nb(o.amount_refunded);
    const quand = nb(o.created);
    const client = txt((o.billing_details as Record<string, unknown> | undefined)?.email) || "Client Stripe";
    if (montant <= 0) return { ecritures: [], ignore: "Remboursement de 0 €" };
    if (devise !== "eur") {
      return { ecritures: [], alerte: `Remboursement de ${montant / 100} ${devise.toUpperCase()} — à saisir à la main, l'application ne convertit pas les devises.` };
    }
    return {
      ecritures: [{
        date: dateParis(quand),
        libelle: `Remboursement — ${client}`,
        sens: "sortie",
        categorie: "remboursements_verses",
        montantCents: montant,
        moyen: "Stripe",
        tiers: client,
        piece: txt(o.receipt_number) || txt(o.id),
        note: "Remboursement enregistré automatiquement depuis Stripe.",
        origine: "stripe",
        stripeId: `refund:${txt(o.id)}:${montant}`,
      }],
    };
  }

  return { ecritures: [], ignore: `Événement ${ev.type} sans portée comptable` };
}
