export const dynamic = "force-dynamic";
import { stripProfileSecrets } from "@/lib/profile/safe";
import { T, normLang } from "@/lib/i18n/translations";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { FileAttenteCourses } from "@/components/courses/FileAttenteCourses";
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
import { Logo } from "@/components/brand/Logo";
import { EcranLancement } from "@/components/layout/EcranLancement";
import { MiseAJour } from "@/components/layout/MiseAJour";
import { CLE_SESSION_LANCEMENT } from "@/lib/ui/lancement";

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
  const brutMasquees = ((settingsRow?.data ?? {}) as Record<string, unknown>).notifsMasquees;
  const notifsMasquees = Array.isArray(brutMasquees) ? brutMasquees.filter((x): x is string => typeof x === "string") : [];

  if (profile && !profile.onboarding_completed) redirect("/onboarding");
  const langue = normLang(String(profile?.preferred_language ?? "fr"));

  return (
    <LanguageProvider initialLang={langue} dict={T[langue]} userId={user.id}>
      <FuseauProvider fuseau={fuseau}>
      {/* ── ÉCRAN DE LANCEMENT ─────────────────────────────────────────────────────
          Rendu ICI, par le serveur, pour être visible dès la première image ; sa sortie
          est décidée par <EcranLancement />. Le petit script le masque AVANT la moindre
          peinture s'il a déjà été vu dans cette session — sans quoi il flasherait à
          chaque rechargement. `suppressHydrationWarning` : ce script modifie l'élément
          avant l'hydratation, c'est voulu. */}
      <div id="lancement" aria-hidden="true" suppressHydrationWarning
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FAFAFA]">
        <div className="lancement-logo"><Logo size={76} /></div>
        <div className="lancement-nom mt-4 text-[22px] font-bold tracking-tight text-zinc-900">Pacevo</div>
        <div className="lancement-barre mt-6 h-[3px] w-28 overflow-hidden rounded-full bg-zinc-200"><span /></div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem(${JSON.stringify(CLE_SESSION_LANCEMENT)}))document.getElementById("lancement").setAttribute("data-vu","")}catch(e){}` }} />
      <EcranLancement />
      <div className="flex h-screen bg-[#FAFAFA] overflow-hidden">
        <AutoSync />
        {/* Un onglet resté ouvert pendant une mise en ligne passe à la nouvelle version. */}
        <MiseAJour />
        <MessageNotifier />
        {/* Les courses enregistrées sans réseau repartent dès que le réseau revient. */}
        <FileAttenteCourses />
        <Sidebar profile={stripProfileSecrets(profile)} unreadMessages={unreadMessages ?? 0} estEditeur={estAdmin(user.email)} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar profile={stripProfileSecrets(profile)} avatarColor={avatarColor} notifsMasquees={notifsMasquees} />
          <main className="flex-1 overflow-auto p-3 md:p-6">
            {children}
          </main>
          {/* ⚠️ ICI, ET PAS PAGE PAR PAGE. L'article 1.1 des conditions d'API
              d'intervals.icu impose d'attribuer à Garmin toute information dérivée de ses
              données. Elle était posée sur quatre pages choisies à la main — et HUIT
              autres vues lisaient les mêmes tables sans rien afficher (heatmap, survol,
              trophées, clubs, ligues, profil…). Une liste tenue à la main s'oublie ; le
              layout, non : toute page présente et à venir la porte. */}
          {/* ⚠️ LA LIGNE GARMIN RESTE SUR TÉLÉPHONE, même si Cyprien a demandé (21/09/2026)
              d'alléger le bas de l'écran : c'est la contrepartie contractuelle de l'API
              dont dépend tout le produit, pas un texte de confort. Elle est ramenée à une
              seule ligne serrée (~22 px). L'avertissement médical, lui, part dans la
              feuille « Plus » sous md : il reste à un geste sur chaque page. */}
          <AttributionGarmin className="px-2 py-1 text-[10px] leading-tight tracking-tight md:px-6 md:pb-3 md:text-[11px] md:leading-relaxed md:tracking-normal" />
          <div className="hidden shrink-0 md:block">
            <MedicalDisclaimer lang={langue} />
          </div>
          {/* Téléphone seulement : la barre d'onglets (Accueil · Carte · Enregistrer ·
              Calendrier · Plus) et la cale qui lui réserve sa place sous le pied de page. */}
          {/* L'avertissement médical est rendu ICI, côté serveur, et passé en nœud : importé
              depuis la barre (composant client), il aurait embarqué le dictionnaire entier
              (183 kB) dans le JavaScript de chaque page. */}
          <MobileTabBar unreadMessages={unreadMessages ?? 0} estEditeur={estAdmin(user.email)} avertissement={<MedicalDisclaimer lang={langue} />} />
        </div>
        {/* Bulle d'aide : hors du flux, disponible sur TOUTES les pages — une question de
            support naît devant l'écran qui pose problème, pas dans un menu séparé. */}
        <SupportBubble />
      </div>
      </FuseauProvider>
    </LanguageProvider>
  );
}
