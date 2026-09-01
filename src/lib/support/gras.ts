/**
 * Découpage du **gras** produit par l'assistant.
 *
 * ⚠️ LA BULLE AFFICHAIT LES ASTÉRISQUES. Le prompt demande explicitement au modèle de
 * mettre en gras le nom des pages et des boutons — c'est ce qui rend un chemin de clics
 * lisible d'un coup d'œil. Faute de rendu, l'athlète lisait « ouvre **Réglages** puis
 * **Montre** » : le balisage sautait aux yeux à la place du mot qu'il devait repérer.
 *
 * Fonction PURE et sortie du composant pour être testable : c'est elle qui décide de ce
 * qui est mis en valeur, et une erreur ici se voit sur chaque réponse.
 */
export type Segment = { texte: string; gras: boolean };

export function segmenterGras(source: string): Segment[] {
  const brut = String(source ?? "");
  if (!brut) return [];
  // `[^*]+` interdit à un segment d'enjamber un autre `*` : « **a** et **b** » donne
  // deux passages en gras, pas un seul qui avale le texte du milieu.
  const parts = brut.split(/(\*\*[^*]+\*\*)/g);
  const out: Segment[] = [];
  for (const p of parts) {
    if (!p) continue;
    const gras = p.length > 4 && p.startsWith("**") && p.endsWith("**");
    out.push({ texte: gras ? p.slice(2, -2) : p, gras });
  }
  return out;
}
