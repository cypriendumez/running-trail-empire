import type { SupabaseClient } from "@supabase/supabase-js";
import { autoCoachForUser } from "@/lib/ai/autoCoach";

// ─────────────────────────────────────────────────────────────────────────────
//  OBJECTIF DE COURSE — source unique `race_objective` (lue par tous les générateurs
//  de séances + le nom de séance montre). Centralisé ici pour que TOUTE écriture
//  (carte Objectif du dashboard ET « M'entraîner pour cette course ») reste cohérente
//  et déclenche la même re-synchronisation des séances auto.
// ─────────────────────────────────────────────────────────────────────────────

export type ObjectiveInput = {
  /** Heure de départ « HH:MM », saisie par l'athlète. `null` s'il ne l'a pas donnée. */
  heureDepart?: string | null; race: string; distanceKm: number; raceDate: string; targetSeconds: number };
export type ObjectiveData = ObjectiveInput & { targetTime: string; targetPace: string; ts: string };

export const fmtObjectiveTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h ? `${h}h${String(m).padStart(2, "0")}${sec ? `'${String(sec).padStart(2, "0")}` : ""}` : `${m}'${String(sec).padStart(2, "0")}`;
};
export const fmtObjectivePace = (secPerKm: number) => `${Math.floor(secPerKm / 60)}'${String(Math.round(secPerKm % 60)).padStart(2, "0")}/km`;

// Temps cible prédit depuis la VMA quand l'utilisateur n'en fixe pas (ex. « M'entraîner
// pour cette course »). % de VMA soutenable selon la distance (repères physiologiques
// classiques, alignés sur le Ghost Runner). Renvoie des secondes.
export function predictTargetSeconds(distanceKm: number, vmaKmh: number): number {
  const pct = distanceKm <= 1.5 ? 1.0 : distanceKm <= 3 ? 0.97 : distanceKm <= 6 ? 0.93
    : distanceKm <= 12 ? 0.90 : distanceKm <= 25 ? 0.85 : distanceKm <= 45 ? 0.80 : 0.74;
  const speedKmh = Math.max(4, vmaKmh * pct);
  return Math.round((distanceKm / speedKmh) * 3600);
}

// Enregistre / met à jour l'objectif de course ET re-synchronise les séances :
//   1) upsert de la notification `race_objective` (un seul objectif actif par client),
//   2) purge des séances AUTO à venir (from:"coach-auto") — préserve l'historique et
//      les séances assignées par un vrai coach (from:"coach"),
//   3) déblocage du coach auto (`auto_coach_state`),
//   4) régénération immédiate (best-effort) → re-push montre qui remplace l'ancienne.
export async function setRaceObjective(admin: SupabaseClient, userId: string, input: ObjectiveInput): Promise<ObjectiveData> {
  const data: ObjectiveData = {
    race: input.race, distanceKm: input.distanceKm, raceDate: input.raceDate, targetSeconds: input.targetSeconds,
    targetTime: fmtObjectiveTime(input.targetSeconds),
    targetPace: fmtObjectivePace(input.targetSeconds / input.distanceKm),
    // Heure de départ : SAISIE PAR L'ATHLÈTE, jamais importée. Les deux agrégateurs qui
    // alimentent le catalogue ne la publient pas (vérifié à la source) ; elle vit donc
    // ici, dans le JSON de l'objectif, et reste absente tant qu'il ne l'a pas donnée.
    heureDepart: input.heureDepart ?? null,
    ts: new Date().toISOString(),
  };

  const { data: existing } = await admin.from("notifications")
    .select("id").eq("user_id", userId).eq("type", "race_objective").maybeSingle();
  const row = { title: "Objectif de course", body: `${data.race} · ${data.targetTime}`, read: true, data };
  if (existing?.id) await admin.from("notifications").update(row).eq("id", existing.id);
  else await admin.from("notifications").insert({ user_id: userId, type: "race_objective", ...row });

  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: autoSessions } = await admin.from("notifications")
      .select("id, data").eq("user_id", userId).eq("type", "coach_session");
    const staleIds = (autoSessions ?? [])
      .filter((r) => { const dd = (r.data ?? {}) as { from?: string; date?: string }; return dd.from === "coach-auto" && String(dd.date ?? "") >= today; })
      .map((r) => r.id);
    if (staleIds.length) await admin.from("notifications").delete().in("id", staleIds);
    await admin.from("notifications").delete().eq("user_id", userId).eq("type", "auto_coach_state");
    const { data: creds } = await admin.from("profiles").select("intervals_athlete_id, intervals_api_key").eq("id", userId).single();
    if (creds?.intervals_athlete_id && creds?.intervals_api_key) {
      await autoCoachForUser(admin, { userId, athleteId: String(creds.intervals_athlete_id), apiKey: String(creds.intervals_api_key) });
    }
  } catch { /* best-effort : l'objectif reste enregistré quoi qu'il arrive */ }

  return data;
}
