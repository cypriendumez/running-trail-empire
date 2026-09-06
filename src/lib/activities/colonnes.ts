// ─────────────────────────────────────────────────────────────────────────────
//  LES COLONNES D'ÉDITION EXISTENT-ELLES VRAIMENT ?
//
//  Le projet a déjà été mordu : un fichier de migration ne prouve pas qu'une colonne
//  existe (la 006 n'avait jamais tourné, trois tables manquaient). Ici la conséquence
//  serait pire qu'un écran vide — l'athlète renommerait sa sortie, l'écran dirait
//  « enregistré », et rien ne serait écrit.
//
//  On SONDE donc, une fois, et l'interface d'édition ne s'affiche que si la réponse est
//  oui. `42703` est le code PostgreSQL « colonne inconnue » ; c'est le même repère que
//  la synchro intervals.icu utilise déjà (`hasNewCols`).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

export const COLONNE_INCONNUE = "42703";

/** Noms réels en base. Une seule définition : l'écriture et la lecture ne peuvent pas diverger. */
export const COLONNES_EDITION = { titre: "title_custom", description: "description" } as const;

/** SQL à exécuter pour activer la fonction (donné à l'éditeur, jamais exécuté ici). */
export const SQL_ACTIVATION =
  "alter table workouts add column if not exists title_custom text, add column if not exists description text;";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function colonnesEditionPresentes(sb: SupabaseClient<any, any, any>): Promise<boolean> {
  const { error } = await sb
    .from("workouts")
    .select(`${COLONNES_EDITION.titre}, ${COLONNES_EDITION.description}`)
    .limit(1);
  if (!error) return true;
  if (error.code === COLONNE_INCONNUE) return false;
  // Toute AUTRE panne (réseau, droits) ne prouve pas l'absence : on ne ferme pas la
  // fonction pour une raison qu'on n'a pas comprise, la route dira l'échec réel.
  return true;
}
