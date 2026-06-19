export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushIntervalsWorkout, buildWorkoutDescription, ensureRunThresholdPace } from "@/lib/watch/intervals";
import { getEffectiveVma } from "@/lib/ai/coachContext";

const ADMIN_EMAIL = "cypriendumez@outlook.fr";

type SessionIn = { date: string; type?: string; title?: string; detail?: string; why?: string; feel?: string; tags?: string[] };

// POST /api/admin/publish-plan {user_id, sessions:[{date,type,title,detail,why,feel,tags}]}
// → publie le plan de la semaine dans le calendrier du client (notifications type=coach_session datées).
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id, sessions } = await req.json() as { user_id: string; sessions: SessionIn[] };
  if (!user_id || !Array.isArray(sessions) || sessions.length === 0) return NextResponse.json({ error: "user_id et sessions requis" }, { status: 400 });

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Remplace le plan à venir : on efface les séances coach datées d'aujourd'hui ou plus tard, puis on réinsère.
  try {
    await admin.from("notifications").delete().eq("user_id", user_id).eq("type", "coach_session").gte("data->>date", today);
  } catch { /* filtre jsonb optionnel — le calendrier dédoublonne par date au pire */ }

  const rows = sessions
    .filter((s) => s.date)
    .map((s) => ({
      user_id,
      type: "coach_session",
      title: String(s.title || s.type || "Séance").slice(0, 80),
      body: String(s.detail || "").slice(0, 200),
      data: {
        from: "coach",
        date: String(s.date).slice(0, 10),
        sessionType: String(s.type || "").slice(0, 24),
        subtitle: String(s.detail || "").slice(0, 400),
        why: String(s.why || "").slice(0, 500),
        feel: String(s.feel || "").slice(0, 250),
        tags: Array.isArray(s.tags) ? s.tags.slice(0, 4).map((t) => String(t).slice(0, 16)) : [],
      },
    }));

  if (rows.length === 0) return NextResponse.json({ error: "Aucune séance valide" }, { status: 400 });
  const { error } = await admin.from("notifications").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Pousse aussi chaque séance (hors repos/renfo) sur la montre Garmin du client ──
  let watchSent = 0;
  try {
    const { data: prof } = await admin.from("profiles").select("*").eq("id", user_id).single();
    const athleteId = (prof?.intervals_athlete_id as string | undefined) || process.env.INTERVALS_ICU_ATHLETE_ID;
    const apiKey = (prof?.intervals_api_key as string | undefined) || process.env.INTERVALS_ICU_API_KEY;
    const warmMin = (prof?.warmup_min as number | null | undefined) ?? null;
    const coolMin = (prof?.cooldown_min as number | null | undefined) ?? null;
    if (athleteId && apiKey) {
      // Objectif du client → toutes les séances de la semaine s'appellent « Prépa <objectif> » sur la montre.
      const { data: objRow } = await admin.from("notifications").select("data").eq("user_id", user_id).eq("type", "race_objective").maybeSingle();
      const objectiveRace = ((objRow?.data as { race?: string } | undefined)?.race) || null;
      const vma = await getEffectiveVma(admin, user_id);
      await ensureRunThresholdPace({ athleteId, apiKey, vmaKmh: vma }); // pour que Garmin transmette l'allure
      const results = await Promise.all(sessions.filter((s) => s.date).map((s) => {
        const built = buildWorkoutDescription(String(s.title || s.type || "Séance"), String(s.detail || ""), String(s.type || ""), objectiveRace, vma, warmMin, coolMin);
        if (!built) return Promise.resolve(false);
        return pushIntervalsWorkout({ athleteId, apiKey, userId: user_id, name: built.name, date: String(s.date).slice(0, 10), description: built.description }).then((r) => r.ok);
      }));
      watchSent = results.filter(Boolean).length;
    }
  } catch { /* best effort : la publication réussit même si l'envoi montre échoue */ }

  return NextResponse.json({ ok: true, count: rows.length, watchSent });
}
