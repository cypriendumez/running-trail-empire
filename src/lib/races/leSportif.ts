import { normNom } from "./groupes";
import { correctedRaceType } from "@/lib/raceType";
import type { RaceType } from "@/types";

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

/**
 * Le SEGMENT DE NOM de la fiche, isolé du reste de l'URL.
 *
 * ⚠️ SANS CET ISOLEMENT, LE CHEMIN DU SPORT OFFRE DES MOTS GRATUITS. Une URL le-sportif
 * s'écrit `/calendrier/{id}/{nom-annee-ville}/{sport}/`, et le segment de sport vaut
 * « trail-course-nature », « course-a-pied-sur-route » ou « marche-gourmande ». Comparé
 * à l'URL entière, « Course Nature Via Agrippa » trouvait « course » et « nature » dans
 * le chemin de N'IMPORTE QUEL trail : deux mots communs sans qu'aucun ne vienne du nom
 * de la course. Toute course nommée « Trail de X » ou « Course Nature X » pouvait ainsi
 * s'apparier à une autre course de la même ville.
 */
export function segmentNom(url: unknown): string {
  const parts = String(url ?? "").split("/").filter(Boolean);
  // ["calendrier", "{id}", "{nom}", "{sport}"] — le nom est en troisième position.
  return parts[0] === "calendrier" && parts.length >= 3 ? parts[2] : "";
}

/** « st » et « ste » sont la même chose que « saint » et « sainte » dans un slug. */
const ABREGES: Record<string, string> = { st: "saint", ste: "sainte", sts: "saints" };

/**
 * Deux mots désignent-ils la même chose ? Égalité, ou préfixe à deux lettres près pour
 * absorber le pluriel et le féminin (« foulee » / « foulees », « amandinoise » /
 * « amandinoises »). L'écart est borné à deux : au-delà, « mont » avalerait
 * « montigny » et rendrait l'exigence de mots complets inopérante.
 */
export function motProche(a: string, b: string): boolean {
  const x = ABREGES[a] ?? a, y = ABREGES[b] ?? b;
  if (x === y) return true;
  const [court, long] = x.length <= y.length ? [x, y] : [y, x];
  return court.length >= 4 && long.startsWith(court) && long.length - court.length <= 2;
}

/** Mots significatifs d'un nom de course, pour comparer deux libellés. */
const VIDES = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "et", "a", "au", "aux", "sur", "en"]);
export function motsCles(nom: unknown): string[] {
  // Les parenthèses portent le sponsor ou le lieu-dit, jamais l'identité de l'épreuve :
  // « Les Boucles Vauban (Decathlon) » est la même course que « Les Boucles Vauban », et
  // le slug de la source n'a évidemment pas le nom du sponsor.
  const sansParentheses = String(nom ?? "").replace(/\([^)]*\)/g, " ");
  return normNom(sansParentheses).split(" ").filter((m) => m.length > 2 && !VIDES.has(m));
}

/**
 * Mots qui décrivent le FORMAT, pas l'identité de la course.
 *
 * ⚠️ CE N'EST PAS UNE LISTE DE MOTS COURANTS, C'EST UNE LISTE DE MOTS INTERCHANGEABLES.
 * Notre catalogue écrit « Trail La Cépienne » là où la source écrit « la-cepienne » :
 * exiger le mot « trail » rejetait un appariement pourtant juste. À l'inverse « kids »,
 * « nocturne » ou « relais » ne sont PAS de ce genre — ce sont eux qui séparent deux
 * épreuves d'un même week-end, et ils restent obligatoires. Mal remplir cette liste
 * rouvre exactement la faille qu'on vient de fermer : n'y mettre qu'un mot dont
 * l'absence ne change rien à l'épreuve désignée.
 */
