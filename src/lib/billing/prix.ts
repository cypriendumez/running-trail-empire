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
  premium: { mois: 1499, an: 14990 },
} as const;

export type CleFormule = keyof typeof PRIX_AFFICHES;
export type Periode = "mois" | "an";

/**
 * Nombre de mois FACTURÉS sur un an.
 *
 * Douze mois d'accès pour dix mois payés — deux mois offerts. C'est la même mécanique
 * que les abonnements annuels du marché, et c'est l'unique définition de la remise :
 * `TARIFS[f].an === TARIFS[f].mois × MOIS_FACTURES_PAR_AN`, vérifié par un test.
 * L'ancien « −33 % » bradait l'abonnement sans raison.
 */
export const MOIS_FACTURES_PAR_AN = 10;

/** Remise annuelle en pourcentage ENTIER, arrondi vers le bas (17 pour −17 %). */
export const REMISE_ANNUELLE_PCT = Math.floor((1 - MOIS_FACTURES_PAR_AN / 12) * 100);

/** Mois offerts sur un engagement annuel (2). */
export const MOIS_OFFERTS = 12 - MOIS_FACTURES_PAR_AN;

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
