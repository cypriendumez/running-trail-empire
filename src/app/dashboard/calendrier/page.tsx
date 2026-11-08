import { prioriteDe } from "@/lib/coach/saison";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarView, type Planned, type PlannedText, type CalNote, type CalRace, type CoachState } from "@/components/training/CalendarView";
import { oneSessionPerSlot, slotKey } from "@/lib/coach/sessions";
import { estUnePanne } from "@/lib/dashboard/lectures";
import { COLONNES_ACCES, rappelPremiumPour, type ProfilAcces } from "@/lib/billing/access";
import { rappelAffichable, TYPE_RAPPEL_PREMIUM } from "@/lib/coach/rappelPremium";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier" };

export default async function CalendrierPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [seancesRes, { data: settingsRow }, { data: profileRow }, { data: objRow }, { data: stateRow }, { data: rappelRow }] = await Promise.all([
    sb.from("notifications").select("id, type, title, data, created_at")
      .eq("user_id", user.id).in("type", ["coach_session", "client_note", "planned_race"])
      .order("created_at", { ascending: false }).limit(200),
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle(),
    sb.from("profiles").select(`warmup_min, cooldown_min, ${COLONNES_ACCES}`).eq("id", user.id).maybeSingle(),
    // L'OBJECTIF DE COURSE. Il n'était pas lu ici : le calendrier n'affichait que les
    // `planned_race`, si bien qu'un athlète ayant fixé « Marathon de Lille le 25 octobre »
    // lisait « Aucune course » sur son propre calendrier, et ne voyait nulle part la date
    // qui structure pourtant toute sa préparation.
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    // Pourquoi le plan de la semaine ressemble à ça (sérialisé par le coach autonome au
    // moment de la génération, donc toujours cohérent avec les séances affichées).
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "auto_coach_state").maybeSingle(),
    // Ce que Premium aurait changé à ce plan, calculé par le même passage du coach.
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", TYPE_RAPPEL_PREMIUM)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  /**
   * ⚠️ UN CALENDRIER VIDE N'EST PAS UN CALENDRIER EN PANNE.
   *
   * Cette lecture ramène TOUT le contenu de l'écran — séances du coach, notes, courses
   * planifiées. Son erreur n'était pas lue : en cas d'échec, `data` vaut `null`, le
   * `?? []` prend le relais, et l'athlète voit un calendrier VIDE. Or c'est le mois de
   * son plan d'entraînement : lui montrer un mois blanc revient à lui dire que son
   * plan a disparu.
   *
   * `PGRST116` n'est pas concerné ici (pas de `.single()`), mais on passe par le même
   * juge que le tableau de bord pour qu'il n'existe qu'une définition de « panne ».
   */
  const data = seancesRes.data;
  const lectureEnPanne = estUnePanne(seancesRes);
  if (lectureEnPanne) console.error("[calendrier] séances illisibles :", seancesRes.error?.message);
  const us = (settingsRow?.data ?? {}) as Record<string, unknown>;
  // Téléphone → vue Agenda d'abord. L'agent utilisateur suffit pour un DÉFAUT d'onglet :
  // se tromper coûte un clic, pas une fonctionnalité.
  const surTelephone = /Mobi|Android|iPhone|iPad/i.test((await headers()).get("user-agent") ?? "");
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
    const d = (r.data ?? {}) as { date?: string; name?: string; location?: string; distanceKm?: number | null; priorite?: unknown };
    return { id: String(r.id), date: String(d.date ?? "").slice(0, 10), name: d.name || r.title || "Course", location: d.location || "", distanceKm: d.distanceKm ?? null, priorite: prioriteDe(d.priorite) };
  }).filter((x) => x.date);

  // L'objectif rejoint les courses du calendrier — c'est la date la plus importante du
  // plan, elle ne peut pas être la seule à ne pas y figurer. `isObjective` permet de la
  // distinguer visuellement d'une course simplement notée. Dédoublonnage sur la date :
  // « M'entraîner pour cette course » peut avoir créé les deux lignes.
  const obj = (objRow?.data ?? null) as { race?: string; raceDate?: string; distanceKm?: number; targetTime?: string } | null;
  const objDate = String(obj?.raceDate ?? "").slice(0, 10);
  const races: CalRace[] = obj && /^\d{4}-\d{2}-\d{2}$/.test(objDate)
    ? [{ id: "race-objective", date: objDate, name: obj.race || "Objectif", location: "", distanceKm: obj.distanceKm ?? null, isObjective: true, priorite: "A" as const },
       ...racesPlanned.filter((r) => r.date !== objDate)]
    : racesPlanned;

  const coachState = (stateRow?.data ?? null) as CoachState | null;
  // Le rappel ne s'adresse qu'à un plan bâti sur la lecture essentielle : un athlète passé à
  // Premium ne doit plus lire ce que Premium « aurait » changé. Et seulement celui du jour,
  // daté comme le coach le date (son fuseau de référence) — celui de la veille décrit une
  // semaine qui a glissé.
  const rappelPremium = rappelPremiumPour(profileRow as ProfilAcces | null)
    ? rappelAffichable(rappelRow?.data, aujourdhui(FUSEAU_DEFAUT))
    : null;

  // Le hero (présentation + détail réactif de la séance sélectionnée) vit désormais dans CalendarView.
  return (
    <>
      <CalendarView enPanne={lectureEnPanne} sessions={sessions} notes={notes} races={races} coachState={coachState} rappelPremium={rappelPremium} weekStart={weekStart} units={units} warmupMin={warmupMin} cooldownMin={cooldownMin} realismeMasque={typeof us.realismeMasque === "string" ? us.realismeMasque : null} vueParDefaut={surTelephone ? "agenda" : "month"} />
    </>
  );
}
