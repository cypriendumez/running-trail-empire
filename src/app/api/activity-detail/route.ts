export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { identifiantsDe } from "@/lib/intervals/identifiants";

const BASE = "https://intervals.icu/api/v1";
const STREAM_TYPES = "time,distance,heartrate,watts,cadence,altitude,velocity_smooth";

type Num = number | null;
type SeriesPoint = { km: Num; min: Num; pace: Num; hr: Num; power: Num; cad: Num; alt: Num };

// Repli : séance enregistrée en base (ex. course faite au TÉLÉPHONE, absente d'intervals.icu).
async function fromWorkout(admin: ReturnType<typeof createAdminClient>, userId: string, date: string, distance_km?: number) {
  const { data } = await admin.from("workouts").select("*").eq("user_id", userId).eq("date", date);
  if (!data || !data.length) return null;
  let w = data[0] as Record<string, number | string | null>;
  if (distance_km != null && data.length > 1) {
    w = (data as Record<string, number | string | null>[]).reduce((b, x) =>
      Math.abs((Number(x.distance_km) || 0) - distance_km) < Math.abs((Number(b.distance_km) || 0) - distance_km) ? x : b, data[0]);
  }
  const km = Number(w.distance_km) || 0, sec = Number(w.duration_seconds) || 0;
  const activity = {
    name: w.title, type: "Run",
    distance: km * 1000, moving_time: sec, elapsed_time: sec,
    total_elevation_gain: w.elevation_gain_m, total_elevation_loss: w.elevation_loss_m,
    average_heartrate: w.avg_hr, max_heartrate: w.max_hr,
    average_speed: km && sec ? (km * 1000) / sec : null,
    icu_training_load: w.tss, aerobic_te: w.training_effect,
    average_cadence: w.avg_cadence_spm != null ? Number(w.avg_cadence_spm) / 2 : null,
    average_temp: w.weather_temp_c,
    // ⚠️ CE CHAMP EST L'ATTRIBUTION GARMIN, pas un libellé décoratif. David Tinker
    // (intervals.icu) l'a demandé explicitement par écrit le 22/08/2026 : « If you have
    // an activity detail page somewhere, it should include the device name. »
    //
    // Sur le chemin principal il vient tel quel d'intervals.icu (« Garmin Forerunner
    // 165 »). Ici, dans le repli — une séance absente d'intervals.icu — on ne connaît
    // que le CANAL d'entrée. Le montrer comme un appareil afficherait
    // « Appareil : GARMIN_CONNECT », qui n'est le nom d'aucune montre. Une séance au
    // téléphone, elle, dit vrai : l'appareil EST le téléphone.
    device_name: w.source === "phone_gps" ? "Téléphone (GPS)" : null,
  };
  return { activity, series: null, power: null, laps: null, elevGain: w.elevation_gain_m ?? null, elevLoss: w.elevation_loss_m ?? null };
}

