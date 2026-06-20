export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushIntervalsWorkout, buildWorkoutDescription, ensureRunThresholdPace } from "@/lib/watch/intervals";
import { getEffectiveVma } from "@/lib/ai/coachContext";

const ADMIN_EMAIL = "cypriendumez@outlook.fr";

// POST /api/admin/assign-session — le coach pousse la « séance du jour » à un client.
// Stockée comme notification (type=coach_session) → lue par le dashboard du client.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id, title, subtitle, tags, why } = await req.json() as {
    user_id: string; title: string; subtitle?: string; tags?: string[]; why?: string;
  };
  if (!user_id || !title?.trim()) return NextResponse.json({ error: "user_id et title requis" }, { status: 400 });

  const today = new Date().toISOString().split("T")[0];
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id,
    type: "coach_session",
    title: title.trim(),
    body: subtitle ?? "",
    data: {
      from: "coach",
      date: today,
      subtitle: subtitle ?? "",
      tags: Array.isArray(tags) ? tags.slice(0, 4).map((t) => String(t).slice(0, 16)) : [],
      why: why ?? "",
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Pousse aussi la séance sur la montre Garmin du client (cible FC selon le type) ──
  let watchSent = false;
  try {
    const { data: prof } = await admin.from("profiles").select("*").eq("id", user_id).single();
    const athleteId = (prof?.intervals_athlete_id as string | undefined) || process.env.INTERVALS_ICU_ATHLETE_ID;
    const apiKey = (prof?.intervals_api_key as string | undefined) || process.env.INTERVALS_ICU_API_KEY;
    const warmMin = (prof?.warmup_min as number | null | undefined) ?? null;
    const coolMin = (prof?.cooldown_min as number | null | undefined) ?? null;
    if (athleteId && apiKey) {
      // Objectif du client (affiché sur son dashboard) → la séance s'appelle « Prépa <objectif> » sur la montre.
      const { data: objRow } = await admin.from("notifications").select("data").eq("user_id", user_id).eq("type", "race_objective").maybeSingle();
      const objectiveRace = ((objRow?.data as { race?: string } | undefined)?.race) || null;
      const vma = await getEffectiveVma(admin, user_id);
      await ensureRunThresholdPace({ athleteId, apiKey, vmaKmh: vma }); // pour que Garmin transmette l'allure
      const sessionType = `${title} ${(Array.isArray(tags) ? tags.join(" ") : "")}`;
      const built = buildWorkoutDescription(title, subtitle ?? "", sessionType, objectiveRace, vma, warmMin, coolMin);
      if (built) {
        const r = await pushIntervalsWorkout({ athleteId, apiKey, userId: user_id, name: built.name, date: today, description: built.description, sport: built.sport });
        watchSent = r.ok;
      }
    }
  } catch { /* best effort */ }

  return NextResponse.json({ ok: true, watchSent });
}
