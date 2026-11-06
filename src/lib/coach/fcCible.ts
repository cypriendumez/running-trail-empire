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
  // ⚠️ JAMAIS SOUS UNE VALEUR RÉELLEMENT ATTEINTE (même règle que le coach, `fcMaxEst`) :
  // une FC max déclarée à 180 quand la montre a enregistré 195 est fausse par construction.
  // Avant le 11/10/2026, la déclarée l'emportait toujours ici (`declaree ?? observee`).
  const observeeFiable = observee != null && observee > 150 ? observee : null;
  if (declaree != null || observeeFiable != null) {
    return { max: Math.max(declaree ?? 0, observeeFiable ?? 0), repos, seuil, source: "mesures" };
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

/** Sous ce nombre de footings mesurés, l'habitude n'est pas établie. */
export const FOOTINGS_MIN = 8;
/** En deçà, l'écart n'est pas significatif : on ne bouge pas la cible pour 2 battements. */
export const ECART_MIN = 4;
/** Garde-fou bas : on ne descend jamais une cible d'endurance sous ce % de réserve. */
export const PLANCHER_RESERVE = 0.45;

/**
 * AJUSTE LA CIBLE D'ENDURANCE À CE QUE L'ATHLÈTE FAIT VRAIMENT — dans un seul sens.
 *
 * Le modèle de Karvonen place l'endurance à 66 % de réserve. Sur un athlète réel
 * (06/09/2026) cela donnait 156-166 bpm alors que ses footings tournent à 143-152 : il
 * court ses footings PLUS FACILE que la théorie, et il a raison — c'est le principe
 * 80/20, et lui imposer 10 battements de plus transformerait ses jours faciles en jours
 * moyens, la faute la plus répandue en course à pied.
 *
 * ⚠️ L'AJUSTEMENT EST ASYMÉTRIQUE, ET C'EST TOUT L'INTÉRÊT. On suit l'athlète quand il
 * court PLUS FACILE que la théorie ; on ne le suit PAS quand il court plus dur. Sinon
 * on validerait précisément l'erreur qu'on veut corriger chez le débutant qui fait tous
 * ses footings en zone 3. La théorie sert alors de plafond, la pratique de plancher.
 *
 * Rien ne bouge pour le seuil ni la VMA : ces zones-là sont définies par une mesure
 * (le seuil), pas par une habitude.
 *
 * @param observees FC moyennes de ses footings récents, en battements.
 */
export function cibleEndurance(refs: ReferencesFc, observees: readonly number[], largeur = 10): PlageFc | null {
  const theorique = plageFc("endurance", refs, largeur);
  if (!theorique) return null;
  const mesures = (observees ?? []).filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 60 && v < 230);
  if (mesures.length < FOOTINGS_MIN) return theorique;

  // MÉDIANE, pas moyenne : une seule séance en côtes ou un capteur qui décroche ne doit
  // pas déplacer la cible de tout un athlète.
  const triees = [...mesures].sort((a, b) => a - b);
  const mediane = triees.length % 2
    ? triees[(triees.length - 1) / 2]
    : (triees[triees.length / 2 - 1] + triees[triees.length / 2]) / 2;

  const centreTheorique = (theorique.lo + theorique.hi) / 2;
  if (mediane >= centreTheorique - ECART_MIN) return theorique;   // il ne court pas plus facile : on ne bouge pas

  // Plancher : même en suivant l'athlète, une cible d'endurance ne descend pas au point
  // de ne plus rien entraîner (marche rapide, capteur en vrac, séances de récupération
  // comptées à tort comme des footings).
  const plancher = refs.max != null && refs.repos != null
    ? refs.repos + (refs.max - refs.repos) * PLANCHER_RESERVE
    : centreTheorique - 25;
  const centre = Math.max(plancher, mediane);
  const demi = Math.max(2, Math.min(LARGEUR_MAX, Math.round(largeur)) / 2);
  return borner({ lo: Math.round(centre - demi), hi: Math.round(centre + demi) }, refs);
}

