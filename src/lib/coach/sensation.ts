/**
 * LE PLAN À LA SENSATION (grossesse, décision de Cyprien du 20/11/2026) — le catalogue santé : « Pilote à
 * la sensation et à la conversation, PAS à la FC (elle est faussée) ». Les allures sont déjà absentes (le
 * coach ne les chiffre pas, `coachContext`) ; ici, chaque zone de fréquence cardiaque écrite dans un jour du
 * plan (« FC Z1→Z2 », « en Z2 », « HR Z1 »…) devient « à la sensation », dans la langue du texte.
 */
import type { Lang } from "@/lib/i18n/translations";

const SENSATION: Record<Lang, string> = { fr: "à la sensation", en: "by feel", de: "nach Gefühl", es: "por sensaciones", pt: "pela sensação" };

/** Une zone de FC : « FC/HR/HF Z1 », « … Z1→Z2 », « … Z1-Z2 », ou « en/in/em/at/a Z2 ». */
const ZONE = /(?:\b(?:FC|HR|HF)\s*|\b(?:en|in|em|at|a)\s+)Z\d(?:\s*[→\-–]\s*Z\d)?/g;

export function aLaSensation(texte: string, l: Lang = "fr"): string {
  return String(texte ?? "").replace(ZONE, SENSATION[l] ?? SENSATION.fr);
}
