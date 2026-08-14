export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanBody, canComment, MAX_COMMENT } from "@/lib/social/feed";
import { premierGrosMot } from "@/lib/social/moderation";

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
  const { data: post } = await sb.from("activity_posts").select("id, user_id, visibility, created_at").eq("id", postId).maybeSingle();
  if (!post) return NextResponse.json({ error: "Publication introuvable" }, { status: 404 });

  if (raw.action === "comment") {
    const body = cleanBody(raw.body, MAX_COMMENT);
    if (!body) return NextResponse.json({ error: "Commentaire vide" }, { status: 400 });

    // ── GROSSIÈRETÉS ───────────────────────────────────────────────────────────
    // Refusé AVANT toute écriture, et avec le mot en cause : un refus sans motif se
    // lit comme une panne, et l'auteur réessaie à l'identique.
    const fautif = premierGrosMot(body);
    if (fautif) {
      return NextResponse.json(
        { error: `Commentaire refusé : « ${fautif} » n'a pas sa place ici.`, motif: "grossierete" },
        { status: 422 },
      );
    }

    // ── QUI A LE DROIT DE COMMENTER ────────────────────────────────────────────
    // Voir et commenter sont deux droits distincts. Compte public : n'importe qui.
    // Compte privé : uniquement les amis, c'est-à-dire un suivi dans les DEUX sens.
    const auteurId = String((post as { user_id: string }).user_id);
    const [{ data: auteur }, { data: jeSuis }, { data: ilMeSuit }] = await Promise.all([
      sb.from("profiles").select("is_private").eq("id", auteurId).maybeSingle(),
      sb.from("follows").select("following_id").eq("follower_id", user.id).eq("following_id", auteurId).eq("status", "accepted").maybeSingle(),
      sb.from("follows").select("following_id").eq("follower_id", auteurId).eq("following_id", user.id).eq("status", "accepted").maybeSingle(),
    ]);
    // Migration 021 en retard : PostgREST renvoie 42703 et `auteur` vaut null. On
    // retombe alors sur « compte public », c'est-à-dire le comportement d'avant —
    // jamais sur un refus général qui bloquerait toute la messagerie sociale.
    const auteurPrive = Boolean((auteur as { is_private?: boolean } | null)?.is_private);
    const autorise = canComment(
      post as Parameters<typeof canComment>[0], user.id, auteurPrive,
      { suit: !!jeSuis, estSuivi: !!ilMeSuit },
    );
    if (!autorise) {
      return NextResponse.json(
        { error: "Ce compte est privé : seuls ses amis peuvent commenter.", motif: "compte_prive" },
        { status: 403 },
      );
    }

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
