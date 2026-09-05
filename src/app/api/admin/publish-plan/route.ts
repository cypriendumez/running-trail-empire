export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushIntervalsWorkout, buildWorkoutDescription, ensureRunThresholdPace, litMontre } from "@/lib/watch/intervals";
import { getEffectiveVma } from "@/lib/ai/coachContext";
import { estAdmin } from "@/lib/admin/acces";
import { identifiantsDe } from "@/lib/intervals/identifiants";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";


type SessionIn = { date: string; type?: string; title?: string; detail?: string; why?: string; feel?: string; tags?: string[] };

// POST /api/admin/publish-plan {user_id, sessions:[{date,type,title,detail,why,feel,tags}], auto?}
// → publie le plan de la semaine dans le calendrier du client (notifications type=coach_session datées).
//
// `auto: true` = publication automatique déclenchée par l'ouverture d'une séance côté coach :
//   • au plus UNE publication par jour et par athlète (sinon chaque visite réécrirait son plan) ;
//   • AUCUN envoi sur la montre — le push Garmin reste une action explicite du coach.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !estAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id, sessions, auto } = await req.json() as { user_id: string; sessions: SessionIn[]; auto?: boolean };
  if (!user_id || !Array.isArray(sessions) || sessions.length === 0) return NextResponse.json({ error: "user_id et sessions requis" }, { status: 400 });

  const admin = createAdminClient();
  const today = aujourdhui(FUSEAU_DEFAUT);

  // Garde-fou anti-réécriture : si un plan a déjà été publié aujourd'hui (auto ou manuel),
  // la publication automatique ne fait rien. Le bouton du coach, lui, force toujours.
  // Le « jour » est celui d'UTC (created_at est un timestamptz) : la remise à zéro tombe donc
  // vers 2 h du matin en France l'été — sans conséquence pratique pour un usage de journée.
  if (auto) {
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id).eq("type", "coach_session")
      .gte("created_at", `${today}T00:00:00Z`);
    if ((count ?? 0) > 0) return NextResponse.json({ ok: true, skipped: true, count: 0, watchSent: 0 });
  }

  // Remplace le plan à venir : on efface les séances coach datées d'aujourd'hui ou plus tard, puis on réinsère.
  // ⚠️ ON GARDE LE « AU MIEUX », mais plus le silence. Le `catch` ne voyait rien : un
  // client Supabase RETOURNE ses erreurs. Contrairement au coach automatique — qui
  // repasse toutes les dix minutes, et où l'on peut donc abandonner sans rien perdre —
  // c'est ici un geste MANUEL : refuser bloquerait la publication. On publie donc, et
  // on écrit ce qui n'a pas pu être purgé.
  const { error: ePurge } = await admin.from("notifications").delete()
    .eq("user_id", user_id).eq("type", "coach_session").gte("data->>date", today);
  if (ePurge) console.error("[publish-plan] plan à venir non purgé, doublons possibles sur la montre :", ePurge.message);

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
  // Jamais en mode auto : envoyer sur la montre d'un athlète est une action visible chez lui,
  // elle reste déclenchée à la main par le coach.
  let watchSent = 0;
  if (auto) return NextResponse.json({ ok: true, auto: true, count: rows.length, watchSent: 0 });
  try {
    const { data: prof } = await admin.from("profiles").select("*").eq("id", user_id).single();
    // ⚠️ AUCUN REPLI SUR LES VARIABLES D'ENVIRONNEMENT — voir `lib/intervals/identifiants`.
    // Le `|| process.env.INTERVALS_ICU_*` qui était ici donnait le compte de l'ÉDITEUR à
    // tout athlète qui n'a pas branché sa montre : ses séances partaient sur le poignet
    // de l'éditeur, et il lisait les sorties de l'éditeur comme les siennes.
    const ids = identifiantsDe(prof);
    const athleteId = ids?.athleteId;
    const apiKey = ids?.apiKey;
    const warmMin = (prof?.warmup_min as number | null | undefined) ?? null;
    const coolMin = (prof?.cooldown_min as number | null | undefined) ?? null;
    if (athleteId && apiKey) {
      // Objectif du client → toutes les séances de la semaine s'appellent « Prépa <objectif> » sur la montre.
      const { data: objRow } = await admin.from("notifications").select("data").eq("user_id", user_id).eq("type", "race_objective").maybeSingle();
      const objectiveRace = ((objRow?.data as { race?: string } | undefined)?.race) || null;
      const vma = await getEffectiveVma(admin, user_id);
      await ensureRunThresholdPace({ athleteId, apiKey, vmaKmh: vma }); // pour que Garmin transmette l'allure
      // UNE lecture pour toute la semaine : la montre ne change pas d'une séance à l'autre.
      const montre = await litMontre({ athleteId, apiKey });
      const results = await Promise.all(sessions.filter((s) => s.date).map((s) => {
        const built = buildWorkoutDescription(String(s.title || s.type || "Séance"), String(s.detail || ""), String(s.type || ""), objectiveRace, vma, warmMin, coolMin, montre);
        if (!built) return Promise.resolve(false);
        return pushIntervalsWorkout({ athleteId, apiKey, userId: user_id, name: built.name, date: String(s.date).slice(0, 10), description: built.description, sport: built.sport }).then((r) => r.ok);
      }));
      watchSent = results.filter(Boolean).length;
    }
  } catch { /* best effort : la publication réussit même si l'envoi montre échoue */ }

  return NextResponse.json({ ok: true, count: rows.length, watchSent });
}
