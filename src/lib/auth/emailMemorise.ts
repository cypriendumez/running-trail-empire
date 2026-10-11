/**
 * L'ADRESSE SAISIE SUIT LA PERSONNE D'UNE PAGE À L'AUTRE (connexion ⇄ inscription ⇄ mot de
 * passe oublié), comme dans toute application : on ne la retape pas.
 *
 * ⚠️ PAS DANS L'URL. `/login?email=…` finirait dans l'historique, les journaux du serveur et
 * l'en-tête Referer. Le stockage de session ne quitte pas l'onglet et s'efface à la lecture.
 */
const CLE = "pacevo:auth-email";

export function memoriserEmail(email: string): void {
  try { sessionStorage.setItem(CLE, email.trim()); } catch { /* navigation privée : on retapera */ }
}

/** Rend l'adresse mémorisée (et l'oublie), ou une chaîne vide. */
export function reprendreEmail(): string {
  try {
    const v = sessionStorage.getItem(CLE) ?? "";
    sessionStorage.removeItem(CLE);
    return v;
  } catch {
    return "";
  }
}
