export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ routes: [] });

  // Les FAVORIS d'abord, puis les plus récents. C'est tout l'objet du cœur : le
  // parcours qu'on refait chaque semaine descendait d'un cran à chaque nouveau tracé,
  // jusqu'à se perdre sous les essais abandonnés.
  const { data, error } = await supabase
    .from("user_routes")
    .select("*")
    .eq("user_id", user.id)
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    // Migration 024 en retard : `is_favorite` n'existe pas encore et PostgREST rejette
    // le tri entier. On retombe sur l'ordre chronologique plutôt que de renvoyer une
    // liste VIDE — l'athlète perdrait l'accès à tous ses parcours pour une colonne.
    const repli = await supabase.from("user_routes").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    return NextResponse.json({ routes: repli.data ?? [] });
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

/**
 * PATCH { id, isFavorite } → met ou retire le cœur.
 *
 * On IMPOSE la valeur au lieu de basculer côté serveur : deux clics rapides sur le
 * cœur, ou deux onglets ouverts, et une bascule aveugle laisserait l'affichage et la
 * base en désaccord — un cœur plein à l'écran, un parcours non favori en base, sans
 * que rien ne le signale.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { id?: string; isFavorite?: boolean };
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  if (typeof body.isFavorite !== "boolean") return NextResponse.json({ error: "isFavorite requis" }, { status: 400 });

  // `eq("user_id")` en plus de l'identifiant : la RLS protège déjà, mais une requête
  // qui ne dit pas à qui appartient la ligne finirait par être copiée ailleurs sans
  // cette protection. On l'écrit ici pour qu'elle voyage avec le code.
  const { data, error } = await supabase
    .from("user_routes")
    .update({ is_favorite: body.isFavorite })
    .eq("id", id).eq("user_id", user.id)
    .select("id, is_favorite").maybeSingle();

  if (error) {
    // Migration 024 en retard : on le DIT, plutôt que de répondre « ok » à un cœur qui
    // n'a rien enregistré. Un succès mensonger est pire qu'une erreur affichée.
    return NextResponse.json({ error: "Favoris indisponibles : migration 024 à appliquer." }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: "Parcours introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true, route: data });
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
