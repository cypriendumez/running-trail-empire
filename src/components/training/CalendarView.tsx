"use client";

import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import {
  Target, X, Plus, StickyNote, Flag, Loader2, Trash2,
  ChevronLeft, ChevronRight, LayoutGrid, List, CalendarRange,
} from "lucide-react";
import { RenfoGuide } from "@/components/training/RenfoGuide";
import { fmtDistance, type UnitSystem } from "@/lib/units";
import { useT } from "@/lib/i18n/LanguageProvider";

export type Planned = { date: string; type: string; title: string; detail: string; why: string; feel: string; tags: string[] };
export type CalNote = { id: string; date: string; text: string };
export type CalRace = { id: string; date: string; name: string; location: string; distanceKm: number | null };

// Catégorie canonique d'une séance (à partir du libellé libre du coach) → couleur + légende i18n.
type Cat = "endurance" | "long" | "vma" | "threshold" | "recovery" | "renfo" | "rest";
const CAT_COLOR: Record<Cat, { bg: string; fg: string; soft: string }> = {
  rest: { bg: "#71717a", fg: "#52525b", soft: "#f4f4f5" },
  recovery: { bg: "#0284c7", fg: "#0369a1", soft: "#e0f2fe" },
  threshold: { bg: "#ea580c", fg: "#c2410c", soft: "#ffedd5" },
  vma: { bg: "#dc2626", fg: "#b91c1c", soft: "#fee2e2" },
  renfo: { bg: "#7c3aed", fg: "#6d28d9", soft: "#ede9fe" },
  long: { bg: "#16a34a", fg: "#15803d", soft: "#dcfce7" },
  endurance: { bg: "#059669", fg: "#047857", soft: "#d1fae5" },
};
const LEGEND_ORDER: Cat[] = ["endurance", "long", "vma", "threshold", "recovery", "renfo", "rest"];
function categoryOf(t: string): Cat {
  const s = t.toLowerCase();
  if (/repos|rest|ruhe|descans/.test(s)) return "rest";
  if (/récup|recup|recovery|erholung/.test(s)) return "recovery";
  if (/seuil|tempo|threshold|schwelle|umbral|limiar/.test(s)) return "threshold";
  if (/vma|fractionn|interval|vo2|vo₂|série|series|serie/.test(s)) return "vma";
  if (/renfo|muscu|gainage|force|strength|kräft|fuerza|força/.test(s)) return "renfo";
  if (/long/.test(s)) return "long";
  return "endurance";
}
const typeColor = (t: string) => CAT_COLOR[categoryOf(t)];
const isRenfo = (t: string) => categoryOf(t) === "renfo";
const fmtKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function CalendarView({ sessions, notes: notesProp = [], races: racesProp = [], weekStart = "mon", units = "metric" }: { sessions: Planned[]; notes?: CalNote[]; races?: CalRace[]; weekStart?: "mon" | "sun"; units?: UnitSystem }) {
  const { t, lang } = useT();
  const [sel, setSel] = useState<string | null>(null);
  const [notes, setNotes] = useState<CalNote[]>(notesProp);
  const [races, setRaces] = useState<CalRace[]>(racesProp);
  const [adding, setAdding] = useState<null | "note" | "race">(null);
  const [noteText, setNoteText] = useState("");
  const [race, setRace] = useState({ name: "", location: "", distanceKm: "" });
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState<{ name: string; city: string; distanceKm: number | null; date: string; type: string }[]>([]);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [offset, setOffset] = useState(0); // décalage en blocs de 4 semaines
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRaceName = (v: string) => {
    setRace((r) => ({ ...r, name: v }));
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (v.trim().length < 2) { setSuggest([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/races/search?q=${encodeURIComponent(v.trim())}`);
        const j = await res.json();
        setSuggest(Array.isArray(j.races) ? j.races : []);
      } catch { /* recherche silencieuse */ }
    }, 250);
  };
  const pickRace = (s: { name: string; city: string; distanceKm: number | null }) => {
    setRace({ name: s.name, location: s.city || "", distanceKm: s.distanceKm != null ? String(s.distanceKm) : "" });
    setSuggest([]);
  };

  const coachByDate: Record<string, Planned> = {};
  for (const s of sessions) if (!coachByDate[s.date]) coachByDate[s.date] = s;
  const notesByDate: Record<string, CalNote[]> = {};
  for (const n of notes) (notesByDate[n.date] ??= []).push(n);
  const racesByDate: Record<string, CalRace[]> = {};
  for (const r of races) (racesByDate[r.date] ??= []).push(r);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = fmtKey(today);
  const baseStart = new Date(today);
  baseStart.setDate(today.getDate() - (weekStart === "sun" ? today.getDay() : (today.getDay() + 6) % 7));
  const gridStart = new Date(baseStart);
  gridStart.setDate(baseStart.getDate() + offset * 7);
  const weeks = Array.from({ length: 4 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + wi * 7 + di); return d; }));
  const dayHeaders = Array.from({ length: 7 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d.toLocaleDateString(lang, { weekday: "short" }); });
  const rangeLabel = `${weeks[0][0].toLocaleDateString(lang, { day: "numeric", month: "short" })} – ${weeks[3][6].toLocaleDateString(lang, { day: "numeric", month: "short" })}`;

  // Stats de période (séances planifiées sur les 4 semaines affichées + cette semaine).
  const periodCount = weeks.flat().filter((d) => coachByDate[fmtKey(d)]).length;
  const thisWeekCount = weeks[0].filter((d) => coachByDate[fmtKey(d)] && offset === 0).length;

  // Agenda : toutes les dates avec contenu, ≥ aujourd'hui, triées.
  const agendaDates = useMemo(() => {
    const set = new Set<string>([...Object.keys(coachByDate), ...Object.keys(notesByDate), ...Object.keys(racesByDate)]);
    return [...set].filter((k) => k >= todayKey).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, notes, races]);

  const coach = sel ? coachByDate[sel] : null;
  const selNotes = sel ? (notesByDate[sel] ?? []) : [];
  const selRaces = sel ? (racesByDate[sel] ?? []) : [];

  const openDay = (key: string) => { setSel(key); setAdding(null); setNoteText(""); setRace({ name: "", location: "", distanceKm: "" }); setSuggest([]); };
  const weekLabel = (n: number) => (n > 1 ? t("cal.week.many", { n }) : t("cal.week.one", { n }));

  const addEntry = async () => {
    if (!sel || busy) return;
    setBusy(true);
    try {
      const payload = adding === "race"
        ? { date: sel, kind: "race", name: race.name, location: race.location, distanceKm: race.distanceKm }
        : { date: sel, kind: "note", text: noteText };
      const r = await fetch("/api/calendar-entry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) { toast.error(j.error || t("cal.toast.failed")); return; }
      if (adding === "race") {
        setRaces((rs) => [...rs, { id: j.id, date: sel, name: race.name, location: race.location, distanceKm: race.distanceKm ? Number(race.distanceKm) : null }]);
        toast.success(t("cal.toast.raceAdded"));
      } else {
        setNotes((ns) => [...ns, { id: j.id, date: sel, text: noteText }]);
        toast.success(t("cal.toast.noteAdded"));
      }
      setAdding(null); setNoteText(""); setRace({ name: "", location: "", distanceKm: "" }); setSuggest([]);
    } catch { toast.error(t("cal.toast.saveFailed")); }
    finally { setBusy(false); }
  };

  const del = async (id: string, kind: "note" | "race") => {
    try {
      const r = await fetch(`/api/calendar-entry?id=${id}`, { method: "DELETE" });
      const j = await r.json();
      if (j.ok) {
        if (kind === "race") setRaces((rs) => rs.filter((x) => x.id !== id));
        else setNotes((ns) => ns.filter((x) => x.id !== id));
      } else toast.error(j.error || t("cal.toast.failed"));
    } catch { toast.error(t("cal.toast.delFailed")); }
  };

  // ── Carte « séance » réutilisée (grille + agenda) ──
  const SessionCard = ({ s, dense }: { s: Planned; dense?: boolean }) => {
    const c = typeColor(s.type);
    return (
      <div className="overflow-hidden rounded-xl text-left" style={{ background: c.soft }}>
        <div className="h-1.5" style={{ background: c.bg }} />
        <div className={dense ? "p-1.5" : "p-2.5"}>
          <div className={`font-extrabold uppercase tracking-wide ${dense ? "text-[9px]" : "text-[10px]"}`} style={{ color: c.fg }}>{s.type}</div>
          <div className={`font-bold leading-tight text-zinc-800 ${dense ? "line-clamp-2 text-[11.5px]" : "text-sm"}`}>{s.title}</div>
          {s.detail && <div className={`mt-0.5 whitespace-pre-line leading-snug text-zinc-500 ${dense ? "line-clamp-3 text-[10px]" : "text-xs"}`}>{s.detail}</div>}
          {s.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-0.5">{s.tags.slice(0, dense ? 3 : 6).map((tg) => <span key={tg} className={`rounded bg-white/70 px-1 py-px font-semibold text-zinc-500 ${dense ? "text-[8.5px]" : "text-[10px]"}`}>{tg}</span>)}</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Barre de contrôle : navigation période + bascule de vue */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setOffset((o) => o - 4)} aria-label="prev" className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setOffset(0)} disabled={offset === 0} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40">{t("cal.today")}</button>
          <button onClick={() => setOffset((o) => o + 4)} aria-label="next" className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800"><ChevronRight className="h-4 w-4" /></button>
          <span className="ml-2 hidden text-sm font-semibold text-zinc-500 first-letter:uppercase sm:inline">{rangeLabel}</span>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 text-sm font-semibold">
          {([["month", LayoutGrid, t("cal.view.month")], ["agenda", List, t("cal.view.agenda")]] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${view === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Légende des types de séance */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{t("cal.legend")}</span>
        {LEGEND_ORDER.map((cat) => (
          <span key={cat} className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLOR[cat].bg }} />
            {t(`cal.cat.${cat}`)}
          </span>
        ))}
      </div>

      {view === "month" ? (
        <>
          <p className="mb-3 text-sm text-zinc-500">{t("cal.hint")} 🏁</p>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="min-w-[700px] lg:min-w-0">
              <div className="mb-2.5 grid grid-cols-7 gap-2 sm:gap-3">
                {dayHeaders.map((d, i) => <div key={i} className="text-center text-[11px] font-bold uppercase tracking-widest text-zinc-400 first-letter:uppercase">{d}</div>)}
              </div>

              <div className="space-y-4">
                {weeks.map((week, wi) => {
                  const cats = week.map((d) => coachByDate[fmtKey(d)]).filter(Boolean).map((s) => categoryOf((s as Planned).type));
                  const count = cats.length;
                  const uniqueCats = [...new Set(cats)];
                  return (
                    <div key={wi}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 first-letter:uppercase">{t("cal.weekOf", { date: week[0].toLocaleDateString(lang, { day: "numeric", month: "short" }) })}</div>
                        <div className="flex items-center gap-2">
                          {count > 0 ? (
                            <>
                              <div className="flex items-center gap-0.5">{uniqueCats.map((c) => <span key={c} className="h-2 w-2 rounded-full" style={{ background: CAT_COLOR[c].bg }} />)}</div>
                              <span className="text-[11px] font-semibold text-zinc-400">{weekLabel(count)}</span>
                            </>
                          ) : (
                            <span className="text-[11px] font-medium text-zinc-300">{t("cal.week.rest")}</span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-2 sm:gap-3">
                        {week.map((d) => {
                          const key = fmtKey(d);
                          const s = coachByDate[key];
                          const nNotes = (notesByDate[key] ?? []).length;
                          const dayRaces = racesByDate[key] ?? [];
                          const isToday = key === todayKey;
                          const active = sel === key;
                          const empty = !s && dayRaces.length === 0 && nNotes === 0;
                          return (
                            <button key={key} onClick={() => openDay(key)}
                              className={`group flex min-h-[136px] flex-col rounded-2xl border p-2 text-left transition-all duration-200
                                ${isToday ? "border-emerald-400 bg-emerald-50/40 ring-1 ring-emerald-200" : empty ? "border-zinc-200/70 bg-zinc-50/40 hover:border-emerald-300 hover:bg-white" : "border-zinc-200/80 bg-white hover:border-emerald-300 hover:shadow-md"}
                                ${active ? "ring-2 ring-emerald-400" : ""}`}>
                              <div className={`mb-1.5 flex justify-center text-sm font-bold ${isToday ? "" : "text-zinc-400"}`}>
                                <span className={isToday ? "flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[13px] text-white shadow-sm" : ""}>{d.getDate()}</span>
                              </div>
                              <div className="flex flex-1 flex-col gap-1">
                                {s && <SessionCard s={s} dense />}
                                {dayRaces.map((r) => (
                                  <div key={r.id} className="flex items-center gap-1 rounded-lg bg-amber-100 px-1.5 py-1 text-[10px] font-bold text-amber-800"><Flag className="h-3 w-3 flex-shrink-0" /><span className="truncate">{r.name}</span></div>
                                ))}
                                {nNotes > 0 && <div className="flex items-center gap-1 rounded-lg bg-zinc-100 px-1.5 py-1 text-[10px] font-semibold text-zinc-500"><StickyNote className="h-3 w-3" />{nNotes}</div>}
                                {empty && <div className="flex flex-1 items-center justify-center text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100"><Plus className="h-4 w-4" /></div>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── Vue Agenda : chronologie des séances/courses/notes à venir ── */
        <div>
          {agendaDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm"><CalendarRange className="h-7 w-7 text-zinc-300" /></div>
              <p className="max-w-xs text-sm text-zinc-500">{t("cal.agenda.empty")}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {agendaDates.map((key) => {
                const d = new Date(key + "T00:00:00");
                const s = coachByDate[key];
                const dayRaces = racesByDate[key] ?? [];
                const dayNotes = notesByDate[key] ?? [];
                const isToday = key === todayKey;
                return (
                  <div key={key} className="flex gap-3 sm:gap-4">
                    <div className="flex w-12 flex-shrink-0 flex-col items-center pt-1 sm:w-14">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 first-letter:uppercase">{d.toLocaleDateString(lang, { weekday: "short" })}</div>
                      <div className={`text-2xl font-bold leading-tight ${isToday ? "text-emerald-600" : "text-zinc-900"}`}>{d.getDate()}</div>
                      <div className="text-[10px] text-zinc-400 first-letter:uppercase">{d.toLocaleDateString(lang, { month: "short" })}</div>
                    </div>
                    <div className="flex-1 space-y-2 border-l border-zinc-100 pb-4 pl-3 sm:pl-4">
                      {isToday && <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{t("cal.today")}</span>}
                      {s && <button onClick={() => openDay(key)} className="block w-full transition-transform hover:-translate-y-0.5"><SessionCard s={s} /></button>}
                      {dayRaces.map((r) => (
                        <button key={r.id} onClick={() => openDay(key)} className="flex w-full items-center gap-2.5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-left ring-1 ring-amber-100 transition-colors hover:bg-amber-100/70">
                          <Flag className="h-4 w-4 flex-shrink-0 text-amber-600" />
                          <div className="min-w-0"><div className="truncate font-bold text-zinc-900">{r.name}</div><div className="truncate text-xs text-zinc-500">{[r.location, r.distanceKm != null ? fmtDistance(r.distanceKm, units) : ""].filter(Boolean).join(" · ") || t("cal.panel.plannedRace")}</div></div>
                        </button>
                      ))}
                      {dayNotes.map((n) => (
                        <button key={n.id} onClick={() => openDay(key)} className="flex w-full items-start gap-2.5 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-left transition-colors hover:bg-zinc-100"><StickyNote className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" /><p className="line-clamp-2 whitespace-pre-line text-sm text-zinc-700">{n.text}</p></button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Panneau du jour sélectionné */}
      {sel && (
        <div className="mt-5 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 bg-zinc-900 px-5 py-3 text-white">
            <div className="text-sm font-bold first-letter:uppercase">{new Date(sel + "T00:00:00").toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}</div>
            <button onClick={() => setSel(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"><X className="h-4 w-4" /></button>
          </div>

          <div className="space-y-4 p-5">
            {/* Séance coach */}
            {coach && (
              <div className="rounded-2xl p-4" style={{ background: typeColor(coach.type).soft }}>
                <div className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: typeColor(coach.type).fg }}>{coach.type} · {t("cal.panel.coachSession")}</div>
                <h3 className="text-lg font-bold text-zinc-900">{coach.title}</h3>
                {coach.tags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{coach.tags.map((tg) => <span key={tg} className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">{tg}</span>)}</div>}
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-700">{coach.detail.replace(/\s*→\s*/g, "\n")}</p>
                {coach.why && <div className="mt-2 rounded-xl bg-white/60 p-3 text-sm leading-relaxed text-zinc-700"><b>{t("cal.panel.why")}&nbsp;:</b> {coach.why}</div>}
                {coach.feel && <div className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-zinc-600"><Target className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" /><span><b className="text-zinc-700">{t("cal.panel.feel")}&nbsp;:</b> {coach.feel}</span></div>}
                {isRenfo(coach.type) && <div className="mt-3"><RenfoGuide /></div>}
              </div>
            )}

            {/* Courses planifiées du jour */}
            {selRaces.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                <div className="flex items-center gap-2.5">
                  <Flag className="h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <div className="font-bold text-zinc-900">{r.name}</div>
                    <div className="text-xs text-zinc-500">{[r.location, r.distanceKm != null ? fmtDistance(r.distanceKm, units) : ""].filter(Boolean).join(" · ") || t("cal.panel.plannedRace")}</div>
                  </div>
                </div>
                <button onClick={() => del(r.id, "race")} className="text-zinc-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}

            {/* Notes du jour */}
            {selNotes.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-2 rounded-2xl bg-zinc-50 px-4 py-3">
                <div className="flex items-start gap-2.5"><StickyNote className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" /><p className="whitespace-pre-line text-sm text-zinc-700">{n.text}</p></div>
                <button onClick={() => del(n.id, "note")} className="flex-shrink-0 text-zinc-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}

            {/* Ajout */}
            {adding === null ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setAdding("note")} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"><StickyNote className="h-4 w-4 text-zinc-400" /> {t("cal.addNote")}</button>
                <button onClick={() => { setAdding("race"); setSuggest([]); }} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"><Flag className="h-4 w-4" /> {t("cal.planRace")}</button>
              </div>
            ) : adding === "note" ? (
              <div className="space-y-2 rounded-2xl border border-zinc-200 p-3">
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} autoFocus placeholder={t("cal.note.ph")}
                  className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                <div className="flex gap-2">
                  <button onClick={addEntry} disabled={busy || !noteText.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("cal.add")}</button>
                  <button onClick={() => setAdding(null)} className="rounded-xl px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50">{t("cal.cancel")}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
                <div className="relative">
                  <input value={race.name} onChange={(e) => onRaceName(e.target.value)} autoFocus autoComplete="off" placeholder={t("cal.race.namePh")} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                  {suggest.length > 0 && (
                    <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl">
                      {suggest.map((s, i) => (
                        <button key={i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickRace(s)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-amber-50">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-zinc-800">{s.name}</span>
                            <span className="block truncate text-[11px] text-zinc-400">{[s.city, s.date ? new Date(s.date).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" }) : ""].filter(Boolean).join(" · ")}</span>
                          </span>
                          {s.distanceKm != null && <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{fmtDistance(s.distanceKm, units)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <input value={race.location} onChange={(e) => setRace({ ...race, location: e.target.value })} placeholder={t("cal.race.locPh")} className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                  <input value={race.distanceKm} onChange={(e) => setRace({ ...race, distanceKm: e.target.value })} type="number" placeholder={t("cal.race.kmPh")} className="w-20 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addEntry} disabled={busy || !race.name.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />} {t("cal.plan")}</button>
                  <button onClick={() => setAdding(null)} className="rounded-xl px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50">{t("cal.cancel")}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
