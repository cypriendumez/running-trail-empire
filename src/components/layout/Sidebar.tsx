"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu, X,
  LayoutDashboard, MapPin, Mountain, Heart, ShoppingBag,
  User, Trophy, Settings, LogOut, ChevronLeft,
  Ghost, Watch, GraduationCap, CalendarDays, MessagesSquare, Newspaper, Crown, Medal, Users, Target, ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";

// Navigation groupée par univers — plus lisible et pro.
const groups: { titleKey: string | null; items: { href: string; icon: typeof LayoutDashboard; tk: string }[] }[] = [
  {
    titleKey: null,
    items: [{ href: "/dashboard", icon: LayoutDashboard, tk: "nav.dashboard" }],
  },
  {
    titleKey: "group.training",
    items: [
      { href: "/dashboard/calendrier", icon: CalendarDays, tk: "nav.calendar" },
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
    titleKey: "group.tracking",
    items: [
      { href: "/dashboard/health", icon: Heart, tk: "nav.health" },
      { href: "/dashboard/messages", icon: MessagesSquare, tk: "nav.messaging" },
      { href: "/dashboard/sync", icon: Watch, tk: "nav.sync" },
    ],
  },
  {
    titleKey: "group.club",
    items: [
      { href: "/dashboard/communaute", icon: Users, tk: "nav.community" },
      { href: "/dashboard/clubs", icon: Target, tk: "nav.clubs" },
      // Vitrine, Segments, Carte de chaleur et Survol 3D partagent UNE entrée : ce
      // sont quatre lectures du même sujet — ce que l'athlète a parcouru. Ils se
      // choisissent par la rangée d'onglets en haut de page (comme l'onglet Santé),
      // au lieu d'occuper quatre lignes de menu.
      { href: "/dashboard/trophees", icon: Trophy, tk: "nav.performances" },
      { href: "/dashboard/leagues", icon: Medal, tk: "nav.leagues" },
      { href: "/dashboard/shop", icon: ShoppingBag, tk: "nav.shop" },
    ],
  },
];

const PREMIUM_CARD: Record<string, { title: string; sub: string }> = {
  fr: { title: "Passe au Pro", sub: "Plans IA illimités, Ghost Runner, Trail Builder complet." },
  en: { title: "Go Pro", sub: "Unlimited AI plans, Ghost Runner, full Trail Builder." },
  de: { title: "Auf Pro upgraden", sub: "Unbegrenzte KI-Pläne, Ghost Runner, voller Trail Builder." },
  es: { title: "Pasa a Pro", sub: "Planes IA ilimitados, Ghost Runner, Trail Builder completo." },
  pt: { title: "Passa para Pro", sub: "Planos IA ilimitados, Ghost Runner, Trail Builder completo." },
};

/**
 * `estEditeur` est calculé PAR LE SERVEUR et transmis — il n'est volontairement pas
 * déduit ici. ⚠️ Ce composant s'exécute dans le navigateur, où `process.env` est vide :
 * relire la liste des administrateurs sur place aurait retombé sur le seul propriétaire
 * historique, et masqué le lien à une adresse pourtant autorisée. La propriété est
 * OBLIGATOIRE pour qu'aucun futur appel ne puisse l'oublier et faire disparaître le lien
 * en silence.
 */
export function Sidebar({ profile, unreadMessages = 0, estEditeur }: { profile: Record<string, unknown> | null; unreadMessages?: number; estEditeur: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang } = useT();
  const [collapsed, setCollapsed] = useState(false);
  /**
   * ⚠️ SUR MOBILE, CETTE BARRE MANGEAIT 62 % DE L'ÉCRAN.
   *
   * Mesuré en production sur un écran de 375 px : l'`aside` restait à 232 px dans le
   * flux, il ne restait donc que 143 px à TOUTES les pages de l'espace connecté — 95 px
   * une fois les marges retirées. La carte du Trail Builder tombait à 93 px de large et
   * sa barre d'attribution, qui ne peut pas descendre sous 95 px, débordait en
   * s'enroulant sur trois lignes. C'est ce débordement qu'on voyait ; la cause était la
   * largeur volée à toute l'application.
   *
   * `collapsed` n'y changeait rien : il ne se déclenche qu'au clic, ne se souvient de
   * rien d'un chargement à l'autre, et même replié il prend encore 76 px sur 375.
   *
   * Sur mobile, la barre devient donc un TIROIR hors-champ. À partir de `md`, tout le
   * comportement d'origine est conservé, à la classe près.
   */
  const [ouvertMobile, setOuvertMobile] = useState(false);
  // Naviguer ferme le tiroir : sans cela il reste ouvert par-dessus la page demandée.
  useEffect(() => { setOuvertMobile(false); }, [pathname]);
  const tier = String(profile?.subscription_tier ?? "free");
  // ⚠️ L'espace coach existait sans qu'aucun lien n'y mène : six pages protégées,
  // absentes de cette barre, atteignables seulement en tapant l'adresse. Masquer ce lien
  // ne protège RIEN — la vraie barrière est le `redirect()` du layout /admin, côté
  // serveur. Il évite juste d'afficher une porte qu'on ne peut pas ouvrir.
  const pc = PREMIUM_CARD[lang] ?? PREMIUM_CARD.fr;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const NavItem = ({ href, icon: Icon, label }: { href: string; icon: typeof LayoutDashboard; label: string }) => {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    // Pastille de messages non lus — masquée quand on consulte déjà la messagerie.
    const count = href === "/dashboard/messages" && pathname !== "/dashboard/messages" ? unreadMessages : 0;
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
          active ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
        )}
      >
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-emerald-500" />}
        <span className="relative flex-shrink-0">
          <Icon className="w-[18px] h-[18px]" />
          {count > 0 && collapsed && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">{count > 9 ? "9+" : count}</span>
          )}
        </span>
        {!collapsed && <span className="flex-1">{label}</span>}
        {!collapsed && count > 0 && (
          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white shadow-sm">{count > 99 ? "99+" : count}</span>
        )}
      </Link>
    );
  };

  return (
    <>
    {/* Voile : un appui à côté referme le tiroir. */}
    {ouvertMobile && (
      <div
        onClick={() => setOuvertMobile(false)}
        className="fixed inset-0 z-40 bg-zinc-900/40 md:hidden"
        aria-hidden="true"
      />
    )}

    {/* Bouton d'ouverture, en MIROIR de la bulle d'aide déjà posée en bas à droite :
        il ne recouvre ni la barre supérieure ni le contenu, et reste sous le pouce. */}
    <button
      type="button"
      onClick={() => setOuvertMobile((v) => !v)}
      aria-label={t("nav.menu")}
      aria-expanded={ouvertMobile}
      className="fixed bottom-5 left-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-lg md:hidden"
    >
      {ouvertMobile ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
    </button>

    <aside className={cn(
      // ⚠️ `transition-all` ANIMAIT TOUT, sur un élément pleine hauteur : chaque image
      // recalculait la mise en page de la barre entière. On ne déclare que les deux
      // propriétés qui changent réellement — la translation du tiroir sur mobile, la
      // largeur du repli sur bureau. La translation est composée par le GPU, la
      // différence se sent à l'ouverture.
      "h-screen flex flex-col border-r border-zinc-100 bg-white transition-[transform,width] duration-300 ease-out",
      // Mobile : tiroir hors-champ, il ne prend AUCUNE largeur au contenu.
      "fixed inset-y-0 left-0 z-50 w-[264px] -translate-x-full",
      ouvertMobile && "translate-x-0 shadow-2xl",
      // À partir de md : exactement le comportement d'avant.
      "md:static md:z-auto md:translate-x-0 md:shadow-none",
      collapsed ? "md:w-[76px]" : "md:w-[232px]",
    )}>
      {/* Logo → retour au tableau de bord */}
      <Link
        href="/dashboard"
        title={t("nav.dashboard")}
        className="h-16 flex items-center px-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
      >
        <Logo size={36} className="flex-shrink-0" />
        {!collapsed && <Wordmark className="ml-3 text-lg" />}
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {groups.map((g, gi) => (
          <div key={gi} className={gi > 0 ? "mt-5" : ""}>
            {g.titleKey && !collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">{t(g.titleKey)}</div>
            )}
            {g.titleKey && collapsed && gi > 0 && <div className="mx-3 mb-2 border-t border-zinc-100" />}
            <div className="space-y-0.5">
              {g.items.map((it) => <NavItem key={it.href} href={it.href} icon={it.icon} label={t(it.tk)} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* Encart Premium — comptes gratuits uniquement (comme la maquette) */}
      {!collapsed && tier === "free" && (
        <div className="px-3 pb-1">
          <Link href="/pricing" className="block rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white p-3 transition-shadow hover:shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 text-white"><Crown className="h-4 w-4" /></span>
              <span className="text-sm font-bold text-zinc-900">{pc.title}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">{pc.sub}</p>
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-zinc-100 space-y-0.5">
        {estEditeur && (
          <Link href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all">
            <ShieldCheck className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && "Espace coach"}
          </Link>
        )}
        <NavItem href="/dashboard/profile" icon={User} label={t("nav.profile")} />
        <Link href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all">
          <Settings className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && t("nav.settings")}
        </Link>
        <button onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-all">
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && t("nav.logout")}
        </button>
        <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-zinc-400 hover:bg-zinc-50 transition-all">
          <ChevronLeft className={cn("w-4 h-4 transition-transform flex-shrink-0", collapsed && "rotate-180")} />
          {!collapsed && t("nav.collapse")}
        </button>
      </div>
    </aside>
    </>
  );
}
