export const dynamic = "force-dynamic";
import { TrailModes } from "@/components/trail/TrailModes";
import { texteRelief } from "@/components/trail/relief3dI18n";
import { ParcoursBrowser } from "@/components/parcours/ParcoursBrowser";
import { createClient } from "@/lib/supabase/server";
import { COLONNES_ACCES, profilPeut } from "@/lib/billing/access";
import { getAccountLang } from "@/lib/i18n/serverLang";

/** Le seul libellé qui n'appartient pas à la vue relief : le mode « construire ». */
const MODE_CONSTRUIRE: Record<string, string> = {
  fr: "Construire", en: "Build", de: "Erstellen", es: "Crear", pt: "Criar",
};

// « Carte » dans la navigation depuis le 21/09/2026 (Cyprien) — le nom d'outil « Trail Builder »
// reste sur la vitrine, où il désigne la fonctionnalité ; ici c'est l'onglet de l'app.
export const metadata = { title: "Carte" };

export default async function TrailPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;

  // Le droit d'export est lu ICI, côté serveur, et descend en propriété : le composant
  // client n'a pas à relire la formule.
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profil } = user
    ? await sb.from("profiles").select(COLONNES_ACCES).eq("id", user.id).maybeSingle()
    : { data: null };
  // La langue du compte : la vue relief nomme des institutions (IGN, swisstopo, USGS) qui
  // ne se traduisent pas, mais tout ce qui les décrit, si.
  const langue = user ? await getAccountLang(sb, user.id) : "fr";

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

  // ⚠️ LA CARTE EST OUVERTE À TOUS DEPUIS LE 22/10/2026 (Cyprien : l'export GPX « dans
  // les abonnements payants, mais pas la map en général et l'accès à tous les parcours »).
  // Construire une boucle, la voir en relief, chercher un parcours : gratuit. Seul
  // l'EXPORT GPX — la trace qui part vers la montre — est réservé aux formules payantes.
  // Avant, un compte gratuit ne voyait qu'une porte fermée à la place du constructeur.
  //
  // ⚠️ CE VERROU EST D'INTERFACE, ET IL FAUT LE SAVOIR : le GPX est fabriqué dans le
  // navigateur à partir de coordonnées que la carte affiche déjà. Aucune route ne le
  // sert, il n'y a donc aucun appel à refuser — on retire le bouton, on ne protège pas
  // une dépense. C'est accepté : l'export ne coûte rien, il sert à décider quelqu'un.
  const exportGpx = profilPeut(profil as Parameters<typeof profilPeut>[0], "gpx");

  return (
    <div className="space-y-6">
      <TrailModes centre={centre} exportGpx={exportGpx} textes={{ ...texteRelief(langue), "mode.construire": MODE_CONSTRUIRE[langue] ?? MODE_CONSTRUIRE.fr }} />
      <ParcoursBrowser initialSearch={q ?? ""} exportGpx={exportGpx} />
    </div>
  );
}
