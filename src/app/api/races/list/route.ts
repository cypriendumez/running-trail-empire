export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Use service role to bypass PostgREST 1000-row default limit (races are public data)

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  // Paginate to bypass Supabase PostgREST db-max-rows (default 1000)
  const allRaces: any[] = [];
  const PAGE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("races")
      .select("*")
      .gte("date", today)
      .order("date", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;
    allRaces.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (allRaces.length >= 15000) break; // safety cap
  }

  return NextResponse.json({ races: allRaces });
}
