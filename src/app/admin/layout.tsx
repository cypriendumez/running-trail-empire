export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MessageNotifier } from "@/components/messages/MessageNotifier";
import { estAdmin } from "@/lib/admin/acces";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!estAdmin(user?.email)) {
    redirect("/dashboard");
  }

  return <><MessageNotifier />{children}</>;
}
