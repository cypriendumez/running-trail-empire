// ─────────────────────────────────────────────────────────────────────────────
//  UN ÉCHEC SERVEUR QUE LE COUREUR NE VOIT PAS DOIT ATTEINDRE `error_logs`.
//
//  Constaté le 08/11/2026 (audit des échecs muets, 15 routes d'écriture) : une douleur
//  déclarée au kiné IA, un objectif de course, la mise à jour du poids du profil
//  échouaient avec un simple `console.error`. La console d'une fonction Vercel, personne
//  ne la lit : /admin › Bugs lit `error_logs`. Ces échecs n'existaient donc pour personne.
//
//  Ne lève JAMAIS : le journal d'un échec ne doit pas faire tomber la route qui l'a
//  constaté. S'il ne peut pas être écrit, la console est le seul endroit qui reste.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type EchecServeur = {
  /** Quelle fonction échouait (« kine », « objectif », « poids »…). 24 caractères au plus. */
  source: string;
  /** La CAUSE, sans donnée de santé ni e-mail : le panneau regroupe sur ce texte. */
  message: string;
  userId?: string | null;
  /** La route, affichée par le panneau. */
  url?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Écrit l'échec dans `error_logs` avec le client fourni (le client admin : la table n'a
 * pas à s'ouvrir aux sessions), ou un client admin créé ici.
 */
export async function journaliserEchec(admin: SupabaseClient | null, e: EchecServeur): Promise<void> {
  try {
    const client = admin ?? createAdminClient();
    const { error } = await client.from("error_logs").insert({
      user_id: e.userId ?? null,
      source: e.source.slice(0, 24),
      message: e.message.slice(0, 2000),
      url: e.url ?? null,
      meta: e.meta ?? {},
    });
    if (error) console.error(`[${e.source}] journal non écrit :`, error.message, "—", e.message);
  } catch (err) {
    console.error(`[${e.source}] journal non écrit :`, err instanceof Error ? err.message : String(err), "—", e.message);
  }
}
