/**
 * QUI OUVRE L'ESPACE COACH — une seule définition, désormais CONFIGURABLE.
 *
 * ⚠️ L'ESPACE COACH EXISTAIT ET N'ÉTAIT ATTEIGNABLE PAR AUCUN LIEN. Six pages
 * fonctionnelles — clients, séances, messagerie, avis, lettre — protégées correctement,
 * mais absentes de la barre latérale : il fallait connaître l'adresse et la taper à la
 * main. Une fonction qu'on ne peut pas atteindre n'existe pas pour celui qui l'utilise.
 *
 * ⚠️ ET L'ADRESSE ÉTAIT ÉCRITE EN DUR, EN SEIZE ENDROITS. Le jour où elle change — une
 * vente, par exemple — il fallait toutes les retrouver : en manquer une laisse soit une
 * porte ouverte à l'ancien propriétaire, soit une fonction morte pour le nouveau.
 *
 * ⚠️ ET ELLE NE POUVAIT PAS CHANGER SANS REDÉPLOYER. Un acheteur n'aurait pas eu accès à
 * son propre espace coach sans modifier le code source. La liste se lit maintenant dans
 * `ADMIN_EMAILS` (côté serveur, jamais `NEXT_PUBLIC_`) : plusieurs adresses séparées par
 * des virgules, changeables depuis le tableau de bord d'hébergement.
 *
 * ⚠️ CE N'EST PAS UN VERROU DE SÉCURITÉ À LUI SEUL. Masquer un lien ne protège rien : la
 * vraie barrière est le `redirect()` du layout `/admin` et le refus des routes
 * `api/admin`, tous exécutés côté serveur.
 *
 * ⚠️ NE PAS IMPORTER DEPUIS UN COMPOSANT CLIENT. Dans le navigateur `process.env` est
 * vide : la fonction retomberait silencieusement sur le seul propriétaire historique et
 * répondrait « non » à un administrateur pourtant légitime. Un test l'interdit.
 */

/** Propriétaire historique — utilisé UNIQUEMENT si `ADMIN_EMAILS` n'est pas renseigné. */
export const ADMIN_PAR_DEFAUT = "cypriendumez@outlook.fr";

const normalise = (e: unknown) => String(e ?? "").trim().toLowerCase();
const EST_ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Les adresses qui ouvrent l'espace coach.
 *
 * Trois cas, et le troisième est le seul qui compte vraiment :
 *  - variable absente     → le propriétaire historique (comportement d'avant, inchangé) ;
 *  - variable lisible     → exactement les adresses qu'elle contient ;
 *  - variable ILLISIBLE   → PERSONNE. Retomber sur le propriétaire historique parce
 *    qu'un acheteur a fait une faute de frappe lui rendrait l'accès sans que personne
 *    ne s'en aperçoive. On ferme, et on le dit dans les journaux.
 */
export function adminsAutorises(valeurEnv?: string): string[] {
  const brut = (valeurEnv ?? process.env.ADMIN_EMAILS ?? "").trim();
  if (!brut) return [ADMIN_PAR_DEFAUT];
  const liste = brut.split(/[,;\s]+/).map(normalise)
    .filter((e, i, t) => EST_ADRESSE.test(e) && t.indexOf(e) === i);
  if (liste.length === 0) {
    console.error("[admin] ADMIN_EMAILS est renseigné mais ne contient aucune adresse valide : l'espace coach est fermé à tout le monde.");
  }
  return liste;
}

export function estAdmin(email: string | null | undefined, valeurEnv?: string): boolean {
  const e = normalise(email);
  return EST_ADRESSE.test(e) && adminsAutorises(valeurEnv).includes(e);
}
