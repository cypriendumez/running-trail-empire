"use client";

import { useMemo, useRef, useState } from "react";
import { Search, X, CornerDownLeft } from "lucide-react";

export type SearchItem = { slug: string; term: string; short?: string; chapter: string; color: string };

// Recherche instantanée dans toutes les notions du cours → saute à la carte (avec flash).
export function CoursSearch({ items, placeholder = "Chercher une notion…", emptyText = "Aucune notion trouvée." }: { items: SearchItem[]; placeholder?: string; emptyText?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const results = useMemo(() => {
    const n = norm(q.trim());
    if (n.length < 2) return [];
    return items.filter((i) => norm(i.term).includes(n) || (i.short && norm(i.short).includes(n))).slice(0, 8);
  }, [q, items]);

  const jumpTo = (slug: string) => {
    setOpen(false); setQ("");
    const el = document.getElementById(slug);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Flash visuel pour repérer la carte atteinte.
    el.classList.add("ring-2", "ring-emerald-400", "ring-offset-2");
    setTimeout(() => el.classList.remove("ring-2", "ring-emerald-400", "ring-offset-2"), 1800);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-all focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
        <Search className="h-4 w-4 flex-shrink-0 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) jumpTo(results[0].slug); if (e.key === "Escape") { setQ(""); setOpen(false); } }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
        />
        {q && (
          <button onClick={() => { setQ(""); setOpen(false); }} aria-label="Effacer" className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          {results.map((r) => (
            <button key={r.slug} onMouseDown={(e) => e.preventDefault()} onClick={() => jumpTo(r.slug)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: r.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-800">{r.term}</span>
                <span className="block truncate text-[11px] text-zinc-400">{r.chapter}{r.short ? ` · ${r.short}` : ""}</span>
              </span>
              <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-zinc-300" />
            </button>
          ))}
        </div>
      )}
      {open && q.trim().length >= 2 && results.length === 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-400 shadow-xl">
          {emptyText}
        </div>
      )}
    </div>
  );
}
