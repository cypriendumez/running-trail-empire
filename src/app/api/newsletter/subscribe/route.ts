export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/newsletter/subscribe { email }
// Inscription publique à la newsletter. Idempotent (upsert sur l'email). Lie au compte si connecté.
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const clean = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(clean) || clean.length > 200) {
    return NextResponse.json({ ok: false, error: "Adresse e-mail invalide" }, { status: 400 });
  }
  // Si la personne est connectée, on relie son compte (sinon abonné anonyme).
  let userId: string | null = null;
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* visiteur non connecté */ }

  try {
    const admin = createAdminClient();
    await admin.from("newsletter_subscribers").upsert(
      { email: clean, user_id: userId, unsubscribed: false },
      { onConflict: "email" },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "Inscription impossible pour le moment" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
