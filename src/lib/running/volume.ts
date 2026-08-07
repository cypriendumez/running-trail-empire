// ─────────────────────────────────────────────────────────────────────────────
//  VOLUME DE RÉFÉRENCE & SORTIE LONGUE — calculs purs, donc testables.
//
//  Extrait de coachContext pour être figé par des tests : ces deux nombres pilotent
//  TOUTES les séances prescrites. Quand ils sont faux, rien ne plante — le plan est
//  simplement dimensionné pour quelqu'un d'autre, et personne ne s'en aperçoit.
// ─────────────────────────────────────────────────────────────────────────────

export type RunLike = { date: string; distance_km?: number | null };

/**
 * Volume hebdomadaire REPRÉSENTATIF, en km — médiane des semaines réellement courues.
 *
 * DÉFAUT RÉEL CORRIGÉ. La référence était `kmIn(28) / 4`, une moyenne sur 28 jours.
 * Relevé en production : un athlète rentrant de trois semaines et demie sans courir,
 * puis enchaînant 62 km en une semaine, était décrit par une « moyenne 4 semaines » de
 * 23 km/sem — un chiffre qui ne correspondait à AUCUNE de ses semaines. Ni les 62 km
 * courus, ni les 0 km de la coupure. Le plan marathon qui en découlait plafonnait à
 * 49 km/semaine avec une sortie longue de 12 km, et lui prescrivait 9 km de sortie
 * longue deux jours après qu'il en eut couru 26.
 *
 * La médiane des semaines NON NULLES répond aux deux biais à la fois : la coupure
 * n'écrase plus la référence (les semaines à zéro sont écartées), et un pic de vacances
 * ne la gonfle pas (une médiane ignore l'extrême). On ne prend PAS la moyenne des
 * semaines non nulles : elle resterait sensible au pic.
 *
 * Garde-fou : il faut au moins 3 semaines courues pour qu'une médiane veuille dire
 * quelque chose. En dessous, on renvoie `null` et l'appelant garde son ancien calcul —
 * mieux vaut une référence imparfaite qu'un niveau déduit de deux points.
 *
 * Les semaines à zéro écartées sont renvoyées : une coupure de 3 semaines change la
 * prescription (reprise progressive), elle doit rester visible, pas être gommée.
 */
export function robustWeeklyKm(
  runs: RunLike[],
  now = Date.now(),
  weeks = 8,
): { km: number; weeksRun: number; weeksOff: number } | null {
  const buckets = new Array(weeks).fill(0);
  for (const r of runs) {
    const t = new Date(r.date).getTime();
    if (!Number.isFinite(t)) continue;
    const ageDays = (now - t) / 86400000;
    if (ageDays < 0 || ageDays >= weeks * 7) continue;
    buckets[Math.floor(ageDays / 7)] += Math.max(0, r.distance_km ?? 0);
  }
  // Une semaine « courue » demande un minimum réel : 2 km, c'est un test de chaussures,
  // pas une semaine d'entraînement, et l'inclure tirerait la médiane vers le bas.
  const run = buckets.filter((k) => k >= 2).sort((a, b) => a - b);
  const off = buckets.length - run.length;
  if (run.length < 3) return null;

  const mid = Math.floor(run.length / 2);
  const km = run.length % 2 ? run[mid] : (run[mid - 1] + run[mid]) / 2;
  return { km: Math.round(km * 10) / 10, weeksRun: run.length, weeksOff: off };
}

/**
 * CAPACITÉ DÉMONTRÉE — le volume hebdomadaire que l'athlète a DÉJÀ tenu, en km.
 *
 * DÉFAUT RÉEL CORRIGÉ. Le coach ne regardait que les 8 dernières semaines (et ne
 * chargeait même que 60 séances, soit ~10 à 13 semaines). Un athlète de 20 ans qui
 * tournait à 71-80 km/semaine quatre mois plus tôt était donc décrit comme un coureur
 * à 31 km/semaine, et son plan marathon plafonné en conséquence. Or un système
 * musculo-tendineux qui a encaissé 80 km/semaine y revient BEAUCOUP plus vite qu'il n'y
 * est monté la première fois : ignorer cet historique, c'est le faire repartir de zéro.
 *
 * Médiane des 4 MEILLEURES semaines sur la fenêtre (26 semaines par défaut) : une seule
 * semaine exceptionnelle ne suffit pas à « démontrer » une capacité, quatre oui.
 *
 * ⚠️ Ce nombre relève le PLAFOND de la montée en charge, jamais la cible immédiate.
 * Avoir tenu 80 km il y a quatre mois ne dit rien de ce qu'on encaisse cette semaine —
 * c'est le ratio aigu:chronique et la VFC qui en décident, et eux ne regardent que le
 * présent.
 */
