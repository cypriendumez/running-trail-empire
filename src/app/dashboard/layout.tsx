export const dynamic = "force-dynamic";
import { stripProfileSecrets } from "@/lib/profile/safe";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MedicalDisclaimer } from "@/components/layout/MedicalDisclaimer";
import { AutoSync } from "@/components/AutoSync";
import { MessageNotifier } from "@/components/messages/MessageNotifier";
import { SupportBubble } from "@/components/support/SupportBubble";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { FuseauProvider } from "@/lib/time/FuseauProvider";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AttributionGarmin } from "@/components/legal/AttributionGarmin";
import { estAdmin } from "@/lib/admin/acces";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ⚠️ LE FUSEAU EST LU ICI, CÔTÉ SERVEUR, ET DESCENDU DANS L'ARBRE. C'est la seule
  // façon que le serveur et le navigateur écrivent le MÊME texte : le serveur tourne à
  // iad1 (États-Unis), donc tout ce qu'il date sans fuseau explicite est décalé. Mesuré :
  // 23 erreurs React #418, dont 96 % entre minuit et 6 h à Paris — la fenêtre où les
  // deux machines ne sont pas le même jour.
  const fuseau = decodeURIComponent((await cookies()).get("pacevo_tz")?.value ?? "");

  const [{ data: profile }, { count: unreadMessages }, { data: settingsRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("notifications").select("id", { count: "exact", head: true })
      // La pastille compte AUSSI les messages d'athlètes : un message qu'on ne voit pas
      // arriver est un message auquel on ne répond pas.
      .eq("user_id", user.id).in("type", ["coach_message", "athlete_message"]).eq("read", false),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle(),
  ]);
  const avatarColor = String(((settingsRow?.data ?? {}) as Record<string, unknown>).avatarColor ?? "emerald");

  if (profile && !profile.onboarding_completed) redirect("/onboarding");

  return (
    <LanguageProvider initialLang={String(profile?.preferred_language ?? "fr")} userId={user.id}>
      <FuseauProvider fuseau={fuseau}>
      <div className="flex h-screen bg-[#FAFAFA] overflow-hidden">
        <AutoSync />
        <MessageNotifier />
        <Sidebar profile={stripProfileSecrets(profile)} unreadMessages={unreadMessages ?? 0} estEditeur={estAdmin(user.email)} />
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
      </FuseauProvider>
    </LanguageProvider>
  );
}
