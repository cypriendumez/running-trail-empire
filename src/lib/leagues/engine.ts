// ─────────────────────────────────────────────────────────────────────────────
//  Moteur de ligues — génération hebdo + score + classement.
//  Score de la semaine = distance + dénivelé + régularité + bonus sortie longue,
//  calculé sur les séances de la semaine ISO en cours (lundi → dimanche).
//  Idempotent : peut tourner à chaque synchro (upsert par (league_id, user_id)).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

const TIER_NAMES: Record<string, string> = {
  bronze: "Ligue Bronze", silver: "Ligue Argent", gold: "Ligue Or", platinum: "Ligue Platine", diamond: "Ligue Diamant",
};

// Lundi (début) et dimanche (fin) de la semaine ISO courante → YYYY-MM-DD.
export function weekBounds(now = new Date()): { weekStart: string; weekEnd: string } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayMon0 = (d.getUTCDay() + 6) % 7; // 0 = lundi … 6 = dimanche
  const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - dayMon0);
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { weekStart: iso(monday), weekEnd: iso(sunday) };
}

// Score hebdo. numeric(5,2) en base → plafonné < 1000.
export function weeklyScore(m: { km: number; elevM: number; sessions: number; longestKm: number }): number {
  const raw = m.km * 1 + m.elevM / 100 + m.sessions * 5 + (m.longestKm >= 20 ? 15 : m.longestKm >= 10 ? 7 : 0);
  return Math.min(999.99, Math.round(raw * 100) / 100);
}

export async function runLeagueUpdate(admin: SupabaseClient): Promise<{ ok: boolean; week: string; tiers: number; members: number; error?: string }> {
  const { weekStart, weekEnd } = weekBounds();

  // 1) Tous les athlètes + leur palier.
  const { data: profiles, error: pErr } = await admin.from("profiles").select("id, league");
  if (pErr) return { ok: false, week: weekStart, tiers: 0, members: 0, error: pErr.message };
  const users = (profiles ?? []) as { id: string; league: string | null }[];
  if (!users.length) return { ok: true, week: weekStart, tiers: 0, members: 0 };

  // 2) Séances de la semaine (tous les athlètes).
  const { data: wkRows } = await admin
    .from("workouts")
    .select("user_id, date, distance_km, elevation_gain_m")
    .in("user_id", users.map((u) => u.id))
    .gte("date", weekStart);
  const perUser: Record<string, { km: number; elevM: number; days: Set<string>; longestKm: number }> = {};
  for (const u of users) perUser[u.id] = { km: 0, elevM: 0, days: new Set(), longestKm: 0 };
  for (const w of (wkRows ?? []) as { user_id: string; date: string; distance_km: number | null; elevation_gain_m: number | null }[]) {
    const acc = perUser[w.user_id]; if (!acc) continue;
    const km = Number(w.distance_km ?? 0);
    acc.km += km; acc.elevM += Number(w.elevation_gain_m ?? 0);
    acc.days.add(String(w.date).slice(0, 10)); acc.longestKm = Math.max(acc.longestKm, km);
  }

  // 3) Une ligue par palier présent cette semaine (créée si absente).
  const tiers = [...new Set(users.map((u) => u.league || "bronze"))];
  const leagueIdByTier: Record<string, string> = {};
  for (const tier of tiers) {
    const { data: existing } = await admin.from("leagues").select("id").eq("tier", tier).eq("week_start", weekStart).limit(1).maybeSingle();
    if (existing?.id) { leagueIdByTier[tier] = existing.id as string; continue; }
    const { data: created } = await admin.from("leagues").insert({
      tier, name: TIER_NAMES[tier] ?? "Ligue", week_start: weekStart, week_end: weekEnd, rewards: ["Badge exclusif", "Montée de palier"],
    }).select("id").single();
    if (created?.id) leagueIdByTier[tier] = created.id as string;
  }

  // 4) Upsert des membres avec leur score.
  const rows: { league_id: string; user_id: string; score: number }[] = [];
  for (const u of users) {
    const lid = leagueIdByTier[u.league || "bronze"]; if (!lid) continue;
    const acc = perUser[u.id];
    rows.push({ league_id: lid, user_id: u.id, score: weeklyScore({ km: acc.km, elevM: acc.elevM, sessions: acc.days.size, longestKm: acc.longestKm }) });
  }
  if (rows.length) await admin.from("league_members").upsert(rows, { onConflict: "league_id,user_id" });

  // 5) Rangs par ligue (score décroissant).
  for (const lid of Object.values(leagueIdByTier)) {
    const inLeague = rows.filter((r) => r.league_id === lid).sort((a, b) => b.score - a.score);
    for (let i = 0; i < inLeague.length; i++) {
      await admin.from("league_members").update({ rank: i + 1 }).eq("league_id", lid).eq("user_id", inLeague[i].user_id);
    }
  }

  return { ok: true, week: weekStart, tiers: tiers.length, members: rows.length };
}
