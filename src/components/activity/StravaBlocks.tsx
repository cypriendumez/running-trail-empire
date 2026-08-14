"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Détail d'une séance — carte, temps intermédiaires, profil d'altitude.
//
//  Reprend la structure des écrans Strava : le tracé d'abord, puis les chiffres
//  clés, puis le découpage kilomètre par kilomètre avec sa barre d'allure et son
//  dénivelé, enfin le profil du terrain.
//
//  Une différence assumée : le DERNIER TRONÇON est marqué « partiel ». Une sortie de
//  12,01 km finit sur 10 mètres ; présenter cela comme un kilomètre plein affiche un
//  chrono aberrant en bas de tableau. Strava masque ce détail, on préfère le dire.
// ─────────────────────────────────────────────────────────────────────────────
import { splitPace, type Split } from "@/lib/segments/splits";
import { SegmentMapLazy } from "@/components/segments/SegmentMapLazy";

export type Chiffre = { label: string; value: string };

const paceLabel = (secParKm: number) => {
  const m = Math.floor(secParKm / 60), s = Math.round(secParKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
};

export function StravaBlocks({ polyline, chiffres, splits, profil }: {
  polyline: string | null;
  chiffres: Chiffre[];
  splits: Split[];
  profil: { d: number; alt: number }[] | null;
}) {
  // Barres proportionnelles à l'allure : la plus rapide occupe toute la largeur.
  const allures = splits.map(splitPace).filter((v): v is number => v != null);
  const meilleure = allures.length ? Math.min(...allures) : 0;
  const pire = allures.length ? Math.max(...allures) : 1;

  return (
    <div className="space-y-6">
      {polyline && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <SegmentMapLazy polyline={polyline} height={260} />
        </section>
      )}

      {chiffres.length > 0 && (
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
          {chiffres.map((c) => (
            <div key={c.label} className="bg-white p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{c.label}</div>
              <div className="mt-1 text-2xl font-black tracking-tight text-zinc-900">{c.value}</div>
            </div>
          ))}
        </section>
      )}

      {profil && profil.length > 3 && <ProfilAltitude points={profil} />}

      {splits.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-bold text-zinc-900">Temps intermédiaires</h2>
          <div className="grid grid-cols-[2.5rem_3.5rem_1fr_3rem] gap-2 border-b border-zinc-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            <span>Km</span><span>Allure</span><span /><span className="text-right">Élév.</span>
          </div>
          <div className="divide-y divide-zinc-50">
            {splits.map((s) => {
              const pace = splitPace(s);
              // Largeur relative : la plus rapide remplit, la plus lente garde 45 %.
              const largeur = pace && pire > meilleure
                ? 45 + 55 * (1 - (pace - meilleure) / (pire - meilleure))
                : 100;
              return (
                <div key={s.km} className="grid grid-cols-[2.5rem_3.5rem_1fr_3rem] items-center gap-2 px-4 py-1.5 text-sm">
                  <span className="font-semibold text-zinc-700">{s.km}</span>
                  <span className="tabular-nums text-zinc-900">{pace ? paceLabel(pace) : "—"}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-4 rounded-sm bg-emerald-500" style={{ width: `${largeur}%` }} />
                    {/* Le tronçon incomplet est ÉTIQUETÉ, jamais présenté comme un km plein. */}
                    {s.partial && (
                      <span className="shrink-0 text-[10px] text-zinc-400">
                        {s.distanceKm.toFixed(2).replace(".", ",")} km
                      </span>
                    )}
                    {/* L'arrêt est AFFICHÉ, pas gommé. L'allure ci-contre l'exclut
                        (temps en mouvement) ; sans cette mention, l'athlète ne
                        comprendrait pas pourquoi son chrono total ne colle pas à la
                        somme des allures. */}
                    {s.stoppedSeconds > 30 && (
                      <span className="shrink-0 text-[10px] text-amber-600">
                        arrêt {Math.floor(s.stoppedSeconds / 60)} min
                      </span>
                    )}
                  </span>
                  <span className={`text-right tabular-nums text-xs ${
                    s.elevation == null ? "text-zinc-300" : s.elevation > 0 ? "text-zinc-700" : "text-zinc-400"}`}>
                    {s.elevation == null ? "—" : s.elevation > 0 ? `+${s.elevation}` : s.elevation}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400">
            Allures calculées sur le temps en mouvement, à partir de la trace GPS.
            Les arrêts de plus de 30 s sont signalés et exclus de l&apos;allure.
          </p>
        </section>
      )}
    </div>
  );
}

/** Profil d'altitude en aire remplie — même lecture que la courbe Strava. */
function ProfilAltitude({ points }: { points: { d: number; alt: number }[] }) {
  const W = 100, H = 30;
  const alts = points.map((p) => p.alt);
  const min = Math.min(...alts), max = Math.max(...alts);
  const dMax = points[points.length - 1].d || 1;
  // Une plage d'altitude nulle donnerait une division par zéro : on force 1 m.
  const plage = Math.max(1, max - min);

  const chemin = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(p.d / dMax) * W} ${H - ((p.alt - min) / plage) * H}`)
    .join(" ");

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-zinc-900">Altitude</h2>
        <span className="text-xs text-zinc-400">{Math.round(min)} – {Math.round(max)} m</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-32 w-full">
        <path d={`${chemin} L ${W} ${H} L 0 ${H} Z`} fill="#d4d4d8" />
        <path d={chemin} fill="none" stroke="#71717a" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
        <span>0 km</span><span>{dMax.toFixed(1).replace(".", ",")} km</span>
      </div>
    </section>
  );
}
