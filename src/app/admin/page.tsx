export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Pacevo" };

export default async function AdminPage() {
  const supabase = createAdminClient();

  // Fetch all profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, age, gender, subscription_tier, league, discipline_score, onboarding_completed, created_at, intervals_athlete_id, avatar_url, mode")
    .order("created_at", { ascending: false });

  // Fetch workout counts per user
  const { data: workoutCounts } = await supabase
    .from("workouts")
    .select("user_id")
    .then(({ data }) => {
      const counts: Record<string, number> = {};
      for (const w of data ?? []) counts[w.user_id] = (counts[w.user_id] ?? 0) + 1;
      return { data: counts };
    });

  const users = (profiles ?? []).map(p => ({
    ...p,
    workout_count: (workoutCounts as Record<string, number>)?.[p.id] ?? 0,
  }));

  return <AdminDashboard users={users} />;
}
