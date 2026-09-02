/**
 * LES OFFRES MARCHANDES — lues dans `product_offers`, jamais ailleurs.
 *
 * ⚠️ C'EST ICI QUE SE JOUE LA PROMESSE DE LA PAGE. L'ancienne boutique affichait 1 167
 * prix INVENTÉS attribués à de vraies enseignes ; elle a été retirée pour cette raison.
 * La règle qui la remplace tient en une phrase : un prix ne s'affiche que s'il vient
 * d'une ligne de `product_offers`, écrite par l'import d'un flux officiel. Table vide =
 * aucun prix, et la fiche le dit. Le prix public conseillé du fabricant, lui, n'est pas
 * une offre : il est affiché à part et étiqueté comme tel.
 *
 * Le recoupement se fait par CODE-BARRES. Les noms commerciaux diffèrent d'une enseigne à
 * l'autre (« Clifton 10 M », « Clifton 10 Homme ») ; le gtin13, non.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Offre = {
  retailer: string;
  price: number;
  currency: string;
  url: string;
  in_stock: boolean | null;
  updated_at: string;
};

export async function offresPour(sb: SupabaseClient, ean: string | undefined): Promise<Offre[]> {
  if (!ean) return [];
  const { data, error } = await sb
    .from("product_offers")
    .select("retailer,price,currency,url,in_stock,updated_at")
    .eq("ean", ean)
    .order("price", { ascending: true });
  // ⚠️ UNE ERREUR NE DOIT PAS SE LIRE COMME « AUCUNE OFFRE ». Les deux se soldent par une
  // liste vide côté appelant ; on distingue donc explicitement, et la page peut dire
  // « offres indisponibles » plutôt que d'affirmer qu'il n'y en a pas.
  if (error) throw new Error(`product_offers illisible : ${error.message}`);
  return (data ?? []) as Offre[];
}

/** La meilleure offre disponible : le prix le plus bas, en stock. */
export function meilleure(offres: Offre[]): Offre | null {
  const dispo = offres.filter((o) => o.in_stock !== false && Number.isFinite(Number(o.price)));
  return dispo.length ? dispo.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b)) : null;
}
