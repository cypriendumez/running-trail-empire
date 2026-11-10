/**
 * QUAND PROPOSER D'INSTALLER L'APPLICATION : la décision, sans navigateur, pour être testée.
 *
 * Défaut constaté le 09/11/2026 : un visiteur arrivé pour la PREMIÈRE fois sur pacevo.fr,
 * depuis un ordinateur, a vu « Installe Pacevo » posé sur la page d'accueil avant d'avoir
 * lu une ligne, avec pour seule sortie une croix grise de 16 px. Proposer d'installer une
 * application à quelqu'un qui ne sait pas encore ce qu'elle fait, c'est l'effet inverse de
 * celui recherché.
 *
 * Deux règles en sortent :
 *  - la proposition ne se montre QUE dans l'application (`/dashboard`), donc à une personne
 *    connectée qui s'en sert déjà. Jamais sur une page publique, ni à la connexion, ni
 *    pendant le questionnaire ;
 *  - elle ne se montre QUE sur un appareil tactile (téléphone, tablette). Sur ordinateur, le
 *    navigateur garde sa propre icône d'installation dans la barre d'adresse : on ne pousse rien.
 */

/** La page en cours fait-elle partie de l'application (et non du site public) ? */
export function pageOuInviter(chemin: string | null | undefined): boolean {
  if (!chemin) return false;
  return chemin === "/dashboard" || chemin.startsWith("/dashboard/");
}

/** Cet appareil doit-il recevoir la proposition ? */
export function appareilAInviter(a: { installee: boolean; tactile: boolean; rejetRecent: boolean }): boolean {
  return a.tactile && !a.installee && !a.rejetRecent;
}
