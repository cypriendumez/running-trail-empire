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

/**
 * OÙ L'ON PRÉVIENT L'ÉDITEUR — nouvelle inscription, message d'un athlète, ressenti
 * douloureux, objectif de course. Ces envois transportent des DONNÉES PERSONNELLES :
 * nom, adresse e-mail, douleurs, état de forme.
 *
 * ⚠️ QUATRE ROUTES REPLIAIENT SUR L'ADRESSE DU PROPRIÉTAIRE HISTORIQUE, ÉCRITE EN DUR.
 * Le jour de la vente, un acheteur qui configure `ADMIN_EMAILS` sans penser à
 * `COACH_EMAIL` aurait continué d'envoyer les données de SES clients dans la boîte du
 * vendeur — sans le savoir, indéfiniment, et sans qu'aucun écran ne le montre. Ce n'est
 * pas un défaut de confort : c'est une transmission de données personnelles à un tiers
 * qui n'a plus rien à voir avec le service.
 *
 * Plus aucun repli en dur. `COACH_EMAIL` si elle est lisible, sinon la PREMIÈRE adresse
 * d'`ADMIN_EMAILS` — configurer l'accès suffit donc à rediriger les alertes.
 *
 * ⚠️ ET SI RIEN N'EST EXPLOITABLE, CHAÎNE VIDE : l'appelant N'ENVOIE PAS. Ne pas prévenir
 * se voit dans les journaux et se répare ; prévenir la mauvaise personne ne se répare
 * pas, parce que personne ne l'apprend.
 */
export function emailEditeur(): string {
  const explicite = normalise(process.env.COACH_EMAIL);
  if (EST_ADRESSE.test(explicite)) return explicite;
  const premier = adminsAutorises()[0] ?? "";
  if (!EST_ADRESSE.test(premier)) {
    console.error("[admin] aucun destinataire exploitable (ni COACH_EMAIL ni ADMIN_EMAILS) : l'alerte à l'éditeur n'est PAS envoyée.");
    return "";
  }
  return premier;
}

/**
 * LE CONTRÔLE COMPLET D'UNE ROUTE D'ADMINISTRATION : bonne adresse ET second facteur.
 *
 * ⚠️ SANS ÇA, LA DOUBLE AUTHENTIFICATION NE PROTÉGERAIT QUE LES PAGES. Les routes d'API
 * s'appellent directement : une session restée ouverte sur une machine tierce ouvrirait
 * les factures et le chiffre d'affaires sans jamais croiser l'écran qui réclame le code.
 * Une porte verrouillée à côté d'une fenêtre ouverte ne protège rien.
 */
export async function gardeAdmin(): Promise<{ id: string; email: string } | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const { etatMfa } = await import("@/lib/admin/mfa");
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!estAdmin(user?.email)) return null;
  const mfa = await etatMfa(sb);
  if (!mfa.ouvert) return null;
  return { id: user!.id, email: String(user!.email) };
}
