export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

// POST /api/admin/advice  { user_id, week_start, coach_advice, publish }
// Saves Claude Pro expert advice and optionally publishes it to the athlete
export async function POST(req: Request) {
  const authHeader = req.headers.get("x-admin-secret");
  if (authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { user_id, week_start, coach_advice, publish } = await req.json() as {
    user_id: string;
    week_start: string;
    coach_advice: string;
    publish?: boolean;
  };

  const { data, error } = await supabase
    .from("ai_advice")
    .upsert({
      user_id,
      week_start,
      coach_advice,
      advice_author: "claude_pro",
      published: publish ?? false,
      published_at: publish ? new Date().toISOString() : null,
    }, { onConflict: "user_id,week_start" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Push in-app notification if publishing
  if (publish && data) {
    await supabase.from("notifications").insert({
      user_id,
      type: "coach_advice",
      title: "Nouveau conseil de votre coach",
      body: coach_advice.slice(0, 120) + (coach_advice.length > 120 ? "…" : ""),
      data: { advice_id: data.id, week_start },
    });
  }

  return NextResponse.json({ advice: data, published: publish ?? false });
}

// GET /api/admin/advice?user_id=xxx
export async function GET(req: Request) {
  const authHeader = req.headers.get("x-admin-secret");
  if (authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const url = new URL(req.url);
  const user_id = url.searchParams.get("user_id");

  const query = supabase
    .from("ai_advice")
    .select("*, profiles(full_name, email)")
    .order("week_start", { ascending: false })
    .limit(20);

  if (user_id) query.eq("user_id", user_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ advice: data });
}
