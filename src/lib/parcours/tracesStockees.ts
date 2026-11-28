import fs from "fs";
import path from "path";
import { gunzipSync } from "zlib";

/**
 * LES TRACÉS DU CATALOGUE, GARDÉS PAR PACEVO (28/11/2026).
 *
 * Avant : chaque tracé était relu à l'ouverture chez OpenStreetMap — dont l'API d'ÉDITION, que la
 * politique d'usage de l'OSMF réserve à l'édition (« not for read-only purposes or projects »,
 * operations.osmfoundation.org/policies/api) — ou au WFS de l'IGN. Désormais le catalogue garde
 * une copie SIMPLIFIÉE de chaque tracé (Douglas-Peucker, quelques mètres), écrite par
 * `scripts/parcours-traces-extraire.ts`, en « tranches » gzip de `data/traces/` (une tranche par
 * reste de l'identifiant), sous la licence du catalogue (ODbL, data/LICENCE.md). Une tranche lue
 * reste en mémoire : un tracé s'ouvre sans aucun appel réseau.
 */
export const TRANCHES = 128;
export const trancheDe = (id: number) => ((id % TRANCHES) + TRANCHES) % TRANCHES;

type LL = [number, number];

// ── Polyline encodée (format Google, précision 1e-5 ≈ 1 m) : 3 à 5 octets par point ────────────
export function encoder(coords: LL[]): string {
  let out = "", px = 0, py = 0;
  const un = (v: number) => { let s = v < 0 ? ~(v << 1) : v << 1; while (s >= 0x20) { out += String.fromCharCode((0x20 | (s & 0x1f)) + 63); s >>= 5; } out += String.fromCharCode(s + 63); };
  for (const [lon, lat] of coords) {
    const y = Math.round(lat * 1e5), x = Math.round(lon * 1e5);
    un(y - py); un(x - px); py = y; px = x;
  }
  return out;
}
export function decoder(s: string): LL[] {
  const out: LL[] = [];
  let i = 0, lat = 0, lon = 0;
  const un = () => { let r = 0, d = 0, b: number; do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << d; d += 5; } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < s.length) { lat += un(); lon += un(); out.push([lon / 1e5, lat / 1e5]); }
  return out;
}

/** Douglas-Peucker en mètres (plan local) : garde la forme, retire les points redondants. */
export function simplifier(c: LL[], toleranceM = 4): LL[] {
  if (c.length <= 2) return c.slice();
  const k = Math.cos((c[0][1] * Math.PI) / 180) * 111_320, m = 110_540;
  const xy = c.map(([lon, lat]) => [lon * k, lat * m]);
  const garde = new Uint8Array(c.length); garde[0] = garde[c.length - 1] = 1;
  const pile: [number, number][] = [[0, c.length - 1]];
  while (pile.length) {
    const [a, b] = pile.pop()!;
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let max = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((xy[i][0] - ax) * dx + (xy[i][1] - ay) * dy) / l2)) : 0;
      const d = Math.hypot(xy[i][0] - (ax + t * dx), xy[i][1] - (ay + t * dy));
      if (d > max) { max = d; idx = i; }
    }
    if (max > toleranceM && idx > 0) { garde[idx] = 1; pile.push([a, idx], [idx, b]); }
  }
  return c.filter((_, i) => garde[i]);
}

const TRANCHES_LUES = new Map<number, Record<string, string>>();

/** Le dossier des tranches (réglable pour les tests). */
export const dossierTraces = () => process.env.PACEVO_DOSSIER_TRACES ?? path.join(process.cwd(), "data", "traces");

/**
 * Le tracé gardé d'un parcours du catalogue, ou `null` s'il n'en a pas (la route relit alors la
 * source). ⚠️ Une tranche illisible n'est PAS « aucun tracé » silencieux : elle lève, la route le
 * journalise et retombe sur la source.
 */
export function traceStockee(id: number): LL[] | null {
  const t = trancheDe(id);
  if (!TRANCHES_LUES.has(t)) {
    // Une tranche ABSENTE est une panne (fichier non déployé, non versionné), pas « aucun tracé » :
    // elle lève — la route le journalise — et rien n'est retenu (relecture du 28/11/2026).
    const f = path.join(dossierTraces(), `${t}.json.gz`);
    TRANCHES_LUES.set(t, JSON.parse(gunzipSync(fs.readFileSync(f)).toString("utf8")));
  }
  const s = TRANCHES_LUES.get(t)?.[String(id)];
  return s ? decoder(s) : null;
}

/** Pour les tests : oublier les tranches lues. */
export function oublierTranches() { TRANCHES_LUES.clear(); }
