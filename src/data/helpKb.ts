// ─────────────────────────────────────────────────────────────────────────────
//  BASE DE CONNAISSANCES DU SUPPORT — la seule source de vérité de l'assistant.
//
//  POURQUOI CE FICHIER EXISTE
//  Un modèle de langage à qui l'on demande « comment connecter ma montre ? » invente un
//  chemin plausible : « Réglages › Appareils › Ajouter ». L'écran n'existe pas, la
//  réponse est fluide, l'utilisateur cherche dix minutes puis conclut que l'app est
//  cassée. Rien n'a planté, personne n'a vu passer d'erreur — le profil exact des défauts
//  silencieux de l'audit, appliqué à l'aide en ligne.
//
//  L'assistant n'a donc PAS le droit d'inventer un chemin : il ne cite que ce qui est
//  écrit ici, et dit « je ne sais pas » sinon. Ce fichier est écrit à partir du code
//  (Sidebar.tsx pour la navigation, les routes réelles pour les comportements) et doit
//  être mis à jour EN MÊME TEMPS que l'app — un test vérifie que chaque chemin cité
//  correspond à une page qui existe vraiment.
// ─────────────────────────────────────────────────────────────────────────────

export type HelpPage = {
  path: string;
  /**
   * Clé de traduction du libellé de menu (`nav.*` dans translations.ts).
   *
   * Sans elle, l'assistant citait le nom FRANÇAIS de la page à un utilisateur allemand :
   * « Du kannst die Sprache in den Paramètres ändern » — alors que sa barre latérale
   * affiche « Einstellungen ». Un chemin exact mais introuvable à l'écran est aussi
   * inutile qu'un chemin inventé. `/pricing` n'est pas dans le menu : pas de clé.
   */
  navKey?: string;
  name: string;
  what: string;
};

/** Carte du site. Chaque `path` DOIT correspondre à un dossier réel de src/app. */
export const HELP_PAGES: HelpPage[] = [
  { path: "/dashboard", navKey: "nav.dashboard", name: "Tableau de bord", what: "Vue d'ensemble : forme du jour, charge, séance du jour, prédictions de chrono, tendance de volume." },
  { path: "/dashboard/calendrier", navKey: "nav.calendar", name: "Calendrier", what: "Le plan préparé par le coach, en vue Mois ou Agenda. Cliquer un jour ouvre le détail de la séance (échauffement, corps, retour au calme, le POURQUOI). Un bandeau « pourquoi ce plan » explique les décisions de la semaine et rappelle l'objectif de course." },
  { path: "/dashboard/races", navKey: "nav.races", name: "Courses", what: "Recherche de courses (~17 000 épreuves), carte, filtres par distance et région. Le bouton « M'entraîner pour cette course » fixe l'objectif et régénère aussitôt le plan." },
  { path: "/dashboard/trail", navKey: "nav.trail", name: "Trail Builder", what: "Construction et exploration de parcours trail." },
  { path: "/dashboard/ghost-runner", navKey: "nav.ghost", name: "Ghost Runner", what: "Comparaison de l'allure à un adversaire virtuel calé sur l'objectif." },
  { path: "/dashboard/cours", navKey: "nav.courses", name: "Cours", what: "Contenus pédagogiques sur l'entraînement." },
  { path: "/dashboard/health", navKey: "nav.health", name: "Santé", what: "Cinq onglets — voir la liste TRADUITE ci-dessous : chat kiné avec schéma corporel (accepte les photos), journal, contact d'urgence, nutrition de course, suivi du poids." },
  { path: "/dashboard/messages", navKey: "nav.messaging", name: "Messagerie", what: "Échange avec le coach humain." },
  { path: "/dashboard/sync", navKey: "nav.sync", name: "Sync Montre", what: "Connexion à intervals.icu (identifiant athlète + clé API) : c'est par là que les activités entrent et que les séances partent vers la montre." },
  { path: "/dashboard/communaute", navKey: "nav.community", name: "Communauté", what: "Actualité running agrégée." },
  { path: "/dashboard/leagues", navKey: "nav.leagues", name: "Ligues", what: "Classements et progression par ligue." },
  { path: "/dashboard/shop", navKey: "nav.shop", name: "Boutique", what: "Équipement. Elle n'affiche que de VRAIES offres importées d'un flux marchand ; tant qu'aucun flux n'est branché, un écran d'attente s'affiche à la place — ce n'est pas une panne." },
  { path: "/dashboard/profile", navKey: "nav.profile", name: "Profil", what: "Âge, taille, poids, sexe, passif de course, terrains, disponibilités, santé (pathologies et zones de blessure), durées d'échauffement et de retour au calme." },
  { path: "/dashboard/settings", navKey: "nav.settings", name: "Paramètres", what: "Langue, unités, début de semaine, préférences d'affichage." },
  { path: "/pricing", name: "Abonnement", what: "Formules et tarifs." },
];

