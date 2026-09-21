"use client";
import { useState } from "react";
import {
  ArrowLeft, ChevronRight, Gauge, Footprints, Bike, TrendingUp, Info,
  Timer, Route, Medal, Mountain, Zap, HeartPulse, Scale,
} from "lucide-react";
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

/**
 * ⚠️ LES NEUF PLANS NE SONT PAS DE MÊME NATURE, et les aligner dans une grille uniforme
 * le cachait. Cinq visent une COURSE avec une date (le plan finit par un affûtage), quatre
 * n'en ont pas (aucun affûtage, cf. `phaseDe` dans le catalogue). Les séparer n'est donc
 * pas une coquetterie : c'est la seule différence qui change la structure du plan.
 */
const GROUPES: { cle: "course" | "sansCourse"; plans: CleProgramme[] }[] = [
  { cle: "course", plans: ["km5", "km10", "semi", "marathon", "trail"] },
  { cle: "sansCourse", plans: ["debutant", "vitesse", "blessure", "poids"] },
];

/** Une icône par programme : la carte se reconnaît avant d'être lue. */
const ICONE: Record<CleProgramme, typeof Gauge> = {
  km5: Timer, km10: Gauge, semi: Route, marathon: Medal, trail: Mountain,
  debutant: Footprints, vitesse: Zap, blessure: HeartPulse, poids: Scale,
};

export function PlansView({ niveau, volumeKm }: { niveau: Niveau; volumeKm: number }) {
  const { lang } = useT();
  const t = PLANS_I18N[lang] ?? PLANS_I18N.fr;
  const [choisi, setChoisi] = useState<CleProgramme | null>(null);
  const [semaines, setSemaines] = useState<number | null>(null);

  if (!choisi) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{t.titre}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">{t.sousTitre}</p>
        </header>

        {/* Les DEUX chiffres qui personnalisent chaque plan, mis en évidence : sans eux,
            l'athlète ne peut pas savoir sur quoi les volumes affichés sont bâtis. */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:max-w-xl">
          <div className="flex items-center gap-2.5 rounded-2xl bg-white px-3 py-3 ring-1 ring-inset ring-zinc-200 sm:gap-3 sm:px-5 sm:py-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700 sm:h-10 sm:w-10">
              <Gauge className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{t.niveau}</div>
              <div className="text-base font-bold leading-tight text-zinc-900 sm:text-lg">{t.niveaux[niveau]}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl bg-white px-3 py-3 ring-1 ring-inset ring-zinc-200 sm:gap-3 sm:px-5 sm:py-4">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700 sm:h-10 sm:w-10">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{t.volumeActuel}</div>
              <div className="text-base font-bold leading-tight text-zinc-900 sm:text-lg">
                {volumeKm} <span className="text-sm font-medium text-zinc-400">{t.parSemaine}</span>
              </div>
            </div>
          </div>
        </div>

        {GROUPES.map((groupe) => (
          <section key={groupe.cle} className="space-y-4">
            <h2 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {groupe.cle === "course" ? t.groupeCourse : t.groupeSansCourse}
              <span aria-hidden className="h-px flex-1 bg-zinc-200" />
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
              {groupe.plans.map((cle) => {
                const prog = PROGRAMMES[cle];
                const Icone = ICONE[cle];
                return (
                  <button
                    key={cle}
                    onClick={() => { setChoisi(cle); setSemaines(prog.semaines[0]); }}
                    className="group relative flex flex-col items-start overflow-hidden rounded-2xl bg-white p-3.5 text-left ring-1 ring-inset ring-zinc-200 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-emerald-400 sm:rounded-3xl sm:p-6"
                  >
                    {/* ⚠️ PAS DE LISERÉ AU SURVOL ICI. Première version : un
                        `scale-x-0 group-hover:scale-x-100`. Vérifié dans le navigateur —
                        AUCUNE règle `.scale-x-0` n'existait dans la feuille de style
                        produite, et `getComputedStyle` rendait `transform: none` : le
                        liseré s'affichait donc en permanence sur les neuf cartes, ce qui
                        les faisait toutes paraître sélectionnées. Troisième panne de cette
                        famille dans la même journée (opacités hors échelle, dégradé
                        arbitraire) — une classe présente dans le DOM ne prouve rien.
                        Le survol est déjà signalé quatre fois : élévation, ombre, anneau
                        émeraude et icône qui se remplit. Un cinquième signal décoratif ne
                        valait pas de reprendre ce risque. */}
                    <div className="flex w-full items-start justify-between gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white sm:h-11 sm:w-11 sm:rounded-2xl">
                        <Icone className="h-5 w-5" />
                      </span>
                      {/* La distance, pour les plans qui visent une course : c'est
                          l'information qu'on cherche en premier, pas la durée du plan. */}
                      {prog.distanceKm != null && groupe.cle === "course" && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-zinc-600">
                          {prog.distanceKm} km
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2.5 text-sm font-bold leading-snug text-zinc-900 sm:mt-4 sm:text-base">{t.noms[cle]}</h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-zinc-500 sm:mt-1.5 sm:line-clamp-none sm:text-sm">{t.pitchs[cle]}</p>
                    <div className="mt-2.5 flex w-full flex-wrap items-center gap-1.5 sm:mt-4">
                      <Chip>{prog.semaines[0]} {t.semaines}</Chip>
                      {prog.marcheCourse && <Chip icone={<Footprints className="h-3 w-3" />}>{t.marcheCourse}</Chip>}
                      {prog.sansImpactPct > 0 && <Chip icone={<Bike className="h-3 w-3" />}>{prog.sansImpactPct} %</Chip>}
                      <ChevronRight className="ml-auto h-4 w-4 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
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

      {/* ⚠️ SUR TÉLÉPHONE, UNE LISTE, PAS UN TABLEAU DE 640 PX (Cyprien, 21/09/2026) : une
          ligne par semaine — phase, volume, sortie longue (ou km sans impact), qualités. */}
      <div className="space-y-1.5 sm:hidden">
        {plan.map((w) => (
          <div key={w.semaine} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-inset ring-zinc-200">
            <span className="w-7 flex-shrink-0 text-sm font-bold tabular-nums text-zinc-900">S{w.semaine}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${TEINTE[w.phase]}`}>{t.phases[w.phase]}{w.decharge ? " ↓" : ""}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums text-zinc-900">{w.volumeKm} km</span>
            <span className="text-xs tabular-nums text-zinc-500">
              {prog.marcheCourse ? `${w.sansImpactKm} km` : w.sortieLongueKm != null ? `SL ${w.sortieLongueKm}` : "—"}
            </span>
            <span className="w-7 text-right text-xs tabular-nums text-zinc-500">{w.qualites > 0 ? `${w.qualites}×` : "—"}</span>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          <span>{t.total}</span><span className="text-sm normal-case tracking-normal text-zinc-900">{volumeTotal(plan)} km</span>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-inset ring-zinc-200 sm:block">
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
