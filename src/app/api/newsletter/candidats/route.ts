export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { RUBRIQUES_LETTRE } from "@/lib/news/rubriques";
import { lienGoogleNews, trancheDe } from "@/lib/news/actualites";
import { preparerSelection, publiable, type Item } from "@/lib/newsletter/selection";
import { lundiDEnvoi } from "@/lib/newsletter/edition";
import { aujourdhui } from "@/lib/time/fuseau";

/**
 * LES CANDIDATS DE LA LETTRE — ce que lit @Gazette (n°19) le dimanche soir pour choisir.
 *
 * Mêmes règles que la lettre (`lib/newsletter/selection`), SANS édition : @Gazette voit
 * l'ordre automatique et choisit dedans. Public, en lecture seule, parce qu'une routine
 * cloud ne doit pas porter de secret : il ne rend que ce que publie déjà le fil
 * d'actualité (titre, média, lien, date), jamais le texte des articles, et rien sur les
 * abonnés. Mis en cache 30 minutes : la collecte interroge une trentaine de flux, on ne la
 * relance pas à chaque appel.
 *
 * ⚠️ PAR TRANCHE DE TRENTE MINUTES, et non « 30 minutes puis rafraîchi en arrière-plan » :
 * personne n'appelle ce point entre deux dimanches, et @Gazette y recevait la collecte de
 * la semaine PRÉCÉDENTE (15/11/2026, PR 51 bloquée par @Maestro). La tranche fait partie de
 * la clé du cache : voir `trancheDe` dans `lib/news/actualites`.
 */

const PAR_RUBRIQUE = 12;

const resumable = (it: Item) => (it.texte ?? "").trim().length >= 320 || !lienGoogleNews(it.link);
const fiche = (it: Item) => ({
  lien: it.link, titre: it.title, media: it.source, date: it.date, langue: it.langue ?? "fr", resumable: resumable(it),
});

const candidats = unstable_cache(async (base: string, _tranche: number) => {
  const sel = await preparerSelection({ base, edition: null });
  const jour = aujourdhui("Europe/Paris");
  return {
    genere: new Date().toISOString(),
    pour: lundiDEnvoi(jour),
    // Les collectes en échec, en clair (vide = aucune) : une rubrique vide n'est plus muette.
    // La réponse reste gardée pour sa tranche : un appelant ne relance pas la collecte à volonté.
    // Rien n'est écrit en base ici (point public) : c'est la lettre du lundi qui journalise.
    pannes: sel.pannes,
    rubriques: RUBRIQUES_LETTRE.map((r, n) => ({
      cle: r.cle,
      places: r.max,
      candidats: n === 0
        ? sel.candidatsUne.map((s) => ({
          ...fiche(s.article), sujet: s.mot || null, medias: s.medias,
          // Ce qu'en titrent les AUTRES médias : de quoi juger le sujet sans ouvrir de page.
          autresTitres: s.membres.filter((m) => m.link !== s.article.link).slice(0, 6).map((m) => `${m.title} (${m.source})`),
        }))
        : sel.parRubrique[n].filter(publiable).slice(0, PAR_RUBRIQUE).map(fiche),
    })),
  };
}, ["newsletter-candidats-v2"], { revalidate: 1800 });

export async function GET() {
  const BASE = process.env.NEXT_PUBLIC_APP_URL;
  if (!BASE) return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL manquant" }, { status: 500 });
  try {
    const reponse = await candidats(BASE, trancheDe(Date.now()));
    // Une collecte incomplète ne reste pas 30 minutes de plus sur le CDN : la tranche suivante la refait.
    const garde = reponse.pannes.length ? "public, max-age=60, s-maxage=300" : "public, max-age=300, s-maxage=1800";
    return NextResponse.json(reponse, { headers: { "Cache-Control": garde } });
  } catch (e) {
    return NextResponse.json({ error: "collecte impossible", detail: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
