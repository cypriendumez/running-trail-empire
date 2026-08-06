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
//  qualité (plafonné par le passif, la santé, la fraîcheur), objectif, périodisation.
//  Ce module se contente de POSER ces séances dans la semaine sans violer les règles
//  de récupération.
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

/**
 * Pose 7 jours d'entraînement à partir du contexte de l'athlète.
 *
 * Ordre de placement (du plus contraint au plus souple) :
 *   1. la sortie longue sur le week-end (c'est elle qui structure la semaine) ;
 *   2. le repos complet le lendemain de la sortie longue ;
 *   3. les séances de qualité, espacées d'au moins `hardGapHours` et jamais collées
 *      à la sortie longue ;
 *   4. le renforcement sur un jour facile ;
 *   5. tout le reste en endurance.
 *
 * Le jour J est ensuite écrasé par le verdict de fraîcheur : feu rouge = pas
 * d'intensité, quoi qu'il ait été planifié.
 */
export function buildWeekPlan(ctx: AthleteContext, today = new Date()): PlanDay[] {
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const gapDays = Math.max(2, Math.ceil(ctx.hardGapHours / 24));
  const easy = ctx.easyPace ? ` (~${ctx.easyPace}/km)` : "";
  const wp = ctx.weekPlan;

  // Emplacements, indexés sur les 7 jours. `null` = encore libre.
  const slot: (PlanDay | null)[] = Array(7).fill(null);
  const put = (i: number, d: Omit<PlanDay, "date" | "confirmed">) => {
    if (i < 0 || i > 6 || slot[i]) return false;
    slot[i] = { ...d, date: iso(dates[i]), confirmed: i < CONFIRMED_DAYS };
    return true;
  };

  // ── 1. Sortie longue : dimanche de préférence, sinon samedi, sinon le dernier jour.
  const weekend = dates.map((d, i) => ({ i, day: d.getDay() })).filter((x) => x.day === 0 || x.day === 6);
  const longIdx = weekend.find((x) => x.day === 0)?.i ?? weekend[0]?.i ?? 6;
  const bike = ctx.longRunMode === "bike";
  put(longIdx, bike
    ? { type: "Vélo", title: "Sortie longue à vélo",
        detail: "Échauffement 15 min très facile → 1h30 à 2h en FC Z2, allure conversationnelle, cadence souple → 10 min de retour au calme. Pas d'allure cible : c'est un volume aérobie sans impact.",
        why: "Le volume aérobie de la semaine, sans les contraintes d'impact de la course.", tags: ["Vélo", "Z2", "Long"] }
    : { type: "Sortie longue", title: "Sortie longue",
        detail: `Échauffement 15 min progressif FC Z1→Z2 → Corps : 1h à 1h30 en Z2${easy}, allure conversationnelle du début à la fin → Retour au calme 10 min FC Z1.`,
        why: "C'est la séance qui construit ton endurance de fond. Elle doit rester facile : si tu finis cassé, elle était trop rapide.", tags: ["Long", "Z2"] });

  // ── 2. Repos complet le lendemain de la sortie longue.
  put(longIdx + 1 <= 6 ? longIdx + 1 : longIdx - 1, {
    type: "Repos", title: "Repos complet",
    detail: "Repos complet. Marche, étirements doux ou mobilité si tu en ressens le besoin, rien de plus.",
    why: "C'est pendant le repos que l'adaptation se fait, pas pendant l'effort.", tags: ["Repos"],
  });

  // ── 3. Séances de qualité, espacées et à distance de la sortie longue.
  const isFree = (i: number) => i >= 0 && i <= 6 && !slot[i];
  const placed: number[] = [];
  const okSpacing = (i: number) =>
    placed.every((p) => Math.abs(p - i) >= gapDays) && Math.abs(i - longIdx) >= 2;
  for (const q of wp.quality) {
    // On cherche d'abord un créneau qui respecte l'espacement, en partant de J+1
    // (J+0 est réservé à la fraîcheur du jour, traitée plus bas).
    let idx = -1;
    for (let i = 1; i <= 6; i++) if (isFree(i) && okSpacing(i)) { idx = i; break; }
    if (idx < 0) break; // impossible de caser cette qualité sans violer la récupération → on n'insiste pas
    const title = q.type === "VMA" ? "Séance VMA" : q.type === "Seuil" ? "Séance au seuil" : q.type === "Spécifique" ? "Allure spécifique objectif" : q.type;
    put(idx, {
      type: q.type, title,
      detail: `Échauffement 20 min progressif FC Z1→Z2 + 3 à 5 lignes droites de 80 m → Corps : ${q.desc} → Retour au calme 10 min FC Z1.`,
      why: "La séance de qualité de ton bloc, calée sur ta VMA et ton objectif. C'est elle qui te fait progresser.",
      tags: [q.type, "Qualité"],
    });
    placed.push(idx);
  }

  // ── 4. Renforcement : jamais la VEILLE d'un jour dur.
  // Principe « hard day hard, easy day easy » : le renfo fatigue les jambes, le poser
  // devant une VMA ou une sortie longue sabote la séance du lendemain. On refuse donc
  // tout créneau suivi d'un jour dur, quitte à le placer en fin de fenêtre.
  const hardIdx = new Set<number>([...placed, longIdx]);
  let renfoIdx = -1;
  for (let i = 1; i <= 6; i++) if (isFree(i) && !hardIdx.has(i + 1)) { renfoIdx = i; break; }
  if (renfoIdx < 0) for (let i = 1; i <= 6; i++) if (isFree(i)) { renfoIdx = i; break; }
  put(renfoIdx, {
    type: "Renfo", title: "Renforcement musculaire",
    detail: "30 à 40 min : gainage (planche, gainage latéral), squats, fentes, montées de mollets, ischios (nordic curls), proprioception sur une jambe. 3 séries de chaque, sans matériel.",
    why: "La prévention de blessure n°1, et un gain direct d'économie de foulée. Non négociable sur le long terme.",
    tags: ["Renfo", "Prévention"],
  });

  // ── 5. Le reste en endurance facile.
  for (let i = 0; i <= 6; i++) put(i, {
    type: "Endurance", title: "Footing en endurance",
    detail: `Échauffement 15 min progressif FC Z1→Z2 → Corps : 40 à 50 min en Z2${easy}, tu dois pouvoir tenir une conversation → Retour au calme 10 min FC Z1.`,
    why: "Le socle aérobie : c'est le volume facile qui construit la forme de fond, pas les séances dures.",
    tags: ["Endurance", "Z2"],
  });

  const week = slot as PlanDay[];

  // ── 6. Le jour J est arbitré par la FRAÎCHEUR RÉELLE, pas par le squelette.
  // Feu rouge : aucune intensité aujourd'hui, quelle que soit la séance prévue.
  const lvl = ctx.readiness.level;
  const isHard = /VMA|Seuil|Spécifique|Sortie longue/i.test(week[0].type);
  if (lvl === "rouge" && week[0].type !== "Repos") {
    week[0] = { ...week[0], type: "Récup", title: "Récupération",
      detail: `Échauffement 10 min très doux FC Z1 → 20 à 25 min en Z1 très facile → 5 min de retour au calme. Ou repos complet si tu le sens mieux.`,
      why: `Aujourd'hui ton corps demande de la récupération : ${ctx.readiness.reasons.slice(0, 2).join(", ")}. Reporter une séance dure de 24 h ne coûte rien ; la forcer coûte des semaines.`,
      tags: ["Récup", "Z1"] };
  } else if (lvl === "orange" && isHard) {
    week[0] = { ...week[0], title: `${week[0].title} (allégée)`,
      detail: `${week[0].detail}\n\n⚠️ Version ALLÉGÉE aujourd'hui : réduis le corps de séance d'environ un tiers.`,
      why: `Séance maintenue mais raccourcie : ${ctx.readiness.reasons.slice(0, 2).join(", ")}.` };
  }

  return week;
}
