/**
 * LES PRIX QU'UNE VITRINE A LE DROIT D'AFFICHER.
 *
 * Afficher un montant différent de celui qu'on prélève n'est pas un défaut d'affichage,
 * c'est un litige. La source de vérité reste `TARIFS` (`lib/stripe/client.ts`), qui porte
 * les identifiants de prix Stripe — mais ce module tire le SDK et la clé secrète, donc
 * aucun composant client ne peut l'importer.
 *
 * D'où ce module, volontairement SANS dépendance : les vitrines l'importent, et
 * `tests/coach.test.ts` vérifie centime par centime qu'il correspond à `TARIFS`.
 *
 * ⚠️ Il existait auparavant DEUX copies de ces montants, une par vitrine, et une
 * TROISIÈME divergente dans les réglages du profil, qui annonçait « Passer à Pro,
 * 10 € /mois, ou 84 €/an (-30 %) » : trois chiffres dont aucun ne correspondait à ce que
 * Stripe aurait débité, pour un palier « Pro » qui n'existe plus. Une seule copie
 * désormais. Ne pas en refaire une : le test refuse qu'une vitrine cesse d'importer ici.
 */

/** Montants EN CENTIMES, strictement égaux à `TARIFS`. */
export const PRIX_AFFICHES = {
  gratuit: { mois: 0, an: 0 },
  starter: { mois: 999, an: 9990 },
  // 119,90 € À L'ANNÉE (Cyprien, 30/10/2026 : « c'est ta décision »). À 149,90 €, l'annuel
  // Premium coûtait plus cher que celui de Runna (119,99 €) alors que le mensuel était moins
  // cher. Quatre mois offerts : 9,99 € par mois, le prix de Starter au mois — l'écart
  // annuel entre les deux formules tombe à 20 €, et Premium devient le choix évident.
  premium: { mois: 1499, an: 11990 },
} as const;

export type CleFormule = keyof typeof PRIX_AFFICHES;
export type Periode = "mois" | "an";

/**
 * LE TARIF ÉTUDIANT : −20 % sur Starter et Premium (Cyprien, 30/10/2026).
 *
 * Il passe par un CODE PROMO Stripe saisi au paiement (`allow_promotion_codes` dans
 * `api/stripe/checkout`), remis à la demande après vérification du statut — une adresse
 * e-mail étudiante ou un certificat de scolarité. Pas de code public : il finirait sur
 * un site de bons plans et vaudrait pour tout le monde. Les vitrines affichent CE nombre,
 * jamais un 20 recopié.
 */
export const REMISE_ETUDIANTE_PCT = 20;

/** « 9,99 € » dans la locale de l'athlète. */
export const euros = (centimes: number, lang: string) =>
  (centimes / 100).toLocaleString(lang, { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

/**
 * Prix ramené au mois pour une périodicité donnée — c'est ce qu'on met en gros.
 * En annuel, on divise le total par DOUZE (mois d'accès), pas par dix : l'athlète
 * compare bien « ce que ça me coûte par mois », et c'est là que la remise se voit.
 */
export const parMois = (formule: CleFormule, periode: Periode) =>
  periode === "an"
    ? Math.round(PRIX_AFFICHES[formule].an / 12)
    : PRIX_AFFICHES[formule].mois;

/** Ce que l'athlète économise sur un an, en centimes (0 pour le palier gratuit). */
export const economieAnnuelle = (formule: CleFormule) =>
  PRIX_AFFICHES[formule].mois * 12 - PRIX_AFFICHES[formule].an;

/**
 * Mois offerts sur un an, DÉDUITS des prix réels et arrondis vers le BAS : l'annonce ne peut
 * jamais dépasser l'économie. Starter : 2 (99,90 € au lieu de 119,88 €). Premium : 4
 * (119,90 € au lieu de 179,88 €, soit 59,98 € d'économie, un peu plus de quatre mois).
 *
 * ⚠️ JAMAIS UN POURCENTAGE : 1 − 10/12 vaut 16,67 %, qu'un arrondi à « −17 % » surestimerait
 * sur une promesse commerciale. Des mois entiers, comptés vers le bas, ne mentent pas.
 */
export const moisOfferts = (formule: Exclude<CleFormule, "gratuit">) =>
  Math.floor(economieAnnuelle(formule) / PRIX_AFFICHES[formule].mois);

/** Le plus de mois offerts parmi les formules : le sélecteur « Annuel » dit « jusqu'à N ». */
export const MOIS_OFFERTS_MAX = Math.max(moisOfferts("starter"), moisOfferts("premium"));
