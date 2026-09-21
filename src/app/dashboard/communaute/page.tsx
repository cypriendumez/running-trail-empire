export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SocialHub, SocleEnAttente } from "@/components/social/SocialHub";

export const metadata = { title: "Ajouter des amis" };

/**
 * « AJOUTER DES AMIS » — l'annuaire social, façon Strava (22/09/2026).
 *
 * L'agrégateur d'actualités qui partageait cet onglet a désormais sa page
 * (/dashboard/actualite) ; le fil des publications reste ici, à un bouton.
 *
 * Les séances proposées à la publication sont chargées ICI, côté serveur : le
 * compositeur n'a donc aucune requête à faire à l'ouverture, et surtout on écarte
 * en amont celles qui sont DÉJÀ publiées — proposer de republier une séance
 * n'aboutirait qu'à l'erreur 409 de la contrainte d'unicité.
 */
export default async function CommunautePage({ searchParams }: { searchParams: Promise<{ suivre?: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { suivre } = await searchParams;

  const [{ data: workouts }, published, mesClubs, { data: moi }] = await Promise.all([
    sb.from("workouts")
      .select("id, title, type, sport, date, distance_km, duration_seconds, elevation_gain_m")
      .eq("user_id", user.id).order("date", { ascending: false }).limit(12),
    sb.from("activity_posts").select("workout_id").eq("user_id", user.id).not("workout_id", "is", null),
    // Seuls les clubs dont l'athlète est MEMBRE peuvent filtrer son fil : proposer
    // un club qu'il n'a pas rejoint donnerait un filtre systématiquement vide.
    sb.from("club_members").select("club_id, clubs!inner(id, name)").eq("user_id", user.id),
    // Le prénom sous le QR code : l'ami qui scanne doit voir QUI l'invite.
    sb.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  // Les tables sociales arrivent par une migration MANUELLE (019). Tant qu'elle n'est
  // pas passée, PostgREST répond 404 sur `activity_posts` — et sans ce garde-fou la
  // page entière tombait en erreur, alors que l'onglet Actualité, lui, marche très
  // bien. Une fonctionnalité pas encore activée ne doit jamais casser celles qui le sont.
  const socialReady = !published.error;

  const dejaPublie = new Set((published.data ?? []).map((p) => String((p as { workout_id: string }).workout_id)));
  const recent = (workouts ?? []).filter((w) => !dejaPublie.has(String((w as { id: string }).id))).slice(0, 8);

  // PostgREST rend la relation imbriquée sous forme de TABLEAU même pour un
  // « à-un » : on aplatit plutôt que de supposer un objet, sinon le filtre
  // resterait vide sans la moindre erreur.
  const clubs = (mesClubs.data ?? []).flatMap((m) => {
    const rel = (m as unknown as { clubs?: unknown }).clubs;
    const liste = Array.isArray(rel) ? rel : rel ? [rel] : [];
    return liste.map((c) => ({ id: String((c as { id: string }).id), name: String((c as { name: string }).name) }));
  });

  if (!socialReady) return <SocleEnAttente />;
  return (
    <SocialHub
      recentWorkouts={recent as never}
      clubs={clubs}
      moi={{ id: user.id, nom: (moi as { full_name?: string | null } | null)?.full_name ?? null }}
      suivre={typeof suivre === "string" ? suivre : null}
    />
  );
}
