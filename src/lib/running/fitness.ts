import { jourLocal, ecartJours } from "@/lib/streak/compute";
// ─────────────────────────────────────────────────────────────────────────────
//  Modèle de forme : VMA, VO2max (multi-sources, façon Garmin) et prédictions de
//  chrono par distance. Calculs purs, réutilisables (profil, onboarding, IA).
//  Équivalences entre distances : modèle de Daniels & Gilbert (VDOT), lib/running/vdot.
// ─────────────────────────────────────────────────────────────────────────────
import { heatAdvice } from "@/lib/weather/openMeteo";
import { vdotDe, vmaDeVdot, vdotDeVma, tempsPourVdot, facteurSocle, SL_PLANCHER_KM, SL_PRET_KM, type Socle } from "./vdot";
export type { Socle } from "./vdot";

export const RACE_DISTANCES: { label: string; km: number }[] = [
  { label: "5 km", km: 5 }, { label: "10 km", km: 10 }, { label: "Semi", km: 21.0975 }, { label: "Marathon", km: 42.195 },
];

// ─────────────────────────────────────────────────────────────────────────────
//  ⚠️ PLUS DE BARÈME EN ESCALIER (02/10/2026). Le % de VMA tenable venait d'une table en
//  marches (0,90 jusqu'à 11 km, 0,83 jusqu'à 22 km, 0,79 jusqu'à 30 km…) : 23,7 km à
//  3'45/km donnaient 21,4 km/h de VMA à Cyprien, 10,9 km et 11,5 km différaient de 8 %,
//  et le 5 km prédit (14'55) n'avait aucun rapport avec son record de semi (1h15).
//  Tout passe désormais par le modèle de Daniels & Gilbert (`lib/running/vdot`), continu
//  et validé sur les tables publiées — la VMA y est ce qu'elle est dans l'application :
//  la vitesse tenue six minutes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SOCLE D'ENDURANCE — sortie longue et volume réels (détail et sources : lib/running/vdot).
 * Deux ancres de sortie longue : 21 km (on ne prépare pas un marathon en dessous) et
 * 32 km (préparation aboutie). N'intervient qu'AU-DELÀ du semi.
 */
export const LONG_RUN_PRET_KM = SL_PRET_KM;
export const LONG_RUN_PLANCHER_KM = SL_PLANCHER_KM;

/**
 * Un nombre seul est lu comme la plus longue sortie (forme historique de l'argument) ;
 * un objet peut ajouter le volume hebdomadaire.
 */
export function socleDe(socle: number | Socle | null | undefined): Socle | null {
  if (socle == null) return null;
  return typeof socle === "number" ? { sortieLongueKm: socle } : socle;
}

/** VMA de référence pour lire un pourcentage hors contexte (un coureur entraîné). */
export const VMA_REFERENCE_KMH = 17;

/**
 * Fraction de VMA tenue sur une distance, pour une VMA donnée — DÉRIVÉE du modèle, plus
 * une constante : un coureur à 20 km/h boucle son semi plus vite, donc il le court à un
 * pourcentage un peu plus haut qu'un coureur à 14 km/h. Sert à l'affichage et aux tests.
 */
export function pctVmaForDistance(km: number, socle?: number | Socle | null, vma = VMA_REFERENCE_KMH): number {
  const sec = predictRaceSec(vma, km, socle);
  return sec > 0 ? Math.round(((km / (sec / 3600)) / vma) * 1000) / 1000 : 0;
}

// VMA depuis un test de 6 min (demi-Cooper) : distance(m) parcourue / 100.
export const vmaFrom6min = (meters: number): number | null =>
  Number.isFinite(meters) && meters > 0 ? Math.round((meters / 100) * 10) / 10 : null;

