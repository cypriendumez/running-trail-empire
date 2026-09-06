export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { classifyRun } from "@/lib/ai/coachContext";
import { GhostRunner } from "@/components/ghost-runner/GhostRunner";
import { stripProfileSecrets } from "@/lib/profile/safe";
import { oneSessionPerSlot } from "@/lib/coach/sessions";
import { getEffectiveVma } from "@/lib/ai/coachContext";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

export const metadata = { title: "Ghost Runner" };

export default async function GhostRunnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const todayStr = aujourdhui(FUSEAU_DEFAUT);
  const [profileRes, baselineRes, coachRes, effectiveVma] = await Promise.all([
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
    // VMA EFFECTIVE — exactement celle du coach et du profil. `performance_baselines`
    // est vide pour la plupart des athlètes (aucun test enregistré) : le Ghost Runner
    // retombait alors sur 16 km/h CODÉ EN DUR, soit une troisième VMA dans l'application
    // et des allures de défi ~10 % trop lentes.
    getEffectiveVma(supabase, user!.id),
  ]);

  // Même source de vérité que le Calendrier : UNE séance par date (la plus récente), puis on ne
  // garde que les séances COURABLES (pas repos/renfo) à venir, les 6 prochaines.
  const coachSessions = oneSessionPerSlot(
    ((coachRes.data ?? []) as { title: string; body: string; data: { date?: string; subtitle?: string; tags?: string[]; i18n?: Record<string, { title?: string; subtitle?: string }> } }[])
      // Le texte reste FRANÇAIS : `applyCoachSession` l'analyse pour régler le défi.
      // `i18n` l'accompagne et ne sert qu'à l'affichage.
      .map((r) => ({ title: r.title || "Séance", detail: r.data?.subtitle || r.body || "", date: String(r.data?.date ?? "").slice(0, 10), tags: Array.isArray(r.data?.tags) ? r.data.tags : [], i18n: r.data?.i18n })),
    (s) => s.date,
  )
    .filter((s) => s.date && s.date >= todayStr)
    .filter((s) => !/repos|renfo|muscu|gainage|force|ppg|\brest\b|vélo|velo|bike|cycl/i.test(`${s.title} ${s.detail}`))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  // FC max réellement ENREGISTRÉE : une mesure vaut mieux que la baseline (vide chez
  // qui n'a pas passé de test) et mieux qu'une formule sur l'âge. Le seuil de 150
  // écarte les séances où le capteur a décroché plutôt que battu un record.
  const { data: fcRows } = await supabase.from("workouts")
    .select("max_hr").eq("user_id", user!.id).gt("max_hr", 150)
    .order("max_hr", { ascending: false }).limit(1);
  const fcMaxObservee = (fcRows?.[0] as { max_hr?: number } | undefined)?.max_hr ?? null;

  // FC de ses FOOTINGS réels : la cible d'endurance suit l'athlète quand il court plus
  // facile que la théorie (et seulement dans ce sens — voir `cibleEndurance`).
  // ⚠️ On reclasse les séances au lieu de croire leur étiquette : les imports
  // intervals.icu marquent presque tout en « easy », ce qui rendrait le tri inutile.
  const { data: recentes } = await supabase.from("workouts")
    .select("distance_km, duration_seconds, avg_hr, type")
    .eq("user_id", user!.id).not("avg_hr", "is", null)
    .order("date", { ascending: false }).limit(60);
  const fcFootings = ((recentes ?? []) as { distance_km: number | null; duration_seconds: number | null; avg_hr: number | null; type: string | null }[])
    .filter((w) => /Footing|Endurance/.test(classifyRun(w, fcMaxObservee)))
    .map((w) => w.avg_hr)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  return (
    <div className="max-w-4xl mx-auto">
      <GhostRunner profile={stripProfileSecrets(profileRes.data)} baseline={baselineRes.data} effectiveVma={effectiveVma}
        fcMaxObservee={fcMaxObservee} fcFootings={fcFootings} coachSessions={coachSessions} />
    </div>
  );
}
