export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estAdmin } from "@/lib/admin/acces";


export async function POST(req: NextRequest) {
  // Auth check — only admin can call this
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !estAdmin(user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { to, subject, body: emailBody } = body;

  if (!to || !subject || !emailBody) {
    return NextResponse.json({ error: "to, subject et body sont requis" }, { status: 400 });
  }

  // Use Resend if configured, otherwise fallback to Supabase auth email (magic link)
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Pacevo <noreply@running-trail-empire.com>",
        to: [to],
        subject,
        text: emailBody,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <div style="background:#09090b;border-radius:16px;padding:32px;color:white">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
              <div style="width:40px;height:40px;background:#059669;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;color:#fff">P</div>
              <span style="font-weight:600;font-size:16px">Pacevo</span>
            </div>
            <p style="color:#a1a1aa;font-size:14px;line-height:1.6;white-space:pre-wrap">${emailBody.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            <hr style="border:none;border-top:1px solid #27272a;margin:24px 0" />
            <p style="color:#52525b;font-size:12px">Pacevo · Ne pas répondre à cet email</p>
          </div>
        </div>`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Resend error: ${err}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, provider: "resend" });
  }

  // No email provider configured
  return NextResponse.json({
    error: "Aucun provider email configuré. Ajoutez RESEND_API_KEY dans les variables Railway."
  }, { status: 503 });
}
