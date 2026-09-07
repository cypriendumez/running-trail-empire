/**
 * LES BORNES D'UN TITRE DE SORTIE — et rien d'autre.
 *
 * ⚠️ CE FICHIER EXISTE POUR LA MÊME RAISON QUE `lib/avis/bornes.ts`, et parce que le
 * défaut qu'il évitait est REVENU. Ces deux constantes vivaient dans
 * `lib/activities/renommage.ts`, que le formulaire d'édition (composant CLIENT) importait
 * pour son `maxLength`. Or `renommage.ts` réutilise la liste de grossièretés de
 * `lib/social/moderation` : l'arbre d'imports a suivi jusqu'au navigateur, et les 106
 * racines surveillées — insultes racistes comprises — sont reparties en clair dans le
 * JavaScript public.
 *
 * Aucune faille : le refus est appliqué côté serveur, connaître la liste ne le contourne
 * pas. Mais un fichier de slurs consultable dans le bundle d'un site mis en vente n'a
 * rien à y faire. Le tree-shaking ne l'enlève pas : `moderation.ts` construit un `Set` au
 * chargement du module, effet de bord qu'un bundler n'a pas le droit de supprimer.
 *
 * La règle : le CLIENT importe ce fichier, le SERVEUR importe `renommage.ts`.
 * `tests/chiffres.test.ts` le vérifie sur le bundle RÉELLEMENT produit, pas sur les
 * imports — c'est lui qui a rattrapé cette régression.
 */
export const TITRE_MAX = 80;
export const DESCRIPTION_MAX = 1000;
