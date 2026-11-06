/**
 * UNE ERREUR DE RÉSEAU N'EST PAS UN BUG DE L'APPLICATION (07/11/2026).
 *
 * L'onglet Bugs montrait « ÉCRAN PLANTÉ · network error » sur /dashboard, 7 fois en quelques
 * minutes le 31/10 : le réseau de l'athlète a coupé pendant le chargement de la page (le flux
 * de la page serveur s'interrompt, le navigateur lève `TypeError: network error`). Le code
 * n'avait rien de faux, mais l'écran disait « Oups, un souci est survenu » et ne se relevait
 * pas tout seul quand la connexion revenait.
 *
 * Les messages varient selon le navigateur : Chrome « Failed to fetch » ou « network error »,
 * Safari « Load failed », Firefox « NetworkError when attempting to fetch resource », Next
 * « ChunkLoadError » / « Loading chunk … failed » quand un morceau de code n'arrive pas.
 */
export function erreurReseau(e: unknown): boolean {
  const err = (e ?? {}) as { name?: unknown; message?: unknown };
  const nom = String(err.name ?? ""), msg = String(err.message ?? "");
  if (nom === "ChunkLoadError") return true;
  return /^(?:network error|failed to fetch|load failed|fetch failed)$/i.test(msg.trim())
    || /networkerror when attempting to fetch|loading (?:css )?chunk [\w-]+ failed|err_network|err_internet_disconnected/i.test(msg);
}
