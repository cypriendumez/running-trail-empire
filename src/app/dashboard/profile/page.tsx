export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { stripProfileSecrets } from "@/lib/profile/safe";
import { bestVmaFromWorkouts, vmaFromPaceCurve } from "@/lib/running/fitness";
import { isRun } from "@/lib/intervals/sport";

export const metadata = { title: "Mon Profil | Pacevo" };

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
    supabase.from("workouts").select("distance_km, date, type, sport").eq("user_id", user!.id).gte("date", yearStart),
    supabase.from("workouts").select("distance_km, date, type, sport").eq("user_id", user!.id).gte("date", monthStart),
    supabase.from("user_goals").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("workouts").select("distance_km, duration_seconds, type, sport, avg_hr, max_hr").eq("user_id", user!.id).gte("date", new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)).order("date", { ascending: false }).limit(150),
  ]);

  // VMA estimée depuis les meilleurs efforts SOUTENUS (FC élevée) + FC max observée.
  const rw = (recentWk ?? []) as { distance_km?: number | null; duration_seconds?: number | null; type?: string | null; sport?: string | null; avg_hr?: number | null; max_hr?: number | null }[];
  const obsMaxHrRaw = Math.max(0, ...rw.map(w => Number(w.max_hr ?? 0)));
  const obsMaxHr = obsMaxHrRaw > 120 ? obsMaxHrRaw : null;
  // MÊME ORDRE DE FIABILITÉ QUE LE COACH : meilleurs efforts mesurés d'abord, et
  // course à pied uniquement. Sans cela le profil affichait une VMA que le plan
  // d'entraînement contredisait — et une sortie vélo pouvait la produire.
  const paceCurveBest = ((profile as { pace_curve?: { best?: { m: number; sec: number }[] } | null } | null)?.pace_curve)?.best;
  const estimatedVma = vmaFromPaceCurve(paceCurveBest) ?? bestVmaFromWorkouts(rw.filter(w => isRun(w.sport)), obsMaxHr);

  // ── STATISTIQUES PAR SPORT ────────────────────────────────────────────────────
  // Additionner course, vélo et randonnée dans un même total n'a pas de sens sportif :
  // 62 km à vélo n'est pas « la plus longue sortie » d'un coureur, et le compteur
  // annuel gonflait d'autant. Le trail reste de la COURSE (sport `run`), mais on le
  // distingue de la route car l'effort n'est pas comparable.
  type WkRow = { distance_km?: number | null; type?: string | null; sport?: string | null };
  const km = (rows: WkRow[]) => rows.reduce((s, w) => s + Number(w.distance_km ?? 0), 0);
  const isTrailRun = (w: WkRow) => isRun(w.sport) && /trail/i.test(String(w.type ?? ""));
  const splitOf = (rows: WkRow[]) => ({
    road: km(rows.filter(w => isRun(w.sport) && !isTrailRun(w))),
    trail: km(rows.filter(isTrailRun)),
    bike: km(rows.filter(w => w.sport === "bike")),
    hike: km(rows.filter(w => w.sport === "hike" || w.sport === "walk")),
  });
  const yearRows = (workoutsYear ?? []) as WkRow[];
  const monthRows = (workoutsMonth ?? []) as WkRow[];
  const runsYear = yearRows.filter(w => isRun(w.sport));

  // Les compteurs mis en avant restent ceux de la COURSE — c'est une application de
  // course à pied, et c'est le chiffre que le coach utilise.
  const kmYear = km(runsYear);
  const kmMonth = km(monthRows.filter(w => isRun(w.sport)));
  const sessionsMonth = monthRows.filter(w => isRun(w.sport)).length;
  const longestRun = Math.max(0, ...runsYear.map(w => Number(w.distance_km ?? 0)));
  const bySport = { year: splitOf(yearRows), month: splitOf(monthRows) };

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
      stats={{ kmYear, kmMonth, sessionsMonth, longestRun, streak, bySport }}
      fitness={{ estimatedVma, obsMaxHr, garminVo2max: Number((profile as { garmin_vo2max?: number | null } | null)?.garmin_vo2max) || null, garmin: ((profile as { garmin_metrics?: Record<string, number | null> | null } | null)?.garmin_metrics) ?? null }}
      userId={user!.id}
    />
  );
}
