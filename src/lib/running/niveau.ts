// ─────────────────────────────────────────────────────────────────────────────
//  LE NIVEAU DU COUREUR — une seule règle, celle du coach.
//
//  ⚠️ L'ÉTIQUETTE « NIVEAU ÉLITE / INTERMÉDIAIRE » NE MESURAIT RIEN. Elle lisait
//  `profiles.mode`, écrit une seule fois, à l'inscription : « elite » si la VMA DÉCLARÉE
//  dépassait 17 km/h (jusqu'au 17/09/2026), puis « ludique » pour tous les inscrits,
//  affiché « Intermédiaire » — débutant complet compris. Aucun code ne le réécrivait
//  (Cyprien, 30/10/2026 : « il me met Élite, mais pourquoi je le suis ? »).
//
//  Le niveau se déduit désormais de la VMA EFFECTIVE, avec les seuils qui fixent déjà le
//  nombre de séances de qualité du coach : l'écran et le plan disent la même chose.
//  Module sans dépendance : l'en-tête et le tableau de bord (navigateur) l'importent aussi.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les quatre niveaux du coach. Déclarés ICI et non importés du catalogue de séances : ce
 * catalogue, en français seulement, ne doit avoir qu'un lecteur (le prompt du coach), et
 * un test le surveille. Le coach affecte cette valeur à son propre type `Level` : si un de
 * ces niveaux venait à disparaître de sa liste, la compilation le dirait.
 */
export type NiveauCoureur = "debutant" | "intermediaire" | "confirme" | "elite";

/** Seuils de VMA (km/h) : sous 13 débutant, de 13 à 16 intermédiaire, de 16 à 19 confirmé, 19 et plus élite. */
export const SEUILS_NIVEAU = { intermediaire: 13, confirme: 16, elite: 19 } as const;

/** Le niveau d'après la VMA effective, ou `null` si elle est inconnue : on ne l'invente pas. */
export function niveauDeVma(vma: number | null | undefined): NiveauCoureur | null {
  if (vma == null || !(vma > 0)) return null;
  if (vma < SEUILS_NIVEAU.intermediaire) return "debutant";
  if (vma < SEUILS_NIVEAU.confirme) return "intermediaire";
  if (vma < SEUILS_NIVEAU.elite) return "confirme";
  return "elite";
}

/** Clé du libellé affiché pour chaque niveau (dictionnaire, 5 langues). */
export const CLE_NIVEAU: Record<NiveauCoureur | "inconnu", string> = {
  debutant: "niveau.debutant",
  intermediaire: "niveau.intermediaire",
  confirme: "niveau.confirme",
  elite: "niveau.elite",
  inconnu: "niveau.inconnu",
};
