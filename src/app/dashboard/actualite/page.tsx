export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { actualitesEnCache, sansTexte } from "@/lib/news/actualites";

export const metadata = { title: "Actualité" };

/**
 * L'agrégateur d'actualités running, sur sa propre page.
 *
 * Il vivait en second onglet du « Club » ; le 22/09/2026, cet onglet est devenu
 * « Ajouter des amis » (suggestions, contacts, QR code) et Cyprien a demandé de mettre
 * l'actualité « autre part ». Rien n'est supprimé : le composant est le même, il a
 * simplement une adresse à lui, et une entrée de menu.
 */
export default async function ActualitePage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  // Le fil « Tout » est rendu PAR LE SERVEUR : les titres sont là dès l'affichage, sans
  // attendre que le navigateur les demande. Cache partagé chaud → instantané ; cache froid
  // → on n'attend pas plus de 2,5 s, le navigateur prendra le relais.
  const initial = await Promise.race([
    actualitesEnCache("all").then(sansTexte).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 2500)),
  ]);
  return (
    <>
      {/* La poignée de main TLS avec les domaines d'images est payée AVANT la première
          image (mesuré : 766 ms pour la première photo, dont l'essentiel en connexion).
          Les favicons des éditeurs viennent de DuckDuckGo, une par carte. */}
      <link rel="preconnect" href="https://images.pexels.com" crossOrigin="" />
      <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
      <link rel="preconnect" href="https://icons.duckduckgo.com" crossOrigin="" />
      <CommunityFeed initial={initial} />
    </>
  );
}