// ─────────────────────────────────────────────────────────────────────────────
//  LES CIBLES DE FC ENVOYÉES À LA MONTRE, ET LE FOOTING « TROP INTENSE » (07/11/2026)
//
//  Cyprien : « est-ce que pour la fréquence cardiaque tu peux faire de même, ajuster s'il y
//  a des différences trop majeures lors des séances ». Mesuré sur ses séances d'octobre :
//  des « Footing en endurance » courus à 164, 166 et 170 bpm, comptés FACILES par le plan
//  (le seul seuil « dur » était 85 % de la FC max, 180 bpm chez lui), et une montre qui ne
//  recevait que « Z1 HR / Z2 HR » — les zones d'intervals.icu, larges d'une vingtaine de
//  battements. Deux décisions, une seule source de chiffres :
//   · la MONTRE reçoit des battements précis (10 bpm) pour l'endurance et la récupération ;
//   · le PLAN compte comme dur un footing couru nettement au-dessus de l'endurance.
// ─────────────────────────────────────────────────────────────────────────────

/** Battements au-dessus du haut de la zone d'endurance au-delà desquels un footing est « dur ». */
export const MARGE_FOOTING_DUR = 5;

export type CiblesFc = {
  /** Corps d'un footing ou d'une sortie longue — suit l'athlète vers le BAS (`cibleEndurance`). */
  endurance: PlageFc;
  /** Échauffement, retour au calme, récupération et récups entre répétitions. */
  recup: PlageFc;
  /** FC moyenne à partir de laquelle une course compte comme une séance DURE. */
  plafondFooting: number;
  /**
   * La FC max réglée dans intervals.icu, lue au moment de l'envoi (`fcMaxMontre`).
   * ⚠️ intervals.icu NE COMPREND PAS les battements absolus (« 133-143bpm » : vérifié le
   * 07/11/2026, l'étape arrive sans cible). Il comprend « 62.7-67.5% HR », en % de SA FC max.
   * Sans elle, aucune étape en battements : on ne convertit pas avec une FC max qui n'est
   * pas celle que la montre appliquera.
   */
  maxMontre?: number | null;
};

/** Les cibles, avec la FC max qu'intervals.icu appliquera. `null` si l'une manque. */
export function avecFcMaxMontre(cibles: CiblesFc | null, maxMontre: number | null): CiblesFc | null {
  if (!cibles || !(maxMontre != null && Number.isFinite(maxMontre) && maxMontre > 100)) return null;
  return { ...cibles, maxMontre };
}

/** Une plage en battements, écrite en % de la FC max de la montre, au dixième (≈ 0,2 bpm). */
export function plageEnPctMax(pl: PlageFc, max: number): string {
  const pct = (b: number) => Math.round((b / max) * 1000) / 10;
  return `${pct(pl.lo)}-${pct(pl.hi)}% HR`;
}

/**
 * Les cibles de FC d'un athlète, ou `null`.
 *
 * ⚠️ SEULEMENT SUR DES MESURES. Une FC max tirée de l'âge (220 − âge) se trompe de ±10 à
 * 12 bpm pour un individu : la montre ferait alors sonner un athlète sur une zone qui n'est
 * pas la sienne. Sans FC max mesurée (ou seuil mesuré), on garde les zones d'intervals.icu.
 *
 * `footings` : FC moyennes de ses footings récents. Le plafond, lui, reste THÉORIQUE : le
 * caler sur ses footings (qui peuvent être trop rapides) validerait l'erreur à corriger.
 */
export function ciblesFcAthlete(refs: ReferencesFc, footings: readonly number[]): CiblesFc | null {
  if (refs.source !== "mesures" && refs.source !== "seuil") return null;
  const theorique = plageFc("endurance", refs);
  const recupTheorique = plageFc("recup", refs);
  if (!theorique || !recupTheorique) return null;
  const plafondFooting = theorique.hi + MARGE_FOOTING_DUR;
  // Les footings trop intenses ne déplacent pas la cible : ce sont eux qu'on veut corriger.
  const endurance = cibleEndurance(refs, footings.filter((v) => v < plafondFooting)) ?? theorique;
  // La récupération reste SOUS l'endurance : une récup plus haute que le footing est absurde.
  const hi = Math.min(recupTheorique.hi, endurance.lo);
  const plancher = refs.repos != null ? refs.repos + 10 : 90;
  const recup = { lo: Math.max(plancher, hi - 10), hi: Math.max(plancher + 4, hi) };
  return { endurance, recup, plafondFooting };
}

/** Une course de plus de 20 min dont la FC moyenne atteint le plafond est une séance dure. */
export function footingTropIntense(fcMoyenne: unknown, dureeSec: unknown, cibles: CiblesFc | null): boolean {
  const fc = Number(fcMoyenne), sec = Number(dureeSec);
  return !!cibles && fcMoyenne != null && Number.isFinite(fc) && Number.isFinite(sec) && sec >= 20 * 60 && fc >= cibles.plafondFooting;
}
