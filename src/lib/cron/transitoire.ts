/**
 * UNE ERREUR PASSAGÈRE N'EST PAS UN REFUS.
 *
 * ⚠️ POURQUOI CETTE DISTINCTION EXISTE. Une écriture Supabase peut échouer pour deux raisons
 * de nature opposée :
 *   - un VRAI refus de la base — contrainte violée, valeur hors énumération : ça se
 *     reproduira à l'identique tant que le code n'est pas corrigé. Il FAUT le signaler
 *     (c'est ce bug-là qui a bloqué pendant deux jours l'ajout des semis et marathons) ;
 *   - un incident d'INFRASTRUCTURE passager — « Gateway Timeout », 503, coupure réseau,
 *     démarrage à froid : il disparaît au prochain essai. Le compter comme un refus fait
 *     passer un cron entier « en échec » alors que 49 lignes sur 50 sont bien écrites —
 *     exactement la fausse alerte qu'on cherche à éviter, car une fausse alerte finit par
 *     être ignorée, y compris le jour où elle est vraie.
 *
 * On ne bloque donc l'alerte QUE sur les vrais refus ; les incidents passagers sont notés
 * mais ne font pas rougir la tâche (et l'appelant peut réessayer).
 */
export function estErreurTransitoire(message: string | undefined | null): boolean {
  const m = String(message ?? "").toLowerCase();
  return /timeout|gateway|fetch failed|network|econnreset|etimedout|socket hang up|503|504|502|service unavailable|temporarily unavailable|too many|rate ?limit/.test(m);
}
