export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PerfTabs } from "@/components/segments/PerfTabs";
import { leaderboard, maitreDuSegment, type StoredEffort } from "@/lib/segments/match";
import { SegmentList, type SegmentVue } from "@/components/segments/SegmentList";

export const metadata = { title: "Segments | Pacevo" };

/**
 * Les segments ne sont pas dessinés à la main : ils sont DÉTECTÉS dans l'historique,
 * et n'existent que s'ils ont été parcourus plusieurs fois. Un segment créé sur une
 * sortie unique n'aurait qu'un concurrent à son classement et un « maître » qui n'y
 * est passé qu'une fois — un objet vide portant un nom.
 */
export default async function SegmentsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: segments, error } = await sb.from("segments")
    .select("id, name, distance_m, elevation_gain_m, avg_grade_pct, polyline")
    .order("distance_m", { ascending: false }).limit(50);

  // Le socle n'est pas encore activé en base : on le DIT, au lieu d'afficher une
  // page vide qui laisserait croire qu'aucun segment n'existe.
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-zinc-900">Segments en attente d&apos;activation</p>
        <p className="mt-2 text-sm text-zinc-500">La base de données des segments n&apos;est pas encore en place.</p>
      </div>
    );
  }

  const ids = (segments ?? []).map((s) => String((s as { id: string }).id));
  const { data: efforts } = ids.length
    ? await sb.from("segment_efforts").select("segment_id, user_id, elapsed_seconds, started_at").in("segment_id", ids)
    : { data: [] };

  const parSegment = new Map<string, StoredEffort[]>();
  for (const e of (efforts ?? []) as Record<string, unknown>[]) {
    const k = String(e.segment_id);
    const arr = parSegment.get(k) ?? [];
    arr.push({ user_id: String(e.user_id), elapsed_seconds: Number(e.elapsed_seconds), started_at: String(e.started_at) });
    parSegment.set(k, arr);
  }

  const vues: SegmentVue[] = (segments ?? []).map((s) => {
    const seg = s as unknown as { id: string; name: string; distance_m: number; elevation_gain_m: number; avg_grade_pct: number | null; polyline: string | null };
    const es = parSegment.get(seg.id) ?? [];
    const classement = leaderboard(es);
    const maitre = maitreDuSegment(es);
    const mien = classement.findIndex((e) => e.user_id === user.id);
    return {
      id: seg.id, name: seg.name, distance_m: seg.distance_m, elevation_gain_m: seg.elevation_gain_m,
      polyline: seg.polyline, avg_grade_pct: seg.avg_grade_pct,
      passages: es.length,
      coureurs: classement.length,
      record: classement[0]?.elapsed_seconds ?? null,
      monRang: mien >= 0 ? mien + 1 : null,
      monTemps: mien >= 0 ? classement[mien].elapsed_seconds : null,
      maitreCount: maitre?.count ?? null,
      jeSuisMaitre: !!maitre?.userIds.includes(user.id),
      maitreExAequo: (maitre?.userIds.length ?? 0) > 1,
    };
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <PerfTabs />
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">Segments</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {vues.length > 0
            ? `${vues.length} portions détectées dans ton historique, chacune parcourue plusieurs fois.`
            : "Aucun segment détecté pour l'instant."}
        </p>
      </header>
      <SegmentList segments={vues} />
    </div>
  );
}
