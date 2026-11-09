// ─────────────────────────────────────────────────────────────────────────────
//  LE RENFORCEMENT REGARDE ENFIN LA FOULÉE DE L'ATHLÈTE.
//
//  Il se périodisait déjà (base / développement / spécifique / affûtage) et surchargeait
//  par semaine de bloc — ce n'était donc pas un texte figé, contrairement à ce que j'ai
//  d'abord dit. Mais il ignorait complètement CE QU'ON SAIT DE LUI : ratio vertical,
//  oscillation, cadence, longueur de foulée, zones de blessure déclarées. Deux coureurs
//  aux fragilités opposées recevaient le même gainage.
//
//  Ce module ne remplace pas la séance : il y ajoute UN AXE prioritaire, choisi sur une
//  mesure qui existe. Trois règles qui le gouvernent :
//
//  1. AUCUN AXE SANS MESURE. Une valeur absente n'est pas une valeur normale : on se
//     tait plutôt que de prescrire à l'aveugle.
//  2. DEUX AXES AU MAXIMUM. Une séance qui corrige tout ne corrige rien, et l'athlète
//     abandonne devant une liste de quinze exercices.
//  3. UNE ZONE FRAGILE DÉCLARÉE N'APPELLE PLUS D'EXERCICES CIBLÉS (09/11/2026). Les zones
//     du profil (`injury_zones`, des antécédents) déclenchaient un « axe » par zone — excentriques pour le tendon d'Achille, « le seul protocole qui ait
//     fait ses preuves », abducteurs parce que « c'est la faiblesse du moyen fessier qui
//     laisse le genou partir en dedans » : un traitement, et une cause, pour une blessure
//     que personne n'a examinée. Pacevo n'est pas un professionnel de santé
//     (lib/health/kineIa) : la douleur allège le plan, le soin relève d'un médecin ou d'un
//     masseur-kinésithérapeute. Seules les MESURES de foulée produisent un axe. Une douleur
//     ACTIVE retire même ces axes, et la séance dit de sauter ce qui sollicite la zone
//     (`renfoDouleur`, lib/ai/autoPlan).
//
//  Les seuils sont ceux de la littérature sur la biomécanique de course, et ils sont
//  volontairement PRUDENTS : on ne signale que ce qui sort nettement de l'ordinaire.
// ─────────────────────────────────────────────────────────────────────────────

export type Axe = "raideur" | "cadence";

export type MesuresFoulee = {
  /** Ratio vertical (%) : oscillation rapportée à la longueur de foulée. Plus bas = mieux. */
  ratioVertical?: number | null;
  /** Cadence moyenne, en pas par minute. */
  cadence?: number | null;
  /** Zones fragiles du profil (antécédents) : ne produisent plus aucun axe (règle 3). */
  zones?: readonly string[] | null;
};

/** Au-delà, l'athlète « saute » plus qu'il n'avance : élasticité et cadence à travailler. */
export const RATIO_VERTICAL_ELEVE = 9;
/** En deçà, la foulée est trop longue : le pied attaque devant, le genou encaisse. */
export const CADENCE_BASSE = 165;
/** Une séance ne corrige pas tout à la fois. */
export const AXES_MAX = 2;

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Axes de renforcement prioritaires, du plus urgent au moins urgent.
 * Liste VIDE quand rien n'est mesuré ni déclaré — et c'est la bonne réponse.
 */
export function axesRenforcement(m: MesuresFoulee): Axe[] {
  const axes: Axe[] = [];
  // Les zones déclarées (`m.zones`) ne produisent plus rien : voir la règle 3 en tête.
  // La foulée, et SEULEMENT si elle est mesurée.
  if (fini(m.ratioVertical) && m.ratioVertical > RATIO_VERTICAL_ELEVE && !axes.includes("raideur")) {
    axes.push("raideur");
  }
  if (fini(m.cadence) && m.cadence < CADENCE_BASSE && !axes.includes("cadence")) {
    axes.push("cadence");
  }
  return axes.slice(0, AXES_MAX);
}
