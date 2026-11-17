// ─────────────────────────────────────────────────────────────────────────────
//  LA LECTURE DES SÉANCES DE LA VMA — une seule, pour le coach et chaque écran (13/11/2026).
//
//  Les séances des `JOURS_VMA` derniers jours, TOUS SPORTS (l'acclimatation à la chaleur compte aussi
//  le vélo), sans plafond en nombre autre qu'un garde-fou. `effortDesSeances` garde ensuite la course à
//  pied et la fenêtre exacte. Avant : les 60 dernières séances — 7 semaines de courses seulement chez
//  un coureur qui fait aussi du vélo.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { debutFenetreVma, PLAFOND_SEANCES_VMA } from "@/lib/dashboard/vmaAffichee";
import { repereDuJourCoureur } from "@/lib/time/fuseau";

export const COLONNES_SEANCES_VMA = "date,type,sport,distance_km,duration_seconds,avg_hr,max_hr,weather_temp_c";

export function lireSeancesVma(sb: SupabaseClient, userId: string, maintenant = repereDuJourCoureur()) {
  return sb.from("workouts").select(COLONNES_SEANCES_VMA).eq("user_id", userId)
    .gte("date", debutFenetreVma(maintenant)).order("date", { ascending: false }).limit(PLAFOND_SEANCES_VMA);
}
