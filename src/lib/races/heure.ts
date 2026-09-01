/**
 * HEURE DE DÉPART D'UNE COURSE.
 *
 * ⚠️ POURQUOI ELLE N'EST PAS DANS LE CATALOGUE, ET NE PEUT PAS Y ÊTRE.
 * Vérifié à la source le 01/09/2026 : la fiche finishers.com du Marathon International
 * de Lille publie `startDate: 2026-10-25` — une DATE, sans heure — et la page ne
 * contient aucune heure. Même constat côté jogging-plus. Les deux agrégateurs qui
 * alimentent les 17 027 fiches ne transportent pas cette information.
 *
 * Ajouter une colonne `start_time` à `races` aurait donc créé un champ vide sur 17 027
 * lignes : exactement le défaut « table jamais alimentée » déjà rencontré ailleurs dans
 * cette app, où un écran finit par afficher un trou blanc que rien ne signale.
 *
 * L'heure existe pourtant — sur le site de l'organisateur, et dans le mail de
 * confirmation d'inscription. C'est l'ATHLÈTE qui la détient. Elle se saisit donc sur
 * SON objectif, et vit dans le JSON de son objectif : aucune migration, et un champ qui
 * n'est rempli que par quelqu'un qui sait vraiment.
 */

/**
 * Normalise une heure saisie en « HH:MM », ou renvoie `null` si elle est inutilisable.
 *
 * Accepte les formes courantes en français (« 9h30 », « 9 h 30 », « 09:30 ») parce que
 * c'est ce qu'on recopie depuis un mail d'organisateur. Refuse tout le reste plutôt que
 * de deviner : une heure de départ fausse est pire qu'une heure absente — elle se
 * planifie, et on rate son départ en s'y fiant.
 */
export function normaliserHeure(v: unknown): string | null {
  const brut = String(v ?? "").trim();
  if (!brut) return null;
  const m = brut.match(/^([01]?\d|2[0-3])\s*[hH:.]\s*([0-5]\d)$/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  // « 9h » seul : un départ à l'heure pile, forme très courante sur les affiches.
  const h = brut.match(/^([01]?\d|2[0-3])\s*[hH]$/);
  if (h) return `${h[1].padStart(2, "0")}:00`;
  return null;
}

/** Affichage à la française : « 09:30 » → « 9 h 30 ». */
export function afficherHeure(v: unknown): string | null {
  const n = normaliserHeure(v);
  if (!n) return null;
  const [h, m] = n.split(":");
  return `${Number(h)} h ${m}`;
}
