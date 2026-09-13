/**
 * TRADUIRE L'ÉCHEC DE CONNEXION DANS LA LANGUE DE LA PERSONNE.
 *
 * ⚠️ La page de connexion affichait `error.message` TEL QUEL. Or Supabase répond en
 * ANGLAIS et en jargon : « Invalid login credentials », « Email not confirmed »,
 * « Request rate limit reached ». Le 13/09/2026, un mauvais mot de passe rendait donc un
 * toast « Invalid login credentials » — un coureur francophone ne sait pas si son mot de
 * passe est faux, si le compte n'existe pas, ou si le site est cassé. C'est exactement le
 * genre de message qui fait croire « ça ne marche pas » et abandonner.
 *
 * On reconnaît ici les quelques causes réelles et on rend le libellé traduit ; tout le
 * reste retombe sur un message générique (jamais la chaîne anglaise brute).
 */
export type LibellesErreur = {
  errBadCredentials: string;
  errUnconfirmed: string;
  errRate: string;
  errGeneric: string;
};

export function messageErreurConnexion(brut: string | undefined | null, L: LibellesErreur): string {
  const s = String(brut ?? "").toLowerCase();
  // « Invalid login credentials » : e-mail inconnu OU mot de passe faux. Supabase ne
  // distingue pas les deux — volontairement, pour ne pas révéler qui a un compte. On garde
  // cette ambiguïté (c'est la règle anti-annuaire), mais en français et sans jargon.
  if (s.includes("invalid login") || s.includes("invalid credentials") || (s.includes("credential") && s.includes("invalid"))) {
    return L.errBadCredentials;
  }
  // Compte créé mais e-mail jamais confirmé : le lien attend dans la boîte de réception.
  if (s.includes("not confirmed") || s.includes("email not confirmed") || s.includes("confirm your")) {
    return L.errUnconfirmed;
  }
  // Trop de tentatives : Supabase impose une pause (limite anti-force-brute).
  if (s.includes("rate limit") || s.includes("too many") || s.includes("over_request_rate")) {
    return L.errRate;
  }
  return L.errGeneric;
}
