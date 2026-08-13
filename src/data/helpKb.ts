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
  /**
   * Mots-clés du REPLI sans IA : ce que les gens tapent réellement, qui n'est presque
   * jamais le nom de la page. Le fuzz a montré que « où je vois mon poids » ne trouvait
   * rien — deux mots utiles ne peuvent pas atteindre le seuil sur le seul nom « Santé ».
   */
  keys?: string[];
  /**
   * CHEMIN DE CLICS exact, de l'écran d'accueil jusqu'à l'endroit précis.
   *
   * Sans lui, l'assistant répondait « tu peux changer la langue dans Paramètres » : exact,
   * mais l'utilisateur ne sait toujours pas où cliquer. Lui demander d'être plus détaillé
   * sans lui donner la structure de la page reviendrait à l'inviter à l'inventer — ce que
   * tout le reste de ce fichier s'emploie à empêcher.
   */
  how?: string;
  /**
   * Dossier réel sous `src/app` quand il diffère de l'URL : groupe de routes `(auth)`,
   * segment dynamique `[id]`. Sans ce champ, le test d'existence chercherait
   * `src/app/login/page.tsx` et échouerait sur une page pourtant bien présente.
   */
  dir?: string;
  name: string;
  what: string;
};

/** Carte du site. Chaque `path` DOIT correspondre à un dossier réel de src/app. */
export const HELP_PAGES: HelpPage[] = [
  { path: "/dashboard", how: "Barre latérale gauche › Tableau de bord, ou le logo Pacevo en haut à gauche.", keys: ["forme", "charge", "resume", "accueil", "apercu", "dashboard", "tableau", "bord"], navKey: "nav.dashboard", name: "Tableau de bord", what: "Vue d'ensemble : forme du jour, charge, séance du jour, prédictions de chrono, tendance de volume." },
  { path: "/dashboard/calendrier", how: "Barre latérale gauche › Calendrier. Bascule Mois / Agenda en haut à droite ; cliquer un jour ouvre le détail de la séance dans le bandeau vert du haut.", keys: ["calendrier", "seance", "seances", "plan", "semaine", "programme", "calendar", "planning", "entrainement"], navKey: "nav.calendar", name: "Calendrier", what: "Le plan préparé par le coach, en vue Mois ou Agenda. Cliquer un jour ouvre le détail de la séance (échauffement, corps, retour au calme, le POURQUOI). Un bandeau « pourquoi ce plan » explique les décisions de la semaine et rappelle l'objectif de course." },
  { path: "/dashboard/races", how: "Barre latérale gauche › Courses. Filtres de distance et de région en haut ; sur la fiche d'une course, le bouton « M'entraîner pour cette course » fixe l'objectif.", keys: ["course", "courses", "race", "inscription", "epreuve", "marathon", "trail", "chercher", "trouver"], navKey: "nav.races", name: "Courses", what: "Recherche de courses (~17 000 épreuves), carte, filtres par distance et région. Le bouton « M'entraîner pour cette course » fixe l'objectif et régénère aussitôt le plan." },
  { path: "/dashboard/trail", how: "Barre latérale gauche › Trail Builder.", keys: ["parcours", "trail", "carte", "itineraire", "suivi", "direct", "partager", "position", "proche"], navKey: "nav.trail", name: "Trail Builder", what: "Exploration et construction de parcours trail sur carte, avec profil de dénivelé. C'est aussi d'ici que se génère le lien de SUIVI EN DIRECT à partager à un proche." },
  { path: "/dashboard/ghost-runner", how: "Barre latérale gauche › Ghost Runner.", keys: ["ghost", "fantome", "adversaire", "virtuel", "comparer"], navKey: "nav.ghost", name: "Ghost Runner", what: "Adversaire virtuel calé sur l'allure de l'objectif de course : sert à visualiser l'écart entre l'allure tenue et celle qu'il faudrait tenir le jour J." },
  { path: "/dashboard/cours", how: "Barre latérale gauche › Cours.", keys: ["cours", "apprendre", "pedagogie", "physiologie", "formation"], navKey: "nav.courses", name: "Cours", what: "Contenus pédagogiques sur l'entraînement (physiologie, allures, planification), avec un chat pour poser des questions sur le cours." },
  { path: "/dashboard/health", how: "Barre latérale gauche › Santé, puis choisir l'onglet voulu dans la rangée du haut (Kiné IA, Journal, Guardian, Nutrition, Poids).", keys: ["sante", "poids", "pesee", "peser", "balance", "imc", "blessure", "douleur", "mal", "kine", "physio", "journal", "guardian", "nutrition", "ravitaillement", "weight", "pain", "gesundheit", "salud", "saude"], navKey: "nav.health", name: "Santé", what: "Regroupe cinq espaces : le chat Kiné IA avec schéma corporel (il accepte les photos), le journal d'entraînement, le contact d'urgence Guardian, la nutrition de course et le suivi du poids." },
  { path: "/dashboard/messages", how: "Barre latérale gauche › Messagerie.", keys: ["message", "messagerie", "coach", "ecrire", "contacter", "discuter", "humain"], navKey: "nav.messaging", name: "Messagerie", what: "Échange avec le coach humain." },
  { path: "/dashboard/sync", how: "Barre latérale gauche › Sync Montre. Coller l'identifiant athlète et la clé API d'intervals.icu, puis enregistrer. Le guide en 4 étapes et le dépôt de fichier GPX / FIT se trouvent sur la même page.", keys: ["montre", "garmin", "watch", "uhr", "reloj", "relogio", "sync", "synchro", "synchronisation", "intervals", "icu", "cle", "api", "connecter", "appairer", "strava", "polar", "coros", "suunto", "gpx", "fit", "importer", "fichier"], navKey: "nav.sync", name: "Sync Montre", what: "Connexion à intervals.icu (identifiant athlète + clé API) : c'est par là que les activités entrent et que les séances partent vers la montre. La page contient un guide pas à pas en 4 étapes et permet aussi d'importer un fichier GPX ou FIT à la main." },
  { path: "/dashboard/communaute", how: "Barre latérale gauche › Communauté.", keys: ["communaute", "actualite", "news", "feed", "articles"], navKey: "nav.community", name: "Communauté", what: "Fil d'actualité running agrégé depuis des sources publiques. La visibilité de son profil s'y règle dans Paramètres › Confidentialité." },
  { path: "/dashboard/trophees", how: "Barre latérale gauche › Vitrine.", keys: ["trophee", "trophees", "vitrine", "record", "records", "medaille", "palier", "serie", "chrono", "personnel", "pr", "badge", "trophy", "achievement"], navKey: "nav.trophies", name: "Vitrine", what: "Trophées calculés sur les séances réellement enregistrées : chronos de référence (5 km, 10 km, semi, marathon), records personnels, paliers de distance et de dénivelé cumulés, plus longue série de semaines, meilleure semaine. Rien n'est offert d'avance : un chrono n'apparaît que si une sortie a VRAIMENT couvert la distance, et un palier que s'il est atteint. Ils se recalculent à chaque visite, donc une séance corrigée met la vitrine à jour." },
  { path: "/dashboard/survol", how: "Barre latérale gauche › Survol 3D. Choisir une sortie dans la rangée du bas, puis appuyer sur Lecture.", keys: ["survol", "3d", "flyover", "rejouer", "rediffusion", "relief", "video", "cinematique", "camera"], navKey: "nav.flyover", name: "Survol 3D", what: "Rejoue une sortie vue du ciel, avec le relief du terrain : la caméra suit la trace GPS et les compteurs (allure, altitude, distance) défilent. GRATUIT et sans abonnement — c'est une fonction payante chez Strava, elle ne l'est pas ici. Exige que la trace GPS ait été importée ; l'altitude ne s'affiche que si la trace en porte une." },
  { path: "/dashboard/heatmap", how: "Barre latérale gauche › Carte de chaleur.", keys: ["chaleur", "heatmap", "carte", "trace", "traces", "gps", "parcours", "habitudes", "ou je cours"], navKey: "nav.heatmap", name: "Carte de chaleur", what: "Superposition de TOUTES les traces GPS importées : plus une portion est parcourue, plus elle chauffe (vert → ambre → rouge). Le comptage se fait par petite maille et une même sortie ne compte qu'une fois par maille, pour qu'un arrêt au feu rouge ne crée pas un point brûlant. Exige que les traces aient été importées depuis intervals.icu." },
  { path: "/dashboard/segments", how: "Barre latérale gauche › Segments.", keys: ["segment", "segments", "portion", "classement", "record", "maitre", "legende", "local", "legend", "kom", "chrono", "leaderboard"], navKey: "nav.segments", name: "Segments", what: "Portions de parcours DÉTECTÉES automatiquement dans les traces GPS : une portion ne devient un segment que si elle a été parcourue plusieurs fois. Chaque segment affiche son record, le classement, le temps personnel et le « Maître du segment » — celui qui l'a parcouru le plus souvent sur les 90 derniers jours (c'est la régularité qui est récompensée, pas la vitesse). Les segments exigent que les traces GPS aient été importées depuis intervals.icu." },
  { path: "/dashboard/leagues", how: "Barre latérale gauche › Ligues.", keys: ["ligue", "ligues", "classement", "league", "ranking", "points", "xp", "gamification"], navKey: "nav.leagues", name: "Ligues", what: "Classements hebdomadaires et progression par ligue. Pour ne pas y apparaître, décocher la visibilité dans Paramètres › Confidentialité." },
  { path: "/dashboard/shop", how: "Barre latérale gauche › Boutique.", keys: ["boutique", "shop", "chaussures", "equipement", "materiel", "acheter", "produits"], navKey: "nav.shop", name: "Boutique", what: "Équipement. Elle n'affiche que de VRAIES offres importées d'un flux marchand ; tant qu'aucun flux n'est branché, un écran d'attente s'affiche à la place — ce n'est pas une panne." },
  { path: "/dashboard/profile", how: "Barre latérale gauche, tout en bas › Profil. Les champs sont regroupés par blocs : identité, pratique, terrains, disponibilités, santé, échauffement / retour au calme. Ne pas oublier d'enregistrer.", keys: ["profil", "age", "taille", "poids", "sexe", "echauffement", "retour", "calme", "disponibilites", "terrains", "passif", "pathologie"], navKey: "nav.profile", name: "Profil", what: "Âge, taille, poids, sexe, passif de course, terrains, disponibilités, santé (pathologies et zones de blessure), durées d'échauffement et de retour au calme." },
  { path: "/dashboard/settings", how: "Barre latérale gauche, tout en bas › Paramètres. On y trouve la langue, les unités, le premier jour de la semaine, les préférences de notification et la confidentialité.", keys: ["parametres", "reglages", "langue", "unites", "miles", "semaine", "notifications", "confidentialite", "settings", "einstellungen", "ajustes", "definicoes", "supprimer", "compte"], navKey: "nav.settings", name: "Paramètres", what: "Langue, unités, début de semaine, préférences d'affichage." },
  { path: "/dashboard/activite", how: "Depuis le Tableau de bord, cliquer sur une activité de la liste. Il n'y a pas d'entrée de menu : on y accède toujours par une séance.", keys: ["detail", "activite", "seance", "metriques", "tours", "zones", "courbes", "analyse"], dir: "dashboard/activite", name: "Détail d'une séance", what: "Toutes les données d'une séance réalisée : métriques, zones de fréquence cardiaque, courbes, tours. On y arrive en CLIQUANT une activité depuis le tableau de bord — ce n'est pas une entrée du menu, et l'adresse exige une date." },
  { path: "/suivre/<identifiant>", how: "Depuis Trail Builder, générer le lien de suivi puis l'envoyer au proche. Il ouvre la page dans son navigateur, sans compte ni installation.", keys: ["suivi", "direct", "live", "partager", "position", "famille", "proche", "femme", "mari", "tracker"], dir: "suivre/[id]", name: "Suivi en direct", what: "Page PUBLIQUE (accessible sans compte) permettant à un proche de suivre le coureur en temps réel. Le lien se génère depuis Trail Builder ; toute personne qui l'a peut voir la position." },
  { path: "/onboarding", how: "S'affiche automatiquement après l'inscription, et tant qu'il n'est pas terminé.", keys: ["onboarding", "inscription", "questionnaire", "demarrage", "refaire"], dir: "onboarding", name: "Onboarding", what: "Questionnaire d'inscription : profil, passif de course, terrains, disponibilités, santé. Il se rejoue automatiquement tant qu'il n'est pas terminé." },
  { path: "/login", how: "Bouton de connexion depuis la page d'accueil publique.", keys: ["connexion", "connecter", "login", "identifiant", "google", "apple"], dir: "(auth)/login", name: "Connexion", what: "Connexion par e-mail et mot de passe, ou via Google / Apple. En cas d'oubli, le lien « mot de passe oublié » envoie un e-mail de réinitialisation." },
  { path: "/signup", how: "Bouton d'inscription depuis la page d'accueil publique.", keys: ["inscription", "creer", "compte", "signup", "sinscrire"], dir: "(auth)/signup", name: "Inscription", what: "Création de compte par e-mail ou via Google / Apple, avec consentement santé. Un e-mail de confirmation est envoyé." },
  { path: "/forgot-password", how: "Lien « Mot de passe oublié » sous le formulaire de connexion.", keys: ["oublie", "mot", "passe", "password", "reinitialiser"], dir: "(auth)/forgot-password", name: "Mot de passe oublié", what: "Saisie de l'adresse e-mail pour recevoir un lien de réinitialisation du mot de passe." },
  { path: "/reset-password", keys: ["nouveau", "mot", "passe", "reinitialisation", "reset"], dir: "(auth)/reset-password", name: "Nouveau mot de passe", what: "Saisie du nouveau mot de passe, après avoir cliqué le lien reçu par e-mail." },
  { path: "/dashboard/journal", dir: "dashboard/journal", name: "Journal", what: "Redirige vers l'onglet Journal de la page Santé : le journal y a été intégré. Une ancienne adresse en circulation continue donc de fonctionner." },
  { path: "/blog", keys: ["blog", "articles", "lire"], dir: "blog", name: "Blog", what: "Articles publics sur l'entraînement, la physiologie et la préparation de course. Accessible sans compte." },
  { path: "/avis", keys: ["avis", "temoignage", "review"], dir: "avis", name: "Avis", what: "Témoignages d'utilisateurs de Pacevo. Page publique, accessible sans compte." },
  { path: "/contact", how: "Lien « Contact » dans le pied de page.", keys: ["contact", "equipe", "joindre", "support"], dir: "contact", name: "Contact", what: "Formulaire pour joindre l'équipe Pacevo. Pour une question sur l'entraînement, la Messagerie du tableau de bord est plus directe." },
  { path: "/mentions-legales", how: "Lien « Mentions légales » dans le pied de page.", keys: ["mentions", "legales", "editeur", "hebergeur"], dir: "mentions-legales", name: "Mentions légales", what: "Éditeur du site, hébergeur et responsabilités légales. Page publique." },
  { path: "/confidentialite", how: "Lien « Confidentialité » dans le pied de page.", keys: ["confidentialite", "donnees", "rgpd", "privacy", "personnelles"], dir: "confidentialite", name: "Confidentialité", what: "Traitement des données personnelles et marche à suivre pour les exercer." },
  { path: "/terms", how: "Lien « CGU » dans le pied de page.", keys: ["cgu", "conditions", "utilisation", "terms"], dir: "terms", name: "Conditions d'utilisation", what: "Conditions générales d'utilisation du service : ce que couvre l'abonnement, les responsabilités de chacun, et le rappel que les conseils fournis ne remplacent pas un avis médical." },
  { path: "/pricing", how: "Encart « Passe au Pro » dans la barre latérale, ou pied de page du site.", keys: ["abonnement", "prix", "tarif", "payer", "pro", "premium", "pricing"], dir: "pricing", name: "Abonnement", what: "Formules et tarifs. Le paiement n'est pas encore ouvert : la page s'affiche, mais aucun abonnement ne peut être souscrit pour l'instant." },
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
  "INTÉGRATIONS : Pacevo ne se connecte qu'à intervals.icu. C'est intervals.icu qui gère l'authentification officielle avec Garmin, COROS, Polar, Suunto ou Strava — Pacevo n'accède jamais directement à ces comptes. Aucun bouton « connecter Strava » n'existe donc dans l'app, et c'est volontaire.",
  "IMPORT MANUEL : la page Sync Montre accepte aussi un fichier GPX ou FIT déposé à la main, utile pour une sortie enregistrée sur un appareil non connecté.",
  "PARAMÈTRES : on y règle la langue, les unités (métrique/impérial), le premier jour de la semaine, les PRÉFÉRENCES DE NOTIFICATION (rappels de séance, résumé hebdomadaire du lundi par e-mail, alertes de récupération si la VFC chute, conseils du coach IA) et la CONFIDENTIALITÉ (apparaître ou non dans les classements des Ligues et dans la Communauté).",
  "PROFIL : âge, taille, poids, sexe, années de course, terrains pratiqués, préférence de dénivelé, nombre de séances par semaine et jours disponibles, section santé (pathologies, zones de blessure, note libre), durées d'échauffement et de retour au calme — ces deux dernières sont EXACTEMENT celles que la montre appliquera.",
  "DÉTAIL D'UNE SÉANCE : cliquer une activité depuis le tableau de bord ouvre sa fiche complète (métriques, zones de FC, courbes, tours). Ce n'est pas une entrée du menu.",
  "SUIVI EN DIRECT : un lien de suivi se génère depuis Trail Builder. La page est PUBLIQUE — quiconque possède le lien voit la position en temps réel, sans avoir de compte. À ne partager qu'avec des proches.",
  "GUARDIAN (Santé › Guardian) : sécurité en course — détection de chute, alerte GPS automatique, contact d'urgence à renseigner. Il s'active depuis cet onglet.",
  "ÉCHAUFFEMENT ET RETOUR AU CALME : leurs durées viennent du Profil et sont reprises À L'IDENTIQUE dans le texte de la séance et dans ce que reçoit la montre.",
  "LIGUES : classements et progression. La visibilité dans les classements se coupe depuis Paramètres › Confidentialité.",
  "COMPTE ET DONNÉES : la suppression du compte et les demandes relatives aux données personnelles passent par Paramètres et la page Confidentialité.",
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
  { q: "Puis-je connecter Strava, Polar, COROS ou Suunto ?",
    a: "Pacevo ne se connecte qu'à UNE plateforme : intervals.icu. C'est intervals.icu qui se relie ensuite à Garmin, COROS, Polar, Suunto ou Strava via leurs connexions officielles — Pacevo n'accède jamais directement à ces comptes. Il n'existe donc pas de bouton « connecter Strava » dans l'app : relie Strava à intervals.icu, puis intervals.icu à Pacevo depuis Sync Montre. À défaut, un fichier GPX ou FIT s'importe à la main depuis cette même page." },
  { q: "Comment supprimer mon compte ou mes données",
    a: "Depuis Paramètres. Pour toute demande relative aux données personnelles, la page Confidentialité indique la marche à suivre." },
];
