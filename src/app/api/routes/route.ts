import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ routes: [] });

  const { data, error } = await supabase
    .from("user_routes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    // Table doesn't exist yet — return empty
    return NextResponse.json({ routes: [] });
  }
  return NextResponse.json({ routes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { name, coordinates, distance_km, elevation_gain_m, duration_min, difficulty } = body;

  if (!name || !coordinates?.length) {
    return NextResponse.json({ error: "Nom et coordonnées requis" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_routes")
    .insert({
      user_id: user.id,
      name,
      coordinates,         // [[lng,lat], ...]
      distance_km: Math.round(distance_km * 100) / 100,
      elevation_gain_m: Math.round(elevation_gain_m),
      duration_min: Math.round(duration_min),
      difficulty: difficulty || "green",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ route: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const { error } = await supabase
    .from("user_routes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
