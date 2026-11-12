// ─────────────────────────────────────────────────────────────────────────────
//  LA FC MAX COMMUNE, LUE EN BASE — pour les écrans qui n'ont pas déjà ses entrées sous la main
//  (tableau de bord, en-tête, indicateurs, Plans, Profil, routes admin). Cyprien, 12/11/2026 :
//  la VMA estimée affichée triait ses « efforts maximaux » avec son propre pic (> 120 sur les
//  dernières séances, sans fenêtre de date ni FC déclarée). Elle passe désormais par la même
//  définition que le coach, la montre, Jour J, le bilan et l'analyse de séance (`fcMaxConnue`).
//
//  ⚠️ SERVEUR SEULEMENT (journal des échecs, client admin) : jamais importé par un composant client.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { fcMaxConnue, seuilMesure, PIC_FC_JOURS } from "@/lib/coach/fcCible";
import { journaliserEchecUneFois } from "@/lib/journal/echecServeur";

/**
 * La FC max commune de l'athlète : la plus haute entre la déclarée (test, profil, sinon montre) et
 * le pic des {@link PIC_FC_JOURS} derniers jours (> 150), sinon le seuil mesuré ÷ 0,92, sinon `null`.
 *
 * `undefined` = une lecture est en PANNE (journalisée une fois par jour) : ce n'est pas « FC max
 * inconnue ». L'appelant garde alors son repli d'avant plutôt que de calculer sur un trou.
 */
export async function fcMaxDeLAthlete(sb: SupabaseClient, userId: string): Promise<number | null | undefined> {
  const [base, prof, pic] = await Promise.all([
    sb.from("performance_baselines").select("max_hr,lt_hr").eq("user_id", userId)
      .order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("profiles").select("max_hr, garmin_metrics").eq("id", userId).maybeSingle(),
    sb.from("workouts").select("max_hr").eq("user_id", userId).not("max_hr", "is", null)
      .gte("date", new Date(Date.now() - PIC_FC_JOURS * 86400000).toISOString().slice(0, 10))
      .order("max_hr", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const panne = base.error ?? prof.error ?? pic.error;
  if (panne) {
    await journaliserEchecUneFois(null, { source: "fc-max", message: `FC max illisible : ${panne.message}`, userId });
    return undefined;
  }
  const b = base.data as { max_hr?: number | null; lt_hr?: number | null } | null;
  const p = prof.data as { max_hr?: number | null; garmin_metrics?: Record<string, unknown> | null } | null;
  return fcMaxConnue({
    declaree: Number(b?.max_hr) || Number(p?.max_hr) || null, montre: p?.garmin_metrics?.maxHR,
    observee: (pic.data as { max_hr?: number | null } | null)?.max_hr, seuil: seuilMesure(b?.lt_hr, p?.garmin_metrics?.lthr),
  }).max;
}
