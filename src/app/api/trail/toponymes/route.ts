import { NextResponse } from "next/server";
import { requete, interrogeable, lire, prioriser, MIROIRS, type Toponyme } from "@/lib/trail/toponymes";

/**
 * LES NOMS DE LA MONTAGNE, SERVIS PAR LE SERVEUR.
 *
 * ⚠️ CETTE ROUTE EXISTE PARCE QU'APPELER OVERPASS DEPUIS LE NAVIGATEUR NE MARCHE PAS.
 * Mesuré le 07/09/2026 : la même requête répond en une seconde depuis le serveur et
 * EXPIRE APRÈS 45 SECONDES depuis la page — un écran figé trois quarts de minute pour des
 * étiquettes. Overpass est un service public gratuit, parfois saturé (504 vu sur le
 * miroir principal le même jour) : il n'a rien à faire dans le chemin direct d'un
 * utilisateur.
 *
 * Ce que la route ajoute, et que le navigateur ne pouvait pas faire :
 * • un DÉLAI COURT — au-delà, on rend une liste vide plutôt que de faire attendre ;
 * • plusieurs MIROIRS, essayés l'un après l'autre ;
 * • un CACHE en mémoire : deux athlètes qui regardent le même massif ne déclenchent
 *   qu'une seule requête chez un service qu'on ne paie pas.
 */
export const dynamic = "force-dynamic";

/** Au-delà, on rend ce qu'on a — c'est-à-dire rien — plutôt que de faire attendre. */
/**
 * ⚠️ 15 SECONDES, ET C'EST UNE MESURE. À 9 s, les massifs les plus fournis rendaient
 * TOUJOURS zéro toponyme depuis la production, alors que la même requête aboutit en 4,3 s
 * depuis un poste : le cadrage alpin dense pèse 1 742 objets, soit ~700 Ko à transférer,
 * et le trajet Vercel → Overpass ajoute assez de latence pour dépasser la limite. Un
 * massif riche est précisément celui où les noms servent le plus — le couper là est
 * l'inverse du but.
 *
 * Le prix : sur un vrai échec, l'athlète attend jusqu'à 15 s au lieu de 9. Il ne le paie
 * qu'UNE fois par zone, la réponse étant ensuite mise en cache six heures.
 */
const DELAI_MS = 15000;
/** Une zone de montagne ne change pas dans la journée. */
const CACHE_MS = 6 * 3600 * 1000;
/** Bornes du cache : au-delà on oublie les plus anciennes entrées. */
const CACHE_MAX = 120;

const cache = new Map<string, { a: number; liste: Toponyme[] }>();

/**
 * ⚠️ LE CACHE EN MÉMOIRE NE SUFFIT PAS EN PRODUCTION, ET C'EST MESURÉ. Vercel exécute
 * cette route sans état : deux appels identiques tombent sur deux instances différentes,
 * et la `Map` ci-dessus est vide dans la seconde. Vérifié sur le site déployé — premier
 * appel 5,4 s, second appel 10,0 s, soit AUCUN gain.
 *
 * On ajoute donc un en-tête de cache lu par le réseau de diffusion : la réponse est
 * servie depuis la périphérie, sans réveiller la fonction ni retoucher Overpass. La
 * `Map` reste utile en local et pour deux requêtes simultanées sur la même instance.
 */
function avecCache(charge: object, secondes: number) {
  return NextResponse.json(charge, {
    headers: {
      // `stale-while-revalidate` : on sert l'ancienne réponse pendant qu'on rafraîchit,
      // plutôt que de faire attendre quelqu'un devant une carte.
      "Cache-Control": `public, s-maxage=${secondes}, stale-while-revalidate=${secondes * 4}`,
    },
  });
}

