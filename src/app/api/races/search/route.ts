export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jourFrance } from "@/lib/races/jourFrance";
import { correspond, motifSansAccents, sansAccents } from "@/lib/races/temps";

// Connecteurs ignorés pour que « marathon pari » trouve « Marathon de Paris ».
const STOP = new Set(["de", "du", "des", "la", "le", "les", "et", "au", "aux", "sur", "en"]);

// GET /api/races/search?q=... → suggestions de courses (catalogue) pour l'autocomplétion.
export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (raw.length < 2) return NextResponse.json({ races: [] });

  // On découpe en mots : chaque mot doit apparaître dans le nom (ilike chaînés = ET), peu importe l'ordre.
  // « 10 km bondues » : la distance tapée est un FILTRE, pas un mot du nom.
  const kmTape = sansAccents(raw).match(/(\d+(?:[.,]\d+)?)\s*(?:km|k)\b/)?.[1];
  const distanceVoulue = kmTape ? Number(kmTape.replace(",", ".")) : null;
  const words = sansAccents(raw).replace(/(\d+(?:[.,]\d+)?)\s*(?:km|k)\b/g, " ")
    .split(/[\s'’\-]+/)
    .map((w) => w.replace(/[%_]/g, ""))
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .slice(0, 5);
  if (words.length === 0 && distanceVoulue == null) words.push(raw.replace(/[%_]/g, ""));

  const sb = createAdminClient();
  // ⚠️ LE JOUR EN FRANCE, PAS EN UTC NI CELUI DU SERVEUR. Constaté le 02/09/2026 à
  //    00 h 49 heure de Paris : il était encore le 1er septembre en UTC, et le catalogue
  //    proposait des courses déjà courues. Le serveur, lui, tourne à Washington — s'y
  //    fier reculerait de six heures de plus. Voir `lib/races/jourFrance`.
  const today = jourFrance();
  // ⚠️ REFAIT LE 29/09/2026. `ilike` est sensible aux accents (« foulees » ne trouvait
  // pas « Foulées »), seul le NOM était cherché (pas la ville), et les ~5 000 courses en
  // « Date à venir » étaient exclues. Désormais : un filet large en base (voyelles en
  // jokers, nom OU ville, courses sans date comprises — triées en dernier), puis le tri
  // exact en mémoire avec la même règle que la liste des courses (`correspond`).
  let query = sb.from("races").select("name, city, distance_km, date, type").gte("date", today);
  for (const w of words) { const m = motifSansAccents(w); query = query.or(`name.ilike.*${m}*,city.ilike.*${m}*`); }
  const { data } = await query.order("date", { ascending: true }).limit(80);

  const vus = new Set<string>();
  const races = (data ?? [])
    .filter((r) => words.every((w) => correspond(`${r.name} ${r.city ?? ""}`, w)))
    .filter((r) => distanceVoulue == null || Math.abs(Number(r.distance_km) - distanceVoulue) <= Math.max(0.6, distanceVoulue * 0.03))
    // Une suggestion par ÉVÉNEMENT : « Nîmes Urban Trail » ×3 (un par format) gâchait la liste.
    .filter((r) => { const k = sansAccents(`${r.name}|${r.city}|${r.date}`); if (vus.has(k)) return false; vus.add(k); return true; })
    .slice(0, 8).map((r) => ({
    name: r.name as string,
    city: (r.city as string) || "",
    distanceKm: (r.distance_km as number) ?? null,
    date: r.date as string,
    type: (r.type as string) || "",
  }));
  return NextResponse.json({ races });
}
