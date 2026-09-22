"use client";
/**
 * DEUX PETITS GRAPHIQUES EN SVG NU — à la place de recharts sur l'accueil.
 *
 * Mesuré le 22/09/2026 sur la version de production : l'accueil chargeait ≈ 500 kB de
 * JavaScript (non compressé) de recharts pour une courbe de VFC et sept barres de
 * kilomètres. Sur un téléphone, c'est autant de code à lire et exécuter AVANT que la
 * page réagisse — pour deux dessins qui tiennent en cinquante lignes de SVG.
 *
 * Ce qu'on garde : la même forme (aire douce sous la courbe, barres arrondies), une
 * info-bulle native (`<title>`) sur chaque point ou barre, et le dessin qui suit la
 * largeur de sa carte (viewBox + preserveAspectRatio="none" pour l'aire ; barres calées
 * en pourcentage). Ce qu'on perd : l'info-bulle stylée au survol, qui n'existait pas
 * au doigt de toute façon.
 *
 * recharts reste utilisé sur le profil et dans l'espace coach, chargés à part.
 */

/** Une courbe lissée (Catmull-Rom → Bézier) qui passe par tous les points. */
function chemin(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`;
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * L'aire de VFC : 14 jours, valeur en ms. `unite` sert l'info-bulle native.
 * Le SVG s'étire à la largeur ET la hauteur de sa carte (preserveAspectRatio="none") ;
 * le trait garde son épaisseur grâce à `vector-effect: non-scaling-stroke`.
 */
export function MiniAire({ points, couleur, unite = "ms", libelle }: {
  points: { date: string; valeur: number }[]; couleur: string; unite?: string; libelle: string;
}) {
  const W = 100, H = 40;
  const vals = points.map((p) => p.valeur);
  const min = Math.min(...vals), max = Math.max(...vals);
  const amp = max - min || 1;
  const pts = points.map((p, i) => ({
    x: points.length === 1 ? W / 2 : (i / (points.length - 1)) * W,
    // 10 % de marge en haut et en bas : une courbe collée au bord se lit mal.
    y: H - 4 - ((p.valeur - min) / amp) * (H - 8),
  }));
  const ligne = chemin(pts);
  const aire = `${ligne} L${pts[pts.length - 1].x} ${H} L${pts[0].x} ${H} Z`;
  const id = `aire-${couleur.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={libelle}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={couleur} stopOpacity={0.22} />
          <stop offset="100%" stopColor={couleur} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={aire} fill={`url(#${id})`} />
      <path d={ligne} fill="none" stroke={couleur} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ vectorEffect: "non-scaling-stroke" }} />
      {/* Des zones invisibles, une par point, pour l'info-bulle native. */}
      {pts.map((p, i) => (
        <rect key={i} x={p.x - W / points.length / 2} y={0} width={W / points.length} height={H} fill="transparent">
          <title>{`${points[i].date} · ${Math.round(points[i].valeur)} ${unite}`}</title>
        </rect>
      ))}
    </svg>
  );
}

/** Sept barres de kilomètres, arrondies, jour en abscisse, avec info-bulle native. */
export function MiniBarres({ barres, libelle, unite = "km" }: {
  barres: { jour: string; valeur: number }[]; libelle: string; unite?: string;
}) {
  const max = Math.max(1, ...barres.map((b) => b.valeur));
  return (
    <div className="flex h-full w-full flex-col" role="img" aria-label={libelle}>
      <div className="flex min-h-0 flex-1 items-end gap-[4%] px-1">
        {barres.map((b, i) => {
          const h = b.valeur > 0 ? Math.max(6, (b.valeur / max) * 100) : 4;
          return (
            <div key={i} className="flex h-full flex-1 items-end" title={`${b.jour} · ${b.valeur.toFixed(1)} ${unite}`}>
              <div className="mx-auto w-full max-w-[36px] rounded-t-md transition-[height] duration-500" style={{ height: `${h}%`, background: b.valeur > 0 ? "#10b981" : "#E4E4E7" }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[4%] px-1">
        {barres.map((b, i) => (
          <div key={i} className="flex-1 text-center text-[10px] leading-none text-zinc-400">{b.jour}</div>
        ))}
      </div>
    </div>
  );
}
