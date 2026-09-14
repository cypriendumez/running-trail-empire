export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verdictAdmin } from "@/lib/admin/acces";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { agregerVisites, type LigneVisite } from "@/lib/visites/agreger";

/**
 * GET /api/admin/visites?jours=30 — l'audience du site et de l'application, agrégée.
 *
 * ⚠️ Le contrôle d'accès est refait ici : le layout `/admin` protège les PAGES, pas les
 * routes d'API.
 *
 * ⚠️ PostgREST plafonne à 1 000 lignes par requête, en silence — on pagine, avec une borne
 * haute. Le jour où la borne est atteinte, la réponse le DIT (`tronque`) au lieu d'afficher
 * un chiffre plausible et faux ; il sera alors temps d'agréger en base.
 */
const PAS = 1000;
const LIGNES_MAX = 60_000;
const JOURS = [7, 30, 90] as const;

export async function GET(req: Request) {
  const acces = await verdictAdmin();
  if (!acces.ok) {
    // « Je n'ai pas pu vérifier » n'est pas « non » : 503 et un message qui dit d'attendre.
    return acces.motif === "indisponible"
      ? NextResponse.json({ error: "Session invérifiable : le service d'authentification n'a pas répondu. Réessaie dans un instant." }, { status: 503 })
      : NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const u = new URL(req.url);
  const jours = (JOURS as readonly number[]).includes(Number(u.searchParams.get("jours"))) ? Number(u.searchParams.get("jours")) : 30;
  const au = aujourdhui(FUSEAU_DEFAUT);
  const du = new Date(new Date(`${au}T12:00:00Z`).getTime() - (jours - 1) * 864e5).toISOString().slice(0, 10);

  const admin = createAdminClient();
  const lignes: LigneVisite[] = [];
  for (let debut = 0; debut < LIGNES_MAX; debut += PAS) {
    const { data, error } = await admin.from("visites")
      .select("jour, chemin, espace, visiteur, compte, connecte, appareil, langue, pays, referent")
      .gte("jour", du)
      .order("id", { ascending: true })
      .range(debut, debut + PAS - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const lot = (data ?? []) as LigneVisite[];
    lignes.push(...lot);
    if (lot.length < PAS) break;
  }

  return NextResponse.json({
    ...agregerVisites(lignes, { du, au }),
    lues: lignes.length,
    tronque: lignes.length >= LIGNES_MAX,
  });
}
