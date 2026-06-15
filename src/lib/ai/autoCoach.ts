// ─────────────────────────────────────────────────────────────────────────────
//  COACH AUTONOME — « l'IA qui s'occupe du coach »
//  À chaque NOUVELLE séance synchronisée, on (re)calcule la prochaine séance à partir
//  du contexte complet de l'athlète (forme, charge, sommeil, objectif, périodisation)
//  et on la publie AUTOMATIQUEMENT sur son dashboard + sa montre. Aucun clic requis.
//  Déterministe (pas d'appel LLM) → fiable pour un cron.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAthleteContext } from "@/lib/ai/coachContext";
import { pushIntervalsWorkout, buildWorkoutDescription, ensureRunThresholdPace } from "@/lib/watch/intervals";

const BASE = "https://intervals.icu/api/v1";
const authHeader = (apiKey: string) => ({ Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64") });

type Admin = SupabaseClient;
type AutoResult = { processed: boolean; pushed?: boolean; session?: string; date?: string; reason?: string };

type ICUActivity = { id?: string | number; type?: string; start_date_local?: string; average_heartrate?: number; max_heartrate?: number };

export async function autoCoachForUser(
  admin: Admin,
  opts: { userId: string; athleteId?: string | null; apiKey?: string | null },
): Promise<AutoResult> {
  const athleteId = opts.athleteId || process.env.INTERVALS_ICU_ATHLETE_ID;
  const apiKey = opts.apiKey || process.env.INTERVALS_ICU_API_KEY;
  if (!athleteId || !apiKey) return { processed: false, reason: "no_creds" };
  const userId = opts.userId;

  // 1) Dernière course synchronisée chez l'athlète (10 derniers jours).
  const newest = new Date().toISOString().slice(0, 10);
  const oldest = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  const res = await fetch(`${BASE}/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`, { headers: authHeader(apiKey), signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!res || !res.ok) return { processed: false, reason: `intervals_${res?.status ?? "err"}` };
  const acts = (await res.json().catch(() => [])) as ICUActivity[];
  const runs = (Array.isArray(acts) ? acts : []).filter((a) => /run/i.test(String(a.type ?? "")));
  const latest = runs[0];
  if (!latest?.id) return { processed: false, reason: "no_recent_run" };
  const latestId = String(latest.id);

  // 2) Déjà traité ? (état stocké dans une notification dédiée)
  const { data: stateRow } = await admin.from("notifications").select("id,data").eq("user_id", userId).eq("type", "auto_coach_state").maybeSingle();
  if ((stateRow?.data as { lastActivityId?: string } | null)?.lastActivityId === latestId) {
    return { processed: false, reason: "up_to_date" };
  }

  // 3) Contexte complet → prochaine séance déterministe (squelette périodisé + fraîcheur réelle).
  const ctx = await buildAthleteContext(admin as unknown as Parameters<typeof buildAthleteContext>[0], userId).catch(() => null);
  if (!ctx) return { processed: false, reason: "ctx_failed" };
  const wp = ctx.weekPlan;

  // La dernière séance était-elle dure ? (FC élevée ou séance structurée) → on enchaîne facile.
  const fc = latest.max_heartrate ?? null;
  const lastHard = (!!latest.average_heartrate && !!fc && latest.average_heartrate >= fc * 0.92) || /workout|interval/i.test(String(latest.type ?? ""));

  let session: { type: string; title: string; subtitle: string; why: string; tags: string[] };
  if (!wp || wp.qBudget <= 0 || wp.eased || lastHard) {
    session = {
      type: "Récup", title: "Footing de récupération",
      subtitle: `40 min footing très facile en Z1-Z2${wp?.easyPace ? ` (~${wp.easyPace}/km)` : ""}`,
      why: lastHard ? "Ta dernière séance était intense : on récupère pour bien l'assimiler." : "On reste en facile aujourd'hui selon ta forme du moment.",
      tags: ["Récup", "Z1/Z2"],
    };
  } else {
    const q = wp.quality[0];
    const title = q.type === "VMA" ? "Séance VMA" : q.type === "Spécifique" ? "Allure spécifique objectif" : q.type === "Seuil" ? "Séance au seuil" : q.type;
    session = { type: q.type, title, subtitle: q.desc, why: "Prochaine séance de qualité de ton bloc, calée sur ta forme et ton objectif.", tags: [q.type, "Qualité"] };
  }

  // 4) Publication AUTOMATIQUE : dashboard client (notification) + montre (cible FC).
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await admin.from("notifications").insert({
    user_id: userId, type: "coach_session", title: session.title, body: session.subtitle,
    data: { from: "coach-auto", date: tomorrow, subtitle: session.subtitle, tags: session.tags, why: session.why },
  });
  let pushed = false;
  try {
    const { data: objRow } = await admin.from("notifications").select("data").eq("user_id", userId).eq("type", "race_objective").maybeSingle();
    const objectiveRace = ((objRow?.data as { race?: string } | undefined)?.race) || null;
    await ensureRunThresholdPace({ athleteId, apiKey, vmaKmh: ctx.vma }); // pour que Garmin transmette l'allure
    const built = buildWorkoutDescription(session.title, session.subtitle, `${session.title} ${session.tags.join(" ")}`, objectiveRace, ctx.vma);
    if (built) {
      const r = await pushIntervalsWorkout({ athleteId, apiKey, userId, name: built.name, date: tomorrow, description: built.description });
      pushed = r.ok;
    }
  } catch { /* best effort */ }

  // 5) Mémorise l'état (évite de re-traiter la même séance).
  const stateData = { lastActivityId: latestId, lastRunDate: latest.start_date_local?.slice(0, 10) ?? null, at: new Date().toISOString() };
  if (stateRow?.id) await admin.from("notifications").update({ data: stateData }).eq("id", stateRow.id);
  else await admin.from("notifications").insert({ user_id: userId, type: "auto_coach_state", title: "auto-coach", body: "", data: stateData });

  return { processed: true, pushed, session: session.title, date: tomorrow };
}
