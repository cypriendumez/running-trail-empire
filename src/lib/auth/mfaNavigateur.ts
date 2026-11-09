import { isAuthApiError, isAuthSessionMissingError, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Les codes de GoTrue qui disent « cette session n'existe plus » (auth-js `ErrorCode`). PAS
 * `insufficient_aal` : GoTrue le rend en 403 (enrôler un second facteur) ou 422 (le retirer)
 * quand il faut REDONNER son code — la session est vivante, on le dit à la personne. PAS non plus
 * `refresh_token_already_used` : il naît aussi d'une course entre deux onglets, session vivante —
 * et la déconnexion qui suit (`signOut`, portée globale) fermerait tous les appareils du titulaire.
 */
const CODES_SESSION_COUPEE = new Set([
  "session_not_found", "session_expired", "refresh_token_not_found",
  "bad_jwt", "no_authorization", "user_not_found",
]);

/**
 * LA SESSION A ÉTÉ COUPÉE AILLEURS — un REFUS, pas une panne (09/11/2026).
 *
 * Retirer la double authentification déconnecte les autres appareils (`retirerDeuxFacteurs`).
 * Sur l'un d'eux, l'écran du code recevait alors un refus de GoTrue (`session_not_found`, que
 * supabase-js rend en `AuthSessionMissingError` après avoir effacé la session locale) et le
 * prenait pour une panne passagère : « L'opération n'a pas abouti », sans issue (essai de
 * Cyprien, 1 h 38). Une session coupée renvoie désormais à la connexion.
 *
 * Décidé sur la CLASSE, le STATUT et le CODE de l'erreur, jamais sur son texte. Une coupure
 * réseau (`AuthRetryableFetchError`, statut 0), un 429 ou un 5xx n'en sont PAS : on ne déconnecte
 * pas un coureur parce que son wifi ou le serveur a toussé. Pure : sert aussi au serveur
 * (`/api/auth/2fa/perdu`, qui ne répond 401 que pour une session vraiment absente).
 */
export function sessionCoupee(erreur: unknown): boolean {
  if (!erreur) return false;
  if (isAuthSessionMissingError(erreur)) return true;
  return isAuthApiError(erreur) && (erreur.status === 401 || CODES_SESSION_COUPEE.has(String(erreur.code ?? "")));
}

/**
 * Le CODE à 6 chiffres a-t-il été refusé (faux, ou défi expiré) ? Seul ce cas mérite « Code
 * incorrect ». Une panne réseau ou serveur l'affichait aussi : la personne retapait un code juste,
 * indéfiniment (relecture du 09/11/2026). Liste FERMÉE de codes GoTrue, pas « tout 4xx » : un
 * facteur retiré entre-temps (`mfa_factor_not_found`), `insufficient_aal` ou `validation_failed`
 * ne sont pas un code faux (second tour de relecture, même nuit).
 */
const CODES_CODE_REFUSE = new Set(["mfa_verification_failed", "mfa_challenge_expired"]);
export function codeRefuse(erreur: unknown): boolean {
  return isAuthApiError(erreur) && CODES_CODE_REFUSE.has(String(erreur.code ?? ""));
}

/**
 * Le facteur n'existe plus (retiré par « J'ai perdu mon téléphone » ou depuis un autre appareil) :
 * il n'y a plus de code à demander. La garde serveur décide ensuite seule.
 */
export function facteurRetire(erreur: unknown): boolean {
  return isAuthApiError(erreur) && erreur.code === "mfa_factor_not_found";
}

/**
 * Côté SERVEUR : la lecture de la session (`getUser`) a-t-elle échoué sur une PANNE, et non parce
 * que la session est absente ou coupée ? Une panne se dit 503 ; une absence, 401 — que l'écran du
 * code traite en « session coupée » et renvoie à la connexion (`/api/auth/2fa/perdu`).
 */
export function lectureSessionEnPanne(erreur: unknown): boolean {
  return !!erreur && !sessionCoupee(erreur);
}

/**
 * GoTrue exige le CODE avant de retirer le facteur (session `aal1` ouverte avant l'activation) :
 * code `insufficient_aal`. Décidé sur le code, plus sur le texte (`/aal2|assurance/` jusqu'au 09/11).
 */
export function aal2Exige(erreur: unknown): boolean {
  return isAuthApiError(erreur) && erreur.code === "insufficient_aal";
}

/**
 * Côté NAVIGATEUR : la session ouverte doit-elle encore donner son code (double authentification) ?
 * Sert à AIGUILLER vers `/verification-2fa`, jamais à protéger quoi que ce soit : la protection est
 * au serveur (`lib/supabase/server`, à partir de GoTrue) et dans la base (politiques RLS `aal2`).
 * Sans session : faux.
 *
 * Une ERREUR rend faux, et c'est sans danger : la lecture part du jeton en mémoire (un appel
 * réseau seulement s'il faut le rafraîchir), et faux envoie vers la page demandée, dont la garde
 * serveur traite une session `aal1` d'un compte protégé comme déconnectée.
 */
export async function secondFacteurAttendu(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
}
