export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/account/delete — supprime le compte de l'utilisateur connecté (irréversible).
export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createAdminClient();
  // Données applicatives liées (best-effort) puis le compte d'authentification.
  try {
    await admin.from("notifications").delete().eq("user_id", user.id);
    await admin.from("profiles").delete().eq("id", user.id);
  } catch { /* best-effort : on supprime quand même le compte auth */ }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
