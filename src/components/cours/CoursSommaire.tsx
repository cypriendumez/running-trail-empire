"use client";

import { useEffect, useState } from "react";

// Sommaire avec scroll-spy : la section en cours de lecture est surlignée.
// Props sérialisables uniquement (rendu par une page serveur).
export function CoursSommaire({ items, label = "Sommaire" }: { items: { id: string; title: string; color: string }[]; label?: string }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    // La section « active » = celle qui traverse le tiers haut de l'écran.
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setActive(e.target.id); break; }
        }
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 },
    );
    for (const i of items) {
      const el = document.getElementById(i.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-6 space-y-1">
      <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wide text-zinc-400">{label}</div>
      {items.map((i) => {
        const on = active === i.id;
        return (
          <a
            key={i.id}
            href={`#${i.id}`}
            aria-current={on ? "true" : undefined}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
              on ? "bg-white font-semibold text-zinc-900 shadow-sm" : "text-zinc-500 hover:bg-white hover:text-zinc-900 hover:shadow-sm"
            }`}
          >
            <span
              className={`h-2 w-2 flex-shrink-0 rounded-full transition-transform ${on ? "scale-125" : "opacity-40"}`}
              style={{ background: i.color }}
            />
            <span className="truncate">{i.title}</span>
          </a>
        );
      })}
    </nav>
  );
}
