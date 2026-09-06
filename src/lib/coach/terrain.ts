// ─────────────────────────────────────────────────────────────────────────────
//  LE PLAN REGARDE ENFIN LE TERRAIN DE LA COURSE.
//
//  Le catalogue porte le dénivelé de 6 369 courses sur 17 211 (dont 2 781 au-dessus de
//  500 m), mais l'objectif de l'athlète n'en transportait que le NOM, la date et la
//  distance. Un coureur préparant un trail à 1 200 m de D+ recevait donc exactement le
//  même plan qu'un coureur de 10 km sur route.
//
//  ⚠️ DEUX ABSENCES À NE PAS CONFONDRE, et c'est tout l'enjeu du module :
//  • `null` = le catalogue ne sait pas. On ne prescrit rien et on le DIT.
//  • `0` = la course est annoncée plate. C'est une information, pas une ignorance.
//  Traiter le premier comme le second ferait préparer un trail comme une course sur
//  route, ce qui est la faute la plus coûteuse qu'un plan puisse commettre.
// ─────────────────────────────────────────────────────────────────────────────

export type Profil = "plat" | "vallonne" | "montagneux";

/** Au-delà de ce D+ par kilomètre, le terrain change la nature de la course. */
export const VALLONNE_M_PAR_KM = 10;
export const MONTAGNEUX_M_PAR_KM = 30;
/** En dessous, le dénivelé de la course ne justifie aucun travail spécifique. */
export const DPLUS_NEGLIGEABLE = 150;
/** Part du D+ de la course qu'une semaine d'entraînement doit finir par atteindre. */
export const PART_HEBDO_CIBLE = 1.5;

export type ExigenceTerrain = {
  profil: Profil;
  dplusCourse: number;
  mParKm: number;
  /** D+ hebdomadaire à atteindre avant la course. */
  cibleHebdoM: number;
  /** D+ hebdomadaire actuel de l'athlète, quand il est mesuré. */
  actuelHebdoM: number | null;
  /** Ce qui manque, en mètres par semaine. 0 = il est déjà au niveau. */
  manqueHebdoM: number;
};

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Ce que le terrain de la course exige. Rend `null` quand il n'y a rien à demander —
 * course plate, dénivelé inconnu, ou distance absurde.
 *
 * @param dplusCourse D+ de la course en mètres. `null` = INCONNU, pas « plat ».
 * @param actuelHebdoM D+ hebdomadaire actuel de l'athlète, s'il est mesuré.
 */
export function exigenceTerrain(
  dplusCourse: number | null | undefined, distanceKm: number | null | undefined, actuelHebdoM: number | null = null,
): ExigenceTerrain | null {
  if (!fini(dplusCourse) || !fini(distanceKm) || distanceKm <= 0) return null;
  // Une course annoncée plate, ou presque, n'appelle aucun travail de côte spécifique.
  if (dplusCourse < DPLUS_NEGLIGEABLE) return null;

  const mParKm = dplusCourse / distanceKm;
  const profil: Profil = mParKm >= MONTAGNEUX_M_PAR_KM ? "montagneux"
    : mParKm >= VALLONNE_M_PAR_KM ? "vallonne" : "plat";
  // Le corps doit voir plus de dénivelé à l'entraînement que le jour J : une semaine
  // à l'exact D+ de la course ne prépare pas à le faire d'un seul tenant.
  const cible = Math.round(dplusCourse * PART_HEBDO_CIBLE);
  const actuel = fini(actuelHebdoM) ? Math.round(actuelHebdoM) : null;
  return {
    profil, dplusCourse: Math.round(dplusCourse),
    mParKm: Math.round(mParKm * 10) / 10,
    cibleHebdoM: cible,
    actuelHebdoM: actuel,
    manqueHebdoM: actuel == null ? 0 : Math.max(0, cible - actuel),
  };
}

/**
 * D+ hebdomadaire médian de l'athlète, sur des semaines glissantes.
 * Médiane et non moyenne : une sortie en montagne ne fait pas un préparation en montagne.
 */
export function denivelePartSemaine(
  courses: readonly { date: string; elevation_gain_m?: number | null }[],
  maintenant = Date.now(), semaines = 8,
): number | null {
  const parJour = new Array(semaines * 7).fill(0);
  let vues = 0;
  for (const c of courses ?? []) {
    const t = Date.parse(String(c.date ?? "").slice(0, 10) + "T12:00:00Z");
    if (!Number.isFinite(t)) continue;
    const age = Math.floor((maintenant - t) / 86400000);
    if (age < 0 || age >= parJour.length) continue;
    const d = c.elevation_gain_m;
    if (!fini(d)) continue;
    parJour[age] += d;
    vues++;
  }
  if (vues < 8) return null;
  const sommes: number[] = [];
  for (let i = 0; i + 7 <= parJour.length; i++) {
    let s = 0;
    for (let k = 0; k < 7; k++) s += parJour[i + k];
    sommes.push(s);
  }
  if (sommes.length < 14) return null;
  sommes.sort((a, b) => a - b);
  const m = Math.floor(sommes.length / 2);
  return Math.round(sommes.length % 2 ? sommes[m] : (sommes[m - 1] + sommes[m]) / 2);
}
