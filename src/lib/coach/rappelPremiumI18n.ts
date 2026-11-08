// ─────────────────────────────────────────────────────────────────────────────
//  « PREMIUM AURAIT CHANGÉ TON PLAN » — les 5 langues (voir `lib/coach/rappelPremium`).
//
//  Seules les TOURNURES vivent ici. Les motifs arrivent déjà traduits du moteur
//  (`readiness.reasonsAll`), les titres des séances du plan (`PlanDay.i18n`), et le nom
//  du jour de `formatDateCivile` : rien de ce qui porte un chiffre n'est réécrit ici.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

type Niveau = "vert" | "jaune" | "orange" | "rouge";

export type TextesRappel = {
  /** La séance du jour nommé devient plus légère : une qualité retirée, une course qui devient repos. */
  allege: (jour: string) => string;
  /** L'inverse : Premium aurait gardé (ou placé) plus d'intensité ce jour-là. */
  intensifie: (jour: string) => string;
  /** Même charge, séance différente : version allégée, autre qualité, autre renforcement. */
  ajuste: (jour: string) => string;
  /** Aucune séance ne change, le verdict du jour si. */
  verdict: (premium: string, starter: string) => string;
  niveaux: Record<Niveau, string>;
  /** Le constat, puis ce que Premium a lu en plus — rien après le constat s'il n'y a pas de motif. */
  phrase: (constat: string, motifs: string) => string;
  auLieuDe: (premium: string, starter: string) => string;
  /** Même séance, autre distance — les nombres arrivent déjà écrits dans la langue. */
  kmAuLieuDe: (titre: string, premium: string, starter: string) => string;
  autresJours: (n: number) => string;
};

export const TEXTES_RAPPEL: Record<Lang, TextesRappel> = {
  fr: {
    allege: (j) => `Premium aurait allégé ta séance de ${j}`,
    intensifie: (j) => `Premium aurait rendu ta séance de ${j} plus soutenue`,
    ajuste: (j) => `Premium aurait ajusté ta séance de ${j}`,
    verdict: (p, s) => `Avec Premium, ton verdict du jour serait ${p} au lieu de ${s}`,
    niveaux: { vert: "vert", jaune: "jaune", orange: "orange", rouge: "rouge" },
    phrase: (c, m) => (m ? `${c} : ${m}.` : `${c}.`),
    auLieuDe: (p, s) => `« ${p} » au lieu de « ${s} »`,
    kmAuLieuDe: (t, p, s) => `« ${t} » : ~${p} km au lieu de ~${s} km`,
    autresJours: (n) => (n > 1 ? `${n} autres jours changent aussi` : "un autre jour change aussi"),
  },
  en: {
    allege: (j) => `Premium would have eased your ${j} session`,
    intensifie: (j) => `Premium would have made your ${j} session harder`,
    ajuste: (j) => `Premium would have adjusted your ${j} session`,
    verdict: (p, s) => `With Premium, today's verdict would be ${p} instead of ${s}`,
    niveaux: { vert: "green", jaune: "yellow", orange: "orange", rouge: "red" },
    phrase: (c, m) => (m ? `${c}: ${m}.` : `${c}.`),
    auLieuDe: (p, s) => `“${p}” instead of “${s}”`,
    kmAuLieuDe: (t, p, s) => `“${t}”: ~${p} km instead of ~${s} km`,
    autresJours: (n) => (n > 1 ? `${n} other days change too` : "one other day changes too"),
  },
  de: {
    allege: (j) => `Premium hätte deine Einheit am ${j} erleichtert`,
    intensifie: (j) => `Premium hätte deine Einheit am ${j} fordernder gestaltet`,
    ajuste: (j) => `Premium hätte deine Einheit am ${j} angepasst`,
    verdict: (p, s) => `Mit Premium wäre deine Tagesbewertung ${p} statt ${s}`,
    niveaux: { vert: "grün", jaune: "gelb", orange: "orange", rouge: "rot" },
    phrase: (c, m) => (m ? `${c}: ${m}.` : `${c}.`),
    auLieuDe: (p, s) => `„${p}“ statt „${s}“`,
    kmAuLieuDe: (t, p, s) => `„${t}“: ~${p} km statt ~${s} km`,
    autresJours: (n) => (n > 1 ? `${n} weitere Tage ändern sich auch` : "ein weiterer Tag ändert sich auch"),
  },
  es: {
    allege: (j) => `Premium habría aligerado tu sesión del ${j}`,
    intensifie: (j) => `Premium habría hecho más exigente tu sesión del ${j}`,
    ajuste: (j) => `Premium habría ajustado tu sesión del ${j}`,
    verdict: (p, s) => `Con Premium, tu veredicto del día sería ${p} en lugar de ${s}`,
    niveaux: { vert: "verde", jaune: "amarillo", orange: "naranja", rouge: "rojo" },
    phrase: (c, m) => (m ? `${c}: ${m}.` : `${c}.`),
    auLieuDe: (p, s) => `«${p}» en lugar de «${s}»`,
    kmAuLieuDe: (t, p, s) => `«${t}»: ~${p} km en lugar de ~${s} km`,
    autresJours: (n) => (n > 1 ? `otros ${n} días cambian también` : "otro día cambia también"),
  },
  pt: {
    allege: (j) => `O Premium teria aliviado a tua sessão de ${j}`,
    intensifie: (j) => `O Premium teria tornado mais exigente a tua sessão de ${j}`,
    ajuste: (j) => `O Premium teria ajustado a tua sessão de ${j}`,
    verdict: (p, s) => `Com o Premium, o teu veredicto do dia seria ${p} em vez de ${s}`,
    niveaux: { vert: "verde", jaune: "amarelo", orange: "laranja", rouge: "vermelho" },
    phrase: (c, m) => (m ? `${c}: ${m}.` : `${c}.`),
    auLieuDe: (p, s) => `«${p}» em vez de «${s}»`,
    kmAuLieuDe: (t, p, s) => `«${t}»: ~${p} km em vez de ~${s} km`,
    autresJours: (n) => (n > 1 ? `mais ${n} dias mudam também` : "mais um dia muda também"),
  },
};
