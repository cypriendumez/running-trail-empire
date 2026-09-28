import type { SupabaseClient } from "@supabase/supabase-js";
import { accesDe, peut, COLONNES_ACCES, type Acces } from "@/lib/billing/access";
import { nettoyerHistorique, type MessageCoach, type Niveau } from "@/lib/ai/coachChat";

/**
 * Lecture de la conversation avec le coach — PARTAGÉE par la route et la page.
 *
 * Deux copies de la même lecture finissent par diverger : l'écran afficherait une
 * formule ou une mémoire que la route, elle, ne lit plus de la même façon.
 */

/** Une ligne `notifications` par athlète, comme la consultation du kiné (`kine_chat`). */
export const TYPE_FIL = "coach_chat";

/** Premium et l'essai reçoivent le coach complet ; Starter, le coach essentiel. */
export const niveauDe = (etat: Acces): Niveau => (peut(etat, "plan_ia") ? "complet" : "essentiel");

export async function lireFil(supabase: SupabaseClient, userId: string): Promise<{ id: string | null; messages: MessageCoach[]; erreur: string | null }> {
  const { data, error } = await supabase.from("notifications").select("id, data")
    .eq("user_id", userId).eq("type", TYPE_FIL).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return {
    id: (data as { id?: string } | null)?.id ?? null,
    messages: nettoyerHistorique((data as { data?: { messages?: unknown } } | null)?.data?.messages),
    erreur: error?.message ?? null,
  };
}

/**
 * La formule de l'athlète. ⚠️ L'erreur de lecture est JOURNALISÉE : `accesDe(null)` accorde
 * l'essai par choix (voir `billing/guard`), et une panne silencieuse ouvrirait le niveau
 * Premium à tout le monde sans que personne le sache.
 */
export async function etatDe(supabase: SupabaseClient, userId: string): Promise<Acces> {
  const { data, error } = await supabase.from("profiles").select(COLONNES_ACCES).eq("id", userId).maybeSingle();
  if (error) console.error("[coach IA] formule illisible, repli sur l'essai :", error.message);
  return accesDe(data as { created_at?: string | null; subscription_tier?: string | null } | null).etat;
}
