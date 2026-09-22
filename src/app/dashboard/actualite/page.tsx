export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CommunityFeed } from "@/components/community/CommunityFeed";

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
  return (
    <>
      {/* La poignée de main TLS avec les domaines d'images est payée AVANT la première
          image (mesuré : 766 ms pour la première photo, dont l'essentiel en connexion).
          Les favicons des éditeurs viennent de DuckDuckGo, une par carte. */}
      <link rel="preconnect" href="https://images.pexels.com" crossOrigin="" />
      <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
      <link rel="preconnect" href="https://icons.duckduckgo.com" crossOrigin="" />
      <CommunityFeed />
    </>
  );
}
