import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Champs LOURDS d'une seule course, chargés à la demande quand l'utilisateur ouvre le
// panneau de détail / la popup carte. Ils sont volontairement EXCLUS de la liste en masse
// (cf. RACE_COLS dans /dashboard/races/page.tsx) pour alléger le payload initial.
const CHAMPS = "id, description, organization, registration_url, terrain, time_limits";
// Migration 032 : inscription directe, site officiel, classement, heure, statut de la date.
// ⚠️ LUS SEULEMENT S'ILS EXISTENT. Avant la migration, les demander ferait échouer toute la
// requête (PostgREST refuse une colonne inconnue, code 42703) — et le panneau d'une course
// perdrait même son bouton d'inscription. On retombe alors sur les champs d'avant.
const CHAMPS_032 = "site_officiel, inscription_url, resultats_url, resultats_annee, heure_depart, date_confirmee";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });
  const sb = createAdminClient();
  // Migration 033 : classements des éditions passées — même repli si la colonne manque.
  const avec033 = await sb.from("races").select(`${CHAMPS}, ${CHAMPS_032}, resultats_editions`).eq("id", id).single();
  const complet = avec033.error?.code === "42703" ? await sb.from("races").select(`${CHAMPS}, ${CHAMPS_032}`).eq("id", id).single() : avec033;
  const { data, error } = complet.error?.code === "42703"
    ? await sb.from("races").select(CHAMPS).eq("id", id).single()
    : complet;
  if (error || !data) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  return NextResponse.json(data);
}
