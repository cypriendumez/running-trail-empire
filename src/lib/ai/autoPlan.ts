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
import { scinderFacile, seanceMatinFacile } from "@/lib/coach/doubleSessions";

export type PlanDay = {
  date: string;          // AAAA-MM-JJ
  type: string;          // Repos | Récup | Endurance | Sortie longue | VMA | Seuil | Spécifique | Renfo | Vélo
  title: string;
  detail: string;
  why: string;
  tags: string[];
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
function kmAndTime(km: number, pace: string | null): string {
  const d = durationFor(km, pace);
  return d ? `~${km} km (environ ${d})` : `~${km} km`;
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
  const gapNote = ctx.hillyTraining
    ? " ⛰️ Sur terrain vallonné, cette allure s'entend en GAP (allure ajustée au dénivelé) : en montée tu seras plus lent au chrono pour le même effort — fie-toi à la FC et au ressenti, pas au cadran."
    : "";
  const cycleNote = ctx.cycle.taper ? " ⚠️ Semaine d'AFFÛTAGE : on réduit le volume, pas l'intensité."
    : ctx.cycle.deload ? " ⚠️ Semaine ALLÉGÉE : c'est maintenant que le corps assimile le travail des 3 semaines précédentes." : "";
  // D'OÙ VIENT LA FATIGUE, quand une part notable ne vient pas de la course. Un athlète
  // qui rentre d'une semaine de randonnée en montagne doit lire « ta charge vient aussi
  // de tes 12 h de rando », pas un allègement inexpliqué de ses séances de course.
  // Optionnel : un `auto_coach_state` sérialisé avant cette version n'a pas ce champ.
  const crossNote = ctx.cross && ctx.cross.sharePct >= 20 && ctx.cross.label
    ? ` (dont ${ctx.cross.sharePct} % venant d'un autre sport : ${ctx.cross.label})`
    : "";

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
  const paceFor = (i: number): string | null => {
    const base = ctx.easyPace;
    if (!base) return null;
    const m = base.match(/(\d+)['’:](\d{2})/);
    const f = ctx.forecast.find((x) => x.date === iso(dates[i]));
    if (!m || !f) return base;
    // Chaleur ET vent : les deux ralentissent, et ils se cumulent.
    // La chaleur s'apprivoise (10-14 j d'exposition) ; le vent, non.
    const penalty = Math.round(heatAdvice(f.tempMax, f.humidity).penaltySecPerKm * ctx.heatAcclim.factor)
      + windAdvice(f.windMaxKmh).penaltySecPerKm;
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

  const weatherFor = (i: number, type: string): string => {
    if (/Repos|Renfo/.test(type)) return "";
    const f = ctx.forecast.find((x) => x.date === iso(dates[i]));
    if (!f) return "";
    const a = heatAdvice(f.tempMax, f.humidity);
    const w = windAdvice(f.windMaxKmh);
    const notes = [a.penaltySecPerKm > 0 || f.tempMax < 5 ? a.note : "", w.note].filter(Boolean);
    return notes.length ? `\n\n${notes.join("\n")}` : "";
  };

  const slot: (PlanDay | null)[] = Array(7).fill(null);
  const put = (i: number, d: Omit<PlanDay, "date" | "confirmed">) => {
    if (i < 0 || i > 6 || slot[i]) return false;
    slot[i] = { ...d, date: iso(dates[i]), confirmed: i < CONFIRMED_DAYS,
                detail: d.detail + weatherFor(i, d.type) };
    return true;
  };

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
      type: "Course", title: o?.race ? `🏁 ${o.race}` : "🏁 Jour de course",
      detail: `Échauffement 15 à 20 min progressif + 3 à 4 lignes droites, terminé 10 min avant le départ.${o?.targetPace ? ` Pars à ${o.targetPace}/km — surtout PAS plus vite sur les 2 premiers kilomètres, c'est l'erreur qui coûte le plus cher.` : ""} Retour au calme 10 min en trottinant.`,
      why: o?.targetTime ? `C'est le jour. Tout le bloc a été construit pour ce chrono de ${o.targetTime}. Fais confiance à ta préparation et tiens ton allure.` : "C'est le jour. Fais confiance à ta préparation.",
      tags: ["Course", o?.distanceKm ? `${o.distanceKm} km` : "Objectif"].filter(Boolean) as string[],
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
        ? { type: "Récup", title: "Déblocage — veille de course",
            detail: "20 min de footing très facile FC Z1 + 3 lignes droites de 80 m à l'allure de course. Rien de plus : on réveille les jambes, on ne les fatigue pas.",
            why: "La forme se construit avant, pas la veille. Une séance de plus ne t'apportera rien et peut te coûter la course.",
            tags: ["Récup", "Veille de course"] }
        : { type: "Récup", title: "Avant-veille de course",
            detail: "30 min de footing facile FC Z1-Z2, éventuellement 4×30 s à l'allure de course pour rester tonique.",
            why: "On garde le contact avec l'allure sans entamer la fraîcheur.", tags: ["Récup", "Affûtage"] })) spend();
    }
    // Les jours qui suivent : récupération obligatoire.
    for (const d of [1, 2]) {
      const i = raceIdx + d;
      if (i > 6) continue;
      // Le footing de reprise n'a lieu que si le budget de sorties le permet.
      if (d === 2 && runBudget <= 0) continue;
      const placedRest = put(i, d === 1
        ? { type: "Repos", title: "Repos post-course", detail: "Repos complet. Marche, étirements doux, hydratation et alimentation soignées.",
            why: "Une course, c'est un effort maximal : le corps a besoin de plusieurs jours pour réparer.", tags: ["Repos"] }
        : { type: "Récup", title: "Récupération post-course",
            detail: "20 à 30 min de footing très facile FC Z1, ou repos si les jambes sont encore lourdes.",
            why: "Reprise en douceur : compte environ un jour de récupération par tranche de 3 km courus en course.", tags: ["Récup", "Z1"] });
      if (placedRest && d === 2) spend();   // le footing de reprise est une sortie
    }
  }

  // ── 1. Jours systématiquement ratés → repos assumé.
  // Continuer à prescrire un jour que l'athlète ne court jamais ne fait que dégrader
  // son adhérence et fausser nos statistiques. Mieux vaut l'acter.
  for (let i = 0; i <= 6; i++) {
    if (ctx.skippedWeekdays.includes(dates[i].getDay())) {
      put(i, { type: "Repos", title: "Repos", tags: ["Repos"],
        detail: "Repos. Ce jour de la semaine ne te convient visiblement pas pour courir — on ne s'obstine pas, le volume est reporté ailleurs.",
        why: "Tu n'as pas couru ce jour-là les dernières fois qu'il était prévu. Un plan qu'on ne suit pas ne sert à rien : on l'adapte à ta vraie vie." });
    }
  }

  // ── 1 bis. DISPONIBILITÉS : on ne place de la course QUE les jours praticables.
  const isFree = (i: number) => i >= 0 && i <= 6 && !slot[i];
  const avail = (i: number) => ctx.availability.days.includes(dates[i].getDay());
  for (let i = 0; i <= 6; i++) {
    if (isFree(i) && !avail(i)) put(i, {
      type: "Repos", title: "Repos", tags: ["Repos"],
      detail: "Repos — tu as indiqué ne pas pouvoir t'entraîner ce jour-là.",
      why: "Ton plan est calé sur tes vraies disponibilités : c'est ce qui le rend tenable dans la durée.",
    });
  }
  // Budget de séances de COURSE pour la semaine (la course elle-même en consomme une).
  // C'est ce plafond qui empêche de prescrire 6 sorties à quelqu'un qui peut en faire 3.

  const canRun = (i: number) => isFree(i) && avail(i) && runBudget > 0;

  // ── 2. Sortie longue : dimanche de préférence, sinon samedi, sinon un jour praticable.
  // Semaine de course : PAS de sortie longue. La course est déjà l'effort long et dur
  // de la semaine ; y ajouter 18 km trois jours avant saboterait la fraîcheur.
  const weekend = dates.map((d, i) => ({ i, day: d.getDay() })).filter((x) => (x.day === 0 || x.day === 6) && canRun(x.i));
  // Une « sortie longue » de moins de 4 km n'est pas une sortie longue. Cas rencontré
  // sur un profil sans aucune donnée (volume cible nul) : le plan annonçait « Sortie
  // longue : ~0 km (environ 0 min) ». Mieux vaut ne rien poser.
  const longIdx = longRunKm < 4 ? -1 : raceIdx >= 0 ? -1
    : (weekend.find((x) => x.day === 0)?.i ?? weekend[0]?.i ?? [6, 5, 4, 3, 2, 1, 0].find((i) => canRun(i)) ?? -1);
  const bike = ctx.longRunMode === "bike";
  if (longIdx >= 0) {
    put(longIdx, bike
      ? { type: "Vélo", title: "Sortie longue à vélo",
          detail: `Échauffement ${warm} min très facile → ${durationFor(longRunKm, paceFor(longIdx)) ?? "1h30"} à 2h en FC Z2, allure conversationnelle, cadence souple → 10 min de retour au calme. Pas d'allure cible : c'est du volume aérobie sans impact.${cycleNote}`,
          why: "Le volume aérobie de la semaine, sans les contraintes d'impact de la course.", tags: ["Vélo", "Z2", "Long"] }
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
          if (canSpice && phase === "Spécifique" && goalPace) {
            // Bloc à allure course EN FIN de sortie longue : courir vite sur des jambes
            // déjà fatiguées, c'est ce qui se passe le jour J.
            const spec = Math.max(2, Math.round(longRunKm * 0.25));
            return { type: "Sortie longue", title: "Sortie longue avec bloc spécifique",
              detail: `Échauffement ${warm} min progressif FC Z1→Z2 → Corps : ${kmAndTime(longRunKm - spec, p)} en Z2${easyTag}, puis ${spec} km à ${goalPace}/km SUR JAMBES FATIGUÉES → Retour au calme ${cool} min FC Z1.${gapNote}${cycleNote}`,
              why: `Le bloc à allure course arrive en FIN de sortie, quand les jambes sont déjà lourdes — c'est exactement l'état dans lequel tu seras au dernier tiers de ta course. Aucune séance ne prépare mieux le jour J.`,
              tags: ["Long", "Spécifique", `${longRunKm} km`] };
          }
          if (canSpice) {
            // Finish progressif : le dernier tiers plus rapide que le premier. Habitue à
            // finir fort plutôt qu'à survivre, et se paie en confiance le jour de course.
            const fast = p ? (() => { const m = p.match(/(\d+)['’](\d{2})/); if (!m) return null;
              const sec = Number(m[1]) * 60 + Number(m[2]) - 20; return `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}`; })() : null;
            const third = Math.max(2, Math.round(longRunKm / 3));
            return { type: "Sortie longue", title: "Sortie longue progressive",
              detail: `Échauffement ${warm} min progressif FC Z1→Z2 → Corps : ${kmAndTime(longRunKm, p)} en Z2${easyTag}, dont les ${third} DERNIERS kilomètres accélérés${fast ? ` à ~${fast}/km` : " d'un cran"} → Retour au calme ${cool} min FC Z1.${gapNote}${cycleNote}`,
              why: `Finir plus vite qu'on a commencé : ça t'apprend à terminer fort au lieu de subir, et ça fabrique la confiance qui décide d'une fin de course. La progression doit rester CONFORTABLE — si tu forces, c'est raté.`,
              tags: ["Long", "Progressif", `${longRunKm} km`] };
          }
          return { type: "Sortie longue", title: "Sortie longue",
            detail: `Échauffement ${warm} min progressif FC Z1→Z2 → Corps : ${kmAndTime(longRunKm, p)} en Z2${easyTag}, allure conversationnelle du début à la fin → Retour au calme ${cool} min FC Z1.${gapNote}${cycleNote}`,
            why: ctx.volume.longRunEased
              // Une sortie longue raccourcie sans explication passe pour une erreur du plan :
              // l'athlète voit un chiffre plus petit que la semaine d'avant et n'en sait rien.
              ? `Sortie longue RACCOURCIE à ${longRunKm} km (${ctx.volume.longRunPlanned} km prévus) : ${ctx.readiness.reasons[0] ?? "signaux de fatigue"}. Ce n'est pas un recul — c'est ce qui permet d'enchaîner la suite du bloc. On remonte dès que la charge redescend.`
              : `C'est la séance qui construit ton endurance de fond — ${longRunKm} km, calés sur ton volume actuel. Elle doit rester facile : si tu finis cassé, elle était trop rapide.`,
            tags: ["Long", "Z2", `${longRunKm} km`] };
        })());
    spend();
  }

  // ── 3. Repos complet le lendemain de la sortie longue.
  const restIdx = longIdx >= 0 ? [longIdx + 1, longIdx - 1].find((i) => isFree(i)) : undefined;
  if (restIdx != null) put(restIdx, {
    type: "Repos", title: "Repos complet",
    detail: "Repos complet. Marche, étirements doux ou mobilité si tu en ressens le besoin, rien de plus.",
    why: "C'est pendant le repos que l'adaptation se fait, pas pendant l'effort.", tags: ["Repos"],
  });

  // ── 4. Séances de qualité, espacées — Y COMPRIS PAR RAPPORT AU PASSÉ.
  // La dernière séance dure DÉJÀ EFFECTUÉE est traitée comme un jour dur d'index négatif :
  // si elle date d'hier, elle occupe l'index −1 et repousse d'autant la première qualité.
  // La course, elle, agit comme un jour dur à ne pas approcher à moins de 48 h.
  // La séance d'aujourd'hui sera de toute façon remplacée par de la récupération si la
  // fraîcheur est au rouge (étape 7). Placer la qualité sur le jour 0 revenait alors à la
  // SUPPRIMER : une semaine entière sans qualité parce que l'athlète était fatigué ce
  // matin-là. On la décale simplement plus loin dans la semaine.
  const dayZeroDropped = ctx.readiness.level === "rouge" || ctx.lastHardDaysAgo === 0;
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
  for (const q of quality) {
    let idx = -1;
    for (let i = dayZeroDropped ? 1 : 0; i <= 6; i++) if (canRun(i) && okSpacing(i) && !coolerExists(i)) { idx = i; break; }
    // Le repli ignorait `dayZeroDropped` : il replaçait la qualité sur le jour même,
    // que l'étape 7 convertissait ensuite en récupération. La séance disparaissait donc
    // de la semaine — le défaut que le premier correctif était censé supprimer, intact
    // dans le chemin de secours.
    if (idx < 0) for (let i = dayZeroDropped ? 1 : 0; i <= 6; i++) if (canRun(i) && okSpacing(i)) { idx = i; break; }
    if (idx < 0) break; // impossible sans violer la récupération ou le budget → on n'insiste pas
    const title = q.type === "VMA" ? "Séance VMA" : q.type === "Seuil" ? "Séance au seuil" : q.type === "Spécifique" ? "Allure spécifique objectif" : q.type;
    // ── SÉANCE SAUVÉE PAR LE PLANCHER « PRÉPARATION EN COURS » ──────────────────
    // Le budget de qualité tombait à zéro dès qu'une montée en charge se voyait dans
    // les chiffres — c'est-à-dire pendant toute une préparation. Résultat vécu à 72 jours
    // d'un marathon : semaine entière en footings lents, alors que c'est la période où
    // l'allure spécifique se construit. On garde donc UNE séance, mais RACCOURCIE et
    // annoncée comme telle : une qualité allégée n'est pas une qualité normale.
    const rescued = ctx.weekPlan.floored;
    put(idx, {
      type: q.type, title: rescued ? `${title} (allégée)` : title,
      detail: `Échauffement ${warmQ} min progressif FC Z1→Z2 + 3 à 5 lignes droites de 80 m → Corps : ${heatAdjustDesc(q.desc, idx)} → Retour au calme ${cool} min FC Z1.${ctx.cycle.taper ? " ⚠️ Affûtage : garde l'intensité mais coupe le nombre de répétitions d'un tiers." : ""}${rescued ? " ⚠️ Version allégée : coupe le nombre de répétitions d'un tiers et garde l'allure. On préserve le stimulus, pas le volume." : ""}`,
      why: rescued
        ? `Ta charge récente est très au-dessus de ta charge de fond${crossNote} — mais ton échéance approche et une semaine sans la moindre allure spécifique se paie le jour J. Donc : UNE séance, raccourcie, plutôt que zéro. Si les sensations ne viennent pas à l'échauffement, transforme-la en footing sans culpabiliser.`
        : "La séance de qualité de ton bloc, calée sur ta VMA et ton objectif. C'est elle qui te fait progresser.",
      tags: [q.type, "Qualité", ...(rescued ? ["Allégée"] : [])],
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
    type: "Endurance", title: "Footing en endurance",
    detail: `Échauffement ${warm} min progressif FC Z1→Z2 → Corps : ${kmAndTime(easyKm, paceFor(i))} en Z2${paceFor(i) ? ` (~${paceFor(i)}/km)` : ""}, tu dois pouvoir tenir une conversation → Retour au calme ${cool} min FC Z1.${gapNote}${doubles ? " 💡 À ton volume, scinde en DEUX sorties dans la journée (matin + soir) plutôt qu'un seul footing interminable." : ""}${cycleNote}`,
    why: ctx.tooMuchIntensity
      ? `⚠️ Tu passes ${ctx.tooMuchIntensity} % de ton temps de course en zone 3 et plus, alors que la cible est 20 %. Tes footings sont courus trop vite — c'est le frein n°1 à la progression. Ralentis jusqu'à pouvoir tenir une conversation complète : c'est censé paraître TROP facile.`
      : `Le socle aérobie. Avec les autres séances, tu es sur ~${targetKm} km cette semaine — c'est le volume facile qui construit la forme de fond, pas les séances dures.`,
    tags: ["Endurance", "Z2", `${easyKm} km`],
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
    type: "Renfo", title: "Renforcement musculaire",
    // Le renforcement était un texte UNIQUE, identique toute l'année. C'est pourtant le
    // premier facteur de prévention des blessures, et il obéit aux mêmes lois que la
    // course : il se périodise et il surcharge. Trois erreurs corrigées ici —
    // aucune progression, aucune spécificité de phase, et de la force lourde maintenue
    // pendant l'affûtage (où elle coûte de la fraîcheur sans plus rien apporter).
    detail: (() => {
      const phase = ctx.cycle.taper ? "affûtage" : ctx.macroPlan[0]?.phase ?? "Développement";
      const sets = blockWeekRenfo === 3 ? 2 : 3 + Math.min(1, blockWeekRenfo);
      if (phase === "affûtage" || ctx.cycle.taper) {
        return `20 à 25 min, ENTRETIEN seulement : gainage 3×45 s, montées de mollets 2×15, proprioception 2×30 s par jambe, quelques bondissements courts. AUCUNE charge lourde ni série longue à l'approche de la course — on préserve la fraîcheur, la force est déjà acquise.`;
      }
      if (phase === "Base") {
        return `35 à 45 min, FONDATIONS : gainage complet (planche, latéral, dos) ${sets}×45 s, squats ${sets}×12, fentes ${sets}×10 par jambe, montées de mollets ${sets}×15, ischios nordic curls ${sets}×6, proprioception sur une jambe ${sets}×30 s. Amplitude et contrôle avant tout — c'est la phase où l'on construit le tendon.`;
      }
      if (phase === "Spécifique") {
        return `30 à 35 min, FORCE UTILE À LA COURSE : squats bulgares ${sets}×8 par jambe, fentes sautées ${sets}×8, montées de mollets sur une jambe ${sets}×12, nordic curls ${sets}×6, gainage dynamique ${sets}×40 s, bondissements ${sets}×10. Explosif et court : on transfère la force vers la foulée, on ne cherche plus le volume.`;
      }
      return `30 à 40 min, DÉVELOPPEMENT : gainage (planche, latéral) ${sets}×45 s, squats ${sets}×12, fentes ${sets}×10 par jambe, montées de mollets ${sets}×15, ischios nordic curls ${sets}×6, proprioception sur une jambe ${sets}×30 s. ${sets > 3 ? "Série supplémentaire par rapport à la semaine dernière — la surcharge vaut aussi pour le renfo." : "Charge maintenue cette semaine (assimilation)."}`;
    })(),
    why: "La prévention de blessure n°1, et un gain direct d'économie de foulée. Elle se périodise comme la course : fondations, puis force utile, puis simple entretien à l'approche du jour J.",
    tags: ["Renfo", "Prévention"],
  });

  // ── 7. Tout ce qui reste = repos.
  for (let i = 0; i <= 6; i++) put(i, {
    type: "Repos", title: "Repos", tags: ["Repos"],
    detail: "Repos. C'est le moment où le corps transforme le travail en progrès.",
    why: "Ton plan tient compte du nombre de séances que tu peux réellement assurer.",
  });

  const week = slot as PlanDay[];

  // ── 7. Le jour J est arbitré par la FRAÎCHEUR RÉELLE, pas par le squelette.
  const lvl = ctx.readiness.level;
  const isHardToday = /VMA|Seuil|Spécifique|Sortie longue/i.test(week[0].type);
  const hardToday = ctx.lastHardDaysAgo === 0;   // une séance dure a DÉJÀ eu lieu aujourd'hui

  if ((lvl === "rouge" || hardToday) && week[0].type !== "Repos") {
    week[0] = { ...week[0], type: "Récup", title: "Récupération",
      detail: `Échauffement ${warm} min très doux FC Z1 → Corps : 25 min en Z1 très facile, piloté à la FRÉQUENCE CARDIAQUE (aucune allure à tenir) → Retour au calme ${cool} min FC Z1. Ou repos complet si tu le sens mieux.`,
      why: hardToday
        ? "Tu as déjà fait une séance exigeante aujourd'hui : on ne double pas. La progression se joue à la récupération."
        : `Aujourd'hui ton corps demande de la récupération : ${ctx.readiness.reasons.slice(0, 2).join(", ")}. Reporter une séance dure de 24 h ne coûte rien ; la forcer coûte des semaines.`,
      tags: ["Récup", "Z1"] };
  } else if (lvl === "orange" && isHardToday) {
    // Le suffixe n'est ajouté QUE s'il n'y est pas déjà : la séance sauvée par le plancher
    // « préparation en cours » est posée alléguée dès l'étape 4, et le verdict orange du
    // jour la ré-annotait — « Séance au seuil (allégée) (allégée) » sur le calendrier
    // ET sur la montre.
    const dejaAllegee = / \(allégée\)$/.test(week[0].title);
    week[0] = { ...week[0], title: dejaAllegee ? week[0].title : `${week[0].title} (allégée)`,
      detail: `${week[0].detail}\n\n⚠️ Version ALLÉGÉE aujourd'hui : réduis le corps de séance d'environ un tiers.`,
      why: `Séance maintenue mais raccourcie : ${ctx.readiness.reasons.slice(0, 2).join(", ")}.` };
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
      week[i] = {
        ...j, moment: "soir",
        title: `${j.title} (soir)`,
        detail: j.detail.replace(/(\d+(?:[.,]\d+)?)\s*km/, `${part.soirKm} km`),
        why: `${j.why} Journée doublée : la sortie principale reste le soir.`,
        tags: [...j.tags.slice(0, 3), "Soir"],
      };
      doubles.push({
        date: j.date, type: "Endurance", moment: "matin",
        title: "Footing du matin",
        detail: seanceMatinFacile(part.matinKm, ctx.easyPace),
        why: "Deuxième sortie de la journée : le même volume qu'en une fois, mieux absorbé. C'est du volume gratuit sur le plan de la fatigue, à condition de le courir vraiment lentement.",
        tags: ["Endurance", "Z1", "Matin"],
        confirmed: j.confirmed,
      });
      restants--;
    }
    // Le matin AVANT le soir : les écrans trient par date, et deux séances de même
    // date doivent s'afficher dans l'ordre où elles se courent.
    if (doubles.length) {
      return [...week, ...doubles].sort((a, b) =>
        a.date.localeCompare(b.date) || (a.moment === "matin" ? -1 : b.moment === "matin" ? 1 : 0));
    }
  }

  return week;
}
