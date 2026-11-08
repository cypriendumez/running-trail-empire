/**
 * L'ACHAT INTÉGRÉ DANS L'APPLI NATIVE (RevenueCat, par le pont Capacitor) — 05/11/2026.
 *
 * Côté client seulement. Le module natif « Purchases » (paquet
 * `@revenuecat/purchases-capacitor`, installé dans `appli/`) est appelé par le pont
 * (`window.Capacitor.Plugins.Purchases`) : le site n'embarque aucun paquet natif.
 *
 * L'acheteur est identifié par son identifiant Pacevo (`appUserID` = id Supabase) : c'est
 * lui que le webhook RevenueCat reçoit, et sur lui que l'accès est accordé
 * (`/api/revenuecat/webhook`). Sans la clé publique RevenueCat de la plateforme
 * (`NEXT_PUBLIC_REVENUECAT_IOS` / `NEXT_PUBLIC_REVENUECAT_ANDROID`), l'achat est
 * « indisponible » — on le dit, on ne fait pas semblant.
 */
import { moduleNatif, plateformeNative } from "@/lib/natif/appli";
import { PRODUITS_STORES, type FormuleStore, type PeriodeStore } from "@/lib/billing/stores";

type ProduitStore = { identifier: string; priceString?: string };
type ModuleAchats = {
  configure(o: { apiKey: string; appUserID: string }): Promise<void>;
  getProducts(o: { productIdentifiers: string[] }): Promise<{ products: ProduitStore[] }>;
  purchaseStoreProduct(o: { product: ProduitStore }): Promise<unknown>;
  restorePurchases(): Promise<unknown>;
};

export type ResultatAchat = "achete" | "annule" | "indisponible" | "erreur";

/** La clé publique RevenueCat de la plateforme, ou `null` si elle n'est pas posée. */
export function cleRevenueCat(plateforme: "ios" | "android" | null): string | null {
  const cle = plateforme === "ios" ? process.env.NEXT_PUBLIC_REVENUECAT_IOS
    : plateforme === "android" ? process.env.NEXT_PUBLIC_REVENUECAT_ANDROID : undefined;
  return cle && cle.trim() ? cle.trim() : null;
}

let configurePour: string | null = null;
async function achats(userId: string): Promise<ModuleAchats | null> {
  const m = moduleNatif<ModuleAchats>("Purchases");
  const cle = cleRevenueCat(plateformeNative());
  if (!m || !cle) return null;
  if (configurePour !== userId) {
    await m.configure({ apiKey: cle, appUserID: userId });
    configurePour = userId;
  }
  return m;
}

/** L'annulation par l'acheteur n'est pas une panne (code RevenueCat 1 / `userCancelled`). */
const estAnnulation = (e: unknown): boolean => {
  const o = e as { code?: unknown; userCancelled?: unknown; message?: unknown } | null;
  return o?.userCancelled === true || String(o?.code) === "1" || /cancel/i.test(String(o?.message ?? ""));
};

export async function acheterDansLAppli(formule: FormuleStore, periode: PeriodeStore, userId: string): Promise<ResultatAchat> {
  try {
    const m = await achats(userId);
    if (!m) return "indisponible";
    const id = PRODUITS_STORES[formule][periode];
    const { products } = await m.getProducts({ productIdentifiers: [id] });
    const produit = products.find((p) => p.identifier === id || p.identifier.split(":")[0] === id);
    if (!produit) return "indisponible";
    await m.purchaseStoreProduct({ product: produit });
    return "achete";
  } catch (e) {
    return estAnnulation(e) ? "annule" : "erreur";
  }
}

/** « Restaurer mes achats » : exigé par Apple pour tout abonnement vendu dans l'appli. */
export async function restaurerAchats(userId: string): Promise<ResultatAchat> {
  try {
    const m = await achats(userId);
    if (!m) return "indisponible";
    await m.restorePurchases();
    return "achete";
  } catch (e) {
    return estAnnulation(e) ? "annule" : "erreur";
  }
}

/**
 * Les prix que le store facturera réellement (« 9,99 € »), par identifiant de produit. Dans
 * l'appli, la page d'abonnement affiche CEUX-LÀ : Apple fixe ses paliers de prix, et afficher
 * le tarif du site pour facturer celui du store serait un prix trompeur.
 */
export async function prixDansLAppli(userId: string): Promise<Record<string, string>> {
  try {
    const m = await achats(userId);
    if (!m) return {};
    const ids = Object.values(PRODUITS_STORES).flatMap((p) => Object.values(p));
    const { products } = await m.getProducts({ productIdentifiers: ids });
    const out: Record<string, string> = {};
    for (const p of products) if (p.priceString) out[p.identifier.split(":")[0]] = p.priceString;
    return out;
  } catch {
    return {};
  }
}
