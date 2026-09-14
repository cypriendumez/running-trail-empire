export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gardeAdmin } from "@/lib/admin/acces";
import { regrouperErreurs, type LigneErreur } from "@/lib/admin/bugs";

/**
 * GET /api/admin/bugs?jours=30&bruit=0 — le journal d'erreurs, regroupé.
 *
 * ⚠️ Le contrôle d'accès est refait ici : le layout `/admin` protège les PAGES, pas les
 * routes d'API. Au bout de celle-ci, il y a les identifiants de comptes et les piles
 * d'exécution de la production.
 */
const PAS = 1000;
const LIGNES_MAX = 5000;
const JOURS = [7, 30, 90] as const;

export async function GET(req: Request) {
  if (!(await gardeAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const u = new URL(req.url);
  const jours = (JOURS as readonly number[]).includes(Number(u.searchParams.get("jours"))) ? Number(u.searchParams.get("jours")) : 30;
  const masquerBruit = u.searchParams.get("bruit") !== "1";
  const depuis = new Date(Date.now() - jours * 864e5).toISOString();

  const admin = createAdminClient();
  const lignes: LigneErreur[] = [];
  // ⚠️ PostgREST plafonne à 1 000 lignes par requête, en silence. On pagine.
  for (let debut = 0; debut < LIGNES_MAX; debut += PAS) {
    const { data, error } = await admin.from("error_logs")
      .select("id, created_at, user_id, source, message, stack, url, user_agent, meta")
      .gte("created_at", depuis)
      .order("created_at", { ascending: false })
      .range(debut, debut + PAS - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const lot = (data ?? []) as LigneErreur[];
    lignes.push(...lot);
    if (lot.length < PAS) break;
  }

  return NextResponse.json({
    jours,
    lues: lignes.length,
    tronque: lignes.length >= LIGNES_MAX,
    groupes: regrouperErreurs(lignes, { masquerBruit }),
  });
}
