"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Trophy, Zap, Users, Star, TrendingUp, TrendingDown, Minus,
  Lock, CheckCircle, Flame, Medal, Plus, ChevronRight,
  MapPin, Calendar, BarChart2, Target, Crown, Mountain, CalendarClock,
} from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { LX, UNIT_T, CH_T } from "./leaguesI18n";
import { BADGE_T } from "./leaguesBadgesI18n";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ComputedBadge {
  id: string;
  name: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
  unlocked: boolean;
  progress: number;
  max: number;
}

interface LeagueMember {
  user_id: string;
  score: number;
  rank: number | null;
  profiles: { full_name: string; avatar_url?: string; league?: string } | null;
}

interface Challenge {
  id: string;
  name: string;
  description?: string;
  total_km: number;
  current_km: number;
  end_date?: string;
}

interface AutoChallenge {
  id: string; icon: string; name: string; desc: string;
  current: number; target: number; unit: string; daysLeft: number; period: string;
}

// ── Config ─────────────────────────────────────────────────────────────────────
// Libellés (label/next) traduits au rendu via LX (clés tier.* / rar.*).
const TIER_CONFIG: Record<string, { gradient: string; emoji: string; textColor: string; next?: string }> = {
  bronze:   { gradient: "from-orange-400 to-amber-600",   emoji: "🥉", textColor: "text-amber-700",  next: "silver" },
  silver:   { gradient: "from-slate-300 to-slate-500",    emoji: "🥈", textColor: "text-slate-600",  next: "gold" },
  gold:     { gradient: "from-yellow-400 to-amber-500",   emoji: "🥇", textColor: "text-yellow-700", next: "platinum" },
  platinum: { gradient: "from-cyan-400 to-sky-600",       emoji: "🔷", textColor: "text-cyan-700",   next: "diamond" },
  diamond:  { gradient: "from-violet-400 to-purple-600",  emoji: "💎", textColor: "text-violet-700", next: undefined },
};

const RARITY_CONFIG = {
  common:    { bg: "bg-zinc-50",     border: "border-zinc-200",   text: "text-zinc-500",    glow: "" },
  rare:      { bg: "bg-blue-50",     border: "border-blue-200",   text: "text-blue-600",    glow: "shadow-blue-100" },
  epic:      { bg: "bg-amber-50",    border: "border-amber-200",  text: "text-amber-600",   glow: "shadow-amber-100" },
  legendary: { bg: "bg-violet-50",   border: "border-violet-200", text: "text-violet-600",  glow: "shadow-violet-100" },
};

function fillT(s: string, p: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));
}

