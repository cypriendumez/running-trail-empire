export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/community/routes?sport=course  → liste des parcours publics partagés
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport");

  let query = supabase
    .from("community_routes")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(500);
  if (sport) query = query.eq("sport", sport);

  const { data, error } = await query;
  if (error) {
    // Table absente (migration non appliquée) — on renvoie une liste vide.
    return NextResponse.json({ routes: [] });
  }
  return NextResponse.json({ routes: data ?? [] });
}

// POST /api/community/routes  → publier un parcours à la communauté
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const {
    name, sport, coordinates, distance_km, elevation_gain_m,
    duration_min, difficulty, region, city, description,
  } = body;

  if (!name || !sport || !Array.isArray(coordinates) || coordinates.length < 2) {
    return NextResponse.json({ error: "Nom, sport et tracé requis" }, { status: 400 });
  }
  if (!["course", "trail", "velo", "marche"].includes(sport)) {
    return NextResponse.json({ error: "Sport invalide" }, { status: 400 });
  }

  // Point de départ représentatif (milieu du tracé) pour la vignette / le centrage
  const mid = coordinates[Math.floor(coordinates.length / 2)] as [number, number];
  const lat = typeof body.lat === "number" ? body.lat : mid[1];
  const lng = typeof body.lng === "number" ? body.lng : mid[0];

  // Nom d'auteur depuis le profil
  let author = "Coureur";
  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  if (prof?.full_name) author = prof.full_name as string;

  const { data, error } = await supabase
    .from("community_routes")
    .insert({
      user_id: user.id,
      author_name: author,
      name: String(name).slice(0, 120),
      sport,
      coordinates,
      distance_km: Math.round((distance_km || 0) * 100) / 100,
      elevation_gain_m: Math.round(elevation_gain_m || 0),
      duration_min: Math.round(duration_min || 0),
      difficulty: ["green", "blue", "red", "black"].includes(difficulty) ? difficulty : "green",
      region: (region || "").slice(0, 80),
      city: (city || "").slice(0, 80),
      lat,
      lng,
      description: (description || "").slice(0, 600),
      is_public: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ route: data });
}

// DELETE /api/community/routes?id=...  → retirer son propre parcours partagé
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const { error } = await supabase
    .from("community_routes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
