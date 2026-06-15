import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarView, type Planned, type CalNote, type CalRace } from "@/components/training/CalendarView";
import { oneSessionPerDate } from "@/lib/coach/sessions";
import { T, normLang } from "@/lib/i18n/translations";
import { CalendarDays, Flag, ListChecks, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier" };

export default async function CalendrierPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, { data: settingsRow }, { data: profileRow }] = await Promise.all([
    sb.from("notifications").select("id, type, title, data, created_at")
      .eq("user_id", user.id).in("type", ["coach_session", "client_note", "planned_race"])
      .order("created_at", { ascending: false }).limit(200),
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle(),
    sb.from("profiles").select("preferred_language").eq("id", user.id).single(),
  ]);
  const us = (settingsRow?.data ?? {}) as Record<string, unknown>;
  const weekStart: "mon" | "sun" = String(us.weekStart ?? "mon") === "sun" ? "sun" : "mon";
  const units: "metric" | "imperial" = String(us.unitSystem ?? "metric") === "imperial" ? "imperial" : "metric";

  // Langue de l'utilisateur (le hero est rendu côté serveur → on traduit via T directement).
  const lang = normLang(profileRow?.preferred_language ?? "fr");
  const tr = (k: string) => T[lang]?.[k] ?? T.fr[k] ?? k;

  const rows = data ?? [];
  // UNE séance par date (la plus récente) → même plan que Dashboard & Ghost Runner.
  const coachRows = oneSessionPerDate(
    rows.filter((r) => r.type === "coach_session"),
    (r) => String((r.data as { date?: string } | null)?.date ?? "").slice(0, 10),
  );
  const sessions: Planned[] = coachRows.map((r) => {
    const d = (r.data ?? {}) as { date?: string; sessionType?: string; subtitle?: string; why?: string; feel?: string; tags?: string[] };
    return { date: String(d.date ?? "").slice(0, 10), type: d.sessionType || "Séance", title: r.title || "Séance", detail: d.subtitle || "", why: d.why || "", feel: d.feel || "", tags: Array.isArray(d.tags) ? d.tags : [] };
  }).filter((s) => s.date);
  const notes: CalNote[] = rows.filter((r) => r.type === "client_note").map((r) => {
    const d = (r.data ?? {}) as { date?: string; text?: string };
    return { id: String(r.id), date: String(d.date ?? "").slice(0, 10), text: d.text || "" };
  }).filter((n) => n.date);
  const racesPlanned: CalRace[] = rows.filter((r) => r.type === "planned_race").map((r) => {
    const d = (r.data ?? {}) as { date?: string; name?: string; location?: string; distanceKm?: number | null };
    return { id: String(r.id), date: String(d.date ?? "").slice(0, 10), name: d.name || r.title || "Course", location: d.location || "", distanceKm: d.distanceKm ?? null };
  }).filter((x) => x.date);

  // Stats du hero (calculées côté serveur).
  const todayKey = new Date().toISOString().slice(0, 10);
  const sow = new Date(); sow.setHours(0, 0, 0, 0);
  sow.setDate(sow.getDate() - (weekStart === "sun" ? sow.getDay() : (sow.getDay() + 6) % 7));
  const sowKey = sow.toISOString().slice(0, 10);
  const eowKey = new Date(sow.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const weekCount = sessions.filter((s) => s.date >= sowKey && s.date < eowKey).length;
  const upcomingCount = sessions.filter((s) => s.date >= todayKey).length;
  const nextRace = racesPlanned.filter((r) => r.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  const nextRaceLabel = nextRace
    ? `${nextRace.name} · ${new Date(nextRace.date + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "short" })}`
    : tr("cal.stat.noRace");

  const chips: { icon: typeof Flag; text: string }[] = [
    { icon: CalendarClock, text: `${weekCount} ${tr("cal.stat.weekSessions")}` },
    { icon: ListChecks, text: `${upcomingCount} ${tr("cal.stat.periodSessions")}` },
    { icon: Flag, text: nextRaceLabel },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <div className="relative overflow-hidden text-white" style={{ background: "linear-gradient(135deg,#064e3b 0%,#047857 45%,#0d9488 100%)" }}>
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20 backdrop-blur-md">
            <CalendarDays className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-50">{tr("cal.eyebrow")}</span>
          </span>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight drop-shadow-sm">{tr("cal.title")}</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-white/85">{tr("cal.subtitle")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white/90 ring-1 ring-white/15 backdrop-blur-md">
                <c.icon className="h-3.5 w-3.5 text-amber-200" />
                {c.text}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 py-6">
        <CalendarView sessions={sessions} notes={notes} races={racesPlanned} weekStart={weekStart} units={units} />
      </div>
    </div>
  );
}
