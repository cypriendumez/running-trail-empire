"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Target, Calendar, Zap, AlertTriangle } from "lucide-react";
import type { Workout } from "@/types";
import { useT } from "@/lib/i18n/LanguageProvider";

interface TaperingWidgetProps {
  workouts: Workout[];
  raceDate?: string | null;
}

interface LoadMetrics {
  ctl: number;
  atl: number;
  tsb: number;
}

export function TaperingWidget({ workouts, raceDate }: TaperingWidgetProps) {
  const { t } = useT();
  const { ctl, atl, tsb, history } = useMemo(() => computeLoad(workouts), [workouts]);

  const daysToRace = raceDate
    ? Math.ceil((new Date(raceDate).getTime() - Date.now()) / 86400000)
    : null;

  const isTaperingWindow = daysToRace !== null && daysToRace <= 21 && daysToRace > 0;
  const targetTSB = 15;
  const tsbProgress = Math.min(100, Math.max(0, ((tsb + 30) / (targetTSB + 30)) * 100));

  const tsbStatus =
    tsb >= 10 ? { labelK: "tap.status.optimal", color: "text-green-600", bg: "bg-[#D1FAE5]" }
    : tsb >= 0 ? { labelK: "tap.status.rising", color: "text-blue-600", bg: "bg-[#E0F2FE]" }
    : tsb >= -10 ? { labelK: "tap.status.balanced", color: "text-orange-500", bg: "bg-[#FFEDD5]" }
    : { labelK: "tap.status.overload", color: "text-red-600", bg: "bg-red-50" };

  const predictedRaceTSB = isTaperingWindow && daysToRace
    ? Math.min(25, tsb + daysToRace * 1.2)
    : null;

  return (
    <div className="bento-card h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-700">{t("tap.title")}</span>
        </div>
        {isTaperingWindow && (
          <span className="text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            J-{daysToRace}
          </span>
        )}
      </div>

      {/* CTL / ATL / TSB row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MetricCard label="CTL" sublabel={t("tap.form")} value={Math.round(ctl)} color="text-blue-700" bg="bg-blue-50" />
        <MetricCard label="ATL" sublabel={t("tap.fatigue")} value={Math.round(atl)} color="text-orange-700" bg="bg-orange-50" />
        <MetricCard
          label="TSB"
          sublabel={t("tap.freshness")}
          value={Math.round(tsb)}
          color={tsb >= 0 ? "text-green-700" : "text-red-600"}
          bg={tsb >= 0 ? "bg-green-50" : "bg-red-50"}
          showSign
        />
      </div>

      {/* TSB status */}
      <div className={`rounded-xl px-4 py-3 mb-4 ${tsbStatus.bg}`}>
        <div className={`text-xs font-semibold ${tsbStatus.color}`}>{t(tsbStatus.labelK)}</div>
        <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-current rounded-full"
            style={{ color: tsbStatus.color.replace("text-", "bg-") }}
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
              {t("tap.targetDay")} <span className="font-bold text-zinc-700">+{targetTSB}</span>
            </div>
            <div className="text-xs text-zinc-500">
              {t("tap.predicted")} <span className={`font-bold ${predictedRaceTSB >= targetTSB ? "text-green-600" : "text-orange-500"}`}>
                +{Math.round(predictedRaceTSB)}
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${predictedRaceTSB >= targetTSB ? "bg-green-500" : "bg-orange-400"}`}
              style={{ width: `${Math.min(100, (predictedRaceTSB / 25) * 100)}%` }}
            />
          </div>
          {predictedRaceTSB < targetTSB - 5 && (
            <p className="mt-2 text-xs text-orange-600 flex items-center gap-1">
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
                className={`flex-1 rounded-sm transition-all ${
                  m.tsb >= 0 ? "bg-green-300" : m.tsb >= -15 ? "bg-orange-300" : "bg-red-300"
                }`}
                style={{ height: `${h}px` }}
                title={`TSB: ${Math.round(m.tsb)}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label, sublabel, value, color, bg, showSign = false,
}: {
  label: string; sublabel: string; value: number; color: string; bg: string; showSign?: boolean;
}) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <div className="text-xs text-zinc-500 mb-0.5">{sublabel}</div>
      <div className={`text-xl font-black ${color}`}>
        {showSign && value > 0 ? "+" : ""}{value}
      </div>
      <div className="text-xs font-semibold text-zinc-400">{label}</div>
    </div>
  );
}

// ── Banister model (simplified) ──────────────────────────────
function computeLoad(workouts: Workout[]): { ctl: number; atl: number; tsb: number; history: LoadMetrics[] } {
  const K_CTL = 42; // days
  const K_ATL = 7;  // days

  const tssMap: Record<string, number> = {};
  for (const w of workouts) {
    const tss = w.tss ?? estimateTSS(w);
    tssMap[w.date] = (tssMap[w.date] ?? 0) + tss;
  }

  let ctl = 40; // typical starting fitness
  let atl = 40;
  const history: LoadMetrics[] = [];

  for (let i = 41; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    const tss = tssMap[d] ?? 0;
    ctl = ctl + (tss - ctl) / K_CTL;
    atl = atl + (tss - atl) / K_ATL;
    history.push({ ctl, atl, tsb: ctl - atl });
  }

  return { ctl, atl, tsb: ctl - atl, history };
}

function estimateTSS(w: Workout): number {
  const durationHours = (w.duration_seconds ?? 0) / 3600;
  const typeMultiplier: Record<string, number> = {
    easy: 50, tempo: 75, interval: 90, vma: 100,
    long_run: 65, trail: 70, hill_repeat: 85,
    race: 110, recovery: 30, strength: 40,
  };
  return Math.round(durationHours * (typeMultiplier[w.type] ?? 60));
}
