"use client";

/**
 * L'EXPÉRIENCE « APPLICATION » CÔTÉ NAVIGATEUR : enregistrer le service worker et proposer
 * l'installation sur l'écran d'accueil.
 *
 * ⚠️ DEUX MONDES DIFFÉRENTS, ET C'EST POUR ÇA QU'IL FAUT DEUX CHEMINS.
 *  - Android / Chrome : le navigateur émet `beforeinstallprompt`. On le capte, on empêche la
 *    mini-bannière native, et on montre NOTRE bouton — au moment choisi, dans la langue de la
 *    personne. `prompt()` déclenche l'installation officielle.
 *  - iPhone / Safari : Apple n'émet AUCUN événement d'installation. Le seul moyen est le geste
 *    manuel (Partager → « Sur l'écran d'accueil »). On ne peut donc que l'EXPLIQUER — un bouton
 *    « installer » y serait un mensonge, il ne ferait rien.
 *
 * On n'affiche jamais rien si l'app est DÉJÀ installée (mode `standalone`), et un rejet est
 * mémorisé (localStorage) pour ne pas harceler. Tout accès au stockage est protégé : en
 * navigation privée, `localStorage` peut lever une exception.
 */
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PWA_I18N } from "@/components/pwa/pwaI18n";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const CLE_REJET = "pacevo_pwa_rejet";
const REPIT_MS = 14 * 24 * 60 * 60 * 1000; // 14 jours après un rejet

function rejeteRecemment(): boolean {
  try {
    const t = Number(localStorage.getItem(CLE_REJET) || 0);
    return t > 0 && Date.now() - t < REPIT_MS;
  } catch { return false; }
}

export function PwaClient() {
  const { lang } = useT();
  const L = PWA_I18N[lang] ?? PWA_I18N.fr;
  const [invite, setInvite] = useState<PromptEvent | null>(null); // Android : événement natif
  const [ios, setIos] = useState(false); // iPhone : instructions manuelles
  const [visible, setVisible] = useState(false);

  // Enregistrement du service worker (hors-ligne + base des notifications). Best effort :
  // un échec ne doit rien casser du site.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Déjà installée → on ne propose rien.
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || rejeteRecemment()) return;

    const ua = navigator.userAgent || "";
    const estIOS = /iphone|ipad|ipod/i.test(ua)
      || (/Macintosh/.test(ua) && "ontouchend" in document); // iPad récent se déclare « Macintosh »

    // Android / Chrome : on attend l'événement, sinon rien ne s'affiche (l'app n'est pas
    // installable sur ce navigateur, mieux vaut se taire que promettre).
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInvite(e as PromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iPhone : pas d'événement possible → on montre les instructions après un court délai,
    // le temps que la personne voie d'abord l'app.
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    if (estIOS) {
      minuteur = setTimeout(() => { setIos(true); setVisible(true); }, 4000);
    }

    // Si l'app est installée pendant la visite, on retire la proposition.
    const onInstalled = () => { setVisible(false); memoriseRejet(); };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (minuteur) clearTimeout(minuteur);
    };
  }, []);

  function memoriseRejet() {
    try { localStorage.setItem(CLE_REJET, String(Date.now())); } catch { /* navigation privée */ }
  }

  function fermer() { setVisible(false); memoriseRejet(); }

  async function installer() {
    if (!invite) return;
    await invite.prompt();
    await invite.userChoice.catch(() => null);
    setInvite(null);
    setVisible(false);
    memoriseRejet();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6 flex justify-center pointer-events-none">
      <div role="dialog" aria-label={L.installTitle}
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl p-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5"><Logo size={36} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">{ios ? L.iosTitle : L.installTitle}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{ios ? L.iosBody : L.installBody}</p>
          {!ios && (
            <button type="button" onClick={installer}
              className="btn-brand justify-center inline-flex mt-3 px-4 py-2 text-sm">
              <Download className="w-4 h-4" /> {L.installBtn}
            </button>
          )}
        </div>
        <button type="button" onClick={fermer} aria-label={L.later}
          className="shrink-0 text-zinc-400 hover:text-zinc-700 p-1 -m-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
