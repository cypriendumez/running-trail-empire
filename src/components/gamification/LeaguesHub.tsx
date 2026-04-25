"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Trophy, Zap, Users, Star, TrendingUp, TrendingDown, Minus,
  Lock, CheckCircle, Flame, Medal, Plus, ChevronRight,
  MapPin, Calendar, BarChart2, Target, Crown,
} from "lucide-react";

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

// ── Config ─────────────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { label: string; gradient: string; emoji: string; textColor: string; next?: string }> = {
  bronze:   { label: "Bronze",  gradient: "from-orange-400 to-amber-600",   emoji: "🥉", textColor: "text-amber-700",  next: "Argent" },
  silver:   { label: "Argent",  gradient: "from-slate-300 to-slate-500",    emoji: "🥈", textColor: "text-slate-600",  next: "Or" },
  gold:     { label: "Or",      gradient: "from-yellow-400 to-amber-500",   emoji: "🥇", textColor: "text-yellow-700", next: "Platine" },
  platinum: { label: "Platine", gradient: "from-cyan-400 to-sky-600",       emoji: "🔷", textColor: "text-cyan-700",   next: "Diamant" },
  diamond:  { label: "Diamant", gradient: "from-violet-400 to-purple-600",  emoji: "💎", textColor: "text-violet-700", next: undefined },
};

