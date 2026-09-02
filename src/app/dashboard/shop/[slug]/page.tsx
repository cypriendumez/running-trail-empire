export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FicheModele } from "@/components/shop/FicheModele";
import { parSlug, alternatives } from "@/lib/shop/catalogue";
import { texteShop } from "@/components/shop/shopI18n";
import { langueDuCompte } from "@/lib/shop/langue";
import { decrire } from "@/lib/shop/description";
import { evaluer } from "@/lib/shop/pourToi";
import { construireProfil } from "@/lib/shop/profilAthlete";
import { offresPour, meilleure, type Offre } from "@/lib/shop/offres";
import { effectiveVma, bestVmaFromWorkouts } from "@/lib/running/fitness";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = parSlug(slug);
  return { title: m ? `${m.marque} ${m.nom}` : "Modèle" };
}


export default async function ModelePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = parSlug(slug);
  if (!m) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [seancesRes, pairesRes, objRes, profilRes, baseRes] = await Promise.all([
    supabase.from("workouts").select("date,distance_km,sport,elevation_gain_m,duration_seconds")
      .eq("user_id", user.id).order("date", { ascending: false }).limit(200),
    supabase.from("shoes").select("brand,model,current_km,max_km,drop_mm,terrain").eq("user_id", user.id).eq("is_active", true),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    supabase.from("profiles").select("pace_curve,garmin_vo2max,preferred_language").eq("id", user.id).single(),
    supabase.from("performance_baselines").select("vma_kmh").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const seances = seancesRes.data ?? [];
  const lang = langueDuCompte(profilRes.data?.preferred_language);
  const { vma } = effectiveVma({
    vmaStored: baseRes.data?.vma_kmh ?? null,
    paceCurveBest: (profilRes.data?.pace_curve as { best?: { m: number; sec: number }[] } | null)?.best ?? null,
    garminVo2: profilRes.data?.garmin_vo2max ?? null,
    fromRuns: bestVmaFromWorkouts(seances as { distance_km?: number | null; duration_seconds?: number | null }[]),
  });
  const profil = construireProfil({
    seances, paires: pairesRes.data ?? [],
    objectif: (objRes.data?.data ?? null) as { distanceKm?: number; raceDate?: string } | null, vma,
  });

  // La langue du compte : la fiche est rendue côté serveur, sans provider React.
  const tx = (k: string, p?: Record<string, string | number>) => texteShop(lang, k, p);
  const avis = evaluer(m, profil);
  const { bouts, manquantes } = decrire(m);
  const proches = alternatives(m);
  const nc = tx("shop.non_communique");

  // ⚠️ UNE LECTURE EN ÉCHEC N'EST PAS « AUCUNE OFFRE ». On distingue les deux : dire
  // « aucune offre » alors que la requête a échoué serait une affirmation fausse.
  let offres: Offre[] = [], offresLisibles = true;
  try { offres = await offresPour(supabase, m.ean); } catch { offresLisibles = false; }
  const best = meilleure(offres);

  return (
    <FicheModele m={m} avis={avis} bouts={bouts} manquantes={manquantes} proches={proches}
      offres={offres} offresLisibles={offresLisibles} best={best} tx={tx} langue={lang} />
  );
}
