/**
 * LE TRAITEMENT D'UN ÉVÉNEMENT RevenueCat (achat intégré dans l'appli native) — 05/11/2026.
 * Séparé de la route pour être testé avec un faux client (tests/appli-native.test.ts).
 * Voir `/api/revenuecat/webhook` pour la sécurité et le contrat de réponse.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formuleDuProduit } from "@/lib/billing/stores";

const ACTIFS = new Set(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "NON_RENEWING_PURCHASE"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReponseStore = { statut: number; corps: Record<string, unknown> };

export async function traiterEvenementStore(admin: SupabaseClient, ev: Record<string, unknown>): Promise<ReponseStore> {
  const type = String(ev.type ?? "");
  const userId = String(ev.app_user_id ?? "");
  const ok = (corps: Record<string, unknown>): ReponseStore => ({ statut: 200, corps: { ok: true, ...corps } });
  if (type === "TEST") return ok({ ignore: "test" });
  const journal = async (message: string, meta: Record<string, unknown>) => {
    const { error } = await admin.from("error_logs").insert({ source: "revenuecat", message: message.slice(0, 2000), meta });
    if (error) console.error("[revenuecat] journal non écrit :", error.message);
  };
  // Un acheteur anonyme ($RCAnonymousID) ou inconnu : rien à accorder, mais on le garde en trace.
  if (!UUID.test(userId)) {
    await journal(`achat store sans identifiant Pacevo (${type})`, { app_user_id: userId, product_id: ev.product_id });
    return ok({ ignore: "utilisateur inconnu" });
  }

  if (ACTIFS.has(type)) {
    const produit = type === "PRODUCT_CHANGE" ? (ev.new_product_id ?? ev.product_id) : ev.product_id;
    const formule = formuleDuProduit(produit);
    if (!formule) {
      await journal(`produit store inconnu : ${String(produit)}`, { type, app_user_id: userId });
      return ok({ ignore: "produit inconnu" });
    }
    const { data, error } = await admin.from("profiles").update({ subscription_tier: formule }).eq("id", userId).select("id");
    if (error) {
      await journal(`accès store non écrit : ${error.message}`, { type, app_user_id: userId, formule });
      return { statut: 500, corps: { error: "Écriture refusée" } };
    }
    if (!data?.length) await journal("achat store pour un profil introuvable", { type, app_user_id: userId, formule });
    return ok({ formule });
  }

  if (type === "EXPIRATION") {
    // Un abonnement web (Stripe) encore en cours garde l'accès : la fin de l'achat store ne
    // doit pas couper ce que l'athlète paie par ailleurs.
    const { data: profil, error: eLecture } = await admin.from("profiles").select("stripe_subscription_id").eq("id", userId).maybeSingle();
    if (eLecture) {
      await journal(`fin d'abonnement store non traitée : ${eLecture.message}`, { app_user_id: userId });
      return { statut: 500, corps: { error: "Lecture refusée" } };
    }
    if ((profil as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id) {
      return ok({ ignore: "abonnement web en cours" });
    }
    const { error } = await admin.from("profiles").update({ subscription_tier: "free" }).eq("id", userId);
    if (error) {
      await journal(`fin d'abonnement store non écrite : ${error.message}`, { app_user_id: userId });
      return { statut: 500, corps: { error: "Écriture refusée" } };
    }
    return ok({ formule: "free" });
  }

  // Résiliation (l'accès court jusqu'à l'expiration), échec de paiement, transfert… : rien à écrire.
  return ok({ ignore: type });
}
