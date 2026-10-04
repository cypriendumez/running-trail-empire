/**
 * LE VOLUME PAR SEMAINE DE CALENDRIER — partagé par la carte « Volume » et sa page détaillée
 * (04/10/2026). Sorti de `BentoDashboard` pour que la page affiche les mêmes barres.
 */
import { isRun } from "@/lib/intervals/sport";
import { ageJours } from "./fenetre";

type SeanceKm = { date: string; sport?: string | null; distance_km?: number | null };

export function computeWeeklyTrend(workouts: readonly SeanceKm[], weeks = 6): { km: number; isCurrent: boolean }[] {
  return Array.from({ length: weeks }, (_, i) => {
    // i = 0 est la semaine la plus ANCIENNE ; la dernière est celle en cours.
    const recul = weeks - 1 - i;
    const km = workouts
      .filter((w) => {
        if (!isRun(w.sport)) return false;
        const age = ageJours(w.date);
        if (age == null || age < 0) return false;
        return Math.floor(age / 7) === recul;
      })
      .reduce((s, w) => s + (w.distance_km ?? 0), 0);
    return { km, isCurrent: i === weeks - 1 };
  });
}