export function demonstratedWeeklyKm(runs: RunLike[], now = Date.now(), weeks = 26): number | null {
  const buckets = new Array(weeks).fill(0);
  for (const r of runs) {
    const t = new Date(r.date).getTime();
    if (!Number.isFinite(t)) continue;
    const ageDays = (now - t) / 86400000;
    if (ageDays < 0 || ageDays >= weeks * 7) continue;
    buckets[Math.floor(ageDays / 7)] += Math.max(0, r.distance_km ?? 0);
  }
  const top = buckets.filter((k) => k >= 2).sort((a, b) => b - a).slice(0, 4);
  if (top.length < 4) return null; // moins de 4 semaines réelles : rien n'est « démontré »
  const med = (top[1] + top[2]) / 2; // médiane des 4 meilleures
  return Math.round(med);
}

// ── Sortie longue ────────────────────────────────────────────────────────────

export type RaceGoal = "5k" | "10k" | "semi" | "marathon" | "trail" | "ultra" | "general";

/**
 * Plus longue sortie à atteindre AU PIC de préparation, en km, selon la distance visée.
 *
 * DÉFAUT RÉEL CORRIGÉ. La sortie longue valait `volume hebdo × 25 %` — le plafond de
 * Daniels — et rien d'autre. Or ce plafond sert à empêcher la sortie longue d'écraser
 * la semaine ; il ne DIT PAS ce qu'il faut courir pour une distance donnée. Appliqué
 * seul à un coureur de 49 km/semaine, il produisait une sortie longue maximale de 12 km
 * pour un marathon : 28 % de la distance de course. Le mur est garanti au 25ᵉ km, et
 * aucun écran ne le signalait.
 *
 * Repères retenus (pratique courante en préparation, pas une invention) :
 *   · 5-10 km   → la sortie longue dépasse la course : l'endurance de base porte le chrono ;
 *   · semi      → ~90 % de la distance ;
 *   · marathon  → ~75 %, plafonné à 32 km (au-delà, le coût de récupération dépasse
 *                 le bénéfice pour un amateur — c'est un consensus, pas une timidité) ;
 *   · ultra     → on ne court jamais la distance : 50 % plafonné à 40 km, le reste se
 *                 construit par le D+ et les week-ends chocs.
 */
export function longRunPeakKm(goal: RaceGoal, raceKm: number | null): number | null {
  if (!raceKm || raceKm <= 0) return null;
  if (goal === "ultra" || raceKm > 45) return Math.min(40, Math.round(raceKm * 0.5));
  if (raceKm > 25) return Math.min(32, Math.round(raceKm * 0.75));
  if (raceKm > 15) return Math.round(raceKm * 0.9);
  return Math.max(12, Math.round(raceKm * 1.5));
}

/**
 * Part du volume hebdomadaire que la sortie longue a le droit d'occuper.
 *
 * Les 25 % de Daniels visent des coureurs à gros volume : à 120 km/semaine, 25 % font
 * déjà 30 km. Chez un amateur à 50 km/semaine, s'y tenir interdit toute préparation
 * marathon sérieuse. La pratique admet 30 à 35 % sur les distances longues — la
 * contrainte devient alors le TEMPS passé debout, pas le pourcentage.
 */
export function longRunShare(goal: RaceGoal, raceKm: number | null): number {
  if (goal === "ultra" || (raceKm ?? 0) > 45) return 0.35;
  if ((raceKm ?? 0) > 25) return 0.35;
  if ((raceKm ?? 0) > 15) return 0.30;
  return 0.25;
}

