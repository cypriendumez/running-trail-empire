export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/community/routes?sport=course  → liste des parcours publics partagés
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport");

  // Colonnes NOMMÉES (audit du 08/11/2026) : `*` publiait l'identifiant du compte de chaque
  // auteur à quiconque, connecté ou non.
  let query = supabase
    .from("community_routes")
    .select("id, author_name, name, sport, coordinates, distance_km, elevation_gain_m, duration_min, difficulty, region, city, lat, lng, description, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(500);
  if (sport) query = query.eq("sport", sport);

  const { data, error } = await query;
  if (error) {
    // Table absente (migration non appliquée) : vraiment rien à montrer. Toute autre erreur est
    // une panne, pas « aucun parcours partagé ».
    if (error.code === "42P01") return NextResponse.json({ routes: [] });
    return NextResponse.json({ error: "Parcours momentanément illisibles." }, { status: 503 });
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

  // ⚠️ AUCUNE MESURE INVENTÉE (audit du 08/11/2026) : `|| 0` publiait « D+ 0 m » ou « 0 min »
  // comme une mesure. Les colonnes sont NOT NULL : un parcours sans ces données n'est pas publié.
  const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (!fini(distance_km) || distance_km <= 0 || !fini(duration_min) || !fini(elevation_gain_m)) {
    return NextResponse.json({ error: "Distance, durée et dénivelé requis : un parcours sans ces mesures ne peut pas être partagé." }, { status: 400 });
  }

  // Point de départ représentatif (milieu du tracé) pour la vignette / le centrage
  const mid = coordinates[Math.floor(coordinates.length / 2)] as [number, number];
  const lat = typeof body.lat === "number" ? body.lat : mid[1];
  const lng = typeof body.lng === "number" ? body.lng : mid[0];

  // Nom d'auteur depuis le profil
  let author = "Coureur";
  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  // Le prénom seul, comme le Club : le parcours est PUBLIC (audit du 08/11/2026).
  if (prof?.full_name) author = String(prof.full_name).trim().split(/\s+/)[0] || author;

  const { data, error } = await supabase
    .from("community_routes")
    .insert({
      user_id: user.id,
      author_name: author,
      name: String(name).slice(0, 120),
      sport,
      coordinates,
      distance_km: Math.round(distance_km * 100) / 100,
      elevation_gain_m: Math.round(elevation_gain_m),
      duration_min: Math.round(duration_min),
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
