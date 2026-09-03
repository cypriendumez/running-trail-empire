export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PerfTabs } from "@/components/segments/PerfTabs";
import { leaderboard, maitreDuSegment } from "@/lib/segments/match";
import { lireEfforts } from "@/lib/segments/efforts";
import { SegmentList, type SegmentVue } from "@/components/segments/SegmentList";
import { getAccountLang } from "@/lib/i18n/serverLang";
import { T, fill } from "@/lib/i18n/translations";

export const metadata = { title: "Segments" };

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
  const d = T[await getAccountLang(sb, user.id)];

  const { data: segments, error } = await sb.from("segments")
    .select("id, name, distance_m, elevation_gain_m, avg_grade_pct, polyline")
    .order("distance_m", { ascending: false }).limit(50);

  // Le socle n'est pas encore activé en base : on le DIT, au lieu d'afficher une
  // page vide qui laisserait croire qu'aucun segment n'existe.
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-zinc-900">{d["seg.off.title"]}</p>
        <p className="mt-2 text-sm text-zinc-500">{d["seg.off.sub"]}</p>
      </div>
    );
  }

  const ids = (segments ?? []).map((s) => String((s as { id: string }).id));
  // ⚠️ LECTURE PAGINÉE. Sans elle, PostgREST s'arrête à 1 000 efforts sans erreur :
  // mesuré le 03/09/2026, la base en comptait 1 063 et 63 passages disparaissaient des
  // classements, du record et du « Maître du segment ».
  const parSegment = await lireEfforts(sb, ids);

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
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">{d["seg.title"]}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {vues.length > 0
            ? fill(d["seg.sub"], { n: vues.length })
            : d["seg.empty"]}
        </p>
      </header>
      <SegmentList segments={vues} />
    </div>
  );
}
