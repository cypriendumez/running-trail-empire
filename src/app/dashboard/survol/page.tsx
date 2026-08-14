export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PerfTabs } from "@/components/segments/PerfTabs";
import { encodePolyline, haversine, type TrackPoint } from "@/lib/segments/geo";
import { paceOf } from "@/lib/social/feed";
import { SurvolChoix } from "@/components/segments/SurvolChoix";

export const metadata = { title: "Survol 3D | Pacevo" };

/**
 * SURVOL 3D — rejouer une sortie vue du ciel.
 *
 * ⚠️ GRATUIT, et c'est un choix de produit assumé : chez Strava cette fonction est
 * derrière l'abonnement. Aucun contrôle de `subscription_tier` ici, et il ne doit pas
 * y en avoir — c'est précisément la différence qu'on revendique.
 *
 * La trace est simplifiée à ~150 points avant l'envoi : la caméra suit un cap
 * interpolé, et 700 points la feraient trembler à chaque micro-écart du GPS sans rien
 * ajouter de visible.
 */
const POINTS_CAMERA = 150;

export default async function SurvolPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { w } = await searchParams;

  const { data: tracks, error } = await sb.from("activity_tracks")
    .select("workout_id, point_count").eq("user_id", user.id).eq("has_gps", true)
    .order("point_count", { ascending: false }).limit(300);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-zinc-900">Survol indisponible</p>
        <p className="mt-2 text-sm text-zinc-500">Les traces GPS ne sont pas accessibles pour le moment.</p>
      </div>
    );
  }

  const ids = (tracks ?? []).map((t) => String((t as { workout_id: string }).workout_id));
  const { data: workouts } = ids.length
    ? await sb.from("workouts")
        .select("id, title, type, date, distance_km, duration_seconds, elevation_gain_m")
        .in("id", ids).order("date", { ascending: false })
    : { data: [] };

  const sorties = (workouts ?? []) as unknown as {
    id: string; title: string | null; type: string | null; date: string;
    distance_km: number | null; duration_seconds: number | null; elevation_gain_m: number | null;
  }[];

  if (!sorties.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-zinc-900">Aucune sortie à survoler</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Le survol se construit sur les traces GPS importées depuis ta montre.
          Lance une synchronisation, puis reviens.
        </p>
      </div>
    );
  }

  // Sortie choisie, ou la plus récente par défaut.
  const choisie = sorties.find((s) => s.id === w) ?? sorties[0];
  const { data: trace } = await sb.from("activity_tracks")
    .select("points").eq("workout_id", choisie.id).maybeSingle();

  const bruts = ((trace as { points?: number[][] } | null)?.points ?? []);
  const pas = Math.max(1, Math.floor(bruts.length / POINTS_CAMERA));
  const echantillon = bruts.filter((_, i) => i % pas === 0);
  const pts: TrackPoint[] = echantillon.map(([lat, lon, t]) => ({ lat, lon, t }));
  // L'altitude n'est envoyée QUE si la trace en porte réellement : le bandeau tait
  // l'altitude plutôt que d'afficher un zéro qui passerait pour une mesure.
  const altitudes = echantillon.every((p) => p.length >= 4) ? echantillon.map((p) => p[3]) : null;

  // ── ALLURE INSTANTANÉE ──────────────────────────────────────────────────────
  // Le bandeau affichait l'allure MOYENNE de toute la sortie : un chiffre figé, à un
  // emplacement qui suggère pourtant une valeur du moment — l'altitude et la distance,
  // elles, défilent. On calcule donc l'allure réelle en chaque point.
  //
  // Lissée sur une fenêtre de 5 points : le GPS fait osciller la vitesse d'un point à
  // l'autre, et une allure qui saute de 3'50 à 6'20 chaque demi-seconde serait
  // illisible — et fausse, puisque personne ne court comme ça.
  const paces: (number | null)[] | null = pts.length > 5 ? pts.map((_, i) => {
    const a = Math.max(0, i - 2), b = Math.min(pts.length - 1, i + 2);
    let d = 0;
    for (let k = a + 1; k <= b; k++) d += haversine(pts[k - 1].lat, pts[k - 1].lon, pts[k].lat, pts[k].lon);
    const dt = pts[b].t - pts[a].t;
    if (d < 5 || dt <= 0) return null;          // à l'arrêt : aucune allure à afficher
    const secParKm = dt / (d / 1000);
    // Garde-fous : au-delà de 20 min/km on marche ou on est arrêté, en deçà de 2 min/km
    // c'est une aberration GPS. Dans les deux cas on préfère ne rien afficher.
    return secParKm > 1200 || secParKm < 120 ? null : secParKm;
  }) : null;

  const pace = paceOf(choisie.duration_seconds, choisie.distance_km);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <PerfTabs />
      <header className="mb-5">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">Survol 3D</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Rejoue ta sortie vue du ciel, relief compris.{" "}
          <span className="font-semibold text-emerald-700">Inclus, sans abonnement.</span>
        </p>
      </header>

      <SurvolChoix
        sorties={sorties.slice(0, 24).map((s) => ({
          id: s.id,
          label: s.title || s.type || "Sortie",
          date: s.date,
          km: s.distance_km,
        }))}
        choisie={choisie.id}
        polyline={pts.length >= 2 ? encodePolyline(pts) : ""}
        altitudes={altitudes}
        paces={paces}
        stats={{
          title: choisie.title || choisie.type || "Sortie",
          distanceKm: choisie.distance_km ?? null,
          paceLabel: pace,
        }}
      />
    </div>
  );
}
