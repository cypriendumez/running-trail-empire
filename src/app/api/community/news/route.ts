export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { QUERIES, estCat, type Cat } from "@/lib/news/rubriques";
import { actualitesEnCache, actualitesDeLaTranche, sansTexte } from "@/lib/news/actualites";

export const runtime = "nodejs";

// Actualité running/trail agrégée depuis des FLUX RSS publics — voir `lib/news/actualites`.
// On n'affiche que titre + source + lien (clic → site source). Aucun article copié → légal.

export async function GET(req: Request) {
  const demande = new URL(req.url).searchParams.get("cat") ?? "all";
  // ⚠️ Avant, une rubrique inconnue retombait sur la requête générale : l'appelant
  // recevait 200 et de l'actualité quelconque, qu'il affichait sous le titre demandé.
  // Une faute de frappe passait inaperçue. On refuse désormais.
  if (!estCat(demande)) {
    return NextResponse.json({ error: `Rubrique inconnue : ${demande}`, rubriques: Object.keys(QUERIES) }, { status: 400 });
  }
  const cat: Cat = demande;
  // Le texte intégral du flux n'intéresse que la lettre du lundi, qui doit le résumer.
  const avecTexte = new URL(req.url).searchParams.get("avecTexte") === "1";
  try {
    // ⚠️ La lettre (`avecTexte=1`) ne passe qu'une fois par semaine : le fil « instantané,
    // rafraîchi en arrière-plan » lui servait la collecte du passage PRÉCÉDENT, ici comme
    // sur le CDN (voir `trancheDe`). Elle lit donc une collecte de sa tranche de trente
    // minutes, et sa réponse n'est jamais resservie périmée.
    if (avecTexte) {
      return NextResponse.json({ items: await actualitesDeLaTranche(cat), cat }, {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=900" },
      });
    }
    return NextResponse.json({ items: sansTexte(await actualitesEnCache(cat)), cat }, {
      // Le même fil pour tous : le CDN le garde 15 min et le ressert pendant qu'il se
      // rafraîchit. Changer de rubrique devient instantané après la première visite.
      headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ items: [], cat, erreur: "sources injoignables" }, { headers: { "Cache-Control": "no-store" } });
  }
}
