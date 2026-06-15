// ─────────────────────────────────────────────────────────────────────────────
//  Parcours France — types & helpers partagés
//  Source : data/dataset.json — VRAIS parcours d'OpenStreetMap (ODbL), toute la
//  France. Métadonnées en base ; la vraie géométrie GPS est chargée à la demande
//  via /api/parcours/geometry (au clic sur un parcours).
//  © les contributeurs OpenStreetMap.
// ─────────────────────────────────────────────────────────────────────────────

export type SportHdf = "Running" | "Trail" | "Randonnée" | "Vélo (Route)" | "VTT";
export type DiffHdf = "Facile" | "Moyen" | "Difficile";
export type TypeHdf = "Boucle" | "Aller simple";

export interface ParcoursHdf {
  id: number;
  osm_id?: number;
  osm_type?: string;
  nom: string;
  sport: SportHdf;
  difficulte: DiffHdf;
  type_parcours: TypeHdf;
  distance_km: number;
  denivele_positif_m: number;
  denivele_negatif_m: number;
  temps_estime: string;
  calories_kcal: number;
  pente_mean: string;
  altitude_min_m: number;
  altitude_max_m: number;
  lat?: number;
  lng?: number;
  localisation: { departement: string; region: string };
  description: string;
  coordinates?: [number, number][]; // géométrie GPS [lng,lat] si déjà connue
}

export const SPORTS: SportHdf[] = ["Running", "Trail", "Randonnée", "Vélo (Route)", "VTT"];
export const DIFFICULTES: DiffHdf[] = ["Facile", "Moyen", "Difficile"];
export const TYPES: TypeHdf[] = ["Boucle", "Aller simple"];

export const SPORT_META: Record<SportHdf, { label: string; emoji: string; color: string; chip: string }> = {
  "Running":      { label: "Running",   emoji: "🏃", color: "#f97316", chip: "bg-orange-100 text-orange-700" },
  "Trail":        { label: "Trail",     emoji: "🥾", color: "#16a34a", chip: "bg-emerald-100 text-emerald-700" },
  "Randonnée":    { label: "Randonnée", emoji: "🚶", color: "#14b8a6", chip: "bg-teal-100 text-teal-700" },
  "Vélo (Route)": { label: "Vélo",      emoji: "🚴", color: "#0ea5e9", chip: "bg-sky-100 text-sky-700" },
  "VTT":          { label: "VTT",       emoji: "🚵", color: "#d97706", chip: "bg-amber-100 text-amber-700" },
};

export const DIFF_META: Record<DiffHdf, { label: string; color: string }> = {
  "Facile":    { label: "Facile",    color: "#22c55e" },
  "Moyen":     { label: "Moyen",     color: "#3b82f6" },
  "Difficile": { label: "Difficile", color: "#ef4444" },
};

// Discipline du planificateur Trail Builder (clés stables, jamais traduites).
export type TrailActivity = "course" | "marche" | "trail" | "velo";
// Sport (valeur canonique des données) → activité du Trail Builder.
// Co-localisé avec les sports : le mapping ne dépend d'aucun libellé d'affichage,
// donc l'event « te:loadRoute » transporte directement l'activité (pas une chaîne FR à re-décoder).
export const SPORT_ACTIVITY: Record<SportHdf, TrailActivity> = {
  "Running":      "course",
  "Trail":        "trail",
  "Randonnée":    "marche",
  "Vélo (Route)": "velo",
  "VTT":          "velo",
};

// ─── Position de repli (déterministe) si un parcours n'a ni lat/lng ni géométrie ─
const FRANCE_CENTER = { lat: 46.6, lng: 2.3 };
export function coordFor(p: { lat?: number; lng?: number }): { lat: number; lng: number } {
  if (typeof p.lat === "number" && typeof p.lng === "number") return { lat: p.lat, lng: p.lng };
  return FRANCE_CENTER;
}

// ─── Facettes (régions + départements présents) pour les filtres pilotés data ───
export interface Facets {
  regions: string[];
  deptsByRegion: Record<string, string[]>;
}
export function computeFacets(all: ParcoursHdf[]): Facets {
  const sets: Record<string, Set<string>> = {};
  for (const p of all) {
    const r = p.localisation?.region, d = p.localisation?.departement;
    if (!r) continue;
    (sets[r] ??= new Set()).add(d);
  }
  const regions = Object.keys(sets).sort((a, b) => a.localeCompare(b, "fr"));
  const deptsByRegion: Record<string, string[]> = {};
  for (const r of regions) {
    deptsByRegion[r] = [...sets[r]].filter((d) => d && d !== "—").sort((a, b) => a.localeCompare(b, "fr"));
  }
  return { regions, deptsByRegion };
}

// ─── Filtres / tri ───────────────────────────────────────────────────────────────
export type SortKey = "recommande" | "proche" | "distance-asc" | "distance-desc" | "denivele-desc" | "denivele-asc" | "alpha";

export interface ParcoursQuery {
  q?: string;
  sport?: string;
  difficulte?: string;
  type?: string;
  region?: string;
  departement?: string;
  distMax?: number;
  sort?: SortKey;
  near?: { lat: number; lng: number };   // tri « proche » : position de l'utilisateur
}

// Distance à vol d'oiseau (km) — pour le tri « Près de moi ».
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function filterAndSort(all: ParcoursHdf[], query: ParcoursQuery): ParcoursHdf[] {
  const q = (query.q ?? "").trim().toLowerCase();
  let list = all.filter((p) => {
    if (query.sport && query.sport !== "all" && p.sport !== query.sport) return false;
    if (query.difficulte && query.difficulte !== "all" && p.difficulte !== query.difficulte) return false;
    if (query.type && query.type !== "all" && p.type_parcours !== query.type) return false;
    if (query.region && query.region !== "all" && p.localisation.region !== query.region) return false;
    if (query.departement && query.departement !== "all" && p.localisation.departement !== query.departement) return false;
    if (typeof query.distMax === "number" && query.distMax < 100 && p.distance_km > 0 && p.distance_km > query.distMax) return false;
    if (q) {
      const hay = `${p.nom} ${p.localisation.departement} ${p.localisation.region}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  switch (query.sort) {
    case "distance-asc":  list = [...list].sort((a, b) => a.distance_km - b.distance_km); break;
    case "distance-desc": list = [...list].sort((a, b) => b.distance_km - a.distance_km); break;
    case "denivele-desc": list = [...list].sort((a, b) => (b.denivele_positif_m || 0) - (a.denivele_positif_m || 0)); break;
    case "denivele-asc":  list = [...list].sort((a, b) => (a.denivele_positif_m || 0) - (b.denivele_positif_m || 0)); break;
    case "proche": {
      // « Près de moi » : tri par distance à vol d'oiseau depuis la position de l'utilisateur.
      const n = query.near;
      if (n) {
        list = [...list].sort((a, b) => {
          const da = a.lat != null && a.lng != null ? haversineKm(n.lat, n.lng, a.lat, a.lng) : Infinity;
          const db = b.lat != null && b.lng != null ? haversineKm(n.lat, n.lng, b.lat, b.lng) : Infinity;
          return da - db;
        });
      }
      break;
    }
    case "alpha":         list = [...list].sort((a, b) => a.nom.localeCompare(b.nom, "fr")); break;
    default: break; // recommande : ordre du dataset
  }
  return list;
}
