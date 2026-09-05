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

  /**
   * OÙ OUVRIR LA CARTE.
   *
   * ⚠️ ELLE S'OUVRAIT SUR LA FRANCE ENTIÈRE, au zoom 6. Personne ne trace un parcours à
   * cette échelle : il fallait chercher sa ville et zoomer une dizaine de fois avant de
   * poser le premier point.
   *
   * On prend les bornes de la DERNIÈRE trace GPS synchronisée. C'est le meilleur signal
   * disponible — là où l'athlète court vraiment — et il est déjà calculé et stocké
   * (`min_lat`/`max_lat`…), donc la lecture est minuscule. Surtout : aucune demande de
   * géolocalisation. Ouvrir un outil de tracé ne devrait pas exiger une permission pour
   * voir sa région.
   *
   * ⚠️ Une première version se servait des parcours ENREGISTRÉS. Vérifié en base :
   * `user_routes` est vide, y compris pour un compte actif depuis des mois — le
   * recentrage n'aurait donc jamais eu lieu. Les traces, elles, sont 330.
   */
  const { data: derniereTrace } = user
    ? await sb.from("activity_tracks")
        .select("min_lat, max_lat, min_lon, max_lon")
        .eq("user_id", user.id).eq("has_gps", true)
        .not("min_lat", "is", null)
        .order("fetched_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  const t = derniereTrace as { min_lat?: number; max_lat?: number; min_lon?: number; max_lon?: number } | null;
  // Le centre des bornes, et seulement s'il est plausible : une inversion lat/lon ou une
  // colonne vide enverrait la carte au milieu de l'océan.
  const centre =
    t && [t.min_lat, t.max_lat, t.min_lon, t.max_lon].every((v) => typeof v === "number" && Number.isFinite(v))
      ? (() => {
          const lat = ((t.min_lat as number) + (t.max_lat as number)) / 2;
          const lon = ((t.min_lon as number) + (t.max_lon as number)) / 2;
          return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
        })()
      : null;

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
      <TrailBuilderLazy centre={centre} />
      <ParcoursBrowser initialSearch={q ?? ""} />
    </div>
  );
}
