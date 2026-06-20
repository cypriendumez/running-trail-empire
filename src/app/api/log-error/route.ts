export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const cut = (s: unknown, n: number) => (typeof s === "string" && s ? s.slice(0, n) : null);

// POST /api/log-error — journalise une erreur (client ou serveur) dans la table `error_logs`.
// Best-effort : ne renvoie jamais d'échec bloquant et ne fait jamais planter l'appelant.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    const admin = createAdminClient();
    await admin.from("error_logs").insert({
      user_id: user?.id ?? null,
      source: cut(body.source, 24) ?? "client",
      message: cut(body.message, 2000) ?? "(no message)",
      stack: cut(body.stack, 6000),
      url: cut(body.url, 1000),
      user_agent: cut(req.headers.get("user-agent"), 500),
      meta: body.meta && typeof body.meta === "object" ? body.meta : null,
    });
  } catch { /* le logger d'erreurs ne doit JAMAIS lever d'erreur lui-même */ }
  return NextResponse.json({ ok: true });
}
