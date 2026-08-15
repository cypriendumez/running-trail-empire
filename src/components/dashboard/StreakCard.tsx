"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  LA SÉRIE — la carte qui donne envie de revenir, sans jamais pousser à courir.
//
//  Toute la pédagogie tient dans la bande de journées : l'athlète VOIT qu'un jour
//  de repos est vert au même titre qu'une séance. Sans cette bande, la règle
//  resterait une phrase que personne ne lit, et le premier jour de repos serait
//  vécu comme une perte.
//
//  Ce composant n'a AUCUNE logique de série : tout vient de `computeStreak`, qui
//  est testé. Il ne fait que traduire des verdicts en couleurs et en phrases.
// ─────────────────────────────────────────────────────────────────────────────

import { Flame, Moon, Check, Clock, Shield, Minus, X, Dumbbell } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { StreakResult, StreakDay } from "@/lib/streak/compute";

/** Nombre de journées montrées dans la bande. Deux semaines : assez pour voir un
 *  rythme hebdomadaire (donc les jours de repos), assez court pour tenir sur un
 *  téléphone sans rétrécir les pastilles jusqu'à l'illisible. */
const JOURS_AFFICHES = 14;

type Style = { dot: string; ring: string; icon: typeof Check; legend: string };

function styleDe(d: StreakDay): Style {
  if (d.verdict === "tenu") {
    if (d.reason === "repos-respecte") return { dot: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-300", icon: Moon, legend: "streak.leg.rest" };
    if (d.reason === "renfo") return { dot: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-300", icon: Dumbbell, legend: "streak.leg.rest" };
    return { dot: "bg-emerald-500 text-white", ring: "ring-emerald-500", icon: Check, legend: "streak.leg.done" };
  }
  if (d.verdict === "attente") return { dot: "bg-white text-amber-500", ring: "ring-amber-300", icon: Clock, legend: "streak.leg.wait" };
  if (d.verdict === "protege") return { dot: "bg-sky-100 text-sky-600", ring: "ring-sky-300", icon: Shield, legend: "streak.leg.prot" };
  if (d.verdict === "rompu") return { dot: "bg-white text-zinc-400", ring: "ring-zinc-300", icon: X, legend: "streak.leg.miss" };
  return { dot: "bg-zinc-50 text-zinc-300", ring: "ring-zinc-200", icon: Minus, legend: "streak.leg.off" };
}

/** Ce qui se joue AUJOURD'HUI, en une phrase — jamais une injonction. */
function cleDuJour(d: StreakDay | null): string {
  if (!d) return "streak.today.none";
  if (d.verdict === "tenu") {
    return d.reason === "repos-respecte" ? "streak.today.rest"
      : d.reason === "renfo" ? "streak.today.renfo"
      : "streak.today.done";
  }
  if (d.verdict === "attente") return "streak.today.wait";
  if (d.verdict === "protege") return "streak.today.protected";
  if (d.reason === "repos-charge") return "streak.today.extra";
  return "streak.today.none";
}

export function StreakCard({ streak }: { streak: StreakResult | null }) {
  const { t, lang } = useT();
  if (!streak) return null;

  const jours = streak.days.slice(-JOURS_AFFICHES);
  // Légende : uniquement les états RÉELLEMENT présents dans la bande — afficher six
  // pastilles explicatives pour trois états visibles noie l'information utile — et
  // dans un ordre FIXE. Suivre l'ordre d'apparition mettait « hors plan » en tête
  // parce que la bande commence avant le premier plan publié : la carte s'ouvrait sur
  // ce qui ne compte pas.
  const ORDRE = ["streak.leg.done", "streak.leg.rest", "streak.leg.wait", "streak.leg.prot", "streak.leg.miss", "streak.leg.off"];
  const presents = new Map<string, Style>();
  for (const j of jours) { const s = styleDe(j); if (!presents.has(s.legend)) presents.set(s.legend, s); }
  const legende = ORDRE.filter((k) => presents.has(k)).map((k) => presents.get(k)!);

  const n = streak.current;
  const dateCourte = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang, { day: "numeric", month: "short" });

  return (
    <div className="mb-5 overflow-hidden rounded-3xl border border-[#e3eef0] bg-white shadow-[0_10px_36px_-28px_rgba(16,24,40,0.35)]">
      <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:gap-7 sm:px-6">
        {/* Le compteur */}
        <div className="flex flex-shrink-0 items-center gap-3.5 sm:w-[8.5rem] sm:border-r sm:border-[#eef4f5] sm:pr-5">
          <span
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${n > 0 ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm" : "bg-zinc-100 text-zinc-300"}`}
          >
            <Flame className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[2rem] font-black leading-none tabular-nums text-[#11201d]">{n}</span>
              <span className="text-sm font-semibold text-[#8aa6a6]">{n === 1 ? t("streak.unit1") : t("streak.unit")}</span>
            </div>
            <div className="mt-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8aa6a6]">
              {t("streak.title")}
            </div>
          </div>
        </div>

        {/* La bande de journées — c'est elle qui ENSEIGNE la règle */}
        <div className="min-w-0 flex-1">
          {/* Quatorze pastilles doivent tenir sur 335 px de large (iPhone SE) SANS se
              chevaucher ni imposer un défilement horizontal au widget principal : sur
              mobile elles descendent à 20 px et l'écart tombe à 2 px. */}
          <div className="flex items-end justify-between gap-[2px] sm:gap-1.5">
            {jours.map((d) => {
              const s = styleDe(d);
              const Icone = s.icon;
              const dt = new Date(`${d.date}T12:00:00Z`);
              return (
                <div key={d.date} className="flex flex-col items-center gap-1" title={`${d.date}${d.prescribed ? ` · ${d.prescribed}` : ""}`}>
                  <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ring-1 sm:h-7 sm:w-7 ${s.dot} ${s.ring}`}>
                    <Icone className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" strokeWidth={2.5} />
                  </span>
                  <span className="text-[9px] font-medium uppercase leading-none text-[#a9bfbd]">
                    {dt.toLocaleDateString(lang, { weekday: "narrow" })}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            {legende.map((s) => {
              const Icone = s.icon;
              return (
                <span key={s.legend} className="inline-flex items-center gap-1 text-[10px] text-[#8aa6a6]">
                  <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ring-1 ${s.dot} ${s.ring}`}>
                    <Icone className="h-2 w-2" strokeWidth={3} />
                  </span>
                  {t(s.legend)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Le contrat du jour, et ce qui pourrait l'entamer — des faits, pas une menace */}
      <div className="border-t border-[#eef4f5] bg-[#fbfdfd] px-5 py-3 sm:px-6">
        <p className="text-[13px] font-medium text-[#3f5b57]">{t(cleDuJour(streak.today))}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#8aa6a6]">
          {streak.threat
            ? t("streak.threat", { d: dateCourte(streak.threat.date) })
            : streak.pending > 0
              ? t("streak.lateOk")
              : t("streak.rule")}
          {streak.best > streak.current && <span className="ml-1.5">· {t("streak.best", { n: streak.best })}</span>}
        </p>
      </div>
    </div>
  );
}
