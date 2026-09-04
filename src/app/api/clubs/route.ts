export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET → clubs visibles + ceux dont je suis membre. */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [{ data: clubs, error }, { data: mine }] = await Promise.all([
    sb.from("clubs").select("id, name, description, city, visibility, member_count, created_at")
      .order("member_count", { ascending: false }).limit(50),
    sb.from("club_members").select("club_id, role").eq("user_id", user.id),
  ]);
  // Les tables arrivent par une migration MANUELLE (020) : tant qu'elle n'est pas
  // passée, on le DIT au lieu de laisser la page tomber en erreur.
  if (error) return NextResponse.json({ ready: false, clubs: [] });

  const roles = new Map((mine ?? []).map((m) => [String((m as { club_id: string }).club_id), String((m as { role: string }).role)]));
  return NextResponse.json({
    ready: true,
    clubs: (clubs ?? []).map((c) => {
      const club = c as Record<string, unknown>;
      return { ...club, joined: roles.has(String(club.id)), role: roles.get(String(club.id)) ?? null };
    }),
  });
}

/** POST { name, description?, city?, visibility? } → crée un club et y inscrit son auteur. */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: "Le nom doit faire entre 2 et 60 caractères" }, { status: 400 });
  }

  const { data: club, error } = await sb.from("clubs").insert({
    name,
    description: typeof b.description === "string" ? b.description.trim().slice(0, 500) : null,
    city: typeof b.city === "string" ? b.city.trim().slice(0, 80) : null,
    visibility: b.visibility === "private" ? "private" : "public",
    created_by: user.id,
  }).select("id").single();
  if (error || !club) return NextResponse.json({ error: "Création impossible" }, { status: 500 });

  // Le créateur devient propriétaire. Sans cette ligne il ne serait pas membre de son
  // propre club, et ne pourrait donc ni le modifier ni le voir s'il est privé.
  // ⚠️ LE COMMENTAIRE CI-DESSUS DIT CE QUE COÛTE CET ÉCHEC, il n'était juste pas lu :
  // sans cette ligne, le créateur n'est pas membre de son propre club et ne peut ni le
  // modifier ni même le VOIR s'il l'a créé privé. Un club fantôme, sans gestionnaire.
  const { error: eProprio } = await sb.from("club_members")
    .insert({ club_id: club.id, user_id: user.id, role: "owner" });
  if (eProprio) return NextResponse.json({ error: "Club créé sans propriétaire, réessaie" }, { status: 500 });
  return NextResponse.json({ id: club.id });
}

/** PUT { clubId } → rejoint / quitte (bascule). */
export async function PUT(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { clubId } = await req.json().catch(() => ({})) as { clubId?: string };
  if (!clubId) return NextResponse.json({ error: "Club manquant" }, { status: 400 });

  const { data: exist } = await sb.from("club_members")
    .select("role").eq("club_id", clubId).eq("user_id", user.id).maybeSingle();

  if (exist) {
    // Le propriétaire ne peut pas quitter son club : il resterait sans gestionnaire,
    // impossible à modifier ou à supprimer par qui que ce soit.
    if ((exist as { role: string }).role === "owner") {
      return NextResponse.json({ error: "Le propriétaire ne peut pas quitter son club" }, { status: 400 });
    }
    // Rejoindre vérifiait son erreur, quitter non : le bouton basculait sur un départ
    // qui n'avait pas eu lieu, et l'athlète restait membre — visible dans un club privé
    // qu'il croyait avoir quitté.
    const { error } = await sb.from("club_members")
      .delete().eq("club_id", clubId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "Impossible de quitter ce club" }, { status: 500 });
    return NextResponse.json({ joined: false });
  }
  const { error } = await sb.from("club_members").insert({ club_id: clubId, user_id: user.id, role: "member" });
  if (error) return NextResponse.json({ error: "Impossible de rejoindre ce club" }, { status: 400 });
  return NextResponse.json({ joined: true });
}
