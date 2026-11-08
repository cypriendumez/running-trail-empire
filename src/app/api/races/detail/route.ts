import { NextRequest, NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { veillerCourse, aRelire } from "@/lib/races/veilleCourse";
import { jourFrance } from "@/lib/races/jourFrance";

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
  // Migrations 034 (parcours, veille) puis 033 (éditions passées) — même repli si une colonne manque.
  const avec034 = await sb.from("races").select(`${CHAMPS}, ${CHAMPS_032}, resultats_editions, parcours_url, veille_at, date`).eq("id", id).single();
  const avec033 = avec034.error?.code === "42703" ? await sb.from("races").select(`${CHAMPS}, ${CHAMPS_032}, resultats_editions`).eq("id", id).single() : avec034;
  const complet = avec033.error?.code === "42703" ? await sb.from("races").select(`${CHAMPS}, ${CHAMPS_032}`).eq("id", id).single() : avec033;
  const { data, error } = complet.error?.code === "42703"
    ? await sb.from("races").select(CHAMPS).eq("id", id).single()
    : complet;
  if (error || !data) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  // ⚠️ LA VEILLE À LA CONSULTATION (01/10/2026) : la page officielle est relue APRÈS la
  // réponse — la fiche s'affiche sans attendre, le lien sera là à la visite suivante. Au
  // plus une lecture par fenêtre (`veille_at`) ; sans la colonne (migration 034), rien.
  const d = data as { veille_at?: string | null; date?: string | null };
  if ("veille_at" in d && aRelire(d.veille_at, d.date, Date.now(), jourFrance())) {
    after(async () => { await veillerCourse(id).catch((e) => console.error("[veille] consultation :", e?.message ?? e)); });
  }
  return NextResponse.json(data);
}
