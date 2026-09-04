/**
 * DISTINGUER « TU N'AS RIEN » DE « ÇA N'A PAS CHARGÉ ».
 *
 * ⚠️ POURQUOI CE MODULE EXISTE. Les quinze lectures du tableau de bord ne regardaient
 * aucune de leurs erreurs : chacune finissait par `?? []` ou `?? null`. Une lecture en
 * panne produisait donc exactement le même écran qu'un compte vide — zéro kilomètre,
 * zéro séance, aucune VMA — et le bandeau « connecte ta montre » s'affichait à un
 * athlète qui l'a déjà connectée et dont les données sont intactes. Le pire message
 * possible : il donne à croire qu'on les a perdues.
 *
 * ⚠️ ET `PGRST116` N'EST PAS UNE PANNE. Mesuré le 04/09/2026 contre la vraie base :
 *
 *     .single()      sur zéro ligne → error.code = "PGRST116"
 *     .maybeSingle() sur zéro ligne → aucune erreur
 *     .select()      sur zéro ligne → [] , aucune erreur
 *
 * Un athlète sans plan actif, sans ligue ou sans nuit enregistrée déclenche donc une
 * erreur `PGRST116` parfaitement normale. La confondre avec une panne afficherait un
 * avertissement permanent à tout nouvel inscrit — et personne n'y croirait plus le jour
 * où il compte vraiment.
 */

/** Ce que rend une lecture Supabase, réduit à ce qui nous intéresse ici. */
export type Lecture = { error: { code?: string } | null };

/** Le code que PostgREST renvoie quand `.single()` ne trouve aucune ligne. */
export const AUCUNE_LIGNE = "PGRST116";

/** Vrai seulement pour un échec RÉEL, jamais pour une absence de données. */
export function estUnePanne(lecture: Lecture | null | undefined): boolean {
  const e = lecture?.error;
  if (!e) return false;
  return e.code !== AUCUNE_LIGNE;
}

/**
 * Les noms des lectures réellement en panne, dans l'ordre donné.
 * Vide dans le cas normal — y compris pour un compte tout neuf.
 */
export function lecturesEnEchec(entrees: [string, Lecture][]): string[] {
  return entrees.filter(([, l]) => estUnePanne(l)).map(([nom]) => nom);
}
