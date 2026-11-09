// ─────────────────────────────────────────────────────────────────────────────
//  LA DOULEUR DÉCLARÉE DOIT ATTEINDRE LE COACH — ET SON ÉCHEC, SE SAVOIR.
//
//  Le coach lit les déclarations `pain_report` pour retirer de l'intensité. Elles venaient
//  de la consultation du « kiné IA », retirée le 09/11/2026 (lib/health/kineIa) ; elles
//  viennent désormais de l'onglet Santé › Douleurs (/api/health/declarer), sans IA.
//  Jusqu'au 08/11/2026 l'échec ne partait que dans la console : l'athlète croyait la
//  douleur notée, et le coach continuait de prescrire de la VMA.
//
//  Désormais la fonction rend ce qui s'est passé, la route le transmet à l'écran, et
//  l'échec est écrit dans `error_logs`.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { journaliserEchec } from "@/lib/journal/echecServeur";

export type Declaration = { userId: string; zone: string; zoneKey: string | null; painLevel: number; today: string };

export { SEUIL_DOULEUR_DECLAREE } from "@/lib/health/seuilDouleur";

/**
 * `true` : la douleur est enregistrée (ou l'était déjà aujourd'hui pour cette zone).
 * `false` : elle ne l'est pas, et l'écran doit le dire.
 *
 * Une seule déclaration par zone et par jour ; une seconde déclaration PLUS FORTE le même jour
 * relève son niveau (relecture du 09/11/2026 : « 3 puis 8 » restait à 3, sous un « enregistrée »).
 * ⚠️ UNE LECTURE EN ÉCHEC NE DIT PAS « PAS ENCORE DÉCLARÉE » : sans réponse, on ne sait
 * pas, et insérer quand même créerait des doublons. On n'écrit rien et on le dit.
 */
export async function enregistrerDouleurDeclaree(
  supabase: SupabaseClient,
  d: Declaration,
  journal: SupabaseClient | null = null,
): Promise<boolean> {
  const echec = (cause: string) => journaliserEchec(journal, {
    source: "douleur", userId: d.userId, url: "/api/health/declarer",
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
    const deja = (existing ?? []).find((n) => {
      const x = n.data as { zone?: string; slot?: string } | null;
      return (x?.slot || x?.zone) === cle;
    });
    if (deja) {
      const avant = deja.data as Record<string, unknown> | null;
      // ⚠️ UNE DOULEUR « PASSÉE » QUI REVIENT LE MÊME JOUR SE ROUVRE (relecture du 09/11/2026) :
      // la ligne du jour gardait `etat: "resolu"`, ne pesait plus (`pese`), et l'écran disait
      // pourtant « enregistrée ». Rouverte, elle repart à l'intensité déclarée.
      const resolue = String(avant?.etat ?? "") === "resolu";
      if (!resolue && Number(avant?.level) >= d.painLevel) return true;
      const { error: eMaj } = await supabase.from("notifications").update({
        body: `Intensité ${d.painLevel}/10 — déclarée depuis l'espace Santé.`,
        data: { ...(avant ?? {}), level: resolue ? d.painLevel : Math.max(Number(avant?.level) || 0, d.painLevel), etat: "actif", majA: d.today },
      }).eq("id", (deja as { id: string }).id).eq("user_id", d.userId);
      if (eMaj) return echec(`mise à jour ${eMaj.code ?? "?"} ${eMaj.message}`);
      return true;
    }
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
