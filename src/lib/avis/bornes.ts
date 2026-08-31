/**
 * LES BORNES D'UN AVIS — et rien d'autre.
 *
 * ⚠️ CE FICHIER EXISTE POUR UNE RAISON PRÉCISE, mesurée le 23/08/2026. Ces deux
 * constantes vivaient dans `lib/avis/store.ts`, où le formulaire (composant CLIENT) les
 * importait. Le jour où `store.ts` a branché le filtre de grossièretés, il s'est mis à
 * importer `lib/social/moderation` — et l'arbre d'imports a suivi jusqu'au navigateur.
 *
 * Vérifié sur le build : `.next/static/chunks/…js` contenait la liste complète des 106
 * racines surveillées, insultes racistes comprises, en clair dans le JavaScript public du
 * site. Aucune faille — le refus est appliqué côté serveur, connaître la liste ne le
 * contourne pas — mais un fichier de slurs consultable dans le bundle d'un site mis en
 * vente n'a rien à y faire. Le tree-shaking ne l'enlève pas : `moderation.ts` construit
 * un `Set` au chargement du module, effet de bord qu'un bundler n'a pas le droit de
 * supprimer.
 *
 * La règle : le CLIENT importe ce fichier, le SERVEUR importe `store.ts`. Un composant
 * client qui importerait `store.ts` ferait revenir la liste — `tests/chiffres.test.ts`
 * le vérifie sur le bundle réellement produit, pas sur les imports.
 */

/** En dessous, ce n'est pas un avis mais un clic. */
export const TEXTE_MIN = 40;
/** Au-dessus, la carte devient illisible et le champ un vecteur d'abus. */
export const TEXTE_MAX = 600;

/**
 * Longueur maximale d'une RÉPONSE de l'éditeur. Elle vit ici pour la même raison que les
 * deux autres : l'écran de modération est un composant CLIENT, et importer `store.ts`
 * pour une seule constante ferait revenir les 106 racines dans le bundle public.
 * Au-delà de cette longueur, ce n'est plus une réponse, c'est un billet.
 */
export const REPONSE_MAX = 600;
