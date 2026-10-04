"use client";
/**
 * LE GRAPHIQUE D'UNE FICHE D'INDICATEUR — SVG nu, sans bibliothèque (04/10/2026).
 *
 * Une à deux courbes (ou des barres), une bande de référence (zone normale) et une ligne de
 * repère (base, médiane). Au survol (ou au doigt), une ligne verticale suit le point le plus
 * proche et une info-bulle donne la date et chaque valeur. Même parti pris que les mini
 * graphiques du tableau de bord : pas de recharts (≈ 500 kB) pour quelques dizaines de points.
 */
import { useMemo, useRef, useState } from "react";
import type { Graphe } from "@/lib/indicateurs/types";

const L = 640, H = 240, M = { haut: 16, droite: 14, bas: 28, gauche: 40 };

function chemin(pts: { x: number; y: number }[]): string {
  if (!pts.length) return "";
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Des graduations « rondes » entre min et max. */
function graduations(min: number, max: number, n = 4): number[] {
  const brut = (max - min) / n || 1;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= brut) ?? brut;
  const out: number[] = [];
  for (let v = Math.ceil(min / pas) * pas; v <= max + 1e-9; v += pas) out.push(Math.round(v * 100) / 100);
  return out;
}

export function GrapheIndicateur({ g, lang }: { g: Graphe; lang: string }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const n = Math.max(0, ...g.lignes.map((l) => l.points.length));
  const dates = g.lignes.find((l) => l.points.length === n)?.points.map((p) => p.date) ?? [];

  const { echY, xs, ticks } = useMemo(() => {
    const vals = g.lignes.flatMap((l) => l.points.map((p) => p.valeur)).concat(
      g.bande ? [g.bande.bas, g.bande.haut] : [], g.repere ? [g.repere.valeur] : [],
    ).filter(Number.isFinite);
    let min = g.barres ? 0 : Math.min(...vals), max = Math.max(...vals);
    if (!Number.isFinite(min) || !Number.isFinite(max)) { min = 0; max = 1; }
    const marge = (max - min) * 0.12 || 1;
    if (!g.barres) min -= marge;
    max += marge;
    const ticks = graduations(min, max);
    const lo = Math.min(min, ticks[0] ?? min), hi = Math.max(max, ticks[ticks.length - 1] ?? max);
    const echY = (v: number) => M.haut + (1 - (v - lo) / (hi - lo || 1)) * (H - M.haut - M.bas);
    const larg = L - M.gauche - M.droite;
    const xs = Array.from({ length: n }, (_, i) => g.barres ? M.gauche + ((i + 0.5) / n) * larg : M.gauche + (n > 1 ? (i / (n - 1)) * larg : larg / 2));
    return { echY, xs, ticks: ticks.filter((v) => v >= lo && v <= hi) };
  }, [g, n]);

  const fmt = (v: number) => v.toLocaleString(lang, { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 });
  const surPointeur = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !n) return;
    const x = ((e.clientX - r.left) / r.width) * L;
    let meilleur = 0;
    xs.forEach((xi, i) => { if (Math.abs(xi - x) < Math.abs(xs[meilleur] - x)) meilleur = i; });
    setSurvol(meilleur);
  };
  if (!n) return null;
  const pasEtiquettes = Math.max(1, Math.ceil(n / 7));
  const largeurBarre = g.barres ? Math.max(3, ((L - M.gauche - M.droite) / n) * 0.62) : 0;
  const base = echY(g.barres ? 0 : ticks[0] ?? 0);

  return (
    <div className="relative">
      <svg ref={svg} viewBox={`0 0 ${L} ${H}`} className="h-auto w-full touch-pan-y select-none" role="img" aria-label={g.titre}
        onPointerMove={surPointeur} onPointerDown={surPointeur} onPointerLeave={() => setSurvol(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.gauche} x2={L - M.droite} y1={echY(v)} y2={echY(v)} stroke="#f1f1f3" strokeWidth={1} />
            <text x={M.gauche - 8} y={echY(v) + 3.5} textAnchor="end" className="fill-zinc-400 text-[10px] tabular-nums">{fmt(v)}</text>
          </g>
        ))}
        {g.bande && (
          <rect x={M.gauche} width={L - M.gauche - M.droite} y={echY(g.bande.haut)} height={Math.max(0, echY(g.bande.bas) - echY(g.bande.haut))} fill="#10b981" opacity={0.08} rx={4} />
        )}
        {g.repere && (
          <g>
            <line x1={M.gauche} x2={L - M.droite} y1={echY(g.repere.valeur)} y2={echY(g.repere.valeur)} stroke="#a1a1aa" strokeDasharray="4 4" strokeWidth={1.2} />
            <text x={L - M.droite} y={echY(g.repere.valeur) - 6} textAnchor="end" paintOrder="stroke" stroke="#fff" strokeWidth={4} strokeLinejoin="round" className="fill-zinc-500 text-[10px] font-semibold">{g.repere.libelle} · {fmt(g.repere.valeur)}</text>
          </g>
        )}
        {g.lignes.map((ligne, li) => {
          const pts = ligne.points.map((p, i) => ({ x: xs[i], y: echY(p.valeur) }));
          if (g.barres) {
            return pts.map((p, i) => (
              <rect key={`${li}-${i}`} x={p.x - largeurBarre / 2} width={largeurBarre} y={Math.min(p.y, base)} height={Math.max(1.5, Math.abs(base - p.y))} rx={Math.min(4, largeurBarre / 2)}
                fill={ligne.couleur} opacity={survol == null || survol === i ? (i === pts.length - 1 ? 1 : 0.75) : 0.35} />
            ));
          }
          const d = chemin(pts);
          return (
            <g key={li}>
              {ligne.aire && pts.length > 1 && (
                <path d={`${d} L${pts[pts.length - 1].x.toFixed(1)} ${(H - M.bas).toFixed(1)} L${pts[0].x.toFixed(1)} ${(H - M.bas).toFixed(1)} Z`} fill={ligne.couleur} opacity={0.1} />
              )}
              <path d={d} fill="none" stroke={ligne.couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
        {dates.map((dt, i) => (i % pasEtiquettes === 0 || i === n - 1) && (
          <text key={i} x={xs[i]} y={H - 8} textAnchor="middle" className="fill-zinc-400 text-[10px] tabular-nums">{dt}</text>
        ))}
        {survol != null && (
          <g>
            <line x1={xs[survol]} x2={xs[survol]} y1={M.haut} y2={H - M.bas} stroke="#18181b" strokeOpacity={0.18} strokeWidth={1} />
            {!g.barres && g.lignes.map((l, li) => l.points[survol] && (
              <circle key={li} cx={xs[survol]} cy={echY(l.points[survol].valeur)} r={4.5} fill="#fff" stroke={l.couleur} strokeWidth={2.2} />
            ))}
          </g>
        )}
      </svg>
      {survol != null && (
        <div className="pointer-events-none absolute top-1 rounded-xl bg-zinc-900/90 px-3 py-2 text-[11px] text-white shadow-lg backdrop-blur"
          style={{ left: `${Math.min(78, Math.max(4, (xs[survol] / L) * 100 - 8))}%` }}>
          <div className="font-semibold text-white/70">{dates[survol]}</div>
          {g.lignes.map((l, li) => l.points[survol] && (
            <div key={li} className="mt-0.5 flex items-center gap-1.5 tabular-nums">
              <span className="h-2 w-2 rounded-full" style={{ background: l.couleur }} />
              {g.lignes.length > 1 && <span className="text-white/70">{l.libelle}</span>}
              <span className="font-bold">{fmt(l.points[survol].valeur)}</span>
              <span className="text-white/60">{g.unite}</span>
            </div>
          ))}
        </div>
      )}
      {(g.lignes.length > 1 || g.bande) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          {g.lignes.length > 1 && g.lignes.map((l) => (
            <span key={l.libelle} className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: l.couleur }} />{l.libelle}</span>
          ))}
          {g.bande && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-emerald-500/15" />{g.bande.libelle}</span>}
        </div>
      )}
    </div>
  );
}
