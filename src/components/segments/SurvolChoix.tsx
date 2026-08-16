"use client";
// Sélecteur de sortie + survol. Le changement passe par l'URL (`?w=`) : la trace est
// lourde, on ne la charge donc que pour la sortie demandée, côté serveur, plutôt que
// d'envoyer les 312 traces au navigateur pour n'en afficher qu'une.
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/LanguageProvider";
import { FlyoverLazy } from "./FlyoverLazy";
import type { FlyoverStats } from "./Flyover";

type Sortie = { id: string; label: string; date: string; km: number | null };

export function SurvolChoix({ sorties, choisie, polyline, altitudes, paces, stats }: {
  sorties: Sortie[]; choisie: string; polyline: string;
  altitudes: number[] | null; paces?: (number | null)[] | null; stats: FlyoverStats;
}) {
  const { t, lang } = useT();
  const router = useRouter();

  return (
    <div className="space-y-4">
      {polyline ? (
        <FlyoverLazy polyline={polyline} altitudes={altitudes} paces={paces} stats={stats} />
      ) : (
        // Trace trop courte pour un survol : on le dit, plutôt que d'afficher une
        // carte figée que l'athlète prendrait pour un bug.
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <p className="font-semibold text-zinc-900">{t("fly.short.title")}</p>
          <p className="mt-1 text-sm text-zinc-500">{t("fly.short.sub")}</p>
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t("fly.pick")}</div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sorties.map((s) => {
            const active = s.id === choisie;
            return (
              <button key={s.id} onClick={() => router.push(`/dashboard/survol?w=${s.id}`)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition ${
                  active ? "border-emerald-500 bg-emerald-50" : "border-zinc-200 bg-white hover:border-zinc-300"}`}>
                <div className="font-semibold text-zinc-800">{s.label}</div>
                <div className="text-zinc-500">
                  {new Date(s.date).toLocaleDateString(lang, { day: "numeric", month: "short", year: "2-digit" })}
                  {s.km ? ` · ${s.km.toFixed(1).replace(".", ",")} km` : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
