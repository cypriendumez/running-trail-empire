export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KINE_IA_RETIRE } from "@/lib/health/kineIa";

/**
 * POST /api/ai/physio — RETIRÉ LE 09/11/2026 (lib/health/kineIa).
 *
 * La consultation du « kiné IA » (une IA présentée comme kinésithérapeute, diagnostic,
 * analyse de photos, protocole de rééducation) est interdite par les conditions de Gemini,
 * par le Code de la santé publique et par le règlement sur les dispositifs médicaux. Son
 * code est SUPPRIMÉ, pas seulement éteint : le dépôt est public. 410 : la fonction n'existe
 * plus, ce n'est pas une panne. Déclarer une douleur se fait par /api/health/declarer.
 */
export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ error: KINE_IA_RETIRE }, { status: 410 });
}
