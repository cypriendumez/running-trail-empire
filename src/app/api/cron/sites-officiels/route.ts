export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { idEditeur } from "@/lib/compta/enregistrer";
import { traiterLot, fenetreFinDeQuota } from "@/lib/races/sitesOfficiels";
import { jourFrance } from "@/lib/races/jourFrance";

/**
 * GET /api/cron/sites-officiels — un petit lot de recherches de sites officiels (03/10/2026).
 *
 * Les fiches reprises de jogging-plus ne peuvent pas être revérifiées à la source (défi
 * anti-robot, qu'on ne contourne pas) : on leur trouve le site de l'organisateur, que la
 * veille relit ensuite. Tourne ICI, sur le serveur, parce que la clé du modèle y est — elle
 * n'est pas copiée dans GitHub. Déclenché par .github/workflows/sites-officiels.yml.
 *
 * ⚠️ LOT PETIT : chaque épreuve coûte une recherche web (quota du projet, partagé avec le
 * kiné et le coach) et quelques lectures de pages ; 300 s de fonction au plus. Et SEULEMENT
 * dans les 35 dernières minutes de la journée de quota (`fenetreFinDeQuota`) : on n'utilise
 * que ce que les athlètes n'ont pas pris.
 */
const LOT_DEFAUT = 15;
const LOT_MAX = 20;

export async function GET(req: Request) {
  const attendu = process.env.CRON_SECRET;
  if (!attendu || req.headers.get("authorization") !== `Bearer ${attendu}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const proprietaire = await idEditeur();
  if (!proprietaire) return NextResponse.json({ error: "Aucun compte d'administration : l'état n'a pas de propriétaire." }, { status: 500 });

  // Hors des dernières minutes de la journée de quota, on ne touche à RIEN : le quota du
  // jour appartient d'abord aux athlètes. `?force=1` pour un lancement manuel assumé.
  const parametres = new URL(req.url).searchParams;
  const fenetre = fenetreFinDeQuota(new Date());
  if (fenetre == null && parametres.get("force") !== "1") {
    return NextResponse.json({ ok: true, ignore: "hors de la fin de journée de quota (minuit, heure du Pacifique)" });
  }
  const demande = Number(parametres.get("lot"));
  const lot = Number.isFinite(demande) && demande > 0 ? Math.min(LOT_MAX, Math.floor(demande)) : LOT_DEFAUT;
  try {
    const b = await traiterLot(createAdminClient(), { proprietaire, aujourdhui: jourFrance(), lot, ecrire: true });
    return NextResponse.json({
      ok: b.erreursEcriture === 0,
      cherchees: b.cherchees, trouvees: b.trouvees, lignesMisesAJour: b.lignesMisesAJour, erreursEcriture: b.erreursEcriture,
      modeleIndisponible: b.indisponible,
      trouvailles: b.details.filter((d) => d.url).map((d) => `${d.nom} (${d.ville ?? "?"}) → ${d.url}`),
    }, { status: b.erreursEcriture ? 500 : 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