//  ⚠️ « RANDONNEE » ET « MARCHE » N'EN SONT PAS, ET LES Y AVOIR MIS A COÛTÉ CHER.
//     « Randonnée de Sassenage » s'est retrouvée appariée à « Corrida de Sassenage » :
//     une fois « randonnee » traité comme un mot de genre, il ne restait que le nom de
//     la ville pour identifier l'épreuve. Or une randonnée et une corrida ne sont pas
//     deux façons de dire la même chose — ce sont deux événements distincts, un jour
//     différent, un public différent. Le critère à appliquer est celui écrit plus haut :
//     un mot n'est de genre que si son absence ne change pas L'ÉPREUVE DÉSIGNÉE.
const GENRES = new Set(["trail", "course", "courses", "nature", "marathon", "semi", "run", "running"]);

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
  course: { name: string; date: string; city?: string },
): string | null {
  const annee = String(course.date ?? "").slice(0, 4);
  if (!/^20\d{2}$/.test(annee)) return null;
  const mots = motsCles(course.name);
  // Les mots de genre peuvent manquer du slug ; tous les autres sont obligatoires. Une
  // course qui n'aurait QUE des mots de genre (« Trail Nature ») n'identifie rien : on
  // refuse plutôt que d'apparier au premier trail venu de la même ville.
  const obligatoires = mots.filter((m) => !GENRES.has(m));
  if (!obligatoires.length) return null;
  // ⚠️ QUAND LA VILLE EST LE SEUL MOT IDENTIFIANT, LE MOT DE GENRE REDEVIENT OBLIGATOIRE.
  //    Toutes les fiches rendues concernent déjà cette ville : exiger son nom dans le slug
  //    ne filtre rien. « Randonnée de Sassenage » n'avait plus que « sassenage » comme mot
  //    obligatoire et s'est appariée à « Corrida de Sassenage » — deux épreuves
  //    différentes, dont seul le mot de genre les sépare.
  //
  //    Mais refuser tout bonnement ces noms-là serait pire : « Trail de Gorbio », « Le
  //    Montagrier Trail » et « Semi-Marathon d'Antony » portent légitimement le nom de
  //    leur commune, et leurs fiches existent. Vérifié sur les trois : elles étaient
  //    rejetées à tort par une règle qui écartait la ville sans rien mettre à la place.
  //
  //    La règle juste est donc conditionnelle : le mot de genre n'est facultatif que tant
  //    qu'autre chose identifie l'épreuve. Dès qu'il est seul à le faire, il compte.
  const ville = motsCles(course.city ?? "");
  const distinctifs = obligatoires.filter((m) => !ville.some((v) => motProche(m, v)));
  const exiges = distinctifs.length ? obligatoires : mots;

  const retenus = (liens ?? []).filter((l) => {
    if (anneeDepuisUrl(l) !== annee) return false;
    // On ne compare QUE le segment de nom, jamais le chemin du sport (cf. segmentNom).
    const jetons = normNom(segmentNom(l)).split(" ").filter(Boolean);
    // ⚠️ TOUS LES MOTS SIGNIFICATIFS, PAS DEUX. Avec un seuil à deux, « KIDS trail
    //    d'Antibes » s'est apparié à la fiche « trail-d-antibes » : « trail » et
    //    « antibes » suffisaient, et le mot qui distingue les deux courses — « kids » —
    //    était ignoré. La course pour enfants a hérité d'un 40 km. Le mot en trop est
    //    précisément celui qui compte : c'est lui qui sépare l'épreuve jeunes de
    //    l'épreuve adulte, le nocturne du diurne, le relais de l'individuel.
    //    Exiger TOUS les mots réduit le nombre d'appariements — c'est le but : mieux
    //    vaut ne pas enrichir une course que l'enrichir avec les données d'une autre.
    //    Et on compare des MOTS ENTIERS, pas des fragments : « Les Foulées Lieu Saint
    //    Amandinoises » avait pris ses distances chez « Foulées Saint-Pierroises », à
    //    400 km, sur la seule foi de « foulees » et « saint ».
    return exiges.every((m) => jetons.some((j) => motProche(m, j)));
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
export function typePour(vu: TypeSportif, distanceKm: number | null): RaceType | null {
  if (vu === "inconnu") return null;
  const d = Number(distanceKm) || 0;
  if (!(d > 0)) return null;
  // ⚠️ LES DEUX NOMS QUE J'AVAIS ÉCRITS N'EXISTENT PAS. Cette fonction rendait
  // « road_half » et « road_marathon », absents de l'enum `race_type` de la base
  // ('road_5k','road_10k','semi','marathon','trail_s','trail_m','trail_l','trail_xl',
  // 'ultra'). PostgREST refusait l'insertion, le code ignorait l'erreur, et le compteur
  // n'augmentait pas : AUCUN semi ni marathon trouvé à la source n'a jamais pu être
  // ajouté, sans que rien ne le signale. C'est le défaut silencieux type : pas de
  // plantage, pas de trace, juste une donnée qui n'arrive jamais.
  if (vu === "trail") return correctedRaceType(d, "trail_s");
  if (d >= 40) return "marathon";
  if (d >= 19) return "semi";
  if (d >= 8) return "road_10k";
  return "road_5k";
}

export function typeCorrige(typeActuel: unknown, vu: TypeSportif, distanceKm: number | null): RaceType | null {
  const t = String(typeActuel ?? "");
  if (vu === "inconnu" || !t) return null;
  const estTrail = t.startsWith("trail");
  if (vu === "trail" && estTrail) return null;
  if (vu === "route" && !estTrail) return null;

  // Une seule table de correspondance : `correctedRaceType` fait foi pour les trails.
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
