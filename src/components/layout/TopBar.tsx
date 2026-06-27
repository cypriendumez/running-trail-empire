"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Search, User, Settings, LogOut, CheckCheck, Flag, Route as RouteIcon, Loader2 } from "lucide-react";
import { colorOf } from "@/lib/avatarColors";
import { useT } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

type Notif = { id: string; type: string; title: string; body: string | null; read: boolean; created_at: string };
type RaceHit = { name: string; city: string; distanceKm: number | null; date: string };
type ParcoursHit = { id: number; nom: string; distance_km: number; localisation: { departement: string } };

const LEVELS: Record<string, { elite: string; inter: string }> = {
  fr: { elite: "Niveau Élite", inter: "Niveau Intermédiaire" },
  en: { elite: "Elite level", inter: "Intermediate level" },
  de: { elite: "Elite-Niveau", inter: "Mittleres Niveau" },
  es: { elite: "Nivel Élite", inter: "Nivel intermedio" },
  pt: { elite: "Nível Elite", inter: "Nível intermédio" },
};

export function TopBar({ profile, avatarColor }: { profile: Record<string, unknown> | null; avatarColor?: string }) {
  const { t, lang } = useT();
  const lv = LEVELS[lang] ?? LEVELS.fr;
  const levelLabel = String(profile?.mode ?? "") === "elite" ? lv.elite : lv.inter;
  const router = useRouter();
  const name = String(profile?.full_name ?? "").trim();
  const initial = (name || "U")[0].toUpperCase();
  const avatarSrc = String(profile?.avatar_url ?? "");
  const email = String(profile?.email ?? "");
  const ac = colorOf(avatarColor);

  const [openNotif, setOpenNotif] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(true);
  const userIdRef = useRef<string | null>(null);

  // ── Recherche globale : courses + parcours, résultats live ──────────────────
  const [q, setQ] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [raceHits, setRaceHits] = useState<RaceHit[]>([]);
  const [parcoursHits, setParcoursHits] = useState<ParcoursHit[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setRaceHits([]); setParcoursHits([]); setOpenSearch(false); setSearching(false); return; }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const [r, p] = await Promise.all([
          fetch(`/api/races/search?q=${encodeURIComponent(query)}`).then((x) => x.json()).catch(() => ({ races: [] })),
          fetch(`/api/parcours?q=${encodeURIComponent(query)}&pageSize=4`).then((x) => x.json()).catch(() => ({ items: [] })),
        ]);
        if (seq !== searchSeq.current) return;
        setRaceHits((r.races ?? []).slice(0, 5));
        setParcoursHits((p.items ?? []).slice(0, 4));
        setOpenSearch(true);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Clic hors de la zone de recherche → ferme le panneau.
  useEffect(() => {
    if (!openSearch) return;
    const onDoc = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpenSearch(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openSearch]);

  const goRace = (name?: string) => {
    setOpenSearch(false); setQ("");
    router.push(`/dashboard/races?q=${encodeURIComponent(name ?? q.trim())}`);
  };
  const goParcours = (nom?: string) => {
    setOpenSearch(false); setQ("");
    router.push(`/dashboard/trail?q=${encodeURIComponent(nom ?? q.trim())}`);
  };

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingNotif(false); return; }
      userIdRef.current = user.id;
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifs((data ?? []) as Notif[]);
      setLoadingNotif(false);
    })();
  }, []);

  const unread = notifs.filter((n) => !n.read).length;

  async function markAllRead() {
    if (!userIdRef.current || unread === 0) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("user_id", userIdRef.current).eq("read", false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const iconFor = (type: string) =>
    /coach|session|s[ée]ance/i.test(type) ? "🏃" : /race|objectif/i.test(type) ? "🎯"
    : /feedback|ressenti/i.test(type) ? "💬" : /badge|league|ligue|d[ée]fi/i.test(type) ? "🏆" : "🔔";

  const timeAgo = (iso: string) => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    return `il y a ${Math.floor(s / 86400)} j`;
  };

  return (
    <header className="h-16 border-b border-zinc-100 bg-white/80 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-30">
      {/* Recherche globale — courses + parcours, résultats en direct */}
      <div ref={searchRef} className="relative flex-1 max-w-md">
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-zinc-50 rounded-2xl border border-zinc-200 focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:border-emerald-400 transition-all">
          {searching ? <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" /> : <Search className="w-4 h-4 text-zinc-400" />}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => { if (raceHits.length || parcoursHits.length) setOpenSearch(true); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim().length >= 2) goRace();
              if (e.key === "Escape") { setOpenSearch(false); setQ(""); }
            }}
            placeholder={t("topbar.search")}
            className="bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 outline-none flex-1"
          />
        </div>

        {openSearch && (
          <div className="absolute left-0 right-0 top-full mt-2 max-h-[26rem] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl z-50">
            {raceHits.length === 0 && parcoursHits.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-zinc-400">Aucun résultat pour « {q.trim()} »</div>
            ) : (
              <>
                {raceHits.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Courses</div>
                    {raceHits.map((r, i) => (
                      <button key={i} onClick={() => goRace(r.name)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50"><Flag className="h-4 w-4 text-amber-600" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-zinc-800">{r.name}</span>
                          <span className="block truncate text-[11px] text-zinc-400">
                            {[r.city, r.distanceKm != null ? `${r.distanceKm} km` : "", r.date && !r.date.startsWith("2099") ? new Date(r.date + "T00:00:00").toLocaleDateString("fr", { day: "numeric", month: "short", year: "numeric" }) : "Date à venir"].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {parcoursHits.length > 0 && (
                  <div className={raceHits.length > 0 ? "border-t border-zinc-100" : ""}>
                    <div className="px-4 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Parcours</div>
                    {parcoursHits.map((p) => (
                      <button key={p.id} onClick={() => goParcours(p.nom)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50"><RouteIcon className="h-4 w-4 text-emerald-600" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-zinc-800">{p.nom}</span>
                          <span className="block truncate text-[11px] text-zinc-400">{[p.distance_km ? `${p.distance_km.toFixed(1)} km` : "", p.localisation?.departement].filter(Boolean).join(" · ")}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => goRace()} className="block w-full border-t border-zinc-100 px-4 py-2.5 text-center text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50">
                  Voir tous les résultats →
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Notifications */}
        <div className="relative">
          <button
            aria-label="Notifications"
            onClick={() => { const willOpen = !openNotif; setOpenNotif(willOpen); setOpenMenu(false); if (willOpen) markAllRead(); }}
            className="relative w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-zinc-50 border border-zinc-200 transition-colors"
          >
            <Bell className="w-4 h-4 text-zinc-600" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {openNotif && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenNotif(false)} />
              <div className="absolute right-0 mt-2 w-80 max-h-[26rem] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 sticky top-0 bg-white">
                  <span className="font-semibold text-sm text-zinc-900">Notifications</span>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                      <CheckCheck className="w-3.5 h-3.5" /> Tout lire
                    </button>
                  )}
                </div>
                {loadingNotif ? (
                  <div className="p-6 text-center text-sm text-zinc-400">Chargement…</div>
                ) : notifs.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-400"><Bell className="w-8 h-8 mx-auto mb-2 text-zinc-200" />Aucune notification</div>
                ) : (
                  <ul className="divide-y divide-zinc-50">
                    {notifs.map((n) => (
                      <li key={n.id} className={`flex gap-3 px-4 py-3 ${n.read ? "" : "bg-emerald-50/40"}`}>
                        <span className="text-lg shrink-0">{iconFor(n.type)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-zinc-900 truncate">{n.title}</div>
                          {n.body && <div className="text-xs text-zinc-500 line-clamp-2">{n.body}</div>}
                          <div className="text-[11px] text-zinc-400 mt-0.5">{timeAgo(n.created_at)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* Avatar + nom → menu */}
        <div className="relative">
          <button
            onClick={() => { setOpenMenu((v) => !v); setOpenNotif(false); }}
            className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-2xl hover:bg-zinc-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-2xl overflow-hidden flex items-center justify-center font-semibold text-sm shadow-sm" style={{ background: ac.bg, color: ac.fg }}>
              {avatarSrc
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                : initial}
            </div>
            {name && (
              <span className="hidden flex-col items-start pr-1 leading-tight sm:flex">
                <span className="text-sm font-semibold text-zinc-800">{name.split(" ")[0]}</span>
                <span className="text-[11px] text-zinc-400">{levelLabel}</span>
              </span>
            )}
          </button>
          {openMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(false)} />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-100">
                  <div className="text-sm font-semibold text-zinc-900 truncate">{name || "Mon compte"}</div>
                  {email && <div className="text-xs text-zinc-400 truncate">{email}</div>}
                </div>
                <Link href="/dashboard/profile" onClick={() => setOpenMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
                  <User className="w-4 h-4 text-zinc-400" /> Profil
                </Link>
                <Link href="/dashboard/settings" onClick={() => setOpenMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
                  <Settings className="w-4 h-4 text-zinc-400" /> Paramètres
                </Link>
                <button onClick={signOut} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-zinc-100 transition-colors">
                  <LogOut className="w-4 h-4" /> Déconnexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
