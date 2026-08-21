export const dynamic = "force-dynamic";
import { stripProfileSecrets } from "@/lib/profile/safe";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MedicalDisclaimer } from "@/components/layout/MedicalDisclaimer";
import { AutoSync } from "@/components/AutoSync";
import { MessageNotifier } from "@/components/messages/MessageNotifier";
import { SupportBubble } from "@/components/support/SupportBubble";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AttributionGarmin } from "@/components/legal/AttributionGarmin";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { count: unreadMessages }, { data: settingsRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("type", "coach_message").eq("read", false),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle(),
  ]);
  const avatarColor = String(((settingsRow?.data ?? {}) as Record<string, unknown>).avatarColor ?? "emerald");

  if (profile && !profile.onboarding_completed) redirect("/onboarding");

  return (
    <LanguageProvider initialLang={String(profile?.preferred_language ?? "fr")} userId={user.id}>
      <div className="flex h-screen bg-[#FAFAFA] overflow-hidden">
        <AutoSync />
        <MessageNotifier />
        <Sidebar profile={stripProfileSecrets(profile)} unreadMessages={unreadMessages ?? 0} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar profile={stripProfileSecrets(profile)} avatarColor={avatarColor} />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
          {/* ⚠️ ICI, ET PAS PAGE PAR PAGE. L'article 1.1 des conditions d'API
              d'intervals.icu impose d'attribuer à Garmin toute information dérivée de ses
              données. Elle était posée sur quatre pages choisies à la main — et HUIT
              autres vues lisaient les mêmes tables sans rien afficher (heatmap, survol,
              trophées, clubs, ligues, profil…). Une liste tenue à la main s'oublie ; le
              layout, non : toute page présente et à venir la porte. */}
          <AttributionGarmin className="pb-3" />
          <MedicalDisclaimer lang={String(profile?.preferred_language ?? "fr")} />
        </div>
        {/* Bulle d'aide : hors du flux, disponible sur TOUTES les pages — une question de
            support naît devant l'écran qui pose problème, pas dans un menu séparé. */}
        <SupportBubble />
      </div>
    </LanguageProvider>
  );
}
