// ─────────────────────────────────────────────────────────────────────────────
//  MEILLEURS EFFORTS — le plus rapide 1 km, 1 mile, 5 km… DANS la sortie.
//
//  Ce n'est pas le chrono du premier kilomètre : c'est la fenêtre la plus rapide, où
//  qu'elle se trouve. Un athlète qui s'échauffe 2 km puis accélère n'a pas son meilleur
//  5 km au départ, et afficher le premier découpage le lui volerait.
//
//  ⚠️ L'INTERPOLATION N'EST PAS UN LUXE. Les points GPS tombent tous les ~5 à 10 m :
//  prendre le point le plus proche au lieu de la position exacte se paie jusqu'à
//  plusieurs secondes sur un 1 km — assez pour effacer un record.
//
//  Les arrêts n'ont pas besoin d'un traitement à part : une fenêtre qui contient une
//  pause est mécaniquement plus lente, donc elle n'est jamais retenue.
// ─────────────────────────────────────────────────────────────────────────────
import type { TrackPoint } from "@/lib/segments/geo";
import { haversine } from "@/lib/segments/geo";

export type Distance = { m: number; cle: string };

/** Les distances de référence, dans l'ordre. `cle` sert à traduire l'intitulé. */
export const DISTANCES: Distance[] = [
  { m: 400, cle: "400m" },
  { m: 1000, cle: "1km" },
  { m: 1609.34, cle: "1mile" },
  { m: 5000, cle: "5km" },
  { m: 10000, cle: "10km" },
  { m: 21097.5, cle: "semi" },
  { m: 42195, cle: "marathon" },
];

export type Effort = {
  cle: string;
  /** Distance visée, en mètres. */
  m: number;
  /** Durée du meilleur passage, en secondes. */
  secondes: number;
  /** Allure de ce passage, en secondes par kilomètre. */
  allureSecKm: number;
};

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Meilleurs efforts d'une trace. Une distance n'apparaît QUE si la sortie la couvre —
 * on ne rend jamais un « meilleur 10 km » sur une sortie de 7 km.
 */
export function meilleursEfforts(points: readonly TrackPoint[], distances: readonly Distance[] = DISTANCES): Effort[] {
  const pts = (points ?? []).filter(
    (p) => p && fini(p.lat) && fini(p.lon) && fini(p.t) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180,
  );
  if (pts.length < 3) return [];

  // Distances et temps cumulés. Le temps doit être CROISSANT : une trace dont l'horloge
  // recule est corrompue, et la traiter donnerait des durées négatives.
  const dist: number[] = [0];
  const temps: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
    const dt = pts[i].t - pts[i - 1].t;
    if (!fini(d) || d < 0 || !fini(dt) || dt < 0) return [];
    dist.push(dist[i - 1] + d);
    temps.push(temps[i - 1] + dt);
  }
  const total = dist[dist.length - 1];

  const out: Effort[] = [];
  for (const cible of distances) {
    if (!(cible.m > 0) || total < cible.m) continue;
    let meilleur = Infinity;
    let i = 0;
    for (let j = 1; j < dist.length; j++) {
      // On garde `i` le plus GRAND possible tel que la fenêtre couvre encore la cible.
      while (i + 1 < j && dist[j] - dist[i + 1] >= cible.m) i++;
      if (dist[j] - dist[i] < cible.m) continue;
      // Position exacte du départ : quelque part entre i et i+1.
      const vise = dist[j] - cible.m;
      const pas = dist[i + 1] - dist[i];
      const frac = pas > 0 ? Math.min(1, Math.max(0, (vise - dist[i]) / pas)) : 0;
      const tDepart = temps[i] + frac * (temps[i + 1] - temps[i]);
      const duree = temps[j] - tDepart;
      if (duree > 0 && duree < meilleur) meilleur = duree;
    }
    if (!fini(meilleur) || meilleur <= 0) continue;
    out.push({
      cle: cible.cle,
      m: cible.m,
      secondes: Math.round(meilleur),
      allureSecKm: Math.round((meilleur / cible.m) * 1000),
    });
  }
  return out;
}

/** « 25:05 » ou « 1 h 19:42 » — un chrono se lit, il ne se calcule pas de tête. */
export function chrono(secondes: number): string {
  if (!fini(secondes) || secondes < 0) return "—";
  const s = Math.round(secondes);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  return h > 0 ? `${h} h ${mm}:${String(r).padStart(2, "0")}` : `${mm}:${String(r).padStart(2, "0")}`;
}

/** Allure lisible à partir de secondes par kilomètre. */
export function allure(secKm: number): string {
  if (!fini(secKm) || secKm <= 0) return "—";
  const s = Math.round(secKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} /km`;
}
