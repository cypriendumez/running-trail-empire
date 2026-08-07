export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { denyIfNotAdmin } from "@/lib/api/adminGuard";


const SEED_RACES = [
  {
    name: "UTMB Mont-Blanc", type: "ultra", region: "auvergne-rhone-alpes",
    department: "Haute-Savoie", city: "Chamonix",
    date: "2026-08-28", distance_km: 171, elevation_gain_m: 10000,
    difficulty: "black", terrain: ["single_track", "technical", "snow"],
    time_limits: [
      { checkpoint: "Départ", km: 0, time_limit_seconds: 0 },
      { checkpoint: "Les Contamines", km: 31, time_limit_seconds: 16200 },
      { checkpoint: "Courmayeur", km: 80, time_limit_seconds: 43200 },
      { checkpoint: "Champex-Lac", km: 124, time_limit_seconds: 68400 },
      { checkpoint: "Arrivée Chamonix", km: 171, time_limit_seconds: 108000 },
    ],
    registration_url: "https://utmb.world",
    organization: "UTMB Group",
    description: "La course de montagne mythique autour du Mont-Blanc. 171km, 10000m D+, passage par France, Italie et Suisse.",
    latitude: 45.9237, longitude: 6.8694,
    is_itra_certified: true, itra_points: 6,
    max_participants: 2300,
  },
  {
    name: "Marathon de Paris", type: "marathon", region: "ile-de-france",
    department: "Paris", city: "Paris",
    date: "2026-04-05", distance_km: 42.195, elevation_gain_m: 180,
    difficulty: "blue", terrain: ["asphalt"],
    time_limits: [{ checkpoint: "Arrivée", km: 42.195, time_limit_seconds: 21600 }],
    registration_url: "https://www.schneiderelectricparismarathon.com",
    organization: "ASO",
    description: "L'un des marathons majeurs mondiaux. Départ des Champs-Élysées, arrivée avenue Foch.",
    latitude: 48.8566, longitude: 2.3522,
    max_participants: 54000,
  },
  {
    name: "Diagonale des Fous (Grand Raid)", type: "ultra", region: "provence-alpes-cote-azur",
    department: "La Réunion", city: "Saint-Pierre",
    date: "2026-10-15", distance_km: 165, elevation_gain_m: 9978,
    difficulty: "black", terrain: ["volcanic", "single_track", "technical"],
    time_limits: [
      { checkpoint: "Hell-Bourg", km: 70, time_limit_seconds: 50400 },
      { checkpoint: "Arrivée Saint-Denis", km: 165, time_limit_seconds: 118800 },
    ],
    registration_url: "https://www.grandraid-reunion.com",
    organization: "Grand Raid Réunion",
    description: "La course la plus difficile au monde. 165km sur l'île de La Réunion avec ses volcans et ses cirques.",
    latitude: -21.3419, longitude: 55.4781,
    is_itra_certified: true, itra_points: 6,
  },
  {
    name: "Trail des Glières", type: "trail_m", region: "auvergne-rhone-alpes",
    department: "Haute-Savoie", city: "Thorens-Glières",
    date: "2026-06-14", distance_km: 43, elevation_gain_m: 2800,
    difficulty: "red", terrain: ["single_track", "alpine", "pasture"],
    time_limits: [{ checkpoint: "Arrivée", km: 43, time_limit_seconds: 25200 }],
    registration_url: "https://www.traildesGlieres.com",
    organization: "Hardrock Club",
    description: "Un trail emblématique des Alpes avec plateau des Glières et vues panoramiques.",
    latitude: 45.9977, longitude: 6.2667,
    max_participants: 2500,
  },
  {
    name: "Semi-Marathon de Lyon", type: "semi", region: "auvergne-rhone-alpes",
    department: "Rhône", city: "Lyon",
    date: "2026-03-01", distance_km: 21.097, elevation_gain_m: 80,
    difficulty: "green", terrain: ["asphalt"],
    time_limits: [{ checkpoint: "Arrivée", km: 21.097, time_limit_seconds: 10800 }],
    registration_url: "https://semi-marathon-lyon.fr",
    organization: "Running Conseil Lyon",
    description: "Semi-marathon dans la capitale des Gaules, traversant les quais et la presqu'île.",
    latitude: 45.7640, longitude: 4.8357,
    max_participants: 8000,
  },
  {
    name: "Maxi Race Lac d'Annecy", type: "trail_xl", region: "auvergne-rhone-alpes",
    department: "Haute-Savoie", city: "Annecy",
    date: "2026-05-23", distance_km: 115, elevation_gain_m: 6500,
    difficulty: "black", terrain: ["single_track", "technical", "alpine"],
    time_limits: [
      { checkpoint: "Faverges", km: 45, time_limit_seconds: 28800 },
      { checkpoint: "Arrivée Annecy", km: 115, time_limit_seconds: 72000 },
    ],
    registration_url: "https://maxirace.fr",
    organization: "Maxi Race",
    description: "Tour du lac d'Annecy en version ultra. Vues spectaculaires sur les Alpes et le lac.",
    latitude: 45.8992, longitude: 6.1294,
    is_itra_certified: true, itra_points: 4,
    max_participants: 1800,
  },
  {
    name: "10km de Paris", type: "road_10k", region: "ile-de-france",
    department: "Paris", city: "Paris",
    date: "2026-03-22", distance_km: 10, elevation_gain_m: 50,
    difficulty: "green", terrain: ["asphalt"],
    time_limits: [{ checkpoint: "Arrivée", km: 10, time_limit_seconds: 7200 }],
    registration_url: "https://10kmdeparis.fr",
    organization: "ASO",
    description: "La course 10km la plus populaire de France, sur les Champs-Élysées.",
    latitude: 48.8698, longitude: 2.3080,
    max_participants: 25000,
  },
  {
    name: "EcoTrail Paris", type: "trail_l", region: "ile-de-france",
    department: "Yvelines", city: "Versailles",
    date: "2026-03-14", distance_km: 80, elevation_gain_m: 1100,
    difficulty: "blue", terrain: ["forest", "gravel", "urban"],
    time_limits: [{ checkpoint: "Arrivée Tour Eiffel", km: 80, time_limit_seconds: 50400 }],
    registration_url: "https://ecotrailparis.com",
    organization: "EcoTrail Paris",
    description: "80km depuis Versailles jusqu'à la Tour Eiffel. Trail urbain unique au monde.",
    latitude: 48.8584, longitude: 2.2945,
    max_participants: 6000,
  },
];

export async function GET(req: Request) {
  // Route de MAINTENANCE : elle écrit avec la clé service_role.
  const denied = await denyIfNotAdmin(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  // Check what's already in DB to avoid duplicates
  const { data: existing } = await createAdminClient().from("races").select("name,date");
  const existingKeys = new Set((existing || []).map(r => `${r.name}::${r.date}`));

  const toInsert = SEED_RACES
    .filter(r => !existingKeys.has(`${r.name}::${r.date}`))
    .map(r => ({
      ...r,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

  if (toInsert.length === 0) {
    const { count } = await createAdminClient().from("races").select("*", { count: "exact", head: true });
    return NextResponse.json({ seeded: 0, total: count, message: "Races already seeded" });
  }

  const { error } = await createAdminClient().from("races").insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await createAdminClient().from("races").select("*", { count: "exact", head: true });
  return NextResponse.json({ seeded: toInsert.length, total: count, message: "Races seeded successfully" });
}
