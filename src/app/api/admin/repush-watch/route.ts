export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushIntervalsWorkout, buildWorkoutDescription, ensureRunThresholdPace } from "@/lib/watch/intervals";
import { getEffectiveVma } from "@/lib/ai/coachContext";
import { oneSessionPerDate } from "@/lib/coach/sessions";

const ADMIN_EMAIL = "cypriendumez@outlook.fr";

// POST /api/admin/repush-watch {user_id}
// → re-pousse sur la montre TOUTES les séances coach à venir DÉJÀ stockées (sans rien régénérer),
//   avec le code actuel : échauffement & retour au calme en FC Z1 (durées du profil), corps à l'allure.
//   Remplace chaque séance existante (même external_id rte-coach-<user>-<date>).
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id } = (await req.json()) as { user_id?: string };
  if (!user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 });

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Identifiants montre + durées d'échauffement / retour au calme du client.
  const { data: prof } = await admin.from("profiles").select("*").eq("id", user_id).single();
  const athleteId = (prof?.intervals_athlete_id as string | undefined) || process.env.INTERVALS_ICU_ATHLETE_ID;
  const apiKey = (prof?.intervals_api_key as string | undefined) || process.env.INTERVALS_ICU_API_KEY;
  if (!athleteId || !apiKey) return NextResponse.json({ error: "Aucune montre connectée pour ce client" }, { status: 400 });
  const warmMin = (prof?.warmup_min as number | null | undefined) ?? null;
  const coolMin = (prof?.cooldown_min as number | null | undefined) ?? null;

  // Séances coach à venir (≥ aujourd'hui), une par date (la plus récente) → même plan que le calendrier.
  const { data: rows } = await admin.from("notifications")
    .select("id, title, data, created_at")
    .eq("user_id", user_id).eq("type", "coach_session")
    .order("created_at", { ascending: false }).limit(200);
  const dateOf = (r: { data: unknown }) => String((r.data as { date?: string } | null)?.date ?? "").slice(0, 10);
  const future = (rows ?? []).filter((r) => dateOf(r) >= today);
  const sessions = oneSessionPerDate(future, dateOf);
  if (sessions.length === 0) return NextResponse.json({ ok: true, pushed: 0, total: 0 });

  // Objectif (nom de course) + VMA pour les allures.
  const { data: objRow } = await admin.from("notifications").select("data").eq("user_id", user_id).eq("type", "race_objective").maybeSingle();
  const objectiveRace = ((objRow?.data as { race?: string } | undefined)?.race) || null;
  const vma = await getEffectiveVma(admin, user_id);
  await ensureRunThresholdPace({ athleteId, apiKey, vmaKmh: vma }); // pour que Garmin transmette l'allure du corps

  const results = await Promise.all(sessions.map(async (r) => {
    const d = (r.data ?? {}) as { date?: string; sessionType?: string; subtitle?: string };
    const date = String(d.date ?? "").slice(0, 10);
    if (!date) return false;
    const built = buildWorkoutDescription(
      r.title || d.sessionType || "Séance", d.subtitle || "",
      `${d.sessionType || ""} ${r.title || ""}`, objectiveRace, vma, warmMin, coolMin,
    );
    if (!built) return false; // repos / renfo : pas de séance montre
    const res = await pushIntervalsWorkout({ athleteId, apiKey, userId: user_id, name: built.name, date, description: built.description, sport: built.sport });
    return res.ok;
  }));

  return NextResponse.json({ ok: true, pushed: results.filter(Boolean).length, total: sessions.length });
}
