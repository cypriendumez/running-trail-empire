/**
 * QUI PEUT ÉCRIRE À QUI.
 *
 * ⚠️ SUIVRE QUELQU'UN N'EST PAS ÊTRE SON AMI. Dans ce produit, `follows` est un lien à
 * SENS UNIQUE, posé directement en « accepted » : personne n'accepte rien, on suit qui
 * on veut. Autoriser à écrire à quiconque on suit reviendrait donc à ouvrir une boîte
 * de réception à n'importe qui — il suffirait de suivre un athlète pour lui écrire.
 *
 * La règle retenue est le SUIVI RÉCIPROQUE : je te suis ET tu me suis. Chacun des deux
 * a posé son lien, donc chacun a consenti. C'est la seule lecture du graphe existant qui
 * porte un consentement mutuel sans inventer de table d'invitations.
 *
 * ⚠️ ET ELLE SE VÉRIFIE AU MOMENT DE L'ENVOI, PAS À L'AFFICHAGE. Masquer un destinataire
 * dans une liste n'empêche personne d'appeler la route à la main.
 */

export type Lien = { follower_id: string; following_id: string };

/** Les athlètes que `moi` suit ET qui suivent `moi`. */
export function amisMutuels(moi: string, liens: Lien[]): string[] {
  if (!moi) return [];
  const jeSuis = new Set<string>();
  const meSuivent = new Set<string>();
  for (const l of liens) {
    if (!l?.follower_id || !l?.following_id) continue;
    // ⚠️ UN LIEN VERS SOI-MÊME NE FAIT PAS UN AMI. La base porte une contrainte, mais
    // une ligne héritée ou une lecture élargie ne doit pas rendre quelqu'un « ami de
    // lui-même » et lui ouvrir une conversation avec son propre reflet.
    if (l.follower_id === l.following_id) continue;
    if (l.follower_id === moi) jeSuis.add(l.following_id);
    if (l.following_id === moi) meSuivent.add(l.follower_id);
  }
  return [...jeSuis].filter((id) => meSuivent.has(id)).sort();
}

/** `moi` a-t-il le droit d'écrire à `cible` ? */
export function peutEcrire(moi: string, cible: string, liens: Lien[]): boolean {
  if (!moi || !cible || moi === cible) return false;
  return amisMutuels(moi, liens).includes(cible);
}
