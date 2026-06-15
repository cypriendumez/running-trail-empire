export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";

// GET /api/cron/auto-coach
// Coach AUTONOME : pour chaque athlète, si une NOUVELLE séance a été synchronisée,
// recalcule et publie la prochaine séance (dashboard + montre) automatiquement.
// Sécurisé par CRON_SECRET (Bearer) si défini ; ouvert en local sinon (dev).
export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, intervals_athlete_id, intervals_api_key")
    .not("intervals_athlete_id", "is", null)
    .not("intervals_api_key", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { userId: string; processed: boolean; session?: string; pushed?: boolean; reason?: string }[] = [];
  for (const p of profiles ?? []) {
    const r = await autoCoachForUser(admin, {
      userId: p.id as string,
      athleteId: p.intervals_athlete_id as string | null,
      apiKey: p.intervals_api_key as string | null,
    }).catch((e) => ({ processed: false, reason: String((e as Error).message) }));
    results.push({ userId: p.id as string, ...r });
  }

  const updated = results.filter((r) => r.processed).length;
  return NextResponse.json({ ok: true, athletes: results.length, updated, results });
}
