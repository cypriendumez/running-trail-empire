/**
 * LES COURSES PROPOSÉES À L'ÉCRAN NUTRITION — et la durée de chacune.
 *
 * ⚠️ LA DURÉE EST CELLE DU COACH, PAS UNE SAISIE. Le plan d'alimentation se calcule sur
 * la durée d'effort (10 km en 38 min : rien à manger ; un marathon en 3 h : sept gels),
 * et le coach la PRÉDIT depuis la VMA effective (`predictRaceSec(vma, distance)`, voir
 * `lib/ai/coachContext`). L'écran reprend exactement ce calcul : si l'athlète lisait
 * « 5 gels » dans Santé et « 7 gels » dans le conseil du coach, l'un des deux mentirait.
 *
 * Sans VMA, le temps VISÉ que l'athlète a déclaré avec son objectif prend le relais (c'est
 * lui qui l'a écrit, ce n'est pas une supposition). Sans l'un ni l'autre : `null`, et
 * l'écran demande la durée au lieu de l'inventer.
 *
 * Les courses viennent de `coursesAVenir` — la source unique qui réunit l'objectif
 * déclaré et le calendrier (elles se contredisaient, cf. `lib/coach/prochaineCourse`).
 */
import { coursesAVenir } from "@/lib/coach/prochaineCourse";
import { predictRaceSec } from "@/lib/running/fitness";

export type CourseNutri = {
  nom: string;
  /** AAAA-MM-JJ. */
  date: string;
  distanceKm: number | null;
  /** Durée d'effort retenue, en secondes — `null` quand rien ne permet de l'estimer. */
  dureeSec: number | null;
  /** D'où vient la durée : prédite depuis la VMA, ou temps visé déclaré. */
  origine: "vma" | "cible" | null;
};

type Objectif = { race?: unknown; raceDate?: unknown; distanceKm?: unknown; targetSeconds?: unknown } | null | undefined;
type Planifiee = { name?: unknown; date?: unknown; distanceKm?: unknown } | null | undefined;

/** Au plus trois : au-delà, la liste repousse le plan sous la ligne de flottaison. */
export const COURSES_MAX = 3;

export function coursesPourNutrition(
  objectif: Objectif,
  planifiees: readonly Planifiee[],
  aujourdhui: string,
  vma: number | null,
): CourseNutri[] {
  const cible = Number(objectif?.targetSeconds);
  return coursesAVenir(objectif, planifiees, aujourdhui).slice(0, COURSES_MAX).map((c) => {
    const km = c.distanceKm != null && c.distanceKm > 0 ? c.distanceKm : null;
    const base = { nom: c.nom, date: c.date, distanceKm: km };
    // `predictRaceSec` rend 0 quand il ne peut rien dire (VMA ou distance absente).
    const predite = vma != null && km != null ? predictRaceSec(vma, km) : 0;
    if (predite > 0) return { ...base, dureeSec: Math.round(predite), origine: "vma" as const };
    // Le temps visé n'appartient qu'à l'OBJECTIF : une course du calendrier n'en a pas.
    if (c.source === "objectif" && Number.isFinite(cible) && cible > 0) {
      return { ...base, dureeSec: Math.round(cible), origine: "cible" as const };
    }
    return { ...base, dureeSec: null, origine: null };
  });
}
