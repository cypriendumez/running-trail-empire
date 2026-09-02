/**
 * LA LANGUE DU COMPTE, CÔTÉ SERVEUR.
 *
 * ⚠️ LES PAGES DE LA BOUTIQUE SONT RENDUES SUR LE SERVEUR : il n'y a pas de provider
 * React, donc pas de `useT()`. Sans cette fonction, la fiche modèle serait retombée en
 * français pour tout le monde alors que les textes existent dans cinq langues — le genre
 * de régression qu'aucun test d'i18n n'attrape, puisqu'elle ne laisse aucune chaîne
 * française en dur dans le fichier.
 */
const LANGUES = ["fr", "en", "de", "es", "pt"] as const;
export type LangueCompte = (typeof LANGUES)[number];

export function langueDuCompte(v: unknown): LangueCompte {
  const s = String(v ?? "").slice(0, 2).toLowerCase();
  return (LANGUES as readonly string[]).includes(s) ? (s as LangueCompte) : "fr";
}
