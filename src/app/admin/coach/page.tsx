export const dynamic = "force-dynamic";
import { isRun } from "@/lib/intervals/sport";
import { createAdminClient } from "@/lib/supabase/admin";
import { CoachPanel, type CoachClient } from "@/components/admin/CoachPanel";

export const metadata = { title: "Coach — mes clients" };

export default async function CoachPage() {
  const sb = createAdminClient();
  const [profilesRes, workoutsRes, sleepRes, hrvRes, unreadRes, objRes, msgRes] = await Promise.all([
    sb.from("profiles").select("id, full_name, email, league, discipline_score"),
    sb.from("workouts").select("user_id, title, type, sport, date, distance_km, tss").order("date", { ascending: false }).limit(3000),
    sb.from("sleep_data").select("user_id, sleep_score, body_battery_end, date").order("date", { ascending: false }).limit(1500),
    sb.from("hrv_data").select("user_id, hrv_ms, physiological_state, date").order("date", { ascending: false }).limit(1500),
    sb.from("notifications").select("id", { count: "exact", head: true }).eq("type", "client_message").eq("read", false),
    sb.from("notifications").select("user_id, data").eq("type", "race_objective"),
    sb.from("notifications").select("user_id").eq("type", "client_message").eq("read", false),
  ]);

  // Index pour le triage : objectif (date course), messages non lus.
  const objByUser: Record<string, string> = {};
  for (const r of (objRes.data ?? []) as { user_id: string; data: { raceDate?: string } }[]) if (r.data?.raceDate && !objByUser[r.user_id]) objByUser[r.user_id] = r.data.raceDate;
  const unreadByUser: Record<string, number> = {};
  for (const r of (msgRes.data ?? []) as { user_id: string }[]) unreadByUser[r.user_id] = (unreadByUser[r.user_id] ?? 0) + 1;

  type Row = { user_id: string; [k: string]: unknown };
  const firstByUser = <T extends Row>(rows: T[] | null): Record<string, T> => {
    const m: Record<string, T> = {};
    for (const r of rows ?? []) if (!m[r.user_id]) m[r.user_id] = r;
    return m;
  };
  const lastSleep = firstByUser(sleepRes.data as Row[] | null);
  const lastHrv = firstByUser(hrvRes.data as Row[] | null);
  const wkByUser: Record<string, { date: string; distance_km: number | null; title: string | null; type: string | null; tss: number | null }[]> = {};
  for (const w of (workoutsRes.data ?? []) as { user_id: string; date: string; distance_km: number | null; title: string | null; type: string | null; tss: number | null }[]) {
    (wkByUser[w.user_id] ??= []).push(w);
  }
  const weekAgo = Date.now() - 7 * 86400000;

  const now = Date.now();
  const clients: CoachClient[] = (profilesRes.data ?? []).map((p) => {
    const ws = wkByUser[p.id] ?? [];
    const last = ws[0];
    const sleepScore = (lastSleep[p.id]?.sleep_score as number) ?? null;
    const state = (lastHrv[p.id]?.physiological_state as string) ?? null;

    // ── Triage : drapeaux « à suivre aujourd'hui » ──
    const flags: { icon: string; label: string; sev: number }[] = [];
    const daysSince = last ? Math.floor((now - new Date(last.date).getTime()) / 86400000) : 99;
    if (last && daysSince > 6) flags.push({ icon: "⏸️", label: `Inactif ${daysSince} j`, sev: 2 });
    if (state === "recovery") flags.push({ icon: "🌙", label: "VFC basse", sev: 3 });
    if (sleepScore != null && sleepScore < 55) flags.push({ icon: "💤", label: "Sommeil bas", sev: 2 });
    const tss7 = ws.filter((w) => now - new Date(w.date).getTime() <= 7 * 86400000).reduce((s, w) => s + (w.tss ?? 0), 0);
    const tss28 = ws.filter((w) => now - new Date(w.date).getTime() <= 28 * 86400000).reduce((s, w) => s + (w.tss ?? 0), 0);
    if (tss28 > 0 && tss7 / (tss28 / 4) > 1.5) flags.push({ icon: "🔥", label: "Charge élevée", sev: 3 });
    const rd = objByUser[p.id];
    if (rd) { const j = Math.ceil((new Date(rd + "T00:00:00").getTime() - now) / 86400000); if (j >= 0 && j <= 14) flags.push({ icon: "🏁", label: `Course J-${j}`, sev: 2 }); }
    if (unreadByUser[p.id]) flags.push({ icon: "💬", label: "Message", sev: 1 });

    return {
      id: p.id,
      name: (p.full_name as string) || (p.email as string) || "Client",
      email: (p.email as string) ?? "",
      league: (p.league as string) ?? "bronze",
      score: Math.round((p.discipline_score as number) ?? 0),
      lastRun: last ? { title: last.title || last.type || "Séance", date: last.date, km: last.distance_km ?? 0 } : null,
      // Volume de COURSE, comme le coach : sinon la fiche client affiche un chiffre
      // que le plan d'entraînement contredit.
      weekKm: Math.round(ws.filter((w) => isRun((w as { sport?: string | null }).sport) && new Date(w.date).getTime() > weekAgo).reduce((s, w) => s + (w.distance_km ?? 0), 0) * 10) / 10,
      sleepScore,
      load14: Math.round(ws.filter((w) => new Date(w.date).getTime() > now - 14 * 86400000).reduce((s, w) => s + (w.tss ?? 0), 0)) || null,
      hrv: (lastHrv[p.id]?.hrv_ms as number) ?? null,
      state,
      flags,
      priority: flags.reduce((s, f) => s + f.sev, 0),
    };
  }).sort((a, b) => (b.lastRun ? new Date(b.lastRun.date).getTime() : 0) - (a.lastRun ? new Date(a.lastRun.date).getTime() : 0));

  return <CoachPanel clients={clients} unread={unreadRes.count ?? 0} />;
}
