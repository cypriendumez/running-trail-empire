export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { GhostRunner } from "@/components/ghost-runner/GhostRunner";
import { stripProfileSecrets } from "@/lib/profile/safe";
import { oneSessionPerDate } from "@/lib/coach/sessions";

export const metadata = { title: "Ghost Runner" };

export default async function GhostRunnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [profileRes, baselineRes, coachRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase
      .from("performance_baselines")
      .select("*")
      .eq("user_id", user!.id)
      .order("tested_at", { ascending: false })
      .limit(1)
      .single(),
    // Séances prescrites par le coach → faisables ici si pas de montre.
    supabase.from("notifications").select("title,body,data,created_at")
      .eq("user_id", user!.id).eq("type", "coach_session")
      .order("created_at", { ascending: false }).limit(20),
  ]);

  // Même source de vérité que le Calendrier : UNE séance par date (la plus récente), puis on ne
  // garde que les séances COURABLES (pas repos/renfo) à venir, les 6 prochaines.
  const coachSessions = oneSessionPerDate(
    ((coachRes.data ?? []) as { title: string; body: string; data: { date?: string; subtitle?: string; tags?: string[] } }[])
      .map((r) => ({ title: r.title || "Séance", detail: r.data?.subtitle || r.body || "", date: String(r.data?.date ?? "").slice(0, 10), tags: Array.isArray(r.data?.tags) ? r.data.tags : [] })),
    (s) => s.date,
  )
    .filter((s) => s.date && s.date >= todayStr)
    .filter((s) => !/repos|renfo|muscu|gainage|force|ppg|\brest\b/i.test(`${s.title} ${s.detail}`))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  return (
    <div className="max-w-4xl mx-auto">
      <GhostRunner profile={stripProfileSecrets(profileRes.data)} baseline={baselineRes.data} coachSessions={coachSessions} />
    </div>
  );
}
