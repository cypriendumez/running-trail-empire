"use client";

/**
 * PAGE HORS-LIGNE — servie par le service worker quand une navigation échoue faute de réseau.
 *
 * Elle est volontairement autonome : aucune donnée à charger, aucun appel réseau. Le service
 * worker la précharge à l'installation, donc elle s'affiche même sans connexion. Le bouton
 * recharge simplement la page — dès que le réseau revient, l'app reprend normalement.
 */
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PWA_I18N } from "@/components/pwa/pwaI18n";

export default function OfflinePage() {
  const { lang } = useT();
  const L = PWA_I18N[lang] ?? PWA_I18N.fr;
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-[#FAFAFA]">
      <div className="inline-flex items-center gap-2.5 mb-8">
        <Logo size={40} />
        <Wordmark className="text-xl" />
      </div>
      <div className="w-16 h-16 bg-zinc-100 rounded-3xl flex items-center justify-center mb-6">
        <WifiOff className="w-8 h-8 text-zinc-500" />
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-3">{L.offlineTitle}</h1>
      <p className="text-zinc-500 max-w-sm mb-8">{L.offlineBody}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="btn-brand justify-center inline-flex px-8 py-3"
      >
        {L.offlineRetry}
      </button>
    </main>
  );
}
