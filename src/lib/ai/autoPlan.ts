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

export type PlanDay = {
  date: string;          // AAAA-MM-JJ
  type: string;          // Repos | Récup | Endurance | Sortie longue | VMA | Seuil | Spécifique | Renfo | Vélo
  title: string;
  detail: string;
  why: string;
  tags: string[];
  /** false = jour prévisionnel, susceptible d'être réajusté par le cron des jours suivants. */
  confirmed: boolean;
};

/** Nombre de jours confirmés (verrouillés) en tête de plan. Au-delà : prévisionnel. */
export const CONFIRMED_DAYS = 3;

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
  const pace = ctx.easyPace;
  const easy = pace ? ` (~${pace}/km)` : "";
  const wp = ctx.weekPlan;
  const { targetKm, longRunKm } = ctx.volume;
  const cycleNote = ctx.cycle.taper ? " ⚠️ Semaine d'AFFÛTAGE : on réduit le volume, pas l'intensité."
    : ctx.cycle.deload ? " ⚠️ Semaine ALLÉGÉE : c'est maintenant que le corps assimile le travail des 3 semaines précédentes." : "";

  const slot: (PlanDay | null)[] = Array(7).fill(null);
  const put = (i: number, d: Omit<PlanDay, "date" | "confirmed">) => {
    if (i < 0 || i > 6 || slot[i]) return false;
    slot[i] = { ...d, date: iso(dates[i]), confirmed: i < CONFIRMED_DAYS };
    return true;
  };

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

  // ── 2. Sortie longue : dimanche de préférence, sinon samedi, sinon le dernier jour libre.
  const weekend = dates.map((d, i) => ({ i, day: d.getDay() })).filter((x) => (x.day === 0 || x.day === 6) && !slot[x.i]);
  const longIdx = weekend.find((x) => x.day === 0)?.i ?? weekend[0]?.i ?? [6, 5, 4].find((i) => !slot[i]) ?? 6;
  const bike = ctx.longRunMode === "bike";
  put(longIdx, bike
    ? { type: "Vélo", title: "Sortie longue à vélo",
        detail: `Échauffement 15 min très facile → ${durationFor(longRunKm, pace) ?? "1h30"} à 2h en FC Z2, allure conversationnelle, cadence souple → 10 min de retour au calme. Pas d'allure cible : c'est du volume aérobie sans impact.${cycleNote}`,
        why: "Le volume aérobie de la semaine, sans les contraintes d'impact de la course.", tags: ["Vélo", "Z2", "Long"] }
    : { type: "Sortie longue", title: "Sortie longue",
        detail: `Échauffement 15 min progressif FC Z1→Z2 → Corps : ${kmAndTime(longRunKm, pace)} en Z2${easy}, allure conversationnelle du début à la fin → Retour au calme 10 min FC Z1.${cycleNote}`,
        why: `C'est la séance qui construit ton endurance de fond — ${longRunKm} km, calés sur ton volume actuel. Elle doit rester facile : si tu finis cassé, elle était trop rapide.`,
        tags: ["Long", "Z2", `${longRunKm} km`] });

  // ── 3. Repos complet le lendemain de la sortie longue.
  const restIdx = [longIdx + 1, longIdx - 1].find((i) => i >= 0 && i <= 6 && !slot[i]);
  if (restIdx != null) put(restIdx, {
    type: "Repos", title: "Repos complet",
    detail: "Repos complet. Marche, étirements doux ou mobilité si tu en ressens le besoin, rien de plus.",
    why: "C'est pendant le repos que l'adaptation se fait, pas pendant l'effort.", tags: ["Repos"],
  });

  // ── 4. Séances de qualité, espacées — Y COMPRIS PAR RAPPORT AU PASSÉ.
  // La dernière séance dure DÉJÀ EFFECTUÉE est traitée comme un jour dur d'index négatif :
  // si elle date d'hier, elle occupe l'index −1 et repousse d'autant la première qualité.
  const placed: number[] = ctx.lastHardDaysAgo != null ? [-ctx.lastHardDaysAgo] : [];
  const isFree = (i: number) => i >= 0 && i <= 6 && !slot[i];
  const okSpacing = (i: number) => placed.every((p) => Math.abs(p - i) >= gapDays) && Math.abs(i - longIdx) >= 2;
  // Le VOLUME plafonne aussi le nombre de qualités : une séance de qualité complète
  // (20 min d'échauffement + corps + 10 min de retour au calme) pèse ~11 km. En dessous
  // de 35 km/semaine, deux séances de ce type ne rentrent tout simplement pas à côté de
  // la sortie longue — le budget théorique doit céder devant l'arithmétique.
  const QUALITY_KM = 11;
  const maxByVolume = Math.max(1, Math.floor((targetKm - longRunKm) / QUALITY_KM));
  const quality = wp.quality.slice(0, Math.min(wp.quality.length, maxByVolume));
  for (const q of quality) {
    let idx = -1;
    for (let i = 0; i <= 6; i++) if (isFree(i) && okSpacing(i)) { idx = i; break; }
    if (idx < 0) break; // impossible sans violer la récupération → on n'insiste pas
    const title = q.type === "VMA" ? "Séance VMA" : q.type === "Seuil" ? "Séance au seuil" : q.type === "Spécifique" ? "Allure spécifique objectif" : q.type;
    put(idx, {
      type: q.type, title,
      detail: `Échauffement 20 min progressif FC Z1→Z2 + 3 à 5 lignes droites de 80 m → Corps : ${q.desc} → Retour au calme 10 min FC Z1.${ctx.cycle.taper ? " ⚠️ Affûtage : garde l'intensité mais coupe le nombre de répétitions d'un tiers." : ""}`,
      why: "La séance de qualité de ton bloc, calée sur ta VMA et ton objectif. C'est elle qui te fait progresser.",
      tags: [q.type, "Qualité"],
    });
    placed.push(idx);
  }

  // ── 5. Renforcement : jamais la VEILLE d'un jour dur.
  // Principe « hard day hard, easy day easy » : le renfo fatigue les jambes, le poser
  // devant une VMA ou une sortie longue sabote la séance du lendemain.
  const hardIdx = new Set<number>([...placed.filter((i) => i >= 0), longIdx]);
  let renfoIdx = -1;
  for (let i = 1; i <= 6; i++) if (isFree(i) && !hardIdx.has(i + 1)) { renfoIdx = i; break; }
  if (renfoIdx < 0) for (let i = 1; i <= 6; i++) if (isFree(i)) { renfoIdx = i; break; }
  if (renfoIdx >= 0) put(renfoIdx, {
    type: "Renfo", title: "Renforcement musculaire",
    detail: "30 à 40 min : gainage (planche, gainage latéral), squats, fentes, montées de mollets, ischios (nordic curls), proprioception sur une jambe. 3 séries de chaque, sans matériel.",
    why: "La prévention de blessure n°1, et un gain direct d'économie de foulée. Non négociable sur le long terme.",
    tags: ["Renfo", "Prévention"],
  });

  // ── 6. Le reste en endurance, DIMENSIONNÉE sur le volume qui reste à couvrir.
  // On retire du volume cible ce qui est déjà attribué (sortie longue + ~9 km par
  // séance de qualité, échauffement et retour au calme compris) et on répartit.
  const easySlots = Array.from({ length: 7 }, (_, i) => i).filter((i) => !slot[i]);
  const usedKm = longRunKm + placed.filter((i) => i >= 0).length * QUALITY_KM;
  const rawEasy = easySlots.length > 0 ? (targetKm - usedKm) / easySlots.length : 0;
  // Bornes de réalisme : en dessous de 4 km ce n'est plus une séance, au-dessus de 18 km
  // ce n'est plus un footing. Un gros volume se couvre en DOUBLANT les séances, pas en
  // allongeant indéfiniment les footings — on le dit à l'athlète au lieu de l'ignorer.
  const easyKm = Math.min(18, Math.max(4, Math.round(rawEasy)));
  const doubles = rawEasy > 18;
  for (const i of easySlots) put(i, {
    type: "Endurance", title: "Footing en endurance",
    detail: `Échauffement 15 min progressif FC Z1→Z2 → Corps : ${kmAndTime(easyKm, pace)} en Z2${easy}, tu dois pouvoir tenir une conversation → Retour au calme 10 min FC Z1.${doubles ? " 💡 À ton volume, scinde en DEUX sorties dans la journée (matin + soir) plutôt qu'un seul footing interminable." : ""}${cycleNote}`,
    why: `Le socle aérobie. Avec les autres séances, tu es sur ~${targetKm} km cette semaine — c'est le volume facile qui construit la forme de fond, pas les séances dures.`,
    tags: ["Endurance", "Z2", `${easyKm} km`],
  });

  const week = slot as PlanDay[];

  // ── 7. Le jour J est arbitré par la FRAÎCHEUR RÉELLE, pas par le squelette.
  const lvl = ctx.readiness.level;
  const isHardToday = /VMA|Seuil|Spécifique|Sortie longue/i.test(week[0].type);
  const hardToday = ctx.lastHardDaysAgo === 0;   // une séance dure a DÉJÀ eu lieu aujourd'hui

  if ((lvl === "rouge" || hardToday) && week[0].type !== "Repos") {
    week[0] = { ...week[0], type: "Récup", title: "Récupération",
      detail: "Échauffement 10 min très doux FC Z1 → 20 à 25 min en Z1 très facile → 5 min de retour au calme. Ou repos complet si tu le sens mieux.",
      why: hardToday
        ? "Tu as déjà fait une séance exigeante aujourd'hui : on ne double pas. La progression se joue à la récupération."
        : `Aujourd'hui ton corps demande de la récupération : ${ctx.readiness.reasons.slice(0, 2).join(", ")}. Reporter une séance dure de 24 h ne coûte rien ; la forcer coûte des semaines.`,
      tags: ["Récup", "Z1"] };
  } else if (lvl === "orange" && isHardToday) {
    week[0] = { ...week[0], title: `${week[0].title} (allégée)`,
      detail: `${week[0].detail}\n\n⚠️ Version ALLÉGÉE aujourd'hui : réduis le corps de séance d'environ un tiers.`,
      why: `Séance maintenue mais raccourcie : ${ctx.readiness.reasons.slice(0, 2).join(", ")}.` };
  }

  return week;
}
