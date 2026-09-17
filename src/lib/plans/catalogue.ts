import { longRunPeakKm, longRunShare, type RaceGoal } from "@/lib/running/volume";

// ─────────────────────────────────────────────────────────────────────────────
//  LES PLANS TOUT CONSTRUITS — EN PLUS DU COACH, JAMAIS À SA PLACE.
//
//  ⚠️ POURQUOI CE MODULE EXISTE. La landing vendait neuf « programmes » (5 km, 10 km,
//  semi, marathon, trail, débuter, vitesse, blessure, perte de poids). Cinq seulement
//  existaient vraiment, et seulement sous forme d'objectif de course : le macro-plan du
//  coach rend un tableau VIDE dès qu'il n'y a pas de date de course
//  (`if (!weeksToRace || weeksToRace < 1 || !vma) return []`). Un athlète qui voulait
//  « débuter » ou « améliorer sa vitesse » n'avait donc aucune progression, juste sept
//  jours glissants — et la carte « reprendre après blessure » ne reposait sur rien.
//
//  ⚠️ CE MODULE NE TOUCHE PAS AU COACH. Le plan glissant reste la vérité du quotidien :
//  lui seul lit la VFC, le sommeil, la charge aiguë et la fraîcheur du jour. Ce catalogue
//  répond à une autre question — « à quoi ressemblent les trois prochains mois ? » —
//  qu'aucun plan de sept jours ne peut montrer. Les deux coexistent, et c'est voulu :
//  l'un donne la trajectoire, l'autre décide de la séance de demain.
//
//  ⚠️ AUCUN CHIFFRE INVENTÉ. Les volumes sortent du volume RÉEL de l'athlète, la sortie
//  longue de `longRunPeakKm`/`longRunShare` (déjà utilisés par le coach), et la
//  progression du plafond de +10 %/semaine. Un plan « générique » à 60 km/semaine servi
//  à quelqu'un qui en court 20 serait une invitation à la blessure.
// ─────────────────────────────────────────────────────────────────────────────

/** Niveau, déduit de la VMA — MÊMES bornes que `libLevel` dans coachContext (une seule échelle). */
export type Niveau = "debutant" | "intermediaire" | "confirme" | "elite";

export function niveauDeVma(vma: number | null | undefined): Niveau {
  const v = Number(vma);
  if (!Number.isFinite(v) || v < 13) return "debutant";
  if (v < 16) return "intermediaire";
  if (v < 19) return "confirme";
  return "elite";
}

export type CleProgramme = "km5" | "km10" | "semi" | "marathon" | "trail" | "debutant" | "vitesse" | "blessure" | "poids";

export type Programme = {
  cle: CleProgramme;
  /** Distance de l'objectif, en km. `null` pour les programmes sans course (débuter, vitesse…). */
  distanceKm: number | null;
  /** Objectif au sens du moteur : pilote le menu de qualité et la sortie longue. */
  goal: RaceGoal;
  /** Bornes de durée proposées, en semaines. La première valeur est le défaut. */
  semaines: number[];
  /** Le programme alterne-t-il marche et course ? (débutants et reprise de blessure) */
  marcheCourse: boolean;
  /** Part du volume à faire SANS impact (vélo, elliptique) — 0 = tout en course. */
  sansImpactPct: number;
  /** Nombre maximum de séances de qualité par semaine, une fois la base installée. */
  qualiteMax: number;
};

/**
 * Les neuf programmes — exactement les neuf cartes de la landing, pour que ce qui est
 * promis dehors existe dedans. Toute carte ajoutée là-bas doit apparaître ici.
 */
export const PROGRAMMES: Record<CleProgramme, Programme> = {
  km5:       { cle: "km5",       distanceKm: 5,     goal: "5k",       semaines: [8, 6, 12, 16],  marcheCourse: false, sansImpactPct: 0,  qualiteMax: 2 },
  km10:      { cle: "km10",      distanceKm: 10,    goal: "10k",      semaines: [10, 6, 12, 16], marcheCourse: false, sansImpactPct: 0,  qualiteMax: 2 },
  semi:      { cle: "semi",      distanceKm: 21.1,  goal: "semi",     semaines: [12, 8, 16, 20], marcheCourse: false, sansImpactPct: 0,  qualiteMax: 2 },
  marathon:  { cle: "marathon",  distanceKm: 42.2,  goal: "marathon", semaines: [16, 12, 20, 24],marcheCourse: false, sansImpactPct: 0,  qualiteMax: 2 },
  trail:     { cle: "trail",     distanceKm: 30,    goal: "trail",    semaines: [12, 8, 16, 20], marcheCourse: false, sansImpactPct: 0,  qualiteMax: 2 },
  // ── Les quatre sans course ──────────────────────────────────────────────────
  // `debutant` : la marche fait partie du plan, et AUCUNE qualité les premières semaines.
  debutant:  { cle: "debutant",  distanceKm: null,  goal: "general",  semaines: [8, 4, 12],      marcheCourse: true,  sansImpactPct: 20, qualiteMax: 1 },
  // `vitesse` : un bloc court et dense — c'est le seul programme où la qualité monte à 3.
  vitesse:   { cle: "vitesse",   distanceKm: 5,     goal: "5k",       semaines: [6, 4, 8, 12],   marcheCourse: false, sansImpactPct: 0,  qualiteMax: 3 },
  // `blessure` : reprise. Marche/course obligatoire, moitié du volume hors impact, et
  // zéro qualité tant que la base n'est pas revenue (voir `phaseDe`).
  blessure:  { cle: "blessure",  distanceKm: null,  goal: "general",  semaines: [8, 4, 12, 16],  marcheCourse: true,  sansImpactPct: 50, qualiteMax: 1 },
  poids:     { cle: "poids",     distanceKm: null,  goal: "general",  semaines: [12, 8, 16],     marcheCourse: true,  sansImpactPct: 40, qualiteMax: 1 },
};

