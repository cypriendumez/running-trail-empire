export const dynamic = "force-dynamic";
import { TrailBuilderLazy } from "@/components/trail/TrailBuilderLazy";
import { ParcoursBrowser } from "@/components/parcours/ParcoursBrowser";
import { createClient } from "@/lib/supabase/server";
import { COLONNES_ACCES, profilPeut } from "@/lib/billing/access";
import { PorteFermee } from "@/components/billing/PorteFermee";

export const metadata = { title: "Trail Builder" };

export default async function TrailPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  // ⚠️ LE CONTRÔLE EST FAIT ICI, CÔTÉ SERVEUR. Masquer le bouton d'export dans le
  // composant laisserait la fonction accessible à qui sait ouvrir l'inspecteur — et
  // « Trail Builder et export GPX » est ce qui sépare Premium de Starter.
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profil } = user
    ? await sb.from("profiles").select(COLONNES_ACCES).eq("id", user.id).maybeSingle()
    : { data: null };

  // ⚠️ La RECHERCHE de parcours reste ouverte à tous : elle ne coûte rien, elle donne
  // envie, et la fermer transformerait une vitrine en mur. Seule la CONSTRUCTION de
  // trace et son export sont réservés.
  if (!profilPeut(profil as Parameters<typeof profilPeut>[0], "gpx")) {
    return (
      <div className="space-y-6">
        <PorteFermee capacite="gpx" />
        <ParcoursBrowser initialSearch={q ?? ""} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TrailBuilderLazy />
      <ParcoursBrowser initialSearch={q ?? ""} />
    </div>
  );
}
