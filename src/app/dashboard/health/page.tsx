export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { HealthCenter } from "@/components/health/HealthCenter";
import { suiviParZone, actives, etatDe, type Signalement, type Douleur } from "@/lib/health/douleurs";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { estUnePanne } from "@/lib/dashboard/lectures";
import { effectiveVma, bestVmaFromWorkouts } from "@/lib/running/fitness";
import { coursesPourNutrition, type CourseNutri } from "@/lib/health/coursesNutrition";

export const metadata = { title: "Santé" };

/**
 * Le suivi des douleurs est lu ICI, côté serveur.
 *
 * ⚠️ IL EST LU PAR LE MÊME CALCUL QUE LE KINÉ IA (`suiviParZone`). Si l'athlète voyait
 * une évolution et le modèle une autre, l'un des deux mentirait — et rien à l'écran ne
 * dirait lequel. Une seule fonction, deux affichages.
 */
export default async function HealthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let suivi: ReturnType<typeof suiviParZone> = [];
  const etats: { cle: string; id: string; etat: string }[] = [];
  let enPanne = false;
  let fil: { role: "user" | "model"; text: string }[] = [];
  let coursesNutrition: CourseNutri[] = [];
  let poidsKg: number | null = null;
  if (user) {
    // La consultation en cours (mémoire du kiné, /api/ai/physio) et, pour la nutrition, les
    // courses à venir et de quoi PRÉDIRE leur durée — la même VMA effective que le coach
    // (`effectiveVma`, seule définition de l'app) : lus ensemble, en une vague.
    const [filRes, objRes, planRes, profilRes, baseRes, seancesRes] = await Promise.all([
      supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "kine_chat").limit(1).maybeSingle(),
      supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
      supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "planned_race").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("pace_curve,garmin_vo2max,weight_kg").eq("id", user.id).single(),
      supabase.from("performance_baselines").select("vma_kmh").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("workouts").select("distance_km,duration_seconds").eq("user_id", user.id).order("date", { ascending: false }).limit(200),
    ]);
    for (const [nom, r] of [["objectif", objRes], ["courses", planRes], ["profil", profilRes], ["séances", seancesRes]] as const) {
      if (r.error && estUnePanne(r)) console.error("[santé] lecture illisible :", nom, r.error.message);
    }
    const { vma } = effectiveVma({
      vmaStored: baseRes.data?.vma_kmh ?? null,
      paceCurveBest: (profilRes.data?.pace_curve as { best?: { m: number; sec: number }[] } | null)?.best ?? null,
      garminVo2: profilRes.data?.garmin_vo2max ?? null,
      fromRuns: bestVmaFromWorkouts((seancesRes.data ?? []) as { distance_km?: number | null; duration_seconds?: number | null }[]),
    });
    coursesNutrition = coursesPourNutrition(
      objRes.data?.data as Parameters<typeof coursesPourNutrition>[0],
      (planRes.data ?? []).map((r) => r.data as Parameters<typeof coursesPourNutrition>[1][number]),
      aujourdhui(FUSEAU_DEFAUT), vma,
    );
    const p = Number(profilRes.data?.weight_kg);
    poidsKg = Number.isFinite(p) && p > 0 ? p : null;
    const brut = (filRes.data?.data as { messages?: unknown } | null)?.messages;
    fil = (Array.isArray(brut) ? brut : [])
      .filter((m): m is { role: "user" | "model"; text: string } => !!m && typeof m === "object" && ((m as { role?: string }).role === "user" || (m as { role?: string }).role === "model") && typeof (m as { text?: unknown }).text === "string")
      .slice(-40);
    /**
     * ⚠️ « AUCUNE DOULEUR » N'EST PAS « ON N'A PAS PU LIRE ».
     *
     * Ces lignes sont les douleurs que l'athlète a DÉCLARÉES lui-même. Sans contrôle,
     * un échec de lecture rendait `[]` et l'écran affichait un historique vierge : de
     * quoi croire que l'application a oublié ce qu'on lui a dit, et tout re-saisir.
     * C'est aussi la mémoire dans laquelle puise le kiné IA.
     */
    const { data, error } = await supabase.from("notifications")
      .select("id,data,created_at").eq("user_id", user.id).eq("type", "pain_report")
      .gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString())
      .order("created_at", { ascending: false }).limit(120);
    const brutes = ((data ?? []) as { id: string; data: Douleur | null; created_at: string }[])
      .map((r) => ({ ...(r.data ?? {}), id: r.id, date: String(r.data?.date ?? r.created_at ?? "").slice(0, 10) }));
    // ⚠️ CE QUE L'ATHLÈTE A DÉCLARÉ PASSÉ NE REMONTE PLUS DANS LE SUIVI — sinon l'écran
    // continue d'afficher une douleur qu'il vient lui-même d'éteindre.
    const retenues = actives(brutes, aujourdhui(FUSEAU_DEFAUT), 60);
    const rows: Signalement[] = retenues.map((r) => ({
      zone: String(r.zone ?? ""),
      cle: r.slot ? String(r.slot) : null,
      level: Number(r.level),
      date: String(r.date ?? "").slice(0, 10),
    }));
    suivi = suiviParZone(rows, aujourdhui(FUSEAU_DEFAUT));
    // La déclaration la PLUS RÉCENTE de chaque zone : c'est elle qu'on met à jour quand
    // l'athlète dit « ça va mieux » ou « c'est passé ».
    const vues = new Set<string>();
    for (const r of retenues) {
      const cle = String(r.slot || r.zone || "");
      if (!cle || vues.has(cle) || !r.id) continue;
      vues.add(cle);
      etats.push({ cle, id: String(r.id), etat: etatDe(r) });
    }
    enPanne = estUnePanne({ error });
    if (enPanne) console.error("[santé] douleurs illisibles :", error?.message);
  }
  return <HealthCenter suivi={suivi} etats={etats} enPanne={enPanne} filInitial={fil} coursesNutrition={coursesNutrition} poidsKg={poidsKg} />;
}
