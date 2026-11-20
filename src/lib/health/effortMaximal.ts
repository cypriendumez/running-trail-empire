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
