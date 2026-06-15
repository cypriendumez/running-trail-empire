export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveVma } from "@/lib/ai/coachContext";
import { setRaceObjective, predictTargetSeconds } from "@/lib/coach/objective";

// POST /api/calendar-entry — le client ajoute une note ou une course planifiée à un jour.
//   {date, kind:"note", text}  OU  {date, kind:"race", name, location?, distanceKm?}
//   « M'entraîner pour cette course » (kind:"race" + distance + date réelle) définit AUSSI
//   l'objectif de course (temps cible prédit depuis la VMA) → séances cohérentes.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json() as { date?: string; kind?: string; text?: string; name?: string; location?: string; distanceKm?: number | string };
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
      data: { date, name: String(b.name).slice(0, 80), location: String(b.location ?? "").slice(0, 80), distanceKm: distanceKm != null && isFinite(distanceKm) ? distanceKm : null, ts: new Date().toISOString() },
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

  // « M'entraîner pour cette course » → cette course devient l'objectif d'entraînement.
  // On ne le fait que si on a une distance ET une date réelle (≠ placeholder 2099) : sinon
  // impossible de prédire un temps cible cohérent. Best-effort (n'empêche jamais l'ajout).
  if (b.kind === "race") {
    const distanceKm = b.distanceKm != null && b.distanceKm !== "" ? Number(b.distanceKm) : null;
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && !date.startsWith("2099") && date >= new Date().toISOString().slice(0, 10);
    if (distanceKm != null && isFinite(distanceKm) && distanceKm > 0 && dateOk) {
      try {
        const vma = (await getEffectiveVma(sb, user.id)) ?? 14; // repli prudent si VMA inconnue
        const targetSeconds = predictTargetSeconds(distanceKm, vma);
        await setRaceObjective(admin, user.id, { race: String(b.name).slice(0, 80), distanceKm, raceDate: date, targetSeconds });
      } catch { /* best-effort : la course est déjà ajoutée */ }
    }
  }

  return NextResponse.json({ ok: true, id: data?.id });
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
