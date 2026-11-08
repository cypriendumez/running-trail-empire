// ─────────────────────────────────────────────────────────────────────────────
//  LES DONNÉES DU BILAN DE LA SEMAINE — lues d'UNE seule façon.
//
//  Deux lecteurs : la carte du tableau de bord (route `ai/bilan`, à la demande) et l'e-mail
//  du lundi (`lib/notify/planSemaine`, Cyprien, 30/10/2026 : « bilan par e-mail chaque
//  lundi »). Deux lectures écrites séparément divergeraient, et l'athlète lirait deux
//  bilans différents de la même semaine selon l'endroit.
//
//  ⚠️ AUCUN MODÈLE ICI : des requêtes et des calculs (`faitsDuBilan`). Ce qui coûte — la
//  rédaction — reste dans la route, derrière le plafond du jour.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { faitsDuBilan, type FaitsBilan } from "@/lib/ai/bilanSemaine";
import { decaleJour } from "@/lib/streak/compute";
import { objectifEnCours } from "@/lib/coach/prochaineCourse";
import { vmaAffichee } from "@/lib/dashboard/vmaAffichee";
import { predictRaceSec } from "@/lib/running/fitness";
import { socleDesSeances } from "@/lib/dashboard/forme";
import { serieVfc, COLONNES_VFC } from "@/lib/health/vfc";

/** La ligne où le bilan rédigé est mémorisé (une par athlète, avec l'empreinte de ses faits). */
export const TYPE_BILAN = "ai_bilan";
const COLS = "date,type,sport,distance_km,duration_seconds,avg_hr,max_hr,elevation_gain_m,hr_zone_seconds,cardiac_decoupling,weather_temp_c";

/**
 * Les faits de la semaine de sept jours qui finit le jour civil `jour` (AAAA-MM-JJ).
 * `null` si les séances sont illisibles : pas de bilan plutôt qu'un bilan vide.
 */
export async function faitsDeLaSemaine(sb: SupabaseClient, userId: string, jour: string): Promise<FaitsBilan | null> {
  const [seancesRes, sommeilRes, vfcRes, objRes, etatRes, baseRes, profilRes] = await Promise.all([
    // Six mois : la tendance d'efficacité se lit sur des blocs de quatre semaines.
    sb.from("workouts").select(COLS).eq("user_id", userId).gte("date", decaleJour(jour, -182)).lte("date", jour).order("date", { ascending: false }),
    sb.from("sleep_data").select("date,sleep_score").eq("user_id", userId).gte("date", decaleJour(jour, -27)).lte("date", jour),
    sb.from("hrv_data").select(COLONNES_VFC).eq("user_id", userId).gte("date", decaleJour(jour, -34)).lte("date", jour),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "race_objective").maybeSingle(),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "auto_coach_state").maybeSingle(),
    sb.from("performance_baselines").select("vma_kmh,max_hr,tested_at").eq("user_id", userId).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("profiles").select("garmin_vo2max,pace_curve").eq("id", userId).maybeSingle(),
  ]);
  if (seancesRes.error) {
    console.error("[bilan] séances illisibles :", seancesRes.error.message);
    return null;
  }
  const seances = (seancesRes.data ?? []) as unknown as (Parameters<typeof faitsDuBilan>[0]["seances"][number] & { max_hr?: number | null; type?: string | null; weather_temp_c?: number | null })[];

  // La VMA et la prédiction : le MÊME calcul que la carte du tableau de bord (40 dernières séances).
  const { vma } = vmaAffichee({
    seances: seances.slice(0, 40) as Parameters<typeof vmaAffichee>[0]["seances"],
    baseline: baseRes.data as { vma_kmh?: number | null; tested_at?: string | null } | null,
    profil: profilRes.data as Parameters<typeof vmaAffichee>[0]["profil"],
  });
  type Course = { race?: string; raceDate?: string; distanceKm?: number };
  const objBrut = objRes.data?.data as (Course & { targetSeconds?: number; precedente?: Course | null }) | null;
  const objectif = objectifEnCours(objBrut as { race: string; raceDate: string; distanceKm: number; targetSeconds: number } | null, jour);
  const recup = (etatRes.data?.data as { recuperation?: { course?: string; reprise?: string } | null } | null)?.recuperation;
  const fcObservee = Math.max(0, ...seances.map((s) => Number(s.max_hr) || 0));
  const fcMax = Number((baseRes.data as { max_hr?: number | null } | null)?.max_hr) || (fcObservee > 120 ? fcObservee : null);

  return faitsDuBilan({
    aujourdhui: jour,
    seances,
    sommeil: (sommeilRes.data ?? []) as { date: string; sleep_score?: number | null }[],
    vfc: serieVfc((vfcRes.data ?? []) as { date: string; rmssd?: number | null; sdnn?: number | null }[]).lignes as { date: string; hrv_ms?: number | null }[],
    fcMax,
    objectif: objectif ? {
      nom: objectif.race, date: objectif.raceDate, distanceKm: objectif.distanceKm, viseSec: objectif.targetSeconds,
      predictionSec: vma > 0 ? predictRaceSec(vma, objectif.distanceKm, socleDesSeances(seances as Parameters<typeof socleDesSeances>[0], jour)) : null,
    } : null,
    recuperation: recup?.course && recup.reprise ? { course: recup.course, reprise: recup.reprise } : null,
    // L'objectif et la course qu'il a remplacée : celle COURUE cette semaine sera nommée.
    courses: [objBrut, objBrut?.precedente].filter((c): c is Course => !!c?.race && !!c.raceDate)
      .map((c) => ({ nom: String(c.race), date: String(c.raceDate), distanceKm: Number(c.distanceKm) || 0 })),
  });
}
