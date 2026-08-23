export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estAdmin } from "@/lib/admin/acces";

/**
 * LA CONVERSATION D'UN SEUL ATHLÈTE.
 *
 * ⚠️ Elle existait déjà, mais seulement à `/admin/messages` — une page à part. Pour
 * répondre à quelqu'un, il fallait quitter sa fiche, donc perdre de vue son ressenti,
 * sa charge et ses séances : exactement ce dont on parle quand on lui écrit. Cette route
 * permet d'afficher le fil DANS la fiche.
 *
 * ⚠️ Le contrôle d'accès est refait ici. Le layout `/admin` protège les PAGES ; une route
 * d'API n'en dépend pas et serait appelable directement — avec, au bout, les messages
 * privés d'un athlète.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!estAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) return NextResponse.json({ ok: false, error: "user_id attendu" }, { status: 400 });

  const { data } = await createAdminClient()
    .from("notifications").select("type, data, created_at")
    .eq("user_id", userId).in("type", ["client_message", "coach_message"])
    .order("created_at", { ascending: true }).limit(200);

  const messages = (data ?? []).map((m) => {
    const d = (m.data ?? {}) as { subject?: string; body?: string; ts?: string };
    return {
      de: m.type === "coach_message" ? "coach" : "client",
      objet: String(d.subject ?? ""),
      texte: String(d.body ?? ""),
      at: String(d.ts || m.created_at || ""),
    };
  // Un message vidé de son texte ne s'affiche pas : une bulle vide dans un fil ressemble
  // à un défaut d'affichage, et fait douter du reste.
  }).filter((m) => m.texte.trim() || m.objet.trim());

  return NextResponse.json({ ok: true, messages });
}
