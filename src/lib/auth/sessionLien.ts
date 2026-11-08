/**
 * LA SESSION EST-ELLE NÉE D'UN LIEN E-MAIL, À L'INSTANT ?
 *
 * Le jeton d'accès de GoTrue porte `amr` : la liste des façons dont la session a été
 * prouvée (`password`, `oauth`, `recovery`, `otp`, `magiclink`…), chacune datée. GoTrue
 * (v2.197, `Session.IsRecovery`) traite `recovery`, `otp` et `magiclink` comme « la personne
 * vient de prouver qu'elle tient la boîte mail » et la dispense alors du mot de passe actuel.
 * On fait pareil, mais seulement dans l'heure qui suit le clic : une session ouverte par un
 * lien il y a deux mois n'est plus une preuve de rien.
 *
 * ⚠️ Lu dans `internal/api/verify.go` (v2.197) : TOUTE vérification de lien (`verifyOtp` avec
 * `token_hash`, que ce soit `recovery`, `signup` ou `magiclink`) émet la session avec la méthode
 * `otp`, pas `recovery`. C'est donc `otp` qui fait passer le parcours « mot de passe oublié » de
 * Pacevo (`/auth/confirm` → `/reset-password`) ; ne jamais le retirer de la liste.
 *
 * ⚠️ Le jeton n'est PAS vérifié ici : l'appelant doit l'avoir fait valider par GoTrue
 * (`auth.getUser()`) avant de croire ce qu'il contient.
 */

const METHODES_LIEN = new Set(["recovery", "otp", "magiclink"]);
export const FENETRE_LIEN_S = 3600;

export function sessionDeLienRecente(accessToken: string | undefined | null, maintenantS = Date.now() / 1000): boolean {
  try {
    const partie = String(accessToken ?? "").split(".")[1] ?? "";
    const charge = JSON.parse(Buffer.from(partie, "base64url").toString("utf8")) as { amr?: { method?: string; timestamp?: number }[] };
    return (charge.amr ?? []).some((m) => METHODES_LIEN.has(String(m.method)) && Number(m.timestamp) >= maintenantS - FENETRE_LIEN_S);
  } catch {
    return false;
  }
}
