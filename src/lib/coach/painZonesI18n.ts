// ─────────────────────────────────────────────────────────────────────────────
//  ZONES DE DOULEUR — traduire une valeur STOCKÉE EN FRANÇAIS.
//
//  Le formulaire post-séance enregistre la valeur française (« Tendon d'Achille »),
//  volontairement : l'IA coach et le budget de qualité la reconnaissent par mots-clés
//  français. Mais cette même valeur ressort ensuite dans le « pourquoi » d'une séance
//  — « douleur en cours (Tendon d'Achille) » — au milieu d'une phrase allemande.
//
//  On traduit donc À L'AFFICHAGE, par correspondance inverse sur la valeur stockée.
//  La donnée en base ne bouge pas : aucune migration, et l'analyse par mots-clés
//  français continue de fonctionner exactement comme avant.
//
//  ⚠️ Ces clés doivent rester alignées sur `PAINS`/`ZONES` de
//  `components/dashboard/SessionFeedback.tsx` — un test le vérifie.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";
import { T } from "@/lib/i18n/translations";

/** Valeur stockée (français) → clé de traduction. Miroir exact du formulaire. */
export const ZONE_KEY: Record<string, string> = {
  "Aucune douleur": "fb.pain.none",
  "Musculaire": "fb.pain.muscle",
  "Articulaire": "fb.pain.joint",
  "Mollet": "fb.zone.calf",
  "Tendon d'Achille": "fb.zone.achilles",
  "Genou": "fb.zone.knee",
  "Cuisse": "fb.zone.thigh",
  "Ischio-jambier": "fb.zone.hamstring",
  "Hanche": "fb.zone.hip",
  "Tibia (périoste)": "fb.zone.shin",
  "Pied / cheville": "fb.zone.foot",
  "Dos / bas du dos": "fb.zone.back",
};

/**
 * Traduit une déclaration de douleur telle qu'elle est stockée.
 *
 * Le format peut porter une intensité — « Genou (7/10) » — ajoutée par l'espace Santé.
 * On traduit la ZONE et on garde le chiffre : une douleur sans son intensité perd
 * précisément ce qui permet de la juger.
 *
 * Une valeur inconnue (saisie libre, ancien libellé) est rendue TELLE QUELLE : mieux
 * vaut un mot français au milieu d'une phrase allemande qu'une douleur qui disparaît.
 */
export function traduireDouleur(valeur: string, lang: Lang): string {
  const m = valeur.match(/^(.*?)\s*(\(\s*\d+\s*\/\s*\d+\s*\))\s*$/);
  const zone = (m ? m[1] : valeur).trim();
  const intensite = m ? ` ${m[2]}` : "";
  const cle = ZONE_KEY[zone];
  if (!cle) return valeur;
  return `${T[lang]?.[cle] ?? T.fr[cle] ?? zone}${intensite}`;
}
