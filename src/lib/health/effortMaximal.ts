/**
 * LES ANTÉCÉDENTS QUI INTERDISENT L'EFFORT MAXIMAL — une seule liste, pour le coach (`noMaxEffort`,
 * budget de qualité et menu), le verrou du test VMA (`autoCoach`) et l'interface (`testVmaAEviterDe`)
 * (19/11/2026). Le catalogue santé (`src/data/healthCatalog.ts`) le dit pour chacun : antécédent
 * cardiaque (« AUCUNE séance maximale… sans accord explicite de son médecin »), covid long (« aucune
 * intensité »), grossesse (« pas d'effort maximal »). La liste vivait recopiée dans le seul coach : le
 * verrou posait le test « 6 min À FOND » à ces coureurs, et le tableau de bord les y invitait.
 */
import type { Lang } from "@/lib/i18n/translations";

export const ANTECEDENTS_SANS_EFFORT_MAXIMAL = ["cardiaque", "covid_long", "grossesse"] as const;
/**
 * Ceux qui interdisent TOUTE intensité, pas seulement l'effort maximal : le covid long (« uniquement en
 * Z1-Z2, aucune intensité tant que la VFC n'est pas remontée à sa base »). Le coach ne connaît pas la VFC
 * d'avant la maladie (sa base est la moyenne des 14 derniers jours, tirée vers le bas par la fatigue), et
 * beaucoup de coureurs n'en ont aucune : zéro qualité tant que l'antécédent est déclaré (décision de
 * Cyprien sur l'avis de @HeadCoach, 19/11/2026).
 */
export const ANTECEDENTS_SANS_INTENSITE = ["covid_long"] as const;
/**
 * Ceux qui se pilotent À LA SENSATION, sans allure chiffrée ni cible de FC : la grossesse (« Pilote à la
 * sensation et à la conversation, PAS à la FC (elle est faussée) ») — les allures viendraient d'une VMA
 * d'avant la grossesse. Rien n'est envoyé à la montre (décisions de Cyprien, 20/11/2026).
 */
export const ANTECEDENTS_A_LA_SENSATION = ["grossesse"] as const;

const parmi = (healthConditions: unknown, liste: readonly string[]): boolean =>
  Array.isArray(healthConditions) && healthConditions.some((s) => typeof s === "string" && liste.includes(s));

/** `health_conditions` du profil (liste de slugs) : l'un d'eux interdit-il l'effort maximal ? */
export function effortMaximalInterdit(healthConditions: unknown): boolean {
  return parmi(healthConditions, ANTECEDENTS_SANS_EFFORT_MAXIMAL);
}

/** L'un d'eux interdit-il toute intensité (aucune séance de qualité) ? */
export function intensiteInterdite(healthConditions: unknown): boolean {
  return parmi(healthConditions, ANTECEDENTS_SANS_INTENSITE);
}

/** L'un d'eux se pilote-t-il à la sensation (aucune allure, aucune FC, rien sur la montre) ? */
export function pilotageSensation(healthConditions: unknown): boolean {
  return parmi(healthConditions, ANTECEDENTS_A_LA_SENSATION);
}

/**
 * COVID LONG : « si l'athlète se sent plus mal 24-48 h APRÈS une séance, réduis immédiatement et oriente-le
 * vers son médecin » (catalogue santé). Signal : le bilan du matin à 4-5/5 (fatigue ou jambes) dans les deux
 * jours qui suivent une sortie — la séance du jour devient un repos (décision de Cyprien, 20/11/2026).
 */
