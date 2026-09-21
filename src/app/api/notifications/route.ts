export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TYPES_NOTIFIES } from "@/lib/notifications/panneau";

/**
 * Le panneau de notifications de l'entête.
 *
 * ⚠️ POURQUOI UNE ROUTE ET PAS supabase-js DANS LE NAVIGATEUR (22/09/2026) : l'entête
 * interrogeait la table directement, ce qui embarquait le client Supabase complet
 * (≈ 220 kB de JS non compressé) dans CHAQUE page du tableau de bord — pour une liste
 * de 60 lignes et une mise à jour « tout lu ». Avec cette route, l'entête n'a besoin
 * que de `fetch`, et le client Supabase ne se charge qu'aux écrans qui écrivent
 * vraiment (réglages, profil, carte).
 *
 *  GET  → les notifications de la liste blanche (cf. lib/notifications/panneau).
 *  POST { toutLu: true } → marque tout comme lu ; l'erreur est lue et renvoyée.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data, error } = await sb
    .from("notifications")
    .select("id, type, title, body, read, created_at")
    .eq("user_id", user.id)
    // ⚠️ LISTE BLANCHE : la table est un fourre-tout (séances, ressenti, état du
    // coach, quotas…). Seules les NOUVELLES pour la personne passent. 60 lignes,
    // parce que les séances se regroupent par jour.
    .in("type", [...TYPES_NOTIFIES])
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const corps = await req.json().catch(() => ({})) as { toutLu?: unknown };
  if (corps.toutLu !== true) return NextResponse.json({ error: "Requête inconnue" }, { status: 400 });

  const { error } = await sb.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  if (error) return NextResponse.json({ error: "Mise à jour impossible" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
