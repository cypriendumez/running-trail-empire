export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estAdmin } from "@/lib/admin/acces";
import { SEAU_PJ, cheminValide, peutOuvrir, urlPiece } from "@/lib/messages/piecesJointes";

/**
 * GET /api/messages/piece?c=<chemin> — sert une pièce jointe de la messagerie (01/10/2026).
 *
 * Le fichier TRANSITE PAR LE SERVEUR : aucune adresse de stockage (publique ou signée)
 * n'atteint le navigateur, donc rien de réutilisable ne traîne dans un historique ou un
 * e-mail transféré. Ouvrent le fichier : celui qui l'a déposé, le coach, et le titulaire
 * d'une boîte où un message le porte (un ami destinataire, l'athlète à qui le coach répond).
 * Tout autre appel reçoit 404 — on ne dit pas qu'un fichier existe à qui ne peut pas le voir.
 */
const introuvable = () => NextResponse.json({ error: "Pièce introuvable" }, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chemin = new URL(req.url).searchParams.get("c");
  if (!cheminValide(chemin)) return introuvable();

  const admin = createAdminClient();
  const estCoach = estAdmin(user.email);
  let recu = false;
  if (!chemin.startsWith(`${user.id}/`) && !estCoach) {
    // ⚠️ Filtré par `user_id` : seule SA boîte compte. La présence de l'adresse dans le
    // message d'un autre ne donne aucun droit.
    const { data, error } = await admin.from("notifications").select("id")
      .eq("user_id", user.id)
      .contains("data", { attachments: [{ url: urlPiece(chemin) }] })
      .limit(1);
    if (error) { console.error("[piece] contrôle d'accès illisible :", error.message); return introuvable(); }
    recu = (data ?? []).length > 0;
  }
  if (!peutOuvrir({ chemin, userId: user.id, estCoach, recu })) return introuvable();

  const { data: fichier, error } = await admin.storage.from(SEAU_PJ).download(chemin);
  if (error || !fichier) return introuvable();
  const type = fichier.type || "application/octet-stream";
  return new NextResponse(fichier.stream(), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="piece"`,
      // Privé : ni le navigateur partagé ni un cache intermédiaire ne doivent le garder.
      "Cache-Control": "private, no-store, max-age=0",
      // Le type a été déduit des OCTETS au dépôt (image ou PDF seulement) : le navigateur
      // ne doit pas en deviner un autre. Pas de CSP « sandbox » : Chrome refuse alors
      // d'afficher un PDF.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
