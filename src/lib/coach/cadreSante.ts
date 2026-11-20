/**
 * LE CADRE DE SANTÉ D'UN COUREUR : ce que son PLAN lui permet, dit à l'IA (refonte du 20/11/2026).
 *
 * Cinq tours de relecture ont chacun trouvé de nouvelles lignes du dossier de l'IA (`ctx.text`) qui
 * poussaient un coureur exempté vers l'intensité : « ne sous-dose pas », « oser la densité », « un gros
 * travail de VMA », « tu peux durcir », « 6-8 lignes droites »… Le dossier d'un coureur ordinaire, corrigé
 * ligne par ligne, ne finissait jamais de l'être, et un en-tête « prime sur tout » autorisait encore
 * l'endurance à qui le plan retire toute séance (@HeadCoach, relecteurs, tour 6).
 *
 * Désormais, un coureur sous cadre reçoit un AUTRE dossier, bâti en liste blanche (lib/ai/coachContext,
 * `dossierCadre`), et ce que ce dossier dit du cadre suit les mêmes règles que le plan :
 *  · avis d'un médecin attendu (questionnaire d'aptitude) → aucune séance d'endurance, la course retirée
 *    (lib/coach/consignesPlan, `appliquerAptitude`) ;
 *  · programme marche-course → ses alternances, rien d'autre, aucune course posée (lib/ai/autoPlan) ;
 *  · covid long, consignes du kiné « sans intensité » ou « durée maximale » → aucune intensité ;
 *  · antécédent cardiaque, grossesse → au plus une séance sous le seuil (lib/coach/qualityBudget) ;
 *  · grossesse → à la sensation, ni allure ni fréquence cardiaque (lib/coach/sensation) ;
 *  · consignes du kiné → leur durée maximale et leur nombre de sorties ; course A ou B avec son accord,
 *    course C remplacée par un footing ;
 *  · antécédent qui interdit l'effort maximal → une course se court à effort contrôlé (décision de
 *    Cyprien, 20/11/2026).
 * Des consignes du kiné qui ne bornent QUE le nombre de sorties laissent l'intensité permise : pas de cadre.
 * Le test (tests/cadre-sante.test.ts) confronte ce cadre au plan produit pour la même situation.
 */
import type { ConsignesKine } from "@/lib/health/consignesKine";
import { effortMaximalInterdit, intensiteInterdite, pilotageSensation } from "@/lib/health/effortMaximal";

/** Ce que le plan permet, du plus strict au moins strict. */
export type NiveauCadre = "sansSeance" | "sansIntensite" | "seuilBas";

export type CadreSante = {
  niveau: NiveauCadre;
  /** Questionnaire d'aptitude coché, avis d'un médecin pas encore déclaré. */
  avisMedical: boolean;
  /** `bloquee` : la séance de son étape dure plus longtemps que la durée maximale du kiné — le plan n'en pose
   *  alors AUCUNE (lib/coach/consignesPlan : la séance devient un repos, « demande-lui comment l'adapter »). */
  marcheCourse: { etape: number; total: number; totalMin: number; bloquee: boolean } | null;
  /** Consignes du kinésithérapeute en vigueur. */
  kine: { sansIntensite: boolean; dureeMaxMin: number | null; seancesMaxSemaine: number | null; jusquAu: string } | null;
  /** Antécédent qui interdit l'effort maximal (cardiaque, covid long, grossesse). */
  effortMaxInterdit: boolean;
  /** Antécédent qui interdit toute intensité (covid long). */
  intensiteInterdite: boolean;
  /** À la sensation (grossesse) : ni allure chiffrée ni cible de fréquence cardiaque. */
  sensation: boolean;
};

export function cadreDeSante(e: {
  avisMedical: boolean;
  marcheCourse: { etape: number; total: number; totalMin: number } | null;
  consignes: ConsignesKine | null;
  conditions: unknown;
}): CadreSante | null {
  const effortMax = effortMaximalInterdit(e.conditions);
  const sansIntensite = intensiteInterdite(e.conditions);
  const kineBride = !!e.consignes && (e.consignes.sansIntensite || e.consignes.dureeMaxMin != null);
  const niveau: NiveauCadre | null = e.avisMedical ? "sansSeance"
    : e.marcheCourse || sansIntensite || kineBride ? "sansIntensite"
    : effortMax ? "seuilBas"
    : null;
  if (!niveau) return null;
  return {
    niveau,
    avisMedical: e.avisMedical,
    marcheCourse: e.marcheCourse ? {
      etape: e.marcheCourse.etape, total: e.marcheCourse.total, totalMin: e.marcheCourse.totalMin,
      bloquee: e.consignes?.dureeMaxMin != null && e.marcheCourse.totalMin > e.consignes.dureeMaxMin,
    } : null,
    kine: e.consignes ? {
      sansIntensite: e.consignes.sansIntensite, dureeMaxMin: e.consignes.dureeMaxMin,
      seancesMaxSemaine: e.consignes.seancesMaxSemaine, jusquAu: e.consignes.jusquAu,
    } : null,
    effortMaxInterdit: effortMax,
    intensiteInterdite: sansIntensite,
    sensation: pilotageSensation(e.conditions),
  };
}

