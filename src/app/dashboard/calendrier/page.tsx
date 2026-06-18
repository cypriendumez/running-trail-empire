import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarView, type Planned, type CalNote, type CalRace } from "@/components/training/CalendarView";
import { oneSessionPerDate } from "@/lib/coach/sessions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier" };

export default async function CalendrierPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, { data: settingsRow }] = await Promise.all([
    sb.from("notifications").select("id, type, title, data, created_at")
      .eq("user_id", user.id).in("type", ["coach_session", "client_note", "planned_race"])
      .order("created_at", { ascending: false }).limit(200),
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle(),
  ]);
  const us = (settingsRow?.data ?? {}) as Record<string, unknown>;
  const weekStart: "mon" | "sun" = String(us.weekStart ?? "mon") === "sun" ? "sun" : "mon";
  const units: "metric" | "imperial" = String(us.unitSystem ?? "metric") === "imperial" ? "imperial" : "metric";

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

  // Le hero (présentation + détail réactif de la séance sélectionnée) vit désormais dans CalendarView.
  return <CalendarView sessions={sessions} notes={notes} races={racesPlanned} weekStart={weekStart} units={units} />;
}
