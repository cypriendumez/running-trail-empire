export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Les deux sources sont bornées à 20 s au total : la fonction doit vivre au-delà, sinon Vercel la
// coupe AVANT la réponse 503 et la journalisation (relecture du 09/11/2026).
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { denyIfAnonymous } from "@/lib/api/adminGuard";
import { geometrieVerifiee, refusDefinitif, causes, ErreurSource } from "@/lib/parcours/geometrie";
import { journaliserEchecUneFois } from "@/lib/journal/echecServeur";
import { estDuCatalogue, distanceDuCatalogue } from "@/lib/parcours/catalogue";

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

// ⚠️ « v2 » (09/11/2026) : les tronçons sont désormais chaînés dans un ordre fixe (identifiant OSM).
// Garder « v1 » aurait servi 30 jours encore les tracés chaînés selon l'ancien ordre. Toute règle qui
// change le tracé rendu change cette version.
// « v3 » (09/11/2026) : un MORCEAU de parcours n'est plus mis en cache — « v2 » en gardait peut-être.
/** Un tracé trop court pour la distance du catalogue : refusé, et jamais mis en cache. */
class TraceIncomplet extends Error {
  readonly partiel = true;
  constructor(message: string, readonly echecs: unknown[]) { super(message); }
}
const tracePourCache = async (type: "relation" | "way", id: string, distanceKm: number) => {
  const v = await geometrieVerifiee(type, id, distanceKm);
  // Une exception n'est pas gardée par `unstable_cache` : le coureur pourra réessayer.
  if (v.partiel) throw new TraceIncomplet(`tracé incomplet : ${type} ${id}`, v.echecs);
  return v.coords;
};
const geometrieEnCache = unstable_cache(tracePourCache, ["parcours-geometrie-v3"], { revalidate: 60 * 60 * 24 * 30 });
/**
 * Un morceau vu il y a moins de 10 min : on le redit sans réinterroger OpenStreetMap (service
 * gratuit, quotas stricts) — sans cette mémoire, chaque clic relançait les deux sources.
 */
const PARTIELS = new Map<string, number>();
/**
 * Deux clics (ou deux coureurs) sur le même parcours au même moment : UNE seule recherche, et UN seul
 * journal — c'est la recherche qui journalise, pas chaque requête qui l'attend (sinon N requêtes
 * simultanées écrivaient N lignes : relecture du 09/11/2026). `verifie` : faux si le catalogue était
 * illisible (tracé non confronté à sa distance, donc gardé nulle part).
 */
const EN_COURS = new Map<string, Promise<{ coords: [number, number][]; verifie: boolean }>>();
/** Dernier signalement d'un catalogue illisible par cette instance (garde synchrone, avant tout `await`). */
let illisibleSignale = 0;

/** Nom court et stable d'une cause, pour le message du journal (jamais d'identifiant ni d'extrait de page). */
const nomCause = (c: unknown) => c instanceof ErreurSource
  // Statut 0 = pas de réponse HTTP (délai, réseau, nœud manquant, trop de relations) : on garde le
  // libellé, sans chiffre, pour ne pas confondre « délai » et « tracé troué » sous « api-osm:0 ».
  ? (c.status ? `${c.source}:${c.status}` : `${c.source}:${c.message.replace(/^[^:]*:\s*/, "").replace(/\d+/g, "N").slice(0, 40)}`)
  // Une réponse illisible (page HTML au lieu de JSON) : un libellé FIXE, pas un extrait de la page.
  : c instanceof SyntaxError ? "réponse illisible"
  : (c as Error)?.message?.replace(/\d+/g, "N").slice(0, 40) || "inconnu";

