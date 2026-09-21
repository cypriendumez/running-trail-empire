import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Les athlètes qui ont décoché « visible dans la communauté » (Paramètres).
 *
 * ⚠️ À LIRE AVEC LE CLIENT ADMIN, JAMAIS AVEC CELUI DE L'ATHLÈTE CONNECTÉ. Le réglage
 * vit dans `notifications` (type `user_settings`), dont la politique `notifs_all_own`
 * ne laisse voir à chacun QUE ses propres lignes. Lu avec la session de l'athlète, cet
 * ensemble ne contenait donc au mieux que lui-même : la case décochée par quelqu'un
 * d'autre n'avait AUCUN effet, il apparaissait quand même dans les suggestions, la
 * recherche et — désormais — l'appariement des contacts. Constaté le 22/09/2026 en
 * relisant la politique (migration 001, ligne 397), pas en le voyant : avec un seul
 * inscrit, une liste « complète » ressemble à une liste juste.
 */
export async function athletesMasques(admin: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await admin.from("notifications").select("user_id, data").eq("type", "user_settings");
  // Une lecture en échec ne doit pas EXPOSER : on masque tout le monde plutôt que personne.
  if (error) return new Set(["*"]);
  const masques = new Set<string>();
  for (const row of data ?? []) {
    const settings = (row as { data?: Record<string, unknown> }).data ?? {};
    if (settings.communityVisible === false) masques.add(String((row as { user_id: string }).user_id));
  }
  return masques;
}

/** Vrai si l'athlète est masqué — ou si la liste n'a pas pu être lue (`*`). */
export const estMasque = (masques: Set<string>, id: string) => masques.has("*") || masques.has(id);
