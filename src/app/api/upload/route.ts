export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const admin = createAdminClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "fichier";
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.publicUrl, name: file.name, type: file.type || "" });
}
