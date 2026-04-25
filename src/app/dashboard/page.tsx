import { createClient } from "@/lib/supabase/server";
import { BentoDashboard } from "@/components/dashboard/BentoDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [profileRes, hrvRes, workoutsRes, planRes, leagueRes, disciplineRes, sleepRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("hrv_data").select("*").eq("user_id", user!.id).order("date", { ascending: false }).limit(14),
    supabase.from("workouts").select("*").eq("user_id", user!.id).order("date", { ascending: false }).limit(40),
    supabase.from("training_plans").select("*").eq("user_id", user!.id).eq("is_active", true).single(),
    supabase.from("league_members").select("*, leagues(*)").eq("user_id", user!.id).order("score", { ascending: false }).limit(1).single(),
    supabase.from("discipline_scores").select("*").eq("user_id", user!.id).order("week_start", { ascending: false }).limit(8),
    supabase.from("sleep_data").select("total_sleep_min,sleep_score,body_battery_end,deep_sleep_min,rem_sleep_min").eq("user_id", user!.id).order("date", { ascending: false }).limit(1).single(),
  ]);

  return (
    <BentoDashboard
      profile={profileRes.data}
      hrv={hrvRes.data ?? []}
      workouts={workoutsRes.data ?? []}
      plan={planRes.data}
      league={leagueRes.data}
      disciplineHistory={disciplineRes.data ?? []}
      sleep={sleepRes.data ?? null}
    />
  );
}
