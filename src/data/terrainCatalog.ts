// Catalogue des terrains — source unique partagée par les formulaires (onboarding, profil)
// et par le briefing du coach IA.
//
// Le terrain est MULTIPLE : beaucoup de coureurs alternent route en semaine et sentier ou
// sable le week-end. Chaque terrain impose ses propres contraintes (surface, allure
// pertinente ou non, charge mécanique) et le coach doit toutes les respecter à la fois.

export type TerrainItem = {
  slug: string;
  /** Libellé court des puces, traduit (repli : fr). */
  label: Record<string, string>;
  /** Consigne d'entraînement injectée dans le prompt du coach. */
  coach: string;
  /** true = une allure au km n'a pas de sens sur cette surface (sable, montagne). */
  paceMeaningless?: boolean;
};

export const TERRAINS: TerrainItem[] = [
  {
    slug: "plat",
    label: { fr: "🛣️ Plat / route", en: "🛣️ Flat / road", de: "🛣️ Flach / Straße", es: "🛣️ Llano / asfalto", pt: "🛣️ Plano / estrada" },
    coach: "PLAT (route) : les allures /km sont parfaitement pertinentes — chiffre-les précisément. En revanche l'impact est répétitif et identique à chaque foulée → impose du renforcement et varie les surfaces quand c'est possible. Si l'objectif comporte du dénivelé, il DOIT aller chercher des côtes (même une bosse répétée en boucle).",
  },
  {
    slug: "vallonne",
    label: { fr: "🌄 Vallonné", en: "🌄 Rolling", de: "🌄 Hügelig", es: "🌄 Ondulado", pt: "🌄 Ondulado" },
    coach: "VALLONNÉ : l'allure brute ment, raisonne en GAP (allure ajustée au dénivelé) et en FC. Les bosses naturelles font déjà du travail de force — n'ajoute pas une séance de côtes par-dessus sans raison.",
  },
  {
    slug: "montagne",
    label: { fr: "⛰️ Montagne", en: "⛰️ Mountain", de: "⛰️ Berge", es: "⛰️ Montaña", pt: "⛰️ Montanha" },
    coach: "MONTAGNE (sentier technique) : ne prescris PAS d'allure /km sur ce terrain (elle n'a aucun sens) — pilote en DURÉE, en FC et en D+ (mètres de dénivelé). Travaille la montée (côtes longues, marche rapide efficace au-delà de 15 %) ET la DESCENTE (excentrique = première cause de destruction musculaire en trail, à doser très progressivement).",
    paceMeaningless: true,
  },
  {
    slug: "plage",
    label: { fr: "🏖️ Plage / sable", en: "🏖️ Beach / sand", de: "🏖️ Strand / Sand", es: "🏖️ Playa / arena", pt: "🏖️ Praia / areia" },
    coach: "⚠️ PLAGE (sable) : surface MOLLE → l'allure /km n'est PAS comparable au bitume (compte 45 s à 1 min 30 de plus au km), ne fixe donc AUCUNE allure cible sur le sable : pilote en DURÉE et en FRÉQUENCE CARDIAQUE. Le sable sollicite énormément mollets, tendon d'Achille et pieds → excellent pour la force et l'économie de foulée, mais RISQUE ÉLEVÉ de tendinopathie : limite à 1-2 sorties sable/semaine, jamais deux jours de suite, et cours de préférence sur le sable HUMIDE et plat près de l'eau (le sable sec et en dévers déforme la foulée et fatigue asymétriquement).",
    paceMeaningless: true,
  },
  {
    slug: "piste",
    label: { fr: "🏟️ Piste", en: "🏟️ Track", de: "🏟️ Bahn", es: "🏟️ Pista", pt: "🏟️ Pista" },
    coach: "PISTE : idéale pour la qualité chiffrée (fractionné calibré au mètre). Alterne les sens de rotation pour ne pas surcharger une jambe, et sors de la piste pour l'endurance (le volume facile se fait ailleurs, sur surface variée).",
  },
  {
    slug: "sentier",
    label: { fr: "🌲 Sentier / forêt", en: "🌲 Trail / forest", de: "🌲 Trail / Wald", es: "🌲 Sendero / bosque", pt: "🌲 Trilho / floresta" },
    coach: "SENTIER (forêt, chemins) : surface souple et irrégulière — excellente pour la proprioception et douce pour les articulations. L'allure y est naturellement plus lente qu'en route : ne la compare pas au bitume, et privilégie la FC pour juger l'effort.",
  },
  {
    slug: "tapis",
    label: { fr: "🏃 Tapis de course", en: "🏃 Treadmill", de: "🏃 Laufband", es: "🏃 Cinta de correr", pt: "🏃 Passadeira" },
    coach: "TAPIS DE COURSE : allure imposée et régulière, pratique pour le travail calibré. Mets 1 % de pente pour compenser l'absence de résistance de l'air, et attends-toi à une FC plus haute en intérieur (chaleur). La foulée y est moins variée : compense par du renforcement et des surfaces variées ailleurs.",
  },
  {
    slug: "neige",
    label: { fr: "❄️ Neige / glace", en: "❄️ Snow / ice", de: "❄️ Schnee / Eis", es: "❄️ Nieve / hielo", pt: "❄️ Neve / gelo" },
    coach: "NEIGE / GLACE : surface instable et glissante → aucune allure cible pertinente, pilote en durée et en FC. Le risque de chute et de sollicitation asymétrique (stabilisateurs, chevilles) est réel : proscris le fractionné rapide, rallonge l'échauffement, et privilégie les crampons si la glace est présente.",
    paceMeaningless: true,
  },
];

/** Libellé traduit d'un terrain (repli sur le français si la langue manque). */
export const terrainLabel = (item: TerrainItem, lang: string) => item.label[lang] ?? item.label.fr;

/**
 * Construit le bloc « terrain » du briefing coach à partir des slugs stockés.
 * Accepte le tableau `main_terrains` ET l'ancienne colonne `main_terrain` (chaîne unique),
 * afin que le code fonctionne avant comme après la migration 009.
 */
export function terrainCoachBlock(terrains: unknown, legacySingle?: unknown): { labels: string[]; rules: string[]; paceMeaningless: boolean } {
  const raw = Array.isArray(terrains) ? terrains.map(String)
    : typeof legacySingle === "string" && legacySingle ? [legacySingle]
    : [];
  // « mixte » était une valeur de l'ancien schéma mono-choix : on la traduit en sa véritable
  // signification (route + sentier) plutôt que de la perdre.
  const set = new Set(raw.flatMap((s) => (s === "mixte" ? ["plat", "sentier"] : [s])));
  const hits = TERRAINS.filter((t) => set.has(t.slug));
  return {
    labels: hits.map((t) => t.label.fr.replace(/^[^\p{L}\p{N}]+/u, "")),
    rules: hits.map((t) => t.coach),
    paceMeaningless: hits.some((t) => t.paceMeaningless),
  };
}
