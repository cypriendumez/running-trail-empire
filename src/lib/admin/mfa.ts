import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * DOUBLE AUTHENTIFICATION DE L'ESPACE COACH.
 *
 * ⚠️ UN MOT DE PASSE SEUL NE LIE RIEN À UN APPAREIL. Tant que l'accès ne dépend que d'un
 * couple adresse + mot de passe, toute machine où ce couple est saisi — ou toute session
 * restée ouverte — donne accès aux factures des clients et au chiffre d'affaires. Le
 * second facteur est ce qui transforme « mes identifiants » en « mes identifiants ET mon
 * appareil ».
 *
 * ⚠️ ET ELLE NE S'IMPOSE QUE SI UN FACTEUR EST DÉJÀ VÉRIFIÉ. Exiger un code à quelqu'un
 * qui n'en a jamais configuré le mettrait dehors de son propre espace, définitivement.
 * Tant qu'aucun facteur n'existe, l'écran INSISTE mais laisse passer.
 */

export type Niveau = "aal1" | "aal2";

/**
 * Lit le niveau d'authentification dans le jeton d'accès.
 *
 * ⚠️ Le jeton n'est PAS vérifié ici : sa signature l'a déjà été par `getUser()`, côté
 * serveur, avant qu'on arrive. Cette fonction ne fait que lire une revendication d'un
 * jeton déjà authentifié — l'utiliser sur un jeton non vérifié n'aurait aucune valeur.
 */
export function aalDuJeton(jeton: string | null | undefined): Niveau | null {
  const parts = String(jeton ?? "").split(".");
  if (parts.length !== 3) return null;
  try {
    const charge = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    const aal = (charge as { aal?: unknown }).aal;
    return aal === "aal2" ? "aal2" : aal === "aal1" ? "aal1" : null;
  } catch { return null; }
}

export type EtatMfa = {
  /** Un facteur TOTP confirmé existe-t-il ? */
  configure: boolean;
  /** La session actuelle a-t-elle franchi le second facteur ? */
  niveau: Niveau | null;
  /** L'accès est-il ouvert ? Faux uniquement si un facteur existe ET n'a pas été présenté. */
  ouvert: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function etatMfa(sb: SupabaseClient<any, any, any>): Promise<EtatMfa> {
  let configure = false;
  try {
    const { data } = await sb.auth.mfa.listFactors();
    configure = Boolean(data?.totp?.some((f) => f.status === "verified"));
  } catch {
    // ⚠️ En cas d'échec de lecture, on considère qu'AUCUN facteur n'existe : bloquer
    // l'espace parce qu'une requête a échoué enfermerait l'éditeur dehors sur une panne
    // passagère. Le pire ici est une porte fermée par erreur, pas une porte ouverte —
    // le mot de passe reste exigé dans tous les cas.
    return { configure: false, niveau: null, ouvert: true };
  }
  const { data: sess } = await sb.auth.getSession();
  const niveau = aalDuJeton(sess?.session?.access_token);
  return { configure, niveau, ouvert: !configure || niveau === "aal2" };
}