/**
 * Libellés RÉELS des onglets de la page Santé, par langue.
 *
 * Ils vivent dans le dictionnaire local de `HealthCenter.tsx` (clés `tab.*`), donc hors
 * du fichier global de traductions. Sans cette copie, l'assistant recopiait le nom
 * français de la base de connaissances : « no separador "Poids" » à un lusophone dont
 * l'onglet affiche « Peso ». Une consigne de traduction ne suffit pas — le modèle reprend
 * ce qu'il lit.
 *
 * Un test vérifie que chacun de ces libellés existe réellement dans HealthCenter.tsx :
 * deux sources de vérité ne peuvent pas diverger sans être signalées.
 */
export const HEALTH_TABS: Record<string, string[]> = {
  fr: ["Kiné IA", "Journal", "Guardian", "Nutrition", "Poids"],
  en: ["AI Physio", "Journal", "Guardian", "Nutrition", "Weight"],
  de: ["KI-Physio", "Tagebuch", "Guardian", "Ernährung", "Gewicht"],
  es: ["Fisio IA", "Diario", "Guardian", "Nutrición", "Peso"],
  pt: ["Fisio IA", "Diário", "Guardian", "Nutrição", "Peso"],
};

/** Comportements réels de l'app. Chaque entrée décrit CE QUI SE PASSE, pas une intention. */
export const HELP_FACTS: string[] = [
  "COACH AUTONOME : le plan couvre 7 jours glissants et se recalcule TOUTES LES NUITS (vers 3 h 30 UTC), ainsi qu'à chaque changement d'objectif de course et à chaque synchronisation d'activités. L'athlète n'a rien à déclencher.",
  "MONTRE : seuls les 5 PREMIERS jours du plan sont envoyés vers la montre. Les jours suivants restent prévisionnels et peuvent changer — les pousser encombrerait la montre de séances qui vont être corrigées.",
  "MONTRE — POINT CRUCIAL : la dernière étape (intervals.icu → Garmin Connect → montre) passe par le BLUETOOTH DU TÉLÉPHONE. Aucun serveur ne peut la déclencher. Si une séance n'apparaît pas sur la montre, il faut ouvrir Garmin Connect sur le téléphone, montre à proximité, et laisser la synchronisation se faire.",
  "VOLUME : seule la COURSE À PIED compte dans le volume d'entraînement. Randonnée, marche et vélo sont exclus du kilométrage — mais ils comptent dans la CHARGE (fatigue). C'est voulu : une randonnée de 1 000 m de dénivelé fatigue réellement sans être de la course.",
  "VMA : si aucun test n'est enregistré, elle est ESTIMÉE à partir des meilleures séances récentes, et l'écran indique qu'il s'agit d'une estimation. Sans aucune séance importée, il n'y a pas de VMA — et donc pas d'allures cibles.",
  "SÉANCES DE QUALITÉ : leur nombre est plafonné par le verdict de fraîcheur du jour (VFC, sommeil, ratio de charge, douleur signalée), par le passif de course (moins de 3 ans → 2 séances dures maximum par semaine) et par les pathologies déclarées. Une semaine sans fractionné n'est pas un oubli : le bandeau « pourquoi ce plan » du calendrier en donne la raison chiffrée.",
  "OBJECTIF DE COURSE : il se fixe depuis la carte Objectif du tableau de bord ou depuis « M'entraîner pour cette course » dans Courses. Le changer purge les séances automatiques à venir et régénère le plan dans la foulée.",
  "MODE POIDS (Santé › Poids) : le SUIVI (pesées, tendance, dépense, protéines) est disponible sans rien activer. Seul l'OBJECTIF DE PERTE demande une activation volontaire. Il est refusé si l'IMC est inférieur à 20, avant 18 ans, ou si une grossesse est déclarée ; entre 20 et 21 d'IMC il passe en maintien sans déficit.",
  "TENDANCE DE POIDS : elle n'apparaît qu'à partir de 4 pesées réparties sur au moins 2 semaines, la dernière datant de moins de 21 jours. En dessous, l'app affiche « pas encore mesurable » plutôt qu'un chiffre — l'écart entre deux pesées, c'est de l'hydratation, pas de la graisse.",
  "KINÉ IA : le chat accepte une photo. Elle est analysée puis oubliée — elle n'est enregistrée NULLE PART. Une photo permet de voir un gonflement, une asymétrie, l'état de la peau ou l'usure d'une semelle ; elle ne permet ni de palper, ni de distinguer une périostite d'une fracture de fatigue.",
  "ABONNEMENT : le paiement n'est pas encore ouvert. Le message « le paiement n'est pas encore ouvert » est le comportement attendu, pas une panne.",
  "LANGUES : l'interface existe en français, anglais, allemand, espagnol et portugais. Elle se change dans Paramètres. Certaines analyses rédigées par l'IA peuvent encore revenir en français.",
  "DONNÉES MANQUANTES : quand une information manque, l'app le DIT au lieu d'afficher un chiffre plausible. Un « — » ou un « pas encore mesurable » est un choix, pas un bug.",
];

