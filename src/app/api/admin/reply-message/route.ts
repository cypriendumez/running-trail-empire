export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estAdmin } from "@/lib/admin/acces";
import { nettoyerPieces } from "@/lib/messages/piecesJointes";


// POST /api/admin/reply-message {user_id, body} — le coach répond à un client.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !estAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id, body, attachments } = await req.json() as { user_id?: string; body?: string; attachments?: { url: string; name: string; type: string }[] };
  // Mêmes règles que la messagerie des athlètes : seules nos pièces jointes privées.
  const atts = nettoyerPieces(attachments);
  if (!user_id || (!body?.trim() && atts.length === 0)) return NextResponse.json({ error: "user_id et message requis" }, { status: 400 });

  const admin = createAdminClient();
  const { data: ins, error } = await admin.from("notifications").insert({
    user_id,
    type: "coach_message",
    title: "Réponse du coach",
    body: (body || (atts.length ? `📎 ${atts.length} pièce(s) jointe(s)` : "")).slice(0, 200),
    data: { from: "coach", subject: "", body: String(body ?? "").slice(0, 2000), attachments: atts, ts: new Date().toISOString() },
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: ins?.id });
}
