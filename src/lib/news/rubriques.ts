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

export type Cat = "all" | "running" | "trail" | "ultra" | "marathon" | "gear" | "nutrition" | "elite" | "conseils";

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
  // Pour la lettre seulement, comme les deux précédentes : ce que cherche un coureur qui
  // s'entraîne avec Pacevo (voir la rubrique « Conseils » de `RUBRIQUES_LETTRE`).
  conseils: "conseils entraînement course à pied OR plan d'entraînement running",
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
  // ⚠️ LA RUBRIQUE QUI MANQUAIT (10/11/2026). Cyprien : « c'est les meilleurs articles que
  // tu pourrais faire ? ça concerne vraiment mon type de client ? ». La lettre parlait
  // d'événements, de faits divers et de matériel, jamais de ce qu'un coureur qui
  // s'entraîne avec un coach cherche d'abord : comment progresser, récupérer, éviter la
  // blessure. Le titre doit le dire, en français ou en anglais.
  conseils:
    /entra[îi]nement|conseils?\b|comment (courir|progresser|pr[ée]parer|r[ée]cup|am[ée]liorer|bien|[ée]viter|g[ée]rer|reprendre)|allure|fractionn|\bvma\b|r[ée]cup[ée]ration|blessure|tendinite|p[ée]riostite|[ée]chauffement|renforcement|[ée]tirement|sortie longue|pr[ée]parer (un|son|sa|le|la|votre|ton)|plan d.entra|\bseuil\b|endurance fondamentale|\btraining\b|how to|\btips?\b|workouts?|(easy|race|marathon|your) pace|injur|recovery|strength|stretch|tempo run|intervals?\b|long run|cadence/i,
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
    /jornet|walmsley|dauwalter|kipchoge|record|championnat|mondiaux|world championship|vainqueur|remporte|\bwins?\b|\bwon\b|s.impose|\bgagne|triomphe|victoire|podium|r[ée]sultats?|results|utmb|western states|golden trail|diamond league|olympi|champion/i,
};

/**
 * Ce qui ressemble à un résultat sans en être un : le « record » d'une course qui
 * accueille plus de monde que l'an passé. Vu la semaine du 9/11/2026 (« la 25e édition
 * bat son record de participants », « une troisième édition record ») dans « Élites ».
 */
export const PAS_ELITE = /record de (participants|participation|fr[ée]quentation|coureurs|dossards)|[ée]dition record/i;

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
  { cle: "conseils", cat: "conseils", max: 3 },
  { cle: "trail", cat: "trail", max: 3 },
  { cle: "elite", cat: "elite", max: 3 },
  { cle: "materiel", cat: "gear", max: 3 },
  { cle: "nutrition", cat: "nutrition", max: 2 },
] as const satisfies readonly { cle: string; cat: Cat; max: number }[];

/**
 * LA NUTRITION DU COUREUR, PAS CELLE DE TOUT LE MONDE.
 *
 * Les requêtes Google Actualités de la semaine du 9/11/2026 ramenaient, à côté des
 * « trois conseils d'un coach » du marathon de La Baule, la charcuterie moins salée, la
 * ménopause et la conservation des pommes de terre : tous passent `FILTRES.nutrition`.
 * Un article de la rubrique doit donc AUSSI parler de course ou d'effort.
 */
export const CONTEXTE_COURSE =
  /\bcour(se|ses|ir|eur|eurs|euse|euses)\b|running|runner|\btrail|marathon|ultra|endurance|sporti(f|ve)s?|\bsport\b|athl[èe]te|athlete|entra[îi]nement|training|exercise|effort|\brace\b/i;

/**
 * Une promotion n'est pas un article : « ce gilet Salomon […] perd 50 € » (L'Équipe,
 * 9/11/2026) passait le filtre nutrition par le mot « hydratation ».
 *
 * ⚠️ Elle s'applique à TOUTES les rubriques depuis le 10/11/2026 : « Traileuses longue
 * distance, -26 % sur la chaussure de trail Asics Trabuco Max 5 » (Le Télégramme) ouvrait
 * la rubrique « Trail & ultra ». La requête « matériel » de la semaine en ramenait une
 * vingtaine sous toutes les formes : un prix (« à 323,74 € »), « tombe à », « dérapent
 * de 270 à 120 € », « à saisir », « moins cher », « 11.11 d'AliExpress », « Single Day ».
 * Un PRIX (« à 199 € », « 228,93 € ») signale une offre. Pas une SOMME : « la cagnotte
 * atteint 100 000 € » est une information, et doit rester visible à la une.
 */
export const PROMO =
  /perd \d+\s?€|-\s?\d+\s?%|\bpromo|soldes|bon plan|black friday|single day|\b11\.11\b|\bprix (cass|barr)|\d+,\d{2}\s?€|\bà \d+\s?€|tombe à|chute de|d[ée]rap|[àa] saisir|moins ch[eè]re?|r[ée]serves s.[ée]puisent|\boffre/i;

/**
 * Un TEST de matériel, pas un catalogue : la presse française publie surtout des
 * sélections commerciales. « Matériel & chaussures » garde les tests, comparatifs et avis.
 */
export const TEST_MATERIEL = /\btests?\b|test ?:|comparatif|\bavis\b|\bessai\b|on a test|j.ai test|review|\bvs\.?\b/i;

/** Hors course à pied, même quand le vocabulaire y ressemble (« un ensemble de ski technique »). */
export const HORS_COURSE = /\bski\b|alpinisme|euroligue|\bnba\b|blazers|\bfootball\b|\brugby\b|\bxv de france\b|\btennis\b|\bhandball\b|\bcodes?\b|\bcyclisme\b|\bcyclistes?\b/i;

/**
 * LA COURSE À PIED, ET RIEN D'AUTRE : pour « Conseils », plus strict que `CONTEXTE_COURSE`.
 *
 * ⚠️ `CONTEXTE_COURSE` contient « entraînement », « effort », « sport » : il convient à
 * Nutrition (un aliment n'a pas d'entraînement), pas à une rubrique dont le filtre cherche
 * justement « entraînement ». Le 10/11/2026, « William Saliba de retour à l'entraînement »
 * (football) et « Paul Boudehent ménagé à l'entraînement » (XV de France) y entraient.
 */
export const COURSE_A_PIED =
  /\bcour(se|ses|ir|eur|eurs|euse|euses)\b|running|runner|\btrail|marathon|\bultra|\bsemi\b|\bvma\b|fractionn|allure|footing|\b(5|10|21|42) ?km\b/i;

/**
 * Ce qui a le vocabulaire d'un conseil sans en être un : les classements de produits
 * (« The Best Heart Rate Monitors Give You the Most Accurate Training Data ») et les
 * statistiques d'une course (« Where Runners' Pace Broke at the New York City Marathon »).
 */
export const PAS_CONSEIL = /\bbest\b|meilleur(e)?s\b|where runners|\bfield by\b|who passed|finished (the|after)/i;
