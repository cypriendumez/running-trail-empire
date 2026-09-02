/**
 * LES OFFRES MARCHANDES — lues dans `product_offers`, jamais ailleurs.
 *
 * ⚠️ C'EST ICI QUE SE JOUE LA PROMESSE DE LA PAGE. L'ancienne boutique affichait 1 167
 * prix INVENTÉS attribués à de vraies enseignes ; elle a été retirée pour cette raison.
 * La règle qui la remplace tient en une phrase : un prix ne s'affiche que s'il vient
 * d'une ligne de `product_offers`, et chaque ligne porte le NOM du marchand, la DATE du
 * relevé et le LIEN vers sa page. Table vide = aucun prix, et la fiche le dit.
 *
 * Les relevés viennent aujourd'hui des données structurées publiques des fiches
 * marchandes ; un flux d'affiliation officiel remplira exactement la même table, sans
 * rien changer à l'affichage. Le prix public conseillé du fabricant, lui, n'est pas une
 * offre : il sert de référence pour la remise, et il est étiqueté comme tel.
 *
 * Le recoupement se fait par CODE-BARRES. Les noms commerciaux diffèrent d'une enseigne à
 * l'autre (« Clifton 10 M », « Clifton 10 Homme ») ; le gtin13, non.
 *
 * ⚠️ UN PRIX PÉRIME, ET UN PRIX PÉRIMÉ EST UNE FAUSSE INFORMATION. Un tarif relevé
 * aujourd'hui ne vaut plus rien dans un mois : la date du relevé est affichée, et une
 * offre trop ancienne perd son statut de « meilleure offre ». Sans cette borne, la page
 * annoncerait une promotion terminée depuis longtemps — le genre de chiffre qui fait
 * cliquer puis perdre confiance.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Offre = {
  retailer: string;
  /** Visuel fourni PAR LE FLUX du marchand, avec le droit de l'afficher. Jamais récupéré ailleurs. */
  image_url?: string | null;
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
    .select("retailer,price,currency,url,in_stock,updated_at,image_url")
    .eq("ean", ean)
    .order("price", { ascending: true });
  // ⚠️ UNE ERREUR NE DOIT PAS SE LIRE COMME « AUCUNE OFFRE ». Les deux se soldent par une
  // liste vide côté appelant ; on distingue donc explicitement, et la page peut dire
  // « offres indisponibles » plutôt que d'affirmer qu'il n'y en a pas.
  if (error) throw new Error(`product_offers illisible : ${error.message}`);
  return (data ?? []) as Offre[];
}

/** Au-delà, un prix relevé n'est plus présenté comme le prix du jour. */
export const FRAICHEUR_JOURS = 14;

export function ageEnJours(iso: unknown, maintenant = Date.now()): number | null {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? Math.floor((maintenant - t) / 86_400_000) : null;
}

export function estFraiche(o: Offre, maintenant = Date.now()): boolean {
  const j = ageEnJours(o.updated_at, maintenant);
  return j != null && j <= FRAICHEUR_JOURS;
}

/** La meilleure offre : le prix le plus bas, en stock, et relevé récemment. */
export function meilleure(offres: Offre[], maintenant = Date.now()): Offre | null {
  const dispo = offres.filter((o) => o.in_stock !== false && Number.isFinite(Number(o.price)) && estFraiche(o, maintenant));
  return dispo.length ? dispo.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b)) : null;
}

/**
 * La remise par rapport au prix public conseillé, en pourcentage entier.
 *
 * ⚠️ ON NE CALCULE RIEN SANS LES DEUX CHIFFRES. Sans prix conseillé, il n'y a pas de
 * remise à annoncer : afficher « -0 % » ou prendre le prix le plus haut du marché comme
 * référence fabriquerait une promotion. Et une « remise » négative (prix supérieur au
 * conseillé) n'est pas une remise : on ne l'affiche pas.
 */
export function remisePourcent(prix: number | null | undefined, conseille: number | null | undefined): number | null {
  const p = Number(prix), c = Number(conseille);
  if (!Number.isFinite(p) || !Number.isFinite(c) || c <= 0 || p <= 0 || p >= c) return null;
  return Math.round((1 - p / c) * 100);
}

/** Toutes les offres du catalogue, en une requête, rangées par code-barres. */
export async function offresParEan(sb: SupabaseClient): Promise<Record<string, Offre[]>> {
  const { data, error } = await sb
    .from("product_offers")
    .select("retailer,price,currency,url,in_stock,updated_at,image_url,ean")
    .not("ean", "is", null)
    .order("price", { ascending: true })
    .limit(1000);
  if (error) throw new Error(`product_offers illisible : ${error.message}`);
  const out: Record<string, Offre[]> = {};
  for (const o of (data ?? []) as (Offre & { ean: string })[]) (out[o.ean] ??= []).push(o);
  return out;
}
