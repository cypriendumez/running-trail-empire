// ─────────────────────────────────────────────────────────────────────────────
//  LA PENTE DE L'ATHLÈTE — progresse-t-il, et à quelle vitesse ?
//
//  Le coach savait dire où en est l'athlète AUJOURD'HUI. Il ne savait pas dire s'il
//  MONTE. Conséquence directe, mesurée le 06/09/2026 : le verdict sur l'objectif
//  (« atteignable », « ambitieux », « irréaliste ») reposait sur une amélioration
//  SUPPOSÉE de 0,4 %/semaine, la même pour tout le monde. Deux athlètes de forme
//  identique recevaient donc le même verdict, que l'un progresse et l'autre stagne.
//
//  MARQUEUR RETENU : l'efficacité aérobie — vitesse par battement de cœur, sur les
//  seules sorties faciles. Un premier essai par « meilleur effort du bloc » a été
//  ÉCARTÉ après mesure : la série sautait de 16,6 à 19,8 km/h d'un bloc à l'autre
//  parce qu'elle dépend de savoir si l'athlète a fait une séance dure ce mois-là, pas
//  de sa forme. L'efficacité, elle, se mesure à chaque footing : sur le même compte,
//  rapport signal/bruit de 3,6 contre un bruit dominant pour l'autre méthode.
//
//  ⚠️ CE MARQUEUR A UN BIAIS CONNU, ET IL FAUT LE DIRE : la chaleur le fait baisser à
//  forme égale. Une pente mesurée d'avril à août est donc pessimiste par construction.
//  C'est pourquoi cette pente MODÈRE l'hypothèse générique au lieu de la remplacer, et
//  que le module rend toujours de quoi nuancer (nombre de blocs, signal/bruit).
// ─────────────────────────────────────────────────────────────────────────────

export type CourseEfficacite = {
  date: string; distance_km?: number | null; duration_seconds?: number | null; avg_hr?: number | null;
};

/** Un bloc de mesure. Quatre semaines : assez pour lisser, assez court pour bouger. */
export const JOURS_BLOC = 28;
/** Sous ce nombre de sorties, la médiane d'un bloc n'en est pas une. */
export const SEANCES_PAR_BLOC = 3;
/** Sous ce nombre de blocs, il n'y a pas de tendance, seulement deux points. */
export const BLOCS_MIN = 4;
/** En dessous, le bruit domine : on refuse de conclure. */
export const SIGNAL_SUR_BRUIT_MIN = 2;
/** Au-delà, ce n'est plus une sortie facile : l'efficacité n'y veut plus dire la même chose. */
export const PART_FC_FACILE = 0.85;

export type Tendance = {
  /** Pente en % d'efficacité par semaine. Négative = l'athlète recule. */
  pctParSemaine: number;
  blocs: number;
  signalSurBruit: number;
  /** Semaines couvertes par la mesure — une pente sur 8 semaines ne vaut pas une sur 30. */
  semaines: number;
};

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const mediane = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * Efficacité médiane par bloc de 4 semaines : vitesse (km/h) par battement, ×1000.
 * L'unité n'a pas de sens en soi — seule son ÉVOLUTION en a.
 */
