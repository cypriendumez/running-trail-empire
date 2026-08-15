// ─────────────────────────────────────────────────────────────────────────────
//  BUDGET DE QUALITÉ — combien de séances exigeantes cette semaine.
//
//  C'est la décision la plus lourde du coach : elle sépare une préparation d'un
//  entretien. Elle vivait au milieu des 1 500 lignes de `coachContext`, mêlée aux
//  requêtes Supabase, donc INTESTABLE autrement qu'en observant le plan produit.
//  Elle est ici, pure, et couverte par des tests.
//
//  DEUX DÉFAUTS RÉELS CORRIGÉS EN L'EXTRAYANT (relevés sur le compte de production,
//  à 72 jours d'un marathon, avec 73 km courus dans la semaine) :
//
//  1. LA MÊME FATIGUE ÉTAIT COMPTÉE DEUX FOIS. Le ratio aigu:chronique et le TSB sont
//     deux lectures de la MÊME série de charge : quand la charge récente dépasse la
//     charge de fond, le ratio monte ET le TSB plonge, mécaniquement. Chacun retirait
//     une séance de qualité. Une montée en charge — c'est-à-dire ce que fait tout
//     athlète en préparation — coûtait donc DEUX séances d'un coup. Mesuré : budget
//     structurel 2 → 0. Une seule déduction désormais, motif explicite.
//
//  2. UNE FATIGUE PASSAGÈRE POUVAIT VIDER UNE PRÉPARATION ENTIÈRE. Le plancher
//     « objectif chrono » ne s'appliquait QUE si la liste d'allègements était vide.
//     Autrement dit : au premier signal, plus aucune qualité, et tant que le signal
//     dure. Un athlète qui monte en charge dix semaines avant son marathon n'a plus
//     que des footings — et c'est précisément la période où l'allure spécifique se
//     construit. Zéro qualité pendant une préparation est une erreur d'entraînement,
//     pas une précaution. On garde donc UNE qualité, RACCOURCIE et annoncée comme
//     telle, sauf vrai signal d'alerte : douleur, VFC en baisse ET nuit dégradée
//     (double signal), interdiction médicale d'effort maximal, ou aucun historique.
//
//  Ce que ce plancher ne franchit JAMAIS : le plafond lié au passif de coureur
//  (tendons), le plafond du mode perte de poids, et le verdict de fraîcheur du JOUR
//  (qui, lui, peut encore transformer la séance du jour en repos).
// ─────────────────────────────────────────────────────────────────────────────
import { tr, nLoc, type I18nText } from "@/lib/i18n/multi";
import { MOTIF_T } from "@/lib/coach/reasonsI18n";

export type QBLevel = "debutant" | "intermediaire" | "confirme" | "elite";
export type QBGoal = "5k" | "10k" | "semi" | "marathon" | "trail" | "ultra" | "general";

export type QualityBudgetInput = {
  level: QBLevel;
  goal: QBGoal;
  /** Libellé de phase de périodisation (« BASE… », « AFFÛTAGE… »). */
  phase: string;
  /** Aucune séance de course enregistrée → semaine d'observation. */
  noHistory: boolean;
  /** Douleurs déclarées en cours. */
  pains: string[];
  /** VFC sous sa ligne de base. */
  hrvDown: boolean;
  /** VFC NETTEMENT au-dessus de sa base (7 j vs 7 j précédents).
   *
   *  La VFC ne servait qu'à PUNIR : une baisse coûtait une séance, une hausse ne rendait
   *  jamais rien. Le corps n'avait donc aucun moyen de contredire l'arithmétique de
   *  charge. Cas réel : VFC à +22 % sur sept jours, au plus haut de tout l'historique,
   *  sommeil correct, aucune douleur — et le plan proposait quatre jours de footing de
   *  25 min d'affilée parce que le ratio aigu:chronique était à 2,0 après trois semaines
   *  d'arrêt. L'athlète a évidemment ignoré le plan, ce qui ne protège plus personne. */
  hrvUp: boolean;
  /** Nuit dégradée (score < 60 ou moins de 6 h), avec son libellé déjà formaté. */
  badNight: boolean;
  badNightLabel?: string;
  /** Ratio aigu:chronique et TSB — DEUX LECTURES DE LA MÊME CHARGE, cf. en-tête. */
  acr: number;
  tsb: number;
  /** Ressenti élevé sur les derniers retours. */
  rpeHigh: boolean;
  rpeAvg?: number | null;
  /** Part du temps de course passée en Z3+ (footings courus trop vite). */
  hardTimePct: number | null;
  /** Décrochage en secondes/km sur la dernière série, si supérieur au bruit. */
  fadeSec: number | null;
  /** Capacité qui stagne alors que la charge monte. */
  plateau: boolean;
  /** Pathologie interdisant l'effort maximal. */
  noMaxEffort: boolean;
  /** Années de pratique — plafonne la qualité quel que soit le cardio. */
  runYears: number | null;
  /** Plafond du mode perte de poids, s'il est actif. */
  weightLossMaxQuality: number | null;
  /** Un objectif de course est-il enregistré, et à combien de jours ? */
  hasObjective: boolean;
  daysToRace: number | null;
  isShortGoal: boolean;
};

