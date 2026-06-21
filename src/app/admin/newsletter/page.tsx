export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewsletterComposer } from "@/components/admin/NewsletterComposer";

export const metadata = { title: "Newsletter — Admin" };

export default async function AdminNewsletterPage() {
  // L'accès est déjà restreint à l'admin par le layout /admin.
  const admin = createAdminClient();
  // Destinataires = UNIQUEMENT les abonnés à la newsletter (opt-in).
  const { count: subs } = await admin
    .from("newsletter_subscribers")
    .select("id", { count: "exact", head: true })
    .eq("unsubscribed", false);
  return <NewsletterComposer subscriberCount={subs ?? 0} />;
}
