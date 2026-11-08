// ─────────────────────────────────────────────────────────────────────────────
//  AUCUNE ADRESSE E-MAIL DANS LE JOURNAL D'ERREURS.
//
//  Constaté le 08/11/2026 (audit des données de santé et personnelles) : `error_logs`
//  recevait l'adresse des coureurs en clair — « E-mail non envoyé à <adresse> »,
//  « Inscription de <adresse> impossible », `meta: { email }`, `{ to }`, `{ inscrit }`, et
//  parfois le corps d'erreur de Resend qui la répète. La table n'a ni purge ni
//  anonymisation, et beaucoup de ces lignes n'ont pas de `user_id` : la suppression d'un
//  compte ne pouvait pas les retrouver. Le journal sert à voir ce qui casse, pas à qui on
//  écrivait : l'identifiant du compte, quand il existe, suffit.
//
//  Appliqué AU POINT D'ÉCRITURE, sur le message comme sur `meta`, quel que soit
//  l'appelant : un oubli dans une route ne peut plus faire fuir une adresse.
// ─────────────────────────────────────────────────────────────────────────────

const ADRESSE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/**
 * Les clés qui ne portent QUE des adresses : leur valeur part entière. `to`, `cc`, `dest`
 * n'y sont pas (relecture du 08/11/2026) : `to` désigne aussi une page ou une étape, utile au
 * diagnostic ; les adresses qu'elles portent sont masquées par la règle générale.
 */
const CLES_ADRESSE = /^(e-?mail|emails?|destinataires?|inscrit|adresse|recipient)$/i;
export const MASQUE = "[adresse]";

/** Une chaîne, un tableau ou un objet, avec toute adresse remplacée par `[adresse]`. */
export function sansAdresse<T>(valeur: T, profondeur = 0): T {
  if (typeof valeur === "string") return valeur.replace(ADRESSE, MASQUE) as T;
  if (profondeur > 6 || valeur == null || typeof valeur !== "object") return valeur;
  if (Array.isArray(valeur)) return valeur.map((v) => sansAdresse(v, profondeur + 1)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) {
    out[k] = CLES_ADRESSE.test(k) && v != null ? MASQUE : sansAdresse(v, profondeur + 1);
  }
  return out as T;
}
