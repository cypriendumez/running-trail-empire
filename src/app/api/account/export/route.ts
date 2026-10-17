export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripProfileSecrets } from "@/lib/profile/safe";

/**
 * EXPORT RGPD — toutes les données de l'athlète (profil, séances, baselines, objectifs), en JSON.
 *
 * ⚠️ CÔTÉ SERVEUR, PAS DANS LE NAVIGATEUR (constat d'audit M1, 16/10/2026). Avant, l'export
 * faisait un `select("*")` sur `profiles` DEPUIS LE NAVIGATEUR : la réponse réseau contenait
 * donc `intervals_api_key` (clé API / jeton OAuth intervals.icu), même si le fichier final
 * l'enlevait — une injection de script (XSS) pouvait la lire au passage. Ici, le secret est
 * retiré par `stripProfileSecrets` AVANT que la réponse ne parte : il ne quitte jamais le serveur.
 *
 * Chaque table n'est lue QUE pour le compte connecté (`user.id`) ; aucun identifiant reçu n'est cru.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "non_connecte" }, { status: 401 });

  const admin = createAdminClient();
  const [prof, wk, base, gl] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user.id).single(),
    admin.from("workouts").select("*").eq("user_id", user.id),
    admin.from("performance_baselines").select("*").eq("user_id", user.id),
    admin.from("user_goals").select("*").eq("user_id", user.id),
  ]);

  return NextResponse.json(
    {
      exported_at: new Date().toISOString(),
      profile: stripProfileSecrets(prof.data ?? null),
      workouts: wk.data ?? [],
      baselines: base.data ?? [],
      goals: gl.data ?? [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
