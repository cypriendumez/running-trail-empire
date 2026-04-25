import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { RacesHub } from "@/components/races/RacesHub";

export const metadata = { title: "Courses France" };

// Service role bypasses PostgREST 1000-row cap for public race data
const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function RacesPage() {
  const today = new Date().toISOString().slice(0, 10);
  const allRaces: any[] = [];
  const PAGE = 1000;
  let from = 0;

  while (true) {
    const { data } = await supabaseAdmin
      .from("races")
      .select("*")
      .gte("date", today)
      .order("date", { ascending: true })
      .range(from, from + PAGE - 1);

    if (!data?.length) break;
    allRaces.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (allRaces.length >= 15000) break;
  }

  return <RacesHub races={allRaces} />;
}
