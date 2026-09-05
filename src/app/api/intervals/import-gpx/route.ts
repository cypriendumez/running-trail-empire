export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { aujourdhui, jourCivil, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

export const runtime = "nodejs";

// Minimal GPX parser — extracts name, trkpts, distance
function parseGPX(xml: string): { name: string; points: { lat: number; lng: number; ele?: number; time?: string }[] } {
  const nameMatch = xml.match(/<name>(.*?)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : "Activité importée";

  const trkptRegex = /<trkpt lat="([^"]+)" lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  const points: { lat: number; lng: number; ele?: number; time?: string }[] = [];

  let m;
  while ((m = trkptRegex.exec(xml)) !== null) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    const inner = m[3];
    const eleMatch = inner.match(/<ele>(.*?)<\/ele>/);
    const timeMatch = inner.match(/<time>(.*?)<\/time>/);
    points.push({
      lat,
      lng,
      ele: eleMatch ? parseFloat(eleMatch[1]) : undefined,
      time: timeMatch ? timeMatch[1] : undefined,
    });
  }
  return { name, points };
}

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

  // Accept even 0-point GPX (manual/indoor activities with no GPS track)
  if (points.length === 0 && !xml.includes("<trkpt") && !xml.includes("<wpt")) {
    return NextResponse.json({ error: "Fichier GPX invalide ou vide" }, { status: 400 });
  }

  // Calculate distance
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) distanceKm += haversine(points[i - 1], points[i]);

  // Calculate elevation gain
  let elevGain = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = (points[i].ele ?? 0) - (points[i - 1].ele ?? 0);
    if (diff > 0) elevGain += diff;
  }

  // Duration from timestamps
  let durationSec = 0;
  if (points[0].time && points[points.length - 1].time) {
    durationSec = (new Date(points[points.length - 1].time!).getTime() - new Date(points[0].time!).getTime()) / 1000;
  }

  // Date from first timestamp
  const dateStr = points[0].time ? jourCivil(points[0].time, FUSEAU_DEFAUT) : aujourdhui(FUSEAU_DEFAUT);

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
    created_at: new Date().toISOString(),
  })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, name, distanceKm, elevGain, durationSec, workout: data });
}
