// ─────────────────────────────────────────────────────────────────────────────
//  LA DOULEUR DÉCLARÉE AU KINÉ IA DOIT ATTEINDRE LE COACH — ET SON ÉCHEC, SE SAVOIR.
//
//  Le coach lit les déclarations `pain_report` pour retirer de l'intensité. Le kiné doit
//  répondre même si l'enregistrement échoue (c'est juste), mais jusqu'au 08/11/2026
//  l'échec ne partait que dans la console : le kiné répondait comme si la douleur était
//  notée, l'athlète le croyait, et le coach continuait de prescrire de la VMA.
//
//  Désormais la fonction rend ce qui s'est passé, la route le transmet à l'écran, et
//  l'échec est écrit dans `error_logs`.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { journaliserEchec } from "@/lib/journal/echecServeur";

export type Declaration = { userId: string; zone: string; zoneKey: string | null; painLevel: number; today: string };

/**
 * `true` : la douleur est enregistrée (ou l'était déjà aujourd'hui pour cette zone).
 * `false` : elle ne l'est pas, et l'écran doit le dire.
 *
 * Une seule déclaration par zone et par jour : le chat envoie la zone à CHAQUE message.
 * ⚠️ UNE LECTURE EN ÉCHEC NE DIT PAS « PAS ENCORE DÉCLARÉE » : sans réponse, on ne sait
 * pas, et insérer quand même créerait des doublons. On n'écrit rien et on le dit.
 */
export async function enregistrerDouleurDeclaree(
  supabase: SupabaseClient,
  d: Declaration,
  journal: SupabaseClient | null = null,
): Promise<boolean> {
  const echec = (cause: string) => journaliserEchec(journal, {
    source: "kine", userId: d.userId, url: "/api/ai/physio",
    // La zone et le niveau restent hors du message : ce sont des données de santé.
    message: `Douleur déclarée non enregistrée : ${cause}`,
  }).then(() => false);
  try {
    const { data: existing, error: eLecture } = await supabase.from("notifications")
      .select("id, data").eq("user_id", d.userId).eq("type", "pain_report")
      .gte("created_at", `${d.today}T00:00:00Z`).limit(20);
    if (eLecture) return echec(`lecture ${eLecture.code ?? "?"} ${eLecture.message}`);
    // Le dédoublonnage suit la CLÉ, pas le libellé : sinon changer de langue en cours de
    // journée rouvrirait une seconde déclaration pour la même zone.
    const cle = d.zoneKey || d.zone;
    const already = (existing ?? []).some((n) => {
      const x = n.data as { zone?: string; slot?: string } | null;
      return (x?.slot || x?.zone) === cle;
    });
    if (already) return true;
    const { error } = await supabase.from("notifications").insert({
      user_id: d.userId, type: "pain_report",
      title: `Douleur signalée : ${d.zone}`,
      body: `Intensité ${d.painLevel}/10 — déclarée depuis l'espace Santé.`,
      data: { zone: d.zone, slot: d.zoneKey ?? null, level: d.painLevel, date: d.today },
    });
    if (error) return echec(`écriture ${error.code ?? "?"} ${error.message}`);
    return true;
  } catch (e) {
    return echec(e instanceof Error ? e.message : String(e));
  }
}
