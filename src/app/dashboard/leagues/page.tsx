export const dynamic = "force-dynamic";
import { isRun } from "@/lib/intervals/sport";
import { createClient } from "@/lib/supabase/server";
import { LeaguesHub } from "@/components/gamification/LeaguesHub";

export const metadata = { title: "Ligues & Gamification | Pacevo" };

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
      .select("id, date, distance_km, duration_seconds, elevation_gain_m, type, sport, avg_pace_min_km")
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

  // ── Métriques réelles (année en cours) ──
  // Badges et classements de COURSE : une sortie vélo de 60 km décrochait le badge
  // « sortie longue ≥ 20 km » et gonflait le record de distance. Le vélo reste visible
  // ailleurs, mais il ne concourt pas dans une ligue de course à pied.
  const allWorkouts = (workouts ?? []).filter((w) => isRun((w as { sport?: string | null }).sport));
  const num = (v: unknown) => Number(v ?? 0);
  const totalKm = allWorkouts.reduce((s, w) => s + num(w.distance_km), 0);
  const totalElev = allWorkouts.reduce((s, w) => s + num(w.elevation_gain_m), 0);
  const sessions = allWorkouts.length;
  const maxRun = Math.max(0, ...allWorkouts.map((w) => num(w.distance_km)));
  // Le trail est un TYPE de course, pas la randonnée : `allWorkouts` ne contient déjà
  // plus que de la course à pied, le filtre de type suffit.
  const isTrail = (w: { type?: unknown }) => String(w.type ?? "").toLowerCase().includes("trail");
  const trailWorkouts = allWorkouts.filter(isTrail);
  const trailKm = trailWorkouts.reduce((s, w) => s + num(w.distance_km), 0);
  const longRuns = allWorkouts.filter((w) => num(w.distance_km) >= 20).length;
  const paces = allWorkouts.map((w) => num(w.avg_pace_min_km)).filter((p) => p > 2.5 && p < 12);
  const bestPace = paces.length ? Math.min(...paces) : 0; // min/km — plus bas = plus rapide

  // Série en cours (jours consécutifs), avec tolérance « pas encore couru aujourd'hui ».
  const dates = new Set(allWorkouts.map((w) => String(w.date).slice(0, 10)));
  let streak = 0;
  const d = new Date();
  if (!dates.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (dates.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  const distinctDays = dates.size;

  // Volume mensuel
  const byMonth: Record<string, number> = {};
  allWorkouts.forEach((w) => { const m = String(w.date).slice(0, 7); byMonth[m] = (byMonth[m] ?? 0) + num(w.distance_km); });
  const maxMonthKm = Math.max(0, ...Object.values(byMonth));
  const activeMonths = Object.keys(byMonth).length;
  const subMarathon = allWorkouts.some((w) => num(w.distance_km) >= 42 && num(w.duration_seconds) > 0 && num(w.duration_seconds) <= 14400);
  const totalHours = allWorkouts.reduce((s, w) => s + num(w.duration_seconds), 0) / 3600;
  const marathonCount = allWorkouts.filter((w) => num(w.distance_km) >= 42).length;
  const maxElevRun = Math.max(0, ...allWorkouts.map((w) => num(w.elevation_gain_m)));
  // Plus gros volume sur 7 jours glissants
  const kmByDay: Record<string, number> = {};
  allWorkouts.forEach((w) => { const k = String(w.date).slice(0, 10); kmByDay[k] = (kmByDay[k] ?? 0) + num(w.distance_km); });
  let bigWeek = 0;
  for (const day of Object.keys(kmByDay)) {
    const end = new Date(day + "T00:00:00").getTime();
    let s = 0; for (let k = 0; k < 7; k++) s += kmByDay[new Date(end - k * 86400000).toISOString().slice(0, 10)] ?? 0;
    bigWeek = Math.max(bigWeek, s);
  }

  // ── Métriques avancées (nouveaux badges & records personnels) ──
  const dow = (s: unknown) => new Date(String(s).slice(0, 10) + "T12:00:00").getDay();
  const weekendRuns = allWorkouts.filter((w) => { const g = dow(w.date); return g === 0 || g === 6; }).length;
  const runsPerDay: Record<string, number> = {};
  allWorkouts.forEach((w) => { const k = String(w.date).slice(0, 10); runsPerDay[k] = (runsPerDay[k] ?? 0) + 1; });
  const doubleDays = Object.values(runsPerDay).filter((n) => n >= 2).length;
  const maxRunSec = Math.max(0, ...allWorkouts.map((w) => num(w.duration_seconds)));
  const isoWeekKey = (s: unknown) => { const d = new Date(String(s).slice(0, 10) + "T12:00:00"); const oneJan = new Date(d.getFullYear(), 0, 1); const days = Math.floor((d.getTime() - oneJan.getTime()) / 86400000); return `${d.getFullYear()}-${Math.ceil((days + oneJan.getDay() + 1) / 7)}`; };
  const weeksActive = new Set(allWorkouts.map((w) => isoWeekKey(w.date))).size;
  const monthsOver100 = Object.values(byMonth).filter((k) => k >= 100).length;
  const monthSet = new Set(allWorkouts.map((w) => Number(String(w.date).slice(5, 7))));
  const winterRun = [12, 1, 2].some((m) => monthSet.has(m));
  const allSeasons = [12, 1, 2].some((m) => monthSet.has(m)) && [3, 4, 5].some((m) => monthSet.has(m)) && [6, 7, 8].some((m) => monthSet.has(m)) && [9, 10, 11].some((m) => monthSet.has(m));
  const fastRuns = paces.filter((p) => p <= 5).length;
  const sortedDayTs = [...dates].map((ds) => new Date(ds + "T00:00:00").getTime()).sort((a, b) => a - b);
  let longestStreak = 0, curStreak = 0; let prevTs: number | null = null;
  for (const t of sortedDayTs) { curStreak = prevTs !== null && t - prevTs === 86400000 ? curStreak + 1 : 1; longestStreak = Math.max(longestStreak, curStreak); prevTs = t; }

  type Rarity = "common" | "rare" | "epic" | "legendary";
  const badge = (id: string, name: string, icon: string, rarity: Rarity, description: string, unlocked: boolean, progress: number, max: number) =>
    ({ id, name, icon, rarity, description, unlocked, progress: Math.round(Math.min(Math.max(progress, 0), max)), max });

  const computedBadges = [
    // Distances (sortie unique)
    badge("first_run", "Premier pas", "👟", "common", "Enregistrer votre première séance", sessions > 0, Math.min(sessions, 1), 1),
    badge("run_5k", "Premier 5 km", "🏃", "common", "Courir 5 km en une séance", maxRun >= 5, maxRun, 5),
    badge("run_10k", "Premier 10 km", "🎽", "common", "Courir 10 km en une séance", maxRun >= 10, maxRun, 10),
    badge("half", "Semi-marathon", "🏅", "rare", "Boucler 21 km en une séance", maxRun >= 21, maxRun, 21),
    badge("marathon", "Marathon", "🎖️", "epic", "Boucler 42 km en une séance", maxRun >= 42, maxRun, 42),
    badge("ultra_50", "Ultra 50K", "💎", "legendary", "Courir 50 km en une seule sortie", maxRun >= 50, maxRun, 50),
    badge("ultra_100", "Centurion", "👑", "legendary", "Courir 100 km en une seule sortie", maxRun >= 100, maxRun, 100),
    // Volume annuel
    badge("km_100", "100 km / an", "💯", "common", "Cumuler 100 km sur l'année", totalKm >= 100, totalKm, 100),
    badge("km_500", "500 km / an", "🚀", "rare", "Cumuler 500 km sur l'année", totalKm >= 500, totalKm, 500),
    badge("km_1000", "1000 km / an", "⭐", "epic", "Cumuler 1000 km sur l'année", totalKm >= 1000, totalKm, 1000),
    badge("km_2000", "2000 km / an", "🌟", "legendary", "Cumuler 2000 km sur l'année", totalKm >= 2000, totalKm, 2000),
    // Volume mensuel
    badge("month_100", "100 km en un mois", "💪", "epic", "Courir 100 km sur un seul mois", maxMonthKm >= 100, maxMonthKm, 100),
    badge("month_200", "Machine de guerre", "🔱", "legendary", "Courir 200 km sur un seul mois", maxMonthKm >= 200, maxMonthKm, 200),
    // Régularité / séries
    badge("streak_3", "Sur la lancée", "✨", "common", "Courir 3 jours d'affilée", streak >= 3, streak, 3),
    badge("streak_7", "7 jours de feu", "🔥", "rare", "Courir 7 jours d'affilée", streak >= 7, streak, 7),
    badge("streak_14", "Inarrêtable", "⚡", "epic", "Courir 14 jours d'affilée", streak >= 14, streak, 14),
    badge("streak_30", "Mois de feu", "🌋", "legendary", "Courir 30 jours d'affilée", streak >= 30, streak, 30),
    badge("days_50", "Habitué", "📆", "rare", "Courir 50 jours différents dans l'année", distinctDays >= 50, distinctDays, 50),
    badge("days_100", "Centaine de jours", "🗓️", "epic", "Courir 100 jours différents dans l'année", distinctDays >= 100, distinctDays, 100),
    // Séances
    badge("sessions_25", "Assidu", "🎯", "common", "Compléter 25 séances", sessions >= 25, sessions, 25),
    badge("sessions_100", "Centurion de l'effort", "🏆", "epic", "Compléter 100 séances", sessions >= 100, sessions, 100),
    // Trail / dénivelé
    badge("first_trail", "Baptême du trail", "⛰️", "common", "Compléter votre première sortie trail", trailWorkouts.length > 0, Math.min(trailWorkouts.length, 1), 1),
    badge("trail_100", "Traileur", "🏔️", "rare", "Cumuler 100 km de trail", trailKm >= 100, trailKm, 100),
    badge("vert_1000", "Grimpeur", "🧗", "epic", "1000 m de D+ sur une seule sortie", Math.max(0, ...allWorkouts.map((w) => num(w.elevation_gain_m))) >= 1000, Math.max(0, ...allWorkouts.map((w) => num(w.elevation_gain_m))), 1000),
    badge("everest", "Everesting", "🗻", "legendary", "Cumuler 8848 m de D+ (l'Everest !)", totalElev >= 8848, totalElev, 8848),
    // Vitesse
    badge("speed_5", "Sous les 5'/km", "⚡", "rare", "Tenir une allure < 5:00/km sur une sortie", bestPace > 0 && bestPace <= 5, bestPace > 0 && bestPace <= 5 ? 1 : 0, 1),
    badge("speed_430", "Foudre", "🚀", "epic", "Tenir une allure < 4:30/km sur une sortie", bestPace > 0 && bestPace <= 4.5, bestPace > 0 && bestPace <= 4.5 ? 1 : 0, 1),
    badge("sub4_marathon", "Marathon Sub 4h", "🏅", "epic", "Finir un marathon en moins de 4 heures", subMarathon, subMarathon ? 1 : 0, 1),
    // Endurance / saison
    badge("long_runner", "Roi de la sortie longue", "🦵", "rare", "5 sorties d'au moins 20 km", longRuns >= 5, longRuns, 5),
    badge("seasoned", "Coureur de l'année", "📅", "epic", "Être actif sur 6 mois différents", activeMonths >= 6, activeMonths, 6),
    // Distances intermédiaires
    badge("run_15k", "15 km", "🥈", "common", "Courir 15 km en une séance", maxRun >= 15, maxRun, 15),
    badge("run_30k", "30 km", "🥇", "rare", "Courir 30 km en une séance", maxRun >= 30, maxRun, 30),
    badge("marathon_x3", "Triple marathon", "🏛️", "legendary", "Boucler 3 sorties d'au moins 42 km", marathonCount >= 3, marathonCount, 3),
    // Volume
    badge("km_3000", "3000 km / an", "🌠", "legendary", "Cumuler 3000 km sur l'année", totalKm >= 3000, totalKm, 3000),
    badge("month_150", "150 km en un mois", "🦾", "legendary", "Courir 150 km sur un seul mois", maxMonthKm >= 150, maxMonthKm, 150),
    badge("bigweek_100", "Grosse semaine", "🌪️", "epic", "100 km sur 7 jours glissants", bigWeek >= 100, bigWeek, 100),
    badge("hours_100", "100 heures", "⏱️", "epic", "Cumuler 100 h de course sur l'année", totalHours >= 100, totalHours, 100),
    // Régularité
    badge("streak_21", "21 jours d'affilée", "🧱", "epic", "Courir 21 jours consécutifs", streak >= 21, streak, 21),
    badge("sessions_50", "50 séances", "📋", "common", "Compléter 50 séances", sessions >= 50, sessions, 50),
    badge("sessions_250", "250 séances", "🏵️", "legendary", "Compléter 250 séances", sessions >= 250, sessions, 250),
    badge("days_200", "200 jours courus", "🗓️", "legendary", "Courir 200 jours différents dans l'année", distinctDays >= 200, distinctDays, 200),
    badge("long_10", "Roi des sorties longues", "🦿", "epic", "10 sorties d'au moins 20 km", longRuns >= 10, longRuns, 10),
    // Trail / dénivelé
    badge("vert_500", "Première grimpe", "🥾", "rare", "500 m de D+ sur une seule sortie", maxElevRun >= 500, maxElevRun, 500),
    badge("trail_500", "Maître du trail", "🌲", "epic", "Cumuler 500 km de trail", trailKm >= 500, trailKm, 500),
    badge("elev_20k", "Deux Everest", "🏔️", "legendary", "Cumuler 20 000 m de D+", totalElev >= 20000, totalElev, 20000),
    // Vitesse
    badge("speed_4", "Vitesse pure", "💨", "legendary", "Tenir une allure < 4:00/km sur une sortie", bestPace > 0 && bestPace <= 4, bestPace > 0 && bestPace <= 4 ? 1 : 0, 1),

    // ════════ NOUVEAUX BADGES ════════
    // Distances (sortie unique)
    badge("run_25k", "25 km", "📏", "rare", "Courir 25 km en une séance", maxRun >= 25, maxRun, 25),
    badge("run_60k", "60 km", "🥵", "legendary", "Courir 60 km en une seule sortie", maxRun >= 60, maxRun, 60),
    badge("run_80k", "80 km", "🫀", "legendary", "Courir 80 km en une seule sortie", maxRun >= 80, maxRun, 80),
    badge("miles_100", "100 miles", "🦅", "legendary", "Courir 161 km (100 miles) en une sortie", maxRun >= 161, maxRun, 161),
    // Volume annuel
    badge("km_250", "250 km / an", "🧭", "common", "Cumuler 250 km sur l'année", totalKm >= 250, totalKm, 250),
    badge("km_750", "750 km / an", "🚄", "rare", "Cumuler 750 km sur l'année", totalKm >= 750, totalKm, 750),
    badge("km_1500", "1500 km / an", "✈️", "epic", "Cumuler 1500 km sur l'année", totalKm >= 1500, totalKm, 1500),
    badge("tdf", "Tour de France", "🚲", "legendary", "Cumuler 3500 km sur l'année (un Tour de France !)", totalKm >= 3500, totalKm, 3500),
    // Volume mensuel
    badge("month_50", "50 km en un mois", "📈", "common", "Courir 50 km sur un seul mois", maxMonthKm >= 50, maxMonthKm, 50),
    badge("month_300", "300 km en un mois", "☄️", "legendary", "Courir 300 km sur un seul mois", maxMonthKm >= 300, maxMonthKm, 300),
    badge("months100_6", "Six mois à 100", "📚", "legendary", "6 mois différents à plus de 100 km", monthsOver100 >= 6, monthsOver100, 6),
    // Régularité / séries
    badge("streak_50", "50 jours d'affilée", "🧊", "legendary", "Courir 50 jours consécutifs", longestStreak >= 50, longestStreak, 50),
    badge("streak_100", "100 jours d'affilée", "💠", "legendary", "Courir 100 jours consécutifs", longestStreak >= 100, longestStreak, 100),
    badge("weeks_10", "10 semaines actives", "📊", "rare", "Courir sur 10 semaines différentes", weeksActive >= 10, weeksActive, 10),
    badge("weeks_26", "Demi-saison", "🌗", "epic", "Courir sur 26 semaines différentes", weeksActive >= 26, weeksActive, 26),
    badge("weeks_52", "Toute l'année", "♾️", "legendary", "Courir sur 52 semaines différentes", weeksActive >= 52, weeksActive, 52),
    badge("days_150", "150 jours courus", "🧮", "legendary", "Courir 150 jours différents dans l'année", distinctDays >= 150, distinctDays, 150),
    // Séances
    badge("sessions_500", "500 séances", "🏟️", "legendary", "Compléter 500 séances", sessions >= 500, sessions, 500),
    // Trail / dénivelé
    badge("vert_2000", "Ascension", "🪜", "legendary", "2000 m de D+ sur une seule sortie", maxElevRun >= 2000, maxElevRun, 2000),
    badge("vert_3000", "Mur vertical", "🧗‍♂️", "legendary", "3000 m de D+ sur une seule sortie", maxElevRun >= 3000, maxElevRun, 3000),
    badge("trail_250", "Traileur confirmé", "🌳", "epic", "Cumuler 250 km de trail", trailKm >= 250, trailKm, 250),
    badge("elev_30k", "Toit du monde ×3", "🛰️", "legendary", "Cumuler 30 000 m de D+", totalElev >= 30000, totalElev, 30000),
    // Vitesse
    badge("speed_345", "Sprinteur", "🏎️", "legendary", "Tenir une allure < 3:45/km sur une sortie", bestPace > 0 && bestPace <= 3.75, bestPace > 0 && bestPace <= 3.75 ? 1 : 0, 1),
    badge("fast_10", "Métronome rapide", "🎼", "rare", "10 sorties sous les 5:00/km", fastRuns >= 10, fastRuns, 10),
    // Temps / endurance
    badge("hours_50", "50 heures", "🕐", "rare", "Cumuler 50 h de course sur l'année", totalHours >= 50, totalHours, 50),
    badge("hours_200", "200 heures", "🕰️", "legendary", "Cumuler 200 h de course sur l'année", totalHours >= 200, totalHours, 200),
    badge("long_3h", "Endurance 3 h", "⌛", "epic", "Une sortie d'au moins 3 heures", maxRunSec >= 10800, maxRunSec, 10800),
    badge("long_6h", "Ultra-endurance", "🌒", "legendary", "Une sortie d'au moins 6 heures", maxRunSec >= 21600, maxRunSec, 21600),
    // Comportement / fun
    badge("weekend_10", "Guerrier du week-end", "🛡️", "common", "10 sorties un samedi ou un dimanche", weekendRuns >= 10, weekendRuns, 10),
    badge("double_1", "Double ration", "🍱", "rare", "Faire 2 séances dans la même journée", doubleDays >= 1, doubleDays, 1),
    badge("double_10", "Bi-quotidien", "🔂", "epic", "10 journées avec 2 séances", doubleDays >= 10, doubleDays, 10),
    badge("four_seasons", "Quatre saisons", "🍂", "epic", "Courir au moins une fois à chaque saison", allSeasons, allSeasons ? 1 : 0, 1),
    badge("winter", "Coureur d'hiver", "❄️", "rare", "Courir en décembre, janvier ou février", winterRun, winterRun ? 1 : 0, 1),
    badge("marathon_x5", "Collectionneur de marathons", "🏛️", "legendary", "Boucler 5 sorties d'au moins 42 km", marathonCount >= 5, marathonCount, 5),
  ];

  // Available challenges from DB (défis collectifs, s'il y en a)
  const { data: availableChallenges } = await supabase
    .from("team_challenges")
    .select("id, name, description, total_km, current_km, end_date")
    .order("created_at", { ascending: false })
    .limit(5);

  // ── Défis à suivi automatique : objectifs réels calculés sur tes données ──
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthWk = allWorkouts.filter((w) => String(w.date).slice(0, 10) >= monthStart);
  const monthKm = monthWk.reduce((s, w) => s + num(w.distance_km), 0);
  const monthElev = monthWk.reduce((s, w) => s + num(w.elevation_gain_m), 0);
  const monthLongest = Math.max(0, ...monthWk.map((w) => num(w.distance_km)));
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const weekWk = allWorkouts.filter((w) => new Date(w.date).getTime() >= sevenDaysAgo);
  const weekKm = weekWk.reduce((s, w) => s + num(w.distance_km), 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysToMonthEnd = Math.max(1, Math.ceil((endOfMonth.getTime() - now.getTime()) / 86400000));
  const daysToSunday = (7 - now.getDay()) % 7 || 7;
  const maxWeekRun = Math.max(0, ...weekWk.map((w) => num(w.distance_km)));
  const weekElev = weekWk.reduce((s, w) => s + num(w.elevation_gain_m), 0);
  const monthTrailKm = monthWk.filter(isTrail).reduce((s, w) => s + num(w.distance_km), 0);
  const monthDistinctDays = new Set(monthWk.map((w) => String(w.date).slice(0, 10))).size;
  const daysToYearEnd = Math.max(1, Math.ceil((new Date(now.getFullYear(), 11, 31).getTime() - now.getTime()) / 86400000));
  const weekendThisWeek = (weekWk.some((w) => dow(w.date) === 6) ? 1 : 0) + (weekWk.some((w) => dow(w.date) === 0) ? 1 : 0);
  const weekFast = weekWk.map((w) => num(w.avg_pace_min_km)).filter((p) => p > 2.5 && p <= 5).length;
  const monthMarathon = monthWk.some((w) => num(w.distance_km) >= 42) ? 1 : 0;

  const autoChallenges = [
    { id: "w_sessions", icon: "🔥", name: "Semaine active", desc: "4 séances sur les 7 derniers jours", current: weekWk.length, target: 4, unit: "séances", daysLeft: daysToSunday, period: "semaine" },
    { id: "w_km", icon: "🏃", name: "30 km cette semaine", desc: "Cumuler 30 km sur 7 jours", current: Math.round(weekKm), target: 30, unit: "km", daysLeft: daysToSunday, period: "semaine" },
    { id: "m_km", icon: "📅", name: "100 km ce mois", desc: "Cumuler 100 km de course sur le mois", current: Math.round(monthKm), target: 100, unit: "km", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "m_sessions", icon: "🎯", name: "Régularité du mois", desc: "12 séances dans le mois", current: monthWk.length, target: 12, unit: "séances", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "m_long", icon: "🦵", name: "Sortie longue", desc: "Une sortie d'au moins 15 km ce mois", current: Math.round(monthLongest), target: 15, unit: "km", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "m_elev", icon: "⛰️", name: "Grimpeur du mois", desc: "2000 m de D+ cumulés ce mois", current: Math.round(monthElev), target: 2000, unit: "m D+", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "w_long", icon: "🏞️", name: "Sortie longue de la semaine", desc: "Une sortie d'au moins 10 km sur 7 jours", current: Math.round(maxWeekRun), target: 10, unit: "km", daysLeft: daysToSunday, period: "semaine" },
    { id: "w_elev", icon: "🧗", name: "Grimpe de la semaine", desc: "500 m de D+ sur 7 jours", current: Math.round(weekElev), target: 500, unit: "m D+", daysLeft: daysToSunday, period: "semaine" },
    { id: "m_days", icon: "📆", name: "Assiduité du mois", desc: "Courir 15 jours différents ce mois", current: monthDistinctDays, target: 15, unit: "jours", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "m_trail", icon: "🌲", name: "Trail du mois", desc: "20 km de trail ce mois", current: Math.round(monthTrailKm), target: 20, unit: "km", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "m_long25", icon: "🏔️", name: "Prépa longue distance", desc: "Une sortie d'au moins 25 km ce mois", current: Math.round(monthLongest), target: 25, unit: "km", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "y_km", icon: "🗓️", name: "Cap de l'année", desc: "1000 km sur l'année", current: Math.round(totalKm), target: 1000, unit: "km", daysLeft: daysToYearEnd, period: "année" },
    // ════════ NOUVEAUX DÉFIS ════════
    { id: "w_weekend", icon: "🛡️", name: "Guerrier du week-end", desc: "Courir samedi ET dimanche", current: weekendThisWeek, target: 2, unit: "jours", daysLeft: daysToSunday, period: "semaine" },
    { id: "w_sessions5", icon: "💥", name: "Grosse semaine", desc: "5 séances sur les 7 derniers jours", current: weekWk.length, target: 5, unit: "séances", daysLeft: daysToSunday, period: "semaine" },
    { id: "w_km50", icon: "🚀", name: "50 km cette semaine", desc: "Cumuler 50 km sur 7 jours", current: Math.round(weekKm), target: 50, unit: "km", daysLeft: daysToSunday, period: "semaine" },
    { id: "w_fast", icon: "⚡", name: "Séance rapide", desc: "Une sortie sous 5:00/km cette semaine", current: weekFast > 0 ? 1 : 0, target: 1, unit: "sortie", daysLeft: daysToSunday, period: "semaine" },
    { id: "m_km200", icon: "🔥", name: "200 km ce mois", desc: "Cumuler 200 km de course sur le mois", current: Math.round(monthKm), target: 200, unit: "km", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "m_long30", icon: "🦵", name: "Sortie très longue", desc: "Une sortie d'au moins 30 km ce mois", current: Math.round(monthLongest), target: 30, unit: "km", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "m_elev3000", icon: "🏔️", name: "Montagne du mois", desc: "3000 m de D+ cumulés ce mois", current: Math.round(monthElev), target: 3000, unit: "m D+", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "m_marathon", icon: "🎖️", name: "Marathon du mois", desc: "Une sortie d'au moins 42 km ce mois", current: monthMarathon, target: 1, unit: "sortie", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "m_trail50", icon: "🌲", name: "Traileur du mois", desc: "50 km de trail ce mois", current: Math.round(monthTrailKm), target: 50, unit: "km", daysLeft: daysToMonthEnd, period: "mois" },
    { id: "m_days20", icon: "📆", name: "Régularité béton", desc: "Courir 20 jours différents ce mois", current: monthDistinctDays, target: 20, unit: "jours", daysLeft: daysToMonthEnd, period: "mois" },
  ];

  const records = {
    longestRun: Math.round(maxRun * 10) / 10,
    bestPace,
    biggestWeek: Math.round(bigWeek),
    biggestMonth: Math.round(maxMonthKm),
    longestStreak,
    maxElevRun: Math.round(maxElevRun),
    totalHours: Math.round(totalHours),
    weeksActive,
  };

  return (
    <LeaguesHub
      userId={user.id}
      profile={profile as Record<string, unknown>}
      myMembership={myMembership as Record<string, unknown> | null}
      leagueMembers={leagueMembers}
      computedBadges={computedBadges}
      myChallenges={(challenges ?? []) as Record<string, unknown>[]}
      availableChallenges={(availableChallenges ?? []) as Record<string, unknown>[]}
      autoChallenges={autoChallenges}
      stats={{ totalKm: Math.round(totalKm), streak, sessions: allWorkouts.length, elevation: Math.round(totalElev) }}
      records={records}
    />
  );
}
