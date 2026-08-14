// ─────────────────────────────────────────────────────────────────────────────
//  TEMPS INTERMÉDIAIRES — le découpage kilomètre par kilomètre d'une sortie.
//
//  Calculé depuis la trace GPS (position + temps + altitude), et non demandé à la
//  montre : intervals.icu n'expose pas les tours de la même façon selon l'appareil,
//  alors que la trace, elle, est toujours là dès qu'il y a du GPS.
// ─────────────────────────────────────────────────────────────────────────────
import { haversine, type TrackPoint } from "./geo";

/**
 * Vitesse en dessous de laquelle on considère l'athlète ARRÊTÉ, en m/s.
 * 0,5 m/s = 1,8 km/h : bien en dessous de la marche (~5 km/h), donc on n'exclut
 * jamais une portion réellement parcourue à pied — seulement les vrais arrêts.
 */
const SEUIL_ARRET = 0.5;

export type Split = {
  /** Numéro du kilomètre (1, 2, 3…). */
  km: number;
  /** Durée écoulée sur ce kilomètre, arrêts compris. */
  seconds: number;
  /**
   * Durée EN MOUVEMENT, arrêts exclus. C'est elle qui sert à l'allure.
   * Sur un ultra, un ravitaillement de vingt minutes transformait un kilomètre en
   * « 91:32 /km » — un chiffre exact mais absurde présenté comme une allure de course.
   */
  movingSeconds: number;
  /** Temps d'arrêt détecté sur ce kilomètre, en secondes (0 si aucun). */
  stoppedSeconds: number;
  /** Dénivelé du kilomètre, en mètres — `null` si la trace n'a pas d'altitude. */
  elevation: number | null;
  /** Distance réellement couverte : < 1 km pour le dernier tronçon. */
  distanceKm: number;
  /** Le dernier tronçon est presque toujours incomplet ; on le SIGNALE. */
  partial: boolean;
};

/**
 * Découpe une trace en kilomètres.
 *
 * ⚠️ LE DERNIER TRONÇON EST MARQUÉ `partial`. Une sortie de 12,01 km finit sur
 * 10 mètres : présenter son allure comme celle d'un kilomètre plein afficherait un
 * chrono aberrant — souvent spectaculairement rapide ou lent — au bas du tableau.
 * Strava masque ce détail ; on préfère le dire.
 */
export function computeSplits(points: TrackPoint[], seuilM = 1000): Split[] {
  if (points.length < 2) return [];
  const splits: Split[] = [];

  let cumul = 0;            // distance depuis le début du kilomètre courant
  let arret = 0;            // temps immobile accumulé sur ce kilomètre
  let debutT = points[0].t;
  let debutAlt = points[0].alt;
  let km = 1;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const d = haversine(a.lat, a.lon, b.lat, b.lon);
    const dt = b.t - a.t;
    cumul += d;
    // Intervalle passé à l'arrêt : on le compte à part plutôt que de le fondre dans
    // l'allure. Un `dt` nul ou négatif (horodatage douteux) n'est jamais compté.
    if (dt > 0 && d / dt < SEUIL_ARRET) arret += dt;
    if (cumul < seuilM) continue;

    const ecoule = Math.max(0, Math.round(b.t - debutT));
    splits.push({
      km, seconds: ecoule,
      movingSeconds: Math.max(1, ecoule - Math.round(arret)),
      stoppedSeconds: Math.round(arret),
      elevation: typeof b.alt === "number" && typeof debutAlt === "number" ? Math.round(b.alt - debutAlt) : null,
      distanceKm: cumul / 1000, partial: false,
    });
    km++; cumul = 0; arret = 0; debutT = b.t; debutAlt = b.alt;
  }

  // Reste : on ne le publie que s'il est significatif (au-delà de 50 m), sinon il
  // n'apporte rien et encombre le tableau d'une ligne à 3 secondes.
  const dernier = points[points.length - 1];
  if (cumul > 50) {
    const ecoule = Math.max(0, Math.round(dernier.t - debutT));
    splits.push({
      km, seconds: ecoule,
      movingSeconds: Math.max(1, ecoule - Math.round(arret)),
      stoppedSeconds: Math.round(arret),
      elevation: typeof dernier.alt === "number" && typeof debutAlt === "number" ? Math.round(dernier.alt - debutAlt) : null,
      distanceKm: cumul / 1000, partial: true,
    });
  }
  return splits;
}

/**
 * Allure d'un tronçon, en secondes par kilomètre.
 *
 * Calculée sur le temps EN MOUVEMENT et ramenée au kilomètre — les deux corrections
 * comptent. Sans la première, un ravitaillement de vingt minutes affiche « 91:32 /km ».
 * Sans la seconde, un reliquat de 200 m couru en 60 s affiche « 1:00 /km », un record
 * du monde apparent au bas de chaque sortie.
 */
export const splitPace = (s: Split): number | null =>
  s.distanceKm > 0 ? s.movingSeconds / s.distanceKm : null;

/**
 * Profil d'altitude ramené à `cible` points, pour un tracé lisible.
 * `null` si la trace ne porte pas d'altitude — on n'affiche pas un profil plat
 * inventé là où la donnée manque.
 */
export function elevationProfile(points: TrackPoint[], cible = 120): { d: number; alt: number }[] | null {
  const avecAlt = points.filter((p) => typeof p.alt === "number");
  if (avecAlt.length < points.length / 2 || avecAlt.length < 4) return null;

  let cumul = 0;
  const bruts: { d: number; alt: number }[] = [{ d: 0, alt: points[0].alt as number }];
  for (let i = 1; i < points.length; i++) {
    cumul += haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    if (typeof points[i].alt === "number") bruts.push({ d: cumul / 1000, alt: points[i].alt as number });
  }
  const pas = Math.max(1, Math.floor(bruts.length / cible));
  const out = bruts.filter((_, i) => i % pas === 0);
  // Le dernier point est toujours conservé : sans lui le profil s'arrête avant la fin
  // et la distance affichée ne colle plus à celle de la séance.
  if (out[out.length - 1] !== bruts[bruts.length - 1]) out.push(bruts[bruts.length - 1]);
  return out;
}

/**
 * Série lissée d'une métrique le long de la sortie, pour tracer une courbe.
 *
 * Renvoie `null` si la métrique est absente de plus de la moitié des points : une
 * courbe reconstituée à partir de quelques valeurs éparses serait une invention
 * graphique, pas une mesure.
 */
export function metricSeries(
  points: TrackPoint[],
  lire: (p: TrackPoint) => number | null | undefined,
  cible = 120,
): { d: number; v: number }[] | null {
  const connus = points.filter((p) => typeof lire(p) === "number");
  if (connus.length < points.length / 2 || connus.length < 4) return null;

  let cumul = 0;
  const bruts: { d: number; v: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i > 0) cumul += haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    const v = lire(points[i]);
    if (typeof v === "number") bruts.push({ d: cumul / 1000, v });
  }
  if (bruts.length < 4) return null;

  // Moyenne par tranche : garde la forme de la courbe sans son bruit seconde par
  // seconde, qui rendrait le tracé illisible sur 3 000 points.
  const parTranche = Math.max(1, Math.ceil(bruts.length / cible));
  const out: { d: number; v: number }[] = [];
  for (let i = 0; i < bruts.length; i += parTranche) {
    const t = bruts.slice(i, i + parTranche);
    out.push({ d: t[t.length - 1].d, v: t.reduce((s, x) => s + x.v, 0) / t.length });
  }
  return out;
}
