// ─────────────────────────────────────────────────────────────────────────────
//  PLAN AUTONOME SUR 7 JOURS — le moteur qui remplace le coach humain.
//
//  Volontairement DÉTERMINISTE (aucun appel LLM) : ce code tourne dans un cron,
//  pour tous les athlètes, tous les jours. Un plan toujours correct et instantané
//  vaut mieux qu'un plan plus joliment rédigé qui échoue une nuit sur trois et
//  laisse un client sans séance. L'IA générative reste sur la page coach, pour
//  l'analyse approfondie d'une séance à la demande.
//
//  L'intelligence est dans buildAthleteContext : VMA, allures calculées, budget de
//  qualité (plafonné par le passif, la santé, la fraîcheur), volume cible, phase du
//  cycle, dernière séance dure, jours systématiquement ratés. Ce module POSE ces
//  séances dans la semaine sans violer les règles de récupération.
// ─────────────────────────────────────────────────────────────────────────────
import type { AthleteContext } from "@/lib/ai/coachContext";
import { heatAdvice, windAdvice } from "@/lib/weather/openMeteo";
import { choisirJourQualite } from "@/lib/coach/meteoPlacement";
import { scinderFacile, seanceMatinFacile } from "@/lib/coach/doubleSessions";
import { PLAN_T } from "@/lib/ai/planI18n";
import { nRaw, type I18nText } from "@/lib/i18n/multi";
import type { Lang } from "@/lib/i18n/translations";

/** Les quatre langues matérialisées À CÔTÉ du français canonique. */
const AUTRES_LANGUES: Lang[] = ["en", "de", "es", "pt"];

/** Ce qu'un athlète LIT. Le français, lui, reste dans les champs de premier niveau. */
export type PlanDayText = { title: string; detail: string; why: string; tags: string[] };

export type PlanDay = {
  date: string;          // AAAA-MM-JJ
  type: string;          // Repos | Récup | Endurance | Sortie longue | VMA | Seuil | Spécifique | Renfo | Vélo
  /**
   * ⚠️ CES QUATRE CHAMPS SONT EN FRANÇAIS, ET C'EST VOLONTAIRE.
   *
   * `lib/watch/intervals.ts` construit la séance Garmin en ANALYSANT cette prose :
   * « corps : » délimite le corps de séance, « récup » donne la durée de récupération,
   * « seuil »/« vma »/« côte » choisissent la zone d'allure, « repos » signifie « ne
   * rien pousser », et le motif « N×DISTANCE à ALLURE » produit les répétitions.
   * `type` et `tags` alimentent le même analyseur (`${type} ${tags.join(" ")}`).
   *
   * Les traduire ici casserait la poussée montre EN SILENCE : `buildWorkoutDescription`
   * renverrait null ou des étapes fausses, sans lever la moindre erreur. La version
   * lue par l'athlète vit dans `i18n`.
   */
  title: string;
  detail: string;
  why: string;
  tags: string[];
  /**
   * Le MÊME jour, rendu dans les autres langues — pour l'affichage seulement.
   * Le français n'y figure pas : il est déjà au-dessus, et le dupliquer offrirait
   * une seconde vérité qui finirait par diverger. Une langue absente retombe donc
   * naturellement sur le français, jamais sur du vide.
   */
  i18n?: Partial<Record<Lang, PlanDayText>>;
  /** false = jour prévisionnel, susceptible d'être réajusté par le cron des jours suivants. */
  confirmed: boolean;
  /** Créneau dans la journée, quand l'athlète double. Absent = séance unique, et tout
   *  se comporte alors exactement comme avant. La déduplication des écrans porte sur
   *  `date#moment` : sans ce champ, la seconde séance du jour disparaîtrait. */
  moment?: "matin" | "soir";
};

/** Nombre de jours confirmés (verrouillés) en tête de plan. Au-delà : prévisionnel. */
/**
 * Jours poussés vers la montre — et donc affichés comme CONFIRMÉS.
 *
 * Porté de 3 à 5. La synchronisation Garmin Connect → montre passe par le Bluetooth du
 * téléphone, sur le calendrier de Garmin : aucun serveur ne peut la déclencher (vérifié,
 * intervals.icu n'expose aucun endpoint de renvoi). La seule variable qu'on maîtrise est
 * l'AVANCE : plus une séance est posée tôt, plus la synchronisation naturelle a
 * d'occasions de l'attraper avant le départ. Avec cinq jours, une séance a été déposée
 * quatre nuits avant d'être courue — il faudrait rater quatre synchronisations
 * consécutives pour la manquer.
 *
 * Les jours lointains restent provisoires : ils sont recalculés et corrigés chaque matin.
 */
