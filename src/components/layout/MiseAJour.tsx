"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * LA NOUVELLE VERSION, SANS ATTENDRE UN RECHARGEMENT MANUEL.
 *
 * Constaté le 29/09/2026 : les captures de Cyprien montraient l'ANCIEN menu (et, la veille,
 * l'onglet « Coach IA » retiré) des heures après la mise en ligne. Le service worker n'y
 * est pour rien (réseau d'abord pour les pages) : c'est l'onglet — ou l'application
 * installée — resté ouvert. Next navigue sans recharger, et le JavaScript chargé au
 * premier affichage continue de tourner.
 *
 * Ce build connaît sa version (`NEXT_PUBLIC_VERSION`, fixée par next.config depuis le
 * tampon `version.json`). On relit celle EN LIGNE au retour sur l'onglet et toutes les
 * 15 min ; si elle diffère :
 *   - à la PROCHAINE navigation, la page se recharge d'elle-même — l'athlète arrive sur
 *     la nouvelle version sans rien faire, et sans perdre une saisie en cours ;
 *   - d'ici là, une pastille discrète propose de le faire tout de suite.
 */
export const MA_VERSION = process.env.NEXT_PUBLIC_VERSION ?? "";

const L: Record<string, { texte: string; bouton: string }> = {
  fr: { texte: "Nouvelle version de Pacevo", bouton: "Mettre à jour" },
  en: { texte: "New version of Pacevo", bouton: "Update" },
  de: { texte: "Neue Version von Pacevo", bouton: "Aktualisieren" },
  es: { texte: "Nueva versión de Pacevo", bouton: "Actualizar" },
  pt: { texte: "Nova versão da Pacevo", bouton: "Atualizar" },
};

/** Une version en ligne différente de la nôtre, et lisible des deux côtés. */
export const versionPlusRecente = (enLigne: unknown, locale: string) =>
  typeof enLigne === "string" && /^[0-9a-f]{7,40}$/.test(enLigne) && /^[0-9a-f]{7,40}$/.test(locale) && enLigne !== locale;

export function MiseAJour() {
  const { lang } = useT();
  const d = L[lang] ?? L.fr;
  const pathname = usePathname();
  const [dispo, setDispo] = useState(false);
  const dispoRef = useRef(false);
  dispoRef.current = dispo;
  const cheminPrecedent = useRef(pathname);

  useEffect(() => {
    if (!MA_VERSION) return;
    let fini = false;
    const verifier = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/version.json", { cache: "no-store" });
        const j = (await r.json()) as { commit?: string };
        if (!fini && versionPlusRecente(j?.commit, MA_VERSION)) setDispo(true);
      } catch { /* hors ligne : on réessaiera */ }
    };
    const premiere = setTimeout(verifier, 30_000);
    const minuterie = setInterval(verifier, 15 * 60_000);
    document.addEventListener("visibilitychange", verifier);
    return () => { fini = true; clearTimeout(premiere); clearInterval(minuterie); document.removeEventListener("visibilitychange", verifier); };
  }, []);

  // À la navigation SUIVANTE, on bascule : la page demandée se charge dans la nouvelle
  // version. ⚠️ Sur un CHANGEMENT de page seulement — jamais au moment de la détection,
  // qui peut tomber en pleine saisie.
  useEffect(() => {
    if (cheminPrecedent.current === pathname) return;
    cheminPrecedent.current = pathname;
    if (dispoRef.current) window.location.reload();
  }, [pathname]);

  if (!dispo) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[65] flex justify-center px-3 md:bottom-6">
      <div className="flex items-center gap-3 rounded-full bg-zinc-900 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-xl">
        <span>{d.texte}</span>
        <button type="button" onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400">
          <RefreshCw className="h-3.5 w-3.5" />{d.bouton}
        </button>
      </div>
    </div>
  );
}
