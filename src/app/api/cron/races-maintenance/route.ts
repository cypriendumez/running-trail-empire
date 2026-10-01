export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { editionSuivanteEstimee } from "@/lib/races/prochaineEdition";

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
 * ⚠️ SAUF QUAND L'ÉDITION SUIVANTE SE DEVINE (30/09/2026). Les Foulées Lambersartoises,
 * courues le dimanche 27/09, sont passées en « Date à venir » le lendemain — Cyprien :
 * « pourquoi il met Date à venir alors que l'édition était le week-end dernier ? ». Une
 * course de WEEK-END revient au même rang du même mois (« 4e dimanche de septembre ») :
 * elle reçoit cette date, marquée ESTIMÉE (`date_confirmee = false`, affichée « ≈ »),
 * que le relevé hebdomadaire du site officiel confirme ou corrige
 * (`scripts/veille-courses.ts`, la veille quotidienne et hebdomadaire). En semaine, l'estimation se trompait toujours : 2099.
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
  const A_VENIR = "2099-01-01";
  let bascules = 0, estimees = 0;
  let tours = 0;
  let colonneConfirmee = true;

  for (; tours < 5; tours++) {
    // Date cible → courses : l'édition suivante estimée, ou le marqueur « à venir ».
    const parCible = new Map<string, string[]>();
    let lues = 0;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from("races").select("id, date")
        .lt("date", aujourdhui).order("id").range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: error.message, bascules }, { status: 500 });
      if (!data?.length) break;
      for (const r of data) {
        const cible = (colonneConfirmee && editionSuivanteEstimee(r.date, aujourdhui)) || A_VENIR;
        parCible.set(cible, [...(parCible.get(cible) ?? []), r.id as string]);
      }
      lues += data.length;
      if (data.length < PAGE) break;
    }
    if (!lues) break;

    for (const [cible, ids] of parCible) for (let i = 0; i < ids.length; i += LOT) {
      const lot = ids.slice(i, i + LOT);
      const patch = cible === A_VENIR
        ? { date: A_VENIR, updated_at: new Date().toISOString() }
        : { date: cible, date_confirmee: false, updated_at: new Date().toISOString() };
      const { error } = await sb.from("races").update(patch).in("id", lot);
      // Colonne `date_confirmee` absente (migration 032 non passée) : on ne peut pas dire
      // « estimée » — le marqueur reprend la main, au tour suivant.
      if (error?.code === "42703") { colonneConfirmee = false; continue; }
      if (error) return NextResponse.json({ error: error.message, bascules }, { status: 500 });
      bascules += lot.length;
      if (cible !== A_VENIR) estimees += lot.length;
    }
  }

  // On RELIT pour dire la vérité : annoncer « terminé » sans vérifier serait exactement
  // le défaut qu'on vient de corriger.
  const { count: restantes } = await sb.from("races").select("id", { count: "exact", head: true })
    .lt("date", aujourdhui);

  // ── MÉNAGE DE LA MESURE D'AUDIENCE ─────────────────────────────────────────
  // Les visites de plus de 13 mois sont retirées : assez pour comparer un mois à celui
  // de l'année précédente, en deçà des 25 mois que la CNIL tolère pour la mesure
  // d'audience. Ce cron est le seul passage quotidien d'entretien ; l'échec est DIT,
  // jamais tu — mais il ne fait pas rougir le cron des courses, qui a fait son travail.
  const limiteVisites = new Date(Date.now() - 13 * 30.5 * 864e5).toISOString().slice(0, 10);
  const { error: eVisites, count: visitesPurgees } = await sb.from("visites")
    .delete({ count: "exact" }).lt("jour", limiteVisites);
  if (eVisites) console.error("[maintenance] purge des visites impossible :", eVisites.message);

  return NextResponse.json({
    ok: true,
    bascules,
    estimees,
    restantes: restantes ?? null,
    tours,
    visitesPurgees: eVisites ? null : (visitesPurgees ?? 0),
    purgeVisites: eVisites ? eVisites.message : "ok",
    message: bascules
      ? `${bascules} course(s) passée(s) rebasculée(s) — ${estimees} sur l'édition suivante estimée (≈), les autres en « Date à venir ». Restantes : ${restantes ?? "?"}.`
      : "Aucune course passée : le catalogue est à jour.",
  });
}
