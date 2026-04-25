"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MapPin, Mountain, Heart, ShoppingBag,
  User, Trophy, Bot, Settings, LogOut, ChevronLeft,
  Ghost, BookOpen, ShieldCheck, Zap, Watch
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/races", icon: MapPin, label: "Courses" },
  { href: "/dashboard/trail", icon: Mountain, label: "Trail Builder" },
  { href: "/dashboard/health", icon: Heart, label: "Santé" },
  { href: "/dashboard/shop", icon: ShoppingBag, label: "Boutique" },
  { href: "/dashboard/coaching", icon: Bot, label: "Coaching IA" },
  { href: "/dashboard/ghost-runner", icon: Ghost, label: "Ghost Runner" },
  { href: "/dashboard/journal", icon: BookOpen, label: "Journal" },
  { href: "/dashboard/leagues", icon: Trophy, label: "Ligues" },
  { href: "/dashboard/sync", icon: Watch, label: "Sync Montre" },
  { href: "/dashboard/profile", icon: User, label: "Profil" },
];

export function Sidebar({ profile }: { profile: Record<string, unknown> | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className={cn(
      "h-screen flex flex-col border-r border-zinc-100 bg-white transition-all duration-300",
      collapsed ? "w-[72px]" : "w-[220px]"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-zinc-100">
        <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">R</span>
        </div>
        {!collapsed && (
          <span className="ml-3 font-semibold text-zinc-900 text-sm leading-tight">
            Running &<br />Trail Empire
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-100 space-y-0.5">
        <Link href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && "Paramètres"}
        </Link>
        <Link href="/admin"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-violet-50 hover:text-violet-700 transition-all">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          {!collapsed && "Admin"}
        </Link>
        <button onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-all">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && "Déconnexion"}
        </button>
        <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-zinc-400 hover:bg-zinc-50 transition-all">
          <ChevronLeft className={cn("w-4 h-4 transition-transform flex-shrink-0", collapsed && "rotate-180")} />
          {!collapsed && "Réduire"}
        </button>
      </div>
    </aside>
  );
}
