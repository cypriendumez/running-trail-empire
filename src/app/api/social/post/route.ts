export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanBody, isPublishable, MAX_BODY, type Visibility } from "@/lib/social/feed";
import { premierGrosMot } from "@/lib/social/moderation";

const VISIBILITIES: Visibility[] = ["public", "followers", "private"];
const MAX_PHOTOS = 4;

/**
 * N'accepte que des URL issues de NOTRE stockage Supabase.
 *
 * Sans ce filtre, le champ serait une porte ouverte : n'importe quelle URL passée
 * dans le corps de la requête s'afficherait dans le fil sous le nom de l'auteur —
 * image d'un autre site, pixel espion mesurant qui lit la publication, ou contenu
 * changé après coup par un tiers. On ne rend que ce qu'on héberge.
 */
function cleanPhotoUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const prefixe = base ? `${base.replace(/\/$/, "")}/storage/v1/object/public/` : null;
  return input
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter((u) => !!prefixe && u.startsWith(prefixe))
    .slice(0, MAX_PHOTOS);
}

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

  const photoUrls = cleanPhotoUrls(raw.photoUrls);

  if (!isPublishable(body, workoutId) && photoUrls.length === 0) {
    return NextResponse.json({ error: "Écris quelque chose, ajoute une photo ou choisis une séance" }, { status: 400 });
  }

  // Grossièretés : même règle qu'en commentaire. Filtrer les commentaires en laissant
  // passer les publications aurait été une demi-mesure — c'est la publication qui est
  // la plus vue.
  const fautif = body ? premierGrosMot(body) : null;
  if (fautif) {
    return NextResponse.json(
      { error: `Publication refusée : « ${fautif} » n'a pas sa place ici.`, motif: "grossierete" },
      { status: 422 },
    );
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
    .insert({ user_id: user.id, workout_id: workoutId, body, visibility, photo_urls: photoUrls })
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
