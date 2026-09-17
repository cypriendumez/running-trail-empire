"use client";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Gauge, Footprints, Bike, TrendingUp, Info } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PROGRAMMES, genererPlan, volumeTotal, type CleProgramme, type Niveau } from "@/lib/plans/catalogue";
import { PLANS_I18N } from "./plansI18n";

/** Teinte par phase — la lecture doit se faire d'un coup d'œil, sans lire les mots. */
const TEINTE: Record<string, string> = {
  "Reprise": "bg-sky-50 text-sky-700 ring-sky-200",
  "Base": "bg-zinc-100 text-zinc-600 ring-zinc-200",
  "Développement": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Spécifique": "bg-amber-50 text-amber-700 ring-amber-200",
  "Affûtage": "bg-violet-50 text-violet-700 ring-violet-200",
};

const ORDRE: CleProgramme[] = ["km5", "km10", "semi", "marathon", "trail", "debutant", "vitesse", "blessure", "poids"];

export function PlansView({ niveau, volumeKm }: { niveau: Niveau; volumeKm: number }) {
  const { lang } = useT();
  const t = PLANS_I18N[lang] ?? PLANS_I18N.fr;
  const [choisi, setChoisi] = useState<CleProgramme | null>(null);
  const [semaines, setSemaines] = useState<number | null>(null);

  if (!choisi) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{t.titre}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">{t.sousTitre}</p>
        </header>

        {/* Les deux chiffres qui personnalisent TOUS les plans : on les montre d'emblée,
            pour que l'athlète sache sur quoi ils sont bâtis. */}
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm ring-1 ring-inset ring-zinc-200">
            <Gauge className="h-4 w-4 text-emerald-600" />
            <span className="text-zinc-500">{t.niveau}</span>
            <span className="font-semibold text-zinc-900">{t.niveaux[niveau]}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm ring-1 ring-inset ring-zinc-200">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="text-zinc-500">{t.volumeActuel}</span>
            <span className="font-semibold text-zinc-900">{volumeKm} {t.parSemaine}</span>
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ORDRE.map((cle) => {
            const prog = PROGRAMMES[cle];
            return (
              <button
                key={cle}
                onClick={() => { setChoisi(cle); setSemaines(prog.semaines[0]); }}
                className="group flex flex-col items-start rounded-3xl bg-white p-6 text-left shadow-sm ring-1 ring-inset ring-zinc-200 transition-all hover:shadow-md hover:ring-emerald-300"
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <h2 className="text-base font-bold text-zinc-900">{t.noms[cle]}</h2>
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{t.pitchs[cle]}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Chip>{prog.semaines[0]} {t.semaines}</Chip>
                  {prog.marcheCourse && <Chip icone={<Footprints className="h-3 w-3" />}>{t.marcheCourse}</Chip>}
                  {prog.sansImpactPct > 0 && <Chip icone={<Bike className="h-3 w-3" />}>{prog.sansImpactPct} %</Chip>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const prog = PROGRAMMES[choisi];
  const plan = genererPlan({ programme: choisi, niveau, volumeDepartKm: volumeKm, semaines: semaines ?? prog.semaines[0] });

  return (
    <div className="space-y-6">
      <button onClick={() => setChoisi(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> {t.retour}
      </button>

      <header>
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{t.noms[choisi]}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">{t.pitchs[choisi]}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{t.duree}</span>
        {prog.semaines.map((n) => (
          <button
            key={n} onClick={() => setSemaines(n)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              (semaines ?? prog.semaines[0]) === n ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >{n} {t.semaines}</button>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-100">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{t.avertissement}
      </p>

      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-inset ring-zinc-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <th className="px-5 py-3">{t.colSemaine}</th>
              <th className="px-5 py-3">{t.colPhase}</th>
              <th className="px-5 py-3">{t.colVolume}</th>
              <th className="px-5 py-3">{prog.marcheCourse ? t.colSansImpact : t.colLongue}</th>
              <th className="px-5 py-3">{t.colQualite}</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((w) => (
              <tr key={w.semaine} className="border-b border-zinc-50 last:border-0">
                <td className="px-5 py-3 font-semibold text-zinc-900">{w.semaine}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TEINTE[w.phase]}`}>
                    {t.phases[w.phase]}
                  </span>
                  {w.decharge && <span className="ml-2 text-xs text-zinc-400">{t.decharge}</span>}
                </td>
                <td className="px-5 py-3 text-zinc-700">{w.volumeKm} km</td>
                <td className="px-5 py-3 text-zinc-700">
                  {prog.marcheCourse ? `${w.sansImpactKm} km` : w.sortieLongueKm != null ? `${w.sortieLongueKm} km` : t.aucuneQualite}
                </td>
                <td className="px-5 py-3 text-zinc-700">{w.qualites > 0 ? `${w.qualites}×` : t.aucuneQualite}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-50/70">
              <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400" colSpan={2}>{t.total}</td>
              <td className="px-5 py-3 font-bold text-zinc-900" colSpan={3}>{volumeTotal(plan)} km</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Chip({ children, icone }: { children: React.ReactNode; icone?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
      {icone}{children}
    </span>
  );
}
