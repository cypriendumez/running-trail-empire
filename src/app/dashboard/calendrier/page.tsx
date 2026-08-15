import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarView, type Planned, type PlannedText, type CalNote, type CalRace, type CoachState } from "@/components/training/CalendarView";
import { oneSessionPerSlot, slotKey } from "@/lib/coach/sessions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier" };

export default async function CalendrierPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, { data: settingsRow }, { data: profileRow }, { data: objRow }, { data: stateRow }] = await Promise.all([
    sb.from("notifications").select("id, type, title, data, created_at")
      .eq("user_id", user.id).in("type", ["coach_session", "client_note", "planned_race"])
      .order("created_at", { ascending: false }).limit(200),
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle(),
    sb.from("profiles").select("warmup_min, cooldown_min").eq("id", user.id).maybeSingle(),
    // L'OBJECTIF DE COURSE. Il n'était pas lu ici : le calendrier n'affichait que les
    // `planned_race`, si bien qu'un athlète ayant fixé « Marathon de Lille le 25 octobre »
    // lisait « Aucune course » sur son propre calendrier, et ne voyait nulle part la date
    // qui structure pourtant toute sa préparation.
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    // Pourquoi le plan de la semaine ressemble à ça (sérialisé par le coach autonome au
    // moment de la génération, donc toujours cohérent avec les séances affichées).
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "auto_coach_state").maybeSingle(),
  ]);
  const us = (settingsRow?.data ?? {}) as Record<string, unknown>;
  const weekStart: "mon" | "sun" = String(us.weekStart ?? "mon") === "sun" ? "sun" : "mon";
  const units: "metric" | "imperial" = String(us.unitSystem ?? "metric") === "imperial" ? "imperial" : "metric";
  // Durées d'échauffement / retour au calme choisies par l'athlète (repli 15 / 10 min).
  const warmupMin = Number((profileRow as { warmup_min?: number | null } | null)?.warmup_min) || 15;
  const cooldownMin = Number((profileRow as { cooldown_min?: number | null } | null)?.cooldown_min) || 10;

  const rows = data ?? [];
  // UNE séance par date (la plus récente) → même plan que Dashboard & Ghost Runner.
  const coachRows = oneSessionPerSlot(
    rows.filter((r) => r.type === "coach_session"),
    (r) => slotKey(r.data as { date?: string; moment?: string } | null),
  );
  const sessions: Planned[] = coachRows.map((r) => {
    const d = (r.data ?? {}) as { date?: string; sessionType?: string; subtitle?: string; why?: string; feel?: string; tags?: string[]; confirmed?: boolean; i18n?: Record<string, PlannedText> };
    return { date: String(d.date ?? "").slice(0, 10), type: d.sessionType || "Séance", title: r.title || "Séance", detail: d.subtitle || "", why: d.why || "", feel: d.feel || "", tags: Array.isArray(d.tags) ? d.tags : [],
      // Traductions du plan : c'est le composant client qui choisit la langue, pour que
      // le sélecteur de langue s'applique sans recharger la page.
      i18n: d.i18n,
      // Les séances publiées à la main par le coach n'ont pas ce champ → considérées confirmées.
      confirmed: d.confirmed !== false };
  }).filter((s) => s.date);
  const notes: CalNote[] = rows.filter((r) => r.type === "client_note").map((r) => {
    const d = (r.data ?? {}) as { date?: string; text?: string };
    return { id: String(r.id), date: String(d.date ?? "").slice(0, 10), text: d.text || "" };
  }).filter((n) => n.date);
  const racesPlanned: CalRace[] = rows.filter((r) => r.type === "planned_race").map((r) => {
    const d = (r.data ?? {}) as { date?: string; name?: string; location?: string; distanceKm?: number | null };
    return { id: String(r.id), date: String(d.date ?? "").slice(0, 10), name: d.name || r.title || "Course", location: d.location || "", distanceKm: d.distanceKm ?? null };
  }).filter((x) => x.date);

  // L'objectif rejoint les courses du calendrier — c'est la date la plus importante du
  // plan, elle ne peut pas être la seule à ne pas y figurer. `isObjective` permet de la
  // distinguer visuellement d'une course simplement notée. Dédoublonnage sur la date :
  // « M'entraîner pour cette course » peut avoir créé les deux lignes.
  const obj = (objRow?.data ?? null) as { race?: string; raceDate?: string; distanceKm?: number; targetTime?: string } | null;
  const objDate = String(obj?.raceDate ?? "").slice(0, 10);
  const races: CalRace[] = obj && /^\d{4}-\d{2}-\d{2}$/.test(objDate)
    ? [{ id: "race-objective", date: objDate, name: obj.race || "Objectif", location: "", distanceKm: obj.distanceKm ?? null, isObjective: true },
       ...racesPlanned.filter((r) => r.date !== objDate)]
    : racesPlanned;

  const coachState = (stateRow?.data ?? null) as CoachState | null;

  // Le hero (présentation + détail réactif de la séance sélectionnée) vit désormais dans CalendarView.
  return <CalendarView sessions={sessions} notes={notes} races={races} coachState={coachState} weekStart={weekStart} units={units} warmupMin={warmupMin} cooldownMin={cooldownMin} />;
}
