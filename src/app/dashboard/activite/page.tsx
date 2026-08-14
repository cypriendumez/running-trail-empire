import Link from "next/link";
import { SessionDetail } from "@/components/admin/SessionDetail";
import { cleanActivityName } from "@/lib/utils/activityName";
import { createClient } from "@/lib/supabase/server";
import { computeSplits, elevationProfile } from "@/lib/segments/splits";
import { encodePolyline, simplify, type TrackPoint } from "@/lib/segments/geo";
import { StravaBlocks, type Chiffre } from "@/components/activity/StravaBlocks";

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
          const pts: TrackPoint[] = bruts.map(([lat, lon, t, alt]) => ({ lat, lon, t, alt }));
          splits = computeSplits(pts);
          profil = elevationProfile(pts);
          // Tracé allégé pour la carte : la précision au mètre n'apporte rien à
          // cette échelle et alourdirait la page pour rien.
          polyline = encodePolyline(simplify(pts, 25));
        }
      }
    }
  } catch { /* les blocs Strava sont un bonus : jamais au prix du détail existant */ }

  return (
    <div className="space-y-6">
      <SessionDetail clientMode user="" date={date} dist={sp.dist} title={cleanActivityName(sp.title) || undefined} />
      {(polyline || splits.length > 0 || chiffres.length > 0) && (
        <div className="mx-auto w-full max-w-4xl px-4 pb-10">
          <StravaBlocks polyline={polyline} chiffres={chiffres} splits={splits} profil={profil} />
        </div>
      )}
    </div>
  );
}
