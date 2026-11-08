import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Côté NAVIGATEUR : la session ouverte doit-elle encore donner son code (double authentification) ?
 * Sert à AIGUILLER vers `/verification-2fa`, jamais à protéger quoi que ce soit : la protection est
 * au serveur (`lib/supabase/server`, à partir de GoTrue) et dans la base (politiques RLS `aal2`).
 * Sans session : faux.
 */
export async function secondFacteurAttendu(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
}
