// ─────────────────────────────────────────────────────────────────────────────
//  LE QUESTIONNAIRE D'APTITUDE À L'EFFORT (Santé, lot 3, 10/11/2026).
//
//  Sept situations qui doivent faire voir un médecin AVANT de s'entraîner (inspiré des
//  questionnaires de pré-participation type PAR-Q et des « 10 règles d'or » du Club des
//  cardiologues du sport ; formulation propre à Pacevo). Pacevo ne conclut rien : il oriente.
//
//  Décisions de Cyprien (10/11/2026) : si le coureur coche au moins une situation, le plan ne
//  contient AUCUNE séance d'endurance (course, vélo, natation) tant qu'il n'a pas indiqué avoir
//  vu un médecin qui l'autorise à courir — repos, renfo doux sans saut, pas de test VMA
//  (lib/coach/consignesPlan `appliquerAptitude`, autoCoach). L'application n'est pas bloquée.
//  Le questionnaire se repose chaque année. Une ligne `aptitude` par coureur (`notifications`).
//  Une ligne illisible vaut « absent » : Santé redemande le questionnaire (pas de valeur inventée).
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export const TYPE_APTITUDE = "aptitude";
/** Le questionnaire se repose chaque année (décision de Cyprien, comme QS-SPORT : « ces 12 derniers mois »). */
export const JOURS_RENOUVELLEMENT = 365;
// Ajoutées le 10/11/2026 (directeur scientifique) : mort subite d'un proche avant 50 ans (seuil du
// dépistage en 14 points de l'American Heart Association), maladie cardiaque, hypertension ou
// traitement pour le cœur ou la tension (PAR-Q+ ; Cyprien a écarté « tout traitement au long
// cours », qui aurait coupé la course pour une pilule ou une thyroïde). Une ligne ancienne reste valide.
export const QUESTIONS_APTITUDE = ["poitrine", "malaise", "essoufflement", "palpitations", "avisContraire", "familleMortSubite", "maladieConnue"] as const;
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

/** L'avis d'un médecin est-il attendu (donc : aucune course) ? Oui si une situation est cochée et qu'aucun avis n'est venu. */
export function avisAttendu(a: Aptitude | null): boolean {
  return !!a && a.oui.length > 0 && !a.avisMedecin;
}

/** Les textes du plan (bandeau, séances), 5 langues. */
export const APTITUDE_T: Record<Lang, { motif: string }> = {
  fr: { motif: "questionnaire d'aptitude : avis d'un médecin attendu, pas de course" },
  en: { motif: "fitness questionnaire: waiting for a doctor's opinion, no running" },
  de: { motif: "Fitness-Fragebogen: ärztliche Einschätzung ausstehend, kein Laufen" },
  es: { motif: "cuestionario de aptitud: a la espera de la opinión de un médico, sin correr" },
  pt: { motif: "questionário de aptidão: à espera da opinião de um médico, sem corrida" },
};

/** À reposer : la dernière réponse date d'un an ou plus (l'attente d'avis, elle, ne se périme pas). */
export function aRenouveler(a: Aptitude | null, jour: string): boolean {
  if (!a) return false;
  const ecart = (new Date(`${jour}T12:00:00Z`).getTime() - new Date(`${a.date}T12:00:00Z`).getTime()) / 864e5;
  return ecart >= JOURS_RENOUVELLEMENT;
}