/**
 * PART DE LA PÉNALITÉ DE CHALEUR RETENUE POUR RELIRE UNE PERFORMANCE.
 *
 * Pas une constante inventée : c'est EXACTEMENT la fraction que `autoPlan` applique déjà
 * pour corriger les allures de qualité par temps chaud (`heatAdjustDesc` divise par 2),
 * avec sa justification — la chaleur pénalise surtout les efforts longs et continus,
 * beaucoup moins un effort dur et court, où l'athlète compense en partie.
 *
 * Vérifié sur le compte de production : la pénalité PLEINE donne 21,2 km/h depuis un
 * 10 km à 29,6 °C, ce qu'aucune autre source ne corrobore. La moitié donne 19,9 —
 * exactement ce que valent les efforts du même athlète par 13 °C (19,7-19,8).
 */
export const PART_PENALITE_CHALEUR = 0.5;

/**
 * Durée qu'aurait valu cet effort EN CONDITIONS NEUTRES.
 *
 * DÉFAUT RÉEL CORRIGÉ. L'application corrigeait les allures qu'elle PRESCRIT pour la
 * chaleur, mais jamais celles qu'elle LIT. Un 10 km couru à 31 °C était donc interprété
 * comme s'il avait eu lieu à 13 °C : la VMA estimée s'effondrait chaque été, et avec
 * elle toutes les allures de l'athlète — au moment précis où il avait le plus besoin
 * qu'on ne le sous-estime pas. Constaté : 16,1 km/h lus sur une sortie à 31,8 °C contre
 * 19,7 sur la même distance à 13,5 °C, chez le même coureur à trois mois d'écart.
 *
 * `acclimFactor` ≤ 1 : un athlète acclimaté souffre moins, donc on corrige moins.
 * Sans température connue, on ne corrige RIEN — on ne devine pas la météo d'un jour.
 */
export function dureeEnConditionsNeutres(
  durationSec: number, distanceKm: number, tempC: number | null | undefined, acclimFactor = 1,
): number {
  if (tempC == null || !(distanceKm > 0) || !(durationSec > 0)) return durationSec;
  const penalite = heatAdvice(tempC, null).penaltySecPerKm * acclimFactor * PART_PENALITE_CHALEUR;
  if (!(penalite > 0)) return durationSec;
  const secParKm = durationSec / distanceKm;
  // Garde-fou : une correction ne peut pas rendre un effort plus de deux fois plus rapide.
  return Math.max(durationSec / 2, (secParKm - penalite) * distanceKm);
}

// VMA estimée depuis une performance (course ou séance dure) : vitesse / %VMA.
// On lit ce qui a été COURU : aucun socle d'endurance n'entre ici, il ne sert qu'à prédire.
export function vmaFromEffort(distanceKm: number, durationSec: number): number | null {
  if (!(distanceKm > 0) || !(durationSec > 0)) return null;
  const speed = distanceKm / (durationSec / 3600); // km/h
  if (speed < 5 || speed > 30) return null; // garde-fou (données aberrantes)
  const vdot = vdotDe(distanceKm, durationSec);
  const vma = vdot != null ? vmaDeVdot(vdot) : null;
  return vma != null ? Math.round(vma * 10) / 10 : null;
}

/**
 * ALLURE D'ENDURANCE MESURÉE — celle que l'athlète tient RÉELLEMENT en zone 2.
 *
 * DÉFAUT RÉEL, ET IL SE MORDAIT LA QUEUE. L'allure de footing était déduite d'un
 * pourcentage de VMA (70 %). Or une allure facile ne se définit pas par un pourcentage
 * de vitesse : elle se définit par la FRÉQUENCE CARDIAQUE. Le rapport entre les deux
 * dépend de l'économie de course, du terrain, de la fraîcheur — il varie d'un coureur
 * à l'autre bien plus que le modèle ne le suppose.
 *
 * Mesuré sur le compte de production, 99 séances en zone 2 (146-163 bpm, Karvonen) :
 * allure réelle 4'59/km. Le modèle en prescrivait 4'26 — soit 33 s/km trop vite, ce qui
 * situe le « footing » en zone 3. L'application reprochait donc à l'athlète de courir
 * ses footings trop vite (« 31 % du temps en Z3+ ») TOUT EN LUI PRESCRIVANT une allure
 * qui l'y envoyait. Elle causait le défaut qu'elle signalait.
 *
 * On lit l'allure DANS SES CONDITIONS (correction de chaleur) et on renvoie une valeur
 * NEUTRE : le plan ré-applique ensuite la pénalité météo du jour prescrit. Sans cela,
 * la chaleur serait comptée deux fois.
 *
 * `null` si l'historique ne permet pas de conclure — l'appelant retombe alors sur le
 * pourcentage de VMA, et doit le dire.
 */