const RARITY_CONFIG = {
  common:    { label: "Commun",    bg: "bg-zinc-50",     border: "border-zinc-200",   text: "text-zinc-500",    glow: "" },
  rare:      { label: "Rare",      bg: "bg-blue-50",     border: "border-blue-200",   text: "text-blue-600",    glow: "shadow-blue-100" },
  epic:      { label: "Épique",    bg: "bg-amber-50",    border: "border-amber-200",  text: "text-amber-600",   glow: "shadow-amber-100" },
  legendary: { label: "Légendaire",bg: "bg-violet-50",   border: "border-violet-200", text: "text-violet-600",  glow: "shadow-violet-100" },
};

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
  myChallenges, availableChallenges, stats,
}: {
  userId: string;
  profile: Record<string, unknown>;
  myMembership: Record<string, unknown> | null;
  leagueMembers: Record<string, unknown>[];
  computedBadges: ComputedBadge[];
  myChallenges: Record<string, unknown>[];
  availableChallenges: Record<string, unknown>[];
  stats: { totalKm: number; streak: number; sessions: number };
}) {
  const [tab, setTab] = useState<"league" | "badges" | "challenges">("league");
  const [badgeFilter, setBadgeFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [joiningChallenge, setJoiningChallenge] = useState<string | null>(null);

  // League data
  const leagues = (myMembership as Record<string, unknown> | null)?.leagues as Record<string, unknown> | null;
  const myScore = Number((myMembership as Record<string, unknown> | null)?.score ?? 0);
  const myRank = Number((myMembership as Record<string, unknown> | null)?.rank ?? 0);
  const tier = TIER_CONFIG[String(leagues?.tier ?? profile?.league ?? "bronze")] ?? TIER_CONFIG.bronze;

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
      toast.error(error.code === "23505" ? "Vous participez déjà à ce défi" : "Erreur lors de l'inscription");
    } else {
      toast.success("Vous avez rejoint le défi !");
    }
  }

  const myName = String(profile?.full_name ?? "Vous");
  const myAvatar = String(profile?.avatar_url ?? "");

  return (
    <div className="space-y-4 pb-10">

      {/* ── Stats banner ── */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { label: "Km cette année", value: stats.totalKm, unit: "km", icon: <BarChart2 className="w-3.5 h-3.5" />, color: "bg-green-50 text-green-700" },
            { label: "Série actuelle", value: stats.streak, unit: "j", icon: <Flame className="w-3.5 h-3.5" />, color: "bg-orange-50 text-orange-700" },
            { label: "Sessions", value: stats.sessions, unit: "", icon: <Target className="w-3.5 h-3.5" />, color: "bg-violet-50 text-violet-700" },
          ] as { label: string; value: number; unit: string; icon: React.ReactNode; color: string }[]
        ).map(s => (
          <div key={s.label} className={`rounded-2xl p-3 ${s.color.split(" ")[0]}`}>
            <div className={`flex items-center gap-1 text-xs font-medium mb-1 ${s.color.split(" ")[1]}`}>{s.icon}{s.label}</div>
            <div className="text-2xl font-black text-zinc-900">{s.value}<span className="text-sm font-normal text-zinc-400 ml-1">{s.unit}</span></div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl w-fit">
        {[
          { v: "league", l: "🏆 Ligue" },
          { v: "badges", l: `🎖️ Badges (${unlocked.length}/${computedBadges.length})` },
          { v: "challenges", l: "👥 Défis" },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v as typeof tab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}>
            {t.l}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════ LEAGUE TAB ══════════ */}
        {tab === "league" && (
          <motion.div key="league" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="grid grid-cols-12 gap-4">

            {/* My league card */}
            <div className="col-span-12 md:col-span-4 bento-card flex flex-col">
              {/* Tier badge */}
              <div className={`self-center w-24 h-24 rounded-3xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center text-5xl shadow-lg mb-4`}>
                {tier.emoji}
              </div>
              <div className="text-center mb-5">
                <div className={`text-2xl font-black ${tier.textColor}`}>{tier.label}</div>
                {leagues ? (
                  <>
                    <div className="text-sm text-zinc-600 font-medium mt-0.5">{String(leagues.name ?? "")}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {new Date(String(leagues.week_start)).toLocaleDateString("fr", { day: "numeric", month: "short" })} →{" "}
                      {new Date(String(leagues.week_end)).toLocaleDateString("fr", { day: "numeric", month: "short" })}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-400 mt-1">Aucune ligue active</div>
                )}
              </div>

              <div className="space-y-2 text-sm flex-1">
                {([
                  { label: "Votre classement", value: myRank > 0 ? `${myRank}e / ${members.length}` : "—" },
                  { label: "Score de la semaine", value: myScore > 0 ? `${myScore.toFixed(0)} pts` : "—" },
                  { label: "Badges débloqués", value: `${unlocked.length}/${computedBadges.length}` },
                  { label: "Prochain palier", value: tier.next ? `Ligue ${tier.next}` : "🏆 Niveau max !" },
                ] as { label: string; value: string }[]).map(s => (
                  <div key={s.label} className="flex justify-between py-2 border-b border-zinc-50 last:border-0">
                    <span className="text-zinc-500">{s.label}</span>
                    <span className="font-semibold text-zinc-900">{s.value}</span>
                  </div>
                ))}
              </div>

              {Array.isArray(leagues?.rewards) && (leagues.rewards as string[]).length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-2xl text-xs text-yellow-800">
                  🎁 Récompense Top 3 : {(leagues.rewards as string[]).join(", ")}
                </div>
              )}
            </div>

            {/* Leaderboard */}
            <div className="col-span-12 md:col-span-8 bento-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-900">Classement de la semaine</h3>
                <span className="text-xs text-zinc-400">{members.length} participant{members.length > 1 ? "s" : ""}</span>
              </div>

              {members.length === 0 ? (
                <div className="text-center py-16 text-zinc-400">
                  <Trophy className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
                  <p className="text-sm">Vous n&apos;êtes dans aucune ligue cette semaine</p>
                  <p className="text-xs mt-1 text-zinc-300">Le classement se génère automatiquement le lundi</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {members.slice(0, 10).map((m, i) => {
                    const isMe = m.user_id === userId;
                    const displayName = isMe ? myName : String(m.profiles?.full_name ?? "Coureur");
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
                            {displayName}{isMe && " (Vous)"}
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
                      … et {members.length - 10} autres participants
                    </div>
                  )}
                </div>
              )}
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
                  <span className="text-sm font-semibold">Progression badges</span>
                  <span className="text-sm text-zinc-400">{Math.round(unlocked.length / computedBadges.length * 100)}%</span>
                </div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${(unlocked.length / computedBadges.length) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }} />
                </div>
                <div className="flex gap-3 mt-3 text-xs text-zinc-400">
                  <span>⬜ Commun: {computedBadges.filter(b => b.rarity === "common" && b.unlocked).length}/{computedBadges.filter(b => b.rarity === "common").length}</span>
                  <span>🔵 Rare: {computedBadges.filter(b => b.rarity === "rare" && b.unlocked).length}/{computedBadges.filter(b => b.rarity === "rare").length}</span>
                  <span>🟡 Épique: {computedBadges.filter(b => b.rarity === "epic" && b.unlocked).length}/{computedBadges.filter(b => b.rarity === "epic").length}</span>
                  <span>💜 Légend.: {computedBadges.filter(b => b.rarity === "legendary" && b.unlocked).length}/{computedBadges.filter(b => b.rarity === "legendary").length}</span>
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
                  {f === "all" ? "Tous" : f === "unlocked" ? `✓ Débloqués (${unlocked.length})` : `🔒 À débloquer (${computedBadges.length - unlocked.length})`}
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
                    <div className="text-xs font-bold text-zinc-900 text-center leading-tight mb-1">{badge.name}</div>
                    <div className={`text-xs text-center font-semibold mb-2 ${rc.text}`}>{rc.label}</div>
                    <div className="text-xs text-zinc-400 text-center leading-tight mb-2">{badge.description}</div>
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
            className="space-y-4">

            {/* My active challenges */}
            {myChallenges.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" /> Mes défis en cours
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
                            {daysLeft > 0 ? `J-${daysLeft}` : "Terminé"}
                          </span>
                        )}
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-zinc-500 mb-1">
                          <span>Progression collective</span>
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
                        Votre contribution : <span className="font-semibold text-green-600">{myKm.toFixed(1)} km</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Available challenges */}
            <div className="space-y-3">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-zinc-500" /> Défis disponibles
              </h3>

              {availableChallenges.length === 0 ? (
                <div className="bento-card text-center py-12">
                  <Trophy className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                  <p className="text-zinc-400 text-sm">Aucun défi disponible pour le moment</p>
                  <p className="text-zinc-300 text-xs mt-1">De nouveaux défis collectifs arrivent chaque semaine</p>
                </div>
              ) : (
                availableChallenges.map((c) => {
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
                                {daysLeft > 0 ? `${daysLeft} jours restants` : "Terminé"}
                              </span>
                            )}
                          </div>
                        </div>
                        {alreadyIn ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-xl shrink-0">
                            <CheckCircle className="w-3.5 h-3.5" /> Inscrit
                          </span>
                        ) : (
                          <button
                            onClick={() => joinChallenge(ch.id)}
                            disabled={joiningChallenge === ch.id}
                            className="flex items-center gap-1 text-xs font-semibold bg-zinc-900 text-white px-3 py-1.5 rounded-xl hover:bg-zinc-700 transition-all disabled:opacity-50 shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {joiningChallenge === ch.id ? "…" : "Rejoindre"}
                          </button>
                        )}
                      </div>
                      {/* Progress */}
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-zinc-400 mt-1">
                        <span>{Number(ch.current_km).toFixed(1)} km parcourus</span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Upcoming features teaser */}
            <div className="bento-card bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/10 rounded-xl"><Medal className="w-5 h-5 text-yellow-400" /></div>
                <div className="font-bold">Créer votre propre défi</div>
              </div>
              <p className="text-sm text-zinc-400 mb-4">
                Invitez vos amis à courir ensemble un itinéraire mythique — TMB, GR20, Route des Grandes Alpes…
              </p>
              <button className="flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors">
                Bientôt disponible <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
