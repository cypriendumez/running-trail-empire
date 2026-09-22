/**
 * L'ALTITUDE D'UN TRACÉ — échantillonnage, dénivelé honnête, et un échec qui se dit.
 *
 * ── TROIS DÉFAUTS MESURÉS LE 22/09/2026 dans le constructeur de parcours ─────────────
 *
 * 1. LE D+ ÉTAIT LA SOMME DE TOUTES LES MONTÉES, BRUIT COMPRIS. Le modèle d'altitude
 *    d'open-meteo a une résolution de ~90 m et une erreur verticale de quelques mètres :
 *    additionner chaque écart positif compte le bruit autant que les côtes. Sur un
 *    parcours vallonné, ça gonfle le D+ de dizaines de pour cent — et le D+ pilote la
 *    difficulté affichée, la durée estimée, et la séance que l'athlète en tire.
 *    → seuil d'hystérésis : une montée ne compte QUE si elle dépasse `SEUIL_M` depuis
 *      le dernier creux. C'est la méthode des GPS de randonnée.
 *
 * 2. 100 POINTS, QUELLE QUE SOIT LA LONGUEUR. Sur 3 km c'est un point tous les 30 m ;
 *    sur 40 km, un point tous les 400 m — chaque bosse de moins de 400 m disparaît, et
 *    le D+ est SOUS-estimé. → on interroge par paquets de 100 (la limite de l'API), avec
 *    un pas cible de ~50 m, plafonné à `POINTS_MAX` pour ne pas marteler le service.
 *
 * 3. UN ÉCHEC DE LECTURE RENDAIT DES ZÉROS. `new Array(n).fill(0)` : l'écran affichait
 *    « D+ 0 m », difficulté « facile », durée sans pénalité — un parcours de montagne
 *    présenté comme plat parce que le réseau a toussé. → on rend `null`, et l'interface
 *    dit « altitude indisponible ».
 *
 * Tout est pur sauf `chargerProfil` ; `tests/trace.test.ts` rejoue des profils connus.
 */

export type Point = { lat: number; lng: number };

/** Le pas visé entre deux mesures d'altitude, en mètres. */
export const PAS_CIBLE_M = 50;
/** Plafond de points interrogés : 5 paquets de 100 = 500 mesures, ~50 km au pas cible. */
export const POINTS_MAX = 500;
/** Une montée compte à partir de ce cumul, en mètres (bruit du modèle d'altitude). */
export const SEUIL_M = 5;

const R_TERRE_KM = 6371;

