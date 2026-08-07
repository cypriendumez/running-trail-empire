export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShoppingHub } from "@/components/shop/ShoppingHub";
import { ShopComingSoon } from "@/components/shop/ShopComingSoon";

export const metadata = { title: "Shopping Hub" };

/**
 * La boutique n'apparaît QUE si de vraies offres ont été importées.
 *
 * Le catalogue historique était généré de bout en bout — prix et disponibilités
 * inventés, attribués à de vraies enseignes avec leurs vraies adresses, sans que rien
 * ne le signale. Un avertissement aurait été un pansement : on ne montre plus de prix
 * qui ne vienne pas d'un marchand. Tant que `product_offers` est vide (table absente ou
 * flux non encore importé), l'athlète voit un écran d'attente honnête.
 */
export default async function ShopPage() {
  let hasRealOffers = false;
  try {
    const { count, error } = await createAdminClient()
      .from("product_offers").select("id", { count: "exact", head: true }).limit(1);
    hasRealOffers = !error && (count ?? 0) > 0;
  } catch { hasRealOffers = false; }

  return hasRealOffers ? <ShoppingHub /> : <ShopComingSoon />;
}
