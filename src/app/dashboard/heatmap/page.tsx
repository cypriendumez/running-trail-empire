export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PerfTabs } from "@/components/segments/PerfTabs";
import { heatCells, topCells, denseBounds } from "@/lib/segments/heatmap";
import type { TrackPoint } from "@/lib/segments/geo";
import { HeatmapLazy } from "@/components/segments/HeatmapLazy";
import { getAccountLang } from "@/lib/i18n/serverLang";
import { T, fill } from "@/lib/i18n/translations";

export const metadata = { title: "Carte de chaleur | Pacevo" };

/**
 * Carte de chaleur personnelle : où l'athlète court VRAIMENT.
 *
 * L'agrégation se fait ici, côté serveur : envoyer les 200 000 points bruts au
 * navigateur le ferait ramer pour un résultat moins lisible qu'une grille de
 * passages. Les traces sont paginées car chacune pèse plusieurs centaines de points
 * et la réponse PostgREST est bornée.
 */
export default async function HeatmapPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const lang = await getAccountLang(sb, user.id);
  const d = T[lang];

  const traces: TrackPoint[][] = [];
  let indisponible = false;
  for (let page = 0; page < 10; page++) {
    const { data, error } = await sb.from("activity_tracks")
      .select("points").eq("user_id", user.id).eq("has_gps", true)
      .order("workout_id").range(page * 40, page * 40 + 39);
    if (error) { indisponible = true; break; }
    if (!data?.length) break;
    for (const row of data) {
      const pts = ((row as { points?: number[][] }).points ?? [])
        .map(([lat, lon, t]) => ({ lat, lon, t }));
      if (pts.length >= 5) traces.push(pts);
    }
    if (data.length < 40) break;
  }

  const cells = indisponible ? [] : topCells(heatCells(traces));
  const bounds = denseBounds(cells);
  const max = cells.reduce((m, c) => Math.max(m, c.n), 1);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <PerfTabs />
      <header className="mb-5">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">{d["heat.title"]}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {cells.length > 0
            ? fill(d["heat.sub"], { traces: traces.length, cells: cells.length.toLocaleString(lang), max })
            : d["heat.empty"]}
        </p>
      </header>

      {/* Distinguer « pas encore de données » d'une panne : les deux donnent une
          carte vide, mais l'athlète n'a pas la même chose à faire. */}
      {indisponible ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="font-semibold text-zinc-900">{d["heat.down.title"]}</p>
          <p className="mt-1 text-sm text-zinc-500">{d["gps.unavailable"]}</p>
        </div>
      ) : !bounds ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="font-semibold text-zinc-900">{d["heat.none.title"]}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            {d["heat.none.sub"]}
          </p>
        </div>
      ) : (
        <HeatmapLazy cells={cells} bounds={bounds} max={max} />
      )}
    </div>
  );
}