/** Ce que /admin doit savoir d'une recherche ratée. Appelé UNE fois par recherche. */
async function journaliserRecherche(e: unknown, type: "relation" | "way", id: string) {
  const base = { source: "parcours-geometrie", url: "/api/parcours/geometry" };
  // Un MORCEAU de parcours (OpenStreetMap incomplet) : une ligne par parcours et par jour (seuls les
  // parcours du catalogue ont une distance), avec la cause si l'autre source a échoué.
  if ((e as { partiel?: unknown })?.partiel === true) {
    const echecs = (e as TraceIncomplet).echecs ?? [];
    await journaliserEchecUneFois(null, {
      ...base, message: `Tracé incomplet sur OpenStreetMap : ${type} ${id}`,
      meta: { type, id, autreSource: [...new Set(echecs.flatMap((x) => causes(x)).map(nomCause))] },
    });
    return;
  }
  if (refusDefinitif(e)) {
    // Un parcours MORT dans le catalogue : listé dans /admin (une ligne par parcours et par jour) pour
    // pouvoir le retirer — SEULEMENT s'il y est vraiment : un identifiant inventé ne doit pas pouvoir
    // remplir error_logs (relecture du 09/11/2026).
    const auCatalogue = estDuCatalogue(type, id);
    if (auCatalogue) await journaliserEchecUneFois(null, {
      ...base, message: `Parcours supprimé d'OpenStreetMap : ${type} ${id}`, meta: { type, id },
    });
    // Catalogue illisible dans la fonction : on ne peut plus repérer les parcours morts, on le DIT.
    else if (auCatalogue === null) await journaliserEchecUneFois(null, {
      ...base, message: "Catalogue des parcours illisible : parcours supprimés non repérés",
    });
    return;
  }
  // Les deux sources en panne : JOURNALISÉ, une fois par jour et par cause — sinon un blocage durable
  // (adresse bannie, User-Agent refusé) n'arrivait jamais à /admin. La CAUSE dans le message
  // (« api-osm:429 · overpass:403 »), sans identifiant : une panne du matin ne masque plus un
  // blocage de l'après-midi (relecture du 09/11/2026).
  const statuts = causes(e).map((c) => (c as { message?: string })?.message ?? String(c));
  const cause = [...new Set(causes(e).map(nomCause))].sort().join(" · ");
  await journaliserEchecUneFois(null, {
    ...base, message: `Tracé de parcours indisponible : ${cause}`, meta: { type, id, statuts },
  });
}
const PARTIEL_MS = 10 * 60_000;

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

  const vuPartiel = PARTIELS.get(key);
  if (vuPartiel && Date.now() - vuPartiel < PARTIEL_MS) return NextResponse.json({ error: "Tracé incomplet sur OpenStreetMap.", partiel: true }, { status: 422 });

  let enCours = EN_COURS.get(key);
  if (!enCours) {
    const distance = distanceDuCatalogue(type, id);
    // Catalogue illisible : le tracé ne peut plus être confronté à sa distance. On ne le garde NULLE
    // PART (ni cache persistant, ni mémoire, ni navigateur) et on le DIT dans /admin.
    const signaler = distance === null && Date.now() - illisibleSignale > 60 * 60_000;
    if (signaler) illisibleSignale = Date.now();
    enCours = (async () => {
      if (signaler) await journaliserEchecUneFois(null, {
        source: "parcours-geometrie", url: "/api/parcours/geometry",
        message: "Catalogue des parcours illisible : tracés non vérifiés, cache coupé",
      });
      try {
        const coords = await (distance === null ? tracePourCache(type, id, 0) : geometrieEnCache(type, id, distance));
        return { coords, verifie: distance !== null };
      } catch (e) {
        if ((e as { partiel?: unknown })?.partiel === true) {
          // Purge des entrées expirées ; tout vider d'un coup relançait toutes les recherches.
          if (PARTIELS.size > 2000) for (const [k, t] of PARTIELS) if (Date.now() - t >= PARTIEL_MS) PARTIELS.delete(k);
          if (PARTIELS.size > 2000) PARTIELS.clear();
          PARTIELS.set(key, Date.now());
        }
        await journaliserRecherche(e, type, id);
        throw e;
      }
    })();
    EN_COURS.set(key, enCours);
    enCours.finally(() => EN_COURS.delete(key)).catch(() => {});
  }

  try {
    const { coords, verifie } = await enCours;
    // Non vérifié (catalogue illisible) : peut-être un morceau — gardé nulle part, réessayable.
    if (!verifie) return NextResponse.json({ coordinates: coords }, { headers: { "Cache-Control": "no-store" } });
    if (CACHE.size > 2000) CACHE.clear();
    CACHE.set(key, coords);
    return NextResponse.json({ coordinates: coords }, { headers: garde });
  } catch (e) {
    // Le journal est déjà écrit par la recherche : ici, seulement la réponse.
    // Un MORCEAU de parcours (OpenStreetMap incomplet) : ni montré, ni gardé 30 jours.
    if ((e as { partiel?: unknown })?.partiel === true) {
      return NextResponse.json({ error: "Tracé incomplet sur OpenStreetMap.", partiel: true }, { status: 422 });
    }
    // La relation n'existe plus sur OpenStreetMap : un refus DÉFINITIF, pas « réessaie plus tard ».
    if (refusDefinitif(e)) {
      return NextResponse.json({ error: "Ce parcours n'a plus de tracé sur OpenStreetMap.", definitif: true }, { status: 404 });
    }
    // Les deux sources en panne : on le DIT, sans rien inventer.
    return NextResponse.json({ error: "Géométrie indisponible pour le moment." }, { status: 503, headers: { "Retry-After": "60" } });
  }
}
