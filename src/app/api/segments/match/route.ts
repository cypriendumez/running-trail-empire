export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bboxOverlap, bboxOf, type TrackPoint } from "@/lib/segments/geo";
import { findEfforts, type SegmentDef } from "@/lib/segments/match";

/**
 * APPARIEMENT : confronte les traces importées au catalogue de segments et
 * enregistre chaque passage.
 *
 * L'ordre des opérations est ce qui rend l'exercice tenable. Comparer chaque trace à
 * chaque segment point par point serait quadratique — 314 traces × N segments × 1 000
 * points. On élimine donc d'abord par ZONE ENGLOBANTE (deux comparaisons de nombres),
 * ce qui écarte l'écrasante majorité des couples avant tout calcul géodésique.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { workoutId } = await req.json().catch(() => ({})) as { workoutId?: string };
  const admin = createAdminClient();

  // Traces à traiter : celle demandée, ou toutes celles qui portent des coordonnées.
  let q = admin.from("activity_tracks")
    .select("workout_id, points, min_lat, max_lat, min_lon, max_lon")
    .eq("user_id", user.id).eq("has_gps", true);
  if (workoutId) q = q.eq("workout_id", workoutId);
  // Chaque lecture est lue (audit du 08/11/2026) : une panne n'est ni « aucune trace », ni
  // « aucun segment », ni une séance sans date.
  const { data: tracks, error: eTraces } = await q.limit(50);
  if (eTraces) return NextResponse.json({ error: "Traces momentanément illisibles." }, { status: 503 });
  if (!tracks?.length) return NextResponse.json({ efforts: 0, message: "Aucune trace à analyser." });

  const { data: segments, error: eSegments } = await sb.from("segments")
    .select("id, distance_m, start_lat, start_lon, end_lat, end_lon, min_lat, max_lat, min_lon, max_lon")
    .limit(500);
  if (eSegments) return NextResponse.json({ error: "Segments momentanément illisibles." }, { status: 503 });
  if (!segments?.length) return NextResponse.json({ efforts: 0, message: "Aucun segment au catalogue." });

  // Les seules séances de ces traces (50 au plus) : toutes celles du compte dépassaient les
  // 1 000 lignes que rend PostgREST, et les plus anciennes perdaient leur date.
  const { data: workouts, error: eSeances } = await admin.from("workouts")
    .select("id, date").eq("user_id", user.id)
    .in("id", (tracks as { workout_id: string }[]).map((t) => String(t.workout_id)));
  if (eSeances) return NextResponse.json({ error: "Séances momentanément illisibles." }, { status: 503 });
  const dateDe = new Map((workouts ?? []).map((w) => [String((w as { id: string }).id), String((w as { date: string }).date)]));

  const aInserer: Record<string, unknown>[] = [];
  let sansDate = 0;

  for (const t of tracks as Record<string, unknown>[]) {
    const raw = (t.points ?? []) as [number, number, number][];
    if (raw.length < 2) continue;
    const points: TrackPoint[] = raw.map(([lat, lon, s]) => ({ lat, lon, t: s }));
    const boxTrace = t.min_lat != null
      ? { minLat: Number(t.min_lat), maxLat: Number(t.max_lat), minLon: Number(t.min_lon), maxLon: Number(t.max_lon) }
      : bboxOf(points);
    if (!boxTrace) continue;

    for (const s of segments as Record<string, unknown>[]) {
      // Préfiltre : si les deux zones ne se touchent pas, aucun calcul n'est utile.
      if (s.min_lat != null && !bboxOverlap(boxTrace, {
        minLat: Number(s.min_lat), maxLat: Number(s.max_lat),
        minLon: Number(s.min_lon), maxLon: Number(s.max_lon),
      })) continue;

      const def: SegmentDef = {
        id: String(s.id), distance_m: Number(s.distance_m),
        start_lat: Number(s.start_lat), start_lon: Number(s.start_lon),
        end_lat: Number(s.end_lat), end_lon: Number(s.end_lon),
      };
      // ⚠️ PAS DE DATE INVENTÉE (audit du 08/11/2026) : `?? new Date()` datait du jour un passage
      // dont la séance était inconnue, et le classement « du mois » le comptait. Sans date, pas
      // d'enregistrement (la colonne est NOT NULL) : il est compté, pas tu.
      const date = dateDe.get(String(t.workout_id));
      for (const e of findEfforts(points, def)) {
        if (!date) { sansDate++; continue; }
        aInserer.push({
          segment_id: def.id, user_id: user.id, workout_id: String(t.workout_id),
          elapsed_seconds: e.elapsed_seconds,
          started_at: date,
        });
      }
    }
  }

  if (!aInserer.length) return NextResponse.json({ efforts: 0, sansDate, message: sansDate ? "Passages reconnus, mais séance sans date : rien enregistré." : "Aucun segment reconnu sur ces traces." });

  // `ignoreDuplicates` s'appuie sur la contrainte unique (segment, séance) : un
  // ré-appariement ne peut donc pas gonfler les classements ni le titre de Maître.
  const { error } = await admin.from("segment_efforts")
    .upsert(aInserer, { onConflict: "segment_id,workout_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });

  return NextResponse.json({ efforts: aInserer.length, sansDate });
}
