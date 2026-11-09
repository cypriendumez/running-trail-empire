export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Les deux sources sont bornées à 20 s au total : la fonction doit vivre au-delà, sinon Vercel la
// coupe AVANT la réponse 503 et la journalisation (relecture du 09/11/2026).
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { denyIfAnonymous } from "@/lib/api/adminGuard";
import { geometrieParcours, refusDefinitif, causes } from "@/lib/parcours/geometrie";
import { journaliserEchecUneFois } from "@/lib/journal/echecServeur";

/**
 * GÉOMÉTRIE GPS RÉELLE D'UN PARCOURS, chargée à la demande depuis OpenStreetMap (ODbL).
 *
 * ⚠️ PLUS D'UNE MINUTE D'ATTENTE (Cyprien, 09/11/2026, capture : « Chargement du tracé… » depuis
 * une minute). On n'interrogeait QUE Overpass, un serveur après l'autre, 30 s chacun ; mesuré ce
 * jour-là : overpass-api.de répondait 502, kumi.systems et private.coffee ne répondaient plus
 * après 70 s. Et la mémoire du serveur se perdait à chaque redémarrage de la fonction.
 *  · DEUX SOURCES EN MÊME TEMPS : l'API officielle d'OpenStreetMap (`/full`, 0,3 s mesurée le
 *    même jour) et Overpass ; la première géométrie valable gagne, chacune bornée à DELAI_MS.
 *  · CACHE PERSISTANT (`unstable_cache`, 30 jours) : un tracé chargé une fois l'est pour tous,
 *    d'une instance à l'autre. La mémoire locale reste la première marche.
 */
const CACHE = new Map<string, [number, number][]>();

const geometrieEnCache = unstable_cache(geometrieParcours, ["parcours-geometrie-v1"], { revalidate: 60 * 60 * 24 * 30 });

export async function GET(req: NextRequest) {
  // Interroge Overpass, un service communautaire GRATUIT aux quotas stricts. Laisser la
  // route ouverte aux requêtes anonymes, c'est risquer de faire bannir l'adresse IP de
  // l'application pour tout le monde.
  const denied = await denyIfAnonymous();
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type") === "way" ? "way" : "relation";
  if (!id || !/^\d+$/.test(id)) return NextResponse.json({ error: "id invalide" }, { status: 400 });

  const key = `${type}/${id}`;
  // Le navigateur garde aussi le tracé : il ne change pour ainsi dire jamais.
  const garde = { "Cache-Control": "private, max-age=86400" };
  const cached = CACHE.get(key);
  if (cached) return NextResponse.json({ coordinates: cached, cached: true }, { headers: garde });

  try {
    const coords = await geometrieEnCache(type, id);
    if (CACHE.size > 2000) CACHE.clear();
    CACHE.set(key, coords);
    return NextResponse.json({ coordinates: coords }, { headers: garde });
  } catch (e) {
    // La relation n'existe plus sur OpenStreetMap : un refus DÉFINITIF, pas « réessaie plus tard ».
    if (refusDefinitif(e)) return NextResponse.json({ error: "Ce parcours n'a plus de tracé sur OpenStreetMap.", definitif: true }, { status: 404 });
    // Les deux sources en panne : on le DIT (sans rien inventer) et on le JOURNALISE, une fois par
    // jour — sinon un blocage durable (adresse bannie, User-Agent refusé) n'arrivait jamais à /admin.
    const statuts = causes(e).map((c) => (c as { message?: string })?.message ?? String(c));
    await journaliserEchecUneFois(null, {
      source: "parcours-geometrie", url: "/api/parcours/geometry",
      message: "Tracé de parcours indisponible : API OpenStreetMap et Overpass en échec",
      meta: { type, id, statuts },
    });
    return NextResponse.json({ error: "Géométrie indisponible pour le moment." }, { status: 503, headers: { "Retry-After": "60" } });
  }
}
