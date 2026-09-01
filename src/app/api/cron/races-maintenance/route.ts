export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * BASCULEMENT QUOTIDIEN DES COURSES PASSÉES.
 *
 * ⚠️ CETTE MAINTENANCE N'AVAIT JAMAIS TOURNÉ. La route `DELETE /api/races/sync` la fait
 * depuis toujours, mais RIEN NE L'APPELAIT : ni cron, ni workflow, ni script. Constaté le
 * 01/09/2026 : 2 583 courses portaient une date passée (du 11 juin au 31 août), dont
 * 2 454 sans aucune édition future. Comme le catalogue ne montre que `date >= aujourd'hui`,
 * ces courses n'étaient pas « périmées » — elles étaient INVISIBLES. 1 125 noms de courses
 * réelles, « 10 Km de Soustons », « Frappadingue Lunéville », introuvables pour qui les
 * cherchait.
 *
 * Les courses françaises sont annuelles : une édition passée n'est pas une course
 * disparue. On bascule donc la date sur le marqueur 2099-01-01, affiché « Date à venir ».
 *
 * ⚠️ CETTE ROUTE NE SUPPRIME RIEN. La route d'administration supprime en plus les
 * éditions périmées déjà remplacées par une édition future ; c'est utile mais destructif,
 * et une suppression planifiée qui se trompe ne se rattrape pas. Le basculement, lui, est
 * réversible : il n'écrit qu'une date. Le nettoyage des doublons reste manuel.
 */
export async function GET(req: Request) {
  const attendu = process.env.CRON_SECRET;
  if (!attendu || req.headers.get("authorization") !== `Bearer ${attendu}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const sb = createAdminClient();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  // ⚠️ PAGINER SANS `order` SAUTE DES LIGNES. Premier passage réel : 2 956 courses à
  //    date passée, 2 291 basculées, 665 OUBLIÉES — dont « 10 Km de Soustons » et
  //    « Ultra Champsaur », les deux exemples que j'avais donnés comme introuvables.
  //    `range()` découpe un résultat dont l'ordre n'est PAS garanti sans `order` : d'une
  //    page à l'autre Postgres peut renvoyer les mêmes lignes ou en omettre. Le tri par
  //    `id` rend le découpage stable.
  //
  //    Et on RECOMMENCE tant qu'il en reste : une écriture concurrente, ou une course
  //    importée pendant le passage, laisserait sinon des oubliées jusqu'au lendemain.
  //    Borné à 5 tours — au-delà, c'est un problème qu'une boucle ne réglera pas.
  const PAGE = 1000;
  const LOT = 200;
  let bascules = 0;
  let tours = 0;

  for (; tours < 5; tours++) {
    const aBasculer: string[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from("races").select("id")
        .lt("date", aujourdhui).order("id").range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: error.message, bascules }, { status: 500 });
      if (!data?.length) break;
      aBasculer.push(...data.map((r) => r.id as string));
      if (data.length < PAGE) break;
    }
    if (!aBasculer.length) break;

    for (let i = 0; i < aBasculer.length; i += LOT) {
      const lot = aBasculer.slice(i, i + LOT);
      const { error } = await sb.from("races")
        .update({ date: "2099-01-01", updated_at: new Date().toISOString() })
        .in("id", lot);
      if (error) return NextResponse.json({ error: error.message, bascules }, { status: 500 });
      bascules += lot.length;
    }
  }

  // On RELIT pour dire la vérité : annoncer « terminé » sans vérifier serait exactement
  // le défaut qu'on vient de corriger.
  const { count: restantes } = await sb.from("races").select("id", { count: "exact", head: true })
    .lt("date", aujourdhui);

  return NextResponse.json({
    ok: true,
    bascules,
    restantes: restantes ?? null,
    tours,
    message: bascules
      ? `${bascules} course(s) passée(s) rebasculée(s) en « Date à venir » — elles redeviennent visibles au catalogue. Restantes : ${restantes ?? "?"}.`
      : "Aucune course passée : le catalogue est à jour.",
  });
}
