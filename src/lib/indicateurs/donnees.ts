/**
 * LES DONNÉES D'UNE FICHE D'INDICATEUR — lues côté serveur (04/10/2026).
 *
 * Mêmes lectures que le tableau de bord pour ce qui alimente un CHIFFRE (les 40 dernières
 * séances, la charge sur un an, la baseline, l'objectif), plus un historique plus long pour
 * les GRAPHIQUES. Chaque erreur est lue : une lecture en panne est signalée, jamais
 * présentée comme « pas de données » (lib/dashboard/lectures).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "@/lib/i18n/translations";
import type { HRVData, Workout } from "@/types";
import type { DonneesFiche } from "./fiches";
import type { SeanceCharge } from "@/lib/dashboard/charge";
import { vmaAffichee, SEANCES_VMA } from "@/lib/dashboard/vmaAffichee";
import { fcMaxDeLAthlete } from "@/lib/coach/fcMaxServeur";
import { COLONNES_VFC, serieVfc } from "@/lib/health/vfc";
import { objectifEnCours } from "@/lib/coach/prochaineCourse";
import { computeStreak, coursesDeLObjectif, type StreakWorkout, type StreakPrescription } from "@/lib/streak/compute";
import { oneSessionPerSlot, slotKey } from "@/lib/coach/sessions";
import { signalerLectures } from "@/lib/dashboard/lecturesServeur";
import { estUnePanne } from "@/lib/dashboard/lectures";

const decale = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const PANNE: Record<Lang, string> = {
  fr: "Une partie de tes données n'a pas pu être lue : certains chiffres peuvent manquer. Recharge la page dans un instant.",
  en: "Some of your data couldn't be read: some figures may be missing. Reload the page in a moment.",
  de: "Ein Teil deiner Daten konnte nicht gelesen werden: Einige Werte fehlen eventuell. Lade die Seite gleich neu.",
  es: "No se ha podido leer parte de tus datos: pueden faltar algunas cifras. Recarga la página en un momento.",
  pt: "Não foi possível ler parte dos teus dados: podem faltar alguns números. Recarrega a página daqui a pouco.",
};

export async function chargerDonnees(sb: SupabaseClient, userId: string, lang: Lang, aujourdhui: string): Promise<DonneesFiche & { pannes: string[] }> {
  const [profil, seances, historique, vfc, sommeil, charge, base, obj, plan, serieSeances, seriePlan, serieRessentis, fcMaxVma, seancesVma] = await Promise.all([
    sb.from("profiles").select("resting_hr, garmin_vo2max, pace_curve").eq("id", userId).maybeSingle(),
    sb.from("workouts").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(40),
    sb.from("workouts").select("date, sport, distance_km").eq("user_id", userId).gte("date", decale(aujourdhui, -120)).order("date", { ascending: false }).limit(1000),
    sb.from("hrv_data").select(COLONNES_VFC).eq("user_id", userId).order("date", { ascending: false }).limit(60),
    sb.from("sleep_data").select("date, sleep_score, total_sleep_min").eq("user_id", userId).order("date", { ascending: false }).limit(14),
    sb.from("workouts").select("date, tss, type, duration_seconds").eq("user_id", userId).gte("date", decale(aujourdhui, -365)).order("date", { ascending: false }).limit(1000),
    sb.from("performance_baselines").select("vma_kmh, tested_at").eq("user_id", userId).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "race_objective").maybeSingle(),
    sb.from("training_plans").select("start_date, created_at, race_date").eq("user_id", userId).eq("is_active", true).maybeSingle(),
    // ── LA SÉRIE, POUR L'ASSIDUITÉ (06/11/2026) : le score discipline juge ce que le coach a
    // prescrit, avec les règles de la série. Mêmes lectures que le tableau de bord, sur la
    // fenêtre utile (14 jours jugés + 28 de charge pour les protections de surcharge).
    sb.from("workouts").select("date,sport,type,duration_seconds,distance_km,tss,training_effect")
      .eq("user_id", userId).gte("date", decale(aujourdhui, -60)).order("date", { ascending: false }).limit(300),
    sb.from("notifications").select("created_at,data").eq("user_id", userId).eq("type", "coach_session")
      .gte("data->>date", decale(aujourdhui, -20)).order("created_at", { ascending: false }).limit(200),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "session_feedback").order("created_at", { ascending: false }).limit(60),
    // La FC max COMMUNE trie les efforts de la VMA (12/11/2026), comme partout.
    fcMaxDeLAthlete(sb, userId),
    // Les séances de LA VMA (12/11/2026) : autant que le coach (`SEANCES_VMA`).
    sb.from("workouts").select("date,type,sport,distance_km,duration_seconds,avg_hr,max_hr,weather_temp_c").eq("user_id", userId).order("date", { ascending: false }).limit(SEANCES_VMA),
  ]);
  const enPanne = [profil, seances, historique, vfc, sommeil, charge, base, obj, plan, serieSeances, seriePlan, serieRessentis, seancesVma].filter((r) => estUnePanne(r));
  // Journalisées dans error_logs (12/11/2026) — « aucune ligne » n'est pas une panne.
  await signalerLectures("indicateurs", userId, [["profil", profil], ["seances", seances], ["historique", historique], ["vfc", vfc],
    ["sommeil", sommeil], ["charge", charge], ["repere", base], ["objectif", obj], ["plan", plan], ["serie-seances", serieSeances],
    ["serie-plan", seriePlan], ["serie-ressentis", serieRessentis], ["vma", seancesVma]]);
  const ws = (seances.data ?? []) as Workout[];
  const p = profil.data as { resting_hr?: number | null; garmin_vo2max?: number | null; pace_curve?: { best?: { m: number; sec: number }[] } | null } | null;
  const o = (obj.data?.data ?? null) as DonneesFiche["objectif"];
  // UNE seule mesure de VFC (rMSSD, ou SDNN d'Apple Watch), état face à SA base :
  // exactement la série que reçoit la carte du tableau de bord (lib/health/vfc).
  const serie = serieVfc((vfc.data ?? []) as Pick<HRVData, "date" | "rmssd" | "sdnn">[]);
  return {
    lang, aujourdhui,
    seances: ws,
    historique: (historique.data ?? []) as Workout[],
    vfc: serie.lignes,
    metriqueVfc: serie.metrique,
    sommeil: (sommeil.data ?? []) as DonneesFiche["sommeil"],
    charge: (charge.data ?? []) as SeanceCharge[],
    vma: vmaAffichee({ seances: (seancesVma.data ?? []) as Parameters<typeof vmaAffichee>[0]["seances"], baseline: base.data as { vma_kmh?: number | null; tested_at?: string | null } | null, profil: p, fcMax: fcMaxVma }),
    // Une course passée n'est plus l'objectif : la vitesse se juge alors sur la VMA, comme
    // sur la carte du tableau de bord (`objectifEnCours`, même règle des deux côtés).
    objectif: o && o.raceDate && o.distanceKm ? objectifEnCours(o, aujourdhui) : null,
    plan: (plan.data ?? null) as DonneesFiche["plan"],
    fcRepos: Number(p?.resting_hr) || null,
    // Une lecture en panne ne doit pas se lire comme « rien de prescrit » : pas de série.
    serie: seriePlan.error || serieSeances.error ? null : computeStreak({
      workouts: (serieSeances.data ?? []) as StreakWorkout[],
      prescriptions: oneSessionPerSlot((seriePlan.data ?? []) as { data: StreakPrescription }[], (r) => slotKey(r.data as { date?: unknown; moment?: unknown })).map((r) => r.data),
      feedbacks: ((serieRessentis.data ?? []) as { data: { date?: unknown; pain?: unknown } }[]).map((r) => r.data),
      courses: coursesDeLObjectif((obj.data?.data ?? null) as Parameters<typeof coursesDeLObjectif>[0]),
      today: aujourdhui, windowDays: 30,
    }).days.map((j) => ({ date: j.date, verdict: j.verdict })),
    pannes: enPanne.length ? [PANNE[lang]] : [],
  };
}
