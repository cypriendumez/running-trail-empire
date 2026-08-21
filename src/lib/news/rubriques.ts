/**
 * LES RUBRIQUES D'ACTUALITÉ — définies UNE FOIS.
 *
 * Elles servaient deux appelants qui ne se parlaient pas : l'agrégateur du fil Communauté
 * et la lettre du lundi. La lettre demandait une rubrique par son nom, sous forme de
 * chaîne libre ; une faute de frappe ne provoquait aucune erreur — la route retombait sur
 * la requête générale et renvoyait de l'actualité quelconque, présentée sous un titre de
 * rubrique. Une rubrique « Nutrition » remplie de tests de chaussures, sans un seul signe
 * que quelque chose clochait.
 *
 * Tout est donc ici, et les deux appelants importent la même chose.
 */

export type Cat = "all" | "running" | "trail" | "ultra" | "marathon" | "gear" | "nutrition" | "elite";

/** Requête Google News par rubrique (agrège des centaines de publications). */
export const QUERIES: Record<Cat, string> = {
  all: "course à pied OR trail running OR marathon",
  running: "course à pied running performance",
  trail: "trail running sentier",
  ultra: "ultra trail OR UTMB OR ultramarathon",
  marathon: "marathon course à pied",
  gear: "chaussures running test OR montre GPS running",
  // Ces deux rubriques ne figurent pas dans les onglets du fil Communauté : elles servent
  // la lettre du lundi, qui doit couvrir la nutrition et les résultats d'élite.
  nutrition: "nutrition course à pied OR alimentation coureur OR hydratation trail",
  elite: "résultats ultra-trail OR élite trail running OR record marathon",
};

export const estCat = (v: unknown): v is Cat =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(QUERIES, v);

/**
 * FILTRE THÉMATIQUE — seulement pour les rubriques ÉTROITES.
 *
 * Un flux entre dans une rubrique EN BLOC : tous ses articles, pas seulement ceux qui
 * parlent du sujet. C'est sans conséquence pour « running » ou « trail », assez larges
 * pour tout accueillir. Ça ne l'est pas pour « nutrition » : Marathon Handbook publie de
 * l'alimentation ET des tests de chaussures. On ne garde donc, pour ces deux rubriques
 * seulement, que les titres qui traitent vraiment du sujet — quitte à en renvoyer peu,
 * ce que l'appelant sait gérer (une rubrique vide ne s'affiche pas).
 */
export const FILTRES: Partial<Record<Cat, RegExp>> = {
  // ⚠️ Le vocabulaire de la nutrition CHEVAUCHE celui de la chaussure, et trois pièges
  // ont failli passer : « carb » est dans « carbon plate », « gel » est dans le GEL-Kayano
  // d'Asics, « fuel » est dans le FuelCell de New Balance — trois des modèles les plus
  // testés de la presse running. La rubrique Nutrition se serait remplie de chaussures.
  // D'où : « carb » seulement en mot entier, « gel » seulement en « energy gel », et
  // « fuel » en mot entier (FuelCell n'a pas de coupure de mot après « fuel »).
  // Même piège en français : « jeûne » s'écrit avec un accent circonflexe, « jeune » non —
  // sans l'accent, « le jeune coureur » atterrissait en nutrition.
  nutrition:
    /nutrition|alimentation|aliment|hydrat|glucide|carbohydrate|\bcarbs?\b|prot[ée]in|energy gels?|ravitaillement|boisson|\bfuel(l?ing)?\b|calorie|di[èe]te|estomac|intestin|vitamin|sucre|[ée]lectrolyte|electrolyte|je[û]ne|micronutri|caf[ée]ine|caffeine|\\brepas\\b|d[îi]ner|petit[- ]d[ée]jeuner|collation|grignot/i,
  // « Matériel » n'avait pas de filtre, et Runner's World y déversait tout : la rubrique
  // a affiché « Jenny Simpson met fin à sa carrière après un arrêt cardiaque » sous le
  // titre « Matériel & chaussures ». ⚠️ Exiger un mot générique ne suffit PAS : un test
  // de chaussure s'intitule souvent par le seul nom du modèle (« Nnormal Kjerag 02 Keeps
  // the Kilian-Level Agility »). Les marques font donc partie du filtre.
  gear:
    /chaussure|\bshoes?\b|sneaker|basket|montre|\bwatch\b|cardio|capteur|\btests?\b|comparatif|mat[ée]riel|[ée]quipement|\bgear\b|review|semelle|midsole|outsole|\bdrop\b|carbon plate|\bfoam\b|\bsacs?\b|b[âa]tons?\b|veste|nike|adidas|asics|hoka|salomon|saucony|brooks|new balance|altra|la sportiva|nnormal|mizuno|\bpuma\b|garmin|coros|suunto|polar|merrell|inov-?8|dynafit|topo athletic|scarpa|vaporfly|alphafly|kayano|nimbus|speedgoat/i,
  elite:
    /jornet|walmsley|dauwalter|kipchoge|record|championnat|mondiaux|world championship|vainqueur|remporte|\bwins\b|victoire|podium|r[ée]sultats?|results|utmb|western states|golden trail|diamond league|olympi|champion/i,
};

/**
 * LE SOMMAIRE DE LA LETTRE DU LUNDI, dans l'ordre d'affichage.
 *
 * `cle` est le libellé traduit (voir `lib/newsletter/email`), `cat` la rubrique
 * d'actualité à interroger, `max` le nombre d'articles retenus.
 *
 * ⚠️ La somme des `max` ne doit JAMAIS dépasser le plafond du résumeur : au-delà, les
 * derniers articles ne sont pas seulement privés de résumé, ils sortaient carrément du
 * rendu et la rubrique correspondante disparaissait sans un mot. Un test vérifie
 * l'inégalité, et le résumeur rend désormais tout ce qu'il reçoit.
 */
export const RUBRIQUES_LETTRE = [
  { cle: "une", cat: "all", max: 5 },
  { cle: "trail", cat: "trail", max: 3 },
  { cle: "elite", cat: "elite", max: 3 },
  { cle: "materiel", cat: "gear", max: 3 },
  { cle: "nutrition", cat: "nutrition", max: 2 },
] as const satisfies readonly { cle: string; cat: Cat; max: number }[];
