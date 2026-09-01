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
/**
 * Type interne d'une course, déduit du sport vu à la source ET de sa distance.
 *
 * ⚠️ CETTE FONCTION EXISTE PARCE QUE J'AI INSÉRÉ DES TYPES FAUX. Pour créer une distance
 * manquante, j'appelais `typeCorrige("road_5k", vu, d)` — or cette fonction ne corrige
 * QUE les incohérences route/trail : « road_5k » face à une fiche de route lui paraissait
 * déjà cohérent, elle rendait `null`, et mon repli ignorait la distance. Résultat en
 * base : un semi-marathon de 21,1 km rangé en « road_5k », et un trail de 26 km aussi.
 * Ici, le type se déduit des deux informations, sans repli.
 */
export function typePour(vu: TypeSportif, distanceKm: number | null): string | null {
  if (vu === "inconnu") return null;
  const d = Number(distanceKm) || 0;
  if (vu === "trail") return d > 80 ? "trail_xl" : d > 50 ? "trail_l" : d > 30 ? "trail_m" : "trail_s";
  if (d >= 40) return "road_marathon";
  if (d >= 19) return "road_half";
  if (d >= 8) return "road_10k";
  return "road_5k";
}

export function typeCorrige(typeActuel: unknown, vu: TypeSportif, distanceKm: number | null): string | null {
  const t = String(typeActuel ?? "");
  if (vu === "inconnu" || !t) return null;
  const estTrail = t.startsWith("trail");
  if (vu === "trail" && estTrail) return null;
  if (vu === "route" && !estTrail) return null;

  // Une seule table de correspondance dans ce fichier : deux copies divergeraient.
  return typePour(vu, distanceKm);
}


/**
 * DISTANCES D'UNE FICHE — lues dans un champ STRUCTURÉ, jamais dans la prose.
 *
 * ⚠️ LE PREMIER JET GRATTAIT TOUTE LA PAGE, et il se trompait : sur « 10 km d'Angers »
 * il n'a rien trouvé, ailleurs il ramassait des kilomètres cités dans un texte
 * publicitaire ou une adresse. Ajouter une distance inventée au catalogue serait pire
 * que d'en manquer une : elle deviendrait une course à laquelle personne ne peut
 * s'inscrire.
 *
 * le-sportif publie la liste dans son `<meta name="keywords">`, TOUJOURS à la fin et
 * TOUJOURS après le type. Vérifié sur trois fiches de familles différentes :
 *   « … course à pied (sur route), 10 km, 5 km, 1,5 km »
 *   « … trail, course nature, 10 km, 5 km, 3 km, 1 km »
 *   « … course à pied (sur route), 42,2 km, 21,1 km, 10 km »
 * On ne lit donc que la QUEUE de cette liste, et on s'arrête au premier mot-clé qui
 * n'est pas une distance.
 */
export function distancesDeFiche(html: string): number[] {
  const m = String(html ?? "").match(/<meta name="keywords"[^>]*content="([^"]*)"/i);
  if (!m) return [];
  const kw = m[1]
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();

  // ⚠️ NE PAS DÉCOUPER SUR LA VIRGULE. Premier jet : « 1,5 km » a été coupé en « 1 » et
  //    « 5 km », la liste s'est arrêtée là, et Bondues ne rendait qu'UNE distance sur
  //    trois. En français la virgule est à la fois le séparateur de la liste ET la
  //    virgule décimale. On capture donc la queue d'un seul coup, en laissant l'expression
  //    régulière décider où la suite de distances commence.
  const queue = kw.match(/((?:\d{1,3}(?:[.,]\d{1,2})?\s*km)(?:\s*,\s*\d{1,3}(?:[.,]\d{1,2})?\s*km)*)\s*$/i);
  if (!queue) return [];

  const out: number[] = [];
  for (const d of queue[1].matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*km/gi)) {
    const v = parseFloat(d[1].replace(",", "."));
    // Bornes de bon sens : en dessous d'un kilomètre c'est une course d'enfants, au-delà
    // de 200 km c'est une erreur de saisie. Ni l'une ni l'autre n'a sa place ici.
    if (v >= 1 && v <= 200) out.push(Math.round(v * 100) / 100);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/**
 * Distances présentes à la source et ABSENTES de chez nous.
 *
 * ⚠️ TOLÉRANCE DE 100 m À LA COMPARAISON. Les sources arrondissent différemment : notre
 * 42,2 km et leur 42,195 km sont la même course, et les traiter comme deux distances
 * créerait un doublon à chaque marathon du catalogue.
 */
export function distancesManquantes(nos: (number | null)[], source: number[]): number[] {
  const miennes = (nos ?? []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
  return source.filter((d) => !miennes.some((m) => Math.abs(m - d) < 0.15));
}
