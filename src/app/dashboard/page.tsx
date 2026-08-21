import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BentoDashboard } from "@/components/dashboard/BentoDashboard";
import { stripProfileSecrets } from "@/lib/profile/safe";
import type { Objective } from "@/components/dashboard/ObjectiveCard";
import { bestVmaFromWorkouts, loadRisk, effectiveVma } from "@/lib/running/fitness";
import { oneSessionPerSlot, slotKey } from "@/lib/coach/sessions";
import { computeStreak, jourLocal, decaleJour, type StreakWorkout, type StreakPrescription } from "@/lib/streak/compute";
import { accesDe } from "@/lib/billing/access";
import { AttributionGarmin } from "@/components/legal/AttributionGarmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── Fenêtre de LA SÉRIE ─────────────────────────────────────────────────────
  // Deux requêtes DÉDIÉES et volontairement maigres. Les requêtes existantes sont
  // plafonnées à 40 lignes : côté prescriptions, l'auto-coach en accumule ~1 par
  // jour écoulé + 7 à venir, donc 40 lignes ne couvrent qu'un mois — la série se
  // serait tue au-delà, sans que rien ne l'indique. On charge donc explicitement la
  // fenêtre d'observation, en ne demandant que les colonnes réellement lues.
  const streakToday = jourLocal();
  const streakFrom = decaleJour(streakToday, -119);

  const [profileRes, hrvRes, workoutsRes, planRes, leagueRes, disciplineRes, sleepRes, coachRes, feedbackRes, objRes, baseRes, newMembersRes, streakWkRes, streakPlanRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("hrv_data").select("*").eq("user_id", user!.id).order("date", { ascending: false }).limit(14),
    supabase.from("workouts").select("*").eq("user_id", user!.id).order("date", { ascending: false }).limit(40),
    supabase.from("training_plans").select("*").eq("user_id", user!.id).eq("is_active", true).single(),
    supabase.from("league_members").select("*, leagues(*)").eq("user_id", user!.id).order("score", { ascending: false }).limit(1).single(),
    supabase.from("discipline_scores").select("*").eq("user_id", user!.id).order("week_start", { ascending: false }).limit(8),
    supabase.from("sleep_data").select("total_sleep_min,sleep_score,body_battery_end,deep_sleep_min,rem_sleep_min,date").eq("user_id", user!.id).order("date", { ascending: false }).limit(1).single(),
    supabase.from("notifications").select("title,body,data,created_at").eq("user_id", user!.id).eq("type", "coach_session").order("created_at", { ascending: false }).limit(40),
    supabase.from("notifications").select("data").eq("user_id", user!.id).eq("type", "session_feedback").order("created_at", { ascending: false }).limit(60),
    supabase.from("notifications").select("data").eq("user_id", user!.id).eq("type", "race_objective").maybeSingle(),
    supabase.from("performance_baselines").select("vma_kmh,max_hr").eq("user_id", user!.id).order("tested_at", { ascending: false }).limit(1).single(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from("workouts").select("date,sport,type,duration_seconds,distance_km,tss,training_effect")
      .eq("user_id", user!.id).gte("date", streakFrom).order("date", { ascending: false }).limit(500),
    // Trié par created_at DÉCROISSANT : `oneSessionPerSlot` garde la première vue de
    // chaque créneau, donc la décision la PLUS RÉCENTE. Trier par date casserait la
    // déduplication en silence (on garderait une prescription périmée).
    supabase.from("notifications").select("created_at,data")
      .eq("user_id", user!.id).eq("type", "coach_session").gte("data->>date", streakFrom)
      .order("created_at", { ascending: false }).limit(600),
  ]);

  // L'état d'abonnement se déduit du profil déjà chargé : `created_at` donne l'essai,
  // `subscription_tier` la formule. Aucune requête de plus.
  const acces = accesDe(profileRes.data as { created_at?: string | null; subscription_tier?: string | null } | null);

  // La série est calculée À LA LECTURE, jamais stockée : une séance qui arrive avec
  // deux jours de retard répare la journée au lieu de la perdre. Voir lib/streak.
  const streak = computeStreak({
    workouts: (streakWkRes.data ?? []) as StreakWorkout[],
    prescriptions: oneSessionPerSlot(
      (streakPlanRes.data ?? []) as { data: StreakPrescription }[],
      (r) => slotKey(r.data as { date?: unknown; moment?: unknown }),
    ).map((r) => r.data),
    feedbacks: ((feedbackRes.data ?? []) as { data: { date?: unknown; pain?: unknown } }[]).map((r) => r.data),
    today: streakToday,
  });
  const newMembersWeek = newMembersRes.count ?? 0;

  const objective = (objRes.data?.data ?? null) as Objective | null;

  // VMA actuelle (test sinon estimée) + risque de charge (déload proactif).
  const wks = (workoutsRes.data ?? []) as { date: string; type?: string | null; distance_km?: number | null; duration_seconds?: number | null; avg_hr?: number | null; max_hr?: number | null; tss?: number | null }[];
  const obsMaxHr = Math.max(0, ...wks.map(w => Number(w.max_hr ?? 0)));
  const garminVo2 = Number((profileRes.data as { garmin_vo2max?: number | null } | null)?.garmin_vo2max) || 0;
  // VMA : test → efforts réels (reflète l'allure de course) → dérivée de la VO2max Garmin (repli).
  // MÊME calcul que le coach — la même fonction, pas une chaîne parallèle. Celle-ci
  // ignorait purement et simplement la courbe d'allure : le tableau de bord annonçait
  // 18,7 km/h pendant que le plan était calé sur 17,3, pour le même athlète.
  const currentVma = effectiveVma({
    vmaStored: Number((baseRes.data as { vma_kmh?: number } | null)?.vma_kmh) || null,
    paceCurveBest: ((profileRes.data as { pace_curve?: { best?: { m: number; sec: number }[] } | null } | null)?.pace_curve)?.best,
    garminVo2: garminVo2 || null,
    fromRuns: bestVmaFromWorkouts(wks, obsMaxHr > 120 ? obsMaxHr : null),
  }).vma ?? 0;
  const risk = loadRisk(wks);

  // Prochaine séance prescrite par le coach (aujourd'hui ou à venir) → prioritaire sur l'IA/l'algo.
  const today = new Date().toISOString().split("T")[0];
  type CoachText = { title?: string; subtitle?: string; tags?: string[]; why?: string };
  type CoachRow = { title: string; body: string; data: { date?: string; subtitle?: string; tags?: string[]; why?: string; i18n?: Record<string, CoachText> } };
  const cn = oneSessionPerSlot((coachRes.data ?? []) as CoachRow[], (r) => slotKey(r.data))
    .filter((r) => (r.data?.date ?? "") >= today)
    .sort((a, b) => (a.data?.date ?? "").localeCompare(b.data?.date ?? ""))[0];
  const coachSession = cn
    // Le français reste ici ; `i18n` voyage à côté et c'est le composant client qui
    // choisit la langue (le sélecteur est instantané, il ne recharge pas la page).
    ? { title: cn.title, subtitle: cn.data.subtitle || cn.body || "", tags: cn.data.tags ?? [], why: cn.data.why ?? "", i18n: cn.data.i18n }
    : null;

  // Demande de ressenti après la dernière séance (si non donné et séance récente ≤ 4 j).
  const fbDates = new Set(((feedbackRes.data ?? []) as { data: { date?: string } }[]).map((r) => r.data?.date).filter(Boolean));
  const lastWk = (workoutsRes.data ?? [])[0] as { date?: string; title?: string; type?: string } | undefined;
  const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0];
  const pendingFeedback = lastWk?.date && lastWk.date.slice(0, 10) >= fourDaysAgo && !fbDates.has(lastWk.date.slice(0, 10))
    ? { date: lastWk.date.slice(0, 10), title: lastWk.title || lastWk.type || "Séance" }
    : null;

  return (
    <>
    <BentoDashboard
      profile={stripProfileSecrets(profileRes.data)}
      hrv={hrvRes.data ?? []}
      workouts={workoutsRes.data ?? []}
      plan={planRes.data}
      league={leagueRes.data}
      disciplineHistory={disciplineRes.data ?? []}
      sleep={sleepRes.data ?? null}
      coachSession={coachSession}
      pendingFeedback={pendingFeedback}
      objective={objective}
      currentVma={currentVma}
      loadRisk={risk}
      newMembersWeek={newMembersWeek}
      streak={streak}
      acces={acces}
    />
      {/* Obligation de l'article 1.1 des conditions d'API d'intervals.icu. */}
      <AttributionGarmin className="mt-6" />
    </>
  );
}
