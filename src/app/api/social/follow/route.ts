export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { suggestable } from "@/lib/social/feed";
import { athletesMasques, estMasque } from "@/lib/social/visibilite";
import { estUuid } from "@/lib/social/amisLiens";

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

/**
 * GET ?q=… → recherche d'athlètes ; sans `q`, suggestions à suivre ;
 * GET ?id=… → UN athlète (le lien d'un QR code scanné), avec l'état du bouton.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 80) ?? "";
  const id = params.get("id");
  // ⚠️ `id` est une colonne uuid : un `.eq` sur « n'importe quoi » LÈVE côté PostgREST
  // (400) au lieu de répondre « rien ». On filtre la forme avant de demander.
  if (id !== null && !estUuid(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  let query = sb.from(TABLE_ATHLETES).select(ATHLETE_COLS).eq("onboarding_completed", true).limit(30);
  if (id) query = query.eq("id", id);
  else if (q) query = query.ilike("full_name", `%${q}%`);
  const [{ data: rows }, { data: following }, masques] = await Promise.all([
    query,
    sb.from("follows").select("following_id").eq("follower_id", user.id).eq("status", "accepted"),
    athletesMasques(createAdminClient()),
  ]);

  const followingIds = new Set((following ?? []).map((f) => String((f as { following_id: string }).following_id)));
  const visible = ((rows ?? []) as { id: string }[]).filter((a) => !estMasque(masques, a.id) && a.id !== user.id);

  if (id) {
    const a = visible[0];
    if (!a) return NextResponse.json({ error: "Athlète introuvable" }, { status: 404 });
    return NextResponse.json({ athlete: { ...a, following: followingIds.has(a.id) }, followingCount: followingIds.size });
  }

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
    /**
     * ⚠️ L'ASYMÉTRIE ÉTAIT LE DÉFAUT : suivre vérifiait son erreur, ne plus suivre non.
     *
     * Ce n'est pas cosmétique. Le suivi MUTUEL est ce qui ouvre la messagerie entre
     * athlètes (`peutEcrire`). Un retrait qui échoue en silence répond « following:
     * false », le bouton bascule, et le lien reste : l'autre athlète peut toujours
     * écrire à quelqu'un qui croit l'avoir coupé. Une décision de confidentialité ne
     * peut pas s'annoncer réussie sans l'être.
     */
    const { error } = await sb.from("follows").delete()
      .eq("follower_id", user.id).eq("following_id", athleteId);
    if (error) return NextResponse.json({ error: "Impossible de ne plus suivre cet athlète" }, { status: 500 });
    return NextResponse.json({ following: false });
  }
  const { error } = await sb.from("follows")
    .insert({ follower_id: user.id, following_id: athleteId, status: "accepted" });
  if (error) return NextResponse.json({ error: "Impossible de suivre cet athlète" }, { status: 400 });
  return NextResponse.json({ following: true });
}