export const MIN_SEANCES_ALLURE_Z2 = 5;

export function easyPaceFromHeartRate(
  runs: { distance_km?: number | null; duration_seconds?: number | null; avg_hr?: number | null; weather_temp_c?: number | null }[],
  maxHr: number | null | undefined,
  restHr: number | null | undefined,
  acclimFactor = 1,
): number | null {
  if (!(maxHr && maxHr > 120) || !(restHr && restHr > 20) || maxHr <= restHr) return null;
  // Zone 2 « facile » au sens de l'application elle-même : réserve cardiaque 60-70 %
  // (Karvonen), la définition déjà utilisée pour afficher les zones à l'athlète.
  const bas = restHr + (maxHr - restHr) * 0.6;
  const haut = restHr + (maxHr - restHr) * 0.7;
  const allures: number[] = [];
  for (const w of runs) {
    // 4 km minimum : sur plus court, l'échauffement pèse trop dans la moyenne.
    if (!w.distance_km || w.distance_km < 4 || !w.duration_seconds || w.avg_hr == null) continue;
    if (w.avg_hr < bas || w.avg_hr >= haut) continue;
    const sec = dureeEnConditionsNeutres(w.duration_seconds, w.distance_km, w.weather_temp_c, acclimFactor);
    allures.push(sec / w.distance_km);
  }
  if (allures.length < MIN_SEANCES_ALLURE_Z2) return null;
  // MÉDIANE et pas moyenne : une seule sortie en montagne ou un GPS qui déraille
  // déplacerait la moyenne, jamais la médiane.
  allures.sort((a, b) => a - b);
  return Math.round(allures[Math.floor(allures.length / 2)]);
}

// VO2max (ml/kg/min) à partir de plusieurs sources, comme Garmin combine les données.
//  • VMA × 3.5 (Léger)  • 15.3 × FCmax/FCrepos (Uth-Sørensen)
// VMA (km/h) déduite d'une VO2max (formule de Léger : VO2max ≈ 3,5 × VMA).
// Une VO2max absente ou aberrante ne donne PAS de VMA : 0 est lu comme « pas de
// valeur » par les appelants, là où NaN se propageait jusqu'à l'écran.
export const vmaFromVo2max = (vo2max: number): number =>
  Number.isFinite(vo2max) && vo2max > 0 ? Math.round((vo2max / 3.5) * 10) / 10 : 0;

export function vo2maxEstimate(opts: { vma?: number | null; maxHr?: number | null; restHr?: number | null; garmin?: number | null }): { value: number; sources: string[] } | null {
  // Mesure Garmin (montre) = source de vérité → on la prend telle quelle, sans moyenner avec l'estimation.
  if (opts.garmin && opts.garmin > 0) return { value: Math.round(opts.garmin), sources: ["Garmin"] };
  const ests: { v: number; src: string }[] = [];
  if (opts.vma && opts.vma > 0) ests.push({ v: opts.vma * 3.5, src: "VMA" });
  if (opts.maxHr && opts.restHr && opts.restHr > 0 && opts.maxHr > opts.restHr) ests.push({ v: 15.3 * (opts.maxHr / opts.restHr), src: "FC max/repos" });
  if (!ests.length) return null;
  return { value: Math.round(ests.reduce((a, b) => a + b.v, 0) / ests.length), sources: ests.map(e => e.src) };
}

