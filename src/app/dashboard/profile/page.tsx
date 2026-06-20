export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { stripProfileSecrets } from "@/lib/profile/safe";
import { bestVmaFromWorkouts } from "@/lib/running/fitness";

export const metadata = { title: "Mon Profil | Running & Trail Empire" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    { data: profile },
    { data: baseline },
    { data: shoes },
    { data: workoutsYear },
    { data: workoutsMonth },
    { data: goals },
    { data: recentWk },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("performance_baselines").select("*").eq("user_id", user!.id).order("tested_at", { ascending: false }).limit(1).single(),
    supabase.from("shoes").select("*").eq("user_id", user!.id).eq("is_active", true),
    supabase.from("workouts").select("distance_km, date").eq("user_id", user!.id).gte("date", yearStart),
    supabase.from("workouts").select("distance_km, date").eq("user_id", user!.id).gte("date", monthStart),
    supabase.from("user_goals").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("workouts").select("distance_km, duration_seconds, type, avg_hr, max_hr").eq("user_id", user!.id).gte("date", new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)).order("date", { ascending: false }).limit(150),
  ]);

  // VMA estimée depuis les meilleurs efforts SOUTENUS (FC élevée) + FC max observée.
  const rw = (recentWk ?? []) as { distance_km?: number | null; duration_seconds?: number | null; type?: string | null; avg_hr?: number | null; max_hr?: number | null }[];
  const obsMaxHrRaw = Math.max(0, ...rw.map(w => Number(w.max_hr ?? 0)));
  const obsMaxHr = obsMaxHrRaw > 120 ? obsMaxHrRaw : null;
  const estimatedVma = bestVmaFromWorkouts(rw, obsMaxHr);

  const kmYear = (workoutsYear ?? []).reduce((s: number, w: Record<string, unknown>) => s + Number(w.distance_km ?? 0), 0);
  const kmMonth = (workoutsMonth ?? []).reduce((s: number, w: Record<string, unknown>) => s + Number(w.distance_km ?? 0), 0);
  const sessionsMonth = (workoutsMonth ?? []).length;
  const longestRun = Math.max(0, ...(workoutsYear ?? []).map((w: Record<string, unknown>) => Number(w.distance_km ?? 0)));

  // Streak calc: consecutive days with workout ending today
  const dates = new Set((workoutsYear ?? []).map((w: Record<string, unknown>) => String(w.date).slice(0, 10)));
  let streak = 0;
  const d = new Date();
  while (dates.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return (
    <ProfileSettings
      profile={stripProfileSecrets(profile)}
      baseline={baseline}
      shoes={shoes ?? []}
      goals={goals ?? []}
      stats={{ kmYear, kmMonth, sessionsMonth, longestRun, streak }}
      fitness={{ estimatedVma, obsMaxHr }}
      userId={user!.id}
    />
  );
}
