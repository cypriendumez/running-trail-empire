export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * LA MÉMOIRE DE LA CONSULTATION KINÉ — une ligne `kine_chat` par athlète.
 *
 * Jusqu'au 22/09/2026 la conversation vivait dans l'état du composant : un rechargement,
 * un changement d'onglet, et le kiné « oubliait » tout — seules les douleurs déclarées
 * (pain_report) survivaient. Le fil est désormais écrit par /api/ai/physio (texte seul,
 * jamais les photos, 40 derniers messages) et relu par la page Santé.
 *
 *  DELETE → « Nouvelle consultation » : on efface le fil. Les douleurs déclarées, elles,
 *  restent : c'est le suivi clinique, pas une conversation.
 */
export async function DELETE() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { error } = await sb.from("notifications").delete().eq("user_id", user.id).eq("type", "kine_chat");
  if (error) return NextResponse.json({ error: "Effacement impossible" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