/**
 * Sortie longue de la semaine `i` d'un macro-plan : progression bornée des DEUX côtés.
 *
 * Passer de 9 à 32 km parce que le marathon l'exige serait remplacer un défaut par un
 * autre bien pire — la blessure. On monte donc de 2 km par semaine au maximum, sans
 * jamais dépasser la part autorisée du volume hebdomadaire ni le pic visé, et on
 * redescend en affûtage.
 *
 * @param current  plus longue sortie réellement courue récemment (point de départ honnête)
 * @param peak     cible au pic (longRunPeakKm) — `null` si aucun objectif de course
 * @param weeksToPeak semaines disponibles avant l'affûtage
 */
export function longRunForWeek(args: {
  weekIndex: number; weeksToPeak: number;
  current: number; peak: number | null;
  weeklyKm: number; share: number; taper: boolean;
}): number {
  const { weekIndex, weeksToPeak, current, peak, weeklyKm, share, taper } = args;

  // Affûtage : on coupe pour de bon, la sortie longue n'apporte plus rien.
  if (taper) return Math.max(1, Math.round(Math.min(weeklyKm * 0.20, peak ?? Infinity)));

  // Sans objectif de course, rien ne dit quelle distance viser : on s'en tient à la part
  // du volume, comme avant. On n'invente pas un pic qui n'a pas de raison d'être.
  if (peak == null) return Math.max(1, Math.round(weeklyKm * share));

  // 1. Progression vers le pic, bornée à +2 km par semaine au-dessus de la plus longue
  //    sortie réellement courue.
  //
  //    L'incrément se compte en `weekIndex` et NON en `weekIndex + 1` : la semaine 0 est
  //    la semaine en cours, on n'y a encore rien progressé. Avec `+1`, la borne partait
  //    déjà à +2 km et la rampe linéaire passait dessous sans jamais la toucher — un
  //    garde-fou qui ne se déclenchait jamais (relevé par le test : bond de 13 à 16 km).
  const progress = Math.min(1, weekIndex / Math.max(1, weeksToPeak));
  const wanted = Math.min(
    current + (peak - current) * progress,
    current + 2 * weekIndex,
    peak,
  );

  // 2. Garde-fou dur : au-delà de la MOITIÉ du volume hebdomadaire, la sortie longue
  //    déséquilibre la semaine et blesse. On ne descend cependant jamais sous ce que
  //    l'athlète COURT DÉJÀ — prescrire 9 km à quelqu'un qui vient d'en courir 26 était
  //    le défaut d'origine, le corriger par un plafond l'aurait réintroduit.
  //
  //    `byVolume` n'est délibérément PAS utilisé comme plancher : un coureur à 70 km/semaine
  //    dont la plus longue sortie est de 10 km ne doit pas sauter à 24 km sous prétexte que
  //    son volume le permettrait. C'est la durée d'UNE sortie qui blesse, pas le ratio.
  //
  //    Quand ce plafond mord — volume trop bas pour la distance visée — `longRunGap` le
  //    signale au lieu de le taire.
  const ceiling = Math.max(weeklyKm * 0.5, current);
  return Math.max(1, Math.round(Math.min(wanted, ceiling)));
}

/**
 * L'écart entre ce que la préparation atteindra et ce que la course demande.
 *
 * C'est le point le plus important de ce fichier : quand la montée en charge ne suffit
 * pas à préparer la distance visée, on le DIT au lieu de prescrire une sortie longue de
 * 12 km pour un marathon en laissant croire que c'est la bonne.
 */
export function longRunGap(peakPlanned: number, peakNeeded: number | null, raceKm: number | null): string | null {
  if (peakNeeded == null || raceKm == null) return null;
  if (peakPlanned >= peakNeeded * 0.85) return null;
  const km = raceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return `⚠️ PRÉPARATION INSUFFISANTE POUR LA DISTANCE : au rythme de progression actuel, la plus longue sortie de la préparation plafonnera à ~${peakPlanned} km pour une course de ${km} km (il en faudrait ~${peakNeeded}). Dis-le-lui clairement et propose l'un des deux : augmenter la fréquence des sorties pour faire monter le volume, ou viser une distance plus courte cette fois-ci. Ne fais pas comme si le plan préparait la course.`;
}
