// ─────────────────────────────────────────────────────────────────────────────
//  IMPORT DES TRACES GPS — appelé par la synchronisation ET par la route dédiée.
//
//  ⚠️ POURQUOI CE FICHIER EXISTE. L'import initial des 314 traces était un script
//  lancé une fois à la main. Les séances suivantes entraient bien en base par la
//  synchronisation, mais leur trace n'était JAMAIS importée : elles disparaissaient
//  du survol, de la carte de chaleur et de l'appariement de segments, sans que rien
//  ne signale l'absence. Un défaut silencieux qui s'aggravait à chaque sortie.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { simplify, encodePolyline, bboxOf, type TrackPoint } from "@/lib/segments/geo";

const BASE = "https://intervals.icu/api/v1";

/**
 * Importe les traces manquantes, par petits lots.
 *
 * `max` est volontairement bas quand l'appel vient de la synchronisation : celle-ci
 * a déjà son propre budget de temps, et intervals.icu limite le débit au-delà d'environ
 * 200 requêtes rapprochées (mesuré). Le reliquat sera pris à la synchro suivante.
 */
export async function importMissingTracks(
  sb: SupabaseClient,
  opts: { userId: string; apiKey: string; max?: number },
): Promise<{ imported: number; withoutGps: number; failed: number; remaining: number }> {
  const max = opts.max ?? 8;

  const [{ data: workouts }, { data: done }] = await Promise.all([
    sb.from("workouts").select("id, external_id")
      .eq("user_id", opts.userId).not("external_id", "is", null)
      .order("date", { ascending: false }).limit(1000),
    sb.from("activity_tracks").select("workout_id").eq("user_id", opts.userId),
  ]);

  const traitees = new Set((done ?? []).map((t) => String((t as { workout_id: string }).workout_id)));
  const restantes = (workouts ?? []).filter((w) => !traitees.has(String((w as { id: string }).id)));
  const lot = restantes.slice(0, max) as { id: string; external_id: string }[];

  let imported = 0, withoutGps = 0, failed = 0;

  for (const w of lot) {
    try {
      const pts = await fetchTrack(String(w.external_id), opts.apiKey);
      if (pts === null) { failed++; continue; }

      if (pts.length < 2) {
        // Séance sans trace (tapis, home-trainer) : on l'enregistre COMME TELLE, pour
        // ne plus jamais la redemander à chaque synchronisation.
        await sb.from("activity_tracks").insert({
          workout_id: w.id, user_id: opts.userId, points: [], point_count: 0, has_gps: false,
        });
        withoutGps++;
        continue;
      }

      const light = simplify(pts, 10);
      const box = bboxOf(light);
      await sb.from("activity_tracks").insert({
        workout_id: w.id, user_id: opts.userId,
        // Positions : 0 lat, 1 lon, 2 temps, 3 altitude, 4 FC, 5 cadence, 6 puissance.
        points: light.map((p) => [
          Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6)), Math.round(p.t),
          p.alt ?? null, p.hr ?? null, p.cad ?? null, p.pw ?? null,
        ]),
        polyline: encodePolyline(light),
        point_count: light.length,
        min_lat: box?.minLat, max_lat: box?.maxLat, min_lon: box?.minLon, max_lon: box?.maxLon,
        has_gps: true,
      });
      imported++;
    } catch { failed++; }
  }

  return { imported, withoutGps, failed, remaining: Math.max(0, restantes.length - lot.length) };
}

/** Trace complète d'une activité : coordonnées, temps, altitude, FC, cadence, puissance. */
async function fetchTrack(activityId: string, apiKey: string): Promise<TrackPoint[] | null> {
  let r: Response | null = null;
  // Un seul réessai : intervals.icu limite le débit au-delà d'environ 200 requêtes
  // rapprochées, et un court répit suffit à repasser.
  for (let essai = 0; essai < 2; essai++) {
    if (essai > 0) await new Promise((res) => setTimeout(res, 1200));
    r = await fetch(`${BASE}/activity/${activityId}/streams?types=latlng,time,altitude,heartrate,cadence,watts`, {
      headers: { Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64") },
      signal: AbortSignal.timeout(25000),
    }).catch(() => null);
    if (r?.ok) break;
  }
  if (!r?.ok) return null;

  const j = await r.json();
  const flux = Array.isArray(j) ? j : [j];
  const lire = (n: string) => flux.find((s: { type?: string }) => s?.type === n) as { data?: unknown[]; data2?: unknown[] } | undefined;

  // ⚠️ `data` porte les latitudes et `data2` les longitudes — et non des paires.
  const latlng = lire("latlng");
  const lats = (latlng?.data ?? []) as unknown[];
  const lons = (latlng?.data2 ?? []) as unknown[];
  if (!lats.length || lats.length !== lons.length) return [];

  const temps = lire("time")?.data as number[] | undefined;
  const alt = lire("altitude")?.data as number[] | undefined;
  const hr = lire("heartrate")?.data as number[] | undefined;
  const cad = lire("cadence")?.data as number[] | undefined;
  const pw = lire("watts")?.data as number[] | undefined;
  const val = (src: number[] | undefined, i: number) =>
    typeof src?.[i] === "number" ? Math.round(src[i] * 10) / 10 : undefined;

  const out: TrackPoint[] = [];
  for (let i = 0; i < lats.length; i++) {
    const lat = lats[i], lon = lons[i];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    // Un (0,0) au large de l'Afrique ferait exploser la zone englobante et casserait
    // tout le préfiltrage des segments.
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) continue;
    out.push({
      lat, lon,
      t: typeof temps?.[i] === "number" ? temps[i] : i,
      alt: val(alt, i), hr: val(hr, i), cad: val(cad, i), pw: val(pw, i),
    });
  }
  return out;
}
