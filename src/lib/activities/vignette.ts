// ─────────────────────────────────────────────────────────────────────────────
//  VIGNETTE DE TRACÉ — le dessin du parcours, sans carte.
//
//  Un fil d'activités façon Strava montre la forme du parcours sur chaque ligne.
//  Charger vingt cartes à tuiles pour cela coûterait vingt fois le réseau, vingt
//  fois l'attribution, et une page qui rame. Le tracé seul suffit à reconnaître
//  une sortie : on le dessine donc en SVG, calculé sur le serveur, envoyé comme
//  quelques centaines d'octets de chemin.
//
//  ⚠️ Un degré de longitude ne vaut un degré de latitude qu'à l'équateur. Sans la
//  correction en cos(latitude), une boucle serait étirée horizontalement de 35 %
//  à Rouen — le parcours deviendrait méconnaissable.
// ─────────────────────────────────────────────────────────────────────────────

export type Point = { lat: number; lon: number };
export type Vignette = { d: string; largeur: number; hauteur: number };

/** En dessous, il n'y a pas de forme à montrer (séance sur tapis, trace tronquée). */
export const POINTS_MIN = 8;

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Chemin SVG du tracé, ajusté dans une boîte `largeur × hauteur`, marges comprises.
 * Rend `null` dès que la trace ne permet pas de dessiner honnêtement quelque chose.
 */
export function cheminTrace(points: readonly Point[], largeur = 168, hauteur = 96, marge = 6): Vignette | null {
  if (!Array.isArray(points) || points.length < POINTS_MIN) return null;
  if (!(largeur > 2 * marge) || !(hauteur > 2 * marge)) return null;
  const pts = points.filter((p) => p && fini(p.lat) && fini(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
  if (pts.length < POINTS_MIN) return null;

  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  const latMin = Math.min(...lats), latMax = Math.max(...lats);
  const lonMin = Math.min(...lons), lonMax = Math.max(...lons);
  // Projection équirectangulaire locale : à l'échelle d'une sortie, elle est exacte
  // à quelques mètres près et ne coûte rien.
  const k = Math.cos(((latMin + latMax) / 2) * Math.PI / 180);
  const spanX = (lonMax - lonMin) * k, spanY = latMax - latMin;
  // Une trace immobile (GPS bloqué, tapis de course) n'a pas de forme : on ne
  // fabrique pas un dessin à partir de rien.
  if (!(spanX > 0) && !(spanY > 0)) return null;

  const boiteX = largeur - 2 * marge, boiteY = hauteur - 2 * marge;
  const echelle = Math.min(spanX > 0 ? boiteX / spanX : Infinity, spanY > 0 ? boiteY / spanY : Infinity);
  if (!fini(echelle) || echelle <= 0) return null;
  // Centrage : une sortie très allongée ne doit pas se coller au bord.
  const decX = marge + (boiteX - spanX * echelle) / 2;
  const decY = marge + (boiteY - spanY * echelle) / 2;

  const arrondi = (v: number) => Math.round(v * 10) / 10;
  const d = pts.map((p, i) => {
    const x = arrondi(decX + (p.lon - lonMin) * k * echelle);
    // Le nord est en HAUT : l'axe des y d'un SVG descend, la latitude monte.
    const y = arrondi(decY + (latMax - p.lat) * echelle);
    return `${i === 0 ? "M" : "L"}${x} ${y}`;
  }).join("");

  return { d, largeur, hauteur };
}
