export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { challengeProgress, daysLeft, notStarted, type Challenge, type ChallengeWorkout } from "@/lib/challenges/progress";
import { ClubsHub, type ClubVue, type DefiVue } from "@/components/clubs/ClubsHub";

export const metadata = { title: "Clubs & Défis | Pacevo" };

/**
 * Clubs et défis.
 *
 * La progression des défis est calculée ICI, à la lecture, sur les séances réelles :
 * aucune colonne de progression en base, donc rien qui puisse survivre à la
 * correction ou à la suppression d'une séance. Même principe que la Vitrine.
 */
export default async function ClubsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [clubsRes, membresRes, defisRes, partsRes, workoutsRes] = await Promise.all([
    sb.from("clubs").select("id, name, description, city, visibility, member_count")
      .order("member_count", { ascending: false }).limit(50),
    sb.from("club_members").select("club_id, role").eq("user_id", user.id),
    sb.from("challenges").select("id, name, description, metric, target, starts_on, ends_on, club_id")
      .order("ends_on", { ascending: true }).limit(50),
    sb.from("challenge_participants").select("challenge_id").eq("user_id", user.id),
    sb.from("workouts").select("date, sport, type, distance_km, elevation_gain_m")
      .eq("user_id", user.id).order("date", { ascending: false }).limit(2000),
  ]);

  // Tant que la migration 020 n'est pas passée, on l'annonce au lieu de laisser la
  // page tomber en erreur — une fonctionnalité non activée ne casse jamais l'app.
  if (clubsRes.error || defisRes.error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-zinc-900">Clubs &amp; Défis en attente d&apos;activation</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          La migration 020 n&apos;a pas encore été exécutée dans Supabase. Le reste de
          l&apos;application fonctionne normalement.
        </p>
      </div>
    );
  }

  const roles = new Map((membresRes.data ?? []).map((m) => {
    const r = m as { club_id: string; role: string };
    return [String(r.club_id), String(r.role)];
  }));
  const clubs: ClubVue[] = (clubsRes.data ?? []).map((c) => {
    const k = c as unknown as ClubVue;
    return { ...k, joined: roles.has(k.id), role: roles.get(k.id) ?? null };
  });

  const inscrits = new Set((partsRes.data ?? []).map((p) => String((p as { challenge_id: string }).challenge_id)));
  const workouts = (workoutsRes.data ?? []) as unknown as ChallengeWorkout[];

  const defis: DefiVue[] = (defisRes.data ?? []).map((d) => {
    const ch = d as unknown as Challenge & { description: string | null; club_id: string | null };
    const p = challengeProgress(ch, workouts);
    return {
      id: ch.id, name: ch.name, description: ch.description, metric: ch.metric, target: Number(ch.target),
      starts_on: ch.starts_on, ends_on: ch.ends_on,
      clubName: ch.club_id ? clubs.find((c) => c.id === ch.club_id)?.name ?? null : null,
      value: p.value, ratio: p.ratio, done: p.done,
      joined: inscrits.has(ch.id),
      daysLeft: daysLeft(ch),
      notStarted: notStarted(ch),
    };
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <ClubsHub clubs={clubs} defis={defis} />
    </div>
  );
}
