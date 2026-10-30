import type { SupabaseClient } from "@supabase/supabase-js";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

// ─────────────────────────────────────────────────────────────────────────────
//  OBJECTIF DE COURSE — source unique `race_objective` (lue par tous les générateurs
//  de séances + le nom de séance montre). Centralisé ici pour que TOUTE écriture
//  (carte Objectif du dashboard ET « M'entraîner pour cette course ») reste cohérente
//  et déclenche la même re-synchronisation des séances auto.
// ─────────────────────────────────────────────────────────────────────────────

export type ObjectiveInput = {
  /** Heure de départ « HH:MM », saisie par l'athlète. `null` s'il ne l'a pas donnée. */
  heureDepart?: string | null; race: string; distanceKm: number; raceDate: string; targetSeconds: number;
  /** `false` : défi personnel, pas une course officielle (`lib/coach/prochaineCourse`). */
  officielle?: boolean };
/** Une course passée, gardée quand un nouvel objectif la remplace. */
export type CoursePrecedente = { race: string; raceDate: string; distanceKm: number; officielle: boolean };
export type ObjectiveData = ObjectiveInput & { targetTime: string; targetPace: string; ts: string; precedente?: CoursePrecedente | null;
  /** Jour (AAAA-MM-JJ) où la préparation de CET objectif a commencé : l'anneau
   *  « préparation » du tableau de bord part de là (`avancementObjectif`). */
  depuis?: string };

/**
 * LE JOUR OÙ LA PRÉPARATION A COMMENCÉ.
 *
 * L'anneau « 56 % PRÉPARATION » supposait 16 semaines de préparation faute de date
 * (Cyprien, 30/10/2026 : sub 16 fixé le jour même, déjà « à 56 % »). Corriger le chrono ou
 * le nom d'un objectif ne remet pas sa préparation à zéro : la date de départ ne change
 * qu'avec la course elle-même (sa date). Un objectif enregistré avant ce champ part de sa
 * date d'enregistrement.
 */