export function haversineKm(a: Point, b: Point): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R_TERRE_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function distanceKm(pts: Point[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversineKm(pts[i - 1], pts[i]);
  return d;
}

/**
 * Les indices à interroger : un point tous les ~`PAS_CIBLE_M`, extrémités comprises,
 * au plus `POINTS_MAX`. Rendre des INDICES (et non des points) permet de réétaler
 * ensuite les altitudes sur la trace complète sans se tromper d'alignement.
 */
export function indicesEchantillon(pts: Point[], pasM = PAS_CIBLE_M, max = POINTS_MAX): number[] {
  if (pts.length <= 2) return pts.map((_, i) => i);
  const total = distanceKm(pts) * 1000;
  const vise = Math.min(max, Math.max(2, Math.ceil(total / pasM) + 1));
  if (vise >= pts.length) return pts.map((_, i) => i);
  const idx: number[] = [];
  for (let k = 0; k < vise; k++) idx.push(Math.round((k * (pts.length - 1)) / (vise - 1)));
  // Les arrondis peuvent produire deux fois le même indice sur une trace très courte.
  return [...new Set(idx)];
}

/** Réétale les altitudes mesurées sur tous les points, en interpolant entre deux mesures. */
export function etaler(pts: number, indices: number[], mesures: number[]): number[] {
  if (indices.length === 0 || indices.length !== mesures.length) return [];
  const out = new Array<number>(pts);
  for (let k = 0; k < indices.length - 1; k++) {
    const i0 = indices[k], i1 = indices[k + 1];
    const a = mesures[k], b = mesures[k + 1];
    for (let i = i0; i < i1; i++) out[i] = a + ((b - a) * (i - i0)) / (i1 - i0 || 1);
  }
  for (let i = indices[indices.length - 1]; i < pts; i++) out[i] = mesures[mesures.length - 1];
  for (let i = 0; i < indices[0]; i++) out[i] = mesures[0];
  return out;
}

/**
 * Dénivelé positif et négatif avec hystérésis : on ne valide une montée que lorsqu'elle
 * dépasse `seuil` depuis le dernier point bas, et réciproquement. Le bruit de ±2 m du
 * modèle d'altitude ne franchit jamais le seuil ; une vraie côte, si.
 */
export function denivele(elevs: number[], seuil = SEUIL_M): { gain: number; perte: number } {
  if (elevs.length < 2) return { gain: 0, perte: 0 };
  let gain = 0, perte = 0;
  let ref = elevs[0];   // dernier point de retournement CONFIRMÉ
  let ext = elevs[0];   // extremum atteint depuis `ref`, dans le sens courant
  let bas = elevs[0], haut = elevs[0]; // utilisés tant que le sens est inconnu
  let sens: 0 | 1 | -1 = 0;
  for (let i = 1; i < elevs.length; i++) {
    const x = elevs[i];
    if (sens === 0) {
      // Tant qu'on n'a pas franchi le seuil, on ne sait pas si ça monte ou descend :
      // on suit les deux extrêmes, et c'est le premier franchissement qui tranche.
      bas = Math.min(bas, x); haut = Math.max(haut, x);
      if (haut - bas >= seuil) {
        if (x >= haut - 1e-9) { sens = 1; ref = bas; ext = haut; }
        else { sens = -1; ref = haut; ext = bas; }
      }
      continue;
    }
    if (sens === 1) {
      if (x >= ext) { ext = x; continue; }
      // Retournement confirmé seulement si la redescente dépasse le seuil.
      if (ext - x >= seuil) { gain += ext - ref; ref = ext; ext = x; sens = -1; }
      continue;
    }
    if (x <= ext) { ext = x; continue; }
    if (x - ext >= seuil) { perte += ref - ext; ref = ext; ext = x; sens = 1; }
  }
  // La dernière montée (ou descente) en cours compte aussi, si elle dépasse le seuil.
  if (sens === 1 && ext - ref >= seuil) gain += ext - ref;
  if (sens === -1 && ref - ext >= seuil) perte += ref - ext;
  return { gain: Math.round(gain), perte: Math.round(perte) };
}

export type Profil = { altitudes: number[]; gain: number; perte: number; min: number; max: number };

/**
 * Interroge open-meteo par paquets de 100 coordonnées (sa limite) et rend le profil
 * complet — ou `null` si UNE SEULE requête échoue.
 *
 * ⚠️ `null`, JAMAIS DES ZÉROS : un profil plat inventé se lit comme un fait sur l'écran
 * (D+ 0 m, difficulté facile, durée sans pénalité de montée). Mieux vaut dire « je ne
 * sais pas » — c'est ce que l'interface affiche.
 */
export async function chargerProfil(
  pts: Point[],
  opts: { fetch?: typeof fetch; signal?: AbortSignal; pasM?: number; max?: number } = {},
): Promise<Profil | null> {
  if (pts.length < 2) return null;
  const f = opts.fetch ?? fetch;
  const indices = indicesEchantillon(pts, opts.pasM ?? PAS_CIBLE_M, opts.max ?? POINTS_MAX);
  const mesures: number[] = [];
  for (let d = 0; d < indices.length; d += 100) {
    const lot = indices.slice(d, d + 100).map((i) => pts[i]);
    const lat = lot.map((p) => p.lat.toFixed(5)).join(",");
    const lng = lot.map((p) => p.lng.toFixed(5)).join(",");
    try {
      const r = await f(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, { signal: opts.signal });
      if (!r.ok) return null;
      const j = await r.json() as { elevation?: unknown };
      // ⚠️ ON VÉRIFIE LE TYPE BRUT, PAS `Number(v)` : `Number(null)` vaut 0, et
      // `Number.isFinite(0)` est vrai — un tableau de `null` passait donc pour un profil
      // au niveau de la mer. Mesuré en écrivant le test.
      const e = Array.isArray(j.elevation) ? j.elevation : null;
      // Un paquet incomplet fausserait l'alignement : on refuse tout le profil.
      if (!e || e.length !== lot.length || e.some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
      mesures.push(...(e as number[]));
    } catch { return null; }
  }
  const altitudes = etaler(pts.length, indices, mesures);
  if (altitudes.length !== pts.length) return null;
  const { gain, perte } = denivele(altitudes);
  return { altitudes, gain, perte, min: Math.round(Math.min(...mesures)), max: Math.round(Math.max(...mesures)) };
}

/**
 * Le profil OSRM qui correspond à l'activité.
 *
 * ⚠️ TOUT PASSAIT PAR `foot`, VÉLO COMPRIS : l'itinéraire d'un parcours à vélo suivait
 * les sentiers piétons, donc une distance et un temps qui ne correspondaient à rien de
 * roulable. Le serveur public OSRM n'expose que `foot`, `bike` et `car`.
 */
export function profilOsrm(activite: string): "foot" | "bike" {
  return activite === "velo" || activite === "vtt" || activite === "bike" ? "bike" : "foot";
}
