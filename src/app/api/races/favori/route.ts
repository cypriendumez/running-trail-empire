export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { idCourseValide } from "@/lib/races/favoris";

export const TYPE_FAVORI = "race_favori";

/**
 * COURSES MISES EN FAVORI.
 *
 * ⚠️ AUCUNE MIGRATION. Une table dédiée serait plus propre, mais le schéma n'est pas
 * modifiable automatiquement ici : on range donc les favoris dans `notifications`, le
 * fourre-tout typé de l'app, comme l'objectif de course ou les réglages de compta.
 *
 * UNE LIGNE PAR (athlète, course), et l'unicité est vérifiée AVANT l'insertion : sans
 * ça, un double-clic — ou un clic sur un réseau lent, où rien n'a encore bougé à
 * l'écran — créerait deux favoris pour la même course, et le compteur mentirait.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { raceId?: string; on?: boolean };
  const raceId = String(body.raceId ?? "").trim();
  if (!idCourseValide(raceId)) {
    return NextResponse.json({ error: "Course invalide" }, { status: 400 });
  }
  const on = body.on !== false;

  const admin = createAdminClient();
  const { data: deja } = await admin.from("notifications").select("id")
    .eq("user_id", user.id).eq("type", TYPE_FAVORI).eq("data->>raceId", raceId).limit(1).maybeSingle();

  if (!on) {
    // Retrait : on supprime TOUTES les copies, pas seulement la première. Une base qui
    // aurait accumulé des doublons avant ce garde-fou laisserait sinon un favori
    // fantôme, impossible à enlever depuis l'interface.
    if (deja?.id) {
      // L'ajout vérifiait son erreur et répondait 500 ; le retrait rendait « favori:
      // false » quoi qu'il arrive. La course restait en favori et réapparaissait au
      // rechargement, sans que l'athlète puisse comprendre pourquoi.
      const { error } = await admin.from("notifications").delete()
        .eq("user_id", user.id).eq("type", TYPE_FAVORI).eq("data->>raceId", raceId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, favori: false });
  }

  if (deja?.id) return NextResponse.json({ ok: true, favori: true, deja: true });

  const { error } = await admin.from("notifications").insert({
    user_id: user.id, type: TYPE_FAVORI, read: true,
    title: "Course en favori", body: raceId,
    data: { raceId, at: new Date().toISOString() },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, favori: true });
}
