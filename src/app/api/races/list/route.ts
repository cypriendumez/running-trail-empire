import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Catalogue PUBLIC des courses à venir — colonnes LÉGÈRES (liste + marqueurs carte).
// Les champs lourds (description, time_limits, terrain…) sont chargés au clic via
// /api/races/detail. Service role pour dépasser la limite PostgREST de 1000 lignes.
const RACE_COLS =
  "id,name,type,region,department,city,date,distance_km,elevation_gain_m,difficulty,latitude,longitude,is_itra_certified,itra_points";

export async function GET() {
  const supabaseAdmin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const allRaces: unknown[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("races")
      .select(RACE_COLS)
      .gte("date", today)
      .order("date", { ascending: true })
      // ⚠️ UN `range()` SANS ORDRE TOTAL SAUTE DES LIGNES. Constaté pour de vrai sur la
      // maintenance des courses : 2 956 lignes à traiter, 2 291 vues, 665 OUBLIÉES.
      // Sans `order`, Postgres ne garantit rien d'une page à l'autre ; et un tri sur une
      // colonne non unique (la date, partagée par des milliers de courses) ne suffit pas
      // non plus — il faut un départage stable, d'où l'`id`.
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;
    allRaces.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (allRaces.length >= 25000) break;
  }

  return NextResponse.json(
    { races: allRaces },
    {
      headers: {
        // Caché au bord du CDN Vercel : la 1re requête remplit le cache, les suivantes
        // sont servies instantanément (compressé), sans DB ni sérialisation par requête.
        // s-maxage=30 min, sert l'ancienne version pendant la revalidation jusqu'à 24 h.
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
      },
    },
  );
}
