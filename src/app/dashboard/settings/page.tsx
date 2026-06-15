export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata = { title: "Paramètres | Running & Trail Empire" };

export default async function SettingsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: settingsRow }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", user.id).single(),
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle(),
  ]);
  return (
    <SettingsView
      profile={(profile ?? {}) as Record<string, unknown>}
      email={user.email ?? ""}
      userId={user.id}
      settings={(settingsRow?.data ?? {}) as Record<string, unknown>}
    />
  );
}
