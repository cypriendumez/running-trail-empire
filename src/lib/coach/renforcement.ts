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
//  3. LA DOULEUR PASSE AVANT LA PERFORMANCE. Une zone déclarée fragile prend le pas sur
//     n'importe quelle métrique de foulée.
//
//  Les seuils sont ceux de la littérature sur la biomécanique de course, et ils sont
//  volontairement PRUDENTS : on ne signale que ce qui sort nettement de l'ordinaire.
// ─────────────────────────────────────────────────────────────────────────────

export type Axe = "genou_hanche" | "mollet_achille" | "chaine_posterieure" | "raideur" | "cadence";

export type MesuresFoulee = {
  /** Ratio vertical (%) : oscillation rapportée à la longueur de foulée. Plus bas = mieux. */
  ratioVertical?: number | null;
  /** Cadence moyenne, en pas par minute. */
  cadence?: number | null;
  /** Zones douloureuses ou fragiles déclarées, en clair (« genou », « mollet »…). */
  zones?: readonly string[] | null;
};

/** Au-delà, l'athlète « saute » plus qu'il n'avance : élasticité et cadence à travailler. */
export const RATIO_VERTICAL_ELEVE = 9;
/** En deçà, la foulée est trop longue : le pied attaque devant, le genou encaisse. */
export const CADENCE_BASSE = 165;
/** Une séance ne corrige pas tout à la fois. */
export const AXES_MAX = 2;

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Reconnaît une zone quel que soit le mot employé par l'athlète ou le formulaire. */
const MOTS: Record<Axe, RegExp> = {
  genou_hanche: /genou|rotule|ilio|itbs|bandelette|hanche|psoas|tfl/i,
  mollet_achille: /mollet|achille|soleaire|soléaire|tendon|cheville|aponevrose|aponévrose|fasciite|plantaire/i,
  chaine_posterieure: /ischio|hamstring|fessier|lombaire|dos|bassin|pubalgie/i,
  raideur: /(?!)/,   // jamais déduit d'une douleur : c'est une mesure, pas un symptôme
  cadence: /(?!)/,
};

/**
 * Axes de renforcement prioritaires, du plus urgent au moins urgent.
 * Liste VIDE quand rien n'est mesuré ni déclaré — et c'est la bonne réponse.
 */
export function axesRenforcement(m: MesuresFoulee): Axe[] {
  const axes: Axe[] = [];
  const zones = (m.zones ?? []).filter((z): z is string => typeof z === "string" && z.trim().length > 0);

  // 1. La douleur d'abord. Une zone déclarée fragile prime sur toute métrique.
  for (const axe of ["genou_hanche", "mollet_achille", "chaine_posterieure"] as const) {
    if (zones.some((z) => MOTS[axe].test(z))) axes.push(axe);
  }

  // 2. Puis la foulée, et SEULEMENT si elle est mesurée.
  if (fini(m.ratioVertical) && m.ratioVertical > RATIO_VERTICAL_ELEVE && !axes.includes("raideur")) {
    axes.push("raideur");
  }
  if (fini(m.cadence) && m.cadence < CADENCE_BASSE && !axes.includes("cadence")) {
    axes.push("cadence");
  }
  return axes.slice(0, AXES_MAX);
}
