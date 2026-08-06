export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { syncIntervalsForUser } from "@/lib/intervals/syncUser";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/intervals
 *
 * Called by Intervals.icu when a new activity is created or updated.
 * Payload: { athlete_id, event, id, ... }
 *
 * Secured via ?secret=WEBHOOK_SECRET in the URL we register with Intervals.icu.
 */
export async function POST(req: Request) {
  // Verify secret
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const athleteId = body.athlete_id as string | undefined;
  const event = body.event as string | undefined;

  if (!athleteId) {
    return NextResponse.json({ ok: true, skipped: "no athlete_id" });
  }

  // Only react to activity events
  if (event && !event.includes("activity")) {
    return NextResponse.json({ ok: true, skipped: `event=${event}` });
  }

  const admin = createAdminClient();

  // Find which user owns this athlete ID
  const { data: profile } = await admin
    .from("profiles")
    .select("id, intervals_athlete_id, intervals_api_key")
    .eq("intervals_athlete_id", athleteId)
    .single();

  if (!profile?.intervals_api_key) {
    return NextResponse.json({ ok: true, skipped: "user not found" });
  }

  const { synced, error: syncErr } = await syncIntervalsForUser(admin, {
    userId: profile.id, athleteId, apiKey: profile.intervals_api_key, days: 7,
  });
  if (syncErr) return NextResponse.json({ error: syncErr }, { status: 502 });

  // Coach AUTONOME INSTANTANÉ : dès qu'intervals notifie une nouvelle séance, on (re)publie
  // la prochaine séance sur le dashboard + la montre, sans aucun délai ni clic.
  let coached = false;
  if (synced > 0) {
    const r = await autoCoachForUser(admin, { userId: profile.id, athleteId, apiKey: profile.intervals_api_key }).catch(() => null);
    coached = !!r?.processed;
  }
  console.log(`[webhook/intervals] athlete=${athleteId} → ${synced} activités synced · coach=${coached}`);
  return NextResponse.json({ ok: true, synced, coached });
}

// Intervals.icu also sends GET to verify the webhook endpoint is alive
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, service: "running-trail-empire" });
}

