export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffType } from "@/lib/upload/sniff";
import { SEAU_PJ, cheminPiece, urlPiece } from "@/lib/messages/piecesJointes";

const MAX = 10 * 1024 * 1024; // 10 Mo

/**
 * POST /api/upload (multipart, champ "file") → dépôt PRIVÉ + adresse de l'application.
 *
 * ⚠️ PLUS D'URL PUBLIQUE (01/10/2026) : le seau `message-attachments` était public, une
 * pièce jointe restait lisible à vie par quiconque avait l'adresse. Le fichier va dans
 * `SEAU_PJ`, privé, et n'est servi que par /api/messages/piece, après contrôle
 * (lib/messages/piecesJointes).
 */
async function seauPrive(): Promise<string | null> {
  const { data, error } = await createAdminClient().storage.getBucket(SEAU_PJ);
  if (error || !data) return `Espace de stockage « ${SEAU_PJ} » introuvable : ${error?.message ?? "absent"}.`;
  // Un seau se bascule en public d'un clic : ce jour-là, on REFUSE de déposer.
  if (data.public) return `L'espace « ${SEAU_PJ} » est PUBLIC : dépôt refusé.`;
  return null;
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Fichier trop lourd (max 10 Mo)" }, { status: 400 });

  // ── TYPE DE FICHIER : liste blanche, et type DÉDUIT DU CONTENU ──────────────
  // Le seau était PUBLIC (jusqu'au 01/10/2026) et le type repris tel quel du navigateur. N'importe quel
  // compte pouvait donc déposer un .html ou un .svg contenant du script, en imposant
  // lui-même `text/html` : une page arbitraire hébergée sur notre infrastructure, avec
  // notre nom de domaine de stockage — hameçonnage ou distribution de fichiers douteux.
  // On n'accepte que des images et des PDF, et on détermine le type nous-mêmes à partir
  // des premiers octets : l'extension et l'en-tête déclaré mentent, pas la signature.
  // La détection vit dans lib/upload/sniff.ts : le kiné IA applique EXACTEMENT la même,
  // deux copies auraient fini par diverger — et c'est un contrôle de sécurité.
  const buf = Buffer.from(await file.arrayBuffer());
  const contentType = sniffType(buf);
  if (!contentType) {
    return NextResponse.json({ error: "Format non accepté. Images (JPEG, PNG, GIF, WebP) et PDF uniquement." }, { status: 415 });
  }

  const motif = await seauPrive();
  if (motif) { console.error("[upload]", motif); return NextResponse.json({ error: "Envoi de fichiers indisponible pour le moment." }, { status: 503 }); }
  // Le chemin ne garde ni le nom du fichier ni la date : deux identifiants, et l'extension
  // réécrite d'après le type RÉEL (« photo.html » ne peut pas rester .html).
  const path = cheminPiece(user.id, crypto.randomUUID(), contentType);
  const { error } = await createAdminClient().storage.from(SEAU_PJ).upload(path, buf, { contentType, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, url: urlPiece(path), name: file.name.slice(0, 120), type: contentType });
}