const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Les phrases du cadre, en français : le dossier de l'IA est rédigé en français (le modèle répond dans la
 * langue du coureur). Exportées pour le test, qui n'accepte de vocabulaire d'intensité QUE dans ces phrases
 * exactes, jamais sur un simple marqueur (« ⛔ », « cadre de santé »).
 */
export const CADRE_FR = {
  titre: "⛔ CADRE DE SANTÉ — CE QUE SON PLAN LUI PERMET, ET RIEN DE PLUS",
  sansSeance: "AUCUNE séance d'endurance — ni course, ni vélo, ni natation — tant qu'un médecin ne l'a pas vu (questionnaire d'aptitude) : du repos, de la mobilité, de la marche tranquille et un renforcement doux sans saut, rien d'autre.",
  sansIntensite: "AUCUNE intensité : de l'endurance facile seulement, à la conversation — ni séance de qualité, ni accélération, ni ligne droite, ni test.",
  seuilBas: "Au plus UNE séance par semaine SOUS le seuil, en blocs longs à allure tenue ; jamais au seuil réel, ni VMA, ni zone 5, ni sprint, ni test, ni effort maximal ; tout le reste en endurance facile.",
  // Les étapes 9 à 11 sont de la course continue (20, 25, 30 min) : « des alternances » était faux (@HeadCoach).
  marcheCourse: (etape: number, total: number) => `Programme marche-course, étape ${etape} sur ${total} : ses séances sont celles de son étape, rien d'autre — jamais plus longues ni plus rapides.`,
  marcheCourseBloquee: (etape: number, total: number, totalMin: number, max: number, fin: string) => `Programme marche-course, étape ${etape} sur ${total} : AUCUNE séance cette semaine — celle de son étape (${totalMin} min) dépasse la durée fixée par son kinésithérapeute (${max} min, jusqu'au ${jjmm(fin)}) ; il doit lui demander comment l'adapter.`,
  sensation: "À la sensation : aucune allure chiffrée, aucune cible de fréquence cardiaque — il doit pouvoir parler.",
  // Une course A ou B n'est pas raccourcie par le plan : elle reste, avec l'accord du kiné (lib/coach/consignesPlan).
  dureeMax: (min: number, fin: string) => `Chaque sortie dure ${min} min au plus, sortie longue comprise — une course A ou B à part, avec son accord (consignes de son kinésithérapeute jusqu'au ${jjmm(fin)}).`,
  seancesMax: (n: number, fin: string) => `${n} sortie(s) de course au plus sur 7 jours glissants (consignes de son kinésithérapeute jusqu'au ${jjmm(fin)}).`,
  courseRetiree: "Course au calendrier : retirée de son plan tant qu'un médecin ne l'a pas vu.",
  courseMarcheCourse: "Course au calendrier : aucune n'est posée pendant le programme marche-course.",
  courseControle: "Course au calendrier : courue à effort contrôlé — ni chrono, ni allure cible, ni accélération ; il doit pouvoir parler du début à la fin.",
  courseKine: (fin: string) => `Course A ou B au calendrier : seulement avec l'accord de son kinésithérapeute (consignes jusqu'au ${jjmm(fin)}) ; une course C devient un footing facile.`,
  limite: "Tu ne prescris, ne suggères ni ne promets rien au-delà de ce cadre — même s'il est frais, motivé ou proche de sa course ; seul un médecin (ou, pour ses consignes, son kinésithérapeute) peut le lever. N'en cite pas la cause médicale.",
} as const;

/** Les lignes du cadre, dans l'ordre où le dossier les donne. */
export function lignesCadre(c: CadreSante): string[] {
  const l: string[] = [];
  l.push(c.niveau === "sansSeance" ? CADRE_FR.sansSeance : c.niveau === "sansIntensite" ? CADRE_FR.sansIntensite : CADRE_FR.seuilBas);
  if (c.niveau !== "sansSeance") {
    if (c.marcheCourse) l.push(c.marcheCourse.bloquee && c.kine?.dureeMaxMin != null
      ? CADRE_FR.marcheCourseBloquee(c.marcheCourse.etape, c.marcheCourse.total, c.marcheCourse.totalMin, c.kine.dureeMaxMin, c.kine.jusquAu)
      : CADRE_FR.marcheCourse(c.marcheCourse.etape, c.marcheCourse.total));
    if (c.sensation) l.push(CADRE_FR.sensation);
    if (c.kine?.dureeMaxMin != null) l.push(CADRE_FR.dureeMax(c.kine.dureeMaxMin, c.kine.jusquAu));
    if (c.kine?.seancesMaxSemaine != null) l.push(CADRE_FR.seancesMax(c.kine.seancesMaxSemaine, c.kine.jusquAu));
  }
  // La course : ce que le plan en fait (retirée, absente, à effort contrôlé, avec l'accord du kiné).
  if (c.avisMedical) l.push(CADRE_FR.courseRetiree);
  else if (c.marcheCourse) l.push(CADRE_FR.courseMarcheCourse);
  else {
    if (c.effortMaxInterdit) l.push(CADRE_FR.courseControle);
    if (c.kine) l.push(CADRE_FR.courseKine(c.kine.jusquAu));
  }
  l.push(CADRE_FR.limite);
  return l;
}
