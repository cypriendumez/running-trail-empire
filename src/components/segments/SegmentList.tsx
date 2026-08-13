// ─────────────────────────────────────────────────────────────────────────────
//  Liste des segments — le chrono d'abord, la couronne ensuite.
//
//  Le « Maître du segment » (notre équivalent du Local Legend) est mis en avant à
//  égalité avec le record, parce qu'il récompense autre chose : la régularité. C'est
//  le seul titre qu'un coureur du dimanche peut prendre à un élite, et c'est
//  précisément ce qui le rend motivant.
// ─────────────────────────────────────────────────────────────────────────────
import { Crown, Timer, Users, Repeat, TrendingUp } from "lucide-react";
import { SegmentMapLazy } from "./SegmentMapLazy";

export type SegmentVue = {
  id: string; name: string; distance_m: number; elevation_gain_m: number;
  polyline: string | null; avg_grade_pct: number | null;
  passages: number; coureurs: number;
  record: number | null;
  monRang: number | null; monTemps: number | null;
  maitreCount: number | null; jeSuisMaitre: boolean; maitreExAequo: boolean;
};

/** Chrono court : 3'36" plutôt que 00:03:36. */
function chrono(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}'${String(s).padStart(2, "0")}"`;
}

export function SegmentList({ segments }: { segments: SegmentVue[] }) {
  if (!segments.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
        <p className="font-semibold text-zinc-900">Aucun segment pour l&apos;instant</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
          Les segments se détectent automatiquement dans tes traces : il faut avoir
          parcouru une même portion plusieurs fois pour qu&apos;elle en devienne un.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {segments.map((s) => (
        <article key={s.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-md">
          <div className="flex flex-wrap items-center gap-4 p-4">
            {s.polyline && (
              <div className="w-full sm:w-[200px] sm:shrink-0">
                <SegmentMapLazy polyline={s.polyline} height={120} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-bold text-zinc-900">{s.name}</h2>
                {s.jeSuisMaitre && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    <Crown className="h-3 w-3" /> {s.maitreExAequo ? "Maître ex æquo" : "Maître"}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span>{(s.distance_m / 1000).toFixed(2).replace(".", ",")} km</span>
                {s.elevation_gain_m > 0
                  ? <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" />{s.elevation_gain_m} m D+{s.avg_grade_pct ? ` · ${String(s.avg_grade_pct).replace(".", ",")} %` : ""}</span>
                  : <span>plat</span>}
                <span className="inline-flex items-center gap-1"><Repeat className="h-3 w-3" /> {s.passages} passages</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {s.coureurs} coureur{s.coureurs > 1 ? "s" : ""}</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Record</div>
                {/* Pas de record = pas de tiret trompeur : on dit qu'il n'y en a pas. */}
                <div className="text-xl font-black text-zinc-900">
                  {s.record != null ? chrono(s.record) : <span className="text-sm font-medium text-zinc-400">aucun</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Mon temps</div>
                <div className="text-xl font-black text-emerald-600">
                  {s.monTemps != null ? chrono(s.monTemps) : <span className="text-sm font-medium text-zinc-400">—</span>}
                </div>
                {s.monRang != null && (
                  <div className="text-[10px] text-zinc-400">{s.monRang}ᵉ sur {s.coureurs}</div>
                )}
              </div>
            </div>
          </div>

          {s.maitreCount != null && (
            <div className="flex items-center gap-2 border-t border-zinc-100 bg-amber-50/50 px-4 py-2 text-xs text-amber-800">
              <Timer className="h-3.5 w-3.5" />
              <span>
                <strong>Maître du segment</strong> — {s.maitreCount} passages sur 90 jours
                {s.jeSuisMaitre ? " (c'est toi)" : ""}
                {s.maitreExAequo ? " · plusieurs ex æquo" : ""}
              </span>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
