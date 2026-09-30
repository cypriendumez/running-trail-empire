export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
/**
 * GET /api/cron/resultats-course — « tes résultats sont en ligne », quelques jours après la
 * course visée (lib/notify/resultatsCourse). Appelée chaque matin par
 * `.github/workflows/resultats-course.yml`.
 *
 * Tous les jours, et c'est voulu : entre J+2 et J+10, l'athlète reçoit l'e-mail le PREMIER
 * matin où le classement de son édition est connu — une seule fois (envoi mémorisé).
 * `?blanc=1` parcourt tout le chemin sans rien envoyer ni mémoriser.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { courseTerminee, envoyerResultatsCourse, type Objectif } from "@/lib/notify/resultatsCourse";
import { jourFrance } from "@/lib/races/jourFrance";

export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const blanc = new URL(req.url).searchParams.get("blanc") === "1";
  const aujourdhui = jourFrance();
  const admin = createAdminClient();
  // Seuls les athlètes dont la course visée tombe dans la fenêtre : inutile de lire les autres.
  const { data, error } = await admin.from("notifications").select("user_id, data").eq("type", "race_objective").limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const concernes = ((data ?? []) as { user_id: string; data: Objectif }[]).filter((r) => courseTerminee(r.data, aujourdhui));

  const resultats: { userId: string; sent: boolean; skipped?: string }[] = [];
  for (const r of concernes) {
    const e = await envoyerResultatsCourse(admin, { userId: r.user_id, aujourdhui, blanc })
      .catch((x) => ({ sent: false, skipped: String((x as Error).message) }));
    resultats.push({ userId: r.user_id, sent: e.sent, skipped: e.skipped });
  }
  return NextResponse.json({ ok: true, blanc, aujourdhui, objectifs: data?.length ?? 0, dansLaFenetre: concernes.length, envoyes: resultats.filter((x) => x.sent).length, resultats });
}