export const vo2maxLabel = (v: number): string =>
  v >= 65 ? "🏆 Élite" : v >= 56 ? "✅ Excellent" : v >= 46 ? "👍 Bon" : v >= 36 ? "📈 Moyen" : "🌱 En progression";

// Temps prédit (secondes) sur une distance, depuis la VMA.
export function predictRaceSec(vma: number, distanceKm: number, socle?: number | Socle | null): number {
  // Sans VMA exploitable il n'y a pas de prédiction : 0 se lit comme « pas de valeur »
  // par les appelants, là où `Infinity` se lisait « InfinityhNaN » à l'écran.
  if (!Number.isFinite(vma) || vma <= 0 || !Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const vdot = vdotDeVma(vma);
  if (vdot == null) return 0;
  // L'équivalence de Daniels, puis le socle d'endurance au-delà du semi (lib/running/vdot).
  return tempsPourVdot(vdot, distanceKm) * facteurSocle(distanceKm, socleDe(socle));
}

/**
 * ⚠️ LE DERNIER REMPART AVANT L'ÉCRAN. Ces deux formateurs rendaient « NaN:NaN » et
 * « NaN'NaN/km » — et `racePredictions(null)` allait jusqu'à « InfinityhNaN ». Les
 * quatre appelants actuels gardent tous leur entrée (`vma > 0`), donc rien de tel n'est
 * affiché aujourd'hui : c'est une fragilité, pas un défaut vivant. Mais le jour où un
 * cinquième appelant oublie la garde, mieux vaut un tiret honnête qu'un charabia qui
 * ressemble à une panne du produit.
 *
 * ⚠️ ET `?? 0` NE RATTRAPE PAS `NaN` : seul `Number.isFinite` le voit.
 */
export const NON_CHIFFRE = "—";

export const fmtTime = (sec: number): string => {
  if (!Number.isFinite(sec)) return NON_CHIFFRE;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};
export const fmtPaceSec = (secPerKm: number): string =>
  !Number.isFinite(secPerKm) ? NON_CHIFFRE :
  `${Math.floor(secPerKm / 60)}'${String(Math.round(secPerKm % 60)).padStart(2, "0")}`;

// Prédictions complètes par distance depuis la VMA.
export function racePredictions(vma: number, socle?: number | Socle | null): { label: string; km: number; time: string; pace: string }[] {
  return RACE_DISTANCES.map(d => {
    const sec = predictRaceSec(vma, d.km, socle);
    return { label: d.label, km: d.km, time: fmtTime(sec), pace: fmtPaceSec(sec / d.km) + "/km" };
  });
}

// ── Projection vers l'objectif : chrono atteignable maintenant + projeté le jour J ──
export type RaceProjection = {
  nowSec: number; projectedSec: number; gapSec: number | null;
  verdict: "acquis" | "atteignable" | "ambitieux" | "irrealiste";
};
export function raceProjection(
  currentVma: number, distanceKm: number, targetSec: number | null, weeksToRace: number | null,
  /** Amélioration attendue d'ici la course, en fraction (0,05 = 5 %). Quand elle est
   *  fournie, elle vient de la pente RÉELLE de l'athlète (`lib/running/progression`)
   *  et remplace l'hypothèse générique — laquelle promettait le même progrès à tout le
   *  monde, qu'il monte ou qu'il stagne. */
  ameliorationMesuree?: number | null,
  /** Socle d'endurance réel (sortie longue, volume) : sans lui, la prédiction prudente. */
  socle?: number | Socle | null,
): RaceProjection {
  const nowSec = predictRaceSec(currentVma, distanceKm, socle);
  // Amélioration réaliste sur le bloc : ~0,4 %/sem de gain d'allure, plafonné à 8 %.
  const improv = typeof ameliorationMesuree === "number" && Number.isFinite(ameliorationMesuree)
    ? Math.min(0.08, Math.max(0, ameliorationMesuree))
    : weeksToRace != null ? Math.min(0.08, Math.max(0, weeksToRace) * 0.004) : 0;
  const projectedSec = Math.round(nowSec * (1 - improv));
  let verdict: RaceProjection["verdict"] = "atteignable";
  let gapSec: number | null = null;
  if (targetSec != null && targetSec > 0) {
    gapSec = projectedSec - targetSec;
    verdict = targetSec >= nowSec ? "acquis"
      : targetSec >= projectedSec ? "atteignable"
      : targetSec >= projectedSec * 0.97 ? "ambitieux"
      : "irrealiste";
  }
  return { nowSec, projectedSec, gapSec, verdict };
}

// ── Risque de charge (anti-blessure proactif / déload auto) ──
const TSS_BY_TYPE: Record<string, number> = { easy: 50, tempo: 75, interval: 90, vma: 100, long_run: 65, trail: 70, hill_repeat: 85, race: 110, recovery: 30, strength: 40 };
export function estimateTSS(w: { duration_seconds?: number | null; type?: string | null; tss?: number | null }): number {
  if (w.tss != null) return Number(w.tss);
  return Math.round(((w.duration_seconds ?? 0) / 3600) * (TSS_BY_TYPE[String(w.type ?? "")] ?? 60));
}
export type LoadRisk = { acwr: number; monotony: number; deload: boolean; level: "ok" | "vigilance" | "deload"; reason: string };
export function loadRisk(workouts: { date: string; type?: string | null; duration_seconds?: number | null; tss?: number | null }[]): LoadRisk {
  // ⚠️ JOURS DE CALENDRIER, comme partout ailleurs sur le tableau de bord. Les fenêtres
  //    étaient ancrées sur l'heure exacte de l'appel et le découpage quotidien se faisait
  //    en UTC : le ratio bougeait selon le moment de la consultation, et la journée
  //    d'entraînement d'un athlète parisien basculait à 02 h du matin. Le 0,58 affiché
  //    était juste, mais il n'était pas STABLE — et il est lu à côté d'un volume et d'une
  //    charge qui, eux, comptent en cases de calendrier.
  const aujourdhui = jourLocal();
  const ageDe = (w: { date: string }) => {
    const j = String(w.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(j)) return null;
    const n = ecartJours(j, aujourdhui);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const within = (d: number) => workouts.filter(w => { const a = ageDe(w); return a != null && a < d; });
  const tss7 = within(7).reduce((s, w) => s + estimateTSS(w), 0);
  const tss28 = within(28).reduce((s, w) => s + estimateTSS(w), 0);
  const acwr = tss28 > 0 ? Math.round((tss7 / (tss28 / 4)) * 100) / 100 : 0;
  const daily = Array.from({ length: 7 }, (_, i) =>
    workouts.filter(w => ageDe(w) === i).reduce((s, w) => s + estimateTSS(w), 0));
  const mean = daily.reduce((a, b) => a + b, 0) / 7;
  const sd = Math.sqrt(daily.reduce((a, b) => a + (b - mean) ** 2, 0) / 7) || 1;
  const monotony = mean > 0 ? Math.round((mean / sd) * 10) / 10 : 0;
  const deload = acwr > 1.5 || monotony > 2.2;
  const level: LoadRisk["level"] = deload ? "deload" : (acwr > 1.3 || monotony > 1.8 ? "vigilance" : "ok");
  const reason = acwr > 1.5 ? `charge aiguë +${Math.round((acwr - 1) * 100)} % vs ta moyenne (risque blessure)`
    : monotony > 2.2 ? "entraînement trop monotone (varie l'intensité, ajoute un vrai repos)"
    : acwr > 1.3 ? "charge en hausse — surveille la récupération" : "";
  return { acwr, monotony, deload, level, reason };
}

// Meilleure VMA estimée depuis l'historique : UNIQUEMENT des efforts réellement
// soutenus (FC élevée), sinon on surestime (un footing rapide n'est pas un max).
/**
 * VMA déduite des MEILLEURS EFFORTS mesurés (courbe d'allure intervals.icu, 42 j).
 *
 * De loin la source la plus fiable, et pour une raison simple : une moyenne d'activité
 * divise la distance totale par la durée totale, échauffement et retour au calme
 * compris — elle sous-estime l'effort réel. La courbe d'allure, elle, retient le
 * meilleur segment continu à chaque distance.
 *
 * On prend le MAXIMUM des VMA implicites : chaque effort n'est un révélateur que s'il
 * a été maximal, et un effort non maximal ne peut que sous-estimer. Le plus favorable
 * est donc le plus proche de la vérité.
 */
export function vmaFromPaceCurve(best: { m: number; sec: number }[] | null | undefined): number | null {
  if (!best?.length) return null;
  let top: number | null = null;
  for (const b of best) {
    if (!(b.m > 0) || !(b.sec > 0)) continue;
    const v = vmaFromEffort(b.m / 1000, b.sec);
    if (v != null && (top == null || v > top)) top = v;
  }
  return top;
}

/**
 * LA VMA EFFECTIVE — un seul calcul, pour toute l'application.
 *
 * DÉFAUT RÉEL CORRIGÉ. Quatre chaînes distinctes calculaient la VMA : le coach, le
 * tableau de bord, le profil et `getEffectiveVma`. Elles ne consultaient ni les mêmes
 * sources ni dans le même ordre — le tableau de bord ignorait purement et simplement la
 * courbe d'allure. Relevé sur le compte de production : coach 17,3 km/h, tableau de bord
 * 18,7 km/h, profil 17,3, pour le même athlète au même instant. Chaque commentaire de
 * chaque chaîne affirmait pourtant « garantit le MÊME chiffre côté coach et côté client ».
 *
 * CE QUI A CHANGÉ EN PLUS : LA COURBE ET LA VO2max SE CROISENT.
 * La courbe d'allure ne connaît que ce que l'athlète A COURU. Sans effort maximal récent,
 * son meilleur 5 000 m est une sortie d'entraînement, et la VMA qu'on en déduit est
 * plancher, pas plafond. Constaté : courbe → 17,3 km/h alors que la VO2max mesurée par la
 * montre (63) en donne 18,0 et que le meilleur 10 000 m de la courbe (41'08) est très
 * au-dessous de ce qu'une VO2max de 63 permet. La VO2max n'était jamais consultée : elle
 * était en dernier recours, derrière une courbe qui répond toujours.
 *
 * On retient donc la PLUS HAUTE des deux. Ce n'est pas de l'optimisme : les deux sources
 * ne peuvent que SOUS-estimer (un effort non maximal ne révèle pas le maximum), donc la
 * plus favorable est la plus proche de la vérité. Le même raisonnement que
 * `vmaFromPaceCurve` applique déjà entre ses propres points.
 *
 * Un test enregistré garde la priorité absolue : c'est la seule valeur MESURÉE.
 */
export type VmaSource = "test" | "courbe" | "vo2max" | "séances" | null;

export function effectiveVma(i: {
  /** `performance_baselines.vma_kmh` — un vrai test, s'il existe. */
  vmaStored?: number | null;
  /** `profiles.pace_curve.best` — meilleurs efforts continus. */
  paceCurveBest?: { m: number; sec: number }[] | null;
  /** VO2max mesurée par la montre (`profiles.garmin_vo2max`). */
  garminVo2?: number | null;
  /** Repli quand ni courbe ni VO2max : les efforts soutenus de l'historique. */
  fromRuns?: number | null;
}): { vma: number | null; source: VmaSource } {
  if (i.vmaStored != null && i.vmaStored > 0) return { vma: i.vmaStored, source: "test" };
  const curve = vmaFromPaceCurve(i.paceCurveBest);
  const vo2 = i.garminVo2 != null && i.garminVo2 > 0 ? vmaFromVo2max(i.garminVo2) : null;
  const runs = i.fromRuns != null && i.fromRuns > 0 ? i.fromRuns : null;
  // LES TROIS SOURCES SE COMPARENT, la plus haute gagne — et on NOMME celle qui a gagné,
  // pour que l'athlète puisse vérifier d'où sort son chiffre au lieu de le subir.
  //
  // Les efforts réels ne sont plus un simple REPLI : depuis qu'ils sont relus dans leurs
  // conditions (chaleur), ils redeviennent la mesure la plus directe qu'on ait. Les
  // reléguer derrière une courbe d'allure polluée par un été à 31 °C revenait à jeter
  // la meilleure donnée disponible.
  const candidats: { v: number; s: VmaSource }[] = [
    ...(curve != null ? [{ v: curve, s: "courbe" as const }] : []),
    ...(vo2 != null ? [{ v: vo2, s: "vo2max" as const }] : []),
    ...(runs != null ? [{ v: runs, s: "séances" as const }] : []),
  ];
  if (!candidats.length) return { vma: null, source: null };
  const gagnant = candidats.reduce((a, b) => (b.v > a.v ? b : a));
  return { vma: gagnant.v, source: gagnant.s };
}

/** La séance qui donne la VMA « séances » : sa valeur, et de QUAND et de QUOI elle date. */
export type MeilleurEffort = { vma: number; date: string | null; distanceKm: number };

export function bestVmaFromWorkouts(
  ...args: Parameters<typeof meilleurEffort>
): number | null {
  return meilleurEffort(...args)?.vma ?? null;
}

/**
 * ⚠️ LA MÊME RECHERCHE, MAIS QUI DIT D'OÙ VIENT LE CHIFFRE. « 19,8 km/h — VMA estimée »
 * ne permettait pas de savoir si la carte suivait la forme ou datait de six mois
 * (Cyprien, 28/09/2026 : « est-ce que ça se met régulièrement à jour ? »). Elle suit :
 * c'était son semi de Lambersart du 24/08, relu à 23,9 °C. Il faut pouvoir le LIRE.
 */
export function meilleurEffort(
  workouts: { date?: string; distance_km?: number | null; duration_seconds?: number | null; type?: string | null; avg_hr?: number | null;
    /** Température du jour de la séance. Sans elle, aucune correction n'est appliquée. */
    weather_temp_c?: number | null }[],
  maxHr?: number | null,
  /**
   * Fenêtre de FORME (jours). Sans elle, un record vieux de cinq mois sert encore de
   * base aux allures prescrites. Constaté en production : une VMA de 19,8 km/h issue
   * d'un 10 km de mars pilotait encore les séances d'août, produisant des fractionnés
   * plus rapides que le record de l'athlète sur la distance. On prescrit sur la forme
   * du moment, pas sur le souvenir du pic.
   */
  windowDays = 120,
  /** Acclimatation à la chaleur (≤ 1) : un athlète acclimaté souffre moins, on corrige moins. */
  heatFactor = 1,
): MeilleurEffort | null {
  let best: MeilleurEffort | null = null;
  const now = Date.now();
  for (const w of workouts) {
    if (w.date && (now - new Date(w.date).getTime()) > windowDays * 86400000) continue;
    if (!w.distance_km || w.distance_km < 2 || !w.duration_seconds) continue;
    if (/strength|renfo|muscu/i.test(String(w.type ?? ""))) continue;
    // Effort vraiment maximal exigé : si on a la FC, il faut ≥ 85 % de la FC max.
    if (maxHr && maxHr > 120 && w.avg_hr != null && w.avg_hr < maxHr * 0.85) continue;
    // L'effort est relu DANS SES CONDITIONS : un 10 km à 31 °C ne vaut pas le même
    // chrono qu'à 13 °C, et le lire brut faisait s'effondrer la VMA chaque été.
    const sec = dureeEnConditionsNeutres(w.duration_seconds, w.distance_km, w.weather_temp_c, heatFactor);
    const v = vmaFromEffort(w.distance_km, sec);
    if (v != null && (best == null || v > best.vma)) best = { vma: v, date: w.date ? String(w.date).slice(0, 10) : null, distanceKm: w.distance_km };
  }
  return best;
}
