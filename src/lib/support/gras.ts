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
import { segments } from "@/lib/ui/richText";

export type Segment = { texte: string; gras: boolean };

/**
 * ⚠️ UNE SEULE IMPLÉMENTATION, DEUX APPELANTS. Le kiné IA a reçu son propre analyseur
 * (`lib/ui/richText`) parce que ses réponses portent aussi des titres et des listes.
 * Garder ici un second découpage du gras aurait voulu dire deux codes à corriger le jour
 * où l'un se trompe, et un seul des deux assistants réparé. Cette fonction reste le point
 * d'entrée nommé du support — et ses garanties (restitution sans perte, deux gras qui ne
 * fusionnent pas) sont vérifiées sur l'analyseur partagé.
 */
export function segmenterGras(source: string): Segment[] {
  const brut = String(source ?? "");
  if (!brut) return [];
  return segments(brut).map((s) => ({ texte: s.texte, gras: s.gras }));
}
