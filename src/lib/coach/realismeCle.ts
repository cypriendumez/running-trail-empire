/**
 * LA CLÉ QUI IDENTIFIE UN AVERTISSEMENT DE RÉALISME — pour pouvoir le masquer sans le perdre.
 *
 * Cyprien, 21/09/2026 : « rajoute un bouton qui permet de faire disparaître ce qui est en
 * rouge ». Le bloc « Réalisme de l'objectif » (chrono hors de portée, sortie longue
 * impossible d'ici la course, âge) se réaffichait à CHAQUE visite du calendrier, sans
 * jamais pouvoir être écarté une fois lu.
 *
 * ⚠️ ON NE MASQUE PAS « LE BLOC », ON MASQUE CET AVERTISSEMENT-LÀ. Le choix de l'athlète
 * est mémorisé sous une clé qui dépend de l'objectif ET du contenu des avertissements :
 *   · il change d'objectif           → nouvelle clé, le bloc revient ;
 *   · un avertissement apparaît ou
 *     disparaît (VMA qui progresse,
 *     date qui approche)             → nouvelle clé, le bloc revient.
 * Un « ne plus afficher » ne doit jamais cacher une mise en garde qu'il n'a pas lue.
 */
export type ObjectifCle = { race?: string | null; raceDate?: string | null } | null | undefined;

/** Empreinte courte et stable d'une chaîne (djb2) — pas de crypto, pas de dépendance. */
export function empreinte(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function cleRealisme(objectif: ObjectifCle, avertissements: readonly string[]): string {
  const race = (objectif?.race ?? "").trim().toLowerCase();
  const date = objectif?.raceDate ?? "";
  return `${race}|${date}|${empreinte(avertissements.filter(Boolean).join("\n"))}`;
}

/** L'avertissement est-il masqué par ce que l'athlète a enregistré ? (Une clé vaut toujours
 *  `race|date|empreinte` : un réglage vide ou absent ne peut donc jamais la valoir.) */
export const realismeMasque = (memorise: string | null | undefined, cle: string): boolean =>
  memorise === cle;
