/**
 * LE PLAN À LA SENSATION (grossesse, décision de Cyprien du 20/11/2026) — le catalogue santé : « Pilote à
 * la sensation et à la conversation, PAS à la FC (elle est faussée) ». Les allures sont déjà absentes (le
 * coach ne les chiffre pas, `coachContext`) ; ici, chaque zone de fréquence cardiaque écrite dans un jour du
 * plan (« FC Z1→Z2 », « en Z2 », « HR Z1 »…) devient « à la sensation », dans la langue du texte.
 */
import type { Lang } from "@/lib/i18n/translations";

const SENSATION: Record<Lang, string> = { fr: "à la sensation", en: "by feel", de: "nach Gefühl", es: "por sensaciones", pt: "pela sensação" };

/** Une zone de FC : « FC/HR/HF Z1 », « … Z1→Z2 », « … Z1-Z2 », « en/in/em/at/a Z2 », et « en FC Z2 » d'un seul tenant
 *  (sinon « en à la sensation », relecteur G, 23/11/2026). */
const ZONE = /(?:\b(?:en|in|em|at|a)\s+)?(?:\b(?:FC|HR|HF)\s*)?\bZ\d(?:\s*[→\-–]\s*Z\d)?\b/g;

/** « , piloté à la FRÉQUENCE CARDIAQUE » de la récupération (PLAN_T.recupDetail) : retiré, virgule comprise — la zone
 *  devenue « à la sensation » le dit déjà (« 25 min à la sensation très facile (aucune allure à tenir) »). */
const PILOTE_FC: Record<Lang, RegExp> = {
  fr: /, piloté à la FRÉQUENCE CARDIAQUE/g, en: /, driven by HEART RATE/g, de: /, über die HERZFREQUENZ gesteuert/g,
  es: /, pilotado por FRECUENCIA CARDÍACA/g, pt: /, guiado pela FREQUÊNCIA CARDÍACA/g,
};

/** La FC des notes de chaleur et de vent (lib/weather/openMeteoI18n : « juge à la FC », « bascule sur la FC »…). */
const METEO_FC: Record<Lang, [RegExp, string][]> = {
  // (Sans `\b` devant « à » : hors ASCII, JavaScript n'y voit pas de frontière de mot.)
  fr: [[/(^|\s)(à|sur) la FC\b/g, "$1$2 la sensation"]],
  en: [[/\bby heart rate\b/g, "by feel"], [/\bto heart rate\b/g, "to running by feel"]],
  de: [[/\bnach (?:der )?Herzfrequenz\b/g, "nach Gefühl"], [/\bauf die Herzfrequenz\b/g, "auf das Gefühl"]],
  es: [[/\bpor la FC\b/g, "por sensaciones"], [/\ba la FC\b/g, "a las sensaciones"]],
  pt: [[/\bpela FC\b/g, "pela sensação"], [/\bpara a FC\b/g, "para a sensação"]],
};

export function aLaSensation(texte: string, l: Lang = "fr"): string {
  let t = String(texte ?? "").replace(ZONE, SENSATION[l] ?? SENSATION.fr).replace(PILOTE_FC[l] ?? PILOTE_FC.fr, "");
  for (const [re, par] of METEO_FC[l] ?? METEO_FC.fr) t = t.replace(re, par);
  return t;
}

/** Une étiquette de zone (« Z2 », « Z1-Z2 », « FC Z1 ») devient « Ressenti » ; les doublons tombent. */
const ETIQUETTE_SENSATION: Record<Lang, string> = { fr: "Ressenti", en: "Feel", de: "Gefühl", es: "Sensaciones", pt: "Sensação" };
export function etiquettesALaSensation(tags: readonly string[], l: Lang = "fr"): string[] {
  const out = tags.map((t) => (/^(?:(?:FC|HR|HF)\s*)?Z\d(?:\s*[→\-–]\s*Z\d)?$/.test(String(t).trim()) ? ETIQUETTE_SENSATION[l] ?? ETIQUETTE_SENSATION.fr : t));
  return out.filter((t, i) => out.indexOf(t) === i);
}

/** Le « pourquoi » de la séance sous le seuil, sans VMA ni objectif chiffré (PLAN_T.qualiteWhy le cale sur la VMA). */
export const QUALITE_WHY_SENSATION: Record<Lang, string> = {
  fr: "La séance de ton bloc, à la sensation : tu dois pouvoir parler par phrases courtes, sans jamais forcer.",
  en: "The session of your block, by feel: you should be able to talk in short sentences, never pushing.",
  de: "Die Einheit deines Blocks, nach Gefühl: Du solltest in kurzen Sätzen sprechen können, ohne dich je zu verausgaben.",
  es: "La sesión de tu bloque, por sensaciones: debes poder hablar con frases cortas, sin forzar nunca.",
  pt: "A sessão do teu bloco, pela sensação: deves conseguir falar por frases curtas, sem nunca forçar.",
};
