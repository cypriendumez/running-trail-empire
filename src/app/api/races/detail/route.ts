import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Champs LOURDS d'une seule course, chargés à la demande quand l'utilisateur ouvre le
// panneau de détail / la popup carte. Ils sont volontairement EXCLUS de la liste en masse
// (cf. RACE_COLS dans /dashboard/races/page.tsx) pour alléger le payload initial.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("races")
    .select("id, description, organization, registration_url, terrain, time_limits")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  return NextResponse.json(data);
}
