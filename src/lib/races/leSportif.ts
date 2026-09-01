import { normNom } from "./groupes";

/**
 * TROISIÈME SOURCE — le-sportif.com, pour corriger ce que les deux autres ont faux.
 *
 * ⚠️ POURQUOI CETTE SOURCE, ET PAS UNE AUTRE. Sur « Foulées de Bondues », finishers
 * annonce un TRAIL et le-sportif une COURSE SUR ROUTE. Vérifié le 02/09/2026 : la fiche
 * le-sportif donne la date exacte, les CINQ distances (10 km, 5 km, 1,5 km, marche 5 km,
 * 700 m) et les horaires de départ (10 h 00 et 9 h 00). Les deux agrégateurs qui
 * alimentent le catalogue n'avaient ni le type juste, ni les horaires, ni trois des
 * distances.
 *
 * CE QUI EST AUTORISÉ, ET CE QUI NE L'EST PAS. Leur `robots.txt` dit `Allow: /` et
 * n'interdit que cinq chemins d'administration — dont `/ExternalCalendarFeed/`, qui
 * répond de toute façon 403. La page de recherche `/Calendar/CalendarSearch.aspx`, elle,
 * n'est pas interdite et répond 200. On s'en tient à elle, et à une recherche CIBLÉE par
 * ville : pas de balayage de tout le site.
 *
 * ⚠️ UNE MAUVAISE CORRESPONDANCE EST PIRE QUE PAS DE CORRESPONDANCE. Écrire le type
 * d'une course sur une autre remplacerait une erreur par une erreur invisible. On
 * n'accepte donc qu'une correspondance UNIQUE et vérifiée sur le nom ET l'année.
 */

/** Type de course, tel que le-sportif l'inscrit dans l'URL de la fiche. */
export type TypeSportif = "route" | "trail" | "inconnu";

export function typeDepuisUrl(url: unknown): TypeSportif {
  const u = String(url ?? "").toLowerCase();
  if (!u.includes("/calendrier/")) return "inconnu";
  // L'ordre compte : « trail-course-nature » contient « course », il doit être testé
  // AVANT « course-a-pied-sur-route » sous peine d'être classé route.
  if (u.includes("trail") || u.includes("course-nature")) return "trail";
  if (u.includes("course-a-pied-sur-route")) return "route";
  return "inconnu";
}

/** Année inscrite dans le slug de la fiche — le-sportif la met toujours. */
export function anneeDepuisUrl(url: unknown): string | null {
  const m = String(url ?? "").match(/-(20\d{2})(?:[-/]|$)/);
  return m ? m[1] : null;
}

/** Mots significatifs d'un nom de course, pour comparer deux libellés. */
const VIDES = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "et", "a", "au", "aux", "sur", "en"]);
export function motsCles(nom: unknown): string[] {
  return normNom(nom).split(" ").filter((m) => m.length > 2 && !VIDES.has(m));
}

/**
 * Choisit LA fiche qui correspond, ou rien.
 *
 * Trois conditions cumulatives, et l'unicité :
 *   · l'année du slug doit être celle de notre date — une course annuelle a une fiche
 *     par édition, et corriger le type de la mauvaise année n'aurait aucun sens ;
 *   · au moins deux mots significatifs communs, ou l'unique mot significatif s'il n'y en
 *     a qu'un — « Foulées de Bondues » et « Foulées Argentées » partagent « foulees »,
 *     ce qui ne suffit évidemment pas ;
 *   · une seule fiche restante. Deux candidates = on ne tranche pas.
 */
export function choisirFiche(
  liens: string[],
  course: { name: string; date: string },
): string | null {
  const annee = String(course.date ?? "").slice(0, 4);
  if (!/^20\d{2}$/.test(annee)) return null;
  const mots = motsCles(course.name);
  if (!mots.length) return null;

  const retenus = (liens ?? []).filter((l) => {
    if (anneeDepuisUrl(l) !== annee) return false;
    const slug = normNom(String(l).replace(/^\/calendrier\/\d+\//, "").replace(/\//g, " "));
    const communs = mots.filter((m) => slug.includes(m)).length;
    return mots.length === 1 ? communs === 1 : communs >= 2;
  });
  return retenus.length === 1 ? retenus[0] : null;
}

/**
 * Notre type interne doit-il être corrigé ?
 *
 * On ne touche QUE la famille route ↔ trail, jamais la distance : `road_10k` devient
 * `trail_s` ou l'inverse selon la source, mais un 10 km reste un 10 km. Et on ne corrige
 * rien si le-sportif ne sait pas non plus.
 */
export function typeCorrige(typeActuel: unknown, vu: TypeSportif, distanceKm: number | null): string | null {
  const t = String(typeActuel ?? "");
  if (vu === "inconnu" || !t) return null;
  const estTrail = t.startsWith("trail");
  if (vu === "trail" && estTrail) return null;
  if (vu === "route" && !estTrail) return null;

  const d = Number(distanceKm) || 0;
  if (vu === "trail") {
    return d > 80 ? "trail_xl" : d > 50 ? "trail_l" : d > 30 ? "trail_m" : "trail_s";
  }
  // Route : la famille suit la distance, comme partout ailleurs dans l'app.
  if (d >= 40) return "road_marathon";
  if (d >= 19) return "road_half";
  if (d >= 8) return "road_10k";
  return "road_5k";
}
