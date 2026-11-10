// ─────────────────────────────────────────────────────────────────────────────
//  LE QUESTIONNAIRE D'APTITUDE À L'EFFORT (Santé, lot 3, 10/11/2026).
//
//  Cinq situations qui doivent faire voir un médecin AVANT de s'entraîner fort (inspiré des
//  questionnaires de pré-participation type PAR-Q et des « 10 règles d'or » du Club des
//  cardiologues du sport ; formulation propre à Pacevo). Pacevo ne conclut rien : il oriente.
//
//  Décision de Cyprien (10/11/2026) : si le coureur coche au moins une situation, le plan ne
//  contient AUCUNE séance dure tant qu'il n'a pas indiqué avoir vu un médecin qui l'autorise
//  à reprendre l'intensité. L'application n'est pas bloquée : footings, renfo sans saut,
//  sorties longues faciles restent. Une ligne `aptitude` par coureur (`notifications`).
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export const TYPE_APTITUDE = "aptitude";
export const QUESTIONS_APTITUDE = ["poitrine", "malaise", "essoufflement", "palpitations", "avisContraire"] as const;
export type QuestionAptitude = (typeof QUESTIONS_APTITUDE)[number];

export type Aptitude = {
  /** Les situations cochées (vide = aucune). */
  oui: QuestionAptitude[];
  /** Jour de la réponse (AAAA-MM-JJ, fixé par le serveur ou l'inscription). */
  date: string;
  /** Jour où le coureur a indiqué avoir vu un médecin qui l'autorise ; `null` sinon. */
  avisMedecin: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Valide une réponse : la liste des situations cochées, rien d'autre. */
export function validerAptitude(brut: unknown, date: string): { ok: true; aptitude: Aptitude } | { ok: false } {
  const b = (brut ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.oui) || !DATE.test(date)) return { ok: false };
  const oui = [...new Set(b.oui)].filter((q): q is QuestionAptitude => (QUESTIONS_APTITUDE as readonly unknown[]).includes(q));
  if (oui.length !== b.oui.length) return { ok: false };
  return { ok: true, aptitude: { oui, date, avisMedecin: null } };
}

/** Une ligne lue en base, ou `null` si elle est absente ou illisible (jamais de valeur inventée). */
export function lireAptitude(data: unknown): Aptitude | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const v = validerAptitude(d, typeof d.date === "string" ? d.date : "");
  if (!v.ok) return null;
  const avis = typeof d.avisMedecin === "string" && DATE.test(d.avisMedecin) ? d.avisMedecin : null;
  return { ...v.aptitude, avisMedecin: avis };
}

/** Le plan doit-il rester sans intensité ? Oui si une situation est cochée et qu'aucun avis n'est venu. */
export function avisAttendu(a: Aptitude | null): boolean {
  return !!a && a.oui.length > 0 && !a.avisMedecin;
}

/** Les textes du plan (bandeau, séances), 5 langues. */
export const APTITUDE_T: Record<Lang, { motif: string }> = {
  fr: { motif: "questionnaire d'aptitude : avis d'un médecin attendu, pas d'intensité" },
  en: { motif: "fitness questionnaire: waiting for a doctor's opinion, no intensity" },
  de: { motif: "Fitness-Fragebogen: ärztliche Einschätzung ausstehend, keine Intensität" },
  es: { motif: "cuestionario de aptitud: a la espera de la opinión de un médico, sin intensidad" },
  pt: { motif: "questionário de aptidão: à espera da opinião de um médico, sem intensidade" },
};
