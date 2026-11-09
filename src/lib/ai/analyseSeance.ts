// ─────────────────────────────────────────────────────────────────────────────
//  LES FAITS D'UNE SÉANCE — ce que le modèle a le droit d'écrire.
//
//  Le coach proposait la séance du jour ; aucune séance PASSÉE n'était jamais relue.
//  L'athlète voyait ses chiffres bruts et devait les interpréter seul, ce qui est
//  exactement le travail qu'il paie.
//
//  ⚠️ CE MODULE NE PARLE PAS AU MODÈLE. Il calcule des faits VÉRIFIABLES — intensité
//  réelle, répartition en zones, rang parmi les séances comparables, écart au prescrit —
//  et la route les lui donne en lui interdisant d'en inventer d'autres. C'est la seule
//  façon d'avoir une analyse qui ne raconte pas ce qui l'arrange : un modèle à qui on
//  tend des chiffres bruts en fabrique toujours un récit.
//
//  ⚠️ ET L'INTENSITÉ SE JUGE À LA FC, JAMAIS À L'ÉTIQUETTE. Mesuré sur un compte réel :
//  305 séances sur 334 sont dites « easy » par la montre, séances à 180 bpm comprises.
//  Se fier au champ `type` ferait analyser une séance de seuil comme un footing.
// ─────────────────────────────────────────────────────────────────────────────

import { parseReps, parsePaceSec, FOURCHETTE_QUALITE_SEC } from "@/lib/watch/intervals";
import { serieDeRepetitions, blocPrincipal, type DetailIntervalles, type FluxSeance } from "@/lib/intervals/performance";
import type { PausesSeance } from "@/lib/activities/pauses";

/** Part de la FC max au-delà de laquelle une séance est DURE. Même valeur que le reste
 *  du coach (`PART_FC_DURE` dans coachContext) : deux seuils divergents donneraient deux
 *  verdicts différents sur la même séance selon l'écran. */
export const PART_FC_DURE = 0.85;
/** En deçà, la séance est un footing. Entre les deux, elle est « modérée ». */
export const PART_FC_FACILE = 0.75;
/** Écart de distance sous lequel deux séances sont jugées comparables. */
export const ECART_DISTANCE = 0.15;
/** En dessous, un classement ne veut rien dire. */
export const COMPARABLES_MIN = 4;
/**
 * FC moyenne en dessous de laquelle une séance de course n'est PAS crédible.
 *
 * ⚠️ VU SUR UN APPEL RÉEL. Une séance du compte porte 64 bpm de moyenne, 65 de maximum et
 * aucune distance : la montre a enregistré une période de repos. Le coach en a tiré
 * « une bonne gestion de l'effort malgré la chaleur » — il n'a inventé aucun chiffre, il
 * a inventé du SENS, ce qui est pire parce que ça ne se repère pas.
 */
export const FC_PLANCHER = 90;

/** Les séances dont l'allure prévue vaut pour TOUTE la sortie (types canoniques du plan). Pour
 *  les autres — seuil, tempo —, c'est le corps de séance qui se compare à la cible. */
export const SEANCE_HOMOGENE = /^(endurance|sortie longue|récup)/i;

export type SeanceBrute = {
  id?: string; date: string; title?: string | null; sport?: string | null;
  distance_km?: number | null; duration_seconds?: number | null;
  avg_pace_min_km?: number | null; gap_min_km?: number | null;
  avg_hr?: number | null; max_hr?: number | null;
  elevation_gain_m?: number | null; hr_zone_seconds?: unknown;
  avg_cadence_spm?: number | null; weather_temp_c?: number | null;
  // La foulée et la dérive cardiaque, lues pour l'analyse COMPLÈTE (Premium) seulement.
  cardiac_decoupling?: number | null; avg_power_watts?: number | null; ground_contact_ms?: number | null;
  vertical_oscillation_cm?: number | null; stride_length_m?: number | null;
  /** L'identifiant de l'activité chez intervals.icu, pour en relire les intervalles. */
  external_id?: string | null;
};

export type Reperes = { fcMax?: number | null; vma?: number | null; allureFacile?: string | null };

export type Prescrit = { type?: string | null; titre?: string | null; detail?: string | null } | null;

/** Le type de « prescrit » d'un jour de course : la course elle-même, pas un entraînement. */
export const TYPE_COURSE = "Course";

type CourseObjectif = { race?: unknown; raceDate?: unknown; distanceKm?: unknown };
export type ObjectifAvecPrecedente = (CourseObjectif & { precedente?: CourseObjectif | null }) | null | undefined;

