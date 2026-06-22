export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COACH_EMAIL = process.env.COACH_EMAIL || "cypriendumez@outlook.fr";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
type Attachment = { url: string; name: string; type: string };

const cleanAtt = (a: unknown): Attachment[] => Array.isArray(a)
  ? a.slice(0, 5).map((x) => ({ url: String((x as Attachment).url ?? "").slice(0, 600), name: String((x as Attachment).name ?? "fichier").slice(0, 120), type: String((x as Attachment).type ?? "").slice(0, 80) })).filter((x) => x.url)
  : [];

// POST = envoyer un message (ou {action:"restore", id} pour restaurer).
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const b = await req.json() as { action?: string; id?: string; subject?: string; body?: string; attachments?: unknown };

  if (b.action === "restore" && b.id) {
    const { data: row } = await admin.from("notifications").select("data").eq("id", b.id).eq("user_id", user.id).single();
    if (row) await admin.from("notifications").update({ data: { ...(row.data as object), deleted: false } }).eq("id", b.id).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  const atts = cleanAtt(b.attachments);
  if (!b.body?.trim() && atts.length === 0) return NextResponse.json({ error: "Message vide" }, { status: 400 });

  const { data: ins, error } = await admin.from("notifications").insert({
    user_id: user.id, type: "client_message",
    title: (b.subject?.trim() || "Message").slice(0, 80),
    body: (b.body || (atts.length ? `📎 ${atts.length} pièce(s) jointe(s)` : "")).slice(0, 200),
    data: { from: "client", subject: String(b.subject ?? "").slice(0, 120), body: String(b.body ?? "").slice(0, 2000), attachments: atts, ts: new Date().toISOString() },
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (RESEND_API_KEY) {
    try {
      const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();
      const name = (prof?.full_name as string) || (prof?.email as string) || "Un client";
      const link = `${APP_URL}/admin/messages?client=${user.id}`;
      const attLine = atts.length ? `<p style="color:#666;font-size:13px">📎 ${atts.length} pièce(s) jointe(s)</p>` : "";
      await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Pacevo <onboarding@resend.dev>",
          to: [COACH_EMAIL], reply_to: (prof?.email as string) || undefined,
          subject: `📩 ${name} t'a écrit${b.subject?.trim() ? ` : ${b.subject.trim()}` : ""}`,
          html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:540px;color:#18181b"><p style="font-size:15px"><b>${name}</b> t'a envoyé un message via Pacevo :</p><blockquote style="border-left:3px solid #10b981;margin:14px 0;padding:8px 16px;color:#333;background:#f6fdf9;border-radius:0 8px 8px 0">${(b.body || "").replace(/</g, "&lt;") || "(pièce jointe)"}</blockquote>${attLine}<p style="margin-top:20px"><a href="${link}" style="background:#059669;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">Répondre à ${name} →</a></p><p style="color:#999;font-size:12px;margin-top:18px">Ce bouton ouvre directement la conversation dans ton espace coach.</p></div>`,
        }), signal: AbortSignal.timeout(10000),
      });
    } catch { /* best-effort */ }
  }
  return NextResponse.json({ ok: true, id: ins?.id });
}

// DELETE ?id= → mise à la corbeille (soft-delete).
export async function DELETE(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const admin = createAdminClient();
  const { data: row } = await admin.from("notifications").select("data").eq("id", id).eq("user_id", user.id).in("type", ["client_message", "coach_message"]).single();
  if (row) await admin.from("notifications").update({ data: { ...(row.data as object), deleted: true } }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
