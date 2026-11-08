/**
 * IMPORT D'UN FICHIER GPX — ce qui décide qu'une activité importée COMPTE.
 *
 * ⚠️ UNE COURSE IMPORTÉE N'ENTRAIT PAS DANS LES RECORDS. La route écrivait la séance sans
 * `sport` ; or la carte « Records personnels » ne lit que `sport = run`. Cas réel : Cyprien
 * veut retrouver son semi en 1 h 15 de 2024, absent d'intervals.icu (dont l'historique
 * Garmin commence le 26/04/2025) — le seul chemin était d'exporter le GPX de Garmin
 * Connect et de l'importer… pour une séance qui serait restée invisible. Relevé le
 * 28/09/2026.
 *
 * ⚠️ ET LE MÊME FICHIER S'IMPORTAIT DEUX FOIS. Rien ne reconnaissait une activité déjà
 * importée : un second clic doublait la séance, donc le volume de la semaine.
 */
export type SportGpx = "run" | "bike" | "hike" | "walk" | "swim" | "other";

/** Au-delà, ce n'est pas de la course à pied : 22 km/h tient un 10 km en 27 min. */
export const VITESSE_MAX_COURSE_KMH = 22;

/**
 * Le sport d'un fichier GPX. Garmin Connect écrit `<type>running</type>` (ou
 * `trail_running`, `cycling`, `hiking`…), Strava un code numérique (9 = course, 1 = vélo,
 * 4 = randonnée, 10 = marche). Sans type, la vitesse tranche entre course et vélo — et
 * l'absence de vitesse ne tranche rien : `null`, plutôt qu'une supposition.
 */
export function sportDuGpx(xml: string, distanceKm: number, dureeSec: number): SportGpx | null {
  const brut = (String(xml ?? "").match(/<trk>[\s\S]*?<type>\s*([^<]+?)\s*<\/type>/i)?.[1] ?? "").toLowerCase();
  if (brut) {
    if (/run|jog/.test(brut) || brut === "9") return "run";
    if (/cycl|bik|ride/.test(brut) || brut === "1") return "bike";
    if (/hik/.test(brut) || brut === "4") return "hike";
    if (/walk/.test(brut) || brut === "10") return "walk";
    if (/swim/.test(brut)) return "swim";
    return "other";
  }
  if (!(distanceKm > 0) || !(dureeSec > 0)) return null;
  return distanceKm / (dureeSec / 3600) <= VITESSE_MAX_COURSE_KMH ? "run" : "bike";
}

/**
 * Identifiant stable d'une activité importée : l'instant de son PREMIER point. Deux
 * exports du même fichier le partagent ; deux sorties différentes, jamais.
 */
export function idExterneGpx(premierInstant: string | null | undefined): string | null {
  const t = Date.parse(String(premierInstant ?? ""));
  return Number.isFinite(t) ? `gpx:${new Date(t).toISOString()}` : null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  LECTURE D'UN GPX : nom, points (`<trkpt>`), altitude et heure de passage.
//  Sortie de la route d'import le 08/11/2026 pour être testée sur de vrais fichiers.
// ─────────────────────────────────────────────────────────────────────────────
export function parseGPX(xml: string): { name: string; points: { lat: number; lng: number; ele?: number; time?: string }[] } {
  const nameMatch = xml.match(/<name>(.*?)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : "Activité importée";

  // Les attributs dans N'IMPORTE QUEL ordre, entre guillemets simples ou doubles (relecture du
  // 08/11/2026) : `lat` puis `lon` était seul lu, et un export `lon="…" lat="…"` arrivait vide,
  // refusé comme « sans trace ».
  const trkptRegex = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
  const attribut = (attrs: string, nom: string) => attrs.match(new RegExp(`\\b${nom}\\s*=\\s*["']([^"']+)["']`))?.[1];
  const points: { lat: number; lng: number; ele?: number; time?: string }[] = [];

  let m;
  while ((m = trkptRegex.exec(xml)) !== null) {
    const lat = parseFloat(attribut(m[1], "lat") ?? "");
    const lng = parseFloat(attribut(m[1], "lon") ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const inner = m[2] ?? "";
    const eleMatch = inner.match(/<ele>(.*?)<\/ele>/);
    const timeMatch = inner.match(/<time>(.*?)<\/time>/);
    points.push({
      lat,
      lng,
      ele: eleMatch ? parseFloat(eleMatch[1]) : undefined,
      time: timeMatch ? timeMatch[1] : undefined,
    });
  }
  return { name, points };
}