/**
 * LA SÉANCE ÉTAIT-ELLE LA COURSE VISÉE ? (09/11/2026)
 *
 * Marathon de Lille, 25/10 : le coach avait publié une « Récupération » ce jour-là, et l'analyse
 * a jugé le marathon contre elle — « intensité totalement inappropriée pour une séance de
 * récupération ». Le jour de l'objectif (ou de la course qu'il a remplacée), une séance à ±15 %
 * de la distance (GPS, parcours) EST la course : on la juge comme une course.
 * Sans distance connue pour l'objectif, une sortie d'au moins 3 km ce jour-là suffit.
 */
export function courseDuJour(o: ObjectifAvecPrecedente, jour: string, distanceKm: number | null | undefined): { nom: string; distanceKm: number | null } | null {
  for (const c of [o, o?.precedente]) {
    if (!c || String(c.raceDate ?? "").slice(0, 10) !== jour) continue;
    const d = Number(c.distanceKm), km = Number(distanceKm);
    if (Number.isFinite(d) && d > 0) {
      if (!(km > 0) || Math.abs(km - d) / d > 0.15) continue;
    } else if (!(km >= 3)) continue;
    return { nom: String(c.race ?? "").trim(), distanceKm: Number.isFinite(d) && d > 0 ? d : null };
  }
  return null;
}

/**
 * LE CONTEXTE DU JOUR DE LA SÉANCE (analyse complète), relu par la route : chaque champ
 * `null` = non mesuré, et l'analyse le dit. ABSENT (`undefined`) = non demandé (Starter).
 */
export type ContexteSeance = {
  /** Le ressenti déclaré pour CETTE séance (note sur 10), s'il existe. */
  ressenti: { rpe: number } | null;
  /** La nuit qui précède (le sommeil daté du jour de la séance). */
  nuit: { score: number | null; minutes: number | null } | null;
  /** La VFC du matin de la séance, et sa moyenne des 7 jours précédents (même mesure). */
  vfc: { matin: number; base: number | null } | null;
  /** La fraîcheur la veille au soir (modèle de charge `computeLoad`). */
  forme: { tsb: number; ctl: number; atl: number } | null;
};

export type FaitsSeance = {
  /** Faux quand la séance n'a rien d'interprétable : le modèle doit alors se taire. */
  exploitable: boolean;
  date: string;
  sport: string;
  distanceKm: number | null;
  dureeMin: number | null;
  /** Allure réelle, en minutes par km. */
  allure: number | null;
  /** Allure corrigée du dénivelé, quand la montre la fournit. */
  allureCorrigee: number | null;
  fcMoy: number | null;
  fcMax: number | null;
  /** Part de la FC max de l'athlète, en %. `null` sans FC max connue. */
  partFcMax: number | null;
  intensite: "facile" | "moderee" | "dure" | null;
  /** Minutes passées dans chaque zone, mesurées par la montre. */
  zonesMin: number[] | null;
  dplus: number | null;
  tempC: number | null;
  cadence: number | null;
  /** Dérive cardiaque (%), mesurée sur une sortie continue ; `null` si la montre ne l'a pas. */
  derive: number | null;
  /** La foulée, champ par champ : chacun `null` s'il n'a pas été mesuré. */
  foulee: { puissanceW: number | null; contactSolMs: number | null; oscillationCm: number | null; longueurM: number | null };
  /** Rang parmi les séances comparables, du plus rapide au plus lent. */
  rang: { place: number; total: number } | null;
  /** Montées et descentes relues sur les flux (analyse complète, séances de trail). */
  trail: AnalyseTrail | null;
  /** Le contexte du jour (analyse complète) : ressenti, nuit, VFC du matin, fraîcheur. */
  contexte: (ContexteSeance & {
    /** Ressenti et intensité cardiaque qui se contredisent — le signal que ni l'un ni
     *  l'autre ne donne seul. Calculé ici, jamais laissé à l'interprétation du modèle. */
    signalRessenti: "fatigue" | "facilite" | null;
  }) | null;
  /** Progression : l'efficacité (vitesse par battement) de cette séance face à la médiane
   *  des séances de même intensité et de distance proche, sur les 12 semaines précédentes. */
  progression: { classe: "facile" | "moderee" | "dure"; n: number; ecartPct: number } | null;
  /** La zone de fréquence cardiaque visée par le corps de séance (« en Z2 »), et le temps qui
   *  y a été passé — ou AU-DESSUS : un footing couru en Z3 n'est plus un footing. */
  zoneVisee: { zone: number; minutesDans: number; minutesAuDessus: number; minutesTotal: number } | null;
  /** Les répétitions relevées par la montre (analyse complète), dans l'ordre : allures en s/km. */
  repetitions: { allures: number[]; fcMoy: number | null; decrochageSec: number } | null;
  /**
   * L'écart CHIFFRÉ à la séance prévue — seulement ce qui se mesure des deux côtés :
   * les répétitions face à leur cible, le corps d'un seuil face à la sienne, ou un footing
   * entier face à son allure facile. `ecartSec` = fait − prévu : positif, plus lent.
   */
  ecart: {
    sur: "repetitions" | "bloc" | "seance";
    allureCibleSec: number;
    allureFaiteSec: number;
    ecartSec: number;
    repsPrevues: number | null;
    repsFaites: number | null;
    /** Répétitions dans la fourchette que la montre affichait (± `FOURCHETTE_QUALITE_SEC`). */
    dansLaFourchette: number | null;
    blocMin: number | null;
    /** Les tours qui composent le corps d'une séance continue, quand la montre l'a découpé. */
    tours: number[] | null;
    /** Over-under : les deux allures alternées dans chaque répétition (la cible est leur moyenne). */
    alternance: [number, number] | null;
  } | null;
  prescrit: { type: string; titre: string } | null;
  /** Les arrêts relus sur la trace GPS (`lib/activities/pauses`) : `null` = non demandés ou
   *  inconnus (sans trace, c'est dit dans `manques`), liste vide = aucun arrêt détecté. */
  arrets: PausesSeance | null;
  /** Ce qu'on NE SAIT PAS. Le modèle doit le dire au lieu de combler. */
  manques: string[];
};

