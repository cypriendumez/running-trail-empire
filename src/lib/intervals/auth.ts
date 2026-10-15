/**
 * L'EN-TÊTE D'AUTHENTIFICATION intervals.icu — UNE SEULE FAÇON DE LE CONSTRUIRE (12/10/2026).
 *
 * Deux façons d'ouvrir le compte d'un athlète coexistent désormais :
 *  · la CLÉ API qu'il colle lui-même (Paramètres › Developer Settings) → `Basic API_KEY:<clé>` ;
 *  · l'AUTORISATION OAuth (application « Pacevo », n° 1331, approuvée par intervals.icu le
 *    12/10/2026) → `Bearer <jeton>`.
 *
 * ⚠️ AUCUNE MIGRATION, À DESSEIN. Le jeton OAuth est rangé dans la MÊME colonne que la clé,
 * `profiles.intervals_api_key`, précédé de `oauth:`. Trois raisons :
 *  · cette colonne est déjà retirée de tout profil envoyé au navigateur (`stripProfileSecrets`) :
 *    un jeton n'a pas à apprendre à se cacher ;
 *  · `identifiantsDe` reste la seule porte d'entrée, sans troisième chemin ;
 *  · une nouvelle colonne aurait été une migration de plus à lancer à la main — et, tant
 *    qu'elle manque, PostgREST rejette l'écriture entière.
 * Une clé intervals.icu ne contient jamais « : » : le préfixe ne peut pas être ambigu.
 *
 * Avant ce module, l'en-tête `Basic` était recopié à la main dans SEIZE fichiers. Un jeton
 * OAuth envoyé en `Basic` répond 401 et ressemble à une panne d'intervals.icu : chaque appel
 * passe donc par `enteteIntervals` (vérifié par `tests/intervals-oauth.test.ts`).
 */
export const PREFIXE_OAUTH = "oauth:";

/** Ce secret est-il un jeton OAuth (et non une clé API collée par l'athlète) ? */
export function estJetonOAuth(secret: unknown): boolean {
  return typeof secret === "string" && secret.trim().startsWith(PREFIXE_OAUTH);
}

/** Le secret à ranger dans `profiles.intervals_api_key` pour un jeton OAuth. */
export function secretOAuth(jeton: string): string {
  return PREFIXE_OAUTH + jeton.trim();
}

/** Le jeton seul, sans son préfixe (pour la révocation). */
export function jetonDe(secret: string): string {
  const s = secret.trim();
  return s.startsWith(PREFIXE_OAUTH) ? s.slice(PREFIXE_OAUTH.length) : s;
}

/**
 * La valeur de l'en-tête `Authorization` pour ce secret.
 * On rogne les espaces ici aussi : deux routes lisent encore la colonne sans passer par
 * `identifiantsDe`, et une clé collée arrive souvent avec un retour à la ligne.
 */
export function enteteIntervals(secret: string): string {
  const s = secret.trim();
  if (s.startsWith(PREFIXE_OAUTH)) return "Bearer " + s.slice(PREFIXE_OAUTH.length);
  return "Basic " + Buffer.from(`API_KEY:${s}`).toString("base64");
}
