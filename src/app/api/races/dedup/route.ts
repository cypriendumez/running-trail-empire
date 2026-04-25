export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fetch ALL races paginated (bypasses 1000-row cap)
async function fetchAllRaces() {
  const all: { id: string; name: string; date: string; latitude: number | null }[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("races")
      .select("id,name,date,latitude")
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function POST() {
  const all = await fetchAllRaces();
  const total = all.length;

  // Group by name::date key
  const groups = new Map<string, typeof all>();
  for (const r of all) {
    const key = `${r.name.toLowerCase().trim()}::${r.date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  // Collect IDs to delete: for each group >1, keep the best one (has GPS, or first)
  const toDelete: string[] = [];
  for (const [, group] of groups) {
    if (group.length <= 1) continue;
    // Prefer row with GPS coords, then just the first
    const best = group.find(r => r.latitude != null) ?? group[0];
    for (const r of group) {
      if (r.id !== best.id) toDelete.push(r.id);
    }
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ message: "Pas de doublons trouvés", total, deleted: 0 });
  }

  // Delete in batches of 100
  let deleted = 0;
  const BATCH = 100;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    const { error } = await supabaseAdmin.from("races").delete().in("id", batch);
    if (!error) deleted += batch.length;
  }

  const { count } = await supabaseAdmin
    .from("races")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({
    message: `${deleted} doublons supprimés`,
    before: total,
    deleted,
    after: count,
    unique_keys: groups.size,
  });
}

export async function GET() {
  const all = await fetchAllRaces();
  const groups = new Map<string, number>();
  for (const r of all) {
    const key = `${r.name.toLowerCase().trim()}::${r.date}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const dupes = [...groups.values()].filter(v => v > 1);
  return NextResponse.json({
    total_rows: all.length,
    unique_keys: groups.size,
    duplicate_keys: dupes.length,
    extra_rows: dupes.reduce((s, v) => s + v - 1, 0),
  });
}

// PATCH: update a specific race (admin only)
export async function PATCH(req: Request) {
  const { id, date, name } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (date) updates.date = date;
  if (name) updates.name = name;
  const { error } = await supabaseAdmin.from("races").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: { id, ...updates } });
}
