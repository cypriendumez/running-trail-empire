export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { syncIntervalsForUser } from "@/lib/intervals/syncUser";

export const runtime = "nodejs";
export const maxDuration = 60; // 60s timeout (Vercel hobby = 10s, pro = 60s)

// GET /api/cron/sync-all
// Called by Vercel Cron every 30 minutes.
// Secured with CRON_SECRET header.
export async function GET(req: Request) {
  // Verify the cron secret
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch all users with Intervals.icu credentials
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, intervals_athlete_id, intervals_api_key")
    .not("intervals_athlete_id", "is", null)
    .not("intervals_api_key", "is", null);

  if (error) {
    console.error("[cron/sync-all] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const days = 1; // sync last 24h for the cron (lightweight)
  const oldest = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const newest = new Date().toISOString().split("T")[0];

  const results: { userId: string; ok: boolean; workouts?: number; coached?: boolean; error?: string }[] = [];

  for (const profile of profiles ?? []) {
    if (!profile.intervals_athlete_id || !profile.intervals_api_key) continue;

    try {
      // Chemin de synchronisation PARTAGÉ. Ce cron avait sa propre copie de la logique :
      // elle ignorait les champs récents (température, GAP, temps en zone, sport), ne
      // lançait aucune des analyses mesurées, et faisait un upsert sur une contrainte
      // inexistante — donc n'écrivait rien. Trois implémentations divergentes pour une
      // seule tâche, c'est deux de trop.
      const { synced, error: syncErr } = await syncIntervalsForUser(admin, {
        userId: profile.id,
        athleteId: profile.intervals_athlete_id,
        apiKey: profile.intervals_api_key,
        days,
      });
      if (syncErr) { results.push({ userId: profile.id, ok: false, error: syncErr }); continue; }

      // Coach AUTONOME : du nouveau → recalcule et publie la prochaine séance.
      let coached = false;
      if (synced > 0) {
        const r = await autoCoachForUser(admin, { userId: profile.id, athleteId: profile.intervals_athlete_id, apiKey: profile.intervals_api_key }).catch(() => null);
        coached = !!r?.processed;
      }
      results.push({ userId: profile.id, ok: true, workouts: synced, coached });
    } catch (err) {
      results.push({ userId: profile.id, ok: false, error: String(err) });
    }
  }

  const total = results.reduce((a, r) => a + (r.workouts ?? 0), 0);
  console.log(`[cron/sync-all] Synced ${total} activities for ${results.length} users`);
  return NextResponse.json({ ok: true, users: results.length, total_activities: total, results });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapActivityType(type: string): string {
  const map: Record<string, string> = {
    Run: "easy", TrailRun: "trail", VirtualRun: "easy",
    Workout: "interval", Ride: "easy", Walk: "recovery", Hike: "trail",
  };
  return map[type] ?? "easy";
}

// Classe la séance par intensité RÉELLE (FC) + distance + dénivelé → type canonique juste,
// au lieu de tout marquer « easy ». Préserve le trail. enum workouts.type valide.
