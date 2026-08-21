export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TYPE_AVIS, refusDe, avisDe, litAvis } from "@/lib/avis/store";

/**
 * L'AVIS DE L'ATHLÈTE CONNECTÉ.
 *
 * GET  → son avis, s'il en a écrit un (pour préremplir le formulaire).
 * POST → écrit ou remplace le sien.
 *
 * ⚠️ UN COMPTE = UN AVIS. La contrainte n'est pas déclarative, elle vient de la façon
 * dont on écrit : on cherche la ligne existante et on la MET À JOUR. Sans ça, quelqu'un
 * pourrait poster cinquante fois et noyer la page.
 *
 * ⚠️ RIEN de ce que le client envoie n'atteint la base tel quel. La note est bornée, le
 * texte est validé et tronqué, l'auteur est calculé DEPUIS LE PROFIL côté serveur, et
 * `publie` est forcé à faux. Un client qui enverrait `{publie: true, auteur: "Kilian
 * Jornet"}` obtiendrait exactement le même résultat qu'un client honnête.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await createAdminClient()
    .from("notifications").select("data")
    .eq("user_id", user.id).eq("type", TYPE_AVIS).maybeSingle();

  return NextResponse.json({ ok: true, avis: litAvis(data?.data ?? null) });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { note, texte } = (await req.json().catch(() => ({}))) as { note?: unknown; texte?: unknown };
  const refus = refusDe(note, texte);
  if (refus) return NextResponse.json({ ok: false, error: refus }, { status: 400 });

  const admin = createAdminClient();
  // Le nom affiché vient du PROFIL, jamais de la requête.
  const { data: profil } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const avis = avisDe(note as number, texte as string, profil?.full_name as string | null);

  const { data: existant } = await admin
    .from("notifications").select("id")
    .eq("user_id", user.id).eq("type", TYPE_AVIS).maybeSingle();

  const erreur = existant?.id
    ? (await admin.from("notifications").update({ data: avis }).eq("id", existant.id)).error
    : (await admin.from("notifications").insert({
        user_id: user.id, type: TYPE_AVIS, title: "avis", body: "", data: avis,
      })).error;

  if (erreur) return NextResponse.json({ ok: false, error: erreur.message }, { status: 500 });
  return NextResponse.json({ ok: true, avis });
}
