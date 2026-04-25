export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";
import { RacesHub } from "@/components/races/RacesHub";

export const metadata = { title: "Courses France" };

export default async function RacesPage() {
  const supabaseAdmin = createAdminClient();
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
