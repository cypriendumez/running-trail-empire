export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { filterAndSort, computeFacets, type ParcoursHdf, type SortKey, type Facets, type SportHdf, type DiffHdf, type TypeHdf } from "@/data/parcoursHdf";

// VRAIS parcours France (OpenStreetMap / ODbL). Lu une fois puis gardé en mémoire.
let CACHE: ParcoursHdf[] | null = null;
let FACETS: Facets | null = null;

// Priorité aux parcours CERTIFIÉS par le crawl (~15 000 vérifiés : vraie distance/D+/difficulté/nom) ;
// repli sur la liste brute si le fichier certifié est absent.
const CANDIDATES: { file: string; certified: boolean }[] = [
  { file: "parcours_certifies.json", certified: true },
  { file: "dataset_france.json", certified: false },
  { file: "dataset.json", certified: false },
];

// Entrée du fichier certifié → forme ParcoursHdf attendue par l'app (localisation, pente_mean, id…).
type RawCertified = {
  osm_id?: number; osm_type?: string; nom?: string; sport?: string; difficulte?: string; type_parcours?: string;
  distance_km?: number; denivele_positif_m?: number; denivele_negatif_m?: number; temps_estime?: string;
  calories_kcal?: number; pente_max_pct?: number; altitude_min_m?: number; altitude_max_m?: number;
  lat?: number; lng?: number; region?: string; departements?: string[] | string; depart?: string; arrivee?: string;
};
function mapCertified(p: RawCertified): ParcoursHdf {
  return {
    id: Number(p.osm_id) || 0,
    osm_id: p.osm_id, osm_type: p.osm_type,
    nom: p.nom ?? "Parcours",
    sport: (p.sport ?? "Trail") as SportHdf,
    difficulte: (p.difficulte ?? "Moyen") as DiffHdf,
    type_parcours: (p.type_parcours ?? "Boucle") as TypeHdf,
    distance_km: p.distance_km ?? 0,
    denivele_positif_m: p.denivele_positif_m ?? 0,
    denivele_negatif_m: p.denivele_negatif_m ?? 0,
    temps_estime: p.temps_estime ?? "",
    calories_kcal: p.calories_kcal ?? 0,
    pente_mean: p.pente_max_pct != null ? `${p.pente_max_pct}%` : "",
    altitude_min_m: p.altitude_min_m ?? 0,
    altitude_max_m: p.altitude_max_m ?? 0,
    lat: p.lat, lng: p.lng,
    localisation: { region: p.region ?? "", departement: Array.isArray(p.departements) ? (p.departements[0] ?? "") : (p.departements ?? "") },
    description: [p.depart, p.arrivee].filter(Boolean).join(" → "),
  };
}

function load(): ParcoursHdf[] {
  if (CACHE) return CACHE;
  for (const c of CANDIDATES) {
    const file = path.join(process.cwd(), "data", c.file);
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
        CACHE = c.certified ? (raw as RawCertified[]).map(mapCertified) : (raw as ParcoursHdf[]);
        FACETS = computeFacets(CACHE);
        return CACHE;
      }
    } catch {
      /* fichier illisible → on tente le suivant */
    }
  }
  CACHE = [];
  FACETS = { regions: [], deptsByRegion: {} };
  return CACHE;
}

export async function GET(req: NextRequest) {
  const all = load();
  if (all.length === 0) {
    return NextResponse.json(
      { error: "Dataset introuvable. Lancez la collecte (node collecte_france.js).", items: [], total: 0, page: 1, pageSize: 0, totalPages: 0, facets: { regions: [], deptsByRegion: {} } },
      { status: 503 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const distMaxRaw = sp.get("distMax");
  // near=lat,lng → tri « Près de moi » (position approximative, jamais stockée).
  const nearRaw = (sp.get("near") ?? "").split(",").map(Number);
  const near = nearRaw.length === 2 && isFinite(nearRaw[0]) && isFinite(nearRaw[1])
    ? { lat: nearRaw[0], lng: nearRaw[1] } : undefined;
  const filtered = filterAndSort(all, {
    q: sp.get("q") ?? undefined,
    sport: sp.get("sport") ?? undefined,
    difficulte: sp.get("difficulte") ?? undefined,
    type: sp.get("type") ?? undefined,
    region: sp.get("region") ?? undefined,
    departement: sp.get("departement") ?? undefined,
    distMax: distMaxRaw ? Number(distMaxRaw) : undefined,
    sort: (sp.get("sort") as SortKey) ?? undefined,
    near,
  });

  const pageSize = Math.min(60, Math.max(1, Number(sp.get("pageSize")) || 12));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(sp.get("page")) || 1));
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return NextResponse.json({
    items,
    total: filtered.length,
    page,
    pageSize,
    totalPages,
    facets: FACETS ?? { regions: [], deptsByRegion: {} },
  });
}
