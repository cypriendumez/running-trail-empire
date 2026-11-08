// Lecture des séances qui alimentent la dépense du mode poids (route /api/weight).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnergyWorkout } from "@/lib/weight/energy";

/**
 * Séances des 30 derniers jours, ou `null` quand elles sont ILLISIBLES.
 *
 * ⚠️ UNE PANNE N'EST PAS « 0 SÉANCE » (08/11/2026). L'erreur de la seconde lecture n'était
 * pas lue : `[]` partait au calcul, la dépense était calculée sans aucun sport, et la cible
 * calorique sortait trop basse — un chiffre de santé présenté comme mesuré, expliqué à
 * l'écran par « aucune séance chiffrable ». Sans séances lisibles, on ne calcule rien.
 */
export async function fetchWorkouts(sb: Pick<SupabaseClient, "from">, userId: string): Promise<EnergyWorkout[] | null> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const cols = "date, type, distance_km, duration_seconds, elevation_gain_m, avg_power_watts";
  const withSport = await sb.from("workouts").select(`${cols}, sport`).eq("user_id", userId).gte("date", since);
  if (!withSport.error) return (withSport.data ?? []) as unknown as EnergyWorkout[];
  // Repli prévu pour la colonne `sport` absente ; il échoue à son tour en cas de vraie panne.
  const plain = await sb.from("workouts").select(cols).eq("user_id", userId).gte("date", since);
  if (plain.error) return null;
  return (plain.data ?? []) as unknown as EnergyWorkout[];
}
