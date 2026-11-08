export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffImage } from "@/lib/upload/sniff";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

export async function POST(req: NextRequest) {
  // 1. Session
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const file = formData.get("avatar") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 5 Mo)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // 3. ⚠️ LE TYPE RÉEL, D'APRÈS LES OCTETS — jamais `file.type`, que le client fixe librement
  //    (constat d'audit M5). Un fichier qui n'est pas une vraie image (HTML, SVG, polyglotte)
  //    est refusé, et c'est ce type reniflé qui sert d'extension ET de Content-Type stocké
  //    (le seau `avatars` est PUBLIC et servi avec ce type). Même garde que /api/upload.
  const contentType = sniffImage(buffer);
  if (!contentType) {
    return NextResponse.json({ error: "Format non accepté (JPEG, PNG, WebP, GIF uniquement)." }, { status: 415 });
  }
  const ext = contentType.split("/")[1].replace("jpeg", "jpg");
  const path = `${user.id}/avatar.${ext}`;

  // 4. Upload via le client admin (contourne la RLS)
  const { error: upErr } = await createAdminClient().storage
    .from("avatars")
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (upErr) {
    return NextResponse.json({ error: "Erreur upload : " + upErr.message }, { status: 500 });
  }

  // 5. URL publique
  const { data: { publicUrl } } = createAdminClient().storage
    .from("avatars")
    .getPublicUrl(path);

  // 6. profiles.avatar_url
  const { error: dbErr } = await createAdminClient()
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (dbErr) {
    return NextResponse.json({ error: "Erreur mise à jour profil : " + dbErr.message }, { status: 500 });
  }

  // URL avec cache-buster
  return NextResponse.json({ url: `${publicUrl}?t=${Date.now()}` });
}
