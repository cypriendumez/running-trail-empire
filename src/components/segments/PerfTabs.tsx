"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Sous-onglets « Performances ».
//
//  Activités, Vitrine, Segments et Survol 3D occupaient autant d'entrées de la
//  barre latérale pour un même sujet : ce que l'athlète a parcouru. On reprend le
//  motif déjà en place sur l'onglet Santé — une seule entrée de menu, une rangée
//  d'onglets en haut de page — plutôt que d'allonger encore le menu.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Trophy, Route, Orbit } from "lucide-react";

const ONGLETS = [
  { href: "/dashboard/activites", label: "Activités", icon: Activity },
  { href: "/dashboard/trophees", label: "Vitrine", icon: Trophy },
  { href: "/dashboard/segments", label: "Segments", icon: Route },
  { href: "/dashboard/survol", label: "Survol 3D", icon: Orbit },
];

export function PerfTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1">
      {ONGLETS.map(({ href, label, icon: Icon }) => {
        const actif = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              actif ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
