export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanBody, isPublishable, MAX_BODY, type Visibility } from "@/lib/social/feed";

const VISIBILITIES: Visibility[] = ["public", "followers", "private"];

/** POST { workoutId?, body?, visibility? } → publie une séance ou un billet. */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const raw = await req.json().catch(() => ({})) as Record<string, unknown>;
  const body = cleanBody(raw.body, MAX_BODY);
  const workoutId = typeof raw.workoutId === "string" && raw.workoutId ? raw.workoutId : null;
  const visibility: Visibility = VISIBILITIES.includes(raw.visibility as Visibility)
    ? raw.visibility as Visibility
    : "followers"; // défaut prudent : une trace GPS part du domicile

  if (!isPublishable(body, workoutId)) {
    return NextResponse.json({ error: "Écris quelque chose ou choisis une séance" }, { status: 400 });
  }

  if (workoutId) {
    // On vérifie que la séance appartient bien au publiant. Sans ce contrôle, il
    // suffirait de deviner un identifiant pour publier la sortie de quelqu'un d'autre
    // sous son propre nom — et la carte irait avec.
    const { data: w } = await sb.from("workouts")
      .select("id").eq("id", workoutId).eq("user_id", user.id).maybeSingle();
    if (!w) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  const { data, error } = await sb.from("activity_posts")
    .insert({ user_id: user.id, workout_id: workoutId, body, visibility })
    .select("id").single();

  if (error) {
    // L'index unique sur `workout_id` empêche de publier deux fois la même séance.
    // On le traduit en message clair plutôt qu'en erreur technique.
    const dejaPublie = /duplicate key|unique/i.test(error.message);
    return NextResponse.json(
      { error: dejaPublie ? "Cette séance est déjà publiée" : "Publication impossible" },
      { status: dejaPublie ? 409 : 500 },
    );
  }
  return NextResponse.json({ id: data.id });
}

/** DELETE ?id=… → retire sa publication. */
export async function DELETE(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Publication manquante" }, { status: 400 });

  // Le `eq("user_id")` est la vraie garde : sans lui, un identifiant deviné
  // supprimerait la publication d'autrui. La RLS le couvre aussi, on ne s'en remet
  // pas à une seule barrière pour une suppression.
  const { error } = await sb.from("activity_posts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Suppression impossible" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
