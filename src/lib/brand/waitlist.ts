/**
 * L'OFFRE FONDATEUR DE LA LISTE D'ATTENTE — une seule source, facile à changer.
 *
 * ⚠️ CE N'EST QU'UNE PROMESSE AFFICHÉE. Aucune remise n'est appliquée ici : la liste
 * d'attente ne fait que COLLECTER des e-mails avant le lancement. Le vrai coupon −{remisePct}%
 * sera créé dans Stripe le jour du lancement (quand la société existera). Tant que rien n'est
 * encaissé, aucune société n'est requise.
 *
 * ⚠️ RENTABILITÉ. L'offre est volontairement BORNÉE : réservée aux `places` premiers, remise
 * limitée à la PREMIÈRE année (renouvellement au plein tarif ensuite). Même à −30 %, le revenu
 * reste très au-dessus du coût marginal d'un coureur (l'IA coûte quelques centimes). Changer
 * `places` ou `remisePct` ici met à jour le texte partout — ne jamais recopier ces chiffres.
 */
export const OFFRE_FONDATEUR = {
  /** Nombre de places à tarif fondateur (crée la rareté, borne le coût de la remise). */
  places: 100,
  /** Remise, en %, sur la PREMIÈRE année d'abonnement uniquement. */
  remisePct: 30,
} as const;
