export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ReviewRow { route_ref: string; rating: number }

// GET /api/community/reviews?ref=tr-gr20            → avis détaillés + moyenne
// GET /api/community/reviews?refs=tr-gr20,ru-...     → agrégats (moyenne/nb) par parcours
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const refs = searchParams.get("refs");
  const ref = searchParams.get("ref");

  // Mode agrégats (pour la grille de cartes)
  if (refs) {
    const list = refs.split(",").map(s => s.trim()).filter(Boolean).slice(0, 600);
    if (list.length === 0) return NextResponse.json({ aggregates: {} });
    const { data, error } = await supabase
      .from("route_reviews")
      .select("route_ref, rating")
      .in("route_ref", list);
    if (error) return NextResponse.json({ aggregates: {} });
    const agg: Record<string, { sum: number; count: number }> = {};
    for (const r of (data ?? []) as ReviewRow[]) {
      const a = (agg[r.route_ref] ??= { sum: 0, count: 0 });
      a.sum += r.rating;
      a.count += 1;
    }
    const aggregates: Record<string, { avg: number; count: number }> = {};
    for (const [k, v] of Object.entries(agg)) {
      aggregates[k] = { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count };
    }
    return NextResponse.json({ aggregates });
  }

  // Mode détaillé (pour la fiche d'un parcours)
  if (!ref) return NextResponse.json({ reviews: [], avg: 0, count: 0 });
  const { data, error } = await supabase
    .from("route_reviews")
    .select("*")
    .eq("route_ref", ref)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ reviews: [], avg: 0, count: 0 });
  const reviews = data ?? [];
  const count = reviews.length;
  const avg = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  return NextResponse.json({ reviews, avg, count });
}

// POST /api/community/reviews  → laisser / mettre à jour son avis (1 par parcours)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { ref, rating, comment } = await req.json();
  if (!ref || !rating) return NextResponse.json({ error: "Parcours et note requis" }, { status: 400 });

  let author = "Coureur";
  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  if (prof?.full_name) author = prof.full_name as string;

  const { data, error } = await supabase
    .from("route_reviews")
    .upsert(
      {
        route_ref: String(ref),
        user_id: user.id,
        author_name: author,
        rating: Math.max(1, Math.min(5, Math.round(Number(rating)))),
        comment: (comment || "").slice(0, 1000),
        created_at: new Date().toISOString(),
      },
      { onConflict: "route_ref,user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data });
}
