/**
 * REGROUPEMENT DES COURSES PAR ÉVÉNEMENT.
 *
 * ⚠️ LE CATALOGUE AFFICHAIT UNE CARTE PAR DISTANCE, PAS PAR COURSE. « Boucles de
 * Saint-Thonan » occupait trois cartes consécutives — 10 km, 9 km, 5 km — même ville,
 * même date, même page d'inscription. Ce n'est pas une donnée en double : ce sont les
 * formats d'un seul événement. Mais empilés tels quels, ils se lisent comme un bug, et
 * ils repoussent les vraies courses suivantes hors de l'écran.
 *
 * Mesuré sur les 15 000 lignes du catalogue : 8 613 événements réels, dont 3 674 à
 * plusieurs distances — soit 43 % de lignes en moins une fois regroupées.
 *
 * La clé est (nom, ville, date). PAS l'URL d'inscription : deux courses distinctes d'un
 * même organisateur peuvent la partager. PAS le nom seul : une course annuelle a
 * plusieurs éditions, et deux villes peuvent avoir une « Corrida de Noël ».
 */

export type CourseGroupable = {
  id: string;
  name: string;
  city?: string | null;
  date?: string | null;
  distance_km?: number | null;
};

export type Evenement<T extends CourseGroupable> = {
  /** Clé de regroupement, stable — sert aussi de `key` React. */
  cle: string;
  /** La course qui porte la carte : la PLUS LONGUE distance, c'est-à-dire le format
   *  principal de l'événement. Ouvrir « le 5 km » quand un trail de 42 km existe le même
   *  jour donnerait une idée fausse de la course. */
  principale: T;
  /** Toutes les distances, de la plus courte à la plus longue. Une seule pour la
   *  grande majorité des événements. */
  formats: T[];
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function cleEvenement(r: CourseGroupable): string {
  return `${norm(r.name)}::${norm(r.city)}::${norm(r.date)}`;
}

/**
 * Regroupe en conservant l'ORDRE d'arrivée des événements : la liste est déjà triée
 * (par date, par distance…), et réordonner ici ferait mentir le sélecteur de tri.
 */
export function grouperEvenements<T extends CourseGroupable>(races: T[]): Evenement<T>[] {
  const par = new Map<string, T[]>();
  const ordre: string[] = [];
  for (const r of races) {
    if (!r || typeof r.id !== "string") continue;
    const cle = cleEvenement(r);
    const deja = par.get(cle);
    if (deja) deja.push(r);
    else { par.set(cle, [r]); ordre.push(cle); }
  }
  return ordre.map((cle) => {
    const formats = [...(par.get(cle) ?? [])].sort(
      (a, b) => (Number(a.distance_km) || 0) - (Number(b.distance_km) || 0),
    );
    return { cle, principale: formats[formats.length - 1], formats };
  });
}