export function debutPreparation(
  ancien: { raceDate?: unknown; depuis?: unknown; ts?: unknown } | null | undefined,
  raceDate: string,
  aujourdhui: string,
): string {
  if (!ancien || String(ancien.raceDate ?? "") !== raceDate) return aujourdhui;
  const connu = String(ancien.depuis ?? ancien.ts ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(connu) && connu <= aujourdhui ? connu : aujourdhui;
}

/**
 * LA COURSE QU'UN NOUVEL OBJECTIF REMPLACE N'EST PAS OUBLIÉE.
 *
 * `race_objective` est une ligne unique, écrasée à chaque enregistrement. Cas réel (Cyprien,
 * 30/10/2026) : cinq jours après le marathon de Lille, il fixe son prochain objectif, un sub
 * 16 min sur 5 km. Sans cette mémoire, la récupération d'après-marathon (`lib/coach/
 * apresCourse`) disparaissait avec la ligne — le coach remettait de l'intensité à J+6 — et
 * l'e-mail « tes résultats sont en ligne », attendu entre J+2 et J+10, ne partait jamais.
 *
 * L'ancien objectif devient la course précédente s'il est PASSÉ ; s'il est encore à venir
 * (on corrige simplement son objectif), la course précédente qu'il portait est conservée.
 * Ses lecteurs ont leur propre fenêtre (4 semaines au plus) : une vieille course s'ignore seule.
 */
export function coursePrecedente(
  ancien: { race?: unknown; raceDate?: unknown; distanceKm?: unknown; officielle?: unknown; precedente?: CoursePrecedente | null } | null | undefined,
  aujourdhui: string,
): CoursePrecedente | null {
  if (!ancien) return null;
  const date = String(ancien.raceDate ?? "").slice(0, 10);
  const km = Number(ancien.distanceKm);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date < aujourdhui && String(ancien.race ?? "").trim() && km > 0) {
    return { race: String(ancien.race).trim(), raceDate: date, distanceKm: km, officielle: ancien.officielle !== false };
  }
  return ancien.precedente ?? null;
}

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
  const today = aujourdhui(FUSEAU_DEFAUT);
  const data: ObjectiveData = {
    race: input.race, distanceKm: input.distanceKm, raceDate: input.raceDate, targetSeconds: input.targetSeconds,
    targetTime: fmtObjectiveTime(input.targetSeconds),
    targetPace: fmtObjectivePace(input.targetSeconds / input.distanceKm),
    // Heure de départ : SAISIE PAR L'ATHLÈTE, jamais importée. Les deux agrégateurs qui
    // alimentent le catalogue ne la publient pas (vérifié à la source) ; elle vit donc
    // ici, dans le JSON de l'objectif, et reste absente tant qu'il ne l'a pas donnée.
    heureDepart: input.heureDepart ?? null,
    // Écrit dans les deux cas : un champ explicite se lit sans deviner. Les objectifs
    // enregistrés avant l'option n'en ont pas, et restent officiels (`estOfficielle`).
    officielle: input.officielle !== false,
    ts: new Date().toISOString(),
  };

  /**
   * ⚠️ L'ÉCHEC DE CETTE LECTURE EST PIRE QUE LA PERTE DE L'OBJECTIF.
   *
   * Son erreur n'était pas lue. En échec, `existing` reste indéfini — ce que la suite
   * interprétait comme « cet athlète n'a pas encore d'objectif » — et on INSÉRAIT une
   * seconde ligne `race_objective`. Or tout le reste de l'application lit cet objectif
   * par `maybeSingle()`, qui ÉCHOUE dès qu'il y a deux lignes : l'objectif ne devenait
   * pas seulement faux, il devenait définitivement illisible, et le seul moyen d'en
   * sortir aurait été une intervention en base.
   */
  const { data: existing, error: eLecture } = await admin.from("notifications")
    .select("id, data").eq("user_id", userId).eq("type", "race_objective").maybeSingle();
  if (eLecture) throw new Error(`objectif illisible : ${eLecture.message}`);
  data.precedente = coursePrecedente(existing?.data as Parameters<typeof coursePrecedente>[0], today);
  data.depuis = debutPreparation(existing?.data as Parameters<typeof debutPreparation>[0], input.raceDate, today);

  const row = { title: "Objectif de course", body: `${data.race} · ${data.targetTime}`, read: true, data };
  // Et l'écriture elle-même : sans ce contrôle, la fonction rendait l'objectif à
  // l'appelant, qui l'affichait comme enregistré, alors que rien n'avait été écrit.
  // C'est exactement la plainte « le coach ignore ma course » — sauf qu'ici elle
  // aurait été fondée.
  const { error: eEcriture } = existing?.id
    ? await admin.from("notifications").update(row).eq("id", existing.id)
    : await admin.from("notifications").insert({ user_id: userId, type: "race_objective", ...row });
  if (eEcriture) throw new Error(`objectif non enregistré : ${eEcriture.message}`);

  try {
    const { data: autoSessions } = await admin.from("notifications")
      .select("id, data").eq("user_id", userId).eq("type", "coach_session");
    const staleIds = (autoSessions ?? [])
      .filter((r) => { const dd = (r.data ?? {}) as { from?: string; date?: string }; return dd.from === "coach-auto" && String(dd.date ?? "") >= today; })
      .map((r) => r.id);
    // ⚠️ VOLONTAIREMENT « AU MIEUX », MAIS PLUS MUET. L'intention du `catch` ci-dessous
    // est juste : l'objectif est déjà enregistré, une replanification ratée ne doit pas
    // l'effacer. Sauf qu'un client Supabase RETOURNE ses erreurs au lieu de les lever —
    // le `catch` ne voyait donc rien. Or si `auto_coach_state` n'est pas purgé, le coach
    // reste bloqué et le calendrier ne bouge pas : l'athlète fixe un marathon et ne voit
    // rien changer. C'est exactement la plainte « le coach ignore ma course », et sans
    // trace elle est indiagnosticable. On continue, mais on écrit.
    if (staleIds.length) {
      const { error } = await admin.from("notifications").delete().in("id", staleIds);
      if (error) console.error("[objectif] séances auto non purgées :", error.message);
    }
    const { error: eEtat } = await admin.from("notifications")
      .delete().eq("user_id", userId).eq("type", "auto_coach_state");
    if (eEtat) console.error("[objectif] coach auto non débloqué, le plan ne sera pas régénéré :", eEtat.message);
    const { data: creds } = await admin.from("profiles").select("intervals_athlete_id, intervals_api_key").eq("id", userId).single();
    if (creds?.intervals_athlete_id && creds?.intervals_api_key) {
      await autoCoachForUser(admin, { userId, athleteId: String(creds.intervals_athlete_id), apiKey: String(creds.intervals_api_key) });
    }
  } catch { /* best-effort : l'objectif reste enregistré quoi qu'il arrive */ }

  return data;
}
