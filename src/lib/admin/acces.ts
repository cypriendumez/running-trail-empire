/**
 * QUI EST L'ÉDITEUR DU SITE — une seule définition.
 *
 * ⚠️ L'ESPACE COACH EXISTAIT ET N'ÉTAIT ATTEIGNABLE PAR AUCUN LIEN. Six pages
 * fonctionnelles — clients, séances, messagerie, avis, lettre — protégées correctement,
 * mais absentes de la barre latérale : il fallait connaître l'adresse et la taper à la
 * main. Une fonction qu'on ne peut pas atteindre n'existe pas pour celui qui l'utilise.
 *
 * ⚠️ ET LE CONTRÔLE ÉTAIT ÉCRIT EN DUR DANS LE LAYOUT. Ajouter le lien ailleurs aurait
 * créé une deuxième copie de l'adresse — donc deux vérités qui finissent par diverger,
 * exactement le défaut corrigé une dizaine de fois sur ce projet. Le layout ET la barre
 * latérale lisent maintenant la même ligne.
 *
 * ⚠️ CE N'EST PAS UN VERROU DE SÉCURITÉ À LUI SEUL. Masquer un lien ne protège rien : la
 * vraie barrière est le `redirect()` du layout `/admin`, exécuté côté serveur. Cette
 * fonction sert à ne PAS afficher une porte qu'on ne peut pas ouvrir.
 */
export const ADMIN_EMAIL = "cypriendumez@outlook.fr";

export function estAdmin(email: string | null | undefined): boolean {
  return String(email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}
