export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanBody, MAX_COMMENT } from "@/lib/social/feed";

/**
 * Encouragements et commentaires.
 *
 * Les compteurs affichés (`kudos_count`, `comments_count`) ne sont JAMAIS mis à jour
 * ici : ils le sont par trigger PostgreSQL (migration 019). Une route qui oublie de
 * décrémenter laisse un compteur faux à l'écran pour toujours — un chiffre plausible
 * et faux, précisément ce que ce projet traque.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const raw = await req.json().catch(() => ({})) as Record<string, unknown>;
  const postId = typeof raw.postId === "string" ? raw.postId : "";
  if (!postId) return NextResponse.json({ error: "Publication manquante" }, { status: 400 });

  // On vérifie que la publication est VISIBLE par le lecteur avant toute écriture.
  // La RLS filtre déjà la lecture, donc une publication invisible remonte `null` :
  // encourager ce qu'on n'a pas le droit de voir devient impossible.
  const { data: post } = await sb.from("activity_posts").select("id").eq("id", postId).maybeSingle();
  if (!post) return NextResponse.json({ error: "Publication introuvable" }, { status: 404 });

  if (raw.action === "comment") {
    const body = cleanBody(raw.body, MAX_COMMENT);
    if (!body) return NextResponse.json({ error: "Commentaire vide" }, { status: 400 });
    const { data, error } = await sb.from("post_comments")
      .insert({ post_id: postId, user_id: user.id, body })
      .select("id, body, created_at").single();
    if (error) return NextResponse.json({ error: "Commentaire refusé" }, { status: 500 });
    return NextResponse.json({ comment: data });
  }

  // Encouragement : bascule. La clé primaire (post_id, user_id) rend le double
  // encouragement impossible en base — on n'a pas à s'en remettre au client.
  const { data: existing } = await sb.from("post_kudos")
    .select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  if (existing) {
    await sb.from("post_kudos").delete().eq("post_id", postId).eq("user_id", user.id);
    return NextResponse.json({ kudoed: false });
  }
  const { error } = await sb.from("post_kudos").insert({ post_id: postId, user_id: user.id });
  if (error) return NextResponse.json({ error: "Encouragement refusé" }, { status: 500 });
  return NextResponse.json({ kudoed: true });
}

/** GET ?postId=… → commentaires d'une publication. */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const postId = new URL(req.url).searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "Publication manquante" }, { status: 400 });

  const { data } = await sb.from("post_comments")
    // Contrainte nommée pour la même raison que dans le fil : sans elle, PostgREST
    // hésite entre plusieurs chemins vers `profiles` et répond 300.
    .select("id, body, created_at, author:profiles!post_comments_user_id_fkey(id, full_name, avatar_url)")
    .eq("post_id", postId).order("created_at", { ascending: true }).limit(100);

  return NextResponse.json({ comments: data ?? [] });
}
