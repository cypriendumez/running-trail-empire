import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { fuseauOuDefaut } from "@/lib/time/fuseau";
import { createClient } from "@/lib/supabase/server";
import { lecturesEnEchec } from "@/lib/dashboard/lectures";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { BentoDashboard } from "@/components/dashboard/BentoDashboard";
import { stripProfileSecrets } from "@/lib/profile/safe";
import type { Objective } from "@/components/dashboard/ObjectiveCard";
import { bestVmaFromWorkouts, loadRisk, effectiveVma } from "@/lib/running/fitness";
import { oneSessionPerSlot, slotKey } from "@/lib/coach/sessions";
import { computeStreak, jourLocal, decaleJour, type StreakWorkout, type StreakPrescription } from "@/lib/streak/compute";
import { accesDe } from "@/lib/billing/access";

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
  // ⚠️ LE FUSEAU DE L'ATHLÈTE, PAS CELUI DU SERVEUR. Cette page est rendue à iad1
  // (États-Unis) : sans ce paramètre, `jourLocal` répondait la VEILLE entre minuit et
  // 6 h heure de Paris, et la flamme de série se calculait sur le mauvais jour.
  const fuseauAthlete = fuseauOuDefaut(decodeURIComponent((await cookies()).get("pacevo_tz")?.value ?? ""));
  const streakToday = jourLocal(new Date(), fuseauAthlete);
  const streakFrom = decaleJour(streakToday, -119);

  // Le jour de l'athlète, calculé AVANT les requêtes : il en filtre une.
  const today = aujourdhui(FUSEAU_DEFAUT);

  const [profileRes, hrvRes, workoutsRes, planRes, leagueRes, sleepRes, coachRes, feedbackRes, objRes, baseRes, newMembersRes, prRes, chargeRes, streakWkRes, streakPlanRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("hrv_data").select("*").eq("user_id", user!.id).order("date", { ascending: false }).limit(14),
    supabase.from("workouts").select("*").eq("user_id", user!.id).order("date", { ascending: false }).limit(40),
    supabase.from("training_plans").select("*").eq("user_id", user!.id).eq("is_active", true).single(),
    supabase.from("league_members").select("*, leagues(*)").eq("user_id", user!.id).order("score", { ascending: false }).limit(1).single(),
    supabase.from("sleep_data").select("total_sleep_min,sleep_score,body_battery_end,deep_sleep_min,rem_sleep_min,date").eq("user_id", user!.id).order("date", { ascending: false }).limit(1).single(),
    // ⚠️ ON NE RAMÈNE QUE LES SÉANCES À VENIR. Cette lecture rapportait les 40
    // dernières séances — 110 Ko mesurés, la plus grosse de la page — pour n'en garder
    // ENSUITE qu'une seule : la prochaine. Le filtre est le même, il se fait juste du
    // bon côté. La série, elle, a sa propre requête (`streakPlanRes`) et n'est pas
    // touchée : c'est elle qui a besoin du passé.
    supabase.from("notifications").select("title,body,data,created_at").eq("user_id", user!.id).eq("type", "coach_session").gte("data->>date", today).order("created_at", { ascending: false }).limit(40),
    supabase.from("notifications").select("data").eq("user_id", user!.id).eq("type", "session_feedback").order("created_at", { ascending: false }).limit(60),
    supabase.from("notifications").select("data").eq("user_id", user!.id).eq("type", "race_objective").maybeSingle(),
    supabase.from("performance_baselines").select("vma_kmh,max_hr").eq("user_id", user!.id).order("tested_at", { ascending: false }).limit(1).single(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    // ── RECORDS PAR DISTANCE — requête DÉDIÉE, sur TOUT l'historique ──────────────
    // La liste principale est plafonnée à 40 activités, soit ici deux mois seulement.
    // La carte « Records personnels » se calculait dessus et annonçait donc, avec le
    // badge RP, le meilleur temps des DEUX DERNIERS MOIS. Constaté sur des données
    // réelles : 25:48 affiché au 5 km alors que le vrai record est 16:07, et 41:20 au
    // 10 km alors que le vrai est 33:58 — près de huit minutes d'écart, sur une carte
    // qui dit « record ». On charge donc les seules séances candidates, sur toute la
    // durée du compte : filtrées à la COURSE À PIED (un tour de vélo de 21 km serait
    // sinon devenu un record du semi-marathon) et bornées aux quatre distances.
    supabase.from("workouts").select("date,distance_km,duration_seconds")
      .eq("user_id", user!.id).eq("sport", "run").gt("duration_seconds", 0)
      .or("and(distance_km.gte.4.7,distance_km.lte.5.4),and(distance_km.gte.9.4,distance_km.lte.10.6),and(distance_km.gte.20,distance_km.lte.22),and(distance_km.gte.40.5,distance_km.lte.43.5)")
      .order("duration_seconds", { ascending: true }).limit(400),
    // ── CHARGE (CTL/ATL/TSB) — requête DÉDIÉE, une année de mise en route ─────────
    // Le modèle est une moyenne mobile exponentielle de constante 42 jours. Alimentée
    // sur 42 jours seulement et amorcée à une valeur arbitraire, elle N'A PAS CONVERGÉ :
    // l'amorce pèse encore (1−1/42)^42 ≈ 36 % du résultat. Mesuré sur ce compte, les
    // 40 points d'amorce écrits en dur apportaient 14,5 des 53,7 de « Forme » affichés,
    // et la « Fraîcheur » sortait à −3,6 au lieu de −10,8 — assez pour faire basculer
    // le verdict de « charge lourde » à « charge équilibrée ».
    // Une année d'historique rend l'amorce négligeable : (1−1/42)^365 ≈ 0,015 %.
    // Tous sports confondus, volontairement : un tour de vélo fatigue aussi.
    supabase.from("workouts").select("date,tss,type,duration_seconds")
      .eq("user_id", user!.id).gte("date", decaleJour(streakToday, -365))
      .order("date", { ascending: false }).limit(1000),
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

  /**
   * ⚠️ UNE LECTURE EN PANNE NE DOIT PAS SE LIRE COMME « TU N'AS RIEN COURU ».
   *
   * Aucune des quinze lectures de cette page ne regardait son erreur. Si `workouts`
   * ne répond pas, `?? []` prend le relais et l'athlète voit zéro kilomètre, zéro
   * séance, aucune VMA — l'écran d'un compte vide, alors que ses données sont
   * intactes. C'est le pire message possible : il donne à croire qu'on les a perdues.
   *
   * ⚠️ ET `PGRST116` N'EST PAS UNE PANNE. Mesuré : `.single()` sur zéro ligne REND une
   * erreur portant ce code — c'est le cas normal d'un athlète qui n'a pas encore de
   * plan, de ligue ou de nuit enregistrée. Le confondre avec une panne afficherait un
   * avertissement permanent à tout nouvel inscrit, et on n'y croirait plus le jour où
   * il compte.
   */
  // Des identifiants STABLES, pas des libellés : cette page est rendue côté serveur et
  // n'a pas de dictionnaire. C'est le composant client, qui connaît la langue, qui les
  // traduit. La distinction panne / absence vit dans `lib/dashboard/lectures`, où elle
  // est éprouvable — c'est là que le projet range ses calculs affichés.
  const donneesIncompletes = lecturesEnEchec([
    ["profil", profileRes], ["seances", workoutsRes],
    ["charge", chargeRes], ["records", prRes],
  ]);
  if (donneesIncompletes.length) {
    console.error("[tableau de bord] lectures en échec :", donneesIncompletes.join(", "));
  }

  return (
    <>
    <BentoDashboard
      donneesIncompletes={donneesIncompletes}
      profile={stripProfileSecrets(profileRes.data)}
      hrv={hrvRes.data ?? []}
      workouts={workoutsRes.data ?? []}
      plan={planRes.data}
      league={leagueRes.data}
      prWorkouts={prRes.data ?? []}
      chargeHistory={chargeRes.data ?? []}
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
    </>
  );
}
