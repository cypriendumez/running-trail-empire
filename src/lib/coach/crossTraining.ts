// ─────────────────────────────────────────────────────────────────────────────
//  CROSS-TRAINING — ce que l'athlète a fait EN DEHORS de la course.
//
//  Le coach n'en voyait qu'un chiffre : des kilomètres. « + 47 km d'autres sports ».
//  Trois défauts dans cette seule ligne :
//
//    1. Les kilomètres d'un vélo, d'une randonnée et d'une natation s'additionnaient
//       comme s'ils étaient comparables. 40 km de vélo et 2 km de bassin ne racontent
//       pas la même chose, et leur somme ne raconte rien.
//    2. Une séance SANS distance — home-trainer, rameur, renfo, yoga — valait zéro.
//       Elle était donc invisible dans le texte envoyé à l'IA, alors qu'elle pesait
//       bel et bien dans la charge. Le coach pouvait commenter une fatigue dont il ne
//       voyait pas la cause.
//    3. Le seuil d'affichage était de 3 km : une heure de rameur ne franchissait
//       jamais un seuil exprimé dans une unité qui ne la concerne pas.
//
//  On compte donc en MINUTES et en TSS — les deux seules unités communes à tous les
//  sports — et on nomme l'impact subi par les jambes, parce que c'est ce qui distingue
//  une fatigue qui s'ajoute à celle de la course d'une fatigue qui s'y substitue.
// ─────────────────────────────────────────────────────────────────────────────

import { asSport, impactOf, isRun, SPORT_LABEL, type Impact, type Sport } from "@/lib/intervals/sport";
import { SPORT_LABEL_T, DUREE_INCONNUE } from "@/lib/intervals/sportI18n";
import { estimateTSS } from "@/lib/running/fitness";
import { tr, LOCALE, type I18nText } from "@/lib/i18n/multi";
import type { Lang } from "@/lib/i18n/translations";

export type CrossWorkout = {
  date: string;
  sport?: string | null;
  type?: string | null;
  duration_seconds?: number | null;
  tss?: number | null;
  elevation_gain_m?: number | null;
};

export type CrossBySport = {
  sport: Sport;
  label: string;
  impact: Impact;
  minutes: number;
  tss: number;
  sessions: number;
  elevationM: number;
};

export type CrossSummary = {
  /** Minutes de sport hors course sur la fenêtre. 0 si la durée n'est pas renseignée —
   *  jamais déduite de la distance : une durée absente est une durée absente. */
  minutes: number;
  tss: number;
  sessions: number;
  /** Part de la charge TOTALE de la fenêtre venant d'un autre sport que la course (%). */
  sharePct: number;
  /** Minutes passées sur des sports qui chargent les jambes (rando, marche, ski, ballon) :
   *  celles-là s'additionnent à l'usure de la course, contrairement au vélo ou au bassin. */
  impactMinutes: number;
  bySport: CrossBySport[];
  /** Phrase prête à afficher, ou null s'il n'y a rien à dire. On ne remplit pas le
   *  contexte du coach avec « 0 min de cross-training ». */
  label: string | null;
  /** Le même résumé dans les 5 langues. `label` (français) reste la version canonique :
   *  c'est elle qui part dans le prompt du modèle. Celle-ci ne sert qu'à l'affichage —
   *  ce résumé se retrouve dans le « pourquoi » d'une séance, et une séance espagnole ne
   *  peut pas se terminer par « 3 × randonnée ». */
  labelAll: I18nText | null;
};

/** « 4 h 10 », « 45 min » — jamais « 250 min », qu'un humain doit convertir de tête. */
export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, "0")}`;
}

const EMPTY: CrossSummary = {
  minutes: 0, tss: 0, sessions: 0, sharePct: 0, impactMinutes: 0, bySport: [], label: null, labelAll: null,
};

/**
 * Résume le cross-training des `days` derniers jours.
 *
 * `sharePct` se calcule sur la charge, seule grandeur commune à la course et au reste.
 * Il répond à la question que l'athlète se pose vraiment quand le plan s'allège :
 * « cette fatigue, elle vient d'où ? »
 */
export function summarizeCross(
  workouts: CrossWorkout[],
  now: number = Date.now(),
  days = 7,
): CrossSummary {
  const inWindow = workouts.filter((w) => {
    const t = new Date(w.date).getTime();
    return Number.isFinite(t) && now - t <= days * 86400000 && now - t >= -86400000;
  });
  if (!inWindow.length) return EMPTY;

  const totalTss = inWindow.reduce((s, w) => s + estimateTSS(w), 0);
  const cross = inWindow.filter((w) => !isRun(w.sport));
  if (!cross.length) return { ...EMPTY, sharePct: 0 };

  const acc = new Map<Sport, CrossBySport>();
  for (const w of cross) {
    const sport = asSport(w.sport);
    const cur = acc.get(sport) ?? {
      sport, label: SPORT_LABEL[sport], impact: impactOf(sport),
      minutes: 0, tss: 0, sessions: 0, elevationM: 0,
    };
    cur.minutes += Math.round((w.duration_seconds ?? 0) / 60);
    cur.tss += estimateTSS(w);
    cur.sessions += 1;
    cur.elevationM += Math.round(w.elevation_gain_m ?? 0);
    acc.set(sport, cur);
  }

  const bySport = [...acc.values()].sort((a, b) => b.tss - a.tss || b.minutes - a.minutes);
  const minutes = bySport.reduce((s, x) => s + x.minutes, 0);
  const tss = bySport.reduce((s, x) => s + x.tss, 0);
  const sessions = bySport.reduce((s, x) => s + x.sessions, 0);
  const impactMinutes = bySport.filter((x) => x.impact !== "aucun").reduce((s, x) => s + x.minutes, 0);

  // « 3 sorties vélo (4 h 10, 294 TSS) · 2 randonnées (5 h, 148 TSS, D+ 1 400 m) »
  // Le rendu français est produit par le MÊME gabarit que les autres langues : il ne
  // peut donc pas diverger de ce qui est affiché à un athlète anglophone.
  const labelIn = (lang: Lang) => bySport.map((x) => {
    const dur = x.minutes > 0 ? fmtMinutes(x.minutes) : DUREE_INCONNUE[lang];
    const elev = x.elevationM >= 300 ? `, D+ ${x.elevationM.toLocaleString(LOCALE[lang])} m` : "";
    return `${x.sessions} × ${SPORT_LABEL_T[lang][x.sport]} (${dur}, ${Math.round(x.tss)} TSS${elev})`;
  }).join(" · ");

  return {
    minutes, tss: Math.round(tss), sessions,
    sharePct: totalTss > 0 ? Math.round((tss / totalTss) * 100) : 0,
    impactMinutes, bySport, label: labelIn("fr"), labelAll: tr(labelIn),
  };
}
