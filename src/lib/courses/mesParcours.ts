/**
 * « MES PARCOURS » — les traces GPS des dernières sorties de l'athlète, dessinées en bleu
 * sous sa position sur l'écran Enregistrer (Cyprien, 27/11/2026, vidéo de Strava à
 * l'appui : la carte de Strava est couverte des lignes bleues des parcours courus).
 *
 * Strava montre les parcours de TOUS ses membres : c'est sa donnée. Nous montrons les
 * siens, à lui seul — sa propre carte de chaleur, celle que Strava appelle
 * « Personnelle ». Rien d'inventé : sans trace importée, la couche est vide.
 *
 * ⚠️ LE POIDS. Une trace fait des milliers de points ; trente traces brutes, plusieurs
 * centaines de kilo-octets envoyés au téléphone avant que la carte s'affiche. Chaque
 * trace est donc RÉDUITE à un point sur N (au plus `MAX_POINTS`), et chaque coordonnée
 * arrondie à 5 décimales (environ 1 m) — la précision de la polyligne d'origine.
 */
import { decodePolyline } from "@/lib/segments/geo";

export const MAX_PARCOURS = 30;
export const MAX_POINTS = 120;

const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

/** Polylignes encodées → traces allégées [lat, lon][], sans trace vide ni invalide. */
export function allegerParcours(polylignes: (string | null | undefined)[], maxPoints = MAX_POINTS): [number, number][][] {
  const sorties: [number, number][][] = [];
  for (const p of polylignes.slice(0, MAX_PARCOURS)) {
    if (!p) continue;
    let pts: { lat: number; lon: number }[];
    try { pts = decodePolyline(p); } catch { continue; }
    pts = pts.filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lon) && Math.abs(q.lat) <= 90 && Math.abs(q.lon) <= 180);
    if (pts.length < 2) continue;
    const pas = Math.max(1, Math.ceil(pts.length / maxPoints));
    const garde = pts.filter((_, i) => i % pas === 0);
    // Le dernier point est gardé : sans lui, chaque trace s'arrête avant l'arrivée.
    const dernier = pts[pts.length - 1];
    if (garde[garde.length - 1] !== dernier) garde.push(dernier);
    sorties.push(garde.map((q) => [r5(q.lat), r5(q.lon)]));
  }
  return sorties;
}
