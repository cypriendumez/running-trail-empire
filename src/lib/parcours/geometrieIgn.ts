import { chainSegmentsMesure } from "@/lib/parcours/geometrie";
import { UA_PACEVOBOT } from "@/lib/races/robot";

/**
 * LE TRACÉ D'UN ITINÉRAIRE DE L'IGN (BD TOPO®, classe `itineraire_autre`, Licence Ouverte 2.0).
 *
 * 27/11/2026 : le catalogue reçoit des milliers d'itinéraires de la BD TOPO (Cyprien : « des
 * parcours partout en France »). Embarquer leurs tracés dans la fonction serveur l'alourdirait de
 * dizaines de Mo ; ils sont donc relus à la demande au service WFS de la Géoplateforme, par leur
 * identifiant IGN (`cleabs`), comme ceux d'OSM le sont chez OSM.
 */
const WFS = "https://data.geopf.fr/wfs/ows";
const DELAI_MS = 15_000;

/** Un identifiant IGN valable : rien d'autre ne part dans la requête (pas d'injection CQL). */
export const estCleabs = (s: string) => /^ITI_AUT_\d{16}$/.test(s);

export class ErreurIgn extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type LL = [number, number];

export async function geometrieIgn(cleabs: string, f: typeof fetch = fetch): Promise<{ coords: LL[]; totalKm: number; perduKm: number }> {
  if (!estCleabs(cleabs)) throw new ErreurIgn("identifiant IGN invalide", 400);
  const url = `${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:itineraire_autre&OUTPUTFORMAT=application/json&CQL_FILTER=${encodeURIComponent(`cleabs='${cleabs}'`)}`;
  const r = await f(url, { headers: { "User-Agent": UA_PACEVOBOT }, signal: AbortSignal.timeout(DELAI_MS) });
  // Un 404 HTTP = le SERVICE introuvable (adresse déplacée), pas l'itinéraire retiré : passager
  // pour nous (502), jamais le refus définitif réservé à « réponse sans itinéraire » ci-dessous.
  if (!r.ok) throw new ErreurIgn(`IGN ${r.status}`, r.status === 404 ? 502 : r.status);
  const j = await r.json() as { features?: { geometry?: { type: string; coordinates: unknown } }[] };
  const g = j.features?.[0]?.geometry;
  // Absent de l'IGN : retiré de la BD TOPO depuis l'import — un refus DÉFINITIF.
  if (!g) throw new ErreurIgn("itinéraire absent de la BD TOPO", 404);
  const segs = g.type === "LineString" ? [g.coordinates as LL[]] : g.type === "MultiLineString" ? (g.coordinates as LL[][]) : [];
  return chainSegmentsMesure(segs);
}