export const CONFIRMED_DAYS = 5;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Durée approximative d'une distance à une allure donnée (« 4'20 » → « 1h05 »). */
function durationFor(km: number, paceMinKm: string | null): string | null {
  if (!paceMinKm) return null;
  const m = paceMinKm.match(/(\d+)['’:](\d{1,2})/);
  if (!m) return null;
  const secPerKm = Number(m[1]) * 60 + Number(m[2]);
  const total = Math.round((km * secPerKm) / 60); // minutes
  return total >= 60 ? `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}` : `${total} min`;
}

/** « ~12 km (environ 1h02) » — ou juste la distance si l'allure est inconnue. */
function kmAndTime(km: number, pace: string | null, lang: Lang): string {
  return PLAN_T[lang].kmEtTemps(nRaw(km, lang), durationFor(km, pace));
}

/**
 * Pose 7 jours d'entraînement à partir du contexte de l'athlète.
 *
 * Ordre de placement (du plus contraint au plus souple) :
 *   1. les jours systématiquement ratés → repos d'office (inutile de s'obstiner) ;
 *   2. la sortie longue sur le week-end (c'est elle qui structure la semaine) ;
 *   3. le repos complet le lendemain de la sortie longue ;
 *   4. les séances de qualité, espacées d'au moins `hardGapHours` — y compris
 *      par rapport à la dernière séance dure DÉJÀ EFFECTUÉE ;
 *   5. le renforcement sur un jour facile, jamais la veille d'un jour dur ;
 *   6. tout le reste en endurance, dimensionnée sur le volume cible restant.
 *
 * Le jour J est ensuite écrasé par le verdict de fraîcheur : feu rouge = pas
 * d'intensité, quoi qu'il ait été planifié.
 */
export function buildWeekPlan(ctx: AthleteContext, today = new Date()): PlanDay[] {
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const gapDays = Math.max(2, Math.ceil(ctx.hardGapHours / 24));
  // Échauffement / retour au calme : on écrit dans le texte EXACTEMENT les durées que la
  // montre appliquera. Elles étaient codées en dur ici (10/15/20 et 5/10) pendant que la
  // montre lisait le réglage du profil : le site annonçait « échauffement 10 min » et la
  // montre en envoyait 15, avec un corps de séance réduit de 25 à 10 min. Deux séances
  // différentes pour le même jour.
  const { warm, cool } = ctx.warmCool;
  // Allure visée le jour J, quand un objectif chiffré existe.
  const goalPace = ctx.objective?.targetPace ?? null;
  // Même position de cycle que la qualité : 0-2 montée, 3 assimilation.
  const blockWeekRenfo = (() => { const d = new Date(start); const on = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = on.getUTCDay() || 7; on.setUTCDate(on.getUTCDate() + 4 - day); const ys = new Date(Date.UTC(on.getUTCFullYear(), 0, 1)); return Math.ceil(((on.getTime() - ys.getTime()) / 86400000 + 1) / 7) % 4; })();
  // Avant une séance de qualité, l'échauffement est allongé (mise en action progressive).
  const warmQ = Math.min(30, warm + 5);
  const pace = ctx.easyPace;
  const easy = pace ? ` (~${pace}/km)` : "";
  const wp = ctx.weekPlan;
  const { targetKm, longRunKm } = ctx.volume;
  // En terrain vallonné, une allure au km brute est intenable en montée et trop facile
  // en descente : on précise que la cible s'entend en allure AJUSTÉE AU DÉNIVELÉ.
  const gapNote = (l: Lang) => (ctx.hillyTraining ? PLAN_T[l].noteGAP : "");
  const cycleNote = (l: Lang) => (ctx.cycle.taper ? PLAN_T[l].noteAffutage
    : ctx.cycle.deload ? PLAN_T[l].noteAllegee : "");
  // D'OÙ VIENT LA FATIGUE, quand une part notable ne vient pas de la course. Un athlète
  // qui rentre d'une semaine de randonnée en montagne doit lire « ta charge vient aussi
  // de tes 12 h de rando », pas un allègement inexpliqué de ses séances de course.
  // Optionnel : un `auto_coach_state` sérialisé avant cette version n'a pas ce champ.
  const crossNote = (l: Lang) => (ctx.cross && ctx.cross.sharePct >= 20 && ctx.cross.label
    ? PLAN_T[l].noteCross(ctx.cross.sharePct, ctx.cross.labelAll?.[l] ?? ctx.cross.label)
    : "");
  /** Motifs de fraîcheur, dans la langue demandée — français si le contexte est ancien. */
  const motifs = (l: Lang, n: number) =>
    (ctx.readiness.reasonsAll?.length ? ctx.readiness.reasonsAll.map((r: I18nText) => r[l] ?? r.fr) : ctx.readiness.reasons)
      .slice(0, n).join(", ");

  // Météo RÉELLE du jour concerné (prévisions Open-Meteo à la position de l'athlète).
  // On n'ajoute la consigne que si elle change quelque chose : inutile d'alourdir une
  // séance par 18 °C. Le repos et le renfo ne sont pas concernés.
  /**
   * Allure du jour, CORRIGÉE DE LA CHALEUR.
   *
   * La météo n'était jusqu'ici qu'une note ajoutée au texte : l'allure prescrite restait
   * la même par 12 °C et par 31 °C. Or c'est le CHIFFRE que la montre lit et transforme
   * en alarme d'allure — l'athlète recevait donc une cible impossible, contredite deux
   * lignes plus bas par une note lui disant de lever le pied. On corrige le nombre.
   */
  // Chaleur ET vent : les deux ralentissent, et ils se cumulent.
  // La chaleur s'apprivoise (10-14 j d'exposition) ; le vent, non.
  // Un seul endroit calcule ce surcoût : il sert à RALENTIR l'allure du jour ET à
  // CHOISIR le jour de la séance de qualité, qui ne peuvent donc pas se contredire.
  const penaliteMeteo = (i: number): number => {
    const f = ctx.forecast.find((x) => x.date === iso(dates[i]));
    if (!f) return 0;
    return Math.round(heatAdvice(f.tempMax, f.humidity).penaltySecPerKm * ctx.heatAcclim.factor)
      + windAdvice(f.windMaxKmh).penaltySecPerKm;
  };

  const paceFor = (i: number): string | null => {
    const base = ctx.easyPace;
    if (!base) return null;
    const m = base.match(/(\d+)['’:](\d{2})/);
    const f = ctx.forecast.find((x) => x.date === iso(dates[i]));
    if (!m || !f) return base;
    const penalty = penaliteMeteo(i);
    if (!penalty) return base;
    const sec = Number(m[1]) * 60 + Number(m[2]) + penalty;
    return `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}`;
  };

  /**
   * Allures d'une séance de QUALITÉ, corrigées de la chaleur.
   *
   * Sans cela, la description annonçait « 12×400 m à ~3'20/km » un jour à 27 °C tout en
   * ajoutant une note conseillant de lever le pied : le texte et le chiffre se
   * contredisaient, et c'est le chiffre que la montre transforme en alarme d'allure.
   * Correction à MOITIÉ de la pénalité : la chaleur pénalise surtout les efforts longs,
   * beaucoup moins les répétitions courtes — appliquer la pénalité pleine sous-doserait
   * le stimulus qu'on cherche précisément à produire.
   */
  const heatAdjustDesc = (desc: string, i: number): string => {
    const f = ctx.forecast.find((x) => x.date === iso(dates[i]));
    if (!f) return desc;
    const penalty = Math.round((heatAdvice(f.tempMax, f.humidity).penaltySecPerKm * ctx.heatAcclim.factor
      + windAdvice(f.windMaxKmh).penaltySecPerKm) / 2);
    if (!penalty) return desc;
    return desc.replace(/(\d+)['’](\d{2})\/km/g, (_m, mm: string, ss: string) => {
      const sec = Number(mm) * 60 + Number(ss) + penalty;
      return `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}/km`;
    });
  };

  const weatherFor = (i: number, type: string, l: Lang): string => {
    if (/Repos|Renfo/.test(type)) return "";
    const f = ctx.forecast.find((x) => x.date === iso(dates[i]));
    if (!f) return "";
    const a = heatAdvice(f.tempMax, f.humidity, l);
    const w = windAdvice(f.windMaxKmh, l);
    const notes = [a.penaltySecPerKm > 0 || f.tempMax < 5 ? a.note : "", w.note].filter(Boolean);
    return notes.length ? `\n\n${notes.join("\n")}` : "";
  };

  /**
   * Une journée décrite par des GABARITS, pas par des chaînes déjà rendues.
   *
   * C'est ce qui garantit que les cinq langues décrivent LA MÊME séance : elles sortent
   * du même gabarit, appelé avec les mêmes nombres. Le français n'est pas un cas
   * particulier — il est simplement le rendu qui atterrit dans les champs canoniques.
   */
  type DaySpec = {
    type: string;
    title: (l: Lang) => string;
    detail: (l: Lang) => string;
    why: (l: Lang) => string;
    tags: (l: Lang) => string[];
  };

  const slot: (PlanDay | null)[] = Array(7).fill(null);
  const put = (i: number, d: DaySpec) => {
    if (i < 0 || i > 6 || slot[i]) return false;
    const rendu = (l: Lang): PlanDayText => ({
      title: d.title(l), detail: d.detail(l) + weatherFor(i, d.type, l), why: d.why(l), tags: d.tags(l),
    });
    slot[i] = {
      ...rendu("fr"), type: d.type, date: iso(dates[i]), confirmed: i < CONFIRMED_DAYS,
      i18n: Object.fromEntries(AUTRES_LANGUES.map((l) => [l, rendu(l)])) as Partial<Record<Lang, PlanDayText>>,
    };
    return true;
  };
  /** Raccourci pour un texte identique dans toutes les langues (nom propre, nombre…). */
  const brut = (s: string) => () => s;
  /** Étiquettes : la liste est fixe, chaque langue rend la sienne. */
  const tags = (...keys: (keyof (typeof PLAN_T)["fr"]["tags"])[]) => (l: Lang) => keys.map((k) => PLAN_T[l].tags[k]);

  // ── 0. LA COURSE. Elle prime sur tout le reste : c'est l'objectif, pas une séance.
  // Sans ce bloc, le moteur pouvait poser une VMA la veille ou une sortie longue le
  // jour J — il ne consultait simplement jamais la date de course.
  const raceIdx = ctx.daysToRace != null && ctx.daysToRace >= 0 && ctx.daysToRace <= 6 ? ctx.daysToRace : -1;

  // Budget de SORTIES de la semaine. Déclaré avant tout placement : la semaine de course
  // pose elle aussi des footings (déblocage, avant-veille, reprise) qui doivent le
  // consommer — les oublier donnait 6 séances à un athlète qui en déclare 3.
  let runBudget = Math.max(1, ctx.availability.daysPerWeek - (raceIdx >= 0 ? 1 : 0));
  const spend = () => { runBudget -= 1; };

  if (raceIdx >= 0) {
    const o = ctx.objective;
    put(raceIdx, {
      type: "Course",
      // Le NOM DE LA COURSE est un nom propre : il traverse les cinq langues tel quel.
      title: (l) => PLAN_T[l].courseTitre(o?.race ?? null),
      detail: (l) => PLAN_T[l].courseDetail(o?.targetPace ?? null),
      why: (l) => PLAN_T[l].courseWhy(o?.targetTime ?? null),
      tags: (l) => [PLAN_T[l].tags["Course"], o?.distanceKm ? PLAN_T[l].tagKm(nRaw(o.distanceKm, l)) : PLAN_T[l].tags["Objectif"]],
    });
    // Les 2 jours qui précèdent : décrassage seulement. Aucune séance dure dans les 48 h.
    for (const d of [1, 2]) {
      const i = raceIdx - d;
      if (i < 0) continue;
      // Ces jours-là sont des SORTIES : ils consomment le budget hebdomadaire au même
      // titre qu'un footing. Les oublier donnait 6 séances à un athlète qui en déclare 3.
      //
      // Et le protocole complet — avant-veille + veille + reprise — suppose au moins
      // quatre sorties dans la semaine. En dessous, on garde le seul déblocage de la
      // veille : celui qui compte. Un coureur à trois sorties par semaine préfère du
      // repos à un footing de plus juste avant sa course.
      if (runBudget <= 0) continue;
      if (put(i, d === 1
        ? { type: "Récup", title: (l) => PLAN_T[l].veilleTitre,
            detail: (l) => PLAN_T[l].veilleDetail,
            why: (l) => PLAN_T[l].veilleWhy,
            tags: tags("Récup", "Veille de course") }
        : { type: "Récup", title: (l) => PLAN_T[l].avantVeilleTitre,
            detail: (l) => PLAN_T[l].avantVeilleDetail,
            why: (l) => PLAN_T[l].avantVeilleWhy, tags: tags("Récup", "Affûtage") })) spend();
    }
    // Les jours qui suivent : récupération obligatoire.
    for (const d of [1, 2]) {
      const i = raceIdx + d;
      if (i > 6) continue;
      // Le footing de reprise n'a lieu que si le budget de sorties le permet.
      if (d === 2 && runBudget <= 0) continue;
      const placedRest = put(i, d === 1
        ? { type: "Repos", title: (l) => PLAN_T[l].reposCourseTitre, detail: (l) => PLAN_T[l].reposCourseDetail,
            why: (l) => PLAN_T[l].reposCourseWhy, tags: tags("Repos") }
        : { type: "Récup", title: (l) => PLAN_T[l].recupCourseTitre,
            detail: (l) => PLAN_T[l].recupCourseDetail,
            why: (l) => PLAN_T[l].recupCourseWhy, tags: tags("Récup", "Z1") });
      if (placedRest && d === 2) spend();   // le footing de reprise est une sortie
    }
  }

  // ── 1. Jours systématiquement ratés → repos assumé.
  // Continuer à prescrire un jour que l'athlète ne court jamais ne fait que dégrader
  // son adhérence et fausser nos statistiques. Mieux vaut l'acter.
  for (let i = 0; i <= 6; i++) {
    if (ctx.skippedWeekdays.includes(dates[i].getDay())) {
      put(i, { type: "Repos", title: (l) => PLAN_T[l].reposTitre, tags: tags("Repos"),
        detail: (l) => PLAN_T[l].reposJourRateDetail,
        why: (l) => PLAN_T[l].reposJourRateWhy });
    }
  }

  // ── 1 bis. DISPONIBILITÉS : on ne place de la course QUE les jours praticables.
  const isFree = (i: number) => i >= 0 && i <= 6 && !slot[i];
  const avail = (i: number) => ctx.availability.days.includes(dates[i].getDay());
  for (let i = 0; i <= 6; i++) {
    if (isFree(i) && !avail(i)) put(i, {
      type: "Repos", title: (l) => PLAN_T[l].reposTitre, tags: tags("Repos"),
      detail: (l) => PLAN_T[l].reposIndispoDetail,
      why: (l) => PLAN_T[l].reposIndispoWhy,
    });
  }
  // Budget de séances de COURSE pour la semaine (la course elle-même en consomme une).
  // C'est ce plafond qui empêche de prescrire 6 sorties à quelqu'un qui peut en faire 3.

  const canRun = (i: number) => isFree(i) && avail(i) && runBudget > 0;

  // ── 2. Sortie longue : dimanche de préférence, sinon samedi, sinon un jour praticable.
  // Semaine de course : PAS de sortie longue. La course est déjà l'effort long et dur
  // de la semaine ; y ajouter 18 km trois jours avant saboterait la fraîcheur.
  // ── LE JOUR 0 SERA ÉCRASÉ PAR LA FRAÎCHEUR : ON N'Y POSE RIEN QUI COMPTE ──────
  //  L'étape 7 remplace la séance du jour par de la récupération quand la fraîcheur est
  //  au rouge (ou qu'une séance dure a déjà eu lieu aujourd'hui). Ce drapeau existait
  //  déjà plus bas pour les séances de QUALITÉ, avec ce constat : « placer la qualité
  //  sur le jour 0 revenait à la SUPPRIMER ». Le même piège valait pour la sortie
  //  longue, et il n'y avait jamais été traité.
  //
  //  DÉFAUT RÉEL, resté invisible parce qu'il ne se produit QUE le dimanche : la sortie
  //  longue va de préférence sur un dimanche, or un dimanche le dimanche EST le jour 0.
  //  Un athlète au rouge ce jour-là perdait sa sortie longue pour les sept jours — pas
  //  décalée, pas raccourcie, pas expliquée : absente. Six jours sur sept, personne ne
  //  pouvait le voir. Sept jours consécutifs contenant toujours exactement un samedi et
  //  un dimanche, l'écarter laisse forcément l'autre jour de week-end disponible.
  const dayZeroDropped = ctx.readiness.level === "rouge" || ctx.lastHardDaysAgo === 0;
  const weekend = dates.map((d, i) => ({ i, day: d.getDay() }))
    .filter((x) => (x.day === 0 || x.day === 6) && canRun(x.i) && !(dayZeroDropped && x.i === 0));
  // Une « sortie longue » de moins de 4 km n'est pas une sortie longue. Cas rencontré
  // sur un profil sans aucune donnée (volume cible nul) : le plan annonçait « Sortie
  // longue : ~0 km (environ 0 min) ». Mieux vaut ne rien poser.
  const longIdx = longRunKm < 4 ? -1 : raceIdx >= 0 ? -1
    : (weekend.find((x) => x.day === 0)?.i ?? weekend[0]?.i
      ?? [6, 5, 4, 3, 2, 1, 0].find((i) => canRun(i) && !(dayZeroDropped && i === 0)) ?? -1);
  const bike = ctx.longRunMode === "bike";
  if (longIdx >= 0) {
    put(longIdx, bike
      ? { type: "Vélo", title: (l) => PLAN_T[l].veloLongTitre,
          detail: (l) => PLAN_T[l].veloLongDetail(warm, durationFor(longRunKm, paceFor(longIdx)) ?? "1h30", cycleNote(l)),
          why: (l) => PLAN_T[l].veloLongWhy, tags: tags("Vélo", "Z2", "Long") }
      : (() => {
          // ── SORTIE LONGUE : PLUS UN SIMPLE BLOC DE Z2 ────────────────────────
          // Elle était toujours identique — « X km en Z2, conversationnel » — quelle que
          // soit la phase et quel que soit l'objectif. C'est la séance la plus longue de
          // la semaine, donc la plus coûteuse : la laisser sans intention, c'est gâcher
          // sa moitié la plus utile. Un entraîneur y insère de la spécificité dès que
          // l'athlète encaisse le volume.
          //
          // Trois conditions pour oser : un athlète qui a de l'historique, une fraîcheur
          // qui le permet, et une distance suffisante pour que la fin ait un sens.
          const p = paceFor(longIdx);
          const easyTag = p ? ` (~${p}/km)` : "";
          const canSpice = longRunKm >= 12 && ctx.readiness.level !== "rouge" && !ctx.cycle.taper && !ctx.weekPlan.eased;
          const phase = ctx.macroPlan[0]?.phase ?? "Développement";
          const tagLong = (cat: "Spécifique" | "Progressif" | "Z2") => (l: Lang) =>
            [PLAN_T[l].tags["Long"], PLAN_T[l].tags[cat], PLAN_T[l].tagKm(nRaw(longRunKm, l))];
          if (canSpice && phase === "Spécifique" && goalPace) {
            // Bloc à allure course EN FIN de sortie longue : courir vite sur des jambes
            // déjà fatiguées, c'est ce qui se passe le jour J.
            const spec = Math.max(2, Math.round(longRunKm * 0.25));
            return { type: "Sortie longue", title: (l: Lang) => PLAN_T[l].longSpecTitre,
              detail: (l: Lang) => PLAN_T[l].longSpecDetail(warm, kmAndTime(longRunKm - spec, p, l), easyTag, nRaw(spec, l), goalPace, cool, `${gapNote(l)}${cycleNote(l)}`),
              why: (l: Lang) => PLAN_T[l].longSpecWhy,
              tags: tagLong("Spécifique") };
          }
          if (canSpice) {
            // Finish progressif : le dernier tiers plus rapide que le premier. Habitue à
            // finir fort plutôt qu'à survivre, et se paie en confiance le jour de course.
            const fast = p ? (() => { const m = p.match(/(\d+)['’](\d{2})/); if (!m) return null;
              const sec = Number(m[1]) * 60 + Number(m[2]) - 20; return `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}`; })() : null;
            const third = Math.max(2, Math.round(longRunKm / 3));
            return { type: "Sortie longue", title: (l: Lang) => PLAN_T[l].longProgTitre,
              detail: (l: Lang) => PLAN_T[l].longProgDetail(warm, kmAndTime(longRunKm, p, l), easyTag, nRaw(third, l), fast, cool, `${gapNote(l)}${cycleNote(l)}`),
              why: (l: Lang) => PLAN_T[l].longProgWhy,
              tags: tagLong("Progressif") };
          }
          return { type: "Sortie longue", title: (l: Lang) => PLAN_T[l].longTitre,
            detail: (l: Lang) => PLAN_T[l].longDetail(warm, kmAndTime(longRunKm, p, l), easyTag, cool, `${gapNote(l)}${cycleNote(l)}`),
            why: (l: Lang) => (ctx.volume.longRunEased
              // Une sortie longue raccourcie sans explication passe pour une erreur du plan :
              // l'athlète voit un chiffre plus petit que la semaine d'avant et n'en sait rien.
              ? PLAN_T[l].longWhyRaccourcie(nRaw(longRunKm, l), nRaw(ctx.volume.longRunPlanned, l), motifs(l, 1) || PLAN_T[l].motifDefaut)
              : PLAN_T[l].longWhy(nRaw(longRunKm, l))),
            tags: tagLong("Z2") };
        })());
    spend();
  }

  // ── 3. Repos complet le lendemain de la sortie longue.
  const restIdx = longIdx >= 0 ? [longIdx + 1, longIdx - 1].find((i) => isFree(i)) : undefined;
  if (restIdx != null) put(restIdx, {
    type: "Repos", title: (l) => PLAN_T[l].reposCompletTitre,
    detail: (l) => PLAN_T[l].reposCompletDetail,
    why: (l) => PLAN_T[l].reposCompletWhy, tags: tags("Repos"),
  });

  // ── 4. Séances de qualité, espacées — Y COMPRIS PAR RAPPORT AU PASSÉ.
  // La dernière séance dure DÉJÀ EFFECTUÉE est traitée comme un jour dur d'index négatif :
  // si elle date d'hier, elle occupe l'index −1 et repousse d'autant la première qualité.
  // La course, elle, agit comme un jour dur à ne pas approcher à moins de 48 h.
  // (`dayZeroDropped` est déclaré plus haut : il sert d'abord à la sortie longue, puis
  //  ici à la qualité. Deux déclarations auraient fini par diverger.)
  const placed: number[] = ctx.lastHardDaysAgo != null ? [-ctx.lastHardDaysAgo] : [];
  if (raceIdx >= 0) placed.push(raceIdx);
  // Un jour à 30 °C n'est pas un jour de qualité s'il existe une alternative plus fraîche
  // dans la fenêtre : on ne sacrifie pas une séance clé à la canicule.
  const tempOf = (i: number) => ctx.forecast.find((x) => x.date === iso(dates[i]))?.tempMax ?? null;
  // Reporter une séance pour cause de chaleur n'a de sens que si l'alternative est
  // réellement plus fraîche ET utilisable. Sans la condition d'espacement, une semaine
  // entièrement caniculaire voyait TOUS ses jours disqualifiés par le seul jour un peu
  // moins chaud — la qualité basculait alors sur le repli, et se perdait.
  const coolerExists = (i: number) => {
    const t = tempOf(i);
    if (t == null || t < 28) return false;
    return dates.some((_, j) => j !== i && canRun(j) && okSpacing(j) && (tempOf(j) ?? 99) < t - 3);
  };
  const okSpacing = (i: number) => placed.every((p) => Math.abs(p - i) >= gapDays)
    && (longIdx < 0 || Math.abs(i - longIdx) >= 2)
    && (raceIdx < 0 || Math.abs(i - raceIdx) >= 3);   // rien de dur dans les 48 h autour de la course
  // Le VOLUME plafonne aussi le nombre de qualités : une séance complète (20 min
  // d'échauffement + corps + 10 min de retour au calme) pèse ~11 km. En dessous de
  // 35 km/semaine, deux séances de ce type ne rentrent pas à côté de la sortie longue.
  // Coût kilométrique d'une séance de qualité. C'était une CONSTANTE de 11 km, quel que
  // soit le coureur : pour un débutant visant 18 km par semaine, une seule séance en
  // consommait plus de la moitié, et le plan dépassait sa cible de 45 %. On le calcule
  // sur SON allure : échauffement + retour au calme + ~25 min de corps.
  const QUALITY_KM = (() => {
    const p2 = ctx.easyPace?.match(/(\d+)['’](\d{2})/);
    if (!p2) return 11;
    const secPerKm = Number(p2[1]) * 60 + Number(p2[2]);
    const minutes = warm + cool + 25;
    return Math.max(5, Math.round((minutes * 60 / secPerKm) * 10) / 10);
  })();
  const maxByVolume = Math.max(1, Math.floor((targetKm - longRunKm) / QUALITY_KM));
  // La FRÉQUENCE plafonne aussi : à 3 sorties par semaine, deux séances de qualité plus
  // la sortie longue ne laissent AUCUN footing facile — soit 100 % d'intensité, l'inverse
  // du modèle polarisé. Une qualité pour trois sorties, deux à partir de cinq.
  const maxByFrequency = ctx.availability.daysPerWeek <= 3 ? 1 : ctx.availability.daysPerWeek <= 5 ? 2 : 3;
  // AFFÛTAGE : on garde l'intensité mais on coupe le VOLUME dur. Sans ce plafond, une
  // semaine d'affûtage cumulait sortie longue + 3 qualités — quatre séances exigeantes
  // à quinze jours de l'objectif, soit exactement ce que l'affûtage doit empêcher.
  const maxByTaper = ctx.cycle.taper ? (longIdx >= 0 ? 1 : 2) : 99;
  const quality = wp.quality.slice(0, Math.min(wp.quality.length, maxByVolume, maxByFrequency, maxByTaper));
  for (let qi = 0; qi < quality.length; qi++) {
    const q = quality[qi];
    // Tous les jours possibles, plus seulement le premier : c'est ce qui permet à la
    // météo de départager. Sans cette liste, une séance de VMA pouvait tomber sur le
    // jour à 25 s/km de pénalité alors qu'un jour à 0 attendait 48 h plus tard.
    const eligibles: number[] = [];
    for (let i = dayZeroDropped ? 1 : 0; i <= 6; i++) if (canRun(i) && okSpacing(i) && !coolerExists(i)) eligibles.push(i);
    let idx = choisirJourQualite(eligibles, penaliteMeteo, quality.length - 1 - qi);
    // Le repli ignorait `dayZeroDropped` : il replaçait la qualité sur le jour même,
    // que l'étape 7 convertissait ensuite en récupération. La séance disparaissait donc
    // de la semaine — le défaut que le premier correctif était censé supprimer, intact
    // dans le chemin de secours.
    if (idx < 0) for (let i = dayZeroDropped ? 1 : 0; i <= 6; i++) if (canRun(i) && okSpacing(i)) { idx = i; break; }
    if (idx < 0) break; // impossible sans violer la récupération ou le budget → on n'insiste pas
    const title = (l: Lang) => q.type === "VMA" ? PLAN_T[l].qualiteTitreVMA
      : q.type === "Seuil" ? PLAN_T[l].qualiteTitreSeuil
      : q.type === "Spécifique" ? PLAN_T[l].qualiteTitreSpecifique : q.type;
    // La description de la séance vient du menu de qualité, déjà rendue dans les
    // 5 langues (`QualitySession.descAll`). Un contexte sérialisé par une version
    // antérieure n'a pas ce champ : on retombe alors sur le français, jamais sur du vide.
    const corps = (l: Lang) => heatAdjustDesc(q.descAll?.[l] ?? q.desc, idx);
    // ── SÉANCE SAUVÉE PAR LE PLANCHER « PRÉPARATION EN COURS » ──────────────────
    // Le budget de qualité tombait à zéro dès qu'une montée en charge se voyait dans
    // les chiffres — c'est-à-dire pendant toute une préparation. Résultat vécu à 72 jours
    // d'un marathon : semaine entière en footings lents, alors que c'est la période où
    // l'allure spécifique se construit. On garde donc UNE séance, mais RACCOURCIE et
    // annoncée comme telle : une qualité allégée n'est pas une qualité normale.
    const rescued = ctx.weekPlan.floored;
    put(idx, {
      type: q.type,
      title: (l) => (rescued ? `${title(l)}${PLAN_T[l].suffixeAllegee}` : title(l)),
      detail: (l) => PLAN_T[l].qualiteDetail(warmQ, corps(l), cool, ctx.cycle.taper, rescued),
      why: (l) => (rescued ? PLAN_T[l].qualiteWhySauvee(crossNote(l)) : PLAN_T[l].qualiteWhy),
      tags: (l) => [
        PLAN_T[l].tags[q.type as keyof (typeof PLAN_T)["fr"]["tags"]] ?? q.type,
        PLAN_T[l].tags["Qualité"],
        ...(rescued ? [PLAN_T[l].tags["Allégée"]] : []),
      ],
    });
    placed.push(idx);
    spend();
  }

  // ── 5. Endurance sur les jours de course restants (budget non consommé).
  const easySlots: number[] = [];
  // Le jour 0 RESTE un créneau de footing même quand la fraîcheur le convertit en
  // récupération : une séance de récup est un footing court, elle porte du kilométrage.
  // (À la différence d'une séance de qualité annulée, dont les 11 km, eux, se libèrent.)
  for (let i = 0; i <= 6; i++) if (canRun(i)) { easySlots.push(i); spend(); }
  // La séance du jour est arbitrée par la fraîcheur à l'étape 7. Si la qualité prévue
  // aujourd'hui va être remplacée par de la récupération, ses kilomètres ne doivent PAS
  // être décomptés du budget : sinon les footings de la semaine rétrécissent pour
  // financer une séance qui n'aura jamais lieu (constaté : footings ramenés à 4 km).
  const qualityKept = placed.filter((i) => i >= 0 && i !== raceIdx && !(dayZeroDropped && i === 0));
  const usedKm = (longIdx >= 0 ? longRunKm : 0) + qualityKept.length * QUALITY_KM;
  // Le budget restant ne suffit pas toujours à alimenter tous les créneaux libres. Plutôt
  // que d'y poser des footings au rabais — ce qui faisait dépasser la cible hebdomadaire —
  // on réduit le NOMBRE de sorties : un jour de repos vaut mieux qu'un footing de 2 km.
  const remaining = Math.max(0, targetKm - usedKm);
  const affordable = Math.max(0, Math.floor(remaining / 4));
  if (easySlots.length > affordable) {
    for (const i of easySlots.splice(affordable)) { slot[i] = null; runBudget += 1; }
  }
  const rawEasy = easySlots.length > 0 ? remaining / easySlots.length : 0;
  // Bornes de réalisme : en dessous de 4 km ce n'est plus une séance, au-dessus de 18 km
  // ce n'est plus un footing — un gros volume se couvre en DOUBLANT les sorties.
  // Semaine de course : les footings restent courts quoi qu'il arrive. Un « footing »
  // de 18 km trois jours avant un départ ruinerait la fraîcheur, même si le volume
  // cible n'a pas été correctement réduit en amont.
  // Un footing plus long que la sortie longue n'a aucun sens : c'est la sortie longue qui
  // porte le volume, et deux séances de même durée n'en font qu'une répétée. Constaté sur
  // 3 sorties par semaine — 16 km de « footing » contre 13 km de sortie longue.
  const easyCap = Math.min(raceIdx >= 0 ? 10 : 18, longIdx >= 0 ? Math.max(4, longRunKm * 0.85) : 18);
  // Plancher à 4 km SAUF si le budget ne le permet pas : mieux vaut une sortie de moins
  // qu'un dépassement de la cible hebdomadaire.
  const easyKm = Math.min(easyCap, Math.max(rawEasy >= 3 ? 4 : 3, Math.round(rawEasy)));
  const doubles = rawEasy > easyCap && raceIdx < 0;
  for (const i of easySlots) put(i, {
    type: "Endurance", title: (l) => PLAN_T[l].enduranceTitre,
    detail: (l) => PLAN_T[l].enduranceDetail(warm, kmAndTime(easyKm, paceFor(i), l),
      paceFor(i) ? ` (~${paceFor(i)}/km)` : "", cool, gapNote(l), doubles, cycleNote(l)),
    why: (l) => (ctx.tooMuchIntensity
      ? PLAN_T[l].enduranceWhyTropIntense(nRaw(ctx.tooMuchIntensity, l))
      : PLAN_T[l].enduranceWhy(nRaw(targetKm, l))),
    tags: (l) => [PLAN_T[l].tags["Endurance"], PLAN_T[l].tags["Z2"], PLAN_T[l].tagKm(nRaw(easyKm, l))],
  });

  // ── 6. Renforcement : sur un jour SANS course, jamais la veille d'un jour dur.
  // Il ne consomme pas de budget de course : 30 min à la maison restent possibles
  // un jour de repos de course.
  const hardIdx = new Set<number>([...placed.filter((i) => i >= 0), longIdx].filter((i) => i >= 0));
  // Le repli acceptait N'IMPORTE quel jour libre, y compris la veille d'une séance dure —
  // ce que la règle principale interdit précisément. Constaté sur 164 scénarios : renfo
  // le samedi, VMA le dimanche. Un renforcement la veille d'une qualité en gâche les
  // deux : jambes lourdes le jour J, et bénéfice de force non assimilé.
  // Mieux vaut PAS de renfo qu'un renfo mal placé — il n'est pas urgent à la journée près.
  const renfoIdx = [1, 2, 3, 4, 5, 6].find((i) => isFree(i) && avail(i) && !hardIdx.has(i + 1))
    ?? [1, 2, 3, 4, 5, 6].find((i) => isFree(i) && !hardIdx.has(i + 1));
  if (renfoIdx != null) put(renfoIdx, {
    type: "Renfo", title: (l) => PLAN_T[l].renfoTitre,
    // Le renforcement était un texte UNIQUE, identique toute l'année. C'est pourtant le
    // premier facteur de prévention des blessures, et il obéit aux mêmes lois que la
    // course : il se périodise et il surcharge. Trois erreurs corrigées ici —
    // aucune progression, aucune spécificité de phase, et de la force lourde maintenue
    // pendant l'affûtage (où elle coûte de la fraîcheur sans plus rien apporter).
    detail: (l) => {
      const phase = ctx.cycle.taper ? "affûtage" : ctx.macroPlan[0]?.phase ?? "Développement";
      const sets = blockWeekRenfo === 3 ? 2 : 3 + Math.min(1, blockWeekRenfo);
      if (phase === "affûtage" || ctx.cycle.taper) return PLAN_T[l].renfoAffutage;
      if (phase === "Base") return PLAN_T[l].renfoBase(sets);
      if (phase === "Spécifique") return PLAN_T[l].renfoSpecifique(sets);
      return PLAN_T[l].renfoDeveloppement(sets, sets > 3);
    },
    why: (l) => PLAN_T[l].renfoWhy,
    tags: tags("Renfo", "Prévention"),
  });

  // ── 7. Tout ce qui reste = repos.
  for (let i = 0; i <= 6; i++) put(i, {
    type: "Repos", title: (l) => PLAN_T[l].reposTitre, tags: tags("Repos"),
    detail: (l) => PLAN_T[l].reposFinalDetail,
    why: (l) => PLAN_T[l].reposFinalWhy,
  });

  const week = slot as PlanDay[];

  // ── 7. Le jour J est arbitré par la FRAÎCHEUR RÉELLE, pas par le squelette.
  const lvl = ctx.readiness.level;
  const isHardToday = /VMA|Seuil|Spécifique|Sortie longue/i.test(week[0].type);
  const hardToday = ctx.lastHardDaysAgo === 0;   // une séance dure a DÉJÀ eu lieu aujourd'hui

  /**
   * Réécrit un jour DANS LES CINQ LANGUES à partir de ce qu'il contient déjà.
   *
   * Les étapes 7 et 8 ne reconstruisent pas une séance : elles retouchent celle qui est
   * là (suffixe « (allégée) », mention du doublage…). Sans ce passage, la retouche
   * n'aurait porté que sur le français et les autres langues auraient gardé le texte
   * d'avant — exactement le genre de divergence silencieuse qu'on cherche à éviter.
   */
  const reecrire = (d: PlanDay, f: (l: Lang, avant: PlanDayText) => PlanDayText): PlanDay => {
    const frText: PlanDayText = { title: d.title, detail: d.detail, why: d.why, tags: d.tags };
    const avant = (l: Lang): PlanDayText => (l === "fr" ? frText : d.i18n?.[l] ?? frText);
    return {
      ...d, ...f("fr", frText),
      i18n: Object.fromEntries(AUTRES_LANGUES.map((l) => [l, f(l, avant(l))])) as Partial<Record<Lang, PlanDayText>>,
    };
  };

  if ((lvl === "rouge" || hardToday) && week[0].type !== "Repos") {
    week[0] = reecrire({ ...week[0], type: "Récup" }, (l) => ({
      title: PLAN_T[l].recupTitre,
      detail: PLAN_T[l].recupDetail(warm, cool),
      why: hardToday ? PLAN_T[l].recupWhyDejaDur : PLAN_T[l].recupWhyRouge(motifs(l, 2)),
      tags: [PLAN_T[l].tags["Récup"], PLAN_T[l].tags["Z1"]],
    }));
  } else if (lvl === "orange" && isHardToday) {
    // Le suffixe n'est ajouté QUE s'il n'y est pas déjà : la séance sauvée par le plancher
    // « préparation en cours » est posée alléguée dès l'étape 4, et le verdict orange du
    // jour la ré-annotait — « Séance au seuil (allégée) (allégée) » sur le calendrier
    // ET sur la montre.
    // Le test porte sur le titre FRANÇAIS canonique : c'est le même fait pour les cinq
    // langues, et le lire dans chacune ferait dépendre le plan de ses traductions.
    const dejaAllegee = / \(allégée\)$/.test(week[0].title);
    week[0] = reecrire(week[0], (l, avant) => ({
      ...avant,
      title: dejaAllegee ? avant.title : `${avant.title}${PLAN_T[l].suffixeAllegee}`,
      detail: `${avant.detail}${PLAN_T[l].allegeeDetailSuffixe}`,
      why: PLAN_T[l].allegeeWhy(motifs(l, 2)),
    }));
  }

  // ── 8. DOUBLES SÉANCES — matin + soir ────────────────────────────────────────
  // On SCINDE, on n'ajoute pas. Une sortie facile devenue trop longue pour un seul
  // bloc est répartie sur la journée : même volume, mieux absorbé. Le plan se
  // contentait jusqu'ici d'un conseil dans le texte (« scinde en deux sorties »), que
  // rien ne transformait en séances réelles — ni sur le calendrier, ni sur la montre.
  //
  // Les conditions (option cochée, volume, fraîcheur, absence de douleur, hors
  // affûtage) sont décidées dans lib/coach/doubleSessions et arrivent ici tranchées :
  // ce module POSE les séances, il ne juge pas de leur opportunité.
  if (ctx.doubles?.autorise) {
    const doubles: PlanDay[] = [];
    // Au plus deux jours doublés par semaine : au-delà, la contrainte d'organisation
    // dépasse le bénéfice, et c'est le premier motif d'abandon de la méthode.
    let restants = 2;
    for (let i = 0; i < week.length && restants > 0; i++) {
      const j = week[i];
      if (j.type !== "Endurance") continue;               // on ne scinde qu'un footing
      const km = Number(/(\d+(?:[.,]\d+)?)\s*km/.exec(j.detail)?.[1]?.replace(",", ".") ?? 0);
      const part = scinderFacile(km);
      if (!part) continue;                                // trop court pour valoir deux sorties
      week[i] = { ...reecrire(j, (l, avant) => ({
        title: `${avant.title}${PLAN_T[l].suffixeSoir}`,
        detail: avant.detail.replace(/(\d+(?:[.,]\d+)?)\s*km/, `${nRaw(part.soirKm, l)} km`),
        why: `${avant.why}${PLAN_T[l].whySoir}`,
        tags: [...avant.tags.slice(0, 3), PLAN_T[l].tags["Soir"]],
      })), moment: "soir" };
      const matin = (l: Lang): PlanDayText => ({
        title: PLAN_T[l].matinTitre,
        detail: seanceMatinFacile(part.matinKm, ctx.easyPace, l),
        why: PLAN_T[l].matinWhy,
        tags: [PLAN_T[l].tags["Endurance"], PLAN_T[l].tags["Z1"], PLAN_T[l].tags["Matin"]],
      });
      doubles.push({
        date: j.date, type: "Endurance", moment: "matin",
        ...matin("fr"),
        i18n: Object.fromEntries(AUTRES_LANGUES.map((l) => [l, matin(l)])) as Partial<Record<Lang, PlanDayText>>,
        confirmed: j.confirmed,
      });
      restants--;
    }
    // Le matin AVANT le soir : les écrans trient par date, et deux séances de même
    // date doivent s'afficher dans l'ordre où elles se courent.
    if (doubles.length) {
      return sortir([...week, ...doubles]);
    }
  }

  return sortir(week);

  /**
   * ── LE RENFORCEMENT DE SECOURS ─────────────────────────────────────────────
   *
   * ⚠️ IL DISPARAISSAIT CHEZ CEUX QUI EN ONT LE PLUS BESOIN. L'étape 6 cherche un jour
   * LIBRE — `isFree`, c'est-à-dire un jour où rien n'a été posé. Or à ce stade le repos
   * l'est déjà, comme séance à part entière. Un coureur qui court sept jours sur sept
   * n'avait donc plus un seul créneau : mesuré, 0 renfo sur un profil élite à 70 km,
   * alors que c'est précisément le profil le plus exposé à la blessure. Le commentaire
   * de l'étape 6 annonçait pourtant l'inverse — « 30 min à la maison restent possibles
   * un jour de repos de course ».
   *
   * Quand aucun jour n'est libre, le renforcement se pose donc EN SECOND sur un footing
   * facile — ce que fait tout coureur à haut volume : de la force après une sortie
   * facile, jamais la veille d'une séance dure.
   *
   * ⚠️ Trois interdits maintenus : pas la veille d'un jour dur (jambes lourdes le jour J,
   * force non assimilée), pas sur la sortie longue, pas un jour de repos complet — ce
   * repos-là est prescrit, pas une case vide.
   */
  function sortir(jours: PlanDay[]): PlanDay[] {
    if (jours.some((d) => d.type === "Renfo")) return jours;

    const dur = new Set(jours.filter((d) => /VMA|Seuil|Sp[ée]cifique|Allure|C[oô]te|Sortie longue/i.test(d.type)).map((d) => d.date));
    const veilleDeDur = (date: string) => {
      const d = new Date(date + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      return dur.has(d.toISOString().slice(0, 10));
    };
    // ⚠️ NE JAMAIS GREFFER LE RENFO SUR UN JOUR DÉJÀ DOUBLÉ. `sortir` passe APRÈS la
    // pose des doubles séances : un jour scindé matin + soir a déjà son créneau du soir
    // occupé par un footing. Sans ce garde-fou, l'athlète recevait TROIS séances le même
    // jour, dont deux annoncées au même moment — « Footing en endurance (soir) » ET
    // « Renforcement musculaire », impossibles à faire toutes les deux. Constaté sur le
    // scénario « doubles autorisés, gros volume » : 3 séances le 2 septembre.
    const joursDoubles = new Set(jours.filter((d) => d.moment === "matin").map((d) => d.date));
    const hote = jours.find((d) => d.type === "Endurance" && d.moment !== "matin"
      && !joursDoubles.has(d.date) && !veilleDeDur(d.date));
    if (!hote) return jours;

    const rendu = (l: Lang): PlanDayText => ({
      title: PLAN_T[l].renfoTitre,
      // ⚠️ La version ALLÉGÉE, volontairement. Ce renforcement-là s'ajoute à un footing
      // le même jour : y mettre de la force lourde ferait deux séances dures en une
      // journée, ce que le plan passe son temps à éviter ailleurs.
      detail: PLAN_T[l].renfoAffutage,
      why: PLAN_T[l].renfoWhy,
      tags: [PLAN_T[l].tags["Renfo"], PLAN_T[l].tags["Prévention"]],
    });
    const renfo: PlanDay = {
      date: hote.date, type: "Renfo", moment: "soir",
      ...rendu("fr"),
      i18n: Object.fromEntries(AUTRES_LANGUES.map((l) => [l, rendu(l)])) as Partial<Record<Lang, PlanDayText>>,
      confirmed: hote.confirmed,
    };
    return [...jours, renfo].sort((a, b) =>
      a.date.localeCompare(b.date) || (a.moment === "matin" ? -1 : b.moment === "matin" ? 1 : 0));
  }
}
