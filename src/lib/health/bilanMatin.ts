// ─────────────────────────────────────────────────────────────────────────────
//  LE BILAN DU MATIN — trois réponses de 1 à 5, lues par le coach le jour même.
//
//  Santé, lot 2 (Cyprien, 10/11/2026). Le coureur dit, en trois clics, comment il se sent ce
//  matin : fatigue générale, jambes (lourdeur, courbatures), stress de la vie hors course.
//  Échelle unique : 1 = très bien, 5 = très mal (questionnaires de bien-être des sports
//  collectifs, Hooper & Mackinnon 1995 ; McLean et al. 2010).
//
//  Décision de Cyprien (10/11/2026) : le plan ne s'allège que si c'est FRANC — fatigue ou
//  jambes à 4 ou 5 sur 5. Alors la séance dure du jour devient une récupération facile et le
//  feu affiche le motif. Le stress seul ne retire rien : il s'affiche. Jamais de feu rouge sur
//  le seul ressenti. Pacevo n'interprète rien d'autre : ce sont des indicateurs d'entraînement,
//  pas un examen de santé.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export const TYPE_BILAN = "bilan_matin";
/** À partir de cette note (sur 5), la fatigue ou les jambes allègent la séance dure du jour. */
export const SEUIL_FRANC = 4;
/** À partir de cette note, le stress s'affiche dans le bandeau du plan (sans rien retirer). */
export const SEUIL_STRESS = 4;

export type BilanMatin = { date: string; fatigue: number; jambes: number; stress: number };

const note = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

/** Valide ce qu'envoie le navigateur. La date est TOUJOURS celle du serveur, jamais la sienne. */
export function validerBilan(brut: unknown, date: string): { ok: true; bilan: BilanMatin } | { ok: false } {
  const b = (brut ?? {}) as Record<string, unknown>;
  const fatigue = note(b.fatigue), jambes = note(b.jambes), stress = note(b.stress);
  if (fatigue == null || jambes == null || stress == null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false };
  return { ok: true, bilan: { date, fatigue, jambes, stress } };
}

/** Une ligne lue en base, si elle est complète et valide ; sinon `null` (jamais de valeur inventée). */
export function lireBilan(data: unknown): BilanMatin | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const date = typeof d.date === "string" ? d.date : "";
  const v = validerBilan(d, date);
  return v.ok ? v.bilan : null;
}

/** Le bilan de CE jour parmi des lignes (la plus récente d'abord), ou `null`. */
export function bilanDuJour(lignes: readonly { data?: unknown }[], jour: string): BilanMatin | null {
  for (const l of lignes) { const b = lireBilan(l.data); if (b && b.date === jour) return b; }
  return null;
}

/** Ce que le bilan fait au plan du jour. */
export function effetBilan(b: BilanMatin | null): { allege: boolean; stressHaut: boolean } {
  if (!b) return { allege: false, stressHaut: false };
  return { allege: b.fatigue >= SEUIL_FRANC || b.jambes >= SEUIL_FRANC, stressHaut: b.stress >= SEUIL_STRESS };
}

/** Le motif affiché dans le bandeau « pourquoi ce plan » et dans le « pourquoi » de la séance. */
export const BILAN_T: Record<Lang, {
  motif: (f: number, j: number) => string; stress: (s: number) => string; recupWhy: (f: number, j: number) => string;
}> = {
  fr: {
    motif: (f, j) => `bilan du matin : fatigue ${f}/5, jambes ${j}/5`,
    stress: (s) => `bilan du matin : stress ${s}/5 (affiché, ne retire rien)`,
    recupWhy: (f, j) => `Ton bilan de ce matin (fatigue ${f}/5, jambes ${j}/5) : la séance dure est remplacée par une sortie facile. Elle revient quand tu te sens mieux.`,
  },
  en: {
    motif: (f, j) => `morning check-in: fatigue ${f}/5, legs ${j}/5`,
    stress: (s) => `morning check-in: stress ${s}/5 (shown, removes nothing)`,
    recupWhy: (f, j) => `Your check-in this morning (fatigue ${f}/5, legs ${j}/5): the hard session is replaced by an easy run. It comes back when you feel better.`,
  },
  de: {
    motif: (f, j) => `Morgen-Check: Müdigkeit ${f}/5, Beine ${j}/5`,
    stress: (s) => `Morgen-Check: Stress ${s}/5 (angezeigt, nichts gestrichen)`,
    recupWhy: (f, j) => `Dein Morgen-Check (Müdigkeit ${f}/5, Beine ${j}/5): Die harte Einheit wird durch einen lockeren Lauf ersetzt. Sie kommt zurück, wenn es dir besser geht.`,
  },
  es: {
    motif: (f, j) => `chequeo matinal: cansancio ${f}/5, piernas ${j}/5`,
    stress: (s) => `chequeo matinal: estrés ${s}/5 (se muestra, no quita nada)`,
    recupWhy: (f, j) => `Tu chequeo de esta mañana (cansancio ${f}/5, piernas ${j}/5): la sesión dura se sustituye por una salida suave. Volverá cuando te encuentres mejor.`,
  },
  pt: {
    motif: (f, j) => `check-in da manhã: cansaço ${f}/5, pernas ${j}/5`,
    stress: (s) => `check-in da manhã: stress ${s}/5 (mostrado, não retira nada)`,
    recupWhy: (f, j) => `O teu check-in desta manhã (cansaço ${f}/5, pernas ${j}/5): a sessão dura é substituída por uma corrida fácil. Volta quando te sentires melhor.`,
  },
};
