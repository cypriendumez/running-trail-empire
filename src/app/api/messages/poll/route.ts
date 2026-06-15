export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAIL = "cypriendumez@outlook.fr";

// GET /api/messages/poll → nombre de messages non lus pertinents pour l'utilisateur (coach ou client).
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ count: 0, role: "none" });

  if (user.email === ADMIN_EMAIL) {
    const { count } = await createAdminClient().from("notifications")
      .select("id", { count: "exact", head: true }).eq("type", "client_message").eq("read", false);
    return NextResponse.json({ count: count ?? 0, role: "coach" });
  }
  const { count } = await sb.from("notifications")
    .select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("type", "coach_message").eq("read", false);
  return NextResponse.json({ count: count ?? 0, role: "client" });
}
