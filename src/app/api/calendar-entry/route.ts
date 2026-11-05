export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveVma } from "@/lib/ai/coachContext";
import { setRaceObjective, predictTargetSeconds } from "@/lib/coach/objective";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { prioriteDe } from "@/lib/coach/saison";
import { objectifEnCours } from "@/lib/coach/prochaineCourse";
import { autoCoachForUser } from "@/lib/ai/autoCoach";

// POST /api/calendar-entry — le client ajoute une note ou une course planifiée à un jour.
//   {date, kind:"note", text}  OU  {date, kind:"race", name, location?, distanceKm?}
//   « M'entraîner pour cette course » (kind:"race" + distance + date réelle) définit AUSSI
//   l'objectif de course (temps cible prédit depuis la VMA) → séances cohérentes.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json() as { date?: string; kind?: string; text?: string; name?: string; location?: string; distanceKm?: number | string; priorite?: string };
  if (!b.date || !b.kind) return NextResponse.json({ error: "date et kind requis" }, { status: 400 });
  const date = String(b.date).slice(0, 10);
  const admin = createAdminClient();

  let row;
  if (b.kind === "race") {
    if (!b.name?.trim()) return NextResponse.json({ error: "Nom de course requis" }, { status: 400 });
    const distanceKm = b.distanceKm != null && b.distanceKm !== "" ? Number(b.distanceKm) : null;
    row = {
      user_id: user.id, type: "planned_race", title: b.name.slice(0, 80),
      body: [b.location, distanceKm ? `${distanceKm} km` : ""].filter(Boolean).join(" · ").slice(0, 200),
      // Priorité dans la saison (lib/coach/saison) : A se prépare et s'affûte, B se court en
      // préparation, C remplace une séance. Sans réponse : C — noter une course ne doit rien bouleverser.
      data: { date, name: String(b.name).slice(0, 80), location: String(b.location ?? "").slice(0, 80), priorite: prioriteDe(b.priorite), distanceKm: distanceKm != null && isFinite(distanceKm) ? distanceKm : null, ts: new Date().toISOString() },
    };
  } else {
    if (!b.text?.trim()) return NextResponse.json({ error: "Note vide" }, { status: 400 });
    row = {
      user_id: user.id, type: "client_note", title: "Note",
      body: b.text.slice(0, 200),
      data: { date, text: String(b.text).slice(0, 1000), ts: new Date().toISOString() },
    };
  }

  const { data, error } = await admin.from("notifications").insert(row).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // « M'entraîner pour cette course » (priorité A) → l'objectif DÉCLARÉ, mais seulement s'il
  // n'y en a pas déjà un à venir. ⚠️ Avant la saison (05/11/2026), TOUTE course ajoutée avec
  // une distance remplaçait l'objectif : noter une course de préparation effaçait le
  // marathon. Les courses A suivantes restent dans la saison ; le coach vise la plus proche.
  // ⚠️ ET PLUS DE VMA INVENTÉE : sans VMA connue, le chrono visé était prédit avec 14 km/h et
  // servait d'allure spécifique au plan. Sans VMA, pas d'objectif déclaré : la course A
  // reste dans la saison, sans chrono, et le coach la vise quand même (lib/coach/saison).
  if (b.kind === "race" && prioriteDe(b.priorite) === "A") {
    const distanceKm = b.distanceKm != null && b.distanceKm !== "" ? Number(b.distanceKm) : null;
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && !date.startsWith("2099") && date >= aujourdhui(FUSEAU_DEFAUT);
    if (distanceKm != null && isFinite(distanceKm) && distanceKm > 0 && dateOk) {
      try {
        // Une lecture en échec ne dit PAS « aucun objectif » : sans réponse, on ne touche à rien.
        const { data: objRow, error: eObjectif } = await admin.from("notifications").select("data")
          .eq("user_id", user.id).eq("type", "race_objective").maybeSingle();
        const objectifAVenir = objectifEnCours((objRow as { data?: { raceDate?: unknown } } | null)?.data ?? null, aujourdhui(FUSEAU_DEFAUT));
        const vma = await getEffectiveVma(sb, user.id);
        if (!eObjectif && !objectifAVenir && vma != null) {
          await setRaceObjective(admin, user.id, { race: String(b.name).slice(0, 80), distanceKm, raceDate: date, targetSeconds: predictTargetSeconds(distanceKm, vma) });
        }
      } catch { /* best-effort : la course est déjà ajoutée */ }
    }
  }

  return NextResponse.json({ ok: true, id: data?.id });
}

// PATCH /api/calendar-entry  {id, priorite} — change la priorité d'une course du calendrier
// (lib/coach/saison) et régénère le plan : une course passée en B ou en C change la semaine.
export async function PATCH(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { id?: string; priorite?: string };
  if (!b.id || !["A", "B", "C"].includes(String(b.priorite))) return NextResponse.json({ error: "id et priorité requis" }, { status: 400 });
  const admin = createAdminClient();
  // L'identifiant de l'athlète vient de la SESSION : on ne touche qu'à SES courses.
  const { data: ligne, error: eLecture } = await admin.from("notifications").select("id, data")
    .eq("id", b.id).eq("user_id", user.id).eq("type", "planned_race").maybeSingle();
  if (eLecture) return NextResponse.json({ error: eLecture.message }, { status: 500 });
  if (!ligne) return NextResponse.json({ error: "Course introuvable" }, { status: 404 });
  const data = { ...((ligne as { data?: Record<string, unknown> }).data ?? {}), priorite: prioriteDe(b.priorite) };
  const { error } = await admin.from("notifications").update({ data }).eq("id", b.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: creds } = await admin.from("profiles").select("intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle();
  await autoCoachForUser(admin, {
    userId: user.id,
    athleteId: (creds?.intervals_athlete_id as string | null) ?? null,
    apiKey: (creds?.intervals_api_key as string | null) ?? null,
    notify: false,
  }).catch(() => { /* le cron rattrapera */ });
  return NextResponse.json({ ok: true, priorite: data.priorite });
}

// DELETE /api/calendar-entry?id=... — supprime une note / course planifiée du client.
export async function DELETE(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").delete().eq("id", id).eq("user_id", user.id).in("type", ["client_note", "planned_race"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
