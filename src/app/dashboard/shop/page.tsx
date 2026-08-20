import { ShopComingSoon } from "@/components/shop/ShopComingSoon";

export const metadata = { title: "Shopping Hub" };

/**
 * On ne montre AUCUN prix qui ne vienne pas d'un marchand.
 *
 * ⚠️ CETTE PORTE ÉTAIT INVERSÉE DANS SES EFFETS (corrigé le 20/08/2026).
 *
 * Elle comptait les lignes de `product_offers` puis faisait :
 *     `return hasRealOffers ? <ShoppingHub /> : <ShopComingSoon />;`
 * en croyant n'ouvrir que sur de vraies offres. Or `ShoppingHub` ne lit JAMAIS
 * `product_offers` — vérifié : ses seuls appels Supabase portent sur la table `shoes`
 * de l'athlète. Son catalogue est un `const PRODUCTS` généré dans le fichier :
 * 1 167 références aux prix INVENTÉS, attribuées à de vraies enseignes (i-run,
 * Alltricks, Lepape, Ekosport, Décathlon).
 *
 * Conséquence : importer un vrai flux d'affiliation — le but même de
 * `/api/shop/import-feed` — aurait ALLUMÉ le catalogue simulé et ÉTEINT l'écran
 * d'attente honnête. Exactement l'inverse de l'intention écrite ici. Le défaut est resté
 * invisible parce que `product_offers` est vide : la branche fautive n'a jamais tourné.
 *
 * Tant qu'aucun composant ne RENDU réellement `product_offers`, cette page affiche
 * l'écran d'attente, sans condition. Le travail restant n'est pas de rebrancher
 * `ShoppingHub` : c'est d'écrire la vue qui lit les offres importées (elles portent déjà
 * leur propre `image_url` fournie par le marchand, cf. `/api/shop/import-feed`).
 *
 * `tests/photos.test.ts` verrouille : cette page ne doit pas mentionner `ShoppingHub`.
 */
export default function ShopPage() {
  return <ShopComingSoon />;
}