export type SemainePlan = {
  semaine: number;
  phase: "Reprise" | "Base" | "Développement" | "Spécifique" | "Affûtage";
  volumeKm: number;
  sortieLongueKm: number | null;
  /** Nombre de séances de qualité cette semaine (0 en reprise et en décharge). */
  qualites: number;
  /** Semaine de décharge : le volume recule volontairement. */
  decharge: boolean;
  sansImpactKm: number;
};

/** Progression hebdomadaire maximale du volume — la règle des 10 %, jamais dépassée. */
export const HAUSSE_MAX = 0.10;
/**
 * PLAFOND DE MONTÉE EN CHARGE — +40 % au-dessus du volume de départ.
 *
 * ⚠️ SANS LUI, LE PLAN DOUBLE LE VOLUME. Constaté en exerçant la page : une prépa
 * marathon de 16 semaines partie de 48 km/sem culminait à 113 km/sem. C'est ce que donne
 * +10 %/semaine composé, et c'est arithmétiquement juste — mais aucun entraîneur ne fait
 * doubler le volume d'un coureur en quatre mois. Le plafond est celui que `coachContext`
 * applique DÉJÀ au macro-plan (`ceilFactor`) : les deux disent maintenant la même chose.
 */
export const PLAFOND_MONTEE = 1.4;
/** Une semaine sur quatre recule : c'est l'assimilation, pas du temps perdu. */
export const CYCLE_DECHARGE = 4;
export const DECHARGE_FACTEUR = 0.75;

/**
 * Phase de la semaine `i` sur `n`.
 *
 * Les programmes de course finissent par un affûtage (la fraîcheur le jour J) ; ceux qui
 * n'ont pas de date d'arrivée n'en ont pas — affûter pour rien coûterait du volume sans
 * rien apporter. La reprise de blessure, elle, COMMENCE par une phase dédiée.
 */
function phaseDe(i: number, n: number, prog: Programme): SemainePlan["phase"] {
  const restantes = n - i;
  if (prog.cle === "blessure" && i < Math.ceil(n * 0.35)) return "Reprise";
  if (prog.cle === "debutant" && i < Math.ceil(n * 0.25)) return "Reprise";
  if (prog.distanceKm != null && restantes <= 2) return "Affûtage";
  if (prog.distanceKm != null && restantes <= Math.ceil(n * 0.35)) return "Spécifique";
  if (i < Math.ceil(n * 0.35)) return "Base";
  return "Développement";
}

/**
 * Construit le plan complet, semaine par semaine.
 *
 * `volumeDepartKm` est le volume que l'athlète court DÉJÀ. C'est le paramètre le plus
 * important du module : sans lui on servirait le même plan à tout le monde, ce que fait
 * n'importe quel plan de magazine — et c'est précisément ce qui blesse.
 */
export function genererPlan(opts: {
  programme: CleProgramme;
  niveau: Niveau;
  volumeDepartKm: number;
  semaines?: number;
}): SemainePlan[] {
  const prog = PROGRAMMES[opts.programme];
  const n = Math.max(4, Math.min(24, Math.round(opts.semaines ?? prog.semaines[0])));

  // Plancher de volume : un débutant déclaré à 0 km doit commencer quelque part, et un
  // plan qui démarre à 0 ne progresse jamais (0 × 1,1 = 0).
  const planchers: Record<Niveau, number> = { debutant: 10, intermediaire: 20, confirme: 30, elite: 40 };
  const depart = Math.max(planchers[opts.niveau] * (prog.marcheCourse ? 0.6 : 1), Number(opts.volumeDepartKm) || 0);

  const piconLong = longRunPeakKm(prog.goal, prog.distanceKm);
  const partLong = longRunShare(prog.goal, prog.distanceKm);

  const out: SemainePlan[] = [];
  let volume = depart;
  for (let i = 0; i < n; i++) {
    const phase = phaseDe(i, n, prog);
    const decharge = i > 0 && (i + 1) % CYCLE_DECHARGE === 0 && phase !== "Affûtage";

    // Le volume ne monte QUE hors décharge et hors affûtage.
    if (i > 0 && !decharge && phase !== "Affûtage") {
      volume = Math.min(volume * (1 + HAUSSE_MAX), depart * PLAFOND_MONTEE);
    }

    const volSemaine = phase === "Affûtage"
      ? volume * (i === n - 1 ? 0.55 : 0.72)
      : decharge ? volume * DECHARGE_FACTEUR
      : volume;

    // Sortie longue : bornée par la part du volume ET par le pic utile de la distance.
    // Sans le second plafond, une prépa marathon à gros volume prescrirait 45 km.
    const brute = volSemaine * partLong;
    const longue = prog.distanceKm == null && !prog.marcheCourse
      ? Math.round(brute)
      : prog.marcheCourse ? null
      : Math.round(Math.min(brute, piconLong ?? brute));

    // Qualité : zéro en reprise (les tendons d'abord), zéro en décharge, plafonnée sinon.
    const qualites = phase === "Reprise" || decharge ? 0
      : phase === "Base" ? Math.min(1, prog.qualiteMax)
      : prog.qualiteMax;

    out.push({
      semaine: i + 1,
      phase,
      volumeKm: Math.round(volSemaine),
      sortieLongueKm: longue,
      qualites,
      decharge,
      sansImpactKm: Math.round((volSemaine * prog.sansImpactPct) / 100),
    });
  }
  return out;
}

/** Volume total du plan, en km — sert à annoncer l'engagement réel, pas une promesse vague. */
export const volumeTotal = (p: SemainePlan[]) => p.reduce((s, w) => s + w.volumeKm, 0);
