export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";
import { TYPE_AVIS, litAvis } from "@/lib/avis/store";
import { AvisModeration } from "@/components/admin/AvisModeration";

export const metadata = { title: "Avis — Admin" };

export default async function AdminAvisPage() {
  // L'accès est déjà restreint à l'admin par le layout /admin.
  const { data } = await createAdminClient()
    .from("notifications").select("id, data, created_at")
    .eq("type", TYPE_AVIS).order("created_at", { ascending: false });

  const lignes = (data ?? [])
    .map((r) => ({ id: String(r.id), a: litAvis(r.data) }))
    .filter((x): x is { id: string; a: NonNullable<ReturnType<typeof litAvis>> } => Boolean(x.a))
    .map((x) => ({ id: x.id, ...x.a }));

  return <AvisModeration initial={lignes} />;
}