export type QualityBudget = {
  /** Nombre de séances de qualité retenues pour la semaine. */
  qBudget: number;
  /** Celui que justifient niveau, objectif et phase, AVANT tout allègement : c'est lui
   *  qui doit porter la feuille de route des semaines suivantes — une fatigue de cette
   *  semaine ne dicte pas deux mois de plan. */
  structuralQBudget: number;
  /** Motifs d'allègement, en français, affichés à l'athlète ET envoyés à l'IA. */
  easeReasons: string[];
  /** Le passif de coureur a-t-il plafonné la qualité (message différent : limite
   *  structurelle, pas allègement passager) ? */
  expCapped: boolean;
  expCap: number | null;
  /** La séance a-t-elle été SAUVÉE par le plancher « objectif » ? Si oui elle doit être
   *  prescrite RACCOURCIE, et le plan doit dire pourquoi. */
  floored: boolean;
  /** Ce qu'on a décidé de NE PAS retenir contre l'athlète, et pourquoi. Un allègement
   *  annulé doit se dire : sinon le coach paraît ignorer une charge qu'il a bien vue. */
  notes: string[];
  /** Les mêmes notes dans les 5 langues. `notes` (français) reste la version canonique.
   *  Ces notes finissent recopiées dans le « pourquoi » d'une séance : sans traduction,
   *  un athlète espagnol lisait une explication à moitié française. */
  notesAll: I18nText[];
  /** La physiologie a-t-elle contredit l'arithmétique de charge (VFC nettement au-dessus
   *  de sa base, sommeil correct, aucune douleur) ? Le verdict de fraîcheur du jour doit
   *  en tenir compte, sinon il continue de transformer chaque journée en récupération. */
  bodySaysFresh: boolean;
};

/** Un objectif à plus de 16 semaines laisse le temps d'une vraie coupure ; en deçà,
 *  chaque semaine sans allure spécifique se paie le jour J. */
const OBJECTIVE_FLOOR_DAYS = 112;

