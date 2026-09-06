// ─────────────────────────────────────────────────────────────────────────────
//  LA FRÉQUENCE CARDIAQUE À TENIR — une seule définition, la plus étroite possible.
//
//  Deux défauts mesurés le 06/09/2026 sur un compte réel :
//
//  1. LA RÉFÉRENCE N'ÉTAIT PAS LA SIENNE. Le Ghost Runner calculait ses zones avec
//     `baseline?.max_hr ?? 190`. La table `performance_baselines` de l'athlète est
//     VIDE : il courait donc sur un 190 par défaut, quand sa FC max réellement observée
//     est 212 (29 séances au-dessus de 200, une moyenne montée à 198 — ce n'est pas un
//     artefact de capteur) et son seuil mesuré par Garmin 192. Toutes ses cibles étaient
//     décalées d'une vingtaine de battements vers le bas.
//
//  2. LES PLAGES ÉTAIENT TROP LARGES. Une zone de 10 points de % FC max fait ~21 bpm de
//     large, et un « échauffement Z1 → corps Z2 » affiché d'un bloc en fait plus de 30.
//     « Reste entre 129 et 162 » ne cible rien : c'est presque toute l'amplitude utile
//     d'un coureur. Un entraîneur donne une fenêtre de l'ordre de 10 battements.
//
//  MÉTHODE, et pourquoi elle change selon l'intensité :
//  • En dessous du seuil, on raisonne en RÉSERVE cardiaque (Karvonen) : elle tient
//    compte de la FC de repos, donc de la forme du jour, là qu'un simple % de FC max
//    ignore un athlète au repos bas.
//  • Au seuil et au-dessus, on s'ancre sur le SEUIL MESURÉ (LTHR) quand il existe. Le
//    seuil est la seule zone qu'une mesure définit littéralement ; l'estimer par un
//    pourcentage d'un maximum, c'est empiler deux approximations.
// ─────────────────────────────────────────────────────────────────────────────

export type ReferencesFc = {
  /** FC maximale retenue, et d'où elle vient. */
  max: number | null;
  repos: number | null;
  /** Seuil mesuré (LTHR). Absent chez la plupart des montres. */
  seuil: number | null;
  source: "mesures" | "seuil" | "age" | "aucune";
};

export type PlageFc = { lo: number; hi: number };

/** Intensités que le plan sait prescrire. */
export type Intensite = "recup" | "endurance" | "tempo" | "seuil" | "vma";

/** Largeur maximale d'une cible. Au-delà, ce n'est plus une consigne. */
export const LARGEUR_MAX = 12;

const nb = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

/**
 * Références cardiaques de l'athlète, par ordre de FIABILITÉ décroissante.
 *
 * `observee` est la plus haute FC réellement enregistrée sur ses séances : c'est une
 * mesure, elle passe donc avant toute formule. On exige qu'elle dépasse 150 pour ne pas
 * retenir un capteur qui a décroché.
 */
export function referencesFc(e: {
  maxDeclaree?: unknown; maxObservee?: unknown; repos?: unknown; seuil?: unknown; age?: unknown;
}): ReferencesFc {
  const seuil = nb(e.seuil);
  const repos = nb(e.repos);
  const declaree = nb(e.maxDeclaree);
  const observee = nb(e.maxObservee);
  if (declaree != null || (observee != null && observee > 150)) {
    return { max: declaree ?? observee, repos, seuil, source: "mesures" };
  }
  // Le seuil vaut ~92 % de la FC max chez un athlète entraîné : bien meilleur repli
  // que l'âge, et il reste adossé à une mesure.
  if (seuil != null && seuil > 120) return { max: Math.round(seuil / 0.92), repos, seuil, source: "seuil" };
  const age = nb(e.age);
  if (age != null && age > 5 && age < 100) return { max: 220 - age, repos, seuil, source: "age" };
  return { max: null, repos, seuil, source: "aucune" };
}

/** Milieu de zone, en fraction de réserve cardiaque. Étroit par construction. */
const RESERVE: Record<Intensite, number> = {
  recup: 0.55,      // vraiment facile : on récupère, on ne s'entraîne pas
  endurance: 0.66,  // le cœur de l'entraînement, allure conversationnelle
  tempo: 0.80,
  seuil: 0.88,
  vma: 0.95,
};
/** Part du seuil mesuré, pour les intensités qu'il définit littéralement. */
const PART_SEUIL: Partial<Record<Intensite, number>> = { tempo: 0.93, seuil: 0.97, vma: 1.03 };

/**
 * Fenêtre de FC à tenir, en battements. `null` quand on ne sait pas : une cible
 * inventée est pire que pas de cible, l'athlète la suivrait.
 *
 * @param largeur amplitude totale voulue, plafonnée à {@link LARGEUR_MAX}.
 */
export function plageFc(intensite: Intensite, refs: ReferencesFc, largeur = 10): PlageFc | null {
  const l = Math.max(4, Math.min(LARGEUR_MAX, Math.round(largeur)));
  const demi = l / 2;
  const part = PART_SEUIL[intensite];
  // Au seuil et au-dessus : la mesure prime sur toute formule.
  if (part != null && refs.seuil != null && refs.seuil > 120) {
    const centre = refs.seuil * part;
    return borner({ lo: Math.round(centre - demi), hi: Math.round(centre + demi) }, refs);
  }
  if (refs.max == null || refs.repos == null) {
    // Sans FC de repos, la réserve n'est pas calculable. On retombe sur un pourcentage
    // de FC max — moins juste, mais honnête tant qu'il est ANNONCÉ comme tel.
    if (refs.max == null) return null;
    const approx: Record<Intensite, number> = { recup: 0.68, endurance: 0.76, tempo: 0.85, seuil: 0.90, vma: 0.95 };
    const centre = refs.max * approx[intensite];
    return borner({ lo: Math.round(centre - demi), hi: Math.round(centre + demi) }, refs);
  }
  const centre = refs.repos + (refs.max - refs.repos) * RESERVE[intensite];
  return borner({ lo: Math.round(centre - demi), hi: Math.round(centre + demi) }, refs);
}

/** Une cible ne sort jamais du domaine physiologique de l'athlète. */
function borner(p: PlageFc, refs: ReferencesFc): PlageFc {
  const plancher = refs.repos != null ? refs.repos + 10 : 90;
  const plafond = refs.max ?? 220;
  const lo = Math.max(plancher, Math.min(p.lo, plafond - 4));
  const hi = Math.max(lo + 4, Math.min(p.hi, plafond));
  return { lo, hi };
}

/** « 152-162 bpm ». Rend `null` plutôt qu'une plage vide : l'écran doit pouvoir se taire. */
export function plageLisible(p: PlageFc | null): string | null {
  return p ? `${p.lo}-${p.hi} bpm` : null;
}
