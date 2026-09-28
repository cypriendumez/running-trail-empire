export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validerRecordDeclare, type CleDistance } from "@/lib/dashboard/records";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

/**
 * RECORDS DÉCLARÉS — un record couru AVANT l'historique de la montre (voir
 * `lib/dashboard/records`, `RecordDeclare`). Une ligne `notifications` par distance
 * (`record_declare`), comme les autres réglages de l'athlète : aucune migration.
 *
 * ⚠️ SUPABASE RETOURNE SES ERREURS, IL NE LES LÈVE PAS : chaque `error` est lu, sinon
 * l'écran annoncerait un record enregistré qui ne l'est pas.
 * ⚠️ TOUTES LES LECTURES ET ÉCRITURES SONT FILTRÉES PAR `user_id`, même sous RLS.
 */
const TYPE = "record_declare";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "non_connecte" }, { status: 401 });

  const rec = validerRecordDeclare(await req.json().catch(() => null), aujourdhui(FUSEAU_DEFAUT));
  if (!rec) return NextResponse.json({ ok: false, error: "invalide" }, { status: 400 });

  const { data: existant, error: eLecture } = await supabase.from("notifications").select("id")
    .eq("user_id", user.id).eq("type", TYPE).eq("data->>distance", rec.distance).limit(1).maybeSingle();
  if (eLecture) {
    console.error("[records] lecture :", eLecture.message);
    return NextResponse.json({ ok: false, error: "lecture" }, { status: 500 });
  }
  const { error } = existant
    ? await supabase.from("notifications").update({ data: rec }).eq("id", (existant as { id: string }).id).eq("user_id", user.id)
    : await supabase.from("notifications").insert({ user_id: user.id, type: TYPE, title: "Record déclaré", body: "", read: true, data: rec });
  if (error) {
    console.error("[records] écriture :", error.message);
    return NextResponse.json({ ok: false, error: "ecriture" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, record: rec });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "non_connecte" }, { status: 401 });
  const distance = new URL(req.url).searchParams.get("distance") as CleDistance | null;
  if (!distance || !["5k", "10k", "semi", "marathon"].includes(distance)) {
    return NextResponse.json({ ok: false, error: "invalide" }, { status: 400 });
  }
  // Retirer un record DÉCLARÉ, c'est retirer ce que l'athlète a lui-même saisi — rien de
  // mesuré n'est touché.
  const { error } = await supabase.from("notifications").delete()
    .eq("user_id", user.id).eq("type", TYPE).eq("data->>distance", distance);
  if (error) {
    console.error("[records] suppression :", error.message);
    return NextResponse.json({ ok: false, error: "ecriture" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
