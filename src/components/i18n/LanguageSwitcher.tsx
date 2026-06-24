"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { LANGS } from "@/lib/i18n/translations";

// Sélecteur de langue pour les pages publiques (et partout). Persisté via cookie par setLang.
export function LanguageSwitcher({ light = false, className = "" }: { light?: boolean; className?: string }) {
  const { lang, setLang } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${light ? "text-white/90 hover:bg-white/10" : "text-zinc-600 hover:bg-zinc-100"}`}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{cur.code.toUpperCase()}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); router.refresh(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <span>{l.flag}</span>
              <span className="flex-1">{l.label}</span>
              {l.code === lang && <Check className="h-4 w-4 text-[#059669]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
