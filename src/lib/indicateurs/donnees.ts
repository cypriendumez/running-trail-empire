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
import { vmaAffichee } from "@/lib/dashboard/vmaAffichee";

const decale = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const PANNE: Record<Lang, string> = {
  fr: "Une partie de tes données n'a pas pu être lue : certains chiffres peuvent manquer. Recharge la page dans un instant.",
  en: "Some of your data couldn't be read: some figures may be missing. Reload the page in a moment.",
  de: "Ein Teil deiner Daten konnte nicht gelesen werden: Einige Werte fehlen eventuell. Lade die Seite gleich neu.",
  es: "No se ha podido leer parte de tus datos: pueden faltar algunas cifras. Recarga la página en un momento.",
  pt: "Não foi possível ler parte dos teus dados: podem faltar alguns números. Recarrega a página daqui a pouco.",
};

export async function chargerDonnees(sb: SupabaseClient, userId: string, lang: Lang, aujourdhui: string): Promise<DonneesFiche & { pannes: string[] }> {
  const [profil, seances, historique, vfc, sommeil, charge, base, obj, plan] = await Promise.all([
    sb.from("profiles").select("resting_hr, garmin_vo2max, pace_curve").eq("id", userId).maybeSingle(),
    sb.from("workouts").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(40),
    sb.from("workouts").select("date, sport, distance_km").eq("user_id", userId).gte("date", decale(aujourdhui, -120)).order("date", { ascending: false }).limit(1000),
    sb.from("hrv_data").select("date, hrv_ms, physiological_state").eq("user_id", userId).order("date", { ascending: false }).limit(60),
    sb.from("sleep_data").select("date, sleep_score, total_sleep_min").eq("user_id", userId).order("date", { ascending: false }).limit(14),
    sb.from("workouts").select("date, tss, type, duration_seconds").eq("user_id", userId).gte("date", decale(aujourdhui, -365)).order("date", { ascending: false }).limit(1000),
    sb.from("performance_baselines").select("vma_kmh, tested_at").eq("user_id", userId).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "race_objective").maybeSingle(),
    sb.from("training_plans").select("start_date, created_at, race_date").eq("user_id", userId).eq("is_active", true).maybeSingle(),
  ]);
  const enPanne = [profil, seances, historique, vfc, sommeil, charge, base, obj, plan].filter((r) => r.error);
  for (const r of enPanne) console.error("[indicateurs] lecture impossible :", r.error?.message);
  const ws = (seances.data ?? []) as Workout[];
  const p = profil.data as { resting_hr?: number | null; garmin_vo2max?: number | null; pace_curve?: { best?: { m: number; sec: number }[] } | null } | null;
  const o = (obj.data?.data ?? null) as DonneesFiche["objectif"];
  return {
    lang, aujourdhui,
    seances: ws,
    historique: (historique.data ?? []) as Workout[],
    vfc: (vfc.data ?? []) as Pick<HRVData, "date" | "hrv_ms" | "physiological_state">[],
    sommeil: (sommeil.data ?? []) as DonneesFiche["sommeil"],
    charge: (charge.data ?? []) as SeanceCharge[],
    vma: vmaAffichee({ seances: ws, baseline: base.data as { vma_kmh?: number | null; tested_at?: string | null } | null, profil: p }),
    objectif: o && o.raceDate && o.distanceKm ? o : null,
    plan: (plan.data ?? null) as DonneesFiche["plan"],
    fcRepos: Number(p?.resting_hr) || null,
    pannes: enPanne.length ? [PANNE[lang]] : [],
  };
}
