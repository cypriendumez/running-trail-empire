export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/settings — enregistre les préférences (couleur d'avatar, unités, début de semaine…)
// dans une ligne notifications type "user_settings" (jsonb), une par utilisateur.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.avatarColor === "string") patch.avatarColor = body.avatarColor.slice(0, 20);
  if (body.unitSystem === "metric" || body.unitSystem === "imperial") patch.unitSystem = body.unitSystem;
  if (body.weekStart === "mon" || body.weekStart === "sun") patch.weekStart = body.weekStart;
  // Préférences booléennes (notifications + confidentialité). Stockées centralement,
  // lues par les générateurs de notifications / les pages Ligues & Communauté.
  for (const k of ["weeklyDigest", "recoveryAlerts", "coachTips", "sessionReminders", "leaguePublic", "communityVisible"]) {
    if (typeof body[k] === "boolean") patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Rien à enregistrer" }, { status: 400 });

  const admin = createAdminClient();

  /**
   * ⚠️ LA LECTURE D'ABORD, ET SON ÉCHEC EST FATAL.
   *
   * Son erreur n'était pas lue. Une lecture en échec rend `existing` indéfini, ce que
   * la suite interprétait comme « cet athlète n'a encore aucun réglage » : on partait
   * d'un objet VIDE et on insérait une seconde ligne. Autrement dit, une coupure d'une
   * seconde effaçait tous les réglages déjà enregistrés et n'en gardait que celui qu'on
   * venait d'envoyer — en répondant `ok: true`. On refuse plutôt que d'écraser.
   */
  const { data: existing, error: eLecture } = await admin.from("notifications")
    .select("id, data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle();
  if (eLecture) {
    console.error("[réglages] lecture impossible, écriture refusée :", eLecture.message);
    return NextResponse.json({ error: "Réglages illisibles pour le moment" }, { status: 500 });
  }

  const merged = { ...((existing?.data as object) ?? {}), ...patch };
  // ⚠️ ET L'ÉCRITURE ENSUITE. Elle non plus n'était pas contrôlée : la route renvoyait
  // `ok: true` avec les réglages fusionnés, l'écran les affichait, et ils revenaient à
  // leur ancienne valeur au premier rechargement.
  const { error: eEcriture } = existing?.id
    ? await admin.from("notifications").update({ data: merged }).eq("id", existing.id)
    : await admin.from("notifications").insert({ user_id: user.id, type: "user_settings", title: "Préférences", body: "", read: true, data: merged });
  if (eEcriture) {
    console.error("[réglages] écriture refusée :", eEcriture.message);
    return NextResponse.json({ error: "Réglages non enregistrés" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, settings: merged });
}
