// ─────────────────────────────────────────────────────────────────────────────
//  Génération de vrais tracés pour les parcours Hauts-de-France.
//  Le dataset n'a pas de géométrie : on fabrique des points de passage
//  déterministes (boucle ou aller simple) autour de la position du parcours,
//  puis on les fait suivre les vraies routes/chemins via OSRM (comme le
//  Trail Builder). Résultat : un tracé qui colle aux rues, façon map-planner.
// ─────────────────────────────────────────────────────────────────────────────

import { coordFor, type ParcoursHdf } from "@/data/parcoursHdf";

// PRNG déterministe (mulberry32) — un id donne toujours le même tracé.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Points de passage déterministes autour du centre du parcours. [lng, lat]
function waypointsFor(p: ParcoursHdf): [number, number][] {
  const center = coordFor(p);
  const r = rng(p.id * 2246822519 + 99);
  const cosLat = Math.cos((center.lat * Math.PI) / 180) || 1;
  const toLat = (dkm: number) => dkm / 111;
  const toLng = (dkm: number) => dkm / (111 * cosLat);
  const pts: [number, number][] = [];

  if (p.type_parcours === "Boucle") {
    // Rayon tel que le périmètre approche la distance (les routes rallongent).
    const radiusKm = Math.min(7, Math.max(0.4, (p.distance_km / (2 * Math.PI)) * 0.7));
    const n = 6;
    const base = r() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const ang = base + (i / n) * Math.PI * 2;
      const rr = radiusKm * (0.7 + r() * 0.6);
      pts.push([center.lng + toLng(rr * Math.cos(ang)), center.lat + toLat(rr * Math.sin(ang))]);
    }
    pts.push(pts[0]); // referme la boucle
  } else {
    // Aller simple : une ligne brisée dans une direction donnée.
    const dir = r() * Math.PI * 2;
    const lenKm = Math.min(15, Math.max(1, p.distance_km * 0.8));
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const along = lenKm * t;
      const side = (r() - 0.5) * Math.min(2, lenKm * 0.25);
      pts.push([
        center.lng + toLng(Math.cos(dir) * along - Math.sin(dir) * side),
        center.lat + toLat(Math.sin(dir) * along + Math.cos(dir) * side),
      ]);
    }
  }
  return pts;
}

// Profil OSRM selon le sport (le serveur public gère "foot" et "bike").
function osrmProfile(sport: ParcoursHdf["sport"]): "foot" | "bike" {
  return sport === "Vélo (Route)" || sport === "VTT" ? "bike" : "foot";
}

// Renvoie un tracé [lng, lat][] qui suit les vraies routes (sinon repli sur les
// points de passage en ligne droite si OSRM est indisponible).
export async function generateTrace(p: ParcoursHdf): Promise<[number, number][]> {
  const wp = waypointsFor(p);
  const coordStr = wp.map(([lng, lat]) => `${lng},${lat}`).join(";");

  for (const profile of [osrmProfile(p.sport), "foot"] as const) {
    try {
      const url = `https://router.project-osrm.org/route/v1/${profile}/${coordStr}?geometries=geojson&overview=full`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      const coords = data.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
      if (coords && coords.length > 1) return coords;
    } catch {
      /* on tente le profil suivant, puis le repli */
    }
  }
  return wp; // repli : la ligne brisée des points de passage
}
