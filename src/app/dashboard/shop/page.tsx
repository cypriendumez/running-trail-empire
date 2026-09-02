export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GearHub } from "@/components/shop/GearHub";
import { CATALOGUE } from "@/lib/shop/catalogue";
import { construireProfil } from "@/lib/shop/profilAthlete";
import { effectiveVma, bestVmaFromWorkouts } from "@/lib/running/fitness";
import { texteShop } from "@/components/shop/shopI18n";
import { langueDuCompte } from "@/lib/shop/langue";

export const metadata = { title: "Comparateur" };

/**
 * LE COMPARATEUR D'ÉQUIPEMENT.
 *
 * ⚠️ CETTE PAGE A REMPLACÉ UN ÉCRAN D'ATTENTE, ET IL FAUT SAVOIR POURQUOI. La boutique
 * précédente affichait 1 167 références aux PRIX INVENTÉS attribuées à de vraies enseignes
 * (i-run, Alltricks, Décathlon…). Elle a été gelée sur un écran « bientôt disponible » —
 * la seule chose honnête à faire à ce moment-là.
 *
 * Ce qui change ici : la page n'affiche AUCUN prix marchand. Elle compare des
 * CARACTÉRISTIQUES relevées et sourcées, et les confronte à l'entraînement réel de
 * l'athlète. Le jour où un flux d'affiliation alimentera `product_offers`, les offres
 * apparaîtront sur les fiches — et elles seront vraies.
 */
export default async function ShopPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [seancesRes, pairesRes, objRes, profilRes, baseRes] = await Promise.all([
    supabase.from("workouts").select("date,distance_km,sport,elevation_gain_m,duration_seconds")
      .eq("user_id", user.id).order("date", { ascending: false }).limit(200),
    supabase.from("shoes").select("brand,model,current_km,max_km,drop_mm,terrain")
      .eq("user_id", user.id).eq("is_active", true),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    supabase.from("profiles").select("pace_curve,garmin_vo2max,preferred_language").eq("id", user.id).single(),
    supabase.from("performance_baselines").select("vma_kmh").eq("user_id", user.id)
      .order("tested_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const seances = seancesRes.data ?? [];
  const lang = langueDuCompte(profilRes.data?.preferred_language);
  const tx = (k: string, p?: Record<string, string | number>) => texteShop(lang, k, p);
  // La VMA passe par `effectiveVma` : c'est la SEULE définition de l'app, et elle nomme
  // sa source. Recalculer autrement ici ferait diverger la fiche du tableau de bord.
  const { vma } = effectiveVma({
    vmaStored: baseRes.data?.vma_kmh ?? null,
    paceCurveBest: (profilRes.data?.pace_curve as { best?: { m: number; sec: number }[] } | null)?.best ?? null,
    garminVo2: profilRes.data?.garmin_vo2max ?? null,
    fromRuns: bestVmaFromWorkouts(seances as { distance_km?: number | null; duration_seconds?: number | null }[]),
  });

  const obj = (objRes.data?.data ?? null) as { distanceKm?: number; raceDate?: string } | null;
  const profil = construireProfil({ seances, paires: pairesRes.data ?? [], objectif: obj, vma });

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">{tx("shop.titre")}</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-zinc-500">
          {tx("shop.sous_titre", { n: CATALOGUE.length })}
        </p>
      </header>
      <GearHub catalogue={CATALOGUE} profil={profil} />
    </div>
  );
}
