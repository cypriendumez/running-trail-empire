export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { champsConsentement } from "@/lib/auth/consentement";

/**
 * ENREGISTRE L'ACCORD AUX DONNÉES DE SANTÉ du compte connecté (écran `/consentement`).
 *
 * Seulement pour SOI : le compte est celui de la session, jamais un identifiant reçu. Et
 * seulement sur un geste explicite (`accord: true`, la case cochée). L'écriture passe par
 * l'API d'administration : `app_metadata` n'est pas modifiable par la personne elle-même,
 * ce qui en fait une trace qu'on peut produire. Voir `lib/auth/consentement`.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "non_connecte" }, { status: 401 });

  const { accord } = (await req.json().catch(() => ({}))) as { accord?: unknown };
  if (accord !== true) return NextResponse.json({ ok: false, error: "accord_requis" }, { status: 400 });

  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { app_metadata: champsConsentement("ecran") });
  if (error) return NextResponse.json({ ok: false, error: "enregistrement_impossible" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
