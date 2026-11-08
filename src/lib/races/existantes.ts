// ─────────────────────────────────────────────────────────────────────────────
//  LES COURSES DÉJÀ AU CATALOGUE, TOUTES, POUR NE PAS LES RÉINSÉRER.
//
//  Audit du 08/11/2026 : les imports `races/seed` et `races/seed-full` lisaient l'existant
//  par un seul `select("name,date")`. PostgREST n'en rend que 1 000 sur ~17 000 : presque tout
//  le jeu repartait comme nouveau, en doublons. Et une lecture en échec (`existing || []`)
//  valait « catalogue vide ». Ici : par pages, dans un ordre TOTAL (`id`), et une page
//  illisible rend une erreur au lieu d'une liste raccourcie.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseExistante = { name: string; date: string };

export async function coursesExistantes(admin: SupabaseClient, pagesMax = 100): Promise<{ courses: CourseExistante[] } | { erreur: string }> {
  const courses: CourseExistante[] = [];
  for (let page = 0; page < pagesMax; page++) {
    const { data, error } = await admin.from("races").select("name,date").order("id").range(page * 1000, page * 1000 + 999);
    if (error) return { erreur: `${error.code ?? "?"} ${error.message}` };
    courses.push(...((data ?? []) as CourseExistante[]));
    if ((data ?? []).length < 1000) return { courses };
  }
  return { erreur: `plus de ${pagesMax * 1000} courses : lecture arrêtée` };
}
