export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestable } from "@/lib/social/feed";

/**
 * Colonnes publiques d'un athlète — ÉNUMÉRÉES, jamais `select("*")` suivi d'un
 * filtrage. Une colonne sensible ajoutée demain au profil (clé intervals.icu,
 * e-mail, identifiants Stripe) ne peut pas se retrouver exposée par simple oubli :
 * il faudrait l'ajouter ici à la main.
 */
const ATHLETE_COLS = "id, full_name, avatar_url, league, discipline_score";

/**
 * On lit `athletes_publics` (migration 022) et NON `profiles`.
 *
 * Défaut réel : `profiles` n'expose que `profiles_select_own` (auth.uid() = id).
 * Cette route lisait donc uniquement la ligne de l'utilisateur lui-même, que
 * `suggestable` écarte ensuite — la liste d'athlètes était VIDE pour tout le monde
 * et la recherche ne trouvait jamais personne. Indétectable tant qu'il n'y a qu'un
 * seul inscrit : une liste vide ressemble à « personne à suggérer ».
 *
 * La vue n'expose que les colonnes publiques ; ouvrir la RLS de `profiles` aurait
 * exposé la clé intervals.icu, l'e-mail et les identifiants Stripe, la RLS
 * travaillant par LIGNE et non par colonne.
 */
const TABLE_ATHLETES = "athletes_publics";

/** Athlètes ayant explicitement refusé d'apparaître dans la Communauté. */
async function hiddenAthletes(sb: Awaited<ReturnType<typeof createClient>>): Promise<Set<string>> {
  const { data } = await sb.from("notifications").select("user_id, data").eq("type", "user_settings");
  const hidden = new Set<string>();
  for (const row of data ?? []) {
    const settings = (row as { data?: Record<string, unknown> }).data ?? {};
    // Le réglage existe déjà dans l'écran Paramètres ; l'ignorer ici aurait rendu
    // une case à cocher mensongère — l'athlète l'aurait décochée sans effet.
    if (settings.communityVisible === false) hidden.add(String((row as { user_id: string }).user_id));
  }
  return hidden;
}

/** GET ?q=… → recherche d'athlètes ; sans `q`, suggestions à suivre. */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  let query = sb.from(TABLE_ATHLETES).select(ATHLETE_COLS).eq("onboarding_completed", true).limit(30);
  if (q) query = query.ilike("full_name", `%${q}%`);
  const [{ data: rows }, { data: following }, hidden] = await Promise.all([
    query,
    sb.from("follows").select("following_id").eq("follower_id", user.id).eq("status", "accepted"),
    hiddenAthletes(sb),
  ]);

  const followingIds = new Set((following ?? []).map((f) => String((f as { following_id: string }).following_id)));
  const visible = ((rows ?? []) as { id: string }[]).filter((a) => !hidden.has(a.id));

  return NextResponse.json({
    // En recherche on montre TOUT le monde (avec l'état du bouton), alors qu'en
    // suggestion on écarte les athlètes déjà suivis : proposer de suivre quelqu'un
    // qu'on suit déjà donne l'impression que le bouton est cassé.
    athletes: (q ? visible : suggestable(visible, user.id, followingIds))
      .map((a) => ({ ...a, following: followingIds.has(a.id) })),
    followingCount: followingIds.size,
  });
}

/** POST { athleteId } → suit / ne suit plus (bascule). */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { athleteId } = await req.json().catch(() => ({})) as { athleteId?: string };
  if (!athleteId) return NextResponse.json({ error: "Athlète manquant" }, { status: 400 });
  // La base porte déjà la contrainte `follows_pas_soi_meme`, mais un 500 SQL est une
  // mauvaise réponse à une erreur prévisible : on répond proprement.
  if (athleteId === user.id) return NextResponse.json({ error: "On ne se suit pas soi-même" }, { status: 400 });

  const { data: existing } = await sb.from("follows")
    .select("follower_id").eq("follower_id", user.id).eq("following_id", athleteId).maybeSingle();

  if (existing) {
    await sb.from("follows").delete().eq("follower_id", user.id).eq("following_id", athleteId);
    return NextResponse.json({ following: false });
  }
  const { error } = await sb.from("follows")
    .insert({ follower_id: user.id, following_id: athleteId, status: "accepted" });
  if (error) return NextResponse.json({ error: "Impossible de suivre cet athlète" }, { status: 400 });
  return NextResponse.json({ following: true });
}