// POST /api/activity-detail {date, distance_km}  (version CLIENT : l'athlète connecté voit SA séance)
// → { activity, series, power, laps, elevGain, elevLoss }
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, distance_km } = await req.json() as { date: string; distance_km?: number };
  if (!date) return NextResponse.json({ error: "date requise" }, { status: 400 });

  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("intervals_athlete_id, intervals_api_key").eq("id", user.id).single();
  // ⚠️ AUCUN REPLI SUR LES VARIABLES D'ENVIRONNEMENT — voir `lib/intervals/identifiants`.
  // Le `|| process.env.INTERVALS_ICU_*` qui était ici donnait le compte de l'ÉDITEUR à
  // tout athlète qui n'a pas branché sa montre : ses séances partaient sur le poignet
  // de l'éditeur, et il lisait les sorties de l'éditeur comme les siennes.
  const ids = identifiantsDe(p);
  const ATH = ids?.athleteId;
  const KEY = ids?.apiKey;
  if (!ATH || !KEY) {
    const fb = await fromWorkout(admin, user.id, date.slice(0, 10), distance_km);
    return fb ? NextResponse.json(fb) : NextResponse.json({ error: "Connecte ta montre (intervals.icu) pour le détail complet." }, { status: 503 });
  }

  const day = date.slice(0, 10);
  const auth = { Authorization: "Basic " + Buffer.from(`API_KEY:${KEY}`).toString("base64") };

  try {
    const listRes = await fetch(`${BASE}/athlete/${ATH}/activities?oldest=${day}&newest=${day}`, { headers: auth, signal: AbortSignal.timeout(20000) });
    if (!listRes.ok) return NextResponse.json({ error: `Intervals.icu HTTP ${listRes.status}` }, { status: 502 });
    const list = await listRes.json();
    if (!Array.isArray(list) || list.length === 0) {
      const fb = await fromWorkout(admin, user.id, day, distance_km);
      return fb ? NextResponse.json(fb) : NextResponse.json({ error: "Activité introuvable" }, { status: 404 });
    }
    let matched = list[0];
    if (distance_km != null && list.length > 1) {
      matched = list.reduce((best: Record<string, number>, a: Record<string, number>) =>
        Math.abs((a.distance ?? 0) / 1000 - distance_km) < Math.abs((best.distance ?? 0) / 1000 - distance_km) ? a : best, list[0]);
    }
    const id = matched.id as string;

    const [fullRes, streamRes, lapsRes] = await Promise.all([
      fetch(`${BASE}/activity/${id}`, { headers: auth, signal: AbortSignal.timeout(20000) }).catch(() => null),
      fetch(`${BASE}/activity/${id}/streams?types=${STREAM_TYPES}`, { headers: auth, signal: AbortSignal.timeout(25000) }).catch(() => null),
      fetch(`${BASE}/activity/${id}/intervals`, { headers: auth, signal: AbortSignal.timeout(20000) }).catch(() => null),
    ]);

    const activity = fullRes && fullRes.ok ? await fullRes.json() : matched;

    let laps: Record<string, number | string | null>[] | null = null;
    if (lapsRes && lapsRes.ok) {
      const lj = await lapsRes.json();
      const raw = Array.isArray(lj) ? lj : (lj.icu_intervals || lj.intervals || []);
      if (Array.isArray(raw) && raw.length) {
        laps = raw.filter((l: Record<string, number>) => l && l.distance).map((l: Record<string, number>) => ({
          km: Math.round((l.distance / 1000) * 100) / 100,
          dur: l.moving_time ?? null,
          paceMps: l.average_speed ?? null,
          gapMps: l.gap ?? null,
          hr: l.average_heartrate ?? null,
          hrMax: l.max_heartrate ?? null,
          cad: l.average_cadence != null ? Math.round(l.average_cadence * 2) : null,
          power: typeof l.average_watts === "number" ? Math.round(l.average_watts) : (typeof l.icu_average_watts === "number" ? Math.round(l.icu_average_watts) : null),
          zone: l.zone ?? null,
          intensity: l.intensity != null ? Math.round(l.intensity) : null,
          elev: l.total_elevation_gain != null ? Math.round(l.total_elevation_gain) : null,
          type: typeof l.type === "string" ? l.type : null,
        }));
      }
    }

    let series: SeriesPoint[] | null = null;
    let power: { avg: number; max: number; np: number | null } | null = null;
    let elevGain: number | null = null, elevLoss: number | null = null;
    if (streamRes && streamRes.ok) {
      const streams = await streamRes.json();
      if (Array.isArray(streams)) {
        const S: Record<string, (number | null)[]> = {};
        for (const s of streams) if (s?.type && Array.isArray(s.data)) S[s.type] = s.data;
        const N = S.time?.length ?? S.distance?.length ?? 0;
        if (N > 0) {
          const TARGET = 240;
          const bucket = Math.max(1, Math.ceil(N / TARGET));
          series = [];
          const avgRange = (arr: (number | null)[] | undefined, i: number, end: number): number | null => {
            if (!arr) return null;
            let sum = 0, c = 0;
            for (let j = i; j < end; j++) { const v = arr[j]; if (typeof v === "number" && isFinite(v)) { sum += v; c++; } }
            return c ? sum / c : null;
          };
          for (let i = 0; i < N; i += bucket) {
            const end = Math.min(i + bucket, N);
            const dist = avgRange(S.distance, i, end);
            const vel = avgRange(S.velocity_smooth, i, end);
            const hr = avgRange(S.heartrate, i, end);
            const pw = avgRange(S.watts, i, end);
            const cad = avgRange(S.cadence, i, end);
            const alt = avgRange(S.altitude, i, end);
            const tm = avgRange(S.time, i, end);
            series.push({
              km: dist != null ? Math.round(dist / 10) / 100 : null,
              min: tm != null ? Math.round(tm / 6) / 10 : null,
              pace: vel && vel > 0.4 ? Math.min(12, Math.round((1000 / 60 / vel) * 100) / 100) : null,
              hr: hr != null ? Math.round(hr) : null,
              power: pw != null ? Math.round(pw) : null,
              cad: cad != null ? Math.round(cad * 2) : null,
              alt: alt != null ? Math.round(alt * 10) / 10 : null,
            });
          }
          const watts = (S.watts ?? []).filter((v): v is number => typeof v === "number" && isFinite(v));
          if (watts.length > 10) {
            const avg = watts.reduce((a, b) => a + b, 0) / watts.length;
            const max = watts.reduce((m, v) => (v > m ? v : m), -Infinity);
            let np: number | null = null;
            const win = 30;
            if (watts.length > win) {
              const roll: number[] = [];
              let sum = 0;
              for (let k = 0; k < watts.length; k++) { sum += watts[k]; if (k >= win) sum -= watts[k - win]; if (k >= win - 1) roll.push(sum / win); }
              const mean4 = roll.reduce((a, b) => a + Math.pow(b, 4), 0) / roll.length;
              np = Math.pow(mean4, 0.25);
            }
            power = { avg: Math.round(avg), max: Math.round(max), np: np != null ? Math.round(np) : null };
          }
          const alt = S.altitude;
          if (Array.isArray(alt) && alt.length > 10) {
            const W = 5;
            const sm: number[] = [];
            for (let i = 0; i < alt.length; i++) {
              let s = 0, c = 0;
              for (let j = Math.max(0, i - W); j <= Math.min(alt.length - 1, i + W); j++) { const v = alt[j]; if (typeof v === "number" && isFinite(v)) { s += v; c++; } }
              if (c) sm.push(s / c);
            }
            if (sm.length > 10) {
              let g = 0, l = 0, ref: number | null = null;
              for (const v of sm) { if (ref == null) { ref = v; continue; } if (v >= ref + 0.5) { g += v - ref; ref = v; } else if (v <= ref - 0.5) { l += ref - v; ref = v; } }
              elevGain = Math.round(g); elevLoss = Math.round(l);
            }
          }
        }
      }
    }

    return NextResponse.json({ activity, series, power, laps, elevGain, elevLoss });
  } catch (e) {
    const fb = await fromWorkout(admin, user.id, day, distance_km).catch(() => null);
    return fb ? NextResponse.json(fb) : NextResponse.json({ error: `Erreur réseau: ${(e as Error).message}` }, { status: 502 });
  }
}
