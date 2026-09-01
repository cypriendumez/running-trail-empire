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

  // On ne lit QUE ce qui sert : id des courses à date passée, hors marqueur.
  const aBasculer: string[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from("races").select("id")
      .lt("date", aujourdhui).range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;
    aBasculer.push(...data.map((r) => r.id as string));
    if (data.length < PAGE) break;
  }

  let bascules = 0;
  const LOT = 200;
  for (let i = 0; i < aBasculer.length; i += LOT) {
    const { error } = await sb.from("races")
      .update({ date: "2099-01-01", updated_at: new Date().toISOString() })
      .in("id", aBasculer.slice(i, i + LOT));
    if (error) return NextResponse.json({ error: error.message, bascules }, { status: 500 });
    bascules += aBasculer.slice(i, i + LOT).length;
  }

  return NextResponse.json({
    ok: true,
    bascules,
    message: bascules
      ? `${bascules} course(s) passée(s) rebasculée(s) en « Date à venir » — elles redeviennent visibles au catalogue.`
      : "Aucune course passée : le catalogue est à jour.",
  });
}
