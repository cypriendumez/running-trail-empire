export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BASE = "https://intervals.icu/api/v1";

function authHeader(apiKey: string) {
  return { Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64") };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("intervals_athlete_id, intervals_api_key").eq("id", user.id).single();

  const athleteId = profile?.intervals_athlete_id;
  const apiKey = profile?.intervals_api_key;
  if (!athleteId || !apiKey) return NextResponse.json({ error: "No credentials" });

  const oldest = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const newest = new Date().toISOString().split("T")[0];

  const res = await fetch(`${BASE}/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`, {
    headers: authHeader(apiKey),
  });

  const raw = await res.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(raw); } catch {}

  return NextResponse.json({
    status: res.status,
    athleteId,
    oldest,
    newest,
    raw_length: raw.length,
    count: Array.isArray(parsed) ? parsed.length : null,
    sample: Array.isArray(parsed) ? (parsed as unknown[]).slice(0, 2) : parsed,
  });
}
