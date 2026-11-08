export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { aujourdhui, jourCivil, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { sportDuGpx, idExterneGpx, parseGPX } from "@/lib/intervals/gpx";

export const runtime = "nodejs";

// Distance entre deux points (le fichier est lu par `parseGPX`, lib/intervals/gpx).
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "gpx") {
    return NextResponse.json({ error: "Seuls les fichiers GPX sont supportés pour l'instant" }, { status: 400 });
  }

  const xml = await file.text();
  const { name, points } = parseGPX(xml);

  // Un fichier sans aucun point ni repère n'est pas un GPX (les séances sans trace, en salle,
  // sont refusées juste après : sans heures de passage, ni durée ni date réelles).
  if (points.length === 0 && !xml.includes("<trkpt") && !xml.includes("<wpt")) {
    return NextResponse.json({ error: "Fichier GPX invalide ou vide" }, { status: 400 });
  }

  // ⚠️ UNE SÉANCE SANS TRACE NI HEURES DE PASSAGE N'EST PAS UNE SÉANCE (08/11/2026). Sans
  // `<trkpt>`, `points[0]` faisait tomber la route ; sans horodatage, la durée devenait 1 s
  // (« minimum pour la contrainte ») et la date celle du jour : une allure de 10 km en 1 s,
  // datée d'aujourd'hui, entrait dans le volume et les records comme une mesure. Un
  // itinéraire préparé (sans heures) n'est pas une activité : on le dit.
  if (points.length < 2) {
    return NextResponse.json({ error: "Ce fichier ne contient pas de trace d'activité (aucun point de passage)." }, { status: 400 });
  }
  if (!points[0].time || !points[points.length - 1].time) {
    return NextResponse.json({ error: "Ce fichier n'a pas d'heures de passage : sans durée ni date réelles, la séance fausserait ton volume et tes records. Exporte l'activité enregistrée par ta montre, pas un itinéraire." }, { status: 400 });
  }

  // Calculate distance
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) distanceKm += haversine(points[i - 1], points[i]);

  // Calculate elevation gain
  let elevGain = 0;
  // Seulement entre deux points qui ont TOUS LES DEUX une altitude : un point sans `<ele>`
  // valait 0, et le saut de 0 à 300 m comptait 300 m de dénivelé inventé.
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].ele, b = points[i].ele;
    if (a == null || b == null) continue;
    const diff = b - a;
    if (diff > 0) elevGain += diff;
  }

  // Duration from timestamps
  let durationSec = 0;
  if (points[0].time && points[points.length - 1].time) {
    durationSec = (new Date(points[points.length - 1].time!).getTime() - new Date(points[0].time!).getTime()) / 1000;
  }

  // Date from first timestamp
  const dateStr = points[0].time ? jourCivil(points[0].time, FUSEAU_DEFAUT) : aujourdhui(FUSEAU_DEFAUT);

  // Sans `sport`, une course importée n'entrait pas dans les records (voir lib/intervals/gpx).
  const sport = sportDuGpx(xml, distanceKm, durationSec);
  // Le même fichier importé deux fois doublait la séance, donc le volume de la semaine.
  const externalId = idExterneGpx(points[0]?.time);
  if (externalId) {
    const { data: deja, error: eDeja } = await supabase.from("workouts").select("id")
      .eq("user_id", user.id).eq("external_id", externalId).limit(1).maybeSingle();
    // Sans réponse, on ne sait pas si elle est déjà là : l'insérer pourrait la doubler.
    if (eDeja) return NextResponse.json({ error: "Vérification impossible pour le moment, réessaie dans un instant." }, { status: 503 });
    if (deja) return NextResponse.json({ error: "Cette activité est déjà importée." }, { status: 409 });
  }

  const { data, error } = await supabase.from("workouts").insert({
    user_id: user.id,
    title: name,
    type: name.toLowerCase().includes("trail") ? "trail" : "easy",
    date: dateStr,
    duration_seconds: Math.max(1, Math.round(durationSec)), // minimum 1 pour la contrainte > 0
    distance_km: Math.round(distanceKm * 100) / 100,
    elevation_gain_m: Math.round(elevGain),
    elevation_loss_m: 0,
    source: "manual", // enum: manual|garmin|coros|strava|apple_health|polar
    ...(sport ? { sport } : {}),
    ...(externalId ? { external_id: externalId } : {}),
    created_at: new Date().toISOString(),
  })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, name, distanceKm, elevGain, durationSec, sport, workout: data });
}
