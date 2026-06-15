export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runLeagueUpdate } from "@/lib/leagues/engine";

export const runtime = "nodejs";

// GET /api/cron/leagues — génère/rafraîchit le classement de la semaine. Protégé par CRON_SECRET.
export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = await runLeagueUpdate(createAdminClient());
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
