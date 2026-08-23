export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estAdmin } from "@/lib/admin/acces";


// POST /api/admin/read-messages {user_id} — le coach a lu les messages de ce client.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !estAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id } = await req.json() as { user_id?: string };
  if (!user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 });

  await createAdminClient().from("notifications").update({ read: true })
    .eq("user_id", user_id).eq("type", "client_message").eq("read", false);
  return NextResponse.json({ ok: true });
}
