export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canSee, type Post } from "@/lib/social/feed";

/**
 * Fil d'actualité : ses propres publications et celles des athlètes suivis.
 *
 * La visibilité est appliquée DEUX FOIS — par les politiques RLS de PostgreSQL, qui
 * sont la vraie barrière, puis par `canSee` ici. Ce n'est pas de la redondance
 * inutile : une erreur de politique ne provoque aucun plantage, elle affiche
 * simplement la sortie de quelqu'un à qui ne devait pas la voir. Le second filtre
 * rend ce défaut visible en test au lieu d'en production.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const limit = Math.min(50, Number(new URL(req.url).searchParams.get("limit") ?? 20));

  const { data: following } = await sb.from("follows")
    .select("following_id").eq("follower_id", user.id).eq("status", "accepted");
  const followingIds = new Set((following ?? []).map((f) => String((f as { following_id: string }).following_id)));

  const authors = [user.id, ...followingIds];
  const { data: rows, error } = await sb.from("activity_posts")
    // ⚠️ La contrainte de clé étrangère est NOMMÉE explicitement, et ce n'est pas
    // du zèle : `profiles` est atteignable depuis `activity_posts` par DEUX chemins
    // (la clé `user_id`, et un lien plusieurs-à-plusieurs via `post_kudos`).
    // Sans la lever, PostgREST refuse de choisir et répond 300 (PGRST201) — le fil
    // entier restait vide, sans la moindre erreur visible côté athlète.
    .select(`id, user_id, title, body, photo_urls, visibility, kudos_count, comments_count, created_at,
             author:profiles!activity_posts_user_id_fkey(id, full_name, avatar_url),
             workout:workouts!activity_posts_workout_id_fkey(id, title, type, sport, date, distance_km, duration_seconds, elevation_gain_m)`)
    .in("user_id", authors)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: "Fil indisponible", detail: error.message }, { status: 500 });

  const posts = ((rows ?? []) as unknown as (Post & Record<string, unknown>)[])
    .filter((p) => canSee(p, user.id, followingIds));

  // Quelles publications ai-je déjà encouragées ? Une seule requête pour tout le
  // fil : interroger post par post aurait multiplié les allers-retours par 20.
  const ids = posts.map((p) => p.id);
  const { data: mine } = ids.length
    ? await sb.from("post_kudos").select("post_id").eq("user_id", user.id).in("post_id", ids)
    : { data: [] };
  const kudoed = new Set((mine ?? []).map((k) => String((k as { post_id: string }).post_id)));

  return NextResponse.json({
    posts: posts.map((p) => ({ ...p, kudoed: kudoed.has(p.id), mine: p.user_id === user.id })),
    // Le fil vide a deux causes très différentes, et l'écran doit savoir laquelle :
    // « tu ne suis personne » appelle l'annuaire, « personne n'a rien publié »
    // appelle la publication. Confondre les deux, c'est un cul-de-sac pour l'athlète.
    followingCount: followingIds.size,
  });
}
