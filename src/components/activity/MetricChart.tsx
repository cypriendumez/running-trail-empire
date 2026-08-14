// ─────────────────────────────────────────────────────────────────────────────
//  Courbe d'une métrique le long d'une sortie (FC, cadence, puissance).
//
//  Aire remplie, même lecture que les courbes Strava. Aucune courbe n'est affichée
//  si la métrique manque : mieux vaut un bloc absent qu'une ligne plate inventée là
//  où la montre n'a rien mesuré.
// ─────────────────────────────────────────────────────────────────────────────
export function MetricChart({ titre, unite, couleur, points, resume }: {
  titre: string;
  unite: string;
  couleur: string;
  points: { d: number; v: number }[];
  resume: { label: string; value: string }[];
}) {
  const W = 100, H = 30;
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const dMax = points[points.length - 1].d || 1;
  // Plage nulle (valeur constante) : on force 1 pour éviter une division par zéro.
  const plage = Math.max(1, max - min);
  const chemin = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(p.d / dMax) * W} ${H - ((p.v - min) / plage) * H}`)
    .join(" ");

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-zinc-900">{titre}</h2>
        <span className="text-xs text-zinc-400">{Math.round(min)} – {Math.round(max)} {unite}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-28 w-full">
        <path d={`${chemin} L ${W} ${H} L 0 ${H} Z`} fill={couleur} fillOpacity="0.25" />
        <path d={chemin} fill="none" stroke={couleur} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-3 divide-y divide-zinc-50 border-t border-zinc-100">
        {resume.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-zinc-500">{r.label}</span>
            <span className="font-bold text-zinc-900">{r.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
