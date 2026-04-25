import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function nominatim(city: string, dept: string): Promise<{ lat: number; lon: number } | null> {
  const queries = [
    city ? `${city}, France` : null,
    dept ? `département ${dept}, France` : null,
  ].filter(Boolean) as string[];

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=fr`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "RunningTrailEmpire/1.0 contact@running-empire.fr" },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data[0]?.lat) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    } catch {}
  }
  return null;
}

export async function POST() {
  // Fetch races without GPS
  const { data: races, error } = await supabaseAdmin
    .from("races")
    .select("id,city,department")
    .or("latitude.is.null,longitude.is.null")
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!races || races.length === 0) return NextResponse.json({ geocoded: 0, message: "Tous les pins sont déjà géolocalisés" });

  let geocoded = 0;
  let failed = 0;

  for (let i = 0; i < races.length; i++) {
    const race = races[i];
    await new Promise(r => setTimeout(r, 1100)); // Nominatim: max 1 req/sec

    const coords = await nominatim(race.city || "", race.department || "");
    if (coords) {
      const { error: updErr } = await supabaseAdmin
        .from("races")
        .update({ latitude: coords.lat, longitude: coords.lon, updated_at: new Date().toISOString() })
        .eq("id", race.id);
      if (!updErr) geocoded++;
      else failed++;
    } else {
      failed++;
    }
  }

  const { count } = await supabaseAdmin
    .from("races")
    .select("*", { count: "exact", head: true })
    .not("latitude", "is", null);

  return NextResponse.json({
    geocoded,
    failed,
    total_with_gps: count,
    message: `${geocoded} courses géolocalisées`,
  });
}

export async function GET() {
  return POST();
}
