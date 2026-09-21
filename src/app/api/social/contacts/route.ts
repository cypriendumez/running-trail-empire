export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { athletesMasques, estMasque } from "@/lib/social/visibilite";
import { normaliserEmails } from "@/lib/social/amisLiens";

/**
 * POST { emails: string[] } → les athlètes Pacevo qui portent l'une de ces adresses.
 *
 * C'est l'appariement de contacts façon Strava : le téléphone donne les adresses de ses
 * contacts (sélecteur de contacts du navigateur, choisi par l'athlète), on répond QUI est
 * déjà inscrit — et rien d'autre.
 *
 * ⚠️ LA RÉPONSE NE CONTIENT JAMAIS D'ADRESSE. Ni celle qui a apparié, ni les autres :
 * on rend l'identifiant public, le nom et l'avatar, comme la recherche. Renvoyer
 * « telle adresse a un compte » ferait de cette route un annuaire ; la liste est bornée
 * (`CONTACTS_MAX`) pour la même raison, et un athlète masqué (Paramètres) ou non
 * inscrit jusqu'au bout n'apparaît pas — même si son adresse est dans le carnet.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const corps = await req.json().catch(() => ({})) as { emails?: unknown };
  const emails = normaliserEmails(corps.emails);
  if (emails.length === 0) return NextResponse.json({ athletes: [], soumis: 0 });

  const admin = createAdminClient();
  const [{ data: profils, error }, { data: following }, masques] = await Promise.all([
    // `profiles` (pas la vue) : l'adresse n'est pas une colonne publique — c'est
    // précisément pour ça qu'on la lit ICI, avec le client admin, et qu'on ne la rend pas.
    admin.from("profiles").select("id, full_name, avatar_url, onboarding_completed").in("email", emails),
    sb.from("follows").select("following_id").eq("follower_id", user.id).eq("status", "accepted"),
    athletesMasques(admin),
  ]);
  if (error) return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });

  const suivis = new Set((following ?? []).map((f) => String((f as { following_id: string }).following_id)));
  const athletes = ((profils ?? []) as { id: string; full_name?: string | null; avatar_url?: string | null; onboarding_completed?: boolean | null }[])
    .filter((p) => p.id !== user.id && p.onboarding_completed === true && !estMasque(masques, p.id))
    .map((p) => ({ id: p.id, full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null, following: suivis.has(p.id) }));

  return NextResponse.json({ athletes, soumis: emails.length });
}
