export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { LeaguesHub } from "@/components/gamification/LeaguesHub";

export const metadata = { title: "Ligues & Gamification | Running & Trail Empire" };

export default async function LeaguesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;

  const [
    { data: profile },
    { data: myMembership },
    { data: workouts },
    { data: userBadges },
    { data: challenges },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url, discipline_score, league").eq("id", user.id).single(),

    // My current league membership + league info
    supabase
      .from("league_members")
      .select("score, rank, league_id, leagues(id, tier, name, week_start, week_end, rewards)")
      .eq("user_id", user.id)
      .order("leagues(week_start)", { ascending: false })
      .limit(1)
      .single(),

    // Workouts this year for badge computation
    supabase
      .from("workouts")
      .select("id, date, distance_km, duration_min, elevation_gain_m, workout_type")
      .eq("user_id", user.id)
      .gte("date", yearStart)
      .order("date", { ascending: false }),

    // My unlocked badges (with badge details)
    supabase
      .from("user_badges")
      .select("unlocked_at, progress, max_progress, badges(id, name, description, icon, rarity)")
      .eq("user_id", user.id),

    // Active team challenges I'm part of
    supabase
      .from("challenge_members")
      .select("km_contributed, team_challenges(id, name, description, total_km, current_km, end_date)")
      .eq("user_id", user.id),
  ]);

  // If in a league, fetch all members of that league
  let leagueMembers: Record<string, unknown>[] = [];
  const leagueId = (myMembership as Record<string, unknown> | null)?.league_id as string | null;
  if (leagueId) {
    const { data } = await supabase
      .from("league_members")
      .select("score, rank, user_id, profiles(full_name, avatar_url, league)")
      .eq("league_id", leagueId)
      .order("score", { ascending: false })
      .limit(50);
    leagueMembers = (data as Record<string, unknown>[]) ?? [];
  }

  // Compute badges from workout data
  const allWorkouts = workouts ?? [];
  const totalKm = allWorkouts.reduce((s, w) => s + Number(w.distance_km ?? 0), 0);
  const trailWorkouts = allWorkouts.filter(w => String(w.workout_type ?? "").toLowerCase().includes("trail"));

  // Streak calculation
  const dates = new Set(allWorkouts.map(w => String(w.date).slice(0, 10)));
  let streak = 0;
  const d = new Date();
  while (dates.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }

  // Monthly max km
  const byMonth: Record<string, number> = {};
  allWorkouts.forEach(w => {
    const m = String(w.date).slice(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + Number(w.distance_km ?? 0);
  });
  const maxMonthKm = Math.max(0, ...Object.values(byMonth));

  // Sub-4h marathon
  const subMarathon = allWorkouts.some(
    w => Number(w.distance_km ?? 0) >= 42 && Number(w.duration_min ?? 999) <= 240
  );

  const computedBadges = [
    {
      id: "first_run",
      name: "Premier pas",
      icon: "👟",
      rarity: "common" as const,
      description: "Enregistrer votre première séance",
      unlocked: allWorkouts.length > 0,
      progress: Math.min(allWorkouts.length, 1),
      max: 1,
    },
    {
      id: "first_10k",
      name: "Premier 10km",
      icon: "🏃",
      rarity: "common" as const,
      description: "Courir 10km en une seule séance",
      unlocked: allWorkouts.some(w => Number(w.distance_km ?? 0) >= 10),
      progress: Math.min(Math.max(0, ...allWorkouts.map(w => Number(w.distance_km ?? 0))), 10),
      max: 10,
    },
    {
      id: "consistency_7",
      name: "7 jours consécutifs",
      icon: "🔥",
      rarity: "rare" as const,
      description: "Courir 7 jours d'affilée",
      unlocked: streak >= 7,
      progress: Math.min(streak, 7),
      max: 7,
    },
    {
      id: "consistency_30",
      name: "Mois de feu",
      icon: "🌋",
      rarity: "epic" as const,
      description: "Courir 30 jours d'affilée",
      unlocked: streak >= 30,
      progress: Math.min(streak, 30),
      max: 30,
    },
    {
      id: "100km_year",
      name: "100km cette année",
      icon: "💯",
      rarity: "common" as const,
      description: "Cumuler 100km sur l'année",
      unlocked: totalKm >= 100,
      progress: Math.round(Math.min(totalKm, 100)),
      max: 100,
    },
    {
      id: "500km_year",
      name: "500km cette année",
      icon: "🚀",
      rarity: "rare" as const,
      description: "Cumuler 500km sur l'année",
      unlocked: totalKm >= 500,
      progress: Math.round(Math.min(totalKm, 500)),
      max: 500,
    },
    {
      id: "1000km_year",
      name: "1000km en un an",
      icon: "⭐",
      rarity: "epic" as const,
      description: "Cumuler 1000km sur l'année",
      unlocked: totalKm >= 1000,
      progress: Math.round(Math.min(totalKm, 1000)),
      max: 1000,
    },
    {
      id: "100km_month",
      name: "100km en un mois",
      icon: "💪",
      rarity: "epic" as const,
      description: "Courir 100km en un seul mois",
      unlocked: maxMonthKm >= 100,
      progress: Math.round(Math.min(maxMonthKm, 100)),
      max: 100,
    },
    {
      id: "first_trail",
      name: "Baptême du trail",
      icon: "⛰️",
      rarity: "common" as const,
      description: "Compléter votre première sortie trail",
      unlocked: trailWorkouts.length > 0,
      progress: Math.min(trailWorkouts.length, 1),
      max: 1,
    },
    {
      id: "sub_4_marathon",
      name: "Marathon Sub 4h",
      icon: "⚡",
      rarity: "rare" as const,
      description: "Finir un marathon en moins de 4 heures",
      unlocked: subMarathon,
      progress: subMarathon ? 1 : 0,
      max: 1,
    },
    {
      id: "half_marathon",
      name: "Semi-marathon",
      icon: "🏅",
      rarity: "common" as const,
      description: "Courir 21km en une séance",
      unlocked: allWorkouts.some(w => Number(w.distance_km ?? 0) >= 21),
      progress: Math.min(Math.max(0, ...allWorkouts.map(w => Number(w.distance_km ?? 0))), 21),
      max: 21,
    },
    {
      id: "itra_100",
      name: "Ultra-trailer",
      icon: "💎",
      rarity: "legendary" as const,
      description: "Courir un 100km en trail",
      unlocked: trailWorkouts.some(w => Number(w.distance_km ?? 0) >= 100),
      progress: Math.round(Math.min(Math.max(0, ...trailWorkouts.map(w => Number(w.distance_km ?? 0))), 100)),
      max: 100,
    },
  ];

  // Available challenges from DB
  const { data: availableChallenges } = await supabase
    .from("team_challenges")
    .select("id, name, description, total_km, current_km, end_date")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <LeaguesHub
      userId={user.id}
      profile={profile as Record<string, unknown>}
      myMembership={myMembership as Record<string, unknown> | null}
      leagueMembers={leagueMembers}
      computedBadges={computedBadges}
      myChallenges={(challenges ?? []) as Record<string, unknown>[]}
      availableChallenges={(availableChallenges ?? []) as Record<string, unknown>[]}
      stats={{ totalKm: Math.round(totalKm), streak, sessions: allWorkouts.length }}
    />
  );
}
