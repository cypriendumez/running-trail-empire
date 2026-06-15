export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/feedback {date, title, rpe (0-10), pain: string[], note}
// → enregistre le ressenti post-séance (lu par le coach, informe la perso IA).
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, title, rpe, pain, note } = await req.json() as { date?: string; title?: string; rpe?: number; pain?: string[]; note?: string };
  if (date == null || rpe == null) return NextResponse.json({ error: "date et rpe requis" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: user.id,
    type: "session_feedback",
    title: "Ressenti séance",
    body: `RPE ${Math.round(Number(rpe))}/10`,
    data: {
      date: String(date).slice(0, 10),
      title: String(title ?? "").slice(0, 80),
      rpe: Math.max(0, Math.min(10, Math.round(Number(rpe)))),
      pain: Array.isArray(pain) ? pain.slice(0, 4).map((p) => String(p).slice(0, 24)) : [],
      note: String(note ?? "").slice(0, 500),
      ts: new Date().toISOString(),
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Alerte e-mail au coach (best-effort) — ressenti + douleurs.
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const COACH_EMAIL = process.env.COACH_EMAIL || "cypriendumez@outlook.fr";
  if (RESEND_API_KEY) {
    try {
      const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();
      const name = (prof?.full_name as string) || (prof?.email as string) || "Un client";
      const r = Math.round(Number(rpe));
      const painTxt = Array.isArray(pain) && pain.length ? pain.join(", ") : "aucune douleur signalée";
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Running & Trail Empire <onboarding@resend.dev>",
          to: [COACH_EMAIL],
          reply_to: (prof?.email as string) || undefined,
          subject: `🏃 Ressenti de ${name} : RPE ${r}/10${title ? ` — ${title}` : ""}`,
          text: `${name} vient de noter sa séance${title ? ` « ${title} »` : ""} :\n\n• Ressenti d'effort : ${r}/10\n• Douleurs : ${painTxt}\n${note ? `• Note : « ${note} »\n` : ""}\n→ Détails dans l'espace coach.`,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch { /* e-mail best-effort, le ressenti est déjà enregistré */ }
  }

  return NextResponse.json({ ok: true });
}