/** Problèmes fréquents → la cause RÉELLE et la marche à suivre. */
export const HELP_PROBLEMS: { q: string; a: string }[] = [
  { q: "Mes séances n'arrivent pas sur ma montre",
    a: "Trois causes possibles, dans l'ordre : (1) la synchronisation Garmin passe par le Bluetooth du téléphone — ouvre Garmin Connect, montre à proximité ; (2) seuls les 5 premiers jours du plan sont poussés, une séance dans 6 jours n'y est pas encore ; (3) les identifiants intervals.icu sont absents ou périmés — vérifie dans Sync Montre." },
  { q: "Mes activités n'apparaissent pas dans l'app",
    a: "L'import passe par intervals.icu. Vérifie dans Sync Montre que l'identifiant athlète et la clé API sont renseignés et valides. Si la clé a été régénérée côté intervals.icu, il faut la re-saisir ici." },
  { q: "Le coach ne me donne aucune séance de fractionné",
    a: "C'est presque toujours volontaire. Le calendrier affiche un bandeau « pourquoi ce plan » avec la raison chiffrée : fatigue (ratio de charge élevé, TSB très négatif, VFC basse, mauvaise nuit), douleur signalée, ou plafond lié au passif de course. L'intensité revient d'elle-même quand le signal redescend." },
  { q: "Mon kilométrage me semble faux",
    a: "Seule la course à pied entre dans le volume. Les randonnées, marches et sorties vélo en sont exclues volontairement — sinon une semaine de randonnée ferait proposer une sortie longue démesurée. Ces activités comptent en revanche dans la fatigue." },
  { q: "Je n'ai pas d'allure cible sur mes séances",
    a: "Les allures se calculent depuis la VMA. Sans séance importée, la VMA ne peut pas être estimée et aucune allure n'est affichée — c'est délibéré : mieux vaut aucune allure qu'une allure inventée. Elles apparaîtront dès les premières activités synchronisées." },
  { q: "Je ne peux pas m'abonner / le paiement ne fonctionne pas",
    a: "Le paiement n'est pas encore ouvert. Ce n'est pas une panne de ton côté." },
  { q: "La boutique est vide",
    a: "Elle n'affiche que de vraies offres importées d'un flux marchand officiel. Tant qu'aucun flux n'est branché, un écran d'attente s'affiche — choix assumé plutôt qu'un catalogue aux prix inventés." },
  { q: "Mon objectif de course n'a rien changé à mes séances",
    a: "Le type des séances change bien (par exemple Seuil et Allure marathon au lieu de VMA), mais le VOLUME reste calé sur ce que tu cours réellement. Et si la fatigue est élevée, aucune séance de qualité n'est posée cette semaine-là, ce qui donne l'impression que rien n'a bougé. Le bandeau « pourquoi ce plan » du calendrier détaille l'état réel." },
  { q: "Comment supprimer mon compte ou mes données",
    a: "Depuis Paramètres. Pour toute demande relative aux données personnelles, la page Confidentialité indique la marche à suivre." },
];
