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
 *
 * ⚠️ LE TEXTE EN DERNIER RECOURS. Jusqu'au 12/10/2026, on ne lisait que le message, en y
 * cherchant « 502|503|504 » sans bornes de mot : « 23502 null value in column … » (la
 * violation de NOT NULL) et « invalid input syntax for type smallint: "1502.5" » passaient
 * pour une passerelle en panne — un vrai refus classé passager ne fait plus rougir la tâche.
 * On décide donc sur ce qui est structuré, du plus sûr au moins sûr :
 *   1. le STATUT HTTP, quand l'appelant l'a : 408, 429, 502, 503, 504 disent « réessaie ».
 *      PostgREST ne rend jamais un refus de la base sous ces statuts (contrainte, type,
 *      énumération → 400 ou 409) ; il ne rend 503 ou 504 que pour une base injoignable,
 *      des ressources épuisées ou une file d'attente du pool trop longue (08*, 53*,
 *      PGRST000 à PGRST003 — docs.postgrest.org, « Errors ») ;
 *   2. le CODE de l'erreur : une erreur qui porte un code de la base a été rendue PAR la
 *      base. C'est un refus, quoi que dise son texte ;
 *   3. le TEXTE, faute de mieux. Les statuts n'y comptent plus que comme mots entiers :
 *      « 23502 » et « 1502.5 » ne sont plus des 502.
 *
 * ⚠️ LIMITE ASSUMÉE DU TEXTE : il ne distingue pas un statut d'une valeur qui s'écrit pareil.
 * Une valeur refusée « "503" » (Postgres cite les valeurs entre guillemets) ou « 1.502 » (le
 * point borne le mot) passerait encore pour un incident, comme un nom de colonne contenant
 * « timeout ». D'où la règle pour tout appelant qui a l'erreur de supabase-js : lui passer
 * l'ERREUR (qui porte son code) et le STATUT de la réponse, jamais `error.message` seul.
 */

/** Statuts qui disent « réessaie » : délai dépassé, trop de requêtes, passerelle, service indisponible. */
const STATUTS_PASSAGERS = new Set([408, 429, 502, 503, 504]);

/**
 * Un code rendu PAR LA BASE : SQLSTATE (23502, 22P02, P0001, XX000…) ou PostgREST (PGRST204…).
 * Cinq caractères dont le premier est un chiffre, ou l'une des quatre classes à lettre
 * (F0, HV, P0, XX). Pas « cinq majuscules » : `EPIPE`, une coupure réseau, en a cinq aussi.
 */
const CODE_BASE = /^(?:\d[0-9A-Z]{4}|(?:F0|HV|P0|XX)[0-9A-Z]{3}|PGRST\d{3})$/;

const TEXTE_PASSAGER = /timeout|gateway|fetch failed|network|econnreset|etimedout|socket hang up|\b50[234]\b|service unavailable|temporarily unavailable|too many|rate ?limit/;

/** Une erreur telle que la rend supabase-js : son texte, et son code quand la base l'a rendue. */
type ErreurRendue = { message?: string | null; code?: string | null };

export function estErreurTransitoire(
  erreur: string | ErreurRendue | undefined | null,
  statut?: number | null,
): boolean {
  if (statut != null && STATUTS_PASSAGERS.has(statut)) return true;
  const e: ErreurRendue = typeof erreur === "string" ? { message: erreur } : erreur ?? {};
  if (CODE_BASE.test(String(e.code ?? ""))) return false;
  return TEXTE_PASSAGER.test(String(e.message ?? "").toLowerCase());
}
