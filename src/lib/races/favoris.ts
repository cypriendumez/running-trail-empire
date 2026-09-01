/**
 * FAVORIS — validation de l'identifiant de course.
 *
 * ⚠️ CE QUI ARRIVE ICI VIENT DU NAVIGATEUR. `raceId` part dans un filtre PostgREST
 * (`data->>raceId`) : une valeur non contrôlée n'a rien à y faire. On n'accepte donc
 * que la forme exacte d'un identifiant de la table `races` — un UUID — et on refuse
 * tout le reste plutôt que de « nettoyer » une entrée douteuse.
 */
export function idCourseValide(v: unknown): boolean {
  const s = String(v ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
