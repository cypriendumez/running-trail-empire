// Retire les secrets du profil AVANT de l'envoyer à un composant client (= au navigateur).
// `intervals_api_key` est une clé d'accès à l'API intervals.icu de l'athlète : elle ne doit JAMAIS
// quitter le serveur. `intervals_athlete_id` n'est pas secret (simple identifiant, utilisé par l'UI
// pour afficher l'état « montre connectée ») → on le conserve.
export function stripProfileSecrets<T>(profile: T): T {
  if (!profile || typeof profile !== "object") return profile;
  const p = { ...(profile as Record<string, unknown>) };
  delete p.intervals_api_key;
  return p as T;
}
