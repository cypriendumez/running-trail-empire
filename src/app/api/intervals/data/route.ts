export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "activities";
  const days = parseInt(url.searchParams.get("days") ?? "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  if (type === "activities") {
    const { data } = await supabase
      .from("workouts")
      .select(`
        id, title, type, date, duration_seconds, distance_km,
        avg_hr, tss, training_effect,
        vertical_oscillation_cm, ground_contact_ms, avg_cadence_spm,
        avg_power_watts, elevation_gain_m, source
      `)
      .eq("user_id", user.id)
      .gte("date", since)
      .order("date", { ascending: false })
      .limit(200);

    const activities = (data ?? []).map(w => ({
      id: w.id,
      name: w.title,
      type: w.type,
      date: w.date,
      distance_km: w.distance_km,
      duration_min: w.duration_seconds ? Math.round(w.duration_seconds / 60) : null,
      avg_hr: w.avg_hr,
      tss: w.tss,
      training_effect: w.training_effect,
      vertical_oscillation_cm: w.vertical_oscillation_cm,
      ground_contact_time_ms: w.ground_contact_ms,
      avg_cadence_spm: w.avg_cadence_spm,
      avg_power_watts: w.avg_power_watts,
      elevation_gain_m: w.elevation_gain_m,
    }));

    return NextResponse.json({ activities });
  }

  if (type === "wellness") {
    const [hrvRes, sleepRes] = await Promise.all([
      supabase.from("hrv_data").select("date, hrv_ms, sdnn, physiological_state").eq("user_id", user.id).gte("date", since).order("date", { ascending: false }).limit(200),
      supabase.from("sleep_data").select("date, total_sleep_min, sleep_score, body_battery_end, spo2_avg").eq("user_id", user.id).gte("date", since).order("date", { ascending: false }).limit(200),
    ]);

    // Merge by date
    const sleepByDate = Object.fromEntries((sleepRes.data ?? []).map(s => [s.date, s]));
    const allDates = new Set([...(hrvRes.data ?? []).map(h => h.date), ...(sleepRes.data ?? []).map(s => s.date)]);

    const wellness = [...allDates].sort((a, b) => b.localeCompare(a)).map(date => {
      const hrv = (hrvRes.data ?? []).find(h => h.date === date);
      const sleep = sleepByDate[date];
      return {
        date,
        hrv: hrv?.hrv_ms ?? null,
        sleep_h: sleep?.total_sleep_min ? sleep.total_sleep_min / 60 : null,
        sleep_score: sleep?.sleep_score ?? null,
        body_battery: sleep?.body_battery_end ?? null,
        spo2: sleep?.spo2_avg ?? null,
        state: hrv?.physiological_state ?? null,
      };
    });

    return NextResponse.json({ wellness });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
