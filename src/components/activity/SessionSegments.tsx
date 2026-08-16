// ─────────────────────────────────────────────────────────────────────────────
//  Segments franchis pendant CETTE sortie — l'équivalent du bloc « Meilleurs
//  efforts / Segments » de Strava.
//
//  On n'affiche que les segments réellement chronométrés sur cette séance, avec le
//  rang obtenu. Lister des segments proches mais non parcourus laisserait croire à
//  des efforts qui n'ont pas eu lieu.
// ─────────────────────────────────────────────────────────────────────────────
import { Medal, Crown } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

export type EffortVue = {
  id: string;
  name: string;
  distance_m: number;
  elapsed_seconds: number;
  rang: number | null;
  total: number;
  record: boolean;
};

const chrono = (s: number) => {
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};
const allure = (sec: number, m: number) => {
  const p = sec / (m / 1000), mm = Math.floor(p / 60), ss = Math.round(p % 60);
  return `${mm}:${String(ss).padStart(2, "0")} /km`;
};

export function SessionSegments({ efforts }: { efforts: EffortVue[] }) {
  const { t } = useT();
  if (!efforts.length) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-bold text-zinc-900">
        Segments · {efforts.length}
      </h2>
      <div className="divide-y divide-zinc-50">
        {efforts.map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              e.record ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500"}`}>
              {e.record ? <Crown className="h-4 w-4" /> : <Medal className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-zinc-900">{e.name}</div>
              <div className="text-xs text-zinc-500">
                {(e.distance_m / 1000).toFixed(2).replace(".", ",")} km · {allure(e.elapsed_seconds, e.distance_m)}
                {/* Le rang n'est affiché QUE s'il existe ; « 1er sur 1 » resterait
                    exact mais flatteur, donc on précise toujours le total. */}
                {e.rang != null && ` · ${t("seg.rank", { n: e.rang, total: e.total })}`}
              </div>
            </div>
            <span className="shrink-0 text-lg font-black tabular-nums text-zinc-900">{chrono(e.elapsed_seconds)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
