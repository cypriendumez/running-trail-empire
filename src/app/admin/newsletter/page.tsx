export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewsletterComposer } from "@/components/admin/NewsletterComposer";

export const metadata = { title: "Newsletter — Admin" };

export default async function AdminNewsletterPage() {
  // L'accès est déjà restreint à l'admin par le layout /admin.
  const admin = createAdminClient();
  const [{ count: subs }, { count: users }] = await Promise.all([
    admin.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("unsubscribed", false),
    admin.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  // Approximation du nombre de destinataires uniques (abonnés + comptes, sans dédup exact ici).
  const recipients = Math.max(subs ?? 0, users ?? 0);
  return <NewsletterComposer subscriberCount={recipients} />;
}
