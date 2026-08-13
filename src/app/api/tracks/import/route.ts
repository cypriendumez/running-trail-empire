export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { simplify, encodePolyline, bboxOf, type TrackPoint } from "@/lib/segments/geo";

const BASE = "https://intervals.icu/api/v1";

/**
 * IMPORT DES TRACES GPS — le préalable aux segments et au survol 3D.
 *
 * intervals.icu n'expose aucune coordonnée sur l'activité : tout est dans les FLUX,
 * et sous une forme contre-intuitive — `data` porte les latitudes, `data2` les
 * longitudes (et non des paires). Ce piège est déjà documenté dans
 * src/lib/intervals/location.ts, qui ne prenait que le premier point.
 *
 * Traitement PAR LOTS et non en une fois : 314 séances = 314 appels réseau, ce qui
 * dépasserait largement le temps d'exécution d'une fonction serverless. Chaque appel
 * traite un lot et renvoie ce qu'il reste à faire, le client rappelle jusqu'à zéro.
 */
const LOT = 15;

export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: profile } = await sb.from("profiles")
    .select("intervals_api_key, intervals_athlete_id").eq("id", user.id).maybeSingle();
  const apiKey = (profile as { intervals_api_key?: string } | null)?.intervals_api_key;
  // La clé ne quitte JAMAIS le serveur : elle sert ici et n'apparaît dans aucune réponse.
  if (!apiKey) {
    return NextResponse.json({ error: "Connecte d'abord ta montre dans Sync Montre." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Séances déjà traitées — succès comme absence de trace. Sans mémoriser les
  // secondes, on rappellerait indéfiniment intervals.icu pour des séances de tapis
  // qui n'auront jamais de coordonnées.
  const [{ data: workouts }, { data: done }] = await Promise.all([
    sb.from("workouts").select("id, external_id, date")
      .eq("user_id", user.id).not("external_id", "is", null)
      .order("date", { ascending: false }).limit(1000),
    admin.from("activity_tracks").select("workout_id").eq("user_id", user.id),
  ]);

  const traitees = new Set((done ?? []).map((t) => String((t as { workout_id: string }).workout_id)));
  const restantes = (workouts ?? []).filter((w) => !traitees.has(String((w as { id: string }).id)));
  const lot = restantes.slice(0, LOT);

  let importees = 0, sansGps = 0, echecs = 0;

  for (const w of lot as { id: string; external_id: string }[]) {
    try {
      const points = await fetchTrack(String(w.external_id).replace(/^i/, "i"), apiKey);
      if (!points) { echecs++; continue; }

      if (points.length < 2) {
        // Séance sans trace (tapis, home-trainer) : on l'ENREGISTRE comme telle,
        // pour ne plus jamais la redemander.
        await admin.from("activity_tracks").insert({
          workout_id: w.id, user_id: user.id, points: [], point_count: 0, has_gps: false,
        });
        sansGps++;
        continue;
      }

      const light = simplify(points, 10);
      const box = bboxOf(light);
      await admin.from("activity_tracks").insert({
        workout_id: w.id, user_id: user.id,
        points: light.map((p) => [Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6)), Math.round(p.t)]),
        polyline: encodePolyline(light),
        point_count: light.length,
        min_lat: box?.minLat, max_lat: box?.maxLat, min_lon: box?.minLon, max_lon: box?.maxLon,
        has_gps: true,
      });
      importees++;
    } catch { echecs++; }
  }

  return NextResponse.json({
    importees, sansGps, echecs,
    // Le client rappelle tant que ce nombre n'est pas nul : c'est ce qui rend
    // l'import de 314 traces possible sans jamais dépasser le temps d'exécution.
    restantes: Math.max(0, restantes.length - lot.length),
    total: (workouts ?? []).length,
  });
}

/**
 * Trace complète d'une activité : coordonnées + temps écoulé, ou null si l'API échoue.
 *
 * ⚠️ INTERVALS.ICU LIMITE LE DÉBIT, et c'est mesuré, pas supposé : lors de l'import
 * initial des 314 traces, tout s'est bien passé jusqu'à ~200 requêtes rapprochées,
 * puis 101 échecs D'AFFILÉE — alors que la même activité répondait HTTP 200 quelques
 * minutes plus tard, au repos. Sans ce court répit, un athlète au gros historique
 * verrait un tiers de ses traces manquer, en silence et sans explication.
 */
async function fetchTrack(activityId: string, apiKey: string): Promise<TrackPoint[] | null> {
  let r: Response | null = null;
  for (let essai = 0; essai < 2; essai++) {
    if (essai > 0) await new Promise((res) => setTimeout(res, 1200));
    r = await fetch(`${BASE}/activity/${activityId}/streams?types=latlng,time`, {
      headers: { Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64") },
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    if (r?.ok) break;
  }
  if (!r?.ok) return null;
  const j = await r.json();
  const flux = Array.isArray(j) ? j : [j];
  const latlng = flux.find((s) => s?.type === "latlng");
  const temps = flux.find((s) => s?.type === "time");

  const lats: unknown[] = latlng?.data ?? [];
  const lons: unknown[] = latlng?.data2 ?? [];
  if (!lats.length || lats.length !== lons.length) return [];

  const out: TrackPoint[] = [];
  for (let i = 0; i < lats.length; i++) {
    const lat = lats[i], lon = lons[i];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    // Garde-fous sur les coordonnées aberrantes : un (0,0) au large de l'Afrique
    // ferait exploser la zone englobante et casserait tout le préfiltrage.
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    if (lat === 0 && lon === 0) continue;
    // À défaut de flux temporel, on retombe sur l'indice : les montres échantillonnent
    // à 1 Hz. C'est une HYPOTHÈSE, mais elle ne sert qu'à ordonner les points — les
    // chronos de segment, eux, sont rejetés si le temps est nul (voir findEfforts).
    const t = typeof temps?.data?.[i] === "number" ? temps.data[i] : i;
    out.push({ lat, lon, t });
  }
  return out;
}
