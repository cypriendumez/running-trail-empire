export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TYPE_AVIS, litAvis, refusReponse, REPONSE_MAX } from "@/lib/avis/store";
import { estAdmin } from "@/lib/admin/acces";


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
  if (!user || !estAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const corps = (await req.json().catch(() => ({}))) as { id?: string; publie?: boolean; reponse?: unknown };
  const { id, publie } = corps;
  const veutRepondre = typeof corps.reponse === "string";
  if (!id || (typeof publie !== "boolean" && !veutRepondre)) {
    return NextResponse.json({ ok: false, error: "id, et publie ou reponse, attendus" }, { status: 400 });
  }
  if (veutRepondre) {
    const refus = refusReponse(corps.reponse);
    if (refus) return NextResponse.json({ ok: false, error: refus }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ligne } = await admin
    .from("notifications").select("data").eq("id", id).eq("type", TYPE_AVIS).maybeSingle();
  const avis = litAvis(ligne?.data ?? null);
  if (!avis) return NextResponse.json({ ok: false, error: "Avis introuvable" }, { status: 404 });

  // ⚠️ LE TEXTE DE L'ATHLÈTE N'EST JAMAIS TOUCHÉ. On repart de l'avis relu, on ne
  // modifie que le drapeau et/ou la réponse — deux champs qui appartiennent à l'éditeur.
  // La page publique promet « publiés tels qu'ils sont écrits » : cette promesse tient
  // par la construction de cette ligne, pas par une intention.
  const maj: Record<string, unknown> = { ...avis };
  if (typeof publie === "boolean") maj.publie = publie;
  if (veutRepondre) {
    const t = String(corps.reponse).trim();
    // Une réponse vide SUPPRIME la réponse : c'est la marche arrière, et sans elle on
    // n'ose plus répondre vite.
    if (t) { maj.reponse = t.slice(0, REPONSE_MAX); maj.reponseAt = new Date().toISOString(); }
    else { delete maj.reponse; delete maj.reponseAt; }
  }

  const { error } = await admin.from("notifications").update({ data: maj }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, publie: maj.publie, reponse: maj.reponse ?? null, reponseAt: maj.reponseAt ?? null });
}

/** La liste complète, pour l'écran de modération. */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !estAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data } = await createAdminClient()
    .from("notifications").select("id, data, created_at")
    .eq("type", TYPE_AVIS).order("created_at", { ascending: false });

  const avis = (data ?? []).map((r) => ({ id: String(r.id), ...litAvis(r.data) })).filter((a) => a.note);
  return NextResponse.json({ ok: true, avis });
}
