export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";
import { lireFlux } from "@/lib/calendrier/flux";
import { reponseNavigateur } from "@/lib/calendrier/navigateur";
import { empreinteJeton } from "@/lib/calendrier/jeton";
import { createClient } from "@/lib/supabase/server";

// GET /api/calendrier/flux/<jeton>.ics — le calendrier des séances, relu par Apple Calendrier,
// Google Agenda ou Outlook. PUBLIC par nature (leurs serveurs n'ont pas de session) : c'est le
// jeton, secret et révocable, qui sert de clé. Voir lib/calendrier/.
//
// ⚠️ AUCUNE indexation, aucun cache partagé : l'adresse est personnelle.
const ENTETES_PRIVES = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function GET(req: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  // Ouvert dans un navigateur : jamais le fichier (qui s'importerait en copie figée, en double),
  // mais l'abonnement (Apple) ou la page des boutons (ailleurs). Voir lib/calendrier/navigateur.ts.
  const navigateur = await reponseNavigateur(req.headers, jeton, {
    existe: async (j) => {
      const { data, error } = await createAdminClient().from("calendrier_abonnements")
        .select("user_id").eq("jeton_empreinte", empreinteJeton(j)).maybeSingle();
      return error ? null : !!data;
    },
    connecte: async () => { const { data } = await (await createClient()).auth.getUser(); return !!data.user; },
  });
  if (navigateur) return navigateur;
  const r = await lireFlux(createAdminClient(), jeton, new Date());
  if (r.statut !== 200) {
    // 503 = « réessaie plus tard » : l'agenda garde ses séances au lieu de tout effacer.
    return new Response(r.statut === 404 ? "Calendrier introuvable" : "Indisponible, réessaie plus tard", {
      status: r.statut,
      headers: { ...ENTETES_PRIVES, "Content-Type": "text/plain; charset=utf-8", ...(r.statut === 503 ? { "Retry-After": "900" } : {}) },
    });
  }
  return new Response(r.ics, {
    status: 200,
    headers: { ...ENTETES_PRIVES, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="pacevo.ics"' },
  });
}
