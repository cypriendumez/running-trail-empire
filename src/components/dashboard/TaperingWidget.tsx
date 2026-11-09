"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Target, Calendar, AlertTriangle } from "lucide-react";
import type { Workout } from "@/types";
import { useT } from "@/lib/i18n/LanguageProvider";
import { computeLoad, type SeanceCharge } from "@/lib/dashboard/charge";
import { ecartJours } from "@/lib/streak/compute";

interface TaperingWidgetProps {
  /** Historique de charge sur un an, chargé par une requête dédiée. La liste
   *  principale du tableau de bord est plafonnée à 40 activités : s'en servir ne
   *  laissait pas au modèle le temps de converger (voir `computeLoad`). */
  workouts: SeanceCharge[];
  raceDate?: string | null;
  /** Jour civil de l'athlète, fourni par le serveur : le même au rendu et à l'hydratation
   *  (l'horloge de la machine donnait la veille au serveur entre minuit et 1 h). */
  aujourdhui?: string;
}

export function TaperingWidget({ workouts, raceDate, aujourdhui }: TaperingWidgetProps) {
  const { t, lang } = useT();
  const { ctl, atl, tsb, history, estimees } = useMemo(() => computeLoad(workouts, aujourdhui), [workouts, aujourdhui]);

  const daysToRace = raceDate && aujourdhui
    ? ecartJours(aujourdhui, String(raceDate).slice(0, 10))
    : raceDate ? Math.ceil((new Date(raceDate).getTime() - Date.now()) / 86400000) : null;

  const isTaperingWindow = daysToRace !== null && daysToRace <= 21 && daysToRace > 0;
  const targetTSB = 15;
  const tsbProgress = Math.min(100, Math.max(0, ((tsb + 30) / (targetTSB + 30)) * 100));

  // LA CHARTE (DESIGN.md, 07/11/2026) : surfaces neutres, la couleur ne marque que le SENS
  // (fraîcheur positive ou négative, état). Les trois aplats pastel bleu/orange/vert et le
  // bandeau coloré faisaient de cette carte la seule « arc-en-ciel » du tableau de bord.
  // ⚠️ « AFFÛTAGE OPTIMAL » SEULEMENT À L'APPROCHE D'UNE COURSE (audit du 09/11/2026). Le libellé
  //    tombait dès +10 de fraîcheur, quel que soit le calendrier : à +36, quinze jours sans courir
  //    et quarante jours avant la course, la carte félicitait d'un affûtage. Hors des 21 jours qui
  //    précèdent la course, +10 à +25 c'est « frais » ; au-delà de +25 (seuil « transition » de
  //    Coggan/TrainingPeaks), la forme s'érode — on le dit, en orange.
  const tsbStatus =
    tsb > 25 && !isTaperingWindow ? { labelK: "tap.status.detraining", color: "text-amber-700", bar: "bg-amber-400", dot: "bg-amber-400" }
    : tsb >= 10 ? { labelK: isTaperingWindow ? "tap.status.optimal" : "tap.status.fresh", color: "text-emerald-700", bar: "bg-emerald-500", dot: "bg-emerald-500" }
    : tsb >= 0 ? { labelK: "tap.status.rising", color: "text-emerald-700", bar: "bg-emerald-400", dot: "bg-emerald-400" }
    : tsb >= -10 ? { labelK: "tap.status.balanced", color: "text-amber-700", bar: "bg-amber-400", dot: "bg-amber-400" }
    : { labelK: "tap.status.overload", color: "text-rose-700", bar: "bg-rose-500", dot: "bg-rose-500" };

  const predictedRaceTSB = isTaperingWindow && daysToRace
    ? Math.min(25, tsb + daysToRace * 1.2)
    : null;

  return (
    <div className="bento-card h-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="metric-label">{t("tap.title")}</div>
        {isTaperingWindow ? (
          <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-700">
            <Calendar className="h-3 w-3" />
            J-{daysToRace}
          </span>
        ) : null}
      </div>

      {/* CTL / ATL / TSB : le nom parlant d'abord, le sigle en petit pour qui le connaît. */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <MetricCard label="CTL" sublabel={t("tap.form")} value={Math.round(ctl)} color="text-zinc-900" />
        <MetricCard label="ATL" sublabel={t("tap.fatigue")} value={Math.round(atl)} color="text-zinc-900" />
        <MetricCard
          label="TSB"
          sublabel={t("tap.freshness")}
          value={Math.round(tsb)}
          color={tsb >= 0 ? "text-emerald-600" : "text-rose-600"}
          showSign
        />
      </div>

      {/* TSB status */}
      <div className="mb-4">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${tsbStatus.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tsbStatus.dot}`} />
          {t(tsbStatus.labelK)}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          {/* ⚠️ LA BARRE ÉTAIT NOIRE (06/11/2026) : `style={{ color: "bg-green-600" }}` mettait un
              NOM DE CLASSE dans une propriété CSS — invalide, donc `bg-current` prenait la
              couleur du texte. La classe de fond est maintenant posée directement. */}
          <motion.div
            className={`h-full rounded-full ${tsbStatus.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${tsbProgress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Tapering target */}
      {isTaperingWindow && predictedRaceTSB !== null && (
        <div className="border border-zinc-200 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Target className="w-3.5 h-3.5" />
              {t("tap.targetDay")} <span className="font-semibold text-zinc-700">+{targetTSB}</span>
            </div>
            <div className="text-xs text-zinc-500">
              {t("tap.predicted")} <span className={`font-semibold ${predictedRaceTSB >= targetTSB ? "text-emerald-600" : "text-amber-600"}`}>
                +{Math.round(predictedRaceTSB)}
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${predictedRaceTSB >= targetTSB ? "bg-emerald-500" : "bg-amber-400"}`}
              style={{ width: `${Math.min(100, (predictedRaceTSB / 25) * 100)}%` }}
            />
          </div>
          {predictedRaceTSB < targetTSB - 5 && (
            <p className="mt-2 text-xs text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t("tap.reduce", { min: Math.round((targetTSB - predictedRaceTSB) * 3) })}
            </p>
          )}
        </div>
      )}

      {/* 7-day TSB sparkline */}
      <div className="mt-4">
        <div className="text-xs text-zinc-400 mb-2">{t("tap.spark")}</div>
        <div className="flex items-end gap-1 h-8">
          {history.slice(-7).map((m, i) => {
            const h = Math.min(32, Math.max(4, ((m.tsb + 30) / 60) * 32));
            return (
              <div
                key={i}
                className={`flex-1 rounded-sm ${
                  m.tsb >= 0 ? "bg-emerald-300" : m.tsb >= -15 ? "bg-amber-300" : "bg-rose-300"
                }`}
                style={{ height: `${h}px` }}
                title={`${t("tap.freshness")}${lang === "fr" ? "\u00a0: " : ": "}${Math.round(m.tsb) > 0 ? "+" : ""}${Math.round(m.tsb)}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label, sublabel, value, color, showSign = false,
}: {
  label: string; sublabel: string; value: number; color: string; showSign?: boolean;
}) {
  return (
    <div className="rounded-xl bg-zinc-50 px-2 py-2.5 text-center ring-1 ring-inset ring-zinc-100">
      <div className="truncate text-[11px] font-medium text-zinc-500">{sublabel}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums tracking-tight ${color}`}>
        {showSign && value > 0 ? "+" : ""}{value}
      </div>
      <div className="text-[11px] font-semibold text-zinc-400">{label}</div>
    </div>
  );
}

// ── Banister model (simplified) ──────────────────────────────
