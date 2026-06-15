export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Connecteurs ignorés pour que « marathon pari » trouve « Marathon de Paris ».
const STOP = new Set(["de", "du", "des", "la", "le", "les", "et", "au", "aux", "sur", "en"]);

// GET /api/races/search?q=... → suggestions de courses (catalogue) pour l'autocomplétion.
export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (raw.length < 2) return NextResponse.json({ races: [] });

  // On découpe en mots : chaque mot doit apparaître dans le nom (ilike chaînés = ET), peu importe l'ordre.
  const words = raw.toLowerCase()
    .split(/[\s'’\-]+/)
    .map((w) => w.replace(/[%_]/g, ""))
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .slice(0, 5);
  if (words.length === 0) words.push(raw.replace(/[%_]/g, ""));

  const sb = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  // gte today : courses à venir. lt 2099 : on exclut les placeholders (date inconnue).
  let query = sb.from("races").select("name, city, distance_km, date, type").gte("date", today).lt("date", "2099-01-01");
  for (const w of words) query = query.ilike("name", `%${w}%`);
  const { data } = await query.order("date", { ascending: true }).limit(8);

  const races = (data ?? []).map((r) => ({
    name: r.name as string,
    city: (r.city as string) || "",
    distanceKm: (r.distance_km as number) ?? null,
    date: r.date as string,
    type: (r.type as string) || "",
  }));
  return NextResponse.json({ races });
}
