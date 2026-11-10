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
 * QUAND la proposition se montre (règles et raisons dans `invitation.ts`) : seulement dans
 * l'application (`/dashboard`), seulement sur un appareil tactile, jamais si l'app est DÉJÀ
 * installée (mode `standalone`), et un rejet est mémorisé (localStorage) pour ne pas
 * harceler. Tout accès au stockage est protégé : en navigation privée, `localStorage` peut
 * lever une exception, d'où la fermeture gardée AUSSI en mémoire (`ferme`).
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PWA_I18N } from "@/components/pwa/pwaI18n";
import { appareilAInviter, pageOuInviter } from "@/components/pwa/invitation";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const CLE_REJET = "pacevo_pwa_rejet";
const REPIT_MS = 14 * 24 * 60 * 60 * 1000; // 14 jours après un rejet
const DELAI_MS = 4000; // le temps de voir l'écran avant qu'on propose quoi que ce soit

function rejeteRecemment(): boolean {
  try {
    const t = Number(localStorage.getItem(CLE_REJET) || 0);
    return t > 0 && Date.now() - t < REPIT_MS;
  } catch { return false; }
}

export function PwaClient() {
  const { lang } = useT();
  const L = PWA_I18N[lang] ?? PWA_I18N.fr;
  const dansAppli = pageOuInviter(usePathname());
  const [invite, setInvite] = useState<PromptEvent | null>(null); // Android : événement natif
  const [ios, setIos] = useState(false); // iPhone : instructions manuelles
  const [ferme, setFerme] = useState(false); // fermée pendant cette visite, même sans stockage
  const [pose, setPose] = useState(false); // la personne a eu le temps de voir l'écran

  // Enregistrement du service worker (hors-ligne + base des notifications). Best effort :
  // un échec ne doit rien casser du site.
  //
  // ⚠️ JAMAIS EN DÉVELOPPEMENT. Le worker sert `/_next/static/` CACHE D'ABORD, ce qui est
  // juste en production (URL hachées, immuables) et FAUX avec `next dev`, où la feuille
  // de style garde la même URL d'une modification à l'autre. Résultat, constaté cinq
  // fois en deux jours : des classes présentes dans le DOM sans aucune règle CSS — une
  // panne indiscernable d'une classe Tailwind hors échelle, sauf qu'ici la classe est
  // bonne. Deux heures perdues à chercher un bogue Tailwind qui était un cache.
  // Et s'il en reste un d'une session précédente, on le désinscrit.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    // Déjà installée, refusée récemment, ou ordinateur → on ne propose rien et on ne capte
    // rien : le navigateur garde son propre chemin d'installation.
    const installee = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    const tactile = window.matchMedia?.("(pointer: coarse)").matches === true;
    if (!appareilAInviter({ installee, tactile, rejetRecent: rejeteRecemment() })) return;

    const ua = navigator.userAgent || "";
    const estIOS = /iphone|ipad|ipod/i.test(ua)
      || (/Macintosh/.test(ua) && "ontouchend" in document); // iPad récent se déclare « Macintosh »

    // Android / Chrome : on attend l'événement, sinon rien ne s'affiche (l'app n'est pas
    // installable sur ce navigateur, mieux vaut se taire que promettre). L'événement arrive au
    // chargement, souvent sur une page publique : on le GARDE, et on ne le montre que dans
    // l'application. ⚠️ Chrome le réémet après un refus de sa fenêtre d'installation : c'est
    // `ferme` qui empêche alors la proposition de revenir.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInvite(e as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iPhone : pas d'événement possible → on ne peut qu'expliquer le geste.
    if (estIOS) setIos(true);

    // Si l'app est installée pendant la visite, on retire la proposition.
    const onInstalled = () => { setFerme(true); memoriseRejet(); };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Dans l'application seulement, et après un court délai : on laisse d'abord voir l'écran.
  useEffect(() => {
    if (!dansAppli) return;
    const minuteur = setTimeout(() => setPose(true), DELAI_MS);
    return () => { clearTimeout(minuteur); setPose(false); };
  }, [dansAppli]);

  function memoriseRejet() {
    try { localStorage.setItem(CLE_REJET, String(Date.now())); } catch { /* navigation privée */ }
  }

  function fermer() { setFerme(true); memoriseRejet(); }

  async function installer() {
    if (!invite) return;
    // `prompt()` ne sert qu'une fois par événement et lève s'il est rappelé : quoi qu'il
    // arrive, la proposition se retire.
    try {
      await invite.prompt();
      await invite.userChoice;
    } catch { /* fenêtre déjà servie ou refusée par le navigateur */ }
    setInvite(null);
    fermer();
  }

  const visible = dansAppli && pose && !ferme && (invite !== null || ios);
  if (!visible) return null;

  // Au-dessus de la barre d'onglets du téléphone (même réserve que `MiseAJour`), sinon la
  // proposition recouvre la navigation.
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-3 pointer-events-none md:bottom-6">
      <div role="dialog" aria-label={ios ? L.iosTitle : L.installTitle}
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl p-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5"><Logo size={36} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">{ios ? L.iosTitle : L.installTitle}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{ios ? L.iosBody : L.installBody}</p>
          {/* La sortie est écrite en toutes lettres : une croix seule ne se voit pas. */}
          <div className="mt-3 flex flex-wrap items-center gap-1">
            {!ios && (
              <button type="button" onClick={installer}
                className="btn-brand justify-center inline-flex px-4 py-2 text-sm">
                <Download className="w-4 h-4" /> {L.installBtn}
              </button>
            )}
            <button type="button" onClick={fermer}
              className={`rounded-lg py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 ${ios ? "pr-3" : "px-3"}`}>
              {L.later}
            </button>
          </div>
        </div>
        <button type="button" onClick={fermer} aria-label={L.close}
          className="shrink-0 rounded-lg p-2 -m-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
