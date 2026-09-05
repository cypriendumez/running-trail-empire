export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { HealthCenter } from "@/components/health/HealthCenter";
import { suiviParZone, type Signalement } from "@/lib/health/douleurs";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { estUnePanne } from "@/lib/dashboard/lectures";

export const metadata = { title: "Santé & Guardian" };

/**
 * Le suivi des douleurs est lu ICI, côté serveur.
 *
 * ⚠️ IL EST LU PAR LE MÊME CALCUL QUE LE KINÉ IA (`suiviParZone`). Si l'athlète voyait
 * une évolution et le modèle une autre, l'un des deux mentirait — et rien à l'écran ne
 * dirait lequel. Une seule fonction, deux affichages.
 */
export default async function HealthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let suivi: ReturnType<typeof suiviParZone> = [];
  let enPanne = false;
  if (user) {
    /**
     * ⚠️ « AUCUNE DOULEUR » N'EST PAS « ON N'A PAS PU LIRE ».
     *
     * Ces lignes sont les douleurs que l'athlète a DÉCLARÉES lui-même. Sans contrôle,
     * un échec de lecture rendait `[]` et l'écran affichait un historique vierge : de
     * quoi croire que l'application a oublié ce qu'on lui a dit, et tout re-saisir.
     * C'est aussi la mémoire dans laquelle puise le kiné IA.
     */
    const { data, error } = await supabase.from("notifications")
      .select("data,created_at").eq("user_id", user.id).eq("type", "pain_report")
      .gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString())
      .order("created_at", { ascending: false }).limit(120);
    const rows: Signalement[] = ((data ?? []) as { data: { zone?: string; slot?: string; level?: number; date?: string } | null; created_at: string }[])
      .map((r) => ({
        zone: String(r.data?.zone ?? ""),
        cle: r.data?.slot ? String(r.data.slot) : null,
        level: Number(r.data?.level),
        date: String(r.data?.date ?? r.created_at ?? "").slice(0, 10),
      }));
    suivi = suiviParZone(rows, aujourdhui(FUSEAU_DEFAUT));
    enPanne = estUnePanne({ error });
    if (enPanne) console.error("[santé] douleurs illisibles :", error?.message);
  }
  return <HealthCenter suivi={suivi} enPanne={enPanne} />;
}
