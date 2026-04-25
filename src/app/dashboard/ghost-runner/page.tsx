import { createClient } from "@/lib/supabase/server";
import { GhostRunner } from "@/components/ghost-runner/GhostRunner";

export const metadata = { title: "Ghost Runner" };

export default async function GhostRunnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [profileRes, baselineRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("performance_baselines")
      .select("*")
      .eq("user_id", user!.id)
      .order("tested_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <GhostRunner profile={profileRes.data} baseline={baselineRes.data} />
    </div>
  );
}
