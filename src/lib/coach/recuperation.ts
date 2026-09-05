// ─────────────────────────────────────────────────────────────────────────────
//  DEUX SIGNAUX DE RÉCUPÉRATION QUE LE COACH NE VOYAIT PAS
//
//  Mesuré sur les 55 nuits réelles du compte de l'éditeur, ces deux règles ajoutent
//  3 déclenchements que l'ancien code laissait passer — et à chaque fois il disait
//  « fonce » :
//
//  1. DETTE DE SOMMEIL. L'ancienne règle ne regardait QUE la nuit dernière. Un athlète
//     qui dort 3 h 23, puis 5 h 13, puis 6 h 51 finit sa 3ᵉ nuit « correcte » : aucun
//     signal, alors qu'il lui manque 4,4 h de sommeil. (Cas réels : 14/06 et 03/08.)
//
//  2. CHUTE AIGUË DE VFC. L'ancienne règle comparait la moyenne de 7 jours aux 7 jours
//     précédents. Une seule mauvaise matinée ne déplace presque pas une moyenne de 7 j :
//     le 17/06, VFC à 76 contre une base à 103 (−27 %) et la tendance hebdomadaire était
//     … EN HAUSSE. Le coach donnait donc le feu vert le matin le plus dégradé du mois.
//
//  Aucune de ces fonctions n'invente : quand la donnée manque ou est trop maigre pour
//  conclure, elles renvoient `null` et l'appelant n'affiche rien.
// ─────────────────────────────────────────────────────────────────────────────

/** Une nuit telle que la montre la fournit. `total_sleep_min` peut manquer. */
export type Nuit = { date: string; total_sleep_min: number | null };
/** Une mesure de variabilité cardiaque. `hrv_ms` peut manquer. */
export type MesureVfc = { date: string; hrv_ms: number | null };

/** Nombre de nuits sur lesquelles la dette se cumule. */
export const NUITS_DETTE = 3;
/** Dette à partir de laquelle la tolérance à l'intensité est atteinte : 2 h 30 cumulées. */
export const DETTE_MIN = 150;
/** Sous ce nombre de nuits mesurées, on ne connaît pas l'habitude de l'athlète. */
export const NUITS_HABITUDE_MIN = 7;
/** Chute d'un matin, en % sous sa propre base, qui vaut un avertissement. */
export const CHUTE_VFC_PCT = 20;
/** Sous ce nombre de mesures, la « base » n'en est pas une. */
export const BASE_VFC_MIN = 5;
/** Au-delà, la mesure est trop vieille pour décrire l'état d'AUJOURD'HUI. */
export const FRAICHEUR_JOURS = 2;

const NOMBRE = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Écart en jours entre deux dates CIVILES (aucun fuseau : on compare des calendriers). */
export function ecartJours(a: string, b: string): number | null {
  const ta = Date.parse(a.slice(0, 10) + "T12:00:00Z");
  const tb = Date.parse(b.slice(0, 10) + "T12:00:00Z");
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.round((ta - tb) / 86400000);
}

/**
 * Durée de sommeil HABITUELLE de l'athlète : la médiane de ses nuits mesurées.
 * Surtout pas une norme de 8 h — celui qui vit à 6 h 30 serait en « dette » chaque jour,
 * et un signal qui s'allume tous les jours ne signale plus rien.
 */
export function dureeHabituelle(nuits: readonly Nuit[]): number | null {
  const d = nuits.map((n) => NOMBRE(n.total_sleep_min)).filter((x): x is number => x != null && x > 0).sort((a, b) => a - b);
  if (d.length < NUITS_HABITUDE_MIN) return null;
  const m = Math.floor(d.length / 2);
  return d.length % 2 ? d[m] : (d[m - 1] + d[m]) / 2;
}

export type Dette = { manqueMin: number; nuits: number; habituelMin: number };

/**
 * Dette accumulée sur les {@link NUITS_DETTE} nuits qui précèdent `jourRef` (incluse).
 * Exige les 3 nuits : deux nuits mesurées et un trou ne disent pas si la 3ᵉ fut courte.
 */
export function detteSommeil(nuits: readonly Nuit[], jourRef: string, habituelMin?: number | null): Dette | null {
  const habituel = NOMBRE(habituelMin ?? dureeHabituelle(nuits));
  if (habituel == null || habituel <= 0) return null;
  const fenetre: number[] = [];
  for (const n of nuits) {
    const ecart = n.date ? ecartJours(jourRef, n.date) : null;
    if (ecart == null || ecart < 0 || ecart >= NUITS_DETTE) continue;
    const min = NOMBRE(n.total_sleep_min);
    if (min == null) continue;
    fenetre.push(min);
  }
  if (fenetre.length < NUITS_DETTE) return null;
  const manque = fenetre.reduce((s, x) => s + (habituel - x), 0);
  if (manque < DETTE_MIN) return null;
  return { manqueMin: Math.round(manque), nuits: fenetre.length, habituelMin: Math.round(habituel) };
}

export type ChuteVfc = { valeur: number; base: number; chutePct: number; date: string };

/**
 * Chute d'UN matin sous sa propre base (moyenne des 7 jours qui le précèdent).
 * Complète la tendance hebdomadaire sans la remplacer : l'une voit la fatigue qui
 * s'installe, l'autre le matin où le corps dit non.
 */
export function chuteVfc(serie: readonly MesureVfc[], jourRef: string): ChuteVfc | null {
  const pts = serie
    .map((h) => ({ date: String(h.date ?? "").slice(0, 10), ms: NOMBRE(h.hrv_ms) }))
    .filter((h): h is { date: string; ms: number } => h.ms != null && h.ms > 0 && h.date.length === 10);
  if (!pts.length) return null;
  // La plus récente, à condition qu'elle décrive encore aujourd'hui.
  let dernier = pts[0];
  for (const p of pts) if (p.date > dernier.date) dernier = p;
  const age = ecartJours(jourRef, dernier.date);
  if (age == null || age < 0 || age > FRAICHEUR_JOURS) return null;
  const base = pts.filter((p) => { const e = ecartJours(dernier.date, p.date); return e != null && e >= 1 && e <= 7; }).map((p) => p.ms);
  if (base.length < BASE_VFC_MIN) return null;
  const moyenne = base.reduce((a, b) => a + b, 0) / base.length;
  if (!(moyenne > 0)) return null;
  const chute = (1 - dernier.ms / moyenne) * 100;
  if (chute < CHUTE_VFC_PCT) return null;
  return { valeur: Math.round(dernier.ms), base: Math.round(moyenne), chutePct: Math.round(chute), date: dernier.date };
}
