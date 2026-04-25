"use client";

import { Bell, Search, Zap, Moon, Sun } from "lucide-react";
import { useState } from "react";

export function TopBar({ profile }: { profile: Record<string, unknown> | null }) {
  const [mode, setMode] = useState<"ludique" | "elite">(
    (profile?.mode as "ludique" | "elite") ?? "ludique"
  );

  return (
    <header className="h-16 border-b border-zinc-100 bg-white/80 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-30">
      {/* Search */}
      <div className="flex-1 max-w-sm">
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            placeholder="Rechercher une course, parcours..."
            className="bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 outline-none flex-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl">
          <button
            onClick={() => setMode("ludique")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === "ludique" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
            }`}
          >
            <Moon className="w-3 h-3" />
            Ludique
          </button>
          <button
            onClick={() => setMode("elite")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === "elite" ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500"
            }`}
          >
            <Zap className="w-3 h-3" />
            Élite
          </button>
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-zinc-50 border border-zinc-200 transition-colors">
          <Bell className="w-4 h-4 text-zinc-600" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold text-sm">
          {String(profile?.full_name ?? "U")[0].toUpperCase()}
        </div>
      </div>
    </header>
  );
}
