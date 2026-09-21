import {
  LayoutDashboard, CalendarDays, ClipboardList, MapPin, ShieldCheck, Mountain, Ghost,
  GraduationCap, Heart, MessagesSquare, Watch, Users, Target, Trophy, Medal, ShoppingBag,
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

// Navigation groupée par univers — plus lisible et pro.
export const NAV_GROUPES: Groupe[] = [
  {
    titleKey: null,
    items: [{ href: "/dashboard", icon: LayoutDashboard, tk: "nav.dashboard" }],
  },
  {
    titleKey: "group.training",
    items: [
      { href: "/dashboard/calendrier", icon: CalendarDays, tk: "nav.calendar" },
      // Juste sous le calendrier : le plan glissant répond à « et demain ? », le
      // catalogue à « et les trois prochains mois ? ». Les deux se consultent ensemble.
      { href: "/dashboard/plans", icon: ClipboardList, tk: "nav.plans" },
      { href: "/dashboard/races", icon: MapPin, tk: "nav.races" },
      // Juste SOUS « Courses » : le PPS ne se cherche pas pour lui-même, on y pense au
      // moment de s'inscrire. Le voisinage fait la moitié du travail de découverte.
      { href: "/dashboard/pps", icon: ShieldCheck, tk: "nav.pps" },
      { href: "/dashboard/trail", icon: Mountain, tk: "nav.trail" },
      { href: "/dashboard/ghost-runner", icon: Ghost, tk: "nav.ghost" },
      { href: "/dashboard/cours", icon: GraduationCap, tk: "nav.courses" },
    ],
  },
  {
    // ⚠️ RANGÉ LE 21/09/2026 (Cyprien : « range mieux les différentes catégories ») :
    // « Mes activités » est du SUIVI (ce que l'athlète a couru), pas du club ; et le
    // comparateur d'équipement n'a rien de social — il a son propre groupe.
    titleKey: "group.tracking",
    items: [
      { href: "/dashboard/health", icon: Heart, tk: "nav.health" },
      // Vitrine, Segments, Carte de chaleur et Survol 3D partagent UNE entrée : ce
      // sont quatre lectures du même sujet — ce que l'athlète a parcouru. Ils se
      // choisissent par la rangée d'onglets en haut de page (comme l'onglet Santé),
      // au lieu d'occuper quatre lignes de menu.
      { href: "/dashboard/trophees", icon: Trophy, tk: "nav.performances" },
      { href: "/dashboard/messages", icon: MessagesSquare, tk: "nav.messaging" },
      { href: "/dashboard/sync", icon: Watch, tk: "nav.sync" },
    ],
  },
  {
    titleKey: "group.club",
    items: [
      { href: "/dashboard/communaute", icon: Users, tk: "nav.community" },
      { href: "/dashboard/clubs", icon: Target, tk: "nav.clubs" },
      { href: "/dashboard/leagues", icon: Medal, tk: "nav.leagues" },
    ],
  },
  {
    titleKey: "group.gear",
    items: [{ href: "/dashboard/shop", icon: ShoppingBag, tk: "nav.shop" }],
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
