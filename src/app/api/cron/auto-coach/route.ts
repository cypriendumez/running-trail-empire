export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";

type AutoSummary = { userId: string; processed: boolean; days?: number; pushed?: number; reason?: string };

// GET /api/cron/auto-coach
// Coach AUTONOME : republie chaque nuit un plan glissant de 7 jours pour CHAQUE athlète,
// recalculé sur sa forme du moment (VFC, sommeil, charge, santé, objectif, périodisation).
// Sécurisé par CRON_SECRET (Bearer) si défini ; ouvert en local sinon (dev).
export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  // TOUS les athlètes ayant terminé leur inscription — la montre n'étant plus obligatoire,
  // un client sans Garmin doit lui aussi recevoir son plan dans son calendrier.
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, intervals_athlete_id, intervals_api_key")
    .eq("onboarding_completed", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: AutoSummary[] = [];
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
