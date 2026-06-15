export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/workouts/log — enregistre une course faite au TÉLÉPHONE (GPS, sans montre),
// façon Strava : distance, durée, allure, D+, FC + tracé GPS → apparaît dans l'historique.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const distance_km = Number(b.distanceKm) || 0;
  const duration_seconds = Math.round(Number(b.durationSeconds) || 0);
  if (!(distance_km > 0.1) || !(duration_seconds > 30)) {
    return NextResponse.json({ error: "Course trop courte pour être enregistrée." }, { status: 400 });
  }
  const date = typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(b.date) ? b.date.slice(0, 10) : new Date().toISOString().slice(0, 10);

  // Tracé GPS (sous-échantillonné) stocké dans `notes` (champ libre, non affiché) → carte plus tard.
  let notes: string | null = null;
  if (Array.isArray(b.track) && b.track.length > 1) {
    const pts = b.track
      .filter((p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
      .map((p: [number, number]) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]);
    if (pts.length > 1) notes = "[GPS]" + JSON.stringify(pts.slice(0, 500));
  }

  const row = {
    user_id: user.id,
    title: (typeof b.title === "string" && b.title.trim()) ? b.title.slice(0, 100) : "Course (téléphone)",
    type: typeof b.type === "string" ? b.type : "easy",
    date,
    duration_seconds,
    distance_km: Math.round(distance_km * 100) / 100,
    elevation_gain_m: b.elevationGain != null ? Math.round(Number(b.elevationGain)) : null,
    elevation_loss_m: b.elevationLoss != null ? Math.round(Number(b.elevationLoss)) : null,
    avg_pace_min_km: Math.round((duration_seconds / 60 / distance_km) * 100) / 100,
    avg_hr: b.avgHr != null ? Math.round(Number(b.avgHr)) : null,
    max_hr: b.maxHr != null ? Math.round(Number(b.maxHr)) : null,
    source: "phone_gps",
    notes,
  };

  const { data, error } = await sb.from("workouts").insert(row).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
