/**
 * LA VMA AFFICHÉE ET SA SOURCE — un seul calcul pour le tableau de bord ET pour la page
 * détaillée « Vitesse & prédictions » (04/10/2026). Sorti de `app/dashboard/page.tsx` :
 * deux écrans qui recalculeraient chacun la VMA finiraient par diverger — c'est
 * exactement l'histoire de `effectiveVma` (quatre chaînes, quatre chiffres).
 */
import { meilleurEffort, effectiveVma, type MeilleurEffort } from "@/lib/running/fitness";

/** D'où vient la VMA affichée (dates au format AAAA-MM-JJ). */
export type SourceVma =
  | { type: "seances"; date: string | null; km: number | null }
  | { type: "test"; date: string | null }
  | { type: "courbe" }
  | { type: "vo2max" };

type SeanceVma = Parameters<typeof meilleurEffort>[0][number] & { max_hr?: number | null };

export function vmaAffichee(i: {
  /** Les séances lues par le tableau de bord (les 40 dernières). */
  seances: readonly SeanceVma[];
  baseline: { vma_kmh?: number | null; tested_at?: string | null } | null;
  profil: { garmin_vo2max?: number | null; pace_curve?: { best?: { m: number; sec: number }[] } | null } | null;
}): { vma: number; source: SourceVma | null; effort: MeilleurEffort | null } {
  const obsMaxHr = Math.max(0, ...i.seances.map((w) => Number(w.max_hr ?? 0)));
  const garminVo2 = Number(i.profil?.garmin_vo2max) || 0;
  // VMA : test → efforts réels (reflète l'allure de course) → dérivée de la VO2max Garmin (repli).
  // MÊME calcul que le coach — la même fonction, pas une chaîne parallèle. Celle-ci
  // ignorait purement et simplement la courbe d'allure : le tableau de bord annonçait
  // 18,7 km/h pendant que le plan était calé sur 17,3, pour le même athlète.
  const effort = meilleurEffort([...i.seances], obsMaxHr > 120 ? obsMaxHr : null);
  const calc = effectiveVma({
    vmaStored: Number(i.baseline?.vma_kmh) || null,
    paceCurveBest: i.profil?.pace_curve?.best,
    garminVo2: garminVo2 || null,
    fromRuns: effort?.vma ?? null,
  });
  // D'OÙ VIENT LE CHIFFRE — sans quoi « 19,8 km/h » ne disait pas s'il suivait la forme
  // ou datait de six mois. Il la suit (recalculé à chaque affichage) ; on le montre.
  const source: SourceVma | null = calc.source === "séances" && effort
    ? { type: "seances", date: effort.date, km: effort.distanceKm }
    : calc.source === "test"
      ? { type: "test", date: String(i.baseline?.tested_at ?? "").slice(0, 10) || null }
      : calc.source === "courbe" ? { type: "courbe" }
      : calc.source === "vo2max" ? { type: "vo2max" } : null;
  return { vma: calc.vma ?? 0, source, effort };
}
