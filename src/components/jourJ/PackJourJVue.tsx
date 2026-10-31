import Link from "next/link";
import { Flag, Timer, Thermometer, Droplets, Flame, Moon, Lock } from "lucide-react";
import { formatDateCivile } from "@/lib/time/fuseau";
import { temps, type PackJourJ } from "@/lib/coach/jourJ";
import type { TextesJourJ } from "@/lib/coach/jourJI18n";

/**
 * Le pack jour J (Premium) — voir `lib/coach/jourJ`. Composant SERVEUR : rien n'y est
 * interactif, tout est calculé avant d'arriver ici, dans la langue de l'athlète.
 */
const carte = "rounded-2xl border border-zinc-200 bg-white p-5";
const titreCarte = "flex items-center gap-2 text-sm font-semibold text-zinc-900";

function Entete({ t, sous }: { t: TextesJourJ; sous?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-[#059669]" />
        <h1 className="text-2xl font-bold tracking-tight text-[#11201d]">{t.titre}</h1>
        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">{t.premium}</span>
      </div>
      {sous && <p className="mt-1 text-sm text-zinc-500">{sous}</p>}
    </div>
  );
}

/** La page vue par une formule qui n'ouvre pas le pack : elle dit ce qu'il contient, et où l'obtenir. */
export function VerrouJourJ({ t }: { t: TextesJourJ }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Entete t={t} />
      <div className={carte}>
        <p className="flex gap-2 text-sm leading-relaxed text-zinc-700"><Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />{t.verrou}</p>
        <Link href="/pricing" className="mt-3 inline-flex rounded-full bg-[#059669] px-4 py-2 text-sm font-semibold text-white hover:bg-[#047857]">{t.verrouCta}</Link>
      </div>
    </div>
  );
}

export function SansObjectifJourJ({ t }: { t: TextesJourJ }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Entete t={t} />
      <div className={carte}>
        <p className="text-sm leading-relaxed text-zinc-700">{t.sansObjectif}</p>
        <Link href="/dashboard" className="mt-3 inline-flex rounded-full bg-[#059669] px-4 py-2 text-sm font-semibold text-white hover:bg-[#047857]">{t.sansObjectifCta}</Link>
      </div>
    </div>
  );
}

export function PackJourJVue({ pack, t, lang, nom, date, joursRestants, dplusM }: {
  pack: PackJourJ; t: TextesJourJ; lang: string; nom: string; date: string; joursRestants: number; dplusM: number | null;
}) {
  const c = pack.chrono;
  const n = (x: number) => new Intl.NumberFormat(lang).format(x);
  const sous = [nom, formatDateCivile(date, lang, { day: "numeric", month: "long", year: "numeric" }), t.jRestants(String(joursRestants))].join(" · ");
  const stats: [string, number | null][] = [[t.vise, c.viseSec], [t.maintenant, c.maintenantSec], [t.auJourJ, c.projeteSec]];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Entete t={t} sous={sous} />

      <section className={carte}>
        <h2 className={titreCarte}><Timer className="h-4 w-4 text-[#059669]" />{t.chrono}</h2>
        {pack.mode === "route" ? (
          <>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {stats.map(([label, sec]) => (
                <div key={label}>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</div>
                  <div className="text-xl font-black tabular-nums text-zinc-900">{sec == null ? "—" : temps(sec)}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-700">
              {c.verdict === "irrealiste" && c.projeteSec != null ? t.verdict.irrealiste(temps(c.projeteSec)) : c.verdict === "irrealiste" ? t.verdict.inconnu : t.verdict[c.verdict]}
            </p>
            {c.allureSecKm != null && (
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-xs font-medium text-zinc-500">{t.allure}</span>
                <span className="text-2xl font-black tabular-nums text-[#059669]">{temps(c.allureSecKm)}</span>
                <span className="text-xs text-zinc-500">{t.parKm}</span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-zinc-700">
            {t.trail}{dplusM != null ? ` ${t.trailDplus(n(dplusM))}` : ""}
          </p>
        )}
      </section>

      {pack.passages.length > 0 && (
        <section className={carte}>
          <h2 className={titreCarte}><Flag className="h-4 w-4 text-[#059669]" />{t.marche}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{pack.strategie === "longue" ? t.strategieLongue : t.strategieCourte}</p>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400"><th className="py-1 font-medium">{t.km}</th><th className="py-1 text-right font-medium">{t.tempsPassage}</th></tr></thead>
            <tbody>
              {pack.passages.map((p) => (
                <tr key={p.km} className="border-t border-zinc-100"><td className="py-1.5 tabular-nums text-zinc-600">{n(p.km)}</td><td className="py-1.5 text-right font-semibold tabular-nums text-zinc-900">{temps(p.tempsSec)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className={carte}>
        <h2 className={titreCarte}><Thermometer className="h-4 w-4 text-[#059669]" />{t.meteo}</h2>
        {pack.meteo.prevue ? (
          <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-700">
            <p>{t.prevue(n(Math.round(pack.meteo.prevue.tempC)))}</p>
            {pack.meteo.prevue.ventKmh != null && pack.meteo.prevue.ventKmh >= 20 && <p>{t.prevueVent(n(Math.round(pack.meteo.prevue.ventKmh)))}</p>}
            {pack.meteo.prevue.allureSecKm != null && pack.meteo.prevue.tempsSec != null && (
              <p className="font-semibold text-zinc-900">{t.prevueAllure(temps(pack.meteo.prevue.allureSecKm), temps(pack.meteo.prevue.tempsSec))}</p>
            )}
          </div>
        ) : pack.meteo.scenarios.length > 0 ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{t.meteoAttente}</p>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {pack.meteo.scenarios.map((s) => (
                  <tr key={s.cle} className="border-t border-zinc-100">
                    <td className="py-1.5 text-zinc-600">{t.tranche[s.cle]}</td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-700">{temps(s.allureSecKm)}{t.parKm}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-zinc-900">{temps(s.tempsSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{t.meteoTrail}</p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{t.chaleur}</p>
      </section>

      <section className={carte}>
        <h2 className={titreCarte}><Droplets className="h-4 w-4 text-[#059669]" />{t.ravito}</h2>
        {pack.nutrition ? (
          <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-700">
            {pack.nutrition.plan.gels > 0 && <p>{t.ravitoGels(n(pack.nutrition.plan.gels), n(pack.nutrition.plan.premierApportMin), n(pack.nutrition.deroule.intervalleMin))}</p>}
            <p>{t.ravitoBoisson(n(pack.nutrition.plan.mlParH), n(pack.nutrition.deroule.flasques), n(pack.nutrition.deroule.sodiumMgParH))}</p>
            {!pack.nutrition.plan.tempConnue && <p className="text-xs text-zinc-500">{t.ravitoTemperee}</p>}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">{t.ravitoRien}</p>
        )}
      </section>

      <section className={carte}>
        <h2 className={titreCarte}><Flame className="h-4 w-4 text-[#059669]" />{t.echauffement}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">{t.echauffementTexte[pack.echauffement]}</p>
      </section>

      <section className={carte}>
        <h2 className={titreCarte}><Moon className="h-4 w-4 text-[#059669]" />{t.veille}</h2>
        <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-700">
          {pack.veilleGlucidesG != null && <p>{t.veilleGlucides(n(pack.veilleGlucidesG))}</p>}
          <p>{t.veilleBase}</p>
          {pack.pps && (
            <p className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">{t.pps}</span>
              <Link href="/dashboard/pps" className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline">{t.ppsCta}</Link>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
