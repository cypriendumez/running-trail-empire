/**
 * LES ABONNEMENTS VENDUS PAR LES STORES (achat intégré Apple et Google) — 05/11/2026.
 *
 * Dans l'appli native, l'abonnement se vend par l'achat intégré (règle 3.1.1 d'Apple), géré
 * par RevenueCat. Ce module est la SEULE table entre un produit des stores et une formule
 * Pacevo : la page d'abonnement l'utilise pour acheter, le webhook RevenueCat pour accorder
 * l'accès (`profiles.subscription_tier`, lu par `lib/billing/access`).
 *
 * ⚠️ Ces identifiants doivent être créés À L'IDENTIQUE dans App Store Connect et la Google
 * Play Console (abonnements), puis rattachés aux droits « starter » et « premium » dans
 * RevenueCat. Un identifiant différent = un achat payé qui n'ouvre rien.
 */
export type FormuleStore = "starter" | "premium";
export type PeriodeStore = "mois" | "an";

export const PRODUITS_STORES: Readonly<Record<FormuleStore, Readonly<Record<PeriodeStore, string>>>> = {
  starter: { mois: "fr.pacevo.starter.mois", an: "fr.pacevo.starter.an" },
  premium: { mois: "fr.pacevo.premium.mois", an: "fr.pacevo.premium.an" },
};

/**
 * La formule d'un produit acheté, ou `null` s'il n'est pas l'un des nôtres. Google
 * suffixe parfois l'identifiant de son offre de base (« fr.pacevo.premium.an:annuel ») :
 * seule la partie avant « : » compte.
 */
export function formuleDuProduit(produitId: unknown): FormuleStore | null {
  const id = String(produitId ?? "").split(":")[0].trim();
  for (const formule of Object.keys(PRODUITS_STORES) as FormuleStore[]) {
    if (Object.values(PRODUITS_STORES[formule]).includes(id)) return formule;
  }
  return null;
}
