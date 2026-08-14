export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Metric } from "@/lib/challenges/progress";

const METRICS: Metric[] = ["distance", "elevation", "sessions", "longest_run"];

/** POST { name, metric, target, startsOn, endsOn, clubId? } → crée un défi et y inscrit son auteur. */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const metric = METRICS.includes(b.metric as Metric) ? b.metric as Metric : null;
  const target = Number(b.target);
  const jour = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const startsOn = jour(b.startsOn), endsOn = jour(b.endsOn);

  if (name.length < 2) return NextResponse.json({ error: "Donne un nom au défi" }, { status: 400 });
  if (!metric) return NextResponse.json({ error: "Critère inconnu" }, { status: 400 });
  if (!Number.isFinite(target) || target <= 0) return NextResponse.json({ error: "Objectif invalide" }, { status: 400 });
  if (!startsOn || !endsOn) return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  // La base porte la même contrainte, mais un 500 SQL est une mauvaise réponse à une
  // erreur de saisie prévisible.
  if (endsOn < startsOn) return NextResponse.json({ error: "La fin doit suivre le début" }, { status: 400 });

  const { data, error } = await sb.from("challenges").insert({
    name, metric, target, starts_on: startsOn, ends_on: endsOn,
    description: typeof b.description === "string" ? b.description.trim().slice(0, 500) : null,
    club_id: typeof b.clubId === "string" && b.clubId ? b.clubId : null,
    created_by: user.id,
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: "Création impossible" }, { status: 500 });

  await sb.from("challenge_participants").insert({ challenge_id: data.id, user_id: user.id });
  return NextResponse.json({ id: data.id });
}

/** PUT { challengeId } → participe / se retire (bascule). */
export async function PUT(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { challengeId } = await req.json().catch(() => ({})) as { challengeId?: string };
  if (!challengeId) return NextResponse.json({ error: "Défi manquant" }, { status: 400 });

  const { data: exist } = await sb.from("challenge_participants")
    .select("user_id").eq("challenge_id", challengeId).eq("user_id", user.id).maybeSingle();
  if (exist) {
    await sb.from("challenge_participants").delete().eq("challenge_id", challengeId).eq("user_id", user.id);
    return NextResponse.json({ joined: false });
  }
  const { error } = await sb.from("challenge_participants").insert({ challenge_id: challengeId, user_id: user.id });
  if (error) return NextResponse.json({ error: "Participation impossible" }, { status: 400 });
  return NextResponse.json({ joined: true });
}
