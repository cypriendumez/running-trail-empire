/**
 * L'ÉTAT DE L'ABONNEMENT, TEL QUE STRIPE LE DIT — et tel que l'athlète doit le lire.
 *
 * ── LE DÉFAUT ────────────────────────────────────────────────────────────────
 * L'application ne retenait de Stripe qu'UNE chose : la formule (`subscription_tier`).
 * Trois questions restaient donc sans réponse, alors que Stripe y répond à chaque
 * notification :
 *
 *  · « quand vais-je être prélevé ? » — nulle part. Un abonné ne pouvait pas le savoir
 *    sans ouvrir le portail Stripe ;
 *  · « j'ai résilié, jusqu'à quand j'ai accès ? » — nulle part non plus. C'est
 *    exactement le flou qui pousse quelqu'un à faire opposition auprès de sa banque
 *    « au cas où » ;
 *  · « mon paiement a échoué ? » — l'application ne l'apprenait JAMAIS. Stripe réessaie
 *    quelques jours puis résilie ; le compte retombait en gratuit du jour au lendemain,
 *    sans qu'aucun message n'ait prévenu l'athlète qu'une carte expirée en était la
 *    cause. Un abonné perdu, et qui ne saura jamais pourquoi.
 *
 * ── PAS DE MIGRATION ─────────────────────────────────────────────────────────
 * L'état vit dans `notifications`, le fourre-tout typé du projet, sous le type
 * `abonnement_etat` — comme `auto_coach_state`, `compta_reglages` ou `avis` avant lui.
 * Ajouter trois colonnes à `profiles` aurait demandé du DDL manuel, donc une étape de
 * plus entre le code et la production, pour une donnée qui se reconstruit entièrement
 * à la prochaine notification Stripe.
 */

export const TYPE_ETAT_ABO = "abonnement_etat";

export type EtatAbonnement = {
  /** Statut Stripe brut (`active`, `trialing`, `past_due`, `canceled`…). */
  statut: string;
  /** Fin de la période EN COURS, au format AAAA-MM-JJ. C'est la date de prélèvement
   *  si l'abonnement continue, ou la date de fin d'accès s'il a été résilié. */
  periodeFin: string | null;
  /** L'athlète a demandé l'arrêt : il garde l'accès jusqu'à `periodeFin`, puis stop. */
  annuleALaFin: boolean;
  /** Le dernier prélèvement a échoué. Remis à faux dès qu'un paiement réussit. */
  echecPaiement: boolean;
};

/** Lit une ligne `notifications` comme un état d'abonnement, ou `null` si elle n'en est pas un. */
export function litEtatAbo(data: unknown): EtatAbonnement | null {
  const d = data as Partial<EtatAbonnement> | null;
  if (!d || typeof d.statut !== "string" || !d.statut) return null;
  return {
    statut: d.statut,
    // ⚠️ On n'accepte qu'une date au format attendu. Une valeur douteuse devient `null`,
    // ce qui fait disparaître la ligne à l'écran — bien mieux qu'afficher « Invalid Date »
    // à quelqu'un qui cherche à savoir quand il sera débité.
    periodeFin: typeof d.periodeFin === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.periodeFin) ? d.periodeFin : null,
    annuleALaFin: d.annuleALaFin === true,
    echecPaiement: d.echecPaiement === true,
  };
}

/**
 * Ce qu'il faut DIRE à l'athlète, en une clé de traduction et une date.
 *
 * ⚠️ FONCTION PURE, et c'est volontaire : c'est ici que se décide le message le plus
 * délicat de l'application — celui qui annonce un prélèvement. Il doit être testable
 * sans base ni réseau, sur les huit combinaisons de statut.
 *
 * L'ordre des cas n'est pas décoratif. L'échec de paiement passe AVANT tout le reste :
 * quelqu'un dont la carte a été refusée n'a que faire de sa date de renouvellement, il
 * a besoin d'aller corriger sa carte — et c'est le seul cas où l'inaction lui coûte son
 * abonnement.
 */
export type MessageAbo = { cle: "echec" | "annule" | "essai" | "renouvelle"; date: string | null } | null;

export function messageAbo(e: EtatAbonnement | null | undefined): MessageAbo {
  if (!e) return null;
  if (e.echecPaiement) return { cle: "echec", date: e.periodeFin };
  if (e.annuleALaFin) return { cle: "annule", date: e.periodeFin };
  // Sans date, il n'y a rien à annoncer : on se tait plutôt que d'écrire une phrase
  // amputée (« Prochain prélèvement le »).
  if (!e.periodeFin) return null;
  if (e.statut === "trialing") return { cle: "essai", date: e.periodeFin };
  if (e.statut === "active") return { cle: "renouvelle", date: e.periodeFin };
  return null;
}