export function efficaciteParBloc(
  runs: readonly CourseEfficacite[], fcMax: number | null, maintenant = Date.now(), blocsMax = 9,
): { bloc: number; valeur: number; seances: number }[] {
  const paquets = new Map<number, number[]>();
  for (const r of runs ?? []) {
    const km = fini(r.distance_km) ? r.distance_km : null;
    const sec = fini(r.duration_seconds) ? r.duration_seconds : null;
    const fc = fini(r.avg_hr) ? r.avg_hr : null;
    if (km == null || sec == null || fc == null || km < 3 || sec <= 0 || fc < 60) continue;
    // Sorties FACILES seulement : sur une séance dure, la vitesse par battement monte
    // sans que la forme ait changé — on mesurerait l'intensité, pas le progrès.
    if (fcMax != null && fc / fcMax >= PART_FC_FACILE) continue;
    const t = Date.parse(String(r.date ?? "").slice(0, 10) + "T12:00:00Z");
    if (!Number.isFinite(t)) continue;
    const bloc = Math.floor((maintenant - t) / (JOURS_BLOC * 86400000));
    if (bloc < 0 || bloc >= blocsMax) continue;
    const vitesse = km / (sec / 3600);
    if (!(vitesse > 3) || !(vitesse < 30)) continue;   // ni marche, ni vélo étiqueté course
    if (!paquets.has(bloc)) paquets.set(bloc, []);
    paquets.get(bloc)!.push((vitesse / fc) * 1000);
  }
  return [...paquets.entries()]
    .filter(([, v]) => v.length >= SEANCES_PAR_BLOC)
    .map(([bloc, v]) => ({ bloc, valeur: mediane(v), seances: v.length }))
    .sort((a, b) => b.bloc - a.bloc);
}

/**
 * Pente de l'efficacité, en % par semaine. Rend `null` quand on ne peut pas conclure —
 * pas assez de blocs, ou trop de dispersion pour distinguer une tendance du hasard.
 */
export function tendanceEfficacite(serie: readonly { bloc: number; valeur: number }[]): Tendance | null {
  const pts = (serie ?? []).filter((p) => fini(p.valeur) && p.valeur > 0);
  if (pts.length < BLOCS_MIN) return null;
  // x en SEMAINES, croissant vers le présent (bloc 0 = le plus récent).
  const xs = pts.map((p) => -p.bloc * (JOURS_BLOC / 7));
  const ys = pts.map((p) => p.valeur);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const varX = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (!(varX > 0) || !(my > 0)) return null;
  const pente = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / varX;
  const residu = Math.sqrt(xs.reduce((s, x, i) => s + (ys[i] - (my + pente * (x - mx))) ** 2, 0) / n);
  const etendue = Math.max(...xs) - Math.min(...xs);
  // Signal : ce que la pente fait gagner (ou perdre) sur toute la période mesurée.
  // Bruit : ce dont les points s'écartent de la droite. Sous 2, on ne conclut pas.
  const rapport = residu > 0 ? Math.abs((pente * etendue) / residu) : Infinity;
  if (!(rapport >= SIGNAL_SUR_BRUIT_MIN)) return null;
  return {
    pctParSemaine: Math.round((pente / my) * 10000) / 100,
    blocs: n,
    signalSurBruit: Math.round(rapport * 100) / 100,
    semaines: Math.round(etendue),
  };
}

/** Hypothèse générique du modèle : ~0,4 %/semaine, plafonnée à 8 % sur le bloc. */
export const GAIN_GENERIQUE_SEMAINE = 0.004;
export const GAIN_MAX = 0.08;

/**
 * Amélioration à attendre d'ici la course, en fraction du chrono actuel.
 *
 * ⚠️ La pente mesurée MODÈRE l'hypothèse générique, elle ne la remplace pas — et pour
 * une raison précise : l'efficacité aérobie baisse avec la chaleur à forme égale, donc
 * une pente mesurée sur un été est pessimiste. On retient la moitié de l'écart entre
 * hypothèse et mesure, et on ne promet JAMAIS de gain à un athlète qui recule.
 */
export function ameliorationAttendue(semainesAvantCourse: number | null, tendance: Tendance | null): number {
  const sem = fini(semainesAvantCourse) ? Math.max(0, semainesAvantCourse) : 0;
  if (sem === 0) return 0;
  if (!tendance) return Math.min(GAIN_MAX, sem * GAIN_GENERIQUE_SEMAINE);
  const mesuree = tendance.pctParSemaine / 100;
  const retenue = (GAIN_GENERIQUE_SEMAINE + mesuree) / 2;
  // Un athlète qui recule ne se voit pas promettre de progrès ; on ne lui prédit pas
  // non plus une dégradation, ce serait aussi présomptueux dans l'autre sens.
  return Math.min(GAIN_MAX, Math.max(0, sem * retenue));
}
