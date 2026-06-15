export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BASE = "https://intervals.icu/api/v1";
const auth = (k: string) => ({ Authorization: "Basic " + Buffer.from(`API_KEY:${k}`).toString("base64") });

/**
 * GET /api/watch/status
 * Renvoie l'état de la connexion montre (intervals.icu → Garmin / Coros / Wahoo).
 *  - connected : identifiants intervals.icu valides
 *  - pushReady : « envoyer les entraînements planifiés » est activé pour au moins une montre
 *  - device    : la montre prête (Garmin / Coros / Wahoo)
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false, pushReady: false, device: null });

  const { data: profile } = await supabase
    .from("profiles")
    .select("intervals_athlete_id, intervals_api_key")
    .eq("id", user.id)
    .single();
  const ATHLETE_ID = profile?.intervals_athlete_id || process.env.INTERVALS_ICU_ATHLETE_ID;
  const API_KEY = profile?.intervals_api_key || process.env.INTERVALS_ICU_API_KEY;
  if (!ATHLETE_ID || !API_KEY) return NextResponse.json({ connected: false, pushReady: false, device: null });

  try {
    const res = await fetch(`${BASE}/athlete/${ATHLETE_ID}`, { headers: auth(API_KEY), cache: "no-store" });
    if (!res.ok) return NextResponse.json({ connected: false, pushReady: false, device: null });
    const a = await res.json();
    const devices = [
      { name: "Garmin", on: !!a.icu_garmin_upload_workouts, last: a.icu_garmin_last_upload ?? null },
      { name: "Coros", on: !!a.coros_upload_workouts, last: a.coros_last_upload ?? null },
      { name: "Wahoo", on: !!a.wahoo_upload_workouts, last: a.wahoo_last_upload ?? null },
    ];
    const ready = devices.find((d) => d.on) ?? null;
    return NextResponse.json({
      connected: true,
      pushReady: !!ready,
      device: ready?.name ?? null,
      lastUpload: ready?.last ?? null,
    });
  } catch {
    return NextResponse.json({ connected: false, pushReady: false, device: null });
  }
}
