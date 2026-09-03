import Link from "next/link";
import { SessionDetail } from "@/components/admin/SessionDetail";
import { cleanActivityName } from "@/lib/utils/activityName";
import { createClient } from "@/lib/supabase/server";
import { computeSplits, elevationProfile, metricSeries } from "@/lib/segments/splits";
import { encodePolyline, simplify, type TrackPoint } from "@/lib/segments/geo";
import { StravaBlocks, type Chiffre } from "@/components/activity/StravaBlocks";
import { MetricChart } from "@/components/activity/MetricChart";
import { SessionSegments, type EffortVue } from "@/components/activity/SessionSegments";
import { leaderboard, type StoredEffort } from "@/lib/segments/match";
import { lireEfforts } from "@/lib/segments/efforts";

export const dynamic = "force-dynamic";

const hhmm = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}` : `${m} min`;
};
const pace = (sec: number, km: number) => {
  const p = sec / km, m = Math.floor(p / 60), s = Math.round(p % 60);
  return s === 60 ? `${m + 1}:00 /km` : `${m}:${String(s).padStart(2, "0")} /km`;
};

/**
 * Détail d'une séance.
 *
 * Les blocs façon Strava (carte, chiffres clés, temps intermédiaires, profil
 * d'altitude) sont calculés depuis la TRACE GPS, pas demandés à la montre :
 * intervals.icu n'expose pas les tours de la même manière selon l'appareil, alors que
 * la trace est toujours là dès qu'il y a du GPS. Ils s'ajoutent au détail existant
 * (métriques, zones FC, courbes) plutôt que de le remplacer.
 */
export default async function ActivitePage({ searchParams }: { searchParams: Promise<{ date?: string; dist?: string; title?: string }> }) {
  const sp = await searchParams;
  const date = (sp.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-zinc-500">Séance introuvable.</p>
        <Link href="/dashboard" className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">Retour au tableau de bord</Link>
      </div>
    );
  }

  // ── Blocs Strava, best-effort ────────────────────────────────────────────────
  // Toute cette section est facultative : si la trace manque (séance sur tapis,
  // import non fait), on n'affiche simplement pas ces blocs. Le détail existant,
  // lui, doit continuer à s'afficher quoi qu'il arrive.
  let polyline: string | null = null;
  let splits: ReturnType<typeof computeSplits> = [];
  let profil: ReturnType<typeof elevationProfile> = null;
  const chiffres: Chiffre[] = [];
  let courbes: { titre: string; unite: string; couleur: string; points: { d: number; v: number }[]; resume: { label: string; value: string }[] }[] = [];
  let effortsVus: EffortVue[] = [];

  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data: w } = await sb.from("workouts")
        .select("id, distance_km, duration_seconds, elevation_gain_m, avg_hr, avg_cadence_spm, avg_power_watts")
        .eq("user_id", user.id).eq("date", date).order("distance_km", { ascending: false }).limit(1).maybeSingle();

      if (w) {
        const wk = w as Record<string, number | string | null>;
        const km = Number(wk.distance_km ?? 0), sec = Number(wk.duration_seconds ?? 0);
        // On n'ajoute une case QUE si la mesure existe : une grille de tirets
        // ferait passer une séance mal enregistrée pour une séance sans effort.
        if (km > 0) chiffres.push({ label: "Distance", value: `${km.toFixed(2).replace(".", ",")} km` });
        if (sec > 0) chiffres.push({ label: "Temps", value: hhmm(sec) });
        if (km > 0 && sec > 0) chiffres.push({ label: "Allure moyenne", value: pace(sec, km) });
        if (Number(wk.elevation_gain_m ?? 0) > 0) chiffres.push({ label: "Dénivelé +", value: `${Math.round(Number(wk.elevation_gain_m))} m` });
        if (Number(wk.avg_hr ?? 0) > 0) chiffres.push({ label: "FC moyenne", value: `${Math.round(Number(wk.avg_hr))} bpm` });
        if (Number(wk.avg_cadence_spm ?? 0) > 0) chiffres.push({ label: "Cadence moy.", value: `${Math.round(Number(wk.avg_cadence_spm))} ppm` });
        if (Number(wk.avg_power_watts ?? 0) > 0) chiffres.push({ label: "Puissance moy.", value: `${Math.round(Number(wk.avg_power_watts))} W` });

        const { data: tr } = await sb.from("activity_tracks")
          .select("points").eq("workout_id", String(wk.id)).maybeSingle();
        const bruts = ((tr as { points?: number[][] } | null)?.points ?? []);
        if (bruts.length >= 10) {
          // Positions du tableau `points` : 0 lat, 1 lon, 2 temps, 3 altitude, 4 FC,
          // 5 cadence, 6 puissance. Les traces importées avant l'ajout des flux
          // n'ont que les quatre premières — les courbes se taisent alors d'elles-mêmes.
          const pts: TrackPoint[] = bruts.map(([lat, lon, t, alt, hr, cad, pw]) =>
            ({ lat, lon, t, alt: alt ?? undefined, hr: hr ?? undefined, cad: cad ?? undefined, pw: pw ?? undefined } as TrackPoint));
          splits = computeSplits(pts);
          profil = elevationProfile(pts);
          // Tracé allégé pour la carte : la précision au mètre n'apporte rien à
          // cette échelle et alourdirait la page pour rien.
          polyline = encodePolyline(simplify(pts, 25));

          // ── Courbes FC / cadence / puissance ────────────────────────────────
          // Les flux sont stockés aux positions 4, 5 et 6 des points. Chaque courbe
          // n'apparaît que si la métrique existe VRAIMENT sur la sortie.
          const moy = (v: { d: number; v: number }[]) => v.reduce((a, b) => a + b.v, 0) / v.length;
          const defs = [
            { titre: "Fréquence cardiaque", unite: "bpm", couleur: "#ef4444", lire: (q: TrackPoint) => (q as unknown as { hr?: number }).hr },
            // ⚠️ FACTEUR 2 SUR LA CADENCE. intervals.icu renvoie des TOURS par minute (une
            // jambe), alors que la montre, la base (`avg_cadence_spm` = 174) et le reste
            // de l'app raisonnent en PAS par minute (deux jambes). Sans cette conversion,
            // la courbe affichait 89 sous une carte annonçant 174 : l'athlète aurait cru
            // sa cadence effondrée, et les seuils du coach (« sous 170, cadence basse »)
            // se seraient déclenchés à tort.
            { titre: "Cadence", unite: "ppm", couleur: "#ec4899", lire: (q: TrackPoint) => { const c = (q as unknown as { cad?: number }).cad; return typeof c === "number" ? c * 2 : undefined; } },
            { titre: "Puissance", unite: "W", couleur: "#a855f7", lire: (q: TrackPoint) => (q as unknown as { pw?: number }).pw },
          ];
          courbes = defs.flatMap((d) => {
            const serie = metricSeries(pts, d.lire as never);
            if (!serie) return [];
            const vals = serie.map((x) => x.v);
            return [{
              titre: d.titre, unite: d.unite, couleur: d.couleur, points: serie,
              resume: [
                { label: `${d.titre} moy.`, value: `${Math.round(moy(serie))} ${d.unite}` },
                { label: `${d.titre} max.`, value: `${Math.round(Math.max(...vals))} ${d.unite}` },
              ],
            }];
          });

          // ── Segments franchis pendant CETTE sortie ──────────────────────────
          const { data: mes } = await sb.from("segment_efforts")
            .select("id, segment_id, elapsed_seconds").eq("workout_id", String(wk.id));
          const segIds = [...new Set((mes ?? []).map((e) => String((e as { segment_id: string }).segment_id)))];
          if (segIds.length) {
            // ⚠️ MÊME PLAFOND DE 1 000 LIGNES QUE SUR LA PAGE DES SEGMENTS. Le
            // classement affiché sous une séance était amputé de la même façon, en
            // silence : PostgREST s'arrête à 1 000 sans erreur.
            const [{ data: segs }, parSeg] = await Promise.all([
              sb.from("segments").select("id, name, distance_m").in("id", segIds),
              lireEfforts(sb, segIds),
            ]);
            effortsVus = (mes ?? []).map((e) => {
              const ef = e as unknown as { id: string; segment_id: string; elapsed_seconds: number };
              const seg = (segs ?? []).find((x) => String((x as { id: string }).id) === ef.segment_id) as
                { id: string; name: string; distance_m: number } | undefined;
              const cl = leaderboard(parSeg.get(ef.segment_id) ?? []);
              const rang = cl.findIndex((x) => x.user_id === user.id);
              return {
                id: ef.id, name: seg?.name ?? "Segment", distance_m: seg?.distance_m ?? 0,
                elapsed_seconds: ef.elapsed_seconds,
                rang: rang >= 0 ? rang + 1 : null, total: cl.length,
                record: cl[0]?.elapsed_seconds === ef.elapsed_seconds,
              };
            }).sort((a, b) => b.distance_m - a.distance_m);
          }
        }
      }
    }
  } catch { /* les blocs Strava sont un bonus : jamais au prix du détail existant */ }

  return (
    <div className="space-y-6">
      <SessionDetail clientMode user="" date={date} dist={sp.dist} title={cleanActivityName(sp.title) || undefined} />
      {(polyline || splits.length > 0 || chiffres.length > 0 || courbes.length > 0 || effortsVus.length > 0) && (
        <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-10">
          <StravaBlocks polyline={polyline} chiffres={chiffres} splits={splits} profil={profil} />
          <SessionSegments efforts={effortsVus} />
          {courbes.map((c) => <MetricChart key={c.titre} {...c} />)}
        </div>
      )}
    </div>
  );
}
