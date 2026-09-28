import {
  LayoutDashboard, CalendarDays, ClipboardList, MapPin, ShieldCheck, Mountain, Ghost,
  GraduationCap, Heart, MessagesSquare, Watch, UserPlus, Newspaper, Trophy, Medal, ShoppingBag,
} from "lucide-react";

/**
 * LA LISTE DES DESTINATIONS DE L'ESPACE CONNECTÉ — UNE SEULE, POUR LES DEUX NAVIGATIONS.
 *
 * La barre latérale (bureau) et la barre d'onglets (téléphone) lisent toutes deux cette
 * liste. Ce n'est pas une coquetterie : la barre d'onglets n'affiche que quatre
 * destinations en direct et range TOUT LE RESTE derrière « Plus » — si ce reste était
 * recopié à la main, la prochaine page ajoutée à la barre latérale serait atteignable
 * sur bureau et introuvable sur téléphone, sans qu'aucun test ne le voie. Ici, « le
 * reste » se CALCULE : tout ce qui n'est pas un onglet.
 */
export type Destination = { href: string; icon: typeof LayoutDashboard; tk: string };
export type Groupe = { titleKey: string | null; items: Destination[] };

// ⚠️ DU PLUS UTILISÉ AU MOINS UTILE (Cyprien, 28/09/2026 : « choisis le bon ordre, du plus
// utilisé au moins utile, mets-toi à la place de l'utilisateur »). La mesure d'audience ne
// comptait que 11 pages vues dans l'app ce jour-là : l'ordre suit donc la FRÉQUENCE
// d'usage d'un coureur coaché, rubrique par rubrique, puis dans chaque rubrique :
//   - chaque jour : l'accueil, puis la séance du jour (calendrier) ;
//   - à chaque sortie : enregistrer, puis relire ce qu'on a couru, sa santé, son coach ;
//   - de temps en temps : préparer (courses, parcours, plans, cours, PPS) ;
//   - le social ;
//   - presque jamais : la montre (réglée une fois) et les chaussures (une paire par saison).
export const NAV_GROUPES: Groupe[] = [
  {
    titleKey: null,
    items: [{ href: "/dashboard", icon: LayoutDashboard, tk: "nav.dashboard" }],
  },
  {
    titleKey: "group.training",
    items: [
      { href: "/dashboard/calendrier", icon: CalendarDays, tk: "nav.calendar" },
      { href: "/dashboard/ghost-runner", icon: Ghost, tk: "nav.ghost" },
    ],
  },
  {
    // « Mes activités » est du SUIVI (ce que l'athlète a couru) ; la messagerie aussi :
    // on y écrit d'abord à son coach (imprévus, douleurs, objectifs).
    titleKey: "group.tracking",
    items: [
      // Vitrine, Segments, Carte de chaleur et Survol 3D partagent UNE entrée : ce
      // sont quatre lectures du même sujet — ce que l'athlète a parcouru. Ils se
      // choisissent par la rangée d'onglets en haut de page (comme l'onglet Santé),
      // au lieu d'occuper quatre lignes de menu.
      { href: "/dashboard/trophees", icon: Trophy, tk: "nav.performances" },
      { href: "/dashboard/health", icon: Heart, tk: "nav.health" },
      { href: "/dashboard/messages", icon: MessagesSquare, tk: "nav.messaging" },
    ],
  },
  {
    // Ce qu'on consulte pour PRÉPARER, pas chaque jour. Le PPS ferme la marche : on y pense
    // une fois par an, et la fiche de chaque course l'annonce déjà au moment de s'inscrire.
    titleKey: "group.prep",
    items: [
      { href: "/dashboard/races", icon: MapPin, tk: "nav.races" },
      { href: "/dashboard/trail", icon: Mountain, tk: "nav.trail" },
      { href: "/dashboard/plans", icon: ClipboardList, tk: "nav.plans" },
      { href: "/dashboard/cours", icon: GraduationCap, tk: "nav.courses" },
      { href: "/dashboard/pps", icon: ShieldCheck, tk: "nav.pps" },
    ],
  },
  {
    // ⚠️ « CLUBS & DÉFIS » RETIRÉ DU MENU LE 22/09/2026 (Cyprien : « enlève club et les
    // défis pour l'instant ») — la page /dashboard/clubs existe toujours, elle n'est
    // plus proposée. L'onglet « Le Club » devient « Ajouter des amis » (suggestions,
    // contacts, QR code, façon Strava) et l'agrégateur d'actualités, qui y vivait en
    // second onglet, a sa propre page.
    titleKey: "group.club",
    items: [
      { href: "/dashboard/communaute", icon: UserPlus, tk: "nav.community" },
      { href: "/dashboard/leagues", icon: Medal, tk: "nav.leagues" },
      { href: "/dashboard/actualite", icon: Newspaper, tk: "nav.news" },
    ],
  },
  {
    // La montre et les chaussures : l'équipement. La synchro se règle une fois, puis
    // tourne seule — elle n'a rien à faire au milieu du suivi de tous les jours.
    titleKey: "group.gear",
    items: [
      { href: "/dashboard/sync", icon: Watch, tk: "nav.sync" },
      { href: "/dashboard/shop", icon: ShoppingBag, tk: "nav.shop" },
    ],
  },
];

/**
 * Les quatre destinations qui ont leur propre onglet sur téléphone, dans l'ordre de la
 * barre (l'onglet « Plus » ferme la marche). Disposition demandée par Cyprien le
 * 21/09/2026, calquée sur Strava : Accueil · Carte · Enregistrer · Calendrier · Plus.
 * « Enregistrer » ouvre le Ghost Runner, qui est l'écran qui enregistre une course GPS.
 */
export const ONGLETS_MOBILE = ["/dashboard", "/dashboard/trail", "/dashboard/ghost-runner", "/dashboard/calendrier"] as const;

/** Tout ce qui n'a pas d'onglet : le contenu de « Plus », calculé et jamais recopié. */
export const resteMobile = (): Destination[] =>
  NAV_GROUPES.flatMap((g) => g.items).filter((d) => !(ONGLETS_MOBILE as readonly string[]).includes(d.href));

/** Une destination est-elle « active » pour ce chemin ? (le tableau de bord exige l'égalité) */
export const estActive = (pathname: string, href: string) =>
  pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
