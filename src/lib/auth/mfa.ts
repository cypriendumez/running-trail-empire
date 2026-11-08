/**
 * DOUBLE AUTHENTIFICATION (TOTP) — la règle unique : « cette session doit-elle encore donner
 * son code ? » (08/11/2026).
 *
 * Un compte avec un facteur TOTP VÉRIFIÉ n'est complet qu'avec une session `aal2` (mot de passe
 * PUIS code). Une session `aal1` d'un tel compte (mot de passe seul, Google seul, ou lien reçu par
 * e-mail) est « en attente » : le serveur la traite comme NON connectée (`lib/supabase/server`),
 * et la page `/verification-2fa` demande le code.
 *
 * ⚠️ D'OÙ VIENNENT LES DEUX DONNÉES, ET POURQUOI C'EST SÛR :
 * - les facteurs viennent de `auth.getUser()`, c'est-à-dire de GoTrue (qui les charge avec
 *   l'utilisateur, `Eager`, v2.197) — PAS du cookie, que le navigateur peut réécrire ;
 * - le niveau `aal` vient du jeton d'accès, SIGNÉ, que `getUser()` vient de faire valider.
 * Un facteur seulement « non vérifié » (enrôlement abandonné) ne compte pas.
 */

type AvecFacteurs = { factors?: { status?: string; factor_type?: string }[] | null } | null | undefined;

/** Le niveau d'assurance porté par le jeton (`aal1` / `aal2`), ou `null` s'il est illisible. */
export function aalDuJeton(jeton: string | null | undefined): string | null {
  try {
    const partie = String(jeton ?? "").split(".")[1] ?? "";
    const aal = (JSON.parse(Buffer.from(partie, "base64url").toString("utf8")) as { aal?: unknown }).aal;
    return typeof aal === "string" ? aal : null;
  } catch {
    return null;
  }
}

/** Le compte a-t-il une double authentification ACTIVE (au moins un facteur vérifié) ? */
export function aUnSecondFacteur(user: AvecFacteurs): boolean {
  return (user?.factors ?? []).some((f) => f.status === "verified");
}

/**
 * Vrai si la session doit encore donner son code : facteur vérifié ET jeton qui n'est pas `aal2`.
 * Un jeton illisible ne vaut pas `aal2` : dans le doute, on demande le code.
 */
export function secondFacteurEnAttente(user: AvecFacteurs, jeton: string | null | undefined): boolean {
  return aUnSecondFacteur(user) && aalDuJeton(jeton) !== "aal2";
}