/** Arrondi du cadrage : deux vues presque identiques doivent partager une entrée. */
function cle(b: { sud: number; ouest: number; nord: number; est: number }): string {
  const r = (n: number) => Math.round(n * 50) / 50;   // pas de 0,02° ≈ 2 km
  return `${r(b.sud)},${r(b.ouest)},${r(b.nord)},${r(b.est)}`;
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const n = (k: string) => Number(p.get(k));
  const bbox = { sud: n("sud"), ouest: n("ouest"), nord: n("nord"), est: n("est") };
  const zoom = n("zoom");
  if (!Object.values(bbox).every(Number.isFinite) || !Number.isFinite(zoom)) {
    return NextResponse.json({ error: "cadrage invalide" }, { status: 400 });
  }
  // Le même contrôle que côté client : une zone trop large ramènerait des milliers
  // d'objets illisibles et pèserait sur un service gratuit.
  if (!interrogeable(bbox, zoom)) return avecCache({ toponymes: [], raison: "trop_large" }, 3600);

  const k = cle(bbox);
  const vu = cache.get(k);
  if (vu && Date.now() - vu.a < CACHE_MS) return avecCache({ toponymes: vu.liste, cache: true }, CACHE_MS / 1000);

  /**
   * ⚠️ EN PARALLÈLE, PAS L'UN APRÈS L'AUTRE. Mesuré en dix minutes le 07/09/2026 : un
   * miroir servait 118 objets puis a cessé de répondre pendant qu'un autre rendait
   * 35 sommets en 1,6 s. En série, le miroir mort coûtait NEUF SECONDES d'attente avant
   * même d'essayer celui qui marchait. On les lance ensemble et on garde la première
   * vraie réponse.
   *
   * ⚠️ ET ON EXIGE UNE RÉPONSE NON VIDE. Un miroir à couverture partielle (osm.ch) rend
   * 200 avec deux sommets là où un autre en trouve trente-cinq : gagner la course avec
   * une réponse presque vide donnerait une carte presque muette.
   */
  const essai = (miroir: string) => fetch(miroir, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // ⚠️ OVERPASS EXIGE UN AGENT IDENTIFIABLE, ET IL LE DIT EN CLAIR. Sans cet en-tête,
      // le serveur répond « 429 — Please include a meaningful User-Agent string with your
      // requests to avoid rate-limiting ». Mesuré : refus en 217 ms, aucun objet. C'est la
      // règle d'un service public gratuit, et la respecter coûte une ligne.
      "User-Agent": "Pacevo/1.0 (application d'entrainement course a pied; https://running-trail-empire-woad.vercel.app)",
    },
    body: new URLSearchParams({ data: requete(bbox) }),
    signal: AbortSignal.timeout(DELAI_MS),
  }).then(async (r) => {
    if (!r.ok) throw new Error(String(r.status));
    const liste = prioriser(lire(await r.json()));
    if (!liste.length) throw new Error("vide");
    return liste;
  });

  try {
    const liste = await Promise.any(MIROIRS.map(essai));
    // ⚠️ ON MET EN CACHE MÊME UNE LISTE VIDE (plus bas) : un massif sans sommet nommé
    // existe, et sans cela on rejouerait la requête à chaque déplacement pour rien.
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(k, { a: Date.now(), liste });
    return avecCache({ toponymes: liste }, CACHE_MS / 1000);
  } catch {
    // Tous les miroirs ont échoué ou n'ont rien trouvé. On mémorise brièvement pour ne
    // pas marteler un service gratuit déjà en peine.
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(k, { a: Date.now() - CACHE_MS + 120_000, liste: [] });   // revalable dans 2 min
  }
  // ⚠️ AUCUNE ERREUR HTTP ICI. Ne pas avoir les noms n'est pas une panne de l'application :
  // la carte reste entièrement utilisable. On le DIT, et l'écran l'affiche.
  // ⚠️ UN ÉCHEC SE MET EN CACHE BRIÈVEMENT, PAS SIX HEURES. Overpass retombe en marche
  // en quelques minutes : figer son absence pour la journée priverait l'athlète des noms
  // longtemps après le retour du service.
  return avecCache({ toponymes: [], raison: "indisponible" }, 120);
}
