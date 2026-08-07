export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { denyIfAnonymous } from "@/lib/api/adminGuard";

// Géométrie GPS réelle chargée à la demande depuis OpenStreetMap (Overpass, ODbL).
// Mise en cache mémoire : une géométrie de parcours ne change quasiment jamais.
const CACHE = new Map<string, [number, number][]>();

interface OsmGeomPt { lat: number; lon: number }
interface OsmWay { type: "way"; geometry?: OsmGeomPt[] }
interface OsmRelation { type: "relation"; members?: Array<{ type: string; geometry?: OsmGeomPt[] }> }
type OsmEl = OsmWay | OsmRelation | { type: string };

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function assemble(elements: OsmEl[]): [number, number][] {
  // Récupère chaque tronçon (way) séparément.
  const segs: [number, number][][] = [];
  const addWay = (geom?: OsmGeomPt[]) => {
    if (!geom || geom.length < 2) return;
    segs.push(geom.map((g) => [g.lon, g.lat] as [number, number]));
  };
  // Avec ">>", Overpass renvoie TOUS les tronçons (y compris ceux des
  // sous-relations) comme éléments "way" autonomes → on ne lit que ceux-là
  // (gère les super-relations, sans double comptage).
  for (const el of elements) {
    if (el.type === "way") addWay((el as OsmWay).geometry);
  }
  return chainSegments(segs);
}

// Les membres d'une relation OSM ne sont PAS ordonnés bout-à-bout, et une route
// peut être faite de plusieurs morceaux. On construit d'abord des chaînes
// maximales (par tronçons qui se touchent), puis on les relie par proximité.
function chainSegments(segs: [number, number][][]): [number, number][] {
  const valid = segs.filter((s) => s.length >= 2);
  if (valid.length <= 1) return dedup(valid[0] ?? []);
  // Tolérance ~5 m : raccorde les tronçons qui se touchent (petits écarts d'arrondi).
  const eq = (a: [number, number], b: [number, number]) =>
    Math.abs(a[0] - b[0]) < 5e-5 && Math.abs(a[1] - b[1]) < 5e-5;
  const used = new Array(valid.length).fill(false);

  // 1) Chaînes maximales (chaque composant connexe est chaîné proprement).
  const chains: [number, number][][] = [];
  for (let start = 0; start < valid.length; start++) {
    if (used[start]) continue;
    let chain = valid[start].slice();
    used[start] = true;
    let extended = true;
    while (extended) {
      extended = false;
      const head = chain[0], tail = chain[chain.length - 1];
      for (let i = 0; i < valid.length; i++) {
        if (used[i]) continue;
        const s = valid[i], a = s[0], b = s[s.length - 1];
        if (eq(tail, a)) chain = chain.concat(s.slice(1));
        else if (eq(tail, b)) chain = chain.concat(s.slice(0, -1).reverse());
        else if (eq(head, b)) chain = s.slice(0, -1).concat(chain);
        else if (eq(head, a)) chain = s.slice(1).reverse().concat(chain);
        else continue;
        used[i] = true; extended = true; break;
      }
    }
    chains.push(chain);
  }
  if (chains.length === 1) return dedup(chains[0]);

  // 2) On garde la PLUS LONGUE chaîne, puis on ne lui rattache que les chaînes
  //    séparées par un PETIT trou (< 250 m). On ne relie JAMAIS deux morceaux
  //    éloignés par un trait droit → plus de ligne à travers l'eau / les champs.
  const GAP_KM = 0.25;
  chains.sort((a, b) => chainKm(b) - chainKm(a));
  const usedC = new Array(chains.length).fill(false);
  let result = chains[0].slice();
  usedC[0] = true;
  let added = true;
  while (added) {
    added = false;
    const head = result[0], tail = result[result.length - 1];
    let best = -1, rev = false, prepend = false, bestGap = Infinity;
    for (let i = 0; i < chains.length; i++) {
      if (usedC[i]) continue;
      const c = chains[i], a = c[0], b = c[c.length - 1];
      const tA = havKm(tail, a), tB = havKm(tail, b), hA = havKm(head, a), hB = havKm(head, b);
      if (tA < bestGap) { bestGap = tA; best = i; rev = false; prepend = false; }
      if (tB < bestGap) { bestGap = tB; best = i; rev = true; prepend = false; }
      if (hB < bestGap) { bestGap = hB; best = i; rev = false; prepend = true; }
      if (hA < bestGap) { bestGap = hA; best = i; rev = true; prepend = true; }
    }
    if (best >= 0 && bestGap < GAP_KM) {
      usedC[best] = true; added = true;
      const c = rev ? chains[best].slice().reverse() : chains[best];
      result = prepend ? c.concat(result) : result.concat(c);
    }
  }
  return dedup(result);
}

function havKm(a: [number, number], b: [number, number]): number {
  const R = 6371, dLat = ((b[1] - a[1]) * Math.PI) / 180, dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function chainKm(c: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < c.length; i++) d += havKm(c[i - 1], c[i]);
  return d;
}

function dedup(chain: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of chain) {
    const l = out[out.length - 1];
    if (!l || Math.abs(l[0] - p[0]) >= 1e-9 || Math.abs(l[1] - p[1]) >= 1e-9) out.push(p);
  }
  return out;
}

export async function GET(req: NextRequest) {
  // Interroge Overpass, un service communautaire GRATUIT aux quotas stricts. Laisser la
  // route ouverte aux requêtes anonymes, c'est risquer de faire bannir l'adresse IP de
  // l'application pour tout le monde.
  const denied = await denyIfAnonymous();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type") === "way" ? "way" : "relation";
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: "id invalide" }, { status: 400 });

  const key = `${type}/${id}`;
  const cached = CACHE.get(key);
  if (cached) return NextResponse.json({ coordinates: cached, cached: true });

  // ">>" (recurse down) récupère AUSSI la géométrie des sous-relations
  // (super-relations) ; sans ça certaines routes renvoyaient un tracé vide.
  const q = `[out:json][timeout:60];${type}(${id});${type === "relation" ? ">>;" : ""}out geom;`;
  for (let i = 0; i < ENDPOINTS.length; i++) {
    try {
      const res = await fetch(ENDPOINTS[i], {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "RunningTrailEmpire/1.0 (parcours; ODbL)",
        },
        body: "data=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const coords = assemble(json.elements ?? []);
      if (coords.length > 1) {
        if (CACHE.size > 2000) CACHE.clear();
        CACHE.set(key, coords);
        return NextResponse.json({ coordinates: coords });
      }
    } catch {
      /* on tente le miroir suivant */
    }
  }
  return NextResponse.json({ error: "Géométrie indisponible pour le moment." }, { status: 502 });
}
