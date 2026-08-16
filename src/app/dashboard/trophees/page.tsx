export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PerfTabs } from "@/components/segments/PerfTabs";
import { computeTrophies } from "@/lib/trophies/compute";
import { TrophyWall } from "@/components/trophies/TrophyWall";
import { getAccountLang } from "@/lib/i18n/serverLang";
import { T, fill } from "@/lib/i18n/translations";

export const metadata = { title: "Vitrine | Pacevo" };

/**
 * Les trophées sont calculés À LA LECTURE, sur les séances réelles — aucune table,
 * donc aucune migration, et surtout aucun trophée qui survivrait à la correction ou
 * à la suppression de la séance qui l'avait mérité.
 *
 * Vérifié sur les données réelles (314 séances) : 16:07 au 5 km, 33:58 sur 10,1 km,
 * 26 km de plus longue sortie, 2 321 km cumulés, 39 semaines d'affilée. Ni marathon
 * ni semi ne sont décernés, faute d'une sortie à ces distances — c'est voulu.
 */
export default async function TropheesPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const d = T[await getAccountLang(sb, user.id)];

  const { data: workouts } = await sb.from("workouts")
    .select("date, title, type, sport, distance_km, duration_seconds, elevation_gain_m")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(2000);

  const trophies = computeTrophies((workouts ?? []) as never);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <PerfTabs />
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">{d["nav.trophies"]}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {trophies.length > 0
            ? fill(d["tro.sub"], { n: trophies.length })
            : d["tro.empty"]}
        </p>
      </header>
      <TrophyWall trophies={trophies} />
    </div>
  );
}