// `course` : le jour d'une course, que le plan garde (le départ appartient au coureur) — ajouté à son « pourquoi ».
export const MALAISE_T: Record<Lang, { motif: string; why: string; course: string }> = {
  fr: { motif: "bilan du matin après une séance : fatigue marquée — repos aujourd'hui ; si cela se répète, parles-en à ton médecin",
    why: "Ton bilan de ce matin montre une fatigue marquée après ta dernière séance : avec l'antécédent déclaré dans ta santé, on se repose aujourd'hui. Si cela se répète, parles-en à ton médecin.",
    course: " ⚠️ Ton bilan de ce matin montre une fatigue marquée après ta dernière séance : si tu prends le départ, cours sans jamais forcer et renonce au moindre malaise. Si cela se répète, parles-en à ton médecin." },
  en: { motif: "morning check-in after a session: marked fatigue — rest today; if it happens again, talk to your doctor",
    why: "Your check-in this morning shows marked fatigue after your last session: with the health history you declared, today is a rest day. If it happens again, talk to your doctor.",
    course: " ⚠️ Your check-in this morning shows marked fatigue after your last session: if you start, never push, and stop at the slightest discomfort. If it happens again, talk to your doctor." },
  de: { motif: "Morgen-Check nach einer Einheit: deutliche Müdigkeit — heute Ruhe; wenn es wieder vorkommt, sprich mit deiner Ärztin oder deinem Arzt",
    why: "Dein Morgen-Check zeigt deutliche Müdigkeit nach deiner letzten Einheit: Mit der angegebenen Vorgeschichte ist heute Ruhetag. Wenn es wieder vorkommt, sprich mit deiner Ärztin oder deinem Arzt.",
    course: " ⚠️ Dein Morgen-Check zeigt deutliche Müdigkeit nach deiner letzten Einheit: Wenn du startest, lauf ohne dich zu verausgaben und hör beim geringsten Unwohlsein auf. Wenn es wieder vorkommt, sprich mit deiner Ärztin oder deinem Arzt." },
  es: { motif: "chequeo matinal tras una sesión: cansancio marcado — descanso hoy; si se repite, háblalo con tu médico",
    why: "Tu chequeo de esta mañana muestra un cansancio marcado tras tu última sesión: con el antecedente declarado en tu salud, hoy toca descanso. Si se repite, háblalo con tu médico.",
    course: " ⚠️ Tu chequeo de esta mañana muestra un cansancio marcado tras tu última sesión: si tomas la salida, corre sin forzar nunca y abandona ante el menor malestar. Si se repite, háblalo con tu médico." },
  pt: { motif: "balanço da manhã após uma sessão: cansaço marcado — descanso hoje; se se repetir, fala com o teu médico",
    why: "O teu balanço desta manhã mostra um cansaço marcado após a tua última sessão: com o antecedente declarado na tua saúde, hoje é dia de descanso. Se se repetir, fala com o teu médico.",
    course: " ⚠️ O teu balanço desta manhã mostra um cansaço marcado após a tua última sessão: se partires, corre sem nunca forçar e desiste ao menor mal-estar. Se se repetir, fala com o teu médico." },
};

/**
 * Le motif affiché au coureur (« Dis-le-lui clairement », catalogue santé) : ce qui est écarté, pourquoi,
 * et qui peut lever la limite. Une orientation, aucun diagnostic ; l'antécédent n'est pas nommé.
 */
export const EFFORT_MAX_T: Record<Lang, { motif: (sansIntensite: boolean) => string }> = {
  fr: { motif: (s) => s
    ? "antécédent déclaré dans ta santé : aucune intensité pour l'instant, de l'endurance facile seulement — seul ton médecin peut lever cette limite"
    : "antécédent déclaré dans ta santé : ni VMA ni test, une séance au seuil bas au plus par semaine — seul ton médecin peut lever cette limite" },
  en: { motif: (s) => s
    ? "health history you declared: no intensity for now, easy endurance only — only your doctor can lift this limit"
    : "health history you declared: no VO₂max work or test, at most one low-threshold session a week — only your doctor can lift this limit" },
  de: { motif: (s) => s
    ? "angegebene Vorgeschichte: vorerst keine Intensität, nur lockere Ausdauer — nur deine Ärztin oder dein Arzt kann diese Grenze aufheben"
    : "angegebene Vorgeschichte: kein vVO₂max-Training und kein Test, höchstens eine Einheit an der unteren Schwelle pro Woche — nur deine Ärztin oder dein Arzt kann diese Grenze aufheben" },
  es: { motif: (s) => s
    ? "antecedente declarado en tu salud: ninguna intensidad por ahora, solo resistencia suave — solo tu médico puede levantar este límite"
    : "antecedente declarado en tu salud: ni VAM ni test, como mucho una sesión de umbral bajo por semana — solo tu médico puede levantar este límite" },
  pt: { motif: (s) => s
    ? "antecedente declarado na tua saúde: nenhuma intensidade por agora, só resistência leve — só o teu médico pode levantar este limite"
    : "antecedente declarado na tua saúde: nem VAM nem teste, no máximo uma sessão de limiar baixo por semana — só o teu médico pode levantar este limite" },
};
