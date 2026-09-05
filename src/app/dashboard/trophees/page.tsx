export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PerfTabs } from "@/components/segments/PerfTabs";
import { computeTrophies } from "@/lib/trophies/compute";
import { TrophyWall, type TexteVitrine } from "@/components/trophies/TrophyWall";
import { getAccountLang } from "@/lib/i18n/serverLang";
import { T, fill } from "@/lib/i18n/translations";
import { fmtNombre } from "@/lib/i18n/nombres";

export const metadata = { title: "Vitrine" };

/**
 * Les trophées sont calculés À LA LECTURE, sur les séances réelles — aucune table,
 * donc aucune migration, et surtout aucun trophée qui survivrait à la correction ou
 * à la suppression de la séance qui l'avait mérité.
 *
 * Le bandeau de bilan suit la même règle : il ADDITIONNE les séances lues juste
 * au-dessus. Aucun total n'est stocké, donc aucun ne peut se désynchroniser de
 * l'historique — et une valeur manquante n'est jamais comptée comme un zéro.
 */
export default async function TropheesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const lang = await getAccountLang(sb, user.id);
  const d = T[lang];

  const { data: workouts } = await sb.from("workouts")
    .select("date, title, type, sport, distance_km, duration_seconds, elevation_gain_m")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(2000);

  const seances = (workouts ?? []) as { distance_km: number | null; duration_seconds: number | null; elevation_gain_m: number | null }[];
  const trophies = computeTrophies(seances as never);

  const somme = (lire: (s: (typeof seances)[number]) => number | null | undefined) =>
    seances.reduce((t, s) => { const v = lire(s); return t + (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0); }, 0);
  const bilan = [
    { label: d["vit.total"], valeur: `${fmtNombre(somme((s) => s.distance_km), lang, 0)} km` },
    { label: d["vit.sorties"], valeur: fmtNombre(seances.length, lang, 0) },
    { label: d["vit.deniv"], valeur: `${fmtNombre(somme((s) => s.elevation_gain_m), lang, 0)} m` },
    { label: d["vit.heures"], valeur: `${fmtNombre(Math.round(somme((s) => s.duration_seconds) / 3600), lang, 0)} h` },
  ];

  const textes: TexteVitrine = {
    vide: d["tro.empty"],
    videSub: d["feed.emptySub"],
    sections: [
      { kinds: ["course"], titre: d["vit.secCourses"], sous: d["vit.secCoursesSub"] },
      { kinds: ["chrono"], titre: d["vit.secChronos"], sous: d["vit.secChronosSub"] },
      { kinds: ["record"], titre: d["vit.secRecords"], sous: d["vit.secRecordsSub"] },
      { kinds: ["palier", "serie", "volume"], titre: d["vit.secRegul"], sous: d["vit.secRegulSub"] },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <PerfTabs />
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">{d["nav.trophies"]}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {trophies.length > 0 ? fill(d["tro.sub"], { n: trophies.length }) : d["tro.empty"]}
        </p>
      </header>

      {/* BILAN — quatre chiffres, une seule ligne. La page n'était qu'une suite de
          grandes cartes blanches : il manquait un point d'entrée qui résume. */}
      {seances.length > 0 && (
        <dl className="mb-8 grid grid-cols-2 divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:grid-cols-4 sm:divide-x">
          {bilan.map((b) => (
            <div key={b.label} className="px-4 py-3.5">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{b.label}</dt>
              <dd className="mt-0.5 text-xl font-black tracking-tight text-zinc-900">{b.valeur}</dd>
            </div>
          ))}
        </dl>
      )}

      <TrophyWall trophies={trophies} textes={textes} />
    </div>
  );
}