const n = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const positif = (v: unknown): number | null => { const x = n(v); return x != null && x > 0 ? x : null; };

/** Minutes par zone. La montre renvoie des secondes, parfois en objet, parfois en tableau. */
export function zonesEnMinutes(brut: unknown): number[] | null {
  const t = Array.isArray(brut) ? brut
    : brut && typeof brut === "object" ? Object.values(brut as Record<string, unknown>)
    : null;
  if (!t || t.length === 0) return null;
  const min = t.map((v) => { const s = n(v); return s == null || s < 0 ? 0 : Math.round(s / 60); });
  // Une séance dont TOUTES les zones sont à zéro n'a pas été mesurée : la dire « 100 %
  // en zone 1 » serait une invention.
  return min.some((m) => m > 0) ? min : null;
}

/**
 * Faits d'une séance. Aucun n'est deviné : ce qui manque part dans `manques`, que la
 * route recopie dans l'invite pour que le modèle le dise plutôt que de le combler.
 *
 * @param comparables autres séances du même sport, pour situer celle-ci. Le rang n'est
 *                    calculé que sur des distances proches — comparer un 5 km à un
 *                    marathon ne dit rien.
 */
export function faitsDeSeance(
  s: SeanceBrute, reperes: Reperes = {}, comparables: readonly SeanceBrute[] = [], prescrit: Prescrit = null,
  /** Les intervalles relus chez intervals.icu (analyse complète). ABSENTS = non demandés : rien
   *  n'en est dit, ni compté comme inconnu ; « illisible » = demandés mais sans réponse. */
  intervalles?: DetailIntervalles | "illisible",
  /** Le contexte du jour (analyse complète). ABSENT = non demandé. */
  contexte?: ContexteSeance,
  /** Les flux d'une séance de trail (analyse complète). ABSENTS = non demandés. */
  flux?: FluxSeance | "illisible",
  /** Les arrêts relus sur la trace. ABSENTS = non demandés ; `null` = pas de trace lisible. */
  arrets?: PausesSeance | null,
): FaitsSeance {
  const manques: string[] = [];
  const distanceKm = positif(s.distance_km);
  const dureeSec = positif(s.duration_seconds);
  const fcMoy = positif(s.avg_hr);
  const fcMaxAthlete = positif(reperes.fcMax);

  const allure = positif(s.avg_pace_min_km) ?? (distanceKm && dureeSec ? dureeSec / 60 / distanceKm : null);
  const allureCorrigee = positif(s.gap_min_km);
  if (allureCorrigee == null && positif(s.elevation_gain_m)) {
    manques.push("allure corrigée du dénivelé non fournie par la montre : le relief n'est pas neutralisé");
  }

  const partFcMax = fcMoy != null && fcMaxAthlete != null ? Math.round((fcMoy / fcMaxAthlete) * 100) : null;
  if (fcMoy == null) manques.push("aucune fréquence cardiaque enregistrée");
  else if (fcMaxAthlete == null) manques.push("FC maximale de l'athlète inconnue : l'intensité ne peut pas être située");

  // ⚠️ L'INTENSITÉ VIENT DE LA FC, PAS DU CHAMP `type` de la montre.
  const intensite: FaitsSeance["intensite"] = partFcMax == null ? null
    : partFcMax >= PART_FC_DURE * 100 ? "dure"
    : partFcMax >= PART_FC_FACILE * 100 ? "moderee" : "facile";

  // ── LA SÉANCE EST-ELLE SEULEMENT EXPLOITABLE ? ──────────────────────────────
  // Sans distance NI durée, il n'y a pas de séance : l'analyser reviendrait à commenter
  // une ligne vide, ce que le modèle fait très volontiers si on ne l'en empêche pas.
  const vide = distanceKm == null && dureeSec == null;
  if (vide) manques.push("séance quasiment vide : ni distance ni durée enregistrées — il n'y a rien à interpréter, et il faut le dire");
  if (fcMoy != null && fcMoy < FC_PLANCHER) {
    manques.push(`fréquence cardiaque moyenne de ${Math.round(fcMoy)} : incompatible avec une course, la montre a probablement enregistré du repos — ne rien conclure de cette séance`);
  }

  const zonesMin = zonesEnMinutes(s.hr_zone_seconds);
  if (zonesMin == null) manques.push("temps passé en zones non mesuré");

  // Rang parmi les séances de distance proche, à l'allure corrigée du relief quand elle
  // existe. Sans assez de points de comparaison, on ne classe pas.
  const rang = (() => {
    if (distanceKm == null) return null;
    const vitesse = (w: SeanceBrute) => {
      const a = positif(w.gap_min_km) ?? positif(w.avg_pace_min_km);
      return a != null ? a : null;
    };
    const moi = allureCorrigee ?? allure;
    if (moi == null) return null;
    const proches = comparables.filter((w) => {
      const d = positif(w.distance_km);
      return d != null && Math.abs(d - distanceKm) / distanceKm <= ECART_DISTANCE && vitesse(w) != null;
    });
    if (proches.length + 1 < COMPARABLES_MIN) return null;
    const plusRapides = proches.filter((w) => (vitesse(w) as number) < moi).length;
    return { place: plusRapides + 1, total: proches.length + 1 };
  })();

  // ── LES RÉPÉTITIONS ET L'ÉCART À LA SÉANCE PRÉVUE (analyse complète) ───────────
  // La séance prévue se lit dans son texte canonique, avec LE MÊME lecteur que la montre
  // (`parseReps`, `parsePaceSec`) : la cible jugée ici est celle que l'athlète avait au poignet.
  const detailPrevu = String(prescrit?.detail ?? "");
  const repsPrevues = detailPrevu ? parseReps(detailPrevu, null) : null;
  // Plusieurs allures dans le texte (une sortie longue qui finit plus vite) : la cible est
  // ambiguë, on ne compare pas plutôt que de choisir au hasard.
  const allures = new Set([...detailPrevu.toLowerCase().matchAll(/(\d)\s*['’h:]\s*(\d{2})\s*\/?\s*km/g)].map((m) => m[1] + m[2]));
  // Over-under (« en alternant 1 min à 3'57 / 1 min à 3'49 ») : la cible d'une répétition est
  // la moyenne des deux allures, pondérée par leurs durées — pas la première lue dans le texte.
  const alt = repsPrevues?.alt ?? null;
  const allureCible = alt
    ? Math.round((alt.aPaceSec * alt.aSec + alt.bPaceSec * alt.bSec) / (alt.aSec + alt.bSec))
    : repsPrevues?.paceSec ?? (allures.size === 1 ? parsePaceSec(detailPrevu) : null);
  // La série et le bloc, déduits selon ce qui était prévu : deux répétitions prévues suffisent à
  // reconnaître une série de deux (un over-under 2×5 min), trois sinon.
  const lu = intervalles && intervalles !== "illisible"
    ? { serie: serieDeRepetitions(intervalles.liste, repsPrevues ? Math.min(3, Math.max(2, repsPrevues.reps)) : 3), bloc: blocPrincipal(intervalles.liste) }
    : null;
  // Une séance CONTINUE prévue (seuil, tempo) que la montre a coupée en tours : ces tours sont
  // le corps de la séance (`bloc`), pas des répétitions — les appeler ainsi tromperait le modèle.
  const continuPrevu = !repsPrevues && allureCible != null && !SEANCE_HOMOGENE.test(String(prescrit?.type ?? ""));
  const repetitions = lu?.serie && !(continuPrevu && lu.bloc)
    ? { allures: lu.serie.reps.map((r) => r.allureSec), fcMoy: lu.serie.fcMoy, decrochageSec: lu.serie.fadeSec }
    : null;
  let ecart: FaitsSeance["ecart"] = null;
  if (intervalles !== undefined && allureCible != null) {
    const sansSerie = { repsPrevues: null, repsFaites: null, dansLaFourchette: null, blocMin: null, tours: null, alternance: null };
    if (repsPrevues) {
      if (repetitions) {
        const moyenne = Math.round(repetitions.allures.reduce((x, y) => x + y, 0) / repetitions.allures.length);
        ecart = {
          sur: "repetitions", allureCibleSec: allureCible, allureFaiteSec: moyenne, ecartSec: moyenne - allureCible,
          repsPrevues: repsPrevues.reps, repsFaites: repetitions.allures.length,
          // Over-under : la montre affichait DEUX fourchettes ; juger une répétition entière
          // contre l'une ou l'autre n'a pas de sens.
          dansLaFourchette: alt ? null : repetitions.allures.filter((a) => Math.abs(a - allureCible) <= FOURCHETTE_QUALITE_SEC).length,
          blocMin: null, tours: null, alternance: alt ? [alt.aPaceSec, alt.bPaceSec] : null,
        };
      } else if (lu?.bloc) {
        // Pas de répétitions, mais un effort continu : c'est ce qui a été couru À LA PLACE.
        ecart = {
          sur: "bloc", allureCibleSec: allureCible, allureFaiteSec: lu.bloc.allureSec, ecartSec: lu.bloc.allureSec - allureCible,
          repsPrevues: repsPrevues.reps, repsFaites: 0, dansLaFourchette: null,
          blocMin: Math.round(lu.bloc.dureeSec / 60), tours: lu.bloc.tours.length > 1 ? lu.bloc.tours : null,
          alternance: alt ? [alt.aPaceSec, alt.bPaceSec] : null,
        };
      } else if (intervalles === "illisible") {
        manques.push("le détail des répétitions n'a pas pu être lu : ne commente ni leur nombre ni leur allure");
      } else {
        manques.push(`aucune série de répétitions reconnue dans la séance enregistrée, alors que ${repsPrevues.reps} étaient prévues : on ne peut pas juger le fractionné — ne suppose pas qu'il n'a pas été fait`);
      }
    } else if (SEANCE_HOMOGENE.test(String(prescrit?.type ?? ""))) {
      // Footing, endurance, sortie longue, récupération : la cible vaut pour toute la séance.
      const faite = allureCorrigee ?? allure;
      if (faite != null) {
        const sec = Math.round(faite * 60);
        ecart = { sur: "seance", allureCibleSec: allureCible, allureFaiteSec: sec, ecartSec: sec - allureCible, ...sansSerie };
      }
    } else if (lu?.bloc) {
      // Seuil, tempo : le CORPS de la séance, jamais la moyenne avec l'échauffement.
      ecart = {
        sur: "bloc", allureCibleSec: allureCible, allureFaiteSec: lu.bloc.allureSec, ecartSec: lu.bloc.allureSec - allureCible,
        ...sansSerie, blocMin: Math.round(lu.bloc.dureeSec / 60), tours: lu.bloc.tours.length > 1 ? lu.bloc.tours : null,
      };
    } else if (intervalles === "illisible") {
      manques.push("le détail des intervalles n'a pas pu être lu : l'allure du corps de séance est inconnue, ne la compare pas à la cible");
    } else {
      manques.push("le corps de la séance n'a pas pu être isolé (aucune suite d'efforts enchaînés d'au moins 6 min en zone 3 ou plus) : ne compare pas son allure à la cible");
    }
  }

  // ── LE CONTEXTE DU JOUR ET LE RESSENTI (analyse complète) ───────────────────────
  let contexteFait: FaitsSeance["contexte"] = null;
  if (contexte) {
    // ⚠️ ASSAINI ICI, PAS CHEZ L'APPELANT : une fraîcheur incalculable arrivait en « NaN », et une
    // VFC de référence nulle donnait « +Infinity % » dans la consigne (trouvé par crash-test).
    // Une valeur absurde est une valeur NON MESURÉE, et l'analyse le dit.
    const fini = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
    const r0 = contexte.ressenti?.rpe;
    const sc = contexte.nuit?.score, mn = contexte.nuit?.minutes;
    const nuitPropre = { score: fini(sc) && sc >= 0 && sc <= 100 ? Math.round(sc) : null, minutes: fini(mn) && mn > 0 && mn < 24 * 60 ? Math.round(mn) : null };
    const m0 = contexte.vfc?.matin, b0 = contexte.vfc?.base;
    const f0 = contexte.forme;
    contexte = {
      ressenti: fini(r0) && r0 >= 0 && r0 <= 10 ? { rpe: Math.round(r0) } : null,
      nuit: nuitPropre.score != null || nuitPropre.minutes != null ? nuitPropre : null,
      vfc: fini(m0) && m0 > 0 ? { matin: Math.round(m0), base: fini(b0) && b0 > 0 ? Math.round(b0) : null } : null,
      forme: f0 && [f0.tsb, f0.ctl, f0.atl].every(fini) ? { tsb: Math.round(f0.tsb), ctl: Math.round(f0.ctl), atl: Math.round(f0.atl) } : null,
    };
    const rpe = contexte.ressenti?.rpe ?? null;
    // Un 8/10 sur un footing que la FC dit facile : de la fatigue que le cœur ne montre pas
    // encore. Un 2/10 sur une séance que la FC dit dure : de la fraîcheur, ou une FC max
    // trop basse. Seuils volontairement nets : en dessous, le ressenti ne contredit rien.
    const signalRessenti = rpe == null || intensite == null ? null
      : rpe >= 7 && intensite === "facile" ? "fatigue"
      : rpe <= 3 && intensite === "dure" ? "facilite" : null;
    contexteFait = { ...contexte, signalRessenti };
    if (!contexte.ressenti) manques.push("aucun ressenti déclaré pour cette séance");
    if (!contexte.nuit) manques.push("sommeil de la nuit précédente non mesuré");
    if (!contexte.vfc) manques.push("VFC du matin non mesurée");
    if (!contexte.forme) manques.push("fraîcheur du jour inconnue (pas assez de séances avant celle-ci)");
    manques.push("humidité non mesurée par la montre : ne commente pas l'humidité");
  }

  // ── LA PROGRESSION : à intensité égale et distance proche, l'efficacité (vitesse par
  // battement) face aux 12 semaines précédentes. Une allure seule ne dit rien : plus vite
  // avec un cœur plus haut n'est pas un progrès.
  let progression: FaitsSeance["progression"] = null;
  if (intervalles !== undefined && intensite && distanceKm && dureeSec && fcMoy && fcMaxAthlete) {
    const eff = (km: number, sec: number, fc: number) => (km * 1000 / (sec / 60)) / fc;
    const moi = eff(distanceKm, dureeSec, fcMoy);
    const classeDe = (fc: number) => (fc / fcMaxAthlete >= PART_FC_DURE ? "dure" : fc / fcMaxAthlete >= PART_FC_FACILE ? "moderee" : "facile");
    const jour = String(s.date ?? "").slice(0, 10);
    const semblables = comparables.filter((w) => {
      const d = positif(w.distance_km), t = positif(w.duration_seconds), fc = positif(w.avg_hr);
      const age = jour && w.date ? (Date.parse(`${jour}T12:00:00Z`) - Date.parse(`${String(w.date).slice(0, 10)}T12:00:00Z`)) / 86_400_000 : NaN;
      return d != null && t != null && fc != null && fc >= FC_PLANCHER && age > 0 && age <= 84
        && Math.abs(d - distanceKm) / distanceKm <= 0.25 && classeDe(fc) === intensite;
    }).map((w) => eff(Number(w.distance_km), Number(w.duration_seconds), Number(w.avg_hr))).sort((a, b) => a - b);
    if (semblables.length >= 3) {
      const mediane = semblables.length % 2 ? semblables[(semblables.length - 1) / 2] : (semblables[semblables.length / 2 - 1] + semblables[semblables.length / 2]) / 2;
      progression = { classe: intensite, n: semblables.length, ecartPct: Math.round((moi / mediane - 1) * 100) };
    }
  }

  // ── LE TRAIL : montées et descentes, sur les flux.
  const trail = flux && flux !== "illisible" ? analyseTrail(flux) : null;
  if (flux === "illisible") manques.push("les flux d'altitude n'ont pas pu être lus : ne commente ni les montées ni les descentes");
  // Sans trace horodatée, on ne sait pas s'il s'est arrêté : « aucun arrêt » serait inventé.
  if (arrets === null) manques.push("pas de trace GPS horodatée : les arrêts éventuels sont inconnus, n'en parle pas");

  // ── LA ZONE VISÉE : celle que le corps de séance prescrit (« Corps : 50 min en Z2 »). Les zones
  // de l'échauffement (« FC Z1→Z2 ») ne comptent pas : seul le corps dit l'intention.
  const zv = /corps\s*:[^→]*?\bZ([1-5])\b/i.exec(detailPrevu);
  const zoneVisee = intervalles !== undefined && zv && zonesMin
    ? (() => {
        const z = Number(zv[1]);
        return {
          zone: z,
          minutesDans: zonesMin[z - 1] ?? 0,
          minutesAuDessus: zonesMin.slice(z).reduce((a, b) => a + b, 0),
          minutesTotal: zonesMin.reduce((a, b) => a + b, 0),
        };
      })()
    : null;

  return {
    exploitable: !vide && !(fcMoy != null && fcMoy < FC_PLANCHER),
    date: String(s.date ?? "").slice(0, 10),
    sport: String(s.sport ?? "run"),
    distanceKm: distanceKm == null ? null : Math.round(distanceKm * 100) / 100,
    dureeMin: dureeSec == null ? null : Math.round(dureeSec / 60),
    allure: allure == null ? null : Math.round(allure * 100) / 100,
    allureCorrigee: allureCorrigee == null ? null : Math.round(allureCorrigee * 100) / 100,
    fcMoy, fcMax: positif(s.max_hr), partFcMax, intensite, zonesMin,
    dplus: n(s.elevation_gain_m), tempC: n(s.weather_temp_c), cadence: positif(s.avg_cadence_spm),
    derive: n(s.cardiac_decoupling) == null ? null : Math.round(n(s.cardiac_decoupling)! * 10) / 10,
    foulee: {
      puissanceW: positif(s.avg_power_watts), contactSolMs: positif(s.ground_contact_ms),
      oscillationCm: positif(s.vertical_oscillation_cm), longueurM: positif(s.stride_length_m),
    },
    rang,
    trail, contexte: contexteFait, progression, zoneVisee, repetitions, ecart,
    prescrit: prescrit?.type ? { type: String(prescrit.type), titre: String(prescrit.titre ?? "") } : null,
    arrets: arrets ?? null,
    manques,
  };
}

/** Pente à partir de laquelle un tronçon est une montée (ou, en négatif, une descente). */
export const PENTE_TRAIL = 0.04;
/** Dénivelé minimal d'une montée ou d'une descente : en dessous, c'est le bruit du GPS. */
export const DENIVELE_MIN_M = 30;
/** Pas de rééchantillonnage, en mètres : l'altitude d'un GPS saute d'un point à l'autre. */
const PAS_M = 50;

export type AnalyseTrail = {
  montees: { nombre: number; dPlus: number; minutes: number; vam: number | null; fc: number | null };
  descentes: { nombre: number; dMoins: number; km: number; allureSec: number | null; fc: number | null };
};

/**
 * MONTÉES ET DESCENTES d'une séance, relues sur ses flux (Premium, trail).
 *
 * La vitesse ascensionnelle (VAM, mètres de dénivelé gagnés par heure) ne se calcule que
 * SUR LES MONTÉES : rapportée à toute la séance, elle mélange le plat et les descentes et ne
 * dit rien. Le GPS fait sauter l'altitude de quelques mètres d'un point à l'autre : on
 * rééchantillonne tous les 50 m, on lisse, et une montée doit gagner au moins 30 m.
 * `null` si les flux ne permettent rien (séance trop courte, altitude absente).
 */
export function analyseTrail(f: FluxSeance): AnalyseTrail | null {
  const n = Math.min(f.temps.length, f.distance.length, f.altitude.length);
  type P = { t: number; d: number; a: number; fc: number | null };
  const pts: P[] = [];
  let prochain = 0;
  for (let i = 0; i < n; i++) {
    const t = f.temps[i], d = f.distance[i], a = f.altitude[i];
    if (![t, d, a].every((x) => typeof x === "number" && Number.isFinite(x))) continue;
    if (d < prochain) continue;
    const fc = f.fc && typeof f.fc[i] === "number" && f.fc[i] > 0 ? f.fc[i] : null;
    pts.push({ t, d, a, fc });
    prochain = d + PAS_M;
  }
  if (pts.length < 20) return null;
  // Lissage de l'altitude sur 3 points (≈ 150 m).
  const alt = pts.map((_, i) => {
    const v = pts.slice(Math.max(0, i - 1), Math.min(pts.length, i + 2)).map((p) => p.a);
    return v.reduce((x, y) => x + y, 0) / v.length;
  });
  type Troncon = { sens: 1 | -1 | 0; de: number; a: number };
  const troncons: Troncon[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dd = pts[i + 1].d - pts[i].d;
    const pente = dd > 0 ? (alt[i + 1] - alt[i]) / dd : 0;
    const sens: 1 | -1 | 0 = pente >= PENTE_TRAIL ? 1 : pente <= -PENTE_TRAIL ? -1 : 0;
    const dernier = troncons[troncons.length - 1];
    if (dernier && dernier.sens === sens) dernier.a = i + 1;
    else troncons.push({ sens, de: i, a: i + 1 });
  }
  const fcMoy = (de: number, a: number) => {
    const v = pts.slice(de, a + 1).map((p) => p.fc).filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) : null;
  };
  const montees = troncons.filter((x) => x.sens === 1 && alt[x.a] - alt[x.de] >= DENIVELE_MIN_M);
  const descentes = troncons.filter((x) => x.sens === -1 && alt[x.de] - alt[x.a] >= DENIVELE_MIN_M);
  if (!montees.length && !descentes.length) return null;
  const somme = (l: Troncon[], f2: (x: Troncon) => number) => l.reduce((s, x) => s + f2(x), 0);
  const dureeMontees = somme(montees, (x) => pts[x.a].t - pts[x.de].t);
  const dPlus = Math.round(somme(montees, (x) => alt[x.a] - alt[x.de]));
  const dureeDescentes = somme(descentes, (x) => pts[x.a].t - pts[x.de].t);
  const kmDescentes = somme(descentes, (x) => pts[x.a].d - pts[x.de].d) / 1000;
  const moyFc = (l: Troncon[]) => {
    const v = l.map((x) => fcMoy(x.de, x.a)).filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  return {
    montees: {
      nombre: montees.length, dPlus, minutes: Math.round(dureeMontees / 60),
      vam: dureeMontees > 0 ? Math.round(dPlus / (dureeMontees / 3600)) : null, fc: moyFc(montees),
    },
    descentes: {
      nombre: descentes.length, dMoins: Math.round(somme(descentes, (x) => alt[x.de] - alt[x.a])),
      km: Math.round(kmDescentes * 10) / 10,
      allureSec: kmDescentes > 0 ? Math.round(dureeDescentes / kmDescentes) : null, fc: moyFc(descentes),
    },
  };
}

/** Allure en `m'ss`, ou `null`. Écrire « 4.75 min/km » à un coureur n'a aucun sens. */
export function allureTexte(minParKm: number | null): string | null {
  if (minParKm == null || !Number.isFinite(minParKm) || minParKm <= 0) return null;
  const m = Math.floor(minParKm);
  const s = Math.round((minParKm - m) * 60);
  return s === 60 ? `${m + 1}'00` : `${m}'${String(s).padStart(2, "0")}`;
}

/**
 * Date en toutes lettres. Le modèle RECOPIE ce qu'on lui donne : lui tendre
 * « 2026-08-24 » lui faisait servir cette chaîne telle quelle à l'athlète.
 *
 * ⚠️ CE QUI PROTÈGE LA DATE, C'EST `timeZone: "UTC"` — pas l'heure de midi. J'avais
 * d'abord écrit l'inverse ; la mutation l'a démenti : passer le parse à minuit ne change
 * RIEN tant que le formatage est forcé en UTC. Sans ce `timeZone`, en revanche, le
 * serveur (iad1, aux États-Unis) reculerait la date d'un jour. Le parse à midi reste une
 * ceinture de sécurité si quelqu'un retire un jour le `timeZone`.
 */
export function dateLisible(iso: string, lang = "fr"): string {
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
  if (!Number.isFinite(d.getTime())) return String(iso);
  const etiquette: Record<string, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT" };
  return d.toLocaleDateString(etiquette[lang] ?? "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
