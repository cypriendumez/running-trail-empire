export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { amisMutuels, type Lien } from "@/lib/social/amis";
import { stripProfileSecrets } from "@/lib/profile/safe";

/**
 * GET → les athlètes avec qui on peut échanger : ceux qu'on suit ET qui nous suivent.
 *
 * ⚠️ ON NE REND QUE LE NOM ET L'IDENTIFIANT. Une liste de contacts n'a aucune raison de
 * transporter l'e-mail, la clé de montre ou le poids de quelqu'un — et
 * `stripProfileSecrets` existe précisément parce qu'une fuite de ce genre a déjà eu lieu.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createAdminClient();
  // Les deux sens en une seule lecture : ceux que je suis, et ceux qui me suivent.
  const { data, error } = await admin.from("follows")
    .select("follower_id,following_id")
    .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);
  if (error) return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });

  const ids = amisMutuels(user.id, (data ?? []) as Lien[]);
  if (ids.length === 0) return NextResponse.json({ amis: [] });

  const { data: profils } = await admin.from("profiles")
    .select("id, full_name, avatar_url").in("id", ids);
  const amis = (profils ?? []).map((p) => {
    const net = stripProfileSecrets(p as Record<string, unknown>) as { id: string; full_name?: string; avatar_url?: string };
    return { id: net.id, nom: net.full_name || "Athlète", avatar: net.avatar_url ?? null };
  });
  return NextResponse.json({ amis });
}
