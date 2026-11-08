/**
 * LA PRESCRIPTION DU JOUR, EN ÉTAPES (07/11/2026).
 *
 * Le coach écrit chaque séance en une phrase chaînée par des flèches — c'est le format que
 * `lib/watch/intervals.ts` relit pour bâtir la séance de la montre, il ne change pas :
 *   « Échauffement 8 min progressif FC Z1→Z2 → Corps : ~5,5 km en Z2 (~4'36/km) → Retour au calme 6 min FC Z1 »
 * Sur la carte « Séance du jour », cette phrase de 180 caractères se lisait comme un bloc.
 * On la DÉCOUPE pour l'affichage seulement : une étape par ligne, le cœur de séance en avant.
 *
 * ⚠️ Seules les flèches ENTOURÉES D'ESPACES séparent les étapes : « Z1→Z2 », collée, fait
 * partie du texte d'une étape. Rien n'est réécrit, rien n'est inventé : chaque étape est
 * un morceau exact de la phrase d'origine.
 */
export type Etape = { libelle: string | null; texte: string; coeur: boolean };

/** Un libellé court en tête d'étape (« Corps : », « Hauptteil: », « Body: »), sans chiffre. */
const LIBELLE = /^([^\d:→]{2,24}?)\s?:\s+([\s\S]+)$/;

export function etapesSeance(prescription: string | null | undefined): Etape[] | null {
  const brut = String(prescription ?? "").trim();
  if (!brut) return null;
  const morceaux = brut.split(/\s+→\s+/).map((m) => m.trim()).filter(Boolean);
  if (morceaux.length < 2) return null;
  const etapes = morceaux.map((m) => {
    const l = m.match(LIBELLE);
    // « Corps », mot du format relu par la montre, se dit « Cœur de séance » à l'écran.
    return l ? { libelle: /^corps$/i.test(l[1].trim()) ? "Cœur de séance" : l[1].trim(), texte: l[2].trim(), coeur: false } : { libelle: null, texte: m, coeur: false };
  });
  // Le cœur : l'étape étiquetée s'il y en a une, sinon celle du milieu (3 étapes : la 2e).
  const i = etapes.findIndex((e) => e.libelle) >= 0 ? etapes.findIndex((e) => e.libelle) : Math.floor((etapes.length - 1) / 2);
  etapes[i].coeur = true;
  return etapes;
}