// ── Helper: user initials avatar ───────────────────────────────────────────────
function Avatar({ name, url, size = 8 }: { name: string; url?: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden`;
  if (url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <div className={cls}><img src={url} alt={name} className="w-full h-full object-cover" /></div>
  );
  return (
    <div className={`${cls} bg-gradient-to-br from-green-400 to-emerald-600`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function LeaguesHub({
  userId, profile, myMembership, leagueMembers, computedBadges,
  myChallenges, availableChallenges, autoChallenges, stats, records,
}: {
  userId: string;
  profile: Record<string, unknown>;
  myMembership: Record<string, unknown> | null;
  leagueMembers: Record<string, unknown>[];
  computedBadges: ComputedBadge[];
  myChallenges: Record<string, unknown>[];
  availableChallenges: Record<string, unknown>[];
  autoChallenges: AutoChallenge[];
  stats: { totalKm: number; streak: number; sessions: number; elevation: number };
  records: { longestRun: number; bestPace: number; biggestWeek: number; biggestMonth: number; longestStreak: number; maxElevRun: number; totalHours: number; weeksActive: number };
}) {
  const { lang } = useT();
  const d = LX[lang] ?? LX.fr;
  // Badges & défis arrivent en FR du serveur → remplacés par id (fr = passthrough).
  const bT = (b: ComputedBadge): [string, string] => BADGE_T[lang]?.[b.id] ?? [b.name, b.description];
  const cT = (c: AutoChallenge): [string, string] => CH_T[lang]?.[c.id] ?? [c.name, c.desc];
  const uT = (u: string) => UNIT_T[lang]?.[u] ?? u;
  const [tab, setTab] = useState<"league" | "badges" | "challenges">("league");
  const [badgeFilter, setBadgeFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [joiningChallenge, setJoiningChallenge] = useState<string | null>(null);

  // League data
  const leagues = (myMembership as Record<string, unknown> | null)?.leagues as Record<string, unknown> | null;
  const myScore = Number((myMembership as Record<string, unknown> | null)?.score ?? 0);
  const myRank = Number((myMembership as Record<string, unknown> | null)?.rank ?? 0);
  const currentTierKey = String(leagues?.tier ?? profile?.league ?? "bronze");
  const tier = TIER_CONFIG[currentTierKey] ?? TIER_CONFIG.bronze;
  const tierKey = TIER_CONFIG[currentTierKey] ? currentTierKey : "bronze";
  const fmtPace = (p: number) => p > 0 ? `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}` : "—";

  // Leaderboard: sort by score desc
  const members = (leagueMembers as unknown as LeagueMember[]).sort((a, b) => b.score - a.score);

  // Badges
  const unlocked = computedBadges.filter(b => b.unlocked);
  const filteredBadges = badgeFilter === "unlocked"
    ? computedBadges.filter(b => b.unlocked)
    : badgeFilter === "locked"
      ? computedBadges.filter(b => !b.unlocked)
      : computedBadges;

  async function joinChallenge(challengeId: string) {
    setJoiningChallenge(challengeId);
    const supabase = createClient();
    const { error } = await supabase.from("challenge_members").insert({
      challenge_id: challengeId,
      user_id: userId,
      km_contributed: 0,
    });
    setJoiningChallenge(null);
    if (error) {
      toast.error(error.code === "23505" ? d["t.alreadyIn"] : d["t.joinErr"]);
    } else {
      toast.success(d["t.joined"]);
    }
  }

  const myName = String(profile?.full_name ?? d["you"]);
  const myAvatar = String(profile?.avatar_url ?? "");

  return (
    <div className="space-y-4 pb-10">

      {/* ── Stats banner ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            { label: d["s.kmYear"], value: stats.totalKm.toLocaleString(lang), unit: "km", icon: <BarChart2 className="h-4 w-4" />, grad: "from-emerald-50 to-green-50 border-emerald-100", ic: "bg-emerald-100 text-emerald-600", num: "text-emerald-700" },
            { label: d["s.streak"], value: stats.streak, unit: d["u.day"], icon: <Flame className="h-4 w-4" />, grad: "from-orange-50 to-amber-50 border-orange-100", ic: "bg-orange-100 text-orange-600", num: "text-orange-700" },
            { label: d["s.sessions"], value: stats.sessions, unit: "", icon: <Target className="h-4 w-4" />, grad: "from-violet-50 to-fuchsia-50 border-violet-100", ic: "bg-violet-100 text-violet-600", num: "text-violet-700" },
            { label: d["s.elev"], value: stats.elevation.toLocaleString(lang), unit: "m", icon: <Mountain className="h-4 w-4" />, grad: "from-sky-50 to-blue-50 border-sky-100", ic: "bg-sky-100 text-sky-600", num: "text-sky-700" },
          ] as { label: string; value: number | string; unit: string; icon: React.ReactNode; grad: string; ic: string; num: string }[]
        ).map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }}
            className={`rounded-2xl border bg-gradient-to-br p-4 transition-transform hover:-translate-y-0.5 ${s.grad}`}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.ic}`}>{s.icon}</span>
              <span className="text-xs font-medium text-zinc-500">{s.label}</span>
            </div>
            <div className={`text-2xl font-black tabular-nums ${s.num}`}>{s.value}<span className="ml-1 text-sm font-normal text-zinc-400">{s.unit}</span></div>
          </motion.div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex w-fit gap-1 rounded-2xl bg-zinc-100/80 p-1 ring-1 ring-zinc-200/60">
        {[
          { v: "league", l: d["tab.league"] },
          { v: "badges", l: `${d["tab.badges"]} (${unlocked.length}/${computedBadges.length})` },
          { v: "challenges", l: d["tab.challenges"] },
        ].map(t => {
          const active = tab === t.v;
          return (
            <button key={t.v} onClick={() => setTab(t.v as typeof tab)}
              className={`relative whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}>
              {active && <motion.span layoutId="leagues-tab-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl bg-white shadow-sm" />}
              <span className="relative">{t.l}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════ LEAGUE TAB ══════════ */}
        {tab === "league" && (
          <motion.div key="league" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="grid grid-cols-12 gap-4">

            {/* My league card */}
            <div className="col-span-12 md:col-span-4 bento-card flex flex-col">
              {/* Tier badge — halo coloré + léger flottement */}
              <div className="relative mb-4 self-center">
                <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${tier.gradient} opacity-50 blur-xl`} />
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className={`relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br ${tier.gradient} text-5xl shadow-lg ring-4 ring-white`}>
                  {tier.emoji}
                </motion.div>
              </div>
              <div className="text-center mb-5">
                <div className={`text-2xl font-black ${tier.textColor}`}>{d[`tier.${tierKey}`]}</div>
                {leagues ? (
                  <>
                    <div className="text-sm text-zinc-600 font-medium mt-0.5">{String(leagues.name ?? "")}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {new Date(String(leagues.week_start)).toLocaleDateString(lang, { day: "numeric", month: "short" })} →{" "}
                      {new Date(String(leagues.week_end)).toLocaleDateString(lang, { day: "numeric", month: "short" })}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-400 mt-1">{d["noLeague"]}</div>
                )}
              </div>

              <div className="space-y-2 text-sm flex-1">
                {([
                  { label: d["myRank"], value: myRank > 0 ? fillT(d["rankVal"], { n: myRank, m: members.length }) : "—" },
                  { label: d["weekScore"], value: myScore > 0 ? `${myScore.toFixed(0)} pts` : "—" },
                  { label: d["badgesUnlocked"], value: `${unlocked.length}/${computedBadges.length}` },
                  { label: d["nextTier"], value: tier.next ? fillT(d["tierLeague"], { t: d[`tier.${tier.next}`] }) : d["maxTier"] },
                ] as { label: string; value: string }[]).map(s => (
                  <div key={s.label} className="flex justify-between py-2 border-b border-zinc-50 last:border-0">
                    <span className="text-zinc-500">{s.label}</span>
                    <span className="font-semibold text-zinc-900">{s.value}</span>
                  </div>
                ))}
              </div>

              {Array.isArray(leagues?.rewards) && (leagues.rewards as string[]).length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-2xl text-xs text-yellow-800">
                  {d["reward"]} {(leagues.rewards as string[]).join(", ")}
                </div>
              )}
            </div>

            {/* Leaderboard */}
            <div className="col-span-12 md:col-span-8 bento-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-900">{d["lb.title"]}</h3>
                <span className="text-xs text-zinc-400">{members.length} {members.length > 1 ? d["participants"] : d["participant"]}</span>
              </div>

              {members.length === 0 ? (
                <div className="text-center py-16 text-zinc-400">
                  <Trophy className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
                  <p className="text-sm">{d["lb.empty1"]}</p>
                  <p className="text-xs mt-1 text-zinc-300">{d["lb.empty2"]}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {members.slice(0, 10).map((m, i) => {
                    const isMe = m.user_id === userId;
                    const displayName = isMe ? myName : String(m.profiles?.full_name ?? d["runner"]);
                    const avatarUrl = isMe ? myAvatar : String(m.profiles?.avatar_url ?? "");
                    const maxScore = members[0]?.score ?? 1;
                    return (
                      <motion.div key={m.user_id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                        className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                          isMe ? "bg-green-50 border border-green-200 ring-1 ring-green-200" : i === 0 ? "bg-yellow-50" : "hover:bg-zinc-50"
                        }`}
                      >
                        {/* Rank */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          i === 0 ? "bg-yellow-100 text-yellow-700" :
                          i === 1 ? "bg-slate-100 text-slate-600" :
                          i === 2 ? "bg-orange-100 text-orange-600" :
                          "bg-zinc-100 text-zinc-500"
                        }`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </div>

                        <Avatar name={displayName} url={avatarUrl} size={8} />

                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold truncate ${isMe ? "text-green-700" : "text-zinc-900"}`}>
                            {displayName}{isMe && d["meSuffix"]}
                            {i === 0 && <Crown className="w-3.5 h-3.5 inline ml-1 text-yellow-500" />}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-20 h-1.5 bg-zinc-100 rounded-full hidden sm:block">
                            <motion.div className={`h-full rounded-full ${isMe ? "bg-green-500" : "bg-zinc-400"}`}
                              initial={{ width: 0 }} animate={{ width: `${(m.score / maxScore) * 100}%` }}
                              transition={{ duration: 0.8, delay: i * 0.04 }} />
                          </div>
                          <span className="text-sm font-bold text-zinc-900 w-10 text-right">{Number(m.score).toFixed(0)}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                  {members.length > 10 && (
                    <div className="text-center text-xs text-zinc-400 py-2">
                      {fillT(d["andOthers"], { n: members.length - 10 })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Échelle des ligues */}
            <div className="col-span-12 bento-card">
              <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> {d["ladder"]}</h3>
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {Object.entries(TIER_CONFIG).map(([key, t]) => {
                  const isCurrent = key === currentTierKey;
                  return (
                    <div key={key} className={`relative rounded-2xl border p-3 text-center transition-all ${isCurrent ? "border-transparent ring-2 ring-green-400 shadow-md bg-green-50/40" : "border-zinc-200 bg-white opacity-70"}`}>
                      <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${t.gradient} text-2xl shadow`}>{t.emoji}</div>
                      <div className={`text-xs sm:text-sm font-bold ${t.textColor}`}>{d[`tier.${key}`]}</div>
                      {isCurrent && <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">{d["youChip"]}</span>}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-zinc-400">{d["ladderHint1"]}<b className="text-zinc-600">{d["ladderTop"]}</b>{d["ladderHint2"]}</p>
            </div>

            {/* Records personnels */}
            <div className="col-span-12 bento-card">
              <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2"><Medal className="w-4 h-4 text-violet-500" /> {d["rec.title"]} <span className="text-xs font-normal text-zinc-400">{d["rec.year"]}</span></h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {([
                  { icon: <MapPin className="w-3.5 h-3.5" />, label: d["rec.longest"], value: records.longestRun.toLocaleString(lang), unit: "km", color: "text-emerald-600" },
                  { icon: <Zap className="w-3.5 h-3.5" />, label: d["rec.pace"], value: fmtPace(records.bestPace), unit: "/km", color: "text-blue-600" },
                  { icon: <Flame className="w-3.5 h-3.5" />, label: d["rec.streak"], value: records.longestStreak, unit: d["u.day"], color: "text-orange-600" },
                  { icon: <Mountain className="w-3.5 h-3.5" />, label: d["rec.elev"], value: records.maxElevRun.toLocaleString(lang), unit: "m", color: "text-sky-600" },
                  { icon: <TrendingUp className="w-3.5 h-3.5" />, label: d["rec.week"], value: records.biggestWeek.toLocaleString(lang), unit: "km", color: "text-green-600" },
                  { icon: <BarChart2 className="w-3.5 h-3.5" />, label: d["rec.month"], value: records.biggestMonth.toLocaleString(lang), unit: "km", color: "text-teal-600" },
                  { icon: <CalendarClock className="w-3.5 h-3.5" />, label: d["rec.hours"], value: records.totalHours.toLocaleString(lang), unit: "h", color: "text-amber-600" },
                  { icon: <Calendar className="w-3.5 h-3.5" />, label: d["rec.weeks"], value: records.weeksActive, unit: "/52", color: "text-violet-600" },
                ] as { icon: React.ReactNode; label: string; value: number | string; unit: string; color: string }[]).map((r) => (
                  <div key={r.label} className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3">
                    <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${r.color}`}>{r.icon}{r.label}</div>
                    <div className="text-xl font-black text-zinc-900 tabular-nums">{r.value}<span className="text-xs font-normal text-zinc-400 ml-1">{r.unit}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment grimper */}
            <div className="col-span-12 bento-card bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> {d["climb.title"]}</h3>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                {[
                  { icon: "🏃", t: d["climb.1t"], d: d["climb.1d"] },
                  { icon: "⛰️", t: d["climb.2t"], d: d["climb.2d"] },
                  { icon: "🎯", t: d["climb.3t"], d: d["climb.3d"] },
                ].map((x) => (
                  <div key={x.t} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-xl mb-1">{x.icon}</div>
                    <div className="font-semibold">{x.t}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{x.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════ BADGES TAB ══════════ */}
        {tab === "badges" && (
          <motion.div key="badges" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4">

            {/* Progress summary */}
            <div className="bento-card bg-gradient-to-br from-zinc-900 to-zinc-800 text-white flex items-center gap-6">
              <div className="text-center shrink-0">
                <div className="text-4xl font-black">{unlocked.length}</div>
                <div className="text-xs text-zinc-400 mt-0.5">/ {computedBadges.length}</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{d["prog.badges"]}</span>
                  <span className="text-sm text-zinc-400">{Math.round(unlocked.length / computedBadges.length * 100)}%</span>
                </div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${(unlocked.length / computedBadges.length) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }} />
                </div>
                <div className="flex gap-3 mt-3 text-xs text-zinc-400">
                  <span>⬜ {d["rar.common"]}: {computedBadges.filter(b => b.rarity === "common" && b.unlocked).length}/{computedBadges.filter(b => b.rarity === "common").length}</span>
                  <span>🔵 {d["rar.rare"]}: {computedBadges.filter(b => b.rarity === "rare" && b.unlocked).length}/{computedBadges.filter(b => b.rarity === "rare").length}</span>
                  <span>🟡 {d["rar.epic"]}: {computedBadges.filter(b => b.rarity === "epic" && b.unlocked).length}/{computedBadges.filter(b => b.rarity === "epic").length}</span>
                  <span>💜 {d["rar.legShort"]}: {computedBadges.filter(b => b.rarity === "legendary" && b.unlocked).length}/{computedBadges.filter(b => b.rarity === "legendary").length}</span>
                </div>
              </div>
            </div>

            {/* Filter */}
            <div className="flex gap-2">
              {(["all", "unlocked", "locked"] as const).map(f => (
                <button key={f} onClick={() => setBadgeFilter(f)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    badgeFilter === f ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  }`}>
                  {f === "all" ? d["f.all"] : f === "unlocked" ? fillT(d["f.unlocked"], { n: unlocked.length }) : fillT(d["f.locked"], { n: computedBadges.length - unlocked.length })}
                </button>
              ))}
            </div>

            {/* Badge grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredBadges.map((badge, i) => {
                const rc = RARITY_CONFIG[badge.rarity];
                return (
                  <motion.div key={badge.id}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                    className={`relative p-4 rounded-3xl border shadow-sm transition-all ${
                      badge.unlocked
                        ? `${rc.bg} ${rc.border} ${rc.glow}`
                        : "bg-zinc-50 border-zinc-100 grayscale opacity-50"
                    }`}
                  >
                    {badge.unlocked && (
                      <span className="absolute top-2 right-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </span>
                    )}
                    {!badge.unlocked && (
                      <span className="absolute top-2 right-2">
                        <Lock className="w-3.5 h-3.5 text-zinc-300" />
                      </span>
                    )}
                    <div className="text-4xl mb-2 text-center">{badge.icon}</div>
                    <div className="text-xs font-bold text-zinc-900 text-center leading-tight mb-1">{bT(badge)[0]}</div>
                    <div className={`text-xs text-center font-semibold mb-2 ${rc.text}`}>{d[`rar.${badge.rarity}`]}</div>
                    <div className="text-xs text-zinc-400 text-center leading-tight mb-2">{bT(badge)[1]}</div>
                    {/* Progress bar */}
                    {!badge.unlocked && badge.max > 1 && (
                      <div>
                        <div className="h-1 bg-zinc-200 rounded-full overflow-hidden">
                          <div className="h-full bg-zinc-400 rounded-full" style={{ width: `${(badge.progress / badge.max) * 100}%` }} />
                        </div>
                        <div className="text-center text-xs text-zinc-400 mt-1">{badge.progress}/{badge.max}</div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ══════════ CHALLENGES TAB ══════════ */}
        {tab === "challenges" && (
          <motion.div key="challenges" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-5">

            {/* Défis à suivi automatique — calculés sur tes vraies données */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-500" /> {d["ch.title"]} <span className="text-xs font-normal text-zinc-400">{d["ch.auto"]}</span>
                </h3>
                <span className="text-xs font-semibold text-green-600">{fillT(d["ch.done"], { a: autoChallenges.filter(c => c.current >= c.target).length, b: autoChallenges.length })}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {autoChallenges.map((c, i) => {
                  const pct = c.target > 0 ? Math.min((c.current / c.target) * 100, 100) : 0;
                  const done = c.current >= c.target;
                  return (
                    <motion.div key={c.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className={`rounded-3xl border p-4 transition-all ${done ? "border-green-200 bg-green-50/60" : "border-zinc-200 bg-white hover:border-zinc-300"}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${done ? "bg-green-100" : "bg-zinc-100"}`}>{c.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-900 text-sm truncate">{cT(c)[0]}</span>
                            {done && <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700"><CheckCircle className="w-3 h-3" /> {d["ch.doneChip"]}</span>}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">{cT(c)[1]}</p>
                        </div>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400 shrink-0"><CalendarClock className="w-3 h-3" />{fillT(d["dminus"], { n: c.daysLeft })}</span>
                      </div>
                      <div className="mt-3">
                        <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: i * 0.05 }}
                            className={`h-full rounded-full ${done ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-zinc-400 to-zinc-500"}`} />
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className={`font-semibold ${done ? "text-green-600" : "text-zinc-700"}`}>{c.current.toLocaleString(lang)} / {c.target.toLocaleString(lang)} {uT(c.unit)}</span>
                          <span className="text-zinc-400">{Math.round(pct)}%</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* My active challenges */}
            {myChallenges.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" /> {d["ch.mine"]}
                </h3>
                {myChallenges.map((mc) => {
                  const ch = mc.team_challenges as unknown as Challenge;
                  if (!ch) return null;
                  const pct = ch.total_km > 0 ? (Number(ch.current_km) / Number(ch.total_km)) * 100 : 0;
                  const myKm = Number(mc.km_contributed ?? 0);
                  const daysLeft = ch.end_date
                    ? Math.ceil((new Date(ch.end_date).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <div key={ch.id} className="bento-card border-l-4 border-l-green-400">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-zinc-900 flex items-center gap-2">
                            <Users className="w-4 h-4 text-green-500" /> {ch.name}
                          </div>
                          {ch.description && <div className="text-xs text-zinc-400 mt-0.5">{ch.description}</div>}
                        </div>
                        {daysLeft !== null && (
                          <span className={`text-xs px-2 py-1 rounded-xl font-semibold shrink-0 ${
                            daysLeft < 3 ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-600"
                          }`}>
                            {daysLeft > 0 ? fillT(d["dminus"], { n: daysLeft }) : d["ended"]}
                          </span>
                        )}
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-zinc-500 mb-1">
                          <span>{d["ch.coll"]}</span>
                          <span className="font-semibold text-zinc-900">{Number(ch.current_km).toFixed(1)} / {ch.total_km} km</span>
                        </div>
                        <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
                            transition={{ duration: 1 }}
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" />
                        </div>
                        <div className="text-right text-xs text-zinc-400 mt-1">{Math.round(pct)}%</div>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {d["ch.contrib"]} <span className="font-semibold text-green-600">{myKm.toFixed(1)} km</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Défis collectifs (équipes) — affichés s'il y en a */}
            {availableChallenges.length > 0 && (
              <div className="space-y-3">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-500" /> {d["ch.collTitle"]}
              </h3>

              {availableChallenges.map((c) => {
                  const ch = c as unknown as Challenge;
                  const alreadyIn = myChallenges.some(mc => {
                    const t = mc.team_challenges as unknown as Challenge;
                    return t?.id === ch.id;
                  });
                  const pct = ch.total_km > 0 ? (Number(ch.current_km) / Number(ch.total_km)) * 100 : 0;
                  const daysLeft = ch.end_date
                    ? Math.ceil((new Date(ch.end_date).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <div key={ch.id} className="bento-card hover:border-zinc-300 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-zinc-900 text-sm">{ch.name}</div>
                          {ch.description && <div className="text-xs text-zinc-400 mt-0.5">{ch.description}</div>}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ch.total_km} km</span>
                            {daysLeft !== null && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {daysLeft > 0 ? fillT(d["ch.daysLeft"], { n: daysLeft }) : d["ended"]}
                              </span>
                            )}
                          </div>
                        </div>
                        {alreadyIn ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-xl shrink-0">
                            <CheckCircle className="w-3.5 h-3.5" /> {d["ch.joined"]}
                          </span>
                        ) : (
                          <button
                            onClick={() => joinChallenge(ch.id)}
                            disabled={joiningChallenge === ch.id}
                            className="flex items-center gap-1 text-xs font-semibold bg-zinc-900 text-white px-3 py-1.5 rounded-xl hover:bg-zinc-700 transition-all disabled:opacity-50 shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {joiningChallenge === ch.id ? "…" : d["ch.join"]}
                          </button>
                        )}
                      </div>
                      {/* Progress */}
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-zinc-400 mt-1">
                        <span>{fillT(d["ch.kmDone"], { n: Number(ch.current_km).toFixed(1) })}</span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                    </div>
                  );
              })}
              </div>
            )}

            {/* Upcoming features teaser */}
            <div className="bento-card bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/10 rounded-xl"><Medal className="w-5 h-5 text-yellow-400" /></div>
                <div className="font-bold">{d["teaser.title"]}</div>
              </div>
              <p className="text-sm text-zinc-400 mb-4">
                {d["teaser.desc"]}
              </p>
              <button className="flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors">
                {d["teaser.soon"]} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