export function computeQualityBudget(i: QualityBudgetInput): QualityBudget {
  let qBudget = i.level === "debutant" ? 1 : i.level === "intermediaire" ? 2 : 3;
  if (i.goal === "marathon" || i.goal === "ultra") qBudget -= 1; // le volume prime → un cran de moins
  if (i.phase.startsWith("BASE")) qBudget = Math.min(qBudget, i.level === "debutant" ? 1 : 2);
  else if (i.phase.startsWith("AFFÛTAGE")) qBudget = Math.min(qBudget, 2); // garde l'intensité, coupe le volume

  const structuralQBudget = Math.max(1, Math.min(3, qBudget));

  const easeReasons: string[] = [];
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const frNum = (n: number, d = 0) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−");

  // ── ATHLÈTE INCONNU : PAS DE QUALITÉ ─────────────────────────────────────────
  // Un compte neuf n'a ni historique, ni VMA, ni signal de fatigue — donc aucun motif
  // d'allègement, un verdict « vert » par défaut et un budget hérité du niveau.
  // Résultat constaté sur un profil vide : SÉANCE DE VMA DÈS LE PREMIER JOUR.
  if (i.noHistory) {
    qBudget = 0;
    easeReasons.push("aucun historique d'entraînement : semaine d'observation avant toute intensité");
  }
  if (i.pains.length) { qBudget -= 1; easeReasons.push("douleur signalée"); }
  if (i.hrvDown) { qBudget -= 1; easeReasons.push("VFC en baisse"); }

  // ── CHARGE : UN SEUL SIGNAL, UNE SEULE DÉDUCTION ─────────────────────────────
  // Ratio aigu:chronique et TSB décrivent le même phénomène par deux bouts. Les
  // additionner, c'est punir deux fois une montée en charge normale (cf. en-tête).
  const acrHigh = i.acr > 1.5, tsbLow = i.tsb < -25;
  // ── ET LE CORPS A LE DROIT DE CONTREDIRE L'ARITHMÉTIQUE ──────────────────────
  // Le ratio aigu:chronique n'est pas une mesure de fatigue : c'est un indicateur
  // statistique de RISQUE, calculé sur une charge de fond. Après trois semaines
  // d'arrêt, cette charge de fond est effondrée — n'importe quelle reprise saine
  // affiche alors un ratio « de risque », y compris chez quelqu'un de parfaitement
  // frais. La VFC, elle, mesure vraiment l'état du système nerveux autonome.
  // Quand les deux se contredisent, on croit le corps, pas la division.
  // (Relevé : VFC +22 % sur 7 j, au plus haut de tout l'historique, sommeil ~7 h,
  // aucune douleur — et zéro qualité prescrite pendant que l'athlète courait 73 km.)
  const bodySaysFresh = i.hrvUp && !i.badNight && i.pains.length === 0;
  const notesAll: I18nText[] = [];
  if (acrHigh || tsbLow) {
    const parts = [
      acrHigh ? `ratio aigu:chronique ${frNum(r1(i.acr), 1)}` : null,
      tsbLow ? `TSB ${frNum(Math.round(i.tsb))}` : null,
    ].filter(Boolean);
    if (bodySaysFresh) {
      // On ne fait pas SEMBLANT de ne pas avoir vu la charge : on l'annonce, et on dit
      // pourquoi elle ne coûte rien cette fois.
      notesAll.push(tr((l) => MOTIF_T[l].chargeVueMaisMaintenue([
        acrHigh ? MOTIF_T[l].partRatio(nLoc(r1(i.acr), l, 1)) : null,
        tsbLow ? MOTIF_T[l].partTsb(nLoc(Math.round(i.tsb), l)) : null,
      ].filter(Boolean).join(", "))));
    } else {
      qBudget -= 1;
      easeReasons.push(`charge récente très supérieure à la charge de fond (${parts.join(", ")})`);
    }
  }

  if (i.rpeHigh) { qBudget -= 1; easeReasons.push(`ressenti élevé sur ses dernières séances (RPE moyen ${i.rpeAvg}/10)`); }
  if (i.hardTimePct != null && i.hardTimePct > 25) {
    qBudget -= 1;
    easeReasons.push(`${i.hardTimePct} % du temps en Z3+ (footings courus trop vite)`);
  }
  // Prescrit vs réalisé : le décrochage sur la dernière série est le signal le plus
  // direct qu'on ait. Seuil à 10 s/km — en deçà c'est du bruit de mesure et de terrain.
  const faded = i.fadeSec != null && i.fadeSec >= 10;
  if (faded) { qBudget -= 1; easeReasons.push(`décrochage de ${i.fadeSec} s/km sur sa dernière série (séance trop ambitieuse)`); }
  // PLATEAU : stagner pendant que la charge monte ne se soigne pas avec plus de charge.
  if (i.plateau) easeReasons.push("plateau de progression malgré une charge en hausse");
  if (i.badNight) { qBudget -= 1; easeReasons.push(`nuit dégradée (${i.badNightLabel ?? "?"})`); }
  // Pathologies interdisant l'effort maximal : on retire d'office la marche la plus haute.
  if (i.noMaxEffort) qBudget = Math.min(qBudget, 1);

  // Le PASSIF plafonne la qualité : un cardio de confirmé sur des tendons de 8 mois = blessure.
  const expCap = i.runYears == null ? null : i.runYears < 1 ? 1 : i.runYears < 3 ? 2 : null;
  const expCapped = expCap != null && qBudget > expCap;
  if (expCapped) qBudget = expCap!;
  qBudget = Math.max(0, Math.min(3, qBudget));

  // Le plafond « passif » reste prioritaire : il n'est jamais franchi par un plancher.
  const before = qBudget;
  const floor = (v: number) => { qBudget = Math.max(qBudget, expCap != null ? Math.min(v, expCap) : v); };
  if (!i.noHistory && !easeReasons.length && i.hasObjective && i.isShortGoal && i.level !== "debutant") floor(2);
  if (!i.noHistory && !easeReasons.length && qBudget === 0 && i.level !== "debutant") floor(1);

  // ── PLANCHER « PRÉPARATION EN COURS » ────────────────────────────────────────
  // Une échéance approche : on ne descend pas à zéro qualité sur une fatigue de charge.
  // Les vrais signaux d'alerte, eux, gardent le dernier mot.
  const alarm = i.pains.length > 0 || (i.hrvDown && i.badNight) || i.noMaxEffort;
  const inPrep = i.hasObjective && i.daysToRace != null && i.daysToRace >= 0 && i.daysToRace <= OBJECTIVE_FLOOR_DAYS;
  if (inPrep && !i.noHistory && !alarm && i.level !== "debutant") floor(1);

  // Plafond « perte de poids » — appliqué APRÈS les planchers, donc jamais contournable.
  // Un athlète en obésité de classe II avec un objectif chrono déclencherait sinon le
  // plancher : du fractionné sur des articulations qui encaissent près de 300 kg par appui.
  if (i.weightLossMaxQuality != null) qBudget = Math.min(qBudget, i.weightLossMaxQuality);

  return {
    // Le français sort du MÊME gabarit que les autres langues : les deux ne peuvent
    // donc pas diverger au fil des retouches.
    notes: notesAll.map((n) => n.fr),
    notesAll,
    bodySaysFresh,
    qBudget,
    structuralQBudget,
    easeReasons,
    expCapped,
    expCap,
    // « Sauvée par le plancher » ne vaut que si un allègement était en cours : sans
    // motif d'allègement, la séance est normale et n'a aucune raison d'être raccourcie.
    floored: qBudget > before && easeReasons.length > 0,
  };
}
