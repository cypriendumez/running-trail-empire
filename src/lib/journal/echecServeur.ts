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
import { sansAdresse } from "@/lib/journal/sansAdresse";

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
 * La cause d'une exception, STABLE d'un passage à l'autre : identifiants et nombres
 * remplacés, longueur bornée. Sans cela, « une fois par jour » ne dédoublonne plus rien
 * dès qu'un message porte une valeur variable (durée, identifiant) — et la synchro repasse
 * toutes les 2 min : jusqu'à ~720 lignes par jour et par compte (relecture du 09/11/2026).
 */
export function causeStable(e: unknown): string {
  // ⚠️ Appelée DANS des gestionnaires d'erreur : elle ne doit jamais lever (relecture du
  // 09/11/2026). `String()` lève sur un objet sans prototype, et le `message` d'une Error
  // n'est pas forcément une chaîne.
  try {
    // Une erreur PostgREST brute est un objet `{ message, code }`, pas une Error : sans ce cas,
    // sa cause devenait « [object Object] ». Une Error sans message garde au moins son nom.
    const message = e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string"
      ? (e as { message: string }).message : null;
    const brut = message ? message : e instanceof Error ? e.name : String(e);
    return brut.replace(/\b[0-9a-f]{8,}(?:-[0-9a-f]{4,})*\b/gi, "[id]").replace(/\d+/g, "#").slice(0, 160);
  } catch {
    return "cause illisible";
  }
}

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
      message: sansAdresse(e.message).slice(0, 2000),
      url: e.url ?? null,
      meta: sansAdresse(e.meta ?? {}),
    });
    if (error) console.error(`[${e.source}] journal non écrit :`, error.message, "—", e.message);
  } catch (err) {
    console.error(`[${e.source}] journal non écrit :`, err instanceof Error ? err.message : String(err), "—", e.message);
  }
}

/**
 * Comme `journaliserEchec`, mais une seule ligne par compte, source et message sur la
 * fenêtre (24 h par défaut). Pour les tâches qui repassent souvent (synchronisation toutes
 * les 30 min, coach de nuit) : un refus durable — accès intervals.icu retiré — écrirait
 * sinon la même ligne quarante-huit fois par jour, et un journal qui crie cesse d'être lu.
 * Sans réponse sur l'existant, on écrit : une ligne de trop vaut mieux qu'un échec tu.
 */
export async function journaliserEchecUneFois(admin: SupabaseClient | null, e: EchecServeur, fenetreMs = 24 * 3600 * 1000): Promise<void> {
  try {
    const client = admin ?? createAdminClient();
    const message = sansAdresse(e.message).slice(0, 2000);
    let q = client.from("error_logs").select("id").eq("source", e.source.slice(0, 24)).eq("message", message)
      .gte("created_at", new Date(Date.now() - fenetreMs).toISOString()).limit(1);
    q = e.userId ? q.eq("user_id", e.userId) : q.is("user_id", null);
    const { data, error } = await q;
    if (!error && (data ?? []).length) return;
    await journaliserEchec(client, e);
  } catch (err) {
    console.error(`[${e.source}] journal non écrit :`, err instanceof Error ? err.message : String(err), "—", e.message);
  }
}
