/**
 * LE STATUT JURIDIQUE DE L'ÉDITEUR — un module SERVEUR, délibérément à part.
 *
 * ⚠️ POURQUOI IL N'EST PLUS DANS `editeur.ts`. Il y était, et `EDITEUR.statut` appelait
 * cette fonction AU CHARGEMENT DU MODULE. Or `ProfileSettings.tsx` porte « use client »
 * et importe la fiche d'identité pour y lire l'adresse de contact — et un composant
 * client embarque tout son arbre d'imports. L'appel se retrouvait donc exécuté DANS LE
 * NAVIGATEUR : constaté dans `.next/static/chunks/`, pas supposé.
 *
 * Le navigateur ne reçoit que les variables `NEXT_PUBLIC_*`. Le jour où l'éditeur pose
 * `EDITEUR_STATUT` sur l'hébergement, la page légale aurait affiché le vrai statut au
 * premier rendu (fait côté serveur) puis l'aurait remplacé par « [À COMPLÉTER] » à
 * l'hydratation, avec une erreur React #418 — une mention légale fausse sur un site en
 * vente. Le défaut dormait : tant que la variable est vide, serveur et navigateur
 * rendent le même repère, donc rien ne se voyait.
 *
 * ⚠️ ET IL NE SUFFIT PAS DE DÉPLACER : le motif `env.EDITEUR_STATUT`, avec
 * `env = process.env` en paramètre par défaut, n'écrit JAMAIS `process.env.EDITEUR_STATUT`
 * en toutes lettres. Un garde-fou qui chercherait ce motif littéral ne verrait rien
 * (essayé — il rendait « 0 violation » sur le code fautif). `tests/bundle.test.ts` juge
 * donc les PROPRIÉTÉS lues, pas la forme de l'accès.
 *
 * Ce fichier ne doit être importé que par du code serveur.
 */

/** Le repère affiché tant que l'identité légale n'est pas déclarée. */
export const STATUT_A_COMPLETER = "[À COMPLÉTER / TO BE COMPLETED — statut juridique et n° SIREN/SIRET]";

/**
 * Le statut juridique publié, lu sur l'hébergement.
 *
 * ⚠️ ON NE PUBLIE QU'UNE VALEUR PLAUSIBLE. Une variable posée à « oui », « ok » ou à
 * trois caractères remplirait la page d'un statut qui n'en est pas un, et la mention
 * légale paraîtrait complète tout en étant fausse — pire que le repère visible qu'elle
 * remplace. En dessous de dix caractères, on garde le repère.
 */
export function statutEditeur(env: Record<string, string | undefined> = process.env): string {
  const v = (env.EDITEUR_STATUT ?? "").trim();
  return v.length >= 10 ? v : STATUT_A_COMPLETER;
}
