/**
 * LA VMA AFFICHÉE ET SA SOURCE — un seul calcul pour le tableau de bord ET pour la page
 * détaillée « Vitesse & prédictions » (04/10/2026). Sorti de `app/dashboard/page.tsx` :
 * deux écrans qui recalculeraient chacun la VMA finiraient par diverger — c'est
 * exactement l'histoire de `effectiveVma` (quatre chaînes, quatre chiffres).
 */
import { meilleurEffort, effectiveVma, type MeilleurEffort } from "@/lib/running/fitness";
import { fcMaxPourEfforts } from "@/lib/coach/fcCible";
import { isRun } from "@/lib/intervals/sport";
import { heatAcclimation } from "@/lib/weather/openMeteo";

/** D'où vient la VMA affichée (dates au format AAAA-MM-JJ). */
export type SourceVma =
  | { type: "seances"; date: string | null; km: number | null }
  | { type: "test"; date: string | null }
  | { type: "courbe" }
  | { type: "vo2max" };

type SeanceVma = Parameters<typeof meilleurEffort>[0][number] & { max_hr?: number | null; sport?: string | null };

/** La fenêtre de la VMA « séances », en JOURS : les courses des 120 derniers jours, AUCUN plafond en
 *  nombre (13/11/2026). C'est la fenêtre de forme de `meilleurEffort` (un record de mars ne pilote pas
 *  les séances d'août). Avant : les 60 dernières séances TOUS SPORTS — un coureur qui fait aussi du vélo
 *  n'y voyait que 7 semaines de courses, et sa VMA tombait de 17 à 14,2 km/h quand son 10 km sortait
 *  de la liste (tests/profils.crash, profil 5). Avant le 12/11/2026 : 40, 60, 120 ou 200 séances
 *  selon l'écran. */
export const JOURS_VMA = 120;
/** Garde-fou de la lecture (`lireSeancesVma`) : 500 séances en 120 jours, plus de 4 par jour. */
export const PLAFOND_SEANCES_VMA = 500;
/** Premier jour lu (« AAAA-MM-JJ ») : un jour de marge, la fenêtre exacte est appliquée par `effortDesSeances`. */
export function debutFenetreVma(maintenant = Date.now()): string {
  return new Date(maintenant - (JOURS_VMA + 1) * 86400000).toISOString().slice(0, 10);
}

/** Facteur d'acclimatation à la chaleur, déduit des séances elles-mêmes (jours ≥ 25 °C sur 30 jours),
 *  exactement comme le coach : un athlète acclimaté souffre moins, son chrono se corrige moins. */
export function acclimatationDesSeances(seances: readonly { date?: string | null; weather_temp_c?: unknown }[], maintenant = Date.now()): number {
  const jours = new Set((seances ?? [])
    .filter((w) => { const t = Number(w.weather_temp_c); return w.weather_temp_c != null && Number.isFinite(t) && t >= 25
      && maintenant - new Date(String(w.date ?? "")).getTime() <= 30 * 86400000; })
    .map((w) => String(w.date).slice(0, 10)));
  return heatAcclimation(jours.size).factor;
}

/**
 * LE MEILLEUR EFFORT DE L'ATHLÈTE — la SEULE lecture des séances qui fonde la VMA « séances », pour
 * le coach comme pour chaque écran (12/11/2026) : les séances des {@link JOURS_VMA} derniers jours,
 * sans plafond en nombre (13/11/2026), course à pied seulement, efforts triés par la FC max commune (`fcMaxPourEfforts`), relus dans leurs
 * conditions avec l'acclimatation à la chaleur. `seances` peut en porter plus (plus anciennes) : la
 * fenêtre est appliquée ici, quel que soit l'ordre.
 */
export function effortDesSeances(seances: readonly SeanceVma[], fcMax: number | null | undefined, maintenant = Date.now()): MeilleurEffort | null {
  const debut = debutFenetreVma(maintenant);
  const lues = (seances ?? []).filter((w) => String(w.date ?? "").slice(0, 10) >= debut);
  const courses = lues.filter((w) => isRun(w.sport));
  return meilleurEffort(courses, fcMaxPourEfforts(fcMax, courses), JOURS_VMA, acclimatationDesSeances(lues, maintenant), maintenant);
}

export function vmaAffichee(i: {
  /** Les séances lues (au moins les {@link JOURS_VMA} derniers jours, tous sports : `lireSeancesVma`). */
  seances: readonly SeanceVma[];
  baseline: { vma_kmh?: number | null; tested_at?: string | null } | null;
  profil: { garmin_vo2max?: number | null; pace_curve?: { best?: { m: number; sec: number }[] } | null } | null;
  /** La FC max COMMUNE (`fcMaxConnue` / `fcMaxDeLAthlete`) ; `undefined` = lecture en panne. */
  fcMax: number | null | undefined;
}): { vma: number; source: SourceVma | null; effort: MeilleurEffort | null } {
  const garminVo2 = Number(i.profil?.garmin_vo2max) || 0;
  // VMA : test → efforts réels (reflète l'allure de course) → dérivée de la VO2max Garmin (repli).
  // MÊME calcul que le coach — la même fonction, pas une chaîne parallèle. Celle-ci
  // ignorait purement et simplement la courbe d'allure : le tableau de bord annonçait
  // 18,7 km/h pendant que le plan était calé sur 17,3, pour le même athlète.
  // 12/11/2026 : les efforts sont triés avec la FC max COMMUNE, plus avec le pic > 120 des seules
  // séances lues (sans fenêtre de date ni FC déclarée).
  // ⚠️ COURSE À PIED SEULEMENT (directeur scientifique, 12/11/2026) : comme le coach. Une sortie vélo
  // de 40 km à 25 km/h donnait une « VMA » de ~25 km/h, que `effectiveVma` retenait (la plus haute).
  // Le tri par la FC les écartait par hasard ; sans FC max, plus rien ne les arrêtait.
  const effort = effortDesSeances(i.seances, i.fcMax);
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
