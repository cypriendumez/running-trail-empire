export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TYPE_AVIS, litAvis } from "@/lib/avis/store";

const ADMIN_EMAIL = "cypriendumez@outlook.fr";

/**
 * MODÉRATION — publier ou retirer un avis.
 *
 * ⚠️ ELLE NE SERT QU'À ÉCARTER L'INSULTE ET LE SPAM. Trier par note est exactement ce
 * que la directive (UE) 2019/2161 interdit, au même titre qu'inventer des avis : la page
 * publique promet de ne pas cacher les avis négatifs, et cette route ne doit jamais
 * servir à le faire. Elle ne modifie d'ailleurs PAS le texte — seulement le drapeau
 * `publie` — pour que « publiés tels qu'ils sont écrits » reste littéralement vrai.
 *
 * ⚠️ Le contrôle d'accès est REFAIT ici. Le layout `/admin` protège les PAGES ; une route
 * d'API n'en dépend pas et serait appelable directement.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, publie } = (await req.json().catch(() => ({}))) as { id?: string; publie?: boolean };
  if (!id || typeof publie !== "boolean") {
    return NextResponse.json({ ok: false, error: "id et publie attendus" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ligne } = await admin
    .from("notifications").select("data").eq("id", id).eq("type", TYPE_AVIS).maybeSingle();
  const avis = litAvis(ligne?.data ?? null);
  if (!avis) return NextResponse.json({ ok: false, error: "Avis introuvable" }, { status: 404 });

  // On ne réécrit QUE le drapeau : le texte de l'athlète est reporté à l'identique.
  const { error } = await admin.from("notifications").update({ data: { ...avis, publie } }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, publie });
}

/** La liste complète, pour l'écran de modération. */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data } = await createAdminClient()
    .from("notifications").select("id, data, created_at")
    .eq("type", TYPE_AVIS).order("created_at", { ascending: false });

  const avis = (data ?? []).map((r) => ({ id: String(r.id), ...litAvis(r.data) })).filter((a) => a.note);
  return NextResponse.json({ ok: true, avis });
}
