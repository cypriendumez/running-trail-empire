export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffType } from "@/lib/upload/sniff";

const MAX = 10 * 1024 * 1024; // 10 Mo
const BUCKET = "message-attachments";

// POST /api/upload (multipart, champ "file") → upload + URL publique.
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Fichier trop lourd (max 10 Mo)" }, { status: 400 });

  // ── TYPE DE FICHIER : liste blanche, et type DÉDUIT DU CONTENU ──────────────
  // Le bucket est PUBLIC et le type était repris tel quel du navigateur. N'importe quel
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

  const admin = createAdminClient();
  // L'extension est réécrite d'après le type réel : « photo.html » ne peut pas rester .html.
  const ext = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1];
  const stem = file.name.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-50) || "fichier";
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${stem}.${ext}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.publicUrl, name: file.name, type: contentType });
}
