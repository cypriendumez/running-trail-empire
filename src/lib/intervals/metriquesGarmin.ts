// ─────────────────────────────────────────────────────────────────────────────
//  MÉTRIQUES DE LA MONTRE → PROFIL : FUSIONNER, JAMAIS ÉCRASER PAR « RIEN ».
//
//  Constaté le 08/11/2026 : le cron (`days = 1`) et l'alerte intervals.icu synchronisent
//  une fenêtre courte. Garmin ne met la VO2max à jour qu'environ une fois par semaine :
//  dans une fenêtre d'un jour elle est presque toujours absente, alors que la FC de repos
//  ou la CTL y sont. La synchro écrivait pourtant `garmin_vo2max: null` et remplaçait
//  l'historique (120 points sur un an, écrits par la route du navigateur) par 0 ou 1
//  point. La VO2max mesurée et sa courbe disparaissaient pour quiconque n'ouvrait pas
//  l'app, et l'écran retombait sans le dire sur une estimation.
//
//  La règle était déjà celle de la synchro — « dernière valeur NON nulle par champ » —
//  mais seulement À L'INTÉRIEUR de la fenêtre. Elle vaut maintenant au-delà : une
//  fenêtre qui ne voit pas une valeur ne prouve pas qu'elle a cessé d'exister.
// ─────────────────────────────────────────────────────────────────────────────

export type PointVo2 = { date: string; v: number };

export type MetriquesGarmin = {
  vo2max: number | null;
  restingHR: number | null;
  lthr: number | null;
  maxHR: number | null;
  thresholdPaceSecPerKm: number | null;
  ctl: number | null;
  atl: number | null;
  rampRate: number | null;
  vo2maxHistory: PointVo2[];
  updatedAt: string;
};

const CHAMPS = ["vo2max", "restingHR", "lthr", "maxHR", "thresholdPaceSecPerKm", "ctl", "atl", "rampRate"] as const;

/** Points d'historique conservés : le graphique de tendance en lit au plus 120. */
export const POINTS_MAX = 120;

const nombre = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** L'historique d'une ligne `garmin_metrics` lue en base, nettoyé (ligne ancienne ou abîmée). */
function historiqueDe(x: unknown): PointVo2[] {
  if (!Array.isArray(x)) return [];
  return x.filter((p): p is PointVo2 =>
    !!p && typeof (p as PointVo2).date === "string" && nombre((p as PointVo2).v) != null && (p as PointVo2).v > 0);
}

/**
 * Les métriques à écrire : chaque champ prend la valeur NOUVELLE si la fenêtre en a vu
 * une, sinon garde la valeur déjà enregistrée. L'historique est l'union des deux, par
 * date (la valeur nouvelle l'emporte pour un même jour), en ordre chronologique.
 */
export function fusionnerMetriquesGarmin(existant: unknown, nouveau: MetriquesGarmin): MetriquesGarmin {
  const ancien = (existant && typeof existant === "object" ? existant : {}) as Record<string, unknown>;
  const fusion = { ...nouveau };
  for (const k of CHAMPS) fusion[k] = nombre(nouveau[k]) ?? nombre(ancien[k]);
  const parDate = new Map<string, number>();
  for (const p of historiqueDe(ancien.vo2maxHistory)) parDate.set(p.date, p.v);
  for (const p of historiqueDe(nouveau.vo2maxHistory)) parDate.set(p.date, p.v);
  fusion.vo2maxHistory = [...parDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, v }))
    .slice(-POINTS_MAX);
  return fusion;
}

/** Y a-t-il quelque chose à écrire ? Une fenêtre vide ne doit rien réécrire du tout. */
export function aDesMetriques(m: MetriquesGarmin): boolean {
  return CHAMPS.some((k) => m[k] != null) || m.vo2maxHistory.length > 0;
}
