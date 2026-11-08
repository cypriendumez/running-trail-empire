export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { verdictAdmin } from "@/lib/admin/acces";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";


// GET /api/admin/athletes  — list all athletes for admin panel
export async function GET(req: Request) {
  // Session administrateur ET appareil de confiance, comme le panneau (audit du 08/11/2026) :
  // le secret partagé `x-admin-secret` ouvrait ces routes sans le second facteur.
  const acces = await verdictAdmin();
  if (!acces.ok) return NextResponse.json({ error: "Forbidden" }, { status: acces.motif === "indisponible" ? 503 : 403 });

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, age, discipline_score, league, subscription_tier, created_at")
    .order("discipline_score", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ athletes: data });
}
