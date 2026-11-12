import { redirect } from "next/navigation";
import { fcMaxDeLAthlete } from "@/lib/coach/fcMaxServeur";
import { createClient } from "@/lib/supabase/server";
import { effectiveVma } from "@/lib/running/fitness";
import { robustWeeklyKm } from "@/lib/running/volume";
import { niveauDeVma } from "@/lib/plans/catalogue";
import { PlansView } from "./PlansView";
import { effortDesSeances } from "@/lib/dashboard/vmaAffichee";
import { signalerLectures } from "@/lib/dashboard/lecturesServeur";
import { BandeauPanne } from "@/components/dashboard/BandeauPanne";
import { getPublicLang } from "@/lib/i18n/serverLang";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans d'entraînement" };

/**
 * PLANS TOUT CONSTRUITS — page serveur.
 *
 * Elle ne fait qu'une chose : établir les DEUX chiffres qui personnalisent les plans —
 * le niveau (depuis la VMA) et le volume hebdomadaire réel. Tout le reste est calculé
 * dans `lib/plans/catalogue`, qui n'a besoin d'aucune base.
 *
 * ⚠️ AUCUN CHIFFRE INVENTÉ. Le volume vient de `robustWeeklyKm` (la MÉDIANE des semaines
 * réellement courues — pas la moyenne, qu'une coupure écrase), et la VMA de
 * `effectiveVma`, la même fonction que le coach et le tableau de bord. Un plan servi sur
 * un volume deviné serait pire que pas de plan du tout.
 */
export default async function PlansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profRes, baseRes, woRes, fcMaxVma] = await Promise.all([
    supabase.from("profiles").select("garmin_vo2max, pace_curve").eq("id", user.id).maybeSingle(),
    supabase.from("performance_baselines").select("vma_kmh").eq("user_id", user.id)
      .order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("workouts").select("date, type, sport, distance_km, duration_seconds, avg_hr, max_hr, weather_temp_c")
      .eq("user_id", user.id).order("date", { ascending: false }).limit(120),
    // La FC max COMMUNE trie les efforts de la VMA (12/11/2026), comme partout.
    fcMaxDeLAthlete(supabase, user.id),
  ]);

  // Une panne n'est pas « aucune donnée » (12/11/2026) : le niveau et le volume affichés retomberaient en silence.
  const pannes = await signalerLectures("plans", user.id, [["seances", woRes], ["repere", baseRes], ["profil", profRes]]);
  const wks = (woRes.data ?? []) as { date: string; sport?: string | null; distance_km?: number | null; duration_seconds?: number | null; avg_hr?: number | null; max_hr?: number | null }[];
  const vma = effectiveVma({
    vmaStored: Number((baseRes.data as { vma_kmh?: number } | null)?.vma_kmh) || null,
    paceCurveBest: ((profRes.data as { pace_curve?: { best?: { m: number; sec: number }[] } | null } | null)?.pace_curve)?.best,
    garminVo2: Number((profRes.data as { garmin_vo2max?: number } | null)?.garmin_vo2max) || null,
    // LA lecture des efforts (`effortDesSeances`, 12/11/2026) : celle du coach et de chaque écran —
    // 60 séances, course seulement, FC max commune, acclimatation à la chaleur.
    fromRuns: effortDesSeances(wks, fcMaxVma)?.vma ?? null,
  }).vma;

  // `null` si l'historique ne permet pas de conclure : la vue le dit alors franchement,
  // au lieu d'afficher un volume de départ qui n'existe pas.
  const volume = robustWeeklyKm(wks)?.km ?? 0;

  // Une panne est DITE au coureur (12/11/2026) : son niveau et son volume seraient faux sans un mot.
  return (
    <>
      <BandeauPanne lectures={pannes} lang={await getPublicLang()} />
      <PlansView niveau={niveauDeVma(vma)} volumeKm={Math.round(volume)} />
    </>
  );
}
