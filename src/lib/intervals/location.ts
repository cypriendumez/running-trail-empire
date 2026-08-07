// ─────────────────────────────────────────────────────────────────────────────
//  POSITION D'ENTRAÎNEMENT
//  intervals.icu n'expose aucune latitude/longitude sur l'activité elle-même :
//  ni dans la liste, ni dans le détail. Les coordonnées ne vivent que dans le
//  FLUX `latlng`, et sous une forme peu évidente — `data` contient les latitudes,
//  `data2` les longitudes (et non des paires [lat, lon] comme on s'y attendrait).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

const BASE = "https://intervals.icu/api/v1";

/** Point de départ d'une activité, ou null si elle n'a pas de trace GPS (tapis, intérieur). */
export async function activityStartPoint(
  activityId: string, apiKey: string,
): Promise<{ lat: number; lon: number } | null> {
  try {
    const r = await fetch(`${BASE}/activity/${activityId}/streams?types=latlng`, {
      headers: { Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64") },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const stream = (Array.isArray(j) ? j : [j]).find((s) => s?.type === "latlng");
    const lat = stream?.data?.[0];
    const lon = stream?.data2?.[0];
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
  } catch { return null; }
}

/**
 * Rafraîchit la position connue de l'athlète depuis sa dernière séance GPS.
 * Best-effort et peu fréquent : on ne le fait que si la position stockée date de
 * plus de 24 h, pour ne pas ajouter un appel réseau à chaque synchronisation.
 */
export async function refreshAthleteLocation(
  admin: SupabaseClient,
  opts: { userId: string; apiKey: string; activityId: string; lastLocAt?: string | null },
): Promise<{ lat: number; lon: number } | null> {
  if (opts.lastLocAt && Date.now() - new Date(opts.lastLocAt).getTime() < 24 * 3600_000) return null;
  const pt = await activityStartPoint(opts.activityId, opts.apiKey);
  if (!pt) return null;
  await admin.from("profiles")
    .update({ last_lat: pt.lat, last_lon: pt.lon, last_loc_at: new Date().toISOString() })
    .eq("id", opts.userId)
    .then(() => {}, () => {});   // colonnes de la migration 013 : best-effort
  return pt;
}
