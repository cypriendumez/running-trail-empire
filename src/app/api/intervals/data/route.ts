export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { COLONNES_VFC, serieVfc } from "@/lib/health/vfc";

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
      .limit(Math.min(days * 3, 2000));

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
      supabase.from("hrv_data").select(COLONNES_VFC).eq("user_id", user.id).gte("date", since).order("date", { ascending: false }).limit(Math.min(days, 2000)),
      supabase.from("sleep_data").select("date, total_sleep_min, sleep_score, body_battery_end, spo2_avg").eq("user_id", user.id).gte("date", since).order("date", { ascending: false }).limit(Math.min(days, 2000)),
    ]);

    // UNE seule mesure de VFC (rMSSD, ou SDNN d'Apple Watch) : la colonne montre la valeur
    // et l'état DANS cette mesure, face à la base de l'athlète (lib/health/vfc). Un jour
    // qui ne porte que l'autre mesure garde sa ligne, sans VFC — jamais convertie.
    const serie = serieVfc((hrvRes.data ?? []) as { date: string; rmssd: number | null; sdnn: number | null }[]);
    const vfcParDate = new Map(serie.lignes.map((l) => [l.date, l]));
    const sleepByDate = Object.fromEntries((sleepRes.data ?? []).map(s => [s.date, s]));
    const allDates = new Set([...(hrvRes.data ?? []).map(h => h.date), ...(sleepRes.data ?? []).map(s => s.date)]);

    const wellness = [...allDates].sort((a, b) => b.localeCompare(a)).map(date => {
      const hrv = vfcParDate.get(date);
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

    return NextResponse.json({ wellness, metriqueVfc: serie.metrique });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
