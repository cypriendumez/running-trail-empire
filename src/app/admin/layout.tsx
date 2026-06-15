export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MessageNotifier } from "@/components/messages/MessageNotifier";

const ADMIN_EMAIL = "cypriendumez@outlook.fr";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  return <><MessageNotifier />{children}</>;
}
