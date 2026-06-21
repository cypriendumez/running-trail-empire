export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAIL = "cypriendumez@outlook.fr";

// POST /api/admin/broadcast { title, body }
// Publie un article/newsletter : e-mail (Resend) à tous les abonnés + e-mails des comptes,
// + une notification dans le site pour chaque utilisateur inscrit.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, body } = (await req.json()) as { title?: string; body?: string };
  const t = String(title ?? "").trim();
  const b = String(body ?? "").trim();
  if (!t || !b) return NextResponse.json({ error: "Titre et contenu requis" }, { status: 400 });

  const admin = createAdminClient();

  // Destinataires : UNIQUEMENT les personnes ABONNÉES à la newsletter (opt-in, non désinscrites).
  // On n'envoie JAMAIS aux comptes qui ne se sont pas abonnés.
  const { data: subs } = await admin
    .from("newsletter_subscribers")
    .select("email, user_id")
    .eq("unsubscribed", false);
  const subRows = (subs ?? []) as { email?: string; user_id?: string | null }[];
  const emails = new Set<string>();
  for (const s of subRows) if (s.email) emails.add(s.email.toLowerCase());
  const recipients = [...emails];

  // 1) Notification site : seulement pour les abonnés qui ont un compte (user_id), dédupliqués.
  const subUserIds = [...new Set(subRows.map((s) => s.user_id).filter((id): id is string => !!id))];
  const notifRows = subUserIds.map((uid) => ({
    user_id: uid, type: "newsletter", title: t.slice(0, 120), body: b.slice(0, 500),
    data: { from: "newsletter", title: t, ts: new Date().toISOString() },
  }));
  let notified = 0;
  if (notifRows.length) {
    const { error } = await admin.from("notifications").insert(notifRows);
    if (!error) notified = notifRows.length;
  }

  // 2) E-mails via Resend, en lots BCC de 45 (un seul envoi par lot, sans exposer les adresses).
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.RESEND_FROM || "Running & Trail Empire <noreply@running-trail-empire.com>";
  let emailed = 0;
  if (RESEND_API_KEY && recipients.length) {
    const html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#18181b">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div style="width:36px;height:36px;background:#059669;border-radius:10px;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center">R</div>
        <strong style="font-size:15px">Running &amp; Trail Empire</strong>
      </div>
      <h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(t)}</h1>
      <div style="font-size:15px;line-height:1.7;color:#3f3f46;white-space:pre-wrap">${escapeHtml(b)}</div>
      <p style="margin-top:28px;font-size:12px;color:#a1a1aa">Tu reçois cet e-mail car tu es abonné(e) à Running &amp; Trail Empire.</p>
    </div>`;
    const batches: string[][] = [];
    for (let i = 0; i < recipients.length; i += 45) batches.push(recipients.slice(i, i + 45));
    for (const batch of batches) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: [FROM.replace(/.*<(.+)>.*/, "$1")], bcc: batch, subject: t, text: b, html }),
        });
        if (r.ok) emailed += batch.length;
      } catch { /* best effort : un lot raté n'annule pas le reste */ }
    }
  }

  return NextResponse.json({ ok: true, recipients: recipients.length, emailed, notified });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
